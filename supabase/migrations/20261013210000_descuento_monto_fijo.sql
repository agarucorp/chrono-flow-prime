-- Descuento fijo en pesos, además del porcentaje.
-- El recálculo de la cuota lo respeta: primero el porcentaje y después el monto.

alter table public.cuotas_mensuales
  add column if not exists descuento_monto numeric(12,2) not null default 0;

comment on column public.cuotas_mensuales.descuento_monto is
  'Pesos a descontar de la cuota, después del porcentaje.';

create or replace function public.fn_ajuste_cambio_plan_mes(
  p_usuario_id uuid,
  p_anio integer,
  p_mes integer
)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_target date := make_date(p_anio, p_mes, 1);
  v_desde date;
  v_cursor date;
  v_rest numeric := 0;
  v_base numeric;
  v_clases integer;
  v_tarifa numeric;
  v_desc numeric;
  v_desc_monto numeric;
  v_origen numeric;
begin
  select min(make_date(c.anio, c.mes, 1))
    into v_desde
  from public.cuotas_mensuales c
  where c.usuario_id = p_usuario_id
    and c.ajuste_origen is not null
    and make_date(c.anio, c.mes, 1) <= v_target
    and make_date(c.anio, c.mes, 1) >= (v_target - interval '14 months')::date;

  if v_desde is null then
    return 0;
  end if;

  v_cursor := v_desde;
  while v_cursor <= v_target loop
    select c.ajuste_origen, c.clases_a_cobrar, c.tarifa_unitaria, c.descuento_porcentaje, c.descuento_monto
      into v_origen, v_clases, v_tarifa, v_desc, v_desc_monto
    from public.cuotas_mensuales c
    where c.usuario_id = p_usuario_id
      and c.anio = extract(year from v_cursor)::int
      and c.mes = extract(month from v_cursor)::int;

    v_rest := v_rest + coalesce(v_origen, 0);

    if v_cursor = v_target then
      return v_rest;
    end if;

    v_base := greatest(0, round(
      coalesce(v_clases, 0) * coalesce(v_tarifa, 0)
      * (1 - coalesce(v_desc, 0) / 100.0)
      - coalesce(v_desc_monto, 0),
      2
    ));
    if v_base + v_rest >= 0 then
      v_rest := 0;
    else
      v_rest := v_base + v_rest;
    end if;

    v_cursor := (v_cursor + interval '1 month')::date;
  end loop;

  return v_rest;
end;
$$;

revoke all on function public.fn_ajuste_cambio_plan_mes(uuid, integer, integer) from public, anon, authenticated;

create or replace function public.fn_recalcular_cuota_mensual(
  p_usuario_id uuid,
  p_anio integer,
  p_mes integer
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_prev date := (make_date(p_anio, p_mes, 1) - interval '1 month')::date;
  v_mes record;
  v_prev_real record;
  v_prev_congelado integer;
  v_arrastre integer := 0;
  v_a_cobrar integer;
  v_tarifa numeric(12,2);
  v_base numeric(12,2);
  v_base_desc numeric(12,2);
  v_ajuste numeric(12,2) := 0;
  v_aplicado numeric(12,2) := 0;
  v_monto numeric(12,2);
  v_monto_desc numeric(12,2);
  v_descuento numeric := 0;
  v_descuento_monto numeric := 0;
  v_existe boolean;
  v_combo integer;
begin
  if auth.uid() is not null
     and auth.uid() <> p_usuario_id
     and not public.is_user_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select exists (
    select 1 from public.cuotas_mensuales c
    where c.usuario_id = p_usuario_id and c.anio = p_anio and c.mes = p_mes
  ) into v_existe;

  if public.fn_es_mes_congelado(p_anio, p_mes) and v_existe then
    return;
  end if;

  select * into v_mes
  from public.fn_clases_mes_usuario(p_usuario_id, p_anio, p_mes);

  select coalesce(c.clases_base_arrastre, c.clases_mes)
    into v_prev_congelado
  from public.cuotas_mensuales c
  where c.usuario_id = p_usuario_id
    and c.anio = extract(year from v_prev)::int
    and c.mes = extract(month from v_prev)::int;

  if v_prev_congelado is not null then
    select * into v_prev_real
    from public.fn_clases_mes_usuario(
      p_usuario_id,
      extract(year from v_prev)::int,
      extract(month from v_prev)::int
    );
    v_arrastre := v_prev_real.neto - v_prev_congelado;
  end if;

  v_ajuste := coalesce(public.fn_ajuste_cambio_plan_mes(p_usuario_id, p_anio, p_mes), 0);

  if v_mes.plan = 0 and v_mes.vacantes = 0 and v_arrastre = 0 and v_ajuste = 0 and not v_existe then
    return;
  end if;

  v_tarifa := public.fn_tarifa_unitaria_mes(p_usuario_id, p_anio, p_mes);
  v_a_cobrar := greatest(0, v_mes.neto + v_arrastre);
  v_base := round(v_a_cobrar * v_tarifa, 2);

  select coalesce(c.descuento_porcentaje, 0), coalesce(c.descuento_monto, 0)
    into v_descuento, v_descuento_monto
  from public.cuotas_mensuales c
  where c.usuario_id = p_usuario_id and c.anio = p_anio and c.mes = p_mes;

  v_base_desc := greatest(
    0,
    round(v_base * (1 - coalesce(v_descuento, 0) / 100.0), 2) - coalesce(v_descuento_monto, 0)
  );

  if v_base_desc + v_ajuste < 0 then
    v_aplicado := -v_base_desc;
    v_monto_desc := 0;
  else
    v_aplicado := v_ajuste;
    v_monto_desc := v_base_desc + v_ajuste;
  end if;

  if v_base + v_ajuste < 0 then
    v_monto := 0;
  else
    v_monto := v_base + v_ajuste;
  end if;

  v_combo := public.fn_plan_combo_mes(p_usuario_id, p_anio, p_mes);
  if v_combo is null or v_combo < 1 or v_combo > 5 then
    v_combo := null;
  end if;

  insert into public.cuotas_mensuales (
    usuario_id, anio, mes,
    clases_previstas, clases_reservadas,
    clases_canceladas_anticipacion, clases_canceladas_tardia,
    clases_mes, ajuste_clases, clases_a_cobrar,
    tarifa_unitaria, monto_total, monto_con_descuento,
    combo_aplicado, estado_pago, generado_el,
    ajuste_aplicado
  ) values (
    p_usuario_id, p_anio, p_mes,
    v_mes.plan, v_mes.vacantes,
    v_mes.creditos, v_mes.tardias,
    v_mes.neto, v_arrastre, v_a_cobrar,
    v_tarifa, v_monto, v_monto_desc,
    v_combo, 'pendiente', now(),
    v_aplicado
  )
  on conflict (usuario_id, anio, mes) do update set
    clases_previstas = excluded.clases_previstas,
    clases_reservadas = excluded.clases_reservadas,
    clases_canceladas_anticipacion = excluded.clases_canceladas_anticipacion,
    clases_canceladas_tardia = excluded.clases_canceladas_tardia,
    clases_mes = excluded.clases_mes,
    ajuste_clases = excluded.ajuste_clases,
    clases_a_cobrar = excluded.clases_a_cobrar,
    tarifa_unitaria = excluded.tarifa_unitaria,
    monto_total = excluded.monto_total,
    monto_con_descuento = case
      when coalesce(public.cuotas_mensuales.descuento_porcentaje, 0) > 0
        or coalesce(public.cuotas_mensuales.descuento_monto, 0) > 0
        then greatest(0, round(
          excluded.clases_a_cobrar * excluded.tarifa_unitaria
          * (1 - coalesce(public.cuotas_mensuales.descuento_porcentaje, 0) / 100.0), 2
        ) - coalesce(public.cuotas_mensuales.descuento_monto, 0) + excluded.ajuste_aplicado)
      else excluded.monto_con_descuento
    end,
    combo_aplicado = excluded.combo_aplicado,
    ajuste_aplicado = excluded.ajuste_aplicado,
    generado_el = now();
end;
$$;

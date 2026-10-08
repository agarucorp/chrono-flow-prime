-- Cambiar de plan rige desde el día siguiente.
-- La cuota del mes en curso no se reescribe (está paga por adelantado).
-- La diferencia de precio entre lo ya emitido y lo que va a cursar
-- se suma o se resta en la cuota del mes siguiente, y si no alcanza
-- sigue en los meses posteriores.

alter table public.cuotas_mensuales
  add column if not exists clases_base_arrastre integer,
  add column if not exists ajuste_origen numeric(12,2),
  add column if not exists ajuste_aplicado numeric(12,2) not null default 0;

comment on column public.cuotas_mensuales.clases_base_arrastre is
  'Neto del mes ya contemplado al cambiar de plan. El arrastre posterior solo cuenta lo que cambie después de ese momento.';

comment on column public.cuotas_mensuales.ajuste_origen is
  'Diferencia de precio del cambio de plan, en pesos, para empezar a aplicar en este mes. Negativo es a favor del alumno.';

comment on column public.cuotas_mensuales.ajuste_aplicado is
  'Parte de esa diferencia que efectivamente entra en esta cuota. El resto pasa al mes siguiente.';

-- Clases del plan entre dos fechas, con las mismas bajas que usa la cuota.
create or replace function public.fn_contar_clases_plan(
  p_usuario_id uuid,
  p_desde date,
  p_hasta date
)
returns integer
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with slots as (
    select s.fecha, s.clase_numero
    from public.fn_slots_disponibilidad(p_desde, p_hasta) s
    where s.origen = 'regular'
  )
  select coalesce(count(*), 0)::int
  from generate_series(p_desde, p_hasta, interval '1 day') d
  join public.horarios_recurrentes_usuario h
    on h.usuario_id = p_usuario_id
   and coalesce(h.activo, true)
   and h.dia_semana = case when extract(dow from d)::int = 0 then 7
                           else extract(dow from d)::int end
   and (h.fecha_inicio is null or h.fecha_inicio <= d::date)
   and (h.fecha_fin is null or h.fecha_fin >= d::date)
  join slots s
    on s.fecha = d::date
   and s.clase_numero = h.clase_numero
  where p_desde <= p_hasta;
$$;

revoke all on function public.fn_contar_clases_plan(uuid, date, date) from public, anon, authenticated;

-- Cuánto del ajuste de un cambio de plan le toca a este mes.
-- Recorre desde el ajuste más viejo y va absorbiendo cada cuota,
-- así un segundo recálculo no lo aplica dos veces.
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
    select c.ajuste_origen, c.clases_a_cobrar, c.tarifa_unitaria, c.descuento_porcentaje
      into v_origen, v_clases, v_tarifa, v_desc
    from public.cuotas_mensuales c
    where c.usuario_id = p_usuario_id
      and c.anio = extract(year from v_cursor)::int
      and c.mes = extract(month from v_cursor)::int;

    v_rest := v_rest + coalesce(v_origen, 0);

    if v_cursor = v_target then
      return v_rest;
    end if;

    v_base := round(
      coalesce(v_clases, 0) * coalesce(v_tarifa, 0)
      * (1 - coalesce(v_desc, 0) / 100.0),
      2
    );
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

  select coalesce(c.descuento_porcentaje, 0) into v_descuento
  from public.cuotas_mensuales c
  where c.usuario_id = p_usuario_id and c.anio = p_anio and c.mes = p_mes;

  if coalesce(v_descuento, 0) > 0 then
    v_base_desc := round(v_base * (1 - v_descuento / 100.0), 2);
  else
    v_base_desc := v_base;
  end if;

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
        then greatest(0, round(
          excluded.clases_a_cobrar * excluded.tarifa_unitaria
          * (1 - public.cuotas_mensuales.descuento_porcentaje / 100.0), 2
        ) + excluded.ajuste_aplicado)
      else excluded.monto_con_descuento
    end,
    combo_aplicado = excluded.combo_aplicado,
    ajuste_aplicado = excluded.ajuste_aplicado,
    generado_el = now();
end;
$$;

create or replace function public.fn_trigger_recalcular_cuotas_horarios_actual_siguiente()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_usuario uuid;
begin
  if coalesce(current_setting('app.skip_recalc_cuota', true), '') = '1' then
    return coalesce(new, old);
  end if;

  v_usuario := coalesce(new.usuario_id, old.usuario_id);
  if v_usuario is not null then
    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(v_usuario);
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.fn_cambiar_plan(p_horario_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_manana date := v_hoy + 1;
  v_ini date := date_trunc('month', v_hoy)::date;
  v_fin date := (date_trunc('month', v_hoy) + interval '1 month - 1 day')::date;
  v_prox date := (date_trunc('month', v_hoy) + interval '1 month')::date;
  v_combo integer := coalesce(array_length(p_horario_ids, 1), 0);
  v_anio integer := extract(year from v_hoy)::int;
  v_mes integer := extract(month from v_hoy)::int;
  v_anio_sig integer := extract(year from v_prox)::int;
  v_mes_sig integer := extract(month from v_prox)::int;
  v_tarifa_vieja numeric(12,2);
  v_tarifa_nueva numeric(12,2);
  v_descuento numeric := 0;
  v_n_full integer;
  v_n_hoy integer;
  v_n_resto integer;
  v_y numeric(12,2);
  v_x numeric(12,2);
  v_delta numeric(12,2);
  v_neto integer;
  i integer;
  v_cursor date;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  perform public.fn_validar_horarios_plan(p_horario_ids, v_uid, v_manana);

  if not exists (
    select 1 from public.cuotas_mensuales c
    where c.usuario_id = v_uid and c.anio = v_anio and c.mes = v_mes
  ) then
    perform public.fn_recalcular_cuota_mensual(v_uid, v_anio, v_mes);
  end if;

  v_tarifa_vieja := public.fn_tarifa_unitaria_mes(v_uid, v_anio, v_mes);
  v_n_full := public.fn_contar_clases_plan(v_uid, v_ini, v_fin);

  select coalesce(c.descuento_porcentaje, 0) into v_descuento
  from public.cuotas_mensuales c
  where c.usuario_id = v_uid and c.anio = v_anio and c.mes = v_mes;

  -- El trigger no puede recalcular en el hueco en que el plan viejo ya
  -- cerró y el nuevo todavía no existe: esa cuota quedaría en 0 días.
  perform set_config('app.skip_recalc_cuota', '1', true);

  update public.horarios_recurrentes_usuario
  set fecha_fin = v_hoy, updated_at = now()
  where usuario_id = v_uid
    and coalesce(activo, true)
    and (fecha_fin is null or fecha_fin > v_hoy);

  insert into public.horarios_recurrentes_usuario (
    usuario_id, dia_semana, clase_numero, hora_inicio, hora_fin,
    horario_semanal_id, activo, fecha_inicio, combo_aplicado
  )
  select v_uid, hs.dia_semana, hs.clase_numero, hs.hora_inicio, hs.hora_fin,
         hs.id, true, v_manana, v_combo
  from public.horarios_semanales hs
  where hs.id = any (p_horario_ids);

  perform set_config('app.skip_recalc_cuota', '0', true);

  update public.turnos_variables
  set estado = 'cancelada', updated_at = now()
  where cliente_id = v_uid
    and turno_fecha >= v_prox
    and estado = 'confirmada';

  update public.profiles
  set combo_asignado = v_combo,
      combo_pendiente = null,
      tarifa_pendiente = null,
      fecha_cambio_plan = null,
      updated_at = now()
  where id = v_uid;

  v_tarifa_nueva := public.fn_tarifa_unitaria_mes(v_uid, v_anio_sig, v_mes_sig);
  v_n_hoy := public.fn_contar_clases_plan(v_uid, v_ini, v_hoy);
  v_n_resto := public.fn_contar_clases_plan(v_uid, v_manana, v_fin);

  v_y := round(v_n_full * v_tarifa_vieja * (1 - coalesce(v_descuento, 0) / 100.0), 2);
  v_x := round(
    (v_n_hoy * v_tarifa_vieja + v_n_resto * v_tarifa_nueva)
    * (1 - coalesce(v_descuento, 0) / 100.0),
    2
  );
  v_delta := v_x - v_y;

  select m.neto into v_neto
  from public.fn_clases_mes_usuario(v_uid, v_anio, v_mes) m;

  update public.cuotas_mensuales
  set clases_base_arrastre = v_neto
  where usuario_id = v_uid
    and anio = v_anio
    and mes = v_mes;

  perform public.fn_recalcular_cuota_mensual(v_uid, v_anio_sig, v_mes_sig);

  update public.cuotas_mensuales
  set ajuste_origen = v_delta
  where usuario_id = v_uid
    and anio = v_anio_sig
    and mes = v_mes_sig;

  v_cursor := v_prox;
  for i in 1..4 loop
    perform public.fn_recalcular_cuota_mensual(
      v_uid,
      extract(year from v_cursor)::int,
      extract(month from v_cursor)::int
    );
    v_cursor := (v_cursor + interval '1 month')::date;
  end loop;

  return jsonb_build_object(
    'combo', v_combo,
    'tarifa', v_tarifa_nueva,
    'desde', v_manana,
    'diferencia', v_delta,
    'clases_hasta_hoy', v_n_hoy,
    'clases_resto_mes', v_n_resto
  );
end;
$$;

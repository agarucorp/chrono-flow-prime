-- Cuotas: modelo "mes propio congelado + arrastre".
--
-- El problema que resuelve: el cálculo anterior sumaba a la cuota de M todas las
-- vacantes con fecha en M-1, sin distinguir si ya se habían cobrado. Una vacante
-- reservada en julio para el 10 de agosto se cobraba en agosto (agosto todavía
-- no estaba congelado) y otra vez en septiembre (por tener fecha en agosto).
-- Al mismo tiempo, una vacante reservada en agosto para el 15 de septiembre no
-- se cobraba nunca, porque no tenía fecha en agosto ni estaba en el plan.
--
-- Modelo nuevo, en clases y no en pesos:
--
--   propio(M)   = clases con fecha en M según el estado actual
--                 (plan + vacantes - créditos, sin los días que cerró el admin)
--   arrastre(M) = propio(M-1) - propio_congelado(M-1)
--   a_cobrar(M) = propio(M) + arrastre(M)
--
-- propio_congelado(M-1) es el valor que quedó grabado en la fila de M-1 cuando
-- ese mes pasó a ser el mes en curso. El arrastre es entonces exactamente lo que
-- cambió después de haberse cobrado: no puede duplicar ni perder nada.
--
-- Como el pago es adelantado, un cambio sobre un mes futuro impacta ese mes
-- directamente, y un cambio sobre el mes en curso (ya cobrado) viaja al
-- siguiente vía arrastre.

alter table public.cuotas_mensuales
  add column if not exists clases_mes integer not null default 0,
  add column if not exists ajuste_clases integer not null default 0;

comment on column public.cuotas_mensuales.clases_mes is
  'Clases netas con fecha en este mes. Se congela cuando el mes pasa a ser el mes en curso.';
comment on column public.cuotas_mensuales.ajuste_clases is
  'Arrastre del mes anterior: lo que cambió después de que ese mes ya estaba cobrado. Puede ser negativo.';
comment on column public.cuotas_mensuales.clases_previstas is
  'Clases del plan recurrente con fecha en este mes, sin los días que cerró el admin.';
comment on column public.cuotas_mensuales.clases_reservadas is
  'Vacantes con fecha en este mes que se cobran.';
comment on column public.cuotas_mensuales.clases_canceladas_anticipacion is
  'Clases con fecha en este mes canceladas a tiempo: no se cobran.';
comment on column public.cuotas_mensuales.clases_canceladas_tardia is
  'Clases con fecha en este mes canceladas fuera de plazo: se cobran igual.';

-- Desglose de un mes calendario según el estado actual de las tablas.
-- Es la única definición de "cuántas clases tiene este alumno en este mes".
create or replace function public.fn_clases_mes_usuario(
  p_usuario_id uuid,
  p_anio integer,
  p_mes integer
)
returns table (
  plan integer,
  vacantes integer,
  creditos integer,
  tardias integer,
  neto integer
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with rango as (
    select make_date(p_anio, p_mes, 1) as ini,
           (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date as fin
  ),
  -- Clases del plan que realmente se dan: el admin puede haber cerrado el día
  -- (feriado, ausencia, bloqueo) y entonces esa clase no existe ni se cobra.
  plan_mes as (
    select count(*)::int as n
    from rango r
    cross join generate_series(r.ini, r.fin, interval '1 day') d
    join public.horarios_recurrentes_usuario h
      on h.usuario_id = p_usuario_id
     and coalesce(h.activo, true)
     and h.dia_semana = case when extract(dow from d)::int = 0 then 7
                             else extract(dow from d)::int end
     and (h.fecha_inicio is null or h.fecha_inicio <= d::date)
     and (h.fecha_fin is null or h.fecha_fin >= d::date)
    where not public.fn_clase_dada_de_baja(d::date, h.clase_numero)
  ),
  -- Una vacante se cobra si sigue confirmada, o si el alumno la canceló fuera
  -- de plazo (el apercibimiento es justamente que se cobra igual).
  vacantes_mes as (
    select count(*)::int as n
    from rango r
    join public.turnos_variables tv
      on tv.cliente_id = p_usuario_id
     and tv.turno_fecha between r.ini and r.fin
    where not public.fn_clase_dada_de_baja(tv.turno_fecha, tv.clase_numero)
      and (
        tv.estado = 'confirmada'
        or exists (
          select 1
          from public.turnos_cancelados tc
          where tc.cliente_id = p_usuario_id
            and tc.turno_fecha = tv.turno_fecha
            and tc.clase_numero = tv.clase_numero
            and coalesce(tc.cancelacion_tardia, false)
            and lower(coalesce(tc.tipo_cancelacion, '')) = 'usuario'
        )
      )
  ),
  -- Créditos: clases del plan que el alumno canceló a tiempo, o que canceló el
  -- admin. Los días que cerró el admin ya salieron de plan_mes, así que se
  -- excluyen para no descontarlos dos veces.
  creditos_mes as (
    select count(*)::int as n
    from rango r
    join public.turnos_cancelados tc
      on tc.cliente_id = p_usuario_id
     and tc.turno_fecha between r.ini and r.fin
    where tc.origen = 'recurrente'
      and not coalesce(tc.cancelacion_tardia, false)
      and lower(coalesce(tc.tipo_cancelacion, '')) <> 'sistema'
      and not public.fn_clase_dada_de_baja(tc.turno_fecha, tc.clase_numero)
  ),
  tardias_mes as (
    select count(*)::int as n
    from rango r
    join public.turnos_cancelados tc
      on tc.cliente_id = p_usuario_id
     and tc.turno_fecha between r.ini and r.fin
    where coalesce(tc.cancelacion_tardia, false)
      and lower(coalesce(tc.tipo_cancelacion, '')) = 'usuario'
      and not public.fn_clase_dada_de_baja(tc.turno_fecha, tc.clase_numero)
  )
  select p.n, v.n, c.n, t.n, greatest(0, p.n + v.n - c.n)
  from plan_mes p, vacantes_mes v, creditos_mes c, tardias_mes t;
$$;

drop function if exists public.fn_upsert_cuota_mensual(
  uuid, integer, integer, integer, numeric, numeric, numeric, integer, integer, integer, integer
);

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
  v_monto numeric(12,2);
  v_monto_desc numeric(12,2);
  v_descuento numeric := 0;
  v_existe boolean;
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

  -- Mes en curso o pasado con cuota ya emitida: es lo que el alumno tiene que
  -- pagar y no se toca. Lo que cambie ahora sale en el arrastre del siguiente.
  if public.fn_es_mes_congelado(p_anio, p_mes) and v_existe then
    return;
  end if;

  select * into v_mes
  from public.fn_clases_mes_usuario(p_usuario_id, p_anio, p_mes);

  select c.clases_mes into v_prev_congelado
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

  -- Sin plan ni movimientos no hay cuota: no queremos filas en 0 esperando que
  -- el alumno elija un plan.
  if v_mes.plan = 0 and v_mes.vacantes = 0 and v_arrastre = 0 and not v_existe then
    return;
  end if;

  v_tarifa := public.fn_tarifa_unitaria_mes(p_usuario_id, p_anio, p_mes);
  v_a_cobrar := greatest(0, v_mes.neto + v_arrastre);
  v_monto := round(v_a_cobrar * v_tarifa, 2);

  select coalesce(c.descuento_porcentaje, 0) into v_descuento
  from public.cuotas_mensuales c
  where c.usuario_id = p_usuario_id and c.anio = p_anio and c.mes = p_mes;

  if coalesce(v_descuento, 0) > 0 then
    v_monto_desc := round(v_monto * (1 - v_descuento / 100.0), 2);
  else
    v_monto_desc := v_monto;
  end if;

  insert into public.cuotas_mensuales (
    usuario_id, anio, mes,
    clases_previstas, clases_reservadas,
    clases_canceladas_anticipacion, clases_canceladas_tardia,
    clases_mes, ajuste_clases, clases_a_cobrar,
    tarifa_unitaria, monto_total, monto_con_descuento,
    combo_aplicado, estado_pago, generado_el
  ) values (
    p_usuario_id, p_anio, p_mes,
    v_mes.plan, v_mes.vacantes,
    v_mes.creditos, v_mes.tardias,
    v_mes.neto, v_arrastre, v_a_cobrar,
    v_tarifa, v_monto, v_monto_desc,
    public.fn_plan_combo_mes(p_usuario_id, p_anio, p_mes), 'pendiente', now()
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
        then round(excluded.monto_total
                   * (1 - public.cuotas_mensuales.descuento_porcentaje / 100.0), 2)
      else excluded.monto_con_descuento
    end,
    combo_aplicado = excluded.combo_aplicado,
    generado_el = now();
end;
$$;

-- fn_es_mes_congelado se llama desde funciones SECURITY DEFINER, así que le
-- fijamos el search_path igual que al resto.
create or replace function public.fn_es_mes_congelado(p_anio integer, p_mes integer)
returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select (p_anio < extract(year from public.fn_mes_ar_hoy())::int)
      or (p_anio = extract(year from public.fn_mes_ar_hoy())::int
          and p_mes <= extract(month from public.fn_mes_ar_hoy())::int);
$$;

-- Legacy: no tenía search_path ni control de acceso, filtraba por profiles.valor_clase
-- (columna muerta) y su única llamada era una edge function que ya no se usa.
drop function if exists public.fn_generar_cuotas_mes_siguiente();

-- Cuotas viejas con clases_a_cobrar en 0 y monto_total calculado: el importe es
-- el que se le cobró al alumno, así que se conserva y se reconstruye el conteo
-- para que el histórico no muestre "0 clases" con un total distinto de cero.
update public.cuotas_mensuales
set clases_a_cobrar = round(monto_total / tarifa_unitaria)::int
where coalesce(clases_a_cobrar, 0) = 0
  and coalesce(monto_total, 0) > 0
  and coalesce(tarifa_unitaria, 0) > 0;

-- Arranque del modelo nuevo: las filas ya emitidas se toman como congeladas con
-- el neto que se les calcula hoy, para que el primer arrastre sea 0 y a nadie le
-- aparezca un cargo retroactivo por el cambio de fórmula.
update public.cuotas_mensuales c
set clases_mes = (
      select m.neto from public.fn_clases_mes_usuario(c.usuario_id, c.anio, c.mes) m
    ),
    ajuste_clases = 0
where public.fn_es_mes_congelado(c.anio, c.mes);

revoke all on function public.fn_clases_mes_usuario(uuid, integer, integer) from anon, authenticated;
revoke all on function public.fn_recalcular_cuota_mensual(uuid, integer, integer) from anon, authenticated;

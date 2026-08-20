-- =============================================================================
-- Fase 2 · Planes y cuotas
--
-- Problemas que corrige:
--
--   · El precio salía de profiles.tarifa_personalizada, que el propio alumno
--     escribía desde el front con un array hardcodeado (PAQUETES_PRECIOS),
--     duplicado de configuracion_admin. Si quedaba en null, obtener_tarifa_usuario
--     caía en tarifa_horaria, que vale 0: cuota de cero.
--   · El alta de plan eran tres escrituras sueltas desde el cliente (horarios,
--     perfil, recálculo). Si fallaba la segunda quedaba un plan sin tarifa.
--   · Las cancelaciones hechas por el admin no acreditaban nada al alumno.
--   · Una ausencia limitada a ciertas clases acreditaba el día entero.
--   · Cancelar una vacante restaba dos veces (dejaba de sumar y además acreditaba).
--   · Un perfil nuevo sin plan generaba una fila de cuota en cero.
--
-- Regla de negocio que se respeta en todo el archivo: el cobro es adelantado.
-- Lo que pasa en el mes M no altera la cuota de M, se refleja en M+1.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. La tarifa se deriva del plan, no la escribe el cliente
--
-- tarifa_personalizada recupera su significado original: precio negociado que
-- fija el admin a mano. Hoy todos los valores coinciden exactamente con el
-- precio de combo correspondiente (o sea, no hay ningún acuerdo especial real),
-- así que se limpian para que el precio pase a derivarse del combo.
-- -----------------------------------------------------------------------------
update public.profiles p
set tarifa_personalizada = null
where p.tarifa_personalizada is not null
  and p.tarifa_personalizada = (
    select case coalesce(p.combo_asignado, 0)
             when 1 then ca.combo_1_tarifa
             when 2 then ca.combo_2_tarifa
             when 3 then ca.combo_3_tarifa
             when 4 then ca.combo_4_tarifa
             when 5 then ca.combo_5_tarifa
           end
    from public.configuracion_admin ca
    order by ca.updated_at desc nulls last, ca.created_at desc nulls last
    limit 1
  );

-- Columnas del esquema de "plan pendiente", reemplazado por el cálculo por mes.
update public.profiles
set combo_pendiente = null, tarifa_pendiente = null, fecha_cambio_plan = null
where combo_pendiente is not null
   or tarifa_pendiente is not null
   or fecha_cambio_plan is not null;

-- Tamaño del plan vigente al cierre del mes pedido. Se mide en un día concreto
-- (el último) y no contando filas del rango: durante un cambio de plan conviven
-- el plan viejo y el nuevo, y contar el rango sumaría los dos.
create or replace function public.fn_plan_combo_mes(p_usuario_id uuid, p_anio integer, p_mes integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select least(count(*), 5)::int
  from public.horarios_recurrentes_usuario h
  where h.usuario_id = p_usuario_id
    and coalesce(h.activo, true)
    and (h.fecha_inicio is null
         or h.fecha_inicio <= (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date)
    and (h.fecha_fin is null
         or h.fecha_fin >= (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date);
$$;

create or replace function public.fn_tarifa_unitaria_mes(p_usuario_id uuid, p_anio integer, p_mes integer)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.tarifa_personalizada from public.profiles p where p.id = p_usuario_id),
    (select case public.fn_plan_combo_mes(p_usuario_id, p_anio, p_mes)
              when 1 then ca.combo_1_tarifa
              when 2 then ca.combo_2_tarifa
              when 3 then ca.combo_3_tarifa
              when 4 then ca.combo_4_tarifa
              when 5 then ca.combo_5_tarifa
              else 0
            end
     from public.configuracion_admin ca
     order by ca.updated_at desc nulls last, ca.created_at desc nulls last
     limit 1),
    0
  )::numeric(12,2);
$$;

-- -----------------------------------------------------------------------------
-- 2. ¿El admin dio de baja esta clase puntual?
--
-- Cubre día cerrado por ausencia total, feriado (habilitado o no: en ambos casos
-- la grilla regular de ese día desaparece), bloqueo de horario y ausencia
-- limitada a ciertas clases. Este último caso antes se ignoraba y se acreditaba
-- el día completo.
-- -----------------------------------------------------------------------------
create or replace function public.fn_clase_dada_de_baja(p_fecha date, p_clase_numero integer)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    e.cerrado
    or e.tipo in ('feriado', 'fin_semana')
    or exists (
      select 1 from public.ausencias_admin aa
      where aa.activo
        and p_fecha between aa.fecha_inicio and coalesce(aa.fecha_fin, aa.fecha_inicio)
        and p_clase_numero = any (aa.clases_canceladas)
    )
    or exists (
      select 1
      from public.horarios_bloqueados hb
      join public.horarios_semanales hs on hs.id = hb.horario_semanal_id
      where hb.activo and hb.fecha = p_fecha and hs.clase_numero = p_clase_numero
    )
  from public.fn_dia_estado(p_fecha) e;
$$;

-- -----------------------------------------------------------------------------
-- 3. Recálculo de la cuota
-- -----------------------------------------------------------------------------
create or replace function public.fn_recalcular_cuota_mensual(p_usuario_id uuid, p_anio integer, p_mes integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ini date := make_date(p_anio, p_mes, 1);
  v_fin date := (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date;
  v_prev_ini date := (v_ini - interval '1 month')::date;
  v_prev_fin date := (v_ini - interval '1 day')::date;
  v_plan_mes integer := 0;
  v_canceladas_tardia integer := 0;
  v_canceladas_anticipacion integer := 0;
  v_adj_vacantes_prev integer := 0;
  v_adj_cancelaciones_prev integer := 0;
  v_adj_credito_prev integer := 0;
  v_clases_a_cobrar integer := 0;
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

  -- Cobro adelantado: un mes que ya arrancó queda congelado.
  if public.fn_es_mes_congelado(p_anio, p_mes) and v_existe then
    return;
  end if;

  -- Base del mes: las clases del plan que efectivamente ocurren.
  -- Las que el admin dio de baja se acreditan en M+1, no se descuentan acá.
  select count(*)::int into v_plan_mes
  from generate_series(v_ini, v_fin, interval '1 day') d
  join public.horarios_recurrentes_usuario h
    on h.usuario_id = p_usuario_id
   and coalesce(h.activo, true)
   and h.dia_semana = case when extract(dow from d)::int = 0 then 7 else extract(dow from d)::int end
   and (h.fecha_inicio is null or h.fecha_inicio <= d::date)
   and (h.fecha_fin is null or h.fecha_fin >= d::date);

  -- Si no hay plan ni cuota previa no se crea una fila en cero: el usuario
  -- todavía no eligió plan y el sistema debe pedírselo, no facturarle nada.
  if v_plan_mes = 0 and not v_existe then
    return;
  end if;

  -- Contadores informativos del propio mes.
  select
    count(*) filter (where coalesce(tc.cancelacion_tardia, false)),
    count(*) filter (where not coalesce(tc.cancelacion_tardia, false))
  into v_canceladas_tardia, v_canceladas_anticipacion
  from public.turnos_cancelados tc
  where tc.cliente_id = p_usuario_id
    and tc.turno_fecha between v_ini and v_fin
    and lower(coalesce(tc.tipo_cancelacion, '')) = 'usuario';

  -- Vacantes tomadas el mes anterior: se cobran ahora.
  -- Una vacante cancelada fuera de plazo se sigue cobrando; cancelada a tiempo
  -- simplemente deja de sumar (no se acredita, nunca se había cobrado).
  select
    (select count(*)
       from public.turnos_variables tv
      where tv.cliente_id = p_usuario_id
        and tv.turno_fecha between v_prev_ini and v_prev_fin
        and tv.estado = 'confirmada'
        and not public.fn_clase_dada_de_baja(tv.turno_fecha, tv.clase_numero))
    +
    (select count(*)
       from public.turnos_cancelados tc
      where tc.cliente_id = p_usuario_id
        and tc.turno_fecha between v_prev_ini and v_prev_fin
        and tc.origen = 'variable'
        and coalesce(tc.cancelacion_tardia, false))
  into v_adj_vacantes_prev;

  -- Clases del plan canceladas el mes anterior: se acreditan ahora.
  -- Incluye las que canceló el admin (el alumno no debe pagarlas) y excluye las
  -- tardías. Las que cayeron en un día dado de baja se cuentan más abajo, para
  -- no acreditarlas dos veces.
  select count(*)::int into v_adj_cancelaciones_prev
  from public.turnos_cancelados tc
  where tc.cliente_id = p_usuario_id
    and tc.turno_fecha between v_prev_ini and v_prev_fin
    and tc.origen = 'recurrente'
    and not coalesce(tc.cancelacion_tardia, false)
    and lower(coalesce(tc.tipo_cancelacion, '')) <> 'sistema'
    and not public.fn_clase_dada_de_baja(tc.turno_fecha, tc.clase_numero);

  -- Clases del plan que el admin dio de baja el mes anterior (feriado, ausencia
  -- total o parcial, bloqueo de horario): se acreditan ahora.
  select count(*)::int into v_adj_credito_prev
  from generate_series(v_prev_ini, v_prev_fin, interval '1 day') d
  join public.horarios_recurrentes_usuario h
    on h.usuario_id = p_usuario_id
   and coalesce(h.activo, true)
   and h.dia_semana = case when extract(dow from d)::int = 0 then 7 else extract(dow from d)::int end
   and (h.fecha_inicio is null or h.fecha_inicio <= d::date)
   and (h.fecha_fin is null or h.fecha_fin >= d::date)
  where public.fn_clase_dada_de_baja(d::date, h.clase_numero);

  v_tarifa := public.fn_tarifa_unitaria_mes(p_usuario_id, p_anio, p_mes);

  v_clases_a_cobrar := greatest(
    0,
    v_plan_mes + v_adj_vacantes_prev - v_adj_cancelaciones_prev - v_adj_credito_prev
  );

  v_monto := round(v_clases_a_cobrar * v_tarifa, 2);

  select coalesce(c.descuento_porcentaje, 0) into v_descuento
  from public.cuotas_mensuales c
  where c.usuario_id = p_usuario_id and c.anio = p_anio and c.mes = p_mes;

  if coalesce(v_descuento, 0) > 0 then
    v_monto_desc := round(v_monto * (1 - v_descuento / 100.0), 2);
  else
    v_monto_desc := v_monto;
  end if;

  perform public.fn_upsert_cuota_mensual(
    p_usuario_id, p_anio, p_mes, v_plan_mes, v_tarifa,
    v_monto, v_monto_desc, v_plan_mes,
    v_canceladas_tardia, v_canceladas_anticipacion, v_clases_a_cobrar
  );
end;
$$;

-- Un perfil recién creado no tiene plan: no hay nada que recalcular hasta que
-- elija uno. Antes el INSERT disparaba el recálculo y generaba la cuota en cero.
create or replace function public.fn_trigger_recalcular_cuotas_profile_actual_siguiente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and (new.tarifa_personalizada is distinct from old.tarifa_personalizada
          or new.combo_asignado is distinct from old.combo_asignado
          or new.is_active is distinct from old.is_active
          or new.fecha_desactivacion is distinct from old.fecha_desactivacion) then
    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(new.id);
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Alta y cambio de plan en una sola transacción
--
-- El cliente manda los ids de horarios_semanales y nada más. El servidor deriva
-- día, clase, horas y tarifa: el alumno elige cuándo entrena, no cuánto paga.
-- -----------------------------------------------------------------------------
create or replace function public.fn_validar_horarios_plan(
  p_horario_ids uuid[],
  p_usuario_id uuid,
  p_desde date
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer := coalesce(array_length(p_horario_ids, 1), 0);
  v_validos integer;
  v_lleno record;
begin
  if v_total < 1 or v_total > 5 then
    raise exception 'El plan debe tener entre 1 y 5 clases semanales';
  end if;

  if v_total <> (select count(distinct x) from unnest(p_horario_ids) x) then
    raise exception 'Hay horarios repetidos en la selección';
  end if;

  select count(*) into v_validos
  from public.horarios_semanales hs
  where hs.id = any (p_horario_ids)
    and coalesce(hs.activo, true);

  if v_validos <> v_total then
    raise exception 'Alguno de los horarios elegidos no existe o está deshabilitado';
  end if;

  -- Ningún horario del plan puede quedar por encima de su capacidad. El front
  -- mostraba la ocupación pero nadie la validaba del lado del servidor.
  select hs.dia_semana, hs.hora_inicio, hs.capacidad into v_lleno
  from public.horarios_semanales hs
  where hs.id = any (p_horario_ids)
    and (
      select count(*)
      from public.horarios_recurrentes_usuario h
      join public.profiles pr on pr.id = h.usuario_id
      where h.dia_semana = hs.dia_semana
        and h.clase_numero = hs.clase_numero
        and h.usuario_id <> p_usuario_id
        and coalesce(h.activo, true)
        and (h.fecha_fin is null or h.fecha_fin >= p_desde)
        and coalesce(pr.is_active, true)
    ) >= hs.capacidad
  limit 1;

  if found then
    raise exception 'El horario de las % del día % ya está completo (capacidad %)',
      to_char(v_lleno.hora_inicio, 'HH24:MI'), v_lleno.dia_semana, v_lleno.capacidad;
  end if;
end;
$$;

create or replace function public.fn_seleccionar_plan(p_horario_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_combo integer := coalesce(array_length(p_horario_ids, 1), 0);
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  perform public.fn_validar_horarios_plan(p_horario_ids, v_uid, v_hoy);

  if exists (
    select 1 from public.horarios_recurrentes_usuario h
    where h.usuario_id = v_uid
      and coalesce(h.activo, true)
      and (h.fecha_fin is null or h.fecha_fin >= v_hoy)
  ) then
    raise exception 'Ya tenés un plan activo: usá el cambio de plan';
  end if;

  insert into public.horarios_recurrentes_usuario (
    usuario_id, dia_semana, clase_numero, hora_inicio, hora_fin,
    horario_semanal_id, activo, fecha_inicio, combo_aplicado
  )
  select v_uid, hs.dia_semana, hs.clase_numero, hs.hora_inicio, hs.hora_fin,
         hs.id, true, v_hoy, v_combo
  from public.horarios_semanales hs
  where hs.id = any (p_horario_ids);

  update public.profiles
  set combo_asignado = v_combo,
      tarifa_personalizada = null,
      combo_pendiente = null,
      tarifa_pendiente = null,
      fecha_cambio_plan = null,
      updated_at = now()
  where id = v_uid;

  perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(v_uid);

  return jsonb_build_object(
    'combo', v_combo,
    'tarifa', public.fn_tarifa_unitaria_mes(v_uid,
                extract(year from v_hoy)::int, extract(month from v_hoy)::int),
    'desde', v_hoy
  );
end;
$$;

create or replace function public.fn_cambiar_plan(p_horario_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_fin_mes date := (date_trunc('month', v_hoy) + interval '1 month - 1 day')::date;
  v_prox_mes date := (date_trunc('month', v_hoy) + interval '1 month')::date;
  v_combo integer := coalesce(array_length(p_horario_ids, 1), 0);
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  perform public.fn_validar_horarios_plan(p_horario_ids, v_uid, v_prox_mes);

  -- El mes en curso ya está facturado: el plan viejo sigue vigente hasta que
  -- termine y el nuevo arranca el día 1 del mes siguiente.
  update public.horarios_recurrentes_usuario
  set fecha_fin = v_fin_mes, updated_at = now()
  where usuario_id = v_uid
    and coalesce(activo, true)
    and (fecha_fin is null or fecha_fin > v_fin_mes);

  insert into public.horarios_recurrentes_usuario (
    usuario_id, dia_semana, clase_numero, hora_inicio, hora_fin,
    horario_semanal_id, activo, fecha_inicio, combo_aplicado
  )
  select v_uid, hs.dia_semana, hs.clase_numero, hs.hora_inicio, hs.hora_fin,
         hs.id, true, v_prox_mes, v_combo
  from public.horarios_semanales hs
  where hs.id = any (p_horario_ids);

  -- Cambiar de plan resetea las reservas sueltas futuras: el alumno arranca el
  -- mes que viene con los cupos nuevos y nada heredado.
  update public.turnos_variables
  set estado = 'cancelada', updated_at = now()
  where cliente_id = v_uid
    and turno_fecha >= v_prox_mes
    and estado = 'confirmada';

  update public.profiles
  set combo_pendiente = null,
      tarifa_pendiente = null,
      fecha_cambio_plan = null,
      tarifa_personalizada = null,
      updated_at = now()
  where id = v_uid;

  perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(v_uid);

  return jsonb_build_object(
    'combo', v_combo,
    'tarifa', public.fn_tarifa_unitaria_mes(v_uid,
                extract(year from v_prox_mes)::int, extract(month from v_prox_mes)::int),
    'desde', v_prox_mes
  );
end;
$$;

revoke all on function public.fn_recalcular_cuota_mensual(uuid, integer, integer) from anon, authenticated;
grant execute on function public.fn_seleccionar_plan(uuid[]) to authenticated;
grant execute on function public.fn_cambiar_plan(uuid[]) to authenticated;
grant execute on function public.fn_tarifa_unitaria_mes(uuid, integer, integer) to authenticated;
grant execute on function public.fn_plan_combo_mes(uuid, integer, integer) to authenticated;
grant execute on function public.fn_clase_dada_de_baja(date, integer) to authenticated;

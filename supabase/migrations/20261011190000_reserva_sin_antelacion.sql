-- Una vacante se reserva hasta que la clase empieza.
-- El margen de 24 horas (anticipacion_reserva_horas) dejaba afuera
-- las clases del feriado del día siguiente. Cancelar sigue en 36 horas.

alter table public.configuracion_admin
  alter column anticipacion_reserva_horas set default 0;

update public.configuracion_admin
set anticipacion_reserva_horas = 0,
    updated_at = now()
where anticipacion_reserva_horas is distinct from 0;

create or replace function public.reservar_vacante(p_turno_fecha date, p_clase_numero integer)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_slot record;
  v_sistema_activo boolean;
  v_inicio timestamptz;
  v_cancelacion_id uuid;
  v_nueva_id uuid;
  v_credito uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select coalesce(sistema_activo, true)
    into v_sistema_activo
  from public.configuracion_admin
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  if v_sistema_activo is false then
    raise exception 'El sistema de reservas está temporalmente desactivado';
  end if;

  if exists (
    select 1 from public.profiles pr
    where pr.id = v_uid
      and (pr.is_active is false
           or (pr.fecha_desactivacion is not null and pr.fecha_desactivacion <= v_hoy))
  ) then
    raise exception 'Tu cuenta está inactiva';
  end if;

  if not exists (
    select 1 from public.horarios_recurrentes_usuario h
    where h.usuario_id = v_uid and coalesce(h.activo, true)
  ) then
    raise exception 'Primero tenés que elegir un plan';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_turno_fecha::text || ':' || p_clase_numero::text));
  perform pg_advisory_xact_lock(hashtext('clase_a_favor:' || v_uid::text));

  select * into v_slot
  from public.fn_slots_disponibilidad(p_turno_fecha, p_turno_fecha) s
  where s.clase_numero = p_clase_numero;

  if not found then
    raise exception 'Esa clase no está disponible: el día está cerrado o el horario no existe';
  end if;

  v_inicio := (p_turno_fecha::text || ' ' || v_slot.hora_inicio::text)::timestamp
              at time zone 'America/Argentina/Buenos_Aires';

  if v_inicio <= now() then
    raise exception 'Esa clase ya empezó';
  end if;

  if v_slot.disponibles <= 0 then
    raise exception 'Cupo completo';
  end if;

  select tc.id into v_cancelacion_id
  from public.turnos_cancelados tc
  where tc.cliente_id = v_uid
    and tc.turno_fecha = p_turno_fecha
    and tc.clase_numero = p_clase_numero
  limit 1;

  if v_cancelacion_id is not null then
    if public.fn_credito_consumido(v_cancelacion_id) then
      raise exception 'Ya usaste la clase a favor de esta cancelación en otra vacante';
    end if;

    delete from public.turnos_cancelados where id = v_cancelacion_id;

    v_credito := public.fn_credito_para_fecha(v_uid, p_turno_fecha);

    update public.turnos_variables
    set estado = 'confirmada', credito_cancelacion_id = v_credito, updated_at = now()
    where cliente_id = v_uid
      and turno_fecha = p_turno_fecha
      and clase_numero = p_clase_numero
      and estado = 'cancelada';

    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(v_uid);
    return v_cancelacion_id;
  end if;

  if exists (
    select 1 from public.turnos_variables tv
    where tv.cliente_id = v_uid
      and tv.turno_fecha = p_turno_fecha
      and tv.clase_numero = p_clase_numero
      and tv.estado = 'confirmada'
  ) then
    raise exception 'Ya tenés una reserva en ese horario';
  end if;

  if exists (
    select 1 from public.horarios_recurrentes_usuario h
    where h.usuario_id = v_uid
      and h.dia_semana = v_slot.dia_semana
      and h.clase_numero = p_clase_numero
      and coalesce(h.activo, true)
      and (h.fecha_inicio is null or h.fecha_inicio <= p_turno_fecha)
      and (h.fecha_fin is null or h.fecha_fin >= p_turno_fecha)
  ) then
    raise exception 'Esa clase ya es parte de tu plan';
  end if;

  v_credito := public.fn_credito_para_fecha(v_uid, p_turno_fecha);

  insert into public.turnos_variables (
    cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin, clase_numero, estado,
    credito_cancelacion_id
  ) values (
    v_uid, p_turno_fecha, v_slot.hora_inicio, v_slot.hora_fin, p_clase_numero, 'confirmada',
    v_credito
  ) returning id into v_nueva_id;

  perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(v_uid);
  return v_nueva_id;
end;
$function$;

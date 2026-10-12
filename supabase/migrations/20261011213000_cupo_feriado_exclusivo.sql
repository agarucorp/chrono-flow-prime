-- El cupo de cada horario del feriado es el que cargó el admin (1, 6, 90 o el que sea).
-- No suma a los alumnos del plan. Al llegar a ese número, no entra nadie más.

create or replace function public.fn_admin_agregar_clase_alumno(p_usuario_id uuid, p_turno_fecha date, p_clase_numero integer)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_slot record;
  v_cancelacion_id uuid;
  v_nueva_id uuid;
  v_credito uuid;
begin
  if not public.is_user_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_turno_fecha::text || ':' || p_clase_numero::text));
  perform pg_advisory_xact_lock(hashtext('clase_a_favor:' || p_usuario_id::text));

  select * into v_slot
  from public.fn_slots_disponibilidad(p_turno_fecha, p_turno_fecha) s
  where s.clase_numero = p_clase_numero;

  if not found then
    raise exception 'Esa clase no existe o el día está cerrado';
  end if;

  if exists (
    select 1 from public.turnos_variables tv
    where tv.cliente_id = p_usuario_id
      and tv.turno_fecha = p_turno_fecha
      and tv.clase_numero = p_clase_numero
      and tv.estado = 'confirmada'
  ) then
    raise exception 'El alumno ya tiene esa clase';
  end if;

  if v_slot.disponibles <= 0 then
    raise exception 'Cupo completo';
  end if;

  select tc.id into v_cancelacion_id
  from public.turnos_cancelados tc
  where tc.cliente_id = p_usuario_id
    and tc.turno_fecha = p_turno_fecha
    and tc.clase_numero = p_clase_numero
  limit 1;

  if v_cancelacion_id is not null then
    if public.fn_credito_consumido(v_cancelacion_id) then
      raise exception 'El alumno ya usó la clase a favor de esa cancelación en otra vacante';
    end if;

    delete from public.turnos_cancelados where id = v_cancelacion_id;

    v_credito := public.fn_credito_para_fecha(p_usuario_id, p_turno_fecha);

    update public.turnos_variables
    set estado = 'confirmada', credito_cancelacion_id = v_credito, updated_at = now()
    where cliente_id = p_usuario_id
      and turno_fecha = p_turno_fecha
      and clase_numero = p_clase_numero
      and estado = 'cancelada';
    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(p_usuario_id);
    return v_cancelacion_id;
  end if;

  v_credito := public.fn_credito_para_fecha(p_usuario_id, p_turno_fecha);

  insert into public.turnos_variables (
    cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin, clase_numero, estado,
    credito_cancelacion_id
  ) values (
    p_usuario_id, p_turno_fecha, v_slot.hora_inicio, v_slot.hora_fin, p_clase_numero, 'confirmada',
    v_credito
  ) returning id into v_nueva_id;

  perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(p_usuario_id);
  return v_nueva_id;
end;
$function$;

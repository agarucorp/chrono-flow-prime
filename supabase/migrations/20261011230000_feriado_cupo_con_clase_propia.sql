-- Un feriado de día hábil no reutiliza el número de la grilla semanal.
-- 8:00 deja de ser la clase 2 y 9:00 deja de ser la clase 3: cada horario
-- del feriado tiene su propio cupo (100 + hora). El plan de ese día no
-- ocupa ese cupo ni impide anotarse.

create temporary table mapa_cupo_feriado on commit drop as
select f.fecha,
       (h->>'hora_inicio')::time as hora_inicio,
       (h->>'clase_numero')::int as clase_vieja,
       (100 + extract(hour from (h->>'hora_inicio')::time)::int) as clase_nueva
from public.feriados f
cross join lateral jsonb_array_elements(f.horarios_personalizados) h
where f.tipo = 'dia_habil_feriado'
  and f.horarios_personalizados is not null
  and (h->>'clase_numero')::int
      is distinct from (100 + extract(hour from (h->>'hora_inicio')::time)::int);

update public.turnos_variables tv
set clase_numero = m.clase_nueva,
    updated_at = now()
from mapa_cupo_feriado m
where tv.turno_fecha = m.fecha
  and tv.turno_hora_inicio = m.hora_inicio
  and tv.clase_numero = m.clase_vieja;

update public.turnos_cancelados tc
set clase_numero = m.clase_nueva
from mapa_cupo_feriado m
where tc.turno_fecha = m.fecha
  and tc.turno_hora_inicio = m.hora_inicio
  and tc.clase_numero = m.clase_vieja
  and tc.origen = 'variable';

create or replace function public.fn_normalizar_horarios_feriado()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cap_default integer;
begin
  if new.horarios_personalizados is null
     or jsonb_typeof(new.horarios_personalizados) <> 'array'
     or jsonb_array_length(new.horarios_personalizados) = 0 then
    new.horarios_personalizados := null;
    return new;
  end if;

  select coalesce(max_alumnos_por_clase, 4) into v_cap_default
  from public.configuracion_admin
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  select jsonb_agg(
    jsonb_build_object(
      'hora_inicio', to_char((h->>'hora_inicio')::time, 'HH24:MI'),
      'hora_fin', to_char((h->>'hora_fin')::time, 'HH24:MI'),
      'clase_numero', case
        when new.tipo = 'dia_habil_feriado'
          then 100 + extract(hour from (h->>'hora_inicio')::time)::int
        else coalesce(
          (h->>'clase_numero')::int,
          public.fn_clase_numero_por_hora((h->>'hora_inicio')::time)
        )
      end,
      'capacidad', greatest(1, coalesce((h->>'capacidad')::int, v_cap_default))
    )
    order by (h->>'hora_inicio')::time
  )
  into new.horarios_personalizados
  from jsonb_array_elements(new.horarios_personalizados) h;

  return new;
end;
$function$;

update public.feriados
set updated_at = now()
where tipo = 'dia_habil_feriado'
  and horarios_personalizados is not null;

-- Una cancelación del plan no se retoma al reservar el cupo del feriado.
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
    and (
      v_slot.origen = 'regular'
      or coalesce(tc.origen, 'recurrente') = 'variable'
    )
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

  if v_slot.origen = 'regular'
     and exists (
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
    and (
      v_slot.origen = 'regular'
      or coalesce(tc.origen, 'recurrente') = 'variable'
    )
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

-- El admin agrega y cancela por hora. En un feriado esa hora es el cupo
-- del feriado, no la clase del plan.
create or replace function public.fn_admin_cancelar_clase_por_hora(
  p_usuario_id uuid,
  p_turno_fecha date,
  p_hora_inicio time
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_clase_numero integer;
begin
  select s.clase_numero into v_clase_numero
  from public.fn_slots_disponibilidad(p_turno_fecha, p_turno_fecha) s
  where s.hora_inicio = p_hora_inicio
  order by s.clase_numero
  limit 1;

  if v_clase_numero is null then
    v_clase_numero := public.fn_clase_numero_por_hora(p_hora_inicio);
  end if;

  if v_clase_numero is null then
    raise exception 'No hay una clase configurada para las %', to_char(p_hora_inicio, 'HH24:MI');
  end if;

  return public.fn_cancelar_clase(p_turno_fecha, v_clase_numero, p_usuario_id);
end;
$function$;

create or replace function public.fn_admin_agregar_clase_por_hora(
  p_usuario_id uuid,
  p_turno_fecha date,
  p_hora_inicio time
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_clase_numero integer;
begin
  select s.clase_numero into v_clase_numero
  from public.fn_slots_disponibilidad(p_turno_fecha, p_turno_fecha) s
  where s.hora_inicio = p_hora_inicio
  order by s.clase_numero
  limit 1;

  if v_clase_numero is null then
    v_clase_numero := public.fn_clase_numero_por_hora(p_hora_inicio);
  end if;

  if v_clase_numero is null then
    raise exception 'No hay una clase configurada para las %', to_char(p_hora_inicio, 'HH24:MI');
  end if;

  return to_jsonb(public.fn_admin_agregar_clase_alumno(p_usuario_id, p_turno_fecha, v_clase_numero));
end;
$function$;

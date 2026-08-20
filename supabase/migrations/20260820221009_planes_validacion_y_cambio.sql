-- Ya aplicada en remoto. Una sola clase por día al elegir plan, y el cambio
-- de plan actualiza combo_asignado sin borrar una tarifa_personalizada del admin.

create or replace function public.fn_validar_horarios_plan(p_horario_ids uuid[], p_usuario_id uuid, p_desde date)
returns void
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_total integer := coalesce(array_length(p_horario_ids, 1), 0);
  v_validos integer;
  v_dias integer;
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

  select count(distinct hs.dia_semana) into v_dias
  from public.horarios_semanales hs
  where hs.id = any (p_horario_ids);

  if v_dias <> v_total then
    raise exception 'No se puede elegir más de una clase por día';
  end if;

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

create or replace function public.fn_cambiar_plan(p_horario_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
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

  update public.turnos_variables
  set estado = 'cancelada', updated_at = now()
  where cliente_id = v_uid
    and turno_fecha >= v_prox_mes
    and estado = 'confirmada';

  update public.profiles
  set combo_asignado = v_combo,
      combo_pendiente = null,
      tarifa_pendiente = null,
      fecha_cambio_plan = null,
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

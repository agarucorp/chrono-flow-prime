-- Nadie puede quitar a un alumno de una clase que ya empezó, tampoco el admin.

create or replace function public.fn_cancelar_clase(
  p_turno_fecha date,
  p_clase_numero integer,
  p_usuario_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_destino uuid := coalesce(p_usuario_id, auth.uid());
  v_es_admin boolean := public.is_user_admin(auth.uid());
  v_origen text;
  v_hora_inicio time;
  v_hora_fin time;
  v_dow integer;
  v_inicio timestamptz;
  v_tardia boolean;
  v_horas integer;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if v_destino <> v_uid and not v_es_admin then
    raise exception 'No autorizado';
  end if;

  v_dow := case when extract(dow from p_turno_fecha)::int = 0 then 7
                else extract(dow from p_turno_fecha)::int end;

  if exists (
    select 1 from public.turnos_cancelados tc
    where tc.cliente_id = v_destino
      and tc.turno_fecha = p_turno_fecha
      and tc.clase_numero = p_clase_numero
  ) then
    raise exception 'Esa clase ya estaba cancelada';
  end if;

  select 'variable', tv.turno_hora_inicio, tv.turno_hora_fin
    into v_origen, v_hora_inicio, v_hora_fin
  from public.turnos_variables tv
  where tv.cliente_id = v_destino
    and tv.turno_fecha = p_turno_fecha
    and tv.clase_numero = p_clase_numero
    and tv.estado = 'confirmada'
  limit 1;

  if v_origen is null then
    select 'recurrente',
           coalesce(hs.hora_inicio, h.hora_inicio),
           coalesce(hs.hora_fin, h.hora_fin)
      into v_origen, v_hora_inicio, v_hora_fin
    from public.horarios_recurrentes_usuario h
    left join public.horarios_semanales hs
      on hs.dia_semana = h.dia_semana
     and hs.clase_numero = h.clase_numero
     and coalesce(hs.activo, true)
    where h.usuario_id = v_destino
      and h.dia_semana = v_dow
      and h.clase_numero = p_clase_numero
      and coalesce(h.activo, true)
      and (h.fecha_inicio is null or h.fecha_inicio <= p_turno_fecha)
      and (h.fecha_fin is null or h.fecha_fin >= p_turno_fecha)
    limit 1;
  end if;

  if v_origen is null then
    raise exception 'No tenés esa clase reservada';
  end if;

  v_inicio := (p_turno_fecha::text || ' ' || v_hora_inicio::text)::timestamp
              at time zone 'America/Argentina/Buenos_Aires';

  if v_inicio <= now() then
    raise exception 'No se puede cancelar una clase que ya empezó';
  end if;

  select coalesce(cancelacion_penalidad_horas, 72) into v_horas
  from public.configuracion_admin
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  -- Una cancelación hecha por el admin nunca penaliza al alumno.
  v_tardia := case
    when v_destino <> v_uid then false
    else public.fn_es_cancelacion_tardia(p_turno_fecha, v_hora_inicio, now())
  end;

  insert into public.turnos_cancelados (
    cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin,
    clase_numero, origen, tipo_cancelacion, cancelacion_tardia
  ) values (
    v_destino, p_turno_fecha, v_hora_inicio, v_hora_fin,
    p_clase_numero, v_origen,
    case when v_destino <> v_uid then 'admin' else 'usuario' end,
    v_tardia
  );

  if v_origen = 'variable' then
    update public.turnos_variables
    set estado = 'cancelada', updated_at = now()
    where cliente_id = v_destino
      and turno_fecha = p_turno_fecha
      and clase_numero = p_clase_numero
      and estado = 'confirmada';
  end if;

  perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(v_destino);

  return jsonb_build_object(
    'tardia', v_tardia,
    'origen', v_origen,
    'horas_penalidad', coalesce(v_horas, 72),
    'hora_inicio', v_hora_inicio
  );
end;
$$;

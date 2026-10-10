-- El admin puede marcar un feriado para cualquier fecha.
-- Si ese mes ya tiene cuota, se reescribe sin el día cerrado.
-- El mes en curso sigue congelado: la clase se acredita en el mes siguiente.

create or replace function public.fn_recalcular_cuota_de_fecha(
  p_usuario_id uuid,
  p_fecha date
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_anio integer := extract(year from p_fecha)::int;
  v_mes integer := extract(month from p_fecha)::int;
begin
  if not exists (
    select 1
    from public.cuotas_mensuales c
    where c.usuario_id = p_usuario_id
      and c.anio = v_anio
      and c.mes = v_mes
  ) then
    return;
  end if;

  perform public.fn_recalcular_cuota_mensual(p_usuario_id, v_anio, v_mes);
end;
$$;

revoke all on function public.fn_recalcular_cuota_de_fecha(uuid, date) from public, anon, authenticated;

create or replace function public.fn_admin_aplicar_feriado(p_feriado_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_fecha date;
  v_afectados integer := 0;
  r record;
begin
  if not public.is_user_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select f.fecha into v_fecha from public.feriados f where f.id = p_feriado_id;
  if v_fecha is null then
    raise exception 'El feriado no existe';
  end if;

  for r in
    select tv.id, tv.cliente_id, tv.turno_hora_inicio, tv.turno_hora_fin, tv.clase_numero
    from public.turnos_variables tv
    where tv.turno_fecha = v_fecha
      and tv.estado = 'confirmada'
  loop
    insert into public.turnos_cancelados (
      cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin,
      clase_numero, origen, tipo_cancelacion, cancelacion_tardia
    )
    select r.cliente_id, v_fecha, r.turno_hora_inicio, r.turno_hora_fin,
           r.clase_numero, 'variable', 'sistema', false
    where not exists (
      select 1 from public.turnos_cancelados tc
      where tc.cliente_id = r.cliente_id
        and tc.turno_fecha = v_fecha
        and tc.clase_numero = r.clase_numero
    );

    update public.turnos_variables set estado = 'cancelada', updated_at = now()
    where id = r.id;

    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(r.cliente_id);
    perform public.fn_recalcular_cuota_de_fecha(r.cliente_id, v_fecha);
    v_afectados := v_afectados + 1;
  end loop;

  update public.feriados set turnos_cancelados = true, updated_at = now()
  where id = p_feriado_id;

  for r in
    select distinct h.usuario_id
    from public.horarios_recurrentes_usuario h
    where coalesce(h.activo, true)
      and h.dia_semana = case when extract(dow from v_fecha)::int = 0 then 7
                             else extract(dow from v_fecha)::int end
      and (h.fecha_inicio is null or h.fecha_inicio <= v_fecha)
      and (h.fecha_fin is null or h.fecha_fin >= v_fecha)
  loop
    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(r.usuario_id);
    perform public.fn_recalcular_cuota_de_fecha(r.usuario_id, v_fecha);
  end loop;

  return v_afectados;
end;
$$;

create or replace function public.fn_admin_revertir_feriado(p_feriado_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_fecha date;
  v_afectados integer := 0;
  r record;
begin
  if not public.is_user_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select f.fecha into v_fecha from public.feriados f where f.id = p_feriado_id;
  if v_fecha is null then
    raise exception 'El feriado no existe';
  end if;

  for r in
    select tc.id, tc.cliente_id, tc.clase_numero
    from public.turnos_cancelados tc
    where tc.turno_fecha = v_fecha
      and lower(coalesce(tc.tipo_cancelacion, '')) = 'sistema'
  loop
    update public.turnos_variables
    set estado = 'confirmada', updated_at = now()
    where cliente_id = r.cliente_id
      and turno_fecha = v_fecha
      and clase_numero = r.clase_numero
      and estado = 'cancelada';

    delete from public.turnos_cancelados where id = r.id;

    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(r.cliente_id);
    perform public.fn_recalcular_cuota_de_fecha(r.cliente_id, v_fecha);
    v_afectados := v_afectados + 1;
  end loop;

  for r in
    select distinct h.usuario_id
    from public.horarios_recurrentes_usuario h
    where coalesce(h.activo, true)
      and h.dia_semana = case when extract(dow from v_fecha)::int = 0 then 7
                             else extract(dow from v_fecha)::int end
      and (h.fecha_inicio is null or h.fecha_inicio <= v_fecha)
      and (h.fecha_fin is null or h.fecha_fin >= v_fecha)
  loop
    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(r.usuario_id);
    perform public.fn_recalcular_cuota_de_fecha(r.usuario_id, v_fecha);
  end loop;

  return v_afectados;
end;
$$;

-- Guardar un feriado solo recalcula la cuota del plan.
-- Una reserva confirmada sigue confirmada: la cancela el alumno,
-- el admin, o la acción explícita de cancelar. No el guardado del día.

create or replace function public.fn_admin_aplicar_feriado(p_feriado_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_fecha date;
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

  return 0;
end;
$$;

-- Devolver las reservas del lunes 12/10 que el guardado del feriado
-- había pasado a cancelación del sistema. Las de admin o del alumno quedan.
do $$
declare
  r record;
begin
  create temp table restaurar_feriado on commit drop as
  select tv.id as turno_id, tc.id as cancel_id, tv.cliente_id
  from public.turnos_variables tv
  join public.turnos_cancelados tc
    on tc.cliente_id = tv.cliente_id
   and tc.turno_fecha = tv.turno_fecha
   and tc.clase_numero = tv.clase_numero
  where tv.turno_fecha = '2026-10-12'
    and tv.estado = 'cancelada'
    and lower(coalesce(tc.tipo_cancelacion, '')) = 'sistema';

  if exists (
    select 1
    from public.turnos_variables tv
    join restaurar_feriado rf on tv.credito_cancelacion_id = rf.cancel_id
  ) then
    raise exception 'Hay una clase a favor apoyada en una de estas cancelaciones';
  end if;

  update public.turnos_variables tv
  set estado = 'confirmada', updated_at = now()
  where tv.id in (select turno_id from restaurar_feriado);

  delete from public.turnos_cancelados tc
  where tc.id in (select cancel_id from restaurar_feriado);

  for r in select distinct cliente_id from restaurar_feriado
  loop
    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(r.cliente_id);
    perform public.fn_recalcular_cuota_de_fecha(r.cliente_id, '2026-10-12'::date);
  end loop;
end;
$$;

-- Ya aplicada en remoto. El panel admin trabaja con horas; el servidor traduce a clase_numero.

create or replace function public.fn_admin_cancelar_clase_por_hora(
  p_usuario_id uuid,
  p_turno_fecha date,
  p_hora_inicio time
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_clase_numero integer;
begin
  v_clase_numero := public.fn_clase_numero_por_hora(p_hora_inicio);
  if v_clase_numero is null then
    raise exception 'No hay una clase configurada para las %', to_char(p_hora_inicio, 'HH24:MI');
  end if;

  return public.fn_cancelar_clase(p_turno_fecha, v_clase_numero, p_usuario_id);
end;
$$;

create or replace function public.fn_admin_agregar_clase_por_hora(
  p_usuario_id uuid,
  p_turno_fecha date,
  p_hora_inicio time
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_clase_numero integer;
begin
  v_clase_numero := public.fn_clase_numero_por_hora(p_hora_inicio);
  if v_clase_numero is null then
    raise exception 'No hay una clase configurada para las %', to_char(p_hora_inicio, 'HH24:MI');
  end if;

  return public.fn_admin_agregar_clase_alumno(p_usuario_id, p_turno_fecha, v_clase_numero);
end;
$$;

grant execute on function public.fn_admin_cancelar_clase_por_hora(uuid, date, time) to authenticated;
grant execute on function public.fn_admin_agregar_clase_por_hora(uuid, date, time) to authenticated;

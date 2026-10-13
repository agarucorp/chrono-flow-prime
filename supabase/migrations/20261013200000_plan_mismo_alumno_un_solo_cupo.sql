-- Al cambiar el plan, la fila vieja sigue activa (fecha_fin = hoy) y se inserta
-- la nueva. El conteo por fila hacía que quien mantenía una clase llena
-- ocupara dos cupos y chocara con chk_alumnos_no_excede_capacidad.
-- Una persona cuenta una sola vez en ese horario.

create or replace function public.actualizar_alumnos_agendados_simple()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_dia integer := coalesce(new.dia_semana, old.dia_semana);
  v_ini time := coalesce(new.hora_inicio, old.hora_inicio);
  v_fin time := coalesce(new.hora_fin, old.hora_fin);
begin
  update public.horarios_semanales
  set alumnos_agendados = (
        select count(distinct hru.usuario_id)::int
        from public.horarios_recurrentes_usuario hru
        where hru.dia_semana = v_dia
          and hru.hora_inicio = v_ini
          and hru.hora_fin = v_fin
          and hru.activo = true
      ),
      updated_at = now()
  where dia_semana = v_dia
    and hora_inicio = v_ini
    and hora_fin = v_fin
    and activo = true;

  return coalesce(new, old);
end;
$$;

create or replace function public.actualizar_alumnos_agendados()
returns void
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.horarios_semanales
  set alumnos_agendados = (
        select count(distinct hru.usuario_id)::int
        from public.horarios_recurrentes_usuario hru
        where hru.dia_semana = horarios_semanales.dia_semana
          and hru.hora_inicio = horarios_semanales.hora_inicio
          and hru.hora_fin = horarios_semanales.hora_fin
          and hru.activo = true
      ),
      updated_at = now()
  where activo = true;
end;
$$;

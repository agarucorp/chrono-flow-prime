-- El cupo de la grilla contaba toda fila activa, aunque la persona ya hubiera
-- dejado ese horario (fecha_fin en el pasado). El formulario no la contaba,
-- el alumno veía un lugar libre y al guardar chocaba con el tope.
-- La fila sigue activa: la cuota y la clase de hoy la necesitan hasta la fecha
-- de fin. El cupo solo suma a quien todavía va y tiene la cuenta activa.

create or replace function public.actualizar_alumnos_agendados_simple()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_dia integer := coalesce(new.dia_semana, old.dia_semana);
  v_ini time := coalesce(new.hora_inicio, old.hora_inicio);
  v_fin time := coalesce(new.hora_fin, old.hora_fin);
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
begin
  update public.horarios_semanales
  set alumnos_agendados = (
        select count(distinct hru.usuario_id)::int
        from public.horarios_recurrentes_usuario hru
        join public.profiles pr on pr.id = hru.usuario_id
        where hru.dia_semana = v_dia
          and hru.hora_inicio = v_ini
          and hru.hora_fin = v_fin
          and coalesce(hru.activo, true)
          and (hru.fecha_fin is null or hru.fecha_fin >= v_hoy)
          and coalesce(pr.is_active, true)
          and (pr.fecha_desactivacion is null or pr.fecha_desactivacion > v_hoy)
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
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
begin
  update public.horarios_semanales
  set alumnos_agendados = (
        select count(distinct hru.usuario_id)::int
        from public.horarios_recurrentes_usuario hru
        join public.profiles pr on pr.id = hru.usuario_id
        where hru.dia_semana = horarios_semanales.dia_semana
          and hru.hora_inicio = horarios_semanales.hora_inicio
          and hru.hora_fin = horarios_semanales.hora_fin
          and coalesce(hru.activo, true)
          and (hru.fecha_fin is null or hru.fecha_fin >= v_hoy)
          and coalesce(pr.is_active, true)
          and (pr.fecha_desactivacion is null or pr.fecha_desactivacion > v_hoy)
      ),
      updated_at = now()
  where activo = true;
end;
$$;

select public.actualizar_alumnos_agendados();

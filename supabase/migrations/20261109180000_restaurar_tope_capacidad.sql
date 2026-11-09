-- La capacidad se edita por día y clase, pero nunca puede quedar por debajo
-- de los alumnos con plan de esa clase.

alter table public.horarios_semanales
  add constraint chk_alumnos_no_excede_capacidad
  check ((capacidad = 0) or (alumnos_agendados <= capacidad));

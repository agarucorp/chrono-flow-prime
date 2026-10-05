-- DNI del alumno, para el seguro de salud. Lo carga el propio usuario desde su perfil.
alter table public.profiles
  add column if not exists dni text;

comment on column public.profiles.dni is
  'Documento del alumno. Información necesaria para el seguro de salud.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_dni_formato'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_dni_formato
      check (dni is null or dni ~ '^[0-9]{1,8}$');
  end if;
end $$;

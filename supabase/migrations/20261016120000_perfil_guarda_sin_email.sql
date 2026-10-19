-- El alumno guarda nombre, teléfono y DNI sin mandar el email.
-- El upsert armaba un insert sin email y chocaba con el NOT NULL, así que
-- el perfil no cambiaba. Si el email viene vacío, se toma el de la cuenta.
-- El nombre completo se rearma con el nombre y el apellido ya capitalizados.

create or replace function public.profiles_ensure_names()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  auth_first text;
  auth_last text;
  auth_name text;
  auth_email text;
  derived_first text;
  derived_last text;
begin
  select
    coalesce((raw_user_meta_data->>'first_name'), (raw_user_meta_data->>'given_name')),
    coalesce((raw_user_meta_data->>'last_name'), (raw_user_meta_data->>'family_name')),
    (raw_user_meta_data->>'name'),
    email
  into auth_first, auth_last, auth_name, auth_email
  from auth.users
  where id = new.id;

  if new.email is null or btrim(new.email) = '' then
    new.email := auth_email;
  end if;

  if (new.first_name is null or btrim(new.first_name) = '')
     or (new.last_name is null or btrim(new.last_name) = '') then
    if auth_first is not null or auth_last is not null then
      new.first_name := coalesce(new.first_name, public.capitalize_words(auth_first));
      new.last_name := coalesce(new.last_name, public.capitalize_words(auth_last));
    elsif auth_name is not null and btrim(auth_name) <> '' then
      new.first_name := coalesce(new.first_name, public.capitalize_words(split_part(auth_name, ' ', 1)));
      new.last_name := coalesce(
        new.last_name,
        public.capitalize_words(btrim(substring(auth_name from position(' ' in auth_name) + 1)))
      );
    else
      select first_name, last_name
      into derived_first, derived_last
      from public.derive_names_from_fullname_or_email(new.full_name, new.email);

      new.first_name := coalesce(new.first_name, derived_first);
      new.last_name := coalesce(new.last_name, derived_last);
    end if;
  end if;

  if new.first_name is not null then
    new.first_name := public.capitalize_words(new.first_name);
  end if;
  if new.last_name is not null then
    new.last_name := public.capitalize_words(new.last_name);
  end if;

  if new.first_name is not null or new.last_name is not null then
    new.full_name := btrim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, ''));
  end if;

  return new;
end;
$function$;

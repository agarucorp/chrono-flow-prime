-- =============================================================================
-- Fase 1 · Seguridad
--
-- Cierra tres agujeros explotables con la anon key pública:
--   1. Un alumno podía hacerse admin con un PATCH a profiles.role.
--   2. crear_usuario_admin permitía crear cuentas confirmadas sin pasar por Auth.
--   3. Las vistas corrían como su owner (bypass de RLS) con grants de escritura
--      para anon y authenticated.
--
-- Contexto: la migración 20260810_hardening_seguridad_turnos.sql existe en el
-- repo pero nunca se aplicó a la base, así que no había ninguna guarda de rol.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Guarda de columnas privilegiadas en profiles
--
-- Postgres no tiene RLS a nivel columna y la policy profiles_update_own_or_admin
-- deja al usuario escribir su propia fila completa, así que la única forma de
-- proteger columnas puntuales es un trigger.
-- -----------------------------------------------------------------------------
create or replace function public.fn_profiles_guard_columnas_privilegiadas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Las escrituras que llegan desde una función SECURITY DEFINER corren con
  -- current_user = owner. Esas ya validaron autorización por su cuenta.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if public.is_user_admin(auth.uid()) then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'No autorizado: el rol solo puede cambiarlo un administrador';
  end if;

  if new.is_active is distinct from old.is_active
     or new.fecha_desactivacion is distinct from old.fecha_desactivacion then
    raise exception 'No autorizado: el estado de la cuenta solo puede cambiarlo un administrador';
  end if;

  if new.email is distinct from old.email then
    raise exception 'No autorizado: el email se administra desde la cuenta';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_columnas_privilegiadas on public.profiles;
create trigger trg_profiles_guard_columnas_privilegiadas
  before update on public.profiles
  for each row
  execute function public.fn_profiles_guard_columnas_privilegiadas();

-- Alta de perfil desde el cliente: el rol siempre arranca en 'client'.
create or replace function public.fn_profiles_forzar_rol_alta()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated')
     and not public.is_user_admin(auth.uid()) then
    new.role := 'client';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_forzar_rol_alta on public.profiles;
create trigger trg_profiles_forzar_rol_alta
  before insert on public.profiles
  for each row
  execute function public.fn_profiles_forzar_rol_alta();

-- -----------------------------------------------------------------------------
-- 2. Baja de funciones peligrosas o rotas
--
-- crear_usuario_admin insertaba en auth.users con email_confirmed_at = now(),
-- salteándose verificación de mail, rate limit y captcha. El resto son restos
-- que ya fallan en runtime (columnas o tablas inexistentes) pero siguen siendo
-- superficie expuesta y RLS bypass si alguien las "arregla".
-- -----------------------------------------------------------------------------
drop function if exists public.crear_usuario_admin(text, text);
drop function if exists public.search_users(text);
drop function if exists public.get_users_by_role(text);
drop function if exists public.ensure_profile_for(uuid, text, text);
drop function if exists public.marcar_pago_procesado(uuid, uuid);
drop function if exists public.insert_horarios_recurrentes_usuario(uuid, jsonb);
drop function if exists public.generar_cuota_mensual(uuid, numeric, date);
drop function if exists public.simular_clase_llena(integer, time, time);
drop function if exists public.bloquear_dia_completo(integer, boolean);
drop function if exists public.bloquear_horario(integer, time, time, boolean);
drop function if exists public.cambiar_tarifa(numeric, text, uuid);
drop function if exists public.cambiar_tarifa_usuario(uuid, numeric, text, uuid);

-- -----------------------------------------------------------------------------
-- 3. sync_phones_from_auth: exigir admin y fijar search_path
-- -----------------------------------------------------------------------------
create or replace function public.sync_phones_from_auth()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count integer := 0;
  user_record record;
begin
  if not public.is_user_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  for user_record in
    select
      au.id,
      au.raw_user_meta_data->>'phone' as phone,
      au.raw_user_meta_data->>'first_name' as first_name,
      au.raw_user_meta_data->>'last_name' as last_name
    from auth.users au
    join public.profiles p on p.id = au.id
    where (p.phone is null or p.phone = '')
      and au.raw_user_meta_data->>'phone' is not null
      and au.raw_user_meta_data->>'phone' <> ''
  loop
    update public.profiles
    set phone = user_record.phone,
        first_name = coalesce(first_name, user_record.first_name),
        last_name = coalesce(last_name, user_record.last_name),
        updated_at = now()
    where id = user_record.id;

    updated_count := updated_count + 1;
  end loop;

  return json_build_object(
    'success', true,
    'updated_count', updated_count,
    'message', 'Phones synchronized successfully'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Vistas
--
-- Las cuatro tenían SELECT/INSERT/UPDATE/DELETE/TRUNCATE para anon y
-- authenticated, y vista_horarios_usuarios corría como su owner: un anónimo
-- podía leer los horarios y tarifas de todos los alumnos.
-- Tres de ellas no las usa nadie en el front.
-- -----------------------------------------------------------------------------
drop view if exists public.users_by_role;
drop view if exists public.vista_historial_tarifas;
drop view if exists public.vista_tarifas_activas;

alter view public.vista_horarios_usuarios set (security_invoker = true);
revoke all on public.vista_horarios_usuarios from anon, authenticated;
grant select on public.vista_horarios_usuarios to authenticated;

-- -----------------------------------------------------------------------------
-- 5. fn_upsert_cuota_mensual: quitar de la superficie REST
--
-- Es SECURITY DEFINER, no valida autorización y estaba llamable por cualquier
-- usuario logueado, que podía reescribir la cuota de cualquier otro. Solo se
-- usa internamente desde fn_recalcular_cuota_mensual (que sí valida), y las
-- llamadas internas corren con los privilegios del owner.
-- -----------------------------------------------------------------------------
revoke all on function public.fn_upsert_cuota_mensual(
  uuid, integer, integer, integer, numeric, numeric, numeric,
  integer, integer, integer, integer
) from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Cerrar la superficie del rol anon
--
-- La app nunca lee datos sin sesión: el login pasa por Supabase Auth, no por
-- PostgREST. Sin esto, políticas como turnos_disponibles_select_all USING (true)
-- (rol public, que incluye anon) exponen datos sin autenticar.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from anon', r.fn);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. search_path fijo en todas las SECURITY DEFINER
--
-- Sin search_path fijo, una función DEFINER puede resolver objetos contra un
-- esquema controlado por el llamante (search_path hijacking).
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proconfig is null
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.fn);
  end loop;
end;
$$;

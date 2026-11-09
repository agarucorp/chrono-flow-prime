-- Los avisos al celular son solo para la cuenta del admin del gimnasio,
-- aunque haya otras cuentas con rol admin.

create or replace function public.fn_push_es_receptor(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_usuario_id
      and p.role = 'admin'
      and lower(p.email) = 'lucasmaldacena@gmail.com'
  );
$$;

drop policy push_suscripciones_insert on public.push_suscripciones;
drop policy push_suscripciones_update on public.push_suscripciones;

create policy push_suscripciones_insert on public.push_suscripciones
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and public.fn_push_es_receptor((select auth.uid())));

create policy push_suscripciones_update on public.push_suscripciones
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()) and public.fn_push_es_receptor((select auth.uid())));

create or replace function public.fn_push_destinos()
returns table(id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select s.id, s.endpoint, s.p256dh, s.auth
  from public.push_suscripciones s
  where public.fn_push_es_receptor(s.usuario_id);
$$;

revoke execute on function public.fn_push_destinos() from public, anon, authenticated;
grant execute on function public.fn_push_destinos() to service_role;

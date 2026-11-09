-- Avisos al celular del admin: los mismos movimientos que muestra la campana
-- del panel (cancelaciones, reservas y cambios de plan de los alumnos) llegan
-- como notificación aunque la app esté cerrada. Las claves VAPID viven en
-- vault con los nombres push_vapid_publica y push_vapid_privada.

create extension if not exists pg_net with schema extensions;

create table public.push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  dispositivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_suscripciones_usuario_idx on public.push_suscripciones (usuario_id);

alter table public.push_suscripciones enable row level security;

create policy push_suscripciones_select on public.push_suscripciones
  for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy push_suscripciones_insert on public.push_suscripciones
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and public.is_user_admin((select auth.uid())));

create policy push_suscripciones_update on public.push_suscripciones
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()) and public.is_user_admin((select auth.uid())));

create policy push_suscripciones_delete on public.push_suscripciones
  for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- Cola que lee la función avisos-admin. Sin políticas: solo service_role.
create table public.push_pendientes (
  id bigint generated always as identity primary key,
  clave text not null unique,
  titulo text not null,
  cuerpo text not null,
  url text not null default '/admin',
  creado_el timestamptz not null default now(),
  enviado_el timestamptz
);

create index push_pendientes_sin_enviar_idx on public.push_pendientes (id) where enviado_el is null;

alter table public.push_pendientes enable row level security;

create or replace function public.fn_push_hora(p_hora time)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case when p_hora is null then '' else
    (case when extract(hour from p_hora)::int % 12 = 0 then 12
          else extract(hour from p_hora)::int % 12 end)::text
    || case when extract(minute from p_hora)::int = 0 then ''
            else ':' || lpad(extract(minute from p_hora)::int::text, 2, '0') end
    || case when extract(hour from p_hora)::int >= 12 then 'pm' else 'am' end
  end;
$$;

create or replace function public.fn_push_clase(p_fecha date, p_inicio time, p_fin time)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select (array['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'])[extract(dow from p_fecha)::int + 1]
         || ' ' || extract(day from p_fecha)::int
         || ' ' || (array['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'])[extract(month from p_fecha)::int]
         || ', ' || public.fn_push_hora(p_inicio)
         || case when p_fin is null then '' else ' – ' || public.fn_push_hora(p_fin) end;
$$;

create or replace function public.fn_push_nombre(p_usuario_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (
      select case when base = '' or base like '%@%' then null else initcap(base) end
      from (
        select regexp_replace(
                 trim(coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.full_name, '')),
                 '\s+', ' ', 'g'
               ) as base
        from public.profiles p
        where p.id = p_usuario_id
      ) x
    ),
    'Alumno'
  );
$$;

create or replace function public.fn_push_encolar(p_clave text, p_titulo text, p_cuerpo text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $$
begin
  if not exists (select 1 from public.push_suscripciones) then
    return;
  end if;

  insert into public.push_pendientes (clave, titulo, cuerpo)
  values (p_clave, p_titulo, p_cuerpo)
  on conflict (clave) do nothing;

  if found then
    perform net.http_post(
      url := 'https://bihqdptdkgdfztufrmlm.supabase.co/functions/v1/avisos-admin',
      body := '{}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 10000
    );
  end if;
end;
$$;

-- Un aviso que falla nunca debe frenar la cancelación, la reserva o el plan.
create or replace function public.fn_push_trg_cancelacion()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if lower(coalesce(new.tipo_cancelacion, '')) <> 'usuario'
     or public.is_user_admin(auth.uid()) then
    return null;
  end if;

  begin
    perform public.fn_push_encolar(
      'cancel:' || new.id,
      public.fn_push_nombre(new.cliente_id),
      'Canceló el ' || public.fn_push_clase(new.turno_fecha, new.turno_hora_inicio, new.turno_hora_fin)
    );
  exception when others then
    raise warning 'Aviso push de cancelación: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function public.fn_push_trg_reserva()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.estado <> 'confirmada'
     or (tg_op = 'UPDATE' and old.estado = 'confirmada')
     or public.is_user_admin(auth.uid()) then
    return null;
  end if;

  begin
    perform public.fn_push_encolar(
      'reserva:' || new.id || ':' || txid_current(),
      public.fn_push_nombre(new.cliente_id),
      'Reservó el ' || public.fn_push_clase(new.turno_fecha, new.turno_hora_inicio, new.turno_hora_fin)
    );
  exception when others then
    raise warning 'Aviso push de reserva: %', sqlerrm;
  end;
  return null;
end;
$$;

-- Corre al confirmar la transacción para ver todos los días del plan nuevo
-- juntos. Como en la campana, el plan elegido por primera vez no avisa.
create or replace function public.fn_push_trg_plan()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_cantidad integer;
  v_detalle text;
begin
  if new.fecha_inicio is null
     or new.fecha_inicio <= (timezone('America/Argentina/Buenos_Aires', new.created_at))::date
     or public.is_user_admin(auth.uid()) then
    return null;
  end if;

  begin
    select count(*),
           string_agg(
             (array['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'])[(x.dia_semana % 7) + 1]
               || ' ' || public.fn_push_hora(x.hora_inicio),
             ', ' order by x.dia_semana
           )
      into v_cantidad, v_detalle
    from (
      select distinct on (h.dia_semana) h.dia_semana, h.hora_inicio
      from public.horarios_recurrentes_usuario h
      where h.usuario_id = new.usuario_id
        and h.created_at = new.created_at
        and h.fecha_inicio = new.fecha_inicio
      order by h.dia_semana, h.hora_inicio
    ) x;

    perform public.fn_push_encolar(
      'plan:' || new.usuario_id || ':' || txid_current(),
      public.fn_push_nombre(new.usuario_id),
      'Cambió el plan a ' || v_cantidad || case when v_cantidad = 1 then ' día' else ' días' end
        || coalesce(': ' || v_detalle, '')
    );
  exception when others then
    raise warning 'Aviso push de plan: %', sqlerrm;
  end;
  return null;
end;
$$;

create trigger trg_push_cancelacion
  after insert on public.turnos_cancelados
  for each row execute function public.fn_push_trg_cancelacion();

create trigger trg_push_reserva
  after insert or update of estado on public.turnos_variables
  for each row execute function public.fn_push_trg_reserva();

create constraint trigger trg_push_plan
  after insert on public.horarios_recurrentes_usuario
  deferrable initially deferred
  for each row execute function public.fn_push_trg_plan();

create or replace function public.fn_push_tomar_pendientes()
returns table(id bigint, titulo text, cuerpo text, url text)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  update public.push_pendientes p
  set enviado_el = now()
  where p.id in (
    select q.id
    from public.push_pendientes q
    where q.enviado_el is null
      and q.creado_el > now() - interval '1 day'
    order by q.id
    limit 50
    for update skip locked
  )
  returning p.id, p.titulo, p.cuerpo, p.url;
$$;

create or replace function public.fn_push_destinos()
returns table(id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select s.id, s.endpoint, s.p256dh, s.auth
  from public.push_suscripciones s
  join public.profiles p on p.id = s.usuario_id
  where p.role = 'admin';
$$;

create or replace function public.fn_push_vapid()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'publica', (select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'push_vapid_publica'),
    'privada', (select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'push_vapid_privada'),
    'contacto', 'mailto:' || coalesce(
      (select p.email from public.profiles p where p.role = 'admin' and p.email is not null order by p.created_at limit 1),
      'admin@malda.app'
    )
  );
$$;

revoke execute on function public.fn_push_encolar(text, text, text) from public, anon, authenticated;
revoke execute on function public.fn_push_tomar_pendientes() from public, anon, authenticated;
revoke execute on function public.fn_push_destinos() from public, anon, authenticated;
revoke execute on function public.fn_push_vapid() from public, anon, authenticated;
grant execute on function public.fn_push_tomar_pendientes() to service_role;
grant execute on function public.fn_push_destinos() to service_role;
grant execute on function public.fn_push_vapid() to service_role;

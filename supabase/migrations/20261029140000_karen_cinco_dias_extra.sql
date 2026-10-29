-- Excepción única para Karen Peña: las dos clases a favor del 26 de octubre
-- vencen cinco días más tarde (10 de noviembre). El resto sigue en 10 días.

create or replace function public.fn_clases_a_favor(p_usuario_id uuid default null)
returns table (
  cancelacion_id uuid,
  turno_fecha date,
  clase_numero integer,
  hora_inicio time,
  cancelada_el timestamptz,
  vence date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := coalesce(p_usuario_id, auth.uid());
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if v_uid <> auth.uid() and not public.is_user_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  return query
  select tc.id,
         tc.turno_fecha,
         tc.clase_numero,
         tc.turno_hora_inicio,
         coalesce(tc.fecha_cancelacion, tc.created_at),
         public.fn_credito_vence(coalesce(tc.fecha_cancelacion, tc.created_at))
           + case
               when tc.id in (
                 '1a44ab31-6173-4857-a453-74f1c86742b2'::uuid,
                 '32e52a4d-04a6-4ac5-a813-c8549782116b'::uuid
               ) then 5
               else 0
             end
  from public.turnos_cancelados tc
  where tc.cliente_id = v_uid
    and tc.origen = 'recurrente'
    and not coalesce(tc.cancelacion_tardia, false)
    and lower(coalesce(tc.tipo_cancelacion, '')) in ('usuario', 'admin')
    and public.fn_credito_vence(coalesce(tc.fecha_cancelacion, tc.created_at))
          + case
              when tc.id in (
                '1a44ab31-6173-4857-a453-74f1c86742b2'::uuid,
                '32e52a4d-04a6-4ac5-a813-c8549782116b'::uuid
              ) then 5
              else 0
            end >= v_hoy
    and exists (
      select 1
      from public.fn_slots_disponibilidad(tc.turno_fecha, tc.turno_fecha) s
      where s.clase_numero = tc.clase_numero
        and s.origen = 'regular'
    )
    and not public.fn_credito_consumido(tc.id)
  order by 6, 5;
end;
$$;

create or replace function public.fn_admin_clases_a_favor()
returns table (
  usuario_id uuid,
  nombre text,
  cantidad integer,
  proximo_vencimiento date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_user_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  return query
  select p.id,
         coalesce(
           nullif(trim(p.full_name), ''),
           nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
           p.email
         )::text,
         count(*)::int,
         min(c.vence)
  from public.profiles p
  cross join lateral public.fn_clases_a_favor(p.id) c
  where exists (
    select 1 from public.turnos_cancelados tc
    where tc.cliente_id = p.id
      and tc.origen = 'recurrente'
      and not coalesce(tc.cancelacion_tardia, false)
      and (
        coalesce(tc.fecha_cancelacion, tc.created_at) >= now() - interval '12 days'
        or tc.id in (
          '1a44ab31-6173-4857-a453-74f1c86742b2'::uuid,
          '32e52a4d-04a6-4ac5-a813-c8549782116b'::uuid
        )
      )
  )
  group by p.id, p.full_name, p.first_name, p.last_name, p.email
  order by min(c.vence), 2;
end;
$$;

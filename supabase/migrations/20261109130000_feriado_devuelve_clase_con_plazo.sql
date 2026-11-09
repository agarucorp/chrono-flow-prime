-- La clase a favor que vuelve porque el feriado canceló la vacante donde se
-- había usado también tiene 10 días desde el feriado.

create or replace function public.fn_clases_a_favor(p_usuario_id uuid default null::uuid)
returns table(cancelacion_id uuid, turno_fecha date, clase_numero integer, hora_inicio time without time zone, cancelada_el timestamp with time zone, vence date)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
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

  -- En un feriado toda clase del plan deja clase a favor, aunque se haya
  -- cancelado tarde o el horario regular ya no exista ese día.
  return query
  select tc.id,
         tc.turno_fecha,
         tc.clase_numero,
         tc.turno_hora_inicio,
         coalesce(tc.fecha_cancelacion, tc.created_at),
         v.vence
  from public.turnos_cancelados tc
  cross join lateral (
    select public.fn_es_dia_feriado(tc.turno_fecha) as es_feriado,
           (
             select max(tv.turno_fecha)
             from public.turnos_variables tv
             join public.turnos_cancelados tf
               on tf.cliente_id = tv.cliente_id
              and tf.turno_fecha = tv.turno_fecha
              and tf.clase_numero = tv.clase_numero
              and tf.tipo_cancelacion = 'feriado'
             where tv.credito_cancelacion_id = tc.id
               and tv.estado = 'cancelada'
           ) as devuelta_por_feriado
  ) f
  cross join lateral (
    select greatest(
             public.fn_credito_vence(coalesce(tc.fecha_cancelacion, tc.created_at))
               + case
                   when tc.id in (
                     '1a44ab31-6173-4857-a453-74f1c86742b2'::uuid,
                     '32e52a4d-04a6-4ac5-a813-c8549782116b'::uuid
                   ) then 5
                   else 0
                 end,
             case when f.es_feriado then tc.turno_fecha + 10 end,
             f.devuelta_por_feriado + 10
           ) as vence
  ) v
  where tc.cliente_id = v_uid
    and tc.origen = 'recurrente'
    and lower(coalesce(tc.tipo_cancelacion, '')) in ('usuario', 'admin', 'feriado')
    and (f.es_feriado or not coalesce(tc.cancelacion_tardia, false))
    and v.vence >= v_hoy
    and (
      f.es_feriado
      or exists (
        select 1
        from public.fn_slots_disponibilidad(tc.turno_fecha, tc.turno_fecha) s
        where s.clase_numero = tc.clase_numero
          and s.origen = 'regular'
      )
    )
    and not public.fn_credito_consumido(tc.id)
  order by 6, 5;
end;
$$;

-- Una clase a favor devuelta por un feriado puede venir de una cancelación de
-- hasta unos 20 días atrás.
create or replace function public.fn_admin_clases_a_favor()
returns table(usuario_id uuid, nombre text, cantidad integer, proximo_vencimiento date)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
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
      and (
        coalesce(tc.fecha_cancelacion, tc.created_at) >= now() - interval '25 days'
        or tc.turno_fecha >= (timezone('America/Argentina/Buenos_Aires', now()))::date - 12
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

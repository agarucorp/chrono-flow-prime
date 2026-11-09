-- Un feriado cierra el día regular: cada clase del plan y cada vacante de ese
-- día queda cancelada a tiempo, sin importar la anticipación. La clase del plan
-- se sigue cobrando y deja una clase a favor que vence 10 días después del
-- feriado. La vacante se libera y, si se había pagado con una clase a favor,
-- esa clase vuelve. Los horarios que cargue el admin son aparte y se reservan
-- como cualquier vacante.

alter table public.turnos_cancelados
  drop constraint turnos_cancelados_tipo_cancelacion_check;

alter table public.turnos_cancelados
  add constraint turnos_cancelados_tipo_cancelacion_check
  check (tipo_cancelacion in ('usuario', 'admin', 'sistema', 'feriado'));

create or replace function public.fn_es_dia_feriado(p_fecha date)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.feriados f
    where f.activo and f.fecha = p_fecha
  );
$$;

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
  cross join lateral (select public.fn_es_dia_feriado(tc.turno_fecha) as es_feriado) f
  cross join lateral (
    select case
             when f.es_feriado then greatest(
               public.fn_credito_vence(coalesce(tc.fecha_cancelacion, tc.created_at)),
               tc.turno_fecha + 10
             )
             else public.fn_credito_vence(coalesce(tc.fecha_cancelacion, tc.created_at))
           end
           + case
               when tc.id in (
                 '1a44ab31-6173-4857-a453-74f1c86742b2'::uuid,
                 '32e52a4d-04a6-4ac5-a813-c8549782116b'::uuid
               ) then 5
               else 0
             end as vence
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
        coalesce(tc.fecha_cancelacion, tc.created_at) >= now() - interval '12 days'
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

create or replace function public.fn_clases_mes_usuario(p_usuario_id uuid, p_anio integer, p_mes integer)
returns table(plan integer, vacantes integer, creditos integer, tardias integer, neto integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with rango as (
    select make_date(p_anio, p_mes, 1) as ini,
           (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date as fin
  ),
  slots as (
    select s.fecha, s.clase_numero, s.origen
    from rango r
    cross join lateral public.fn_slots_disponibilidad(r.ini, r.fin) s
  ),
  -- Clases del plan que se dan ese mes, más las que anuló un feriado: esas se
  -- cobran igual porque dejaron una clase a favor. Si hay ausencia o la clase
  -- ya no está en la grilla, no se cobra.
  plan_mes as (
    select count(*)::int as n
    from rango r
    cross join generate_series(r.ini, r.fin, interval '1 day') d
    join public.horarios_recurrentes_usuario h
      on h.usuario_id = p_usuario_id
     and coalesce(h.activo, true)
     and h.dia_semana = case when extract(dow from d)::int = 0 then 7
                             else extract(dow from d)::int end
     and (h.fecha_inicio is null or h.fecha_inicio <= d::date)
     and (h.fecha_fin is null or h.fecha_fin >= d::date)
    where exists (
            select 1 from slots s
            where s.fecha = d::date
              and s.clase_numero = h.clase_numero
              and s.origen = 'regular'
          )
       or (
            public.fn_es_dia_feriado(d::date)
            and exists (
              select 1 from public.turnos_cancelados tc
              where tc.cliente_id = p_usuario_id
                and tc.turno_fecha = d::date
                and tc.clase_numero = h.clase_numero
                and tc.origen = 'recurrente'
            )
          )
  ),
  -- Una vacante se cobra si sigue confirmada, o si el alumno la canceló fuera
  -- de plazo. Incluye las de feriados y fines de semana habilitados. Las que se
  -- reservaron con una clase a favor no se cobran.
  vacantes_mes as (
    select count(*)::int as n
    from rango r
    join public.turnos_variables tv
      on tv.cliente_id = p_usuario_id
     and tv.turno_fecha between r.ini and r.fin
    join slots s
      on s.fecha = tv.turno_fecha
     and s.clase_numero = tv.clase_numero
    where tv.credito_cancelacion_id is null
      and (
        tv.estado = 'confirmada'
        or exists (
          select 1
          from public.turnos_cancelados tc
          where tc.cliente_id = p_usuario_id
            and tc.turno_fecha = tv.turno_fecha
            and tc.clase_numero = tv.clase_numero
            and coalesce(tc.cancelacion_tardia, false)
            and lower(coalesce(tc.tipo_cancelacion, '')) = 'usuario'
        )
      )
  ),
  tardias_mes as (
    select count(*)::int as n
    from rango r
    join public.turnos_cancelados tc
      on tc.cliente_id = p_usuario_id
     and tc.turno_fecha between r.ini and r.fin
    join slots s
      on s.fecha = tc.turno_fecha
     and s.clase_numero = tc.clase_numero
    where coalesce(tc.cancelacion_tardia, false)
      and lower(coalesce(tc.tipo_cancelacion, '')) = 'usuario'
  )
  -- creditos queda en 0: se mantiene la columna para no romper a quien la lee
  -- (cuotas_mensuales.clases_canceladas_anticipacion, el mail de cobro).
  select p.n, v.n, 0, t.n, greatest(0, p.n + v.n)
  from plan_mes p, vacantes_mes v, tardias_mes t;
$$;

create or replace function public.fn_admin_aplicar_feriado(p_feriado_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_fecha date;
  v_dow integer;
  v_slots integer[];
  v_credito uuid;
  v_cancelaciones integer := 0;
  v_n integer;
  r record;
begin
  if not public.is_user_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select f.fecha into v_fecha from public.feriados f where f.id = p_feriado_id and f.activo;
  if v_fecha is null then
    raise exception 'El feriado no existe';
  end if;

  v_dow := case when extract(dow from v_fecha)::int = 0 then 7
                else extract(dow from v_fecha)::int end;

  select coalesce(array_agg(s.clase_numero), '{}')
    into v_slots
  from public.fn_slots_disponibilidad(v_fecha, v_fecha) s;

  insert into public.turnos_cancelados (
    cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin,
    clase_numero, origen, tipo_cancelacion, cancelacion_tardia, fecha_cancelacion
  )
  select distinct on (h.usuario_id, h.clase_numero)
         h.usuario_id, v_fecha, hs.hora_inicio, hs.hora_fin,
         h.clase_numero, 'recurrente', 'feriado', false, now()
  from public.horarios_recurrentes_usuario h
  join public.horarios_semanales hs
    on hs.dia_semana = h.dia_semana
   and hs.clase_numero = h.clase_numero
   and coalesce(hs.activo, true)
  join public.profiles pr on pr.id = h.usuario_id
  where coalesce(h.activo, true)
    and h.dia_semana = v_dow
    and (h.fecha_inicio is null or h.fecha_inicio <= v_fecha)
    and (h.fecha_fin is null or h.fecha_fin >= v_fecha)
    and coalesce(pr.is_active, true)
    and (pr.fecha_desactivacion is null or pr.fecha_desactivacion > v_fecha)
  order by h.usuario_id, h.clase_numero
  on conflict (cliente_id, turno_fecha, clase_numero) do nothing;
  get diagnostics v_n = row_count;
  v_cancelaciones := v_cancelaciones + v_n;

  -- Vacantes en horarios que ese día ya no existen.
  for r in
    select tv.id, tv.cliente_id, tv.clase_numero, tv.turno_hora_inicio, tv.turno_hora_fin
    from public.turnos_variables tv
    where tv.turno_fecha = v_fecha
      and tv.estado = 'confirmada'
      and not (tv.clase_numero = any (v_slots))
  loop
    insert into public.turnos_cancelados (
      cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin,
      clase_numero, origen, tipo_cancelacion, cancelacion_tardia, fecha_cancelacion
    ) values (
      r.cliente_id, v_fecha, r.turno_hora_inicio, r.turno_hora_fin,
      r.clase_numero, 'variable', 'feriado', false, now()
    )
    on conflict (cliente_id, turno_fecha, clase_numero) do nothing;

    update public.turnos_variables
    set estado = 'cancelada', updated_at = now()
    where id = r.id;

    v_cancelaciones := v_cancelaciones + 1;
  end loop;

  -- Quien tenía clase ese día y ya reservó un horario del feriado sin clase a
  -- favor, la usa en esa reserva en vez de pagarla.
  for r in
    select tv.id, tv.cliente_id
    from public.turnos_variables tv
    where tv.turno_fecha = v_fecha
      and tv.estado = 'confirmada'
      and tv.credito_cancelacion_id is null
      and tv.clase_numero = any (v_slots)
  loop
    select c.cancelacion_id into v_credito
    from public.fn_clases_a_favor(r.cliente_id) c
    where c.cancelacion_id in (
      select tc.id
      from public.turnos_cancelados tc
      where tc.cliente_id = r.cliente_id
        and tc.turno_fecha = v_fecha
        and tc.origen = 'recurrente'
      union
      select tv2.credito_cancelacion_id
      from public.turnos_variables tv2
      join public.turnos_cancelados tc2
        on tc2.cliente_id = tv2.cliente_id
       and tc2.turno_fecha = tv2.turno_fecha
       and tc2.clase_numero = tv2.clase_numero
       and tc2.tipo_cancelacion = 'feriado'
      where tv2.cliente_id = r.cliente_id
        and tv2.turno_fecha = v_fecha
        and tv2.estado = 'cancelada'
        and tv2.credito_cancelacion_id is not null
    )
    order by c.vence, c.cancelada_el
    limit 1;

    if v_credito is not null then
      update public.turnos_variables
      set credito_cancelacion_id = v_credito, updated_at = now()
      where id = r.id;
    end if;
  end loop;

  for r in
    select h.usuario_id
    from public.horarios_recurrentes_usuario h
    where coalesce(h.activo, true)
      and h.dia_semana = v_dow
      and (h.fecha_inicio is null or h.fecha_inicio <= v_fecha)
      and (h.fecha_fin is null or h.fecha_fin >= v_fecha)
    union
    select tv.cliente_id from public.turnos_variables tv where tv.turno_fecha = v_fecha
    union
    select tc.cliente_id from public.turnos_cancelados tc where tc.turno_fecha = v_fecha
  loop
    continue when r.usuario_id is null;
    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(r.usuario_id);
    perform public.fn_recalcular_cuota_de_fecha(r.usuario_id, v_fecha);
  end loop;

  return v_cancelaciones;
end;
$$;

create or replace function public.fn_admin_revertir_feriado(p_feriado_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_fecha date;
  v_dow integer;
  v_afectados integer := 0;
  r record;
begin
  if not public.is_user_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select f.fecha into v_fecha from public.feriados f where f.id = p_feriado_id;
  if v_fecha is null then
    raise exception 'El feriado no existe';
  end if;

  v_dow := case when extract(dow from v_fecha)::int = 0 then 7
                else extract(dow from v_fecha)::int end;

  for r in
    select tc.id, tc.cliente_id, tc.clase_numero, tc.origen
    from public.turnos_cancelados tc
    where tc.turno_fecha = v_fecha
      and lower(coalesce(tc.tipo_cancelacion, '')) in ('feriado', 'sistema')
  loop
    -- Sin feriado no hay clase a favor: la reserva que la usó pasa a cobrarse.
    update public.turnos_variables
    set credito_cancelacion_id = null, updated_at = now()
    where credito_cancelacion_id = r.id;

    -- La vacante vuelve si su clase a favor no se usó en otra reserva y el
    -- alumno no tiene otra clase ese día.
    if r.origen = 'variable' then
      update public.turnos_variables tv
      set estado = 'confirmada', updated_at = now()
      where tv.cliente_id = r.cliente_id
        and tv.turno_fecha = v_fecha
        and tv.clase_numero = r.clase_numero
        and tv.estado = 'cancelada'
        and (tv.credito_cancelacion_id is null
             or not public.fn_credito_consumido(tv.credito_cancelacion_id))
        and not exists (
          select 1 from public.turnos_variables o
          where o.cliente_id = r.cliente_id
            and o.turno_fecha = v_fecha
            and o.estado = 'confirmada'
        );
    end if;

    delete from public.turnos_cancelados where id = r.id;
    v_afectados := v_afectados + 1;
  end loop;

  for r in
    select h.usuario_id
    from public.horarios_recurrentes_usuario h
    where coalesce(h.activo, true)
      and h.dia_semana = v_dow
      and (h.fecha_inicio is null or h.fecha_inicio <= v_fecha)
      and (h.fecha_fin is null or h.fecha_fin >= v_fecha)
    union
    select tv.cliente_id from public.turnos_variables tv where tv.turno_fecha = v_fecha
    union
    select tc.cliente_id from public.turnos_cancelados tc where tc.turno_fecha = v_fecha
  loop
    continue when r.usuario_id is null;
    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(r.usuario_id);
    perform public.fn_recalcular_cuota_de_fecha(r.usuario_id, v_fecha);
  end loop;

  return v_afectados;
end;
$$;

create or replace function public.fn_cancelar_clase(p_turno_fecha date, p_clase_numero integer, p_usuario_id uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_destino uuid := coalesce(p_usuario_id, auth.uid());
  v_es_admin boolean := public.is_user_admin(auth.uid());
  v_origen text;
  v_variable_id uuid;
  v_credito_vacante uuid;
  v_hora_inicio time;
  v_hora_fin time;
  v_dow integer;
  v_inicio timestamptz;
  v_tardia boolean;
  v_horas integer;
  v_cancelacion_id uuid;
  v_credito_id uuid;
  v_credito_vence date;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if v_destino <> v_uid and not v_es_admin then
    raise exception 'No autorizado';
  end if;

  v_dow := case when extract(dow from p_turno_fecha)::int = 0 then 7
                else extract(dow from p_turno_fecha)::int end;

  if exists (
    select 1 from public.turnos_cancelados tc
    where tc.cliente_id = v_destino
      and tc.turno_fecha = p_turno_fecha
      and tc.clase_numero = p_clase_numero
  ) then
    raise exception 'Esa clase ya estaba cancelada';
  end if;

  select 'variable', tv.id, tv.credito_cancelacion_id, tv.turno_hora_inicio, tv.turno_hora_fin
    into v_origen, v_variable_id, v_credito_vacante, v_hora_inicio, v_hora_fin
  from public.turnos_variables tv
  where tv.cliente_id = v_destino
    and tv.turno_fecha = p_turno_fecha
    and tv.clase_numero = p_clase_numero
    and tv.estado = 'confirmada'
  limit 1;

  if v_origen is null then
    select 'recurrente',
           coalesce(hs.hora_inicio, h.hora_inicio),
           coalesce(hs.hora_fin, h.hora_fin)
      into v_origen, v_hora_inicio, v_hora_fin
    from public.horarios_recurrentes_usuario h
    left join public.horarios_semanales hs
      on hs.dia_semana = h.dia_semana
     and hs.clase_numero = h.clase_numero
     and coalesce(hs.activo, true)
    where h.usuario_id = v_destino
      and h.dia_semana = v_dow
      and h.clase_numero = p_clase_numero
      and coalesce(h.activo, true)
      and (h.fecha_inicio is null or h.fecha_inicio <= p_turno_fecha)
      and (h.fecha_fin is null or h.fecha_fin >= p_turno_fecha)
    limit 1;
  end if;

  if v_origen is null then
    raise exception 'No tenés esa clase reservada';
  end if;

  if v_origen = 'recurrente' and public.fn_es_dia_feriado(p_turno_fecha) then
    raise exception 'Ese día es feriado: la clase ya quedó cancelada y tenés una clase a favor';
  end if;

  v_inicio := (p_turno_fecha::text || ' ' || v_hora_inicio::text)::timestamp
              at time zone 'America/Argentina/Buenos_Aires';

  if v_inicio <= now() then
    raise exception 'No se puede cancelar una clase que ya empezó';
  end if;

  select coalesce(cancelacion_penalidad_horas, 72) into v_horas
  from public.configuracion_admin
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  v_tardia := case
    when v_destino <> v_uid then false
    else public.fn_es_cancelacion_tardia(p_turno_fecha, v_hora_inicio, now())
  end;

  insert into public.turnos_cancelados (
    cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin,
    clase_numero, origen, tipo_cancelacion, cancelacion_tardia
  ) values (
    v_destino, p_turno_fecha, v_hora_inicio, v_hora_fin,
    p_clase_numero, v_origen,
    case when v_destino <> v_uid then 'admin' else 'usuario' end,
    v_tardia
  ) returning id into v_cancelacion_id;

  if v_origen = 'variable' then
    update public.turnos_variables
    set estado = 'cancelada', updated_at = now()
    where cliente_id = v_destino
      and turno_fecha = p_turno_fecha
      and clase_numero = p_clase_numero
      and estado = 'confirmada';
  end if;

  -- Clase del plan cancelada a tiempo: queda una clase a favor. Vacante pagada
  -- con clase a favor y cancelada a tiempo: la clase a favor vuelve.
  if not v_tardia then
    select c.cancelacion_id, c.vence into v_credito_id, v_credito_vence
    from public.fn_clases_a_favor(v_destino) c
    where c.cancelacion_id = case when v_origen = 'recurrente'
                                  then v_cancelacion_id
                                  else v_credito_vacante end;
  end if;

  perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(v_destino);

  return jsonb_build_object(
    'tardia', v_tardia,
    'origen', v_origen,
    'horas_penalidad', coalesce(v_horas, 72),
    'hora_inicio', v_hora_inicio,
    'clase_a_favor', v_credito_id is not null,
    'clase_a_favor_vence', v_credito_vence,
    'vacante_con_clase_a_favor', v_credito_vacante is not null
  );
end;
$$;

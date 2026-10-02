-- Clases a favor por cancelación con anticipación.
--
-- Antes, cancelar a tiempo una clase del plan la descontaba de la cuota (vía el
-- arrastre al mes siguiente), así que cada cancelación reescribía el balance del
-- alumno y lo que cobra el admin. Ahora la cuota no se toca: la cancelación a
-- tiempo deja una clase a favor que el alumno usa para reservar una vacante sin
-- cargo dentro de los 10 días siguientes a la cancelación. Si cancela tarde, la
-- pierde como hasta ahora. Las vacantes sin clase a favor se siguen cobrando.
--
-- No hay tabla nueva: la cancelación ya está en turnos_cancelados, y la vacante
-- que la consume la apunta con turnos_variables.credito_cancelacion_id. Todo lo
-- demás (vencimiento, si sigue disponible) se deriva.

alter table public.turnos_variables
  add column if not exists credito_cancelacion_id uuid
  references public.turnos_cancelados (id);

comment on column public.turnos_variables.credito_cancelacion_id is
  'Cancelación con anticipación cuya clase a favor pagó esta vacante. Null = vacante cobrada.';

create index if not exists idx_turnos_variables_credito_cancelacion
  on public.turnos_variables (credito_cancelacion_id)
  where credito_cancelacion_id is not null;

-- Último día (hora Argentina) en que se puede tomar la clase a favor.
create or replace function public.fn_credito_vence(p_cancelada_el timestamptz)
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select (timezone('America/Argentina/Buenos_Aires', p_cancelada_el))::date + 10;
$$;

-- La clase a favor está usada si una vacante la consume: sigue confirmada (o ya
-- se dio), o el alumno la canceló tarde y la perdió. Si la vacante se canceló a
-- tiempo o por feriado, la clase a favor vuelve.
create or replace function public.fn_credito_consumido(p_cancelacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.turnos_variables tv
    where tv.credito_cancelacion_id = p_cancelacion_id
      and (
        tv.estado = 'confirmada'
        or exists (
          select 1 from public.turnos_cancelados tc
          where tc.cliente_id = tv.cliente_id
            and tc.turno_fecha = tv.turno_fecha
            and tc.clase_numero = tv.clase_numero
            and coalesce(tc.cancelacion_tardia, false)
            and lower(coalesce(tc.tipo_cancelacion, '')) = 'usuario'
        )
      )
  );
$$;

-- Clases a favor disponibles de un alumno, la que vence primero arriba.
-- Solo cuentan clases del plan canceladas a tiempo (por el alumno o por el admin
-- en su nombre) que caían en un día con clase regular: si después el día pasó a
-- feriado o ausencia, la clase ya no se cobra y no corresponde además el crédito.
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
  from public.turnos_cancelados tc
  where tc.cliente_id = v_uid
    and tc.origen = 'recurrente'
    and not coalesce(tc.cancelacion_tardia, false)
    and lower(coalesce(tc.tipo_cancelacion, '')) in ('usuario', 'admin')
    and public.fn_credito_vence(coalesce(tc.fecha_cancelacion, tc.created_at)) >= v_hoy
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

-- La clase a favor que paga una vacante en p_fecha: la que vence primero entre
-- las que siguen vigentes ese día. Null si no hay ninguna.
create or replace function public.fn_credito_para_fecha(p_usuario_id uuid, p_fecha date)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.cancelacion_id
  from public.fn_clases_a_favor(p_usuario_id) c
  where c.vence >= p_fecha
  order by c.vence, c.cancelada_el
  limit 1;
$$;

-- Para el panel admin: alumnos con clases a favor pendientes.
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
    -- Filtro barato antes de calcular: solo alumnos con alguna cancelación a
    -- tiempo reciente.
    select 1 from public.turnos_cancelados tc
    where tc.cliente_id = p.id
      and tc.origen = 'recurrente'
      and not coalesce(tc.cancelacion_tardia, false)
      and coalesce(tc.fecha_cancelacion, tc.created_at) >= now() - interval '12 days'
  )
  group by p.id, p.full_name, p.first_name, p.last_name, p.email
  order by min(c.vence), 2;
end;
$$;

-- Cuota del mes: las cancelaciones a tiempo ya no descuentan (dejan una clase a
-- favor) y las vacantes pagadas con clase a favor no se cobran.
create or replace function public.fn_clases_mes_usuario(p_usuario_id uuid, p_anio integer, p_mes integer)
returns table(plan integer, vacantes integer, creditos integer, tardias integer, neto integer)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  with rango as (
    select make_date(p_anio, p_mes, 1) as ini,
           (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date as fin
  ),
  slots as (
    select s.fecha, s.clase_numero, s.origen
    from rango r
    cross join lateral public.fn_slots_disponibilidad(r.ini, r.fin) s
  ),
  -- Clases del plan que realmente se dan ese mes. Si el día es feriado, hay
  -- ausencia o la clase ya no está en la grilla, no aparece como slot regular
  -- y por lo tanto no se cobra.
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
    join slots s
      on s.fecha = d::date
     and s.clase_numero = h.clase_numero
     and s.origen = 'regular'
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
$function$;

create or replace function public.fn_cancelar_clase(p_turno_fecha date, p_clase_numero integer, p_usuario_id uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
$function$;

create or replace function public.reservar_vacante(p_turno_fecha date, p_clase_numero integer)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_slot record;
  v_sistema_activo boolean;
  v_anticipacion integer;
  v_inicio timestamptz;
  v_cancelacion_id uuid;
  v_nueva_id uuid;
  v_credito uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select coalesce(sistema_activo, true), coalesce(anticipacion_reserva_horas, 0)
    into v_sistema_activo, v_anticipacion
  from public.configuracion_admin
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  if v_sistema_activo is false then
    raise exception 'El sistema de reservas está temporalmente desactivado';
  end if;

  if exists (
    select 1 from public.profiles pr
    where pr.id = v_uid
      and (pr.is_active is false
           or (pr.fecha_desactivacion is not null and pr.fecha_desactivacion <= v_hoy))
  ) then
    raise exception 'Tu cuenta está inactiva';
  end if;

  if not exists (
    select 1 from public.horarios_recurrentes_usuario h
    where h.usuario_id = v_uid and coalesce(h.activo, true)
  ) then
    raise exception 'Primero tenés que elegir un plan';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_turno_fecha::text || ':' || p_clase_numero::text));
  -- Dos reservas a la vez no pueden gastar la misma clase a favor.
  perform pg_advisory_xact_lock(hashtext('clase_a_favor:' || v_uid::text));

  select * into v_slot
  from public.fn_slots_disponibilidad(p_turno_fecha, p_turno_fecha) s
  where s.clase_numero = p_clase_numero;

  if not found then
    raise exception 'Esa clase no está disponible: el día está cerrado o el horario no existe';
  end if;

  v_inicio := (p_turno_fecha::text || ' ' || v_slot.hora_inicio::text)::timestamp
              at time zone 'America/Argentina/Buenos_Aires';

  if v_inicio < (now() + make_interval(hours => v_anticipacion)) then
    raise exception 'La reserva necesita al menos % horas de anticipación', v_anticipacion;
  end if;

  if v_slot.disponibles <= 0 then
    raise exception 'Cupo completo';
  end if;

  select tc.id into v_cancelacion_id
  from public.turnos_cancelados tc
  where tc.cliente_id = v_uid
    and tc.turno_fecha = p_turno_fecha
    and tc.clase_numero = p_clase_numero
  limit 1;

  if v_cancelacion_id is not null then
    -- Volver a tomar una clase propia cancelada borra la cancelación, y con ella
    -- su clase a favor. Si esa clase a favor ya pagó otra vacante, no se puede.
    if public.fn_credito_consumido(v_cancelacion_id) then
      raise exception 'Ya usaste la clase a favor de esta cancelación en otra vacante';
    end if;

    delete from public.turnos_cancelados where id = v_cancelacion_id;

    -- Si era una vacante, se vuelve a confirmar con la clase a favor que haya
    -- disponible (puede ser la misma que tenía), o cobrada si no queda ninguna.
    v_credito := public.fn_credito_para_fecha(v_uid, p_turno_fecha);

    update public.turnos_variables
    set estado = 'confirmada', credito_cancelacion_id = v_credito, updated_at = now()
    where cliente_id = v_uid
      and turno_fecha = p_turno_fecha
      and clase_numero = p_clase_numero
      and estado = 'cancelada';

    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(v_uid);
    return v_cancelacion_id;
  end if;

  if exists (
    select 1 from public.turnos_variables tv
    where tv.cliente_id = v_uid
      and tv.turno_fecha = p_turno_fecha
      and tv.clase_numero = p_clase_numero
      and tv.estado = 'confirmada'
  ) then
    raise exception 'Ya tenés una reserva en ese horario';
  end if;

  if exists (
    select 1 from public.horarios_recurrentes_usuario h
    where h.usuario_id = v_uid
      and h.dia_semana = v_slot.dia_semana
      and h.clase_numero = p_clase_numero
      and coalesce(h.activo, true)
      and (h.fecha_inicio is null or h.fecha_inicio <= p_turno_fecha)
      and (h.fecha_fin is null or h.fecha_fin >= p_turno_fecha)
  ) then
    raise exception 'Esa clase ya es parte de tu plan';
  end if;

  -- Si tiene una clase a favor vigente para ese día, la vacante se paga con ella.
  v_credito := public.fn_credito_para_fecha(v_uid, p_turno_fecha);

  insert into public.turnos_variables (
    cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin, clase_numero, estado,
    credito_cancelacion_id
  ) values (
    v_uid, p_turno_fecha, v_slot.hora_inicio, v_slot.hora_fin, p_clase_numero, 'confirmada',
    v_credito
  ) returning id into v_nueva_id;

  perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(v_uid);
  return v_nueva_id;
end;
$function$;

create or replace function public.fn_admin_agregar_clase_alumno(p_usuario_id uuid, p_turno_fecha date, p_clase_numero integer)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_slot record;
  v_cancelacion_id uuid;
  v_nueva_id uuid;
  v_credito uuid;
begin
  if not public.is_user_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_turno_fecha::text || ':' || p_clase_numero::text));
  perform pg_advisory_xact_lock(hashtext('clase_a_favor:' || p_usuario_id::text));

  select * into v_slot
  from public.fn_slots_disponibilidad(p_turno_fecha, p_turno_fecha) s
  where s.clase_numero = p_clase_numero;

  if not found then
    raise exception 'Esa clase no existe o el día está cerrado';
  end if;

  select tc.id into v_cancelacion_id
  from public.turnos_cancelados tc
  where tc.cliente_id = p_usuario_id
    and tc.turno_fecha = p_turno_fecha
    and tc.clase_numero = p_clase_numero
  limit 1;

  if v_cancelacion_id is not null then
    if public.fn_credito_consumido(v_cancelacion_id) then
      raise exception 'El alumno ya usó la clase a favor de esa cancelación en otra vacante';
    end if;

    delete from public.turnos_cancelados where id = v_cancelacion_id;

    v_credito := public.fn_credito_para_fecha(p_usuario_id, p_turno_fecha);

    update public.turnos_variables
    set estado = 'confirmada', credito_cancelacion_id = v_credito, updated_at = now()
    where cliente_id = p_usuario_id
      and turno_fecha = p_turno_fecha
      and clase_numero = p_clase_numero
      and estado = 'cancelada';
    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(p_usuario_id);
    return v_cancelacion_id;
  end if;

  if v_slot.disponibles <= 0 then
    raise exception 'Cupo completo';
  end if;

  if exists (
    select 1 from public.turnos_variables tv
    where tv.cliente_id = p_usuario_id
      and tv.turno_fecha = p_turno_fecha
      and tv.clase_numero = p_clase_numero
      and tv.estado = 'confirmada'
  ) then
    raise exception 'El alumno ya tiene esa clase';
  end if;

  v_credito := public.fn_credito_para_fecha(p_usuario_id, p_turno_fecha);

  insert into public.turnos_variables (
    cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin, clase_numero, estado,
    credito_cancelacion_id
  ) values (
    p_usuario_id, p_turno_fecha, v_slot.hora_inicio, v_slot.hora_fin, p_clase_numero, 'confirmada',
    v_credito
  ) returning id into v_nueva_id;

  perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(p_usuario_id);
  return v_nueva_id;
end;
$function$;

-- "Agregar alumno" de la agenda fallaba siempre: devolvía el uuid de
-- fn_admin_agregar_clase_alumno en una función jsonb ("invalid input syntax for
-- type json") y la reserva se deshacía. Solo cambia el return.
create or replace function public.fn_admin_agregar_clase_por_hora(
  p_usuario_id uuid,
  p_turno_fecha date,
  p_hora_inicio time
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_clase_numero integer;
begin
  v_clase_numero := public.fn_clase_numero_por_hora(p_hora_inicio);
  if v_clase_numero is null then
    raise exception 'No hay una clase configurada para las %', to_char(p_hora_inicio, 'HH24:MI');
  end if;

  return to_jsonb(public.fn_admin_agregar_clase_alumno(p_usuario_id, p_turno_fecha, v_clase_numero));
end;
$$;

-- Las funciones auxiliares solo se llaman desde otras funciones del servidor.
revoke all on function public.fn_credito_vence(timestamptz) from public, anon, authenticated;
revoke all on function public.fn_credito_consumido(uuid) from public, anon, authenticated;
revoke all on function public.fn_credito_para_fecha(uuid, date) from public, anon, authenticated;

revoke all on function public.fn_clases_a_favor(uuid) from public, anon;
grant execute on function public.fn_clases_a_favor(uuid) to authenticated;

revoke all on function public.fn_admin_clases_a_favor() from public, anon;
grant execute on function public.fn_admin_clases_a_favor() to authenticated;

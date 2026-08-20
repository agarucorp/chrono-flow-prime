-- =============================================================================
-- Fase 2 · Núcleo de disponibilidad
--
-- Problema de fondo: había dos modelos de capacidad contradictorios.
--   · obtener_clases_disponibles leía la capacidad de horarios_semanales.
--   · reservar_vacante la calculaba contando filas de turnos_disponibles,
--     o sea "una fila = un cupo libre".
-- Como el front y un trigger insertaban filas en turnos_disponibles por
-- separado, la misma cancelación generaba vacantes duplicadas y la capacidad
-- real quedaba indefinida.
--
-- Solución: la vacante pasa a ser DERIVADA. Para cada (fecha, clase) se calcula
-- capacidad − ocupados, donde ocupados son los planes recurrentes vigentes no
-- cancelados más las reservas variables confirmadas. Nadie escribe vacantes:
-- cancelar libera el cupo por definición y no hay estado que se pueda desincronizar.
--
-- Además se desacopla todo de las horas literales: la identidad de una clase es
-- (fecha, clase_numero), así que el admin puede editar horarios sin romper
-- reservas ni cancelaciones existentes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Identidad de clase en las tablas de reservas y cancelaciones
-- -----------------------------------------------------------------------------
alter table public.turnos_variables  add column if not exists clase_numero integer;
alter table public.turnos_cancelados add column if not exists clase_numero integer;

-- origen distingue si lo cancelado era una clase del plan (que la base del mes
-- ya contaba y por lo tanto hay que acreditar) o una vacante reservada aparte
-- (que simplemente deja de sumar). Sin esta distinción, cancelar una vacante
-- restaba dos veces.
alter table public.turnos_cancelados add column if not exists origen text;

-- Horas que exige el negocio para cancelar sin cargo. Antes estaba hardcodeado
-- en 24 en la función y en el front.
alter table public.configuracion_admin
  add column if not exists cancelacion_penalidad_horas integer not null default 72;

update public.configuracion_admin set cancelacion_penalidad_horas = 72
where cancelacion_penalidad_horas is distinct from 72;

-- Resuelve clase_numero a partir de la hora de inicio. Las clases con horario
-- propio de feriado que no existen en la grilla semanal reciben un número
-- sintético estable (100 + hora) que nunca choca con la grilla real (1..9).
create or replace function public.fn_clase_numero_por_hora(p_hora time)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select hs.clase_numero
       from public.horarios_semanales hs
      where hs.hora_inicio = p_hora
      order by hs.clase_numero
      limit 1),
    100 + extract(hour from p_hora)::int
  );
$$;

update public.turnos_variables
set clase_numero = public.fn_clase_numero_por_hora(turno_hora_inicio)
where clase_numero is null;

update public.turnos_cancelados
set clase_numero = public.fn_clase_numero_por_hora(turno_hora_inicio)
where clase_numero is null;

update public.turnos_cancelados tc
set origen = case
  when exists (
    select 1 from public.turnos_variables tv
    where tv.cliente_id = tc.cliente_id
      and tv.turno_fecha = tc.turno_fecha
      and tv.turno_hora_inicio = tc.turno_hora_inicio
  ) then 'variable'
  else 'recurrente'
end
where origen is null;

alter table public.turnos_variables  alter column clase_numero set not null;
alter table public.turnos_cancelados alter column clase_numero set not null;
alter table public.turnos_cancelados alter column origen set default 'recurrente';
alter table public.turnos_cancelados alter column origen set not null;

-- -----------------------------------------------------------------------------
-- 2. Fin de semana
--
-- horarios_semanales solo tenía filas para dia_semana 1..5, así que el flag
-- habilitar_fin_semana no tenía ningún efecto: no existía grilla que habilitar.
-- Se replica la grilla de lunes en sábado y domingo; el flag global las activa.
-- -----------------------------------------------------------------------------
insert into public.horarios_semanales (dia_semana, hora_inicio, hora_fin, capacidad, clase_numero, activo)
select d.dia, hs.hora_inicio, hs.hora_fin, hs.capacidad, hs.clase_numero, true
from (values (6), (7)) as d(dia)
cross join public.horarios_semanales hs
where hs.dia_semana = 1
  and not exists (
    select 1 from public.horarios_semanales x
    where x.dia_semana = d.dia and x.clase_numero = hs.clase_numero
  );

alter table public.horarios_recurrentes_usuario
  drop constraint if exists horarios_recurrentes_usuario_dia_semana_check;
alter table public.horarios_recurrentes_usuario
  add constraint horarios_recurrentes_usuario_dia_semana_check
  check (dia_semana between 1 and 7);

-- -----------------------------------------------------------------------------
-- 3. Normalización de los horarios personalizados de feriados
--
-- El front venía guardando tres formas distintas de JSON. Las que no traían
-- "capacidad" hacían que obtener_clases_disponibles calculara capacidad 0: un
-- feriado habilitado no mostraba ningún cupo.
-- -----------------------------------------------------------------------------
create or replace function public.fn_normalizar_horarios_feriado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cap_default integer;
begin
  if new.horarios_personalizados is null
     or jsonb_typeof(new.horarios_personalizados) <> 'array'
     or jsonb_array_length(new.horarios_personalizados) = 0 then
    new.horarios_personalizados := null;
    return new;
  end if;

  select coalesce(max_alumnos_por_clase, 4) into v_cap_default
  from public.configuracion_admin
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  select jsonb_agg(
    jsonb_build_object(
      'hora_inicio', to_char((h->>'hora_inicio')::time, 'HH24:MI'),
      'hora_fin',    to_char((h->>'hora_fin')::time, 'HH24:MI'),
      'clase_numero', coalesce(
        (h->>'clase_numero')::int,
        public.fn_clase_numero_por_hora((h->>'hora_inicio')::time)
      ),
      'capacidad', greatest(1, coalesce((h->>'capacidad')::int, v_cap_default))
    )
    order by (h->>'hora_inicio')::time
  )
  into new.horarios_personalizados
  from jsonb_array_elements(new.horarios_personalizados) h;

  return new;
end;
$$;

drop trigger if exists trg_normalizar_horarios_feriado on public.feriados;
create trigger trg_normalizar_horarios_feriado
  before insert or update on public.feriados
  for each row
  execute function public.fn_normalizar_horarios_feriado();

update public.feriados set updated_at = now()
where horarios_personalizados is not null;

-- -----------------------------------------------------------------------------
-- 4. Estado del día
--
-- Un día cerrado (ausencia total, feriado sin horarios habilitados, bloqueo de
-- día completo o fecha inactiva) no debe ofrecer ninguna vacante.
-- Un día con horarios de feriado o de fin de semana habilitado ofrece
-- exactamente los cupos que declaró el admin.
-- -----------------------------------------------------------------------------
create or replace function public.fn_dia_estado(p_fecha date)
returns table(cerrado boolean, tipo text, feriado_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select coalesce(dias_inactivos, '') as dias_inactivos
    from public.configuracion_admin
    order by updated_at desc nulls last, created_at desc nulls last
    limit 1
  ),
  fer as (
    select f.id,
           f.tipo,
           (case when jsonb_typeof(f.horarios_personalizados) = 'array'
                 then jsonb_array_length(f.horarios_personalizados)
                 else 0 end) > 0 as tiene_horarios
    from public.feriados f
    where f.activo and f.fecha = p_fecha
    order by f.updated_at desc nulls last
    limit 1
  )
  select
    (
      exists (
        select 1 from public.ausencias_admin aa
        where aa.activo
          and p_fecha between aa.fecha_inicio and coalesce(aa.fecha_fin, aa.fecha_inicio)
          and coalesce(array_length(aa.clases_canceladas, 1), 0) = 0
      )
      or exists (
        select 1 from public.horarios_bloqueados hb
        where hb.activo and hb.fecha = p_fecha
          and (hb.tipo_bloqueo = 'dia_completo' or hb.horario_semanal_id is null)
      )
      or p_fecha::text = any (string_to_array((select dias_inactivos from cfg), ','))
      or exists (select 1 from fer where not tiene_horarios)
    ) as cerrado,
    case
      when exists (select 1 from fer where tiene_horarios and tipo = 'fin_semana_habilitado') then 'fin_semana'
      when exists (select 1 from fer where tiene_horarios) then 'feriado'
      else 'regular'
    end as tipo,
    (select id from fer where tiene_horarios) as feriado_id;
$$;

-- -----------------------------------------------------------------------------
-- 5. Disponibilidad: única fuente de verdad de capacidad y ocupación
-- -----------------------------------------------------------------------------
create or replace function public.fn_slots_disponibilidad(p_desde date, p_hasta date)
returns table(
  fecha date,
  clase_numero integer,
  hora_inicio time,
  hora_fin time,
  dia_semana integer,
  capacidad integer,
  ocupados integer,
  disponibles integer,
  origen text,
  feriado_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select coalesce(habilitar_fin_semana, false) as finde,
           coalesce(max_alumnos_por_clase, 4) as cap_default
    from public.configuracion_admin
    order by updated_at desc nulls last, created_at desc nulls last
    limit 1
  ),
  dias as (
    select d::date as fecha,
           case when extract(dow from d)::int = 0 then 7 else extract(dow from d)::int end as dow
    from generate_series(p_desde, p_hasta, interval '1 day') d
  ),
  estado as (
    select dias.fecha, dias.dow, e.cerrado, e.tipo, e.feriado_id
    from dias
    cross join lateral public.fn_dia_estado(dias.fecha) e
  ),
  slots_especiales as (
    select e.fecha,
           e.dow,
           (h->>'clase_numero')::int as clase_numero,
           (h->>'hora_inicio')::time as hora_inicio,
           (h->>'hora_fin')::time as hora_fin,
           greatest(1, coalesce((h->>'capacidad')::int, (select cap_default from cfg))) as capacidad,
           e.tipo as origen,
           e.feriado_id
    from estado e
    join public.feriados f on f.id = e.feriado_id
    cross join lateral jsonb_array_elements(f.horarios_personalizados) h
    where not e.cerrado
      and e.tipo in ('feriado', 'fin_semana')
  ),
  slots_regulares as (
    select e.fecha,
           e.dow,
           hs.clase_numero,
           hs.hora_inicio,
           hs.hora_fin,
           coalesce(
             (select ce.capacidad_especial
                from public.capacidad_especial_dias ce
               where ce.fecha = e.fecha
                 and coalesce(ce.activo, true)
                 and (ce.horario_semanal_id = hs.id or ce.horario_semanal_id is null)
               order by (ce.horario_semanal_id is null)
               limit 1),
             hs.capacidad
           ) as capacidad,
           'regular'::text as origen,
           null::uuid as feriado_id
    from estado e
    join public.horarios_semanales hs
      on hs.dia_semana = e.dow
     and coalesce(hs.activo, true)
    where not e.cerrado
      and e.tipo = 'regular'
      and (e.dow <= 5 or (select finde from cfg))
      and not exists (
        select 1 from public.ausencias_admin aa
        where aa.activo
          and e.fecha between aa.fecha_inicio and coalesce(aa.fecha_fin, aa.fecha_inicio)
          and hs.clase_numero = any (aa.clases_canceladas)
      )
      and not exists (
        select 1 from public.horarios_bloqueados hb
        where hb.activo and hb.fecha = e.fecha and hb.horario_semanal_id = hs.id
      )
  ),
  slots as (
    select * from slots_especiales
    union all
    select * from slots_regulares
  )
  select
    s.fecha,
    s.clase_numero,
    s.hora_inicio,
    s.hora_fin,
    s.dow as dia_semana,
    s.capacidad,
    (coalesce(rec.n, 0) + coalesce(vari.n, 0))::int as ocupados,
    greatest(0, s.capacidad - coalesce(rec.n, 0) - coalesce(vari.n, 0))::int as disponibles,
    s.origen,
    s.feriado_id
  from slots s
  left join lateral (
    -- Plan recurrente vigente, descontando quien ya canceló esa fecha puntual.
    -- En un feriado o fin de semana habilitado el día arranca sin reservas.
    select count(*)::int as n
    from public.horarios_recurrentes_usuario hru
    join public.profiles pr on pr.id = hru.usuario_id
    where s.origen = 'regular'
      and hru.dia_semana = s.dow
      and hru.clase_numero = s.clase_numero
      and coalesce(hru.activo, true)
      and (hru.fecha_inicio is null or hru.fecha_inicio <= s.fecha)
      and (hru.fecha_fin is null or hru.fecha_fin >= s.fecha)
      and coalesce(pr.is_active, true)
      and (pr.fecha_desactivacion is null or pr.fecha_desactivacion > s.fecha)
      and not exists (
        select 1 from public.turnos_cancelados tc
        where tc.cliente_id = hru.usuario_id
          and tc.turno_fecha = s.fecha
          and tc.clase_numero = s.clase_numero
      )
  ) rec on true
  left join lateral (
    select count(*)::int as n
    from public.turnos_variables tv
    where tv.turno_fecha = s.fecha
      and tv.clase_numero = s.clase_numero
      and tv.estado = 'confirmada'
  ) vari on true
  order by s.fecha, s.hora_inicio;
$$;

-- Compatibilidad: obtener_clases_disponibles queda como envoltorio delgado
-- sobre la nueva función para no dejar dos cálculos distintos vivos.
drop function if exists public.obtener_clases_disponibles(date, date);
create or replace function public.obtener_clases_disponibles(
  p_fecha_desde date default current_date,
  p_fecha_hasta date default null
)
returns table(
  turno_fecha date,
  clase_numero integer,
  turno_hora_inicio time,
  turno_hora_fin time,
  dia_semana integer,
  capacidad_total integer,
  alumnos_reservados integer,
  cupos_disponibles integer,
  origen text,
  feriado_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.fecha, s.clase_numero, s.hora_inicio, s.hora_fin, s.dia_semana,
         s.capacidad, s.ocupados, s.disponibles, s.origen, s.feriado_id
  from public.fn_slots_disponibilidad(
    p_fecha_desde,
    coalesce(p_fecha_hasta, (date_trunc('month', p_fecha_desde) + interval '2 months - 1 day')::date)
  ) s
  where s.disponibles > 0;
$$;

-- -----------------------------------------------------------------------------
-- 6. Cancelación tardía: 72 horas y zona horaria correcta
--
-- Antes eran 24 horas y el timestamp se construía con la zona de la sesión
-- (UTC en Supabase), corriendo el límite tres horas.
-- -----------------------------------------------------------------------------
create or replace function public.fn_es_cancelacion_tardia(
  p_turno_fecha date,
  p_turno_hora_inicio time,
  p_fecha_cancelacion timestamptz default now()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_inicio timestamptz;
  v_horas integer;
begin
  select coalesce(cancelacion_penalidad_horas, 72) into v_horas
  from public.configuracion_admin
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  v_inicio := (p_turno_fecha::text || ' ' || p_turno_hora_inicio::text)::timestamp
              at time zone 'America/Argentina/Buenos_Aires';

  return v_inicio < (p_fecha_cancelacion + make_interval(hours => coalesce(v_horas, 72)));
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Reservar una vacante
--
-- Antes: la capacidad salía de contar filas de turnos_disponibles, no validaba
-- que la fecha fuera futura, ni el día cerrado, ni la anticipación, y no
-- recalculaba la cuota.
-- -----------------------------------------------------------------------------
drop function if exists public.reservar_vacante(uuid, date, time, time);

create or replace function public.reservar_vacante(p_turno_fecha date, p_clase_numero integer)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_slot record;
  v_sistema_activo boolean;
  v_anticipacion integer;
  v_inicio timestamptz;
  v_cancelacion_id uuid;
  v_nueva_id uuid;
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

  -- Serializa a los que intentan tomar el mismo cupo a la vez.
  perform pg_advisory_xact_lock(hashtext(p_turno_fecha::text || ':' || p_clase_numero::text));

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

  -- Si vuelve sobre una clase que había cancelado, se revierte la cancelación
  -- en lugar de acumular una reserva variable encima del plan.
  select tc.id into v_cancelacion_id
  from public.turnos_cancelados tc
  where tc.cliente_id = v_uid
    and tc.turno_fecha = p_turno_fecha
    and tc.clase_numero = p_clase_numero
  limit 1;

  if v_cancelacion_id is not null then
    delete from public.turnos_cancelados where id = v_cancelacion_id;

    update public.turnos_variables
    set estado = 'confirmada', updated_at = now()
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

  insert into public.turnos_variables (
    cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin, clase_numero, estado
  ) values (
    v_uid, p_turno_fecha, v_slot.hora_inicio, v_slot.hora_fin, p_clase_numero, 'confirmada'
  ) returning id into v_nueva_id;

  perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(v_uid);
  return v_nueva_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Cancelar una clase propia
--
-- Antes el front insertaba en turnos_cancelados sin verificar que la clase
-- existiera y sin liberar el cupo, y la cancelación de una vacante reservada
-- fallaba en silencio.
-- -----------------------------------------------------------------------------
create or replace function public.fn_cancelar_clase(
  p_turno_fecha date,
  p_clase_numero integer,
  p_usuario_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_destino uuid := coalesce(p_usuario_id, auth.uid());
  v_es_admin boolean := public.is_user_admin(auth.uid());
  v_origen text;
  v_hora_inicio time;
  v_hora_fin time;
  v_dow integer;
  v_inicio timestamptz;
  v_tardia boolean;
  v_horas integer;
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

  select 'variable', tv.turno_hora_inicio, tv.turno_hora_fin
    into v_origen, v_hora_inicio, v_hora_fin
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

  -- Una cancelación hecha por el admin nunca penaliza al alumno.
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
  );

  if v_origen = 'variable' then
    update public.turnos_variables
    set estado = 'cancelada', updated_at = now()
    where cliente_id = v_destino
      and turno_fecha = p_turno_fecha
      and clase_numero = p_clase_numero
      and estado = 'confirmada';
  end if;

  perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(v_destino);

  return jsonb_build_object(
    'tardia', v_tardia,
    'origen', v_origen,
    'horas_penalidad', coalesce(v_horas, 72),
    'hora_inicio', v_hora_inicio
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. El admin agrega una clase a un alumno
--
-- Salta la anticipación pero respeta la capacidad real del cupo.
-- -----------------------------------------------------------------------------
create or replace function public.fn_admin_agregar_clase_alumno(
  p_usuario_id uuid,
  p_turno_fecha date,
  p_clase_numero integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slot record;
  v_cancelacion_id uuid;
  v_nueva_id uuid;
begin
  if not public.is_user_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_turno_fecha::text || ':' || p_clase_numero::text));

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
    delete from public.turnos_cancelados where id = v_cancelacion_id;
    update public.turnos_variables
    set estado = 'confirmada', updated_at = now()
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

  insert into public.turnos_variables (
    cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin, clase_numero, estado
  ) values (
    p_usuario_id, p_turno_fecha, v_slot.hora_inicio, v_slot.hora_fin, p_clase_numero, 'confirmada'
  ) returning id into v_nueva_id;

  perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(p_usuario_id);
  return v_nueva_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Baja del modelo viejo de vacantes materializadas
--
-- El trigger insertaba una fila en turnos_disponibles por cada cancelación, y
-- el front insertaba otra: de ahí las vacantes duplicadas. Ya no hace falta,
-- la vacante se deriva.
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select t.tgname, c.relname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal
      and p.proname in (
        'fn_crear_turno_disponible_desde_cancelacion',
        'crear_turno_disponible_desde_cancelacion'
      )
  loop
    execute format('drop trigger if exists %I on public.%I', r.tgname, r.relname);
  end loop;
end;
$$;

drop function if exists public.fn_crear_turno_disponible_desde_cancelacion() cascade;
drop function if exists public.crear_turno_disponible_desde_cancelacion() cascade;

-- -----------------------------------------------------------------------------
-- 11. combo_asignado solo cuenta el plan vigente
--
-- Contaba todas las filas activas sin mirar fecha_fin, así que durante un cambio
-- de plan (las viejas siguen activas hasta fin de mes y las nuevas ya existen)
-- el combo quedaba inflado con la suma de los dos planes.
-- -----------------------------------------------------------------------------
create or replace function public.actualizar_combo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := coalesce(new.usuario_id, old.usuario_id);
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_combo integer;
begin
  select least(count(*), 5) into v_combo
  from public.horarios_recurrentes_usuario h
  where h.usuario_id = v_usuario
    and coalesce(h.activo, true)
    and (h.fecha_fin is null or h.fecha_fin >= v_hoy);

  update public.profiles
  set combo_asignado = nullif(v_combo, 0)
  where id = v_usuario
    and combo_asignado is distinct from nullif(v_combo, 0);

  return coalesce(new, old);
end;
$$;

grant execute on function public.fn_slots_disponibilidad(date, date) to authenticated;
grant execute on function public.obtener_clases_disponibles(date, date) to authenticated;
grant execute on function public.reservar_vacante(date, integer) to authenticated;
grant execute on function public.fn_cancelar_clase(date, integer, uuid) to authenticated;
grant execute on function public.fn_admin_agregar_clase_alumno(uuid, date, integer) to authenticated;
grant execute on function public.fn_dia_estado(date) to authenticated;

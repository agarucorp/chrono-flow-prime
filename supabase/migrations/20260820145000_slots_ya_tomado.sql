-- =============================================================================
-- Fase 2 · fn_slots_disponibilidad expone si el usuario ya tiene el cupo
--
-- El front venía resolviendo esto con tres consultas extra y un Set de claves
-- "fecha_hora_hora" para no ofrecerle al alumno una clase que ya tiene. Como la
-- función es SECURITY DEFINER y conoce auth.uid(), lo resuelve el servidor.
-- =============================================================================

drop function if exists public.obtener_clases_disponibles(date, date);
drop function if exists public.fn_slots_disponibilidad(date, date);

create function public.fn_slots_disponibilidad(p_desde date, p_hasta date)
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
  feriado_id uuid,
  ya_tomado boolean
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
    s.feriado_id,
    (
      exists (
        select 1 from public.turnos_variables tv2
        where tv2.cliente_id = auth.uid()
          and tv2.turno_fecha = s.fecha
          and tv2.clase_numero = s.clase_numero
          and tv2.estado = 'confirmada'
      )
      or (
        s.origen = 'regular'
        and exists (
          select 1 from public.horarios_recurrentes_usuario h2
          where h2.usuario_id = auth.uid()
            and h2.dia_semana = s.dow
            and h2.clase_numero = s.clase_numero
            and coalesce(h2.activo, true)
            and (h2.fecha_inicio is null or h2.fecha_inicio <= s.fecha)
            and (h2.fecha_fin is null or h2.fecha_fin >= s.fecha)
        )
        and not exists (
          select 1 from public.turnos_cancelados tc2
          where tc2.cliente_id = auth.uid()
            and tc2.turno_fecha = s.fecha
            and tc2.clase_numero = s.clase_numero
        )
      )
    ) as ya_tomado
  from slots s
  left join lateral (
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

create function public.obtener_clases_disponibles(
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
  where s.disponibles > 0
    and not s.ya_tomado;
$$;

grant execute on function public.fn_slots_disponibilidad(date, date) to authenticated;
grant execute on function public.obtener_clases_disponibles(date, date) to authenticated;

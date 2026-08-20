-- Ya aplicada en remoto. La cuota cuenta las mismas clases que muestra vacantes.

create or replace function public.fn_clases_mes_usuario(
  p_usuario_id uuid,
  p_anio integer,
  p_mes integer
)
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
  vacantes_mes as (
    select count(*)::int as n
    from rango r
    join public.turnos_variables tv
      on tv.cliente_id = p_usuario_id
     and tv.turno_fecha between r.ini and r.fin
    join slots s
      on s.fecha = tv.turno_fecha
     and s.clase_numero = tv.clase_numero
    where tv.estado = 'confirmada'
       or exists (
         select 1
         from public.turnos_cancelados tc
         where tc.cliente_id = p_usuario_id
           and tc.turno_fecha = tv.turno_fecha
           and tc.clase_numero = tv.clase_numero
           and coalesce(tc.cancelacion_tardia, false)
           and lower(coalesce(tc.tipo_cancelacion, '')) = 'usuario'
       )
  ),
  creditos_mes as (
    select count(*)::int as n
    from rango r
    join public.turnos_cancelados tc
      on tc.cliente_id = p_usuario_id
     and tc.turno_fecha between r.ini and r.fin
    join slots s
      on s.fecha = tc.turno_fecha
     and s.clase_numero = tc.clase_numero
     and s.origen = 'regular'
    where tc.origen = 'recurrente'
      and not coalesce(tc.cancelacion_tardia, false)
      and lower(coalesce(tc.tipo_cancelacion, '')) <> 'sistema'
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
  select p.n, v.n, c.n, t.n, greatest(0, p.n + v.n - c.n)
  from plan_mes p, vacantes_mes v, creditos_mes c, tardias_mes t;
$$;

drop function if exists public.fn_clase_dada_de_baja(date, integer);

revoke all on function public.fn_clases_mes_usuario(uuid, integer, integer) from anon, authenticated;

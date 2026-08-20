-- Ya aplicada en remoto. Grilla semanal con ocupación de plan para alta y cambio.

create or replace function public.fn_ocupacion_plan_semanal()
returns table(
  horario_id uuid,
  dia_semana integer,
  clase_numero integer,
  hora_inicio time,
  hora_fin time,
  capacidad integer,
  ocupados integer,
  completo boolean
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with hoy as (
    select (timezone('America/Argentina/Buenos_Aires', now()))::date as d
  )
  select
    hs.id,
    hs.dia_semana,
    hs.clase_numero,
    hs.hora_inicio,
    hs.hora_fin,
    hs.capacidad,
    coalesce(o.n, 0)::int,
    coalesce(o.n, 0) >= hs.capacidad
  from public.horarios_semanales hs
  cross join hoy
  left join lateral (
    select count(*)::int as n
    from public.horarios_recurrentes_usuario h
    join public.profiles pr on pr.id = h.usuario_id
    where h.dia_semana = hs.dia_semana
      and h.clase_numero = hs.clase_numero
      and h.usuario_id <> auth.uid()
      and coalesce(h.activo, true)
      and (h.fecha_fin is null or h.fecha_fin >= hoy.d)
      and coalesce(pr.is_active, true)
      and (pr.fecha_desactivacion is null or pr.fecha_desactivacion > hoy.d)
  ) o on true
  where coalesce(hs.activo, true)
  order by hs.dia_semana, hs.clase_numero;
$$;

grant execute on function public.fn_ocupacion_plan_semanal() to authenticated;

drop function if exists public.contar_usuarios_horario_recurrente(smallint, text, text);

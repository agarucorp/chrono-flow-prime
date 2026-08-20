-- Primero se retiran las tablas viejas (una de ellas apunta a cancelaciones
-- duplicadas). Después se limpia el duplicado y se pone el índice único.

alter table public.turnos_variables
  drop constraint if exists turnos_variables_creado_desde_disponible_id_fkey;
alter table public.horarios_recurrentes_usuario
  drop constraint if exists horarios_recurrentes_usuario_turno_id_fkey;

alter table public.turnos_variables
  drop column if exists creado_desde_disponible_id;
alter table public.horarios_recurrentes_usuario
  drop column if exists turno_id;

drop function if exists public.fn_crear_turnos_disponibles_desde_feriado(date, jsonb);
drop table if exists public.turnos_disponibles;
drop table if exists public.turnos;

delete from public.turnos_cancelados t
where t.id in (
  select id from (
    select id,
           row_number() over (
             partition by cliente_id, turno_fecha, clase_numero
             order by
               case when lower(coalesce(tipo_cancelacion, '')) = 'usuario' then 0 else 1 end,
               case when coalesce(cancelacion_tardia, false) then 0 else 1 end,
               created_at
           ) as rn
    from public.turnos_cancelados
  ) s
  where rn > 1
);

create unique index if not exists turnos_variables_confirmada_unica
  on public.turnos_variables (cliente_id, turno_fecha, clase_numero)
  where estado = 'confirmada';

create unique index if not exists turnos_cancelados_unica
  on public.turnos_cancelados (cliente_id, turno_fecha, clase_numero);

create unique index if not exists hru_activa_unica
  on public.horarios_recurrentes_usuario (usuario_id, dia_semana, clase_numero)
  where coalesce(activo, true) and fecha_fin is null;

create index if not exists turnos_variables_fecha_clase_confirmada
  on public.turnos_variables (turno_fecha, clase_numero)
  where estado = 'confirmada';

create index if not exists turnos_cancelados_fecha_clase
  on public.turnos_cancelados (turno_fecha, clase_numero);

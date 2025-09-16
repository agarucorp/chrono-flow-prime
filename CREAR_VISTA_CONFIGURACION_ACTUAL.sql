-- VISTA consolidada de configuración actual

CREATE OR REPLACE VIEW public.v_configuracion_actual AS
WITH admin AS (
  SELECT tarifa_horaria,
         moneda,
         max_alumnos_por_clase,
         horario_apertura,
         horario_cierre,
         duracion_clase_minutos,
         anticipacion_reserva_horas,
         cancelacion_horas,
         sistema_activo,
         created_at
  FROM public.configuracion_admin
  WHERE sistema_activo = true
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT a.tarifa_horaria,
       a.moneda,
       a.max_alumnos_por_clase,
       a.horario_apertura,
       a.horario_cierre,
       a.duracion_clase_minutos,
       a.anticipacion_reserva_horas,
       a.cancelacion_horas,
       a.sistema_activo
FROM admin a;



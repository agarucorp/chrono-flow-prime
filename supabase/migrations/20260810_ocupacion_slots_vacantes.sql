-- Ocupación de slots recurrentes para Vacantes (bypass RLS; vigencia por fecha).

CREATE OR REPLACE FUNCTION public.fn_ocupacion_slots_recurrentes(
  p_desde date,
  p_hasta date
)
RETURNS TABLE (
  fecha date,
  hora_inicio text,
  hora_fin text,
  alumnos integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH dias AS (
    SELECT
      d::date AS fecha,
      CASE
        WHEN EXTRACT(DOW FROM d)::int = 0 THEN 7
        ELSE EXTRACT(DOW FROM d)::int
      END AS dia_semana
    FROM generate_series(p_desde, p_hasta, interval '1 day') AS d
  ),
  slots AS (
    SELECT DISTINCT
      hs.dia_semana::int AS dia_semana,
      SUBSTRING(hs.hora_inicio::text, 1, 5) AS hora_inicio,
      SUBSTRING(hs.hora_fin::text, 1, 5) AS hora_fin
    FROM public.horarios_semanales hs
    WHERE COALESCE(hs.activo, true) = true
  )
  SELECT
    dias.fecha,
    slots.hora_inicio,
    slots.hora_fin,
    COUNT(h.id)::int AS alumnos
  FROM dias
  JOIN slots ON slots.dia_semana = dias.dia_semana
  LEFT JOIN public.horarios_recurrentes_usuario h
    ON h.dia_semana = dias.dia_semana
   AND COALESCE(h.activo, true) = true
   AND SUBSTRING(h.hora_inicio::text, 1, 5) = slots.hora_inicio
   AND SUBSTRING(h.hora_fin::text, 1, 5) = slots.hora_fin
   AND (h.fecha_inicio IS NULL OR h.fecha_inicio <= dias.fecha)
   AND (h.fecha_fin IS NULL OR h.fecha_fin >= dias.fecha)
   AND EXISTS (
     SELECT 1
     FROM public.profiles p
     WHERE p.id = h.usuario_id
       AND COALESCE(p.is_active, true) = true
       AND (p.fecha_desactivacion IS NULL OR p.fecha_desactivacion > dias.fecha)
   )
  GROUP BY dias.fecha, slots.hora_inicio, slots.hora_fin;
$$;

COMMENT ON FUNCTION public.fn_ocupacion_slots_recurrentes(date, date) IS
'Ocupación de alumnos recurrentes vigentes por fecha/franja para pintar vacantes.';

REVOKE ALL ON FUNCTION public.fn_ocupacion_slots_recurrentes(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ocupacion_slots_recurrentes(date, date) TO authenticated, service_role;

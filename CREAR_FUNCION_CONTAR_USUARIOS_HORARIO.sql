-- Función para contar usuarios en un horario recurrente (vigentes + activos)
-- SECURITY DEFINER para poder verificar capacidad en onboarding sin RLS abierta

CREATE OR REPLACE FUNCTION public.contar_usuarios_horario_recurrente(
  p_dia_semana SMALLINT,
  p_hora_inicio TEXT, -- Formato HH:MM
  p_hora_fin TEXT    -- Formato HH:MM
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.horarios_recurrentes_usuario h
  JOIN public.profiles p ON p.id = h.usuario_id
  WHERE h.dia_semana = p_dia_semana
    AND COALESCE(h.activo, true) = true
    AND SUBSTRING(h.hora_inicio::TEXT, 1, 5) = p_hora_inicio
    AND SUBSTRING(h.hora_fin::TEXT, 1, 5) = p_hora_fin
    AND (h.fecha_inicio IS NULL OR h.fecha_inicio <= v_hoy)
    AND (h.fecha_fin IS NULL OR h.fecha_fin >= v_hoy)
    AND COALESCE(p.is_active, true) = true
    AND (p.fecha_desactivacion IS NULL OR p.fecha_desactivacion > v_hoy);

  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.contar_usuarios_horario_recurrente IS
'Cuenta alumnos vigentes (fecha_inicio/fin) y activos en un horario. No cuenta inactivos ni planes vencidos.';

REVOKE ALL ON FUNCTION public.contar_usuarios_horario_recurrente(smallint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contar_usuarios_horario_recurrente(smallint, text, text) TO authenticated, service_role;

-- Hardening: RPCs billing sin anon + cupo con vigencia/inactivos

REVOKE ALL ON FUNCTION public.fn_generar_cuotas_mes(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_asegurar_cuotas_actual_y_siguiente() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_recalcular_cuotas_usuario_actual_y_siguiente(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_generar_cuotas_mes(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_asegurar_cuotas_actual_y_siguiente() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_recalcular_cuotas_usuario_actual_y_siguiente(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.contar_usuarios_horario_recurrente(
  p_dia_semana SMALLINT,
  p_hora_inicio TEXT,
  p_hora_fin TEXT
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

REVOKE ALL ON FUNCTION public.contar_usuarios_horario_recurrente(smallint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contar_usuarios_horario_recurrente(smallint, text, text) TO authenticated, service_role;

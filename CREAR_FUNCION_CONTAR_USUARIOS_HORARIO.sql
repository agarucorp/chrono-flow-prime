-- Función para contar usuarios en un horario recurrente sin restricciones de RLS
-- Esta función es necesaria para que los usuarios nuevos puedan verificar la capacidad
-- de los horarios antes de seleccionarlos, sin necesidad de ser admin

CREATE OR REPLACE FUNCTION public.contar_usuarios_horario_recurrente(
  p_dia_semana SMALLINT,
  p_hora_inicio TEXT, -- Formato HH:MM
  p_hora_fin TEXT    -- Formato HH:MM
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con permisos del creador, ignorando RLS
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Contar usuarios recurrentes activos que coincidan con el día y hora
  -- Comparar solo HH:MM ignorando segundos
  SELECT COUNT(*) INTO v_count
  FROM public.horarios_recurrentes_usuario
  WHERE dia_semana = p_dia_semana
    AND activo = true
    AND SUBSTRING(hora_inicio::TEXT, 1, 5) = p_hora_inicio
    AND SUBSTRING(hora_fin::TEXT, 1, 5) = p_hora_fin;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Comentario para documentación
COMMENT ON FUNCTION public.contar_usuarios_horario_recurrente IS 
'Cuenta los usuarios recurrentes activos en un horario específico sin restricciones de RLS. Necesaria para que los usuarios nuevos puedan verificar la capacidad antes de seleccionar horarios.';

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.contar_usuarios_horario_recurrente TO authenticated;
GRANT EXECUTE ON FUNCTION public.contar_usuarios_horario_recurrente TO anon;


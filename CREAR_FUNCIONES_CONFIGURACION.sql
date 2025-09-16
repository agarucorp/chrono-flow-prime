-- FUNCIONES get_tarifa y get_capacidad con fallback a configuracion_admin

-- get_tarifa(tipo_clase, fecha)
CREATE OR REPLACE FUNCTION public.get_tarifa(p_tipo_clase TEXT, p_fecha DATE)
RETURNS DECIMAL AS $$
DECLARE
  v_tarifa DECIMAL(10,2);
BEGIN
  -- Buscar tarifa vigente por tipo de clase y fecha
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='configuracion_tarifas') THEN
    SELECT ct.tarifa_por_clase
      INTO v_tarifa
    FROM public.configuracion_tarifas ct
    WHERE ct.activo = true
      AND ct.tipo_clase = p_tipo_clase
      AND (ct.vigente_desde IS NULL OR ct.vigente_desde <= p_fecha)
      AND (ct.vigente_hasta IS NULL OR ct.vigente_hasta >= p_fecha)
    ORDER BY ct.vigente_desde DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_tarifa IS NOT NULL THEN
    RETURN v_tarifa;
  END IF;

  -- Fallback a tarifa_horaria global
  RETURN COALESCE((SELECT tarifa_horaria
                   FROM public.configuracion_admin
                   WHERE sistema_activo = true
                   ORDER BY created_at DESC
                   LIMIT 1), 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- get_capacidad(tipo_clase, fecha)
CREATE OR REPLACE FUNCTION public.get_capacidad(p_tipo_clase TEXT, p_fecha DATE)
RETURNS INTEGER AS $$
DECLARE
  v_capacidad INTEGER;
BEGIN
  -- Buscar capacidad vigente por tipo de clase y fecha
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='configuracion_capacidad') THEN
    SELECT cc.max_alumnos_por_clase
      INTO v_capacidad
    FROM public.configuracion_capacidad cc
    WHERE cc.activo = true
      AND cc.tipo_clase = p_tipo_clase
      AND (cc.vigente_desde IS NULL OR cc.vigente_desde <= p_fecha)
      AND (cc.vigente_hasta IS NULL OR cc.vigente_hasta >= p_fecha)
    ORDER BY cc.vigente_desde DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_capacidad IS NOT NULL THEN
    RETURN v_capacidad;
  END IF;

  -- Fallback a global
  RETURN COALESCE((SELECT max_alumnos_por_clase
                   FROM public.configuracion_admin
                   WHERE sistema_activo = true
                   ORDER BY created_at DESC
                   LIMIT 1), 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;



-- CREAR TABLA PARA AUSENCIAS POR PERÍODO
-- Esta tabla almacenará los períodos de ausencia del admin

CREATE TABLE IF NOT EXISTS public.ausencias_periodo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NOT NULL,
  motivo TEXT DEFAULT 'Ausencia del entrenador',
  tipo_ausencia VARCHAR(50) DEFAULT 'vacaciones' CHECK (tipo_ausencia IN ('vacaciones', 'enfermedad', 'personal', 'otro')),
  creado_por UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fecha_valida CHECK (fecha_hasta >= fecha_desde)
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_ausencias_periodo_fechas ON public.ausencias_periodo(fecha_desde, fecha_hasta);
CREATE INDEX IF NOT EXISTS idx_ausencias_periodo_creado_por ON public.ausencias_periodo(creado_por);

-- Habilitar RLS
ALTER TABLE public.ausencias_periodo ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Solo admin puede crear/leer
CREATE POLICY "ausencias_periodo_select_all" ON public.ausencias_periodo
FOR SELECT USING (true);

CREATE POLICY "ausencias_periodo_admin_all" ON public.ausencias_periodo
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Función para cancelar todos los turnos en un período
CREATE OR REPLACE FUNCTION public.fn_cancelar_turnos_en_periodo(
  p_fecha_desde DATE,
  p_fecha_hasta DATE,
  p_motivo TEXT DEFAULT 'Ausencia del entrenador'
)
RETURNS TABLE (
  turnos_cancelados INTEGER,
  horarios_cancelados INTEGER
) AS $$
DECLARE
  v_turnos_count INTEGER := 0;
  v_horarios_count INTEGER := 0;
BEGIN
  -- 1. Cancelar todos los turnos variables en el período
  WITH turnos_a_cancelar AS (
    SELECT 
      tv.id,
      tv.cliente_id,
      tv.turno_fecha,
      tv.turno_hora_inicio,
      tv.turno_hora_fin
    FROM public.turnos_variables tv
    WHERE tv.turno_fecha >= p_fecha_desde
      AND tv.turno_fecha <= p_fecha_hasta
      AND tv.estado = 'confirmada'
  )
  INSERT INTO public.turnos_cancelados (
    turno_id,
    cliente_id,
    turno_fecha,
    turno_hora_inicio,
    turno_hora_fin,
    tipo_cancelacion,
    motivo_cancelacion
  )
  SELECT 
    id,
    cliente_id,
    turno_fecha,
    turno_hora_inicio,
    turno_hora_fin,
    'admin',
    p_motivo
  FROM turnos_a_cancelar;
  
  GET DIAGNOSTICS v_turnos_count = ROW_COUNT;
  
  -- 2. Marcar los turnos variables como cancelados
  UPDATE public.turnos_variables
  SET 
    estado = 'cancelada',
    updated_at = NOW()
  WHERE turno_fecha >= p_fecha_desde
    AND turno_fecha <= p_fecha_hasta
    AND estado = 'confirmada';
  
  -- 3. Generar registros de cancelación para horarios recurrentes
  -- (por cada día del período, crear un registro de cancelación para cada horario recurrente)
  WITH fechas_periodo AS (
    SELECT generate_series(
      p_fecha_desde::timestamp,
      p_fecha_hasta::timestamp,
      '1 day'::interval
    )::date AS fecha
  ),
  horarios_en_periodo AS (
    SELECT DISTINCT
      hru.usuario_id,
      hru.hora_inicio,
      hru.hora_fin,
      fp.fecha,
      EXTRACT(DOW FROM fp.fecha) AS dia_semana_num
    FROM public.horarios_recurrentes_usuario hru
    CROSS JOIN fechas_periodo fp
    WHERE hru.activo = true
      AND EXTRACT(DOW FROM fp.fecha) = CASE 
        WHEN hru.dia_semana = 7 THEN 0  -- Domingo
        ELSE hru.dia_semana
      END
      AND EXTRACT(DOW FROM fp.fecha) NOT IN (0, 6)  -- Excluir fines de semana
  )
  INSERT INTO public.turnos_cancelados (
    cliente_id,
    turno_fecha,
    turno_hora_inicio,
    turno_hora_fin,
    tipo_cancelacion,
    motivo_cancelacion
  )
  SELECT 
    usuario_id,
    fecha,
    hora_inicio,
    hora_fin,
    'admin',
    p_motivo
  FROM horarios_en_periodo;
  
  GET DIAGNOSTICS v_horarios_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_turnos_count, v_horarios_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar tablas creadas
SELECT 'ausencias_periodo_ok' AS status;



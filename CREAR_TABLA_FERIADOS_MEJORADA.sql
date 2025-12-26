-- CREAR TABLA FERIADOS MEJORADA
-- Tabla para gestionar feriados con horarios personalizados
-- Permite marcar días hábiles como feriados y habilitar fines de semana con horarios personalizados

-- ============================
-- 1) TABLA
-- ============================
CREATE TABLE IF NOT EXISTS public.feriados (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha DATE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('dia_habil_feriado', 'fin_semana_habilitado')),
    motivo TEXT,
    horarios_personalizados JSONB, -- Array de objetos: [{"hora_inicio": "10:00", "hora_fin": "12:00"}, ...]
    activo BOOLEAN NOT NULL DEFAULT true,
    turnos_cancelados BOOLEAN DEFAULT false, -- Indica si ya se cancelaron los turnos de ese día
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(fecha, tipo) -- Evitar duplicados del mismo tipo en la misma fecha
);

-- Índice para búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_feriados_fecha ON public.feriados(fecha);
CREATE INDEX IF NOT EXISTS idx_feriados_activo ON public.feriados(activo);
CREATE INDEX IF NOT EXISTS idx_feriados_tipo ON public.feriados(tipo);

-- ============================
-- 2) TRIGGER UPDATED_AT
-- ============================
CREATE OR REPLACE FUNCTION update_feriados_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_feriados_timestamp ON public.feriados;
CREATE TRIGGER trigger_update_feriados_timestamp
  BEFORE UPDATE ON public.feriados
  FOR EACH ROW
  EXECUTE FUNCTION update_feriados_timestamp();

-- ============================
-- 3) RLS POLICIES
-- ============================
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: todos los usuarios autenticados pueden ver feriados activos
CREATE POLICY "feriados_select_authenticated" ON public.feriados
FOR SELECT USING (
  auth.role() = 'authenticated' OR auth.role() = 'service_role'
);

-- Políticas para INSERT/UPDATE/DELETE: solo admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feriados' AND policyname = 'feriados_insert_admin_only'
  ) THEN
    CREATE POLICY feriados_insert_admin_only ON public.feriados
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feriados' AND policyname = 'feriados_update_admin_only'
  ) THEN
    CREATE POLICY feriados_update_admin_only ON public.feriados
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feriados' AND policyname = 'feriados_delete_admin_only'
  ) THEN
    CREATE POLICY feriados_delete_admin_only ON public.feriados
    FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
      )
    );
  END IF;
END $$;

-- ============================
-- 4) FUNCIONES AUXILIARES
-- ============================

-- Función para verificar si una fecha es feriado (día hábil)
CREATE OR REPLACE FUNCTION es_feriado_dia_habil(fecha_consulta DATE)
RETURNS BOOLEAN AS $$
DECLARE
  es BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.feriados f
    WHERE f.activo = true 
      AND f.fecha = fecha_consulta 
      AND f.tipo = 'dia_habil_feriado'
  ) INTO es;
  RETURN COALESCE(es, false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Función para verificar si un fin de semana está habilitado
CREATE OR REPLACE FUNCTION es_fin_semana_habilitado(fecha_consulta DATE)
RETURNS BOOLEAN AS $$
DECLARE
  es BOOLEAN;
  dia_semana INTEGER;
BEGIN
  -- Verificar si es sábado (6) o domingo (0)
  dia_semana := EXTRACT(DOW FROM fecha_consulta);
  
  IF dia_semana NOT IN (0, 6) THEN
    RETURN false;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.feriados f
    WHERE f.activo = true 
      AND f.fecha = fecha_consulta 
      AND f.tipo = 'fin_semana_habilitado'
  ) INTO es;
  RETURN COALESCE(es, false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Función para obtener horarios personalizados de un feriado
CREATE OR REPLACE FUNCTION obtener_horarios_feriado(fecha_consulta DATE, tipo_feriado TEXT)
RETURNS JSONB AS $$
DECLARE
  horarios JSONB;
BEGIN
  SELECT f.horarios_personalizados INTO horarios
  FROM public.feriados f
  WHERE f.activo = true 
    AND f.fecha = fecha_consulta 
    AND f.tipo = tipo_feriado
  LIMIT 1;
  
  RETURN COALESCE(horarios, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Función para verificar si una fecha+hora está disponible según feriados
CREATE OR REPLACE FUNCTION es_horario_disponible_feriado(
  fecha_consulta DATE,
  hora_consulta TIME
)
RETURNS BOOLEAN AS $$
DECLARE
  es_dia_habil_feriado BOOLEAN;
  es_fin_semana_hab BOOLEAN;
  horarios_personalizados JSONB;
  horario_item JSONB;
  hora_inicio_feriado TIME;
  hora_fin_feriado TIME;
BEGIN
  -- Si es día hábil y está marcado como feriado
  es_dia_habil_feriado := es_feriado_dia_habil(fecha_consulta);
  
  IF es_dia_habil_feriado THEN
    -- Verificar si la hora está en los horarios personalizados
    horarios_personalizados := obtener_horarios_feriado(fecha_consulta, 'dia_habil_feriado');
    
    -- Si no hay horarios personalizados, el día está completamente cerrado
    IF horarios_personalizados IS NULL OR horarios_personalizados = '[]'::jsonb THEN
      RETURN false;
    END IF;
    
    -- Verificar si la hora está en alguno de los horarios personalizados
    FOR horario_item IN SELECT * FROM jsonb_array_elements(horarios_personalizados)
    LOOP
      hora_inicio_feriado := (horario_item->>'hora_inicio')::TIME;
      hora_fin_feriado := (horario_item->>'hora_fin')::TIME;
      
      IF hora_consulta >= hora_inicio_feriado AND hora_consulta < hora_fin_feriado THEN
        RETURN true;
      END IF;
    END LOOP;
    
    RETURN false;
  END IF;
  
  -- Si es fin de semana
  es_fin_semana_hab := es_fin_semana_habilitado(fecha_consulta);
  
  IF es_fin_semana_hab THEN
    -- Verificar si la hora está en los horarios personalizados
    horarios_personalizados := obtener_horarios_feriado(fecha_consulta, 'fin_semana_habilitado');
    
    -- Si no hay horarios personalizados, el día está cerrado
    IF horarios_personalizados IS NULL OR horarios_personalizados = '[]'::jsonb THEN
      RETURN false;
    END IF;
    
    -- Verificar si la hora está en alguno de los horarios personalizados
    FOR horario_item IN SELECT * FROM jsonb_array_elements(horarios_personalizados)
    LOOP
      hora_inicio_feriado := (horario_item->>'hora_inicio')::TIME;
      hora_fin_feriado := (horario_item->>'hora_fin')::TIME;
      
      IF hora_consulta >= hora_inicio_feriado AND hora_consulta < hora_fin_feriado THEN
        RETURN true;
      END IF;
    END LOOP;
    
    RETURN false;
  END IF;
  
  -- Si es fin de semana y NO está habilitado, está cerrado
  IF EXTRACT(DOW FROM fecha_consulta) IN (0, 6) THEN
    RETURN false;
  END IF;
  
  -- Día hábil normal, disponible
  RETURN true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


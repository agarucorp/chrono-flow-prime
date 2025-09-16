-- CREAR TABLA FERIADOS
-- Tabla para declarar días no laborables del sistema (reemplaza dias_inactivos string)

-- ============================
-- 1) TABLA
-- ============================
CREATE TABLE IF NOT EXISTS public.feriados (
    fecha DATE PRIMARY KEY,
    motivo TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
-- 3) RLS POLICIES (solo admin)
-- ============================
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feriados' AND policyname = 'feriados_select_admin_only'
  ) THEN
    CREATE POLICY feriados_select_admin_only ON public.feriados
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
      )
    );
  END IF;

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
CREATE OR REPLACE FUNCTION es_feriado(fecha_consulta DATE)
RETURNS BOOLEAN AS $$
DECLARE
  es BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.feriados f
    WHERE f.activo = true AND f.fecha = fecha_consulta
  ) INTO es;
  RETURN COALESCE(es, false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Compatibilidad: es_dia_inactivo ahora prioriza feriados
CREATE OR REPLACE FUNCTION es_dia_inactivo(fecha_consulta DATE)
RETURNS BOOLEAN AS $$
DECLARE
  dias_inactivos_text TEXT;
  dias_inactivos_array TEXT[];
  dia_consulta_str TEXT;
BEGIN
  -- Priorizar feriados
  IF es_feriado(fecha_consulta) THEN
    RETURN TRUE;
  END IF;

  -- Fallback a string legacy si existiera
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'configuracion_admin' AND column_name = 'dias_inactivos') THEN
    SELECT dias_inactivos INTO dias_inactivos_text
    FROM public.configuracion_admin
    WHERE sistema_activo = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF dias_inactivos_text IS NULL OR dias_inactivos_text = '' THEN
      RETURN FALSE;
    END IF;

    dias_inactivos_array := string_to_array(dias_inactivos_text, ',');
    dia_consulta_str := fecha_consulta::TEXT;
    RETURN dia_consulta_str = ANY(dias_inactivos_array);
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;




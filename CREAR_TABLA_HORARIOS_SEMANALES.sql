-- ============================================================================
-- TABLA UNIFICADA: horarios_semanales
-- ============================================================================
-- Reemplaza a: horarios_clase + horarios_entrenador
-- Funcionalidad: Una fila por cada horario de clase semanal
-- Editable desde: Panel Admin > Config > "Alumnos por clase"
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.horarios_semanales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  capacidad INTEGER NOT NULL DEFAULT 10 CHECK (capacidad > 0),
  alumnos_agendados INTEGER NOT NULL DEFAULT 0 CHECK (alumnos_agendados >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_alumnos_no_excede_capacidad CHECK (alumnos_agendados <= capacidad),
  CONSTRAINT uq_dia_hora UNIQUE (dia_semana, hora_inicio)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_horarios_semanales_dia ON public.horarios_semanales(dia_semana);
CREATE INDEX IF NOT EXISTS idx_horarios_semanales_hora_inicio ON public.horarios_semanales(hora_inicio);
CREATE INDEX IF NOT EXISTS idx_horarios_semanales_activo ON public.horarios_semanales(activo);

-- RLS
ALTER TABLE public.horarios_semanales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_horarios_semanales" ON public.horarios_semanales
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "admin_horarios_semanales" ON public.horarios_semanales
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_horarios_semanales_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_horarios_semanales_timestamp
  BEFORE UPDATE ON public.horarios_semanales
  FOR EACH ROW
  EXECUTE FUNCTION update_horarios_semanales_timestamp();


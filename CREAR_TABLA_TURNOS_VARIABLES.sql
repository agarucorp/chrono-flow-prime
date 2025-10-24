
CREATE TABLE IF NOT EXISTS public.turnos_variables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  turno_fecha DATE NOT NULL,
  turno_hora_inicio TIME NOT NULL,
  turno_hora_fin TIME NOT NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada', 'cancelada', 'completada')),
  creado_desde_disponible_id UUID REFERENCES public.turnos_disponibles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnos_variables_cliente_id ON public.turnos_variables(cliente_id);
CREATE INDEX IF NOT EXISTS idx_turnos_variables_fecha ON public.turnos_variables(turno_fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_variables_estado ON public.turnos_variables(estado);

ALTER TABLE public.turnos_variables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "turnos_variables_select_own" ON public.turnos_variables;
CREATE POLICY "turnos_variables_select_own" ON public.turnos_variables
FOR SELECT USING (cliente_id = auth.uid());

DROP POLICY IF EXISTS "turnos_variables_insert_own" ON public.turnos_variables;
CREATE POLICY "turnos_variables_insert_own" ON public.turnos_variables
FOR INSERT WITH CHECK (cliente_id = auth.uid());

DROP POLICY IF EXISTS "turnos_variables_update_own" ON public.turnos_variables;
CREATE POLICY "turnos_variables_update_own" ON public.turnos_variables
FOR UPDATE USING (cliente_id = auth.uid());

DROP POLICY IF EXISTS "turnos_variables_admin_all" ON public.turnos_variables;
CREATE POLICY "turnos_variables_admin_all" ON public.turnos_variables
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE OR REPLACE FUNCTION update_turnos_variables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_turnos_variables_updated_at ON public.turnos_variables;
CREATE TRIGGER trigger_update_turnos_variables_updated_at
  BEFORE UPDATE ON public.turnos_variables
  FOR EACH ROW
  EXECUTE FUNCTION update_turnos_variables_updated_at();

SELECT 'turnos_variables_ok' AS status,
       (SELECT COUNT(*) FROM public.turnos_variables) AS total;

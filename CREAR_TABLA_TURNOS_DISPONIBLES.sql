CREATE TABLE IF NOT EXISTS public.turnos_disponibles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turno_fecha DATE NOT NULL,
  turno_hora_inicio TIME NOT NULL,
  turno_hora_fin TIME NOT NULL,
  creado_desde_cancelacion_id UUID NOT NULL REFERENCES public.turnos_cancelados(id) ON DELETE CASCADE,
  creado_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnos_disponibles_fecha ON public.turnos_disponibles(turno_fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_disponibles_fecha_hora ON public.turnos_disponibles(turno_fecha, turno_hora_inicio);

ALTER TABLE public.turnos_disponibles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "turnos_disponibles_select_all" ON public.turnos_disponibles;
CREATE POLICY "turnos_disponibles_select_all" ON public.turnos_disponibles
FOR SELECT USING (true);

DROP POLICY IF EXISTS "turnos_disponibles_admin_all" ON public.turnos_disponibles;
CREATE POLICY "turnos_disponibles_admin_all" ON public.turnos_disponibles
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE OR REPLACE FUNCTION public.fn_crear_turno_disponible_desde_cancelacion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.turnos_disponibles (
    turno_fecha,
    turno_hora_inicio,
    turno_hora_fin,
    creado_desde_cancelacion_id
  ) VALUES (
    NEW.turno_fecha,
    NEW.turno_hora_inicio,
    NEW.turno_hora_fin,
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP TRIGGER IF EXISTS trigger_crear_turno_disponible ON public.turnos_cancelados;
CREATE TRIGGER trigger_crear_turno_disponible
AFTER INSERT ON public.turnos_cancelados
FOR EACH ROW
EXECUTE FUNCTION public.fn_crear_turno_disponible_desde_cancelacion();

SELECT 'turnos_disponibles_ok' AS status,
       (SELECT COUNT(*) FROM public.turnos_disponibles) AS total;



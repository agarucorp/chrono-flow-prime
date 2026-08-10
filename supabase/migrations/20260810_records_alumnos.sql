-- =============================================================================
-- Records de alumnos (disciplinas + entradas)
-- - Nombres de alumnos son texto libre (sin FK a profiles)
-- - Lectura: cualquier usuario autenticado
-- - Escritura: solo admin (usa public.is_admin() existente)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.record_disciplinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  unidad text NOT NULL CHECK (unidad IN ('kg', 'tiempo')),
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.record_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disciplina_id uuid NOT NULL REFERENCES public.record_disciplinas(id) ON DELETE CASCADE,
  alumno_nombre text NOT NULL,
  valor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_record_entries_disciplina
  ON public.record_entries(disciplina_id);

CREATE INDEX IF NOT EXISTS idx_record_disciplinas_orden
  ON public.record_disciplinas(orden, nombre);

ALTER TABLE public.record_disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "record_disciplinas_select_auth" ON public.record_disciplinas;
CREATE POLICY "record_disciplinas_select_auth" ON public.record_disciplinas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "record_disciplinas_write_admin" ON public.record_disciplinas;
CREATE POLICY "record_disciplinas_write_admin" ON public.record_disciplinas
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "record_entries_select_auth" ON public.record_entries;
CREATE POLICY "record_entries_select_auth" ON public.record_entries
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "record_entries_write_admin" ON public.record_entries;
CREATE POLICY "record_entries_write_admin" ON public.record_entries
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Semilla inicial de disciplinas (idempotente por nombre)
INSERT INTO public.record_disciplinas (nombre, unidad, orden)
SELECT v.nombre, v.unidad, v.orden
FROM (VALUES
  ('Remo', 'tiempo', 1),
  ('Ski', 'tiempo', 2),
  ('Cinta', 'tiempo', 3),
  ('Press plano', 'kg', 4)
) AS v(nombre, unidad, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM public.record_disciplinas d WHERE lower(d.nombre) = lower(v.nombre)
);

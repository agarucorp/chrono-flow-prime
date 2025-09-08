-- CREAR TABLA DE HORARIOS DE CLASE
-- Ejecutar en Supabase SQL Editor

-- 1. CREAR TABLA horarios_clase
CREATE TABLE IF NOT EXISTS public.horarios_clase (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 5), -- 1=Lunes ... 5=Viernes
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  capacidad_maxima INTEGER NOT NULL CHECK (capacidad_maxima > 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_dia_hora UNIQUE (dia_semana, hora_inicio)
);

-- 2. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_horarios_clase_dia ON public.horarios_clase(dia_semana);
CREATE INDEX IF NOT EXISTS idx_horarios_clase_hora_inicio ON public.horarios_clase(hora_inicio);

-- 3. HABILITAR RLS
ALTER TABLE public.horarios_clase ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS
-- Lectura: permitir a cualquier usuario autenticado ver los horarios
CREATE POLICY "Enable select for authenticated users" ON public.horarios_clase
FOR SELECT USING (
  auth.role() = 'authenticated' OR auth.role() = 'service_role'
);

-- Insertar/Actualizar/Eliminar: solo administradores
CREATE POLICY "Enable insert for admins only" ON public.horarios_clase
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Enable update for admins only" ON public.horarios_clase
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Enable delete for admins only" ON public.horarios_clase
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5. FUNCIÓN Y TRIGGER PARA updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_horarios_clase_updated_at 
  BEFORE UPDATE ON public.horarios_clase 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 6. CARGA INICIAL: Lunes (1) a Viernes (5), 8 horarios por día
-- Franja horaria base: 09:00-17:00 (bloques de 1 hora)
-- Capacidad por defecto: 10
INSERT INTO public.horarios_clase (dia_semana, hora_inicio, hora_fin, capacidad_maxima) VALUES
  -- Lunes (1)
  (1, '09:00', '10:00', 10),
  (1, '10:00', '11:00', 10),
  (1, '11:00', '12:00', 10),
  (1, '12:00', '13:00', 10),
  (1, '13:00', '14:00', 10),
  (1, '14:00', '15:00', 10),
  (1, '15:00', '16:00', 10),
  (1, '16:00', '17:00', 10),
  -- Martes (2)
  (2, '09:00', '10:00', 10),
  (2, '10:00', '11:00', 10),
  (2, '11:00', '12:00', 10),
  (2, '12:00', '13:00', 10),
  (2, '13:00', '14:00', 10),
  (2, '14:00', '15:00', 10),
  (2, '15:00', '16:00', 10),
  (2, '16:00', '17:00', 10),
  -- Miércoles (3)
  (3, '09:00', '10:00', 10),
  (3, '10:00', '11:00', 10),
  (3, '11:00', '12:00', 10),
  (3, '12:00', '13:00', 10),
  (3, '13:00', '14:00', 10),
  (3, '14:00', '15:00', 10),
  (3, '15:00', '16:00', 10),
  (3, '16:00', '17:00', 10),
  -- Jueves (4)
  (4, '09:00', '10:00', 10),
  (4, '10:00', '11:00', 10),
  (4, '11:00', '12:00', 10),
  (4, '12:00', '13:00', 10),
  (4, '13:00', '14:00', 10),
  (4, '14:00', '15:00', 10),
  (4, '15:00', '16:00', 10),
  (4, '16:00', '17:00', 10),
  -- Viernes (5)
  (5, '09:00', '10:00', 10),
  (5, '10:00', '11:00', 10),
  (5, '11:00', '12:00', 10),
  (5, '12:00', '13:00', 10),
  (5, '13:00', '14:00', 10),
  (5, '14:00', '15:00', 10),
  (5, '15:00', '16:00', 10),
  (5, '16:00', '17:00', 10);

-- 7. VERIFICACIONES BÁSICAS
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'horarios_clase' 
ORDER BY ordinal_position;

SELECT dia_semana, hora_inicio, hora_fin, capacidad_maxima, activo
FROM public.horarios_clase
ORDER BY dia_semana, hora_inicio;



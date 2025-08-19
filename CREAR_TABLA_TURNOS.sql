-- CREAR TABLA DE TURNOS
-- Ejecutar en Supabase SQL Editor

-- 1. CREAR TABLA TURNOS
CREATE TABLE IF NOT EXISTS public.turnos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado TEXT DEFAULT 'disponible' CHECK (estado IN ('disponible', 'ocupado', 'cancelado')),
  cliente_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  profesional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  servicio TEXT,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREAR ÍNDICES PARA MEJOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON public.turnos(fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_cliente_id ON public.turnos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_turnos_profesional_id ON public.turnos(profesional_id);
CREATE INDEX IF NOT EXISTS idx_turnos_estado ON public.turnos(estado);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_hora ON public.turnos(fecha, hora_inicio);

-- 3. HABILITAR RLS
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

-- 4. CREAR POLÍTICAS RLS
-- Política para INSERT - solo admins pueden crear turnos
CREATE POLICY "Enable insert for admins only" ON public.turnos
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Política para SELECT - admins ven todos, usuarios ven solo los suyos
CREATE POLICY "Enable select for admins and own turnos" ON public.turnos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) OR 
  cliente_id = auth.uid() OR 
  profesional_id = auth.uid()
);

-- Política para UPDATE - admins actualizan todos, usuarios solo los suyos
CREATE POLICY "Enable update for admins and own turnos" ON public.turnos
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) OR 
  cliente_id = auth.uid() OR 
  profesional_id = auth.uid()
);

-- Política para DELETE - solo admins pueden eliminar
CREATE POLICY "Enable delete for admins only" ON public.turnos
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5. CREAR FUNCIÓN PARA ACTUALIZAR TIMESTAMP
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. CREAR TRIGGER PARA ACTUALIZAR TIMESTAMP
CREATE TRIGGER update_turnos_updated_at 
  BEFORE UPDATE ON public.turnos 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 7. INSERTAR ALGUNOS TURNOS DE EJEMPLO
INSERT INTO public.turnos (fecha, hora_inicio, hora_fin, estado, servicio) VALUES
  (CURRENT_DATE, '09:00', '10:00', 'disponible', 'Entrenamiento Personal'),
  (CURRENT_DATE, '10:00', '11:00', 'disponible', 'Yoga'),
  (CURRENT_DATE, '11:00', '12:00', 'disponible', 'Spinning'),
  (CURRENT_DATE + INTERVAL '1 day', '09:00', '10:00', 'disponible', 'Entrenamiento Personal'),
  (CURRENT_DATE + INTERVAL '1 day', '10:00', '11:00', 'disponible', 'Yoga'),
  (CURRENT_DATE + INTERVAL '2 days', '09:00', '10:00', 'disponible', 'Entrenamiento Personal'),
  (CURRENT_DATE + INTERVAL '2 days', '10:00', '11:00', 'disponible', 'Spinning');

-- 8. VERIFICAR QUE LA TABLA SE CREÓ CORRECTAMENTE
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'turnos' 
ORDER BY ordinal_position;

-- 9. VERIFICAR LOS TURNOS DE EJEMPLO
SELECT 
  fecha, 
  hora_inicio, 
  hora_fin, 
  estado, 
  servicio 
FROM public.turnos 
ORDER BY fecha, hora_inicio;

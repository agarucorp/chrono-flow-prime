-- CREAR TABLA DE CONFIGURACIÓN PARA GESTIÓN DE TURNOS
-- Ejecutar en Supabase SQL Editor

-- 1. CREAR TABLA DE CONFIGURACIÓN
CREATE TABLE IF NOT EXISTS public.configuracion_turnos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  valor JSONB NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREAR TABLA DE DÍAS ESPECIALES
CREATE TABLE IF NOT EXISTS public.dias_especiales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('cerrado', 'medio_dia', 'feriado')),
  horarios JSONB, -- Para configurar horarios especiales
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AGREGAR COLUMNA max_alumnos A LA TABLA turnos
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS max_alumnos INTEGER DEFAULT 1;

-- 4. CREAR ÍNDICES PARA MEJORAR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_configuracion_turnos_nombre ON public.configuracion_turnos(nombre);
CREATE INDEX IF NOT EXISTS idx_dias_especiales_fecha ON public.dias_especiales(fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_estado ON public.turnos(fecha, estado);

-- 5. HABILITAR RLS
ALTER TABLE public.configuracion_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dias_especiales ENABLE ROW LEVEL SECURITY;

-- 6. CREAR POLÍTICAS RLS
-- Solo admins pueden gestionar configuración
CREATE POLICY "Enable all for admins" ON public.configuracion_turnos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Solo admins pueden gestionar días especiales
CREATE POLICY "Enable all for admins" ON public.dias_especiales
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 7. INSERTAR CONFIGURACIÓN INICIAL
INSERT INTO public.configuracion_turnos (nombre, valor, descripcion) VALUES
('horarios_disponibles', 
 '[
   {"hora_inicio": "08:00", "hora_fin": "09:00", "activo": true},
   {"hora_inicio": "09:00", "hora_fin": "10:00", "activo": true},
   {"hora_inicio": "10:00", "hora_fin": "11:00", "activo": true},
   {"hora_inicio": "11:00", "hora_fin": "12:00", "activo": true},
   {"hora_inicio": "15:00", "hora_fin": "16:00", "activo": true},
   {"hora_inicio": "16:00", "hora_fin": "17:00", "activo": true},
   {"hora_inicio": "18:00", "hora_fin": "19:00", "activo": true},
   {"hora_inicio": "19:00", "hora_fin": "20:00", "activo": true}
 ]'::jsonb,
 'Horarios disponibles para entrenamiento personal'
),
('dias_laborables', 
 '[
   {"nombre": "Domingo", "codigo": 0, "activo": false},
   {"nombre": "Lunes", "codigo": 1, "activo": true},
   {"nombre": "Martes", "codigo": 2, "activo": true},
   {"nombre": "Miércoles", "codigo": 3, "activo": true},
   {"nombre": "Jueves", "codigo": 4, "activo": true},
   {"nombre": "Viernes", "codigo": 5, "activo": true},
   {"nombre": "Sábado", "codigo": 6, "activo": false}
 ]'::jsonb,
 'Configuración de días laborables de la semana'
),
('configuracion_general', 
 '{"max_alumnos_por_turno": 1, "auto_generar_turnos": true, "dias_anticipacion": 30}'::jsonb,
 'Configuración general del sistema de turnos'
);

-- 8. CREAR TRIGGER PARA updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_configuracion_turnos_updated_at 
  BEFORE UPDATE ON public.configuracion_turnos 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dias_especiales_updated_at 
  BEFORE UPDATE ON public.dias_especiales 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. VERIFICAR TABLAS CREADAS
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('configuracion_turnos', 'dias_especiales')
ORDER BY table_name, ordinal_position;

-- 10. VERIFICAR CONFIGURACIÓN INICIAL
SELECT * FROM public.configuracion_turnos;

-- VERIFICAR Y CORREGIR ESTRUCTURA DE LA TABLA TURNOS
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar estructura actual de la tabla turnos
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'turnos' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar si existe la columna fecha
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'turnos' 
    AND column_name = 'fecha'
    AND table_schema = 'public'
) as columna_fecha_existe;

-- 3. Si no existe la columna fecha, agregarla
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS fecha DATE;

-- 4. Si no existe la columna estado, agregarla
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'disponible' CHECK (estado IN ('disponible', 'ocupado', 'cancelado'));

-- 5. Si no existe la columna cliente_id, agregarla
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. Si no existe la columna profesional_id, agregarla
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS profesional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 7. Si no existe la columna servicio, agregarla
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS servicio TEXT;

-- 8. Si no existe la columna notas, agregarla
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS notas TEXT;

-- 9. Si no existe la columna created_at, agregarla
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 10. Si no existe la columna updated_at, agregarla
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 11. Crear índices necesarios
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON public.turnos(fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_cliente_id ON public.turnos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_turnos_profesional_id ON public.turnos(profesional_id);
CREATE INDEX IF NOT EXISTS idx_turnos_estado ON public.turnos(estado);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_hora ON public.turnos(fecha, hora_inicio);

-- 12. Verificar estructura final
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'turnos' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 13. Verificar que la tabla tiene datos
SELECT COUNT(*) as total_turnos FROM public.turnos;

-- Verificar y agregar columnas necesarias para cambio de horarios
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar estructura actual
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'horarios_recurrentes_usuario' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Agregar combo_aplicado si no existe
ALTER TABLE public.horarios_recurrentes_usuario 
ADD COLUMN IF NOT EXISTS combo_aplicado INTEGER;

-- 3. Agregar tarifa_personalizada si no existe
ALTER TABLE public.horarios_recurrentes_usuario 
ADD COLUMN IF NOT EXISTS tarifa_personalizada NUMERIC(10, 2);

-- 4. Agregar clase_numero si no existe (ya debería existir según documentación)
ALTER TABLE public.horarios_recurrentes_usuario 
ADD COLUMN IF NOT EXISTS clase_numero INTEGER;

-- 5. Verificar estructura final
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'horarios_recurrentes_usuario' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- AGREGAR COLUMNAS DE USUARIO A TURNOS_CANCELADOS
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columnas de información del usuario
ALTER TABLE public.turnos_cancelados 
ADD COLUMN IF NOT EXISTS usuario_email TEXT,
ADD COLUMN IF NOT EXISTS usuario_nombre TEXT;

-- 2. Verificar que se agregaron correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'turnos_cancelados' 
    AND table_schema = 'public'
    AND column_name IN ('usuario_email', 'usuario_nombre')
ORDER BY ordinal_position;

-- 3. Verificar estructura completa
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'turnos_cancelados' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

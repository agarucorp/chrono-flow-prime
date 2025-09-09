-- CORREGIR TABLA TURNOS_CANCELADOS PARA HACER TURNO_ID OPCIONAL
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar la foreign key constraint
ALTER TABLE public.turnos_cancelados 
DROP CONSTRAINT IF EXISTS turnos_cancelados_turno_id_fkey;

-- 2. Hacer turno_id opcional (nullable)
ALTER TABLE public.turnos_cancelados 
ALTER COLUMN turno_id DROP NOT NULL;

-- 3. Verificar la estructura actualizada
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'turnos_cancelados' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

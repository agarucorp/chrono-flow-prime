-- CORREGIR TRIGGER PARA TURNOS_CANCELADOS
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar el trigger problemático
DROP TRIGGER IF EXISTS trigger_liberar_turno_cancelado ON public.turnos_cancelados;

-- 2. Eliminar la función problemática
DROP FUNCTION IF EXISTS liberar_turno_cancelado();

-- 3. Verificar que se eliminó correctamente
SELECT 
    'TRIGGER ELIMINADO' as status,
    COUNT(*) as triggers_restantes
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_liberar_turno_cancelado';

-- 4. Verificar estructura de la tabla turnos
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'turnos' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

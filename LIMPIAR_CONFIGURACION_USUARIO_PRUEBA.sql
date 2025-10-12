-- Script para limpiar completamente la configuración del usuario de prueba
-- Ejecutar este script para resetear el estado del usuario

-- 1. Eliminar horarios recurrentes del usuario
DELETE FROM horarios_recurrentes_usuario WHERE usuario_id = 'a244246e-2b21-4ee9-a1bc-0458315b21f1';

-- 2. Verificar que se eliminaron
SELECT COUNT(*) as horarios_eliminados FROM horarios_recurrentes_usuario WHERE usuario_id = 'a244246e-2b21-4ee9-a1bc-0458315b21f1';

-- 3. Verificar estado del usuario
SELECT 
    au.id,
    au.email,
    au.confirmed_at,
    au.created_at,
    p.role,
    p.created_at as profile_created
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email = 'federico.ruizmachado@gmail.com';

-- 4. Verificar si el trigger está funcionando
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%handle_new_user%';

-- 5. Verificar función del trigger
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- RESULTADO ESPERADO:
-- - horarios_eliminados: 0
-- - Usuario confirmado con perfil 'client'
-- - Trigger y función existentes

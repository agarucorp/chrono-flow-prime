-- 🔍 VERIFICACIÓN COMPLETA DEL SISTEMA DE PERFILES AUTOMÁTICOS
-- Este script verifica que todo esté funcionando correctamente

-- 1. Verificar que los triggers estén creados
SELECT 
    'TRIGGERS' as seccion,
    trigger_name,
    event_manipulation,
    action_timing,
    CASE 
        WHEN trigger_name IS NOT NULL THEN '✅ Creado'
        ELSE '❌ Faltante'
    END as estado
FROM information_schema.triggers 
WHERE trigger_name IN ('on_auth_user_confirmed', 'on_auth_user_created_confirmed')
AND event_object_table = 'users'
AND event_object_schema = 'auth'

UNION ALL

-- 2. Verificar que la función existe
SELECT 
    'FUNCION' as seccion,
    routine_name as trigger_name,
    routine_type as event_manipulation,
    'FUNCTION' as action_timing,
    CASE 
        WHEN routine_name IS NOT NULL THEN '✅ Creada'
        ELSE '❌ Faltante'
    END as estado
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user'
AND routine_schema = 'public'

UNION ALL

-- 3. Verificar constraint de roles
SELECT 
    'CONSTRAINT' as seccion,
    conname as trigger_name,
    'CHECK' as event_manipulation,
    'ROLES' as action_timing,
    CASE 
        WHEN pg_get_constraintdef(oid) LIKE '%client%' THEN '✅ Roles correctos (admin, professional, client)'
        ELSE '❌ Roles incorrectos'
    END as estado
FROM pg_constraint 
WHERE conname = 'profiles_role_check'

UNION ALL

-- 4. Verificar usuarios sin perfil
SELECT 
    'USUARIOS_SIN_PERFIL' as seccion,
    COUNT(*)::text as trigger_name,
    'CONFIRMADOS' as event_manipulation,
    'SIN_PERFIL' as action_timing,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Todos tienen perfil'
        ELSE '⚠️ ' || COUNT(*)::text || ' usuarios sin perfil'
    END as estado
FROM auth.users au
WHERE au.confirmed_at IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = au.id
);

-- 5. Estadísticas generales
SELECT 
    'ESTADISTICAS' as seccion,
    'Usuarios confirmados: ' || COUNT(*) as trigger_name,
    'auth.users' as event_manipulation,
    'TOTAL' as action_timing,
    '📊' as estado
FROM auth.users 
WHERE confirmed_at IS NOT NULL

UNION ALL

SELECT 
    'ESTADISTICAS' as seccion,
    'Perfiles existentes: ' || COUNT(*) as trigger_name,
    'profiles' as event_manipulation,
    'TOTAL' as action_timing,
    '📊' as estado
FROM profiles

UNION ALL

SELECT 
    'ESTADISTICAS' as seccion,
    'Roles: ' || STRING_AGG(DISTINCT role, ', ') as trigger_name,
    'profiles.role' as event_manipulation,
    'DISPONIBLES' as action_timing,
    '📊' as estado
FROM profiles 
WHERE role IS NOT NULL;

-- 6. Probar el sistema (simulación)
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_email TEXT := 'test_' || extract(epoch from now())::text || '@example.com';
    profile_created BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '🧪 PROBANDO SISTEMA AUTOMÁTICO...';
    
    -- Insertar usuario de prueba confirmado
    INSERT INTO auth.users (id, email, confirmed_at, created_at)
    VALUES (test_user_id, test_email, NOW(), NOW());
    
    -- Verificar si se creó el perfil automáticamente
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = test_user_id) INTO profile_created;
    
    IF profile_created THEN
        RAISE NOTICE '✅ PERFECTO: El perfil se creó automáticamente';
    ELSE
        RAISE NOTICE '❌ ERROR: El perfil NO se creó automáticamente';
    END IF;
    
    -- Limpiar datos de prueba
    DELETE FROM profiles WHERE id = test_user_id;
    DELETE FROM auth.users WHERE id = test_user_id;
    
    RAISE NOTICE '🧹 Datos de prueba eliminados';
END $$;

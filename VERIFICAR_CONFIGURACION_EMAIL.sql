-- Script para verificar la configuración de confirmación por email
-- Ejecutar en el SQL Editor de Supabase

-- 1. Verificar usuarios recientes y su estado de confirmación
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    raw_user_meta_data
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Verificar si existe la tabla profiles
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles'
);

-- 3. Si existe profiles, verificar su contenido
SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.created_at
FROM public.profiles p
ORDER BY p.created_at DESC
LIMIT 5;

-- 4. Verificar configuración de autenticación
-- Esta consulta te dirá si hay algún problema con la configuración
SELECT 
    'Total usuarios' as metric,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
    'Usuarios confirmados' as metric,
    COUNT(*) as count
FROM auth.users 
WHERE email_confirmed_at IS NOT NULL
UNION ALL
SELECT 
    'Usuarios pendientes' as metric,
    COUNT(*) as count
FROM auth.users 
WHERE email_confirmed_at IS NULL;

-- 5. Verificar triggers existentes
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_schema = 'auth' 
AND event_object_table = 'users';

-- 6. Verificar funciones relacionadas con autenticación
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%user%' OR routine_name LIKE '%auth%';

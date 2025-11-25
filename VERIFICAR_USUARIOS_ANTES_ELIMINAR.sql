-- =====================================================
-- SCRIPT PARA VERIFICAR USUARIOS ANTES DE ELIMINAR
-- Ejecuta esto primero para ver qué usuarios existen
-- =====================================================

-- 1. Verificar usuarios en auth.users con los emails a eliminar
SELECT 
    'Usuarios en auth.users' as tipo,
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users 
WHERE email IN (
    'ruiztonytr@gmail.com',
    'gastonaccenture@gmail.com',
    'fede.rz87@gmail.com',
    'versmax04@gmail.com',
    'belgranosuplementos@gmail.com',
    'gastondigilio@gmail.com',
    'federico.ruizmachado@gmail.com'
)
ORDER BY email;

-- 2. Verificar usuarios en profiles con los emails a eliminar
SELECT 
    'Usuarios en profiles' as tipo,
    id,
    email,
    role,
    is_active,
    created_at
FROM public.profiles 
WHERE email IN (
    'ruiztonytr@gmail.com',
    'gastonaccenture@gmail.com',
    'fede.rz87@gmail.com',
    'versmax04@gmail.com',
    'belgranosuplementos@gmail.com',
    'gastondigilio@gmail.com',
    'federico.ruizmachado@gmail.com'
)
ORDER BY email;

-- 3. Ver todos los usuarios en auth.users (últimos 20)
SELECT 
    'Todos los usuarios (últimos 20)' as tipo,
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users 
ORDER BY created_at DESC
LIMIT 20;

-- 4. Contar cuántos usuarios hay en total
SELECT 
    'Total usuarios en auth.users' as tipo,
    COUNT(*) as cantidad
FROM auth.users;


-- Script para verificar y corregir el problema de admin
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar si el usuario existe en auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'agaru.corp@gmail.com';

-- 2. Verificar si el usuario existe en profiles
SELECT id, email, role, created_at 
FROM profiles 
WHERE email = 'agaru.corp@gmail.com';

-- 3. Verificar por ID (si obtienes el ID del paso 1)
-- Reemplaza 'USER_ID_AQUI' con el ID real del paso 1
-- SELECT id, email, role, created_at 
-- FROM profiles 
-- WHERE id = 'USER_ID_AQUI';

-- 4. Si el usuario no existe en profiles, crearlo
-- (Solo ejecutar si no existe en profiles)
INSERT INTO profiles (id, email, role, created_at, updated_at)
SELECT 
  id,
  email,
  'admin',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'agaru.corp@gmail.com'
AND NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'agaru.corp@gmail.com');

-- 5. Si el usuario existe pero no tiene rol admin, actualizarlo
UPDATE profiles 
SET role = 'admin', updated_at = NOW()
WHERE email = 'agaru.corp@gmail.com' 
AND role != 'admin';

-- 6. Verificación final
SELECT id, email, role, created_at 
FROM profiles 
WHERE email = 'agaru.corp@gmail.com';

-- 7. Verificar todos los usuarios admin
SELECT id, email, role, created_at 
FROM profiles 
WHERE role = 'admin'
ORDER BY created_at DESC;

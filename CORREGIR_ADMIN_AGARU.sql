-- Script para corregir el rol de admin para agaru.corp@gmail.com
-- Ejecutar este script en el SQL Editor de Supabase

-- Primero, verificar si el usuario existe en la tabla profiles
SELECT id, email, role, created_at 
FROM profiles 
WHERE email = 'agaru.corp@gmail.com';

-- Actualizar el rol a 'admin' si existe
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'agaru.corp@gmail.com';

-- Verificar que se actualizó correctamente
SELECT id, email, role, created_at 
FROM profiles 
WHERE email = 'agaru.corp@gmail.com';

-- Si el usuario no existe, insertarlo (esto no debería ser necesario si ya se registró)
-- INSERT INTO profiles (id, email, role, created_at, updated_at)
-- SELECT 
--   (SELECT id FROM auth.users WHERE email = 'agaru.corp@gmail.com'),
--   'agaru.corp@gmail.com',
--   'admin',
--   NOW(),
--   NOW()
-- WHERE EXISTS (SELECT 1 FROM auth.users WHERE email = 'agaru.corp@gmail.com');

-- Verificar todos los usuarios admin
SELECT id, email, role, created_at 
FROM profiles 
WHERE role = 'admin'
ORDER BY created_at DESC;

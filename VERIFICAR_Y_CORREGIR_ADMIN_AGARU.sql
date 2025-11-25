-- =====================================================
-- VERIFICAR Y CORREGIR ROL ADMIN DE agaru.corp@gmail.com
-- =====================================================

-- 1. Verificar si el usuario existe en profiles
SELECT 
  'Usuario agaru.corp@gmail.com en profiles:' as info,
  id,
  email,
  role,
  is_active,
  created_at
FROM public.profiles
WHERE email = 'agaru.corp@gmail.com';

-- 2. Verificar si existe en auth.users
SELECT 
  'Usuario en auth.users:' as info,
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'agaru.corp@gmail.com';

-- 3. Actualizar el rol a admin si existe
UPDATE public.profiles
SET role = 'admin',
    updated_at = NOW()
WHERE email = 'agaru.corp@gmail.com';

-- 4. Verificar que se actualizó correctamente
SELECT 
  'Usuario después de actualizar:' as info,
  id,
  email,
  role,
  is_active,
  updated_at
FROM public.profiles
WHERE email = 'agaru.corp@gmail.com';

-- 5. Verificar todos los usuarios admin
SELECT 
  'Todos los usuarios admin:' as info,
  id,
  email,
  role,
  is_active
FROM public.profiles
WHERE role = 'admin'
ORDER BY created_at DESC;

-- 6. Mensaje final
SELECT '✅ Si el usuario existe, se actualizó el rol a admin. Recarga la página del panel admin.' as mensaje;


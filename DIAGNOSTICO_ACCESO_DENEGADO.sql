-- =====================================================
-- DIAGNÓSTICO: Por qué sigue apareciendo "Acceso Denegado"
-- =====================================================

-- 1. Verificar usuarios admin
SELECT 
  'Usuarios admin:' as info,
  id,
  email,
  role,
  is_active
FROM public.profiles
WHERE role = 'admin'
ORDER BY created_at DESC;

-- 2. Ver TODAS las políticas SELECT en profiles
SELECT 
  'Todas las políticas SELECT:' as info,
  policyname,
  cmd,
  permissive,
  roles,
  qual as condicion_using,
  with_check as condicion_with_check
FROM pg_policies 
WHERE tablename = 'profiles' 
  AND schemaname = 'public'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 3. Verificar si hay políticas que puedan estar bloqueando
SELECT 
  'Políticas que podrían estar bloqueando:' as info,
  policyname,
  qual
FROM pg_policies 
WHERE tablename = 'profiles' 
  AND schemaname = 'public'
  AND cmd = 'SELECT'
  AND (qual IS NULL OR qual = '' OR qual NOT LIKE '%auth.uid()%');

-- 4. Verificar la función is_user_admin
SELECT 
  'Función is_user_admin:' as info,
  proname,
  prosecdef,
  proisstrict,
  prosrc
FROM pg_proc 
WHERE proname = 'is_user_admin';

-- 5. Probar si un usuario puede ver su propio perfil
-- (Esto solo funciona si estás autenticado)
SELECT 
  'Test: Usuario actual puede ver su perfil:' as test,
  COUNT(*) as perfiles_visibles
FROM public.profiles
WHERE id = auth.uid();

-- 6. Verificar si RLS está habilitado
SELECT 
  'RLS habilitado:' as info,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'profiles' AND schemaname = 'public';


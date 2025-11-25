-- =====================================================
-- VERIFICAR TODAS LAS POLÍTICAS ACTUALES
-- =====================================================

-- 1. Ver TODAS las políticas en profiles (no solo SELECT)
SELECT 
  'Todas las políticas en profiles:' as info,
  policyname,
  cmd as operacion,
  permissive,
  qual as condicion_using,
  with_check as condicion_with_check
FROM pg_policies 
WHERE tablename = 'profiles' 
  AND schemaname = 'public'
ORDER BY cmd, policyname;

-- 2. Verificar si hay políticas duplicadas o conflictivas
SELECT 
  'Políticas SELECT en profiles:' as info,
  policyname,
  qual
FROM pg_policies 
WHERE tablename = 'profiles' 
  AND schemaname = 'public'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 3. Verificar la función is_user_admin
SELECT 
  'Función is_user_admin:' as info,
  proname,
  prosecdef,
  prosrc
FROM pg_proc 
WHERE proname = 'is_user_admin';

-- 4. Probar la función manualmente (solo si estás autenticado como admin)
SELECT 
  'Test función is_user_admin:' as info,
  public.is_user_admin(auth.uid()) as es_admin,
  auth.uid() as usuario_actual;


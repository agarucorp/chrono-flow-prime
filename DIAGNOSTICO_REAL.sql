-- =====================================================
-- DIAGNÓSTICO REAL DEL PROBLEMA DEL PANEL ADMIN
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Verificar si hay usuarios en la tabla profiles
SELECT 
  'Total de usuarios en profiles:' as diagnostico,
  COUNT(*) as total
FROM public.profiles;

-- 2. Verificar usuarios admin
SELECT 
  'Usuarios con rol admin:' as diagnostico,
  id,
  email,
  role,
  is_active,
  created_at
FROM public.profiles
WHERE role = 'admin';

-- 3. Verificar usuarios client
SELECT 
  'Usuarios con rol client:' as diagnostico,
  COUNT(*) as total_clientes
FROM public.profiles
WHERE role = 'client';

-- 4. Verificar si RLS está habilitado en profiles
SELECT 
  'RLS habilitado en profiles:' as diagnostico,
  rowsecurity as rls_habilitado
FROM pg_tables 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- 5. Verificar políticas RLS actuales en profiles
SELECT 
  'Políticas RLS en profiles:' as diagnostico,
  policyname,
  cmd as operacion,
  qual as condicion_using,
  with_check as condicion_with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY policyname;

-- 6. Verificar si la función is_user_admin existe
SELECT 
  'Función is_user_admin existe:' as diagnostico,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_user_admin') 
    THEN 'SÍ' 
    ELSE 'NO' 
  END as existe;

-- 7. Verificar estructura de la función is_user_admin (si existe)
SELECT 
  'Detalles de función is_user_admin:' as diagnostico,
  proname as nombre_funcion,
  prosecdef as security_definer,
  proisstrict as es_strict
FROM pg_proc 
WHERE proname = 'is_user_admin';

-- 8. Verificar si hay datos en cuotas_mensuales
SELECT 
  'Datos en cuotas_mensuales:' as diagnostico,
  COUNT(*) as total_cuotas
FROM public.cuotas_mensuales;

-- 9. Verificar políticas RLS en cuotas_mensuales
SELECT 
  'Políticas RLS en cuotas_mensuales:' as diagnostico,
  policyname,
  cmd as operacion
FROM pg_policies 
WHERE tablename = 'cuotas_mensuales' AND schemaname = 'public'
ORDER BY policyname;

-- 10. Verificar si RLS está habilitado en cuotas_mensuales
SELECT 
  'RLS habilitado en cuotas_mensuales:' as diagnostico,
  rowsecurity as rls_habilitado
FROM pg_tables 
WHERE tablename = 'cuotas_mensuales' AND schemaname = 'public';

-- 11. Probar si un usuario admin puede ver todos los perfiles
-- (Esto solo funciona si estás autenticado como admin)
SELECT 
  'Test: Usuario actual puede ver perfiles:' as diagnostico,
  COUNT(*) as perfiles_visibles
FROM public.profiles;

-- 12. Verificar si hay errores comunes: columnas faltantes
SELECT 
  'Columnas en profiles:' as diagnostico,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;


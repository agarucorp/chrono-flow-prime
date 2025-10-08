-- =====================================================
-- DIAGNÓSTICO COMPLETO DE USUARIOS Y CLIENTES
-- =====================================================
-- Ejecuta este script en Supabase SQL Editor para diagnosticar el problema

-- 1. VERIFICAR SI LA TABLA PROFILES EXISTE Y TIENE RLS ACTIVO
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM public.profiles) as total_records
FROM pg_tables 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- 2. VERIFICAR POLÍTICAS RLS ACTIVAS
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  cmd as command,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd;

-- 3. CONTAR USUARIOS POR ROL
SELECT 
  role,
  COUNT(*) as cantidad,
  ARRAY_AGG(email ORDER BY created_at DESC) as emails
FROM public.profiles
GROUP BY role;

-- 4. MOSTRAR TODOS LOS USUARIOS (primeros 10)
SELECT 
  id,
  email,
  role,
  full_name,
  first_name,
  last_name,
  is_active,
  created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;

-- 5. VERIFICAR SI HAY CLIENTES ESPECÍFICAMENTE
SELECT 
  COUNT(*) as total_clientes,
  COUNT(CASE WHEN is_active = true THEN 1 END) as clientes_activos
FROM public.profiles
WHERE role = 'client';

-- 6. MOSTRAR TODOS LOS CLIENTES
SELECT 
  email,
  full_name,
  COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') as nombre_completo,
  is_active,
  created_at
FROM public.profiles
WHERE role = 'client'
ORDER BY created_at DESC;

-- 7. VERIFICAR ADMINISTRADORES
SELECT 
  email,
  full_name,
  created_at
FROM public.profiles
WHERE role = 'admin'
ORDER BY created_at DESC;

-- 8. VERIFICAR SI EL USUARIO ACTUAL ES ADMIN
-- Nota: Reemplaza 'tu-email@example.com' con tu email
SELECT 
  email,
  role,
  CASE 
    WHEN role = 'admin' THEN '✅ Eres administrador'
    ELSE '❌ No eres administrador'
  END as status
FROM public.profiles
WHERE email = 'agaru.corp@gmail.com'; -- Cambia este email si es necesario

-- =====================================================
-- SOLUCIONES POSIBLES
-- =====================================================

-- SI NO HAY CLIENTES: Crear un cliente de prueba
-- DESCOMENTA ESTAS LÍNEAS SOLO SI NO HAY CLIENTES Y QUIERES CREAR UNO DE PRUEBA:

/*
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  first_name,
  last_name,
  role,
  is_active
) VALUES (
  gen_random_uuid(),
  'cliente.prueba@example.com',
  'Cliente de Prueba',
  'Cliente',
  'Prueba',
  'client',
  true
) ON CONFLICT (email) DO UPDATE SET
  role = 'client',
  is_active = true;
*/

-- SI NECESITAS CAMBIAR USUARIOS EXISTENTES A CLIENTES:
-- DESCOMENTA ESTAS LÍNEAS PARA CAMBIAR USUARIOS A ROL 'client':

/*
UPDATE public.profiles 
SET role = 'client'
WHERE role != 'admin' 
  AND email NOT IN ('agaru.corp@gmail.com', 'gastondigilio@gmail.com', 'fede.rz87@gmail.com');
*/

-- VERIFICACIÓN FINAL: Contar usuarios finales
SELECT 
  'RESUMEN FINAL' as info,
  (SELECT COUNT(*) FROM public.profiles) as total_usuarios,
  (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin') as total_admins,
  (SELECT COUNT(*) FROM public.profiles WHERE role = 'client') as total_clientes,
  (SELECT COUNT(*) FROM public.profiles WHERE role = 'client' AND is_active = true) as clientes_activos;


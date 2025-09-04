-- =====================================================
-- SCRIPT DE VERIFICACIÓN DEL SISTEMA DE LOGIN
-- =====================================================

-- 1. VERIFICAR QUE LA TABLA PROFILES EXISTE Y TIENE LA ESTRUCTURA CORRECTA
SELECT 
  'Verificando estructura de tabla profiles' as verificacion,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') 
    THEN '✅ Tabla profiles existe'
    ELSE '❌ Tabla profiles NO existe'
  END as resultado;

-- 2. VERIFICAR COLUMNAS DE LA TABLA PROFILES
SELECT 
  'Verificando columnas de profiles' as verificacion,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. VERIFICAR POLÍTICAS RLS
SELECT 
  'Verificando políticas RLS' as verificacion,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 4. VERIFICAR FUNCIONES CREADAS
SELECT 
  'Verificando funciones' as verificacion,
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('update_updated_at_column', 'handle_new_user', 'is_admin', 'get_user_role')
ORDER BY routine_name;

-- 5. VERIFICAR TRIGGERS
SELECT 
  'Verificando triggers' as verificacion,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND (trigger_name LIKE '%profiles%' OR trigger_name LIKE '%auth%')
ORDER BY trigger_name;

-- 6. VERIFICAR ÍNDICES
SELECT 
  'Verificando índices' as verificacion,
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE tablename = 'profiles'
ORDER BY indexname;

-- 7. VERIFICAR VISTAS
SELECT 
  'Verificando vistas' as verificacion,
  table_name,
  view_definition
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('active_users', 'users_by_role')
ORDER BY table_name;

-- 8. CONTAR USUARIOS EXISTENTES
SELECT 
  'Contando usuarios existentes' as verificacion,
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
  COUNT(CASE WHEN role = 'client' THEN 1 END) as clientes,
  COUNT(CASE WHEN is_active = true THEN 1 END) as usuarios_activos
FROM public.profiles;

-- 9. MOSTRAR USUARIOS ADMIN
SELECT 
  'Usuarios administradores' as verificacion,
  id,
  email,
  full_name,
  role,
  is_active,
  created_at
FROM public.profiles 
WHERE role = 'admin'
ORDER BY created_at DESC;

-- 10. VERIFICAR CONFIGURACIÓN DE AUTENTICACIÓN
SELECT 
  'Verificando configuración de auth' as verificacion,
  'auth.users' as tabla_auth,
  COUNT(*) as total_usuarios_auth
FROM auth.users;

-- 11. VERIFICAR QUE LOS USUARIOS DE AUTH TIENEN PERFILES
SELECT 
  'Verificando sincronización auth-profiles' as verificacion,
  COUNT(a.id) as usuarios_auth,
  COUNT(p.id) as perfiles_creados,
  COUNT(a.id) - COUNT(p.id) as usuarios_sin_perfil
FROM auth.users a
LEFT JOIN public.profiles p ON a.id = p.id;

-- 12. PROBAR FUNCIÓN is_admin CON UN USUARIO ADMIN (si existe)
DO $$
DECLARE
  admin_id UUID;
  es_admin BOOLEAN;
BEGIN
  -- Buscar un usuario admin
  SELECT id INTO admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
  
  IF admin_id IS NOT NULL THEN
    -- Probar función is_admin
    SELECT public.is_admin(admin_id) INTO es_admin;
    
    RAISE NOTICE 'Probando función is_admin con usuario %: %', admin_id, es_admin;
  ELSE
    RAISE NOTICE 'No hay usuarios admin para probar la función is_admin';
  END IF;
END $$;

-- 13. VERIFICAR PERMISOS DE LA TABLA
SELECT 
  'Verificando permisos' as verificacion,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY grantee, privilege_type;

-- 14. RESUMEN FINAL
SELECT 
  'RESUMEN FINAL' as verificacion,
  'Sistema de login verificado' as estado,
  NOW() as fecha_verificacion;

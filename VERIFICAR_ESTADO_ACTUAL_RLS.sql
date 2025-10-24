-- VERIFICAR ESTADO ACTUAL DE POLÍTICAS RLS
-- Ejecutar ANTES de aplicar ORGANIZAR_POLITICAS_RLS.sql

-- ==============================================
-- 1. VERIFICAR POLÍTICAS ACTUALES
-- ==============================================

-- Políticas de profiles
SELECT 
  'PROFILES POLICIES' as seccion,
  policyname as nombre_politica,
  cmd as operacion,
  permissive as permisiva,
  roles as roles_aplicados,
  qual as condicion_where,
  with_check as condicion_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Políticas de turnos
SELECT 
  'TURNOS POLICIES' as seccion,
  policyname as nombre_politica,
  cmd as operacion,
  permissive as permisiva,
  roles as roles_aplicados,
  qual as condicion_where,
  with_check as condicion_check
FROM pg_policies 
WHERE tablename = 'turnos'
ORDER BY cmd, policyname;

-- ==============================================
-- 2. IDENTIFICAR POLÍTICAS "UNRESTRICTED"
-- ==============================================

-- Políticas con condiciones muy permisivas (que aparecen como unrestricted)
SELECT 
  'UNRESTRICTED POLICIES' as seccion,
  tablename as tabla,
  policyname as nombre_politica,
  cmd as operacion,
  CASE 
    WHEN qual = 'true' THEN '❌ COMPLETAMENTE ABIERTA'
    WHEN qual LIKE '%true%' THEN '⚠️ MUY PERMISIVA'
    WHEN qual IS NULL THEN '❌ SIN CONDICIÓN'
    ELSE '✅ CON CONDICIÓN'
  END as nivel_seguridad,
  qual as condicion
FROM pg_policies 
WHERE qual = 'true' OR qual IS NULL OR qual LIKE '%true%'
ORDER BY tablename, cmd;

-- ==============================================
-- 3. VERIFICAR ESTADO RLS
-- ==============================================

SELECT 
  'RLS STATUS' as seccion,
  tablename as tabla,
  rowsecurity as rls_habilitado,
  CASE 
    WHEN rowsecurity THEN '✅ RLS ACTIVO'
    ELSE '❌ RLS INACTIVO'
  END as estado
FROM pg_tables 
WHERE tablename IN ('profiles', 'turnos', 'reservas', 'pagos')
ORDER BY tablename;

-- ==============================================
-- 4. VERIFICAR FUNCIONES AUXILIARES
-- ==============================================

SELECT 
  'HELPER FUNCTIONS' as seccion,
  routine_name as nombre_funcion,
  routine_type as tipo,
  data_type as tipo_retorno,
  routine_definition as definicion
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('is_user_admin', 'is_admin')
ORDER BY routine_name;

-- ==============================================
-- 5. VERIFICAR USUARIOS Y ROLES
-- ==============================================

SELECT 
  'USER ROLES' as seccion,
  email,
  full_name,
  role,
  CASE 
    WHEN role = 'admin' THEN '👑 ADMINISTRADOR'
    WHEN role = 'user' THEN '👤 USUARIO'
    ELSE '❓ ROL DESCONOCIDO'
  END as tipo_usuario,
  created_at
FROM public.profiles 
ORDER BY role DESC, created_at DESC;

-- ==============================================
-- 6. ESTADÍSTICAS DE SEGURIDAD
-- ==============================================

-- Contar políticas por nivel de seguridad
SELECT 
  'SECURITY SUMMARY' as seccion,
  tablename as tabla,
  COUNT(*) as total_politicas,
  COUNT(CASE WHEN qual = 'true' THEN 1 END) as politicas_abiertas,
  COUNT(CASE WHEN qual LIKE '%auth.uid()%' THEN 1 END) as politicas_autenticadas,
  COUNT(CASE WHEN qual LIKE '%admin%' THEN 1 END) as politicas_admin
FROM pg_policies 
WHERE tablename IN ('profiles', 'turnos')
GROUP BY tablename
ORDER BY tablename;

-- ORGANIZAR POLÍTICAS RLS - ELIMINAR COMPONENTES "UNRESTRICTED"
-- Ejecutar en Supabase SQL Editor para limpiar y organizar las políticas

-- ==============================================
-- 1. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- ==============================================

-- Eliminar políticas de la tabla profiles
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable select for own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable select for users and admins" ON public.profiles;
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users and admins" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete for admins only" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;

-- Eliminar políticas de la tabla turnos
DROP POLICY IF EXISTS "Enable insert for all" ON public.turnos;
DROP POLICY IF EXISTS "Enable insert for admins only" ON public.turnos;
DROP POLICY IF EXISTS "Enable select for all" ON public.turnos;
DROP POLICY IF EXISTS "Enable select for admins and users" ON public.turnos;
DROP POLICY IF EXISTS "Enable update for all" ON public.turnos;
DROP POLICY IF EXISTS "Enable update for debugging" ON public.turnos;
DROP POLICY IF EXISTS "Enable update for admins and own turnos" ON public.turnos;
DROP POLICY IF EXISTS "Enable delete for all" ON public.turnos;
DROP POLICY IF EXISTS "Enable delete for admins only" ON public.turnos;

-- ==============================================
-- 2. CREAR FUNCIÓN HELPER PARA VERIFICAR ADMIN
-- ==============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 3. CREAR POLÍTICAS ORGANIZADAS PARA PROFILES
-- ==============================================

-- INSERT: Solo usuarios autenticados pueden crear su perfil
CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- SELECT: Usuarios ven su perfil, admins ven todos
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR is_admin()
);

-- UPDATE: Usuarios actualizan su perfil, admins actualizan todos
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
FOR UPDATE USING (
  auth.uid() = id OR is_admin()
);

-- DELETE: Solo admins pueden eliminar perfiles
CREATE POLICY "profiles_delete_admin_only" ON public.profiles
FOR DELETE USING (is_admin());

-- ==============================================
-- 4. CREAR POLÍTICAS ORGANIZADAS PARA TURNOS
-- ==============================================

-- INSERT: Solo admins pueden crear turnos
CREATE POLICY "turnos_insert_admin_only" ON public.turnos
FOR INSERT WITH CHECK (is_admin());

-- SELECT: Admins ven todos, usuarios ven turnos disponibles y sus reservas
CREATE POLICY "turnos_select_available_and_own" ON public.turnos
FOR SELECT USING (
  is_admin() OR 
  estado = 'disponible' OR 
  cliente_id = auth.uid()
);

-- UPDATE: Admins pueden actualizar todo, usuarios solo turnos disponibles
CREATE POLICY "turnos_update_admin_or_available" ON public.turnos
FOR UPDATE USING (
  is_admin() OR 
  estado = 'disponible'
);

-- DELETE: Solo admins pueden eliminar turnos
CREATE POLICY "turnos_delete_admin_only" ON public.turnos
FOR DELETE USING (is_admin());

-- ==============================================
-- 5. VERIFICAR CONFIGURACIÓN FINAL
-- ==============================================

-- Verificar políticas de profiles
SELECT 
  'PROFILES' as tabla,
  policyname as politica,
  cmd as operacion,
  CASE 
    WHEN qual LIKE '%auth.uid() = id%' THEN 'Usuario propio'
    WHEN qual LIKE '%is_admin()%' THEN 'Solo admin'
    WHEN qual LIKE '%auth.uid() = id OR is_admin()%' THEN 'Usuario propio o admin'
    ELSE 'Otra condición'
  END as descripcion
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Verificar políticas de turnos
SELECT 
  'TURNOS' as tabla,
  policyname as politica,
  cmd as operacion,
  CASE 
    WHEN qual LIKE '%is_admin()%' AND qual NOT LIKE '%OR%' THEN 'Solo admin'
    WHEN qual LIKE '%is_admin() OR%' THEN 'Admin o condición específica'
    WHEN qual LIKE '%estado = ''disponible''%' THEN 'Turnos disponibles'
    ELSE 'Otra condición'
  END as descripcion
FROM pg_policies 
WHERE tablename = 'turnos'
ORDER BY cmd, policyname;

-- Verificar que RLS esté activo
SELECT 
  tablename,
  rowsecurity as rls_activo,
  CASE 
    WHEN rowsecurity THEN '✅ Activado'
    ELSE '❌ Desactivado'
  END as estado
FROM pg_tables 
WHERE tablename IN ('profiles', 'turnos')
ORDER BY tablename;

-- ==============================================
-- 6. VERIFICAR USUARIOS ADMIN
-- ==============================================

SELECT 
  'ADMIN USERS' as info,
  email,
  full_name,
  role,
  created_at
FROM public.profiles 
WHERE role = 'admin'
ORDER BY created_at DESC;

-- ==============================================
-- 7. ESTADÍSTICAS DE TABLAS
-- ==============================================

SELECT 
  'TABLA STATS' as info,
  'profiles' as tabla,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
  COUNT(CASE WHEN role = 'user' THEN 1 END) as usuarios
FROM public.profiles

UNION ALL

SELECT 
  'TABLA STATS' as info,
  'turnos' as tabla,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN estado = 'disponible' THEN 1 END) as disponibles,
  COUNT(CASE WHEN estado = 'ocupado' THEN 1 END) as ocupados
FROM public.turnos;

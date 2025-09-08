-- LIMPIAR POLÍTICAS PROBLEMÁTICAS - ELIMINAR COMPONENTES "UNRESTRICTED"
-- Ejecutar en Supabase SQL Editor para limpiar políticas muy permisivas

-- ==============================================
-- 1. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- ==============================================

-- Eliminar TODAS las políticas de profiles
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_record.policyname);
    END LOOP;
END $$;

-- Eliminar TODAS las políticas de turnos
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'turnos'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.turnos', policy_record.policyname);
    END LOOP;
END $$;

-- ==============================================
-- 2. VERIFICAR LIMPIEZA
-- ==============================================

-- Verificar que no queden políticas
SELECT 
  'CLEANUP VERIFICATION' as seccion,
  tablename as tabla,
  COUNT(*) as politicas_restantes
FROM pg_policies 
WHERE tablename IN ('profiles', 'turnos')
GROUP BY tablename;

-- ==============================================
-- 3. CREAR FUNCIÓN HELPER SEGURA
-- ==============================================

-- Eliminar función anterior si existe
DROP FUNCTION IF EXISTS is_admin();
DROP FUNCTION IF EXISTS is_user_admin(UUID);

-- Crear función helper segura
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar que el usuario esté autenticado
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar que sea admin
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 4. CREAR POLÍTICAS SEGURAS Y ORGANIZADAS
-- ==============================================

-- POLÍTICAS PARA PROFILES
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

-- POLÍTICAS PARA TURNOS
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

-- Verificar políticas creadas
SELECT 
  'FINAL POLICIES' as seccion,
  tablename as tabla,
  policyname as nombre_politica,
  cmd as operacion,
  CASE 
    WHEN qual LIKE '%auth.uid() = id%' AND qual NOT LIKE '%OR%' THEN '👤 Solo propio'
    WHEN qual LIKE '%is_admin()%' AND qual NOT LIKE '%OR%' THEN '👑 Solo admin'
    WHEN qual LIKE '%auth.uid() = id OR is_admin()%' THEN '👤+👑 Propio o admin'
    WHEN qual LIKE '%is_admin() OR%' THEN '👑+ Condición admin'
    ELSE '🔍 Otra condición'
  END as descripcion_seguridad
FROM pg_policies 
WHERE tablename IN ('profiles', 'turnos')
ORDER BY tablename, cmd;

-- Verificar que no hay políticas "unrestricted"
SELECT 
  'UNRESTRICTED CHECK' as seccion,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ No hay políticas unrestricted'
    ELSE '❌ Aún hay políticas unrestricted: ' || COUNT(*)::text
  END as resultado
FROM pg_policies 
WHERE qual = 'true' OR qual IS NULL;

-- Verificar RLS activo
SELECT 
  'RLS STATUS' as seccion,
  tablename as tabla,
  CASE 
    WHEN rowsecurity THEN '✅ RLS ACTIVO'
    ELSE '❌ RLS INACTIVO - ACTIVAR MANUALMENTE'
  END as estado
FROM pg_tables 
WHERE tablename IN ('profiles', 'turnos')
ORDER BY tablename;

-- ==============================================
-- 6. INSTRUCCIONES FINALES
-- ==============================================

SELECT 
  'NEXT STEPS' as seccion,
  '1. Verificar que RLS esté activo en ambas tablas' as paso_1,
  '2. Probar login de usuario normal' as paso_2,
  '3. Probar funciones de admin' as paso_3,
  '4. Verificar que no aparezcan componentes "unrestricted"' as paso_4;

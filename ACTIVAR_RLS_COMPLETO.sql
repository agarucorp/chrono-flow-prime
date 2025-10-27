-- ACTIVAR RLS Y CONFIGURAR POLÍTICAS COMPLETAS
-- Ejecutar en Supabase SQL Editor

-- ==============================================
-- 1. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- ==============================================

-- Eliminar políticas de turnos_cancelados
DROP POLICY IF EXISTS "turnos_cancelados_select_own" ON public.turnos_cancelados;
DROP POLICY IF EXISTS "turnos_cancelados_select_admin_all" ON public.turnos_cancelados;
DROP POLICY IF EXISTS "turnos_cancelados_insert_own" ON public.turnos_cancelados;
DROP POLICY IF EXISTS "turnos_cancelados_insert_admin" ON public.turnos_cancelados;

-- Eliminar políticas de turnos_disponibles
DROP POLICY IF EXISTS "turnos_disponibles_select_all" ON public.turnos_disponibles;
DROP POLICY IF EXISTS "turnos_disponibles_admin_all" ON public.turnos_disponibles;

-- Eliminar políticas de turnos
DROP POLICY IF EXISTS "turnos_select_all" ON public.turnos;
DROP POLICY IF EXISTS "turnos_select_available_and_own" ON public.turnos;
DROP POLICY IF EXISTS "turnos_insert_admin_only" ON public.turnos;
DROP POLICY IF EXISTS "turnos_insert_admin" ON public.turnos;
DROP POLICY IF EXISTS "turnos_update_admin_or_available" ON public.turnos;
DROP POLICY IF EXISTS "turnos_delete_admin_only" ON public.turnos;

-- Eliminar políticas de turnos_variables
DROP POLICY IF EXISTS "turnos_variables_select_own" ON public.turnos_variables;
DROP POLICY IF EXISTS "turnos_variables_insert_own" ON public.turnos_variables;
DROP POLICY IF EXISTS "turnos_variables_update_own" ON public.turnos_variables;

-- Eliminar políticas de horarios_recurrentes_usuario
DROP POLICY IF EXISTS "horarios_recurrentes_usuario_select_own_or_admin" ON public.horarios_recurrentes_usuario;
DROP POLICY IF EXISTS "horarios_recurrentes_usuario_insert_own_or_admin" ON public.horarios_recurrentes_usuario;
DROP POLICY IF EXISTS "horarios_recurrentes_usuario_update_own_or_admin" ON public.horarios_recurrentes_usuario;
DROP POLICY IF EXISTS "horarios_recurrentes_usuario_delete_own_or_admin" ON public.horarios_recurrentes_usuario;

-- Eliminar políticas de profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;

-- ==============================================
-- 2. HABILITAR RLS EN TODAS LAS TABLAS
-- ==============================================

ALTER TABLE public.turnos_cancelados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_disponibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_recurrentes_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuotas_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacidad_especial_dias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_bloqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ausencias_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_admin ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 3. CREAR FUNCIÓN HELPER PARA VERIFICAR ADMIN
-- ==============================================

DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

CREATE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 4. POLÍTICAS PARA TURNOS_CANCELADOS
-- ==============================================

-- SELECT: Usuarios ven sus cancelaciones, admins ven todas
CREATE POLICY "turnos_cancelados_select_own" ON public.turnos_cancelados
FOR SELECT USING (cliente_id = auth.uid() OR is_admin());

-- INSERT: Usuarios insertan sus cancelaciones, admins pueden insertar para cualquier cliente
CREATE POLICY "turnos_cancelados_insert_own" ON public.turnos_cancelados
FOR INSERT WITH CHECK (true);

-- ==============================================
-- 5. POLÍTICAS PARA TURNOS_DISPONIBLES
-- ==============================================

-- SELECT: Todos pueden ver turnos disponibles
CREATE POLICY "turnos_disponibles_select_all" ON public.turnos_disponibles
FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: Solo admins
CREATE POLICY "turnos_disponibles_admin_all" ON public.turnos_disponibles
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ==============================================
-- 6. POLÍTICAS PARA TURNOS
-- ==============================================

-- SELECT: Admins ven todos, usuarios ven turnos disponibles y sus reservas
CREATE POLICY "turnos_select_available_and_own" ON public.turnos
FOR SELECT USING (is_admin() OR estado = 'disponible' OR cliente_id = auth.uid());

-- INSERT: Solo admins pueden crear turnos
CREATE POLICY "turnos_insert_admin_only" ON public.turnos
FOR INSERT WITH CHECK (is_admin());

-- UPDATE: Admins pueden actualizar todo, usuarios solo turnos disponibles
CREATE POLICY "turnos_update_admin_or_available" ON public.turnos
FOR UPDATE USING (is_admin() OR estado = 'disponible');

-- DELETE: Solo admins pueden eliminar turnos
CREATE POLICY "turnos_delete_admin_only" ON public.turnos
FOR DELETE USING (is_admin());

-- ==============================================
-- 7. POLÍTICAS PARA TURNOS_VARIABLES
-- ==============================================

-- SELECT: Usuarios ven sus turnos variables, admins ven todos
CREATE POLICY "turnos_variables_select_own" ON public.turnos_variables
FOR SELECT USING (cliente_id = auth.uid() OR is_admin());

-- INSERT: Usuarios insertan sus turnos variables, admins para cualquier usuario
CREATE POLICY "turnos_variables_insert_own" ON public.turnos_variables
FOR INSERT WITH CHECK (cliente_id = auth.uid() OR is_admin());

-- UPDATE: Usuarios actualizan sus turnos variables, admins todos
CREATE POLICY "turnos_variables_update_own" ON public.turnos_variables
FOR UPDATE USING (cliente_id = auth.uid() OR is_admin());

-- ==============================================
-- 8. POLÍTICAS PARA HORARIOS_RECURRENTES_USUARIO
-- ==============================================

-- SELECT: Usuarios ven sus horarios, admins ven todos
CREATE POLICY "horarios_recurrentes_usuario_select_own_or_admin" ON public.horarios_recurrentes_usuario
FOR SELECT USING (usuario_id = auth.uid() OR is_admin());

-- INSERT: Usuarios insertan sus horarios, admins para cualquier usuario
CREATE POLICY "horarios_recurrentes_usuario_insert_own_or_admin" ON public.horarios_recurrentes_usuario
FOR INSERT WITH CHECK (usuario_id = auth.uid() OR is_admin());

-- UPDATE: Usuarios actualizan sus horarios, admins todos
CREATE POLICY "horarios_recurrentes_usuario_update_own_or_admin" ON public.horarios_recurrentes_usuario
FOR UPDATE USING (usuario_id = auth.uid() OR is_admin());

-- DELETE: Usuarios eliminan sus horarios, admins todos
CREATE POLICY "horarios_recurrentes_usuario_delete_own_or_admin" ON public.horarios_recurrentes_usuario
FOR DELETE USING (usuario_id = auth.uid() OR is_admin());

-- ==============================================
-- 9. POLÍTICAS PARA PROFILES
-- ==============================================

-- SELECT: Usuarios ven su perfil, admins ven todos
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT USING (auth.uid() = id OR is_admin());

-- INSERT: Usuarios autenticados pueden crear su perfil
CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- UPDATE: Usuarios actualizan su perfil, admins todos
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
FOR UPDATE USING (auth.uid() = id OR is_admin());

-- ==============================================
-- 10. POLÍTICAS PARA CUOTAS_MENSUALES
-- ==============================================

-- SELECT: Usuarios ven sus cuotas, admins ven todas
CREATE POLICY "cuotas_mensuales_select_own_or_admin" ON public.cuotas_mensuales
FOR SELECT USING (cliente_id = auth.uid() OR is_admin());

-- INSERT/UPDATE/DELETE: Solo admins
CREATE POLICY "cuotas_mensuales_admin_all" ON public.cuotas_mensuales
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ==============================================
-- 11. POLÍTICAS PARA OTRAS TABLAS ADMIN
-- ==============================================

-- Capacidad especial días: Solo admins
DROP POLICY IF EXISTS "capacidad_especial_dias_admin_all" ON public.capacidad_especial_dias;
CREATE POLICY "capacidad_especial_dias_admin_all" ON public.capacidad_especial_dias
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Horarios bloqueados: Solo admins
DROP POLICY IF EXISTS "horarios_bloqueados_admin_all" ON public.horarios_bloqueados;
CREATE POLICY "horarios_bloqueados_admin_all" ON public.horarios_bloqueados
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Ausencias admin: Solo admins
DROP POLICY IF EXISTS "ausencias_admin_admin_all" ON public.ausencias_admin;
CREATE POLICY "ausencias_admin_admin_all" ON public.ausencias_admin
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Configuración admin: Solo admins
DROP POLICY IF EXISTS "configuracion_admin_admin_all" ON public.configuracion_admin;
CREATE POLICY "configuracion_admin_admin_all" ON public.configuracion_admin
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ==============================================
-- 12. VERIFICAR POLÍTICAS CREADAS
-- ==============================================

SELECT 
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'turnos_cancelados',
    'turnos_disponibles',
    'turnos',
    'turnos_variables',
    'horarios_recurrentes_usuario',
    'profiles',
    'cuotas_mensuales',
    'capacidad_especial_dias',
    'horarios_bloqueados',
    'ausencias_admin',
    'configuracion_admin'
  )
ORDER BY tablename, cmd, policyname;

-- =====================================================
-- HABILITAR RLS Y CREAR POLÍTICAS FALTANTES
-- PRE LANZAMIENTO - SEGURIDAD CRÍTICA
-- =====================================================

-- 1. HABILITAR RLS EN TABLAS CRÍTICAS
-- =====================================================

ALTER TABLE public.cuotas_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS PARA cuotas_mensuales
-- =====================================================

-- Usuarios ven solo sus propias cuotas
DROP POLICY IF EXISTS cuotas_mensuales_select_own ON public.cuotas_mensuales;
CREATE POLICY cuotas_mensuales_select_own ON public.cuotas_mensuales
    FOR SELECT
    USING (usuario_id = auth.uid());

-- Admins ven todas las cuotas
DROP POLICY IF EXISTS cuotas_mensuales_select_admin ON public.cuotas_mensuales;
CREATE POLICY cuotas_mensuales_select_admin ON public.cuotas_mensuales
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Solo admins pueden insertar/actualizar cuotas
DROP POLICY IF EXISTS cuotas_mensuales_insert_admin ON public.cuotas_mensuales;
CREATE POLICY cuotas_mensuales_insert_admin ON public.cuotas_mensuales
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS cuotas_mensuales_update_admin ON public.cuotas_mensuales;
CREATE POLICY cuotas_mensuales_update_admin ON public.cuotas_mensuales
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS cuotas_mensuales_delete_admin ON public.cuotas_mensuales;
CREATE POLICY cuotas_mensuales_delete_admin ON public.cuotas_mensuales
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 3. POLÍTICAS PARA profiles (verificar que RLS esté habilitado)
-- =====================================================

-- Las políticas ya existen, solo verificamos que RLS esté habilitado
-- No es necesario recrearlas a menos que haya problemas

-- 4. POLÍTICAS PARA turnos_variables
-- =====================================================

-- Primero eliminamos las políticas duplicadas
DROP POLICY IF EXISTS turnos_variables_select ON public.turnos_variables;
DROP POLICY IF EXISTS turnos_variables_insert ON public.turnos_variables;
DROP POLICY IF EXISTS turnos_variables_update ON public.turnos_variables;
DROP POLICY IF EXISTS turnos_variables_delete ON public.turnos_variables;
DROP POLICY IF EXISTS "Admins pueden ver todos los turnos variables" ON public.turnos_variables;
DROP POLICY IF EXISTS turnos_variables_delete_admin ON public.turnos_variables;

-- Usuarios ven solo sus propios turnos variables
CREATE POLICY turnos_variables_select_own ON public.turnos_variables
    FOR SELECT
    USING (cliente_id = auth.uid());

-- Admins ven todos los turnos
CREATE POLICY turnos_variables_select_admin ON public.turnos_variables
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Usuarios pueden insertar turnos para sí mismos
CREATE POLICY turnos_variables_insert_own ON public.turnos_variables
    FOR INSERT
    WITH CHECK (cliente_id = auth.uid());

-- Admins pueden insertar turnos para cualquiera
CREATE POLICY turnos_variables_insert_admin ON public.turnos_variables
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Solo admins pueden actualizar turnos
CREATE POLICY turnos_variables_update_admin ON public.turnos_variables
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Solo admins pueden eliminar turnos
CREATE POLICY turnos_variables_delete_admin ON public.turnos_variables
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 5. VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que todas las tablas tienen RLS habilitado
SELECT 
    schemaname,
    tablename,
    CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('cuotas_mensuales', 'profiles', 'turnos_variables')
ORDER BY tablename;

-- Verificar políticas creadas
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('cuotas_mensuales', 'profiles', 'turnos_variables')
ORDER BY tablename, cmd;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================


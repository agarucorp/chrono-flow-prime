-- =====================================================
-- CORREGIR TODAS LAS POLÍTICAS PARA EVITAR RECURSIÓN
-- =====================================================

-- La función is_admin() ya existe y usa SECURITY DEFINER
-- Ahora necesitamos actualizar todas las políticas que verifican admin

-- 1. ACTUALIZAR POLÍTICAS DE cuotas_mensuales
DROP POLICY IF EXISTS cuotas_mensuales_select_admin ON public.cuotas_mensuales;
CREATE POLICY cuotas_mensuales_select_admin ON public.cuotas_mensuales
    FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS cuotas_mensuales_insert_admin ON public.cuotas_mensuales;
CREATE POLICY cuotas_mensuales_insert_admin ON public.cuotas_mensuales
    FOR INSERT
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS cuotas_mensuales_update_admin ON public.cuotas_mensuales;
CREATE POLICY cuotas_mensuales_update_admin ON public.cuotas_mensuales
    FOR UPDATE
    USING (is_admin());

DROP POLICY IF EXISTS cuotas_mensuales_delete_admin ON public.cuotas_mensuales;
CREATE POLICY cuotas_mensuales_delete_admin ON public.cuotas_mensuales
    FOR DELETE
    USING (is_admin());

-- 2. ACTUALIZAR POLÍTICAS DE turnos_variables
DROP POLICY IF EXISTS turnos_variables_select_admin ON public.turnos_variables;
CREATE POLICY turnos_variables_select_admin ON public.turnos_variables
    FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS turnos_variables_insert_admin ON public.turnos_variables;
CREATE POLICY turnos_variables_insert_admin ON public.turnos_variables
    FOR INSERT
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS turnos_variables_update_admin ON public.turnos_variables;
CREATE POLICY turnos_variables_update_admin ON public.turnos_variables
    FOR UPDATE
    USING (is_admin());

DROP POLICY IF EXISTS turnos_variables_delete_admin ON public.turnos_variables;
CREATE POLICY turnos_variables_delete_admin ON public.turnos_variables
    FOR DELETE
    USING (is_admin());

-- 3. ACTUALIZAR POLÍTICAS DE ausencias_admin
DROP POLICY IF EXISTS ausencias_admin_select_admin_only ON public.ausencias_admin;
CREATE POLICY ausencias_admin_select_admin_only ON public.ausencias_admin
    FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS ausencias_admin_insert_admin_only ON public.ausencias_admin;
CREATE POLICY ausencias_admin_insert_admin_only ON public.ausencias_admin
    FOR INSERT
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS ausencias_admin_update_admin_only ON public.ausencias_admin;
CREATE POLICY ausencias_admin_update_admin_only ON public.ausencias_admin
    FOR UPDATE
    USING (is_admin());

DROP POLICY IF EXISTS ausencias_admin_delete_admin_only ON public.ausencias_admin;
CREATE POLICY ausencias_admin_delete_admin_only ON public.ausencias_admin
    FOR DELETE
    USING (is_admin());

-- 4. ACTUALIZAR POLÍTICAS DE turnos_cancelados
DROP POLICY IF EXISTS "Admins pueden ver todos los turnos cancelados" ON public.turnos_cancelados;
CREATE POLICY turnos_cancelados_select_admin ON public.turnos_cancelados
    FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS turnos_cancelados_insert_own ON public.turnos_cancelados;
CREATE POLICY turnos_cancelados_insert_own ON public.turnos_cancelados
    FOR INSERT
    WITH CHECK (cliente_id = auth.uid() OR is_admin());

-- 5. ACTUALIZAR POLÍTICAS DE horarios_recurrentes_usuario
DROP POLICY IF EXISTS "Admins pueden ver todos los horarios recurrentes" ON public.horarios_recurrentes_usuario;
CREATE POLICY horarios_recurrentes_select_admin ON public.horarios_recurrentes_usuario
    FOR SELECT
    USING (is_admin());

-- 6. ACTUALIZAR POLÍTICAS DE configuracion_admin
DROP POLICY IF EXISTS configuracion_admin_select_admin_only ON public.configuracion_admin;
CREATE POLICY configuracion_admin_select_admin_only ON public.configuracion_admin
    FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS configuracion_admin_insert_admin_only ON public.configuracion_admin;
CREATE POLICY configuracion_admin_insert_admin_only ON public.configuracion_admin
    FOR INSERT
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS configuracion_admin_update_admin_only ON public.configuracion_admin;
CREATE POLICY configuracion_admin_update_admin_only ON public.configuracion_admin
    FOR UPDATE
    USING (is_admin());

DROP POLICY IF EXISTS configuracion_admin_delete_admin_only ON public.configuracion_admin;
CREATE POLICY configuracion_admin_delete_admin_only ON public.configuracion_admin
    FOR DELETE
    USING (is_admin());

-- FIN DEL SCRIPT


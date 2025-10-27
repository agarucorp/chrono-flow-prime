-- CORREGIR POLÍTICAS RLS PARA TURNOS_CANCELADOS
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar políticas existentes
DROP POLICY IF EXISTS "turnos_cancelados_select_own" ON public.turnos_cancelados;
DROP POLICY IF EXISTS "turnos_cancelados_select_admin_all" ON public.turnos_cancelados;
DROP POLICY IF EXISTS "turnos_cancelados_insert_own" ON public.turnos_cancelados;
DROP POLICY IF EXISTS "turnos_cancelados_insert_admin" ON public.turnos_cancelados;

-- 2. Crear nuevas políticas para SELECT
-- Los usuarios pueden ver sus propias cancelaciones
CREATE POLICY "turnos_cancelados_select_own" ON public.turnos_cancelados
FOR SELECT USING (cliente_id = auth.uid());

-- Los admins pueden ver todas las cancelaciones
CREATE POLICY "turnos_cancelados_select_admin_all" ON public.turnos_cancelados
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 3. Crear nuevas políticas para INSERT
-- Los usuarios pueden insertar sus propias cancelaciones
CREATE POLICY "turnos_cancelados_insert_own" ON public.turnos_cancelados
FOR INSERT WITH CHECK (cliente_id = auth.uid());

-- Los admins pueden insertar cancelaciones para cualquier usuario
CREATE POLICY "turnos_cancelados_insert_admin" ON public.turnos_cancelados
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. Verificar políticas creadas
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE tablename = 'turnos_cancelados'
ORDER BY cmd, policyname;

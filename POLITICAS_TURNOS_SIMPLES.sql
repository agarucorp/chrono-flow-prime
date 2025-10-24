-- POLÍTICAS RLS SIMPLES PARA TURNOS - SIN DEPENDER DE auth.uid()
-- Ejecutar en Supabase SQL Editor

-- 1. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "Enable insert for admins only" ON public.turnos;
DROP POLICY IF EXISTS "Enable select for admins and users" ON public.turnos;
DROP POLICY IF EXISTS "Enable update for debugging" ON public.turnos;
DROP POLICY IF EXISTS "Enable delete for admins only" ON public.turnos;

-- 2. CREAR POLÍTICAS TEMPORALMENTE PERMISIVAS PARA DEBUG
-- Política para INSERT - permitir a todos temporalmente
CREATE POLICY "Enable insert for all" ON public.turnos
FOR INSERT WITH CHECK (true);

-- Política para SELECT - permitir a todos ver todos los turnos
CREATE POLICY "Enable select for all" ON public.turnos
FOR SELECT USING (true);

-- Política para UPDATE - permitir a todos actualizar
CREATE POLICY "Enable update for all" ON public.turnos
FOR UPDATE USING (true);

-- Política para DELETE - permitir a todos eliminar
CREATE POLICY "Enable delete for all" ON public.turnos
FOR DELETE USING (true);

-- 3. VERIFICAR QUE LAS POLÍTICAS ESTÉN ACTIVAS
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
WHERE tablename = 'turnos';

-- 4. VERIFICAR QUE RLS ESTÉ ACTIVO
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'turnos';

-- 5. VERIFICAR QUE LA TABLA TENGA DATOS
SELECT COUNT(*) as total_turnos FROM public.turnos;
SELECT COUNT(*) as turnos_disponibles FROM public.turnos WHERE estado = 'disponible';
SELECT COUNT(*) as turnos_ocupados FROM public.turnos WHERE estado = 'ocupado';

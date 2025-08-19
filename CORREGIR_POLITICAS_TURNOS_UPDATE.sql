-- CORREGIR POLÍTICAS RLS PARA PERMITIR ACTUALIZACIÓN DE TURNOS
-- Ejecutar en Supabase SQL Editor

-- 1. ELIMINAR POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "Enable insert for admins only" ON public.turnos;
DROP POLICY IF EXISTS "Enable select for admins and users" ON public.turnos;
DROP POLICY IF EXISTS "Enable update for admins and own turnos" ON public.turnos;
DROP POLICY IF EXISTS "Enable delete for admins only" ON public.turnos;

-- 2. CREAR NUEVAS POLÍTICAS MÁS PERMISIVAS PARA DEBUG
-- Política para INSERT - solo admins pueden crear turnos base
CREATE POLICY "Enable insert for admins only" ON public.turnos
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Política para SELECT - admins ven todos, usuarios ven turnos disponibles y los suyos
CREATE POLICY "Enable select for admins and users" ON public.turnos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) OR 
  estado = 'disponible' OR 
  cliente_id = auth.uid()
);

-- Política para UPDATE - TEMPORALMENTE MÁS PERMISIVA PARA DEBUG
CREATE POLICY "Enable update for debugging" ON public.turnos
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) OR 
  estado = 'disponible' -- Permitir actualizar turnos disponibles
);

-- Política para DELETE - solo admins pueden eliminar
CREATE POLICY "Enable delete for admins only" ON public.turnos
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

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

-- 5. VERIFICAR PERMISOS DEL USUARIO ACTUAL
SELECT 
  current_user,
  session_user,
  auth.uid() as current_auth_uid;

-- 6. VERIFICAR QUE EL USUARIO TENGA PERFIL
SELECT 
  id,
  email,
  full_name,
  role
FROM public.profiles 
WHERE id = auth.uid();

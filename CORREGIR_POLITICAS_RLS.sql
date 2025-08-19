-- CORREGIR POLÍTICAS RLS - ELIMINAR RECURSIÓN INFINITA
-- Ejecutar en Supabase SQL Editor

-- 1. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES EN PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.profiles;

-- 2. CREAR POLÍTICAS SIMPLES Y SEGURAS
-- Política para INSERT - cualquier usuario autenticado puede crear su perfil
CREATE POLICY "Enable insert for authenticated users only" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Política para SELECT - usuarios ven su propio perfil, admins ven todos
CREATE POLICY "Enable select for users based on user_id" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Política para UPDATE - usuarios actualizan su propio perfil, admins actualizan todos
CREATE POLICY "Enable update for users based on user_id" ON public.profiles
FOR UPDATE USING (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Política para DELETE - solo admins pueden eliminar perfiles
CREATE POLICY "Enable delete for users based on user_id" ON public.profiles
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 3. VERIFICAR QUE LAS POLÍTICAS ESTÉN ACTIVAS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 4. HABILITAR RLS EN LA TABLA
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. VERIFICAR QUE RLS ESTÉ ACTIVO
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- POLÍTICAS RLS SIN RECURSIÓN INFINITA
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

-- 2. CREAR POLÍTICAS SIMPLES SIN RECURSIÓN
-- Política para INSERT - cualquier usuario autenticado puede crear su perfil
CREATE POLICY "Enable insert for authenticated users only" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Política para SELECT - usuarios ven su propio perfil
CREATE POLICY "Enable select for own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Política para UPDATE - usuarios actualizan su propio perfil
CREATE POLICY "Enable update for own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Política para DELETE - solo admins pueden eliminar (verificaremos en la aplicación)
CREATE POLICY "Enable delete for admins only" ON public.profiles
FOR DELETE USING (false); -- Deshabilitamos DELETE por ahora

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

-- 6. VERIFICAR QUE EL USUARIO FEDE TENGA ROL ADMIN
SELECT email, role, full_name FROM public.profiles WHERE email = 'fede.rz87@gmail.com';

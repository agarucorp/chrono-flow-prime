-- POLÍTICAS RLS COMPLETAS PARA ADMINISTRADORES
-- Ejecutar en Supabase SQL Editor

-- 1. ELIMINAR POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable select for own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete for admins only" ON public.profiles;

-- 2. CREAR FUNCIÓN HELPER PARA VERIFICAR SI ES ADMIN
CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREAR POLÍTICAS COMPLETAS
-- Política para INSERT - cualquier usuario autenticado puede crear su perfil
CREATE POLICY "Enable insert for authenticated users only" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Política para SELECT - usuarios ven su propio perfil, admins ven todos
CREATE POLICY "Enable select for users and admins" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR is_user_admin(auth.uid())
);

-- Política para UPDATE - usuarios actualizan su propio perfil, admins actualizan todos
CREATE POLICY "Enable update for users and admins" ON public.profiles
FOR UPDATE USING (
  auth.uid() = id OR is_user_admin(auth.uid())
);

-- Política para DELETE - solo admins pueden eliminar
CREATE POLICY "Enable delete for admins only" ON public.profiles
FOR DELETE USING (is_user_admin(auth.uid()));

-- 4. VERIFICAR QUE LAS POLÍTICAS ESTÉN ACTIVAS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 5. VERIFICAR QUE RLS ESTÉ ACTIVO
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- 6. VERIFICAR USUARIOS ADMIN
SELECT email, role, full_name, created_at FROM public.profiles WHERE role = 'admin';

-- 7. VERIFICAR TODOS LOS USUARIOS
SELECT email, role, full_name, created_at FROM public.profiles ORDER BY created_at DESC;

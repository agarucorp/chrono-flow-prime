-- 🔐 **Configuración del Sistema de Roles de Administrador**
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna role si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'client' CHECK (role IN ('client', 'admin'));
    END IF;
END $$;

-- 2. Crear índice para optimizar consultas por rol
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. Actualizar el usuario existente gastondigilio@gmail.com como admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'gastondigilio@gmail.com';

-- 4. Crear política RLS para administradores (pueden ver todos los perfiles)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE role = 'admin'
        )
    );

-- 5. Crear política RLS para administradores (pueden actualizar todos los perfiles)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE role = 'admin'
        )
    );

-- 6. Crear política RLS para administradores (pueden eliminar perfiles)
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
    FOR DELETE USING (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE role = 'admin'
        )
    );

-- 7. Crear función helper para verificar si un usuario es admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Crear función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role FROM public.profiles 
        WHERE id = user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Verificar la configuración
SELECT 
    email,
    role,
    full_name,
    created_at
FROM public.profiles 
WHERE role = 'admin';

-- 10. Comentarios en la tabla
COMMENT ON COLUMN public.profiles.role IS 'Rol del usuario: client (cliente) o admin (administrador)';
COMMENT ON FUNCTION is_admin(UUID) IS 'Verifica si un usuario tiene rol de administrador';
COMMENT ON FUNCTION get_user_role(UUID) IS 'Obtiene el rol del usuario especificado';

-- ✅ **Sistema de roles configurado exitosamente**
-- El usuario gastondigilio@gmail.com ahora es administrador
-- Los administradores pueden gestionar todos los perfiles de usuarios

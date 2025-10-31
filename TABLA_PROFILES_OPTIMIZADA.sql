-- =====================================================
-- TABLA DE PERFILES OPTIMIZADA PARA GESTIÓN DE TURNOS
-- =====================================================

-- 1. CREAR TABLA DE PERFILES (si no existe)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  gender TEXT CHECK (gender IN ('masculino', 'femenino')),
  birth_date DATE,
  role TEXT DEFAULT 'client' CHECK (role IN ('admin', 'professional', 'client')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREAR ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);

-- 3. HABILITAR RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. ELIMINAR POLÍTICAS EXISTENTES (si las hay)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- 5. CREAR POLÍTICAS RLS OPTIMIZADAS
-- Usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Usuarios pueden insertar su propio perfil
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admins pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins pueden actualizar todos los perfiles
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins pueden eliminar perfiles
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. CREAR FUNCIÓN PARA ACTUALIZAR TIMESTAMP
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. CREAR TRIGGER PARA ACTUALIZAR TIMESTAMP
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. CREAR FUNCIÓN PARA CREAR PERFIL AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, phone)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. CREAR TRIGGER PARA CREAR PERFIL AUTOMÁTICAMENTE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. CREAR FUNCIONES DE UTILIDAD
-- Función para verificar si un usuario es admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener el rol del usuario
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM public.profiles 
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. CREAR VISTAS ÚTILES
-- Vista de usuarios activos
CREATE OR REPLACE VIEW public.active_users AS
SELECT 
  id,
  email,
  full_name,
  first_name,
  last_name,
  phone,
  gender,
  role,
  created_at
FROM public.profiles
WHERE is_active = true
ORDER BY created_at DESC;

-- Vista de usuarios por rol
CREATE OR REPLACE VIEW public.users_by_role AS
SELECT 
  role,
  COUNT(*) as user_count,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM public.profiles
GROUP BY role
ORDER BY role;

-- 12. INSERTAR USUARIO ADMIN INICIAL (si no existe)
-- NOTA: Cambia el email por el tuyo
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  first_name,
  last_name,
  phone,
  gender,
  role,
  is_active
) VALUES (
  gen_random_uuid(), -- Esto se reemplazará con el ID real del usuario
  'gastondigilio@gmail.com',
  'Gastón Digilio',
  'Gastón',
  'Digilio',
  '+54 11 1234-5678',
  'masculino',
  'admin',
  true
) ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  is_active = true,
  updated_at = NOW();

-- 13. COMENTARIOS EN LA TABLA
COMMENT ON TABLE public.profiles IS 'Perfiles extendidos de usuarios del sistema de gestión de turnos';
COMMENT ON COLUMN public.profiles.id IS 'ID único del usuario (referencia a auth.users)';
COMMENT ON COLUMN public.profiles.email IS 'Email del usuario (único)';
COMMENT ON COLUMN public.profiles.full_name IS 'Nombre completo del usuario';
COMMENT ON COLUMN public.profiles.first_name IS 'Nombre del usuario';
COMMENT ON COLUMN public.profiles.last_name IS 'Apellido del usuario';
COMMENT ON COLUMN public.profiles.phone IS 'Número de teléfono del usuario';
COMMENT ON COLUMN public.profiles.gender IS 'Género del usuario (masculino/femenino)';
COMMENT ON COLUMN public.profiles.birth_date IS 'Fecha de nacimiento del usuario';
COMMENT ON COLUMN public.profiles.role IS 'Rol del usuario (admin/professional/client)';
COMMENT ON COLUMN public.profiles.is_active IS 'Indica si el usuario está activo en el sistema';
COMMENT ON COLUMN public.profiles.created_at IS 'Fecha de creación del perfil';
COMMENT ON COLUMN public.profiles.updated_at IS 'Fecha de última actualización del perfil';

-- 14. VERIFICAR LA CONFIGURACIÓN
SELECT 
  'Tabla profiles creada correctamente' as status,
  COUNT(*) as total_profiles
FROM public.profiles;

-- Mostrar estructura de la tabla
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

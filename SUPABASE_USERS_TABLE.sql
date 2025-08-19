-- =====================================================
-- TABLA DE PERFILES DE USUARIOS PARA GESTIÓN TURNOS
-- =====================================================

-- Crear tabla de perfiles extendidos
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

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS DE SEGURIDAD
-- =====================================================

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

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índice en email para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Índice en role para filtros por rol
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Índice en is_active para filtros de estado
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- =====================================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- =====================================================

-- Insertar usuario admin de ejemplo (cambiar email y datos según necesites)
-- INSERT INTO public.profiles (
--   id,
--   email,
--   full_name,
--   first_name,
--   last_name,
--   phone,
--   gender,
--   role,
--   is_active
-- ) VALUES (
--   'tu-uuid-de-usuario-admin',
--   'admin@turnopro.com',
--   'Administrador Sistema',
--   'Administrador',
--   'Sistema',
--   '+54 11 1234-5678',
--   'masculino',
--   'admin',
--   true
-- );

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

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

-- =====================================================
-- FUNCIONES DE UTILIDAD
-- =====================================================

-- Función para obtener usuarios por rol
CREATE OR REPLACE FUNCTION public.get_users_by_role(user_role TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  gender TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.first_name,
    p.last_name,
    p.phone,
    p.gender,
    p.created_at
  FROM public.profiles p
  WHERE p.role = user_role AND p.is_active = true
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para buscar usuarios por nombre o email
CREATE OR REPLACE FUNCTION public.search_users(search_term TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  gender TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.first_name,
    p.last_name,
    p.phone,
    p.gender,
    p.role,
    p.created_at
  FROM public.profiles p
  WHERE 
    p.is_active = true AND (
      p.full_name ILIKE '%' || search_term || '%' OR
      p.first_name ILIKE '%' || search_term || '%' OR
      p.last_name ILIKE '%' || search_term || '%' OR
      p.email ILIKE '%' || search_term || '%'
    )
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMENTARIOS DE LA TABLA
-- =====================================================

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

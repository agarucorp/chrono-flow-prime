-- =====================================================
-- CONFIGURAR USUARIO ADMIN AUTOMÁTICO
-- =====================================================

-- 1. CREAR FUNCIÓN PARA ASIGNAR ROL DE ADMIN AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION asignar_admin_automatico()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si el email es agaru.corp@gmail.com
  IF NEW.email = 'agaru.corp@gmail.com' THEN
    -- Actualizar el perfil para asignar rol de admin
    UPDATE public.profiles 
    SET 
      role = 'admin',
      updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CREAR TRIGGER PARA ASIGNAR ADMIN AUTOMÁTICAMENTE
CREATE OR REPLACE TRIGGER trigger_asignar_admin_automatico
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION asignar_admin_automatico();

-- 3. ASIGNAR ROL DE ADMIN A USUARIO EXISTENTE (si ya existe)
UPDATE public.profiles 
SET 
  role = 'admin',
  updated_at = NOW()
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email = 'agaru.corp@gmail.com'
);

-- 4. VERIFICAR QUE EL USUARIO ADMIN EXISTE Y TIENE ROL CORRECTO
SELECT 
  u.email,
  p.role,
  p.first_name,
  p.last_name,
  p.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'agaru.corp@gmail.com';

-- 5. CREAR FUNCIÓN PARA VERIFICAR SI UN USUARIO ES ADMIN
CREATE OR REPLACE FUNCTION es_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT p.role INTO user_role
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  WHERE u.email = user_email;
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CREAR FUNCIÓN PARA OBTENER ROL DE USUARIO
CREATE OR REPLACE FUNCTION obtener_rol_usuario(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT p.role INTO user_role
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  WHERE u.email = user_email;
  
  RETURN COALESCE(user_role, 'client');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. CREAR VISTA DE USUARIOS ADMIN
CREATE OR REPLACE VIEW public.usuarios_admin AS
SELECT 
  u.id,
  u.email,
  p.first_name,
  p.last_name,
  p.role,
  p.created_at,
  p.updated_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.role = 'admin'
ORDER BY p.created_at DESC;

-- 8. CREAR VISTA DE USUARIOS CLIENTES
CREATE OR REPLACE VIEW public.usuarios_clientes AS
SELECT 
  u.id,
  u.email,
  p.first_name,
  p.last_name,
  p.role,
  p.created_at,
  p.updated_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.role = 'client' OR p.role IS NULL
ORDER BY p.created_at DESC;

-- 9. COMENTARIOS EN LAS FUNCIONES
COMMENT ON FUNCTION asignar_admin_automatico() IS 'Asigna automáticamente el rol de admin al usuario agaru.corp@gmail.com';
COMMENT ON FUNCTION es_admin(TEXT) IS 'Verifica si un usuario es administrador por su email';
COMMENT ON FUNCTION obtener_rol_usuario(TEXT) IS 'Obtiene el rol de un usuario por su email';
COMMENT ON VIEW public.usuarios_admin IS 'Vista de todos los usuarios administradores';
COMMENT ON VIEW public.usuarios_clientes IS 'Vista de todos los usuarios clientes';

-- 10. VERIFICAR CONFIGURACIÓN
SELECT 
  'Configuración de admin automático completada' as status,
  COUNT(*) as total_admins
FROM public.usuarios_admin;

-- Mostrar información del admin configurado
SELECT 
  'Admin configurado:' as info,
  email,
  role,
  first_name,
  last_name
FROM public.usuarios_admin
WHERE email = 'agaru.corp@gmail.com';

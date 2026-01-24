-- 🔧 CORRECCIÓN DEL TRIGGER DE SIGNUP
-- Este script corrige la función handle_new_user para manejar errores mejor
-- EJECUTAR ESTE SCRIPT MANUALMENTE EN EL SQL EDITOR DE SUPABASE

-- 1. CORREGIR LA FUNCIÓN handle_new_user PARA MANEJAR ERRORES MEJOR
-- Esta versión mejorada maneja errores y evita fallos en cascada
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Intentar insertar el perfil, pero si falla, no hacer que falle todo el signup
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, first_name, last_name, phone, role)
    VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        CONCAT(
          COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
          ' ',
          COALESCE(NEW.raw_user_meta_data->>'last_name', '')
        ),
        NEW.email
      ),
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      NEW.raw_user_meta_data->>'phone',
      'client' -- Rol por defecto
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone = EXCLUDED.phone,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    -- Si hay un error, loguearlo pero no hacer que falle el signup
    -- Esto permite que el usuario se cree aunque haya un problema con el perfil
    RAISE WARNING 'Error al crear perfil para usuario %: %', NEW.id, SQLERRM;
    -- Retornar NEW para que el signup continúe
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. VERIFICAR QUE EL TRIGGER ESTÉ CONFIGURADO CORRECTAMENTE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 3. COMENTARIOS FINALES
COMMENT ON FUNCTION public.handle_new_user() IS 
'Función mejorada que crea perfiles automáticamente después del signup. Maneja errores para evitar que falle el signup completo.';

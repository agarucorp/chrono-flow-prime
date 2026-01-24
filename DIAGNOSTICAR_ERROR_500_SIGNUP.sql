-- 🔍 DIAGNÓSTICO Y CORRECCIÓN DEL ERROR 500 EN SIGNUP
-- Este script diagnostica y corrige problemas con el trigger que se ejecuta después del signup

-- 1. VERIFICAR SI EXISTE EL TRIGGER Y LA FUNCIÓN
SELECT 
  'TRIGGERS Y FUNCIONES' as seccion,
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE trigger_schema = 'auth' 
  AND event_object_table = 'users'
  AND trigger_name LIKE '%user%';

-- 2. VERIFICAR LA FUNCIÓN handle_new_user
SELECT 
  'FUNCIÓN handle_new_user' as seccion,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- 3. VERIFICAR LA ESTRUCTURA DE LA TABLA profiles
SELECT 
  'ESTRUCTURA profiles' as seccion,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. VERIFICAR SI HAY RESTRICCIONES QUE PUEDAN CAUSAR ERRORES
SELECT 
  'RESTRICCIONES profiles' as seccion,
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'profiles';

-- 5. CORREGIR LA FUNCIÓN handle_new_user PARA MANEJAR ERRORES MEJOR
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

-- 6. VERIFICAR QUE EL TRIGGER ESTÉ CONFIGURADO CORRECTAMENTE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 7. VERIFICAR QUE NO HAYA MÚLTIPLES TRIGGERS CONFLICTIVOS
SELECT 
  'VERIFICACIÓN FINAL' as seccion,
  COUNT(*) as total_triggers,
  STRING_AGG(trigger_name, ', ') as triggers_list
FROM information_schema.triggers 
WHERE trigger_schema = 'auth' 
  AND event_object_table = 'users'
  AND trigger_name LIKE '%user%';

-- 8. VERIFICAR USUARIOS RECIENTES SIN PERFIL (para diagnóstico)
SELECT 
  'USUARIOS SIN PERFIL' as seccion,
  u.id,
  u.email,
  u.created_at,
  u.email_confirmed_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
  AND u.created_at > NOW() - INTERVAL '7 days'
ORDER BY u.created_at DESC
LIMIT 10;

-- 9. COMENTARIOS FINALES
COMMENT ON FUNCTION public.handle_new_user() IS 
'Función mejorada que crea perfiles automáticamente después del signup. Maneja errores para evitar que falle el signup completo.';

-- 🔧 SOLUCIÓN DEFINITIVA: CREAR PERFILES AUTOMÁTICAMENTE
-- Este script asegura que TODOS los usuarios nuevos tengan perfil automático

-- 1. Crear función para insertar perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    'client',  -- Rol correcto para usuarios nuevos
    NOW(),
    NOW()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear trigger que se ejecuta cuando se confirma un usuario
CREATE OR REPLACE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- 3. También crear trigger para usuarios que ya vienen confirmados
CREATE OR REPLACE TRIGGER on_auth_user_created_confirmed
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Verificar que no existan usuarios sin perfil
DO $$
DECLARE
    user_count INTEGER;
    profile_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM auth.users WHERE confirmed_at IS NOT NULL;
    SELECT COUNT(*) INTO profile_count FROM profiles;
    
    RAISE NOTICE 'Usuarios confirmados: %', user_count;
    RAISE NOTICE 'Perfiles existentes: %', profile_count;
    
    IF user_count > profile_count THEN
        RAISE NOTICE '⚠️  Hay usuarios confirmados sin perfil. Creando perfiles faltantes...';
        
        -- Crear perfiles para usuarios confirmados que no tienen perfil
        INSERT INTO profiles (id, email, role, created_at, updated_at)
        SELECT 
            au.id,
            au.email,
            'client',
            NOW(),
            NOW()
        FROM auth.users au
        WHERE au.confirmed_at IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = au.id
        );
        
        RAISE NOTICE '✅ Perfiles creados exitosamente';
    ELSE
        RAISE NOTICE '✅ Todos los usuarios confirmados tienen perfil';
    END IF;
END $$;

-- 5. Verificar la configuración
SELECT 
    'Trigger creado correctamente' as status,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name IN ('on_auth_user_confirmed', 'on_auth_user_created_confirmed')
AND event_object_table = 'users'
AND event_object_schema = 'auth';

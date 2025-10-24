-- Script para restaurar la confirmación por email
-- Ejecutar en el SQL Editor de Supabase

-- 1. Crear tabla profiles si no existe
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    gender TEXT,
    birth_date DATE,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- 4. Crear políticas RLS
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Eliminar triggers existentes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;

-- 6. Crear función para manejar confirmación de email
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo crear perfil cuando se confirma el email
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        INSERT INTO public.profiles (id, email, first_name, last_name, phone, gender, birth_date)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
            COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
            COALESCE(NEW.raw_user_meta_data->>'phone', ''),
            COALESCE(NEW.raw_user_meta_data->>'gender', ''),
            CASE 
                WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL 
                THEN (NEW.raw_user_meta_data->>'birth_date')::DATE 
                ELSE NULL 
            END
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            phone = EXCLUDED.phone,
            gender = EXCLUDED.gender,
            birth_date = EXCLUDED.birth_date,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Crear trigger para confirmación de email
CREATE TRIGGER on_auth_user_email_confirmed
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmed();

-- 8. Crear trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Verificar configuración
SELECT 
    'Configuración restaurada' as status,
    'La confirmación por email debería funcionar ahora' as message;

-- 10. INSTRUCCIONES IMPORTANTES:
-- Después de ejecutar este SQL, verifica en tu Dashboard de Supabase:
-- 1. Authentication > Settings > Email Auth
-- 2. Asegúrate de que "Enable email confirmations" esté HABILITADO
-- 3. En Authentication > Settings > URL Configuration:
--    - Site URL: http://localhost:5173
--    - Redirect URLs: http://localhost:5173/confirm-email

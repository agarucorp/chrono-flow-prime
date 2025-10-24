-- Script para habilitar confirmación por email en Supabase
-- Ejecutar en el SQL Editor de Supabase

-- 1. Verificar configuración actual de autenticación
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    u.created_at,
    u.raw_user_meta_data
FROM auth.users u
ORDER BY u.created_at DESC
LIMIT 5;

-- 2. Crear tabla profiles si no existe
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

-- 3. Habilitar RLS en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS para profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Crear función para manejar nuevos usuarios (solo cuando confirman email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo crear perfil si el email está confirmado
    IF NEW.email_confirmed_at IS NOT NULL THEN
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

-- 6. Crear trigger para nuevos usuarios
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Crear trigger para cuando se confirma el email
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el email se confirma, crear/actualizar el perfil
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

-- 8. Crear trigger para confirmación de email
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmed();

-- 9. Crear trigger para updated_at en profiles
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

-- 10. Verificar configuración
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    p.first_name,
    p.last_name,
    p.phone
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 5;

-- 11. INSTRUCCIONES IMPORTANTES:
-- Después de ejecutar este SQL, ve a tu Dashboard de Supabase:
-- 1. Authentication > Settings > Email Auth
-- 2. Habilita "Enable email confirmations"
-- 3. Ve a Authentication > Settings > Email Templates
-- 4. Configura el template "Confirm your signup"
-- 5. En Authentication > Settings > URL Configuration:
--    - Site URL: http://localhost:5173 (para desarrollo)
--    - Redirect URLs: http://localhost:5173/login

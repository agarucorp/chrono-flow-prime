-- Script para configurar correctamente la autenticación en Supabase
-- Ejecutar en el SQL Editor de Supabase

-- 1. Verificar configuración actual de autenticación
SELECT * FROM auth.users LIMIT 5;

-- 2. Verificar si existe la tabla profiles
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles'
);

-- 3. Crear tabla profiles si no existe
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

-- 4. Habilitar RLS en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS para profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. Crear función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, phone, gender, birth_date)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'gender',
        (NEW.raw_user_meta_data->>'birth_date')::DATE
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Crear trigger para nuevos usuarios
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Crear trigger para updated_at en profiles
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Verificar configuración de email en Supabase Dashboard
-- NOTA: Para habilitar confirmación de email, ve a:
-- Authentication > Settings > Email Auth
-- y habilita "Enable email confirmations"

-- 10. Configurar URL de redirección (opcional)
-- En Authentication > URL Configuration:
-- Site URL: http://localhost:5173 (para desarrollo)
-- Redirect URLs: http://localhost:5173/login

-- 11. Verificar que todo esté funcionando
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

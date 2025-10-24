-- Script para diagnosticar por qué el email no se confirma
-- Ejecutar en el SQL Editor de Supabase

-- 1. Verificar usuarios recientes y su estado de confirmación
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    u.confirmation_sent_at,
    u.confirmation_token,
    CASE 
        WHEN u.email_confirmed_at IS NULL THEN '❌ NO CONFIRMADO'
        ELSE '✅ CONFIRMADO'
    END as estado_confirmacion,
    CASE 
        WHEN u.last_sign_in_at IS NULL THEN '❌ NUNCA INICIÓ SESIÓN'
        ELSE '✅ YA INICIÓ SESIÓN'
    END as estado_login
FROM auth.users u
ORDER BY u.created_at DESC
LIMIT 10;

-- 2. Verificar si hay tokens de confirmación pendientes
SELECT 
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmados,
    COUNT(CASE WHEN email_confirmed_at IS NULL AND confirmation_sent_at IS NOT NULL THEN 1 END) as pendientes_confirmacion,
    COUNT(CASE WHEN email_confirmed_at IS NULL AND confirmation_sent_at IS NULL THEN 1 END) as sin_intento_confirmacion
FROM auth.users;

-- 3. Verificar configuración de confirmación de email
SELECT 
    'Configuración de Auth' as seccion,
    'Verificar en Dashboard > Authentication > Settings > Email Auth' as instruccion;

-- 4. Función para confirmar manualmente un usuario (SOLO PARA TESTING)
CREATE OR REPLACE FUNCTION confirm_user_manually(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
    user_id UUID;
    result TEXT;
BEGIN
    -- Buscar el usuario por email
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE email = user_email;
    
    -- Si no existe, retornar error
    IF user_id IS NULL THEN
        RETURN '❌ Usuario no encontrado: ' || user_email;
    END IF;
    
    -- Verificar si ya está confirmado
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = user_id AND email_confirmed_at IS NOT NULL) THEN
        RETURN '⚠️ Usuario ya está confirmado: ' || user_email;
    END IF;
    
    -- Confirmar el email manualmente
    UPDATE auth.users 
    SET 
        email_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = user_id;
    
    -- Verificar que se actualizó correctamente
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = user_id AND email_confirmed_at IS NOT NULL) THEN
        RETURN '✅ Usuario confirmado exitosamente: ' || user_email;
    ELSE
        RETURN '❌ Error al confirmar usuario: ' || user_email;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Verificar políticas RLS que puedan estar bloqueando
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('profiles', 'users')
ORDER BY tablename, policyname;

-- 6. INSTRUCCIONES PARA SOLUCIONAR:

-- PASO 1: Verificar configuración en Supabase Dashboard
-- 1. Ve a Authentication > Settings > Email Auth
-- 2. Asegúrate de que "Enable email confirmations" esté HABILITADO
-- 3. Verifica que "Confirm email" esté HABILITADO

-- PASO 2: Verificar URLs de redirección
-- 1. Ve a Authentication > Settings > URL Configuration
-- 2. Asegúrate de que estas URLs estén en "Redirect URLs":
--    - https://tu-dominio.vercel.app/login
--    - https://tu-dominio.vercel.app/dashboard
--    - https://tu-dominio.vercel.app/user
--    - https://tu-dominio.vercel.app/admin

-- PASO 3: Verificar email templates
-- 1. Ve a Authentication > Email Templates
-- 2. Selecciona "Confirm your signup"
-- 3. Verifica que el template esté configurado correctamente

-- PASO 4: Probar confirmación manual (SOLO PARA TESTING)
-- Ejecutar: SELECT confirm_user_manually('tu-email@ejemplo.com');

-- PASO 5: Verificar logs de autenticación
-- 1. Ve a Dashboard > Logs > Auth Logs
-- 2. Busca errores relacionados con confirmación de email

-- 7. Verificar después de los cambios
SELECT 
    'Estado después de configuración:' as info,
    u.email,
    u.email_confirmed_at,
    CASE 
        WHEN u.email_confirmed_at IS NULL THEN '❌ AÚN NO CONFIRMADO'
        ELSE '✅ CONFIRMADO'
    END as estado
FROM auth.users u
WHERE u.email = 'tu-email-de-prueba@ejemplo.com';

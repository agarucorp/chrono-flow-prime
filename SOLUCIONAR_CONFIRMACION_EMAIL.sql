-- Script para solucionar la confirmación de email que redirige a Vercel
-- Ejecutar en el SQL Editor de Supabase

-- 1. Verificar configuración actual de usuarios
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    u.created_at,
    CASE 
        WHEN u.email_confirmed_at IS NULL THEN '⏳ Pendiente de confirmación'
        ELSE '✅ Confirmado'
    END as estado
FROM auth.users u
ORDER BY u.created_at DESC
LIMIT 10;

-- 2. Verificar si hay usuarios sin confirmar
SELECT 
    COUNT(*) as usuarios_pendientes,
    COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as usuarios_confirmados
FROM auth.users;

-- 3. INSTRUCCIONES IMPORTANTES:
-- Después de ejecutar este SQL, ve a tu Dashboard de Supabase:

-- PASO 1: Configurar Authentication
-- 1. Ve a Authentication > Settings > Email Auth
-- 2. Habilita "Enable email confirmations" ✅
-- 3. Deshabilita "Enable signup" temporalmente si quieres forzar confirmación

-- PASO 2: Configurar URLs de Redirección
-- 1. Ve a Authentication > Settings > URL Configuration
-- 2. Configura:
--    - Site URL: https://tu-dominio.vercel.app (tu dominio de producción)
--    - Redirect URLs: 
--      * https://tu-dominio.vercel.app/login
--      * https://tu-dominio.vercel.app/dashboard
--      * http://localhost:5173/login (para desarrollo)

-- PASO 3: Configurar Email Templates
-- 1. Ve a Authentication > Email Templates
-- 2. Selecciona "Confirm your signup"
-- 3. Usa el template personalizado de MaldaGym
-- 4. Subject: "Confirma tu cuenta en MaldaGym 🎉"

-- PASO 4: Verificar SMTP (Opcional)
-- Si no llegan los emails, configura SMTP personalizado:
-- 1. Ve a Authentication > Settings > SMTP Settings
-- 2. Habilita "Enable Custom SMTP"
-- 3. Configura con tu proveedor de email (Gmail, SendGrid, etc.)

-- 4. Función para confirmar usuarios manualmente (solo para testing)
CREATE OR REPLACE FUNCTION confirm_user_email(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Buscar el usuario por email
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE email = user_email;
    
    -- Si no existe, retornar false
    IF user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Confirmar el email
    UPDATE auth.users 
    SET email_confirmed_at = NOW()
    WHERE id = user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Verificar configuración después de los cambios
SELECT 
    'Configuración actual:' as info,
    u.email,
    u.email_confirmed_at,
    CASE 
        WHEN u.email_confirmed_at IS NULL THEN '❌ Sin confirmar'
        ELSE '✅ Confirmado'
    END as estado
FROM auth.users u
ORDER BY u.created_at DESC
LIMIT 5;

-- 6. NOTA IMPORTANTE:
-- Si quieres confirmar un usuario manualmente para testing:
-- SELECT confirm_user_email('usuario@ejemplo.com');

-- Script para verificar el estado de confirmación del usuario
-- Ejecutar en el SQL Editor de Supabase

-- 1. Verificar el usuario específico
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    u.confirmation_sent_at,
    u.confirmation_token,
    u.raw_user_meta_data,
    CASE 
        WHEN u.email_confirmed_at IS NULL THEN '❌ NO CONFIRMADO'
        ELSE '✅ CONFIRMADO'
    END as estado_confirmacion
FROM auth.users u
WHERE u.email = 'versmax04@gmail.com'
ORDER BY u.created_at DESC;

-- 2. Verificar si hay múltiples registros del mismo email
SELECT 
    COUNT(*) as total_registros,
    u.email,
    MIN(u.created_at) as primer_registro,
    MAX(u.created_at) as ultimo_registro
FROM auth.users u
WHERE u.email = 'versmax04@gmail.com'
GROUP BY u.email;

-- 3. Verificar configuración de confirmación de email
SELECT 
    'Configuración actual:' as info,
    'Verificar en Dashboard > Authentication > Settings > Email Auth' as instruccion;

-- 4. Confirmar manualmente el usuario (SOLO PARA TESTING)
UPDATE auth.users 
SET 
    email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE email = 'versmax04@gmail.com'
AND email_confirmed_at IS NULL;

-- 5. Verificar después de la confirmación manual
SELECT 
    u.email,
    u.email_confirmed_at,
    CASE 
        WHEN u.email_confirmed_at IS NULL THEN '❌ AÚN NO CONFIRMADO'
        ELSE '✅ CONFIRMADO'
    END as estado_final
FROM auth.users u
WHERE u.email = 'versmax04@gmail.com';

-- Script para verificar y ajustar configuración de rate limit en Supabase
-- Ejecutar en el SQL Editor de Supabase

-- 1. Verificar usuarios creados recientemente (última hora)
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutos_desde_creacion
FROM auth.users
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 2. Contar registros en la última hora
SELECT COUNT(*) as registros_ultima_hora
FROM auth.users
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 3. Verificar configuración de autenticación
-- NOTA: La configuración de rate limit NO se puede cambiar desde SQL
-- Debes ir al Dashboard de Supabase:
-- Authentication > Settings > Rate Limits
-- 
-- En el plan gratuito, Supabase limita:
-- - 3-4 registros por hora desde la misma IP
-- - Esto es una limitación del plan gratuito y no se puede cambiar

-- 4. RECOMENDACIONES PARA EVITAR RATE LIMIT:
-- 
-- a) Deshabilitar confirmación de email temporalmente (reduce rate limit):
--    Dashboard > Authentication > Settings > Email Auth
--    Deshabilitar "Enable email confirmations"
--    Esto permite que los usuarios se registren sin enviar email
--
-- b) Usar un servicio de email externo (Resend, SendGrid) para confirmaciones
--    Esto evita el rate limit de emails de Supabase
--
-- c) Aumentar el delay entre registros en el código (ya implementado: 15 segundos)
--
-- d) Considerar actualizar a un plan de pago si necesitas más registros

-- 5. Verificar si hay usuarios sin confirmar que pueden estar bloqueando
SELECT 
    COUNT(*) as usuarios_sin_confirmar,
    MIN(created_at) as usuario_mas_antiguo_sin_confirmar
FROM auth.users
WHERE email_confirmed_at IS NULL
AND created_at > NOW() - INTERVAL '24 hours';

-- 6. Si necesitas limpiar usuarios de prueba (CUIDADO: esto elimina usuarios)
-- Descomenta solo si estás seguro:
/*
DELETE FROM auth.users 
WHERE email_confirmed_at IS NULL 
AND created_at < NOW() - INTERVAL '1 hour'
AND email LIKE '%test%' OR email LIKE '%prueba%';
*/


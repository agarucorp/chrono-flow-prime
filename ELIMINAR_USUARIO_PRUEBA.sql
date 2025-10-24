-- 🗑️ ELIMINAR USUARIO DE PRUEBA
-- Ejecutar en Supabase SQL Editor

-- PASO 1: Identificar el usuario a eliminar
-- (Reemplaza 'email-de-prueba@gmail.com' con el email que usaste)

SELECT 
    id,
    email,
    created_at,
    confirmed_at
FROM auth.users 
WHERE email = 'email-de-prueba@gmail.com';

-- PASO 2: Eliminar el usuario (CUIDADO: esto elimina TODO)
-- Descomenta y ejecuta SOLO si estás seguro del email

-- DELETE FROM auth.users 
-- WHERE email = 'email-de-prueba@gmail.com';

-- PASO 3: Verificar que se eliminó
-- SELECT * FROM auth.users WHERE email = 'email-de-prueba@gmail.com';

-- ⚠️ IMPORTANTE: 
-- - Esto elimina el usuario PERMANENTEMENTE
-- - También elimina todos sus datos relacionados
-- - No se puede deshacer
-- - Úsalo solo para usuarios de prueba

-- 💡 ALTERNATIVA SEGURA:
-- En lugar de eliminar, puedes cambiar el email:
-- UPDATE auth.users 
-- SET email = 'old-' || email 
-- WHERE email = 'email-de-prueba@gmail.com';

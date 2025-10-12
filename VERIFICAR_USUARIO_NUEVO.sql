-- Script para verificar el estado del usuario nuevo e61070f2-3f3a-46ab-a5c3-6d5451d57806

-- 1. Verificar usuario en auth.users
SELECT 
    id,
    email,
    confirmed_at,
    created_at,
    CASE 
        WHEN confirmed_at IS NULL THEN '❌ NO CONFIRMADO'
        ELSE '✅ CONFIRMADO'
    END as status
FROM auth.users 
WHERE id = 'e61070f2-3f3a-46ab-a5c3-6d5451d57806';

-- 2. Verificar perfil en profiles
SELECT 
    id,
    email,
    role,
    created_at,
    CASE 
        WHEN role = 'client' THEN '✅ ROL CORRECTO'
        ELSE '❌ ROL INCORRECTO'
    END as rol_status
FROM profiles 
WHERE id = 'e61070f2-3f3a-46ab-a5c3-6d5451d57806';

-- 3. Verificar horarios recurrentes (debería estar vacío antes de confirmar)
SELECT 
    COUNT(*) as total_horarios,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Ningún horario (correcto antes de confirmar)'
        ELSE '📊 ' || COUNT(*) || ' horarios configurados'
    END as status
FROM horarios_recurrentes_usuario 
WHERE usuario_id = 'e61070f2-3f3a-46ab-a5c3-6d5451d57806';

-- 4. Ver detalle de horarios si existen
SELECT 
    id,
    dia_semana,
    hora_inicio,
    hora_fin,
    activo,
    fecha_inicio,
    created_at
FROM horarios_recurrentes_usuario 
WHERE usuario_id = 'e61070f2-3f3a-46ab-a5c3-6d5451d57806'
ORDER BY dia_semana, hora_inicio;

-- 5. Verificar columnas de la tabla horarios_recurrentes_usuario
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'horarios_recurrentes_usuario' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- RESULTADO ESPERADO:
-- Usuario: ✅ CONFIRMADO
-- Perfil: ✅ ROL client
-- Horarios: 0 o los que se configuraron correctamente
-- Columnas: NO debe existir 'horario_clase_id'

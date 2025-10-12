-- VERIFICAR CONFIGURACIÓN DE EMAILS EN SUPABASE
-- Este script te ayuda a verificar que los emails estén configurados correctamente

-- ==============================================
-- 1. VERIFICAR CONFIGURACIÓN DE AUTH
-- ==============================================

-- Verificar que la confirmación de email esté habilitada
SELECT 
    'Configuración de Auth' as seccion,
    'Estado' as parametro,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM auth.config 
            WHERE parameter = 'enable_signup' 
            AND value = 'true'
        ) THEN '✅ Sign up habilitado'
        ELSE '❌ Sign up deshabilitado'
    END as valor;

-- ==============================================
-- 2. VERIFICAR USUARIOS PENDIENTES DE CONFIRMACIÓN
-- ==============================================

-- Ver usuarios que no han confirmado su email
SELECT 
    email,
    created_at,
    confirmed_at,
    CASE 
        WHEN confirmed_at IS NULL THEN '⏳ Pendiente de confirmación'
        ELSE '✅ Confirmado'
    END as estado,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as horas_desde_registro
FROM auth.users
WHERE confirmed_at IS NULL
ORDER BY created_at DESC;

-- ==============================================
-- 3. ESTADÍSTICAS DE CONFIRMACIÓN
-- ==============================================

-- Resumen de usuarios por estado de confirmación
SELECT 
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN confirmed_at IS NOT NULL THEN 1 END) as usuarios_confirmados,
    COUNT(CASE WHEN confirmed_at IS NULL THEN 1 END) as usuarios_pendientes,
    ROUND(
        COUNT(CASE WHEN confirmed_at IS NOT NULL THEN 1 END)::NUMERIC / 
        NULLIF(COUNT(*)::NUMERIC, 0) * 100, 
        2
    ) as porcentaje_confirmacion
FROM auth.users;

-- ==============================================
-- 4. VERIFICAR EMAILS ENVIADOS RECIENTEMENTE
-- ==============================================

-- Nota: Supabase no guarda logs de emails en la base de datos por defecto
-- Para ver logs de emails, debes ir a:
-- Dashboard → Project Settings → API → Logs → Auth Logs

SELECT 
    '📧 Para ver logs de emails' as informacion,
    'Ve al Dashboard de Supabase → Project Settings → Logs' as ubicacion;

-- ==============================================
-- 5. TESTING DE PLANTILLAS
-- ==============================================

-- Para testear las plantillas de email:
/*
1. Ir al Dashboard de Supabase
2. Authentication → Email Templates
3. Seleccionar la plantilla (Confirm signup / Reset password)
4. Usar el botón "Send test email"
5. Verificar que llegue con el estilo correcto
*/

SELECT 
    '🧪 Testing de plantillas' as paso,
    'Dashboard → Authentication → Email Templates → Send test email' as accion;

-- ==============================================
-- 6. VARIABLES DISPONIBLES EN PLANTILLAS
-- ==============================================

-- Lista de variables que puedes usar en las plantillas
SELECT 
    '{{ .ConfirmationURL }}' as variable,
    'URL de confirmación/reset' as descripcion

UNION ALL

SELECT 
    '{{ .Token }}' as variable,
    'Token de confirmación' as descripcion

UNION ALL

SELECT 
    '{{ .TokenHash }}' as variable,
    'Hash del token' as descripcion

UNION ALL

SELECT 
    '{{ .SiteURL }}' as variable,
    'URL del sitio' as descripcion

UNION ALL

SELECT 
    '{{ .Email }}' as variable,
    'Email del usuario' as descripcion;

-- ==============================================
-- 7. REENVIAR EMAIL DE CONFIRMACIÓN (SI ES NECESARIO)
-- ==============================================

-- Para reenviar el email de confirmación a un usuario específico:
/*
Desde la aplicación frontend, usa:

const { error } = await supabase.auth.resend({
  type: 'signup',
  email: 'usuario@ejemplo.com',
  options: {
    emailRedirectTo: window.location.origin
  }
});
*/

SELECT 
    '🔄 Reenviar email de confirmación' as accion,
    'Usar supabase.auth.resend() desde el frontend' as metodo;

-- ==============================================
-- 8. VERIFICAR CONFIGURACIÓN SMTP
-- ==============================================

-- Verificar que el SMTP esté configurado correctamente
SELECT 
    '📮 Configuración SMTP' as verificacion,
    'Dashboard → Project Settings → Auth → SMTP Settings' as ubicacion,
    'Verifica que el servidor SMTP esté configurado' as accion;

-- ==============================================
-- 9. CHECKLIST DE CONFIGURACIÓN
-- ==============================================

SELECT 
    '✅ CHECKLIST DE CONFIGURACIÓN' as titulo

UNION ALL

SELECT 
    '□ 1. Plantilla de confirmación actualizada' as item

UNION ALL

SELECT 
    '□ 2. Plantilla de recuperación actualizada' as item

UNION ALL

SELECT 
    '□ 3. Subject personalizado' as item

UNION ALL

SELECT 
    '□ 4. Colores del sitio aplicados' as item

UNION ALL

SELECT 
    '□ 5. Test enviado y verificado' as item

UNION ALL

SELECT 
    '□ 6. Probado en Gmail, Outlook, Apple Mail' as item

UNION ALL

SELECT 
    '□ 7. Responsive verificado en mobile' as item

UNION ALL

SELECT 
    '□ 8. Variables {{ }} funcionando correctamente' as item;

-- ==============================================
-- 10. TROUBLESHOOTING
-- ==============================================

/*
PROBLEMAS COMUNES:

1. "El email no llega"
   → Verificar spam/correo no deseado
   → Verificar configuración SMTP
   → Verificar logs en Dashboard

2. "El estilo no se aplica"
   → Algunos clientes de email no soportan CSS avanzado
   → Usar estilos inline
   → Probar en diferentes clientes

3. "Las variables no se reemplazan"
   → Verificar sintaxis {{ .Variable }}
   → Verificar que la variable existe en Supabase
   → Revisar logs para ver errores

4. "El botón no funciona"
   → Verificar que .ConfirmationURL tenga el dominio correcto
   → Verificar redirect URLs en Supabase Auth settings
*/

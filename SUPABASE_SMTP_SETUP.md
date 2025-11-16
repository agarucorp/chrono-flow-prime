# Configuración De SMTP En Supabase (Producción)

Objetivo: evitar el error 429 (email rate limit exceeded) usando un proveedor SMTP propio, y desactivar el email de confirmación en desarrollo.

## 1) Desactivar confirmación de email en desarrollo

- En el Dashboard de Supabase: Auth → Providers → Email
- Desactivar "Confirm email" (solo para el proyecto de desarrollo)
- En el `.env.local` del frontend, agregar:

```
VITE_DISABLE_EMAIL_CONFIRM=true
```

Con esto, el formulario de recuperación simula el envío y no golpea el límite.

> Nota: Para el registro, Supabase envía email si la confirmación está activada en el proyecto. No es posible desactivarlo desde el cliente; para dev, desactiva la confirmación en el Dashboard.

## 2) Configurar SMTP en producción

1. Crea una cuenta en un proveedor SMTP (SendGrid, Mailgun o AWS SES).
2. Verifica tu dominio y configura los registros DNS (SPF, DKIM) según el proveedor.
3. En Supabase Dashboard: Auth → SMTP Settings:
   - SMTP Host (p. ej. `smtp.sendgrid.net`)
   - SMTP Port (587 recomendado)
   - Username (p. ej. `apikey` en SendGrid)
   - Password (API Key generada)
   - Sender name y email (ej: `MaldaGym <no-reply@tudominio.com>`)
4. Guarda cambios y usa el botón “Send test email” para verificar.
5. Ajusta plantillas en Auth → Templates (Confirm signup, Reset password, etc.).

Con SMTP propio, los límites de envío pasan a ser los de tu proveedor (mucho más altos que el plan Free). Aún así, conserva las protecciones anti‑abuso (p. ej., no enviar decenas de correos por minuto al mismo destinatario).

## 3) Recomendaciones

- Evitar dobles envíos: ya bloqueamos clicks mientras `isLoading`.
- Manejar 429 con backoff (implementado).
- No repetir sign up/reset para el mismo email en minutos seguidos.
- Para QA: usar cuentas de prueba distintas o limpiar “auth rate limits” tras ventanas de tiempo.



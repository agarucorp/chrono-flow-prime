# 🔧 Habilitar Confirmación de Email en Supabase

## ❌ Problema Detectado

Los usuarios se están **autoconfirmando** sin recibir email. Esto significa que la confirmación de email está deshabilitada en Supabase.

---

## ✅ Solución - Pasos para Habilitar

### 1. Ir a la Configuración de Auth

```
Dashboard de Supabase
→ Authentication
→ Settings
→ Email Auth
```

### 2. Habilitar "Email Confirmations"

Busca la opción:
```
☑️ Enable email confirmations
```

**Marca esta casilla** para que se requiera confirmación de email.

### 3. Configurar Redirect URLs

En la misma sección de Settings:
```
Redirect URLs → Add URL

Agregar:
- https://tu-dominio.vercel.app
- http://localhost:5173 (para desarrollo)
```

### 4. Configurar Email Templates (Ya hiciste esto ✅)

```
Authentication → Email Templates

✅ Confirm signup: confirmacion_cuenta.html
✅ Reset password: recuperacion_contraseña.html
```

### 5. Verificar SMTP (Opcional pero recomendado)

Por defecto, Supabase usa su propio servicio de email, pero puedes configurar tu propio SMTP:

```
Authentication → Settings → SMTP Settings

Si usas Gmail, SendGrid, Mailgun, etc:
- Enable Custom SMTP
- Configurar servidor, puerto, usuario, contraseña
```

---

## 🧪 Probar la Configuración

### Paso 1: Eliminar usuario de prueba

```sql
-- En Supabase SQL Editor:
DELETE FROM auth.users 
WHERE email = 'tu-email-de-prueba@gmail.com';
```

### Paso 2: Registrarse de nuevo

1. Ve a tu aplicación
2. Regístrate con el mismo email
3. **AHORA SÍ** debería llegar el email de confirmación
4. El usuario quedará pendiente hasta que confirme

### Paso 3: Verificar

```sql
-- Verificar usuario pendiente
SELECT 
    email,
    created_at,
    confirmed_at,
    CASE 
        WHEN confirmed_at IS NULL THEN '⏳ Pendiente de confirmación'
        ELSE '✅ Confirmado'
    END as estado
FROM auth.users
WHERE email = 'tu-email-de-prueba@gmail.com';
```

---

## 🔍 Debugging

Si aún no llega el email:

### 1. Verificar Spam
- Gmail → Spam / Correo no deseado
- Buscar "MaldaGym"

### 2. Verificar Logs de Auth
```
Dashboard → Logs → Auth Logs
```
Buscar errores relacionados con el envío de emails

### 3. Verificar Provider de Email
```
Dashboard → Settings → Auth
```
Ver si hay algún error en el provider de email

### 4. Probar con otro email
- A veces Gmail/Outlook bloquean emails de testing
- Prueba con otro proveedor (ej: ProtonMail, Outlook)

---

## ⚙️ Configuración Recomendada

```
✅ Enable email confirmations: ON
✅ Confirm email: ON  
✅ Secure email change: ON
✅ Double confirm email changes: ON
```

---

## 🎯 Resumen

**Problema**: La confirmación de email está deshabilitada
**Solución**: Habilitar "Enable email confirmations" en Dashboard
**Resultado**: Los nuevos usuarios deberán confirmar su email antes de acceder

---

## 📧 Subject Recomendados

Cuando configures las plantillas, usa estos subjects:

```
Confirm signup:
Subject: Confirma tu cuenta en MaldaGym 🎉

Reset password:  
Subject: Recupera tu contraseña - MaldaGym 🔐

Invite user:
Subject: Invitación a MaldaGym 📨

Magic link:
Subject: Tu enlace de acceso - MaldaGym 🔗
```

---

✅ **Después de habilitar, los emails llegarán con el estilo personalizado de MaldaGym!**

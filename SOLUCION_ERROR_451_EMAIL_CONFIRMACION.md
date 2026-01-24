# 🔧 Solución Error 451: Maximum Credits Exceeded

## ❌ Problema Identificado

El error **"451 Authentication failed: Maximum credits exceeded"** está impidiendo el envío de emails de confirmación, lo que bloquea la creación de nuevos usuarios.

**Error en logs:**
```
"error": "451 Authentication failed: Maximum credits exceeded"
"msg": "500: Error sending confirmation email"
```

## 🔍 Causas Posibles

1. **Proyecto inactivo o suspendido** (la última vez que pasó fue por esto)
2. **Límite de emails del plan gratuito alcanzado**
3. **Configuración de SMTP incorrecta o deshabilitada**
4. **Problema temporal con el servicio de email de Supabase**

## ✅ Pasos para Resolver

### PASO 1: Verificar SMTP Settings (CRÍTICO - HACER PRIMERO)

1. Ir a **Authentication** → **Settings** → **SMTP Settings**
2. **VERIFICAR SI HAY SMTP PERSONALIZADO HABILITADO:**
   - Si **NO** hay SMTP configurado: ✅ Supabase usa su servicio interno (debería funcionar)
   - Si **SÍ** hay SMTP configurado:
     - ⚠️ **DESHABILITARLO TEMPORALMENTE** (Enable Custom SMTP: OFF)
     - Guardar cambios
     - Probar registro de nuevo usuario
     - Si funciona: El problema era el SMTP personalizado
     - Si no funciona: Volver a habilitarlo y verificar credenciales

### PASO 2: Verificar Estado del Proyecto

1. Ir a **Supabase Dashboard** → **Settings** → **General**
2. Verificar que el proyecto esté **ACTIVO** (no pausado o suspendido)
3. Si está pausado:
   - Hacer clic en **"Resume project"** o **"Restore project"**
   - Esperar a que el proyecto se reactive completamente

### PASO 3: Verificar Configuración de Email

1. Ir a **Authentication** → **Settings** → **Email Auth**
2. Verificar que esté habilitado:
   - ✅ **Enable email confirmations**: ON
   - ✅ **Confirm email**: ON
   - ✅ **Secure email change**: ON

### PASO 4: Verificar Email Templates (CRÍTICO)

1. Ir a **Authentication** → **Email Templates**
2. Seleccionar **"Confirm your signup"**
3. **VERIFICAR QUE EL TEMPLATE EXISTA Y ESTÉ CONFIGURADO:**
   - ✅ Subject debe estar configurado (ej: "Confirma tu cuenta en MaldaGym 🎉")
   - ✅ Body debe incluir el enlace: `{{ .ConfirmationURL }}`
   - ✅ El template NO debe estar vacío
   
4. **SI EL TEMPLATE ESTÁ VACÍO O FALTANTE:**
   - Crear/editar el template con este contenido mínimo:
   ```
   Subject: Confirma tu cuenta en MaldaGym 🎉
   
   Body:
   Hola,
   
   Por favor confirma tu cuenta haciendo clic en el siguiente enlace:
   {{ .ConfirmationURL }}
   
   Si no creaste esta cuenta, puedes ignorar este correo.
   ```
   
5. **Verificar URL de redirección:**
   - En el template, el `{{ .ConfirmationURL }}` debe estar presente
   - Verificar que la URL de redirección en Settings sea correcta

### PASO 5: Si el SMTP Personalizado es Necesario

Si después de deshabilitar el SMTP el registro funciona, pero necesitas SMTP personalizado:

1. **Verificar credenciales del SMTP:**
   - Host, Port, Username, Password deben ser correctos
   - Si usas Gmail: Necesitas una "Contraseña de aplicación", no la contraseña normal
   - Si usas otro proveedor: Verificar que las credenciales no hayan expirado

2. **Verificar configuración del dominio (SPF/DKIM):**
   - Si el SMTP usa un dominio personalizado, debe tener SPF/DKIM configurado
   - Hotmail/Outlook son más estrictos con esto que Gmail

3. **Probar envío de email de prueba:**
   - Usar el botón "Send test email" en SMTP Settings
   - Enviar a Gmail y Hotmail para verificar que ambos funcionen

### PASO 6: Verificar URLs de Redirección

1. Ir a **Authentication** → **Settings** → **URL Configuration**
2. Verificar que estén configuradas:
   - **Site URL**: `https://www.maldagym.com` (o tu dominio)
   - **Redirect URLs** debe incluir:
     - `https://www.maldagym.com/login`
     - `https://www.maldagym.com/dashboard`
     - `https://www.maldagym.com/user`
     - `http://localhost:5173/login` (para desarrollo)

### PASO 7: Verificar Webhooks (si aplica)

1. Ir a **Database** → **Webhooks**
2. Verificar si hay webhooks configurados para `auth.users`
3. Si hay webhooks, verificar que estén activos y funcionando

## 🚨 Si el Proyecto Estaba Inactivo

Si el proyecto estaba pausado y lo reactivaste:

1. **Esperar 5-10 minutos** después de reactivar
2. **Verificar que todos los servicios estén activos**:
   - Database: ✅ Activo
   - Auth: ✅ Activo
   - Storage: ✅ Activo
   - Edge Functions: ✅ Activo
3. **Probar registro de nuevo usuario**

## 🔄 Solución si el Problema Persiste

Si después de verificar todo lo anterior el error 451 sigue apareciendo:

1. **Verificar si hay SMTP mal configurado:**
   - Si hay SMTP personalizado pero con credenciales incorrectas, **DESHABILITARLO**
   - Dejar que Supabase use su servicio interno

2. **Recrear el Email Template:**
   - Eliminar el template "Confirm your signup" actual
   - Crear uno nuevo desde cero con el contenido mínimo necesario

3. **Contactar Soporte de Supabase:**
   - Si el proyecto está activo, el uso es mínimo, y todo está configurado correctamente, puede ser un bug
   - Abrir un ticket en el dashboard de Supabase

4. **Verificar si hay webhooks que estén fallando:**
   - Database → Webhooks
   - Si hay webhooks para auth.users, verificar que estén funcionando
   - Deshabilitar temporalmente si están causando problemas

## 📝 Verificación Post-Solución

Después de aplicar la solución:

1. Intentar registrar un nuevo usuario
2. Verificar que llegue el email de confirmación
3. Verificar en logs que no aparezca el error 451
4. Confirmar que el usuario se crea correctamente después de confirmar email

## 🎯 Resultado Esperado

- ✅ Los usuarios pueden registrarse
- ✅ Reciben email de confirmación
- ✅ Pueden confirmar su cuenta
- ✅ Se crea el perfil automáticamente
- ✅ Pueden iniciar sesión

---

**Última actualización:** 2026-01-22
**Estado:** Error 451 confirmado en logs - Requiere verificación de estado del proyecto

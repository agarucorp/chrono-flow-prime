# 🔧 Configurar URLs de Redirección en Supabase

## ❌ Problema Actual
Los usuarios que confirman su email son redirigidos a la página de "request access" de Vercel en lugar de ser confirmados automáticamente.

## ✅ Solución - Configurar URLs Correctas

### 1. Ir a Configuración de URLs en Supabase

```
Dashboard de Supabase
→ Authentication
→ Settings
→ URL Configuration
```

### 2. Configurar Site URL

**Site URL** (URL principal de tu aplicación):
```
https://tu-dominio.vercel.app
```

**Ejemplo:**
```
https://chrono-flow-prime.vercel.app
```

### 3. Configurar Redirect URLs

**Redirect URLs** (URLs permitidas para redirección):
```
https://tu-dominio.vercel.app/login
https://tu-dominio.vercel.app/dashboard
https://tu-dominio.vercel.app/user
https://tu-dominio.vercel.app/admin
http://localhost:5173/login
http://localhost:5173/dashboard
```

### 4. Configurar Email Auth

En la misma sección de Settings:

```
Authentication > Settings > Email Auth

✅ Enable email confirmations: ON
✅ Confirm email: ON
✅ Secure email change: ON
```

### 5. Verificar Email Templates

```
Authentication > Email Templates
→ Confirm your signup

Subject: Confirma tu cuenta en MaldaGym 🎉
Template: Usar el HTML personalizado de MaldaGym
```

### 6. Configurar SMTP (Si es necesario)

Si los emails no llegan:

```
Authentication > Settings > SMTP Settings

✅ Enable Custom SMTP: ON
Provider: Gmail / SendGrid / Mailgun
```

**Configuración para Gmail:**
```
Host: smtp.gmail.com
Port: 587
Username: tu-email@gmail.com
Password: tu-contraseña-de-aplicación
```

### 7. Probar la Configuración

1. **Eliminar usuario de prueba:**
   ```sql
   DELETE FROM auth.users WHERE email = 'usuario-prueba@gmail.com';
   ```

2. **Registrarse de nuevo:**
   - Ir a la aplicación
   - Registrarse con el mismo email
   - Verificar que llega el email de confirmación

3. **Confirmar cuenta:**
   - Hacer clic en el enlace del email
   - Debería redirigir a `/login` o `/dashboard`
   - NO debería ir a la página de "request access"

### 8. Verificar en Logs

```
Dashboard > Logs > Auth Logs
```

Buscar:
- ✅ "Email sent successfully"
- ❌ "Redirect URL not allowed"
- ❌ "Email confirmation failed"

## 🎯 Resultado Esperado

Después de configurar correctamente:

1. ✅ Los usuarios reciben email de confirmación
2. ✅ Al hacer clic en el enlace, se confirma automáticamente
3. ✅ Son redirigidos a la aplicación (no a Vercel)
4. ✅ Pueden iniciar sesión normalmente

## 🔍 Debugging

Si sigue sin funcionar:

1. **Verificar dominio en Vercel:**
   - Asegúrate de que el dominio esté configurado correctamente
   - Verifica que la aplicación esté desplegada

2. **Verificar variables de entorno:**
   ```bash
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_clave_anonima
   ```

3. **Verificar políticas RLS:**
   - Asegúrate de que las políticas permitan el acceso después de la confirmación

4. **Probar con otro email:**
   - A veces Gmail bloquea emails de testing
   - Prueba con Outlook, ProtonMail, etc.

---

## 📝 Resumen de URLs a Configurar

**Site URL:**
```
https://tu-dominio.vercel.app
```

**Redirect URLs:**
```
https://tu-dominio.vercel.app/login
https://tu-dominio.vercel.app/dashboard
https://tu-dominio.vercel.app/user
https://tu-dominio.vercel.app/admin
http://localhost:5173/login
http://localhost:5173/dashboard
```

✅ **Con esta configuración, la confirmación de email funcionará correctamente!**

# 🔍 Investigación Error 451: Registro de Usuarios Bloqueado

## ❌ Problema Actual

**Error:** `451 Authentication failed: Maximum credits exceeded`  
**Efecto:** No se pueden crear usuarios nuevos desde hace una semana  
**Estado del proyecto:** ✅ Activo  
**Uso del proyecto:** ✅ Mínimo (no lanzado aún)

## ✅ Verificaciones Realizadas

### 1. Código - Sin Restricciones de Dominio
- ✅ **No hay validación de dominio** en el código
- ✅ **No hay filtros** que limiten proveedores de email
- ✅ **Cualquier email válido** puede registrarse (gmail, hotmail, outlook, etc.)
- ✅ El problema de hotmail es del **servicio de email**, no del código

### 2. Base de Datos
- ✅ **No hay políticas RLS** que restrinjan dominios
- ✅ **No hay triggers** que bloqueen ciertos dominios
- ✅ **Usuarios existentes:**
  - gmail.com: 5 usuarios (todos confirmados)
  - hotmail.com: 1 usuario (sin confirmar - problema de email, no de código)

### 3. Configuración Verificada
- ✅ Template de email configurado
- ✅ Edge function de bienvenida configurada
- ✅ Proyecto activo
- ✅ Uso mínimo

## 🔍 Causa Probable del Error 451

El error **"451 Maximum credits exceeded"** indica que el **servicio de envío de emails de Supabase** está rechazando el envío. Esto puede ser por:

### Opción 1: SMTP Personalizado Mal Configurado (MÁS PROBABLE)
Si hay un SMTP personalizado configurado pero con credenciales incorrectas o expiradas:
- Supabase intenta usar el SMTP personalizado
- El SMTP falla (credenciales incorrectas, dominio no verificado, etc.)
- Supabase devuelve error 451
- **Solución:** Deshabilitar SMTP personalizado o corregir credenciales

### Opción 2: Límite del Servicio Interno de Supabase
Aunque el proyecto está activo, el servicio interno de Supabase puede tener:
- Un límite temporal alcanzado
- Un problema con la cuenta/proyecto específico
- **Solución:** Contactar soporte de Supabase o esperar

### Opción 3: Configuración de Email Templates
Si el template está mal formateado o tiene problemas:
- Supabase puede rechazar el envío
- **Solución:** Verificar y recrear el template

## ✅ Acciones Inmediatas a Realizar

### PASO 1: Verificar SMTP Settings (CRÍTICO)

1. Ir a **Authentication** → **Settings** → **SMTP Settings**
2. **Verificar si hay SMTP personalizado habilitado:**
   - Si está habilitado: **DESHABILITARLO TEMPORALMENTE**
   - Probar registro de nuevo usuario
   - Si funciona, el problema era el SMTP personalizado
   - Si no funciona, volver a habilitarlo y verificar credenciales

### PASO 2: Verificar Email Templates

1. Ir a **Authentication** → **Email Templates** → **"Confirm your signup"**
2. **Verificar:**
   - El template existe y no está vacío
   - El Subject está configurado
   - El Body incluye `{{ .ConfirmationURL }}`
   - No hay caracteres especiales que puedan causar problemas

### PASO 3: Probar Email de Prueba

1. En **SMTP Settings**, usar el botón **"Send test email"**
2. Enviar a una cuenta de Gmail
3. Enviar a una cuenta de Hotmail
4. Verificar si ambos llegan o si hay diferencias

### PASO 4: Verificar Logs Detallados

1. Ir a **Logs** → **Auth Logs**
2. Buscar intentos de registro recientes
3. Verificar si hay errores adicionales además del 451
4. Verificar si el error es consistente o varía

### PASO 5: Contactar Soporte de Supabase (si persiste)

Si después de verificar todo lo anterior el error persiste:
1. Abrir un ticket en el dashboard de Supabase
2. Mencionar:
   - Error 451 "Maximum credits exceeded"
   - Proyecto activo con uso mínimo
   - No hay SMTP personalizado (o está correctamente configurado)
   - Template de email configurado correctamente
   - El problema comenzó hace una semana

## 📝 Notas Importantes

- **El código NO tiene restricciones de dominio** - cualquier email válido puede registrarse
- **El problema de hotmail** es del servicio de email, no del código
- **El error 451** está bloqueando TODOS los registros, no solo hotmail
- **La última vez que pasó** fue porque el proyecto estaba inactivo (ahora está activo)

## 🎯 Resultado Esperado

Después de resolver el problema:
- ✅ Usuarios con Gmail pueden registrarse
- ✅ Usuarios con Hotmail pueden registrarse
- ✅ Usuarios con cualquier otro dominio pueden registrarse
- ✅ Todos reciben el email de confirmación
- ✅ El error 451 desaparece de los logs

---

**Última actualización:** 2026-01-22  
**Estado:** Error 451 confirmado - Requiere verificación de SMTP Settings en Dashboard

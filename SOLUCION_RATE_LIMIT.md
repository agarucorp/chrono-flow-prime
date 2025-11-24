# Solución para Rate Limit de Supabase

## Problema
Supabase limita a **3-4 registros por hora desde la misma IP** en el plan gratuito. Esto causa el error `429 - Email rate limit exceeded`.

## Límites por Plan

### Plan Gratuito (Free)
- **3-4 registros por hora desde la misma IP**
- Límite global de emails muy restrictivo (varía)
- No se pueden configurar límites personalizados

### Plan Pro ($25/mes)
- **30 nuevos usuarios por hora globalmente** (no por IP)
- Límite significativamente mayor que el plan gratuito
- Puedes contactar a soporte para solicitar aumentos adicionales
- Incluye 100,000 usuarios activos mensuales (MAUs) incluidos
- $0.00325 por cada MAU adicional

### Plan Team
- **30 nuevos usuarios por hora globalmente** (similar al Pro)
- Límites personalizables contactando a soporte
- Ideal para equipos

### Plan Enterprise
- **Límites personalizados** según tus necesidades
- Contacta a Supabase para negociar límites específicos
- Ideal para aplicaciones de gran escala

## Cambios Implementados

### 1. Delay Preventivo Aumentado
- **Antes**: 2 segundos entre intentos
- **Ahora**: 15 segundos entre intentos
- Esto reduce la probabilidad de alcanzar el límite

### 2. Mensajes de Error Mejorados
- Los usuarios ahora reciben mensajes claros explicando el límite
- Se indica que deben esperar 15-20 minutos o usar otra red

### 3. Reintentos Optimizados
- Reducidos de 3 a 2 reintentos
- Delays más largos (30s, 60s) ya que si el límite se alcanzó, los reintentos inmediatos no ayudan

## Verificar Configuración en Supabase Dashboard

### Paso 1: Verificar Rate Limits
1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **Authentication** > **Settings** > **Rate Limits**
3. Verifica los límites actuales (no se pueden cambiar en plan gratuito)

### Paso 2: Deshabilitar Confirmación de Email (Recomendado para Desarrollo)
**Esto reduce el rate limit porque no envía emails:**

1. Ve a **Authentication** > **Settings** > **Email Auth**
2. **Deshabilita** "Enable email confirmations"
3. Esto permite que los usuarios se registren sin confirmar email
4. Los usuarios podrán iniciar sesión inmediatamente después de registrarse

### Paso 3: Verificar Usuarios Recientes
Ejecuta el script SQL `VERIFICAR_RATE_LIMIT_SUPABASE.sql` en el SQL Editor de Supabase para ver:
- Cuántos usuarios se crearon en la última hora
- Si hay usuarios sin confirmar bloqueando el sistema

### Paso 4: Limpiar Usuarios de Prueba (Opcional)
Si estás en desarrollo y creaste muchos usuarios de prueba:

```sql
-- CUIDADO: Esto elimina usuarios
DELETE FROM auth.users 
WHERE email_confirmed_at IS NULL 
AND created_at < NOW() - INTERVAL '1 hour'
AND (email LIKE '%test%' OR email LIKE '%prueba%' OR email LIKE '%demo%');
```

## Soluciones a Largo Plazo

### Opción 1: Usar Servicio de Email Externo
- Configurar Resend, SendGrid o similar
- Esto evita el rate limit de emails de Supabase
- Los usuarios pueden confirmar email sin límites

### Opción 2: Actualizar Plan de Supabase
- **Plan Pro**: 30 nuevos usuarios por hora (vs 3-4 en gratuito)
- **10x más capacidad** que el plan gratuito
- Puedes contactar a soporte para aumentar aún más si es necesario
- Pro: Límites mucho más altos, soporte prioritario
- Contra: Costo mensual ($25/mes para Pro)
- **Recomendado para producción** si esperas más de 3-4 registros por hora

### Opción 3: Implementar Queue de Registros
- Para producción, implementar un sistema de cola
- Los registros se procesan con delays automáticos
- Evita alcanzar el límite

## Comportamiento Actual del Sistema

1. **Delay Preventivo**: Espera 15 segundos entre cada intento de registro
2. **Detección de Rate Limit**: Detecta errores 429 automáticamente
3. **Reintentos**: 2 reintentos con delays de 30s y 60s
4. **Mensajes Claros**: Informa al usuario sobre el límite y qué hacer

## Pruebas

Para probar que funciona:
1. Intenta crear 2-3 usuarios seguidos (debería funcionar con el delay de 15s)
2. Si intentas crear más de 3-4 en una hora, verás el mensaje de error claro
3. Espera 15-20 minutos o cambia de red para poder registrar más usuarios

## Notas Importantes

- El rate limit es **por IP**, no por usuario
- Si estás probando desde la misma computadora/red, todos los intentos cuentan para el mismo límite
- Para pruebas, considera usar diferentes redes o esperar entre intentos
- En producción, el delay de 15 segundos debería ser suficiente para la mayoría de casos


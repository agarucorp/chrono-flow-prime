# Guía para Probar el Sistema de Login

## Pasos para Verificar el Sistema

### 1. Ejecutar Scripts SQL en Supabase

1. **Ejecutar primero**: `TABLA_PROFILES_OPTIMIZADA.sql`
   - Esto creará/optimizará la tabla de perfiles
   - Configurará las políticas RLS
   - Creará las funciones y triggers necesarios

2. **Ejecutar después**: `VERIFICAR_SISTEMA_LOGIN.sql`
   - Esto verificará que todo esté configurado correctamente

### 2. Configurar Variables de Entorno

Asegúrate de tener un archivo `.env` en la raíz del proyecto con:

```bash
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima
```

### 3. Probar el Flujo de Registro

1. **Abrir la aplicación** en `http://localhost:8080`
2. **Hacer clic en "Crear cuenta"**
3. **Completar el formulario paso a paso**:
   - Paso 1: Datos personales (nombre, apellido, teléfono, género, fecha de nacimiento)
   - Paso 2: Datos de acceso (email, confirmar email, contraseña, confirmar contraseña)
4. **Verificar que**:
   - Se muestre el mensaje de éxito
   - Se envíe un email de confirmación
   - El formulario se limpie y vuelva al login

### 4. Probar el Flujo de Login

1. **Revisar el email** y hacer clic en el enlace de confirmación
2. **Volver a la aplicación** y hacer login con las credenciales
3. **Verificar que**:
   - El login funcione correctamente
   - Se redirija según el rol del usuario:
     - Si es admin: `/admin`
     - Si es cliente: `/turnos`

### 5. Probar Recuperación de Contraseña

1. **En la pantalla de login**, hacer clic en "Recuperar acceso"
2. **Ingresar un email** registrado
3. **Verificar que**:
   - Se envíe un email de recuperación
   - Se muestre el mensaje de confirmación

### 6. Verificar en Supabase

1. **Ir al dashboard de Supabase**
2. **Verificar en la tabla `profiles`**:
   - Que se hayan creado los perfiles correctamente
   - Que los roles estén asignados correctamente
   - Que los datos estén completos

## Problemas Comunes y Soluciones

### Error: "No se puede crear perfil"
- **Causa**: El trigger no está funcionando correctamente
- **Solución**: Ejecutar el script `TABLA_PROFILES_OPTIMIZADA.sql` nuevamente

### Error: "Usuario no encontrado en profiles"
- **Causa**: El usuario se creó en auth.users pero no en profiles
- **Solución**: Verificar que el trigger `on_auth_user_created` esté activo

### Error: "No tienes permisos"
- **Causa**: Las políticas RLS no están configuradas correctamente
- **Solución**: Verificar que las políticas estén creadas correctamente

### Error: "Email no confirmado"
- **Causa**: El usuario no ha confirmado su email
- **Solución**: Revisar el email y hacer clic en el enlace de confirmación

## Emails de Administrador

Los siguientes emails se configuran automáticamente como administradores:
- `gastondigilio@gmail.com`
- `fede.rz87@gmail.com`

## Verificación Final

Después de completar todos los pasos, deberías poder:
- ✅ Registrar nuevos usuarios
- ✅ Hacer login con usuarios existentes
- ✅ Recuperar contraseñas
- ✅ Ver usuarios en la tabla profiles de Supabase
- ✅ Los administradores pueden acceder a `/admin`
- ✅ Los clientes pueden acceder a `/turnos`

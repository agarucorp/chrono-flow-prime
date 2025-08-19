# 🔧 Configuración para Puerto 8080

## ⚠️ IMPORTANTE: Tu proyecto usa el puerto 8080

Tu aplicación está configurada para correr en `http://localhost:8080`, no en el puerto 5173 por defecto.

## 📝 Archivo .env

Crea un archivo `.env` en la raíz del proyecto con:

```bash
# Ubicación: gestion-turnos/.env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🌐 URLs de tu Aplicación

- **Aplicación principal**: `http://localhost:8080`
- **Página de login**: `http://localhost:8080/login`
- **Página de turnos**: `http://localhost:8080/turnos`

## 🔐 Configuración de Supabase

En el dashboard de Supabase, configura:

### Authentication > Settings
- **Site URL**: `http://localhost:8080`
- **Redirect URLs**: `http://localhost:8080/**`

### SQL para configurar redirecciones
```sql
-- Configurar URLs de redirección para puerto 8080
UPDATE auth.config 
SET site_url = 'http://localhost:8080',
    redirect_urls = ARRAY['http://localhost:8080/**'];

-- Habilitar autenticación por email
UPDATE auth.config 
SET enable_signup = true, 
    enable_confirmations = false;
```

## 🚀 Cómo Probar

1. **Crear archivo `.env`** con tus credenciales de Supabase
2. **Reiniciar servidor**: `npm run dev`
3. **Ir a**: `http://localhost:8080`
4. **Verificar**: Deberías ver el componente `TestAuth` funcionando

## 🔍 Verificar Configuración

En la consola del navegador (F12), ejecuta:

```javascript
console.log('Puerto actual:', window.location.port)
console.log('URL Supabase:', import.meta.env.VITE_SUPABASE_URL)
console.log('Clave Supabase:', import.meta.env.VITE_SUPABASE_ANON_KEY)
```

## 📱 Navegación

- **Sin autenticación**: Redirige a `/login`
- **Con autenticación**: Accede a todas las rutas
- **Logout**: Vuelve a `/login`

## 🆘 Si No Funciona

1. Verifica que el archivo `.env` esté en la raíz del proyecto
2. Asegúrate de que las credenciales de Supabase sean correctas
3. Reinicia el servidor después de crear el `.env`
4. Verifica la consola del navegador para errores

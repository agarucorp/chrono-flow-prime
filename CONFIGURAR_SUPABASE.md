# Configuración de Supabase

## Problema Identificado
El sistema no puede conectarse a Supabase porque faltan las variables de entorno.

## Solución

### 1. Crear archivo .env
Crea un archivo llamado `.env` en la raíz del proyecto (mismo nivel que `package.json`) con este contenido:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_aqui
```

### 2. Obtener las Variables de Supabase

1. Ve a tu proyecto en [supabase.com](https://supabase.com)
2. Ve a **Settings** → **API**
3. Copia:
   - **Project URL** → pégala en `VITE_SUPABASE_URL`
   - **anon public** key → pégala en `VITE_SUPABASE_ANON_KEY`

### 3. Ejemplo del archivo .env

```bash
VITE_SUPABASE_URL=https://hejlxluzupbaanjuwxqh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhlamx4bHV6dXBiYWFuanV3eHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwNzI4NTMsImV4cCI6MjA1MTY0ODg1M30.abc123...
```

### 4. Reiniciar la Aplicación

Después de crear el archivo `.env`:
1. Guarda el archivo
2. Reinicia la aplicación: `npm run dev`
3. Prueba el registro

## Verificación

Si la configuración es correcta, deberías ver en la consola:
- ✅ No hay errores de variables de entorno
- ✅ El registro funciona correctamente
- ✅ Llega el email de confirmación

## Si Aún No Funciona

1. Verifica que las variables estén correctas
2. Verifica que el proyecto de Supabase esté activo
3. Verifica que las políticas RLS estén configuradas correctamente

# 🔧 Configuración de Supabase - Solución de Problemas

## 🚨 Problema: Página en Blanco

Si tu proyecto se queda en blanco después de agregar las variables de entorno, sigue estos pasos:

### 1. Verificar Archivo .env

Crea un archivo `.env` en la **RAÍZ** del proyecto (mismo nivel que `package.json`):

```bash
# Ubicación: gestion-turnos/.env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Obtener Credenciales de Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Inicia sesión o crea cuenta
3. Crea un nuevo proyecto
4. Ve a **Settings** > **API**
5. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY`

### 3. Reiniciar el Servidor

```bash
# Detener el servidor (Ctrl+C)
# Luego ejecutar:
npm run dev
```

### 4. Verificar en Consola del Navegador

1. Abre las **DevTools** (F12)
2. Ve a la pestaña **Console**
3. Busca mensajes de error o advertencias

### 5. Verificar Variables de Entorno

En la consola del navegador, ejecuta:

```javascript
console.log('URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY)
```

## 🔍 Solución de Problemas Comunes

### Problema: "Cannot read properties of undefined"
- **Causa**: Variables de entorno no cargadas
- **Solución**: Reiniciar servidor después de crear `.env`

### Problema: "Network Error"
- **Causa**: URL de Supabase incorrecta
- **Solución**: Verificar que la URL termine en `.supabase.co`

### Problema: "Invalid API key"
- **Causa**: Clave anónima incorrecta
- **Solución**: Copiar la clave "anon public" (no la "service_role")

## 📁 Estructura de Archivos Correcta

```
gestion-turnos/
├── .env                    ← AQUÍ debe estar
├── package.json
├── src/
│   ├── lib/
│   │   └── supabase.ts
│   ├── contexts/
│   │   └── AuthContext.tsx
│   └── components/
│       └── AuthForm.tsx
└── ...
```

## 🧪 Prueba de Funcionamiento

1. Crea el archivo `.env` con tus credenciales
2. Reinicia el servidor: `npm run dev`
3. Ve a `http://localhost:8080` ⚠️ **PUERTO 8080**
4. Deberías ver el componente `TestAuth` funcionando

## 📞 Si Sigue Sin Funcionar

1. Verifica que no haya errores en la consola del navegador
2. Asegúrate de que el archivo `.env` esté en la raíz del proyecto
3. Verifica que las credenciales de Supabase sean correctas
4. Intenta crear un proyecto nuevo en Supabase

## 🔐 Configuración de Supabase

Una vez que funcione, ejecuta este SQL en Supabase:

```sql
-- Habilitar autenticación por email
UPDATE auth.config 
SET enable_signup = true, 
    enable_confirmations = false;

-- Configurar URLs de redirección para puerto 8080
UPDATE auth.config 
SET site_url = 'http://localhost:8080',
    redirect_urls = ARRAY['http://localhost:8080/**'];
```

## 🌐 URLs Importantes

- **Tu aplicación**: `http://localhost:8080`
- **Login**: `http://localhost:8080/login`
- **Supabase debe redirigir a**: `http://localhost:8080/**`

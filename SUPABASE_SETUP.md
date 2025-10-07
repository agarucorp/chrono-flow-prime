# Configuración de Supabase para TurnoPro

## Paso 1: Crear proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com) y crea una cuenta o inicia sesión
2. Crea un nuevo proyecto
3. Guarda la contraseña de la base de datos (la necesitarás más adelante)

## Paso 2: Obtener las credenciales

1. En tu proyecto de Supabase, ve a **Settings** (Configuración)
2. Selecciona **API** en el menú lateral
3. Copia las siguientes credenciales:
   - **Project URL** (URL del proyecto)
   - **anon/public key** (Clave anónima/pública)

## Paso 3: Configurar variables de entorno

1. En la raíz del proyecto `chrono-flow-prime`, crea un archivo llamado `.env`
2. Agrega el siguiente contenido:

```env
VITE_SUPABASE_URL=tu_project_url_aqui
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

3. Reemplaza los valores con tus credenciales de Supabase

**Ejemplo:**
```env
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Paso 4: Configurar autenticación en Supabase

1. En tu proyecto de Supabase, ve a **Authentication** > **Providers**
2. Asegúrate de que **Email** esté habilitado
3. Configura las opciones:
   - **Enable email confirmations**: Puedes desactivarlo para desarrollo (no recomendado para producción)
   - **Confirm email**: Activado para mayor seguridad

## Paso 5: Probar la aplicación

1. Reinicia el servidor de desarrollo:
```bash
npm run dev
```

2. Abre la aplicación en tu navegador
3. Intenta crear una cuenta nueva
4. Si tienes confirmación de email activada, revisa tu correo
5. Inicia sesión con tus credenciales

## Estructura de datos de usuario

Los datos adicionales del registro se guardan en `user_metadata`:
- `first_name`: Nombre
- `last_name`: Apellido
- `phone`: Teléfono
- `gender`: Género
- `birth_date`: Fecha de nacimiento

## Próximos pasos

Ahora que la autenticación está configurada, puedes:
1. Crear tablas en Supabase para almacenar turnos/citas
2. Implementar políticas de seguridad (Row Level Security)
3. Agregar funcionalidades de gestión de datos
4. Integrar MCP si es necesario

## Troubleshooting

### Error: "Faltan las variables de entorno de Supabase"
- Verifica que el archivo `.env` esté en la raíz del proyecto
- Asegúrate de que las variables empiecen con `VITE_`
- Reinicia el servidor de desarrollo después de crear el archivo

### Error de CORS
- Verifica que la URL de Supabase sea correcta
- Asegúrate de estar usando el protocolo HTTPS

### Los usuarios no se registran
- Verifica la configuración de Authentication en Supabase
- Revisa la consola del navegador para ver errores específicos


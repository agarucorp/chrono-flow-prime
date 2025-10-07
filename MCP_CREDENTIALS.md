# Credenciales necesarias para MCP con Supabase

## ¿Qué credenciales necesitas?

Para configurar MCP con Supabase, necesitas **3 credenciales** principales:

---

## 1. SUPABASE_URL (URL del Proyecto)

### ¿Dónde obtenerla?
1. Ve a [app.supabase.com](https://app.supabase.com)
2. Selecciona tu proyecto
3. **Settings** → **API** → **Project URL**

### Formato:
```
https://abcdefghijklmnop.supabase.co
```

### Ejemplo:
```
SUPABASE_URL=https://xyzabc123def.supabase.co
```

---

## 2. SUPABASE_SERVICE_ROLE_KEY (Clave de Servicio)

### ⚠️ IMPORTANTE
- **NO uses** la `anon` key
- **USA** la `service_role` key
- Esta clave tiene **acceso completo** a tu base de datos
- **Solo para desarrollo local**, nunca en frontend o producción

### ¿Dónde obtenerla?
1. Ve a [app.supabase.com](https://app.supabase.com)
2. Selecciona tu proyecto
3. **Settings** → **API** → **Project API keys**
4. Copia la clave llamada `service_role` (normalmente está oculta, haz clic en "Reveal")

### Formato:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZiIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2OTg4NTM0MDAsImV4cCI6MjAxNDQyOTQwMH0.ejemplo
```
(Comienza con `eyJ` y es muy largo)

### Ejemplo:
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 3. SUPABASE_DB_URL (URL de la Base de Datos)

### ¿Dónde obtenerla?
1. Ve a [app.supabase.com](https://app.supabase.com)
2. Selecciona tu proyecto
3. **Settings** → **Database** → **Connection string** → **URI**
4. Reemplaza `[YOUR-PASSWORD]` con la contraseña de tu base de datos

### Formato:
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Ejemplo:
```
SUPABASE_DB_URL=postgresql://postgres.xyzabc123def:MiPasswordSeguro123@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

---

## ¿Dónde usar estas credenciales?

### Opción A: En la configuración de Cursor

Archivo de configuración de MCP en Cursor (`cursor-mcp-config.json`):

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase-community/mcp-server-supabase"],
      "env": {
        "SUPABASE_URL": "tu-url-aqui",
        "SUPABASE_SERVICE_ROLE_KEY": "tu-service-role-key-aqui",
        "SUPABASE_DB_URL": "tu-db-url-aqui"
      }
    }
  }
}
```

### Opción B: En un archivo .env local (si usas servidor MCP custom)

```env
SUPABASE_URL=https://xyzabc123def.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_URL=postgresql://postgres.xyzabc123def:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

---

## 🔒 Consideraciones de Seguridad

### ✅ SÍ hacer:
- ✅ Usa estas credenciales **solo en desarrollo local**
- ✅ Agrega archivos de configuración con credenciales al `.gitignore`
- ✅ Revisa regularmente los logs de actividad en Supabase
- ✅ Usa contraseñas fuertes para tu base de datos

### ❌ NO hacer:
- ❌ **NUNCA** compartas la `service_role` key públicamente
- ❌ **NUNCA** uses la `service_role` key en el frontend
- ❌ **NUNCA** subas las credenciales a GitHub/repositorios públicos
- ❌ **NUNCA** uses estas credenciales en producción

---

## Verificar que las credenciales funcionan

### Test rápido en terminal:

```bash
# Test con curl
curl -X GET "TU_SUPABASE_URL/rest/v1/" \
  -H "apikey: TU_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer TU_SERVICE_ROLE_KEY"
```

Si las credenciales son correctas, recibirás una respuesta sin errores.

---

## Troubleshooting

### Error: "Invalid API key"
→ Verifica que estés usando la `service_role` key, no la `anon` key

### Error: "Failed to connect to database"
→ Verifica que la `SUPABASE_DB_URL` tenga la contraseña correcta

### Error: "Project not found"
→ Verifica que la `SUPABASE_URL` sea correcta y el proyecto exista

### Error: "Network error"
→ Verifica tu conexión a internet y que Supabase esté operativo

---

## Próximo paso

Una vez que tengas estas 3 credenciales:

1. Copia el archivo `cursor-mcp-config.example.json`
2. Reemplaza los valores de ejemplo con tus credenciales reales
3. Coloca el archivo en la ubicación de configuración de Cursor MCP
4. Reinicia Cursor
5. ¡Listo! Ahora puedes usar MCP con Supabase

Ver `MCP_SUPABASE_SETUP.md` para instrucciones detalladas de configuración.


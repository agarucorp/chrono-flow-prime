# MCP + Supabase - Referencia Rápida

## ⚡ Comandos rápidos

```bash
# Instalar servidor MCP globalmente
npm run mcp:install

# Verificar configuración
npm run verify:mcp

# Inicio rápido (Windows)
scripts\mcp-quickstart.bat

# Inicio rápido (Mac/Linux)
bash scripts/mcp-quickstart.sh
```

---

## 📋 Checklist de configuración

- [ ] Proyecto de Supabase creado
- [ ] Credenciales obtenidas (URL, Service Role Key, DB URL)
- [ ] Servidor MCP instalado (`npm run mcp:install`)
- [ ] Archivo `cursor-mcp-config.json` creado y configurado
- [ ] Configuración copiada a Cursor MCP settings
- [ ] Cursor reiniciado
- [ ] Configuración verificada (`npm run verify:mcp`)

---

## 🔑 Credenciales necesarias

### 1. SUPABASE_URL
**Ubicación:** Settings > API > Project URL  
**Formato:** `https://abcdefgh.supabase.co`

### 2. SUPABASE_SERVICE_ROLE_KEY
**Ubicación:** Settings > API > service_role (clic en Reveal)  
**Formato:** `eyJhbGc...` (muy largo)  
⚠️ **NO uses** la `anon` key

### 3. SUPABASE_DB_URL
**Ubicación:** Settings > Database > Connection string > URI  
**Formato:** `postgresql://postgres.[ref]:[password]@...`  
⚠️ Reemplaza `[YOUR-PASSWORD]` con tu contraseña real

---

## 📂 Ubicación de configuración en Cursor

### Windows
```
%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
```

### Mac
```
~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

### Linux
```
~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

---

## 🎯 Ejemplo de uso con Claude

Una vez configurado MCP, puedes pedirle a Claude:

```
"Muestra las tablas de mi base de datos Supabase"

"Crea una tabla llamada 'appointments' con campos:
- id (uuid, primary key)
- user_id (uuid, referencia a auth.users)
- date (timestamp)
- status (text)

También agrega políticas RLS para que los usuarios solo vean sus propias citas"

"Consulta los últimos 10 usuarios registrados"

"Crea una función de base de datos para calcular estadísticas de citas"
```

---

## 🔒 Seguridad

### ✅ SÍ hacer:
- Usar solo en desarrollo local
- Mantener credenciales en archivos ignorados por git
- Usar contraseñas fuertes
- Revisar logs de Supabase regularmente

### ❌ NO hacer:
- **NUNCA** subir credenciales a repositorios públicos
- **NUNCA** usar `service_role` key en producción
- **NUNCA** compartir las credenciales
- **NUNCA** exponer credenciales en el frontend

---

## 🛠️ Troubleshooting rápido

### Error: "Invalid API key"
→ Estás usando `anon` key en vez de `service_role` key

### Error: "Failed to connect"
→ Verifica la `DB_URL` y la contraseña

### Error: "Project not found"
→ Verifica que la `SUPABASE_URL` sea correcta

### MCP no aparece en Cursor
→ Reinicia Cursor y verifica la ruta del archivo de configuración

---

## 📚 Documentación completa

- [MCP_SUPABASE_SETUP.md](./MCP_SUPABASE_SETUP.md) - Guía completa de configuración
- [MCP_CREDENTIALS.md](./MCP_CREDENTIALS.md) - Detalles sobre credenciales
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Configuración de Supabase

---

## 💡 Consejos

1. **Primero configura Supabase Auth** (`.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`)
2. **Luego configura MCP** para desarrollo avanzado con Claude
3. **Verifica cada paso** con `npm run verify:mcp`
4. **Revisa los logs** en Cursor si algo no funciona (Help > Toggle Developer Tools)

---

## ⚡ Flujo de trabajo recomendado

```
1. Crea proyecto en Supabase
   ↓
2. Obtén credenciales
   ↓
3. Ejecuta script de quickstart
   ↓
4. Edita cursor-mcp-config.json
   ↓
5. Copia configuración a Cursor
   ↓
6. Reinicia Cursor
   ↓
7. Verifica con npm run verify:mcp
   ↓
8. ¡Usa Claude para gestionar tu DB!
```

---

## 🎉 Beneficios de usar MCP

- ✅ Claude puede crear tablas automáticamente
- ✅ Genera políticas RLS por ti
- ✅ Ejecuta consultas complejas en lenguaje natural
- ✅ Ayuda con migraciones de base de datos
- ✅ Depura problemas de datos
- ✅ Acelera el desarrollo

---

**¿Necesitas ayuda?** Consulta la documentación completa o ejecuta `npm run verify:mcp` para diagnósticos.





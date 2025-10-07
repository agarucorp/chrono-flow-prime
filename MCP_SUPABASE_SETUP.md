# Configuración de MCP (Model Context Protocol) con Supabase

## ¿Qué es MCP?

MCP (Model Context Protocol) es un protocolo de Anthropic que permite que los asistentes de IA (como Claude en Cursor) interactúen directamente con servicios externos como Supabase. Esto permite:

- Consultar y modificar datos en tu base de datos durante el desarrollo
- Crear tablas, políticas de seguridad (RLS), y funciones
- Gestionar tu proyecto de Supabase con comandos en lenguaje natural

## Prerequisitos

1. ✅ Proyecto de Supabase creado
2. ✅ Credenciales de Supabase (URL y claves)
3. ✅ Node.js instalado (v18+)
4. ✅ Cursor IDE instalado

---

## Opción 1: Configuración para Cursor (Recomendado para desarrollo)

### Paso 1: Instalar el servidor MCP de Supabase globalmente

```bash
npm install -g @supabase-community/mcp-server-supabase
```

O usando npx (sin instalación global):
```bash
npx @supabase-community/mcp-server-supabase
```

### Paso 2: Obtener credenciales de Supabase

1. Ve a tu proyecto en [Supabase](https://app.supabase.com)
2. Settings > API
3. Necesitarás:
   - **Project URL** (ej: `https://abcdefgh.supabase.co`)
   - **Service Role Key** (⚠️ IMPORTANTE: usa la service_role key, NO la anon key)
   - **Database URL** (Settings > Database > Connection string > URI)

### Paso 3: Configurar MCP en Cursor

1. En Cursor, abre la configuración de MCP:
   - Windows/Linux: `Ctrl+Shift+P` → "MCP: Edit Configuration"
   - Mac: `Cmd+Shift+P` → "MCP: Edit Configuration"

2. O edita manualmente el archivo de configuración:
   - Windows: `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
   - Mac: `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
   - Linux: `~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

3. Agrega la configuración del servidor MCP de Supabase:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase-community/mcp-server-supabase"
      ],
      "env": {
        "SUPABASE_URL": "https://tu-proyecto.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "tu_service_role_key_aqui",
        "SUPABASE_DB_URL": "postgresql://postgres:[password]@db.tu-proyecto.supabase.co:5432/postgres"
      }
    }
  }
}
```

### Paso 4: Reiniciar Cursor

Cierra y vuelve a abrir Cursor para que los cambios surtan efecto.

### Paso 5: Verificar la conexión

Una vez configurado, puedes pedirle a Claude/Cursor que:
- "Muestra las tablas de mi base de datos Supabase"
- "Crea una tabla de usuarios en Supabase"
- "Consulta los datos de la tabla X"

---

## Opción 2: Configuración Local del Servidor MCP (Para desarrollo avanzado)

### Paso 1: Crear proyecto para servidor MCP

```bash
mkdir mcp-supabase-server
cd mcp-supabase-server
npm init -y
npm install @modelcontextprotocol/sdk @supabase/supabase-js dotenv
```

### Paso 2: Crear archivo de configuración

Crea `.env`:
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
SUPABASE_DB_URL=postgresql://postgres:[password]@db.tu-proyecto.supabase.co:5432/postgres
```

### Paso 3: Crear servidor MCP personalizado

Crea `server.js`:

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const server = new Server(
  {
    name: 'supabase-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Definir herramientas disponibles
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'query_database',
        description: 'Ejecuta una consulta SQL en Supabase',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Consulta SQL a ejecutar',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_tables',
        description: 'Lista todas las tablas en la base de datos',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Implementar herramientas
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'query_database') {
    const { data, error } = await supabase.rpc('exec_sql', { sql: args.query });
    if (error) throw error;
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }

  if (name === 'list_tables') {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    if (error) throw error;
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }

  throw new Error(`Herramienta desconocida: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Servidor MCP de Supabase iniciado');
}

main().catch(console.error);
```

### Paso 4: Configurar en Cursor

Edita la configuración de MCP en Cursor apuntando a tu servidor local:

```json
{
  "mcpServers": {
    "supabase-local": {
      "command": "node",
      "args": ["C:/ruta/completa/a/mcp-supabase-server/server.js"],
      "env": {}
    }
  }
}
```

---

## ⚠️ Consideraciones de Seguridad

**IMPORTANTE:** El servidor MCP tiene acceso completo a tu base de datos.

1. **Nunca compartas tu Service Role Key** en repositorios públicos
2. **Usa variables de entorno** para credenciales
3. **Solo en desarrollo:** MCP es para desarrollo local, no para producción
4. **Limita permisos:** Considera crear un usuario de base de datos con permisos limitados
5. **Monitorea el uso:** Revisa regularmente los logs de Supabase

---

## Herramientas disponibles (con servidor MCP oficial)

Una vez configurado, Claude puede:

1. **Listar tablas:** "Muéstrame todas las tablas"
2. **Consultar datos:** "Obtén los últimos 10 usuarios registrados"
3. **Crear tablas:** "Crea una tabla de productos con nombre, precio y stock"
4. **Modificar datos:** "Actualiza el email del usuario con id 123"
5. **Crear políticas RLS:** "Crea una política de seguridad para la tabla usuarios"
6. **Ejecutar migraciones:** "Aplica esta migración SQL"

---

## Troubleshooting

### El servidor MCP no se conecta
- Verifica que las credenciales en `.env` o en la config de Cursor sean correctas
- Asegúrate de usar la **Service Role Key**, no la anon key
- Reinicia Cursor después de cambiar la configuración

### Error de permisos
- Verifica que estés usando la Service Role Key (tiene permisos administrativos)
- Comprueba que tu IP esté en la lista blanca de Supabase (si tienes restricciones)

### Claude no puede ejecutar comandos
- Asegúrate de que el servidor MCP esté en la lista de servidores permitidos
- Verifica que Cursor esté actualizado a la última versión
- Revisa los logs de Cursor: Help > Toggle Developer Tools > Console

---

## Próximos pasos

Una vez configurado MCP, puedes:

1. Pedirle a Claude que cree las tablas necesarias para tu aplicación
2. Generar políticas de seguridad (RLS) automáticamente
3. Poblar datos de prueba
4. Crear funciones y triggers de base de datos
5. Realizar consultas complejas sin escribir SQL manualmente

## Ejemplo de uso

Después de configurar MCP, puedes decirle a Claude:

```
"Crea una tabla 'appointments' con los siguientes campos:
- id (uuid, primary key)
- user_id (uuid, foreign key a auth.users)
- professional_id (uuid)
- date (timestamp)
- status (enum: pending, confirmed, cancelled)
- notes (text)

También crea las políticas RLS necesarias para que los usuarios 
solo puedan ver sus propias citas."
```

Y Claude creará automáticamente la tabla y las políticas en tu base de datos Supabase.


#!/usr/bin/env node

/**
 * Servidor MCP personalizado para Supabase
 * Permite que Cursor/Claude interactúe con tu base de datos Supabase
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';

// Obtener credenciales de variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseDbUrl = process.env.SUPABASE_DB_URL;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
  process.exit(1);
}

// Crear cliente de Supabase con permisos de servicio
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Crear servidor MCP
const server = new Server(
  {
    name: 'supabase-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Listar herramientas disponibles
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'list_tables',
        description: 'Lista todas las tablas en la base de datos Supabase',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'query_table',
        description: 'Consulta datos de una tabla específica. Puedes especificar filtros, ordenamiento y límite.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Nombre de la tabla a consultar',
            },
            select: {
              type: 'string',
              description: 'Columnas a seleccionar (ej: "*" o "id, name, email")',
              default: '*',
            },
            filter: {
              type: 'string',
              description: 'Filtro SQL WHERE (ej: "id.eq.123" o "created_at.gte.2024-01-01")',
            },
            order: {
              type: 'string',
              description: 'Ordenamiento (ej: "created_at.desc" o "name.asc")',
            },
            limit: {
              type: 'number',
              description: 'Número máximo de registros a retornar',
              default: 100,
            },
          },
          required: ['table'],
        },
      },
      {
        name: 'insert_record',
        description: 'Inserta un nuevo registro en una tabla',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Nombre de la tabla',
            },
            data: {
              type: 'object',
              description: 'Datos a insertar (objeto JSON)',
            },
          },
          required: ['table', 'data'],
        },
      },
      {
        name: 'update_record',
        description: 'Actualiza registros en una tabla',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Nombre de la tabla',
            },
            filter: {
              type: 'string',
              description: 'Filtro para identificar el registro (ej: "id.eq.123")',
            },
            data: {
              type: 'object',
              description: 'Datos a actualizar (objeto JSON)',
            },
          },
          required: ['table', 'filter', 'data'],
        },
      },
      {
        name: 'delete_record',
        description: 'Elimina registros de una tabla',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Nombre de la tabla',
            },
            filter: {
              type: 'string',
              description: 'Filtro para identificar el registro a eliminar (ej: "id.eq.123")',
            },
          },
          required: ['table', 'filter'],
        },
      },
      {
        name: 'execute_sql',
        description: 'Ejecuta una consulta SQL directa en la base de datos (solo SELECT para seguridad)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Consulta SQL a ejecutar (solo SELECT permitido)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_table_schema',
        description: 'Obtiene el esquema (columnas y tipos) de una tabla',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Nombre de la tabla',
            },
          },
          required: ['table'],
        },
      },
    ],
  };
});

// Implementar herramientas
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_tables': {
        // Consultar información de esquema para obtener tablas
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
          `,
        });

        if (error) {
          // Si la función RPC no existe, intentar método alternativo
          const { data: tables, error: tablesError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_type', 'BASE TABLE');

          if (tablesError) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error al listar tablas: ${tablesError.message}\n\nNota: Puede que necesites crear una función RPC en Supabase para listar tablas.`,
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  tables?.map((t) => t.table_name) || [],
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'query_table': {
        const { table, select = '*', filter, order, limit = 100 } = args;

        let query = supabase.from(table).select(select);

        // Aplicar filtros si existen
        if (filter) {
          // Parsear filtros simples (ej: "id.eq.123" o "name.ilike.%test%")
          const filterParts = filter.split('.');
          if (filterParts.length >= 3) {
            const column = filterParts[0];
            const operator = filterParts[1];
            const value = filterParts.slice(2).join('.');

            switch (operator) {
              case 'eq':
                query = query.eq(column, value);
                break;
              case 'neq':
                query = query.neq(column, value);
                break;
              case 'gt':
                query = query.gt(column, value);
                break;
              case 'gte':
                query = query.gte(column, value);
                break;
              case 'lt':
                query = query.lt(column, value);
                break;
              case 'lte':
                query = query.lte(column, value);
                break;
              case 'like':
                query = query.like(column, value);
                break;
              case 'ilike':
                query = query.ilike(column, value);
                break;
              case 'is':
                query = query.is(column, value === 'null' ? null : value);
                break;
              default:
                query = query.eq(column, value);
            }
          }
        }

        // Aplicar ordenamiento
        if (order) {
          const orderParts = order.split('.');
          if (orderParts.length === 2) {
            const column = orderParts[0];
            const direction = orderParts[1];
            query = query.order(column, { ascending: direction === 'asc' });
          }
        }

        // Aplicar límite
        query = query.limit(limit);

        const { data, error } = await query;

        if (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error al consultar tabla ${table}: ${error.message}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'insert_record': {
        const { table, data } = args;
        const { data: result, error } = await supabase.from(table).insert(data).select();

        if (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error al insertar en ${table}: ${error.message}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Registro insertado exitosamente:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case 'update_record': {
        const { table, filter, data } = args;
        let query = supabase.from(table).update(data);

        // Aplicar filtro
        if (filter) {
          const filterParts = filter.split('.');
          if (filterParts.length >= 3) {
            const column = filterParts[0];
            const operator = filterParts[1];
            const value = filterParts.slice(2).join('.');

            if (operator === 'eq') {
              query = query.eq(column, value);
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Operador de filtro no soportado: ${operator}. Solo se soporta 'eq' para actualizaciones.`,
                  },
                ],
                isError: true,
              };
            }
          }
        }

        const { data: result, error } = await query.select();

        if (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error al actualizar ${table}: ${error.message}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Registro(s) actualizado(s) exitosamente:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case 'delete_record': {
        const { table, filter } = args;
        let query = supabase.from(table).delete();

        // Aplicar filtro
        if (filter) {
          const filterParts = filter.split('.');
          if (filterParts.length >= 3) {
            const column = filterParts[0];
            const operator = filterParts[1];
            const value = filterParts.slice(2).join('.');

            if (operator === 'eq') {
              query = query.eq(column, value);
            } else {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Operador de filtro no soportado: ${operator}. Solo se soporta 'eq' para eliminaciones.`,
                  },
                ],
                isError: true,
              };
            }
          }
        }

        const { data: result, error } = await query.select();

        if (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error al eliminar de ${table}: ${error.message}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Registro(s) eliminado(s) exitosamente:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case 'execute_sql': {
        const { query } = args;

        // Validar que solo sea SELECT para seguridad
        const trimmedQuery = query.trim().toUpperCase();
        if (!trimmedQuery.startsWith('SELECT')) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Solo se permiten consultas SELECT por seguridad. Para otras operaciones, usa las herramientas específicas (insert_record, update_record, etc.)',
              },
            ],
            isError: true,
          };
        }

        // Intentar ejecutar usando RPC si está disponible
        const { data, error } = await supabase.rpc('exec_sql', { sql: query });

        if (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error al ejecutar SQL: ${error.message}\n\nNota: Puede que necesites crear una función RPC 'exec_sql' en Supabase para ejecutar SQL directo.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'get_table_schema': {
        const { table } = args;

        // Consultar información de columnas
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT 
              column_name,
              data_type,
              is_nullable,
              column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = '${table}'
            ORDER BY ordinal_position;
          `,
        });

        if (error) {
          // Método alternativo usando PostgREST
          return {
            content: [
              {
                type: 'text',
                text: `Error al obtener esquema: ${error.message}\n\nNota: Puede que necesites crear una función RPC en Supabase para consultar el esquema.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Servidor MCP de Supabase iniciado');
}

main().catch((error) => {
  console.error('Error al iniciar servidor MCP:', error);
  process.exit(1);
});

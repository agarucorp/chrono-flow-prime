#!/usr/bin/env node

/**
 * Script para verificar la configuración de MCP con Supabase
 * 
 * Uso: node scripts/verify-mcp-config.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

console.log('🔍 Verificando configuración de MCP con Supabase...\n');

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const success = (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`);
const error = (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`);
const warn = (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
const info = (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`);

let errors = 0;
let warnings = 0;

// 1. Verificar que exista archivo .env
console.log(`${colors.bold}1. Verificando archivo .env${colors.reset}`);
const envPath = path.resolve(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  error('Archivo .env no encontrado');
  warn('Crea un archivo .env con tus credenciales de Supabase');
  errors++;
} else {
  success('Archivo .env encontrado');
  
  // Leer variables de entorno
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const hasUrl = envContent.includes('VITE_SUPABASE_URL=');
  const hasKey = envContent.includes('VITE_SUPABASE_ANON_KEY=');
  
  if (!hasUrl || !hasKey) {
    error('Faltan variables de entorno en .env');
    if (!hasUrl) error('  - VITE_SUPABASE_URL no configurada');
    if (!hasKey) error('  - VITE_SUPABASE_ANON_KEY no configurada');
    errors++;
  } else {
    success('Variables de entorno configuradas');
  }
}

console.log();

// 2. Verificar configuración MCP
console.log(`${colors.bold}2. Verificando configuración de Cursor MCP${colors.reset}`);

const possiblePaths = {
  win32: path.join(process.env.APPDATA || '', 'Cursor', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
  darwin: path.join(process.env.HOME || '', 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
  linux: path.join(process.env.HOME || '', '.config', 'Cursor', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
};

const platform = process.platform;
const mcpConfigPath = possiblePaths[platform];

if (mcpConfigPath && fs.existsSync(mcpConfigPath)) {
  success('Configuración de MCP encontrada en Cursor');
  
  try {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
    
    if (mcpConfig.mcpServers && mcpConfig.mcpServers.supabase) {
      success('Servidor MCP de Supabase configurado');
      
      const env = mcpConfig.mcpServers.supabase.env || {};
      
      if (!env.SUPABASE_URL || env.SUPABASE_URL.includes('tu-proyecto')) {
        warn('SUPABASE_URL no está configurada correctamente en MCP');
        warnings++;
      } else {
        success('SUPABASE_URL configurada en MCP');
      }
      
      if (!env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY.includes('tu_service')) {
        warn('SUPABASE_SERVICE_ROLE_KEY no está configurada en MCP');
        warnings++;
      } else {
        success('SUPABASE_SERVICE_ROLE_KEY configurada en MCP');
      }
      
    } else {
      warn('Servidor MCP de Supabase no configurado');
      info('Agrega la configuración según MCP_SUPABASE_SETUP.md');
      warnings++;
    }
  } catch (err) {
    error(`Error al leer configuración de MCP: ${err.message}`);
    errors++;
  }
} else {
  warn('Configuración de MCP no encontrada');
  info('Puede que no hayas configurado MCP en Cursor todavía');
  info(`Ruta esperada: ${mcpConfigPath}`);
  warnings++;
}

console.log();

// 3. Verificar conexión a Supabase
console.log(`${colors.bold}3. Verificando conexión a Supabase${colors.reset}`);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  error('No se pueden verificar credenciales de Supabase');
  info('Asegúrate de configurar las variables de entorno');
  errors++;
} else {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Intentar hacer una consulta simple
    const { data, error: queryError } = await supabase.auth.getSession();
    
    if (queryError) {
      warn(`Advertencia al conectar: ${queryError.message}`);
      warnings++;
    } else {
      success('Conexión a Supabase exitosa');
    }
  } catch (err) {
    error(`Error al conectar a Supabase: ${err.message}`);
    errors++;
  }
}

console.log();

// 4. Verificar paquetes instalados
console.log(`${colors.bold}4. Verificando paquetes instalados${colors.reset}`);

const packageJsonPath = path.resolve(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps['@supabase/supabase-js']) {
    success(`@supabase/supabase-js v${deps['@supabase/supabase-js']} instalado`);
  } else {
    error('@supabase/supabase-js no está instalado');
    info('Ejecuta: npm install @supabase/supabase-js');
    errors++;
  }
}

console.log();

// Resumen
console.log(`${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.bold}Resumen de Verificación${colors.reset}`);
console.log(`${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

if (errors === 0 && warnings === 0) {
  console.log(`${colors.green}${colors.bold}✓ Todo está configurado correctamente!${colors.reset}`);
} else {
  if (errors > 0) {
    console.log(`${colors.red}${colors.bold}✗ ${errors} error(es) encontrado(s)${colors.reset}`);
  }
  if (warnings > 0) {
    console.log(`${colors.yellow}${colors.bold}⚠ ${warnings} advertencia(s)${colors.reset}`);
  }
  
  console.log();
  console.log(`${colors.cyan}📖 Consulta la documentación:${colors.reset}`);
  console.log('  - SUPABASE_SETUP.md (configuración de Supabase)');
  console.log('  - MCP_SUPABASE_SETUP.md (configuración de MCP)');
  console.log('  - MCP_CREDENTIALS.md (credenciales necesarias)');
}

console.log();

process.exit(errors > 0 ? 1 : 0);


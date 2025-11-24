#!/usr/bin/env node

/**
 * Script para ejecutar las queries de verificación de rate limit usando Supabase
 * Requiere: Service Role Key para acceder a auth.users
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bold}${msg}${colors.reset}\n`),
};

// Leer configuración de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bihqdptdkgdfztufrmlm.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Intentar leer desde archivo .env si existe
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const serviceKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
    if (serviceKeyMatch && !supabaseServiceKey) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKeyMatch[1].trim();
    }
  }
} catch (err) {
  // Ignorar errores al leer .env
}

const finalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseServiceKey;

if (!finalServiceKey) {
  log.error('SUPABASE_SERVICE_ROLE_KEY no está configurada');
  log.info('Configura la variable de entorno SUPABASE_SERVICE_ROLE_KEY');
  log.info('O obtén la Service Role Key desde: Supabase Dashboard > Settings > API > service_role key');
  log.info('');
  log.warn('Usando método alternativo con anon key (limitado)...');
}

// Crear cliente con Service Role Key si está disponible, sino con anon key
const keyToUse = finalServiceKey || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaHFkcHRka2dkZnp0dWZybWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MjQzODAsImV4cCI6MjA3MjUwMDM4MH0.MK6KTQmWLT60qNMoik4Em7KmeaOA3efoUb2rJtNoH7I';
const supabase = createClient(supabaseUrl, keyToUse, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function ejecutarQueries() {
  log.title('Verificando Rate Limit en Supabase');

  try {
    // Intentar usar Admin API directamente
    log.info('Usando Admin API de Supabase...');
    
    if (!finalServiceKey) {
      // Sin Service Role Key, no podemos acceder a auth.users directamente
      log.error('No se puede acceder a auth.users sin Service Role Key');
      log.info('');
      log.info('Para ejecutar estas queries necesitas:');
      log.info('1. Obtener la Service Role Key desde Supabase Dashboard');
      log.info('2. Configurarla como variable de entorno: SUPABASE_SERVICE_ROLE_KEY');
      log.info('');
      log.info('O ejecuta las queries manualmente en el SQL Editor de Supabase:');
      log.info('https://app.supabase.com/project/bihqdptdkgdfztufrmlm/editor');
      return;
    }

    // Si tenemos Service Role Key, usar Admin API
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      log.error(`Error al obtener usuarios: ${usersError.message}`);
      return;
    }

    if (!usersData || !usersData.users) {
      log.error('No se pudieron obtener los usuarios');
      return;
    }

    const users = usersData.users;
    const ahora = new Date();
    const unaHoraAtras = new Date(ahora.getTime() - 60 * 60 * 1000);
    
    // Query 1: Usuarios creados recientemente (última hora)
    log.info('1. Verificando usuarios creados en la última hora...');
    const usuariosUltimaHora = users.filter(user => {
      const createdAt = new Date(user.created_at);
      return createdAt > unaHoraAtras;
    });

    log.success(`Usuarios creados en la última hora: ${usuariosUltimaHora.length}`);
    
    if (usuariosUltimaHora.length > 0) {
      console.log('\nUsuarios recientes:');
      usuariosUltimaHora.forEach(user => {
        const minutosAtras = Math.round((ahora - new Date(user.created_at)) / 60000);
        console.log(`  - ${user.email} (hace ${minutosAtras} minutos)`);
        console.log(`    Confirmado: ${user.email_confirmed_at ? 'Sí' : 'No'}`);
      });
    }

    // Query 2: Contar registros
    log.info('\n2. Contando registros en la última hora...');
    log.success(`Total: ${usuariosUltimaHora.length} registros`);

    // Query 3: Usuarios sin confirmar
    log.info('\n3. Verificando usuarios sin confirmar (últimas 24 horas)...');
    const hace24Horas = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    const usuariosSinConfirmar = users.filter(user => {
      const createdAt = new Date(user.created_at);
      return !user.email_confirmed_at && createdAt > hace24Horas;
    });

    log.success(`Usuarios sin confirmar: ${usuariosSinConfirmar.length}`);
    
    if (usuariosSinConfirmar.length > 0) {
      const masAntiguo = usuariosSinConfirmar.reduce((oldest, user) => {
        return new Date(user.created_at) < new Date(oldest.created_at) ? user : oldest;
      });
      const horasAntiguo = Math.round((ahora - new Date(masAntiguo.created_at)) / (60 * 60 * 1000));
      log.info(`Usuario más antiguo sin confirmar: ${masAntiguo.email} (hace ${horasAntiguo} horas)`);
    }

    // Análisis
    log.title('\n📊 Análisis de Rate Limit');
    
    if (usuariosUltimaHora.length >= 3) {
      log.warn('⚠️  ALERTA: Has alcanzado o estás cerca del límite de rate limit');
      log.warn('   Supabase limita a 3-4 registros por hora desde la misma IP');
      log.info('   Recomendación: Espera antes de crear más usuarios');
    } else if (usuariosUltimaHora.length >= 2) {
      log.warn('⚠️  Advertencia: Has creado 2 usuarios en la última hora');
      log.info('   Puedes crear 1-2 más antes de alcanzar el límite');
    } else {
      log.success('✓ Estás dentro del límite de rate limit');
      log.info(`   Puedes crear ${3 - usuariosUltimaHora.length} usuarios más en esta hora`);
    }

    log.title('\n💡 Recomendaciones');
    log.info('1. Deshabilitar confirmación de email en Supabase Dashboard');
    log.info('   Authentication > Settings > Email Auth > Deshabilitar "Enable email confirmations"');
    log.info('');
    log.info('2. El sistema ya tiene un delay de 15 segundos entre registros');
    log.info('');
    log.info('3. Si necesitas más registros, considera actualizar el plan de Supabase');

  } catch (err) {
    log.error(`Error inesperado: ${err.message}`);
    console.error(err);
  }
}

// Ejecutar
ejecutarQueries().catch(err => {
  log.error(`Error fatal: ${err.message}`);
  process.exit(1);
});


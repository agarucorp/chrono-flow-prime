// Script para programar el envío de cobros mensuales
// Ejecutar: node scripts/programar-cobros-mensuales.js
// Requiere: SUPABASE_URL, CRON_SECRET (o SUPABASE_SERVICE_ROLE_KEY de admin JWT flow)

const cron = require('node-cron');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bihqdptdkgdfztufrmlm.supabase.co';
const CRON_SECRET = process.env.CRON_SECRET;

async function enviarCobrosMensuales() {
  if (!CRON_SECRET) {
    console.error('Falta CRON_SECRET en el entorno');
    return;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/enviar-cobros-mensuales`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'x-cron-secret': CRON_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();
    console.log('Cobros mensuales:', response.status, result);
  } catch (error) {
    console.error('Error enviando cobros mensuales:', error);
  }
}

// Día 25 a las 9:00 AR → Edge Function toma mes SIGUIENTE (día > 5)
cron.schedule('0 9 25 * *', () => {
  enviarCobrosMensuales();
}, {
  timezone: 'America/Argentina/Buenos_Aires',
});

console.log('Cron de cobros mensuales programado: día 25 09:00 America/Argentina/Buenos_Aires');

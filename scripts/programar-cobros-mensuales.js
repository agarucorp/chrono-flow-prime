// Script para programar el envío de cobros mensuales
// Ejecutar: node scripts/programar-cobros-mensuales.js

const cron = require('node-cron');

// Función para llamar a la Edge Function
async function enviarCobrosMensuales() {
  try {
    const response = await fetch('https://bihqdptdkgdfztufrmlm.supabase.co/functions/v1/enviar-cobros-mensuales', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
  } catch (error) {
    console.error('Error enviando cobros mensuales:', error);
  }
}

// Programar para ejecutar el día 25 de cada mes a las 9:00 AM
// Esto significa que se ejecutará 5-6 días antes del mes siguiente
cron.schedule('0 9 25 * *', () => {
  enviarCobrosMensuales();
}, {
  timezone: "America/Argentina/Buenos_Aires"
});

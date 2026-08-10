// Script de prueba para enviar cobros mensuales
// Ejecutar: node scripts/test-cobros-mensuales.js [anio] [mes]
// Requiere: CRON_SECRET (y opcional SUPABASE_URL)

async function testCobrosMensuales() {
  const args = process.argv.slice(2);
  const anio = args[0] ? parseInt(args[0]) : undefined;
  const mes = args[1] ? parseInt(args[1]) : undefined;
  const body = (anio && mes) ? { anio, mes } : {};
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.SUPABASE_URL || 'https://bihqdptdkgdfztufrmlm.supabase.co';

  if (!cronSecret) {
    console.error('Falta CRON_SECRET en el entorno');
    process.exit(1);
  }

  console.log('Enviando cobros mensuales...');
  if (anio && mes) {
    console.log(`   Periodo forzado: ${mes}/${anio}`);
  } else {
    console.log('   Periodo: automático (día 1-5 mes actual; resto mes siguiente, TZ AR)');
  }

  try {
    const response = await fetch(`${baseUrl}/functions/v1/enviar-cobros-mensuales`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'x-cron-secret': cronSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    console.log('Respuesta:', response.status, JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testCobrosMensuales();

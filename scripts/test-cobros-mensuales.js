// Script de prueba para enviar cobros mensuales
// Ejecutar: node scripts/test-cobros-mensuales.js [anio] [mes]
// Ejemplo:  node scripts/test-cobros-mensuales.js 2026 2   → envía para febrero 2026
// Sin args: usa la lógica automática (mes actual si estamos del 1-5, mes siguiente si no)

async function testCobrosMensuales() {
  const args = process.argv.slice(2);
  const anio = args[0] ? parseInt(args[0]) : undefined;
  const mes = args[1] ? parseInt(args[1]) : undefined;

  const body = (anio && mes) ? { anio, mes } : {};
  
  console.log('🚀 Enviando cobros mensuales...');
  if (anio && mes) {
    console.log(`   Periodo forzado: ${mes}/${anio}`);
  } else {
    console.log('   Periodo: automático (mes actual si día 1-5, mes siguiente si no)');
  }

  try {
    const response = await fetch('https://bihqdptdkgdfztufrmlm.supabase.co/functions/v1/enviar-cobros-mensuales', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    console.log('📬 Respuesta:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log(`✅ Enviados: ${result.enviados}`);
      if (result.errores && result.errores.length > 0) {
        console.log(`⚠️ Errores: ${result.errores.length}`);
        result.errores.forEach(e => console.log(`   - ${e.usuario_id}: ${e.error}`));
      }
    } else {
      console.error('❌ Error en el envío:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando prueba:', error);
  }
}

// Ejecutar la prueba
testCobrosMensuales();

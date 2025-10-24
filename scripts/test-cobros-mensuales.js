// Script de prueba para enviar cobros mensuales
// Ejecutar: node scripts/test-cobros-mensuales.js

async function testCobrosMensuales() {
  try {
    console.log('🧪 Iniciando prueba de cobros mensuales...');
    
    const response = await fetch('https://bihqdptdkgdfztufrmlm.supabase.co/functions/v1/enviar-cobros-mensuales', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Cobros enviados exitosamente');
      console.log(`📊 Total procesados: ${result.resultados.length}`);
      
      const exitosos = result.resultados.filter(r => r.status === 'success').length;
      const errores = result.resultados.filter(r => r.status === 'error').length;
      
      console.log(`✅ Exitosos: ${exitosos}`);
      console.log(`❌ Errores: ${errores}`);
      
      if (errores > 0) {
        console.log('Errores detallados:');
        result.resultados
          .filter(r => r.status === 'error')
          .forEach(error => {
            console.log(`  - ${error.email}: ${error.error}`);
          });
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

// Script de prueba para enviar cobros mensuales
// Ejecutar: node scripts/test-cobros-mensuales.js

async function testCobrosMensuales() {
  try {
    const response = await fetch('https://bihqdptdkgdfztufrmlm.supabase.co/functions/v1/enviar-cobros-mensuales', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      const exitosos = result.resultados.filter(r => r.status === 'success').length;
      const errores = result.resultados.filter(r => r.status === 'error').length;
      if (errores > 0) {
        result.resultados
          .filter(r => r.status === 'error')
          .forEach(error => {
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

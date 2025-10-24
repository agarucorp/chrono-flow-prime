-- ========================================
-- DATOS DE PRUEBA PARA AUSENCIAS DEL ADMIN
-- ========================================
-- IMPORTANTE: Estos datos son TEMPORALES y deben eliminarse después de la prueba
-- Ejecutar DATOS_PRUEBA_AUSENCIAS_CLEANUP.sql para limpiar

-- ========================================
-- 1. AUSENCIA ÚNICA (Bloquea clases 1, 2 y 3 el 25 de enero de 2025)
-- ========================================
INSERT INTO ausencias_admin (
  tipo_ausencia,
  fecha_inicio,
  fecha_fin,
  clases_canceladas,
  motivo,
  activo
) VALUES (
  'unica',
  '2025-01-25T12:00:00',
  NULL,
  ARRAY[1, 2, 3],
  '🧪 PRUEBA: Ausencia única - Bloquea clases 1, 2 y 3',
  true
);

-- ========================================
-- 2. AUSENCIA POR PERÍODO (Del 27 al 29 de enero de 2025)
-- ========================================
INSERT INTO ausencias_admin (
  tipo_ausencia,
  fecha_inicio,
  fecha_fin,
  clases_canceladas,
  motivo,
  activo
) VALUES (
  'periodo',
  '2025-01-27T00:00:00',
  '2025-01-29T23:59:59',
  NULL,
  '🧪 PRUEBA: Ausencia por período - Bloquea TODAS las clases',
  true
);

-- ========================================
-- 3. AUSENCIA ÚNICA SIN CLASES ESPECÍFICAS (Bloquea TODO el 30 de enero)
-- ========================================
INSERT INTO ausencias_admin (
  tipo_ausencia,
  fecha_inicio,
  fecha_fin,
  clases_canceladas,
  motivo,
  activo
) VALUES (
  'unica',
  '2025-01-30T12:00:00',
  NULL,
  NULL,
  '🧪 PRUEBA: Ausencia única sin clases específicas - Bloquea TODO el día',
  true
);

-- ========================================
-- VERIFICAR AUSENCIAS CREADAS
-- ========================================
SELECT 
  id,
  tipo_ausencia,
  fecha_inicio,
  fecha_fin,
  clases_canceladas,
  motivo,
  activo
FROM ausencias_admin
WHERE motivo LIKE '%🧪 PRUEBA%'
ORDER BY fecha_inicio;

-- ========================================
-- INSTRUCCIONES DE PRUEBA
-- ========================================

/*
PRUEBAS A REALIZAR:

1. PANEL ADMIN - Editar Ausencias:
   ✓ Verificar que las 3 ausencias aparecen en el listado
   ✓ Verificar que se pueden eliminar (no eliminales todavía)

2. PANEL USUARIO - Mis Clases:
   ✓ Verificar que las clases del 25/01/2025 (clases 1, 2, 3) aparecen con:
     - Fondo amarillo
     - Texto "CLASE BLOQUEADA" (8px, light en mobile)
     - No se pueden seleccionar
   
   ✓ Verificar que TODAS las clases del 27, 28 y 29/01/2025 aparecen bloqueadas
   
   ✓ Verificar que TODAS las clases del 30/01/2025 aparecen bloqueadas

3. PANEL USUARIO - Vacantes:
   ✓ Si hay turnos cancelados para las fechas bloqueadas, NO deben aparecer
   ✓ El contador de vacantes debe excluir los turnos bloqueados

4. PANEL ADMIN - Agenda:
   ✓ Los alumnos con clases en fechas bloqueadas deben aparecer con:
     - Borde amarillo
     - Fondo amarillo semi-transparente
     - Texto "(BLOQUEADA)"
     - NO se pueden seleccionar (cursor-not-allowed)

5. PANEL ADMIN - Historial de Balance:
   ✓ Las clases bloqueadas NO deben aparecer en el balance
   ✓ El total de ingresos debe excluir las clases bloqueadas
   ✓ Verificar en console.log el mensaje con el conteo de turnos filtrados

6. EVENTOS EN TIEMPO REAL:
   ✓ Al crear una nueva ausencia desde "Editar Ausencias":
     - El panel usuario debe recargar automáticamente
     - Las clases deben aparecer bloqueadas instantáneamente
   
   ✓ Al eliminar una ausencia:
     - Las clases deben desbloquearse automáticamente

DESPUÉS DE LAS PRUEBAS:
Ejecutar DATOS_PRUEBA_AUSENCIAS_CLEANUP.sql para eliminar los datos de prueba
*/


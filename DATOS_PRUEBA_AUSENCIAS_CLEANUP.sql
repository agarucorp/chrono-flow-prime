-- ========================================
-- LIMPIEZA DE DATOS DE PRUEBA - AUSENCIAS DEL ADMIN
-- ========================================
-- Ejecutar este script DESPUÉS de completar las pruebas
-- para eliminar todos los datos de prueba creados

-- ========================================
-- ELIMINAR AUSENCIAS DE PRUEBA
-- ========================================
DELETE FROM ausencias_admin
WHERE motivo LIKE '%🧪 PRUEBA%';

-- ========================================
-- VERIFICAR QUE SE ELIMINARON CORRECTAMENTE
-- ========================================
SELECT 
  COUNT(*) as ausencias_prueba_restantes
FROM ausencias_admin
WHERE motivo LIKE '%🧪 PRUEBA%';

-- Debería devolver 0

-- ========================================
-- VERIFICAR AUSENCIAS ACTIVAS RESTANTES
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
WHERE activo = true
ORDER BY fecha_inicio DESC;

-- Solo deben aparecer ausencias reales (sin el emoji 🧪)

-- ========================================
-- ✅ LIMPIEZA COMPLETADA
-- ========================================


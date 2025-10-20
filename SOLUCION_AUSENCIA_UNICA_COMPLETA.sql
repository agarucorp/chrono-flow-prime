-- =====================================================
-- SOLUCIÓN COMPLETA PARA AUSENCIA ÚNICA
-- =====================================================
-- Este script soluciona el problema de que las ausencias únicas
-- no bloquean las clases para los usuarios
--
-- PROBLEMA: El admin crea ausencia única, se guarda en BD, 
-- pero NO se bloquea para el usuario
--
-- CAUSA: Falta la vista vista_horarios_usuarios y/o
-- los horarios de usuarios no tienen clase_numero
-- =====================================================

-- =====================================================
-- PASO 1: Verificar y agregar columna clase_numero si no existe
-- =====================================================

DO $$
BEGIN
  -- Verificar si la columna clase_numero existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'horarios_recurrentes_usuario'
    AND column_name = 'clase_numero'
  ) THEN
    -- Agregar columna clase_numero
    ALTER TABLE horarios_recurrentes_usuario 
    ADD COLUMN clase_numero INTEGER;
    
    RAISE NOTICE '✅ Columna clase_numero agregada a horarios_recurrentes_usuario';
  ELSE
    RAISE NOTICE '✅ Columna clase_numero ya existe';
  END IF;
END $$;

-- =====================================================
-- PASO 2: Migrar datos - asignar clase_numero a horarios existentes
-- =====================================================

-- Solo migrar registros que no tienen clase_numero asignado
UPDATE horarios_recurrentes_usuario hru
SET clase_numero = hs.clase_numero
FROM horarios_semanales hs
WHERE hru.dia_semana = hs.dia_semana
  AND hru.hora_inicio = hs.hora_inicio
  AND hru.clase_numero IS NULL
  AND hs.activo = true;

-- Verificar cuántos registros se migraron
SELECT 
  '✅ Migración de clase_numero' as resultado,
  COUNT(*) as registros_con_clase_numero,
  (SELECT COUNT(*) FROM horarios_recurrentes_usuario WHERE activo = true) as total_registros
FROM horarios_recurrentes_usuario 
WHERE clase_numero IS NOT NULL AND activo = true;

-- =====================================================
-- PASO 3: Crear vista vista_horarios_usuarios
-- =====================================================

-- Eliminar vista si existe
DROP VIEW IF EXISTS vista_horarios_usuarios;

-- Crear vista que combina horarios de usuarios con horas actualizadas
CREATE OR REPLACE VIEW vista_horarios_usuarios AS
SELECT 
  hru.id,
  hru.usuario_id,
  hru.dia_semana,
  hru.clase_numero,
  COALESCE(hs.hora_inicio, hru.hora_inicio) as hora_inicio,
  COALESCE(hs.hora_fin, hru.hora_fin) as hora_fin,
  hru.activo,
  CONCAT('Clase ', hru.clase_numero) as nombre_clase,
  hs.capacidad,
  hru.combo_aplicado,
  hru.tarifa_personalizada,
  hru.created_at,
  hru.updated_at
FROM horarios_recurrentes_usuario hru
LEFT JOIN horarios_semanales hs 
  ON hs.dia_semana = hru.dia_semana 
  AND hs.clase_numero = hru.clase_numero
  AND hs.activo = true
WHERE hru.activo = true;

-- Dar permisos
GRANT SELECT ON vista_horarios_usuarios TO authenticated;
GRANT SELECT ON vista_horarios_usuarios TO anon;

-- Habilitar security invoker
ALTER VIEW vista_horarios_usuarios SET (security_invoker = true);

SELECT '✅ Vista vista_horarios_usuarios creada exitosamente' as resultado;

-- =====================================================
-- PASO 4: Crear índice para mejorar performance
-- =====================================================

-- Índice para búsquedas por clase_numero
CREATE INDEX IF NOT EXISTS idx_horarios_recurrentes_clase_numero 
ON horarios_recurrentes_usuario(clase_numero) 
WHERE activo = true;

-- Índice compuesto para búsquedas por día y clase
CREATE INDEX IF NOT EXISTS idx_horarios_recurrentes_dia_clase 
ON horarios_recurrentes_usuario(dia_semana, clase_numero) 
WHERE activo = true;

-- Índice para horarios_semanales
CREATE INDEX IF NOT EXISTS idx_horarios_semanales_dia_clase 
ON horarios_semanales(dia_semana, clase_numero) 
WHERE activo = true;

SELECT '✅ Índices creados exitosamente' as resultado;

-- =====================================================
-- PASO 5: Verificar que todo funciona correctamente
-- =====================================================

-- Verificar vista
SELECT 
  '✅ VERIFICACIÓN: Vista funcional' as resultado,
  COUNT(*) as total_registros
FROM vista_horarios_usuarios;

-- Verificar que los registros tienen clase_numero
SELECT 
  '✅ VERIFICACIÓN: Registros con clase_numero' as resultado,
  COUNT(*) as con_clase_numero,
  (SELECT COUNT(*) FROM horarios_recurrentes_usuario WHERE activo = true) as total
FROM horarios_recurrentes_usuario 
WHERE clase_numero IS NOT NULL AND activo = true;

-- Verificar ausencias activas
SELECT 
  '✅ VERIFICACIÓN: Ausencias activas' as resultado,
  COUNT(*) as ausencias_unicas_activas
FROM ausencias_admin 
WHERE activo = true AND tipo_ausencia = 'unica';

-- =====================================================
-- PASO 6: Mostrar ejemplo de cómo funciona el bloqueo
-- =====================================================

-- Ejemplo: mostrar qué clases están bloqueadas para una fecha
SELECT 
  '📋 EJEMPLO: Clases bloqueadas por fecha' as info,
  fecha_inicio::date as fecha,
  unnest(clases_canceladas) as clase_numero_bloqueada
FROM ausencias_admin
WHERE activo = true
  AND tipo_ausencia = 'unica'
ORDER BY fecha_inicio::date DESC, clase_numero_bloqueada
LIMIT 20;

-- =====================================================
-- RESUMEN FINAL
-- =====================================================

SELECT '=====================================' as linea;
SELECT '✅ SOLUCIÓN APLICADA EXITOSAMENTE' as resultado;
SELECT '=====================================' as linea;

SELECT 'VERIFICACIONES FINALES:' as titulo;

SELECT 
  '1. Vista vista_horarios_usuarios' as item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'vista_horarios_usuarios')
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado;

SELECT 
  '2. Columna clase_numero' as item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'horarios_recurrentes_usuario' AND column_name = 'clase_numero')
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado;

SELECT 
  '3. Datos migrados' as item,
  CASE 
    WHEN (SELECT COUNT(clase_numero) FROM horarios_recurrentes_usuario WHERE activo = true) > 0
    THEN '✅ HAY DATOS'
    ELSE '❌ SIN DATOS'
  END as estado;

SELECT 
  '4. Índices creados' as item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_horarios_recurrentes_clase_numero')
    THEN '✅ EXISTEN'
    ELSE '⚠️ NO EXISTEN'
  END as estado;

SELECT '=====================================' as linea;
SELECT 'PRÓXIMOS PASOS:' as titulo;
SELECT '1. Refrescar la página en el navegador' as paso;
SELECT '2. El usuario debería ver las clases bloqueadas' as paso;
SELECT '3. Verificar en consola del navegador los logs de depuración' as paso;
SELECT '=====================================' as linea;


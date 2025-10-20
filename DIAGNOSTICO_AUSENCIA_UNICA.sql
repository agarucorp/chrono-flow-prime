-- DIAGNÓSTICO COMPLETO DE AUSENCIA ÚNICA
-- Ejecutar este script paso a paso para diagnosticar el problema

-- =====================================================
-- PASO 1: Verificar que la tabla ausencias_admin existe y tiene datos
-- =====================================================
SELECT 
  'PASO 1: Verificar ausencias_admin' as paso,
  COUNT(*) as total_ausencias_activas
FROM ausencias_admin
WHERE activo = true;

-- Ver ausencias únicas específicamente
SELECT 
  'Ausencias únicas activas' as info,
  id,
  tipo_ausencia,
  fecha_inicio,
  clases_canceladas,
  array_length(clases_canceladas, 1) as cantidad_clases_canceladas,
  created_at
FROM ausencias_admin
WHERE activo = true 
  AND tipo_ausencia = 'unica'
ORDER BY fecha_inicio DESC;

-- =====================================================
-- PASO 2: Verificar que horarios_semanales tiene clase_numero
-- =====================================================
SELECT 
  'PASO 2: Verificar horarios_semanales' as paso,
  COUNT(*) as total_horarios
FROM horarios_semanales
WHERE activo = true;

SELECT 
  'Ejemplo de horarios_semanales' as info,
  dia_semana,
  clase_numero,
  hora_inicio,
  hora_fin,
  capacidad,
  activo
FROM horarios_semanales
WHERE activo = true
  AND dia_semana = 1  -- Lunes
ORDER BY clase_numero
LIMIT 10;

-- =====================================================
-- PASO 3: Verificar que horarios_recurrentes_usuario tiene clase_numero
-- =====================================================
SELECT 
  'PASO 3: Verificar horarios_recurrentes_usuario' as paso,
  COUNT(*) as total_horarios_usuarios
FROM horarios_recurrentes_usuario
WHERE activo = true;

-- Verificar si la columna clase_numero existe y tiene valores
SELECT 
  'Verificar clase_numero en horarios usuarios' as info,
  COUNT(*) as total_registros,
  COUNT(clase_numero) as registros_con_clase_numero,
  COUNT(*) - COUNT(clase_numero) as registros_sin_clase_numero
FROM horarios_recurrentes_usuario
WHERE activo = true;

-- Ver ejemplos de horarios de usuarios
SELECT 
  'Ejemplo de horarios de usuarios' as info,
  hru.id,
  hru.usuario_id,
  p.full_name,
  hru.dia_semana,
  hru.clase_numero,
  hru.hora_inicio,
  hru.hora_fin,
  hru.activo
FROM horarios_recurrentes_usuario hru
LEFT JOIN profiles p ON p.id = hru.usuario_id
WHERE hru.activo = true
ORDER BY hru.usuario_id, hru.dia_semana, hru.clase_numero
LIMIT 10;

-- =====================================================
-- PASO 4: Verificar si la vista vista_horarios_usuarios existe
-- =====================================================
SELECT 
  'PASO 4: Verificar vista' as paso,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name = 'vista_horarios_usuarios'
    ) THEN 'La vista EXISTE'
    ELSE 'La vista NO EXISTE - ESTE ES EL PROBLEMA'
  END as resultado;

-- Si la vista existe, mostrar algunos datos
SELECT 
  'Datos de la vista (si existe)' as info,
  *
FROM vista_horarios_usuarios
WHERE activo = true
LIMIT 5;

-- =====================================================
-- PASO 5: Simular la verificación de bloqueo de clase
-- =====================================================
-- Verificar para el 21/10/2025 (cambiar fecha según necesites)
WITH fecha_prueba AS (
  SELECT '2025-10-21'::date as fecha
),
ausencias_del_dia AS (
  SELECT 
    id,
    tipo_ausencia,
    fecha_inicio::date as fecha,
    clases_canceladas
  FROM ausencias_admin
  WHERE activo = true
    AND tipo_ausencia = 'unica'
    AND fecha_inicio::date = (SELECT fecha FROM fecha_prueba)
)
SELECT 
  'PASO 5: Verificar bloqueo para fecha específica' as paso,
  (SELECT fecha FROM fecha_prueba) as fecha_verificada,
  COUNT(*) as ausencias_encontradas,
  string_agg(clases_canceladas::text, ', ') as clases_canceladas
FROM ausencias_del_dia;

-- Ver qué clases deberían estar bloqueadas
SELECT 
  'Clases que deberían estar bloqueadas' as info,
  fecha_inicio::date as fecha,
  unnest(clases_canceladas) as clase_bloqueada
FROM ausencias_admin
WHERE activo = true
  AND tipo_ausencia = 'unica'
  AND fecha_inicio::date = '2025-10-21'
ORDER BY clase_bloqueada;

-- =====================================================
-- PASO 6: Verificar qué usuarios tienen clases ese día
-- =====================================================
-- Ver qué usuarios tienen clases los martes (21/10/2025 es martes = día 2)
SELECT 
  'PASO 6: Usuarios con clases los martes' as info,
  hru.usuario_id,
  p.full_name,
  p.email,
  hru.clase_numero,
  hru.hora_inicio,
  hru.hora_fin
FROM horarios_recurrentes_usuario hru
LEFT JOIN profiles p ON p.id = hru.usuario_id
WHERE hru.activo = true
  AND hru.dia_semana = 2  -- Martes
ORDER BY hru.clase_numero;

-- =====================================================
-- RESUMEN DE DIAGNÓSTICO
-- =====================================================
SELECT 
  '=====================' as separador,
  'RESUMEN DE DIAGNÓSTICO' as titulo,
  '=====================' as separador2;

SELECT 
  'Vista vista_horarios_usuarios' as verificacion,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name = 'vista_horarios_usuarios'
    ) THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE - CREAR CON CREAR_VISTA_HORARIOS_USUARIOS.sql'
  END as estado;

SELECT 
  'Columna clase_numero en horarios_recurrentes_usuario' as verificacion,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'horarios_recurrentes_usuario'
      AND column_name = 'clase_numero'
    ) THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE - EJECUTAR MIGRACIÓN'
  END as estado;

SELECT 
  'Datos en clase_numero' as verificacion,
  CASE 
    WHEN (SELECT COUNT(clase_numero) FROM horarios_recurrentes_usuario WHERE activo = true) > 0 
    THEN '✅ HAY DATOS'
    ELSE '❌ SIN DATOS - EJECUTAR MIGRACIÓN DE DATOS'
  END as estado;

SELECT 
  'Ausencias únicas activas' as verificacion,
  CASE 
    WHEN (SELECT COUNT(*) FROM ausencias_admin WHERE activo = true AND tipo_ausencia = 'unica') > 0
    THEN '✅ HAY AUSENCIAS'
    ELSE '⚠️ NO HAY AUSENCIAS'
  END as estado;


-- VERIFICAR AUSENCIAS ADMINISTRATIVAS
-- Este script verifica el estado de las ausencias creadas por el admin

-- 1. Ver todas las ausencias activas
SELECT 
  id,
  tipo_ausencia,
  fecha_inicio,
  fecha_fin,
  clases_canceladas,
  motivo,
  activo,
  created_at
FROM ausencias_admin
WHERE activo = true
ORDER BY fecha_inicio DESC;

-- 2. Ver ausencias únicas específicamente
SELECT 
  id,
  fecha_inicio::date as fecha,
  clases_canceladas,
  array_length(clases_canceladas, 1) as cantidad_clases,
  motivo,
  created_at
FROM ausencias_admin
WHERE activo = true 
  AND tipo_ausencia = 'unica'
ORDER BY fecha_inicio DESC;

-- 3. Ver ausencias por período específicamente
SELECT 
  id,
  fecha_inicio::date as fecha_desde,
  fecha_fin::date as fecha_hasta,
  motivo,
  created_at
FROM ausencias_admin
WHERE activo = true 
  AND tipo_ausencia = 'periodo'
ORDER BY fecha_inicio DESC;

-- 4. Verificar si hay ausencias para una fecha específica (cambiar la fecha según necesites)
-- Ejemplo: verificar el 21 de octubre de 2025
SELECT 
  id,
  tipo_ausencia,
  fecha_inicio::date as fecha,
  clases_canceladas,
  'Para el 21/10/2025' as nota
FROM ausencias_admin
WHERE activo = true
  AND fecha_inicio::date = '2025-10-21'
ORDER BY created_at DESC;

-- 5. Verificar horarios semanales con clase_numero
SELECT 
  dia_semana,
  clase_numero,
  hora_inicio,
  hora_fin,
  capacidad,
  activo
FROM horarios_semanales
WHERE activo = true
  AND dia_semana = 2  -- 2 = Martes (el 21/10/2025 es martes)
ORDER BY clase_numero;

-- 6. Verificar si los usuarios tienen horarios con clase_numero
SELECT 
  hru.usuario_id,
  p.full_name,
  hru.dia_semana,
  hru.clase_numero,
  hru.hora_inicio,
  hru.activo
FROM horarios_recurrentes_usuario hru
LEFT JOIN profiles p ON p.id = hru.usuario_id
WHERE hru.activo = true
  AND hru.dia_semana = 2  -- Martes
ORDER BY hru.clase_numero;

-- 7. Verificar vista_horarios_usuarios (si existe)
-- Esta vista debe combinar horarios de usuarios con horas actualizadas
SELECT *
FROM vista_horarios_usuarios
WHERE dia_semana = 2
LIMIT 10;


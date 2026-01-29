-- Script para verificar y cambiar el plan del usuario fede.rz87@gmail.com
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar usuario y plan actual
SELECT 
    p.id,
    p.email,
    p.combo_asignado as plan_actual,
    p.tarifa_personalizada,
    COUNT(hru.id) as cantidad_horarios_actuales
FROM profiles p
LEFT JOIN horarios_recurrentes_usuario hru ON hru.usuario_id = p.id AND hru.activo = true
WHERE p.email = 'fede.rz87@gmail.com'
GROUP BY p.id, p.email, p.combo_asignado, p.tarifa_personalizada;

-- 2. Ver horarios actuales del usuario
SELECT 
    hru.id,
    hru.dia_semana,
    CASE hru.dia_semana
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
    END as dia_nombre,
    hru.clase_numero,
    hru.hora_inicio,
    hru.hora_fin,
    hru.combo_aplicado,
    hru.tarifa_personalizada,
    hru.activo
FROM profiles p
JOIN horarios_recurrentes_usuario hru ON hru.usuario_id = p.id
WHERE p.email = 'fede.rz87@gmail.com'
    AND hru.activo = true
ORDER BY hru.dia_semana, hru.clase_numero;

-- 3. Verificar capacidad de clases para asegurar que hay espacio
SELECT 
    hs.dia_semana,
    CASE hs.dia_semana
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
    END as dia_nombre,
    hs.clase_numero,
    hs.hora_inicio,
    hs.hora_fin,
    hs.capacidad,
    COUNT(hru.id) as usuarios_actuales,
    (hs.capacidad - COUNT(hru.id)) as lugares_disponibles
FROM horarios_semanales hs
LEFT JOIN horarios_recurrentes_usuario hru 
    ON hru.dia_semana = hs.dia_semana 
    AND hru.clase_numero = hs.clase_numero
    AND hru.activo = true
    AND hru.usuario_id != (SELECT id FROM profiles WHERE email = 'fede.rz87@gmail.com') -- Excluir usuario actual
WHERE hs.activo = true
GROUP BY hs.id, hs.dia_semana, hs.clase_numero, hs.hora_inicio, hs.hora_fin, hs.capacidad
ORDER BY hs.dia_semana, hs.clase_numero;

-- NOTA: Para cambiar el plan manualmente, usar los siguientes pasos:
-- 1. Eliminar horarios actuales (si es necesario)
-- 2. Insertar nuevos horarios con el nuevo plan
-- 3. Actualizar combo_asignado y tarifa_personalizada en profiles
-- 
-- Ejemplo de cambio a Plan 3 (3 días):
/*
-- Paso 1: Guardar plan actual para poder revertir
DO $$
DECLARE
    v_user_id UUID;
    v_plan_anterior INTEGER;
    v_tarifa_anterior NUMERIC;
BEGIN
    SELECT id, combo_asignado, tarifa_personalizada::NUMERIC 
    INTO v_user_id, v_plan_anterior, v_tarifa_anterior
    FROM profiles 
    WHERE email = 'fede.rz87@gmail.com';
    
    -- Aquí puedes guardar estos valores en una tabla temporal si quieres revertir después
    RAISE NOTICE 'Usuario: %, Plan anterior: %, Tarifa anterior: %', v_user_id, v_plan_anterior, v_tarifa_anterior;
END $$;

-- Paso 2: Cambiar a Plan 3 (ejemplo - NO EJECUTAR sin verificar primero)
-- UPDATE profiles 
-- SET combo_asignado = 3, tarifa_personalizada = '10000'
-- WHERE email = 'fede.rz87@gmail.com';
*/

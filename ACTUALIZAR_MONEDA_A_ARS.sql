-- Script para actualizar moneda de USD a ARS (Pesos Argentinos)
-- Ejecutar este script en Supabase SQL Editor

-- 1. Actualizar la tabla de configuración de tarifas
UPDATE configuracion_tarifas 
SET tarifa_actual = 2500.00,
    fecha_actualizacion = NOW()
WHERE id = 1;

-- 2. Actualizar el historial de tarifas
UPDATE historial_tarifas 
SET tarifa = 2500.00
WHERE fecha_inicio = '2024-01-01';

-- 3. Insertar nueva entrada en historial con la moneda actualizada
INSERT INTO historial_tarifas (tarifa, fecha_inicio, motivo_cambio)
VALUES (2500.00, CURRENT_DATE, 'Cambio de moneda de USD a ARS')
ON CONFLICT DO NOTHING;

-- 4. Verificar los cambios
SELECT 
    'Configuración actual' as tipo,
    tarifa_actual as tarifa,
    fecha_actualizacion
FROM configuracion_tarifas 
WHERE id = 1

UNION ALL

SELECT 
    'Historial de tarifas' as tipo,
    tarifa::text as tarifa,
    created_at as fecha_actualizacion
FROM historial_tarifas 
ORDER BY fecha_actualizacion DESC;

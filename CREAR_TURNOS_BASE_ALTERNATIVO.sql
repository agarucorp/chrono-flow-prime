-- CREAR TURNOS BASE - VERSIÓN ALTERNATIVA MÁS SIMPLE
-- Ejecutar en Supabase SQL Editor

-- 1. LIMPIAR TURNOS EXISTENTES (OPCIONAL)
-- DELETE FROM public.turnos;

-- 2. CREAR TURNOS UNO POR UNO PARA EVITAR PROBLEMAS DE TIPOS
-- Horarios: 8-9, 9-10, 10-11, 11-12, 15-16, 16-17, 18-19, 19-20

-- Función para crear turnos para una fecha específica
CREATE OR REPLACE FUNCTION crear_turnos_fecha(fecha_destino date)
RETURNS void AS $$
BEGIN
  -- Insertar turnos para la fecha especificada
  INSERT INTO public.turnos (fecha, hora_inicio, hora_fin, estado, servicio, created_at, updated_at) VALUES
    (fecha_destino, '08:00:00'::time, '09:00:00'::time, 'disponible', 'Entrenamiento Personal', NOW(), NOW()),
    (fecha_destino, '09:00:00'::time, '10:00:00'::time, 'disponible', 'Entrenamiento Personal', NOW(), NOW()),
    (fecha_destino, '10:00:00'::time, '11:00:00'::time, 'disponible', 'Entrenamiento Personal', NOW(), NOW()),
    (fecha_destino, '11:00:00'::time, '12:00:00'::time, 'disponible', 'Entrenamiento Personal', NOW(), NOW()),
    (fecha_destino, '15:00:00'::time, '16:00:00'::time, 'disponible', 'Entrenamiento Personal', NOW(), NOW()),
    (fecha_destino, '16:00:00'::time, '17:00:00'::time, 'disponible', 'Entrenamiento Personal', NOW(), NOW()),
    (fecha_destino, '18:00:00'::time, '19:00:00'::time, 'disponible', 'Entrenamiento Personal', NOW(), NOW()),
    (fecha_destino, '19:00:00'::time, '20:00:00'::time, 'disponible', 'Entrenamiento Personal', NOW(), NOW());
END;
$$ LANGUAGE plpgsql;

-- 3. CREAR TURNOS PARA LOS PRÓXIMOS 30 DÍAS
DO $$
DECLARE
  fecha_actual date := CURRENT_DATE;
  i integer;
BEGIN
  FOR i IN 0..29 LOOP
    -- Solo crear turnos para días laborables (lunes a viernes)
    IF EXTRACT(DOW FROM fecha_actual + INTERVAL '1 day' * i) NOT IN (0, 6) THEN
      PERFORM crear_turnos_fecha(fecha_actual + INTERVAL '1 day' * i);
    END IF;
  END LOOP;
END $$;

-- 4. LIMPIAR FUNCIÓN TEMPORAL
DROP FUNCTION IF EXISTS crear_turnos_fecha(date);

-- 5. VERIFICAR QUE SE CREARON LOS TURNOS
SELECT 
  COUNT(*) as total_turnos_creados,
  MIN(fecha) as fecha_inicio,
  MAX(fecha) as fecha_fin
FROM public.turnos 
WHERE servicio = 'Entrenamiento Personal';

-- 6. VERIFICAR HORARIOS POR DÍA
SELECT 
  fecha,
  COUNT(*) as turnos_por_dia,
  STRING_AGG(hora_inicio::text || '-' || hora_fin::text, ', ' ORDER BY hora_inicio) as horarios
FROM public.turnos 
WHERE servicio = 'Entrenamiento Personal'
GROUP BY fecha
ORDER BY fecha
LIMIT 7;

-- 7. VERIFICAR ESTADO DE LOS TURNOS
SELECT 
  estado,
  COUNT(*) as cantidad
FROM public.turnos 
WHERE servicio = 'Entrenamiento Personal'
GROUP BY estado;

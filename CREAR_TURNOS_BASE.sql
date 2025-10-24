-- CREAR TURNOS BASE PARA ENTRENAMIENTO PERSONAL
-- Ejecutar en Supabase SQL Editor

-- 1. LIMPIAR TURNOS EXISTENTES (OPCIONAL)
-- DELETE FROM public.turnos;

-- 2. CREAR TURNOS PARA LOS PRÓXIMOS 30 DÍAS
-- Horarios: 8-9, 9-10, 10-11, 11-12, 15-16, 16-17, 18-19, 19-20

INSERT INTO public.turnos (fecha, hora_inicio, hora_fin, estado, servicio, created_at, updated_at)
SELECT 
  fecha_generada as fecha,
  hora_inicio::time as hora_inicio,  -- CAST explícito a time
  hora_fin::time as hora_fin,        -- CAST explícito a time
  'disponible' as estado,
  'Entrenamiento Personal' as servicio,
  NOW() as created_at,
  NOW() as updated_at
FROM (
  -- Generar fechas para los próximos 30 días
  SELECT 
    (CURRENT_DATE + INTERVAL '1 day' * generate_series(0, 29))::date as fecha_generada
) fechas
CROSS JOIN (
  -- Definir horarios disponibles con CAST explícito
  VALUES 
    ('08:00:00'::time, '09:00:00'::time),
    ('09:00:00'::time, '10:00:00'::time),
    ('10:00:00'::time, '11:00:00'::time),
    ('11:00:00'::time, '12:00:00'::time),
    ('15:00:00'::time, '16:00:00'::time),
    ('16:00:00'::time, '17:00:00'::time),
    ('18:00:00'::time, '19:00:00'::time),
    ('19:00:00'::time, '20:00:00'::time)
) AS horarios(hora_inicio, hora_fin)
WHERE 
  -- Excluir domingos (opcional - ajustar según necesidades)
  EXTRACT(DOW FROM fecha_generada) != 0
  -- Excluir sábados (opcional - ajustar según necesidades)
  AND EXTRACT(DOW FROM fecha_generada) != 6
ORDER BY fecha_generada, hora_inicio;

-- 3. VERIFICAR QUE SE CREARON LOS TURNOS
SELECT 
  COUNT(*) as total_turnos_creados,
  MIN(fecha) as fecha_inicio,
  MAX(fecha) as fecha_fin
FROM public.turnos 
WHERE servicio = 'Entrenamiento Personal';

-- 4. VERIFICAR HORARIOS POR DÍA
SELECT 
  fecha,
  COUNT(*) as turnos_por_dia,
  STRING_AGG(hora_inicio::text || '-' || hora_fin::text, ', ' ORDER BY hora_inicio) as horarios
FROM public.turnos 
WHERE servicio = 'Entrenamiento Personal'
GROUP BY fecha
ORDER BY fecha
LIMIT 7; -- Mostrar solo los primeros 7 días

-- 5. VERIFICAR ESTADO DE LOS TURNOS
SELECT 
  estado,
  COUNT(*) as cantidad
FROM public.turnos 
WHERE servicio = 'Entrenamiento Personal'
GROUP BY estado;

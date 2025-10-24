-- CREAR DATOS DE PRUEBA PARA LA TABLA TURNOS
-- Ejecutar en Supabase SQL Editor DESPUÉS de ejecutar VERIFICAR_Y_CORREGIR_TABLA_TURNOS.sql

-- 1. Verificar si hay datos en la tabla turnos
SELECT COUNT(*) as total_turnos FROM public.turnos;

-- 2. Si no hay datos, crear algunos turnos de prueba para hoy
INSERT INTO public.turnos (fecha, hora_inicio, hora_fin, estado, servicio)
SELECT 
    CURRENT_DATE as fecha,
    hora_inicio,
    hora_fin,
    'disponible' as estado,
    'Clase de prueba' as servicio
FROM (
    VALUES 
        ('08:00:00'::time, '09:00:00'::time),
        ('09:00:00'::time, '10:00:00'::time),
        ('10:00:00'::time, '11:00:00'::time),
        ('11:00:00'::time, '12:00:00'::time),
        ('14:00:00'::time, '15:00:00'::time),
        ('15:00:00'::time, '16:00:00'::time)
) AS horarios(hora_inicio, hora_fin)
WHERE NOT EXISTS (SELECT 1 FROM public.turnos WHERE fecha = CURRENT_DATE);

-- 3. Verificar que se crearon los datos
SELECT 
    id,
    fecha,
    hora_inicio,
    hora_fin,
    estado,
    servicio
FROM public.turnos 
WHERE fecha = CURRENT_DATE
ORDER BY hora_inicio;

-- 4. Verificar estructura final de la tabla
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'turnos' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

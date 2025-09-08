-- Diagnosticar problemas que pueden causar errores 400

-- 1. Verificar si existe la tabla turnos (necesaria para el join)
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'turnos'
) as tabla_turnos_existe;

-- 2. Verificar la estructura de horarios_recurrentes_usuario
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'horarios_recurrentes_usuario' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Verificar si hay datos en horarios_recurrentes_usuario
SELECT COUNT(*) as total_registros FROM public.horarios_recurrentes_usuario;

-- 4. Verificar políticas RLS en horarios_recurrentes_usuario
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'horarios_recurrentes_usuario' 
AND schemaname = 'public';

-- 5. Verificar si existe la relación con turnos
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name='horarios_recurrentes_usuario';

-- 6. Si no existe turnos, crearla
CREATE TABLE IF NOT EXISTS public.turnos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    max_alumnos INTEGER DEFAULT 3,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Habilitar RLS en turnos si no está habilitado
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

-- 8. Crear políticas RLS para turnos
DROP POLICY IF EXISTS "turnos_select_all" ON public.turnos;
CREATE POLICY "turnos_select_all" ON public.turnos
FOR SELECT USING (true);

-- 9. Insertar turnos de ejemplo
INSERT INTO public.turnos (nombre, hora_inicio, hora_fin, max_alumnos) VALUES
('Mañana', '08:00:00', '09:00:00', 3),
('Tarde', '16:00:00', '17:00:00', 3),
('Noche', '19:00:00', '20:00:00', 3)
ON CONFLICT DO NOTHING;

-- 10. Verificar el resultado
SELECT 'Diagnóstico completado' as estado;

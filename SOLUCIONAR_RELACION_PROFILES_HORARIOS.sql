-- Solucionar la relación entre profiles y horarios_recurrentes_usuario

-- 1. Verificar la estructura actual de horarios_recurrentes_usuario
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'horarios_recurrentes_usuario' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar si existe la columna usuario_id
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'horarios_recurrentes_usuario' 
    AND column_name = 'usuario_id'
    AND table_schema = 'public'
) as columna_usuario_id_existe;

-- 3. Si no existe usuario_id, agregarla
ALTER TABLE public.horarios_recurrentes_usuario 
ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Verificar si existe la columna turno_id
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'horarios_recurrentes_usuario' 
    AND column_name = 'turno_id'
    AND table_schema = 'public'
) as columna_turno_id_existe;

-- 5. Crear tabla turnos si no existe
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

-- 6. Si no existe turno_id, agregarla con foreign key
ALTER TABLE public.horarios_recurrentes_usuario 
ADD COLUMN IF NOT EXISTS turno_id UUID REFERENCES public.turnos(id) ON DELETE CASCADE;

-- 7. Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_horarios_usuario_id ON public.horarios_recurrentes_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_horarios_turno_id ON public.horarios_recurrentes_usuario(turno_id);

-- 8. Habilitar RLS en turnos
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

-- 9. Crear políticas RLS para turnos
DROP POLICY IF EXISTS "turnos_select_all" ON public.turnos;
CREATE POLICY "turnos_select_all" ON public.turnos
FOR SELECT USING (true);

DROP POLICY IF EXISTS "turnos_insert_admin_only" ON public.turnos;
CREATE POLICY "turnos_insert_admin_only" ON public.turnos
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 10. Insertar turnos de ejemplo
INSERT INTO public.turnos (nombre, hora_inicio, hora_fin, max_alumnos) VALUES
('Mañana', '08:00:00', '09:00:00', 3),
('Tarde', '16:00:00', '17:00:00', 3),
('Noche', '19:00:00', '20:00:00', 3)
ON CONFLICT DO NOTHING;

-- 11. Verificar las relaciones creadas
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

-- 12. Verificar el resultado final
SELECT 'Relaciones configuradas correctamente' as estado;

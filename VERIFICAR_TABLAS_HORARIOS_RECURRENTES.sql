-- Verificar y crear tablas necesarias para horarios recurrentes

-- 1. Verificar si existe la tabla horarios_recurrentes_usuario
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'horarios_recurrentes_usuario'
) as tabla_horarios_existe;

-- 2. Verificar si existe la tabla turnos
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'turnos'
) as tabla_turnos_existe;

-- 3. Si no existe horarios_recurrentes_usuario, crearla
CREATE TABLE IF NOT EXISTS public.horarios_recurrentes_usuario (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    turno_id UUID NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
    dias_semana TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(usuario_id, turno_id)
);

-- 4. Si no existe turnos, crearla
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

-- 5. Habilitar RLS en las tablas
ALTER TABLE public.horarios_recurrentes_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

-- 6. Crear políticas RLS para horarios_recurrentes_usuario
CREATE POLICY "horarios_recurrentes_usuario_select_own_or_admin" ON public.horarios_recurrentes_usuario
FOR SELECT USING (
    usuario_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "horarios_recurrentes_usuario_insert_own_or_admin" ON public.horarios_recurrentes_usuario
FOR INSERT WITH CHECK (
    usuario_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "horarios_recurrentes_usuario_update_own_or_admin" ON public.horarios_recurrentes_usuario
FOR UPDATE USING (
    usuario_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "horarios_recurrentes_usuario_delete_own_or_admin" ON public.horarios_recurrentes_usuario
FOR DELETE USING (
    usuario_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 7. Crear políticas RLS para turnos
CREATE POLICY "turnos_select_all" ON public.turnos
FOR SELECT USING (true);

CREATE POLICY "turnos_insert_admin_only" ON public.turnos
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "turnos_update_admin_only" ON public.turnos
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "turnos_delete_admin_only" ON public.turnos
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 8. Insertar algunos turnos de ejemplo si no existen
INSERT INTO public.turnos (nombre, hora_inicio, hora_fin, max_alumnos) VALUES
('Mañana', '08:00:00', '09:00:00', 3),
('Tarde', '16:00:00', '17:00:00', 3),
('Noche', '19:00:00', '20:00:00', 3)
ON CONFLICT DO NOTHING;

-- 9. Verificar el estado final
SELECT 'Tablas creadas y configuradas correctamente' as estado;

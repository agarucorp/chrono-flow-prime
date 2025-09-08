-- Crear tabla para horarios recurrentes del usuario
CREATE TABLE IF NOT EXISTS public.horarios_recurrentes_usuario (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    horario_clase_id UUID NOT NULL REFERENCES public.horarios_clase(id) ON DELETE CASCADE,
    dia_semana SMALLINT NOT NULL CHECK (dia_semana >= 1 AND dia_semana <= 5),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin DATE, -- NULL significa que no tiene fecha de fin (recurrencia eterna)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para evitar duplicados del mismo usuario en el mismo horario
    UNIQUE(usuario_id, horario_clase_id)
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_horarios_recurrentes_usuario_id ON public.horarios_recurrentes_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_horarios_recurrentes_usuario_activo ON public.horarios_recurrentes_usuario(activo);
CREATE INDEX IF NOT EXISTS idx_horarios_recurrentes_usuario_dia ON public.horarios_recurrentes_usuario(dia_semana);
CREATE INDEX IF NOT EXISTS idx_horarios_recurrentes_usuario_fecha ON public.horarios_recurrentes_usuario(fecha_inicio, fecha_fin);

-- Crear trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_horarios_recurrentes_usuario_updated_at 
    BEFORE UPDATE ON public.horarios_recurrentes_usuario 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas RLS
ALTER TABLE public.horarios_recurrentes_usuario ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo vean sus propios horarios recurrentes
CREATE POLICY "Users can view their own recurring schedules" ON public.horarios_recurrentes_usuario
    FOR SELECT USING (auth.uid() = usuario_id);

-- Política para que los usuarios solo puedan insertar sus propios horarios recurrentes
CREATE POLICY "Users can insert their own recurring schedules" ON public.horarios_recurrentes_usuario
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Política para que los usuarios solo puedan actualizar sus propios horarios recurrentes
CREATE POLICY "Users can update their own recurring schedules" ON public.horarios_recurrentes_usuario
    FOR UPDATE USING (auth.uid() = usuario_id);

-- Política para que los usuarios solo puedan eliminar sus propios horarios recurrentes
CREATE POLICY "Users can delete their own recurring schedules" ON public.horarios_recurrentes_usuario
    FOR DELETE USING (auth.uid() = usuario_id);

-- Política para administradores (pueden ver todo)
CREATE POLICY "Admins can manage all recurring schedules" ON public.horarios_recurrentes_usuario
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Comentarios para documentación
COMMENT ON TABLE public.horarios_recurrentes_usuario IS 'Tabla que almacena los horarios recurrentes seleccionados por cada usuario para su cuota mensual';
COMMENT ON COLUMN public.horarios_recurrentes_usuario.usuario_id IS 'ID del usuario que tiene configurado este horario recurrente';
COMMENT ON COLUMN public.horarios_recurrentes_usuario.horario_clase_id IS 'ID del horario de clase base que se repite';
COMMENT ON COLUMN public.horarios_recurrentes_usuario.dia_semana IS 'Día de la semana (1=Lunes, 2=Martes, etc.)';
COMMENT ON COLUMN public.horarios_recurrentes_usuario.fecha_inicio IS 'Fecha desde la cual comienza la recurrencia';
COMMENT ON COLUMN public.horarios_recurrentes_usuario.fecha_fin IS 'Fecha hasta la cual se mantiene la recurrencia (NULL = eterna)';
COMMENT ON COLUMN public.horarios_recurrentes_usuario.activo IS 'Indica si este horario recurrente está activo o pausado';

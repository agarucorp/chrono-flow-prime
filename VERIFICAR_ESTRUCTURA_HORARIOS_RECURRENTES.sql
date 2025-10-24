-- Verificar estructura de la tabla horarios_recurrentes_usuario
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'horarios_recurrentes_usuario' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Si no existe dias_semana, agregarla
ALTER TABLE public.horarios_recurrentes_usuario 
ADD COLUMN IF NOT EXISTS dias_semana TEXT[] DEFAULT '{}';

-- Verificar que se agregó correctamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'horarios_recurrentes_usuario' 
AND table_schema = 'public'
ORDER BY ordinal_position;


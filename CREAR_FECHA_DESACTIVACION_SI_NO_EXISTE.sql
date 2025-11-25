-- =====================================================
-- CREAR COLUMNA fecha_desactivacion SI NO EXISTE
-- =====================================================

-- Agregar campo fecha_desactivacion a la tabla profiles
-- Este campo indica desde qué fecha el usuario está inactivo (a partir del mes siguiente)

-- Verificar si la columna ya existe antes de agregarla
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'fecha_desactivacion'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN fecha_desactivacion DATE;
    
    -- Agregar comentario
    COMMENT ON COLUMN public.profiles.fecha_desactivacion IS 'Fecha desde la cual el usuario está inactivo. Si es NULL, el usuario está activo.';
    
    RAISE NOTICE 'Columna fecha_desactivacion creada exitosamente';
  ELSE
    RAISE NOTICE 'Columna fecha_desactivacion ya existe';
  END IF;
END $$;

-- Crear índice para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_profiles_fecha_desactivacion 
ON public.profiles(fecha_desactivacion) 
WHERE fecha_desactivacion IS NOT NULL;

-- Verificar que existe
SELECT 
  'Columna fecha_desactivacion:' as info,
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
AND column_name = 'fecha_desactivacion';


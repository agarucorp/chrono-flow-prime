-- =====================================================
-- AGREGAR COLUMNA fecha_desactivacion A profiles
-- =====================================================

-- Verificar si la columna existe
SELECT 
  'Verificando columna fecha_desactivacion:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'fecha_desactivacion';

-- Agregar la columna si no existe
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fecha_desactivacion DATE;

-- Agregar comentario
COMMENT ON COLUMN public.profiles.fecha_desactivacion IS 'Fecha a partir de la cual el usuario se considera inactivo en el sistema.';

-- Verificar que se agregó correctamente
SELECT 
  'Columna agregada:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'fecha_desactivacion';


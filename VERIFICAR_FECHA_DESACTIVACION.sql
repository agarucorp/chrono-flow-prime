-- =====================================================
-- VERIFICAR SI EXISTE LA COLUMNA fecha_desactivacion
-- =====================================================

-- Verificar si la columna existe
SELECT 
  'Verificando columna fecha_desactivacion:' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'fecha_desactivacion';

-- Si no existe, mostramos todas las columnas de profiles para referencia
SELECT 
  'Todas las columnas en profiles:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;


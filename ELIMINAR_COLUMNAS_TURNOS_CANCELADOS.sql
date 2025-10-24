ALTER TABLE public.turnos_cancelados 
  DROP COLUMN IF EXISTS motivo_cancelacion,
  DROP COLUMN IF EXISTS servicio;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'turnos_cancelados'
ORDER BY ordinal_position;



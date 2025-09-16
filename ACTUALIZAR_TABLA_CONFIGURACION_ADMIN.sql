-- ACTUALIZAR TABLA CONFIGURACION_ADMIN: agregar tarifa_horaria, moneda y unicidad de activo

ALTER TABLE public.configuracion_admin
  ADD COLUMN IF NOT EXISTS tarifa_horaria DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS moneda CHAR(3) NOT NULL DEFAULT 'ARS';

-- Enforzar una sola fila activa (parcial) si no existe índice único
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'configuracion_admin' AND indexname = 'uniq_config_admin_activa'
  ) THEN
    CREATE UNIQUE INDEX uniq_config_admin_activa
    ON public.configuracion_admin ((TRUE))
    WHERE sistema_activo = true;
  END IF;
END $$;

-- Inicializar tarifa_horaria con precio_clase si aplica
UPDATE public.configuracion_admin
SET tarifa_horaria = COALESCE(NULLIF(tarifa_horaria, 0), precio_clase);




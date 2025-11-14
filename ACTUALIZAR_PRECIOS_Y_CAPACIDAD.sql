-- ACTUALIZAR PRECIOS DE COMBOS Y CAPACIDAD MÁXIMA
-- Actualiza los precios de los combos por asistencia y la capacidad máxima por clase

UPDATE public.configuracion_admin
SET 
  combo_1_tarifa = 12500,
  combo_2_tarifa = 11250,
  combo_3_tarifa = 10000,
  combo_4_tarifa = 8750,
  combo_5_tarifa = 7500,
  max_alumnos_por_clase = 4,
  updated_at = NOW()
WHERE sistema_activo = true;


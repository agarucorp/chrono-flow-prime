-- Cuotas mensuales: generación automática durable (mes actual + siguiente)
-- Evita meses “vacíos” cuando no hubo cambios de agenda ni cron externo.

-- 1) Default de monto_con_descuento: NULL (0 engañaba al front)
ALTER TABLE public.cuotas_mensuales
  ALTER COLUMN monto_con_descuento SET DEFAULT NULL;

-- Reparar filas existentes sin descuento pero con monto_con_descuento=0
UPDATE public.cuotas_mensuales
SET monto_con_descuento = monto_total
WHERE COALESCE(descuento_porcentaje, 0) = 0
  AND COALESCE(monto_con_descuento, 0) = 0
  AND COALESCE(monto_total, 0) > 0;

-- 2) Asegurar mes actual + siguiente (idempotente)
CREATE OR REPLACE FUNCTION public.fn_asegurar_cuotas_actual_y_siguiente()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_anio int := EXTRACT(YEAR FROM v_hoy)::int;
  v_mes int := EXTRACT(MONTH FROM v_hoy)::int;
  v_sig date := (date_trunc('month', v_hoy) + interval '1 month')::date;
  v_anio_sig int := EXTRACT(YEAR FROM v_sig)::int;
  v_mes_sig int := EXTRACT(MONTH FROM v_sig)::int;
BEGIN
  PERFORM public.fn_generar_cuotas_mes(v_anio, v_mes);
  PERFORM public.fn_generar_cuotas_mes(v_anio_sig, v_mes_sig);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_asegurar_cuotas_actual_y_siguiente() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_asegurar_cuotas_actual_y_siguiente() TO service_role;

-- 3) Recalcular por usuario: también setea monto_con_descuento y no pisa estado_pago
CREATE OR REPLACE FUNCTION public.fn_recalcular_cuotas_usuario_actual_y_siguiente(p_usuario_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_anio_actual int := EXTRACT(YEAR FROM v_hoy)::int;
  v_mes_actual int := EXTRACT(MONTH FROM v_hoy)::int;
  v_fecha_sig date := (date_trunc('month', v_hoy) + interval '1 month')::date;
  v_anio_sig int := EXTRACT(YEAR FROM v_fecha_sig)::int;
  v_mes_sig int := EXTRACT(MONTH FROM v_fecha_sig)::int;
  v_tarifa numeric(12,2);
  v_clases int;
  v_monto numeric(12,2);
BEGIN
  SELECT tarifa_efectiva::numeric(12,2)
  INTO v_tarifa
  FROM public.obtener_tarifa_usuario(p_usuario_id)
  LIMIT 1;

  IF v_tarifa IS NULL THEN
    SELECT COALESCE(precio_clase, tarifa_horaria, 0)::numeric(12,2)
    INTO v_tarifa
    FROM public.configuracion_admin
    LIMIT 1;
  END IF;

  -- Mes actual
  SELECT f.clases_previstas
  INTO v_clases
  FROM public.fn_clases_previstas_mes(v_anio_actual, v_mes_actual) f
  WHERE f.usuario_id = p_usuario_id;

  IF COALESCE(v_clases, 0) > 0 THEN
    v_monto := COALESCE(v_tarifa, 0) * v_clases;
    INSERT INTO public.cuotas_mensuales (
      usuario_id, anio, mes, clases_previstas, tarifa_unitaria,
      monto_total, monto_con_descuento, estado_pago
    )
    VALUES (
      p_usuario_id, v_anio_actual, v_mes_actual, v_clases, COALESCE(v_tarifa, 0),
      v_monto, v_monto, 'pendiente'
    )
    ON CONFLICT (usuario_id, anio, mes)
    DO UPDATE SET
      clases_previstas = EXCLUDED.clases_previstas,
      tarifa_unitaria = EXCLUDED.tarifa_unitaria,
      monto_total = EXCLUDED.monto_total,
      monto_con_descuento = CASE
        WHEN COALESCE(public.cuotas_mensuales.descuento_porcentaje, 0) > 0
          THEN public.cuotas_mensuales.monto_con_descuento
        ELSE EXCLUDED.monto_con_descuento
      END,
      generado_el = NOW();
  END IF;

  -- Mes siguiente
  SELECT f.clases_previstas
  INTO v_clases
  FROM public.fn_clases_previstas_mes(v_anio_sig, v_mes_sig) f
  WHERE f.usuario_id = p_usuario_id;

  IF COALESCE(v_clases, 0) > 0 THEN
    v_monto := COALESCE(v_tarifa, 0) * v_clases;
    INSERT INTO public.cuotas_mensuales (
      usuario_id, anio, mes, clases_previstas, tarifa_unitaria,
      monto_total, monto_con_descuento, estado_pago
    )
    VALUES (
      p_usuario_id, v_anio_sig, v_mes_sig, v_clases, COALESCE(v_tarifa, 0),
      v_monto, v_monto, 'pendiente'
    )
    ON CONFLICT (usuario_id, anio, mes)
    DO UPDATE SET
      clases_previstas = EXCLUDED.clases_previstas,
      tarifa_unitaria = EXCLUDED.tarifa_unitaria,
      monto_total = EXCLUDED.monto_total,
      monto_con_descuento = CASE
        WHEN COALESCE(public.cuotas_mensuales.descuento_porcentaje, 0) > 0
          THEN public.cuotas_mensuales.monto_con_descuento
        ELSE EXCLUDED.monto_con_descuento
      END,
      generado_el = NOW();
  END IF;
END;
$$;

-- 4) Backfill inmediato: mes actual + siguiente
SELECT public.fn_asegurar_cuotas_actual_y_siguiente();

-- 5) OPCIONAL (recomendado en Dashboard → Database → Extensions → pg_cron):
-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
-- SELECT cron.schedule(
--   'asegurar-cuotas-mensuales',
--   '15 6 * * *',
--   $$SELECT public.fn_asegurar_cuotas_actual_y_siguiente()$$
-- );

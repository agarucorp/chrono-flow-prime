-- Balance admin: permitir lectura de cuotas propias + alinear monto_con_descuento al generar
-- y endurecer generación del mes (sin pisar estado_pago).

-- 1) Alumnos pueden ver sus propias cuotas (además del admin)
DROP POLICY IF EXISTS "cuotas_mensuales_select_own" ON public.cuotas_mensuales;
CREATE POLICY "cuotas_mensuales_select_own" ON public.cuotas_mensuales
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.is_user_admin(auth.uid()));

-- Mantener política admin (por si no está cubierta arriba en algún entorno)
DROP POLICY IF EXISTS "cuotas_mensuales_select_admin" ON public.cuotas_mensuales;
CREATE POLICY "cuotas_mensuales_select_admin" ON public.cuotas_mensuales
  FOR SELECT TO authenticated
  USING (public.is_user_admin(auth.uid()));

-- 2) Generación: también setea monto_con_descuento cuando no hay descuento aplicado
CREATE OR REPLACE FUNCTION public.fn_generar_cuotas_mes(p_anio integer, p_mes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  tarifa numeric(12,2);
  v_result record;
  v_monto numeric(12,2);
BEGIN
  FOR rec IN SELECT * FROM public.fn_clases_previstas_mes(p_anio, p_mes) LOOP
    SELECT * INTO v_result
    FROM obtener_tarifa_usuario(rec.usuario_id)
    LIMIT 1;

    tarifa := v_result.tarifa_efectiva;

    IF tarifa IS NULL THEN
      SELECT COALESCE(precio_clase, tarifa_horaria, 0) INTO tarifa
      FROM public.configuracion_admin
      LIMIT 1;
    END IF;

    v_monto := COALESCE(tarifa, 0) * rec.clases_previstas;

    INSERT INTO public.cuotas_mensuales(
      usuario_id, anio, mes, clases_previstas, tarifa_unitaria,
      monto_total, monto_con_descuento, estado_pago
    )
    VALUES (
      rec.usuario_id, p_anio, p_mes, rec.clases_previstas, COALESCE(tarifa, 0),
      v_monto, v_monto, 'pendiente'
    )
    ON CONFLICT (usuario_id, anio, mes) DO UPDATE
      SET clases_previstas = EXCLUDED.clases_previstas,
          tarifa_unitaria = EXCLUDED.tarifa_unitaria,
          monto_total = EXCLUDED.monto_total,
          -- Solo sincronizar monto_con_descuento si no hay descuento cargado
          monto_con_descuento = CASE
            WHEN COALESCE(public.cuotas_mensuales.descuento_porcentaje, 0) > 0
              THEN public.cuotas_mensuales.monto_con_descuento
            ELSE EXCLUDED.monto_con_descuento
          END,
          generado_el = NOW();
          -- estado_pago se preserva (no se toca)
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_generar_cuotas_mes(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generar_cuotas_mes(integer, integer) TO service_role;

-- =============================================================================
-- Congelar cuota del mes actual (pago adelantado)
-- -----------------------------------------------------------------------------
-- Regla de negocio:
-- - La cuota del mes corriente se congela al existir (abonada al inicio).
-- - Cancelaciones / vacantes / feriados / ausencias del mes M impactan M+1.
-- - Meses <= hoy AR con fila existente NO se pisan (salvo que no exista → create).
-- - El mes siguiente SÍ se recalcula e incorpora ajustes del mes previo.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_mes_ar_hoy()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (timezone('America/Argentina/Buenos_Aires', now()))::date;
$$;

CREATE OR REPLACE FUNCTION public.fn_es_mes_congelado(p_anio integer, p_mes integer)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_hoy date := public.fn_mes_ar_hoy();
  v_anio int := EXTRACT(YEAR FROM v_hoy)::int;
  v_mes int := EXTRACT(MONTH FROM v_hoy)::int;
BEGIN
  -- Congelado: mes actual o pasado (respecto de AR)
  RETURN (p_anio < v_anio) OR (p_anio = v_anio AND p_mes <= v_mes);
END;
$$;

COMMENT ON FUNCTION public.fn_es_mes_congelado(integer, integer) IS
'True si (anio,mes) es el mes AR actual o uno pasado. Esas cuotas no deben pisarse si ya existen.';

-- Writer canónico con freeze + ajustes del mes PREVIO hacia el target
CREATE OR REPLACE FUNCTION public.fn_recalcular_cuota_mensual(
  p_usuario_id uuid,
  p_anio integer,
  p_mes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_clases_recurrentes integer := 0;
  total_clases_variables_mes integer := 0;
  total_clases_canceladas_tardia integer := 0;
  total_clases_canceladas_anticipacion integer := 0;
  adj_cancelaciones_prev integer := 0;
  adj_vacantes_prev integer := 0;
  adj_credito_prev integer := 0; -- feriados/ausencias del mes previo que tocaban su plan
  clases_previstas integer := 0;
  clases_a_cobrar integer := 0;
  tarifa numeric(12,2);
  monto_total numeric(12,2);
  monto_con_descuento numeric(12,2);
  v_descuento_existente numeric := 0;
  v_prev_ini date;
  v_prev_fin date;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_usuario_id
     AND NOT public.is_user_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- FREEZE: si el mes ya empezó (o pasó) y la fila existe, no tocar montos/clases/tarifa.
  IF public.fn_es_mes_congelado(p_anio, p_mes)
     AND EXISTS (
       SELECT 1 FROM public.cuotas_mensuales c
       WHERE c.usuario_id = p_usuario_id AND c.anio = p_anio AND c.mes = p_mes
     ) THEN
    RETURN;
  END IF;

  SELECT tarifa_efectiva::numeric(12,2) INTO tarifa
  FROM public.obtener_tarifa_usuario(p_usuario_id) LIMIT 1;
  IF tarifa IS NULL OR tarifa = 0 THEN
    SELECT COALESCE(tarifa_horaria, combo_1_tarifa, 0)::numeric(12,2) INTO tarifa
    FROM public.configuracion_admin ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  END IF;
  tarifa := COALESCE(tarifa, 0);

  -- Base del mes target: TODAS las clases del plan (sin restar feriados/ausencias).
  -- Feriados/ausencias del mes M se acreditan en M+1 (adelantado).
  WITH rango AS (
    SELECT make_date(p_anio, p_mes, 1) AS ini,
           (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date AS fin
  ),
  dias AS (
    SELECT d::date AS fecha,
           CASE WHEN EXTRACT(DOW FROM d)::int = 0 THEN 7 ELSE EXTRACT(DOW FROM d)::int END AS dia_semana
    FROM rango, generate_series(rango.ini, rango.fin, interval '1 day') AS d
  )
  SELECT COUNT(*)::int INTO total_clases_recurrentes
  FROM dias dn
  JOIN public.horarios_recurrentes_usuario hru
    ON COALESCE(hru.activo, true) = true
   AND hru.dia_semana = dn.dia_semana
   AND hru.usuario_id = p_usuario_id
   AND (hru.fecha_inicio IS NULL OR dn.fecha >= hru.fecha_inicio)
   AND (hru.fecha_fin IS NULL OR dn.fecha <= hru.fecha_fin);

  -- Vacantes del mes target NO se cobran en ese mes: impactan el siguiente (adelantado).
  -- Se cuentan solo como informativas.
  SELECT COUNT(*)::int INTO total_clases_variables_mes
  FROM public.turnos_variables tv
  WHERE tv.cliente_id = p_usuario_id
    AND EXTRACT(YEAR FROM tv.turno_fecha)::int = p_anio
    AND EXTRACT(MONTH FROM tv.turno_fecha)::int = p_mes
    AND tv.estado = 'confirmada';

  -- Contadores informativos del mes target
  SELECT COUNT(*)::int INTO total_clases_canceladas_tardia
  FROM public.turnos_cancelados tc
  WHERE tc.cliente_id = p_usuario_id
    AND EXTRACT(YEAR FROM tc.turno_fecha)::int = p_anio
    AND EXTRACT(MONTH FROM tc.turno_fecha)::int = p_mes
    AND COALESCE(tc.cancelacion_tardia, false) = true
    AND lower(COALESCE(tc.tipo_cancelacion, '')) NOT IN ('sistema', 'admin');

  SELECT COUNT(*)::int INTO total_clases_canceladas_anticipacion
  FROM public.turnos_cancelados tc
  WHERE tc.cliente_id = p_usuario_id
    AND EXTRACT(YEAR FROM tc.turno_fecha)::int = p_anio
    AND EXTRACT(MONTH FROM tc.turno_fecha)::int = p_mes
    AND COALESCE(tc.cancelacion_tardia, false) = false
    AND lower(COALESCE(tc.tipo_cancelacion, '')) NOT IN ('sistema', 'admin');

  -- Ajustes del mes PREVIO → impactan este mes (adelantado)
  v_prev_ini := (make_date(p_anio, p_mes, 1) - interval '1 month')::date;
  v_prev_fin := (make_date(p_anio, p_mes, 1) - interval '1 day')::date;

  SELECT COUNT(*)::int INTO adj_cancelaciones_prev
  FROM public.turnos_cancelados tc
  WHERE tc.cliente_id = p_usuario_id
    AND tc.turno_fecha >= v_prev_ini AND tc.turno_fecha <= v_prev_fin
    AND COALESCE(tc.cancelacion_tardia, false) = false
    AND lower(COALESCE(tc.tipo_cancelacion, '')) NOT IN ('sistema', 'admin');

  SELECT COUNT(*)::int INTO adj_vacantes_prev
  FROM public.turnos_variables tv
  WHERE tv.cliente_id = p_usuario_id
    AND tv.turno_fecha >= v_prev_ini AND tv.turno_fecha <= v_prev_fin
    AND tv.estado = 'confirmada';

  -- Crédito: clases del plan que cayeron en feriado/ausencia en el mes previo
  WITH dias AS (
    SELECT d::date AS fecha,
           CASE WHEN EXTRACT(DOW FROM d)::int = 0 THEN 7 ELSE EXTRACT(DOW FROM d)::int END AS dia_semana
    FROM generate_series(v_prev_ini, v_prev_fin, interval '1 day') AS d
  )
  SELECT COUNT(*)::int INTO adj_credito_prev
  FROM dias dn
  JOIN public.horarios_recurrentes_usuario hru
    ON COALESCE(hru.activo, true) = true
   AND hru.dia_semana = dn.dia_semana
   AND hru.usuario_id = p_usuario_id
   AND (hru.fecha_inicio IS NULL OR dn.fecha >= hru.fecha_inicio)
   AND (hru.fecha_fin IS NULL OR dn.fecha <= hru.fecha_fin)
  WHERE (
    EXISTS (
      SELECT 1 FROM public.ausencias_admin aa
      WHERE aa.activo = true
        AND dn.fecha >= aa.fecha_inicio
        AND dn.fecha <= COALESCE(aa.fecha_fin, aa.fecha_inicio)
    )
    OR EXISTS (
      SELECT 1 FROM public.feriados f
      WHERE f.activo = true AND f.tipo = 'dia_habil_feriado' AND f.fecha = dn.fecha
    )
  );

  -- clases_previstas = plan del mes (sin vacantes del mismo mes)
  clases_previstas := total_clases_recurrentes;
  -- Cobro adelantado: plan del mes + vacantes del previo − cancelaciones/créditos del previo
  clases_a_cobrar := GREATEST(
    0,
    total_clases_recurrentes
      + adj_vacantes_prev
      - adj_cancelaciones_prev
      - adj_credito_prev
  );
  monto_total := ROUND(clases_a_cobrar * tarifa, 2);

  SELECT COALESCE(c.descuento_porcentaje, 0) INTO v_descuento_existente
  FROM public.cuotas_mensuales c
  WHERE c.usuario_id = p_usuario_id AND c.anio = p_anio AND c.mes = p_mes;

  IF COALESCE(v_descuento_existente, 0) > 0 THEN
    monto_con_descuento := ROUND(monto_total * (1 - v_descuento_existente / 100.0), 2);
  ELSE
    monto_con_descuento := monto_total;
  END IF;

  PERFORM public.fn_upsert_cuota_mensual(
    p_usuario_id, p_anio, p_mes, clases_previstas, tarifa,
    monto_total, monto_con_descuento, clases_previstas,
    total_clases_canceladas_tardia, total_clases_canceladas_anticipacion, clases_a_cobrar
  );
END;
$$;

COMMENT ON FUNCTION public.fn_recalcular_cuota_mensual(uuid, integer, integer) IS
'Recalcula cuota. Mes actual/pasado con fila existente: FREEZE. Mes futuro o alta inicial: base del mes + ajustes del mes previo (adelantado).';

-- Triggers de eventos del mes corriente → asegurar recalc del mes SIGUIENTE
CREATE OR REPLACE FUNCTION public.fn_trigger_recalcular_cuotas_cancelacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente_id uuid;
  v_turno_fecha date;
  v_sig date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_cliente_id := OLD.cliente_id;
    v_turno_fecha := OLD.turno_fecha;
  ELSE
    v_cliente_id := NEW.cliente_id;
    v_turno_fecha := NEW.turno_fecha;
  END IF;

  IF v_cliente_id IS NOT NULL AND v_turno_fecha IS NOT NULL THEN
    -- Freeze-aware sobre el mes del evento (no-op si corriente ya existe)
    PERFORM public.fn_recalcular_cuota_mensual(
      v_cliente_id,
      EXTRACT(YEAR FROM v_turno_fecha)::int,
      EXTRACT(MONTH FROM v_turno_fecha)::int
    );
    -- Impacto adelantado → mes siguiente al evento
    v_sig := (date_trunc('month', v_turno_fecha) + interval '1 month')::date;
    PERFORM public.fn_recalcular_cuota_mensual(
      v_cliente_id,
      EXTRACT(YEAR FROM v_sig)::int,
      EXTRACT(MONTH FROM v_sig)::int
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trigger_recalcular_cuotas_turnos_variables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente_id uuid;
  v_fecha date;
  v_sig date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_cliente_id := OLD.cliente_id;
    v_fecha := OLD.turno_fecha;
  ELSE
    v_cliente_id := NEW.cliente_id;
    v_fecha := NEW.turno_fecha;
  END IF;

  IF v_cliente_id IS NOT NULL AND v_fecha IS NOT NULL THEN
    PERFORM public.fn_recalcular_cuota_mensual(
      v_cliente_id,
      EXTRACT(YEAR FROM v_fecha)::int,
      EXTRACT(MONTH FROM v_fecha)::int
    );
    v_sig := (date_trunc('month', v_fecha) + interval '1 month')::date;
    PERFORM public.fn_recalcular_cuota_mensual(
      v_cliente_id,
      EXTRACT(YEAR FROM v_sig)::int,
      EXTRACT(MONTH FROM v_sig)::int
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trigger_recalcular_cuotas_ausencias_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  usuario_record RECORD;
  fecha_cursor date;
  fecha_fin date;
  v_sig date;
  v_anio int;
  v_mes int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    fecha_cursor := OLD.fecha_inicio;
    fecha_fin := COALESCE(OLD.fecha_fin, OLD.fecha_inicio);
  ELSE
    fecha_cursor := NEW.fecha_inicio;
    fecha_fin := COALESCE(NEW.fecha_fin, NEW.fecha_inicio);
  END IF;

  WHILE fecha_cursor <= fecha_fin LOOP
    v_anio := EXTRACT(YEAR FROM fecha_cursor)::int;
    v_mes := EXTRACT(MONTH FROM fecha_cursor)::int;

    FOR usuario_record IN
      SELECT DISTINCT usuario_id
      FROM public.horarios_recurrentes_usuario
      WHERE COALESCE(activo, true) = true
    LOOP
      -- Freeze-aware mes afectado
      PERFORM public.fn_recalcular_cuota_mensual(usuario_record.usuario_id, v_anio, v_mes);
      -- Adelantado → mes siguiente
      v_sig := (date_trunc('month', make_date(v_anio, v_mes, 1)) + interval '1 month')::date;
      PERFORM public.fn_recalcular_cuota_mensual(
        usuario_record.usuario_id,
        EXTRACT(YEAR FROM v_sig)::int,
        EXTRACT(MONTH FROM v_sig)::int
      );
    END LOOP;

    fecha_cursor := (date_trunc('month', fecha_cursor) + interval '1 month')::date;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.fn_mes_ar_hoy() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_mes_ar_hoy() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_es_mes_congelado(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_es_mes_congelado(integer, integer) TO authenticated, service_role;

-- =============================================================================
-- Unificar writers de cuotas: UNA sola fuente de verdad
-- - fn_recalcular_cuota_mensual = calculador canónico
-- - fn_upsert_cuota_mensual     = persistencia (SIN tocar RLS)
-- - fn_generar_cuotas_mes / fn_recalcular_*_actual_y_siguiente delegan al canónico
-- - Elimina trigger duplicado en horarios (asegurar + recalcular)
-- - reservar_vacante respeta fecha_desactivacion
-- =============================================================================

-- Drop firma vieja (10 args) que usaba monto_con_descuento como total y DISABLE RLS
DROP FUNCTION IF EXISTS public.fn_upsert_cuota_mensual(uuid, integer, integer, integer, numeric, numeric, integer, integer, integer, integer);

-- 1) Upsert seguro: no DISABLE RLS, no pisa estado_pago ni descuento admin
CREATE OR REPLACE FUNCTION public.fn_upsert_cuota_mensual(
  p_usuario_id uuid,
  p_anio integer,
  p_mes integer,
  p_clases_previstas integer,
  p_tarifa numeric,
  p_monto_total numeric,
  p_monto_con_descuento numeric,
  p_clases_reservadas integer,
  p_clases_canceladas_tardia integer,
  p_clases_canceladas_anticipacion integer,
  p_clases_a_cobrar integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cuotas_mensuales (
    usuario_id, anio, mes, clases_previstas, tarifa_unitaria,
    monto_total, monto_con_descuento, estado_pago, generado_el,
    clases_reservadas, clases_canceladas_tardia, clases_canceladas_anticipacion, clases_a_cobrar
  ) VALUES (
    p_usuario_id, p_anio, p_mes, GREATEST(COALESCE(p_clases_previstas, 0), 0), COALESCE(p_tarifa, 0),
    COALESCE(p_monto_total, 0), COALESCE(p_monto_con_descuento, p_monto_total, 0), 'pendiente', NOW(),
    GREATEST(COALESCE(p_clases_reservadas, 0), 0),
    GREATEST(COALESCE(p_clases_canceladas_tardia, 0), 0),
    GREATEST(COALESCE(p_clases_canceladas_anticipacion, 0), 0),
    GREATEST(COALESCE(p_clases_a_cobrar, 0), 0)
  )
  ON CONFLICT (usuario_id, anio, mes)
  DO UPDATE SET
    clases_previstas = EXCLUDED.clases_previstas,
    tarifa_unitaria = EXCLUDED.tarifa_unitaria,
    monto_total = EXCLUDED.monto_total,
    -- Preservar descuento manual del admin
    monto_con_descuento = CASE
      WHEN COALESCE(public.cuotas_mensuales.descuento_porcentaje, 0) > 0
        THEN ROUND(
          EXCLUDED.monto_total * (1 - public.cuotas_mensuales.descuento_porcentaje / 100.0),
          2
        )
      ELSE EXCLUDED.monto_con_descuento
    END,
    clases_reservadas = EXCLUDED.clases_reservadas,
    clases_canceladas_tardia = EXCLUDED.clases_canceladas_tardia,
    clases_canceladas_anticipacion = EXCLUDED.clases_canceladas_anticipacion,
    clases_a_cobrar = EXCLUDED.clases_a_cobrar,
    generado_el = NOW();
    -- estado_pago: no se toca
END;
$$;

-- 2) Calculador canónico
CREATE OR REPLACE FUNCTION public.fn_recalcular_cuota_mensual(
  p_usuario_id uuid,
  p_anio integer,
  p_mes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_clases_recurrentes integer := 0;
  total_clases_variables integer := 0;
  total_clases_canceladas_tardia integer := 0;
  total_clases_canceladas_anticipacion integer := 0;
  clases_previstas integer := 0;
  clases_a_cobrar integer := 0;
  tarifa numeric(12,2);
  monto_total numeric(12,2);
  monto_con_descuento numeric(12,2);
  v_descuento_existente numeric := 0;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_usuario_id
     AND NOT public.is_user_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Tarifa efectiva
  SELECT tarifa_efectiva::numeric(12,2)
  INTO tarifa
  FROM public.obtener_tarifa_usuario(p_usuario_id)
  LIMIT 1;

  IF tarifa IS NULL OR tarifa = 0 THEN
    SELECT COALESCE(tarifa_horaria, combo_1_tarifa, 0)::numeric(12,2)
    INTO tarifa
    FROM public.configuracion_admin
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  tarifa := COALESCE(tarifa, 0);

  -- Recurrentes vigentes, sin ausencias admin ni feriados cerrados
  WITH rango AS (
    SELECT make_date(p_anio, p_mes, 1) AS ini,
           (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::date AS fin
  ),
  dias AS (
    SELECT d::date AS fecha,
           CASE WHEN EXTRACT(DOW FROM d)::int = 0 THEN 7 ELSE EXTRACT(DOW FROM d)::int END AS dia_semana
    FROM rango, generate_series(rango.ini, rango.fin, interval '1 day') AS d
  )
  SELECT COUNT(*)::int
  INTO total_clases_recurrentes
  FROM dias dn
  JOIN public.horarios_recurrentes_usuario hru
    ON COALESCE(hru.activo, true) = true
   AND hru.dia_semana = dn.dia_semana
   AND hru.usuario_id = p_usuario_id
   AND (hru.fecha_inicio IS NULL OR dn.fecha >= hru.fecha_inicio)
   AND (hru.fecha_fin IS NULL OR dn.fecha <= hru.fecha_fin)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ausencias_admin aa
    WHERE aa.activo = true
      AND dn.fecha >= aa.fecha_inicio
      AND dn.fecha <= COALESCE(aa.fecha_fin, aa.fecha_inicio)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.feriados f
    WHERE f.activo = true
      AND f.tipo = 'dia_habil_feriado'
      AND f.fecha = dn.fecha
  );

  -- Variables confirmadas (sin ausencias)
  SELECT COUNT(*)::int
  INTO total_clases_variables
  FROM public.turnos_variables tv
  WHERE tv.cliente_id = p_usuario_id
    AND EXTRACT(YEAR FROM tv.turno_fecha)::int = p_anio
    AND EXTRACT(MONTH FROM tv.turno_fecha)::int = p_mes
    AND tv.estado = 'confirmada'
    AND NOT EXISTS (
      SELECT 1 FROM public.ausencias_admin aa
      WHERE aa.activo = true
        AND tv.turno_fecha >= aa.fecha_inicio
        AND tv.turno_fecha <= COALESCE(aa.fecha_fin, aa.fecha_inicio)
    );

  -- Cancelaciones del alumno (no sistema/admin)
  SELECT COUNT(*)::int
  INTO total_clases_canceladas_tardia
  FROM public.turnos_cancelados tc
  WHERE tc.cliente_id = p_usuario_id
    AND EXTRACT(YEAR FROM tc.turno_fecha)::int = p_anio
    AND EXTRACT(MONTH FROM tc.turno_fecha)::int = p_mes
    AND COALESCE(tc.cancelacion_tardia, false) = true
    AND lower(COALESCE(tc.tipo_cancelacion, '')) NOT IN ('sistema', 'admin');

  SELECT COUNT(*)::int
  INTO total_clases_canceladas_anticipacion
  FROM public.turnos_cancelados tc
  WHERE tc.cliente_id = p_usuario_id
    AND EXTRACT(YEAR FROM tc.turno_fecha)::int = p_anio
    AND EXTRACT(MONTH FROM tc.turno_fecha)::int = p_mes
    AND COALESCE(tc.cancelacion_tardia, false) = false
    AND lower(COALESCE(tc.tipo_cancelacion, '')) NOT IN ('sistema', 'admin');

  clases_previstas := total_clases_recurrentes + total_clases_variables;
  -- Anticipada: no se cobra. Tardía: se cobra (no restar).
  clases_a_cobrar := GREATEST(0, clases_previstas - total_clases_canceladas_anticipacion);

  monto_total := ROUND(clases_a_cobrar * tarifa, 2);

  SELECT COALESCE(c.descuento_porcentaje, 0)
  INTO v_descuento_existente
  FROM public.cuotas_mensuales c
  WHERE c.usuario_id = p_usuario_id AND c.anio = p_anio AND c.mes = p_mes;

  IF COALESCE(v_descuento_existente, 0) > 0 THEN
    monto_con_descuento := ROUND(monto_total * (1 - v_descuento_existente / 100.0), 2);
  ELSE
    monto_con_descuento := monto_total;
  END IF;

  -- Si no hay clases previstas ni a cobrar, aún así sincronizar fila a 0
  -- (evita montos stale cuando el alumno pierde horarios)
  PERFORM public.fn_upsert_cuota_mensual(
    p_usuario_id,
    p_anio,
    p_mes,
    clases_previstas,
    tarifa,
    monto_total,
    monto_con_descuento,
    clases_previstas,
    total_clases_canceladas_tardia,
    total_clases_canceladas_anticipacion,
    clases_a_cobrar
  );
END;
$$;

-- 3) Generar mes = recalcular canónico por cada cliente activo
CREATE OR REPLACE FUNCTION public.fn_generar_cuotas_mes(p_anio integer, p_mes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
BEGIN
  -- Solo admin o roles de servicio (auth.uid() null en cron/service_role)
  IF auth.uid() IS NOT NULL AND NOT public.is_user_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  FOR rec IN
    SELECT p.id AS usuario_id
    FROM public.profiles p
    WHERE p.role = 'client'
      AND COALESCE(p.is_active, true) = true
      AND (p.fecha_desactivacion IS NULL OR p.fecha_desactivacion > v_hoy)
      AND EXISTS (
        SELECT 1 FROM public.horarios_recurrentes_usuario h
        WHERE h.usuario_id = p.id
          AND COALESCE(h.activo, true) = true
      )
  LOOP
    PERFORM public.fn_recalcular_cuota_mensual(rec.usuario_id, p_anio, p_mes);
  END LOOP;
END;
$$;

-- 4) Actual + siguiente = canónico (con authz)
CREATE OR REPLACE FUNCTION public.fn_recalcular_cuotas_usuario_actual_y_siguiente(p_usuario_id uuid)
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
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_usuario_id
     AND NOT public.is_user_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  PERFORM public.fn_recalcular_cuota_mensual(p_usuario_id, v_anio, v_mes);
  PERFORM public.fn_recalcular_cuota_mensual(p_usuario_id, v_anio_sig, v_mes_sig);
END;
$$;

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
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_user_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  PERFORM public.fn_generar_cuotas_mes(v_anio, v_mes);
  PERFORM public.fn_generar_cuotas_mes(EXTRACT(YEAR FROM v_sig)::int, EXTRACT(MONTH FROM v_sig)::int);
END;
$$;

-- Asegurar nuevo: solo canónico mes actual (el otro trigger ya cubre actual+siguiente)
CREATE OR REPLACE FUNCTION public.fn_asegurar_cuota_usuario_nuevo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No-op: trg_recalcular_cuotas_horarios_actual_siguiente ya recalcula.
  -- Se mantiene por compatibilidad si algún entorno aún lo referencia.
  RETURN NEW;
END;
$$;

-- Quitar trigger duplicado (INSERT disparaba 2 writers)
DROP TRIGGER IF EXISTS trigger_asegurar_cuota_usuario_nuevo ON public.horarios_recurrentes_usuario;

-- Grants: nada para anon
REVOKE ALL ON FUNCTION public.fn_upsert_cuota_mensual(uuid, integer, integer, integer, numeric, numeric, numeric, integer, integer, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_recalcular_cuota_mensual(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_generar_cuotas_mes(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_recalcular_cuotas_usuario_actual_y_siguiente(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_asegurar_cuotas_actual_y_siguiente() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_upsert_cuota_mensual(uuid, integer, integer, integer, numeric, numeric, numeric, integer, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recalcular_cuota_mensual(uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_generar_cuotas_mes(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_recalcular_cuotas_usuario_actual_y_siguiente(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_asegurar_cuotas_actual_y_siguiente() TO authenticated, service_role;

-- 5) reservar_vacante: bloquear desactivación programada
CREATE OR REPLACE FUNCTION public.reservar_vacante(
  p_turno_disponible_id UUID,
  p_turno_fecha DATE,
  p_turno_hora_inicio TIME,
  p_turno_hora_fin TIME
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_disponible RECORD;
  v_capacidad INT;
  v_reservas INT;
  v_nueva_id UUID;
  v_sistema_activo BOOLEAN;
  v_ya_tiene BOOLEAN;
  v_hoy date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT ca.sistema_activo INTO v_sistema_activo
  FROM public.configuracion_admin ca
  WHERE ca.sistema_activo IS NOT NULL
  ORDER BY ca.updated_at DESC NULLS LAST, ca.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_sistema_activo IS FALSE THEN
    RAISE EXCEPTION 'El sistema de reservas está temporalmente desactivado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_uid
      AND (
        pr.is_active IS FALSE
        OR (pr.fecha_desactivacion IS NOT NULL AND pr.fecha_desactivacion <= v_hoy)
      )
  ) THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.turnos_variables tv
    WHERE tv.cliente_id = v_uid
      AND tv.turno_fecha = p_turno_fecha
      AND tv.turno_hora_inicio = p_turno_hora_inicio
      AND tv.estado = 'confirmada'
  ) INTO v_ya_tiene;

  IF v_ya_tiene THEN
    RAISE EXCEPTION 'Ya tenés una reserva en ese horario';
  END IF;

  IF p_turno_disponible_id IS NOT NULL THEN
    SELECT * INTO v_disponible
    FROM public.turnos_disponibles td
    WHERE td.id = p_turno_disponible_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vacante no encontrada';
    END IF;

    p_turno_fecha := v_disponible.turno_fecha;
    p_turno_hora_inicio := v_disponible.turno_hora_inicio;
    p_turno_hora_fin := v_disponible.turno_hora_fin;
  END IF;

  SELECT COUNT(*)::INT INTO v_capacidad
  FROM public.turnos_disponibles td
  WHERE td.turno_fecha = p_turno_fecha
    AND td.turno_hora_inicio = p_turno_hora_inicio;

  IF v_capacidad <= 0 THEN
    IF p_turno_disponible_id IS NOT NULL THEN
      v_capacidad := 1;
    ELSE
      RAISE EXCEPTION 'No hay vacantes para ese horario';
    END IF;
  END IF;

  SELECT COUNT(*)::INT INTO v_reservas
  FROM public.turnos_variables tv
  WHERE tv.turno_fecha = p_turno_fecha
    AND tv.turno_hora_inicio = p_turno_hora_inicio
    AND tv.estado = 'confirmada';

  IF v_reservas >= v_capacidad THEN
    RAISE EXCEPTION 'Cupo completo';
  END IF;

  INSERT INTO public.turnos_variables (
    cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin,
    estado, creado_desde_disponible_id
  ) VALUES (
    v_uid, p_turno_fecha, p_turno_hora_inicio, p_turno_hora_fin,
    'confirmada', p_turno_disponible_id
  )
  RETURNING id INTO v_nueva_id;

  RETURN v_nueva_id;
END;
$$;

-- 6) Backfill mes actual + siguiente con el writer unificado
SELECT public.fn_asegurar_cuotas_actual_y_siguiente();

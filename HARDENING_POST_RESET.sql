-- =============================================================================
-- Hardening post-reset: seguridad roles, reserva atómica de vacantes, sistema_activo
-- Aplicar en el proyecto Supabase recién reseteado (después de crear tablas base).
-- =============================================================================

-- 1) Impedir que un usuario se auto-asigne role = admin
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    ) INTO caller_is_admin;

    -- Service role / triggers sin JWT: auth.uid() es null → permitir (admin API / migraciones)
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;

    IF NOT caller_is_admin THEN
      RAISE EXCEPTION 'No autorizado a cambiar el rol';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

-- Política UPDATE own sin poder tocar role (refuerzo además del trigger)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_no_role" ON public.profiles;

CREATE POLICY "profiles_update_own_no_role" ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
);

-- 2) Unique: un alumno no puede tener dos reservas variables confirmadas en el mismo slot
CREATE UNIQUE INDEX IF NOT EXISTS uq_turnos_variables_cliente_slot_confirmada
  ON public.turnos_variables (cliente_id, turno_fecha, turno_hora_inicio)
  WHERE estado = 'confirmada';

-- 3) RPC atómica para reservar vacante (evita race / sobrecupo)
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Master switch: si hay config activa y sistema_activo = false, bloquear
  SELECT ca.sistema_activo INTO v_sistema_activo
  FROM public.configuracion_admin ca
  WHERE ca.sistema_activo IS NOT NULL
  ORDER BY ca.updated_at DESC NULLS LAST, ca.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_sistema_activo IS FALSE THEN
    RAISE EXCEPTION 'El sistema de reservas está temporalmente desactivado';
  END IF;

  -- Usuario activo
  IF EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = v_uid AND pr.is_active IS FALSE
  ) THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  -- No duplicar slot propio
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

  -- Lock de la fila disponible (o crear contexto por fecha/hora)
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

  -- Capacidad = cantidad de filas en turnos_disponibles para ese slot
  SELECT COUNT(*)::INT INTO v_capacidad
  FROM public.turnos_disponibles td
  WHERE td.turno_fecha = p_turno_fecha
    AND td.turno_hora_inicio = p_turno_hora_inicio;

  IF v_capacidad <= 0 THEN
    -- Permitir 1 cupo si se pasó id explícito ya lockeado
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
    cliente_id,
    turno_fecha,
    turno_hora_inicio,
    turno_hora_fin,
    estado,
    creado_desde_disponible_id
  ) VALUES (
    v_uid,
    p_turno_fecha,
    p_turno_hora_inicio,
    p_turno_hora_fin,
    'confirmada',
    p_turno_disponible_id
  )
  RETURNING id INTO v_nueva_id;

  RETURN v_nueva_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reservar_vacante(UUID, DATE, TIME, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reservar_vacante(UUID, DATE, TIME, TIME) TO authenticated;

-- 4) Helper: ¿sistema activo? (para lecturas client-side)
CREATE OR REPLACE FUNCTION public.is_sistema_activo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT ca.sistema_activo
      FROM public.configuracion_admin ca
      ORDER BY ca.updated_at DESC NULLS LAST, ca.created_at DESC NULLS LAST
      LIMIT 1
    ),
    true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_sistema_activo() TO authenticated, anon;

SELECT 'hardening_ok' AS status;

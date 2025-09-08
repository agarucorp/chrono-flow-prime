-- CREAR TABLA CLASES INDIVIDUALES
-- Tabla para registrar cada clase individual dentro de las reservas

-- ==============================================
-- 1. CREAR TABLA CLASES INDIVIDUALES
-- ==============================================

CREATE TABLE IF NOT EXISTS public.clases_individuales (
    id_clase_individual UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_reserva UUID NOT NULL REFERENCES public.reservas_turnos(id) ON DELETE CASCADE,
    turno_id UUID NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    fecha_clase DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'programada' CHECK (estado IN (
        'programada',      -- Clase programada, esperando confirmación
        'confirmada',      -- Clase confirmada por el cliente
        'en_curso',        -- Clase en desarrollo
        'completada',      -- Clase finalizada exitosamente
        'cancelada',       -- Clase cancelada por el cliente
        'no_show',         -- Cliente no se presentó
        'reprogramada'     -- Clase reprogramada
    )),
    asistencia BOOLEAN DEFAULT NULL, -- NULL = no registrada, TRUE = asistió, FALSE = no asistió
    calificacion INTEGER CHECK (calificacion >= 1 AND calificacion <= 5), -- Calificación del cliente
    comentarios_cliente TEXT, -- Comentarios del cliente sobre la clase
    comentarios_admin TEXT,   -- Comentarios del admin sobre la clase
    precio_cobrado DECIMAL(10,2) DEFAULT 0.00, -- Precio efectivamente cobrado
    metodo_pago VARCHAR(50), -- 'efectivo', 'transferencia', 'tarjeta', 'otro'
    pagado BOOLEAN DEFAULT FALSE, -- Si se cobró la clase
    fecha_pago TIMESTAMP WITH TIME ZONE, -- Cuándo se realizó el pago
    motivo_cancelacion TEXT, -- Razón de cancelación si aplica
    fecha_cancelacion TIMESTAMP WITH TIME ZONE, -- Cuándo se canceló
    reprogramada_desde UUID REFERENCES public.clases_individuales(id_clase_individual), -- Si fue reprogramada
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar duplicados: un cliente no puede tener dos clases en el mismo turno y fecha
    UNIQUE(turno_id, cliente_id, fecha_clase)
);

-- ==============================================
-- 2. CREAR ÍNDICES PARA OPTIMIZACIÓN
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_clases_individuales_reserva 
ON public.clases_individuales(id_reserva);

CREATE INDEX IF NOT EXISTS idx_clases_individuales_turno 
ON public.clases_individuales(turno_id);

CREATE INDEX IF NOT EXISTS idx_clases_individuales_cliente 
ON public.clases_individuales(cliente_id);

CREATE INDEX IF NOT EXISTS idx_clases_individuales_fecha 
ON public.clases_individuales(fecha_clase);

CREATE INDEX IF NOT EXISTS idx_clases_individuales_estado 
ON public.clases_individuales(estado);

CREATE INDEX IF NOT EXISTS idx_clases_individuales_asistencia 
ON public.clases_individuales(asistencia);

-- ==============================================
-- 3. CREAR TRIGGER PARA ACTUALIZAR TIMESTAMP
-- ==============================================

CREATE OR REPLACE FUNCTION update_clases_individuales_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_clases_individuales_timestamp
    BEFORE UPDATE ON public.clases_individuales
    FOR EACH ROW
    EXECUTE FUNCTION update_clases_individuales_timestamp();

-- ==============================================
-- 4. CREAR POLÍTICAS RLS
-- ==============================================

-- Habilitar RLS
ALTER TABLE public.clases_individuales ENABLE ROW LEVEL SECURITY;

-- Admins pueden ver todas las clases
CREATE POLICY "clases_individuales_select_admin_all" ON public.clases_individuales
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Clientes pueden ver solo sus propias clases
CREATE POLICY "clases_individuales_select_own" ON public.clases_individuales
FOR SELECT USING (cliente_id = auth.uid());

-- Solo admins pueden insertar clases
CREATE POLICY "clases_individuales_insert_admin_only" ON public.clases_individuales
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Admins pueden actualizar todas las clases, clientes solo las suyas
CREATE POLICY "clases_individuales_update_admin_or_own" ON public.clases_individuales
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) OR cliente_id = auth.uid()
);

-- Solo admins pueden eliminar clases
CREATE POLICY "clases_individuales_delete_admin_only" ON public.clases_individuales
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ==============================================
-- 5. CREAR FUNCIONES HELPER
-- ==============================================

-- Función para crear clase individual desde reserva
CREATE OR REPLACE FUNCTION crear_clase_individual(
    p_reserva_id UUID,
    p_fecha_clase DATE,
    p_hora_inicio TIME,
    p_hora_fin TIME
)
RETURNS UUID AS $$
DECLARE
    v_clase_id UUID;
    v_reserva RECORD;
BEGIN
    -- Obtener datos de la reserva
    SELECT rt.*, t.hora_inicio as turno_hora_inicio, t.hora_fin as turno_hora_fin
    INTO v_reserva
    FROM public.reservas_turnos rt
    JOIN public.turnos t ON rt.turno_id = t.id
    WHERE rt.id = p_reserva_id;
    
    -- Verificar que la reserva existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reserva no encontrada: %', p_reserva_id;
    END IF;
    
    -- Crear la clase individual
    INSERT INTO public.clases_individuales (
        id_reserva,
        turno_id,
        cliente_id,
        fecha_clase,
        hora_inicio,
        hora_fin,
        estado,
        precio_cobrado
    ) VALUES (
        p_reserva_id,
        v_reserva.turno_id,
        v_reserva.cliente_id,
        p_fecha_clase,
        p_hora_inicio,
        p_hora_fin,
        'programada',
        (SELECT precio_clase FROM public.configuracion_admin WHERE sistema_activo = true LIMIT 1)
    ) RETURNING id_clase_individual INTO v_clase_id;
    
    RETURN v_clase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para cancelar clase individual
CREATE OR REPLACE FUNCTION cancelar_clase_individual(
    p_clase_id UUID,
    p_motivo TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.clases_individuales 
    SET 
        estado = 'cancelada',
        motivo_cancelacion = p_motivo,
        fecha_cancelacion = NOW(),
        updated_at = NOW()
    WHERE id_clase_individual = p_clase_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar asistencia
CREATE OR REPLACE FUNCTION registrar_asistencia(
    p_clase_id UUID,
    p_asistio BOOLEAN,
    p_calificacion INTEGER DEFAULT NULL,
    p_comentarios TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.clases_individuales 
    SET 
        asistencia = p_asistio,
        calificacion = p_calificacion,
        comentarios_cliente = p_comentarios,
        estado = CASE 
            WHEN p_asistio THEN 'completada'
            ELSE 'no_show'
        END,
        updated_at = NOW()
    WHERE id_clase_individual = p_clase_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas de clases
CREATE OR REPLACE FUNCTION get_estadisticas_clases(
    p_cliente_id UUID DEFAULT NULL,
    p_fecha_desde DATE DEFAULT NULL,
    p_fecha_hasta DATE DEFAULT NULL
)
RETURNS TABLE (
    total_clases BIGINT,
    clases_completadas BIGINT,
    clases_canceladas BIGINT,
    clases_no_show BIGINT,
    promedio_calificacion NUMERIC,
    total_ingresos NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_clases,
        COUNT(CASE WHEN estado = 'completada' THEN 1 END) as clases_completadas,
        COUNT(CASE WHEN estado = 'cancelada' THEN 1 END) as clases_canceladas,
        COUNT(CASE WHEN estado = 'no_show' THEN 1 END) as clases_no_show,
        ROUND(AVG(calificacion), 2) as promedio_calificacion,
        SUM(CASE WHEN pagado THEN precio_cobrado ELSE 0 END) as total_ingresos
    FROM public.clases_individuales ci
    WHERE 
        (p_cliente_id IS NULL OR ci.cliente_id = p_cliente_id)
        AND (p_fecha_desde IS NULL OR ci.fecha_clase >= p_fecha_desde)
        AND (p_fecha_hasta IS NULL OR ci.fecha_clase <= p_fecha_hasta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 6. CREAR TRIGGER PARA SINCRONIZAR CON RESERVAS
-- ==============================================

-- Función para sincronizar estado de reservas cuando cambia una clase
CREATE OR REPLACE FUNCTION sincronizar_estado_reserva()
RETURNS TRIGGER AS $$
DECLARE
    v_reserva_id UUID;
    v_todas_canceladas BOOLEAN;
    v_todas_completadas BOOLEAN;
BEGIN
    -- Obtener ID de reserva
    v_reserva_id := COALESCE(NEW.id_reserva, OLD.id_reserva);
    
    -- Verificar si todas las clases de la reserva están canceladas
    SELECT COUNT(*) = 0 OR COUNT(CASE WHEN estado NOT IN ('cancelada', 'no_show') THEN 1 END) = 0
    INTO v_todas_canceladas
    FROM public.clases_individuales
    WHERE id_reserva = v_reserva_id;
    
    -- Verificar si todas las clases están completadas
    SELECT COUNT(*) = 0 OR COUNT(CASE WHEN estado != 'completada' THEN 1 END) = 0
    INTO v_todas_completadas
    FROM public.clases_individuales
    WHERE id_reserva = v_reserva_id;
    
    -- Actualizar estado de la reserva
    IF v_todas_canceladas THEN
        UPDATE public.reservas_turnos 
        SET estado = 'cancelada', updated_at = NOW()
        WHERE id = v_reserva_id;
    ELSIF v_todas_completadas THEN
        UPDATE public.reservas_turnos 
        SET estado = 'completada', updated_at = NOW()
        WHERE id = v_reserva_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sincronizar_estado_reserva
    AFTER INSERT OR UPDATE OR DELETE ON public.clases_individuales
    FOR EACH ROW
    EXECUTE FUNCTION sincronizar_estado_reserva();

-- ==============================================
-- 7. VERIFICAR CREACIÓN
-- ==============================================

-- Verificar estructura de la tabla
SELECT 
    'TABLA CREADA' as seccion,
    column_name as columna,
    data_type as tipo_dato,
    is_nullable as permite_nulo,
    column_default as valor_default
FROM information_schema.columns 
WHERE table_name = 'clases_individuales' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar políticas RLS
SELECT 
    'POLITICAS RLS' as seccion,
    policyname as nombre_politica,
    cmd as operacion,
    permissive as permisiva
FROM pg_policies 
WHERE tablename = 'clases_individuales'
ORDER BY cmd;

-- Verificar funciones creadas
SELECT 
    'FUNCIONES CREADAS' as seccion,
    routine_name as nombre_funcion,
    routine_type as tipo_funcion
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name LIKE '%clase%'
ORDER BY routine_name;

-- ==============================================
-- 8. DATOS DE PRUEBA (OPCIONAL)
-- ==============================================

-- Insertar datos de prueba si hay reservas existentes
INSERT INTO public.clases_individuales (
    id_reserva,
    turno_id,
    cliente_id,
    fecha_clase,
    hora_inicio,
    hora_fin,
    estado,
    precio_cobrado
)
SELECT 
    rt.id as id_reserva,
    rt.turno_id,
    rt.cliente_id,
    CURRENT_DATE + INTERVAL '1 day' as fecha_clase,
    t.hora_inicio,
    t.hora_fin,
    'programada' as estado,
    COALESCE((SELECT precio_clase FROM public.configuracion_admin WHERE sistema_activo = true LIMIT 1), 1500.00) as precio_cobrado
FROM public.reservas_turnos rt
JOIN public.turnos t ON rt.turno_id = t.id
WHERE rt.estado = 'confirmada'
LIMIT 3
ON CONFLICT DO NOTHING;

-- Mostrar datos de prueba insertados
SELECT 
    'DATOS DE PRUEBA' as seccion,
    COUNT(*) as clases_creadas
FROM public.clases_individuales;

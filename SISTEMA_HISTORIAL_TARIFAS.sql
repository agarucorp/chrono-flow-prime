-- SISTEMA DE HISTORIAL DE TARIFAS
-- Este script implementa un sistema completo de gestión de tarifas con historial

-- ==============================================
-- 1. CREAR TABLA DE HISTORIAL DE TARIFAS
-- ==============================================

CREATE TABLE IF NOT EXISTS historial_tarifas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarifa_horaria NUMERIC(10, 2) NOT NULL CHECK (tarifa_horaria >= 0),
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    fecha_fin TIMESTAMP WITH TIME ZONE,
    vigente BOOLEAN DEFAULT true,
    motivo_cambio TEXT,
    usuario_modificador UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_historial_tarifas_vigente ON historial_tarifas(vigente) WHERE vigente = true;
CREATE INDEX IF NOT EXISTS idx_historial_tarifas_fecha_inicio ON historial_tarifas(fecha_inicio DESC);

-- Comentarios para documentación
COMMENT ON TABLE historial_tarifas IS 'Historial completo de cambios de tarifas del sistema';
COMMENT ON COLUMN historial_tarifas.tarifa_horaria IS 'Valor de la tarifa por hora de clase';
COMMENT ON COLUMN historial_tarifas.fecha_inicio IS 'Fecha desde la cual aplica esta tarifa';
COMMENT ON COLUMN historial_tarifas.fecha_fin IS 'Fecha hasta la cual aplicó esta tarifa (NULL si es vigente)';
COMMENT ON COLUMN historial_tarifas.vigente IS 'Indica si esta es la tarifa actualmente vigente';
COMMENT ON COLUMN historial_tarifas.motivo_cambio IS 'Razón del cambio de tarifa (opcional)';

-- ==============================================
-- 2. FUNCIÓN PARA CAMBIAR TARIFA CON HISTORIAL
-- ==============================================

CREATE OR REPLACE FUNCTION cambiar_tarifa(
    p_nueva_tarifa NUMERIC,
    p_motivo_cambio TEXT DEFAULT NULL,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS TABLE(
    exito BOOLEAN,
    mensaje TEXT,
    tarifa_anterior NUMERIC,
    tarifa_nueva NUMERIC,
    id_historial UUID
) AS $$
DECLARE
    v_tarifa_anterior NUMERIC;
    v_id_historial_nuevo UUID;
    v_ahora TIMESTAMP WITH TIME ZONE;
BEGIN
    v_ahora := NOW();
    
    -- Obtener tarifa actual vigente
    SELECT ht.tarifa_horaria INTO v_tarifa_anterior
    FROM historial_tarifas ht
    WHERE ht.vigente = true
    ORDER BY ht.fecha_inicio DESC
    LIMIT 1;
    
    -- Si no hay tarifa anterior, obtener de configuracion_admin
    IF v_tarifa_anterior IS NULL THEN
        SELECT tarifa_horaria INTO v_tarifa_anterior
        FROM configuracion_admin
        WHERE sistema_activo = true
        ORDER BY created_at DESC
        LIMIT 1;
        
        -- Si existe tarifa en configuracion_admin, crear registro inicial en historial
        IF v_tarifa_anterior IS NOT NULL AND v_tarifa_anterior > 0 THEN
            INSERT INTO historial_tarifas (
                tarifa_horaria,
                fecha_inicio,
                fecha_fin,
                vigente,
                motivo_cambio,
                usuario_modificador
            ) VALUES (
                v_tarifa_anterior,
                v_ahora - INTERVAL '1 second',
                v_ahora,
                false,
                'Migración inicial del sistema',
                p_usuario_id
            );
        ELSE
            v_tarifa_anterior := 0;
        END IF;
    ELSE
        -- Marcar tarifa anterior como no vigente y establecer fecha_fin
        UPDATE historial_tarifas
        SET vigente = false,
            fecha_fin = v_ahora,
            updated_at = v_ahora
        WHERE vigente = true;
    END IF;
    
    -- Crear nueva tarifa vigente
    INSERT INTO historial_tarifas (
        tarifa_horaria,
        fecha_inicio,
        fecha_fin,
        vigente,
        motivo_cambio,
        usuario_modificador
    ) VALUES (
        p_nueva_tarifa,
        v_ahora,
        NULL, -- NULL porque es vigente
        true,
        p_motivo_cambio,
        p_usuario_id
    )
    RETURNING id INTO v_id_historial_nuevo;
    
    -- Actualizar configuracion_admin para mantener sincronización
    UPDATE configuracion_admin
    SET tarifa_horaria = p_nueva_tarifa,
        updated_at = v_ahora
    WHERE sistema_activo = true;
    
    -- Retornar resultado
    RETURN QUERY SELECT 
        true::BOOLEAN,
        ('✅ Tarifa actualizada: $' || v_tarifa_anterior::TEXT || ' → $' || p_nueva_tarifa::TEXT)::TEXT,
        v_tarifa_anterior::NUMERIC,
        p_nueva_tarifa::NUMERIC,
        v_id_historial_nuevo::UUID;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            ('❌ Error al cambiar tarifa: ' || SQLERRM)::TEXT,
            v_tarifa_anterior::NUMERIC,
            p_nueva_tarifa::NUMERIC,
            NULL::UUID;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 3. FUNCIÓN PARA OBTENER TARIFA VIGENTE
-- ==============================================

CREATE OR REPLACE FUNCTION obtener_tarifa_vigente()
RETURNS TABLE(
    tarifa_horaria NUMERIC,
    fecha_inicio TIMESTAMP WITH TIME ZONE,
    motivo_cambio TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ht.tarifa_horaria,
        ht.fecha_inicio,
        ht.motivo_cambio
    FROM historial_tarifas ht
    WHERE ht.vigente = true
    ORDER BY ht.fecha_inicio DESC
    LIMIT 1;
    
    -- Si no hay tarifa en historial, obtener de configuracion_admin
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            ca.tarifa_horaria,
            ca.created_at as fecha_inicio,
            'Tarifa del sistema'::TEXT as motivo_cambio
        FROM configuracion_admin ca
        WHERE ca.sistema_activo = true
        ORDER BY ca.created_at DESC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 4. VISTA PARA CONSULTAR HISTORIAL
-- ==============================================

CREATE OR REPLACE VIEW vista_historial_tarifas AS
SELECT 
    ht.id,
    ht.tarifa_horaria,
    ht.fecha_inicio,
    ht.fecha_fin,
    ht.vigente,
    CASE 
        WHEN ht.vigente THEN '🟢 VIGENTE'
        ELSE '⚪ HISTÓRICA'
    END as estado,
    ht.motivo_cambio,
    p.full_name as modificado_por,
    ht.created_at,
    -- Calcular duración de vigencia en días
    CASE 
        WHEN ht.fecha_fin IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (ht.fecha_fin - ht.fecha_inicio)) / 86400
        ELSE 
            EXTRACT(EPOCH FROM (NOW() - ht.fecha_inicio)) / 86400
    END as dias_vigencia
FROM historial_tarifas ht
LEFT JOIN profiles p ON ht.usuario_modificador = p.id
ORDER BY ht.fecha_inicio DESC;

-- ==============================================
-- 5. POLÍTICAS RLS
-- ==============================================

-- Habilitar RLS
ALTER TABLE historial_tarifas ENABLE ROW LEVEL SECURITY;

-- Política para admin (puede hacer todo)
DROP POLICY IF EXISTS "Admin puede hacer todo con historial_tarifas" ON historial_tarifas;
CREATE POLICY "Admin puede hacer todo con historial_tarifas"
ON historial_tarifas
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Política para alumnos (solo lectura)
DROP POLICY IF EXISTS "Alumnos pueden ver historial_tarifas" ON historial_tarifas;
CREATE POLICY "Alumnos pueden ver historial_tarifas"
ON historial_tarifas
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'alumno'
    )
);

-- ==============================================
-- 6. EJEMPLOS DE USO
-- ==============================================

-- Ejemplo 1: Cambiar tarifa con motivo
-- SELECT * FROM cambiar_tarifa(
--     5000.00,                                    -- Nueva tarifa
--     'Ajuste por inflación',                     -- Motivo
--     '4aa2cada-c59d-4635-bf45-79bafb04b5c7'::UUID -- Usuario admin
-- );

-- Ejemplo 2: Obtener tarifa actual vigente
-- SELECT * FROM obtener_tarifa_vigente();

-- Ejemplo 3: Ver historial completo
-- SELECT * FROM vista_historial_tarifas;

-- Ejemplo 4: Ver solo tarifas vigentes
-- SELECT * FROM historial_tarifas WHERE vigente = true;

-- Ejemplo 5: Ver historial de los últimos 30 días
-- SELECT 
--     tarifa_horaria,
--     fecha_inicio,
--     fecha_fin,
--     motivo_cambio
-- FROM historial_tarifas
-- WHERE fecha_inicio >= NOW() - INTERVAL '30 days'
-- ORDER BY fecha_inicio DESC;

-- ==============================================
-- 7. REPORTES Y ESTADÍSTICAS
-- ==============================================

-- Reporte de cambios de tarifa por mes
CREATE OR REPLACE VIEW reporte_cambios_tarifas_mensual AS
SELECT 
    DATE_TRUNC('month', fecha_inicio) as mes,
    COUNT(*) as cantidad_cambios,
    MIN(tarifa_horaria) as tarifa_minima,
    MAX(tarifa_horaria) as tarifa_maxima,
    AVG(tarifa_horaria) as tarifa_promedio
FROM historial_tarifas
GROUP BY DATE_TRUNC('month', fecha_inicio)
ORDER BY mes DESC;

-- Función para calcular inflación entre dos fechas
CREATE OR REPLACE FUNCTION calcular_inflacion_tarifas(
    p_fecha_desde TIMESTAMP WITH TIME ZONE,
    p_fecha_hasta TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
    tarifa_inicial NUMERIC,
    tarifa_final NUMERIC,
    variacion_absoluta NUMERIC,
    variacion_porcentual NUMERIC
) AS $$
DECLARE
    v_tarifa_inicial NUMERIC;
    v_tarifa_final NUMERIC;
BEGIN
    -- Obtener tarifa inicial
    SELECT ht.tarifa_horaria INTO v_tarifa_inicial
    FROM historial_tarifas ht
    WHERE ht.fecha_inicio <= p_fecha_desde
    ORDER BY ht.fecha_inicio DESC
    LIMIT 1;
    
    -- Obtener tarifa final
    SELECT ht.tarifa_horaria INTO v_tarifa_final
    FROM historial_tarifas ht
    WHERE ht.fecha_inicio <= p_fecha_hasta
    ORDER BY ht.fecha_inicio DESC
    LIMIT 1;
    
    -- Calcular variación
    IF v_tarifa_inicial IS NOT NULL AND v_tarifa_final IS NOT NULL AND v_tarifa_inicial > 0 THEN
        RETURN QUERY SELECT 
            v_tarifa_inicial,
            v_tarifa_final,
            v_tarifa_final - v_tarifa_inicial as variacion_absoluta,
            ((v_tarifa_final - v_tarifa_inicial) / v_tarifa_inicial * 100) as variacion_porcentual;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 8. VERIFICACIÓN Y TESTING
-- ==============================================

-- Verificar que solo haya una tarifa vigente
SELECT 
    COUNT(*) as tarifas_vigentes,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ Correcto'
        WHEN COUNT(*) = 0 THEN '⚠️ Sin tarifa vigente'
        ELSE '❌ Múltiples tarifas vigentes'
    END as estado
FROM historial_tarifas
WHERE vigente = true;

-- Verificar integridad del historial
SELECT 
    'Integridad del historial' as verificacion,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN vigente = true THEN 1 END) as vigentes,
    COUNT(CASE WHEN vigente = false AND fecha_fin IS NULL THEN 1 END) as historicas_sin_fecha_fin
FROM historial_tarifas;

-- ==============================================
-- 9. DOCUMENTACIÓN DEL SISTEMA
-- ==============================================

/*
RESUMEN DEL SISTEMA DE HISTORIAL DE TARIFAS:

1. CARACTERÍSTICAS:
   ✅ Cada cambio de tarifa crea un nuevo registro
   ✅ Se mantiene historial completo sin pérdida de datos
   ✅ Solo una tarifa puede estar vigente a la vez
   ✅ Auditoría completa con usuario modificador y motivo

2. ESTRUCTURA DE DATOS:
   - tarifa_horaria: Valor de la tarifa
   - fecha_inicio: Desde cuándo aplica
   - fecha_fin: Hasta cuándo aplicó (NULL si vigente)
   - vigente: true/false
   - motivo_cambio: Descripción del cambio
   - usuario_modificador: Quién hizo el cambio

3. FLUJO DE CAMBIO DE TARIFA:
   a) Se marca la tarifa actual como no vigente
   b) Se establece fecha_fin en la tarifa anterior
   c) Se crea nueva tarifa con vigente = true
   d) Se sincroniza con configuracion_admin

4. CONSULTAS ÚTILES:
   - Tarifa actual: SELECT * FROM obtener_tarifa_vigente()
   - Historial completo: SELECT * FROM vista_historial_tarifas
   - Cambios mensuales: SELECT * FROM reporte_cambios_tarifas_mensual
   - Inflación: SELECT * FROM calcular_inflacion_tarifas('2024-01-01')

5. BENEFICIOS:
   ✅ Trazabilidad completa
   ✅ Análisis de tendencias
   ✅ Cálculo de inflación
   ✅ Reportes históricos
   ✅ Auditoría de cambios
*/

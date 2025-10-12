-- SISTEMA DE TARIFAS PERSONALIZADAS POR USUARIO
-- Este script implementa tarifas individuales con historial completo

-- ==============================================
-- 1. AGREGAR COLUMNA DE TARIFA PERSONALIZADA A PROFILES
-- ==============================================

-- Agregar tarifa personalizada por usuario
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tarifa_personalizada NUMERIC(10, 2) CHECK (tarifa_personalizada >= 0);

COMMENT ON COLUMN profiles.tarifa_personalizada IS 'Tarifa personalizada por usuario (NULL usa tarifa del sistema)';

-- ==============================================
-- 2. AGREGAR COLUMNA DE USUARIO AFECTADO AL HISTORIAL
-- ==============================================

-- Agregar referencia al usuario afectado por el cambio de tarifa
ALTER TABLE historial_tarifas 
ADD COLUMN IF NOT EXISTS usuario_afectado UUID REFERENCES profiles(id);

-- Crear índice para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_historial_tarifas_usuario_afectado 
ON historial_tarifas(usuario_afectado);

COMMENT ON COLUMN historial_tarifas.usuario_afectado IS 'Usuario al que se le aplicó la tarifa personalizada (NULL = tarifa del sistema)';

-- ==============================================
-- 3. FUNCIÓN PARA CAMBIAR TARIFA DE USUARIO ESPECÍFICO
-- ==============================================

CREATE OR REPLACE FUNCTION cambiar_tarifa_usuario(
    p_usuario_afectado UUID,
    p_nueva_tarifa NUMERIC,
    p_motivo_cambio TEXT DEFAULT NULL,
    p_usuario_modificador UUID DEFAULT NULL
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
    v_nombre_usuario TEXT;
BEGIN
    v_ahora := NOW();
    
    -- Verificar que el usuario existe
    SELECT full_name INTO v_nombre_usuario
    FROM profiles
    WHERE id = p_usuario_afectado;
    
    IF v_nombre_usuario IS NULL THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            '❌ Usuario no encontrado'::TEXT,
            0::NUMERIC,
            0::NUMERIC,
            NULL::UUID;
        RETURN;
    END IF;
    
    -- Obtener tarifa anterior del usuario
    SELECT tarifa_personalizada INTO v_tarifa_anterior
    FROM profiles
    WHERE id = p_usuario_afectado;
    
    -- Si no tenía tarifa personalizada, obtener tarifa del sistema
    IF v_tarifa_anterior IS NULL THEN
        SELECT tarifa_horaria INTO v_tarifa_anterior
        FROM configuracion_admin
        WHERE sistema_activo = true
        ORDER BY created_at DESC
        LIMIT 1;
        
        v_tarifa_anterior := COALESCE(v_tarifa_anterior, 0);
    END IF;
    
    -- Marcar tarifa anterior del usuario como no vigente en el historial
    UPDATE historial_tarifas
    SET vigente = false,
        fecha_fin = v_ahora,
        updated_at = v_ahora
    WHERE usuario_afectado = p_usuario_afectado
    AND vigente = true;
    
    -- Actualizar tarifa personalizada en profiles
    UPDATE profiles
    SET tarifa_personalizada = p_nueva_tarifa,
        updated_at = v_ahora
    WHERE id = p_usuario_afectado;
    
    -- Crear registro en historial
    INSERT INTO historial_tarifas (
        tarifa_horaria,
        fecha_inicio,
        fecha_fin,
        vigente,
        motivo_cambio,
        usuario_modificador,
        usuario_afectado
    ) VALUES (
        p_nueva_tarifa,
        v_ahora,
        NULL,
        true,
        COALESCE(p_motivo_cambio, 'Tarifa personalizada'),
        p_usuario_modificador,
        p_usuario_afectado
    )
    RETURNING id INTO v_id_historial_nuevo;
    
    -- Retornar resultado
    RETURN QUERY SELECT 
        true::BOOLEAN,
        ('✅ Tarifa de ' || v_nombre_usuario || ' actualizada: $' || v_tarifa_anterior::TEXT || ' → $' || p_nueva_tarifa::TEXT)::TEXT,
        v_tarifa_anterior::NUMERIC,
        p_nueva_tarifa::NUMERIC,
        v_id_historial_nuevo::UUID;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            ('❌ Error: ' || SQLERRM)::TEXT,
            v_tarifa_anterior::NUMERIC,
            p_nueva_tarifa::NUMERIC,
            NULL::UUID;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 4. FUNCIÓN PARA OBTENER TARIFA EFECTIVA DE USUARIO
-- ==============================================

CREATE OR REPLACE FUNCTION obtener_tarifa_usuario(p_usuario_id UUID)
RETURNS TABLE(
    tarifa_efectiva NUMERIC,
    es_personalizada BOOLEAN,
    origen TEXT
) AS $$
DECLARE
    v_tarifa_personalizada NUMERIC;
    v_tarifa_sistema NUMERIC;
BEGIN
    -- Obtener tarifa personalizada del usuario
    SELECT tarifa_personalizada INTO v_tarifa_personalizada
    FROM profiles
    WHERE id = p_usuario_id;
    
    -- Si tiene tarifa personalizada, usarla
    IF v_tarifa_personalizada IS NOT NULL THEN
        RETURN QUERY SELECT 
            v_tarifa_personalizada,
            true::BOOLEAN,
            'Tarifa personalizada'::TEXT;
        RETURN;
    END IF;
    
    -- Si no, usar tarifa del sistema
    SELECT tarifa_horaria INTO v_tarifa_sistema
    FROM configuracion_admin
    WHERE sistema_activo = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN QUERY SELECT 
        COALESCE(v_tarifa_sistema, 0::NUMERIC),
        false::BOOLEAN,
        'Tarifa del sistema'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 5. ACTUALIZAR VISTA DE HISTORIAL
-- ==============================================

DROP VIEW IF EXISTS vista_historial_tarifas CASCADE;

CREATE VIEW vista_historial_tarifas AS
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
    p_modificador.full_name as modificado_por,
    p_afectado.full_name as usuario_afectado_nombre,
    p_afectado.email as usuario_afectado_email,
    ht.usuario_afectado as usuario_afectado_id,
    CASE 
        WHEN ht.usuario_afectado IS NULL THEN '🌐 Sistema'
        ELSE '👤 ' || p_afectado.full_name
    END as tipo_tarifa,
    ht.created_at,
    -- Calcular duración de vigencia en días
    CASE 
        WHEN ht.fecha_fin IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (ht.fecha_fin - ht.fecha_inicio)) / 86400
        ELSE 
            EXTRACT(EPOCH FROM (NOW() - ht.fecha_inicio)) / 86400
    END as dias_vigencia
FROM historial_tarifas ht
LEFT JOIN profiles p_modificador ON ht.usuario_modificador = p_modificador.id
LEFT JOIN profiles p_afectado ON ht.usuario_afectado = p_afectado.id
ORDER BY ht.fecha_inicio DESC;

-- ==============================================
-- 6. VISTA DE USUARIOS CON SUS TARIFAS
-- ==============================================

CREATE OR REPLACE VIEW vista_usuarios_tarifas AS
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.tarifa_personalizada,
    COALESCE(
        p.tarifa_personalizada,
        (SELECT tarifa_horaria FROM configuracion_admin WHERE sistema_activo = true ORDER BY created_at DESC LIMIT 1)
    ) as tarifa_efectiva,
    CASE 
        WHEN p.tarifa_personalizada IS NOT NULL THEN true
        ELSE false
    END as tiene_tarifa_personalizada,
    CASE 
        WHEN p.tarifa_personalizada IS NOT NULL THEN '👤 Personalizada'
        ELSE '🌐 Sistema'
    END as tipo_tarifa,
    p.role,
    p.created_at
FROM profiles p
WHERE p.role != 'admin'
ORDER BY p.full_name;

-- ==============================================
-- 7. EJEMPLOS DE USO
-- ==============================================

-- Ejemplo 1: Cambiar tarifa de un usuario específico
-- SELECT * FROM cambiar_tarifa_usuario(
--     'ca4107a3-6f19-40dd-ad92-3bc69ebb8c29'::UUID,  -- ID del usuario
--     4500.00,                                         -- Nueva tarifa
--     'Descuento por antigüedad',                      -- Motivo
--     '4aa2cada-c59d-4635-bf45-79bafb04b5c7'::UUID    -- Admin que hace el cambio
-- );

-- Ejemplo 2: Obtener tarifa efectiva de un usuario
-- SELECT * FROM obtener_tarifa_usuario('ca4107a3-6f19-40dd-ad92-3bc69ebb8c29'::UUID);

-- Ejemplo 3: Ver todos los usuarios con sus tarifas
-- SELECT * FROM vista_usuarios_tarifas;

-- Ejemplo 4: Ver historial de tarifas de un usuario específico
-- SELECT 
--     tarifa_horaria,
--     fecha_inicio,
--     fecha_fin,
--     estado,
--     motivo_cambio,
--     modificado_por
-- FROM vista_historial_tarifas
-- WHERE usuario_afectado_id = 'ca4107a3-6f19-40dd-ad92-3bc69ebb8c29'
-- ORDER BY fecha_inicio DESC;

-- Ejemplo 5: Ver historial completo (sistema + usuarios)
-- SELECT 
--     tipo_tarifa,
--     usuario_afectado_nombre,
--     tarifa_horaria,
--     estado,
--     motivo_cambio,
--     modificado_por,
--     fecha_inicio
-- FROM vista_historial_tarifas
-- ORDER BY fecha_inicio DESC;

-- ==============================================
-- 8. REPORTES Y ESTADÍSTICAS
-- ==============================================

-- Reporte de usuarios con tarifas personalizadas
CREATE OR REPLACE VIEW reporte_tarifas_personalizadas AS
SELECT 
    COUNT(*) FILTER (WHERE tarifa_personalizada IS NOT NULL) as con_tarifa_personalizada,
    COUNT(*) FILTER (WHERE tarifa_personalizada IS NULL) as con_tarifa_sistema,
    COUNT(*) as total_usuarios,
    ROUND(AVG(tarifa_personalizada), 2) as promedio_tarifas_personalizadas,
    MIN(tarifa_personalizada) as tarifa_minima,
    MAX(tarifa_personalizada) as tarifa_maxima
FROM profiles
WHERE role != 'admin';

-- ==============================================
-- 9. DOCUMENTACIÓN DEL SISTEMA
-- ==============================================

/*
RESUMEN DEL SISTEMA DE TARIFAS PERSONALIZADAS:

1. ESTRUCTURA:
   ✅ profiles.tarifa_personalizada: Tarifa específica del usuario (NULL = usa sistema)
   ✅ historial_tarifas.usuario_afectado: Registro de a quién se aplicó el cambio
   ✅ Sincronización automática entre profiles y historial

2. JERARQUÍA DE TARIFAS:
   a) Si usuario tiene tarifa_personalizada → Usa esa
   b) Si no → Usa tarifa del sistema (configuracion_admin.tarifa_horaria)

3. HISTORIAL COMPLETO:
   ✅ Cada cambio genera nuevo registro
   ✅ Se registra quién lo modificó
   ✅ Se registra a quién afecta
   ✅ Se registra motivo del cambio
   ✅ Se mantiene fecha de inicio y fin

4. VENTAJAS:
   ✅ Tarifas diferenciadas por usuario
   ✅ Descuentos especiales
   ✅ Promociones individuales
   ✅ Historial completo de cambios
   ✅ Auditoría total
   ✅ Sin duplicación de tablas
   ✅ Optimizado para consultas rápidas

5. OPTIMIZACIÓN:
   ✅ Solo 1 columna extra en profiles
   ✅ Solo 1 columna extra en historial_tarifas
   ✅ Sin tablas nuevas innecesarias
   ✅ Índices para búsquedas rápidas
   ✅ Vistas para consultas comunes
*/

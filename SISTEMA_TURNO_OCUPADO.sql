-- SISTEMA DE CONTROL DE CAPACIDAD CON TURNO_OCUPADO
-- Este script implementa el sistema de control de capacidad con contador de sesiones/clases

-- ==============================================
-- 1. ESTRUCTURA DE LA COLUMNA TURNO_OCUPADO
-- ==============================================

-- La columna turno_ocupado en horarios_recurrentes_usuario funciona como:
-- 0 = Clase disponible (no llena)
-- 1 = Clase ocupada (capacidad agotada)

SELECT 
    'ESTRUCTURA TURNO_OCUPADO' as descripcion,
    '0 = Clase disponible' as valor_0,
    '1 = Clase ocupada' as valor_1;

-- ==============================================
-- 2. FUNCIÓN DE ACTUALIZACIÓN AUTOMÁTICA
-- ==============================================

-- Función que actualiza turno_ocupado basándose en la capacidad
CREATE OR REPLACE FUNCTION actualizar_turno_ocupado()
RETURNS void AS $$
BEGIN
    -- Actualizar turno_ocupado basándose en la capacidad disponible
    UPDATE horarios_recurrentes_usuario 
    SET turno_ocupado = CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM horarios_recurrentes_usuario hru2
            WHERE hru2.dia_semana = horarios_recurrentes_usuario.dia_semana
            AND hru2.hora_inicio = horarios_recurrentes_usuario.hora_inicio
            AND hru2.hora_fin = horarios_recurrentes_usuario.hora_fin
            AND hru2.activo = true
        ) >= (
            SELECT capacidad 
            FROM horarios_semanales hs
            WHERE hs.dia_semana = horarios_recurrentes_usuario.dia_semana
            AND hs.hora_inicio = horarios_recurrentes_usuario.hora_inicio
            AND hs.hora_fin = horarios_recurrentes_usuario.hora_fin
            AND hs.activo = true
        ) THEN 1
        ELSE 0
    END,
    updated_at = NOW()
    WHERE activo = true;
    
    -- Log de la actualización
    RAISE NOTICE 'turno_ocupado actualizado en horarios_recurrentes_usuario';
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 3. TRIGGERS AUTOMÁTICOS
-- ==============================================

-- Función para triggers
CREATE OR REPLACE FUNCTION trigger_actualizar_turno_ocupado()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar turno_ocupado después de cualquier cambio
    PERFORM actualizar_turno_ocupado();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para cambios en horarios_recurrentes_usuario
DROP TRIGGER IF EXISTS trigger_actualizar_turno_ocupado_insert ON horarios_recurrentes_usuario;
CREATE TRIGGER trigger_actualizar_turno_ocupado_insert
    AFTER INSERT ON horarios_recurrentes_usuario
    FOR EACH ROW
    EXECUTE FUNCTION trigger_actualizar_turno_ocupado();

DROP TRIGGER IF EXISTS trigger_actualizar_turno_ocupado_update ON horarios_recurrentes_usuario;
CREATE TRIGGER trigger_actualizar_turno_ocupado_update
    AFTER UPDATE ON horarios_recurrentes_usuario
    FOR EACH ROW
    EXECUTE FUNCTION trigger_actualizar_turno_ocupado();

DROP TRIGGER IF EXISTS trigger_actualizar_turno_ocupado_delete ON horarios_recurrentes_usuario;
CREATE TRIGGER trigger_actualizar_turno_ocupado_delete
    AFTER DELETE ON horarios_recurrentes_usuario
    FOR EACH ROW
    EXECUTE FUNCTION trigger_actualizar_turno_ocupado();

-- Trigger para cambios de capacidad en horarios_semanales
DROP TRIGGER IF EXISTS trigger_actualizar_turno_ocupado_capacidad ON horarios_semanales;
CREATE TRIGGER trigger_actualizar_turno_ocupado_capacidad
    AFTER UPDATE OF capacidad ON horarios_semanales
    FOR EACH ROW
    WHEN (OLD.capacidad IS DISTINCT FROM NEW.capacidad)
    EXECUTE FUNCTION trigger_actualizar_turno_ocupado();

-- ==============================================
-- 4. VERIFICAR ESTADO ACTUAL
-- ==============================================

-- Ejecutar actualización manual
SELECT actualizar_turno_ocupado();

-- Verificar el estado de turno_ocupado
SELECT 
    dia_semana,
    hora_inicio,
    hora_fin,
    turno_ocupado,
    CASE turno_ocupado
        WHEN 0 THEN '🟢 DISPONIBLE'
        WHEN 1 THEN '🔴 OCUPADO'
    END as estado_clase
FROM horarios_recurrentes_usuario
WHERE activo = true
ORDER BY dia_semana, hora_inicio, turno_ocupado DESC;

-- ==============================================
-- 5. ESTADÍSTICAS DE OCUPACIÓN
-- ==============================================

-- Resumen de clases ocupadas vs disponibles
SELECT 
    turno_ocupado,
    COUNT(*) as cantidad_alumnos,
    CASE turno_ocupado
        WHEN 0 THEN 'Clases Disponibles'
        WHEN 1 THEN 'Clases Ocupadas'
    END as descripcion
FROM horarios_recurrentes_usuario
WHERE activo = true
GROUP BY turno_ocupado
ORDER BY turno_ocupado;

-- ==============================================
-- 6. HORARIOS POR ESTADO DE OCUPACIÓN
-- ==============================================

-- Ver horarios agrupados por día y estado
SELECT 
    CASE dia_semana
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
        WHEN 7 THEN 'Domingo'
    END as dia,
    hora_inicio,
    hora_fin,
    COUNT(*) as total_alumnos,
    MAX(turno_ocupado) as clase_ocupada,
    CASE MAX(turno_ocupado)
        WHEN 0 THEN '🟢 Disponible'
        WHEN 1 THEN '🔴 Ocupada'
    END as estado
FROM horarios_recurrentes_usuario
WHERE activo = true
GROUP BY dia_semana, hora_inicio, hora_fin
ORDER BY dia_semana, hora_inicio;

-- ==============================================
-- 7. LINKEO ENTRE TABLAS
-- ==============================================

-- Verificar el linkeo entre horarios_semanales y horarios_recurrentes_usuario
SELECT 
    'LINKEO DE TABLAS' as descripcion,
    'horarios_semanales.capacidad' as tabla_1,
    'horarios_recurrentes_usuario.turno_ocupado' as tabla_2,
    'Sincronización automática via triggers' as metodo;


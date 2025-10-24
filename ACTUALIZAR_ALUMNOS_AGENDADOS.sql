-- SISTEMA DE ACTUALIZACIÓN AUTOMÁTICA DE ALUMNOS_AGENDADOS
-- Este script mantiene sincronizada la columna alumnos_agendados en horarios_semanales

-- ==============================================
-- 1. FUNCIÓN PRINCIPAL DE ACTUALIZACIÓN
-- ==============================================

-- Función que cuenta los alumnos agendados para cada horario semanal
CREATE OR REPLACE FUNCTION actualizar_alumnos_agendados()
RETURNS void AS $$
BEGIN
    -- Actualizar alumnos_agendados basándose en horarios_recurrentes_usuario
    UPDATE horarios_semanales 
    SET alumnos_agendados = (
        SELECT COUNT(*)
        FROM horarios_recurrentes_usuario hru
        WHERE hru.dia_semana = horarios_semanales.dia_semana
        AND hru.hora_inicio = horarios_semanales.hora_inicio
        AND hru.hora_fin = horarios_semanales.hora_fin
        AND hru.activo = true
    ),
    updated_at = NOW()
    WHERE activo = true;
    
    -- Log de la actualización
    RAISE NOTICE 'alumnos_agendados actualizado en horarios_semanales';
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 2. TRIGGERS AUTOMÁTICOS
-- ==============================================

-- Función para los triggers
CREATE OR REPLACE FUNCTION trigger_actualizar_alumnos_agendados()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar alumnos_agendados después de cualquier cambio en horarios_recurrentes_usuario
    PERFORM actualizar_alumnos_agendados();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trigger_actualizar_alumnos_agendados_insert ON horarios_recurrentes_usuario;
CREATE TRIGGER trigger_actualizar_alumnos_agendados_insert
    AFTER INSERT ON horarios_recurrentes_usuario
    FOR EACH ROW
    EXECUTE FUNCTION trigger_actualizar_alumnos_agendados();

DROP TRIGGER IF EXISTS trigger_actualizar_alumnos_agendados_update ON horarios_recurrentes_usuario;
CREATE TRIGGER trigger_actualizar_alumnos_agendados_update
    AFTER UPDATE ON horarios_recurrentes_usuario
    FOR EACH ROW
    EXECUTE FUNCTION trigger_actualizar_alumnos_agendados();

DROP TRIGGER IF EXISTS trigger_actualizar_alumnos_agendados_delete ON horarios_recurrentes_usuario;
CREATE TRIGGER trigger_actualizar_alumnos_agendados_delete
    AFTER DELETE ON horarios_recurrentes_usuario
    FOR EACH ROW
    EXECUTE FUNCTION trigger_actualizar_alumnos_agendados();

-- ==============================================
-- 3. VERIFICAR FUNCIONAMIENTO
-- ==============================================

-- Ejecutar actualización manual
SELECT actualizar_alumnos_agendados();

-- Verificar resultados
SELECT 
    dia_semana,
    hora_inicio,
    hora_fin,
    capacidad,
    alumnos_agendados,
    CASE 
        WHEN alumnos_agendados >= capacidad THEN '🔴 LLENO'
        WHEN alumnos_agendados >= capacidad * 0.8 THEN '🟡 CASI LLENO'
        ELSE '🟢 DISPONIBLE'
    END as estado
FROM horarios_semanales
WHERE activo = true
ORDER BY dia_semana, hora_inicio;

-- ==============================================
-- 4. ESTADÍSTICAS DE OCUPACIÓN
-- ==============================================

-- Resumen de ocupación por día
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
    COUNT(*) as total_horarios,
    SUM(alumnos_agendados) as total_alumnos,
    ROUND(AVG(alumnos_agendados::numeric), 2) as promedio_alumnos_por_horario,
    ROUND(SUM(alumnos_agendados::numeric) / SUM(capacidad::numeric) * 100, 2) as porcentaje_ocupacion
FROM horarios_semanales
WHERE activo = true
GROUP BY dia_semana
ORDER BY dia_semana;

-- ==============================================
-- 5. HORARIOS CON MAYOR DEMANDA
-- ==============================================

-- Top 5 horarios con más alumnos agendados
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
    alumnos_agendados,
    capacidad,
    ROUND(alumnos_agendados::numeric / capacidad::numeric * 100, 2) as porcentaje_ocupacion
FROM horarios_semanales
WHERE activo = true AND alumnos_agendados > 0
ORDER BY alumnos_agendados DESC
LIMIT 5;


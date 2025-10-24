-- SISTEMA DE BLOQUEO AUTOMÁTICO Y MANUAL DE CLASES
-- Este script implementa el control de disponibilidad y bloqueo de horarios

-- ==============================================
-- 1. MODIFICAR RESTRICCIONES PARA PERMITIR BLOQUEO
-- ==============================================

-- Permitir capacidad = 0 para bloquear clases
ALTER TABLE horarios_semanales 
DROP CONSTRAINT IF EXISTS horarios_semanales_capacidad_check;

ALTER TABLE horarios_semanales 
ADD CONSTRAINT horarios_semanales_capacidad_check CHECK (capacidad >= 0);

-- Permitir bloquear incluso cuando hay alumnos agendados
ALTER TABLE horarios_semanales 
DROP CONSTRAINT IF EXISTS chk_alumnos_no_excede_capacidad;

ALTER TABLE horarios_semanales 
ADD CONSTRAINT chk_alumnos_no_excede_capacidad 
CHECK (capacidad = 0 OR alumnos_agendados <= capacidad);

-- ==============================================
-- 2. FUNCIÓN PARA VERIFICAR DISPONIBILIDAD
-- ==============================================

-- Verifica si un horario está disponible para que un usuario reserve
CREATE OR REPLACE FUNCTION verificar_horario_disponible(
    p_dia_semana INTEGER,
    p_hora_inicio TIME,
    p_hora_fin TIME,
    p_usuario_id UUID
)
RETURNS TABLE(
    disponible BOOLEAN,
    mensaje TEXT,
    capacidad INTEGER,
    alumnos_agendados INTEGER,
    clase_bloqueada BOOLEAN
) AS $$
DECLARE
    v_capacidad INTEGER;
    v_alumnos_agendados INTEGER;
    v_ya_tiene_reserva BOOLEAN;
BEGIN
    -- Obtener capacidad del horario
    SELECT hs.capacidad INTO v_capacidad
    FROM horarios_semanales hs
    WHERE hs.dia_semana = p_dia_semana 
    AND hs.hora_inicio = p_hora_inicio 
    AND hs.hora_fin = p_hora_fin 
    AND hs.activo = true;
    
    -- Si no se encuentra el horario, no está disponible
    IF v_capacidad IS NULL THEN
        RETURN QUERY SELECT 
            false::BOOLEAN, 
            'Horario no disponible'::TEXT,
            0::INTEGER,
            0::INTEGER,
            true::BOOLEAN;
        RETURN;
    END IF;
    
    -- Contar alumnos agendados
    SELECT COUNT(*) INTO v_alumnos_agendados
    FROM horarios_recurrentes_usuario
    WHERE dia_semana = p_dia_semana 
    AND hora_inicio = p_hora_inicio 
    AND hora_fin = p_hora_fin 
    AND activo = true;
    
    -- Verificar si el usuario ya tiene reserva en este horario
    SELECT EXISTS(
        SELECT 1 
        FROM horarios_recurrentes_usuario
        WHERE dia_semana = p_dia_semana 
        AND hora_inicio = p_hora_inicio 
        AND hora_fin = p_hora_fin 
        AND usuario_id = p_usuario_id
        AND activo = true
    ) INTO v_ya_tiene_reserva;
    
    -- CASO 1: Capacidad = 0 (Clase bloqueada manualmente)
    IF v_capacidad = 0 THEN
        RETURN QUERY SELECT 
            false::BOOLEAN, 
            '🔒 Clase bloqueada - No disponible para reservas'::TEXT,
            v_capacidad::INTEGER,
            v_alumnos_agendados::INTEGER,
            true::BOOLEAN;
        RETURN;
    END IF;
    
    -- CASO 2: Usuario ya tiene reserva
    IF v_ya_tiene_reserva THEN
        RETURN QUERY SELECT 
            false::BOOLEAN, 
            'Ya tienes una reserva en este horario'::TEXT,
            v_capacidad::INTEGER,
            v_alumnos_agendados::INTEGER,
            false::BOOLEAN;
        RETURN;
    END IF;
    
    -- CASO 3: Clase llena (turno_ocupado = 1)
    IF v_alumnos_agendados >= v_capacidad THEN
        RETURN QUERY SELECT 
            false::BOOLEAN, 
            '🔴 Clase completa - Capacidad máxima alcanzada'::TEXT,
            v_capacidad::INTEGER,
            v_alumnos_agendados::INTEGER,
            true::BOOLEAN;
        RETURN;
    END IF;
    
    -- CASO 4: Horario disponible
    RETURN QUERY SELECT 
        true::BOOLEAN, 
        ('🟢 Disponible - ' || (v_capacidad - v_alumnos_agendados)::TEXT || ' lugares disponibles')::TEXT,
        v_capacidad::INTEGER,
        v_alumnos_agendados::INTEGER,
        false::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 3. FUNCIÓN PARA BLOQUEAR/DESBLOQUEAR HORARIO ESPECÍFICO
-- ==============================================

-- Bloquea o desbloquea un horario específico
CREATE OR REPLACE FUNCTION bloquear_horario(
    p_dia_semana INTEGER,
    p_hora_inicio TIME,
    p_hora_fin TIME,
    p_bloquear BOOLEAN DEFAULT true
)
RETURNS TABLE(
    exito BOOLEAN,
    mensaje TEXT,
    capacidad_anterior INTEGER,
    capacidad_nueva INTEGER
) AS $$
DECLARE
    v_capacidad_anterior INTEGER;
    v_capacidad_admin INTEGER;
BEGIN
    -- Obtener capacidad actual del horario
    SELECT hs.capacidad INTO v_capacidad_anterior
    FROM horarios_semanales hs
    WHERE hs.dia_semana = p_dia_semana 
    AND hs.hora_inicio = p_hora_inicio 
    AND hs.hora_fin = p_hora_fin 
    AND hs.activo = true;
    
    -- Si no se encuentra el horario
    IF v_capacidad_anterior IS NULL THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            'Horario no encontrado'::TEXT,
            0::INTEGER,
            0::INTEGER;
        RETURN;
    END IF;
    
    -- Si queremos bloquear (capacidad = 0)
    IF p_bloquear THEN
        UPDATE horarios_semanales
        SET capacidad = 0,
            updated_at = NOW()
        WHERE dia_semana = p_dia_semana 
        AND hora_inicio = p_hora_inicio 
        AND hora_fin = p_hora_fin 
        AND activo = true;
        
        RETURN QUERY SELECT 
            true::BOOLEAN,
            '🔒 Horario bloqueado exitosamente'::TEXT,
            v_capacidad_anterior::INTEGER,
            0::INTEGER;
    ELSE
        -- Si queremos desbloquear, restaurar capacidad desde configuracion_admin
        SELECT max_alumnos_por_clase INTO v_capacidad_admin
        FROM configuracion_admin
        WHERE sistema_activo = true
        ORDER BY created_at DESC
        LIMIT 1;
        
        -- Si no hay configuración, usar valor por defecto
        v_capacidad_admin := COALESCE(v_capacidad_admin, 10);
        
        UPDATE horarios_semanales
        SET capacidad = v_capacidad_admin,
            updated_at = NOW()
        WHERE dia_semana = p_dia_semana 
        AND hora_inicio = p_hora_inicio 
        AND hora_fin = p_hora_fin 
        AND activo = true;
        
        RETURN QUERY SELECT 
            true::BOOLEAN,
            ('🔓 Horario desbloqueado - Capacidad restaurada a ' || v_capacidad_admin::TEXT)::TEXT,
            v_capacidad_anterior::INTEGER,
            v_capacidad_admin::INTEGER;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 4. FUNCIÓN PARA BLOQUEAR/DESBLOQUEAR DÍA COMPLETO
-- ==============================================

-- Bloquea o desbloquea todos los horarios de un día
CREATE OR REPLACE FUNCTION bloquear_dia_completo(
    p_dia_semana INTEGER,
    p_bloquear BOOLEAN DEFAULT true
)
RETURNS TABLE(
    exito BOOLEAN,
    mensaje TEXT,
    horarios_afectados INTEGER
) AS $$
DECLARE
    v_horarios_afectados INTEGER;
    v_capacidad_admin INTEGER;
BEGIN
    -- Obtener capacidad desde configuracion_admin para desbloqueo
    IF NOT p_bloquear THEN
        SELECT max_alumnos_por_clase INTO v_capacidad_admin
        FROM configuracion_admin
        WHERE sistema_activo = true
        ORDER BY created_at DESC
        LIMIT 1;
        
        v_capacidad_admin := COALESCE(v_capacidad_admin, 10);
    END IF;
    
    -- Bloquear o desbloquear todos los horarios del día
    IF p_bloquear THEN
        UPDATE horarios_semanales
        SET capacidad = 0,
            updated_at = NOW()
        WHERE dia_semana = p_dia_semana 
        AND activo = true;
    ELSE
        UPDATE horarios_semanales
        SET capacidad = v_capacidad_admin,
            updated_at = NOW()
        WHERE dia_semana = p_dia_semana 
        AND activo = true;
    END IF;
    
    GET DIAGNOSTICS v_horarios_afectados = ROW_COUNT;
    
    IF v_horarios_afectados = 0 THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            'No se encontraron horarios para este día'::TEXT,
            0::INTEGER;
        RETURN;
    END IF;
    
    IF p_bloquear THEN
        RETURN QUERY SELECT 
            true::BOOLEAN,
            ('🔒 Día bloqueado - ' || v_horarios_afectados::TEXT || ' horarios bloqueados')::TEXT,
            v_horarios_afectados::INTEGER;
    ELSE
        RETURN QUERY SELECT 
            true::BOOLEAN,
            ('🔓 Día desbloqueado - ' || v_horarios_afectados::TEXT || ' horarios restaurados con capacidad ' || v_capacidad_admin::TEXT)::TEXT,
            v_horarios_afectados::INTEGER;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 5. EJEMPLOS DE USO
-- ==============================================

-- Ejemplo 1: Verificar disponibilidad de un horario
-- SELECT * FROM verificar_horario_disponible(
--     1,                                          -- Lunes
--     '09:00:00',                                 -- 9 AM
--     '10:00:00',                                 -- 10 AM
--     '4aa2cada-c59d-4635-bf45-79bafb04b5c7'::UUID -- ID del usuario
-- );

-- Ejemplo 2: Bloquear un horario específico (día no laborable)
-- SELECT * FROM bloquear_horario(1, '09:00:00', '10:00:00', true);

-- Ejemplo 3: Desbloquear un horario
-- SELECT * FROM bloquear_horario(1, '09:00:00', '10:00:00', false);

-- Ejemplo 4: Bloquear un día completo (ej: feriado)
-- SELECT * FROM bloquear_dia_completo(1, true); -- Bloquear Lunes

-- Ejemplo 5: Desbloquear un día completo
-- SELECT * FROM bloquear_dia_completo(1, false); -- Desbloquear Lunes

-- ==============================================
-- 6. VERIFICAR ESTADO DE HORARIOS
-- ==============================================

-- Ver todos los horarios con su estado de bloqueo
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
    capacidad,
    alumnos_agendados,
    CASE 
        WHEN capacidad = 0 THEN '🔒 BLOQUEADO'
        WHEN alumnos_agendados >= capacidad THEN '🔴 LLENO'
        WHEN alumnos_agendados >= capacidad * 0.8 THEN '🟡 CASI LLENO'
        ELSE '🟢 DISPONIBLE'
    END as estado
FROM horarios_semanales
WHERE activo = true
ORDER BY dia_semana, hora_inicio;

-- ==============================================
-- 7. ESTADÍSTICAS DE BLOQUEO
-- ==============================================

-- Resumen de horarios bloqueados vs disponibles
SELECT 
    CASE 
        WHEN capacidad = 0 THEN 'Bloqueados'
        ELSE 'Disponibles'
    END as estado,
    COUNT(*) as cantidad_horarios
FROM horarios_semanales
WHERE activo = true
GROUP BY CASE WHEN capacidad = 0 THEN 'Bloqueados' ELSE 'Disponibles' END;

-- ==============================================
-- 8. DOCUMENTACIÓN DEL SISTEMA
-- ==============================================

/*
RESUMEN DEL SISTEMA DE BLOQUEO:

1. BLOQUEO AUTOMÁTICO (turno_ocupado = 1):
   - Se activa cuando alumnos_agendados >= capacidad
   - Impide nuevas reservas automáticamente
   - Se actualiza en tiempo real via triggers

2. BLOQUEO MANUAL (capacidad = 0):
   - El admin puede bloquear horarios específicos
   - El admin puede bloquear días completos
   - Útil para: feriados, días no laborables, eventos especiales

3. FLUJO DE RESERVA:
   a) Usuario intenta reservar
   b) Sistema verifica con verificar_horario_disponible()
   c) Si capacidad = 0 → Bloqueado manualmente
   d) Si alumnos_agendados >= capacidad → Clase llena
   e) Si disponible → Permite reserva

4. DESBLOQUEO:
   - Al desbloquear, se restaura capacidad desde configuracion_admin
   - Mantiene sincronización con el master switch global
*/

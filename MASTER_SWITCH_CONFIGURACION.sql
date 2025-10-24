-- MASTER SWITCH DE CONFIGURACIÓN ADMIN
-- Documentación de cómo funciona el sistema de configuración global

-- ==============================================
-- 1. TABLA MAESTRA: configuracion_admin
-- ==============================================

-- Esta tabla actúa como el master switch del sistema
-- Cualquier cambio aquí debe propagarse a todas las tablas relacionadas

SELECT 
    'configuracion_admin' as tabla_maestra,
    max_alumnos_por_clase,
    tarifa_horaria,
    horario_apertura,
    horario_cierre,
    sistema_activo
FROM configuracion_admin
WHERE sistema_activo = true;

-- ==============================================
-- 2. PROPAGACIÓN AUTOMÁTICA A horarios_semanales
-- ==============================================

-- Cuando se cambia max_alumnos_por_clase en configuracion_admin,
-- automáticamente se actualiza la columna capacidad en horarios_semanales

SELECT 
    'horarios_semanales' as tabla_afectada,
    COUNT(*) as total_horarios,
    MIN(capacidad) as capacidad_minima,
    MAX(capacidad) as capacidad_maxima,
    COUNT(CASE WHEN capacidad = (SELECT max_alumnos_por_clase FROM configuracion_admin WHERE sistema_activo = true) THEN 1 END) as horarios_sincronizados
FROM horarios_semanales
WHERE activo = true;

-- ==============================================
-- 3. VERIFICAR SINCRONIZACIÓN
-- ==============================================

-- Verificar que la capacidad esté sincronizada entre ambas tablas
SELECT 
    CASE 
        WHEN (
            SELECT max_alumnos_por_clase 
            FROM configuracion_admin 
            WHERE sistema_activo = true
        ) = (
            SELECT MIN(capacidad) 
            FROM horarios_semanales 
            WHERE activo = true
        ) AND (
            SELECT MIN(capacidad) 
            FROM horarios_semanales 
            WHERE activo = true
        ) = (
            SELECT MAX(capacidad) 
            FROM horarios_semanales 
            WHERE activo = true
        )
        THEN '✅ SINCRONIZADO'
        ELSE '❌ DESINCRONIZADO'
    END as estado_sincronizacion,
    
    (SELECT max_alumnos_por_clase FROM configuracion_admin WHERE sistema_activo = true) as capacidad_configuracion_admin,
    (SELECT MIN(capacidad) FROM horarios_semanales WHERE activo = true) as capacidad_minima_horarios,
    (SELECT MAX(capacidad) FROM horarios_semanales WHERE activo = true) as capacidad_maxima_horarios;

-- ==============================================
-- 4. FUNCIÓN DE SINCRONIZACIÓN MANUAL (SI ES NECESARIA)
-- ==============================================

-- Si en algún momento se necesita sincronizar manualmente:
/*
UPDATE horarios_semanales
SET 
    capacidad = (SELECT max_alumnos_por_clase FROM configuracion_admin WHERE sistema_activo = true),
    updated_at = NOW()
WHERE activo = true;
*/

-- ==============================================
-- 5. IMPACTO EN EL SISTEMA
-- ==============================================

-- Los cambios en configuracion_admin impactan en:
-- 1. Sistema de reservas (máximo alumnos por clase)
-- 2. Vista de agenda (muestra capacidad correcta)
-- 3. Validaciones de turnos (previene sobrecupo)
-- 4. Reportes y estadísticas

SELECT 
    'IMPACTO GLOBAL' as descripcion,
    'Sistema de reservas' as componente_1,
    'Vista de agenda' as componente_2,
    'Validaciones de turnos' as componente_3,
    'Reportes y estadísticas' as componente_4;


-- VERIFICAR Y CORREGIR ERRORES DE CONSOLA
-- Script para verificar que las tablas necesarias existen y tienen datos

-- ==============================================
-- 1. VERIFICAR TABLAS PRINCIPALES
-- ==============================================

-- Verificar que horarios_semanales existe y tiene datos
SELECT 
    'horarios_semanales' as tabla,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN activo = true THEN 1 END) as registros_activos
FROM horarios_semanales;

-- Verificar que configuracion_admin existe y tiene datos
SELECT 
    'configuracion_admin' as tabla,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN sistema_activo = true THEN 1 END) as registros_activos
FROM configuracion_admin;

-- Verificar que profiles existe y tiene usuarios admin
SELECT 
    'profiles' as tabla,
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as usuarios_admin
FROM profiles;

-- ==============================================
-- 2. VERIFICAR CONFIGURACIÓN ACTUAL
-- ==============================================

-- Mostrar configuración actual del sistema
SELECT 
    max_alumnos_por_clase,
    tarifa_horaria,
    precio_clase,
    sistema_activo,
    updated_at
FROM configuracion_admin
WHERE sistema_activo = true;

-- ==============================================
-- 3. VERIFICAR HORARIOS SEMANALES
-- ==============================================

-- Mostrar horarios semanales activos
SELECT 
    dia_semana,
    hora_inicio,
    hora_fin,
    capacidad,
    alumnos_agendados,
    activo
FROM horarios_semanales
WHERE activo = true
ORDER BY dia_semana, hora_inicio
LIMIT 10;

-- ==============================================
-- 4. VERIFICAR USUARIOS ADMIN
-- ==============================================

-- Mostrar usuarios admin
SELECT 
    id,
    email,
    full_name,
    role,
    is_active
FROM profiles
WHERE role = 'admin';


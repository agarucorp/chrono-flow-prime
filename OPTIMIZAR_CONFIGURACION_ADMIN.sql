-- OPTIMIZAR CONFIGURACIÓN USANDO TABLA EXISTENTE
-- Usar la tabla configuracion_admin existente en lugar de crear tablas nuevas

-- ==============================================
-- 1. VERIFICAR Y AGREGAR COLUMNAS FALTANTES
-- ==============================================

-- Verificar que las columnas necesarias existen
-- La tabla ya tiene: max_alumnos_por_clase y tarifa_horaria
-- No necesitamos agregar columnas, solo verificar que existen

-- ==============================================
-- 2. INSERTAR CONFIGURACIÓN INICIAL SI NO EXISTE
-- ==============================================

-- Los datos ya existen en la tabla, no necesitamos insertar nada
-- La tabla ya tiene configuración activa con:
-- - max_alumnos_por_clase: 20
-- - tarifa_horaria: 2000.00 (actualizada)
-- NOTA: Se eliminó la columna precio_clase redundante

-- ==============================================
-- 3. VERIFICAR ESTRUCTURA FINAL
-- ==============================================

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'configuracion_admin' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ==============================================
-- 4. CREAR VISTA SIMPLE PARA ACCESO RÁPIDO
-- ==============================================

CREATE OR REPLACE VIEW public.configuracion_actual AS
SELECT 
    max_alumnos_por_clase,
    tarifa_horaria,
    sistema_activo,
    updated_at
FROM public.configuracion_admin
WHERE sistema_activo = true
LIMIT 1;

-- ==============================================
-- 5. VERIFICAR QUE LA CONFIGURACIÓN ESTÉ DISPONIBLE
-- ==============================================

SELECT * FROM public.configuracion_actual;

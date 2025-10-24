-- CREAR TABLA CONFIGURACION ADMIN
-- Tabla para control absoluto de configuraciones generales del sistema

-- ==============================================
-- 1. CREAR TABLA CONFIGURACION ADMIN
-- ==============================================

CREATE TABLE IF NOT EXISTS public.configuracion_admin (
    id_configuracion UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    precio_clase DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    dias_inactivos TEXT DEFAULT '',
    max_alumnos_por_clase INTEGER DEFAULT 10,
    horario_apertura TIME DEFAULT '06:00:00',
    horario_cierre TIME DEFAULT '23:00:00',
    duracion_clase_minutos INTEGER DEFAULT 60,
    anticipacion_reserva_horas INTEGER DEFAULT 24,
    cancelacion_horas INTEGER DEFAULT 2,
    mensaje_sistema TEXT DEFAULT '',
    sistema_activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 2. CREAR ÍNDICES PARA OPTIMIZACIÓN
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_configuracion_admin_sistema_activo 
ON public.configuracion_admin(sistema_activo);

-- ==============================================
-- 3. CREAR TRIGGER PARA ACTUALIZAR TIMESTAMP
-- ==============================================

CREATE OR REPLACE FUNCTION update_configuracion_admin_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_configuracion_admin_timestamp
    BEFORE UPDATE ON public.configuracion_admin
    FOR EACH ROW
    EXECUTE FUNCTION update_configuracion_admin_timestamp();

-- ==============================================
-- 4. CREAR POLÍTICAS RLS
-- ==============================================

-- Habilitar RLS
ALTER TABLE public.configuracion_admin ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver la configuración
CREATE POLICY "configuracion_admin_select_admin_only" ON public.configuracion_admin
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Solo admins pueden insertar configuración
CREATE POLICY "configuracion_admin_insert_admin_only" ON public.configuracion_admin
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Solo admins pueden actualizar configuración
CREATE POLICY "configuracion_admin_update_admin_only" ON public.configuracion_admin
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Solo admins pueden eliminar configuración
CREATE POLICY "configuracion_admin_delete_admin_only" ON public.configuracion_admin
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ==============================================
-- 5. INSERTAR CONFIGURACIÓN INICIAL
-- ==============================================

INSERT INTO public.configuracion_admin (
    precio_clase,
    dias_inactivos,
    max_alumnos_por_clase,
    horario_apertura,
    horario_cierre,
    duracion_clase_minutos,
    anticipacion_reserva_horas,
    cancelacion_horas,
    mensaje_sistema,
    sistema_activo
) VALUES (
    1500.00,  -- Precio por clase en pesos
    '2024-12-24,2024-12-25,2025-01-01',  -- Días inactivos (Navidad, Año Nuevo)
    8,  -- Máximo 8 alumnos por clase
    '06:00:00',  -- Apertura a las 6 AM
    '22:00:00',  -- Cierre a las 10 PM
    60,  -- Clases de 60 minutos
    24,  -- Reservar con 24 horas de anticipación
    2,   -- Cancelar hasta 2 horas antes
    'Bienvenido al sistema de reservas de turnos',  -- Mensaje del sistema
    true  -- Sistema activo
) ON CONFLICT DO NOTHING;

-- ==============================================
-- 6. CREAR FUNCIONES HELPER
-- ==============================================

-- Función para obtener configuración actual
CREATE OR REPLACE FUNCTION get_configuracion_admin()
RETURNS TABLE (
    precio_clase DECIMAL(10,2),
    dias_inactivos TEXT,
    max_alumnos_por_clase INTEGER,
    horario_apertura TIME,
    horario_cierre TIME,
    duracion_clase_minutos INTEGER,
    anticipacion_reserva_horas INTEGER,
    cancelacion_horas INTEGER,
    mensaje_sistema TEXT,
    sistema_activo BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ca.precio_clase,
        ca.dias_inactivos,
        ca.max_alumnos_por_clase,
        ca.horario_apertura,
        ca.horario_cierre,
        ca.duracion_clase_minutos,
        ca.anticipacion_reserva_horas,
        ca.cancelacion_horas,
        ca.mensaje_sistema,
        ca.sistema_activo
    FROM public.configuracion_admin ca
    WHERE ca.sistema_activo = true
    ORDER BY ca.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si una fecha es inactiva
CREATE OR REPLACE FUNCTION es_dia_inactivo(fecha_consulta DATE)
RETURNS BOOLEAN AS $$
DECLARE
    dias_inactivos_text TEXT;
    dias_inactivos_array TEXT[];
    dia_consulta_str TEXT;
BEGIN
    -- Obtener los días inactivos de la configuración
    SELECT dias_inactivos INTO dias_inactivos_text
    FROM public.configuracion_admin
    WHERE sistema_activo = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Si no hay configuración, no es día inactivo
    IF dias_inactivos_text IS NULL OR dias_inactivos_text = '' THEN
        RETURN FALSE;
    END IF;
    
    -- Convertir string a array
    dias_inactivos_array := string_to_array(dias_inactivos_text, ',');
    
    -- Convertir fecha de consulta a string
    dia_consulta_str := fecha_consulta::TEXT;
    
    -- Verificar si la fecha está en el array
    RETURN dia_consulta_str = ANY(dias_inactivos_array);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 7. VERIFICAR CREACIÓN
-- ==============================================

-- Verificar que la tabla se creó correctamente
SELECT 
    'TABLA CREADA' as seccion,
    table_name as nombre_tabla,
    column_name as columna,
    data_type as tipo_dato,
    is_nullable as permite_nulo,
    column_default as valor_default
FROM information_schema.columns 
WHERE table_name = 'configuracion_admin' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar políticas RLS
SELECT 
    'POLITICAS RLS' as seccion,
    policyname as nombre_politica,
    cmd as operacion,
    permissive as permisiva
FROM pg_policies 
WHERE tablename = 'configuracion_admin'
ORDER BY cmd;

-- Verificar datos iniciales
SELECT 
    'CONFIGURACION INICIAL' as seccion,
    precio_clase,
    dias_inactivos,
    max_alumnos_por_clase,
    sistema_activo,
    created_at
FROM public.configuracion_admin;

-- Probar función helper
SELECT 
    'FUNCION HELPER' as seccion,
    * 
FROM get_configuracion_admin();

-- Probar función de días inactivos
SELECT 
    'PRUEBA DIAS INACTIVOS' as seccion,
    '2024-12-24'::DATE as fecha_navidad,
    es_dia_inactivo('2024-12-24'::DATE) as es_inactiva_navidad,
    '2024-12-26'::DATE as fecha_normal,
    es_dia_inactivo('2024-12-26'::DATE) as es_inactiva_normal;

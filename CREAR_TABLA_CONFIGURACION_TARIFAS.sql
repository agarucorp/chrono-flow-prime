-- Crear tabla para configuración de tarifas
CREATE TABLE IF NOT EXISTS configuracion_tarifas (
    id SERIAL PRIMARY KEY,
    tarifa_actual DECIMAL(10,2) NOT NULL DEFAULT 2500.00,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    historial_tarifas JSONB DEFAULT '[]'::jsonb
);

-- Insertar configuración inicial (tarifa en pesos argentinos)
INSERT INTO configuracion_tarifas (id, tarifa_actual, historial_tarifas) 
VALUES (1, 2500.00, '[{"tarifa": 2500.00, "fecha_inicio": "2024-01-01"}]')
ON CONFLICT (id) DO NOTHING;

-- Crear tabla para historial de tarifas (opcional, para auditoría)
CREATE TABLE IF NOT EXISTS historial_tarifas (
    id SERIAL PRIMARY KEY,
    tarifa DECIMAL(10,2) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    motivo_cambio TEXT,
    usuario_cambio UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar tarifa inicial en el historial (en pesos argentinos)
INSERT INTO historial_tarifas (tarifa, fecha_inicio) 
VALUES (2500.00, '2024-01-01');

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_configuracion_tarifas_id ON configuracion_tarifas(id);
CREATE INDEX IF NOT EXISTS idx_historial_tarifas_fecha ON historial_tarifas(fecha_inicio);

-- Políticas RLS para administradores
ALTER TABLE configuracion_tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_tarifas ENABLE ROW LEVEL SECURITY;

-- Política para configuracion_tarifas (solo administradores pueden leer y modificar)
CREATE POLICY "Administradores pueden gestionar tarifas" ON configuracion_tarifas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Política para historial_tarifas (solo administradores pueden leer)
CREATE POLICY "Administradores pueden ver historial de tarifas" ON historial_tarifas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Función para actualizar tarifa y mantener historial
CREATE OR REPLACE FUNCTION actualizar_tarifa_y_historial(
    nueva_tarifa DECIMAL(10,2),
    motivo_cambio TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tarifa_anterior DECIMAL(10,2);
    usuario_actual UUID;
BEGIN
    -- Obtener usuario actual
    usuario_actual := auth.uid();
    
    -- Verificar que sea administrador
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = usuario_actual 
        AND auth.users.raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RAISE EXCEPTION 'Solo los administradores pueden cambiar tarifas';
    END IF;
    
    -- Obtener tarifa anterior
    SELECT tarifa_actual INTO tarifa_anterior 
    FROM configuracion_tarifas 
    WHERE id = 1;
    
    -- Actualizar tarifa actual
    UPDATE configuracion_tarifas 
    SET tarifa_actual = nueva_tarifa, 
        fecha_actualizacion = NOW()
    WHERE id = 1;
    
    -- Cerrar período anterior en historial
    UPDATE historial_tarifas 
    SET fecha_fin = CURRENT_DATE - INTERVAL '1 day'
    WHERE fecha_fin IS NULL;
    
    -- Agregar nueva tarifa al historial
    INSERT INTO historial_tarifas (tarifa, fecha_inicio, motivo_cambio, usuario_cambio)
    VALUES (nueva_tarifa, CURRENT_DATE, motivo_cambio, usuario_actual);
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

-- Otorgar permisos a la función
GRANT EXECUTE ON FUNCTION actualizar_tarifa_y_historial TO authenticated;

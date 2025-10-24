-- Crear tabla para configuración de tarifas por días de entrenamiento
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tabla de tarifas por días de entrenamiento
CREATE TABLE IF NOT EXISTS tarifas_dias_entrenamiento (
    id SERIAL PRIMARY KEY,
    dias_por_semana INTEGER NOT NULL CHECK (dias_por_semana >= 1 AND dias_por_semana <= 5),
    tarifa_mensual DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    moneda VARCHAR(10) DEFAULT 'ARS',
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dias_por_semana)
);

-- 2. Insertar configuración inicial de tarifas (valores ejemplo en pesos argentinos)
INSERT INTO tarifas_dias_entrenamiento (dias_por_semana, tarifa_mensual, moneda, descripcion, activo) VALUES
(1, 15000.00, 'ARS', '1 día por semana - Entrada al mundo del fitness', true),
(2, 25000.00, 'ARS', '2 días por semana - Mantente activo', true),
(3, 35000.00, 'ARS', '3 días por semana - Construcción de hábitos', true),
(4, 45000.00, 'ARS', '4 días por semana - Entrenamiento avanzado', true),
(5, 50000.00, 'ARS', '5 días por semana - Máximo rendimiento', true)
ON CONFLICT (dias_por_semana) DO NOTHING;

-- 3. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_tarifas_dias_activo ON tarifas_dias_entrenamiento(activo);
CREATE INDEX IF NOT EXISTS idx_tarifas_dias_semana ON tarifas_dias_entrenamiento(dias_por_semana);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE tarifas_dias_entrenamiento ENABLE ROW LEVEL SECURITY;

-- 5. Política para que todos los usuarios autenticados puedan leer las tarifas
CREATE POLICY "Usuarios autenticados pueden leer tarifas" ON tarifas_dias_entrenamiento
    FOR SELECT 
    USING (auth.role() = 'authenticated' AND activo = true);

-- 6. Política para que solo administradores puedan modificar tarifas
CREATE POLICY "Solo administradores pueden modificar tarifas" ON tarifas_dias_entrenamiento
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- 7. Función para actualizar el timestamp automáticamente
CREATE OR REPLACE FUNCTION actualizar_updated_at_tarifas()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS trigger_actualizar_updated_at_tarifas ON tarifas_dias_entrenamiento;
CREATE TRIGGER trigger_actualizar_updated_at_tarifas
    BEFORE UPDATE ON tarifas_dias_entrenamiento
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at_tarifas();

-- 9. Agregar columna a horarios_recurrentes_usuario para guardar el plan seleccionado
ALTER TABLE horarios_recurrentes_usuario 
ADD COLUMN IF NOT EXISTS plan_dias_semana INTEGER CHECK (plan_dias_semana >= 1 AND plan_dias_semana <= 5);

-- 10. Comentario para claridad
COMMENT ON TABLE tarifas_dias_entrenamiento IS 'Tabla de configuración de tarifas mensuales según cantidad de días de entrenamiento por semana';
COMMENT ON COLUMN tarifas_dias_entrenamiento.dias_por_semana IS 'Cantidad de días de entrenamiento por semana (1-5)';
COMMENT ON COLUMN tarifas_dias_entrenamiento.tarifa_mensual IS 'Precio mensual del plan en la moneda especificada';
COMMENT ON COLUMN horarios_recurrentes_usuario.plan_dias_semana IS 'Plan de días por semana seleccionado por el usuario (1-5 días)';

-- Verificación: Consultar tarifas creadas
SELECT * FROM tarifas_dias_entrenamiento ORDER BY dias_por_semana;


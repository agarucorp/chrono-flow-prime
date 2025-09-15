-- Tablas necesarias para el sistema de configuración de admin
-- Estas tablas permiten que los cambios impacten globalmente en todo el sistema

-- 1. Tabla para horarios fijos del sistema
CREATE TABLE IF NOT EXISTS horarios_fijos_sistema (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clase_numero INTEGER NOT NULL UNIQUE, -- 1 a 8
  nombre_clase TEXT NOT NULL, -- "Clase 1", "Clase 2", etc.
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla para ausencias eventuales
CREATE TABLE IF NOT EXISTS ausencias_eventuales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_ausencia TEXT NOT NULL CHECK (tipo_ausencia IN ('unica', 'periodo')),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE, -- NULL para ausencias únicas
  clases_canceladas INTEGER[], -- Array de números de clase (1-8) para ausencias únicas
  motivo TEXT, -- Opcional: motivo de la ausencia
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla para configuración general del sistema
CREATE TABLE IF NOT EXISTS configuracion_sistema (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  valor TEXT NOT NULL,
  descripcion TEXT,
  tipo_dato TEXT DEFAULT 'string' CHECK (tipo_dato IN ('string', 'number', 'boolean', 'json')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla para configuración de tarifas
CREATE TABLE IF NOT EXISTS configuracion_tarifas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_clase TEXT NOT NULL DEFAULT 'entrenamiento_personal',
  tarifa_por_clase DECIMAL(10,2) NOT NULL,
  moneda TEXT DEFAULT 'ARS',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla para configuración de capacidad
CREATE TABLE IF NOT EXISTS configuracion_capacidad (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_clase TEXT NOT NULL DEFAULT 'entrenamiento_personal',
  max_alumnos_por_clase INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triggers para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_horarios_fijos_sistema_updated_at 
  BEFORE UPDATE ON horarios_fijos_sistema 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ausencias_eventuales_updated_at 
  BEFORE UPDATE ON ausencias_eventuales 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configuracion_sistema_updated_at 
  BEFORE UPDATE ON configuracion_sistema 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configuracion_tarifas_updated_at 
  BEFORE UPDATE ON configuracion_tarifas 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configuracion_capacidad_updated_at 
  BEFORE UPDATE ON configuracion_capacidad 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Datos iniciales para horarios fijos
INSERT INTO horarios_fijos_sistema (clase_numero, nombre_clase, hora_inicio, hora_fin) VALUES
(1, 'Clase 1', '08:00', '09:00'),
(2, 'Clase 2', '09:00', '10:00'),
(3, 'Clase 3', '10:00', '11:00'),
(4, 'Clase 4', '11:00', '12:00'),
(5, 'Clase 5', '15:00', '16:00'),
(6, 'Clase 6', '16:00', '17:00'),
(7, 'Clase 7', '18:00', '19:00'),
(8, 'Clase 8', '19:00', '20:00')
ON CONFLICT (clase_numero) DO NOTHING;

-- Configuración inicial del sistema
INSERT INTO configuracion_sistema (clave, valor, descripcion, tipo_dato) VALUES
('cantidad_clases_por_dia', '8', 'Número de clases disponibles por día', 'number'),
('sistema_activo', 'true', 'Indica si el sistema está activo', 'boolean'),
('configuracion_completa', 'false', 'Indica si la configuración inicial está completa', 'boolean')
ON CONFLICT (clave) DO NOTHING;

-- Configuración inicial de tarifas
INSERT INTO configuracion_tarifas (tipo_clase, tarifa_por_clase, moneda) VALUES
('entrenamiento_personal', 0.00, 'ARS')
ON CONFLICT DO NOTHING;

-- Configuración inicial de capacidad
INSERT INTO configuracion_capacidad (tipo_clase, max_alumnos_por_clase) VALUES
('entrenamiento_personal', 1)
ON CONFLICT DO NOTHING;

-- Políticas RLS (Row Level Security)
ALTER TABLE horarios_fijos_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE ausencias_eventuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_capacidad ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir lectura a todos los usuarios autenticados
CREATE POLICY "Allow read access to authenticated users" ON horarios_fijos_sistema
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to authenticated users" ON ausencias_eventuales
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to authenticated users" ON configuracion_sistema
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to authenticated users" ON configuracion_tarifas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to authenticated users" ON configuracion_capacidad
  FOR SELECT TO authenticated USING (true);

-- Políticas para permitir escritura solo a administradores
CREATE POLICY "Allow admin write access" ON horarios_fijos_sistema
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow admin write access" ON ausencias_eventuales
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow admin write access" ON configuracion_sistema
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow admin write access" ON configuracion_tarifas
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow admin write access" ON configuracion_capacidad
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

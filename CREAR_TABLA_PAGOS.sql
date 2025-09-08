-- =====================================================
-- TABLA DE PAGOS PARA GESTIÓN DE CUOTAS MENSUALES
-- =====================================================

-- 1. CREAR TABLA DE PAGOS
CREATE TABLE IF NOT EXISTS public.pagos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  periodo DATE NOT NULL, -- Fecha que representa el mes/año de la cuota
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
  metodo_pago TEXT, -- 'efectivo', 'transferencia', 'tarjeta', etc.
  observaciones TEXT,
  procesado_por UUID REFERENCES auth.users(id), -- Admin que procesó el pago
  procesado_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint para evitar duplicados del mismo usuario en el mismo período
  UNIQUE(usuario_id, periodo)
);

-- 2. CREAR ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_pagos_usuario_id ON public.pagos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON public.pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_periodo ON public.pagos(periodo);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON public.pagos(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_procesado_por ON public.pagos(procesado_por);

-- 3. HABILITAR RLS (Row Level Security)
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

-- 4. CREAR POLÍTICAS RLS
-- Usuarios pueden ver sus propios pagos
CREATE POLICY "Users can view their own payments" ON public.pagos
  FOR SELECT USING (auth.uid() = usuario_id);

-- Usuarios pueden insertar sus propios pagos (para solicitar pago)
CREATE POLICY "Users can insert their own payments" ON public.pagos
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Solo admins pueden actualizar pagos (cambiar estado)
CREATE POLICY "Admins can update all payments" ON public.pagos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins pueden eliminar pagos
CREATE POLICY "Admins can delete payments" ON public.pagos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins pueden ver todos los pagos
CREATE POLICY "Admins can view all payments" ON public.pagos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. CREAR FUNCIÓN PARA ACTUALIZAR TIMESTAMP
CREATE OR REPLACE FUNCTION update_pagos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. CREAR TRIGGER PARA ACTUALIZAR TIMESTAMP
CREATE TRIGGER update_pagos_updated_at
  BEFORE UPDATE ON public.pagos
  FOR EACH ROW
  EXECUTE FUNCTION update_pagos_updated_at();

-- 7. CREAR FUNCIÓN PARA MARCAR PAGO COMO PROCESADO
CREATE OR REPLACE FUNCTION marcar_pago_procesado(
  pago_id UUID,
  admin_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Verificar que el usuario es admin
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = admin_id AND role = 'admin'
  ) INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Solo los administradores pueden procesar pagos';
  END IF;
  
  -- Actualizar el pago
  UPDATE public.pagos 
  SET 
    estado = 'pagado',
    procesado_por = admin_id,
    procesado_at = NOW(),
    updated_at = NOW()
  WHERE id = pago_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. CREAR FUNCIÓN PARA GENERAR CUOTAS MENSUALES
CREATE OR REPLACE FUNCTION generar_cuota_mensual(
  user_id UUID,
  monto_cuota DECIMAL(10,2),
  periodo_mes DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
  pago_id UUID;
BEGIN
  -- Insertar nueva cuota mensual
  INSERT INTO public.pagos (
    usuario_id,
    monto,
    periodo,
    estado,
    fecha_pago
  ) VALUES (
    user_id,
    monto_cuota,
    periodo_mes,
    'pendiente',
    CURRENT_DATE
  ) ON CONFLICT (usuario_id, periodo) 
  DO UPDATE SET
    monto = EXCLUDED.monto,
    updated_at = NOW()
  RETURNING id INTO pago_id;
  
  RETURN pago_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. CREAR VISTAS ÚTILES
-- Vista de pagos pendientes
CREATE OR REPLACE VIEW public.pagos_pendientes AS
SELECT 
  p.id,
  p.usuario_id,
  u.email,
  pr.first_name,
  pr.last_name,
  p.monto,
  p.fecha_pago,
  p.periodo,
  p.estado,
  p.created_at
FROM public.pagos p
JOIN auth.users u ON p.usuario_id = u.id
LEFT JOIN public.profiles pr ON p.usuario_id = pr.id
WHERE p.estado = 'pendiente'
ORDER BY p.fecha_pago DESC;

-- Vista de pagos procesados
CREATE OR REPLACE VIEW public.pagos_procesados AS
SELECT 
  p.id,
  p.usuario_id,
  u.email,
  pr.first_name,
  pr.last_name,
  p.monto,
  p.fecha_pago,
  p.periodo,
  p.estado,
  p.procesado_por,
  admin_pr.first_name as admin_first_name,
  admin_pr.last_name as admin_last_name,
  p.procesado_at,
  p.created_at
FROM public.pagos p
JOIN auth.users u ON p.usuario_id = u.id
LEFT JOIN public.profiles pr ON p.usuario_id = pr.id
LEFT JOIN auth.users admin_u ON p.procesado_por = admin_u.id
LEFT JOIN public.profiles admin_pr ON p.procesado_por = admin_pr.id
WHERE p.estado = 'pagado'
ORDER BY p.procesado_at DESC;

-- Vista de resumen de pagos por usuario
CREATE OR REPLACE VIEW public.resumen_pagos_usuario AS
SELECT 
  p.usuario_id,
  u.email,
  pr.first_name,
  pr.last_name,
  COUNT(*) as total_pagos,
  COUNT(CASE WHEN p.estado = 'pagado' THEN 1 END) as pagos_pagados,
  COUNT(CASE WHEN p.estado = 'pendiente' THEN 1 END) as pagos_pendientes,
  SUM(CASE WHEN p.estado = 'pagado' THEN p.monto ELSE 0 END) as total_pagado,
  SUM(CASE WHEN p.estado = 'pendiente' THEN p.monto ELSE 0 END) as total_pendiente
FROM public.pagos p
JOIN auth.users u ON p.usuario_id = u.id
LEFT JOIN public.profiles pr ON p.usuario_id = pr.id
GROUP BY p.usuario_id, u.email, pr.first_name, pr.last_name
ORDER BY pr.last_name, pr.first_name;

-- 10. COMENTARIOS EN LA TABLA
COMMENT ON TABLE public.pagos IS 'Registro de cuotas mensuales de los usuarios';
COMMENT ON COLUMN public.pagos.id IS 'ID único del pago';
COMMENT ON COLUMN public.pagos.usuario_id IS 'ID del usuario que debe pagar';
COMMENT ON COLUMN public.pagos.monto IS 'Monto de la cuota mensual';
COMMENT ON COLUMN public.pagos.fecha_pago IS 'Fecha en que se registró el pago';
COMMENT ON COLUMN public.pagos.periodo IS 'Período (mes/año) que cubre la cuota';
COMMENT ON COLUMN public.pagos.estado IS 'Estado del pago: pendiente o pagado';
COMMENT ON COLUMN public.pagos.metodo_pago IS 'Método de pago utilizado';
COMMENT ON COLUMN public.pagos.observaciones IS 'Observaciones adicionales del pago';
COMMENT ON COLUMN public.pagos.procesado_por IS 'Admin que procesó el pago';
COMMENT ON COLUMN public.pagos.procesado_at IS 'Fecha y hora en que se procesó el pago';

-- 11. INSERTAR DATOS DE PRUEBA (opcional)
-- Generar cuotas de prueba para usuarios existentes
-- INSERT INTO public.pagos (usuario_id, monto, periodo, estado) VALUES
--   ('user-uuid-1', 5000.00, '2024-01-01', 'pendiente'),
--   ('user-uuid-2', 5000.00, '2024-01-01', 'pagado');

-- 12. VERIFICAR LA CONFIGURACIÓN
SELECT 
  'Tabla pagos creada correctamente' as status,
  COUNT(*) as total_pagos
FROM public.pagos;

-- Mostrar estructura de la tabla
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'pagos' 
AND table_schema = 'public'
ORDER BY ordinal_position;

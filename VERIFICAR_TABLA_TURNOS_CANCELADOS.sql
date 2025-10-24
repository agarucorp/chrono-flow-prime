-- VERIFICAR SI LA TABLA TURNOS_CANCELADOS EXISTE
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar si la tabla existe
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'turnos_cancelados' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Si no existe, crear la tabla
CREATE TABLE IF NOT EXISTS public.turnos_cancelados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turno_id UUID NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha_cancelacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  motivo_cancelacion TEXT,
  tipo_cancelacion VARCHAR(50) DEFAULT 'usuario' CHECK (tipo_cancelacion IN ('usuario', 'admin', 'sistema')),
  turno_fecha DATE NOT NULL,
  turno_hora_inicio TIME NOT NULL,
  turno_hora_fin TIME NOT NULL,
  servicio TEXT,
  profesional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear índices
CREATE INDEX IF NOT EXISTS idx_turnos_cancelados_cliente_id ON public.turnos_cancelados(cliente_id);
CREATE INDEX IF NOT EXISTS idx_turnos_cancelados_fecha_cancelacion ON public.turnos_cancelados(fecha_cancelacion);
CREATE INDEX IF NOT EXISTS idx_turnos_cancelados_turno_fecha ON public.turnos_cancelados(turno_fecha);

-- 4. Habilitar RLS
ALTER TABLE public.turnos_cancelados ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS
CREATE POLICY "turnos_cancelados_select_own" ON public.turnos_cancelados
FOR SELECT USING (cliente_id = auth.uid());

CREATE POLICY "turnos_cancelados_select_admin_all" ON public.turnos_cancelados
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "turnos_cancelados_insert_own" ON public.turnos_cancelados
FOR INSERT WITH CHECK (cliente_id = auth.uid());

CREATE POLICY "turnos_cancelados_insert_admin" ON public.turnos_cancelados
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 6. Verificar que se creó correctamente
SELECT 
    'TABLA CREADA' as status,
    COUNT(*) as total_registros
FROM public.turnos_cancelados;

-- CREAR SISTEMA DE RESERVAS PARA MÚLTIPLES CLIENTES POR TURNO
-- Ejecutar en Supabase SQL Editor

-- 1. CREAR TABLA DE RESERVAS
CREATE TABLE IF NOT EXISTS public.reservas_turnos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turno_id UUID NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  estado VARCHAR(50) NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada', 'cancelada', 'completada')),
  fecha_reserva TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Evitar duplicados: un cliente no puede reservar el mismo turno dos veces
  UNIQUE(turno_id, cliente_id)
);

-- 2. AGREGAR COLUMNA clientes_actuales A LA TABLA turnos
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS clientes_actuales INTEGER DEFAULT 0;

-- 3. CREAR ÍNDICES PARA MEJORAR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_reservas_turnos_turno_id ON public.reservas_turnos(turno_id);
CREATE INDEX IF NOT EXISTS idx_reservas_turnos_cliente_id ON public.reservas_turnos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_turnos_estado ON public.reservas_turnos(estado);

-- 4. HABILITAR RLS
ALTER TABLE public.reservas_turnos ENABLE ROW LEVEL SECURITY;

-- 5. CREAR POLÍTICAS RLS
-- Solo admins pueden gestionar reservas
CREATE POLICY "Enable all for admins" ON public.reservas_turnos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Los clientes pueden ver solo sus propias reservas
CREATE POLICY "Users can view own reservations" ON public.reservas_turnos
FOR SELECT USING (
  cliente_id = auth.uid()
);

-- 6. CREAR FUNCIÓN PARA ACTUALIZAR CONTADOR DE CLIENTES
CREATE OR REPLACE FUNCTION actualizar_contador_clientes()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar contador en la tabla turnos
  IF TG_OP = 'INSERT' THEN
    UPDATE public.turnos 
    SET clientes_actuales = clientes_actuales + 1,
        updated_at = NOW()
    WHERE id = NEW.turno_id;
    
    -- Cambiar estado a 'ocupado' si se alcanza el máximo
    UPDATE public.turnos 
    SET estado = 'ocupado'
    WHERE id = NEW.turno_id 
    AND clientes_actuales >= max_alumnos;
    
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.turnos 
    SET clientes_actuales = GREATEST(0, clientes_actuales - 1),
        updated_at = NOW()
    WHERE id = OLD.turno_id;
    
    -- Cambiar estado a 'disponible' si no hay clientes
    UPDATE public.turnos 
    SET estado = 'disponible'
    WHERE id = OLD.turno_id 
    AND clientes_actuales = 0;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Si cambia el estado de la reserva
    IF OLD.estado != NEW.estado THEN
      IF NEW.estado = 'cancelada' THEN
        -- Restar del contador
        UPDATE public.turnos 
        SET clientes_actuales = GREATEST(0, clientes_actuales - 1),
            updated_at = NOW()
        WHERE id = NEW.turno_id;
        
        -- Cambiar estado a 'disponible' si no hay clientes
        UPDATE public.turnos 
        SET estado = 'disponible'
        WHERE id = NEW.turno_id 
        AND clientes_actuales = 0;
        
      ELSIF NEW.estado = 'confirmada' AND OLD.estado = 'cancelada' THEN
        -- Sumar al contador
        UPDATE public.turnos 
        SET clientes_actuales = clientes_actuales + 1,
            updated_at = NOW()
        WHERE id = NEW.turno_id;
        
        -- Cambiar estado a 'ocupado' si se alcanza el máximo
        UPDATE public.turnos 
        SET estado = 'ocupado'
        WHERE id = NEW.turno_id 
        AND clientes_actuales >= max_alumnos;
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 7. CREAR TRIGGERS
CREATE TRIGGER trigger_actualizar_contador_clientes
  AFTER INSERT OR UPDATE OR DELETE ON public.reservas_turnos
  FOR EACH ROW EXECUTE FUNCTION actualizar_contador_clientes();

-- 8. CREAR TRIGGER PARA updated_at
CREATE TRIGGER update_reservas_turnos_updated_at 
  BEFORE UPDATE ON public.reservas_turnos 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. VERIFICAR TABLAS CREADAS
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('reservas_turnos')
ORDER BY table_name, ordinal_position;

-- 10. VERIFICAR FUNCIONES CREADAS
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%contador%';

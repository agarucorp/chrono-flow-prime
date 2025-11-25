-- =====================================================
-- CORREGIR SOLO POLÍTICAS SELECT - Sin tocar roles ni nada más
-- =====================================================

-- 1. Crear función is_user_admin si no existe
CREATE OR REPLACE FUNCTION public.is_user_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles p
    WHERE p.id = user_id 
    AND p.role = 'admin'
  );
END;
$$;

-- 2. Eliminar política SELECT problemática
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;

-- 3. Crear política SELECT correcta
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT 
USING (
  auth.uid() = id 
  OR public.is_user_admin(auth.uid())
);

-- 4. Hacer lo mismo para cuotas_mensuales
DROP POLICY IF EXISTS "cuotas_mensuales_select_admin" ON public.cuotas_mensuales;

CREATE POLICY "cuotas_mensuales_select_admin" ON public.cuotas_mensuales
FOR SELECT 
USING (public.is_user_admin(auth.uid()));


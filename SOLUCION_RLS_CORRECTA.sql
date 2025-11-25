-- =====================================================
-- SOLUCIÓN CORRECTA: Permitir que admins vean todos los perfiles
-- El problema: Las políticas RLS están bloqueando las consultas (Error 400)
-- =====================================================

-- PASO 1: Verificar qué políticas existen actualmente
SELECT 
  'Políticas actuales en profiles:' as info,
  policyname,
  cmd,
  qual as condicion_using
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- PASO 2: Crear función helper para verificar admin (si no existe)
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

-- PASO 3: Eliminar políticas que puedan estar bloqueando
-- Solo eliminamos si existen, no todas
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "Enable select for users and admins" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- PASO 4: Crear política correcta para SELECT
-- Esta política permite:
-- - Usuarios ver su propio perfil (auth.uid() = id)
-- - Admins ver TODOS los perfiles (is_user_admin(auth.uid()))
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT 
USING (
  auth.uid() = id 
  OR public.is_user_admin(auth.uid())
);

-- PASO 5: Asegurar que RLS está habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- PASO 6: Verificar que la política funciona
-- (Esto debería mostrar todos los perfiles si estás autenticado como admin)
SELECT 
  'Test: Perfiles visibles para admin:' as test,
  COUNT(*) as total_perfiles
FROM public.profiles;

-- PASO 7: Verificar usuarios admin
SELECT 
  'Usuarios admin:' as info,
  id,
  email,
  role
FROM public.profiles
WHERE role = 'admin';

-- PASO 8: Hacer lo mismo para cuotas_mensuales (tab Balance)
DROP POLICY IF EXISTS "cuotas_mensuales_select_admin" ON public.cuotas_mensuales;

CREATE POLICY "cuotas_mensuales_select_admin" ON public.cuotas_mensuales
FOR SELECT 
USING (public.is_user_admin(auth.uid()));

ALTER TABLE public.cuotas_mensuales ENABLE ROW LEVEL SECURITY;

-- Mensaje final
SELECT '✅ Políticas RLS corregidas. Recarga la página del panel admin.' as mensaje;


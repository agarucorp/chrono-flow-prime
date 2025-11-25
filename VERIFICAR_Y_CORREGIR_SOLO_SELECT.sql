-- =====================================================
-- VERIFICAR Y CORREGIR SOLO LA POLÍTICA SELECT
-- Sin afectar otras funcionalidades
-- =====================================================

-- 1. Ver qué políticas SELECT existen actualmente
SELECT 
  'Políticas SELECT actuales en profiles:' as info,
  policyname,
  qual as condicion_using
FROM pg_policies 
WHERE tablename = 'profiles' 
  AND schemaname = 'public'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 2. Verificar si la función is_user_admin existe
SELECT 
  'Función is_user_admin:' as info,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_user_admin') 
    THEN '✅ Existe' 
    ELSE '❌ NO EXISTE - Necesitamos crearla' 
  END as status;

-- 3. Crear función is_user_admin si no existe
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

-- 4. Eliminar SOLO las políticas SELECT problemáticas (no todas)
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "Enable select for users and admins" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 5. Crear UNA SOLA política SELECT correcta
-- Esta política permite:
-- - Usuarios ver su propio perfil (auth.uid() = id)
-- - Admins ver TODOS los perfiles (is_user_admin(auth.uid()))
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT 
USING (
  auth.uid() = id 
  OR public.is_user_admin(auth.uid())
);

-- 6. Hacer lo mismo para cuotas_mensuales (tab Balance)
DROP POLICY IF EXISTS "cuotas_mensuales_select_admin" ON public.cuotas_mensuales;

CREATE POLICY "cuotas_mensuales_select_admin" ON public.cuotas_mensuales
FOR SELECT 
USING (public.is_user_admin(auth.uid()));

-- 7. Verificar que las políticas se crearon correctamente
SELECT 
  'Políticas SELECT después de la corrección:' as info,
  policyname,
  qual as condicion_using
FROM pg_policies 
WHERE tablename = 'profiles' 
  AND schemaname = 'public'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 8. Verificar usuarios admin
SELECT 
  'Usuarios admin encontrados:' as info,
  id,
  email,
  role
FROM public.profiles
WHERE role = 'admin';

-- 9. Mensaje final
SELECT '✅ Solo se corrigieron las políticas SELECT. Las demás políticas (INSERT, UPDATE, DELETE) no se modificaron.' as mensaje;


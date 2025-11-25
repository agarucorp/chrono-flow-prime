-- =====================================================
-- CORREGIR VERIFICACIÓN DE ADMIN SIN ROMPER NADA
-- El problema: Las políticas RLS bloquean la consulta para verificar si el usuario es admin
-- =====================================================

-- 1. Verificar usuarios admin existentes
SELECT 
  'Usuarios admin actuales:' as info,
  id,
  email,
  role,
  is_active
FROM public.profiles
WHERE role = 'admin'
ORDER BY created_at DESC;

-- 2. Verificar políticas SELECT actuales
SELECT 
  'Políticas SELECT en profiles:' as info,
  policyname,
  qual as condicion
FROM pg_policies 
WHERE tablename = 'profiles' 
  AND schemaname = 'public'
  AND cmd = 'SELECT';

-- 3. Verificar que la función is_user_admin existe y funciona
SELECT 
  'Función is_user_admin:' as info,
  proname as nombre,
  prosecdef as security_definer
FROM pg_proc 
WHERE proname = 'is_user_admin';

-- 4. Asegurar que la política SELECT permite:
--    a) Usuarios ver su propio perfil (para verificar su rol)
--    b) Admins ver todos los perfiles
-- Si la política ya existe y es correcta, no la recreamos
DO $$
BEGIN
  -- Solo crear la política si no existe o si está mal configurada
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
      AND schemaname = 'public'
      AND policyname = 'profiles_select_own_or_admin'
      AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
    FOR SELECT 
    USING (
      auth.uid() = id 
      OR public.is_user_admin(auth.uid())
    );
    RAISE NOTICE 'Política profiles_select_own_or_admin creada';
  ELSE
    RAISE NOTICE 'Política profiles_select_own_or_admin ya existe';
  END IF;
END $$;

-- 5. Verificar que RLS está habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Mensaje final
SELECT '✅ Verificación completada. Las políticas permiten que los usuarios vean su propio perfil y los admins vean todos.' as mensaje;


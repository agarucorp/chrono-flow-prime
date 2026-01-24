-- 🔍 CONSULTAS DE DIAGNÓSTICO (SOLO SELECT - SEGURAS)
-- Estas consultas se pueden ejecutar vía MCP para diagnosticar el problema

-- 1. VERIFICAR SI EXISTE EL TRIGGER Y LA FUNCIÓN
SELECT 
  'TRIGGERS Y FUNCIONES' as seccion,
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE trigger_schema = 'auth' 
  AND event_object_table = 'users'
  AND trigger_name LIKE '%user%';

-- 2. VERIFICAR LA FUNCIÓN handle_new_user
SELECT 
  'FUNCIÓN handle_new_user' as seccion,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- 3. VERIFICAR LA ESTRUCTURA DE LA TABLA profiles
SELECT 
  'ESTRUCTURA profiles' as seccion,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. VERIFICAR SI HAY RESTRICCIONES QUE PUEDAN CAUSAR ERRORES
SELECT 
  'RESTRICCIONES profiles' as seccion,
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'profiles';

-- 5. VERIFICAR USUARIOS RECIENTES SIN PERFIL (para diagnóstico)
SELECT 
  'USUARIOS SIN PERFIL' as seccion,
  u.id,
  u.email,
  u.created_at,
  u.email_confirmed_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
  AND u.created_at > NOW() - INTERVAL '7 days'
ORDER BY u.created_at DESC
LIMIT 10;

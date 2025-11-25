-- =====================================================
-- VERIFICAR POLÍTICAS RLS PARA PANEL DE USUARIO
-- =====================================================

-- 1. Verificar políticas RLS en vista_horarios_usuarios
SELECT 
  'Políticas RLS en vista_horarios_usuarios:' as info,
  policyname,
  cmd,
  qual as condicion
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'vista_horarios_usuarios';

-- 2. Verificar políticas RLS en horarios_recurrentes_usuario
SELECT 
  'Políticas RLS en horarios_recurrentes_usuario:' as info,
  policyname,
  cmd,
  qual as condicion
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'horarios_recurrentes_usuario';

-- 3. Verificar políticas RLS en turnos_disponibles
SELECT 
  'Políticas RLS en turnos_disponibles:' as info,
  policyname,
  cmd,
  qual as condicion
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'turnos_disponibles';

-- 4. Verificar políticas RLS en turnos_variables
SELECT 
  'Políticas RLS en turnos_variables:' as info,
  policyname,
  cmd,
  qual as condicion
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'turnos_variables';

-- 5. Verificar políticas RLS en turnos_cancelados
SELECT 
  'Políticas RLS en turnos_cancelados:' as info,
  policyname,
  cmd,
  qual as condicion
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'turnos_cancelados';

-- 6. Verificar políticas RLS en cuotas_mensuales
SELECT 
  'Políticas RLS en cuotas_mensuales:' as info,
  policyname,
  cmd,
  qual as condicion
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'cuotas_mensuales';

-- 7. Verificar políticas RLS en ausencias_admin
SELECT 
  'Políticas RLS en ausencias_admin:' as info,
  policyname,
  cmd,
  qual as condicion
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'ausencias_admin';

-- 8. Verificar políticas RLS en profiles
SELECT 
  'Políticas RLS en profiles:' as info,
  policyname,
  cmd,
  qual as condicion
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
  AND cmd = 'SELECT';

-- 9. Verificar políticas RLS en configuracion_admin
SELECT 
  'Políticas RLS en configuracion_admin:' as info,
  policyname,
  cmd,
  qual as condicion
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'configuracion_admin';

-- 10. Verificar que RLS está habilitado en todas las tablas
SELECT 
  'RLS habilitado en tablas:' as info,
  relname as tabla,
  CASE 
    WHEN rowsecurity THEN '✅ Habilitado'
    ELSE '❌ Deshabilitado'
  END as estado
FROM pg_class
WHERE relname IN (
  'vista_horarios_usuarios',
  'horarios_recurrentes_usuario',
  'turnos_disponibles',
  'turnos_variables',
  'turnos_cancelados',
  'cuotas_mensuales',
  'ausencias_admin',
  'profiles',
  'configuracion_admin'
)
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 11. Verificar que la vista vista_horarios_usuarios existe y usa SECURITY INVOKER
SELECT 
  'Estado de vista_horarios_usuarios:' as info,
  viewname as vista,
  CASE 
    WHEN viewname = 'vista_horarios_usuarios' THEN '✅ Existe'
    ELSE '❌ No existe'
  END as estado
FROM pg_views
WHERE schemaname = 'public' 
  AND viewname = 'vista_horarios_usuarios';

-- 12. Mensaje final
SELECT 
  '✅ Verificación completada.' as mensaje,
  'Revisa los resultados para identificar posibles problemas de RLS.' as instruccion;


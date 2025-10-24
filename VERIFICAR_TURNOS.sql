-- VERIFICAR ESTADO DE TURNOS - DEBUG
-- Ejecutar en Supabase SQL Editor

-- 1. VERIFICAR TODOS LOS TURNOS
SELECT 
  id,
  fecha,
  hora_inicio,
  hora_fin,
  estado,
  servicio,
  cliente_id,
  profesional_id,
  created_at,
  updated_at
FROM public.turnos 
ORDER BY fecha, hora_inicio;

-- 2. VERIFICAR TURNOS OCUPADOS
SELECT 
  id,
  fecha,
  hora_inicio,
  hora_fin,
  estado,
  servicio,
  cliente_id,
  profesional_id
FROM public.turnos 
WHERE estado = 'ocupado'
ORDER BY fecha, hora_inicio;

-- 3. VERIFICAR TURNOS DISPONIBLES
SELECT 
  id,
  fecha,
  hora_inicio,
  hora_fin,
  estado,
  servicio,
  cliente_id,
  profesional_id
FROM public.turnos 
WHERE estado = 'disponible'
ORDER BY fecha, hora_inicio;

-- 4. VERIFICAR POLÍTICAS RLS ACTIVAS
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE tablename = 'turnos';

-- 5. VERIFICAR QUE RLS ESTÉ ACTIVO
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'turnos';

-- 6. VERIFICAR USUARIOS EN PROFILES
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM public.profiles 
ORDER BY created_at DESC;

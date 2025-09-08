-- Actualizar la restricción de verificación del campo role para incluir 'alumno'

-- Primero eliminar la restricción existente
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Crear la nueva restricción que incluye 'alumno' en lugar de 'client'
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'alumno'));

-- Verificar que la restricción se aplicó correctamente
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'profiles_role_check';

-- Ahora actualizar los roles existentes de 'client' a 'alumno'
UPDATE public.profiles 
SET role = 'alumno' 
WHERE role = 'client';

-- Verificar que el cambio se aplicó correctamente
SELECT role, COUNT(*) as cantidad
FROM public.profiles 
GROUP BY role
ORDER BY role;

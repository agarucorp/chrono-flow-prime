-- Actualizar roles de 'client' a 'alumno' en la tabla profiles
UPDATE public.profiles 
SET role = 'alumno' 
WHERE role = 'client';

-- Verificar que el cambio se aplicó correctamente
SELECT role, COUNT(*) as cantidad
FROM public.profiles 
GROUP BY role
ORDER BY role;

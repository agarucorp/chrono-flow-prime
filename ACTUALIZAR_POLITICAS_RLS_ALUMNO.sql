-- Actualizar políticas RLS para usar 'alumno' en lugar de 'client'

-- Eliminar políticas existentes que usan 'client'
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "turnos_select_all" ON public.turnos;
DROP POLICY IF EXISTS "turnos_insert_admin_only" ON public.turnos;
DROP POLICY IF EXISTS "turnos_update_admin_only" ON public.turnos;
DROP POLICY IF EXISTS "turnos_delete_admin_only" ON public.turnos;
DROP POLICY IF EXISTS "reservas_turnos_select_own_or_admin" ON public.reservas_turnos;
DROP POLICY IF EXISTS "reservas_turnos_insert_own_or_admin" ON public.reservas_turnos;
DROP POLICY IF EXISTS "reservas_turnos_update_own_or_admin" ON public.reservas_turnos;
DROP POLICY IF EXISTS "reservas_turnos_delete_own_or_admin" ON public.reservas_turnos;
DROP POLICY IF EXISTS "horarios_recurrentes_usuario_select_own_or_admin" ON public.horarios_recurrentes_usuario;
DROP POLICY IF EXISTS "horarios_recurrentes_usuario_insert_own_or_admin" ON public.horarios_recurrentes_usuario;
DROP POLICY IF EXISTS "horarios_recurrentes_usuario_update_own_or_admin" ON public.horarios_recurrentes_usuario;
DROP POLICY IF EXISTS "horarios_recurrentes_usuario_delete_own_or_admin" ON public.horarios_recurrentes_usuario;

-- Recrear políticas con 'alumno'
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE USING (id = auth.uid());

CREATE POLICY "turnos_select_all" ON public.turnos
FOR SELECT USING (true);

CREATE POLICY "turnos_insert_admin_only" ON public.turnos
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "turnos_update_admin_only" ON public.turnos
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "turnos_delete_admin_only" ON public.turnos
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "reservas_turnos_select_own_or_admin" ON public.reservas_turnos
FOR SELECT USING (
    cliente_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "reservas_turnos_insert_own_or_admin" ON public.reservas_turnos
FOR INSERT WITH CHECK (
    cliente_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "reservas_turnos_update_own_or_admin" ON public.reservas_turnos
FOR UPDATE USING (
    cliente_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "reservas_turnos_delete_own_or_admin" ON public.reservas_turnos
FOR DELETE USING (
    cliente_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "horarios_recurrentes_usuario_select_own_or_admin" ON public.horarios_recurrentes_usuario
FOR SELECT USING (
    usuario_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "horarios_recurrentes_usuario_insert_own_or_admin" ON public.horarios_recurrentes_usuario
FOR INSERT WITH CHECK (
    usuario_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "horarios_recurrentes_usuario_update_own_or_admin" ON public.horarios_recurrentes_usuario
FOR UPDATE USING (
    usuario_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "horarios_recurrentes_usuario_delete_own_or_admin" ON public.horarios_recurrentes_usuario
FOR DELETE USING (
    usuario_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Verificar políticas actualizadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

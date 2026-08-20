-- Ya aplicada en remoto. Las reservas, cancelaciones y el plan sólo se escriben por RPC.

drop policy if exists "turnos_variables_insert_own" on public.turnos_variables;
drop policy if exists "turnos_variables_insert_admin" on public.turnos_variables;
drop policy if exists "turnos_variables_update_admin" on public.turnos_variables;
drop policy if exists "turnos_variables_delete_admin" on public.turnos_variables;

drop policy if exists "turnos_cancelados_insert_own" on public.turnos_cancelados;

drop policy if exists "Users can manage their own recurring schedules" on public.horarios_recurrentes_usuario;
drop policy if exists "hru_insert_own" on public.horarios_recurrentes_usuario;

revoke insert, update, delete on public.turnos_variables from authenticated;
revoke insert, update, delete on public.turnos_cancelados from authenticated;
revoke insert, update, delete on public.horarios_recurrentes_usuario from authenticated;

drop policy if exists "Usuarios ven solo sus propios horarios" on public.horarios_recurrentes_usuario;
create policy "hru_select_own_o_admin"
  on public.horarios_recurrentes_usuario
  for select
  to authenticated
  using (usuario_id = auth.uid() or public.is_user_admin(auth.uid()));

drop policy if exists "Admins pueden ver todos los horarios recurrentes" on public.horarios_recurrentes_usuario;

drop policy if exists "turnos_variables_select_own" on public.turnos_variables;
drop policy if exists "turnos_variables_select_admin" on public.turnos_variables;
create policy "turnos_variables_select_own_o_admin"
  on public.turnos_variables
  for select
  to authenticated
  using (cliente_id = auth.uid() or public.is_user_admin(auth.uid()));

drop policy if exists "turnos_cancelados_select_own" on public.turnos_cancelados;
drop policy if exists "Admins pueden ver todos los turnos cancelados" on public.turnos_cancelados;
create policy "turnos_cancelados_select_own_o_admin"
  on public.turnos_cancelados
  for select
  to authenticated
  using (cliente_id = auth.uid() or public.is_user_admin(auth.uid()));

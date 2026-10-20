-- Elegir la fecha de baja solo libera el cupo desde ese día.
-- No debe reescribir la cuota del mes actual ni la del siguiente:
-- si hay que restar clases, el admin lo hace a mano en el balance.

create or replace function public.fn_trigger_recalcular_cuotas_profile_actual_siguiente()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op = 'UPDATE'
     and (new.tarifa_personalizada is distinct from old.tarifa_personalizada
          or new.combo_asignado is distinct from old.combo_asignado
          or new.is_active is distinct from old.is_active) then
    perform public.fn_recalcular_cuotas_usuario_actual_y_siguiente(new.id);
  end if;
  return new;
end;
$$;

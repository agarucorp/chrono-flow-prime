-- Los 10 días son el plazo para canjear la clase a favor, no un límite
-- sobre la fecha de la clase elegida. Mientras el crédito siga vigente,
-- paga cualquier clase futura. Si ya venció, la reserva se cobra.

create or replace function public.fn_credito_para_fecha(p_usuario_id uuid, p_fecha date)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- p_fecha queda en la firma porque reservar_vacante ya la pasa.
  select c.cancelacion_id
  from public.fn_clases_a_favor(p_usuario_id) c
  where p_fecha is not null
  order by c.vence, c.cancelada_el
  limit 1;
$$;

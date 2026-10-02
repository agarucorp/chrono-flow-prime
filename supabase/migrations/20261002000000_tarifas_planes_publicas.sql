-- Precios de los planes para el alta y el cambio de plan.
--
-- configuracion_admin solo la puede leer un admin (RLS), así que el modal de
-- alta, el de cambio de plan y la landing mostraban precios fijos en el código
-- (12.500 / 11.250 / 10.000 / 8.750 / 7.500). Cuando el admin cambiaba las
-- tarifas en Configuración, el alumno nuevo seguía viendo los viejos aunque la
-- cuota se le calculara con los nuevos (fn_tarifa_unitaria_mes).
--
-- Esta función expone solo los cinco precios, leyendo la misma fila que usa
-- fn_tarifa_unitaria_mes, para que lo que se muestra y lo que se cobra salgan
-- del mismo lugar.
create or replace function public.fn_tarifas_planes()
returns table (
  combo_1_tarifa numeric,
  combo_2_tarifa numeric,
  combo_3_tarifa numeric,
  combo_4_tarifa numeric,
  combo_5_tarifa numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ca.combo_1_tarifa, ca.combo_2_tarifa, ca.combo_3_tarifa,
         ca.combo_4_tarifa, ca.combo_5_tarifa
  from public.configuracion_admin ca
  order by ca.updated_at desc nulls last, ca.created_at desc nulls last
  limit 1;
$$;

revoke all on function public.fn_tarifas_planes() from public;
grant execute on function public.fn_tarifas_planes() to anon, authenticated;

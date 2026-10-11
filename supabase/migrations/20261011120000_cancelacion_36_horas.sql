-- El margen para cancelar sin cargo pasa de 48 a 36 horas antes del inicio.
-- Lo leen fn_cancelar_clase y fn_es_cancelacion_tardia desde configuracion_admin.
alter table public.configuracion_admin
  alter column cancelacion_penalidad_horas set default 36;

update public.configuracion_admin
set cancelacion_penalidad_horas = 36,
    updated_at = now()
where cancelacion_penalidad_horas is distinct from 36;

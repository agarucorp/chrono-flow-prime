-- El desglose viejo copiaba las clases del plan en clases_reservadas, así que
-- el balance mostraba "+21 vacantes" aunque el alumno no hubiera reservado
-- ninguna. Se reescribe solo el desglose; el monto ya cobrado no se toca.

do $$
declare
  r record;
  m record;
begin
  for r in
    select usuario_id, anio, mes
    from public.cuotas_mensuales
  loop
    select * into m
    from public.fn_clases_mes_usuario(r.usuario_id, r.anio, r.mes);

    update public.cuotas_mensuales
    set clases_previstas = m.plan,
        clases_reservadas = m.vacantes,
        clases_canceladas_anticipacion = m.creditos,
        clases_canceladas_tardia = m.tardias
    where usuario_id = r.usuario_id
      and anio = r.anio
      and mes = r.mes;
  end loop;
end;
$$;

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';

/** Días que dura una clase a favor desde la cancelación (fn_credito_vence). */
export const DIAS_CLASE_A_FAVOR = 10;

/** Horas de anticipación para cancelar sin cargo (configuracion_admin.cancelacion_penalidad_horas). */
export const HORAS_CANCELACION_SEGURA = 48;

/** "sábado 11/10" a partir de 'YYYY-MM-DD', sin correrse de día por zona horaria. */
export const formatFechaCorta = (fecha: string) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'EEEE d/MM', { locale: es });
};

export interface ClaseAFavor {
  cancelacionId: string;
  /** Fecha de la clase cancelada (YYYY-MM-DD). */
  turnoFecha: string;
  claseNumero: number;
  horaInicio: string | null;
  canceladaEl: string;
  /** Último día para usarla (YYYY-MM-DD, hora Argentina). */
  vence: string;
}

/**
 * Clases a favor vigentes del alumno logueado.
 *
 * Las calcula el servidor (fn_clases_a_favor): cada clase del plan cancelada a
 * tiempo deja una, que paga una vacante sin cargo hasta 10 días después de la
 * cancelación. Se recarga con 'balance:refresh', que ya se dispara ante
 * cualquier cancelación o reserva.
 */
export const useClasesAFavor = () => {
  const { user } = useAuthContext();
  const [clases, setClases] = useState<ClaseAFavor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setClases([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc('fn_clases_a_favor', { p_usuario_id: user.id });
    if (error) {
      // Sin la función (o sin permiso) simplemente no se muestran: la reserva
      // sigue funcionando y la que decide si cobra es la base.
      console.warn('No se pudieron cargar las clases a favor:', error.message);
      setClases([]);
    } else {
      setClases(
        (data ?? []).map((c: any) => ({
          cancelacionId: c.cancelacion_id,
          turnoFecha: c.turno_fecha,
          claseNumero: Number(c.clase_numero),
          horaInicio: c.hora_inicio ?? null,
          canceladaEl: c.cancelada_el,
          vence: c.vence,
        }))
      );
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    load();
    const reload = () => {
      load();
    };
    window.addEventListener('balance:refresh', reload);
    return () => window.removeEventListener('balance:refresh', reload);
  }, [load]);

  /** La clase a favor que pagaría una vacante en esa fecha: la que vence primero. */
  const paraFecha = useCallback(
    (fecha: string) => clases.find((c) => c.vence >= fecha) ?? null,
    [clases]
  );

  return { clases, cantidad: clases.length, proxima: clases[0] ?? null, paraFecha, loading, reload: load };
};

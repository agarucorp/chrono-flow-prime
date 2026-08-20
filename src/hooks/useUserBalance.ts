import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { getArgentinaYearMonth } from '@/lib/dateLocal';

export interface BalanceEntry {
  /** Clases que se cobran: clasesMes + ajuste del mes anterior. */
  clases: number;
  precioUnitario: number;
  descuento: number;
  descuentoPorcentaje: number;
  total: number;
  totalConDescuento: number;
  mesNombre: string;
  anio: number;
  mesNumero: number;
  estadoPago?: string;
  isCurrent: boolean;
  isNext: boolean;
  combo?: number | null;
  /** Desglose del mes, tal como lo dejó el recálculo en la base. */
  desglose: {
    plan: number;
    vacantes: number;
    canceladasACredito: number;
    canceladasTardias: number;
    clasesMes: number;
    ajusteMesAnterior: number;
  };
}

interface UseUserBalanceReturn {
  history: BalanceEntry[];
  currentEntry: BalanceEntry | null;
  nextEntry: BalanceEntry | null;
  loading: boolean;
  error: string | null;
}

const monthNames = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Balance del alumno, leído tal cual de cuotas_mensuales.
 *
 * Todo el cálculo (plan, vacantes, cancelaciones, feriados, ausencias, tarifa
 * según el combo y arrastre del mes anterior) vive en fn_recalcular_cuota_mensual.
 * Acá no se recalcula nada: si el front hiciera su propia cuenta, tarde o
 * temprano mostraría un número distinto al que ve el admin.
 */
export const useUserBalance = (): UseUserBalanceReturn => {
  const { user } = useAuthContext();
  const [history, setHistory] = useState<BalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<{ userId: string | null; timestamp: number }>({
    userId: null,
    timestamp: 0,
  });
  const CACHE_MS = 5 * 60 * 1000;

  useEffect(() => {
    if (!user?.id) {
      setHistory([]);
      setLoading(false);
      cacheRef.current = { userId: null, timestamp: 0 };
      return;
    }

    const load = async (showSpinner: boolean) => {
      try {
        if (showSpinner) setLoading(true);
        setError(null);

        const { year: currentYear, month: currentMonth } = getArgentinaYearMonth();
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

        // Crea el mes actual si falta y recalcula el siguiente. El mes en curso
        // que ya tiene cuota emitida no se toca.
        const { error: ensureError } = await supabase.rpc(
          'fn_recalcular_cuotas_usuario_actual_y_siguiente',
          { p_usuario_id: user.id }
        );
        if (ensureError) {
          console.warn('No se pudo asegurar las cuotas del usuario:', ensureError.message);
        }

        const { data, error: cuotasError } = await supabase
          .from('cuotas_mensuales')
          .select('anio, mes, clases_previstas, clases_reservadas, clases_canceladas_anticipacion, clases_canceladas_tardia, clases_mes, ajuste_clases, clases_a_cobrar, tarifa_unitaria, monto_total, monto_con_descuento, descuento_porcentaje, combo_aplicado, estado_pago')
          .eq('usuario_id', user.id)
          .order('anio', { ascending: false })
          .order('mes', { ascending: false });

        if (cuotasError) {
          throw cuotasError;
        }

        const entries: BalanceEntry[] = (data ?? [])
          .filter((cuota) => {
            // Nunca adelantar más de un mes: el resto todavía puede cambiar.
            const diff = (Number(cuota.anio) - currentYear) * 12 + (Number(cuota.mes) - currentMonth);
            return diff <= 1;
          })
          .map((cuota) => {
            const total = Number(cuota.monto_total ?? 0);
            const totalConDescuento = Number(cuota.monto_con_descuento ?? cuota.monto_total ?? 0);
            return {
              clases: Number(cuota.clases_a_cobrar ?? 0),
              precioUnitario: Number(cuota.tarifa_unitaria ?? 0),
              descuento: Math.max(0, total - totalConDescuento),
              descuentoPorcentaje: Number(cuota.descuento_porcentaje ?? 0),
              total,
              totalConDescuento,
              mesNombre: monthNames[Number(cuota.mes) - 1],
              anio: Number(cuota.anio),
              mesNumero: Number(cuota.mes),
              estadoPago: cuota.estado_pago ?? undefined,
              isCurrent: Number(cuota.anio) === currentYear && Number(cuota.mes) === currentMonth,
              isNext: Number(cuota.anio) === nextYear && Number(cuota.mes) === nextMonth,
              combo: cuota.combo_aplicado ?? null,
              desglose: {
                plan: Number(cuota.clases_previstas ?? 0),
                vacantes: Number(cuota.clases_reservadas ?? 0),
                canceladasACredito: Number(cuota.clases_canceladas_anticipacion ?? 0),
                canceladasTardias: Number(cuota.clases_canceladas_tardia ?? 0),
                clasesMes: Number(cuota.clases_mes ?? 0),
                ajusteMesAnterior: Number(cuota.ajuste_clases ?? 0),
              },
            };
          });

        entries.sort((a, b) => (a.anio === b.anio ? b.mesNumero - a.mesNumero : b.anio - a.anio));

        setHistory(entries);
        cacheRef.current = { userId: user.id, timestamp: Date.now() };
      } catch (err) {
        console.error('Error al cargar balance:', err);
        setError('Error al cargar el balance');
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    const cached = cacheRef.current;
    if (cached.userId !== user.id || Date.now() - cached.timestamp >= CACHE_MS || history.length === 0) {
      load(true);
    } else {
      setLoading(false);
    }

    const reload = () => {
      cacheRef.current = { userId: null, timestamp: 0 };
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        load(false);
      }
    };

    window.addEventListener('balance:refresh', reload);

    // Las cuotas las reescribe el servidor ante cualquier cambio relevante, así
    // que basta con escuchar la propia tabla.
    const channel = supabase
      .channel(`balance-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cuotas_mensuales', filter: `usuario_id=eq.${user.id}` },
        reload
      )
      .subscribe();

    return () => {
      window.removeEventListener('balance:refresh', reload);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const currentEntry = useMemo(() => history.find((e) => e.isCurrent) ?? null, [history]);
  const nextEntry = useMemo(() => history.find((e) => e.isNext) ?? null, [history]);

  return { history, currentEntry, nextEntry, loading, error };
};

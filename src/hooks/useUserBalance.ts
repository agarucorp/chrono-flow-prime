import { useEffect, useMemo, useRef, useState } from 'react';
import { startOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { endOfMonthStr, getArgentinaYearMonth, startOfMonthStr } from '@/lib/dateLocal';

interface BalanceAdjustment {
  cantidad: number;
  monto: number;
}

export interface BalanceEntry {
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
  isEstimate?: boolean;
  ajustes?: {
    cancelaciones: BalanceAdjustment;
    vacantes: BalanceAdjustment;
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

const getDateOnly = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const normalizeDateKey = (value: string | Date) => String(value).substring(0, 10);

const toDbWeekday = (date: Date) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

/**
 * Balance con pago adelantado:
 * - Mes actual: congelado (solo lectura de cuotas_mensuales).
 * - Cambios del mes corriente impactan el mes siguiente (SQL bake + UI informativa).
 */
export const useUserBalance = (): UseUserBalanceReturn => {
  const { user } = useAuthContext();
  const [history, setHistory] = useState<BalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userStartDate = (() => {
    if (!user?.created_at) return null;
    const created = new Date(user.created_at);
    if (Number.isNaN(created.valueOf())) return null;
    created.setHours(0, 0, 0, 0);
    return created;
  })();
  const userStartMonth = userStartDate ? startOfMonth(userStartDate) : null;

  const balanceCacheRef = useRef<{ userId: string | null; timestamp: number }>({
    userId: null,
    timestamp: 0,
  });
  const BALANCE_CACHE_DURATION_MS = 5 * 60 * 1000;

  useEffect(() => {
    if (!user?.id) {
      setHistory([]);
      setLoading(false);
      balanceCacheRef.current = { userId: null, timestamp: 0 };
      return;
    }

    const nowBalance = Date.now();
    const cachedBalance = balanceCacheRef.current;

    if (
      cachedBalance.userId === user.id &&
      nowBalance - cachedBalance.timestamp < BALANCE_CACHE_DURATION_MS &&
      history.length > 0
    ) {
      setLoading(false);
      return;
    }

    const loadBalance = async (showSpinner: boolean = false) => {
      try {
        if (showSpinner) setLoading(true);
        setError(null);

        const { year: currentYear, month: currentMonthNum } = getArgentinaYearMonth();
        const nextMonthNum = currentMonthNum === 12 ? 1 : currentMonthNum + 1;
        const nextYear = currentMonthNum === 12 ? currentYear + 1 : currentYear;
        const currentStartISO = startOfMonthStr(currentYear, currentMonthNum);
        const currentEndISO = endOfMonthStr(currentYear, currentMonthNum);

        const { data: horariosRecurrentesConFecha } = await supabase
          .from('horarios_recurrentes_usuario')
          .select('dia_semana, fecha_inicio, fecha_fin, activo')
          .eq('usuario_id', user.id)
          .eq('activo', true);

        if (!(horariosRecurrentesConFecha || []).length) {
          setHistory([]);
          setLoading(false);
          return;
        }

        // Ensure: crea mes actual si falta (freeze si ya existe) + recalc mes siguiente.
        const { error: ensureError } = await supabase.rpc(
          'fn_recalcular_cuotas_usuario_actual_y_siguiente',
          { p_usuario_id: user.id }
        );
        if (ensureError) {
          console.warn('No se pudo asegurar cuotas del usuario:', ensureError.message);
        }

        const { data: cuotasData, error: cuotasError } = await supabase
          .from('cuotas_mensuales')
          .select('*')
          .eq('usuario_id', user.id)
          .order('anio', { ascending: false })
          .order('mes', { ascending: false });

        if (cuotasError) {
          console.error('Error al cargar cuotas:', cuotasError);
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('tarifa_personalizada, combo_asignado, combo_pendiente, tarifa_pendiente, fecha_cambio_plan')
          .eq('id', user.id)
          .maybeSingle();

        const { data: config } = await supabase
          .from('configuracion_admin')
          .select('combo_1_tarifa, combo_2_tarifa, combo_3_tarifa, combo_4_tarifa, combo_5_tarifa')
          .eq('sistema_activo', true)
          .maybeSingle();

        const resolveUnitPrice = (cuota?: any): number => {
          if (cuota?.tarifa_unitaria && Number(cuota.tarifa_unitaria) > 0) {
            return Number(cuota.tarifa_unitaria);
          }
          if (profile?.tarifa_personalizada && Number(profile.tarifa_personalizada) > 0) {
            return Number(profile.tarifa_personalizada);
          }
          if (profile?.combo_asignado && config) {
            const comboKey = `combo_${profile.combo_asignado}_tarifa` as keyof typeof config;
            const value = config[comboKey];
            if (value && Number(value) > 0) return Number(value);
          }
          return 0;
        };

        const filteredCuotas = (cuotasData ?? []).filter((cuota) => {
          if (!cuota?.anio || !cuota?.mes) return false;
          const diff = (Number(cuota.anio) - currentYear) * 12 + (Number(cuota.mes) - currentMonthNum);
          return diff <= 1;
        });

        // Eventos del mes CORRIENTE → solo informativos para el mes siguiente
        // (el monto de M+1 ya los incorpora el SQL).
        const { data: cancelacionesData } = await supabase
          .from('turnos_cancelados')
          .select('id, cancelacion_tardia, tipo_cancelacion, turno_fecha')
          .eq('cliente_id', user.id)
          .gte('turno_fecha', currentStartISO)
          .lte('turno_fecha', currentEndISO);

        const { data: vacantesData } = await supabase
          .from('turnos_variables')
          .select('id')
          .eq('cliente_id', user.id)
          .eq('estado', 'confirmada')
          .gte('turno_fecha', currentStartISO)
          .lte('turno_fecha', currentEndISO);

        const { data: ausenciasAdminData } = await supabase
          .from('ausencias_admin')
          .select('tipo_ausencia, fecha_inicio, fecha_fin, clases_canceladas')
          .eq('activo', true)
          .or(`fecha_inicio.lte.${currentEndISO},fecha_fin.gte.${currentStartISO}`);

        const { data: horariosUsuarioData } = await supabase
          .from('vista_horarios_usuarios')
          .select('dia_semana, clase_numero, activo')
          .eq('usuario_id', user.id)
          .eq('activo', true);

        const { data: feriadosData } = await supabase
          .from('feriados')
          .select('fecha, tipo, activo')
          .eq('activo', true)
          .gte('fecha', currentStartISO)
          .lte('fecha', currentEndISO);

        const feriadosSinClases = new Set(
          (feriadosData || [])
            .filter((f) => f.tipo === 'dia_habil_feriado')
            .map((f) => normalizeDateKey(f.fecha))
        );

        const cancelacionesUsuarioCount = (cancelacionesData || []).filter((c: any) => {
          const tipo = (c?.tipo_cancelacion || '').toString().toLowerCase();
          return tipo !== 'sistema' && tipo !== 'admin' && !c?.cancelacion_tardia;
        }).length;
        const vacantesCount = vacantesData?.length ?? 0;

        const ausenciasCount = (() => {
          if (!ausenciasAdminData?.length || !horariosUsuarioData?.length) return 0;
          const schedule = horariosUsuarioData.map((item) => ({
            diaSemana: Number(item.dia_semana),
            claseNumero:
              item.clase_numero !== null && item.clase_numero !== undefined
                ? Number(item.clase_numero)
                : null,
          }));
          const countForDate = (date: Date, clasesCanceladas?: number[] | null) => {
            const weekday = toDbWeekday(date);
            const matches = schedule.filter((hr) => hr.diaSemana === weekday);
            if (!matches.length) return 0;
            if (clasesCanceladas?.length) {
              const set = new Set(clasesCanceladas.map(Number));
              return matches.filter((hr) => hr.claseNumero !== null && set.has(hr.claseNumero)).length;
            }
            return matches.length;
          };
          const monthStartDate = getDateOnly(currentStartISO);
          const monthEndDate = getDateOnly(currentEndISO);
          let total = 0;
          for (const ausencia of ausenciasAdminData) {
            const inicioOriginal = getDateOnly(ausencia.fecha_inicio);
            const finOriginal = ausencia.fecha_fin ? getDateOnly(ausencia.fecha_fin) : inicioOriginal;
            if (ausencia.tipo_ausencia === 'unica') {
              if (inicioOriginal >= monthStartDate && inicioOriginal <= monthEndDate) {
                total += countForDate(inicioOriginal, ausencia.clases_canceladas ?? undefined);
              }
              continue;
            }
            const periodoInicio = inicioOriginal < monthStartDate ? monthStartDate : inicioOriginal;
            const periodoFin = finOriginal > monthEndDate ? monthEndDate : finOriginal;
            for (let d = new Date(periodoInicio); d <= periodoFin; d.setDate(d.getDate() + 1)) {
              total += countForDate(d, ausencia.clases_canceladas ?? undefined);
            }
          }
          return total;
        })();

        const feriadosCreditoCount = (() => {
          if (!horariosUsuarioData?.length || feriadosSinClases.size === 0) return 0;
          const scheduleDays = new Set(horariosUsuarioData.map((h) => Number(h.dia_semana)));
          let total = 0;
          feriadosSinClases.forEach((fechaStr) => {
            const d = getDateOnly(fechaStr);
            if (scheduleDays.has(toDbWeekday(d))) total += 1;
          });
          return total;
        })();

        const totalCancelacionesCount = cancelacionesUsuarioCount + ausenciasCount + feriadosCreditoCount;
        const nextCuotaRecord = filteredCuotas.find(
          (cuota) => cuota.anio === nextYear && cuota.mes === nextMonthNum
        );
        const nextUnitPrice = resolveUnitPrice(nextCuotaRecord) || resolveUnitPrice();
        const cancelacionesMonto = totalCancelacionesCount * nextUnitPrice;
        const vacantesMonto = vacantesCount * nextUnitPrice;

        const buildEntry = (cuota: any | null, options?: { forceNext?: boolean; isEstimate?: boolean }) => {
          const isCurrent = cuota?.anio === currentYear && cuota?.mes === currentMonthNum;
          const isNext = options?.forceNext
            ? true
            : cuota?.anio === nextYear && cuota?.mes === nextMonthNum;

          // Mes actual: SIEMPRE valores congelados de la fila.
          // Mes siguiente: tarifa de cuota / plan pendiente; montos de DB (ya con ajustes M).
          let unitPrice: number;
          if (isCurrent) {
            unitPrice = resolveUnitPrice(cuota);
          } else if (isNext && profile?.combo_pendiente && profile?.fecha_cambio_plan) {
            const fechaCambio = new Date(profile.fecha_cambio_plan);
            const inicioProximoMes = new Date(nextYear, nextMonthNum - 1, 1);
            if (fechaCambio <= inicioProximoMes) {
              if (profile.tarifa_pendiente && Number(profile.tarifa_pendiente) > 0) {
                unitPrice = Number(profile.tarifa_pendiente);
              } else if (profile.combo_pendiente && config) {
                const comboKey = `combo_${profile.combo_pendiente}_tarifa` as keyof typeof config;
                const value = config[comboKey];
                unitPrice = value && Number(value) > 0 ? Number(value) : resolveUnitPrice(cuota);
              } else {
                unitPrice = resolveUnitPrice(cuota);
              }
            } else {
              unitPrice = resolveUnitPrice(cuota);
            }
          } else {
            unitPrice = resolveUnitPrice(cuota);
          }

          const clases = Number(
            isCurrent
              ? (cuota?.clases_a_cobrar ?? cuota?.clases_previstas ?? 0)
              : (cuota?.clases_a_cobrar ?? cuota?.clases_previstas ?? 0)
          );

          const totalBase =
            cuota?.monto_total !== undefined && cuota?.monto_total !== null
              ? Number(cuota.monto_total)
              : clases * unitPrice;

          const descuentoPct = Number(cuota?.descuento_porcentaje ?? 0);
          const montoDesc = Number(cuota?.monto_con_descuento);
          let totalConDescuento: number;
          if (descuentoPct > 0 && Number.isFinite(montoDesc)) {
            totalConDescuento = montoDesc;
          } else if (Number.isFinite(montoDesc) && montoDesc > 0) {
            totalConDescuento = montoDesc;
          } else {
            totalConDescuento = totalBase;
          }

          const entry: BalanceEntry = {
            clases,
            precioUnitario: unitPrice,
            descuento: totalBase - totalConDescuento,
            descuentoPorcentaje: descuentoPct,
            total: totalBase,
            totalConDescuento,
            mesNombre: cuota?.mes ? monthNames[cuota.mes - 1] : monthNames[nextMonthNum - 1],
            anio: cuota?.anio ?? nextYear,
            mesNumero: cuota?.mes ?? nextMonthNum,
            estadoPago: cuota?.estado_pago ?? undefined,
            isCurrent,
            isNext,
            isEstimate: options?.isEstimate,
          };

          // Mes actual: sin ajustes dinámicos (congelado).
          // Mes siguiente: desglose informativo de eventos del mes corriente (ya bakeados en monto).
          if (entry.isNext && (totalCancelacionesCount > 0 || vacantesCount > 0)) {
            entry.ajustes = {
              cancelaciones: {
                cantidad: totalCancelacionesCount,
                monto: cancelacionesMonto,
              },
              vacantes: {
                cantidad: vacantesCount,
                monto: vacantesMonto,
              },
            };
          }

          return entry;
        };

        const entries: BalanceEntry[] = filteredCuotas.map((cuota) => buildEntry(cuota));

        // Si falta mes siguiente en DB, estimar solo para UI (el ensure debería haberlo creado).
        if (!entries.some((e) => e.isNext)) {
          const startNextMonth = new Date(nextYear, nextMonthNum - 1, 1);
          const endNextMonth = new Date(nextYear, nextMonthNum, 0);
          const lastDayNextMonth = endNextMonth.getDate();
          let clasesEstimadas = 0;
          if (horariosRecurrentesConFecha?.length) {
            for (let dia = 1; dia <= lastDayNextMonth; dia++) {
              const fecha = new Date(nextYear, nextMonthNum - 1, dia);
              const diaSemanaDB = toDbWeekday(fecha);
              const tieneHorario = horariosRecurrentesConFecha.some((hr: any) => {
                if (Number(hr.dia_semana) !== diaSemanaDB) return false;
                if (hr.fecha_inicio && fecha < getDateOnly(hr.fecha_inicio)) return false;
                if (hr.fecha_fin && fecha > getDateOnly(hr.fecha_fin)) return false;
                return true;
              });
              if (tieneHorario) clasesEstimadas++;
            }
          }
          const unit = resolveUnitPrice();
          const totalEstimado = Math.max(0, clasesEstimadas + vacantesCount - totalCancelacionesCount) * unit;
          entries.push(
            buildEntry(
              {
                clases_a_cobrar: Math.max(0, clasesEstimadas + vacantesCount - totalCancelacionesCount),
                clases_previstas: clasesEstimadas,
                tarifa_unitaria: unit,
                monto_total: totalEstimado,
                monto_con_descuento: totalEstimado,
                mes: nextMonthNum,
                anio: nextYear,
                estado_pago: null,
              },
              { forceNext: true, isEstimate: true }
            )
          );
        }

        entries.sort((a, b) => {
          if (a.anio === b.anio) return b.mesNumero - a.mesNumero;
          return b.anio - a.anio;
        });

        const trimmedEntries = userStartMonth
          ? entries.filter((entry) => {
              const entryMonth = new Date(entry.anio, entry.mesNumero - 1, 1);
              entryMonth.setHours(0, 0, 0, 0);
              return entryMonth >= userStartMonth!;
            })
          : entries;

        setHistory(trimmedEntries);
        balanceCacheRef.current = { userId: user.id, timestamp: Date.now() };
      } catch (err) {
        console.error('Error al cargar balance:', err);
        setError('Error al cargar el balance');
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    if (
      cachedBalance.userId !== user.id ||
      nowBalance - cachedBalance.timestamp >= BALANCE_CACHE_DURATION_MS ||
      history.length === 0
    ) {
      loadBalance(true);
    } else {
      setLoading(false);
    }

    const manualHandler = () => {
      balanceCacheRef.current = { userId: null, timestamp: 0 };
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        loadBalance(false);
      }
    };
    window.addEventListener('balance:refresh', manualHandler);

    const channel = supabase.channel(`balance-realtime-${user.id}`);
    const reloadIfVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        balanceCacheRef.current = { userId: null, timestamp: 0 };
        loadBalance(false);
      }
    };

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cuotas_mensuales', filter: `usuario_id=eq.${user.id}` }, reloadIfVisible)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_cancelados', filter: `cliente_id=eq.${user.id}` }, reloadIfVisible)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_variables', filter: `cliente_id=eq.${user.id}` }, reloadIfVisible)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios_recurrentes_usuario', filter: `usuario_id=eq.${user.id}` }, reloadIfVisible)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, reloadIfVisible)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion_admin' }, reloadIfVisible)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ausencias_admin' }, reloadIfVisible)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feriados' }, reloadIfVisible)
      .subscribe();

    return () => {
      try {
        window.removeEventListener('balance:refresh', manualHandler);
      } catch {}
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const currentEntry = useMemo(
    () => history.find((entry) => entry.isCurrent) ?? null,
    [history]
  );
  const nextEntry = useMemo(
    () => history.find((entry) => entry.isNext) ?? null,
    [history]
  );

  return { history, currentEntry, nextEntry, loading, error };
};

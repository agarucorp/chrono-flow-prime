import { useEffect, useMemo, useRef, useState } from 'react';
import { startOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';

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
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const getDateOnly = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const useUserBalance = (): UseUserBalanceReturn => {
  const { user } = useAuthContext();
  const [history, setHistory] = useState<BalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lockedCurrentSnapshotRef = useRef<BalanceEntry | null>(null);
  const userStartDate = (() => {
    if (!user?.created_at) return null;
    const created = new Date(user.created_at);
    if (Number.isNaN(created.valueOf())) return null;
    created.setHours(0, 0, 0, 0);
    return created;
  })();
  const userStartMonth = userStartDate ? startOfMonth(userStartDate) : null;

  useEffect(() => {
    if (!user?.id) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const loadBalance = async (showSpinner: boolean = false) => {
      try {
        if (showSpinner) {
          setLoading(true);
        }
        setError(null);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthNum = now.getMonth() + 1;
        const nextMonthNum = currentMonthNum === 12 ? 1 : currentMonthNum + 1;
        const nextYear = currentMonthNum === 12 ? currentYear + 1 : currentYear;

        const currentStartISO = new Date(currentYear, currentMonthNum - 1, 1).toISOString().split('T')[0];
        const currentEndISO = new Date(currentYear, currentMonthNum, 0).toISOString().split('T')[0];

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
          .select('tarifa_personalizada, combo_asignado')
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
            if (value && Number(value) > 0) {
              return Number(value);
            }
          }
          if (cuota?.monto_total && (cuota?.clases_a_cobrar || cuota?.clases_previstas)) {
            const clases = Number(cuota.clases_a_cobrar ?? cuota.clases_previstas ?? 0);
            if (clases > 0) {
              return Number(cuota.monto_total) / clases;
            }
          }
          return 0;
        };

        const baseUnitPrice = resolveUnitPrice();

        const filteredCuotas = (cuotasData ?? []).filter((cuota) => {
          if (!cuota?.anio || !cuota?.mes) return false;
          const diff = (Number(cuota.anio) - currentYear) * 12 + (Number(cuota.mes) - currentMonthNum);
          if (diff > 1) return false;
          return true;
        });

        const { data: cancelacionesData } = await supabase
          .from('turnos_cancelados')
          .select('id')
          .eq('cliente_id', user.id)
          .eq('cancelacion_tardia', false)
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

        const cancelacionesUsuarioCount = cancelacionesData?.length ?? 0;
        const vacantesCount = vacantesData?.length ?? 0;

        const ausenciasCount = (() => {
          if (!ausenciasAdminData || ausenciasAdminData.length === 0) return 0;
          if (!horariosUsuarioData || horariosUsuarioData.length === 0) return 0;

          const schedule = horariosUsuarioData.map((item) => ({
            diaSemana: Number(item.dia_semana),
            claseNumero:
              item.clase_numero !== null && item.clase_numero !== undefined
                ? Number(item.clase_numero)
                : null,
          }));

          const countForDate = (date: Date, clasesCanceladas?: number[] | null) => {
            const weekday = date.getDay();
            const matches = schedule.filter((hr) => hr.diaSemana === weekday);
            if (matches.length === 0) return 0;
            if (clasesCanceladas && clasesCanceladas.length > 0) {
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

        const totalCancelacionesCount = cancelacionesUsuarioCount + ausenciasCount;

        const nextCuotaRecord = filteredCuotas.find(
          (cuota) => cuota.anio === nextYear && cuota.mes === nextMonthNum
        );
        const nextUnitPrice = resolveUnitPrice(nextCuotaRecord) || baseUnitPrice;
        const cancelacionesMonto = totalCancelacionesCount * nextUnitPrice;
        const vacantesMonto = vacantesCount * nextUnitPrice;

        const buildEntry = (cuota: any | null, options?: { forceNext?: boolean }) => {
          const isCurrent = cuota?.anio === currentYear && cuota?.mes === currentMonthNum;
          const isNext = options?.forceNext
            ? true
            : cuota?.anio === nextYear && cuota?.mes === nextMonthNum;

          const unitPrice = resolveUnitPrice(cuota) || baseUnitPrice;
          const clases = Number(cuota?.clases_a_cobrar ?? cuota?.clases_previstas ?? 0);
          const totalBase = cuota?.monto_total !== undefined ? Number(cuota.monto_total) : clases * unitPrice;
          const totalConDescuento =
            cuota?.monto_con_descuento !== undefined ? Number(cuota.monto_con_descuento) : totalBase;
          const descuento = totalBase - totalConDescuento;
          const descuentoPorcentaje = cuota?.descuento_porcentaje !== undefined
            ? Number(cuota.descuento_porcentaje)
            : totalBase > 0 ? (descuento / totalBase) * 100 : 0;

          const entry: BalanceEntry = {
            clases,
            precioUnitario: unitPrice,
            descuento,
            descuentoPorcentaje,
            total: totalBase,
            totalConDescuento,
            mesNombre: cuota?.mes ? monthNames[cuota.mes - 1] : monthNames[nextMonthNum - 1],
            anio: cuota?.anio ?? nextYear,
            mesNumero: cuota?.mes ?? nextMonthNum,
            estadoPago: cuota?.estado_pago ?? undefined,
            isCurrent,
            isNext,
          };

          if (entry.isNext) {
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

        const hasNextEntry = entries.some((entry) => entry.isNext);
        if (!hasNextEntry) {
          const startNextMonth = new Date(nextYear, nextMonthNum - 1, 1);
          const endNextMonth = new Date(nextYear, nextMonthNum, 0);
          const startNextMonthStr = startNextMonth.toISOString().split('T')[0];
          const endNextMonthStr = endNextMonth.toISOString().split('T')[0];
          const lastDayNextMonth = endNextMonth.getDate();

          const { data: horariosRecurrentes } = await supabase
            .from('horarios_recurrentes_usuario')
            .select('dia_semana, fecha_inicio, fecha_fin, activo')
            .eq('usuario_id', user.id)
            .eq('activo', true);

          const { data: turnosVariablesProximo } = await supabase
            .from('turnos_variables')
            .select('id')
            .eq('cliente_id', user.id)
            .eq('estado', 'confirmada')
            .gte('turno_fecha', startNextMonthStr)
            .lte('turno_fecha', endNextMonthStr);

          const { data: ausenciasAdminEstimacion } = await supabase
            .from('ausencias_admin')
            .select('fecha_inicio, fecha_fin')
            .eq('activo', true)
            .or(`fecha_inicio.lte.${endNextMonthStr},fecha_fin.gte.${startNextMonthStr}`);

          let clasesEstimadas = 0;

          if (horariosRecurrentes && horariosRecurrentes.length > 0) {
            for (let dia = 1; dia <= lastDayNextMonth; dia++) {
              const fecha = new Date(nextYear, nextMonthNum - 1, dia);
              const diaSemanaJS = fecha.getDay();

              const tieneHorario = horariosRecurrentes.some((hr: any) => {
                if (hr.dia_semana !== diaSemanaJS) return false;
                if (hr.fecha_inicio) {
                  const fechaInicio = new Date(hr.fecha_inicio);
                  fechaInicio.setHours(0, 0, 0, 0);
                  if (fecha < fechaInicio) return false;
                }
                if (hr.fecha_fin) {
                  const fechaFin = new Date(hr.fecha_fin);
                  fechaFin.setHours(23, 59, 59, 999);
                  if (fecha > fechaFin) return false;
                }
                return true;
              });

              const bloqueado = ausenciasAdminEstimacion?.some((ausencia: any) => {
                const inicio = new Date(ausencia.fecha_inicio);
                inicio.setHours(0, 0, 0, 0);
                const fin = ausencia.fecha_fin ? new Date(ausencia.fecha_fin) : inicio;
                fin.setHours(23, 59, 59, 999);
                return fecha >= inicio && fecha <= fin;
              });

              if (tieneHorario && !bloqueado) {
                clasesEstimadas++;
              }
            }
          }

          if (turnosVariablesProximo) {
            clasesEstimadas += turnosVariablesProximo.length;
          }

          const totalEstimado = clasesEstimadas * baseUnitPrice;

          entries.push(
            buildEntry(
              {
                clases_a_cobrar: clasesEstimadas,
                tarifa_unitaria: baseUnitPrice,
                monto_total: totalEstimado,
                monto_con_descuento: totalEstimado,
                mes: nextMonthNum,
                anio: nextYear,
                estado_pago: null,
              },
              { forceNext: true }
            )
          );
        }

        const hasCurrentEntry = entries.some((entry) => entry.isCurrent);
        if (!hasCurrentEntry) {
          entries.push({
            clases: 0,
            precioUnitario: baseUnitPrice,
            descuento: 0,
            descuentoPorcentaje: 0,
            total: 0,
            totalConDescuento: 0,
            mesNombre: monthNames[currentMonthNum - 1],
            anio: currentYear,
            mesNumero: currentMonthNum,
            estadoPago: undefined,
            isCurrent: true,
            isNext: false,
          });
        }

        entries.sort((a, b) => {
          if (a.anio === b.anio) {
            return b.mesNumero - a.mesNumero;
          }
          return b.anio - a.anio;
        });
        const currentFromLoad = entries.find((entry) => entry.isCurrent) ?? null;
        let snapshotToUse = lockedCurrentSnapshotRef.current;
        if (currentFromLoad) {
          const shouldUpdateSnapshot =
            !snapshotToUse ||
            snapshotToUse.anio !== currentFromLoad.anio ||
            snapshotToUse.mesNumero !== currentFromLoad.mesNumero;

          if (shouldUpdateSnapshot) {
            snapshotToUse = { ...currentFromLoad };
            lockedCurrentSnapshotRef.current = snapshotToUse;
          }
        } else if (snapshotToUse) {
          snapshotToUse = null;
          lockedCurrentSnapshotRef.current = null;
        }

        const finalEntries =
          snapshotToUse && currentFromLoad
            ? entries.map((entry) =>
                entry.isCurrent &&
                entry.anio === snapshotToUse!.anio &&
                entry.mesNumero === snapshotToUse!.mesNumero
                  ? { ...snapshotToUse! }
                  : entry
              )
            : entries;

        const trimmedEntries =
          userStartMonth
            ? finalEntries.filter((entry) => {
                const entryMonth = new Date(entry.anio, entry.mesNumero - 1, 1);
                entryMonth.setHours(0, 0, 0, 0);
                return entryMonth >= userStartMonth!;
              })
            : finalEntries;

        setHistory(trimmedEntries);
      } catch (err) {
        console.error('Error al cargar balance:', err);
        setError('Error al cargar el balance');
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    // Primera carga con spinner
    loadBalance(true);

    // Refrescar ante eventos manuales
    const manualHandler = () => loadBalance(false);
    window.addEventListener('balance:refresh', manualHandler);

    // Suscripciones en tiempo real a todas las fuentes que impactan el balance
    const channel = supabase.channel(`balance-realtime-${user.id}`);

    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'cuotas_mensuales', filter: `usuario_id=eq.${user.id}` },
      () => loadBalance(false)
    );

    // Cancelaciones del usuario (afectan conteo de cancelaciones)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'turnos_cancelados', filter: `cliente_id=eq.${user.id}` },
      () => loadBalance(false)
    );

    // Turnos variables reservados por el usuario (afectan vacantes/ajustes)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'turnos_variables', filter: `cliente_id=eq.${user.id}` },
      () => loadBalance(false)
    );

    // Cambios en vista de horarios (cuando se crean/activan horarios recurrentes)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'horarios_recurrentes_usuario', filter: `usuario_id=eq.${user.id}` },
      () => loadBalance(false)
    );

    // Cambios de perfil que alteran combo/tarifa personalizada
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
      () => loadBalance(false)
    );

    // Cambios globales de configuración de combos
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'configuracion_admin' },
      () => loadBalance(false)
    );

    // Ausencias del admin (bloqueos) impactan estimación de próximas clases
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'ausencias_admin' },
      () => loadBalance(false)
    );

    channel.subscribe();

    return () => {
      try {
        window.removeEventListener('balance:refresh', manualHandler);
      } catch {}
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [user?.id]);

  const currentEntry = useMemo(
    () => history.find((entry) => entry.isCurrent) ?? null,
    [history]
  );

  const nextEntry = useMemo(
    () => history.find((entry) => entry.isNext) ?? null,
    [history]
  );

  return {
    history,
    currentEntry,
    nextEntry,
    loading,
    error,
  };
};


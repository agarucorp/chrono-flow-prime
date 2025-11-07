import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';

interface BalanceAdjustment {
  cantidad: number;
  monto: number;
}

interface BalanceEntry {
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

export const useUserBalance = (): UseUserBalanceReturn => {
  const { user } = useAuthContext();
  const [history, setHistory] = useState<BalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const loadBalance = async () => {
      try {
        setLoading(true);
        setError(null);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthNum = now.getMonth() + 1;
        const nextMonthNum = currentMonthNum === 12 ? 1 : currentMonthNum + 1;
        const nextYear = currentMonthNum === 12 ? currentYear + 1 : currentYear;

        const startOfCurrentMonth = new Date(currentYear, currentMonthNum - 1, 1);
        const endOfCurrentMonth = new Date(currentYear, currentMonthNum, 0);
        const startCurrentMonthStr = startOfCurrentMonth.toISOString().split('T')[0];
        const endCurrentMonthStr = endOfCurrentMonth.toISOString().split('T')[0];

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

        const getUnitPrice = (cuota?: any): number => {
          if (cuota?.tarifa_unitaria && Number(cuota.tarifa_unitaria) > 0) {
            return Number(cuota.tarifa_unitaria);
          }
          if (profile?.tarifa_personalizada && Number(profile.tarifa_personalizada) > 0) {
            return Number(profile.tarifa_personalizada);
          }
          if (profile?.combo_asignado && config) {
            const comboKey = `combo_${profile.combo_asignado}_tarifa` as keyof typeof config;
            const comboValue = config[comboKey];
            if (comboValue && Number(comboValue) > 0) {
              return Number(comboValue);
            }
          }
          if (cuota?.monto_total && (cuota?.clases_a_cobrar || cuota?.clases_previstas)) {
            const clasesBase = Number(cuota.clases_a_cobrar ?? cuota.clases_previstas ?? 0);
            if (clasesBase > 0) {
              return Number(cuota.monto_total) / clasesBase;
            }
          }
          return 0;
        };

        const baseUnitPrice = getUnitPrice();

        const filteredCuotas = (cuotasData ?? []).filter((cuota) => {
          if (!cuota?.anio || !cuota?.mes) return false;
          if (cuota.anio > nextYear) return false;
          if (cuota.anio === nextYear && cuota.mes > nextMonthNum) return false;
          return true;
        });

        const { data: cancelacionesData } = await supabase
          .from('turnos_cancelados')
          .select('id')
          .eq('cliente_id', user.id)
          .eq('cancelacion_tardia', false)
          .gte('turno_fecha', startCurrentMonthStr)
          .lte('turno_fecha', endCurrentMonthStr);

        const { data: vacantesData } = await supabase
          .from('turnos_variables')
          .select('id')
          .eq('cliente_id', user.id)
          .eq('estado', 'confirmada')
          .gte('turno_fecha', startCurrentMonthStr)
          .lte('turno_fecha', endCurrentMonthStr);

        const cancelacionesCount = cancelacionesData?.length ?? 0;
        const vacantesCount = vacantesData?.length ?? 0;

        const cuotaNext = filteredCuotas.find(
          (cuota) => cuota.anio === nextYear && cuota.mes === nextMonthNum
        );
        const unitPriceForNext = getUnitPrice(cuotaNext) || baseUnitPrice;
        const cancelacionesMonto = cancelacionesCount * unitPriceForNext;
        const vacantesMonto = vacantesCount * unitPriceForNext;

        const buildEntry = (cuota: any | null): BalanceEntry => {
          const isCurrent = cuota?.anio === currentYear && cuota?.mes === currentMonthNum;
          const isNext = cuota?.anio === nextYear && cuota?.mes === nextMonthNum;
          const unitPrice = getUnitPrice(cuota) || baseUnitPrice;
          const clases = Number(cuota?.clases_a_cobrar ?? cuota?.clases_previstas ?? 0);
          const totalBase = cuota?.monto_total !== undefined ? Number(cuota.monto_total) : clases * unitPrice;
          const totalConDescuento = cuota?.monto_con_descuento !== undefined ? Number(cuota.monto_con_descuento) : totalBase;
          const descuento = totalBase - totalConDescuento;
          const descuentoPorcentaje = cuota?.descuento_porcentaje !== undefined
            ? Number(cuota.descuento_porcentaje)
            : totalBase > 0
              ? (descuento / totalBase) * 100
              : 0;

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
                cantidad: cancelacionesCount,
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

          const { data: ausenciasAdmin } = await supabase
            .from('ausencias_admin')
            .select('fecha_inicio, fecha_fin')
            .eq('activo', true)
            .or(`fecha_inicio.lte.${endNextMonthStr},fecha_fin.gte.${startNextMonthStr}`);

          let clasesEstimadas = 0;

          if (horariosRecurrentes && horariosRecurrentes.length > 0) {
            for (let dia = 1; dia <= lastDayNextMonth; dia++) {
              const fecha = new Date(nextYear, nextMonthNum - 1, dia);
              const diaSemanaJS = fecha.getDay();
              const diaSemanaTabla = diaSemanaJS;

              const tieneHorario = horariosRecurrentes.some((hr: any) => {
                if (hr.dia_semana !== diaSemanaTabla) return false;
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

              const bloqueado = ausenciasAdmin?.some((ausencia: any) => {
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

          entries.push({
            clases: clasesEstimadas,
            precioUnitario: baseUnitPrice,
            descuento: 0,
            descuentoPorcentaje: 0,
            total: totalEstimado,
            totalConDescuento: totalEstimado,
            mesNombre: monthNames[nextMonthNum - 1],
            anio: nextYear,
            mesNumero: nextMonthNum,
            isCurrent: false,
            isNext: true,
            isEstimate: true,
            ajustes: {
              cancelaciones: {
                cantidad: cancelacionesCount,
                monto: cancelacionesMonto,
              },
              vacantes: {
                cantidad: vacantesCount,
                monto: vacantesMonto,
              },
            },
          });
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

        setHistory(entries);
      } catch (err) {
        console.error('Error al cargar balance:', err);
        setError('Error al cargar el balance');
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    loadBalance();

    const subscription = supabase
      .channel('balance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cuotas_mensuales',
          filter: `usuario_id=eq.${user.id}`,
        },
        () => {
          loadBalance();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
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
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';

interface BalanceData {
  clases: number;
  precioUnitario: number;
  descuento: number;
  descuentoPorcentaje: number;
  total: number;
  totalConDescuento: number;
  mes: string;
  anio: number;
  mesNumero: number;
  estadoPago?: string;
}

interface UseUserBalanceReturn {
  currentMonth: BalanceData | null;
  nextMonth: BalanceData | null;
  loading: boolean;
  error: string | null;
}

export const useUserBalance = (): UseUserBalanceReturn => {
  const { user } = useAuthContext();
  const [currentMonth, setCurrentMonth] = useState<BalanceData | null>(null);
  const [nextMonth, setNextMonth] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadBalance = async () => {
      try {
        setLoading(true);
        setError(null);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthNum = now.getMonth() + 1; // 1-12
        const nextMonthNum = currentMonthNum === 12 ? 1 : currentMonthNum + 1;
        const nextYear = currentMonthNum === 12 ? currentYear + 1 : currentYear;

        // Obtener cuota del mes actual
        const { data: cuotaActual, error: errorActual } = await supabase
          .from('cuotas_mensuales')
          .select('*')
          .eq('usuario_id', user.id)
          .eq('anio', currentYear)
          .eq('mes', currentMonthNum)
          .maybeSingle();

        if (errorActual) {
          console.error('Error al cargar cuota actual:', errorActual);
        }

        // Obtener cuota del próximo mes
        const { data: cuotaNext, error: errorNext } = await supabase
          .from('cuotas_mensuales')
          .select('*')
          .eq('usuario_id', user.id)
          .eq('anio', nextYear)
          .eq('mes', nextMonthNum)
          .maybeSingle();

        if (errorNext) {
          console.error('Error al cargar cuota próximo mes:', errorNext);
        }

        // Obtener perfil del usuario para tarifa personalizada o combo
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('tarifa_personalizada, combo_asignado')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Error al cargar perfil:', profileError);
        }

        // Obtener configuración de combos
        const { data: config, error: configError } = await supabase
          .from('configuracion_admin')
          .select('combo_1_tarifa, combo_2_tarifa, combo_3_tarifa, combo_4_tarifa, combo_5_tarifa')
          .eq('sistema_activo', true)
          .maybeSingle();

        if (configError) {
          console.error('Error al cargar configuración:', configError);
        }

        // Calcular precio unitario - priorizar combo del perfil sobre tarifa de cuota
        const getUnitPrice = (cuota?: any): number => {
          // 1. Prioridad: tarifa personalizada del perfil
          if (profile?.tarifa_personalizada && profile.tarifa_personalizada > 0) {
            return Number(profile.tarifa_personalizada);
          }
          // 2. Prioridad: combo asignado del perfil
          if (profile?.combo_asignado && config) {
            const comboKey = `combo_${profile.combo_asignado}_tarifa` as keyof typeof config;
            const comboPrice = config[comboKey];
            if (comboPrice && Number(comboPrice) > 0) {
              return Number(comboPrice);
            }
          }
          // 3. Fallback: usar tarifa de la cuota si existe
          if (cuota?.tarifa_unitaria && cuota.tarifa_unitaria > 0) {
            return Number(cuota.tarifa_unitaria);
          }
          return 0;
        };

        const meses = [
          'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];

        // Calcular precio unitario base (sin cuota, para usar combo del perfil)
        const baseUnitPrice = getUnitPrice();

        // Preparar datos del mes actual
        if (cuotaActual) {
          // Usar baseUnitPrice (combo del perfil) si existe, sino usar tarifa de la cuota
          const unitPrice = baseUnitPrice > 0 ? baseUnitPrice : Number(cuotaActual.tarifa_unitaria || 0);
          const clases = cuotaActual.clases_a_cobrar ?? cuotaActual.clases_previstas ?? 0;
          const descuentoPorcentaje = Number(cuotaActual.descuento_porcentaje || 0);
          const total = Number(cuotaActual.monto_total || 0);
          const totalConDescuento = Number(cuotaActual.monto_con_descuento || total);
          const descuento = total - totalConDescuento;

          // Recalcular total si el precio unitario es diferente al de la cuota
          const recalculatedTotal = clases * unitPrice;
          const recalculatedDescuento = recalculatedTotal * (descuentoPorcentaje / 100);
          const recalculatedTotalConDescuento = recalculatedTotal - recalculatedDescuento;

          setCurrentMonth({
            clases,
            precioUnitario: unitPrice,
            descuento: recalculatedDescuento,
            descuentoPorcentaje,
            total: recalculatedTotal,
            totalConDescuento: recalculatedTotalConDescuento,
            mes: meses[currentMonthNum - 1],
            anio: currentYear,
            mesNumero: currentMonthNum,
            estadoPago: cuotaActual.estado_pago
          });
        } else {
          // Si no hay cuota, mostrar estimación
          setCurrentMonth({
            clases: 0,
            precioUnitario: baseUnitPrice,
            descuento: 0,
            descuentoPorcentaje: 0,
            total: 0,
            totalConDescuento: 0,
            mes: meses[currentMonthNum - 1],
            anio: currentYear,
            mesNumero: currentMonthNum
          });
        }

        // Preparar datos del próximo mes
        if (cuotaNext) {
          // Usar baseUnitPrice (combo del perfil) si existe, sino usar tarifa de la cuota
          const unitPrice = baseUnitPrice > 0 ? baseUnitPrice : Number(cuotaNext.tarifa_unitaria || 0);
          const clases = cuotaNext.clases_a_cobrar ?? cuotaNext.clases_previstas ?? 0;
          const descuentoPorcentaje = Number(cuotaNext.descuento_porcentaje || 0);
          const total = Number(cuotaNext.monto_total || 0);
          const totalConDescuento = Number(cuotaNext.monto_con_descuento || total);
          const descuento = total - totalConDescuento;

          // Recalcular total si el precio unitario es diferente al de la cuota
          const recalculatedTotal = clases * unitPrice;
          const recalculatedDescuento = recalculatedTotal * (descuentoPorcentaje / 100);
          const recalculatedTotalConDescuento = recalculatedTotal - recalculatedDescuento;

          setNextMonth({
            clases,
            precioUnitario: unitPrice,
            descuento: recalculatedDescuento,
            descuentoPorcentaje,
            total: recalculatedTotal,
            totalConDescuento: recalculatedTotalConDescuento,
            mes: meses[nextMonthNum - 1],
            anio: nextYear,
            mesNumero: nextMonthNum,
            estadoPago: cuotaNext.estado_pago
          });
        } else {
          // Si no hay cuota, calcular estimación basada en horarios recurrentes
          // Obtener horarios recurrentes activos del usuario
          const { data: horariosRecurrentes } = await supabase
            .from('horarios_recurrentes_usuario')
            .select('dia_semana, fecha_inicio, fecha_fin, activo')
            .eq('usuario_id', user.id)
            .eq('activo', true);

          // Obtener turnos variables confirmados del próximo mes
          const startNextMonth = new Date(nextYear, nextMonthNum - 1, 1);
          const endNextMonth = new Date(nextYear, nextMonthNum, 0); // Último día del próximo mes
          const lastDayNextMonth = endNextMonth.getDate();
          
          // Formatear fechas para consultas SQL
          const startNextMonthStr = startNextMonth.toISOString().split('T')[0];
          const endNextMonthStr = endNextMonth.toISOString().split('T')[0];
          
          const { data: turnosVariables } = await supabase
            .from('turnos_variables')
            .select('id')
            .eq('cliente_id', user.id)
            .eq('estado', 'confirmada')
            .gte('turno_fecha', startNextMonthStr)
            .lte('turno_fecha', endNextMonthStr);

          // Obtener ausencias del admin para el próximo mes
          const { data: ausenciasAdmin } = await supabase
            .from('ausencias_admin')
            .select('fecha_inicio, fecha_fin, clases_canceladas')
            .eq('activo', true)
            .or(`fecha_inicio.lte.${endNextMonthStr},fecha_fin.gte.${startNextMonthStr}`);

          // Calcular clases estimadas del próximo mes
          let clasesEstimadas = 0;

          if (horariosRecurrentes && horariosRecurrentes.length > 0) {
            // Contar días del próximo mes donde hay horarios recurrentes
            for (let dia = 1; dia <= lastDayNextMonth; dia++) {
              const fecha = new Date(nextYear, nextMonthNum - 1, dia);
              const diaSemanaJS = fecha.getDay(); // 0 = domingo, 1 = lunes, etc.
              // Convertir a formato de tabla: horarios_recurrentes_usuario usa 1=Lunes, 2=Martes, ..., 5=Viernes
              // JavaScript: 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
              // Tabla: 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie
              // Si es domingo (0) o sábado (6), no hay horarios recurrentes según la restricción CHECK
              const diaSemanaTabla = diaSemanaJS; // Directo: 1=Lun, 2=Mar, etc.

              // Verificar si hay horario recurrente para este día
              const tieneHorario = horariosRecurrentes.some(hr => {
                // horarios_recurrentes_usuario usa 1=Lunes, 2=Martes, ..., 5=Viernes (según restricción CHECK)
                // Pero también puede tener 7 para domingo en algunos casos
                if (hr.dia_semana !== diaSemanaTabla) return false;
                if (hr.fecha_inicio) {
                  const fechaInicio = new Date(hr.fecha_inicio);
                  fechaInicio.setHours(0, 0, 0, 0);
                  const fechaComparar = new Date(fecha);
                  fechaComparar.setHours(0, 0, 0, 0);
                  if (fechaComparar < fechaInicio) return false;
                }
                if (hr.fecha_fin) {
                  const fechaFin = new Date(hr.fecha_fin);
                  fechaFin.setHours(23, 59, 59, 999);
                  const fechaComparar = new Date(fecha);
                  fechaComparar.setHours(23, 59, 59, 999);
                  if (fechaComparar > fechaFin) return false;
                }
                return true;
              });

              // Verificar si está bloqueado por ausencia del admin
              const estaBloqueado = ausenciasAdmin?.some(ausencia => {
                const inicio = new Date(ausencia.fecha_inicio);
                inicio.setHours(0, 0, 0, 0);
                const fin = ausencia.fecha_fin ? new Date(ausencia.fecha_fin) : inicio;
                fin.setHours(23, 59, 59, 999);
                const fechaComparar = new Date(fecha);
                fechaComparar.setHours(0, 0, 0, 0);
                return fechaComparar >= inicio && fechaComparar <= fin;
              });

              if (tieneHorario && !estaBloqueado) {
                clasesEstimadas++;
              }
            }
          }

          // Sumar turnos variables
          if (turnosVariables) {
            clasesEstimadas += turnosVariables.length;
          }

          const totalEstimado = clasesEstimadas * baseUnitPrice;

          setNextMonth({
            clases: clasesEstimadas,
            precioUnitario: baseUnitPrice,
            descuento: 0,
            descuentoPorcentaje: 0,
            total: totalEstimado,
            totalConDescuento: totalEstimado,
            mes: meses[nextMonthNum - 1],
            anio: nextYear,
            mesNumero: nextMonthNum
          });
        }
      } catch (err) {
        console.error('Error al cargar balance:', err);
        setError('Error al cargar el balance');
      } finally {
        setLoading(false);
      }
    };

    loadBalance();

    // Suscribirse a cambios en cuotas_mensuales
    const subscription = supabase
      .channel('balance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cuotas_mensuales',
          filter: `usuario_id=eq.${user.id}`
        },
        () => {
          loadBalance();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  return {
    currentMonth,
    nextMonth,
    loading,
    error
  };
};


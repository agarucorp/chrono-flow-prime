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


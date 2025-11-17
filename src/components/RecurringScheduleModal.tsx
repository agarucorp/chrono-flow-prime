import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { flushSync } from 'react-dom';
import { Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

interface HorarioClase {
  id: string;
  dia_semana: number;
  clase_numero: number;
  hora_inicio: string;
  hora_fin: string;
  capacidad_maxima: number;
  activo: boolean;
}

interface RecurringScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// ⚡ VERSION: 2025-01-12T16:00:00Z - CRITICAL FIX
// Fixed: Removed horario_clase_id and created_at from insert
// Paquetes de precios - valor por clase según cantidad de días
const PAQUETES_PRECIOS = [
  { dias: 1, precioPorClase: 12500 },
  { dias: 2, precioPorClase: 11250 },
  { dias: 3, precioPorClase: 10000 },
  { dias: 4, precioPorClase: 8750 },
  { dias: 5, precioPorClase: 7500 }
];

export const RecurringScheduleModal: React.FC<RecurringScheduleModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const { user } = useAuthContext();
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();

  // Build timestamp to force cache invalidation
  const BUILD_VERSION = '2025-01-12T16:00:00Z';

  const [horariosClase, setHorariosClase] = useState<HorarioClase[]>([]);
  const [horariosSeleccionados, setHorariosSeleccionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [isReview, setIsReview] = useState(false);
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState<number | null>(null);
  const [step, setStep] = useState<'paquete' | 'horarios' | 'review'>('paquete');

  // Días de la semana
  const diasSemana = [
    { numero: 1, nombre: 'Lunes', nombreCorto: 'Lun' },
    { numero: 2, nombre: 'Martes', nombreCorto: 'Mar' },
    { numero: 3, nombre: 'Miércoles', nombreCorto: 'Mié' },
    { numero: 4, nombre: 'Jueves', nombreCorto: 'Jue' },
    { numero: 5, nombre: 'Viernes', nombreCorto: 'Vie' }
  ];

  // Resetear el estado cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setStep('paquete');
      setPaqueteSeleccionado(null);
      setHorariosSeleccionados(new Set());
      setIsReview(false);
    }
  }, [isOpen]);

  // Cargar horarios de clase disponibles solo cuando se llega al step de horarios
  useEffect(() => {
    if (isOpen && step === 'horarios') {
      fetchHorariosClase();
    }
  }, [isOpen, step]);

  const fetchHorariosClase = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('horarios_semanales')
        .select('id, dia_semana, clase_numero, hora_inicio, hora_fin, capacidad, activo')
        .eq('activo', true)
        .order('dia_semana', { ascending: true })
        .order('clase_numero', { ascending: true });

      if (error) {
        console.error('❌ Error cargando horarios:', error);
        showError('Error', 'No se pudieron cargar los horarios disponibles');
        return;
      }

      const mappedData = (data || []).map(item => ({
        ...item,
        capacidad_maxima: item.capacidad
      }));
      setHorariosClase(mappedData);
    } catch (error) {
      console.error('❌ Error inesperado:', error);
      showError('Error', 'Error inesperado al cargar horarios');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (t?: string) => {
    if (!t) return ''
    // Espera formato HH:MM:SS → devuelve HH:MM
    return t.slice(0, 5)
  }

  const toggleHorario = (horarioId: string, diaSemana: number) => {
    setHorariosSeleccionados(prev => {
      const newSelection = new Set(prev);

      if (newSelection.has(horarioId)) {
        newSelection.delete(horarioId);
        return newSelection;
      }

      if (!paqueteSeleccionado) {
        return prev;
      }

      // Eliminar cualquier horario previamente seleccionado para el mismo día
      const horariosMismoDia = getHorariosPorDia(diaSemana);
      horariosMismoDia.forEach((horario) => {
        if (horario.id !== horarioId) {
          newSelection.delete(horario.id);
        }
      });

      if (newSelection.size >= paqueteSeleccionado) {
        return prev;
      }

      newSelection.add(horarioId);
      return newSelection;
    });
  };

  const handleSeleccionarPaquete = (dias: number) => {
    flushSync(() => {
      setPaqueteSeleccionado(dias);
    });
  };

  const handleContinuarDesdePaquete = () => {
    if (!paqueteSeleccionado) {
      showError('Plan requerido', 'Seleccioná un plan de entrenamiento para continuar.');
      return;
    }
    setStep('horarios');
  };

  const handleSave = () => {
    if (horariosSeleccionados.size === 0) {
      showError('Selección requerida', 'Debes seleccionar al menos un horario para tu cuota mensual');
      return;
    }
    if (horariosSeleccionados.size !== paqueteSeleccionado) {
      showError('Selección incorrecta', `Debes seleccionar exactamente ${paqueteSeleccionado} día(s) según tu paquete`);
      return;
    }
    // Avanzar a etapa de revisión
    setStep('review');
    setIsReview(true);
  };

  const formatPrecio = (precio: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(precio);
  };

  const handleConfirm = async () => {
    try {
      setSaving(true);
      const loadingToast = showLoading('Guardando horarios...');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user?.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        const { error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            id: user?.id,
            email: user?.email,
            role: 'client',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (createProfileError) {
          console.error('❌ Error creando perfil:', createProfileError);
          dismissToast(loadingToast);
          showError('Error', 'Error al crear el perfil de usuario');
          return;
        }
      } else if (profileError) {
        console.error('❌ Error verificando perfil:', profileError);
        dismissToast(loadingToast);
        showError('Error', 'Error al verificar el perfil de usuario');
        return;
      } else {
      }

      // Obtener la tarifa del paquete seleccionado
      const paquete = PAQUETES_PRECIOS.find(p => p.dias === paqueteSeleccionado);
      const tarifaPorClase = paquete?.precioPorClase || 0;

      const horariosRecurrentes = Array.from(horariosSeleccionados).map(horarioId => {
        const horario = horariosClase.find(h => h.id === horarioId);
        return {
          usuario_id: user?.id,
          dia_semana: horario?.dia_semana,
          clase_numero: horario?.clase_numero, // ⭐ Ahora guardamos clase_numero
          hora_inicio: horario?.hora_inicio,
          hora_fin: horario?.hora_fin,
          activo: true,
          fecha_inicio: new Date().toISOString().split('T')[0],
          combo_aplicado: paqueteSeleccionado,
          tarifa_personalizada: tarifaPorClase
        };
      });

      const { error } = await supabase
        .from('horarios_recurrentes_usuario')
        .insert(horariosRecurrentes);

      if (error) {
        dismissToast(loadingToast);
        console.error('❌ Error guardando horarios recurrentes:', error);
        showError('Error', `No se pudieron guardar tus horarios recurrentes: ${error.message}`);
        return;
      }

      // Actualizar combo asignado y tarifa en el perfil del usuario
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ 
          combo_asignado: paqueteSeleccionado,
          tarifa_personalizada: tarifaPorClase.toString()
        })
        .eq('id', user?.id);

      if (profileUpdateError) {
        console.warn('⚠️ No se pudo actualizar el perfil:', profileUpdateError);
        // No es crítico, continuamos
      }

      dismissToast(loadingToast);

      showSuccess('¡Horarios confirmados!', `Tus horarios fueron guardados con Plan ${paqueteSeleccionado} - ${formatPrecio(tarifaPorClase)} por clase`);

      // Generar cuota mensual automáticamente para el mes actual
      const ahora = new Date();
      const mesActual = ahora.getMonth() + 1;
      const anioActual = ahora.getFullYear();


      const { error: cuotaError } = await supabase.rpc('fn_generar_cuotas_mes', {
        p_anio: anioActual,
        p_mes: mesActual
      });

      if (cuotaError) {
        console.error('⚠️ Error generando cuota mensual:', cuotaError);
        // No bloqueamos el flujo, solo advertimos
      } else {
      }

      // Enviar email de bienvenida con cuota del mes actual
      try {
        const { error: emailError } = await supabase.functions.invoke('enviar-email-bienvenida', {
          body: {
            usuario_id: user?.id,
            mes: mesActual,
            anio: anioActual
          }
        });
        if (emailError) {
          console.warn('⚠️ No se pudo enviar email de bienvenida:', emailError);
        }
      } catch (err) {
        console.warn('⚠️ Error enviando email de bienvenida:', err);
      }

      // Marcar tutorial como completado (onboarding)
      try {
        await supabase.auth.updateUser({ data: { onboarding_tutorial_dismissed: true } });
        await supabase
          .from('profiles')
          .update({ onboarding_tutorial_seen: true })
          .eq('id', user?.id);
      } catch (err) {
        console.warn('⚠️ No se pudo marcar el tutorial como visto:', err);
      }

      // Notificar al panel para recargar "Mis Clases"
      window.dispatchEvent(new CustomEvent('horariosRecurrentes:updated'));
      // Refrescar balance inmediatamente
      window.dispatchEvent(new CustomEvent('balance:refresh'));

      onComplete();
    } catch (error) {
      console.error('❌ Error inesperado:', error);
      showError('Error', 'Error inesperado al guardar horarios');
    } finally {
      setSaving(false);
    }
  };

  const getHorariosPorDia = (diaSemana: number) => {
    return horariosClase.filter(h => h.dia_semana === diaSemana);
  };

  const isHorarioSeleccionado = (horarioId: string) => {
    return horariosSeleccionados.has(horarioId);
  };

  const puedeSeleccionarHorario = (horarioId: string) => {
    // Si ya está seleccionado, puede deseleccionar
    if (isHorarioSeleccionado(horarioId)) {
      return true;
    }
    
    // Si no hay paquete seleccionado, no puede seleccionar
    if (!paqueteSeleccionado) {
      return false;
    }
    
    // Si ya se alcanzó el límite, no puede seleccionar más
    return horariosSeleccionados.size < paqueteSeleccionado;
  };

  const tieneHorarioEnDia = (diaSemana: number) => {
    const horariosDelDia = getHorariosPorDia(diaSemana);
    return horariosDelDia.some(h => horariosSeleccionados.has(h.id));
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => undefined}>
      <DialogContent
        hideClose
        className="flex h-[100dvh] w-full flex-col overflow-hidden border border-white/10 bg-[#111111] p-4 text-zinc-100 shadow-[0_50px_140px_rgba(0,0,0,0.75)] sm:max-h-[85vh] sm:w-[72vw] sm:max-w-[58rem] lg:w-[60vw] lg:max-w-[60rem] sm:rounded-[28px] sm:p-8"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex-1 space-y-6 overflow-y-auto px-1 sm:space-y-8 sm:px-0">
          {/* Paso 1: Selección de paquete */}
          {step === 'paquete' && (
            <div className="space-y-6 sm:space-y-8">
              <div className="space-y-4 sm:space-y-5">
                <span className="inline-flex h-8 items-center justify-center rounded-full border border-white/20 bg-black/40 px-5 text-[10px] font-medium uppercase tracking-[0.28em] text-zinc-200 sm:h-9 sm:text-[11px]">
                  Paso 1 de 3
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
                  <div className="flex h-7 w-7 min-h-[28px] min-w-[28px] items-center justify-center rounded-full border border-white bg-white text-zinc-900 sm:h-8 sm:w-8">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4" strokeWidth={2.4} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-semibold text-zinc-50 sm:text-base">Elegí tu plan de entrenamiento</span>
                    <span className="mt-1 text-[10px] text-zinc-400 sm:text-xs">
                      Seleccioná tus días de asistencia por semana para continuar.
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                {PAQUETES_PRECIOS.map((paquete) => {
                  const isSelected = paqueteSeleccionado === paquete.dias;
                  return (
                    <Card
                      key={paquete.dias}
                      className={`group cursor-pointer border border-white/25 bg-zinc-900/70 backdrop-blur-sm transition-all duration-200 ${
                        isSelected ? 'border-white bg-white text-zinc-900' : 'text-zinc-100'
                      }`}
                      onClick={() => handleSeleccionarPaquete(paquete.dias)}
                      style={
                        isSelected
                          ? {
                              boxShadow:
                                '0 0 40px rgba(255,255,255,0.16), inset 0 0 0 2px rgba(20,20,20,0.75)',
                              cursor: 'default',
                            }
                          : {
                              transition: 'all 0.2s ease',
                            }
                      }
                    >
                      <CardHeader className="px-4 pb-3 pt-4">
                        <CardTitle className="flex items-center justify-between text-sm font-semibold tracking-tight sm:text-base">
                          <span className={`${isSelected ? 'text-zinc-900' : 'text-zinc-100'}`}>
                            {paquete.dias} día{paquete.dias > 1 ? 's' : ''}
                          </span>
                          <Check
                            className={`h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4 ${isSelected ? 'text-zinc-900' : 'text-transparent'}`}
                          />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 px-4 pb-4">
                        <div
                          className={`text-lg font-semibold sm:text-2xl ${isSelected ? 'text-zinc-900' : 'text-zinc-100'}`}
                        >
                          {formatPrecio(paquete.precioPorClase)}
                        </div>
                        <div
                          className={`text-[7px] uppercase tracking-[0.3em] ${
                            isSelected ? 'text-zinc-500' : 'text-zinc-400'
                          }`}
                        >
                          Valor por clase
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Paso 2: Selección de horarios */}
          {step === 'horarios' && !isReview && (
            <>
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('paquete');
                      setHorariosSeleccionados(new Set());
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white transition-colors hover:border-white/40 hover:bg-black/60 sm:h-10 sm:w-10"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>

                <span className="inline-flex h-8 items-center justify-center rounded-full border border-white/20 bg-black/40 px-5 text-[10px] font-medium uppercase tracking-[0.28em] text-zinc-200 sm:h-9 sm:text-[11px]">
                  Paso 2 de 3
                </span>
              </div>

              <div className="rounded-2xl border border-white/30 bg-white/5 p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 text-[11px] text-zinc-300 sm:text-sm">
                    <p className="font-medium text-zinc-100">Sistema de cuota por clase</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-400 sm:text-xs">
                      Seleccioná 1 horario por día de acuerdo al plan elegido. Si querés modificar el plan, volvé al paso anterior. Los horarios se reservarán automáticamente cada mes.
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[8px] font-normal uppercase tracking-[0.28em] text-zinc-400 sm:text-[11px] sm:font-medium">
                        <span className="inline-flex h-2 w-2 items-center justify-center rounded-full bg-white" />
                        <span className="font-normal text-zinc-100 sm:font-medium">
                          Horarios seleccionados: {horariosSeleccionados.size}/{paqueteSeleccionado || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="block sm:hidden">
                <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-zinc-950/60">
                  {diasSemana.map(dia => {
                    const horariosDelDia = getHorariosPorDia(dia.numero);
                    const abierto = openDay === dia.numero;
                    return (
                      <div key={dia.numero}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-100"
                          onClick={() => setOpenDay(prev => (prev === dia.numero ? null : dia.numero))}
                        >
                          {dia.nombre}
                          <span className={`transform transition-transform ${abierto ? 'rotate-180' : ''}`}>▾</span>
                        </button>
                        <div
                          className={`overflow-hidden px-4 transition-[max-height,opacity,padding] duration-300 ease-out ${
                            abierto ? 'max-h-96 pb-3 opacity-100' : 'pointer-events-none max-h-0 pb-0 opacity-0'
                          }`}
                        >
                          {horariosDelDia.length === 0 ? (
                            <p className="py-2 text-center text-sm text-zinc-500">No hay horarios disponibles</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {horariosDelDia.map(horario => {
                                const estaSeleccionado = isHorarioSeleccionado(horario.id);
                                const puedeSeleccionar = puedeSeleccionarHorario(horario.id);
                                return (
                                  <Button
                                    key={horario.id}
                                    variant="outline"
                                    size="sm"
                                    className={`h-10 w-full justify-center text-[13px] font-light transition-colors ${
                                      estaSeleccionado
                                        ? 'border-white bg-white text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.12)]'
                                        : puedeSeleccionar
                                        ? 'border-white/20 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-900'
                                        : 'cursor-not-allowed border-white/5 bg-zinc-950 text-zinc-600 opacity-50'
                                    }`}
                                    onClick={() => toggleHorario(horario.id, dia.numero)}
                                    disabled={!puedeSeleccionar}
                                  >
                                    {formatTime(horario.hora_inicio)} - {formatTime(horario.hora_fin)}
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="hidden grid-cols-2 gap-4 sm:grid lg:grid-cols-3">
                {diasSemana.map(dia => {
                  const horariosDelDia = getHorariosPorDia(dia.numero);
                  return (
                    <Card
                      key={dia.numero}
                      className="border border-white/10 bg-zinc-950/70 backdrop-blur-sm"
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-sm font-normal text-zinc-100">
                          <span className="text-[9px] uppercase tracking-[0.28em] text-zinc-400">{dia.nombre}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {horariosDelDia.length === 0 ? (
                            <p className="py-2 text-center text-xs text-zinc-500">No hay horarios disponibles</p>
                          ) : (
                            horariosDelDia.map(horario => {
                              const estaSeleccionado = isHorarioSeleccionado(horario.id);
                              const puedeSeleccionar = puedeSeleccionarHorario(horario.id);
                              return (
                                <Button
                                  key={horario.id}
                                  variant="outline"
                                  size="sm"
                                  className={`h-8 w-full justify-start text-[10px] font-light transition-colors ${
                                    estaSeleccionado
                                      ? 'border-white bg-white text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.12)]'
                                      : puedeSeleccionar
                                      ? 'border-white/20 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-900'
                                      : 'cursor-not-allowed border-white/5 bg-zinc-950 text-zinc-600 opacity-50'
                                  }`}
                                  onClick={() => toggleHorario(horario.id, dia.numero)}
                                  disabled={!puedeSeleccionar}
                                >
                                  {formatTime(horario.hora_inicio)} - {formatTime(horario.hora_fin)}
                                </Button>
                              );
                            })
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}

          {/* Paso 3: Etapa de revisión final */}
          {step === 'review' && isReview && (
            <div className="space-y-6 sm:space-y-8">
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('horarios');
                      setIsReview(false);
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white transition-colors hover:border-white/40 hover:bg-black/60 sm:h-10 sm:w-10"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>
                <span className="inline-flex h-8 items-center justify-center rounded-full border border-white/20 bg-black/40 px-5 text-[10px] font-medium uppercase tracking-[0.28em] text-zinc-200 sm:h-9 sm:text-[11px]">
                  Paso 3 de 3
                </span>
              </div>

              <div className="rounded-2xl border border-white/40 bg-white/5 p-4 sm:p-6">
                <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.28em] text-zinc-300 sm:text-sm">Plan seleccionado</h4>
                <div className="flex items-start justify-between gap-3 sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-normal text-zinc-100 sm:text-lg sm:font-semibold">
                      {paqueteSeleccionado} día{paqueteSeleccionado && paqueteSeleccionado > 1 ? 's' : ''} por semana
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-lg font-semibold text-zinc-100 sm:text-2xl">
                  {formatPrecio(PAQUETES_PRECIOS.find(p => p.dias === paqueteSeleccionado)?.precioPorClase || 0)}
                  <span className="ml-2 text-xs uppercase tracking-[0.25em] text-zinc-500 sm:text-sm">/ clase</span>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 sm:p-6">
                <h4 className="text-xs font-normal uppercase tracking-[0.16em] text-zinc-300 sm:text-sm sm:font-semibold sm:tracking-[0.28em]">Horarios elegidos</h4>
                <ul className="space-y-1 text-xs text-zinc-400 sm:text-sm">
                  {Array.from(horariosSeleccionados).map(id => {
                    const h = horariosClase.find(x => x.id === id);
                    const dia = diasSemana.find(d => d.numero === h?.dia_semana)?.nombre;
                    return (
                      <li key={id} className="flex items-center space-x-2">
                        <Check className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
                        <span>{dia}: {formatTime(h?.hora_inicio)} - {formatTime(h?.hora_fin)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[11px] text-zinc-300 sm:p-6 sm:text-xs">
                <strong className="font-semibold text-zinc-100">Importante:</strong> La cuota mensual se tendrá en cuenta a partir del horario seleccionado más cercano, no es posible decidir la fecha de inicio del entrenamiento.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className={step === 'review' ? 'flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-2' : undefined}>
          {step === 'paquete' && (
            <div className="flex w-full justify-end">
              <Button
                onClick={handleContinuarDesdePaquete}
                disabled={!paqueteSeleccionado || saving}
                className="w-full border border-transparent bg-white text-[13px] text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-white/20 disabled:bg-white/30 disabled:text-zinc-500 sm:w-auto sm:text-sm"
              >
                Continuar
              </Button>
            </div>
          )}

          {step === 'horarios' && (
            <>
              <Button
                onClick={handleSave}
                disabled={saving || horariosSeleccionados.size === 0 || horariosSeleccionados.size !== paqueteSeleccionado}
                className="border border-transparent bg-white text-[13px] text-zinc-900 transition-colors hover:bg-zinc-100 sm:text-sm"
              >
                Continuar
              </Button>
            </>
          )}

          {step === 'review' && (
            <>
              <Button
                onClick={handleConfirm}
                disabled={saving}
                className="border border-transparent bg-white text-zinc-900 transition-colors hover:bg-zinc-100"
              >
                {saving ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-zinc-900"></div>
                    Guardando...
                  </>
                ) : (
                  'Confirmar horarios'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

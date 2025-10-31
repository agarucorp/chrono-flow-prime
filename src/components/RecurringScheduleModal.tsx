import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Check, AlertCircle } from 'lucide-react';
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
  { dias: 1, precioPorClase: 15000 },
  { dias: 2, precioPorClase: 14000 },
  { dias: 3, precioPorClase: 12000 },
  { dias: 4, precioPorClase: 11000 },
  { dias: 5, precioPorClase: 10000 }
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
      
      // Si el horario ya está seleccionado, deseleccionar
      if (newSelection.has(horarioId)) {
        newSelection.delete(horarioId);
        return newSelection;
      }
      
      // Si no hay paquete seleccionado, no permitir seleccionar
      if (!paqueteSeleccionado) {
        return prev;
      }
      
      // Si ya se alcanzó el límite del paquete, no permitir seleccionar más
      if (newSelection.size >= paqueteSeleccionado) {
        return prev;
      }
      
      // Permitir seleccionar el horario
      newSelection.add(horarioId);
      return newSelection;
    });
  };

  const handleSeleccionarPaquete = (dias: number) => {
    setPaqueteSeleccionado(dias);
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

      // Notificar al panel para recargar "Mis Clases"
      window.dispatchEvent(new CustomEvent('horariosRecurrentes:updated'));

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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => undefined}>
      <DialogContent
        hideClose
        className="h-[100dvh] w-[100vw] max-w-none sm:max-w-4xl sm:max-h-[85vh] sm:w-auto sm:rounded-lg p-4 sm:p-6 border-0 sm:border shadow-none sm:shadow-lg overflow-hidden flex flex-col"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base lg:text-lg">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="truncate">
              {step === 'paquete' && 'Elegí tu plan de entrenamiento'}
              {step === 'horarios' && 'Seleccioná tus horarios'}
              {step === 'review' && 'Confirmá tu selección'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 flex-1 overflow-y-auto px-1 sm:px-0">
          {/* Paso 1: Selección de paquete */}
          {step === 'paquete' && (
            <div className="space-y-3 sm:space-y-4">

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                {PAQUETES_PRECIOS.map((paquete) => (
                  <Card
                    key={paquete.dias}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary ${paqueteSeleccionado === paquete.dias ? 'border-primary ring-2 ring-primary' : ''
                      }`}
                    onClick={() => handleSeleccionarPaquete(paquete.dias)}
                  >
                    <CardHeader className="pb-2 px-3 pt-3">
                      <CardTitle className="text-sm sm:text-base flex items-center justify-between gap-1">
                        <span className="truncate">{paquete.dias} día{paquete.dias > 1 ? 's' : ''}</span>
                        <Check className={`h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 ${paqueteSeleccionado === paquete.dias ? 'text-primary' : 'text-transparent'}`} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 px-3 pb-3">
                      <div className="text-lg sm:text-2xl font-bold text-gray-300 break-words">
                        {formatPrecio(paquete.precioPorClase)}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground pt-1 border-t leading-tight">
                        valor por clase
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Paso 2: Selección de horarios */}
          {step === 'horarios' && !isReview && (
            <>
              <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs sm:text-sm text-blue-800 flex-1 min-w-0">
                    <p className="font-medium">Sistema de cuota por clase</p>
                    <p className="text-[11px] sm:text-xs mt-1 leading-relaxed">
                      Seleccioná 1 horario por día de acuerdo al plan elegido, para cambiar de plan volver al paso anterior. Los horarios se reservarán automáticamente cada mes.
                    </p>
                    {/* Indicador de selección */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <span className="text-xs font-medium">
                          Horarios seleccionados: {horariosSeleccionados.size}/{paqueteSeleccionado || 0}
                        </span>
                      </div>
                      {paqueteSeleccionado && horariosSeleccionados.size >= paqueteSeleccionado && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ Plan completo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="block sm:hidden">
                <div className="divide-y divide-border rounded-md border">
                  {diasSemana.map(dia => {
                    const horariosDelDia = getHorariosPorDia(dia.numero);
                    const abierto = openDay === dia.numero;
                    return (
                      <div key={dia.numero}>
                        <button
                          type="button"
                          className="w-full px-4 py-3 text-base font-medium flex items-center justify-between"
                          onClick={() => setOpenDay(prev => (prev === dia.numero ? null : dia.numero))}
                        >
                          {dia.nombre}
                          <span className={`transform transition-transform ${abierto ? 'rotate-180' : ''}`}>▾</span>
                        </button>
                        <div
                          className={`px-4 overflow-hidden transition-[max-height,opacity,padding] duration-300 ease-out ${abierto ? 'pb-3 max-h-96 opacity-100' : 'pb-0 max-h-0 opacity-0 pointer-events-none'}`}
                        >
                          {horariosDelDia.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">No hay horarios disponibles</p>
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
                                    className={`w-full justify-center text-sm h-10 ${
                                      estaSeleccionado
                                        ? 'bg-white text-gray-900 border-white shadow-md'
                                        : puedeSeleccionar
                                        ? 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
                                        : 'bg-gray-900 text-gray-600 border-gray-700 opacity-50 cursor-not-allowed'
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

              <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-4">
                {diasSemana.map(dia => {
                  const horariosDelDia = getHorariosPorDia(dia.numero);
                  return (
                    <Card key={dia.numero}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>{dia.nombre}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {horariosDelDia.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">No hay horarios disponibles</p>
                          ) : (
                            horariosDelDia.map(horario => {
                              const estaSeleccionado = isHorarioSeleccionado(horario.id);
                              const puedeSeleccionar = puedeSeleccionarHorario(horario.id);
                              return (
                                <Button
                                  key={horario.id}
                                  variant="outline"
                                  size="sm"
                                  className={`w-full justify-start text-xs h-8 ${
                                    estaSeleccionado
                                      ? 'bg-white text-gray-900 border-white shadow-md'
                                      : puedeSeleccionar
                                      ? 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
                                      : 'bg-gray-900 text-gray-600 border-gray-700 opacity-50 cursor-not-allowed'
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
            <div className="space-y-4 max-w-md mx-auto px-2">
              {/* Resumen del paquete */}
              <div className="p-3 sm:p-4 bg-primary/10 border border-primary rounded-lg">
                <h4 className="font-medium text-sm mb-2">Plan seleccionado</h4>
                <div className="flex items-start sm:items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-base sm:text-lg font-bold break-words">
                      {paqueteSeleccionado} día{paqueteSeleccionado && paqueteSeleccionado > 1 ? 's' : ''} por semana
                    </p>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-300 flex-shrink-0 break-words">
                    {formatPrecio(PAQUETES_PRECIOS.find(p => p.dias === paqueteSeleccionado)?.precioPorClase || 0)}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">valor por clase</p>
              </div>

              {/* Resumen de horarios */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h4 className="font-medium text-sm">Horarios elegidos</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {Array.from(horariosSeleccionados).map(id => {
                    const h = horariosClase.find(x => x.id === id);
                    const dia = diasSemana.find(d => d.numero === h?.dia_semana)?.nombre;
                    return (
                      <li key={id} className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span>{dia}: {formatTime(h?.hora_inicio)} - {formatTime(h?.hora_fin)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Información importante */}
              <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-md p-3">
                <strong>Importante:</strong> La cuota mensual se tendrá en cuenta a partir del horario seleccionado más cercano, no es posible decidir la fecha de inicio del entrenamiento.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className={step === 'review' ? 'flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-2' : undefined}>
          {step === 'paquete' && (
            <div className="text-center text-sm text-muted-foreground">
              Seleccioná un plan para continuar
            </div>
          )}

          {step === 'horarios' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('paquete');
                  setHorariosSeleccionados(new Set());
                }}
                disabled={saving}
              >
                Volver
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || horariosSeleccionados.size === 0 || horariosSeleccionados.size !== paqueteSeleccionado}
              >
                Continuar
              </Button>
            </>
          )}

          {step === 'review' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('horarios');
                  setIsReview(false);
                }}
                disabled={saving}
              >
                Volver al paso anterior
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={saving}
                className="bg-white text-gray-900 hover:bg-gray-100 border border-gray-300"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
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

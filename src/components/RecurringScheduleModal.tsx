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

  // Días de la semana
  const diasSemana = [
    { numero: 1, nombre: 'Lunes', nombreCorto: 'Lun' },
    { numero: 2, nombre: 'Martes', nombreCorto: 'Mar' },
    { numero: 3, nombre: 'Miércoles', nombreCorto: 'Mié' },
    { numero: 4, nombre: 'Jueves', nombreCorto: 'Jue' },
    { numero: 5, nombre: 'Viernes', nombreCorto: 'Vie' }
  ];

  // Cargar horarios de clase disponibles
  useEffect(() => {
    if (isOpen) {
      console.log(`🔥 RecurringScheduleModal VERSION: ${BUILD_VERSION}`);
      console.log('📌 This version DOES NOT include horario_clase_id or created_at in inserts');
      fetchHorariosClase();
    }
  }, [isOpen]);

  const fetchHorariosClase = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('horarios_semanales')
        .select('*')
        .eq('activo', true)
        .order('dia_semana', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) {
        console.error('Error cargando horarios:', error);
        showError('Error', 'No se pudieron cargar los horarios disponibles');
        return;
      }

      setHorariosClase(data || []);
    } catch (error) {
      console.error('Error inesperado:', error);
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
      
      // Verificar si ya hay un horario seleccionado para este día
      const horariosDelDia = horariosClase.filter(h => h.dia_semana === diaSemana);
      const horariosDelDiaSeleccionados = horariosDelDia.filter(h => newSelection.has(h.id));
      
      if (horariosDelDiaSeleccionados.length > 0 && !newSelection.has(horarioId)) {
        // Si ya hay un horario seleccionado para este día, remover el anterior
        horariosDelDiaSeleccionados.forEach(h => newSelection.delete(h.id));
      }
      
      if (newSelection.has(horarioId)) {
        newSelection.delete(horarioId);
      } else {
        newSelection.add(horarioId);
      }
      
      return newSelection;
    });
  };

  const handleSave = () => {
    if (horariosSeleccionados.size === 0) {
      showError('Selección requerida', 'Debes seleccionar al menos un horario para tu cuota mensual');
      return;
    }
    // Avanzar a etapa de revisión (no cierra ni inserta todavía)
    setIsReview(true);
  };

  const handleConfirm = async () => {
    try {
      setSaving(true);
      const loadingToast = showLoading('Guardando horarios...');

      console.log('🔄 Iniciando confirmación de horarios recurrentes...');
      console.log('👤 Usuario:', user?.id);
      console.log('📅 Horarios seleccionados:', Array.from(horariosSeleccionados));

      // Verificar que el usuario tiene perfil, si no, crearlo
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user?.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        console.log('📝 Creando perfil para usuario...');
        // El perfil no existe, crearlo
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
        console.log('✅ Perfil creado exitosamente');
      } else if (profileError) {
        console.error('❌ Error verificando perfil:', profileError);
        dismissToast(loadingToast);
        showError('Error', 'Error al verificar el perfil de usuario');
        return;
      } else {
        console.log('✅ Perfil existe:', profile?.id);
      }

      const horariosRecurrentes = Array.from(horariosSeleccionados).map(horarioId => {
        const horario = horariosClase.find(h => h.id === horarioId);
        return {
          usuario_id: user?.id,
          dia_semana: horario?.dia_semana,
          hora_inicio: horario?.hora_inicio,
          hora_fin: horario?.hora_fin,
          activo: true,
          fecha_inicio: new Date().toISOString().split('T')[0]
        };
      });

      console.log('💾 Datos a insertar:', horariosRecurrentes);

      const { error } = await supabase
        .from('horarios_recurrentes_usuario')
        .insert(horariosRecurrentes);

      dismissToast(loadingToast);

      if (error) {
        console.error('❌ Error guardando horarios recurrentes:', error);
        showError('Error', `No se pudieron guardar tus horarios recurrentes: ${error.message}`);
        return;
      }

      console.log('✅ Horarios recurrentes guardados exitosamente');
      showSuccess('¡Horarios confirmados!', 'Tus horarios recurrentes fueron guardados');
      
      // Generar cuota mensual automáticamente para el mes actual
      const ahora = new Date();
      const mesActual = ahora.getMonth() + 1;
      const anioActual = ahora.getFullYear();
      
      console.log('💰 Generando cuota mensual para:', { anio: anioActual, mes: mesActual });
      
      const { error: cuotaError } = await supabase.rpc('fn_generar_cuotas_mes', {
        p_anio: anioActual,
        p_mes: mesActual
      });
      
      if (cuotaError) {
        console.error('⚠️ Error generando cuota mensual:', cuotaError);
        // No bloqueamos el flujo, solo advertimos
      } else {
        console.log('✅ Cuota mensual generada exitosamente');
      }
      
      // Notificar al panel para recargar "Mis Clases"
      window.dispatchEvent(new CustomEvent('horariosRecurrentes:updated'));
      
      console.log('🔄 Llamando onComplete...');
      onComplete();
      console.log('✅ onComplete ejecutado');
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
          <DialogTitle className="flex items-center space-x-2 text-base sm:text-lg">
            <Calendar className="h-5 w-5" />
            <span>Seteo de horario recurrente</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 flex-1 overflow-y-auto">
          {!isReview && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Sistema de cuota mensual</p>
                  <p className="text-xs mt-1">
                    Los horarios que selecciones se reservarán automáticamente cada mes. 
                    Solo puedes elegir 1 clase por día para mantener la disponibilidad para otros usuarios.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Selección de horarios (solo en etapa 1) */}
          {!isReview && (
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
                          {horariosDelDia.map(horario => (
                            <Button
                              key={horario.id}
                              variant={isHorarioSeleccionado(horario.id) ? 'default' : 'outline'}
                              size="sm"
                              className="w-full justify-center text-sm h-10"
                              onClick={() => toggleHorario(horario.id, dia.numero)}
                            >
                              {formatTime(horario.hora_inicio)} - {formatTime(horario.hora_fin)}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          )}

          {!isReview && (
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
                        horariosDelDia.map(horario => (
                          <Button
                            key={horario.id}
                            variant={isHorarioSeleccionado(horario.id) ? 'default' : 'outline'}
                            size="sm"
                            className="w-full justify-start text-xs h-8"
                            onClick={() => toggleHorario(horario.id, dia.numero)}
                          >
                            {formatTime(horario.hora_inicio)} - {formatTime(horario.hora_fin)}
                          </Button>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          )}

          {/* Etapa de revisión final */}
          {isReview && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3 max-w-md mx-auto">
              <h4 className="font-medium text-sm">Resumen de clases elegidas</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {Array.from(horariosSeleccionados).map(id => {
                  const h = horariosClase.find(x => x.id === id);
                  const dia = diasSemana.find(d => d.numero === h?.dia_semana)?.nombre;
                  return (
                    <li key={id}>{dia}: {formatTime(h?.hora_inicio)} - {formatTime(h?.hora_fin)}</li>
                  );
                })}
              </ul>
              <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-md p-3">
                <strong>Importante:</strong> La cuota mensual se tendrá en cuenta a partir del horario seleccionado más cercano, no es posible decidir la fecha de inicio del entrenamiento.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className={isReview ? 'flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-2' : undefined}>
          {!isReview ? (
            <Button onClick={handleSave} disabled={saving || horariosSeleccionados.size === 0}>
              Guardar y continuar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsReview(false)} disabled={saving}>
                Volver al paso anterior
              </Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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

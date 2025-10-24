import { useState } from 'react';
import { Calendar, Clock, User, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';

interface Turno {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: 'disponible' | 'ocupado' | 'cancelado';
  cliente_id?: string;
  cliente_nombre?: string;
  profesional_id?: string;
  profesional_nombre?: string;
  servicio?: string;
}

interface AdminTurnoInfoModalProps {
  turno: Turno;
  isOpen: boolean;
  onClose: () => void;
  onTurnoUpdated: () => void;
}

export const AdminTurnoInfoModal = ({ turno, isOpen, onClose, onTurnoUpdated }: AdminTurnoInfoModalProps) => {
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);

  if (!isOpen || !turno) return null;

  // Mostrar alerta de confirmación
  const mostrarConfirmacion = () => {
    setShowConfirmAlert(true);
  };

  // Eliminar clase (cancelar como admin)
  const eliminarTurno = async () => {
    try {
      console.log('🚀 eliminarTurno llamada - turno:', turno);
      
      if (!turno) {
        console.log('❌ No hay turno seleccionado');
        showError('Error', 'No hay turno seleccionado para eliminar');
        return;
      }

      setShowConfirmAlert(false);
      
      console.log('✅ Usuario confirmó la eliminación');
    } catch (error) {
      console.error('❌ Error en confirmación:', error);
      showError('Error', 'Error al procesar la confirmación');
      return;
    }

    try {
      setLoading(true);
      const loadingToast = showLoading('Eliminando clase...');

      // Determinar el tipo de turno
      const esTurnoVariable = turno.id.startsWith('variable_');
      const esTurnoRecurrente = turno.servicio === 'Entrenamiento Recurrente';
      
      console.log('🔍 DEBUG eliminarTurno:', {
        turnoId: turno.id,
        turnoServicio: turno.servicio,
        esTurnoVariable,
        esTurnoRecurrente,
        clienteId: turno.cliente_id,
        fecha: turno.fecha,
        horaInicio: turno.hora_inicio,
        horaFin: turno.hora_fin
      });

      if (esTurnoVariable) {
        // CANCELAR TURNO VARIABLE
        const turnoVariableId = turno.id.replace('variable_', '');
        
        // 1. Buscar el turno variable específico
        const { data: turnoVariable, error: errorBuscar } = await supabase
          .from('turnos_variables')
          .select('id, cliente_id, creado_desde_disponible_id')
          .eq('id', turnoVariableId)
          .eq('estado', 'confirmada')
          .single();

        if (errorBuscar || !turnoVariable) {
          showError('Error', 'No se encontró el turno variable');
          return;
        }

        // 2. Eliminar el turno variable
        const { error: errorEliminar } = await supabase
          .from('turnos_variables')
          .delete()
          .eq('id', turnoVariable.id);

        if (errorEliminar) {
          showError('Error', 'No se pudo eliminar el turno variable');
          return;
        }

        // 3. Calcular si la cancelación es tardía (dentro de 24hs)
        const fechaHoraTurno = new Date(turno.fecha);
        const [hora, minuto] = turno.hora_inicio.split(':');
        fechaHoraTurno.setHours(parseInt(hora), parseInt(minuto), 0, 0);
        
        const ahora = new Date();
        const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        const esCancelacionTardia = diferenciaHoras < 24;

        // 4. Crear registro en turnos_cancelados (esto creará turnos_disponibles automáticamente)
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: turnoVariable.cliente_id,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin',
            cancelacion_tardia: esCancelacionTardia
          });

        if (errorCancelacion) {
          showError('Error', 'No se pudo crear la cancelación');
          return;
        }

      } else if (esTurnoRecurrente) {
        // CANCELAR TURNO RECURRENTE (solo crear cancelación, no eliminar horario fijo)
        
        console.log('🔄 Procesando turno recurrente...');
        
        // Verificar si ya existe una cancelación para este turno
        const { data: cancelacionExistente, error: errorVerificar } = await supabase
          .from('turnos_cancelados')
          .select('id')
          .eq('cliente_id', turno.cliente_id)
          .eq('turno_fecha', turno.fecha)
          .eq('turno_hora_inicio', turno.hora_inicio)
          .eq('turno_hora_fin', turno.hora_fin);

        if (errorVerificar) {
          console.error('❌ Error verificando cancelación existente:', errorVerificar);
          showError('Error', 'No se pudo verificar cancelaciones existentes');
          return;
        }

        if (cancelacionExistente && cancelacionExistente.length > 0) {
          console.log('⚠️ Turno ya cancelado');
          showError('Error', 'Este turno ya está cancelado');
          return;
        }

        // Calcular si la cancelación es tardía (dentro de 24hs)
        const fechaHoraTurno = new Date(turno.fecha);
        const [hora, minuto] = turno.hora_inicio.split(':');
        fechaHoraTurno.setHours(parseInt(hora), parseInt(minuto), 0, 0);
        
        const ahora = new Date();
        const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        const esCancelacionTardia = diferenciaHoras < 24;

        // Crear registro de cancelación
        console.log('➕ Creando cancelación...');
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: turno.cliente_id,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin',
            cancelacion_tardia: esCancelacionTardia
          });

        if (errorCancelacion) {
          console.error('❌ Error creando cancelación:', errorCancelacion);
          showError('Error', 'No se pudo crear la cancelación del turno recurrente');
          return;
        }
        
        console.log('✅ Cancelación creada exitosamente');

      } else {
        // CANCELAR TURNO NORMAL
        // 1. Buscar el turno específico
        const { data: turnoCliente, error: errorBuscar } = await supabase
          .from('turnos')
          .select('*')
          .eq('fecha', turno.fecha)
          .eq('hora_inicio', turno.hora_inicio)
          .eq('cliente_id', turno.cliente_id)
          .eq('estado', 'ocupado')
          .single();

        if (errorBuscar || !turnoCliente) {
          showError('Error', 'No se encontró la reserva del cliente');
          return;
        }

        // 2. Marcar turno como cancelado y liberar cliente
        const { error: errorCancelar } = await supabase
          .from('turnos')
          .update({
            estado: 'cancelado',
            cliente_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', turnoCliente.id);

        if (errorCancelar) {
          showError('Error', 'No se pudo cancelar el turno');
          return;
        }

        // 3. Calcular si la cancelación es tardía (dentro de 24hs)
        const fechaHoraTurno = new Date(turno.fecha);
        const [hora, minuto] = turno.hora_inicio.split(':');
        fechaHoraTurno.setHours(parseInt(hora), parseInt(minuto), 0, 0);
        
        const ahora = new Date();
        const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        const esCancelacionTardia = diferenciaHoras < 24;

        // 4. Crear registro en turnos_cancelados
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: turno.cliente_id,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin',
            cancelacion_tardia: esCancelacionTardia
          });

        if (errorCancelacion) {
          showError('Error', 'No se pudo crear la cancelación');
          return;
        }
      }

      dismissToast(loadingToast);
      showSuccess('Clase eliminada', 'La clase ha sido cancelada exitosamente. Aparecerá en vacantes y el usuario la verá como cancelada.');
      
      console.log('🎉 Éxito! Disparando eventos de actualización...');
      
      // Disparar eventos para actualizar otras vistas
      window.dispatchEvent(new Event('turnosCancelados:updated'));
      window.dispatchEvent(new Event('turnosVariables:updated'));
      window.dispatchEvent(new Event('clasesDelMes:updated'));
      
      console.log('📡 Eventos disparados, llamando onTurnoUpdated...');
      onTurnoUpdated();
      console.log('🚪 Cerrando modal...');
      
      // Cerrar modal después de un pequeño delay para asegurar que se vea el mensaje de éxito
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (error) {
      console.error('Error eliminando clase:', error);
      showError('Error', 'No se pudo eliminar la clase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <Card className="w-full max-w-md max-h-[90vh] sm:max-h-none overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm sm:text-lg font-semibold">Información de la Clase</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="h-6 w-6 p-0 sm:h-8 sm:w-8"
          >
            <X className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-3 sm:space-y-6">
          {/* Información del turno */}
          <div className="space-y-2 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Fecha</Label>
                <p className="font-medium text-xs sm:text-sm">
                  {new Date(turno.fecha).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Horario</Label>
                <p className="font-medium text-xs sm:text-sm">{turno.hora_inicio} - {turno.hora_fin}</p>
              </div>
            </div>
            
            {turno.cliente_nombre && (
              <div>
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Cliente</Label>
                <p className="font-medium text-xs sm:text-sm">{turno.cliente_nombre}</p>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-3 sm:pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="text-xs sm:text-sm w-full sm:w-auto"
            >
              Cerrar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                console.log('🔘 Botón Eliminar Clase clickeado');
                console.log('🔍 Estado loading:', loading);
                console.log('🔍 Turno actual:', turno);
                mostrarConfirmacion();
              }}
              disabled={loading}
              className="text-xs sm:text-sm w-full sm:w-auto"
              style={{ 
                opacity: loading ? 0.5 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              <Trash2 className="h-3 w-3 mr-1 sm:h-4 sm:w-4 sm:mr-2" />
              Eliminar Clase {loading ? '(Cargando...)' : ''}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerta de confirmación */}
      {showConfirmAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Confirmar Cancelación
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                ¿Estás seguro de que quieres cancelar esta clase?<br/>
                El usuario verá la clase como cancelada y aparecerá en vacantes.
              </p>
              
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmAlert(false)}
                  disabled={loading}
                  className="flex-1 text-xs sm:text-sm"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={eliminarTurno}
                  disabled={loading}
                  className="flex-1 text-xs sm:text-sm"
                >
                  {loading ? 'Cancelando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

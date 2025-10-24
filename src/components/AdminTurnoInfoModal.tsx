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

  if (!isOpen || !turno) return null;

  // Eliminar clase (cancelar como admin)
  const eliminarTurno = async () => {
    try {
      console.log('🚀 eliminarTurno llamada - turno:', turno);
      
      if (!turno) {
        console.log('❌ No hay turno seleccionado');
        showError('Error', 'No hay turno seleccionado para eliminar');
        return;
      }

      console.log('🔍 Mostrando confirmación...');
      if (!confirm('¿Estás seguro de que quieres eliminar esta clase? El usuario verá la clase como cancelada y aparecerá en vacantes.')) {
        console.log('❌ Usuario canceló la eliminación');
        return;
      }
      
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

        // 3. Crear registro en turnos_cancelados (esto creará turnos_disponibles automáticamente)
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: turnoVariable.cliente_id,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin'
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

        // Crear registro de cancelación
        console.log('➕ Creando cancelación...');
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: turno.cliente_id,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin'
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

        // 3. Crear registro en turnos_cancelados
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: turno.cliente_id,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin'
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Información de la Clase</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Información del turno */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Fecha</Label>
                <p className="font-medium">
                  {new Date(turno.fecha).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Horario</Label>
                <p className="font-medium">{turno.hora_inicio} - {turno.hora_fin}</p>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Estado</Label>
              <Badge variant={
                turno.estado === 'disponible' ? 'default' :
                turno.estado === 'ocupado' ? 'secondary' : 'destructive'
              }>
                {turno.estado === 'disponible' ? 'Disponible' :
                 turno.estado === 'ocupado' ? 'Ocupado' : 'Cancelado'}
              </Badge>
            </div>

            {turno.cliente_nombre && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                <p className="font-medium">{turno.cliente_nombre}</p>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Servicio</Label>
              <p className="font-medium">{turno.servicio || 'Entrenamiento Personal'}</p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cerrar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                console.log('🔘 Botón Eliminar Clase clickeado');
                console.log('🔍 Estado loading:', loading);
                console.log('🔍 Turno actual:', turno);
                eliminarTurno();
              }}
              disabled={loading}
              style={{ 
                opacity: loading ? 0.5 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar Clase {loading ? '(Cargando...)' : ''}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

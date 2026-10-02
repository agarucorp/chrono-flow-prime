import { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { formatClockRangeAmPm, normalizeTimeToHhMm } from '@/lib/timeFormat';
import { hasClassStarted } from '@/lib/dateLocal';

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
  const [showYaComenzoAlert, setShowYaComenzoAlert] = useState(false);

  if (!isOpen || !turno) return null;

  const claseEnCurso = hasClassStarted(turno.fecha, turno.hora_inicio);

  const mostrarConfirmacion = () => {
    if (claseEnCurso) {
      setShowYaComenzoAlert(true);
      return;
    }
    setShowConfirmAlert(true);
  };

  // Eliminar clase (cancelar como admin)
  const eliminarTurno = async () => {
    try {
      if (!turno) {
        showError('Error', 'No hay turno seleccionado para eliminar');
        return;
      }

      // No permitir eliminar turnos ya cancelados
      if (turno.estado === 'cancelado') {
        showError('Error', 'Esta clase ya está cancelada');
        setShowConfirmAlert(false);
        return;
      }

      if (hasClassStarted(turno.fecha, turno.hora_inicio)) {
        setShowConfirmAlert(false);
        setShowYaComenzoAlert(true);
        return;
      }

      setShowConfirmAlert(false);

    } catch (error) {
      console.error('❌ Error en confirmación:', error);
      showError('Error', 'Error al procesar la confirmación');
      return;
    }

    try {
      setLoading(true);
      const loadingToast = showLoading('Eliminando clase...');

      if (!turno.cliente_id) {
        dismissToast(loadingToast);
        showError('Error', 'La clase no tiene un alumno asociado');
        return;
      }

      // El RPC resuelve solo si la clase es del plan o una vacante reservada,
      // libera el cupo y recalcula la cuota del alumno.
      const { error } = await supabase.rpc('fn_admin_cancelar_clase_por_hora', {
        p_usuario_id: turno.cliente_id,
        p_turno_fecha: turno.fecha,
        p_hora_inicio: normalizeTimeToHhMm(turno.hora_inicio),
      });

      if (error) {
        dismissToast(loadingToast);
        const msg = error.message || '';
        if (msg.toLowerCase().includes('ya empezó') || msg.toLowerCase().includes('ya empezo')) {
          setShowYaComenzoAlert(true);
          return;
        }
        showError('Error', msg || 'No se pudo quitar al alumno de esta clase');
        return;
      }

      dismissToast(loadingToast);
      showSuccess('Clase eliminada', 'La clase fue cancelada. El cupo queda disponible en vacantes y el alumno la verá como cancelada.');

      window.dispatchEvent(new Event('clasesDelMes:updated'));
      window.dispatchEvent(new Event('turnosCancelados:updated'));
      window.dispatchEvent(new Event('alumnosHorarios:updated'));
      window.dispatchEvent(new Event('balance:refresh'));

      onTurnoUpdated();
      onClose();

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
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm sm:text-lg font-semibold">Información de la Clase</CardTitle>
            {turno.estado === 'cancelado' && (
              <Badge variant="destructive" className="text-xs">
                Cancelada
              </Badge>
            )}
          </div>
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
                   {(() => {
                     if (!turno.fecha) return 'Fecha no disponible';
                     
                     const [year, month, day] = turno.fecha.split('-').map(Number);
                     
                     const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
                     const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                     
                     // Calcular día de la semana usando el mismo método que formatLocalDate
                     const d = new Date(year, month - 1, day);
                     const diaSemana = diasSemana[d.getDay()];
                     
                     return `${diaSemana}, ${day} de ${meses[month - 1]} de ${year}`;
                   })()}
                 </p>
              </div>
              <div>
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Horario</Label>
                <p className="font-medium text-xs sm:text-sm">{formatClockRangeAmPm(turno.hora_inicio, turno.hora_fin)}</p>
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
            {/* Solo mostrar botón de eliminar si el turno no está cancelado */}
            {turno.estado !== 'cancelado' && (
              <Button
                variant="destructive"
                onClick={() => {
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
            )}
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
                ¿Cancelar la clase de {turno.cliente_nombre || 'este alumno'} el{' '}
                {(() => {
                  const [year, month, day] = (turno.fecha || '').split('-').map(Number);
                  if (!year || !month || !day) return turno.fecha;
                  return `${day}/${String(month).padStart(2, '0')}/${year}`;
                })()}{' '}
                de {formatClockRangeAmPm(turno.hora_inicio, turno.hora_fin)}?
                <br />
                El cupo se libera en la agenda y en vacantes.
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

      {showYaComenzoAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                La clase ya comenzó
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                No es posible quitar a {turno.cliente_nombre || 'este alumno'} de una clase en curso
                ({formatClockRangeAmPm(turno.hora_inicio, turno.hora_fin)}).
              </p>

              <Button
                onClick={() => setShowYaComenzoAlert(false)}
                className="w-full text-xs sm:text-sm"
              >
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

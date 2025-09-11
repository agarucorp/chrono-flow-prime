import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Users, X, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CancelacionConfirmationModal } from './CancelacionConfirmationModal';

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
  max_alumnos?: number;
}

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface AdminTurnoModalProps {
  turno: Turno | null;
  isOpen: boolean;
  onClose: () => void;
  onTurnoUpdated: () => void;
}

export const AdminTurnoModal = ({ turno, isOpen, onClose, onTurnoUpdated }: AdminTurnoModalProps) => {
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  
  const [clientes, setClientes] = useState<AdminUser[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientesReservados, setClientesReservados] = useState<AdminUser[]>([]);
  const [capacidadDisponible, setCapacidadDisponible] = useState(0);

  // Estado para el modal de confirmación de cancelación
  const [showCancelacionModal, setShowCancelacionModal] = useState(false);
  const [turnoToCancel, setTurnoToCancel] = useState<{clienteId: string, clienteNombre: string} | null>(null);
  const [cancelingTurno, setCancelingTurno] = useState(false);

  // Cargar clientes disponibles y reservas existentes
  useEffect(() => {
    if (isOpen) {
      cargarClientes();
      cargarReservasExistentes();
    }
  }, [isOpen, turno]);

  const cargarClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'client')
        .order('full_name');

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      showError('Error', 'No se pudieron cargar los clientes');
    }
  };

  const cargarReservasExistentes = async () => {
    if (!turno) return;

    try {
      const { data, error } = await supabase
        .from('reservas_turnos')
        .select(`
          cliente_id,
          estado,
          clientes:cliente_id(id, full_name, email)
        `)
        .eq('turno_id', turno.id)
        .eq('estado', 'confirmada');

      if (error) throw error;

      const clientesReservados = data?.map((reserva: any) => ({
        id: reserva.clientes.id,
        full_name: reserva.clientes.full_name,
        email: reserva.clientes.email,
        role: 'client'
      })) || [];

      setClientesReservados(clientesReservados);
      
      // Calcular capacidad disponible
      const maxAlumnos = turno.max_alumnos || 1;
      setCapacidadDisponible(Math.max(0, maxAlumnos - clientesReservados.length));
    } catch (error) {
      console.error('Error cargando reservas:', error);
    }
  };

  // Reservar turno para un cliente
  const reservarTurno = async () => {
    if (!turno || !clienteSeleccionado) {
      showError('Error', 'Selecciona un cliente');
      return;
    }

    if (capacidadDisponible <= 0) {
      showError('Error', 'El turno ya no tiene capacidad disponible');
      return;
    }

    try {
      setLoading(true);
      const loadingToast = showLoading('Reservando turno...');

      // Crear reserva en la tabla de reservas
      const { error } = await supabase
        .from('reservas_turnos')
        .insert({
          turno_id: turno.id,
          cliente_id: clienteSeleccionado,
          estado: 'confirmada'
        });

      dismissToast(loadingToast);

      if (error) throw error;

      showSuccess('Turno reservado', 'El turno ha sido asignado al cliente exitosamente');
      
      // Recargar reservas y limpiar selección
      await cargarReservasExistentes();
      setClienteSeleccionado('');
      onTurnoUpdated();
    } catch (error) {
      console.error('Error reservando turno:', error);
      showError('Error', 'No se pudo reservar el turno');
    } finally {
      setLoading(false);
    }
  };

  // Cancelar reserva de un cliente específico
  const cancelarReserva = async (clienteId: string) => {
    if (!turno) return;

    try {
      setLoading(true);
      const loadingToast = showLoading('Cancelando reserva...');

      // Buscar el turno específico de este cliente en este horario
      const { data: turnoCliente, error: errorBuscar } = await supabase
        .from('turnos')
        .select('*')
        .eq('fecha', turno.fecha)
        .eq('hora_inicio', turno.hora_inicio)
        .eq('cliente_id', clienteId)
        .eq('estado', 'ocupado')
        .single();

      if (errorBuscar) {
        showError('Error', 'No se pudo encontrar la reserva del cliente');
        return;
      }

      // Cancelar la reserva
      const { error: errorCancelar } = await supabase
        .from('turnos')
        .update({
          estado: 'disponible',
          cliente_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', turnoCliente.id);

      if (errorCancelar) {
        showError('Error', 'No se pudo cancelar la reserva');
        return;
      }

      // Registrar disponibilidad en turnos_cancelados
      await supabase
        .from('turnos_cancelados')
        .insert({
          cliente_id: clienteId,
          turno_fecha: turno.fecha,
          turno_hora_inicio: turno.hora_inicio,
          turno_hora_fin: turno.hora_fin,
          tipo_cancelacion: 'admin'
        });

      showSuccess('Reserva cancelada', 'La reserva del cliente ha sido cancelada exitosamente');
      
      // Recargar datos
      await cargarReservasExistentes();
      onTurnoUpdated();
    } catch (error) {
      showError('Error', 'No se pudo cancelar la reserva');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar turno completamente
  const eliminarTurno = async () => {
    if (!turno) return;

    if (!confirm('¿Estás seguro de que quieres eliminar este turno? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setLoading(true);
      const loadingToast = showLoading('Eliminando turno...');

      const { error } = await supabase
        .from('turnos')
        .delete()
        .eq('id', turno.id);

      dismissToast(loadingToast);

      if (error) throw error;

      showSuccess('Turno eliminado', 'El turno ha sido eliminado exitosamente');
      onTurnoUpdated();
      onClose();
    } catch (error) {
      console.error('Error eliminando turno:', error);
      showError('Error', 'No se pudo eliminar el turno');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar clientes por búsqueda y excluir los ya reservados
  const clientesFiltrados = clientes.filter(cliente =>
    (cliente.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     cliente.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    !clientesReservados.some(reservado => reservado.id === cliente.id)
  );

  const handleCancelarClick = (clienteId: string, clienteNombre: string) => {
    setTurnoToCancel({ clienteId, clienteNombre });
    setShowCancelacionModal(true);
  };

  const handleCloseCancelacionModal = () => {
    setShowCancelacionModal(false);
    setTurnoToCancel(null);
    setCancelingTurno(false);
  };

  const handleConfirmCancelacion = async () => {
    if (!turnoToCancel) return;
    
    setCancelingTurno(true);
    await cancelarReserva(turnoToCancel.clienteId);
    setCancelingTurno(false);
    setShowCancelacionModal(false);
    setTurnoToCancel(null);
  };

  if (!isOpen || !turno) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Gestionar Turno</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Información del Turno */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
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
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Capacidad</Label>
              <p className="font-medium">
                {clientesReservados.length} / {turno.max_alumnos || 1} alumnos
              </p>
            </div>
          </div>

          {/* Clientes Reservados */}
          {clientesReservados.length > 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 mb-3">
                <Users className="h-5 w-5 text-blue-600" />
                <Label className="text-base font-medium text-blue-800 dark:text-blue-200">
                  Clientes Reservados ({clientesReservados.length})
                </Label>
              </div>
              
              <div className="space-y-2">
                {clientesReservados.map((cliente) => (
                  <div key={cliente.id} className="flex items-center justify-between p-2 bg-white dark:bg-blue-900 rounded border">
                    <div className="flex items-center space-x-3">
                      <User className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          {cliente.full_name}
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          {cliente.email}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancelarClick(cliente.id, cliente.full_name)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reservar para Nuevo Cliente */}
          {capacidadDisponible > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-green-600" />
                  <Label className="text-base font-medium">Reservar para Cliente</Label>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  {capacidadDisponible} cupo{capacidadDisponible > 1 ? 's' : ''} disponible{capacidadDisponible > 1 ? 's' : ''}
                </Badge>
              </div>
              
              {/* Búsqueda de clientes */}
              <div className="space-y-3">
                <Input
                  placeholder="Buscar cliente por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                
                {/* Lista de clientes */}
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  {clientesFiltrados.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      {searchTerm ? 'No se encontraron clientes' : 'No hay clientes disponibles'}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {clientesFiltrados.map((cliente) => (
                        <div
                          key={cliente.id}
                          className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                            clienteSeleccionado === cliente.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                          }`}
                          onClick={() => setClienteSeleccionado(cliente.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{cliente.full_name}</p>
                              <p className="text-sm text-muted-foreground">{cliente.email}</p>
                            </div>
                            {clienteSeleccionado === cliente.id && (
                              <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Botón para reservar */}
              <Button
                onClick={reservarTurno}
                disabled={!clienteSeleccionado || loading}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Reservar Turno
              </Button>
            </div>
          )}

          {/* Acciones adicionales */}
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
              onClick={eliminarTurno}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar Turno
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Confirmación de Cancelación */}
      <CancelacionConfirmationModal
        turno={{
          id: turno.id,
          fecha: turno.fecha,
          hora_inicio: turno.hora_inicio,
          hora_fin: turno.hora_fin,
          servicio: turno.servicio || 'Entrenamiento Personal',
          estado: 'ocupado',
          profesional_nombre: turnoToCancel ? `Cliente: ${turnoToCancel.clienteNombre}` : undefined
        }}
        isOpen={showCancelacionModal}
        onClose={handleCloseCancelacionModal}
        onConfirm={handleConfirmCancelacion}
        loading={cancelingTurno}
      />
    </div>
  );
};

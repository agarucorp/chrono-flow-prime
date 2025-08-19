import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Users, X, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

  // Cargar clientes disponibles
  useEffect(() => {
    if (isOpen) {
      cargarClientes();
    }
  }, [isOpen]);

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

  // Reservar turno para un cliente
  const reservarTurno = async () => {
    if (!turno || !clienteSeleccionado) {
      showError('Error', 'Selecciona un cliente');
      return;
    }

    try {
      setLoading(true);
      const loadingToast = showLoading('Reservando turno...');

      const { error } = await supabase
        .from('turnos')
        .update({
          estado: 'ocupado',
          cliente_id: clienteSeleccionado,
          updated_at: new Date().toISOString()
        })
        .eq('id', turno.id);

      dismissToast(loadingToast);

      if (error) throw error;

      showSuccess('Turno reservado', 'El turno ha sido asignado al cliente exitosamente');
      onTurnoUpdated();
      onClose();
    } catch (error) {
      console.error('Error reservando turno:', error);
      showError('Error', 'No se pudo reservar el turno');
    } finally {
      setLoading(false);
    }
  };

  // Cancelar reserva de un turno
  const cancelarReserva = async () => {
    if (!turno) return;

    try {
      setLoading(true);
      const loadingToast = showLoading('Cancelando reserva...');

      const { error } = await supabase
        .from('turnos')
        .update({
          estado: 'disponible',
          cliente_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', turno.id);

      dismissToast(loadingToast);

      if (error) throw error;

      showSuccess('Reserva cancelada', 'El turno está disponible nuevamente');
      onTurnoUpdated();
      onClose();
    } catch (error) {
      console.error('Error cancelando reserva:', error);
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

  // Filtrar clientes por búsqueda
  const clientesFiltrados = clientes.filter(cliente =>
    cliente.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <Label className="text-sm font-medium text-muted-foreground">Servicio</Label>
              <p className="font-medium">{turno.servicio || 'Sin especificar'}</p>
            </div>
          </div>

          {/* Cliente Actual (si está reservado) */}
          {turno.estado === 'ocupado' && turno.cliente_nombre && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Cliente Actual
                    </Label>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      {turno.cliente_nombre}
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={cancelarReserva}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancelar Reserva
                </Button>
              </div>
            </div>
          )}

          {/* Reservar para Nuevo Cliente */}
          {turno.estado === 'disponible' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-green-600" />
                <Label className="text-base font-medium">Reservar para Cliente</Label>
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
    </div>
  );
};

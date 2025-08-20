import { useState, useEffect } from 'react';
import { Calendar, Clock, User, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { CalendarView } from '@/components/CalendarView';
import { TurnoConfirmationModal } from '@/components/TurnoConfirmationModal';
import { CancelacionConfirmationModal } from '@/components/CancelacionConfirmationModal';

interface Turno {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: 'disponible' | 'ocupado' | 'cancelado';
  servicio: string;
  cliente_id?: string;
  profesional_id?: string;
}

interface TurnoReservado {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  servicio: string;
  estado: string;
  profesional_nombre?: string;
}

export const TurnoReservation = () => {
  const { user } = useAuthContext();
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  
  const [turnosDisponibles, setTurnosDisponibles] = useState<Turno[]>([]);
  const [turnosReservados, setTurnosReservados] = useState<TurnoReservado[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Estado para el modal de confirmación de reserva
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [turnoToConfirm, setTurnoToConfirm] = useState<Turno | null>(null);
  const [confirmingReservation, setConfirmingReservation] = useState(false);

  // Estado para el modal de confirmación de cancelación
  const [showCancelacionModal, setShowCancelacionModal] = useState(false);
  const [turnoToCancel, setTurnoToCancel] = useState<TurnoReservado | null>(null);
  const [cancelingTurno, setCancelingTurno] = useState(false);

  // Cargar turnos disponibles y reservados
  useEffect(() => {
    fetchTurnos();
  }, [selectedDate]); // Removido selectedService del dependency array

  const fetchTurnos = async () => {
    try {
      setLoading(true);
      console.log('🔍 fetchTurnos: Iniciando carga de turnos...');
      console.log('🔍 fetchTurnos: Fecha seleccionada:', selectedDate.toISOString().split('T')[0]);
      console.log('🔍 fetchTurnos: Usuario actual:', user?.id);
      
      // Obtener turnos disponibles
      const { data: disponibles, error: errorDisponibles } = await supabase
        .from('turnos')
        .select('*')
        .eq('fecha', selectedDate.toISOString().split('T')[0])
        .eq('estado', 'disponible')
        .order('hora_inicio', { ascending: true });

      if (errorDisponibles) {
        console.error('❌ Error obteniendo turnos disponibles:', errorDisponibles);
        return;
      }

      console.log('✅ Turnos disponibles obtenidos:', disponibles);

      // Ya no filtramos por servicio - todos son entrenamiento personal
      setTurnosDisponibles(disponibles || []);

      // Obtener turnos reservados por el usuario
      const { data: reservados, error: errorReservados } = await supabase
        .from('turnos')
        .select(`
          *,
          profesionales:profesional_id(full_name)
        `)
        .eq('cliente_id', user?.id)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (errorReservados) {
        console.error('❌ Error obteniendo turnos reservados:', errorReservados);
        return;
      }

      console.log('✅ Turnos reservados obtenidos:', reservados);

      const turnosReservadosFormateados = reservados?.map(turno => ({
        id: turno.id,
        fecha: turno.fecha,
        hora_inicio: turno.hora_inicio,
        hora_fin: turno.hora_fin,
        servicio: turno.servicio,
        estado: turno.estado,
        profesional_nombre: turno.profesionales?.full_name || 'Sin asignar'
      })) || [];

      setTurnosReservados(turnosReservadosFormateados);
    } catch (error) {
      console.error('❌ Error inesperado:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReservarClick = (turno: Turno) => {
    setTurnoToConfirm(turno);
    setShowConfirmationModal(true);
  };

  const handleConfirmReservation = async (turno: Turno) => {
    try {
      setConfirmingReservation(true);
      console.log('🔍 handleConfirmReservation: Iniciando reserva...');
      console.log('🔍 handleConfirmReservation: Turno a reservar:', turno);
      console.log('🔍 handleConfirmReservation: Usuario actual:', user?.id);
      
      // Verificar que el usuario no tenga ya una reserva para este día
      const { data: reservasExistentes, error: errorVerificacion } = await supabase
        .from('turnos')
        .select('*')
        .eq('cliente_id', user?.id)
        .eq('fecha', selectedDate.toISOString().split('T')[0])
        .in('estado', ['ocupado', 'disponible']);

      if (errorVerificacion) {
        console.error('❌ Error verificando reservas existentes:', errorVerificacion);
        showError('Error al verificar reservas', errorVerificacion.message);
        return;
      }

      if (reservasExistentes && reservasExistentes.length > 0) {
        showError('Límite de reservas alcanzado', 'Solo puedes reservar 1 turno por día');
        return;
      }
      
      const loadingToast = showLoading('Reservando turno...');
      
      // Datos a actualizar
      const datosActualizacion = {
        estado: 'ocupado',
        cliente_id: user?.id,
        updated_at: new Date().toISOString()
      };
      
      console.log('🔍 handleConfirmReservation: Datos a actualizar:', datosActualizacion);
      
      const { data, error, count } = await supabase
        .from('turnos')
        .update(datosActualizacion)
        .eq('id', turno.id)
        .select(); // Agregamos .select() para ver qué se actualizó

      console.log('🔍 handleConfirmReservation: Respuesta completa de Supabase:', { data, error, count });

      dismissToast(loadingToast);

      if (error) {
        console.error('❌ Error al reservar turno:', error);
        showError('Error al reservar turno', error.message);
        return;
      }

      if (!data || data.length === 0) {
        console.error('❌ No se actualizó ningún turno');
        showError('Error al reservar turno', 'No se pudo actualizar el turno');
        return;
      }

      console.log('✅ Turno actualizado en base de datos:', data[0]);
      
      // Verificar que el turno se actualizó correctamente
      const { data: turnoVerificado, error: errorVerificacion2 } = await supabase
        .from('turnos')
        .select('*')
        .eq('id', turno.id)
        .single();

      if (errorVerificacion2) {
        console.error('❌ Error verificando turno actualizado:', errorVerificacion2);
      } else {
        console.log('✅ Turno verificado después de actualización:', turnoVerificado);
      }

      console.log('✅ Turno reservado exitosamente');
      showSuccess('¡Turno reservado exitosamente!', 
        `Has reservado ${turno.servicio} para el ${new Date(turno.fecha).toLocaleDateString('es-ES')} a las ${turno.hora_inicio}`);
      
      // Cerrar modal y limpiar estado
      setShowConfirmationModal(false);
      setTurnoToConfirm(null);
      
      // Forzar recarga de turnos con un pequeño delay
      setTimeout(async () => {
        console.log('🔄 Recargando turnos después de delay...');
        await fetchTurnos();
      }, 500);
    } catch (error) {
      console.error('❌ Error inesperado:', error);
      showError('Error inesperado', 'No se pudo reservar el turno');
    } finally {
      setConfirmingReservation(false);
    }
  };

  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
    setTurnoToConfirm(null);
    setConfirmingReservation(false);
  };

  const handleCancelarClick = (turno: TurnoReservado) => {
    setTurnoToCancel(turno);
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
    await cancelarTurno(turnoToCancel);
    setCancelingTurno(false);
    setShowCancelacionModal(false);
    setTurnoToCancel(null);
  };

  const cancelarTurno = async (turno: TurnoReservado) => {
    try {
      const loadingToast = showLoading('Cancelando turno...');
      
      const { error } = await supabase
        .from('turnos')
        .update({
          estado: 'cancelado',
          cliente_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', turno.id);

      dismissToast(loadingToast);

      if (error) {
        showError('Error al cancelar turno', error.message);
        return;
      }

      showSuccess('Turno cancelado', 'Tu turno ha sido cancelado exitosamente');
      
      // Recargar turnos
      await fetchTurnos();
    } catch (error) {
      showError('Error inesperado', 'No se pudo cancelar el turno');
    }
  };

  const navegarFecha = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const formatDate = (date: Date) => {
    const formattedDate = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Capitalizar solo la primera letra del string completo
    return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">


      {/* Tabs para Calendario y Mis Reservas */}
      <Tabs defaultValue="calendario" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendario" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Calendario</span>
          </TabsTrigger>
          <TabsTrigger value="reservados" className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Mis Reservas</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Calendario */}
        <TabsContent value="calendario" className="mt-4">
          <CalendarView onTurnoReservado={fetchTurnos} />
        </TabsContent>
        
        {/* Mis Reservas */}
        <TabsContent value="reservados" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {turnosReservados.length === 0 ? (
                <div className="text-center py-8">
                  <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No tienes sesiones de entrenamiento reservadas</p>
                </div>
              ) : (
                <div className="grid gap-3 grid-cols-4">
                  {turnosReservados.map(turno => (
                    <Card key={turno.id} className="hover:shadow-md transition-shadow min-h-[140px]">
                                             <CardContent className="p-3">
                         <div className="mb-2">
                         </div>
                        
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">
                              {new Date(turno.fecha).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">
                              {turno.hora_inicio} - {turno.hora_fin}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {turno.profesional_nombre}
                            </span>
                          </div>
                        </div>
                        
                        {turno.estado === 'ocupado' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelarClick(turno)}
                            className="w-full"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancelar
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Modal de Confirmación de Reserva */}
      <TurnoConfirmationModal
        turno={turnoToConfirm}
        isOpen={showConfirmationModal}
        onClose={handleCloseConfirmationModal}
        onConfirm={handleConfirmReservation}
        loading={confirmingReservation}
      />

      {/* Modal de Confirmación de Cancelación */}
      <CancelacionConfirmationModal
        turno={turnoToCancel}
        isOpen={showCancelacionModal}
        onClose={handleCloseCancelacionModal}
        onConfirm={handleConfirmCancelacion}
        loading={cancelingTurno}
      />
    </div>
  );
};

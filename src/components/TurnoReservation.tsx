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
  
  // Estado para el modal de confirmación
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [turnoToConfirm, setTurnoToConfirm] = useState<Turno | null>(null);
  const [confirmingReservation, setConfirmingReservation] = useState(false);

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
      const { data: turnoVerificado, error: errorVerificacion } = await supabase
        .from('turnos')
        .select('*')
        .eq('id', turno.id)
        .single();

      if (errorVerificacion) {
        console.error('❌ Error verificando turno actualizado:', errorVerificacion);
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
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'disponible':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'ocupado':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelado':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const testUpdate = async () => {
    try {
      console.log('🧪 Test: Intentando UPDATE directo...');
      
      const { data, error } = await supabase
        .from('turnos')
        .update({ 
          estado: 'ocupado',
          cliente_id: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'd2371dfd-598d-42af-a1c7-419ba206e52c') // ID del turno que vimos en los logs
        .select();
      
      console.log('🧪 Test: Respuesta del UPDATE:', { data, error });
      
      if (error) {
        console.error('❌ Test: Error en UPDATE:', error);
        showError('Test falló', error.message);
      } else {
        console.log('✅ Test: UPDATE exitoso:', data);
        showSuccess('Test exitoso', 'UPDATE funcionó correctamente');
        await fetchTurnos();
      }
    } catch (error) {
      console.error('❌ Test: Error inesperado:', error);
    }
  };

  const testAuth = async () => {
    try {
      console.log('🔐 Test: Verificando autenticación...');
      console.log('🔐 Test: Usuario del contexto:', user);
      
      // Verificar sesión actual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 Test: Sesión actual:', session);
      console.log('🔐 Test: Error de sesión:', sessionError);
      
      // Verificar usuario actual
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      console.log('🔐 Test: Usuario actual de Supabase:', currentUser);
      console.log('🔐 Test: Error de usuario:', userError);
      
      if (session && currentUser) {
        showSuccess('Auth OK', 'Usuario autenticado correctamente');
      } else {
        showError('Auth Error', 'Problema con la autenticación');
      }
    } catch (error) {
      console.error('❌ Test: Error inesperado en auth:', error);
    }
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
      {/* Header con navegación de fecha */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Reserva de Entrenamiento Personal</span>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navegarFecha('prev')}
              >
                ← Anterior
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
              >
                Hoy
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => navegarFecha('next')}
              >
                Siguiente →
              </Button>
            </div>
          </div>
          
          <div className="text-center text-lg font-medium">
            {formatDate(selectedDate)}
          </div>
        </CardHeader>
      </Card>

      {/* Tabs para Turnos Disponibles y Mis Reservas */}
      <Tabs defaultValue="disponibles" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="disponibles" className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4" />
            <span>Turnos Disponibles</span>
          </TabsTrigger>
          <TabsTrigger value="reservados" className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Mis Reservas</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Turnos Disponibles */}
        <TabsContent value="disponibles" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {turnosDisponibles.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay horarios disponibles para entrenamiento personal en esta fecha</p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-4">
                  {turnosDisponibles.slice(0, 8).map(turno => (
                    <Card key={turno.id} className="hover:shadow-md transition-shadow min-h-[140px]">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={getStatusColor(turno.estado)}>
                            {turno.estado}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {turno.servicio}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {turno.hora_inicio} - {turno.hora_fin}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {new Date(turno.fecha).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                        </div>
                        
                        <Button
                          className="w-full mt-3"
                          size="sm"
                          onClick={() => handleReservarClick(turno)}
                        >
                          Reservar
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
                <div className="space-y-4">
                  {turnosReservados.map(turno => (
                    <Card key={turno.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={getStatusColor(turno.estado)}>
                            {turno.estado}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {turno.servicio}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Fecha</p>
                            <p className="text-sm">
                              {new Date(turno.fecha).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Horario</p>
                            <p className="text-sm">
                              {turno.hora_inicio} - {turno.hora_fin}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Profesional</p>
                            <p className="text-sm">
                              {turno.profesional_nombre}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Estado</p>
                            <p className="text-sm capitalize">
                              {turno.estado}
                            </p>
                          </div>
                        </div>
                        
                        {turno.estado === 'ocupado' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => cancelarTurno(turno)}
                            className="w-full"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
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
      
      {/* Vista de Calendario */}
      <div className="mt-8">
        <CalendarView onTurnoReservado={fetchTurnos} />
      </div>

      {/* Modal de Confirmación */}
      <TurnoConfirmationModal
        turno={turnoToConfirm}
        isOpen={showConfirmationModal}
        onClose={handleCloseConfirmationModal}
        onConfirm={handleConfirmReservation}
        loading={confirmingReservation}
      />
    </div>
  );
};

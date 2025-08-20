import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Grid, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { AdminTurnoModal } from './AdminTurnoModal';
import { useAdmin } from '@/hooks/useAdmin';

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



interface CalendarViewProps {
  onTurnoReservado?: () => void; // Callback para notificar cuando se reserva un turno
}

export const CalendarView = ({ onTurnoReservado }: CalendarViewProps) => {
  const { user } = useAuthContext();
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  const { isAdmin } = useAdmin();
  
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  
  // Estado para admin
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminSelectedTurno, setAdminSelectedTurno] = useState<Turno | null>(null);
  


  // Obtener turnos desde Supabase
  useEffect(() => {
    fetchTurnos();
  }, [currentDate]);

  const fetchTurnos = async () => {
    try {
      setLoading(true);
      
      // Calcular fechas de inicio y fin según la vista
      const { startDate, endDate } = getDateRange();
      
      const { data, error } = await supabase
        .from('turnos')
        .select(`
          *,
          clientes:cliente_id(full_name),
          profesionales:profesional_id(full_name)
        `)
        .gte('fecha', startDate.toISOString().split('T')[0])
        .lte('fecha', endDate.toISOString().split('T')[0])
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) {
        console.error('Error obteniendo turnos:', error);
        return;
      }

      // Transformar datos
      const turnosFormateados = data?.map(turno => ({
        id: turno.id,
        fecha: turno.fecha,
        hora_inicio: turno.hora_inicio,
        hora_fin: turno.hora_fin,
        estado: turno.estado,
        cliente_id: turno.cliente_id,
        cliente_nombre: turno.clientes?.full_name || 'Sin asignar',
        profesional_id: turno.profesional_id,
        profesional_nombre: turno.profesionales?.full_name || 'Sin asignar',
        servicio: turno.servicio || 'Sin especificar'
      })) || [];

      // Nota: Se muestran hasta 24 turnos por día (8 horarios × 3 turnos por horario)
      setTurnos(turnosFormateados);
    } catch (error) {
      console.error('Error inesperado:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para reservar turno desde el calendario
  const reservarTurnoDesdeCalendario = async (turno: Turno) => {
    if (!user) {
      showError('Error', 'Debes estar autenticado para reservar');
      return;
    }

    if (turno.estado !== 'disponible') {
      showError('Error', 'Este turno no está disponible');
      return;
    }

    try {
      const loadingToast = showLoading('Reservando entrenamiento...');
      
      const { error } = await supabase
        .from('turnos')
        .update({
          estado: 'ocupado',
          cliente_id: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', turno.id);

      dismissToast(loadingToast);

      if (error) {
        showError('Error al reservar', error.message);
        return;
      }

      showSuccess('¡Entrenamiento reservado!', 
        `Has reservado entrenamiento para el ${new Date(turno.fecha).toLocaleDateString('es-ES')} a las ${turno.hora_inicio}`);
      
      // Recargar turnos
      await fetchTurnos();
      
      // Notificar al componente padre
      if (onTurnoReservado) {
        onTurnoReservado();
      }
      
      // Cerrar modal
      setShowReservationModal(false);
      setSelectedTurno(null);
    } catch (error) {
      showError('Error inesperado', 'No se pudo reservar el entrenamiento');
    }
  };

  // Función para manejar clic en turno del calendario
  const handleTurnoClick = (turno: Turno) => {
    if (isAdmin) {
      // Para admin: abrir modal de gestión
      setAdminSelectedTurno(turno);
      setShowAdminModal(true);
    } else {
      // Para clientes: solo reservar turnos disponibles
      if (turno.estado === 'disponible') {
        setSelectedTurno(turno);
        setShowReservationModal(true);
      }
    }
  };



  // Función para manejar selección de fecha en el calendario compacto
  const handleDateSelect = (date: Date) => {
    setCurrentDate(date);
  };

  // Función para manejar clic en horario para reserva
  const handleTimeSlotReservation = (horaInicio: string, horaFin: string) => {
    const dayTurnos = getTurnosForDate(currentDate);
    
    // Buscar un turno disponible para este horario
    const turnoDisponible = dayTurnos.find(turno => 
      turno.hora_inicio === horaInicio &&
      turno.estado === 'disponible'
    );

    if (turnoDisponible) {
      // Si hay turno disponible, abrir modal de confirmación
      setSelectedTurno(turnoDisponible);
      setShowReservationModal(true);
    } else {
      // Si no hay turnos disponibles, crear un turno temporal para mostrar info
      const turnoTemporal: Turno = {
        id: 'temp',
        fecha: currentDate.toISOString().split('T')[0],
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        estado: 'no_disponible' as any,
        servicio: 'Entrenamiento Personal',
        profesional_nombre: 'Sin asignar'
      };
      
      setSelectedTurno(turnoTemporal);
      setShowReservationModal(true);
    }
  };

  const getDateRange = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    return {
      startDate: new Date(year, month, 1),
      endDate: new Date(year, month + 1, 0)
    };
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const formatDate = (date: Date) => {
    const formattedDate = date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long'
    });
    return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  };

  const getTurnosForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const turnosDelDia = turnos.filter(turno => turno.fecha === dateStr);
    
    // Retornar todos los turnos del día (hasta 24: 8 horarios × 3 turnos por horario)
    return turnosDelDia;
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

  // Función helper para renderizar slots disponibles con diseño unificado
  const renderAvailableSlot = (horaInicio: string, horaFin: string, key: string) => (
    <div key={key} className="p-2 border border-dashed border-green-300 rounded bg-green-50 cursor-pointer hover:bg-green-100 transition-colors">
      <div className="flex items-center justify-between">
        <div className="text-xs text-green-700 font-medium">Slot Disponible</div>
        <div className="text-xs text-green-600 font-medium">{horaInicio} - {horaFin}</div>
        <div className="text-xs text-green-600">Click para reservar</div>
      </div>
    </div>
  );

  // Función helper para renderizar turnos sin asignar con el mismo diseño
  const renderUnassignedTurno = (turno: Turno, key: string) => (
    <div key={key} className="p-2 border border-dashed border-green-300 rounded bg-green-50 cursor-pointer hover:bg-green-100 transition-colors">
      <div className="flex items-center justify-between">
        <div className="text-xs text-green-700 font-medium">Slot Disponible</div>
        <div className="text-xs text-green-600 font-medium">{turno.hora_inicio} - {turno.hora_fin}</div>
        <div className="text-xs text-green-600">Click para reservar</div>
      </div>
    </div>
  );

  // Componente para marcar el día seleccionado
  const SelectedDayMarker = ({ isSelected }: { isSelected: boolean }) => {
    if (!isSelected) return null;
    
    return (
      <div className="absolute inset-0 bg-orange-300/30 rounded-lg pointer-events-none" />
    );
  };

  // Nueva función para renderizar el calendario compacto
  const renderCompactCalendar = () => {
    const { startDate, endDate } = getDateRange();
    const firstDay = new Date(startDate);
    const lastDay = new Date(endDate);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();
    
    const days = [];
    const today = new Date();
    
    // Agregar días del mes anterior para completar la primera semana
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevDate = new Date(firstDay);
      prevDate.setDate(firstDay.getDate() - (firstDayOfWeek - i));
      days.push({ date: prevDate, isCurrentMonth: false });
    }
    
    // Agregar días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(firstDay);
      dayDate.setDate(i);
      days.push({ date: dayDate, isCurrentMonth: true });
    }
    
    // Completar la última semana
    const remainingDays = 42 - days.length; // 6 semanas * 7 días
    for (let i = 1; i <= remainingDays; i++) {
      const nextDate = new Date(lastDay);
      nextDate.setDate(lastDay.getDate() + i);
      days.push({ date: nextDate, isCurrentMonth: false });
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, isCurrentMonth }, index) => {
          const dayTurnos = getTurnosForDate(date);
          const isToday = date.toDateString() === today.toDateString();
          const isSelected = date.toDateString() === currentDate.toDateString();
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          
          return (
            <div
              key={index}
              className={`relative min-h-[48px] p-2 border border-border/50 rounded-lg transition-all duration-200 text-center cursor-pointer ${
                isCurrentMonth ? 'bg-muted/40 hover:bg-muted/60' : 'bg-muted/30'
              } ${isWeekend ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/70'}`}
              onClick={() => !isWeekend && handleDateSelect(date)}
            >
              <SelectedDayMarker isSelected={isSelected} />
              <div className={`text-sm font-medium relative z-10 ${
                isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Función para renderizar los horarios disponibles como CTAs
  const renderAvailableTimeSlots = () => {
    const dayTurnos = getTurnosForDate(currentDate);
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
    
    if (isWeekend) {
      return (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No hay disponibilidad los fines de semana</p>
        </div>
      );
    }

    // Generar los 8 horarios estándar (8:00 a 15:00)
    const timeSlots = [];
    for (let hour = 8; hour < 16; hour++) {
      const horaInicio = `${hour.toString().padStart(2, '0')}:00`;
      const horaFin = `${(hour + 1).toString().padStart(2, '0')}:00`;
      
      // Buscar turnos disponibles para este horario
      const turnosDisponibles = dayTurnos.filter(turno => 
        turno.hora_inicio === horaInicio && turno.estado === 'disponible'
      );
      
      timeSlots.push({
        horaInicio,
        horaFin,
        turnosDisponibles: turnosDisponibles.length,
        totalSlots: 3,
        estado: turnosDisponibles.length > 0 ? 'disponible' : 'no_disponible'
      });
    }

    // Agrupar por AM/PM
    const amSlots = timeSlots.filter(slot => parseInt(slot.horaInicio) < 12);
    const pmSlots = timeSlots.filter(slot => parseInt(slot.horaInicio) >= 12);

    return (
      <div className="space-y-6">
        {/* Horarios AM */}
        {amSlots.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">AM</h4>
            <div className="grid grid-cols-2 gap-3">
              {amSlots.map((slot, index) => (
                <Button
                  key={`am-${index}`}
                  variant={slot.estado === 'disponible' ? 'default' : 'outline'}
                  className={`h-14 justify-between px-4 transition-all duration-200 ${
                    slot.estado === 'disponible' 
                      ? 'hover:shadow-md hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90' 
                      : 'hover:bg-muted/50 border-muted-foreground/30 text-muted-foreground'
                  }`}
                  onClick={() => handleTimeSlotReservation(slot.horaInicio, slot.horaFin)}
                >
                  <div className="flex items-center">
                    <Clock className={`h-4 w-4 mr-2 ${
                      slot.estado === 'disponible' ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`} />
                    <span className="font-medium">{slot.horaInicio} - {slot.horaFin}</span>
                  </div>
                  <Badge 
                    variant={slot.estado === 'disponible' ? 'secondary' : 'destructive'}
                    className={`text-xs font-medium ${
                      slot.estado === 'disponible' 
                        ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90' 
                        : 'bg-destructive text-destructive-foreground'
                    }`}
                  >
                    {slot.estado === 'disponible' 
                      ? `${slot.turnosDisponibles}/3 Disponible${slot.turnosDisponibles > 1 ? 's' : ''}`
                      : 'No Disponible'
                    }
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Horarios PM */}
        {pmSlots.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">PM</h4>
            <div className="grid grid-cols-2 gap-3">
              {pmSlots.map((slot, index) => (
                <Button
                  key={`pm-${index}`}
                  variant={slot.estado === 'disponible' ? 'default' : 'outline'}
                  className={`h-14 justify-between px-4 transition-all duration-200 ${
                    slot.estado === 'disponible' 
                      ? 'hover:shadow-md hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90' 
                      : 'hover:bg-muted/50 border-muted-foreground/30 text-muted-foreground'
                  }`}
                  onClick={() => handleTimeSlotReservation(slot.horaInicio, slot.horaFin)}
                >
                  <div className="flex items-center">
                    <Clock className={`h-4 w-4 mr-2 ${
                      slot.estado === 'disponible' ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`} />
                    <span className="font-medium">{slot.horaInicio} - {slot.horaFin}</span>
                  </div>
                  <Badge 
                    variant={slot.estado === 'disponible' ? 'secondary' : 'destructive'}
                    className={`text-xs font-medium ${
                      slot.estado === 'disponible' 
                        ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90' 
                        : 'bg-destructive text-destructive-foreground'
                    }`}
                  >
                    {slot.estado === 'disponible' 
                      ? `${slot.turnosDisponibles}/3 Disponible${slot.turnosDisponibles > 1 ? 's' : ''}`
                      : 'No Disponible'
                    }
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Reservar Entrenamiento</span>
            </CardTitle>
            

          </div>
          

        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* Calendario pequeño a la izquierda */}
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="flex items-center justify-between mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateDate('prev')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <h3 className="text-xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                    {currentDate.toLocaleDateString('es-ES', { 
                      month: 'long', 
                      year: 'numeric' 
                    }).replace(/^\w/, c => c.toUpperCase())}
                  </h3>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateDate('next')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-1 mb-3">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-semibold text-foreground bg-muted/30 rounded-md">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendario de días */}
              {renderCompactCalendar()}
            </div>
            
            {/* Horarios disponibles a la derecha */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">
                  Horarios Disponibles para {currentDate.toLocaleDateString('es-ES', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  })}
                </h3>
              </div>
              
              {renderAvailableTimeSlots()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de confirmación de reserva */}
      {showReservationModal && selectedTurno && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>
                  {selectedTurno.estado === 'disponible' ? 'Confirmar Reserva' : 'Horario No Disponible'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                {selectedTurno.estado === 'disponible' ? (
                  <>
                    <p className="text-lg font-medium mb-2">¿Confirmar entrenamiento?</p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p><strong>Fecha:</strong> {new Date(selectedTurno.fecha).toLocaleDateString('es-ES')}</p>
                      <p><strong>Horario:</strong> {selectedTurno.hora_inicio} - {selectedTurno.hora_fin}</p>
                      <p><strong>Servicio:</strong> {selectedTurno.servicio}</p>
                      {selectedTurno.profesional_nombre && (
                        <p><strong>Profesional:</strong> {selectedTurno.profesional_nombre}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium mb-2 text-destructive">Este horario no está disponible</p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p><strong>Fecha:</strong> {new Date(selectedTurno.fecha).toLocaleDateString('es-ES')}</p>
                      <p><strong>Horario:</strong> {selectedTurno.hora_inicio} - {selectedTurno.hora_fin}</p>
                      <p><strong>Estado:</strong> Todos los slots están ocupados</p>
                    </div>
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        Te sugerimos elegir otro horario disponible o seleccionar una fecha diferente.
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReservationModal(false);
                    setSelectedTurno(null);
                  }}
                  className="flex-1"
                >
                  {selectedTurno.estado === 'disponible' ? 'Cancelar' : 'Cerrar'}
                </Button>
                {selectedTurno.estado === 'disponible' && (
                  <Button
                    onClick={() => reservarTurnoDesdeCalendario(selectedTurno)}
                    className="flex-1"
                  >
                    Confirmar Reserva
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de gestión para admin */}
      {showAdminModal && adminSelectedTurno && (
        <AdminTurnoModal
          turno={adminSelectedTurno}
          isOpen={showAdminModal}
          onClose={() => {
            setShowAdminModal(false);
            setAdminSelectedTurno(null);
          }}
          onTurnoUpdated={() => {
            fetchTurnos();
            if (onTurnoReservado) {
              onTurnoReservado();
            }
          }}
        />
      )}
    </div>
  );
};

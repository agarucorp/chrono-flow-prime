import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Grid, CalendarDays, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
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

type ViewMode = 'month' | 'week' | 'day';

interface CalendarViewProps {
  onTurnoReservado?: () => void; // Callback para notificar cuando se reserva un turno
}

export const CalendarView = ({ onTurnoReservado }: CalendarViewProps) => {
  const { user } = useAuthContext();
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [loading, setLoading] = useState(true);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);

  // Obtener turnos desde Supabase
  useEffect(() => {
    fetchTurnos();
  }, [currentDate, viewMode]);

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
    if (turno.estado === 'disponible') {
      setSelectedTurno(turno);
      setShowReservationModal(true);
    }
  };

  const getDateRange = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    switch (viewMode) {
      case 'month':
        return {
          startDate: new Date(year, month, 1),
          endDate: new Date(year, month + 1, 0)
        };
      case 'week':
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return { startDate: startOfWeek, endDate: endOfWeek };
      case 'day':
        return {
          startDate: new Date(currentDate),
          endDate: new Date(currentDate)
        };
      default:
        return {
          startDate: new Date(year, month, 1),
          endDate: new Date(year, month + 1, 0)
        };
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    switch (viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setCurrentDate(newDate);
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: viewMode === 'month' ? 'long' : 'short',
      day: viewMode === 'day' ? 'numeric' : undefined,
      weekday: viewMode === 'day' ? 'long' : undefined
    };
    
    if (viewMode === 'week') {
      const { startDate, endDate } = getDateRange();
      return `${startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    
    return date.toLocaleDateString('es-ES', options);
  };

  const getTurnosForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return turnos.filter(turno => turno.fecha === dateStr);
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

  const renderMonthView = () => {
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
      const currentDate = new Date(firstDay);
      currentDate.setDate(i);
      days.push({ date: currentDate, isCurrentMonth: true });
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
        {/* Días de la semana */}
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        
        {/* Días del mes */}
        {days.map(({ date, isCurrentMonth }, index) => {
          const dayTurnos = getTurnosForDate(date);
          const isToday = date.toDateString() === today.toDateString();
          
          return (
            <div
              key={index}
              className={`min-h-[80px] p-1 border border-border ${
                isCurrentMonth ? 'bg-background' : 'bg-muted/30'
              } ${isToday ? 'ring-2 ring-primary' : ''}`}
            >
              <div className={`text-xs p-1 text-right ${
                isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
              } ${isToday ? 'font-bold' : ''}`}>
                {date.getDate()}
              </div>
              
              {/* Turnos del día */}
              <div className="space-y-1">
                {dayTurnos.slice(0, 3).map(turno => (
                  <div
                    key={turno.id}
                    className={`text-xs p-1 rounded border cursor-pointer transition-colors ${getStatusColor(turno.estado)} ${
                      turno.estado === 'disponible' 
                        ? 'hover:bg-green-200 hover:border-green-300' 
                        : ''
                    }`}
                    title={`${turno.hora_inicio} - ${turno.hora_fin} - ${turno.cliente_nombre}`}
                    onClick={() => handleTurnoClick(turno)}
                  >
                    {turno.hora_inicio} - {turno.cliente_nombre}
                  </div>
                ))}
                {dayTurnos.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{dayTurnos.length - 3} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const { startDate } = getDateRange();
    const weekDays = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      weekDays.push(date);
    }

    return (
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((date, index) => {
          const dayTurnos = getTurnosForDate(date);
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <div key={index} className="min-h-[400px]">
              <div className={`text-center p-2 border-b ${
                isToday ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                <div className="font-medium">
                  {date.toLocaleDateString('es-ES', { weekday: 'short' })}
                </div>
                <div className="text-sm">
                  {date.getDate()}/{date.getMonth() + 1}
                </div>
              </div>
              
              <div className="p-2 space-y-2">
                {dayTurnos.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    Sin turnos
                  </div>
                ) : (
                  dayTurnos.map(turno => (
                    <div
                      key={turno.id}
                      className={`p-2 rounded border cursor-pointer transition-colors ${getStatusColor(turno.estado)} ${
                        turno.estado === 'disponible' 
                          ? 'hover:bg-green-200 hover:border-green-300' 
                          : ''
                      }`}
                      onClick={() => handleTurnoClick(turno)}
                    >
                      <div className="font-medium text-xs">
                        {turno.hora_inicio} - {turno.hora_fin}
                      </div>
                      <div className="text-xs">{turno.cliente_nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {turno.profesional_nombre}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const dayTurnos = getTurnosForDate(currentDate);
    const timeSlots = [];
    
    // Crear slots de tiempo de 8:00 a 20:00
    for (let hour = 8; hour < 20; hour++) {
      const time = `${hour.toString().padStart(2, '0')}:00`;
      const turnosInSlot = dayTurnos.filter(turno => 
        turno.hora_inicio.startsWith(hour.toString().padStart(2, '0'))
      );
      
      timeSlots.push({ time, turnos: turnosInSlot });
    }

    return (
      <div className="space-y-4">
        <div className="text-center text-lg font-medium">
          {currentDate.toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
        
        <div className="space-y-2">
          {timeSlots.map(({ time, turnos }) => (
            <div key={time} className="flex items-center space-x-4 p-2 border rounded">
              <div className="w-16 text-sm font-medium text-muted-foreground">
                {time}
              </div>
              
              <div className="flex-1">
                {turnos.length === 0 ? (
                  <div className="text-muted-foreground text-sm">Disponible</div>
                ) : (
                  turnos.map(turno => (
                    <div
                      key={turno.id}
                      className={`inline-block mr-2 p-2 rounded border cursor-pointer transition-colors ${getStatusColor(turno.estado)} ${
                        turno.estado === 'disponible' 
                          ? 'hover:bg-green-200 hover:border-green-300' 
                          : ''
                      }`}
                      onClick={() => handleTurnoClick(turno)}
                    >
                      <div className="font-medium text-sm">
                        {turno.hora_inicio} - {turno.hora_fin}
                      </div>
                      <div className="text-sm">{turno.cliente_nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {turno.profesional_nombre} • {turno.servicio}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
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
              <span>Calendario de Turnos</span>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDate('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Hoy
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDate('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="text-center text-lg font-medium">
            {formatDate(currentDate)}
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="month" className="flex items-center space-x-2">
                <Grid className="h-4 w-4" />
                <span>Mensual</span>
              </TabsTrigger>
              <TabsTrigger value="week" className="flex items-center space-x-2">
                <CalendarDays className="h-4 w-4" />
                <span>Semanal</span>
              </TabsTrigger>
              <TabsTrigger value="day" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Diario</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="month" className="mt-4">
              {renderMonthView()}
            </TabsContent>
            
            <TabsContent value="week" className="mt-4">
              {renderWeekView()}
            </TabsContent>
            
            <TabsContent value="day" className="mt-4">
              {renderDayView()}
            </TabsContent>
          </Tabs>
          
          {/* Leyenda */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                <span>Disponible</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                <span>Ocupado</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
                <span>Cancelado</span>
              </div>
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
                <span>Confirmar Reserva</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-lg font-medium mb-2">¿Confirmar entrenamiento?</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong>Fecha:</strong> {new Date(selectedTurno.fecha).toLocaleDateString('es-ES')}</p>
                  <p><strong>Horario:</strong> {selectedTurno.hora_inicio} - {selectedTurno.hora_fin}</p>
                  <p><strong>Servicio:</strong> {selectedTurno.servicio}</p>
                </div>
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
                  Cancelar
                </Button>
                <Button
                  onClick={() => reservarTurnoDesdeCalendario(selectedTurno)}
                  className="flex-1"
                >
                  Confirmar Reserva
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

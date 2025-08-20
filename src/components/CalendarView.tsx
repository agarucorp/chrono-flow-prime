import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, Grid, CalendarDays, Clock } from 'lucide-react';
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

type ViewMode = 'month' | 'week' | 'day';

interface CalendarViewProps {
  onTurnoReservado?: () => void; // Callback para notificar cuando se reserva un turno
}

export const CalendarView = ({ onTurnoReservado }: CalendarViewProps) => {
  const { user } = useAuthContext();
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  const { isAdmin } = useAdmin();
  
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [loading, setLoading] = useState(true);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  
  // Estado para admin
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminSelectedTurno, setAdminSelectedTurno] = useState<Turno | null>(null);
  
  // Estado para dropdowns de la vista semanal
  const [expandedSlots, setExpandedSlots] = useState<{[key: string]: boolean}>({});

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

  // Función para manejar toggle de dropdowns en vista semanal
  const toggleSlotExpansion = (dayId: string, turnoId: string) => {
    const key = `${dayId}-${turnoId}`;
    setExpandedSlots(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Función para manejar clic en día (navegación inteligente)
  const handleDayClick = (date: Date) => {
    // Verificar que no sea fin de semana
    const isWeekend = date.getDay() === 0 || date.getDay() === 6; // 0 = Domingo, 6 = Sábado
    if (isWeekend) {
      return; // No permitir navegación a fines de semana
    }
    
    if (viewMode === 'month') {
      // Si estamos en vista mensual, cambiar a semanal y centrar en esa fecha
      setCurrentDate(date);
      setViewMode('week');
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
         // Ajustar para que empiece en lunes
         const dayOfWeek = currentDate.getDay();
         if (dayOfWeek === 0) { // Domingo
           startOfWeek.setDate(currentDate.getDate() + 1); // Ir al lunes
         } else if (dayOfWeek === 6) { // Sábado
           startOfWeek.setDate(currentDate.getDate() + 2); // Ir al lunes
         } else {
           startOfWeek.setDate(currentDate.getDate() - dayOfWeek + 1); // Ir al lunes de la semana
         }
         const endOfWeek = new Date(startOfWeek);
         endOfWeek.setDate(startOfWeek.getDate() + 4); // Solo 5 días (lunes a viernes)
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
         // Navegar entre semanas laborables (5 días)
         newDate.setDate(newDate.getDate() + (direction === 'next' ? 5 : -5));
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
       const weekRange = `${startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} (Lun-Vie)`;
       return weekRange.charAt(0).toUpperCase() + weekRange.slice(1);
     }
    
    const formattedDate = date.toLocaleDateString('es-ES', options);
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
           const isWeekend = date.getDay() === 0 || date.getDay() === 6; // 0 = Domingo, 6 = Sábado
           
           return (
             <div
               key={index}
                               className={`min-h-[80px] p-1 border border-border transition-colors ${
                  isCurrentMonth ? 'bg-background' : 'bg-muted/30'
                } ${isToday ? 'ring-2 ring-primary' : ''} ${
                  isWeekend 
                    ? '' 
                    : 'cursor-pointer hover:bg-muted/50'
                }`}
               onClick={() => !isWeekend && handleDayClick(date)}
             >
                               <div className={`text-xs p-1 text-right ${
                  isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                } ${isToday ? 'font-bold' : ''}`}>
                  {date.getDate()}
                </div>
               
                               {/* Resumen de turnos del día */}
                <div className="space-y-1">
                  {!isWeekend && (
                    // Solo para días laborables, mostrar contadores normales
                    <>
                      {/* Contador de turnos disponibles */}
                      {dayTurnos.filter(t => t.estado === 'disponible').length > 0 && (
                        <div className="text-xs p-1 rounded bg-green-100 text-green-800 border border-green-200 text-center">
                          {dayTurnos.filter(t => t.estado === 'disponible').length} Disponibles
                        </div>
                      )}
                      
                      {/* Contador de turnos reservados/ocupados */}
                      {dayTurnos.filter(t => t.estado === 'ocupado').length > 0 && (
                        <div className="text-xs p-1 rounded bg-blue-100 text-blue-800 border border-blue-200 text-center">
                          {dayTurnos.filter(t => t.estado === 'ocupado').length} Reservados
                        </div>
                      )}
                      
                      {/* Contador de turnos cancelados */}
                      {dayTurnos.filter(t => t.estado === 'cancelado').length > 0 && (
                        <div className="text-xs p-1 rounded bg-red-100 text-red-800 border border-blue-200 text-center">
                          {dayTurnos.filter(t => t.estado === 'cancelado').length} Cancelados
                        </div>
                      )}
                      
                      {/* Si no hay turnos, mostrar mensaje */}
                      {dayTurnos.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center">
                          Sin turnos
                        </div>
                      )}
                    </>
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
    
    // Solo mostrar días laborables (lunes a viernes)
    for (let i = 0; i < 5; i++) {
      const date = new Date(startDate);
      // Ajustar para que empiece en lunes (1) en lugar de domingo (0)
      const dayOfWeek = startDate.getDay();
      const daysToAdd = i + (dayOfWeek === 0 ? 1 : dayOfWeek === 6 ? 2 : 0);
      date.setDate(startDate.getDate() + daysToAdd);
      weekDays.push(date);
    }

    // Generar los 8 horarios estándar (8:00 a 15:00)
    const horariosEstandar = [];
    for (let hour = 8; hour < 16; hour++) {
      const horaInicio = `${hour.toString().padStart(2, '0')}:00`;
      const horaFin = `${(hour + 1).toString().padStart(2, '0')}:00`;
      horariosEstandar.push({
        id: `turno-${hour}`,
        horaInicio,
        horaFin,
        nombre: `Turno ${hour - 7}` // Turno 1 (8:00), Turno 2 (9:00), etc.
      });
    }

         return (
       <div className="grid grid-cols-5 gap-4">
         {/* Columnas de días */}
         {weekDays.map((date, dayIndex) => {
          const dayTurnos = getTurnosForDate(date);
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <div key={dayIndex} className="min-h-[400px]">
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
              
                             <div className="space-y-1">
                 {horariosEstandar.map((horario, turnoIndex) => {
                   // Buscar turnos para este horario específico
                   const turnosEnHorario = dayTurnos.filter(turno => 
                     turno.hora_inicio === horario.horaInicio
                   );
                   
                   // Generar 3 slots para este horario
                   const slots = [];
                   for (let i = 0; i < 3; i++) {
                     if (i < turnosEnHorario.length) {
                       const turno = turnosEnHorario[i];
                       slots.push({
                         id: turno.id,
                         estado: turno.estado,
                         cliente_nombre: turno.cliente_nombre,
                         profesional_nombre: turno.profesional_nombre,
                         hora_inicio: turno.hora_inicio,
                         hora_fin: turno.hora_fin,
                         isReal: true
                       });
                     } else {
                       // Slot disponible
                       slots.push({
                         id: `available-${horario.id}-${i}`,
                         estado: 'disponible',
                         isReal: false
                       });
                     }
                   }

                   const expansionKey = `${date.toISOString().split('T')[0]}-${horario.id}`;
                   const isExpanded = expandedSlots[expansionKey];
                   
                   return (
                     <div key={horario.id} className="min-h-[48px]">
                                               {/* Fila del turno con dropdown */}
                        <div className="h-12 flex items-center justify-center">
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="flex items-center space-x-3">
                              {/* Texto "Turno X" */}
                              <span className="text-sm font-semibold text-foreground bg-primary/10 px-3 py-1 rounded-md border border-primary/20">
                                {horario.nombre}
                              </span>
                              
                              {/* Botón de dropdown */}
                              <button
                                onClick={() => toggleSlotExpansion(date.toISOString().split('T')[0], horario.id)}
                                className="w-6 h-6 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30 flex items-center justify-center text-primary transition-all duration-200 hover:scale-110"
                                title="Expandir/Colapsar"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3 text-primary" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 text-primary" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                       
                       {/* Contenido expandido del dropdown */}
                       {isExpanded && (
                         <div className="p-2 bg-gray-50 border-t border-gray-200">
                           <div className="text-xs text-gray-600 mb-2 text-center">
                             {horario.horaInicio} - {horario.horaFin}
                           </div>
                           <div className="space-y-1">
                             {slots.map((slot, slotIndex) => (
                               <div
                                 key={slot.id}
                                 className={`p-2 rounded border text-xs ${
                                   slot.estado === 'disponible' 
                                     ? 'bg-green-50 border-green-200 text-green-800' 
                                     : slot.estado === 'ocupado'
                                     ? 'bg-blue-50 border-blue-200 text-blue-800'
                                     : slot.estado === 'cancelado'
                                     ? 'bg-red-50 border-red-200 text-red-800'
                                     : 'bg-gray-50 border-gray-200 text-gray-600'
                                 }`}
                               >
                                 <div className="flex items-center justify-between">
                                   <span className="font-medium">
                                     Slot {slotIndex + 1}
                                   </span>
                                   <span className="capitalize">
                                     {slot.estado}
                                   </span>
                                 </div>
                                 {slot.isReal && slot.cliente_nombre && (
                                   <div className="text-xs text-muted-foreground mt-1">
                                     Cliente: {slot.cliente_nombre}
                                   </div>
                                 )}
                                 {slot.isReal && slot.profesional_nombre && (
                                   <div className="text-xs text-muted-foreground">
                                     Profesional: {slot.profesional_nombre}
                                   </div>
                                 )}
                               </div>
                             ))}
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 })}
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
    
    // Crear exactamente 8 horarios disponibles (de 8:00 a 15:00, cada hora)
    for (let hour = 8; hour < 16; hour++) {
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
            <div key={time} className="flex items-center space-x-4 p-3 border rounded">
              <div className="w-16 text-sm font-medium text-muted-foreground">
                {time}
              </div>
              
              <div className="flex-1">
                {/* SIEMPRE mostrar 3 cards por línea */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Mostrar turnos reales si existen */}
                  {turnos.slice(0, 3).map((turno, index) => {
                    // Si el turno no tiene cliente asignado, mostrar como slot disponible
                    if (!turno.cliente_id || turno.cliente_nombre === 'Sin asignar') {
                      return renderUnassignedTurno(turno, `unassigned-${turno.id}`);
                    }
                    
                                         // Si tiene cliente, mostrar como turno normal
                     return (
                       <div
                         key={turno.id}
                         className={`p-2 rounded border cursor-pointer transition-colors ${getStatusColor(turno.estado)} ${
                           turno.estado === 'disponible' 
                             ? 'hover:bg-green-200 hover:border-green-300' 
                             : ''
                         }`}
                         onClick={() => handleTurnoClick(turno)}
                       >
                         <div className="flex items-center justify-between">
                           <div className="text-xs font-medium">
                             {turno.hora_inicio} - {turno.hora_fin}
                           </div>
                           <div className="text-xs text-muted-foreground">
                             {turno.profesional_nombre}
                           </div>
                           <div className="text-xs">{turno.cliente_nombre}</div>
                         </div>
                       </div>
                     );
                  })}
                  
                  {/* Completar con slots disponibles hasta llegar a 3 */}
                  {Array.from({ length: Math.max(0, 3 - turnos.length) }).map((_, index) => {
                    const horaInicio = time;
                    const horaFin = `${(parseInt(time.split(':')[0]) + 1).toString().padStart(2, '0')}:00`;
                    return renderAvailableSlot(horaInicio, horaFin, `available-${time}-${index}`);
                  })}
                </div>
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

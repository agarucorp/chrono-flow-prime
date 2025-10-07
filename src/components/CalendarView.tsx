import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Grid, Clock, AlertTriangle, User, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { AdminTurnoModal } from './AdminTurnoModal';
import { ReservaConfirmationModal } from './ReservaConfirmationModal';
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

interface AlumnoHorario {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  tipo: 'recurrente' | 'variable' | 'cancelado';
  hora_inicio: string;
  hora_fin: string;
  fecha?: string;
  activo?: boolean;
}



interface CalendarViewProps {
  onTurnoReservado?: () => void; // Callback para notificar cuando se reserva un turno
  isAdminView?: boolean; // Nueva prop para identificar si es vista de admin
}

export const CalendarView = ({ onTurnoReservado, isAdminView = false }: CalendarViewProps) => {
  const { user } = useAuthContext();
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  const { isAdmin } = useAdmin();
  
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [reservationLoading, setReservationLoading] = useState(false);
  
  // Estado para admin
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminSelectedTurno, setAdminSelectedTurno] = useState<Turno | null>(null);
  
  // Estado para alumnos
  const [alumnosHorarios, setAlumnosHorarios] = useState<AlumnoHorario[]>([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  
  // Estado para acordeón
  const [horariosExpandidos, setHorariosExpandidos] = useState<Set<string>>(new Set());

  // Función para toggle del acordeón - solo permite un dropdown abierto a la vez
  const toggleHorario = (horarioKey: string) => {
    const nuevosExpandidos = new Set<string>();
    if (!horariosExpandidos.has(horarioKey)) {
      // Si el horario no está expandido, lo expandimos y cerramos todos los demás
      nuevosExpandidos.add(horarioKey);
    }
    // Si ya estaba expandido, lo cerramos (nuevosExpandidos queda vacío)
    setHorariosExpandidos(nuevosExpandidos);
  };
  


  // Obtener turnos desde Supabase
  useEffect(() => {
    fetchTurnos();
    if (isAdminView) {
      fetchAlumnosHorarios();
    }
  }, [currentDate, isAdminView]);

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

  // Función para cargar horarios de alumnos
  const fetchAlumnosHorarios = async () => {
    try {
      setLoadingAlumnos(true);
      const fechaActual = currentDate.toISOString().split('T')[0];
      // Convertir día de la semana: JS (0=domingo) -> DB (1=lunes)
      const diaSemana = currentDate.getDay() === 0 ? 7 : currentDate.getDay();


      // Cargar horarios recurrentes
      const { data: horariosRecurrentes, error: errorRecurrentes } = await supabase
        .from('horarios_recurrentes_usuario')
        .select(`
          id,
          dia_semana,
          hora_inicio,
          hora_fin,
          activo,
          usuario_id,
          profiles!inner(full_name, email, phone)
        `)
        .eq('dia_semana', diaSemana)
        .eq('activo', true);


      if (errorRecurrentes) {
        console.error('Error cargando horarios recurrentes:', errorRecurrentes);
      }

      // Cargar turnos variables
      const { data: turnosVariables, error: errorVariables } = await supabase
        .from('turnos_variables')
        .select(`
          id,
          turno_fecha,
          turno_hora_inicio,
          turno_hora_fin,
          estado,
          cliente_id,
          profiles!inner(full_name, email, phone)
        `)
        .eq('turno_fecha', fechaActual)
        .eq('estado', 'confirmada');


      if (errorVariables) {
        console.error('Error cargando turnos variables:', errorVariables);
      }

      // Cargar turnos cancelados (sin embeds para evitar 406 si falta FK)
      const { data: turnosCancelados, error: errorCancelados } = await supabase
        .from('turnos_cancelados')
        .select('id, turno_fecha, turno_hora_inicio, turno_hora_fin, cliente_id')
        .eq('turno_fecha', fechaActual);


      if (errorCancelados) {
        console.error('Error cargando turnos cancelados:', errorCancelados);
      }

      // Combinar todos los datos
      const todosAlumnos: AlumnoHorario[] = [];

      // Agregar horarios recurrentes
      if (horariosRecurrentes) {
        horariosRecurrentes.forEach(horario => {
          const profile = Array.isArray(horario.profiles) ? horario.profiles[0] : horario.profiles;
          todosAlumnos.push({
            id: horario.id,
            nombre: profile?.full_name || 'Sin nombre',
            email: profile?.email || '',
            telefono: profile?.phone,
            tipo: 'recurrente',
            hora_inicio: horario.hora_inicio,
            hora_fin: horario.hora_fin,
            fecha: fechaActual,
            activo: horario.activo
          });
        });
      }

      // Agregar turnos variables
      if (turnosVariables) {
        turnosVariables.forEach(turno => {
          const profile = Array.isArray(turno.profiles) ? turno.profiles[0] : turno.profiles;
          todosAlumnos.push({
            id: turno.id,
            nombre: profile?.full_name || 'Sin nombre',
            email: profile?.email || '',
            telefono: profile?.phone,
            tipo: 'variable',
            hora_inicio: turno.turno_hora_inicio,
            hora_fin: turno.turno_hora_fin,
            fecha: turno.turno_fecha
          });
        });
      }

      // Agregar turnos cancelados
      if (turnosCancelados) {
        turnosCancelados.forEach(turno => {
          const profile = Array.isArray(turno.profiles) ? turno.profiles[0] : turno.profiles;
          todosAlumnos.push({
            id: turno.id,
            nombre: profile?.full_name || 'Sin nombre',
            email: profile?.email || '',
            telefono: profile?.phone,
            tipo: 'cancelado',
            hora_inicio: turno.turno_hora_inicio,
            hora_fin: turno.turno_hora_fin,
            fecha: turno.turno_fecha
          });
        });
      }

      setAlumnosHorarios(todosAlumnos);
    } catch (error) {
      console.error('Error inesperado cargando horarios de alumnos:', error);
    } finally {
      setLoadingAlumnos(false);
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
      setReservationLoading(true);
      
      let error;
      
      if (turno.id === 'temp') {
        // Crear nuevo turno si es temporal
        const { error: insertError } = await supabase
          .from('turnos')
          .insert({
            fecha: turno.fecha,
            hora_inicio: turno.hora_inicio,
            hora_fin: turno.hora_fin,
            estado: 'ocupado',
            cliente_id: user.id,
            servicio: turno.servicio,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        error = insertError;
      } else {
        // Actualizar turno existente
        const { error: updateError } = await supabase
          .from('turnos')
          .update({
            estado: 'ocupado',
            cliente_id: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', turno.id);
        error = updateError;
      }

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
    } finally {
      setReservationLoading(false);
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
    
    // Buscar turnos ocupados para este horario
    const turnosOcupados = dayTurnos.filter(turno => 
      turno.hora_inicio === horaInicio &&
      turno.estado === 'ocupado'
    );

    // Si hay menos de 3 turnos ocupados, el horario está disponible
    if (turnosOcupados.length < 3) {
      // Crear un turno temporal para la reserva
      const turnoTemporal: Turno = {
        id: 'temp',
        fecha: currentDate.toISOString().split('T')[0],
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        estado: 'disponible',
        servicio: 'Entrenamiento Personal',
        profesional_nombre: 'Sin asignar'
      };
      
      setSelectedTurno(turnoTemporal);
      setShowReservationModal(true);
    } else {
      // Si ya están todos los slots ocupados
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
      <div className="grid grid-cols-7 gap-1 w-full max-w-full">
        {days.map(({ date, isCurrentMonth }, index) => {
          const dayTurnos = getTurnosForDate(date);
          const isToday = date.toDateString() === today.toDateString();
          const isSelected = date.toDateString() === currentDate.toDateString();
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          
          return (
            <div
              key={index}
              className={`relative min-h-[48px] p-2 border border-border/50 rounded-lg transition-all duration-200 text-center cursor-pointer min-w-0 ${
                isCurrentMonth ? 'bg-muted/40 hover:bg-muted/60' : 'bg-muted/30'
              } ${isWeekend ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/70'}`}
              onClick={() => !isWeekend && handleDateSelect(date)}
            >
              <SelectedDayMarker isSelected={isSelected} />
              <div className={`text-xs font-medium relative z-10 truncate ${
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
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
    
    if (isWeekend) {
      return (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No hay disponibilidad los fines de semana</p>
        </div>
      );
    }

    if (loadingAlumnos) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando horarios de alumnos...</p>
        </div>
      );
    }

    // Generar los 8 horarios estándar (8:00 a 15:00)
    const timeSlots = [];
    
    for (let hour = 8; hour < 16; hour++) {
      const horaInicio = `${hour.toString().padStart(2, '0')}:00`;
      const horaFin = `${(hour + 1).toString().padStart(2, '0')}:00`;
      
      // Buscar alumnos para este horario
      const alumnosEnHorario = alumnosHorarios.filter(alumno => {
        // Normalizar formato de hora: "09:00:00" -> "09:00"
        const horaAlumno = alumno.hora_inicio.substring(0, 5);
        return horaAlumno === horaInicio;
      });
      
      
      timeSlots.push({
        horaInicio,
        horaFin,
        alumnos: alumnosEnHorario
      });
    }

    // Agrupar por AM/PM
    const amSlots = timeSlots.filter(slot => parseInt(slot.horaInicio) < 12);
    const pmSlots = timeSlots.filter(slot => parseInt(slot.horaInicio) >= 12);

    // Si es vista de admin, mostrar información de alumnos
    if (isAdminView) {
      return (
        <div className="space-y-6">
          {/* Horarios AM */}
          {amSlots.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-3">AM</h4>
              <div className="space-y-3">
                {amSlots.map((slot, index) => {
                  const horarioKey = `am-${slot.horaInicio}`;
                  const isExpanded = horariosExpandidos.has(horarioKey);
                  
                  return (
                    <Card key={`am-${index}`} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div 
                          className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
                          onClick={() => toggleHorario(horarioKey)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-sm sm:text-base">
                              {slot.horaInicio} - {slot.horaFin}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px]">
                              {slot.alumnos.length} Alumno{slot.alumnos.length !== 1 ? 's' : ''}
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="mt-4">
                            {slot.alumnos.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {slot.alumnos.map((alumno, alumnoIndex) => {
                                  // Separar nombre y apellido
                                  const nombreCompleto = alumno.nombre || '';
                                  const partesNombre = nombreCompleto.split(' ');
                                  const nombre = partesNombre[0] || '';
                                  const apellido = partesNombre.slice(1).join(' ') || '';
                                  
                                  return (
                                    <div key={alumnoIndex} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm text-white ${
                                      alumno.tipo === 'recurrente' ? 'border-green-200' :
                                      alumno.tipo === 'variable' ? 'border-blue-200' :
                                      'border-red-200'
                                    }`}>
                                      <div className="font-medium">
                                        {nombre} {apellido}
                                      </div>
                                      <div className="ml-2">
                                        <Badge variant="outline" className={
                                          alumno.tipo === 'recurrente' ? 'text-green-600 border-green-300' :
                                          alumno.tipo === 'variable' ? 'text-blue-600 border-blue-300' :
                                          'text-red-600 border-red-300'
                                        }>
                                          {alumno.tipo === 'recurrente' ? 'Fijo' :
                                           alumno.tipo === 'variable' ? 'Variable' : 'Cancelado'}
                                        </Badge>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                Sin alumnos en este horario
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Horarios PM */}
          {pmSlots.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-3">PM</h4>
              <div className="space-y-3">
                {pmSlots.map((slot, index) => {
                  const horarioKey = `pm-${slot.horaInicio}`;
                  const isExpanded = horariosExpandidos.has(horarioKey);
                  
                  return (
                    <Card key={`pm-${index}`} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div 
                          className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
                          onClick={() => toggleHorario(horarioKey)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-sm sm:text-base">
                              {slot.horaInicio} - {slot.horaFin}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px]">
                              {slot.alumnos.length} Alumno{slot.alumnos.length !== 1 ? 's' : ''}
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="mt-4">
                            {slot.alumnos.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {slot.alumnos.map((alumno, alumnoIndex) => {
                                  // Separar nombre y apellido
                                  const nombreCompleto = alumno.nombre || '';
                                  const partesNombre = nombreCompleto.split(' ');
                                  const nombre = partesNombre[0] || '';
                                  const apellido = partesNombre.slice(1).join(' ') || '';
                                  
                                  return (
                                    <div key={alumnoIndex} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm text-white ${
                                      alumno.tipo === 'recurrente' ? 'border-green-200' :
                                      alumno.tipo === 'variable' ? 'border-blue-200' :
                                      'border-red-200'
                                    }`}>
                                      <div className="font-medium">
                                        {nombre} {apellido}
                                      </div>
                                      <div className="ml-2">
                                        <Badge variant="outline" className={
                                          alumno.tipo === 'recurrente' ? 'text-green-600 border-green-300' :
                                          alumno.tipo === 'variable' ? 'text-blue-600 border-blue-300' :
                                          'text-red-600 border-red-300'
                                        }>
                                          {alumno.tipo === 'recurrente' ? 'Fijo' :
                                           alumno.tipo === 'variable' ? 'Variable' : 'Cancelado'}
                                        </Badge>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                Sin alumnos en este horario
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Vista normal para clientes (código existente)
    return (
      <div className="space-y-6">
        {/* Horarios AM */}
        {amSlots.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-3">AM</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {amSlots.map((slot, index) => (
                <Button
                  key={`am-${index}`}
                  variant={slot.estado === 'disponible' ? 'default' : 'outline'}
                  className={`h-12 sm:h-14 justify-center px-2 sm:px-4 transition-all duration-200 ${
                    slot.estado === 'disponible' 
                      ? 'hover:shadow-md hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90' 
                      : 'hover:bg-muted/50 border-muted-foreground/30 text-muted-foreground'
                  }`}
                  onClick={() => handleTimeSlotReservation(slot.horaInicio, slot.horaFin)}
                >
                  <div className="flex items-center">
                    <Clock className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${
                      slot.estado === 'disponible' ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`} />
                    <span className="font-medium text-[10px] sm:text-xs">{slot.horaInicio} - {slot.horaFin}</span>
                  </div>
                  {slot.estado === 'disponible' && (
                    <Badge 
                      variant="secondary"
                      className="text-xs font-medium bg-primary-foreground text-primary hover:bg-primary-foreground/90 ml-1"
                    >
                      {`${slot.turnosDisponibles}/3`}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Horarios PM */}
        {pmSlots.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-3">PM</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pmSlots.map((slot, index) => (
                <Button
                  key={`pm-${index}`}
                  variant={slot.estado === 'disponible' ? 'default' : 'outline'}
                  className={`h-12 sm:h-14 justify-center px-2 sm:px-4 transition-all duration-200 ${
                    slot.estado === 'disponible' 
                      ? 'hover:shadow-md hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90' 
                      : 'hover:bg-muted/50 border-muted-foreground/30 text-muted-foreground'
                  }`}
                  onClick={() => handleTimeSlotReservation(slot.horaInicio, slot.horaFin)}
                >
                  <div className="flex items-center">
                    <Clock className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${
                      slot.estado === 'disponible' ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`} />
                    <span className="font-medium text-[10px] sm:text-xs">{slot.horaInicio} - {slot.horaFin}</span>
                  </div>
                  {slot.estado === 'disponible' && (
                    <Badge 
                      variant="secondary"
                      className="text-xs font-medium bg-primary-foreground text-primary hover:bg-primary-foreground/90 ml-1"
                    >
                      {`${slot.turnosDisponibles}/3`}
                    </Badge>
                  )}
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
    <div className="w-full max-w-full">
      <Card className="w-full max-w-full">
        <CardHeader className="w-full max-w-full">
          {!isAdminView && (
            <div className="flex items-center justify-between w-full max-w-full">
              <CardTitle className="flex items-center space-x-2 min-w-0">
                <Calendar className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">Reservar Entrenamiento</span>
              </CardTitle>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="w-full max-w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 w-full max-w-full">
                          {/* Calendario pequeño a la izquierda */}
            <div className="space-y-4 w-full max-w-full">
              <div className="text-center mb-4 w-full max-w-full">
                <div className="flex items-center justify-between mb-2 w-full max-w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateDate('prev')}
                    className="flex-shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <h3 className="text-lg font-bold text-foreground bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent truncate px-2">
                    {currentDate.toLocaleDateString('es-ES', { 
                      month: 'long'
                    }).replace(/^\w/, c => c.toUpperCase())}
                  </h3>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateDate('next')}
                    className="flex-shrink-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-1 mb-3 w-full max-w-full">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                  <div key={day} className="p-2 text-center text-xs font-semibold text-foreground bg-muted/30 rounded-md min-w-0">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendario de días */}
              <div className="w-full max-w-full">
                {renderCompactCalendar()}
              </div>
            </div>
            
            {/* Horarios disponibles a la derecha */}
            <div className="space-y-4 w-full max-w-full">
              <div className="text-center w-full max-w-full">
                <h3 className="text-sm sm:text-base font-semibold mb-2 truncate">
                  {!isAdminView && 'Horarios Disponibles para'} {currentDate.toLocaleDateString('es-ES', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  })}
                </h3>
              </div>
              
              <div className="w-full max-w-full overflow-x-auto">
                {renderAvailableTimeSlots()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de confirmación de reserva */}
      {showReservationModal && selectedTurno && selectedTurno.estado === 'disponible' && (
        <ReservaConfirmationModal
          turno={selectedTurno}
          isOpen={showReservationModal}
          onClose={() => {
            setShowReservationModal(false);
            setSelectedTurno(null);
          }}
          onConfirm={() => reservarTurnoDesdeCalendario(selectedTurno)}
          loading={reservationLoading}
        />
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

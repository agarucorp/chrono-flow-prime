import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Grid, Clock, AlertTriangle, User, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { AdminTurnoInfoModal } from './AdminTurnoInfoModal';
import { ReservaConfirmationModal } from './ReservaConfirmationModal';
import { useAdmin } from '@/hooks/useAdmin';
import { useSystemConfig } from '@/hooks/useSystemConfig';
import { format } from 'date-fns';

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
  usuario_id?: string;
}



interface CalendarViewProps {
  onTurnoReservado?: () => void; // Callback para notificar cuando se reserva un turno
  isAdminView?: boolean; // Nueva prop para identificar si es vista de admin
}

export const CalendarView = ({ onTurnoReservado, isAdminView = false }: CalendarViewProps) => {
  const { user } = useAuthContext();
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  const { isAdmin } = useAdmin();
  const { obtenerCapacidadActual } = useSystemConfig();

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
  const [adminSlots, setAdminSlots] = useState<{ horaInicio: string; horaFin: string; capacidad: number }[]>([]);

  // Estado para ausencias del admin
  const [ausenciasAdmin, setAusenciasAdmin] = useState<any[]>([]);

  // Estado para agregar usuario a slot
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Formatear fecha local a YYYY-MM-DD para evitar TZ
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Cargar ausencias del admin
  const cargarAusenciasAdmin = async () => {
    try {
      const { data, error } = await supabase
        .from('ausencias_admin')
        .select('*')
        .eq('activo', true);

      if (error) {
        console.error('❌ Error al cargar ausencias del admin:', error);
        return;
      }

      setAusenciasAdmin(data || []);
    } catch (error) {
      console.error('❌ Error inesperado al cargar ausencias:', error);
    }
  };

  // Función helper para verificar si una fecha+hora está bloqueada por ausencia del admin
  const estaHorarioBloqueado = (fecha: string, horaInicio: string): boolean => {
    const fechaStr = fecha; // Ya viene en formato YYYY-MM-DD

    return ausenciasAdmin.some(ausencia => {
      // Verificar ausencia única
      if (ausencia.tipo_ausencia === 'unica') {
        const fechaAusenciaISO = ausencia.fecha_inicio.split('T')[0];

        if (fechaAusenciaISO === fechaStr) {
          // Si no hay clases específicas, se bloquean todas
          if (!ausencia.clases_canceladas || ausencia.clases_canceladas.length === 0) {
            return true;
          }
          // Si hay clases específicas, necesitamos mapear la hora al número de clase
          // Por simplicidad, bloqueamos todas si coincide la fecha
          return true;
        }
      }

      // Verificar ausencia por período
      if (ausencia.tipo_ausencia === 'periodo') {
        const fechaInicio = new Date(ausencia.fecha_inicio);
        const fechaFin = new Date(ausencia.fecha_fin);
        const fechaCheck = new Date(fechaStr);

        if (fechaCheck >= fechaInicio && fechaCheck <= fechaFin) {
          return true;
        }
      }

      return false;
    });
  };

  // Estado para acordeón
  const [horariosExpandidos, setHorariosExpandidos] = useState<Set<string>>(new Set());

  // Estado para modal de cancelación de alumno
  const [showCancelAlumnoModal, setShowCancelAlumnoModal] = useState(false);
  const [selectedAlumno, setSelectedAlumno] = useState<AlumnoHorario | null>(null);
  const [cancelingAlumno, setCancelingAlumno] = useState(false);

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
    cargarAusenciasAdmin(); // Cargar ausencias del admin
    if (isAdminView) {
      fetchAlumnosHorarios();
      fetchAdminSlots();
    }
  }, [currentDate, isAdminView]);

  // Escuchar cambios en ausencias del admin
  useEffect(() => {
    const handler = async () => {
      await cargarAusenciasAdmin();
      if (isAdminView) {
        await fetchAlumnosHorarios();
      }
    };
    window.addEventListener('ausenciasAdmin:updated', handler);
    return () => window.removeEventListener('ausenciasAdmin:updated', handler);
  }, [isAdminView]);

  // Suscripciones en tiempo real para admin: reflejar altas/bajas al instante
  useEffect(() => {
    if (!isAdminView) return;
    const ch1 = supabase
      .channel('rt_turnos_variables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_variables' }, () => {
        // Agregar delay para asegurar que los cambios se reflejen
        setTimeout(() => {
          fetchAlumnosHorarios();
        }, 200);
      })
      .subscribe();
    const ch2 = supabase
      .channel('rt_horarios_recurrentes_usuario')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios_recurrentes_usuario' }, () => {
        // Agregar delay para asegurar que los cambios se reflejen
        setTimeout(() => {
          fetchAlumnosHorarios();
        }, 200);
      })
      .subscribe();
    const chSlots = supabase
      .channel('rt_horarios_semanales')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios_semanales' }, () => {
        fetchAdminSlots();
      })
      .subscribe();
    const ch3 = supabase
      .channel('rt_turnos_cancelados')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_cancelados' }, () => {
        // Agregar delay para asegurar que los cambios se reflejen
        setTimeout(() => {
          fetchAlumnosHorarios();
        }, 200);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(chSlots);
      supabase.removeChannel(ch3);
    };
  }, [isAdminView, currentDate]);

  // Escuchar eventos de actualización desde AdminTurnoModal
  useEffect(() => {
    const handleTurnosCanceladosUpdated = async () => {
      await fetchAlumnosHorarios();
    };

    const handleTurnosVariablesUpdated = async () => {
      await fetchTurnos();
      await fetchAlumnosHorarios();
    };

    const handleClasesDelMesUpdated = async () => {
      await fetchTurnos();
      await fetchAlumnosHorarios();
    };

    const handleCapacidadUpdated = async () => {
      // Recargar slots para obtener la nueva capacidad
      await fetchAdminSlots();
      await fetchAlumnosHorarios();
    };

    const handleAlumnosHorariosUpdated = async () => {
      // Recargar alumnos para actualizar contadores
      // Agregar un pequeño delay para asegurar que los cambios en BD se reflejen
      setTimeout(async () => {
        await fetchAlumnosHorarios();
      }, 300);
    };

    window.addEventListener('turnosCancelados:updated', handleTurnosCanceladosUpdated);
    window.addEventListener('turnosVariables:updated', handleTurnosVariablesUpdated);
    window.addEventListener('clasesDelMes:updated', handleClasesDelMesUpdated);
    window.addEventListener('capacidad:updated', handleCapacidadUpdated);
    window.addEventListener('alumnosHorarios:updated', handleAlumnosHorariosUpdated);

    return () => {
      window.removeEventListener('turnosCancelados:updated', handleTurnosCanceladosUpdated);
      window.removeEventListener('turnosVariables:updated', handleTurnosVariablesUpdated);
      window.removeEventListener('clasesDelMes:updated', handleClasesDelMesUpdated);
      window.removeEventListener('capacidad:updated', handleCapacidadUpdated);
      window.removeEventListener('alumnosHorarios:updated', handleAlumnosHorariosUpdated);
    };
  }, []);

  // Cargar slots configurados por admin desde horarios_semanales
  const fetchAdminSlots = async () => {
    try {
      const diaSemana = currentDate.getDay() === 0 ? 7 : currentDate.getDay();
      const { data, error } = await supabase
        .from('horarios_semanales')
        .select('hora_inicio, hora_fin, capacidad, dia_semana, activo')
        .eq('dia_semana', diaSemana)
        .eq('activo', true)
        .order('hora_inicio', { ascending: true });
      if (error) {
        console.error('❌ Error cargando slots admin:', error);
        return;
      }
      const slots = (data || []).map((h: any) => ({
        horaInicio: (h.hora_inicio || '').substring(0, 5),
        horaFin: (h.hora_fin || '').substring(0, 5),
        capacidad: Number(h.capacidad) || 0,
      }));
      setAdminSlots(slots);
    } catch (e) {
      console.error('❌ Error inesperado cargando slots admin:', e);
    }
  };

  const fetchTurnos = async () => {
    try {
      setLoading(true);

      // Calcular fechas de inicio y fin según la vista
      const { startDate, endDate } = getDateRange();

      // 1. Cargar turnos normales (usando turnos_variables que es la tabla actual)
      const { data: turnosNormales, error: errorNormales } = await supabase
        .from('turnos_variables')
        .select(`
          *,
          cliente:profiles!cliente_id(full_name)
        `)
        .eq('estado', 'confirmada')
        .gte('turno_fecha', formatLocalDate(startDate))
        .lte('turno_fecha', formatLocalDate(endDate))
        .order('turno_fecha', { ascending: true })
        .order('turno_hora_inicio', { ascending: true });

      if (errorNormales) {
        console.error('Error obteniendo turnos normales:', errorNormales);
      }

      // 2. Cargar turnos variables
      const { data: turnosVariables, error: errorVariables } = await supabase
        .from('turnos_variables')
        .select(`
          *,
          profiles!cliente_id(full_name)
        `)
        .eq('estado', 'confirmada')
        .gte('turno_fecha', formatLocalDate(startDate))
        .lte('turno_fecha', formatLocalDate(endDate))
        .order('turno_fecha', { ascending: true })
        .order('turno_hora_inicio', { ascending: true });

      if (errorVariables) {
        console.error('Error obteniendo turnos variables:', errorVariables);
      }

      // 3. Transformar turnos normales
      const turnosNormalesFormateados = (turnosNormales || []).map(turno => ({
        id: turno.id,
        fecha: turno.turno_fecha,
        hora_inicio: turno.turno_hora_inicio,
        hora_fin: turno.turno_hora_fin,
        estado: turno.estado,
        cliente_id: turno.cliente_id,
        cliente_nombre: turno.cliente?.full_name || 'Sin asignar',
        profesional_id: null, // turnos_variables no tiene profesional_id
        profesional_nombre: 'Sin asignar',
        servicio: 'Entrenamiento Personal',
        tipo: 'normal'
      }));

      // 4. Transformar turnos variables
      const turnosVariablesFormateados = (turnosVariables || []).map(turno => ({
        id: `variable_${turno.id}`, // Prefijo para evitar conflictos de ID
        fecha: turno.turno_fecha,
        hora_inicio: turno.turno_hora_inicio,
        hora_fin: turno.turno_hora_fin,
        estado: 'ocupado', // Los turnos variables siempre están ocupados
        cliente_id: turno.cliente_id,
        cliente_nombre: turno.profiles?.full_name || 'Sin asignar',
        profesional_id: null,
        profesional_nombre: 'Sin asignar',
        servicio: 'Entrenamiento Variable',
        tipo: 'variable'
      }));

      // 5. Combinar ambos tipos de turnos
      const todosLosTurnos = [...turnosNormalesFormateados, ...turnosVariablesFormateados];

      setTurnos(todosLosTurnos);
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
      const fechaActual = formatLocalDate(currentDate);
      // Convertir día de la semana: JS (0=domingo) -> DB (1=lunes)
      const diaSemana = currentDate.getDay() === 0 ? 7 : currentDate.getDay();

      const { data: horariosRecurrentes, error: errorRecurrentes } = await supabase
        .from('horarios_recurrentes_usuario')
        .select(`
          id,
          dia_semana,
          hora_inicio,
          hora_fin,
          activo,
          usuario_id,
          profiles(full_name, first_name, last_name, email, phone, role)
        `)
        .eq('dia_semana', diaSemana)
        .eq('activo', true);

      if (errorRecurrentes) {
        console.error('❌ Error cargando horarios recurrentes:', errorRecurrentes);
      } else {
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
          profiles(full_name, first_name, last_name, email, phone, role)
        `)
        .eq('turno_fecha', fechaActual)
        .eq('estado', 'confirmada');

      if (errorVariables) {
        console.error('❌ Error cargando turnos variables:', errorVariables);
      } else {
      }

      // Cargar turnos cancelados
      const { data: turnosCancelados, error: errorCancelados } = await supabase
        .from('turnos_cancelados')
        .select(`
          id,
          turno_fecha,
          turno_hora_inicio,
          turno_hora_fin,
          cliente_id,
          profiles(full_name, first_name, last_name, email, phone, role)
        `)
        .eq('turno_fecha', fechaActual);

      if (errorCancelados) {
        console.error('❌ Error cargando turnos cancelados:', errorCancelados);
      } else {
      }

      // Helper para nombre completo
      const getProfileFullName = (profile: any) => {
        if (!profile) return 'Sin nombre';
        const composed = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
        return (profile.full_name || composed || 'Sin nombre').trim();
      };

      // Combinar todos los datos
      const todosAlumnos: AlumnoHorario[] = [];

      // Helper para normalizar formato de hora (HH:mm:ss -> HH:mm)
      const normalizeHora = (hora: string) => {
        if (!hora) return '';
        // Si tiene formato HH:mm:ss, tomar solo HH:mm
        return hora.substring(0, 5);
      };

      // Crear un Set de turnos cancelados para esta fecha específica
      const turnosCanceladosHoy = new Set<string>();
      if (turnosCancelados && turnosCancelados.length > 0) {
        turnosCancelados.forEach(turno => {
          const profile = Array.isArray(turno.profiles) ? turno.profiles[0] : turno.profiles;
          // Filtrar admins: solo agregar si el perfil existe y NO es admin
          if (profile && profile.role !== 'admin') {
            // Crear clave única normalizada: usuario_id + hora_inicio (normalizada) + hora_fin (normalizada)
            const horaInicioNorm = normalizeHora(turno.turno_hora_inicio || '');
            const horaFinNorm = normalizeHora(turno.turno_hora_fin || '');
            const claveCancelado = `${turno.cliente_id}-${horaInicioNorm}-${horaFinNorm}`;
            turnosCanceladosHoy.add(claveCancelado);

            todosAlumnos.push({
              id: turno.id,
              nombre: getProfileFullName(profile),
              email: profile.email || '',
              telefono: profile.phone || '',
              tipo: 'cancelado',
              hora_inicio: horaInicioNorm,
              hora_fin: horaFinNorm,
              fecha: turno.turno_fecha,
              usuario_id: turno.cliente_id
            });
          }
        });
      }

      // Agregar horarios recurrentes (excluyendo admins y los que están cancelados)
      // NO agregar los que están cancelados porque ya se agregaron desde turnos_cancelados
      if (horariosRecurrentes && horariosRecurrentes.length > 0) {
        horariosRecurrentes.forEach(horario => {
          const profile = Array.isArray(horario.profiles) ? horario.profiles[0] : horario.profiles;
          // Filtrar admins: solo agregar si el perfil existe y NO es admin
          if (profile && profile.role !== 'admin') {
            // Crear clave única normalizada para verificar si está cancelado
            const horaInicioNorm = normalizeHora(horario.hora_inicio || '');
            const horaFinNorm = normalizeHora(horario.hora_fin || '');
            const claveRecurrente = `${horario.usuario_id}-${horaInicioNorm}-${horaFinNorm}`;

            // Solo agregar si NO está cancelado (los cancelados ya están en la lista desde turnos_cancelados)
            if (!turnosCanceladosHoy.has(claveRecurrente)) {
              todosAlumnos.push({
                id: horario.id,
                nombre: getProfileFullName(profile),
                email: profile.email || '',
                telefono: profile.phone,
                tipo: 'recurrente',
                hora_inicio: horaInicioNorm,
                hora_fin: horaFinNorm,
                fecha: fechaActual,
                activo: horario.activo,
                usuario_id: horario.usuario_id
              });
            }
            // NO agregar los cancelados aquí porque ya están en turnos_cancelados
          }
        });
      }

      // Agregar turnos variables (excluyendo admins y duplicados)
      // NO agregar los que están cancelados porque ya se agregaron desde turnos_cancelados
      if (turnosVariables && turnosVariables.length > 0) {
        turnosVariables.forEach(turno => {
          const profile = Array.isArray(turno.profiles) ? turno.profiles[0] : turno.profiles;
          // Filtrar admins: solo agregar si el perfil existe y NO es admin
          if (profile && profile.role !== 'admin') {
            const horaInicio = normalizeHora(turno.turno_hora_inicio || '');
            const horaFin = normalizeHora(turno.turno_hora_fin || '');

            // Verificar si este turno variable está cancelado usando clave normalizada
            const claveVariable = `${turno.cliente_id}-${horaInicio}-${horaFin}`;
            const estaCancelado = turnosCanceladosHoy.has(claveVariable);

            // Verificar si ya existe este usuario para esta hora (evitar duplicados)
            const yaExiste = todosAlumnos.some(alumno =>
              alumno.usuario_id === turno.cliente_id &&
              alumno.hora_inicio === horaInicio
            );

            // Solo agregar si NO está cancelado (los cancelados ya están en la lista desde turnos_cancelados)
            if (!yaExiste && !estaCancelado) {
              todosAlumnos.push({
                id: turno.id,
                nombre: getProfileFullName(profile),
                email: profile.email || '',
                telefono: profile.phone,
                tipo: 'variable',
                hora_inicio: horaInicio,
                hora_fin: horaFin,
                fecha: turno.turno_fecha,
                usuario_id: turno.cliente_id
              });
            }
          }
        });
      }
      if (todosAlumnos.length === 0) {
        todosAlumnos.push({
          id: 'no-data',
          nombre: 'Sin clases registradas',
          email: '',
          telefono: '',
          tipo: 'recurrente',
          hora_inicio: '00:00',
          hora_fin: '00:00',
          fecha: fechaActual,
          activo: false
        });
      }

      setAlumnosHorarios(todosAlumnos);
    } catch (error) {
      console.error('❌ Error inesperado cargando horarios de alumnos:', error);
      showError('Error', 'No se pudieron cargar los horarios de los alumnos');
    } finally {
      setLoadingAlumnos(false);
    }
  };

  // Función para abrir modal de gestión de turno
  const handleAlumnoClick = (alumno: AlumnoHorario) => {
    if (!isAdminView) return;

    // Usar siempre la fecha del día seleccionado en el calendario
    const fechaTurno = formatLocalDate(currentDate);
    console.log('📍 Modal fecha:', fechaTurno, 'alumno.fecha:', alumno.fecha, 'currentDate:', currentDate);

    // Crear un objeto Turno para el AdminTurnoModal
    const turnoParaModal: Turno = {
      id: alumno.tipo === 'variable' ? `variable_${alumno.id}` : alumno.id,
      fecha: fechaTurno,
      hora_inicio: alumno.hora_inicio || '',
      hora_fin: alumno.hora_fin || '',
      estado: alumno.tipo === 'cancelado' ? 'cancelado' : 'ocupado',
      cliente_id: alumno.usuario_id,
      cliente_nombre: alumno.nombre,
      profesional_id: null,
      profesional_nombre: 'Sin asignar',
      servicio: alumno.tipo === 'variable' ? 'Entrenamiento Variable' : 'Entrenamiento Recurrente'
    };

    setAdminSelectedTurno(turnoParaModal);
    setShowAdminModal(true);
  };

  // Función para cancelar clase de alumno (solo admin)
  const cancelarClaseAlumno = async () => {
    if (!selectedAlumno || !selectedAlumno.usuario_id) {
      showError('Error', 'No se pudo identificar al alumno');
      return;
    }

    // Verificar si la clase es futura
    if (!esClaseFutura(selectedAlumno.fecha || formatLocalDate(currentDate), selectedAlumno.hora_inicio)) {
      showError('Error', 'Solo se pueden cancelar clases futuras');
      return;
    }

    try {
      setCancelingAlumno(true);
      const loadingToast = showLoading('Cancelando clase...');

      // Verificar si ya existe una cancelación para este turno
      const { data: cancelacionExistente } = await supabase
        .from('turnos_cancelados')
        .select('id')
        .eq('cliente_id', selectedAlumno.usuario_id)
        .eq('turno_fecha', selectedAlumno.fecha || formatLocalDate(currentDate))
        .eq('turno_hora_inicio', selectedAlumno.hora_inicio)
        .eq('turno_hora_fin', selectedAlumno.hora_fin);

      if (cancelacionExistente && cancelacionExistente.length > 0) {
        dismissToast(loadingToast);
        showError('Error', 'Esta clase ya ha sido cancelada');
        return;
      }

      // Crear registro de cancelación
      const { error } = await supabase
        .from('turnos_cancelados')
        .insert({
          cliente_id: selectedAlumno.usuario_id,
          turno_fecha: selectedAlumno.fecha || formatLocalDate(currentDate),
          turno_hora_inicio: selectedAlumno.hora_inicio,
          turno_hora_fin: selectedAlumno.hora_fin,
          tipo_cancelacion: 'admin',
          motivo_cancelacion: 'Cancelada por administrador'
        });

      dismissToast(loadingToast);

      if (error) {
        console.error('Error al cancelar clase:', error);
        showError('Error', `No se pudo cancelar la clase: ${error.message}`);
        return;
      }

      showSuccess('Clase cancelada', `La clase de ${selectedAlumno.nombre} ha sido cancelada exitosamente`);

      // Recargar horarios de alumnos
      await fetchAlumnosHorarios();

      setShowCancelAlumnoModal(false);
      setSelectedAlumno(null);
    } catch (error) {
      console.error('Error inesperado al cancelar clase:', error);
      showError('Error', 'No se pudo cancelar la clase');
    } finally {
      setCancelingAlumno(false);
    }
  };

  // Función para verificar si una clase es futura
  const esClaseFutura = (fecha: string, horaInicio: string) => {
    try {
      // Asegurar que la hora tenga formato completo HH:MM:SS
      const horaCompleta = horaInicio.includes(':') && horaInicio.split(':').length === 2
        ? horaInicio + ':00'
        : horaInicio;

      // Crear fecha de la clase con timezone local
      const fechaClase = new Date(fecha + 'T' + horaCompleta);
      const ahora = new Date();


      return fechaClase > ahora;
    } catch (error) {
      console.error('Error validando fecha:', error);
      return false;
    }
  };

  // Función para manejar el clic en el botón +
  const handleAddUserToSlot = async (slot: any) => {
    try {
      // Verificar si la clase es futura
      if (!esClaseFutura(formatLocalDate(currentDate), slot.horaInicio)) {
        showError('Error', 'Solo se pueden agregar usuarios a clases futuras');
        return;
      }

      setSelectedSlot(slot);
      setSearchTerm('');

      // Cargar usuarios disponibles
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, email, role')
        .eq('role', 'client')
        .eq('is_active', true)
        .order('full_name');

      if (error) {
        console.error('Error cargando usuarios:', error);
        showError('Error', 'No se pudieron cargar los usuarios');
        return;
      }

      // Filtrar usuarios que ya están en este slot
      const usuariosEnSlot = slot.alumnos.map((alumno: any) => alumno.usuario_id);
      const usuariosDisponibles = users?.filter(user => !usuariosEnSlot.includes(user.id)) || [];

      setAvailableUsers(usuariosDisponibles);
      setShowAddUserModal(true);
    } catch (error) {
      console.error('Error inesperado:', error);
      showError('Error', 'No se pudo abrir el modal de usuarios');
    }
  };

  // Función para manejar la selección de usuario
  const handleUserSelection = (user: any) => {
    setSelectedUser(user);
    setShowConfirmModal(true);
  };

  // Función para confirmar y agregar usuario al slot
  const confirmAddUserToSlot = async () => {
    if (!selectedUser || !selectedSlot) return;

    try {
      // Validar capacidad máxima antes de agregar usuario
      const capacidadMaxima = obtenerCapacidadActual() || 4;
      const fechaTurno = formatLocalDate(currentDate);
      
      // Contar cuántos usuarios ya tienen reserva para este horario
      const { data: reservasHorario, error: errorReservasHorario } = await supabase
        .from('turnos_variables')
        .select('id')
        .eq('turno_fecha', fechaTurno)
        .eq('turno_hora_inicio', selectedSlot.horaInicio + ':00')
        .eq('turno_hora_fin', selectedSlot.horaFin + ':00')
        .eq('estado', 'confirmada');

      if (errorReservasHorario) {
        console.error('Error verificando capacidad del horario:', errorReservasHorario);
        showError('Error al verificar capacidad', errorReservasHorario.message);
        return;
      }

      const usuariosEnHorario = reservasHorario?.length || 0;
      
      if (usuariosEnHorario >= capacidadMaxima) {
        showError('Cupo completo', `Este horario ya tiene ${capacidadMaxima} usuarios registrados. No hay más cupos disponibles.`);
        return;
      }

      setAddingUser(true);
      const loadingToast = showLoading('Agregando usuario...');

      // Crear turno variable para el usuario
      const { error } = await supabase
        .from('turnos_variables')
        .insert({
          cliente_id: selectedUser.id,
          turno_fecha: formatLocalDate(currentDate),
          turno_hora_inicio: selectedSlot.horaInicio + ':00',
          turno_hora_fin: selectedSlot.horaFin + ':00',
          estado: 'confirmada'
        });

      dismissToast(loadingToast);

      if (error) {
        console.error('Error agregando usuario:', error);
        showError('Error', `No se pudo agregar el usuario: ${error.message}`);
        return;
      }

      showSuccess('Usuario agregado', `${selectedUser.full_name} ha sido agregado a la clase exitosamente`);

      // Recargar horarios de alumnos
      await fetchAlumnosHorarios();

      setShowAddUserModal(false);
      setShowConfirmModal(false);
      setSelectedSlot(null);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error inesperado:', error);
      showError('Error', 'No se pudo agregar el usuario');
    } finally {
      setAddingUser(false);
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
        `Has reservado entrenamiento para el ${new Date(turno.fecha + 'T00:00:00').toLocaleDateString('es-ES')} a las ${turno.hora_inicio}`);

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
    const capacidadMaxima = obtenerCapacidadActual() || 4;

    // Buscar turnos ocupados para este horario
    const turnosOcupados = dayTurnos.filter(turno =>
      turno.hora_inicio === horaInicio &&
      turno.estado === 'ocupado'
    );

    // Si hay menos usuarios que la capacidad máxima, el horario está disponible
    if (turnosOcupados.length < capacidadMaxima) {
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
    const dateStr = formatLocalDate(date);
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
      <div className="absolute inset-0 bg-accent-foreground/15 rounded-lg pointer-events-none" />
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

    return (
      <div className="grid grid-cols-7 gap-1 w-full max-w-full">
        {days.map(({ date, isCurrentMonth }, index) => {
          const dayTurnos = getTurnosForDate(date);
          const isToday = date.toDateString() === today.toDateString();
          const isSelected = date.toDateString() === currentDate.toDateString();
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          // Si no es del mes actual, mostrar celda vacía
          if (!isCurrentMonth) {
            return (
              <div
                key={index}
                className="relative min-h-[48px] p-2 border border-transparent rounded-lg min-w-0 bg-transparent"
              />
            );
          }

          return (
            <div
              key={index}
              className={`relative min-h-[48px] p-2 border border-border/50 rounded-lg transition-all duration-200 text-center cursor-pointer min-w-0 bg-muted/40 hover:bg-muted/60 ${isWeekend ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/70'
                }`}
              onClick={() => !isWeekend && handleDateSelect(date)}
            >
              <SelectedDayMarker isSelected={isSelected} />
              <div className="font-light relative z-10 truncate text-foreground" style={{ fontSize: '10px' }}>
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

    // Generar horarios dinámicos definidos por admin (horarios_semanales)
    const timeSlots = adminSlots.map(slot => {
      // Filtrar alumnos por horario (incluidos cancelados para mostrar con stroke rojo)
      const alumnosEnHorario = alumnosHorarios
        .filter(alumno =>
          (alumno.hora_inicio || '').substring(0, 5) === slot.horaInicio
        )
        .reduce((acc, alumno) => {
          // Evitar duplicados por usuario_id
          const existe = acc.find(a => a.usuario_id === alumno.usuario_id);
          if (!existe) {
            acc.push(alumno);
          }
          return acc;
        }, [] as AlumnoHorario[]);

      // Contar solo alumnos activos para el cupo disponible
      const alumnosActivos = alumnosEnHorario.filter(a => a.tipo !== 'cancelado');
      
      // Usar capacidad global de configuracion_admin en lugar de capacidad individual del horario
      const capacidadGlobal = obtenerCapacidadActual() || 4;
      
      // Detectar si hay exceso de usuarios (más que la capacidad máxima)
      const tieneExceso = alumnosActivos.length > capacidadGlobal;
      const exceso = tieneExceso ? alumnosActivos.length - capacidadGlobal : 0;
      
      return {
        horaInicio: slot.horaInicio,
        horaFin: slot.horaFin,
        alumnos: alumnosEnHorario, // Incluir cancelados para mostrar con stroke rojo
        alumnosActivos: alumnosActivos, // Solo alumnos activos (azules y verdes)
        capacidad: capacidadGlobal, // Usar capacidad global
        cupoDisponible: Math.max(0, capacidadGlobal - alumnosActivos.length),
        tieneExceso, // Flag para indicar si hay exceso
        exceso, // Cantidad de usuarios que exceden el límite
      };
    });

    // Función para formatear hora de "08:00" a "8am" o "15:00" a "3pm"
    const formatearHora = (hora: string): string => {
      const [horaStr] = hora.split(':');
      const horaNum = parseInt(horaStr);
      if (horaNum === 0) return '12am';
      if (horaNum < 12) return `${horaNum}am`;
      if (horaNum === 12) return '12pm';
      return `${horaNum - 12}pm`;
    };

    // Si es vista de admin, mostrar información de alumnos
    if (isAdminView) {
      if (loadingAlumnos) {
        return (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Cargando clases registradas...</p>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-3">
          {timeSlots.map((slot, index) => {
            const horarioKey = `slot-${slot.horaInicio}`;
            const isExpanded = horariosExpandidos.has(horarioKey);

            return (
              <Card key={`slot-${index}`} className="">
                <CardContent className="p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
                    onClick={() => toggleHorario(horarioKey)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-light text-foreground text-[12px] sm:text-base">
                        {formatearHora(slot.horaInicio)} - {formatearHora(slot.horaFin)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className={`font-light text-[10px] ${
                          slot.tieneExceso 
                            ? 'bg-red-100 text-red-800 border-red-300' 
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        <span className="hidden sm:inline">
                          {slot.alumnosActivos.length}/{slot.capacidad || 0} alumnos
                          {slot.tieneExceso && ` (+${slot.exceso} exceso)`}
                        </span>
                        <span className="sm:hidden">
                          {slot.alumnosActivos.length}/{slot.capacidad || 0}
                          {slot.tieneExceso && ` (+${slot.exceso})`}
                        </span>
                      </Badge>
                      {/* Botón + para agregar usuario - visible en desktop, deshabilitado para clases pasadas */}
                      {isAdminView && slot.cupoDisponible > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="hidden sm:flex h-6 w-6 p-0 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-700 border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!esClaseFutura(formatLocalDate(currentDate), slot.horaInicio)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddUserToSlot(slot);
                          }}
                        >
                          +
                        </Button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4">
                      {/* Advertencia de exceso */}
                      {slot.tieneExceso && (
                        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-2 text-red-800 text-xs font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            <span>⚠️ Exceso de capacidad: {slot.exceso} usuario(s) por encima del límite ({slot.capacidad})</span>
                          </div>
                          <p className="text-red-600 text-[10px] mt-1">
                            Este horario tiene {slot.alumnosActivos.length} usuarios activos registrados, pero el límite es {slot.capacidad}. 
                            Considera cancelar los turnos más recientes para respetar el límite.
                          </p>
                        </div>
                      )}
                      {slot.alumnos.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {slot.alumnos.map((alumno, alumnoIndex) => {
                            // Separar nombre y apellido
                            const nombreCompleto = alumno.nombre || '';
                            const partesNombre = nombreCompleto.split(' ');
                            const nombre = partesNombre[0] || '';
                            const apellido = partesNombre.slice(1).join(' ') || '';

                            // Verificar si este horario está bloqueado por ausencia del admin
                            const estaBloqueado = estaHorarioBloqueado(formatLocalDate(currentDate), slot.horaInicio);

                            // Verificar si la clase es futura para permitir cancelación
                            const esClaseFuturaParaAlumno = esClaseFutura(formatLocalDate(currentDate), slot.horaInicio);

                            return (
                              <div
                                key={alumnoIndex}
                                onClick={() => !estaBloqueado && isAdminView && handleAlumnoClick(alumno)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${estaBloqueado
                                    ? 'border-yellow-400 bg-yellow-900/30 opacity-60 text-yellow-200'
                                    : alumno.tipo === 'cancelado' ? 'border-red-500 text-red-700 bg-red-50' :
                                      alumno.tipo === 'recurrente' ? 'border-green-500 text-green-700 bg-green-50' :
                                        'border-blue-500 text-blue-700 bg-blue-50'
                                  } ${!estaBloqueado && isAdminView ? 'cursor-pointer hover:shadow-md hover:scale-105' : 'cursor-not-allowed'}`}
                              >
                                <div className="font-light text-[10px] sm:text-[12px]">
                                  {nombre} {apellido}
                                  {estaBloqueado && <span className="ml-2 text-[8px] text-yellow-400">(BLOQUEADA)</span>}
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

                      {/* Botón + para agregar usuario - visible en mobile dentro del dropdown, deshabilitado para clases pasadas */}
                      {isAdminView && slot.cupoDisponible > 0 && (
                        <div className="mt-3 flex justify-center sm:hidden">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-700 border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!esClaseFutura(formatLocalDate(currentDate), slot.horaInicio)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddUserToSlot(slot);
                            }}
                          >
                            +
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Mensaje cuando no hay horarios */}
          {timeSlots.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No hay horarios configurados para este día
              </h3>
              <p className="text-sm text-muted-foreground">
                Configura los horarios desde el panel de administración para este día.
              </p>
            </div>
          )}
        </div>
      );
    }

    // Vista normal para clientes (código existente)
    // Separar slots en AM y PM con propiedades completas
    const capacidadGlobal = obtenerCapacidadActual() || 4;
    
    const amSlots = adminSlots
      .filter(slot => {
        const hora = parseInt(slot.horaInicio.split(':')[0]);
        return hora < 12;
      })
      .map(slot => ({
        ...slot,
        estado: 'disponible' as const,
        turnosDisponibles: capacidadGlobal // Usar capacidad global
      }));

    const pmSlots = adminSlots
      .filter(slot => {
        const hora = parseInt(slot.horaInicio.split(':')[0]);
        return hora >= 12;
      })
      .map(slot => ({
        ...slot,
        estado: 'disponible' as const,
        turnosDisponibles: capacidadGlobal // Usar capacidad global
      }));

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
                  className={`h-12 sm:h-14 justify-center px-2 sm:px-4 transition-all duration-200 ${slot.estado === 'disponible'
                      ? 'hover:shadow-md hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'hover:bg-muted/50 border-muted-foreground/30 text-muted-foreground'
                    }`}
                  onClick={() => handleTimeSlotReservation(slot.horaInicio, slot.horaFin)}
                >
                  <div className="flex items-center">
                    <Clock className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${slot.estado === 'disponible' ? 'text-primary-foreground' : 'text-muted-foreground'
                      }`} />
                    <span className="font-medium text-[10px] sm:text-xs">{slot.horaInicio} - {slot.horaFin}</span>
                  </div>
                  {slot.estado === 'disponible' && (
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium bg-primary-foreground text-primary hover:bg-primary-foreground/90 ml-1"
                    >
                      {`${slot.turnosDisponibles}/${capacidadGlobal}`}
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
                  className={`h-12 sm:h-14 justify-center px-2 sm:px-4 transition-all duration-200 ${slot.estado === 'disponible'
                      ? 'hover:shadow-md hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'hover:bg-muted/50 border-muted-foreground/30 text-muted-foreground'
                    }`}
                  onClick={() => handleTimeSlotReservation(slot.horaInicio, slot.horaFin)}
                >
                  <div className="flex items-center">
                    <Clock className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${slot.estado === 'disponible' ? 'text-primary-foreground' : 'text-muted-foreground'
                      }`} />
                    <span className="font-medium text-[10px] sm:text-xs">{slot.horaInicio} - {slot.horaFin}</span>
                  </div>
                  {slot.estado === 'disponible' && (
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium bg-primary-foreground text-primary hover:bg-primary-foreground/90 ml-1"
                    >
                      {`${slot.turnosDisponibles}/${capacidadGlobal}`}
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

                  <h3 className="text-lg font-bold text-muted-foreground truncate px-2">
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
                  <div key={day} className="p-2 text-center font-light text-foreground bg-muted/30 rounded-md min-w-0" style={{ fontSize: '10px' }}>
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
        <AdminTurnoInfoModal
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

      {/* Modal de cancelación de clase de alumno (Admin) */}
      <Dialog open={showCancelAlumnoModal} onOpenChange={setShowCancelAlumnoModal}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[425px] p-3 sm:p-6 mx-1 sm:mx-auto max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[12px]">
              <Trash2 className="h-4 w-4 text-red-500" />
              Cancelar Clase de Alumno
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              ¿Desea cancelar la clase de este alumno?
            </DialogDescription>
          </DialogHeader>

          {selectedAlumno && (
            <div className="space-y-4 py-3">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-[12px] font-medium">Alumno</p>
                    <p className="text-[12px] text-muted-foreground">{selectedAlumno.nombre}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-[12px] font-medium">Horario</p>
                    <p className="text-[12px] text-muted-foreground">
                      {selectedAlumno.hora_inicio} - {selectedAlumno.hora_fin}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-[12px] font-medium">Tipo</p>
                    <Badge variant="outline" className={`text-[12px] ${selectedAlumno.tipo === 'recurrente' ? 'text-green-600 border-green-300' :
                        selectedAlumno.tipo === 'variable' ? 'text-blue-600 border-blue-300' :
                          'text-red-600 border-red-300'
                      }`}>
                      {selectedAlumno.tipo === 'recurrente' ? 'Clase Recurrente' :
                        selectedAlumno.tipo === 'variable' ? 'Clase Variable' : 'Cancelada'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-[12px] text-yellow-800 dark:text-yellow-200">
                  <strong>Importante:</strong> Esta acción cancelará la clase para esta fecha específica.
                  El alumno verá esta clase como cancelada en su panel.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelAlumnoModal(false);
                setSelectedAlumno(null);
              }}
              disabled={cancelingAlumno}
              className="text-[12px]"
            >
              No, mantener clase
            </Button>
            <Button
              variant="destructive"
              onClick={cancelarClaseAlumno}
              disabled={cancelingAlumno}
              className="text-[12px]"
            >
              {cancelingAlumno ? 'Cancelando...' : 'Sí, cancelar clase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para agregar usuario a slot */}
      <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
        <DialogContent className="w-[95vw] max-w-none sm:max-w-lg h-[85vh] sm:h-auto max-h-[85vh] sm:max-h-[80vh] sm:flex sm:flex-col">
          <DialogHeader className="pb-3 flex-shrink-0">
            <DialogTitle className="text-sm sm:text-base">Agregar Usuario a Clase</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Selecciona un usuario para agregar a la clase de {selectedSlot?.horaInicio} - {selectedSlot?.horaFin}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            {/* Barra de búsqueda */}
            <Input
              placeholder="Buscar usuario por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs sm:text-sm flex-shrink-0"
            />

            {/* Lista de usuarios */}
            <div className="flex-1 min-h-0 overflow-y-auto sm:max-h-[45vh] pr-2">
              <div className="space-y-2">
                {availableUsers
                  .filter(user =>
                    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center p-3 sm:p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => handleUserSelection(user)}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-xs sm:text-sm">{user.full_name}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {availableUsers.length === 0 && (
              <p className="text-center text-muted-foreground py-4 text-xs sm:text-sm flex-shrink-0">
                No hay usuarios disponibles para esta clase
              </p>
            )}
          </div>

          <DialogFooter className="pt-3 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowAddUserModal(false)}
              disabled={addingUser}
              className="text-xs sm:text-sm w-full sm:w-auto"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para agregar usuario */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="w-[95vw] max-w-none sm:max-w-md h-[85vh] sm:h-auto max-h-[85vh] sm:max-h-[70vh] sm:flex sm:flex-col">
          <DialogHeader className="pb-2 sm:pb-3 flex-shrink-0">
            <DialogTitle className="text-sm sm:text-base">Confirmar agregar usuario</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              ¿Estás seguro de que quieres agregar a <strong>{selectedUser?.full_name}</strong> a la clase de {selectedSlot?.horaInicio} - {selectedSlot?.horaFin}?
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0">
            {/* Contenido de confirmación */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  El usuario será agregado a la clase y aparecerá en la agenda
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 sm:pt-3 flex-shrink-0">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                disabled={addingUser}
                className="text-xs sm:text-sm w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmAddUserToSlot}
                disabled={addingUser}
                className="text-xs sm:text-sm w-full sm:w-auto bg-white text-gray-900 hover:bg-gray-100"
              >
                {addingUser ? 'Agregando...' : 'Confirmar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

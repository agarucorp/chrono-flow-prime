import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, X, Dumbbell, Zap, User as UserIcon, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay, getDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAdmin } from '@/hooks/useAdmin';
import { ProfileSettingsDialog } from './ProfileSettingsDialog';

interface HorarioRecurrente {
  id: string;
  dia_semana: number;
  clase_numero?: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
  cancelada?: boolean;
  nombre_clase?: string;
}

interface ClaseDelDia {
  id: string;
  dia: Date;
  horario: HorarioRecurrente;
}

export const RecurringScheduleView = () => {
  const { user } = useAuthContext();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const [profileData, setProfileData] = useState<any>(null);
  const [horariosRecurrentes, setHorariosRecurrentes] = useState<HorarioRecurrente[]>(() => {
    // Recuperar horarios del localStorage
    const saved = localStorage.getItem('horariosRecurrentes');
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(() => {
    // Solo mostrar loading si no hay datos guardados
    const saved = localStorage.getItem('horariosRecurrentes');
    return !saved;
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedClase, setSelectedClase] = useState<ClaseDelDia | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showTurnosCancelados, setShowTurnosCancelados] = useState(false);
  const [turnosCancelados, setTurnosCancelados] = useState<any[]>(() => {
    // Recuperar turnos cancelados del localStorage
    const saved = localStorage.getItem('turnosCancelados');
    return saved ? JSON.parse(saved) : [];
  });
  const [loadingTurnosCancelados, setLoadingTurnosCancelados] = useState(false);
  
  // Estados para modal de reserva
  const [showReservaModal, setShowReservaModal] = useState(false);
  const [turnoToReserve, setTurnoToReserve] = useState<any>(null);
  const [confirmingReserva, setConfirmingReserva] = useState(false);
  const [turnosReservados, setTurnosReservados] = useState<any[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeView, setActiveView] = useState<'mis-clases' | 'turnos-disponibles' | 'perfil'>('mis-clases');
  const [clasesDelMes, setClasesDelMes] = useState<any[]>(() => {
    // Recuperar clases del mes del localStorage
    const saved = localStorage.getItem('clasesDelMes');
    return saved ? JSON.parse(saved) : [];
  });
  const [lastLoadTime, setLastLoadTime] = useState<number>(() => {
    // Recuperar timestamp de última carga
    const saved = localStorage.getItem('lastLoadTime');
    return saved ? parseInt(saved) : 0;
  });
  const [loadingMonth, setLoadingMonth] = useState(false);

  // Estado para modal de edición de perfil
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  // Función para formatear horas sin segundos
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5); // Toma solo HH:mm
  };

  const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const getDisplayPhone = () => {
    const phoneValue = (profileData?.phone ?? user?.user_metadata?.phone ?? '') as string;
    const trimmed = (phoneValue || '').toString().trim();
    return trimmed.length > 0 ? trimmed : 'No configurado';
  };

  // Función para cambiar la vista activa
  const handleViewChange = (view: 'mis-clases' | 'turnos-disponibles' | 'perfil') => {
    setActiveView(view);
  };

  // Cargar turnos cancelados al inicio y cuando se cambie a la vista de turnos disponibles
  useEffect(() => {
    if (user?.id) {
      cargarTurnosCancelados();
    }
  }, [user?.id]);

  // Escuchar confirmación de cerrar sesión disparada desde el menú desktop
  useEffect(() => {
    const handleSignoutConfirm = () => setShowLogoutConfirm(true);
    window.addEventListener('auth:signout-confirm', handleSignoutConfirm);
    return () => window.removeEventListener('auth:signout-confirm', handleSignoutConfirm);
  }, []);

  // Días de la semana (0 = Domingo, 1 = Lunes, etc.)
  const diasSemana = useMemo(() => [
    { numero: 0, nombre: 'Domingo', nombreCorto: 'Dom' },
    { numero: 1, nombre: 'Lunes', nombreCorto: 'Lun' },
    { numero: 2, nombre: 'Martes', nombreCorto: 'Mar' },
    { numero: 3, nombre: 'Miércoles', nombreCorto: 'Mié' },
    { numero: 4, nombre: 'Jueves', nombreCorto: 'Jue' },
    { numero: 5, nombre: 'Viernes', nombreCorto: 'Vie' },
    { numero: 6, nombre: 'Sábado', nombreCorto: 'Sáb' }
  ], []);

  // Cargar horarios recurrentes del usuario
  const cargarHorariosRecurrentes = async (forceReload = false) => {
    if (!user?.id) return;

    // Verificar si necesitamos recargar (cada 5 minutos o si es forzado)
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    const shouldReload = forceReload || (now - lastLoadTime) > fiveMinutes;

    if (!shouldReload && horariosRecurrentes.length > 0) {
      setLoading(false); // Asegurar que loading se resetee
      return; // Usar datos del caché
    }

    setLoading(true);
    try {
      // Usar vista que combina horarios de usuarios con horas actualizadas
      const { data, error } = await supabase
        .from('vista_horarios_usuarios')
        .select('id, dia_semana, clase_numero, hora_inicio, hora_fin, activo, usuario_id')
        .eq('usuario_id', user.id)
        .order('dia_semana', { ascending: true })
        .order('clase_numero', { ascending: true });

      if (error) {
        console.error('Error al cargar horarios recurrentes:', error);
        return;
      }

      setHorariosRecurrentes(data || []);
      setLastLoadTime(now);
      
      // Guardar en localStorage
      localStorage.setItem('horariosRecurrentes', JSON.stringify(data || []));
      localStorage.setItem('lastLoadTime', now.toString());
    } catch (error) {
      console.error('Error al cargar horarios recurrentes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar turnos cancelados disponibles
  const cargarTurnosCancelados = async (forceReload = false) => {
    if (!user?.id) return;

      setLoadingTurnosCancelados(true);
    try {
      console.log('🔍 Cargando turnos cancelados disponibles...');
      // Obtener todos los turnos cancelados disponibles con el cliente que canceló
      const { data, error } = await supabase
        .from('turnos_disponibles')
        .select('*')
        .gte('turno_fecha', format(new Date(), 'yyyy-MM-dd'))
        .order('turno_fecha', { ascending: true })
        .order('turno_hora_inicio', { ascending: true });

      if (error) {
        console.error('Error al cargar turnos cancelados:', error);
        return;
      }

      // Obtener información de quién canceló cada turno en una sola consulta
      const idsCancelaciones = (data || []).map(t => t.creado_desde_cancelacion_id);
      
      let cancelaciones = [];
      if (idsCancelaciones.length > 0) {
        const { data: cancelacionesData, error: errorCancelaciones } = await supabase
          .from('turnos_cancelados')
          .select('id, cliente_id, tipo_cancelacion')
          .in('id', idsCancelaciones);
        
        if (errorCancelaciones) {
          console.error('Error al cargar cancelaciones:', errorCancelaciones);
        } else {
          cancelaciones = cancelacionesData || [];
        }
      }

      // Crear un mapa para búsqueda rápida
      const cancelacionesMap = new Map();
      cancelaciones.forEach(c => {
        cancelacionesMap.set(c.id, c);
      });

      // Combinar datos
      const turnosConCancelaciones = (data || []).map((turno) => {
        const cancelacion = cancelacionesMap.get(turno.creado_desde_cancelacion_id);
        return {
          ...turno,
          cliente_que_cancelo: cancelacion?.cliente_id,
          tipo_cancelacion: cancelacion?.tipo_cancelacion
        };
      });

      // Obtener turnos reservados por el usuario para marcar como reservados
      const { data: reservados, error: errorReservados } = await supabase
        .from('turnos_variables')
        .select('creado_desde_disponible_id')
        .eq('cliente_id', user.id)
        .eq('estado', 'confirmada');

      if (errorReservados) {
        console.error('Error al cargar turnos reservados:', errorReservados);
      }

      const idsReservados = new Set(reservados?.map(r => r.creado_desde_disponible_id) || []);

      // Marcar como reservados y verificar si el usuario actual fue quien canceló
      const turnosMarcados = turnosConCancelaciones.map((turno) => ({
        ...turno,
        reservado: idsReservados.has(turno.id),
        canceladoPorUsuario: turno.cliente_que_cancelo === user.id
      }));

      console.log('✅ Turnos cancelados cargados:', turnosMarcados.length, turnosMarcados);
      setTurnosCancelados(turnosMarcados);
    } catch (error) {
      console.error('Error al cargar turnos cancelados:', error);
    } finally {
      setLoadingTurnosCancelados(false);
    }
  };

  // Suscripción en tiempo real a turnos_disponibles (siempre activa para actualizar contador)
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel('turnos_disponibles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_disponibles' }, () => {
        cargarTurnosCancelados(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Cargar datos del perfil desde la base de datos
  const cargarDatosPerfil = async () => {
    if (!user?.id) return;
    
    try {
      // Verificar que haya sesión activa antes de hacer la consulta
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No hay sesión activa, no se puede cargar perfil');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name, phone')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error al cargar perfil:', error);
        // Usar datos del user_metadata como fallback
        setProfileData({
          full_name: user?.user_metadata?.full_name,
          first_name: user?.user_metadata?.first_name,
          last_name: user?.user_metadata?.last_name,
          phone: user?.user_metadata?.phone,
        });
        return;
      }
      
      // Obtener metadata fresca del usuario
      const { data: authUserResp } = await supabase.auth.getUser();
      const metaPhone = authUserResp?.user?.user_metadata?.phone ?? user?.user_metadata?.phone ?? null;

      if (data) {
        // Combinar datos de profiles con metadata por si falta teléfono
        setProfileData({
          ...data,
          phone: (data as any).phone ?? metaPhone,
        });
      } else {
        // Si no hay datos en la tabla, usar user_metadata
        setProfileData({
          full_name: user?.user_metadata?.full_name,
          first_name: user?.user_metadata?.first_name,
          last_name: user?.user_metadata?.last_name,
          phone: metaPhone,
        });
      }
    } catch (error) {
      console.error('Error al cargar perfil:', error);
      // Usar datos del user_metadata como fallback
      setProfileData({
        full_name: user?.user_metadata?.full_name,
        first_name: user?.user_metadata?.first_name,
        last_name: user?.user_metadata?.last_name,
        phone: user?.user_metadata?.phone,
      });
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (user?.id) {
      // Cargar datos iniciales con loading visible
      cargarHorariosRecurrentes();
      cargarDatosPerfil();
      
      // Timeout de seguridad para evitar loading infinito
      const timeoutId = setTimeout(() => {
        console.warn('Timeout de seguridad: ocultando loading después de 10 segundos');
        setLoading(false);
      }, 10000);
      
      return () => clearTimeout(timeoutId);
    } else {
      // Si no hay usuario, ocultar loading
      setLoading(false);
    }
  }, [user?.id]);

  // Forzar recarga del perfil al entrar en la vista de Perfil
  useEffect(() => {
    if (activeView === 'perfil' && user?.id) {
      cargarDatosPerfil();
    }
  }, [activeView, user?.id]);

  // Escuchar actualización desde el modal y recargar inmediatamente
  useEffect(() => {
    const handler = async () => {
      console.log('🔄 Evento horariosRecurrentes:updated recibido');
      
      // Primero cargar los horarios recurrentes
      await cargarHorariosRecurrentes(true);
      
      // Luego cargar las clases del mes con los nuevos horarios
      // Forzamos una pequeña espera para asegurar que el estado se actualizó
      setTimeout(() => {
        cargarClasesDelMes(true);
      }, 100);
    };
    window.addEventListener('horariosRecurrentes:updated', handler);
    return () => window.removeEventListener('horariosRecurrentes:updated', handler);
  }, []);

  // Cargar clases del mes (horarios recurrentes + turnos variables)
  const cargarClasesDelMes = async (forceReload = false) => {
    if (!user?.id) return;

    const monthKey = format(currentMonth, 'yyyy-MM');
    const cachedKey = `clasesDelMes_${monthKey}`;
    const lastLoadKey = `lastClasesLoadTime_${monthKey}`;
    
    // Verificar si necesitamos recargar (cada 3 minutos o si es forzado)
    const now = Date.now();
    const threeMinutes = 3 * 60 * 1000;
    const lastClasesLoadTime = parseInt(localStorage.getItem(lastLoadKey) || '0');
    const shouldReload = forceReload || (now - lastClasesLoadTime) > threeMinutes;

    if (!shouldReload) {
      const cached = localStorage.getItem(cachedKey);
      if (cached) {
        setClasesDelMes(JSON.parse(cached));
        return; // Usar datos del caché
      }
    }

    // Mostrar loading solo si vamos a cargar datos nuevos
    setLoadingMonth(true);

    try {
      const diasDelMes = eachDayOfInterval({ 
        start: startOfMonth(currentMonth), 
        end: endOfMonth(currentMonth) 
      });

      const todasLasClases = [];
      
      // Si es recarga forzada, obtener horarios recurrentes frescos de la base de datos
      let horariosActuales = horariosRecurrentes;
      if (forceReload) {
        const { data: horariosDB } = await supabase
          .from('vista_horarios_usuarios')
          .select('id, dia_semana, clase_numero, hora_inicio, hora_fin, activo, usuario_id')
          .eq('usuario_id', user.id)
          .order('dia_semana', { ascending: true })
          .order('clase_numero', { ascending: true });
        
        horariosActuales = horariosDB || [];
      }
      
      // Cargar horarios recurrentes si existen
      if (horariosActuales.length > 0) {
        for (const dia of diasDelMes) {
          const clasesDelDia = await getClasesDelDia(dia, horariosActuales);
          todasLasClases.push(...clasesDelDia);
        }
      }

      // Cargar turnos variables del mes
      const { data: turnosVariables, error } = await supabase
        .from('turnos_variables')
        .select('*')
        .eq('cliente_id', user.id)
        .eq('estado', 'confirmada')
        .gte('turno_fecha', format(startOfMonth(currentMonth), 'yyyy-MM-dd'))
        .lte('turno_fecha', format(endOfMonth(currentMonth), 'yyyy-MM-dd'));

      if (error) {
        console.error('Error al cargar turnos variables:', error);
      } else if (turnosVariables) {
        // Convertir turnos variables a formato de clase
        const clasesVariables = turnosVariables.map(turno => {
          // Crear fecha correcta sin problemas de zona horaria
          const fechaParts = turno.turno_fecha.split('-');
          const fechaCorrecta = new Date(parseInt(fechaParts[0]), parseInt(fechaParts[1]) - 1, parseInt(fechaParts[2]));
          
          return {
            id: `variable-${turno.id}`,
            dia: fechaCorrecta,
            horario: {
              id: turno.id,
              dia_semana: fechaCorrecta.getDay(),
              hora_inicio: turno.turno_hora_inicio,
              hora_fin: turno.turno_hora_fin,
              activo: true,
              cancelada: false,
              esVariable: true // Marcar como turno variable
            }
          };
        });
        todasLasClases.push(...clasesVariables);
      }

      setClasesDelMes(todasLasClases);
      
      // Guardar en localStorage
      localStorage.setItem(cachedKey, JSON.stringify(todasLasClases));
      localStorage.setItem(lastLoadKey, now.toString());
    } catch (error) {
      console.error('Error al cargar clases del mes:', error);
    } finally {
      setLoadingMonth(false);
    }
  };

  // Cargar clases del mes cuando cambien los horarios o el mes
  useEffect(() => {
    cargarClasesDelMes();
  }, [horariosRecurrentes, currentMonth]);

  // Generar días del mes actual
  const diasDelMes = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Obtener clases del día
  const getClasesDelDia = async (dia: Date, horariosParaUsar?: HorarioRecurrente[]) => {
    const diaSemana = dia.getDay();
    const horariosAFiltrar = horariosParaUsar || horariosRecurrentes;
    const horariosDelDia = horariosAFiltrar.filter(horario => horario.dia_semana === diaSemana);
    
    if (horariosDelDia.length === 0) return [];

    // Obtener todas las cancelaciones del día de una sola vez
    const { data: cancelaciones } = await supabase
      .from('turnos_cancelados')
      .select('turno_hora_inicio, turno_hora_fin')
      .eq('cliente_id', user?.id)
      .eq('turno_fecha', format(dia, 'yyyy-MM-dd'));

    // Crear un Set para búsqueda rápida de cancelaciones
    const cancelacionesSet = new Set(
      cancelaciones?.map(c => `${c.turno_hora_inicio}-${c.turno_hora_fin}`) || []
    );

    // Mapear horarios con su estado de cancelación
    const clasesConCancelaciones = horariosDelDia.map((horario) => {
      const claveCancelacion = `${horario.hora_inicio}-${horario.hora_fin}`;
      return {
        id: `${horario.id}-${format(dia, 'yyyy-MM-dd')}`,
        dia,
        horario: {
          ...horario,
          cancelada: cancelacionesSet.has(claveCancelacion)
        }
      };
    });

    return clasesConCancelaciones;
  };

  // Verificar si la fecha ya pasó
  const isFechaPasada = (fecha: Date) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaTurno = new Date(fecha);
    fechaTurno.setHours(0, 0, 0, 0);
    return fechaTurno < hoy;
  };

  // Manejar click en clase
  const handleClaseClick = (clase: ClaseDelDia) => {
    if (clase.horario.cancelada || isFechaPasada(clase.dia)) return;
    setSelectedClase(clase);
    setShowModal(true);
  };

  // Manejar cancelación de clase
  const handleCancelarClase = async (clase: ClaseDelDia) => {
    if (!user?.id) return;

    console.log('Cancelando clase:', {
      cliente_id: user.id,
      turno_fecha: format(clase.dia, 'yyyy-MM-dd'),
      turno_hora_inicio: clase.horario.hora_inicio,
      turno_hora_fin: clase.horario.hora_fin
    });

    try {
      // Verificar si ya existe una cancelación para este turno
      const { data: cancelacionExistente } = await supabase
        .from('turnos_cancelados')
        .select('id')
        .eq('cliente_id', user.id)
        .eq('turno_fecha', format(clase.dia, 'yyyy-MM-dd'))
        .eq('turno_hora_inicio', clase.horario.hora_inicio)
        .eq('turno_hora_fin', clase.horario.hora_fin);

      if (cancelacionExistente && cancelacionExistente.length > 0) {
        toast({
          title: "Turno ya cancelado",
          description: "Ya has cancelado este turno anteriormente",
          variant: "destructive",
        });
        return;
      }

      // Crear registro de cancelación
      const { error } = await supabase
        .from('turnos_cancelados')
        .insert({
          cliente_id: user.id,
          turno_fecha: format(clase.dia, 'yyyy-MM-dd'),
          turno_hora_inicio: clase.horario.hora_inicio,
          turno_hora_fin: clase.horario.hora_fin,
          tipo_cancelacion: 'usuario'
        });

      if (error) {
        console.error('Error al cancelar turno:', error);
        toast({
          title: "Error",
          description: `Error al cancelar el turno: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Recargar las clases del mes para reflejar el cambio (forzar recarga)
      await cargarClasesDelMes(true);

      setShowModal(false);
      setConfirmOpen(false);
      toast({
        title: "✅ Turno cancelado",
        description: "El turno se canceló exitosamente",
      });
    } catch (error) {
      console.error('Error al cancelar turno:', error);
      toast({
        title: "Error",
        description: "Error al cancelar el turno",
        variant: "destructive",
      });
    }
  };

  // Manejar confirmación de cancelación
  const handleConfirmarCancelacion = () => {
    if (selectedClase) {
      handleCancelarClase(selectedClase);
    }
  };

  // Manejar click en reservar turno
  const handleReservarClick = (turno: any) => {
    setTurnoToReserve(turno);
    setShowReservaModal(true);
  };

  // Manejar confirmación de reserva
  const handleConfirmarReserva = async () => {
    if (!turnoToReserve || !user?.id) return;

    setConfirmingReserva(true);
    try {
      // Insertar en turnos_variables
      const { error } = await supabase
        .from('turnos_variables')
        .insert({
          cliente_id: user.id,
          turno_fecha: turnoToReserve.turno_fecha,
          turno_hora_inicio: turnoToReserve.turno_hora_inicio,
          turno_hora_fin: turnoToReserve.turno_hora_fin,
          estado: 'confirmada',
          creado_desde_disponible_id: turnoToReserve.id
        });

      if (error) {
        console.error('Error al reservar turno:', error);
        toast({
          title: "Error",
          description: `Error al reservar el turno: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Eliminar de turnos_disponibles
      await supabase
        .from('turnos_disponibles')
        .delete()
        .eq('id', turnoToReserve.id);

      toast({
        title: "✅ Turno reservado",
        description: "El turno se reservó exitosamente",
      });
      setShowReservaModal(false);
      setTurnoToReserve(null);
      
      // Recargar turnos disponibles y clases del mes
      await cargarTurnosCancelados(true);
      await cargarClasesDelMes(true);
    } catch (error) {
      console.error('Error al reservar turno:', error);
      toast({
        title: "Error",
        description: "Error al reservar el turno",
        variant: "destructive",
      });
    } finally {
      setConfirmingReserva(false);
    }
  };

  // Cerrar modal de reserva
  const handleCloseReservaModal = () => {
    setShowReservaModal(false);
    setTurnoToReserve(null);
    setConfirmingReserva(false);
  };

  // Navegación del mes
  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  // Verificar si se puede navegar al mes anterior
  const canNavigatePrevious = () => {
    const today = new Date();
    const currentMonthStart = startOfMonth(currentMonth);
    const todayMonthStart = startOfMonth(today);
    return currentMonthStart.getTime() > todayMonthStart.getTime();
  };

  // Verificar si se puede navegar al mes siguiente
  const canNavigateNext = () => {
    const today = new Date();
    const nextMonth = addMonths(today, 1);
    const currentMonthStart = startOfMonth(currentMonth);
    const nextMonthStart = startOfMonth(nextMonth);
    return currentMonthStart.getTime() < nextMonthStart.getTime();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6 pt-1 sm:pt-2">
      {/* Subnavbar */}
      <div className="space-y-3 sm:space-y-4 mt-1 sm:mt-0">
        {/* Desktop navbar (centered pills) */}
        <div className="hidden sm:flex justify-center">
        <div className="flex space-x-1 bg-muted p-1 rounded-full w-fit">
          <button
            onClick={() => handleViewChange('mis-clases')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeView === 'mis-clases'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Mis Clases
          </button>
          <button
            onClick={() => handleViewChange('turnos-disponibles')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              activeView === 'turnos-disponibles'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Vacantes
            {turnosCancelados.length > 0 && (
              <Badge variant="default" className="h-5 px-1.5 text-xs font-bold">
                {turnosCancelados.length}
              </Badge>
            )}
          </button>
        </div>
        </div>

        {/* Mobile bottom floating navbar (unified like desktop) */}
        <div className="block sm:hidden">
          <nav className="fixed bottom-4 left-0 right-0 z-40 pointer-events-none">
            <div className="max-w-7xl mx-auto px-6 flex justify-center">
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-lg rounded-full shadow-lg pointer-events-auto px-3 py-1.5">
                {/* Mis Clases */}
                <button
                  onClick={() => handleViewChange('mis-clases')}
                  className={`relative flex flex-col items-center justify-center w-20 py-1.5 text-[10px] font-medium transition-colors ${
                    activeView === 'mis-clases' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  aria-current={activeView === 'mis-clases'}
                >
                  <Dumbbell className={`h-5 w-5 ${activeView === 'mis-clases' ? 'text-primary mb-1' : 'text-muted-foreground'}`} />
                  {activeView === 'mis-clases' && <span className="leading-none">Mis Clases</span>}
                  {activeView === 'mis-clases' && <span className="absolute -bottom-0.5 h-0.5 w-8 rounded-full bg-orange-500" />}
                </button>
                {/* Vacantes */}
                <button
                  onClick={() => handleViewChange('turnos-disponibles')}
                  className={`relative flex flex-col items-center justify-center w-20 py-1.5 text-[10px] font-medium transition-colors ${
                    activeView === 'turnos-disponibles' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  aria-current={activeView === 'turnos-disponibles'}
                >
                  <div className="relative">
                    <Zap className={`h-5 w-5 ${activeView === 'turnos-disponibles' ? 'text-primary mb-1' : 'text-muted-foreground'}`} />
                    {turnosCancelados.length > 0 && (
                      <Badge variant="default" className="absolute -top-1 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[8px] font-bold">
                        {turnosCancelados.length}
                      </Badge>
                    )}
                  </div>
                  {activeView === 'turnos-disponibles' && <span className="leading-none">Vacantes</span>}
                  {activeView === 'turnos-disponibles' && <span className="absolute -bottom-0.5 h-0.5 w-8 rounded-full bg-orange-500" />}
                </button>
                {/* Perfil */}
                <button
                  onClick={() => handleViewChange('perfil')}
                  className={`relative flex flex-col items-center justify-center w-20 py-1.5 text-[10px] font-medium transition-colors ${
                    activeView === 'perfil' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  aria-current={activeView === 'perfil'}
                >
                  <UserIcon className={`h-5 w-5 ${activeView === 'perfil' ? 'text-primary mb-1' : 'text-muted-foreground'}`} />
                  {activeView === 'perfil' && <span className="leading-none">Perfil</span>}
                  {activeView === 'perfil' && <span className="absolute -bottom-0.5 h-0.5 w-8 rounded-full bg-orange-500" />}
                </button>
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* Contenido basado en la vista activa */}
      {activeView === 'mis-clases' && (
        <>
          {/* Navegación del mes */}
          <div className="flex items-center justify-center space-x-4 -mt-2 sm:mt-0 animate-view-swap">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousMonth}
              disabled={!canNavigatePrevious()}
              className="h-8 w-8 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[200px] text-center">
              {capitalize(format(currentMonth, 'MMMM yyyy', { locale: es }))}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextMonth}
              disabled={!canNavigateNext()}
              className="h-8 w-8 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendario de Mis Clases */}
          <div className="w-full md:w-[55%] mx-auto animate-view-swap">
          <Card>
            <CardContent className="p-0">
              {horariosRecurrentes.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No tienes clases configuradas</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-2 sm:px-4 py-3 text-center sm:text-left font-medium text-xs sm:text-sm text-muted-foreground">Fecha</th>
                        <th className="px-2 sm:px-4 py-3 text-center sm:text-left font-medium text-xs sm:text-sm text-muted-foreground">Día</th>
                        <th className="px-2 sm:px-4 py-3 text-center sm:text-left font-medium text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">Clase</th>
                        <th className="px-2 sm:px-4 py-3 text-center sm:text-left font-medium text-xs sm:text-sm text-muted-foreground">Horario</th>
                        <th className="px-4 py-3 text-center font-medium text-xs sm:text-sm text-muted-foreground hidden md:table-cell">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading || loadingMonth ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center">
                            <div className="flex flex-col items-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                              <p className="text-sm text-muted-foreground">
                                {loading ? 'Cargando clases...' : 'Cargando mes...'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : diasDelMes.map((dia, index) => {
                        // Mostrar todos los días, incluyendo los pasados
                        // if (isFechaPasada(dia)) return null;
                        const clasesDelDia = clasesDelMes.filter(clase => 
                          isSameDay(clase.dia, dia)
                        );
                        return clasesDelDia.map((clase, claseIndex) => (
                          <tr 
                            key={`${dia.getTime()}-${claseIndex}`} 
                            className={`border-b last:border-b-0 transition-colors ${
                              clase.horario.cancelada 
                                ? 'bg-red-50 dark:bg-red-950/20 opacity-60' 
                                : clase.horario.esVariable
                                  ? 'bg-green-50 dark:bg-green-950/20'
                                  : isFechaPasada(clase.dia)
                                    ? 'bg-gray-50 dark:bg-gray-900/20 opacity-50'
                                    : 'hover:bg-muted/30 cursor-pointer'
                            }`}
                            onClick={() => handleClaseClick(clase)}
                          >
                            <td className="px-2 sm:px-4 py-3 text-center sm:text-left">
                              <div className="text-xs sm:text-sm font-medium">
                                {format(dia, "dd 'de' MMMM", { locale: es })}
                              </div>
                              {clase.horario.cancelada && (
                                <div className="text-[10px] sm:text-xs text-red-600 dark:text-red-400 font-medium">
                                  CANCELADA
                                </div>
                              )}
                            </td>
                            <td className="px-2 sm:px-4 py-3 text-center sm:text-left">
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                {format(dia, 'EEEE', { locale: es })}
                              </div>
                            </td>
                            <td className="px-2 sm:px-4 py-3 text-center sm:text-left hidden sm:table-cell">
                              <div className="text-xs sm:text-sm font-medium">
                                {clase.horario.nombre_clase || (clase.horario.clase_numero ? `Clase ${clase.horario.clase_numero}` : '-')}
                              </div>
                            </td>
                            <td className="px-2 sm:px-4 py-3 text-center sm:text-left">
                              <span className={`text-xs sm:text-sm font-medium ${
                                clase.horario.cancelada 
                                  ? 'text-red-600 dark:text-red-400 line-through' 
                                  : clase.horario.esVariable
                                    ? 'text-green-600 dark:text-green-400'
                                    : ''
                              }`}>
                                {formatTime(clase.horario.hora_inicio)} - {formatTime(clase.horario.hora_fin)}
                              </span>
                              {clase.horario.esVariable && (
                                <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                                  NUEVO TURNO
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center hidden md:table-cell">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClaseClick(clase);
                                }}
                                className="h-8 px-3 text-xs sm:text-sm"
                                disabled={clase.horario.cancelada || isFechaPasada(clase.dia)}
                              >
                                {clase.horario.cancelada ? 'Cancelada' : isFechaPasada(clase.dia) ? 'No disponible' : 'Ver Detalles'}
                              </Button>
                            </td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </>
      )}

      {/* Vista de Perfil */}
      {activeView === 'perfil' && (
        <div className="w-full md:w-[55%] mx-auto animate-view-swap pb-24 sm:pb-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-2xl">Mi Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Información del perfil */}
              <div className="space-y-3">
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{user?.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Nombre</p>
                    <p className="text-sm font-medium">
                      {profileData?.first_name && profileData?.last_name 
                        ? `${profileData.first_name} ${profileData.last_name}` 
                        : user?.user_metadata?.first_name && user?.user_metadata?.last_name
                          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
                          : 'No configurado'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Teléfono</p>
                    <p className="text-sm font-medium">
                      {getDisplayPhone()}
                    </p>
                  </div>
                </div>

                {/* Botón Editar Perfil */}
                <Button
                  variant="default"
                  className="w-full text-xs sm:text-sm"
                  onClick={() => setShowProfileSettings(true)}
                >
                  <UserIcon className="h-4 w-4 mr-2" />
                  Editar Perfil
                </Button>

                {/* Cerrar Sesión */}
                <Button
                  variant="destructive"
                  className="w-full text-xs sm:text-sm"
                  onClick={() => setShowLogoutConfirm(true)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cerrar Sesión
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vista de Turnos Disponibles */}
      {activeView === 'turnos-disponibles' && (
        <div className="w-full animate-view-swap pb-24 sm:pb-0">
          <div className="mb-4">
            <h2 className="text-lg sm:text-2xl font-semibold">Turnos Cancelados Disponibles</h2>
          </div>
          {loadingTurnosCancelados ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Cargando turnos cancelados...</p>
            </div>
          ) : turnosCancelados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No hay turnos cancelados disponibles</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {turnosCancelados.map((turno) => (
                <Card key={turno.id} className="hover:bg-muted/50 transition-colors flex flex-col">
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-baseline gap-2">
                        <h3 className="font-semibold text-sm sm:text-base">Clase Disponible</h3>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {(() => {
                        const [year, month, day] = turno.turno_fecha.split('-');
                        const fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        return format(fecha, "dd 'de' MMMM", { locale: es });
                      })()}
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      {formatTime(turno.turno_hora_inicio)} a {formatTime(turno.turno_hora_fin)}
                    </p>
                    {(() => {
                      const createdAt = turno.creado_at || turno.created_at;
                      const d = createdAt ? new Date(createdAt) : null;
                      return d && !isNaN(d.valueOf()) && isAdmin ? (
                        <p className="text-xs text-muted-foreground mb-3">
                          Cancelado el {format(d, "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                        </p>
                      ) : null;
                    })()}
                    {/* Botón centrado en la parte inferior */}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleReservarClick(turno)}
                      disabled={turno.reservado}
                      className="w-full mt-auto h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      {turno.reservado ? 'Reservado' : 'Reservar Clase'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de detalles de la clase */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Detalles de la Clase</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedClase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Fecha</label>
                  <p className="text-sm">{format(selectedClase.dia, "dd 'de' MMMM", { locale: es })}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Día</label>
                  <p className="text-sm">{format(selectedClase.dia, 'EEEE', { locale: es })}</p>
                </div>
              </div>
              
              {selectedClase.horario.nombre_clase && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Clase</label>
                  <p className="text-sm font-semibold">{selectedClase.horario.nombre_clase}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Hora de Inicio</label>
                  <p className="text-sm">{formatTime(selectedClase.horario.hora_inicio)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Hora de Fin</label>
                  <p className="text-sm">{formatTime(selectedClase.horario.hora_fin)}</p>
                </div>
              </div>

              {/* Aviso de política de cancelación */}
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Importante:</strong> si no cancelás la clase antes de las 24hs del comienzo de la misma, se te cobrará el 100% del valor.
                </p>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowModal(false);
                    setConfirmOpen(true);
                  }}
                  disabled={selectedClase.horario.cancelada || isFechaPasada(selectedClase.dia)}
                  className="flex-1"
                >
                  {selectedClase.horario.cancelada 
                    ? 'Ya Cancelada' 
                    : isFechaPasada(selectedClase.dia)
                      ? 'No disponible'
                      : 'Cancelar Clase'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de cancelación */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cancelación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres cancelar esta clase? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarCancelacion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar cancelación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de confirmación de reserva */}
      <Dialog open={showReservaModal} onOpenChange={setShowReservaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Confirmar Reserva</span>
            </DialogTitle>
          </DialogHeader>
          
          {turnoToReserve && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Fecha</label>
                  <p className="text-sm">{turnoToReserve.turno_fecha.split('-').reverse().join('/')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Horario</label>
                  <p className="text-sm">{formatTime(turnoToReserve.turno_hora_inicio)} - {formatTime(turnoToReserve.turno_hora_fin)}</p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Confirmación:</strong> ¿Estás seguro de que quieres reservar este horario?
                </p>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button
                  variant="default"
                  onClick={handleConfirmarReserva}
                  disabled={confirmingReserva}
                  className="flex-1"
                >
                  {confirmingReserva ? 'Reservando...' : 'Confirmar Reserva'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCloseReservaModal}
                  disabled={confirmingReserva}
                  className="flex-1"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Configuración de Perfil - Mismo formato que desktop */}
      <ProfileSettingsDialog
        open={showProfileSettings}
        onClose={() => {
          setShowProfileSettings(false);
          // Recargar datos del perfil después de cerrar
          cargarDatosPerfil();
        }}
        userId={user?.id || null}
        email={user?.email || null}
      />

      {/* Dialog de confirmación de cerrar sesión */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="w-[85vw] sm:w-[360px] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogDescription className="text-center">
              ¿Estás seguro de que quieres cerrar sesión?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row sm:justify-between items-stretch gap-2">
            <AlertDialogCancel className="text-xs sm:text-sm m-0 w-full sm:flex-1">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowLogoutConfirm(false);
                window.dispatchEvent(new CustomEvent('auth:signout'));
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm m-0 w-full sm:flex-1"
            >
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
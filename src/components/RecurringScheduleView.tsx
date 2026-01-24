import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, ChevronLeft, ChevronRight, X, Dumbbell, Zap, User as UserIcon, User, Wallet, Info } from 'lucide-react';
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay, getDate, startOfDay, addDays } from 'date-fns';
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
  bloqueada?: boolean;
  nombre_clase?: string;
  esVariable?: boolean; // Para identificar turnos variables
  tipoCancelacion?: 'usuario' | 'admin' | 'sistema'; // Tipo de cancelación para mostrar correctamente
}

interface ClaseDelDia {
  id: string;
  dia: Date;
  horario: HorarioRecurrente;
}

interface RecurringScheduleViewProps {
  initialView?: 'mis-clases' | 'turnos-disponibles' | 'perfil';
  hideSubNav?: boolean;
}

export const RecurringScheduleView = ({ initialView = 'mis-clases', hideSubNav = false }: RecurringScheduleViewProps) => {
  const { user, signOut } = useAuthContext();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const [profileData, setProfileData] = useState<any>(null);
  const [horariosRecurrentes, setHorariosRecurrentes] = useState<HorarioRecurrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedClase, setSelectedClase] = useState<ClaseDelDia | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showTurnosCancelados, setShowTurnosCancelados] = useState(false);
  const [turnosCancelados, setTurnosCancelados] = useState<any[]>([]);
  const [loadingTurnosCancelados, setLoadingTurnosCancelados] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  
  // Estados para modal de reserva
  const [showReservaModal, setShowReservaModal] = useState(false);
  const [turnoToReserve, setTurnoToReserve] = useState<any>(null);
  const [confirmingReserva, setConfirmingReserva] = useState(false);
  const [turnosReservados, setTurnosReservados] = useState<any[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeView, setActiveView] = useState<'mis-clases' | 'turnos-disponibles' | 'perfil'>(initialView);
  
  // Estados para calendario de vacantes
  const [selectedVacantesDate, setSelectedVacantesDate] = useState<Date | null>(null);
  const [showVacantesDayModal, setShowVacantesDayModal] = useState(false);
  const [vacantesCalendarMonth, setVacantesCalendarMonth] = useState(new Date());
  const [horariosSemanales, setHorariosSemanales] = useState<Array<{ dia_semana: number; hora_inicio: string; hora_fin: string; clase_numero?: number }>>([]);
  
  // Refs para rastrear qué vistas ya han sido cargadas (persisten entre renders)
  const misClasesLoadedRef = useRef<boolean>(false);
  const turnosDisponiblesLoadedRef = useRef<boolean>(false);
  const initialLoadDoneRef = useRef<boolean>(false);
  
  // Actualizar vista cuando cambie initialView desde fuera
  useEffect(() => {
    setActiveView(initialView);
    // Solo cargar si no se han cargado antes
    if (initialView === 'mis-clases' && user?.id && !misClasesLoadedRef.current) {
      setLoading(true);
      cargarHorariosRecurrentes(true);
      misClasesLoadedRef.current = true;
    } else if (initialView === 'mis-clases' && misClasesLoadedRef.current) {
      // Si ya está cargado, no mostrar loading
      setLoading(false);
    } else if (initialView === 'turnos-disponibles' && user?.id && !turnosDisponiblesLoadedRef.current) {
      setLoadingTurnosCancelados(true);
      cargarTurnosCancelados(true);
      turnosDisponiblesLoadedRef.current = true;
    } else if (initialView === 'turnos-disponibles' && turnosDisponiblesLoadedRef.current) {
      // Si ya está cargado, no mostrar loading
      setLoadingTurnosCancelados(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView, user?.id]);
  const [clasesDelMes, setClasesDelMes] = useState<any[]>([]);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const pageVisibleRef = useRef<boolean>(true);
  const lastReloadTimeRef = useRef<number>(0); // Inicializar en 0 para forzar primera carga
  const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos en caché
  const clasesDelMesCacheRef = useRef<{ monthKey: string; timestamp: number }>({ monthKey: '', timestamp: 0 });
  const CLASSES_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos en caché
  const prevMonthRef = useRef<string>('');
  
  useEffect(() => {
    pageVisibleRef.current = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
    const onVisibility = () => {
      const wasHidden = !pageVisibleRef.current;
      pageVisibleRef.current = document.visibilityState === 'visible';
      
      // Solo recargar si la página estaba oculta y vuelve a ser visible
      // Y si ha pasado más tiempo que el caché permite
      if (pageVisibleRef.current && wasHidden && lastReloadTimeRef.current > 0) {
        const timeSinceLastReload = Date.now() - lastReloadTimeRef.current;
        
        // Solo recargar si ha pasado más de 5 minutos desde la última carga
        if (timeSinceLastReload > CACHE_DURATION_MS) {
          console.log('Recargando datos después de', Math.round(timeSinceLastReload / 1000), 'segundos');
          lastReloadTimeRef.current = Date.now();
          // Refrescar silenciosamente al volver al foco (solo si es necesario)
          cargarClasesDelMes(false);
          cargarTurnosCancelados(false);
        } else {
          console.log('Datos en caché, no recargando. Última carga hace', Math.round(timeSinceLastReload / 1000), 'segundos');
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Estado para modal de edición de perfil
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  // Estado para ausencias del admin
  const [ausenciasAdmin, setAusenciasAdmin] = useState<any[]>([]);
  // Caché para ausencias del admin
  const ausenciasAdminCacheRef = useRef<{ timestamp: number }>({ timestamp: 0 });
  const AUSENCIAS_CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutos
  const userStartDate = (() => {
    if (!user?.created_at) return null;
    const created = new Date(user.created_at);
    if (Number.isNaN(created.valueOf())) return null;
    created.setHours(0, 0, 0, 0);
    return created;
  })();

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
    
    // Solo cargar si no se han cargado antes
    if (view === 'mis-clases' && !misClasesLoadedRef.current) {
      setLoading(true);
      cargarHorariosRecurrentes(true);
      misClasesLoadedRef.current = true;
    } else if (view === 'mis-clases' && misClasesLoadedRef.current) {
      // Si ya está cargado, no mostrar loading
      setLoading(false);
    }
    // Si se cambia a vacantes, recargar siempre para asegurar datos frescos
    else if (view === 'turnos-disponibles') {
      try {
        setLoadingTurnosCancelados(true);
        cargarTurnosCancelados(true, true);
        turnosDisponiblesLoadedRef.current = true;
      } catch (error) {
        console.error('Error al cambiar a vista de vacantes:', error);
        setLoadingTurnosCancelados(false);
      }
    }
  };

  // Cargar turnos cancelados al inicio (en background) para tener el contador actualizado
  // Cargar siempre, pero solo mostrar loading cuando se entra a la vista de vacantes
  useEffect(() => {
    if (user?.id && !turnosDisponiblesLoadedRef.current) {
      // Cargar en background sin mostrar loading
      cargarTurnosCancelados(false, false);
      turnosDisponiblesLoadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Cuando se cambia a la vista de vacantes, recargar si es necesario
  useEffect(() => {
    if (user?.id && activeView === 'turnos-disponibles') {
      if (!turnosDisponiblesLoadedRef.current) {
        // Si no se han cargado, cargar con loading
        setLoadingTurnosCancelados(true);
        cargarTurnosCancelados(true, true);
        turnosDisponiblesLoadedRef.current = true;
      } else {
        // Si ya están cargados, solo refrescar sin loading
        cargarTurnosCancelados(false, false);
        setLoadingTurnosCancelados(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeView]);

  // Escuchar confirmación de cierre de sesión desde menús
  useEffect(() => {
    const handleSignoutConfirm = () => setShowLogoutConfirm(true);
    window.addEventListener('auth:signout-confirm', handleSignoutConfirm);
    return () => {
      window.removeEventListener('auth:signout-confirm', handleSignoutConfirm);
    };
  }, []);

  const handleLogout = async () => {
    if (!signOut || loggingOut) return;
    try {
      setLoggingOut(true);
      // Resetear refs de caché al cerrar sesión
      misClasesLoadedRef.current = false;
      turnosDisponiblesLoadedRef.current = false;
      initialLoadDoneRef.current = false;
      lastReloadTimeRef.current = 0;
      const result = await signOut();
      if (!result.success) {
        console.error('Error al cerrar sesión:', result.error);
        return;
      }
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error inesperado al cerrar sesión:', error);
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

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

  // Cargar ausencias del admin
  const cargarAusenciasAdmin = async () => {
    try {
      const { data, error } = await supabase
        .from('ausencias_admin')
        .select('*')
        .eq('activo', true);

      if (error) {
        // Si el error es 400, puede ser que la columna 'activo' no exista o tenga otro nombre
        if (error.code === 'PGRST116' || error.message?.includes('column') || error.message?.includes('400')) {
          console.warn('⚠️ Error al cargar ausencias del admin (posible problema de esquema):', error.message);
          // Intentar sin el filtro de activo
          const { data: dataAll, error: errorAll } = await supabase
            .from('ausencias_admin')
            .select('*');
          
          if (errorAll) {
            console.error('❌ Error al cargar ausencias del admin (sin filtro):', errorAll);
            setAusenciasAdmin([]);
            return;
          }
          
          // Filtrar manualmente las activas si existe la propiedad
          const activas = (dataAll || []).filter(a => a.activo !== false);
          setAusenciasAdmin(activas);
          return;
        }
        
        console.error('❌ Error al cargar ausencias del admin:', error);
        setAusenciasAdmin([]);
        return;
      }

      setAusenciasAdmin(data || []);
      // Actualizar timestamp del caché
      ausenciasAdminCacheRef.current = { timestamp: Date.now() };
    } catch (error) {
      console.error('❌ Error inesperado al cargar ausencias:', error);
      setAusenciasAdmin([]);
    }
  };

  // Función helper para verificar si una fecha+clase está bloqueada por ausencia
  const estaClaseBloqueada = (fecha: Date, claseNumero?: number): boolean => {
    const fechaStr = format(fecha, 'yyyy-MM-dd');
    
    const bloqueada = ausenciasAdmin.some(ausencia => {
      // Verificar ausencia única
      if (ausencia.tipo_ausencia === 'unica') {
        // Extraer solo la parte de fecha (YYYY-MM-DD) del string de fecha ISO
        const fechaAusenciaISO = ausencia.fecha_inicio.split('T')[0];
        
        
        // Si la fecha coincide
        if (fechaAusenciaISO === fechaStr) {
          // Si no hay clases_canceladas específicas, se bloquean todas
          if (!ausencia.clases_canceladas || ausencia.clases_canceladas.length === 0) {
            return true;
          }
          // Si hay clases específicas, verificar si esta clase está en la lista
          if (claseNumero && ausencia.clases_canceladas.includes(claseNumero)) {
            return true;
          }
        }
      }
      
      // Verificar ausencia por período
      if (ausencia.tipo_ausencia === 'periodo') {
        const fechaInicio = ausencia.fecha_inicio.split('T')[0];
        const fechaFin = ausencia.fecha_fin ? ausencia.fecha_fin.split('T')[0] : fechaInicio;
        
        // Si la fecha está dentro del período
        if (fechaStr >= fechaInicio && fechaStr <= fechaFin) {
          return true;
        }
      }
      
      return false;
    });


    return bloqueada;
  };

  // Cargar horarios recurrentes del usuario
  const cargarHorariosRecurrentes = async (forceReload = false) => {
    if (!user?.id) return;

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
        setLoading(false);
        return;
      }

      setHorariosRecurrentes(data || []);
      setLastLoadTime(Date.now());
      lastReloadTimeRef.current = Date.now(); // Actualizar timestamp de última carga
      
      // Cargar clases del mes y mantener loading hasta que termine
      try {
        await cargarClasesDelMes(true);
      } catch (err) {
        console.error('Error al cargar clases del mes:', err);
      } finally {
        // Solo desactivar loading después de que ambas cargas terminen
        setLoading(false);
      }
    } catch (error) {
      console.error('Error al cargar horarios recurrentes:', error);
      setLoading(false);
    }
  };

  // Cargar turnos cancelados disponibles
  const cargarTurnosCancelados = async (forceReload = false, showLoading = false) => {
    if (!user?.id) {
      console.log('⚠️ cargarTurnosCancelados: No hay user.id, abortando');
      return;
    }
    
    console.log('🔄 cargarTurnosCancelados iniciado', { forceReload, showLoading, activeView });
    
    // Actualizar timestamp cuando se cargan datos
    if (forceReload || !turnosCancelados.length) {
      lastReloadTimeRef.current = Date.now();
    }

    // Mostrar loading solo si se solicita explícitamente o si se fuerza recarga y estamos en la vista de vacantes
    if (showLoading || (forceReload && activeView === 'turnos-disponibles')) {
      setLoadingTurnosCancelados(true);
    }
    try {
      // Obtener todas las clases disponibles usando la función SQL
      const fechaHoy = new Date();
      const fechaManana = format(addDays(fechaHoy, 1), 'yyyy-MM-dd');
      
      // Calcular el último día del mes actual
      const ultimoDiaMes = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth() + 1, 0);
      const fechaHasta = format(ultimoDiaMes, 'yyyy-MM-dd');
      
      // Llamar a la función SQL que calcula todas las clases disponibles del mes actual
      const { data: clasesDisponibles, error: errorClases } = await supabase
        .rpc('obtener_clases_disponibles', {
          p_fecha_desde: fechaManana,
          p_fecha_hasta: fechaHasta
        });

      if (errorClases) {
        console.error('❌ Error al cargar clases disponibles:', errorClases);
        setLoadingTurnosCancelados(false);
        setTurnosCancelados([]); // Asegurar que el array esté vacío en caso de error
        return;
      }

      // Si no hay datos, asegurar que el array esté vacío
      if (!clasesDisponibles || clasesDisponibles.length === 0) {
        setTurnosCancelados([]);
        setLoadingTurnosCancelados(false);
        return;
      }

      // Obtener turnos reservados por el usuario del mes actual
      const { data: reservados, error: errorReservados } = await supabase
        .from('turnos_variables')
        .select('turno_fecha, turno_hora_inicio, turno_hora_fin')
        .eq('cliente_id', user.id)
        .eq('estado', 'confirmada')
        .gte('turno_fecha', fechaManana)
        .lte('turno_fecha', fechaHasta);

      if (errorReservados) {
        console.error('Error al cargar turnos reservados:', errorReservados);
      }

      // Crear un Set de turnos reservados por el usuario para verificación rápida
      const turnosReservadosSet = new Set(
        (reservados || []).map(r => 
          `${r.turno_fecha}_${r.turno_hora_inicio}_${r.turno_hora_fin}`
        )
      );

      // Obtener información de cancelaciones si existen
      const idsCancelaciones = (clasesDisponibles || [])
        .filter(c => c.creado_desde_cancelacion_id)
        .map(c => c.creado_desde_cancelacion_id);
      
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

      // Expandir cada clase disponible en múltiples entradas según cupos disponibles
      const turnosExpandidos: any[] = [];
      (clasesDisponibles || []).forEach((clase) => {
        const turnoKey = `${clase.turno_fecha}_${clase.turno_hora_inicio}_${clase.turno_hora_fin}`;
        const estaReservado = turnosReservadosSet.has(turnoKey);
        
        // Solo agregar si no está reservado por este usuario
        if (!estaReservado) {
          const cancelacion = clase.creado_desde_cancelacion_id 
            ? cancelacionesMap.get(clase.creado_desde_cancelacion_id)
            : null;
          
          // Crear una entrada por cada cupo disponible
          for (let i = 0; i < clase.cupos_disponibles; i++) {
            turnosExpandidos.push({
              id: clase.turno_disponible_id || `virtual_${clase.turno_fecha}_${clase.turno_hora_inicio}_${i}`,
              turno_fecha: clase.turno_fecha,
              turno_hora_inicio: clase.turno_hora_inicio,
              turno_hora_fin: clase.turno_hora_fin,
              capacidad_total: clase.capacidad_total,
              alumnos_reservados: clase.alumnos_reservados,
              cupos_disponibles: clase.cupos_disponibles,
              clase_numero: clase.clase_numero,
              dia_semana: clase.dia_semana,
              es_cancelacion: clase.es_cancelacion,
              creado_desde_cancelacion_id: clase.creado_desde_cancelacion_id,
              creado_desde_feriado_id: clase.creado_desde_feriado_id,
              cliente_que_cancelo: cancelacion?.cliente_id,
              tipo_cancelacion: cancelacion?.tipo_cancelacion,
              reservado: false,
              canceladoPorUsuario: cancelacion?.cliente_id === user.id,
              es_virtual: !clase.turno_disponible_id // Marcar si es una entrada virtual (no existe en turnos_disponibles)
            });
          }
        }
      });

      console.log('✅ cargarTurnosCancelados completado', { turnosExpandidos: turnosExpandidos.length });
      setTurnosCancelados(turnosExpandidos);
    } catch (error) {
      console.error('❌ Error al cargar turnos cancelados:', error);
      setTurnosCancelados([]); // Asegurar que el array esté vacío en caso de error
      setLoadingTurnosCancelados(false);
    }
  };

  // Agrupar turnos por fecha y clase (por horario único) - debe estar al nivel superior del componente
  const turnosPorFecha = useMemo(() => {
    try {
      if (!turnosCancelados || !Array.isArray(turnosCancelados) || turnosCancelados.length === 0) {
        return {};
      }

      const grouped: Record<string, { turnos: typeof turnosCancelados; tieneCupos: boolean }> = {};
      turnosCancelados
        .filter(turno => turno && !turno.reservado && turno.turno_fecha)
        .forEach(turno => {
          const fechaStr = turno.turno_fecha;
          const claseKey = `${turno.turno_hora_inicio}-${turno.turno_hora_fin}`;
          const key = `${fechaStr}-${claseKey}`;
          
          if (!grouped[key]) {
            grouped[key] = { turnos: [], tieneCupos: (turno.cupos_disponibles || 0) > 0 };
          }
          grouped[key].turnos.push(turno);
        });
      
      // Agrupar por fecha
      const porFecha: Record<string, { turnos: typeof turnosCancelados; tieneCupos: boolean }> = {};
      Object.entries(grouped).forEach(([key, value]) => {
        const fechaStr = key.split('-')[0] + '-' + key.split('-')[1] + '-' + key.split('-')[2];
        if (!porFecha[fechaStr]) {
          porFecha[fechaStr] = { turnos: [], tieneCupos: false };
        }
        porFecha[fechaStr].turnos.push(...value.turnos);
        if (value.tieneCupos) {
          porFecha[fechaStr].tieneCupos = true;
        }
      });
      
      return porFecha;
    } catch (error) {
      console.error('Error procesando turnos por fecha:', error);
      return {};
    }
  }, [turnosCancelados]);

  // Determinar estado de cada día (verde = tiene cupos, rojo = completo)
  const getEstadoDia = useCallback((fecha: Date): 'verde' | 'rojo' | 'sin-clases' => {
    try {
      const fechaStr = format(fecha, 'yyyy-MM-dd');
      const diaInfo = turnosPorFecha[fechaStr];
      
      if (diaInfo && diaInfo.tieneCupos) {
        return 'verde';
      }
      
      // Verificar si hay clases programadas para este día consultando horarios_semanales
      const diaSemana = fecha.getDay() === 0 ? 7 : fecha.getDay(); // Ajustar domingo (1-7)
      const clasesProgramadas = horariosSemanales.filter(h => 
        h.dia_semana === diaSemana
      );
      
      if (clasesProgramadas.length > 0) {
        // Hay clases programadas pero no hay cupos disponibles = completo
        return 'rojo';
      }
      
      return 'sin-clases';
    } catch (error) {
      console.error('Error en getEstadoDia:', error);
      return 'sin-clases';
    }
  }, [turnosPorFecha, horariosSemanales]);

  // Suscripción en tiempo real a turnos_disponibles (siempre activa para actualizar contador)
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel('turnos_disponibles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_disponibles' }, () => {
        cargarTurnosCancelados(false, false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_variables' }, () => {
        cargarTurnosCancelados(false, false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios_recurrentes_usuario' }, () => {
        cargarTurnosCancelados(false, false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios_semanales' }, () => {
        cargarTurnosCancelados(false, false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Suscripción a turnos_cancelados del usuario y global para refrescar inmediatamente vistas
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`turnos_cancelados_changes_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_cancelados', filter: `cliente_id=eq.${user.id}` }, () => {
        cargarTurnosCancelados(false, false);
        cargarClasesDelMes(false);
        window.dispatchEvent(new CustomEvent('balance:refresh'));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Suscripción a turnos_variables del usuario para actualizar clases del mes y balance
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`turnos_variables_changes_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_variables', filter: `cliente_id=eq.${user.id}` }, () => {
        cargarClasesDelMes(false);
        window.dispatchEvent(new CustomEvent('balance:refresh'));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Suscripción a horarios recurrentes del usuario para refrescar sin recargar
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`horarios_recurrentes_changes_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios_recurrentes_usuario', filter: `usuario_id=eq.${user.id}` }, async () => {
        await cargarHorariosRecurrentes(true);
        cargarClasesDelMes(false);
        window.dispatchEvent(new CustomEvent('balance:refresh'));
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
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name, phone, is_active, fecha_desactivacion')
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

  // Cargar datos iniciales solo una vez
  useEffect(() => {
    if (user?.id && !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      // Cargar datos iniciales con loading visible solo la primera vez
      // cargarHorariosRecurrentes maneja su propio setLoading(false)
      cargarHorariosRecurrentes();
      cargarDatosPerfil();
      // Cargar ausencias del admin solo si no hay caché válido
      const now = Date.now();
      const cached = ausenciasAdminCacheRef.current;
      if (!cached.timestamp || (now - cached.timestamp) >= AUSENCIAS_CACHE_DURATION_MS) {
        cargarAusenciasAdmin(); // Cargar ausencias del admin (no bloquea, solo carga en background)
      }
      
      // Timeout de seguridad para evitar loading infinito
      const timeoutId = setTimeout(() => {
        console.warn('Timeout de seguridad: ocultando loading después de 10 segundos');
        setLoading(false);
      }, 10000);
      
      return () => clearTimeout(timeoutId);
    } else if (!user?.id) {
      // Si no hay usuario, resetear refs y ocultar loading
      misClasesLoadedRef.current = false;
      turnosDisponiblesLoadedRef.current = false;
      initialLoadDoneRef.current = false;
      lastReloadTimeRef.current = 0;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Forzar recarga del perfil al entrar en la vista de Perfil
  useEffect(() => {
    if (activeView === 'perfil' && user?.id) {
      cargarDatosPerfil();
    }
  }, [activeView, user?.id]);

  // Escuchar actualización desde el modal y recargar inmediatamente (solo si la página está visible)
  useEffect(() => {
    const handler = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        // Primero cargar los horarios recurrentes
        await cargarHorariosRecurrentes(true);
        
        // Luego cargar las clases del mes con los nuevos horarios
        // Forzamos una pequeña espera para asegurar que el estado se actualizó
        setTimeout(() => {
          cargarClasesDelMes(true);
        }, 100);
      }
    };
    window.addEventListener('horariosRecurrentes:updated', handler);
    return () => window.removeEventListener('horariosRecurrentes:updated', handler);
  }, []);

  // Escuchar cambios en ausencias del admin (solo si la página está visible)
  useEffect(() => {
    const handler = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        await cargarAusenciasAdmin();
        // Recargar clases del mes para aplicar los cambios
        setTimeout(() => {
          cargarClasesDelMes(true);
        }, 100);
      }
    };
    window.addEventListener('ausenciasAdmin:updated', handler);
    return () => window.removeEventListener('ausenciasAdmin:updated', handler);
  }, []);

  // Escuchar cambios en turnos cancelados (desde admin, especialmente feriados) - refrescar clases del mes, turnos disponibles y balance
  useEffect(() => {
    const handler = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        console.log('📢 [RECURRING_VIEW] Evento turnosCancelados:updated recibido, recargando datos...');
        // Limpiar caché para forzar recarga
        clasesDelMesCacheRef.current = { monthKey: '', timestamp: 0 };
        // Recargar horarios recurrentes primero para asegurar datos frescos
        await cargarHorariosRecurrentes(true);
        // Recargar turnos cancelados y clases del mes
        await cargarTurnosCancelados(true);
        // Pequeño delay para asegurar que los horarios se actualizaron
        setTimeout(() => {
          cargarClasesDelMes(true);
        }, 100);
        window.dispatchEvent(new CustomEvent('balance:refresh'));
      }
    };
    window.addEventListener('turnosCancelados:updated', handler);
    return () => window.removeEventListener('turnosCancelados:updated', handler);
  }, []);

  // Escuchar cambios en turnos variables (desde admin) - refrescar clases del mes y balance
  useEffect(() => {
    const handler = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        // Limpiar caché para forzar recarga
        clasesDelMesCacheRef.current = { monthKey: '', timestamp: 0 };
        await cargarClasesDelMes(true);
        window.dispatchEvent(new CustomEvent('balance:refresh'));
      }
    };
    window.addEventListener('turnosVariables:updated', handler);
    return () => window.removeEventListener('turnosVariables:updated', handler);
  }, []);

  // Escuchar cambios en turnos disponibles (desde feriados con horarios personalizados) - refrescar vista de vacantes
  useEffect(() => {
    const handler = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        console.log('📢 [RECURRING_VIEW] Evento turnosDisponibles:updated recibido, recargando turnos disponibles...');
        await cargarTurnosCancelados(true);
      }
    };
    window.addEventListener('turnosDisponibles:updated', handler);
    return () => window.removeEventListener('turnosDisponibles:updated', handler);
  }, []);

  // Escuchar cambios en clases del mes (desde admin, especialmente feriados) - solo si la página está visible
  useEffect(() => {
    const handler = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        console.log('📢 [RECURRING_VIEW] Evento clasesDelMes:updated recibido, recargando datos...');
        // Limpiar caché para forzar recarga
        clasesDelMesCacheRef.current = { monthKey: '', timestamp: 0 };
        // Recargar horarios recurrentes primero para asegurar datos frescos
        await cargarHorariosRecurrentes(true);
        // Pequeño delay para asegurar que los horarios se actualizaron
        setTimeout(() => {
          cargarClasesDelMes(true);
        }, 100);
      }
    };
    window.addEventListener('clasesDelMes:updated', handler);
    return () => window.removeEventListener('clasesDelMes:updated', handler);
  }, []);


  // Cargar clases del mes (horarios recurrentes + turnos variables)
  const cargarClasesDelMes = async (forceReload = false) => {
    if (!user?.id) return;

    const monthKey = format(currentMonth, 'yyyy-MM');
    const cachedKey = `clasesDelMes_${monthKey}`;
    const lastLoadKey = `lastClasesLoadTime_${monthKey}`;
    
    // Actualizar timestamp cuando se cargan datos
    if (forceReload || !clasesDelMes.length) {
      lastReloadTimeRef.current = Date.now();
    }

    // Si aún no contamos con horarios y no se exige recarga, evitar barrer datos existentes
    if (!forceReload && (!horariosRecurrentes || horariosRecurrentes.length === 0)) {
      return;
    }

    // Mostrar loadingMonth solo si no hay loading principal activo, hay datos previos y la pestaña está visible
    // Si loading está activo, no mostrar loadingMonth porque ya se muestra el loading principal
    setLoadingMonth(!loading && clasesDelMes.length === 0 && (typeof document === 'undefined' || document.visibilityState === 'visible'));

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
      if (horariosActuales && horariosActuales.length > 0) {
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
        const clasesVariables = turnosVariables
          .map<ClaseDelDia | null>(turno => {
          // Crear fecha correcta sin problemas de zona horaria
          const fechaParts = turno.turno_fecha.split('-');
          const fechaCorrecta = new Date(parseInt(fechaParts[0]), parseInt(fechaParts[1]) - 1, parseInt(fechaParts[2]));
            const fechaNormalizada = startOfDay(fechaCorrecta);
            if (userStartDate && fechaNormalizada < userStartDate) {
              return null;
            }
          
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
          })
          .filter((clase): clase is ClaseDelDia => clase !== null);
        todasLasClases.push(...clasesVariables);
      }

      // NO cargar turnos cancelados como líneas separadas
      // Las cancelaciones de clases recurrentes ya se marcan en getClasesDelDia
      // Las cancelaciones de turnos variables ya se manejan eliminando el turno_variable
      // Por lo tanto, NO necesitamos agregar líneas adicionales desde turnos_cancelados

      setClasesDelMes(todasLasClases);
      // Actualizar timestamp del caché
      const monthKey = format(currentMonth, 'yyyy-MM');
      clasesDelMesCacheRef.current = { monthKey, timestamp: Date.now() };
    } catch (error) {
      console.error('Error al cargar clases del mes:', error);
    } finally {
      setLoadingMonth(false);
    }
  };

  // Cargar clases del mes cuando cambien los horarios, el mes o las ausencias del admin (con caché)
  useEffect(() => {
    if (activeView === 'mis-clases') {
      const monthKey = format(currentMonth, 'yyyy-MM');
      const now = Date.now();
      const cached = clasesDelMesCacheRef.current;
      const monthChanged = prevMonthRef.current !== monthKey;
      
      // Solo recargar si:
      // 1. Cambió el mes, O
      // 2. No hay caché válido para este mes, O
      // 3. La caché expiró
      if (monthChanged || cached.monthKey !== monthKey || (now - cached.timestamp) >= CLASSES_CACHE_DURATION_MS) {
        prevMonthRef.current = monthKey;
        cargarClasesDelMes(false);
        // El timestamp se actualiza dentro de cargarClasesDelMes
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horariosRecurrentes, currentMonth, ausenciasAdmin, activeView]);

  // Recargar ausencias cuando cambie el mes (con caché)
  useEffect(() => {
    const now = Date.now();
    const cached = ausenciasAdminCacheRef.current;
    
    // Solo recargar si ha pasado más de 10 minutos desde la última carga
    if (!cached.timestamp || (now - cached.timestamp) >= AUSENCIAS_CACHE_DURATION_MS) {
      cargarAusenciasAdmin();
      ausenciasAdminCacheRef.current = { timestamp: Date.now() };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  // Generar días del mes actual
  const diasDelMes = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Obtener clases del día
  const getClasesDelDia = async (dia: Date, horariosParaUsar?: HorarioRecurrente[]) => {
    if (userStartDate && startOfDay(dia) < userStartDate) {
      return [];
    }
    // Convertir día de la semana: JS (0=domingo, 6=sábado) -> DB (1=lunes, 7=domingo)
    const diaSemanaJS = dia.getDay();
    const diaSemanaDB = diaSemanaJS === 0 ? 7 : diaSemanaJS;
    const horariosAFiltrar = horariosParaUsar || horariosRecurrentes;
    const horariosDelDia = horariosAFiltrar.filter(horario => horario.dia_semana === diaSemanaDB);
    
    const fechaFormateada = format(dia, 'yyyy-MM-dd');
    
    // Debug para feriados
    if (fechaFormateada === '2026-01-13' || fechaFormateada === '2026-01-30') {
      console.log('🔍 [GET_CLASES] Fecha:', fechaFormateada);
      console.log('📅 [GET_CLASES] Día semana JS:', diaSemanaJS, 'DB:', diaSemanaDB);
      console.log('📋 [GET_CLASES] Horarios filtrados:', horariosDelDia.length);
      if (horariosDelDia.length > 0) {
        console.log('📝 [GET_CLASES] Horarios encontrados:', horariosDelDia.map(h => ({
          id: h.id,
          hora_inicio: h.hora_inicio,
          hora_fin: h.hora_fin,
          dia_semana: h.dia_semana
        })));
      }
    }
    
    if (horariosDelDia.length === 0) return [];

    // Obtener todas las cancelaciones del día de una sola vez (incluyendo tipo_cancelacion)
    // También obtener todas las cancelaciones sin filtrar por cliente para debug
    const { data: cancelaciones, error: errorCancelaciones } = await supabase
      .from('turnos_cancelados')
      .select('turno_hora_inicio, turno_hora_fin, tipo_cancelacion, cliente_id')
      .eq('cliente_id', user?.id)
      .eq('turno_fecha', fechaFormateada);

    if (errorCancelaciones) {
      console.error('❌ [GET_CLASES] Error obteniendo cancelaciones:', errorCancelaciones);
    }

    // Debug para feriados: también buscar todas las cancelaciones de ese día sin filtrar por cliente
    if (fechaFormateada === '2026-01-13' || fechaFormateada === '2026-01-30') {
      console.log('🔍 [GET_CLASES] Buscando cancelaciones para:', {
        fecha: fechaFormateada,
        cliente_id: user?.id
      });
      console.log('🚫 [GET_CLASES] Cancelaciones encontradas (filtradas por cliente):', cancelaciones?.length || 0);
      if (cancelaciones && cancelaciones.length > 0) {
        console.log('📝 [GET_CLASES] Cancelaciones:', cancelaciones.map(c => ({
          hora_inicio: c.turno_hora_inicio,
          hora_fin: c.turno_hora_fin,
          tipo: c.tipo_cancelacion,
          cliente_id: c.cliente_id
        })));
      }
      
      // También buscar todas las cancelaciones del día para ver si existen pero con otro cliente_id
      const { data: todasCancelaciones } = await supabase
        .from('turnos_cancelados')
        .select('turno_hora_inicio, turno_hora_fin, tipo_cancelacion, cliente_id')
        .eq('turno_fecha', fechaFormateada)
        .eq('tipo_cancelacion', 'sistema');
      
      console.log('🔍 [GET_CLASES] Todas las cancelaciones del día (sistema):', todasCancelaciones?.length || 0);
      if (todasCancelaciones && todasCancelaciones.length > 0) {
        console.log('📝 [GET_CLASES] Todas las cancelaciones sistema:', todasCancelaciones.map(c => ({
          hora_inicio: c.turno_hora_inicio,
          hora_fin: c.turno_hora_fin,
          tipo: c.tipo_cancelacion,
          cliente_id: c.cliente_id
        })));
      }
    }

    // Crear un Map para búsqueda rápida de cancelaciones con su tipo
    // Normalizar horas a formato HH:MM para comparación consistente
    const cancelacionesMap = new Map(
      (cancelaciones || []).map(c => {
        const horaInicioNorm = formatTime(c.turno_hora_inicio);
        const horaFinNorm = formatTime(c.turno_hora_fin);
        const clave = `${horaInicioNorm}-${horaFinNorm}`;
        return [clave, c.tipo_cancelacion || 'usuario'];
      })
    );

    // Debug para feriados
    if (fechaFormateada === '2026-01-13' || fechaFormateada === '2026-01-30') {
      console.log('🗺️ [GET_CLASES] Mapa de cancelaciones:', Array.from(cancelacionesMap.entries()));
    }

    // Mapear horarios con su estado de cancelación y bloqueo por ausencias del admin
    const clasesConCancelaciones = horariosDelDia
      .map((horario) => {
        const horaInicioNorm = formatTime(horario.hora_inicio);
        const horaFinNorm = formatTime(horario.hora_fin);
        const claveCancelacion = `${horaInicioNorm}-${horaFinNorm}`;
        const estaCancelada = cancelacionesMap.has(claveCancelacion);
        const tipoCancelacion = estaCancelada ? cancelacionesMap.get(claveCancelacion) : undefined;
        const estaBloqueada = estaClaseBloqueada(dia, horario.clase_numero);
        
        // Debug para feriados
        if (fechaFormateada === '2026-01-13' || fechaFormateada === '2026-01-30') {
          console.log(`🔄 [GET_CLASES] Horario ${horaInicioNorm}-${horaFinNorm}:`, {
            claveCancelacion,
            estaCancelada,
            tipoCancelacion,
            horaInicioOriginal: horario.hora_inicio,
            horaFinOriginal: horario.hora_fin
          });
        }
        
        return {
          id: `${horario.id}-${fechaFormateada}`,
          dia,
          horario: {
            ...horario,
            cancelada: estaCancelada,
            bloqueada: estaBloqueada,
            tipoCancelacion: tipoCancelacion as 'usuario' | 'admin' | 'sistema' | undefined
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
    if (clase.horario.cancelada || clase.horario.bloqueada || isFechaPasada(clase.dia)) return;
    setSelectedClase(clase);
    setShowModal(true);
  };

  // Manejar cancelación de clase
  const handleCancelarClase = async (clase: ClaseDelDia) => {
    if (!user?.id) return;


    try {
      // Si es un turno variable, manejarlo de forma especial
      if (clase.horario.esVariable) {
        // 1. Buscar el turno variable en la base de datos
        const { data: turnoVariable, error: errorBuscar } = await supabase
          .from('turnos_variables')
          .select('id, creado_desde_disponible_id')
          .eq('cliente_id', user.id)
          .eq('turno_fecha', format(clase.dia, 'yyyy-MM-dd'))
          .eq('turno_hora_inicio', clase.horario.hora_inicio)
          .eq('turno_hora_fin', clase.horario.hora_fin)
          .eq('estado', 'confirmada')
          .single();

        if (errorBuscar || !turnoVariable) {
          console.error('Error al buscar turno variable:', errorBuscar);
          toast({
            title: "Error",
            description: "No se pudo encontrar el turno variable a cancelar",
            variant: "destructive",
          });
          return;
        }

        // 2. Eliminar el turno variable (para que desaparezca de la agenda)
        const { error: errorEliminar } = await supabase
          .from('turnos_variables')
          .delete()
          .eq('id', turnoVariable.id);

        if (errorEliminar) {
          console.error('Error al eliminar turno variable:', errorEliminar);
          toast({
            title: "Error",
            description: `Error al eliminar el turno variable: ${errorEliminar.message}`,
            variant: "destructive",
          });
          return;
        }

        // 3. Calcular si la cancelación es tardía (dentro de 24hs)
        const fechaHoraTurno = new Date(clase.dia);
        const [hora, minuto] = clase.horario.hora_inicio.split(':');
        fechaHoraTurno.setHours(parseInt(hora), parseInt(minuto), 0, 0);
        
        const ahora = new Date();
        const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        const esCancelacionTardia = diferenciaHoras < 24;

        // 4. Crear registro en turnos_cancelados (el trigger automáticamente creará turnos_disponibles)
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: user.id,
            turno_fecha: format(clase.dia, 'yyyy-MM-dd'),
            turno_hora_inicio: clase.horario.hora_inicio,
            turno_hora_fin: clase.horario.hora_fin,
            tipo_cancelacion: 'usuario',
            cancelacion_tardia: esCancelacionTardia
          });

        if (errorCancelacion) {
          console.error('Error al crear cancelación:', errorCancelacion);
          toast({
            title: "Error",
            description: `Error al crear cancelación: ${errorCancelacion.message}`,
            variant: "destructive",
          });
          return;
        }

      } else {
        // Para turnos recurrentes normales, usar la lógica original
        
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

        // Calcular si la cancelación es tardía (dentro de 24hs)
        const fechaHoraTurno = new Date(clase.dia);
        const [hora, minuto] = clase.horario.hora_inicio.split(':');
        fechaHoraTurno.setHours(parseInt(hora), parseInt(minuto), 0, 0);
        
        const ahora = new Date();
        const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        const esCancelacionTardia = diferenciaHoras < 24;

        // Crear registro de cancelación
        const { error } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: user.id,
            turno_fecha: format(clase.dia, 'yyyy-MM-dd'),
            turno_hora_inicio: clase.horario.hora_inicio,
            turno_hora_fin: clase.horario.hora_fin,
            tipo_cancelacion: 'usuario',
            cancelacion_tardia: esCancelacionTardia
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
      }

      // Recargar las clases del mes para reflejar el cambio (forzar recarga)
      // Usar un pequeño delay para asegurar que la DB se actualizó
      setTimeout(async () => {
        await cargarClasesDelMes(true);
        
        // Recargar turnos disponibles para actualizar vacantes
        await cargarTurnosCancelados(true);

        // Disparar eventos para actualizar vistas relacionadas y el balance
        // NO disparar turnosVariables:updated porque puede causar recargas innecesarias
        window.dispatchEvent(new Event('turnosCancelados:updated'));
        window.dispatchEvent(new CustomEvent('balance:refresh'));
      }, 300);

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

    // Verificar si el usuario está inactivo
    const { data: perfilUsuario, error: errorPerfil } = await supabase
      .from('profiles')
      .select('is_active, fecha_desactivacion')
      .eq('id', user.id)
      .single();

    if (errorPerfil) {
      console.error('Error verificando estado del usuario:', errorPerfil);
    }

    const hoy = new Date().toISOString().split('T')[0];
    const estaInactivo = perfilUsuario?.is_active === false || 
      (perfilUsuario?.fecha_desactivacion && perfilUsuario.fecha_desactivacion <= hoy);

    if (estaInactivo) {
      toast({
        title: "Usuario inactivo",
        description: "Tu cuenta está inactiva. No puedes realizar nuevas reservas.",
        variant: "destructive",
      });
      return;
    }

    setConfirmingReserva(true);
    try {
      // Si el turno es virtual (no existe en turnos_disponibles), crear el registro primero
      let turnoDisponibleId = turnoToReserve.id;
      
      if (turnoToReserve.es_virtual || turnoToReserve.id?.startsWith('virtual_')) {
        // Crear registro en turnos_disponibles si no existe
        const { data: turnoDisponibleExistente, error: errorBuscar } = await supabase
          .from('turnos_disponibles')
          .select('id')
          .eq('turno_fecha', turnoToReserve.turno_fecha)
          .eq('turno_hora_inicio', turnoToReserve.turno_hora_inicio)
          .eq('turno_hora_fin', turnoToReserve.turno_hora_fin)
          .maybeSingle();

        if (errorBuscar && errorBuscar.code !== 'PGRST116') {
          console.error('Error buscando turno disponible:', errorBuscar);
        }

        if (!turnoDisponibleExistente) {
          // Crear nuevo registro en turnos_disponibles
          const { data: nuevoTurnoDisponible, error: errorCrear } = await supabase
            .from('turnos_disponibles')
            .insert({
              turno_fecha: turnoToReserve.turno_fecha,
              turno_hora_inicio: turnoToReserve.turno_hora_inicio,
              turno_hora_fin: turnoToReserve.turno_hora_fin,
              creado_desde_cancelacion_id: turnoToReserve.creado_desde_cancelacion_id || null,
              creado_desde_feriado_id: turnoToReserve.creado_desde_feriado_id || null
            })
            .select('id')
            .single();

          if (errorCrear) {
            console.error('Error creando turno disponible:', errorCrear);
            toast({
              title: "Error",
              description: `Error al crear el turno disponible: ${errorCrear.message}`,
              variant: "destructive",
            });
            return;
          }

          turnoDisponibleId = nuevoTurnoDisponible.id;
        } else {
          turnoDisponibleId = turnoDisponibleExistente.id;
        }
      }

      // Insertar en turnos_variables
      const { error } = await supabase
        .from('turnos_variables')
        .insert({
          cliente_id: user.id,
          turno_fecha: turnoToReserve.turno_fecha,
          turno_hora_inicio: turnoToReserve.turno_hora_inicio,
          turno_hora_fin: turnoToReserve.turno_hora_fin,
          estado: 'confirmada',
          creado_desde_disponible_id: turnoDisponibleId
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

      // NO eliminar de turnos_disponibles para mantener historial
      // El filtro en el frontend ocultará los turnos ya reservados

      // Disparar evento para actualizar balance del admin
      window.dispatchEvent(new Event('turnosVariables:updated'));

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/80"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6 pt-1 sm:pt-2 pb-20 sm:pb-2 md:pb-2">
      {/* Subnavbar - solo mostrar si no está oculta */}
      {!hideSubNav && (
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
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('nav:balance'))}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors text-muted-foreground hover:text-foreground`}
            >
              Balance
            </button>
          </div>
          </div>
        </div>
      )}

      {/* Contenido basado en la vista activa */}
      {activeView === 'mis-clases' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/80 mx-auto mb-4"></div>
                <p className="text-sm text-white/90">Cargando tus clases...</p>
              </div>
            </div>
          ) : (
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
                <div>
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-2 sm:px-4 py-3 text-center sm:text-left font-medium text-xs sm:text-sm text-muted-foreground">Fecha</th>
                        <th className="px-2 sm:px-4 py-3 text-center sm:text-left font-medium text-xs sm:text-sm text-muted-foreground">Día</th>
                        <th className="px-2 sm:px-4 py-3 text-center sm:text-left font-medium text-xs sm:text-sm text-muted-foreground">Horario</th>
                        <th className="px-4 py-3 text-center font-medium text-xs sm:text-sm text-muted-foreground hidden md:table-cell">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingMonth ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center">
                            <div className="flex flex-col items-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/80 mb-2"></div>
                              <p className="text-sm text-white/90">Cargando mes...</p>
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
                                ? 'bg-red-50 dark:bg-red-950/20 opacity-60 cursor-default' 
                                : clase.horario.bloqueada
                                  ? 'bg-yellow-50 dark:bg-yellow-950/20 opacity-70 cursor-default'
                                  : clase.horario.esVariable
                                    ? 'bg-green-50 dark:bg-green-950/20'
                                    : isFechaPasada(clase.dia)
                                      ? 'bg-gray-50 dark:bg-gray-900/20 opacity-50 cursor-default'
                                      : 'hover:bg-muted/30 cursor-pointer'
                            }`}
                            onClick={() => clase.horario.cancelada || clase.horario.bloqueada || isFechaPasada(clase.dia) ? null : handleClaseClick(clase)}
                          >
                            <td className="px-2 sm:px-4 py-3 text-center sm:text-left">
                              <div className="text-xs sm:text-sm font-medium">
                                {format(dia, "dd 'de' MMMM", { locale: es })}
                              </div>
                            </td>
                            <td className="px-2 sm:px-4 py-3 text-center sm:text-left">
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                {format(dia, 'EEEE', { locale: es })}
                              </div>
                              {clase.horario.cancelada && (
                                <div className={`text-[10px] sm:text-xs font-medium ${
                                  clase.horario.tipoCancelacion === 'sistema'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {clase.horario.tipoCancelacion === 'sistema' ? 'FERIADO' : 'CANCELADA'}
                                </div>
                              )}
                              {clase.horario.bloqueada && (
                                <div className="text-[8px] sm:text-xs text-yellow-600 dark:text-yellow-400 font-light sm:font-medium">
                                  CLASE BLOQUEADA
                                </div>
                              )}
                            </td>
                            <td className="px-2 sm:px-4 py-3 text-center sm:text-left">
                              <span className={`text-xs sm:text-sm font-medium ${
                                clase.horario.cancelada 
                                  ? clase.horario.tipoCancelacion === 'sistema'
                                    ? 'text-amber-600 dark:text-amber-400 line-through'
                                    : 'text-red-600 dark:text-red-400 line-through'
                                  : clase.horario.bloqueada
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : clase.horario.esVariable
                                      ? 'text-green-600 dark:text-green-400'
                                      : ''
                              }`}>
                                {formatTime(clase.horario.hora_inicio)} - {formatTime(clase.horario.hora_fin)}
                              </span>
                              {clase.horario.esVariable && !clase.horario.cancelada && (
                                <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                                  Nueva clase
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
                                disabled={clase.horario.cancelada || clase.horario.bloqueada || isFechaPasada(clase.dia)}
                              >
                                {clase.horario.cancelada ? 'Cancelada' : clase.horario.bloqueada ? 'Bloqueada' : isFechaPasada(clase.dia) ? 'No disponible' : 'Ver Detalles'}
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
                  className="w-full text-xs sm:text-sm bg-white text-gray-900 hover:bg-gray-100 border border-gray-300"
                  onClick={() => setShowProfileSettings(true)}
                >
                  <UserIcon className="h-4 w-4 mr-2" />
                  Editar Perfil
                </Button>

              <Button
                className="w-full text-xs sm:text-sm bg-white text-gray-900 hover:bg-gray-100 border border-gray-300"
                onClick={() => window.dispatchEvent(new CustomEvent('info:guide-open'))}
              >
                <Info className="h-4 w-4 mr-2" />
                Información
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
      {activeView === 'turnos-disponibles' && (() => {

        // Renderizar calendario
        const renderVacantesCalendar = () => {
          const year = vacantesCalendarMonth.getFullYear();
          const month = vacantesCalendarMonth.getMonth();
          const firstDay = startOfMonth(vacantesCalendarMonth);
          const lastDay = endOfMonth(vacantesCalendarMonth);
          const daysInMonth = getDate(lastDay);
          const startingDayOfWeek = getDay(firstDay) === 0 ? 6 : getDay(firstDay) - 1; // Lunes = 0

          const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];
          
          // Días del mes anterior
          for (let i = 0; i < startingDayOfWeek; i++) {
            const date = new Date(year, month, -i);
            days.unshift({ date, isCurrentMonth: false });
          }
          
          // Días del mes actual
          for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            days.push({ date, isCurrentMonth: true });
          }
          
          // Completar hasta el final de la semana
          const remainingDays = 42 - days.length; // 6 semanas * 7 días
          for (let i = 1; i <= remainingDays; i++) {
            const date = new Date(year, month + 1, i);
            days.push({ date, isCurrentMonth: false });
          }

          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);

          return (
            <div className="w-full">
              {/* Navegación del mes */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVacantesCalendarMonth(prev => subMonths(prev, 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-lg font-semibold">
                  {format(vacantesCalendarMonth, "MMMM yyyy", { locale: es })}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVacantesCalendarMonth(prev => addMonths(prev, 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Headers de días */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Días del calendario */}
              <div className="grid grid-cols-7 gap-1">
                {days.map(({ date, isCurrentMonth }, index) => {
                  const estadoDia = isCurrentMonth ? getEstadoDia(date) : 'sin-clases';
                  const isPast = date < hoy;
                  const isToday = isSameDay(date, hoy);

                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (isCurrentMonth && !isPast && estadoDia !== 'sin-clases') {
                          setSelectedVacantesDate(date);
                          setShowVacantesDayModal(true);
                        }
                      }}
                      disabled={!isCurrentMonth || isPast || estadoDia === 'sin-clases'}
                      className={`
                        relative min-h-[48px] p-2 rounded-lg text-sm
                        transition-colors
                        ${!isCurrentMonth ? 'opacity-0 cursor-default' : ''}
                        ${isPast ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'}
                        ${isToday ? 'ring-2 ring-primary' : ''}
                        ${estadoDia === 'sin-clases' ? 'cursor-default' : ''}
                      `}
                    >
                      <span className={isCurrentMonth ? '' : 'invisible'}>{getDate(date)}</span>
                      {isCurrentMonth && !isPast && (
                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                          {estadoDia === 'verde' && (
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                          )}
                          {estadoDia === 'rojo' && (
                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Leyenda */}
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span>Con cupos disponibles</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span>Completo</span>
                </div>
              </div>
            </div>
          );
        };

        return (
          <div className="w-full animate-view-swap pb-24 sm:pb-0">
            <div className="mb-6">
              <h2 className="text-lg sm:text-2xl font-semibold">Vacantes Disponibles</h2>
              <p className="text-sm text-muted-foreground mt-1">Seleccioná un día para ver las clases disponibles</p>
            </div>
            {loadingTurnosCancelados ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/80 mx-auto mb-4"></div>
                <p className="text-white/90">Cargando vacantes...</p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-4 sm:p-6">
                  {renderVacantesCalendar()}
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}

      {/* Modal de clases del día seleccionado */}
      <Dialog open={showVacantesDayModal} onOpenChange={setShowVacantesDayModal}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedVacantesDate && format(selectedVacantesDate, "dd 'de' MMMM 'de' yyyy", { locale: es })}
            </DialogTitle>
            <DialogDescription>
              Clases disponibles para este día
            </DialogDescription>
          </DialogHeader>
          
          {selectedVacantesDate && (() => {
            try {
              const fechaStr = format(selectedVacantesDate, 'yyyy-MM-dd');
              const turnosDia = (turnosCancelados || [])
                .filter(turno => turno && !turno.reservado && turno.turno_fecha === fechaStr)
                .map(turno => {
                  try {
                    const fecha = new Date(turno.turno_fecha);
                    const bloqueado = estaClaseBloqueada(fecha, turno.clase_numero);
                    return { ...turno, bloqueadoPorAdmin: bloqueado };
                  } catch (error) {
                    console.error('Error procesando turno:', error, turno);
                    return { ...turno, bloqueadoPorAdmin: false };
                  }
                });

              // Agrupar por horario (clase)
              const clasesAgrupadas: Record<string, typeof turnosDia> = {};
              turnosDia.forEach(turno => {
                if (turno && turno.turno_hora_inicio && turno.turno_hora_fin) {
                  const key = `${turno.turno_hora_inicio}-${turno.turno_hora_fin}`;
                  if (!clasesAgrupadas[key]) {
                    clasesAgrupadas[key] = [];
                  }
                  clasesAgrupadas[key].push(turno);
                }
              });

              const clasesArray = Object.entries(clasesAgrupadas).map(([key, turnos]) => ({
                horario: key,
                turnos: turnos.filter(t => t),
                tieneCupos: turnos.length > 0 && turnos[0] && !turnos[0].bloqueadoPorAdmin
              })).filter(clase => clase.turnos.length > 0);

              if (clasesArray.length === 0) {
                return (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>No hay clases disponibles para este día</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2 mt-4">
                  {clasesArray.map((clase, idx) => {
                    const primerTurno = clase.turnos[0];
                    if (!primerTurno) return null;
                    
                    return (
                      <div
                        key={idx}
                        className={`
                          flex items-center justify-between p-3 rounded-lg border
                          ${clase.tieneCupos 
                            ? 'border-green-500/30 bg-green-500/10 hover:bg-green-500/20 cursor-pointer' 
                            : 'border-red-500/30 bg-red-500/10 opacity-60 cursor-not-allowed'
                          }
                          transition-colors
                        `}
                        onClick={() => {
                          if (clase.tieneCupos && clase.turnos.length > 0) {
                            handleReservarClick(clase.turnos[0]);
                            setShowVacantesDayModal(false);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`
                            w-3 h-3 rounded-full flex-shrink-0
                            ${clase.tieneCupos ? 'bg-green-500' : 'bg-red-500'}
                          `} />
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              Clase {primerTurno.clase_numero || ''} - {formatTime(primerTurno.turno_hora_inicio)} a {formatTime(primerTurno.turno_hora_fin)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {clase.tieneCupos 
                                ? `${clase.turnos.length} cupo${clase.turnos.length > 1 ? 's' : ''} disponible${clase.turnos.length > 1 ? 's' : ''}`
                                : 'Completo'
                              }
                            </div>
                          </div>
                        </div>
                        {clase.tieneCupos && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (clase.turnos.length > 0 && clase.turnos[0]) {
                                handleReservarClick(clase.turnos[0]);
                                setShowVacantesDayModal(false);
                              }
                            }}
                          >
                            Reservar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            } catch (error) {
              console.error('Error renderizando clases del día:', error);
              return (
                <div className="py-8 text-center text-muted-foreground">
                  <p>Error al cargar las clases. Por favor, intentá nuevamente.</p>
                </div>
              );
            }
          })()}
        </DialogContent>
      </Dialog>

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
              <div className="bg-muted/40 border border-border rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
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
              {selectedClase && (() => {
                const fechaHoraTurno = new Date(selectedClase.dia);
                const [hora, minuto] = selectedClase.horario.hora_inicio.split(':');
                fechaHoraTurno.setHours(parseInt(hora), parseInt(minuto), 0, 0);
                
                const ahora = new Date();
                const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
                const esCancelacionTardia = diferenciaHoras < 24;
                
                if (esCancelacionTardia) {
                  return (
                    <div className="space-y-2">
                      <span className="block">¿Estás seguro de que quieres cancelar esta clase?</span>
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                        <span className="block text-yellow-800 dark:text-yellow-200 font-medium">
                          ⚠️ Cancelación tardía
                        </span>
                        <span className="block text-yellow-700 dark:text-yellow-300 text-sm">
                          Al cancelar dentro de las 24hs previas al inicio de la clase, se te cobrará el valor completo de la misma.
                        </span>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="space-y-2">
                      <span className="block">¿Estás seguro de que quieres cancelar esta clase?</span>
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                        <span className="block text-green-800 dark:text-green-200 font-medium">
                          ✅ Cancelación con anticipación
                        </span>
                        <span className="block text-green-700 dark:text-green-300 text-sm">
                          Al cancelar con más de 24hs de anticipación, no se te cobrará por esta clase.
                        </span>
                      </div>
                    </div>
                  );
                }
              })()}
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
            <AlertDialogTitle className="sr-only">Confirmar cierre de sesión</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              ¿Estás seguro de que quieres cerrar sesión?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row sm:justify-between items-stretch gap-2">
            <AlertDialogCancel className="text-xs sm:text-sm m-0 w-full sm:flex-1">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm m-0 w-full sm:flex-1 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loggingOut ? 'Cerrando...' : 'Cerrar sesión'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
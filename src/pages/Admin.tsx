import { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Shield, 
  UserPlus, 
  UserMinus, 
  Crown, 
  User, 
  Calendar,
  Search,
  Filter,
  MoreHorizontal,
  Trash2,
  Eye,
  Settings,
  Clock,
  LogOut,
  X,
  Wallet
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { useAdmin, AdminUser } from '@/hooks/useAdmin';
import { useNotifications } from '@/hooks/useNotifications';
import { CalendarView } from '@/components/CalendarView';
import { TurnoManagement } from '@/components/TurnoManagement';
import { FeriadosConfigModal } from '@/components/FeriadosConfigModal';
import { FinSemanaConfigModal } from '@/components/FinSemanaConfigModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminNavigation } from '@/hooks/useAdminNavigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
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

export default function Admin() {
  const { user, signOut } = useAuthContext();
  const navigate = useNavigate();
  const { activeTab, handleTabChange } = useAdminNavigation();
  const { 
    isAdmin, 
    isLoading, 
    adminUsers, 
    allUsers, 
    fetchAllUsers, 
    fetchAdminUsers,
    changeUserRole,
    deleteUser,
    canBeAdmin,
    selectedYear, selectedMonth, setSelectedYear, setSelectedMonth,
    fetchCuotasMensuales, updateCuotaEstadoPago, updateCuotaDescuento,
    fetchHorariosConHoras
  } = useAdmin();
  
  const [horariosConHoras, setHorariosConHoras] = useState<Record<string, Array<{ dia: string; hora_inicio: string }>>>({});
  
  const { showSuccess, showError, showWarning, showLoading, dismissToast } = useNotifications();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'client'>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [paymentSortOrder, setPaymentSortOrder] = useState<'default' | 'pendiente_first' | 'pagado_first'>('default');
  const [cuotasMap, setCuotasMap] = useState<Record<string, { monto: number; estado: 'pendiente'|'abonada'|'vencida' }>>({});
  const [balanceRows, setBalanceRows] = useState<Array<{ usuario_id: string; nombre: string; email: string; monto: number; montoOriginal: number; estado: 'pendiente'|'abonada'|'vencida'; descuento: number; tipoPago: 'transferencia' | 'efectivo' }>>([]);
  
  // Estado local para tipo de pago (solo indicador visual, no se persiste en BD)
  const [tipoPagoMap, setTipoPagoMap] = useState<Record<string, 'transferencia' | 'efectivo'>>(() => {
    try {
      const stored = localStorage.getItem('adminTipoPagoMap');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  
  const getTipoPago = (userId: string): 'transferencia' | 'efectivo' => {
    return tipoPagoMap[userId] || 'transferencia';
  };
  
  const setTipoPago = (userId: string, tipo: 'transferencia' | 'efectivo') => {
    const newMap = { ...tipoPagoMap, [userId]: tipo };
    setTipoPagoMap(newMap);
    localStorage.setItem('adminTipoPagoMap', JSON.stringify(newMap));
  };
  const [balanceTotals, setBalanceTotals] = useState<{ totalAbonado: number; totalPendiente: number }>({ totalAbonado: 0, totalPendiente: 0 });
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const skipNextReload = useRef(false);
  const [ausenciasAdmin, setAusenciasAdmin] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<string | null>(null);
  const [userHistory, setUserHistory] = useState<Array<{ anio: number; mes: string; monto: number; estado: string }>>([]);
  // Estado de pago por usuario (persistido localmente)
  type EstadoPago = 'pendiente' | 'pagado';
  const STORAGE_PAGO = 'adminPaymentStatus';
  const leerEstadoPagoMap = (): Record<string, EstadoPago> => {
    try {
      const raw = localStorage.getItem(STORAGE_PAGO);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  };
  const escribirEstadoPagoMap = (mapa: Record<string, EstadoPago>) => {
    localStorage.setItem(STORAGE_PAGO, JSON.stringify(mapa));
  };
  // Estado reactivo para forzar re-render al cambiar
  const [estadoPagoMap, setEstadoPagoMap] = useState<Record<string, EstadoPago>>(() => leerEstadoPagoMap());
  const getEstadoPagoLocal = (userId: string): EstadoPago => {
    return estadoPagoMap[userId] || 'pendiente'; // por defecto Pendiente (rojo)
  };
  const setEstadoPagoLocal = (userId: string, estado: EstadoPago) => {
    setEstadoPagoMap(prev => {
      const next = { ...prev, [userId]: estado };
      escribirEstadoPagoMap(next);
      return next;
    });
  };
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showFeriadosModal, setShowFeriadosModal] = useState(false);
  const [showFinSemanaModal, setShowFinSemanaModal] = useState(false);
  const [fechaSeleccionadaFeriado, setFechaSeleccionadaFeriado] = useState<Date | null>(null);
  const [fechaSeleccionadaFinSemana, setFechaSeleccionadaFinSemana] = useState<Date | null>(null);

  // Función para obtener las iniciales del usuario
  const getInitials = (email: string) => {
    if (!email) return 'A';
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email[0].toUpperCase();
  };

  // Función para obtener el nombre del usuario
  const getUserName = (email: string) => {
    if (!email) return 'Admin';
    const name = email.split('@')[0];
    // Separar por punto y capitalizar cada parte
    const parts = name.split('.');
    if (parts.length >= 2) {
      return parts.map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join(' ');
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  // Función para cargar ausencias del admin
  const cargarAusenciasAdmin = async () => {
    try {
      const { data, error } = await supabase
        .from('ausencias_admin')
        .select('*')
        .eq('activo', true);

      if (error) {
        console.error('Error cargando ausencias del admin:', error);
        return;
      }

      setAusenciasAdmin(data || []);
    } catch (error) {
      console.error('Error inesperado cargando ausencias del admin:', error);
    }
  };

  // Función para verificar si una clase está bloqueada por ausencia del admin
  const estaClaseBloqueada = (fecha: string, claseNumero: number) => {
    if (!ausenciasAdmin || ausenciasAdmin.length === 0) return false;

    const fechaObj = new Date(fecha);
    const dia = fechaObj.getDate();
    const mes = fechaObj.getMonth() + 1;
    const año = fechaObj.getFullYear();

    return ausenciasAdmin.some(ausencia => {
      // Verificar ausencia única
      if (ausencia.tipo === 'unica') {
        return ausencia.dia === dia && 
               ausencia.mes === mes && 
               ausencia.año === año &&
               ausencia.clase_numero === claseNumero;
      }
      
      // Verificar ausencia por período
      if (ausencia.tipo === 'periodo') {
        const fechaDesde = new Date(ausencia.fecha_desde);
        const fechaHasta = new Date(ausencia.fecha_hasta);
        
        return fechaObj >= fechaDesde && 
               fechaObj <= fechaHasta &&
               ausencia.clase_numero === claseNumero;
      }
      
      return false;
    });
  };

  // Función para obtener el nombre del día (BD usa 1=Lun..7=Dom)
  const getDiaNombre = (diaSemana: number) => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const idx = diaSemana % 7; // 7 -> 0 (Dom), 1..6 -> 1..6
    return dias[idx] || 'Desconocido';
  };

  // Función para obtener el nombre corto del día (BD usa 1=Lun..7=Dom)
  const getDiaCorto = (diaSemana: number) => {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const idx = diaSemana % 7; // normaliza 7 a 0
    return dias[idx] || '—';
  };

  // Función para obtener días de asistencia del usuario
  const getDiasAsistencia = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user || !user.horarios_recurrentes || user.horarios_recurrentes.length === 0) {
      return '—';
    }
    
    // Extraer todos los días únicos de todos los horarios
    const diasSet = new Set<string>();
    for (const h of user.horarios_recurrentes) {
      if (h.dias_semana && Array.isArray(h.dias_semana)) {
        h.dias_semana.forEach(dia => diasSet.add(dia));
      }
    }
    
    if (diasSet.size === 0) return '—';
    
    // Mapear días de texto a números para ordenar
    const diaMap: Record<string, number> = {
      'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 
      'Viernes': 5, 'Sábado': 6, 'Domingo': 7
    };
    
    const diasUnicos = Array.from(diasSet)
      .map(dia => diaMap[dia] || 0)
      .filter(d => d !== 0)
      .sort((a, b) => a - b);

    return diasUnicos.map(d => getDiaCorto(d)).join(', ');
  };

  // Función para formatear hora (HH:mm) a formato legible (8am, 5pm)
  const formatHora = (horaInicio: string) => {
    if (!horaInicio) return '';
    try {
      const partes = horaInicio.split(':');
      if (partes.length < 2) return horaInicio; // Si no tiene formato esperado, devolver como está
      const horas = partes[0];
      const minutos = partes[1] || '00';
      const h = parseInt(horas, 10);
      if (isNaN(h)) return horaInicio;
      const m = minutos.substring(0, 2); // Solo tomar los primeros 2 caracteres de minutos
      const esPM = h >= 12;
      const hora12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${hora12}${m !== '00' ? ':' + m : ''}${esPM ? 'pm' : 'am'}`;
    } catch (error) {
      console.error('Error formateando hora:', error, horaInicio);
      return horaInicio; // Devolver el valor original si hay error
    }
  };

  // Función para obtener horarios del usuario ordenados por día
  const getHorariosUsuario = (userId: string) => {
    try {
      const horarios = horariosConHoras[userId];
      if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
        return [];
      }

      // Mapear días a números para ordenar
      const diaMap: Record<string, number> = {
        'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 
        'Viernes': 5, 'Sábado': 6, 'Domingo': 7
      };

      // Ordenar por día de la semana (crear copia para no mutar el original)
      return [...horarios].sort((a, b) => {
        const numA = diaMap[a?.dia] || 99;
        const numB = diaMap[b?.dia] || 99;
        return numA - numB;
      });
    } catch (error) {
      console.error('Error obteniendo horarios usuario:', error, userId);
      return [];
    }
  };

  // Función para calcular deuda del usuario (desde base de datos)
  const getEstadoCuenta = (userId: string) => {
    // Por ahora retornar "—" hasta que se implemente la tabla de pagos
    // TODO: Consultar tabla pagos_usuarios cuando esté implementada
    return '—';
  };

  // Función para obtener estado de pago del usuario (local hasta tener backend)
  const getEstadoPago = (userId: string): EstadoPago => {
    return getEstadoPagoLocal(userId);
  };

  // Nombre a mostrar: preferir first_name + last_name; si no, full_name; si no, derivar de email
  const getDisplayFullName = (u: AdminUser) => {
    const looksLikeEmail = (value: string) => /@/.test(value || '');
    const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
    const capitalizeWords = (s: string) => s
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(capitalize)
      .join(' ');
    if ((u.first_name || u.last_name)) {
      const first = capitalize(u.first_name || '');
      const last = capitalize(u.last_name || '');
      const combined = `${first} ${last}`.trim();
      if (combined) return combined;
    }
    if (u.full_name && !looksLikeEmail(u.full_name)) return capitalizeWords(u.full_name);
    const local = (u.email || '').split('@')[0];
    if (!local) return 'Usuario';
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) return `${capitalize(parts[0])} ${capitalize(parts[1])}`;
    // Intentar detectar nombre sin separadores (p.ej., "gastondigilio")
    const commonFirstNames = [
      'agustin','agustina','andres','ana','antonio','beatriz','bruno','carlos','camila','catalina','cristian',
      'diego','daniel','dalma','dario','emiliano','emilia','esteban','facundo','federico','florencia',
      'franco','fernando','gabriel','gaston','gonzalo','guillermo','ignacio','ivan','javier','jorge','jose',
      'juan','julian','julia','karina','laura','leandro','leonardo','luan','lucas','lucia','luis','marcelo',
      'martin','martina','matias','melina','maria','mariana','mariano','marcos','maximiliano','nicolas','noelia',
      'pablo','patricia','paula','ricardo','rodrigo','romina','santiago','sebastian','sergio','silvia','sofia',
      'tomás','tomas','valentin','valentina','vanesa','victoria'
    ];
    const lowerLocal = local.toLowerCase();
    const matched = commonFirstNames.find(n => lowerLocal.startsWith(n));
    if (matched && lowerLocal.length > matched.length) {
      const first = matched;
      const last = lowerLocal.slice(matched.length);
      return `${capitalize(first)} ${capitalize(last)}`;
    }
    return capitalize(local);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // La redirección se maneja automáticamente en el contexto
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };
  
  // Redirigir usuarios no-admin al dashboard de usuario
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/user', { replace: true });
    }
  }, [isLoading, isAdmin, navigate]);

  // Sincronizar phones desde auth.users al cargar Admin
  useEffect(() => {
    const syncPhones = async () => {
      if (!isAdmin) return;
      
      try {
        const { data, error } = await supabase.rpc('sync_phones_from_auth');
        if (error) {
          console.warn('No se pudo sincronizar phones automáticamente:', error.message);
        } else if (data && data.success && data.updated_count > 0) {
          console.log(`✅ ${data.updated_count} teléfonos sincronizados`);
          fetchAllUsers(); // Recargar usuarios para mostrar los cambios
        }
      } catch (err) {
        console.warn('Error ejecutando sync de phones:', err);
      }
    };
    
    syncPhones();
  }, [isAdmin, fetchAllUsers]);

  // Cargar datos al montar el componente y refrescar verificación de admin
  useEffect(() => {
    if (isAdmin) {
      fetchAllUsers();
      fetchAdminUsers();
      // Cargar horarios con horas al cargar usuarios
      if (fetchHorariosConHoras) {
        fetchHorariosConHoras().then(setHorariosConHoras).catch(err => {
          console.error('Error cargando horarios:', err);
        });
      }
    }
  }, [isAdmin, fetchAllUsers, fetchAdminUsers, fetchHorariosConHoras]);

  // Listener para actualizar cuotas cuando cambien las ausencias del admin
  useEffect(() => {
    const handleAusenciasUpdate = () => {
      // Recargar cuotas del período actual
      (async () => {
        await cargarAusenciasAdmin();
        // El useEffect principal se encargará del recálculo
      })();
    };

    const handleClasesUpdate = () => {
      // Recargar usuarios cuando cambien clases o turnos para obtener datos actualizados
      if (isAdmin) {
        fetchAllUsers();
        // Recargar horarios cuando cambien clases o turnos
        if (fetchHorariosConHoras) {
          fetchHorariosConHoras().then(setHorariosConHoras).catch(err => {
            console.error('Error recargando horarios:', err);
          });
        }
      }
    };

    window.addEventListener('ausenciasAdmin:updated', handleAusenciasUpdate);
    window.addEventListener('clasesUsuario:updated', handleClasesUpdate);
    window.addEventListener('turnosCancelados:updated', handleClasesUpdate);
    window.addEventListener('turnosVariables:updated', handleClasesUpdate);
    
    return () => {
      window.removeEventListener('ausenciasAdmin:updated', handleAusenciasUpdate);
      window.removeEventListener('clasesUsuario:updated', handleClasesUpdate);
      window.removeEventListener('turnosCancelados:updated', handleClasesUpdate);
      window.removeEventListener('turnosVariables:updated', handleClasesUpdate);
    };
  }, [selectedYear, selectedMonth, isAdmin, fetchAllUsers]);

  // Refrescar verificación de admin cuando el componente se monta
  useEffect(() => {
    const refreshAdminCheck = async () => {
      if (user) {
        // Verificar por email
        const { data: byEmail, error: emailError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', user.email)
          .single();

        // Verificar por ID
        const { data: byId, error: idError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
      }
    };

    refreshAdminCheck();
  }, [user]);

  // Filtrar usuarios según búsqueda y filtros
  const filteredUsers = allUsers.filter(user => {
    // Excluir administradores - solo mostrar clientes
    if (user.role === 'admin') return false;
    
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  // Ordenar usuarios según el criterio de pago seleccionado
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (paymentSortOrder === 'default') {
      return 0; // Mantener orden original
    }
    
    const getPaymentStatus = (userId: string) => {
      return parseInt(userId.slice(-1), 16) % 2 === 0 ? 'pendiente' : 'pagado';
    };
    
    const statusA = getPaymentStatus(a.id);
    const statusB = getPaymentStatus(b.id);
    
    if (paymentSortOrder === 'pendiente_first') {
      // Los pendientes primero
      if (statusA === 'pendiente' && statusB === 'pagado') return -1;
      if (statusA === 'pagado' && statusB === 'pendiente') return 1;
      return 0;
    } else if (paymentSortOrder === 'pagado_first') {
      // Los pagados primero
      if (statusA === 'pagado' && statusB === 'pendiente') return -1;
      if (statusA === 'pendiente' && statusB === 'pagado') return 1;
      return 0;
    }
    
    return 0;
  });


  // Función para alternar ordenamiento por pago
  const togglePaymentSort = () => {
    if (paymentSortOrder === 'default') {
      setPaymentSortOrder('pendiente_first');
    } else if (paymentSortOrder === 'pendiente_first') {
      setPaymentSortOrder('pagado_first');
    } else {
      setPaymentSortOrder('default');
    }
  };

  // Cambiar rol de usuario
  const handleRoleChange = async (userId: string, newRole: 'client' | 'admin') => {
    const loadingToast = showLoading('Cambiando rol de usuario...');
    
    const result = await changeUserRole(userId, newRole);
    
    dismissToast(loadingToast);
    
    if (result.success) {
      showSuccess('Rol actualizado', 'El rol del usuario ha sido cambiado exitosamente');
    } else {
      showError('Error al cambiar rol', result.error || 'No se pudo cambiar el rol');
    }
  };

  // Bloquear scroll del body cuando el popup de detalles está abierto
  useEffect(() => {
    if (showUserDetails) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [showUserDetails]);

  // Determinar si el mes seleccionado es el mes actual
  const isCurrentMonth = () => {
    const now = new Date();
    return selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;
  };

  // Cargar cuotas del periodo seleccionado y mapear por usuario
  useEffect(() => {
    (async () => {

      // No recargar si hay una actualización de pago en progreso o si se debe saltar
      if (isUpdatingPayment || skipNextReload.current) {
        return;
      }
      
      // Solo cargar ausencias del admin si es necesario
      if (ausenciasAdmin.length === 0) {
        await cargarAusenciasAdmin();
      }
      
      // Cargar cuotas desde la base de datos
      const cuotas = await fetchCuotasMensuales(selectedYear, selectedMonth);
      
      // Si no hay cuotas, no procesar
      if (cuotas.length === 0) {
        setBalanceRows([]);
        setBalanceTotals({ totalAbonado: 0, totalPendiente: 0 });
        return;
      }
      
      // Construir filas para Balance usando datos de la BD
      const rows: Array<{ usuario_id: string; nombre: string; email: string; monto: number; montoOriginal: number; estado: 'pendiente'|'abonada'|'vencida'; descuento: number; tipoPago: 'transferencia' | 'efectivo' }> = [];
      let totalAbonado = 0;
      let totalPendiente = 0;
      
      // Procesar cada cuota de la base de datos
      for (const cuota of cuotas) {
        const usuario = allUsers.find(u => u.id === cuota.usuario_id);
        if (!usuario) continue;
        
        const nombre = usuario.first_name || usuario.last_name ? 
          `${usuario.first_name || ''} ${usuario.last_name || ''}`.trim() : 
          (usuario.full_name || usuario.email);
        const email = usuario.email || '';
        
        const montoOriginal = Number(cuota.monto_total) || 0;
        const descuentoPorcentaje = Number(cuota.descuento_porcentaje) || 0;
        const montoConDescuento = Number(cuota.monto_con_descuento) || montoOriginal;
        const estado = (cuota.estado_pago as any) || 'pendiente';
        const tipoPago = tipoPagoMap[cuota.usuario_id] || 'transferencia';
        
        rows.push({ 
          usuario_id: cuota.usuario_id, 
          nombre, 
          email, 
          monto: montoConDescuento, 
          montoOriginal,
          estado, 
          descuento: descuentoPorcentaje,
          tipoPago
        });
        
        if (estado === 'abonada') totalAbonado += montoConDescuento; 
        else totalPendiente += montoConDescuento;
      }
      
      // Ordenar filas alfabéticamente por nombre
      rows.sort((a, b) => {
        const nombreA = a.nombre.toLowerCase().trim();
        const nombreB = b.nombre.toLowerCase().trim();
        return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
      });
      
      setBalanceRows(rows);
      setBalanceTotals({ totalAbonado, totalPendiente });
    })();
  }, [selectedYear, selectedMonth, allUsers, tipoPagoMap, fetchCuotasMensuales]);

  // Estado popup confirmación eliminar usuario
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Abrir confirmación
  const requestDeleteUser = (userId: string, userName: string) => {
    setDeleteTarget({ id: userId, name: userName });
    setConfirmDeleteOpen(true);
  };

  // Confirmar eliminación
  const handleConfirmDeleteUser = async () => {
    if (!deleteTarget) return;
      const loadingToast = showLoading('Desactivando usuario...');
    const result = await deleteUser(deleteTarget.id);
    dismissToast(loadingToast);
    if (result.success) {
      showSuccess('Usuario desactivado', 'El usuario quedará inactivo a partir del próximo mes');
      setConfirmDeleteOpen(false);
      setDeleteTarget(null);
    } else {
      showError('Error al eliminar usuario', result.error || 'No se pudo eliminar el usuario');
    }
  };

  // Cargar historial de pagos de un usuario
  const loadUserHistory = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('cuotas_mensuales')
        .select('anio, mes, monto_total, estado_pago')
        .eq('usuario_id', userId)
        .order('anio', { ascending: false })
        .order('mes', { ascending: false });

      if (error) {
        console.error('Error cargando historial:', error);
        return;
      }

      const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const history = (data || []).map(d => ({
        anio: d.anio,
        mes: mesesNombres[d.mes - 1] || d.mes.toString(),
        monto: Number(d.monto_total) || 0,
        estado: d.estado_pago === 'abonada' ? 'Abonado' : d.estado_pago === 'vencida' ? 'Vencido' : 'Pendiente'
      }));

      setUserHistory(history);
    } catch (err) {
      console.error('Error inesperado:', err);
    }
  };

  // Efecto para cargar historial cuando se selecciona un usuario
  useEffect(() => {
    if (selectedUserForHistory && showHistoryModal) {
      loadUserHistory(selectedUserForHistory);
    }
  }, [selectedUserForHistory, showHistoryModal]);

  // Si está cargando o no hay usuario, mostrar spinner
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold mb-2">Verificando permisos...</h2>
          <p className="text-muted-foreground">Comprobando tu rol de administrador.</p>
        </div>
      </div>
    );
  }

  // Mostrar loading mientras se verifica el rol
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Si no es admin, mostrar loading mientras se redirige (el useEffect manejará la redirección)
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      {/* Header */}
      <header className="bg-card border-b shadow-card w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12 md:h-16 w-full">
            {/* Navbar opciones (desktop) centrada */}
            <div className="hidden md:flex flex-1 justify-center items-center gap-8">
              <button onClick={() => handleTabChange('usuarios')} className={`relative px-3 py-2 text-sm transition-colors ${activeTab==='usuarios' ? 'text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                Usuarios
                {activeTab==='usuarios' && <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-0.5 w-8 bg-accent-foreground rounded-full"></span>}
              </button>
              <button onClick={() => handleTabChange('balance')} className={`relative px-3 py-2 text-sm transition-colors ${activeTab==='balance' ? 'text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                Balance
                {activeTab==='balance' && <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-0.5 w-8 bg-accent-foreground rounded-full"></span>}
              </button>
              <button onClick={() => handleTabChange('turnos')} className={`relative px-3 py-2 text-sm transition-colors ${activeTab==='turnos' ? 'text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                Configuración
                {activeTab==='turnos' && <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-0.5 w-8 bg-accent-foreground rounded-full"></span>}
              </button>
              <button onClick={() => handleTabChange('calendario')} className={`relative px-3 py-2 text-sm transition-colors ${activeTab==='calendario' ? 'text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                Agenda
                {activeTab==='calendario' && <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-0.5 w-8 bg-accent-foreground rounded-full"></span>}
              </button>
            </div>
            
            {/* Espacio vacío en mobile para empujar el botón a la derecha */}
            <div className="md:hidden flex-1"></div>
            
            {/* Botón de cerrar sesión - visible en desktop y mobile */}
            <div className="flex items-center flex-shrink-0">
              <Button
                variant="ghost"
                className="relative h-10 w-10 p-0 hover:bg-muted transition-colors flex-shrink-0"
                onClick={() => setShowLogoutConfirm(true)}
              >
                <LogOut className="h-6 w-6 text-accent-foreground" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Espaciado superior solo para desktop entre navbar y barra superior */}
      <div className="hidden sm:block h-4" />

      {/* Dialog de confirmación de cerrar sesión (Admin) */}
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
              onClick={async () => { setShowLogoutConfirm(false); await signOut(); navigate('/login'); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm m-0 w-full sm:flex-1"
            >
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="w-full max-w-full px-4 pb-4 md:pb-8 mx-auto">
        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full max-w-full">
          {/* Tabs Desktop - oculto en móvil */}
          <div className="hidden md:block w-full max-w-full overflow-x-auto mb-6">
              
          </div>




          {/* Tab de Usuarios */}
          <TabsContent value="usuarios" className="mt-6 w-full max-w-full pb-20 md:pb-8">

              {/* Búsqueda */}
            <div className="mb-6">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-users"
                  name="search-users"
                  placeholder="Buscar usuario por nombre"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full placeholder:text-[10px] sm:placeholder:text-sm"
                />
              </div>
            </div>


            {/* Users Table */}
            <Card className="w-full max-w-full">
              <CardContent className="p-0 w-full max-w-full">
                {/* Vista de escritorio - Tabla completa */}
                <div className="hidden md:block overflow-x-auto w-full max-w-full">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium min-w-[180px]">Usuario</th>
                        <th className="text-left p-3 font-medium min-w-[140px]">Asistencia</th>
                        <th className="text-left p-3 font-medium min-w-[200px]">Horarios</th>
                        <th className="text-left p-3 font-medium min-w-[140px]">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedUsers
                        .filter(u => !(u.email || '').toLowerCase().includes('test'))
                        .map((user) => {
                        const diasAsistencia = getDiasAsistencia(user.id);
                        
                        return (
                          <tr key={user.id} className="border-b hover:bg-muted/50">
                            <td className="p-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`font-medium truncate ${user.is_active === false ? 'text-muted-foreground line-through' : ''}`}>
                                    {getDisplayFullName(user)}
                                  </p>
                                  {user.is_active === false && (
                                    <Badge variant="secondary" className="text-xs">
                                      Inactivo
                                    </Badge>
                                  )}
                                  {user.fecha_desactivacion && user.fecha_desactivacion > new Date().toISOString().split('T')[0] && (
                                    <Badge variant="outline" className="text-xs">
                                      Se desactiva: {new Date(user.fecha_desactivacion as string).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <p className="text-sm text-muted-foreground">{diasAsistencia}</p>
                            </td>
                            <td className="p-3">
                              {(() => {
                                const horarios = getHorariosUsuario(user.id);
                                if (horarios.length === 0) {
                                  return <span className="text-sm text-muted-foreground">—</span>;
                                }
                                return (
                                  <div className="flex flex-wrap gap-1.5">
                                    {horarios.map((horario, idx) => {
                                      const horaFormateada = formatHora(horario.hora_inicio);
                                      return (
                                        <Badge 
                                          key={idx} 
                                          variant="outline" 
                                          className="text-xs px-2 py-0.5"
                                        >
                                          {horaFormateada}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-start">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <span className="sr-only">Abrir menú</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { 
                                    setSelectedUser(user); 
                                    setShowUserDetails(true); 
                                  }}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Ver Detalles
                                  </DropdownMenuItem>
                                  {/* Acciones de cambio de rol deshabilitadas por requerimiento */}
                                  
                                    <DropdownMenuItem
                                    onClick={() => requestDeleteUser(user.id, getDisplayFullName(user))}
                                    className="text-red-600"
                                    disabled={user.is_active === false}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    {user.is_active === false ? 'Usuario Inactivo' : 'Desactivar Usuario'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Vista móvil - Lista con scroll horizontal */}
                <div className="md:hidden overflow-x-auto w-full">
                  <div className="min-w-[600px]">
                    {/* Encabezados de columna */}
                    <div className="flex items-center px-4 py-2 border-b bg-muted/30 gap-4">
                      <div className="flex-1 min-w-[180px]">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Nombre</p>
                      </div>
                      <div className="flex-1 text-center min-w-[120px]">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Asistencia</p>
                      </div>
                      <div className="flex-1 text-center min-w-[150px]">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Horarios</p>
                      </div>
                    </div>
                    
                    {/* Lista de usuarios */}
                    <div className="divide-y">
                      {sortedUsers
                        .filter(u => !(u.email || '').toLowerCase().includes('test'))
                        .map((user) => {
                        const diasAsistencia = getDiasAsistencia(user.id);
                        const horarios = getHorariosUsuario(user.id);
                        
                        return (
                          <div 
                            key={user.id} 
                            className="flex items-center py-3 px-4 hover:bg-muted/50 transition-colors cursor-pointer gap-4"
                            onClick={() => { 
                              setSelectedUser(user);
                              setShowUserDetails(true);
                            }}
                          >
                            <div className="min-w-0 flex-1 min-w-[180px]">
                              <p className="truncate text-xs text-muted-foreground">{getDisplayFullName(user)}</p>
                            </div>
                            <div className="flex-1 text-center min-w-[120px]">
                              <p className="text-[10px] text-muted-foreground">{diasAsistencia}</p>
                            </div>
                            <div className="flex-1 text-center min-w-[150px]">
                              {horarios.length === 0 ? (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-0.5 justify-center">
                                  {horarios.map((horario, idx) => {
                                    const horaFormateada = formatHora(horario.hora_inicio);
                                    return (
                                      <Badge 
                                        key={idx} 
                                        variant="outline" 
                                        className="text-[9px] px-1 py-0"
                                      >
                                        {horaFormateada}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Tabla vacía sin mensajes cuando no hay usuarios */}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Balance */}
          <TabsContent value="balance" className="mt-6 w-full max-w-full pb-20 md:pb-8">
            <div className="mb-6 flex items-center justify-end gap-2">
              <Select value={String(selectedMonth)} onValueChange={(v)=>setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-[120px] h-8 md:h-9 text-[11px] md:text-sm"><SelectValue placeholder="Mes" /></SelectTrigger>
                <SelectContent className="max-h-[200px] md:max-h-none">
                  <SelectItem value="1" className="text-[11px] md:text-sm py-1.5 md:py-2">Enero</SelectItem>
                  <SelectItem value="2" className="text-[11px] md:text-sm py-1.5 md:py-2">Febrero</SelectItem>
                  <SelectItem value="3" className="text-[11px] md:text-sm py-1.5 md:py-2">Marzo</SelectItem>
                  <SelectItem value="4" className="text-[11px] md:text-sm py-1.5 md:py-2">Abril</SelectItem>
                  <SelectItem value="5" className="text-[11px] md:text-sm py-1.5 md:py-2">Mayo</SelectItem>
                  <SelectItem value="6" className="text-[11px] md:text-sm py-1.5 md:py-2">Junio</SelectItem>
                  <SelectItem value="7" className="text-[11px] md:text-sm py-1.5 md:py-2">Julio</SelectItem>
                  <SelectItem value="8" className="text-[11px] md:text-sm py-1.5 md:py-2">Agosto</SelectItem>
                  <SelectItem value="9" className="text-[11px] md:text-sm py-1.5 md:py-2">Septiembre</SelectItem>
                  <SelectItem value="10" className="text-[11px] md:text-sm py-1.5 md:py-2">Octubre</SelectItem>
                  <SelectItem value="11" className="text-[11px] md:text-sm py-1.5 md:py-2">Noviembre</SelectItem>
                  <SelectItem value="12" className="text-[11px] md:text-sm py-1.5 md:py-2">Diciembre</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={(v)=>setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-[100px] h-8 md:h-9 text-[11px] md:text-sm"><SelectValue placeholder="Año" /></SelectTrigger>
                <SelectContent className="max-h-[200px] md:max-h-none">
                  <SelectItem value={String(new Date().getFullYear()-1)} className="text-[11px] md:text-sm py-1.5 md:py-2">{String(new Date().getFullYear()-1)}</SelectItem>
                  <SelectItem value={String(new Date().getFullYear())} className="text-[11px] md:text-sm py-1.5 md:py-2">{String(new Date().getFullYear())}</SelectItem>
                  <SelectItem value={String(new Date().getFullYear()+1)} className="text-[11px] md:text-sm py-1.5 md:py-2">{String(new Date().getFullYear()+1)}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* KPIs - Mobile: una sola card con divisores */}
            <div className="sm:hidden mb-6">
              <Card className="p-3">
                <div className="flex items-center justify-between pb-3 border-b">
                  <div className="text-xs text-muted-foreground">Total a recibir</div>
                  <div className="text-sm font-semibold">${(balanceTotals.totalAbonado + balanceTotals.totalPendiente).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="text-xs text-muted-foreground">Recibido</div>
                  <div className="text-sm font-semibold">${balanceTotals.totalAbonado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                </div>
                <div className="flex items-center justify-between pt-3">
                  <div className="text-xs text-muted-foreground">Pendiente</div>
                  <div className="text-sm font-semibold">${balanceTotals.totalPendiente.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                </div>
              </Card>
            </div>

            {/* KPIs - Desktop: 3 cards separadas */}
            <div className="hidden sm:grid sm:grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Monto total a recibir</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-semibold">${(balanceTotals.totalAbonado + balanceTotals.totalPendiente).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Monto recibido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">${balanceTotals.totalAbonado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Pendiente de cobro</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">${balanceTotals.totalPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </CardContent>
              </Card>
            </div>

            {/* Tabla detalle por usuario */}
            <Card className="w-full max-w-full">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium text-xs md:text-sm min-w-[180px]">Usuario</th>
                        <th className="text-left p-3 font-medium text-xs md:text-sm min-w-[120px]">Cuota</th>
                        <th className="text-left p-3 font-medium text-xs md:text-sm min-w-[140px]">Estado de pago</th>
                        <th className="text-left p-3 font-medium text-xs md:text-sm min-w-[120px]">Descuento</th>
                        <th className="text-left p-3 font-medium text-xs md:text-sm min-w-[140px]">Tipo de Pago</th>
                        <th className="text-left p-3 font-medium text-xs md:text-sm min-w-[100px]">Historial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanceRows.map(row => (
                        <tr key={row.usuario_id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <p className="font-light md:font-medium truncate text-xs md:text-base">{row.nombre}</p>
                          </td>
                          <td className="p-3">
                            {row.descuento > 0 ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs md:text-sm text-muted-foreground line-through font-light md:font-normal">
                                  ${row.montoOriginal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-sm md:text-sm font-light md:font-medium text-green-600">
                                  ${row.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm md:text-sm font-light md:font-medium">${row.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {/* Dropdown Debe / No debe (persistiendo en BD) */}
                            <Select
                              value={row.estado === 'abonada' ? 'pagado' : 'pendiente'}
                              onValueChange={async (v) => {
                                setIsUpdatingPayment(true);
                                skipNextReload.current = true; // Evitar que el useEffect se ejecute
                                
                                const nuevoEstadoDb = (v === 'pagado') ? 'abonada' : 'pendiente';
                                
                                try {
                                  const res = await updateCuotaEstadoPago(row.usuario_id, selectedYear, selectedMonth, nuevoEstadoDb as any);
                                  
                                  if (!res.success) {
                                    console.error('Error en updateCuotaEstadoPago:', res.error);
                                    showError(`Error al actualizar el estado de pago: ${res.error || 'Error desconocido'}`);
                                    setIsUpdatingPayment(false);
                                    skipNextReload.current = false;
                                    return;
                                  }
                                  
                                  
                                  // Actualizar solo la fila específica en lugar de recargar toda la lista
                                  setBalanceRows(prevRows => 
                                    prevRows.map(r => 
                                      r.usuario_id === row.usuario_id 
                                        ? { ...r, estado: nuevoEstadoDb }
                                        : r
                                    )
                                  );
                                  
                                  // Actualizar totales
                                  setBalanceTotals(prevTotals => {
                                    const monto = row.monto;
                                    return nuevoEstadoDb === 'abonada' ? {
                                      totalAbonado: prevTotals.totalAbonado + monto,
                                      totalPendiente: prevTotals.totalPendiente - monto
                                    } : {
                                      totalAbonado: prevTotals.totalAbonado - monto,
                                      totalPendiente: prevTotals.totalPendiente + monto
                                    };
                                  });
                                  
                                  showSuccess(`Estado de pago actualizado a ${v === 'pagado' ? 'pagado' : 'pendiente'}`);
                                  
                                  // Resetear los flags después de un delay para asegurar que la BD se sincronizó
                                  // y evitar que el useEffect recargue antes de tiempo
                                  setTimeout(() => {
                                    setIsUpdatingPayment(false);
                                    skipNextReload.current = false;
                                  }, 500);
                                } catch (error) {
                                  console.error('Error inesperado actualizando estado de pago:', error);
                                  showError('Error inesperado al actualizar el estado de pago');
                                  setIsUpdatingPayment(false);
                                  skipNextReload.current = false;
                                }
                              }}
                            >
                              <SelectTrigger className={`w-[130px] h-8 ${row.estado==='abonada' ? 'text-green-600' : 'text-red-600'}`}>
                                <SelectValue placeholder="Estado" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pendiente"><span className="text-red-600">Pendiente</span></SelectItem>
                                <SelectItem value="pagado"><span className="text-green-600">Pagado</span></SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3">
                            {/* Input de Descuento editable */}
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={row.descuento}
                                onChange={async (e) => {
                                  const value = e.target.value;
                                  // Permitir campo vacío mientras se escribe
                                  if (value === '') {
                                    setBalanceRows(prevRows => 
                                      prevRows.map(r => 
                                        r.usuario_id === row.usuario_id 
                                          ? { ...r, descuento: 0 }
                                          : r
                                      )
                                    );
                                    return;
                                  }
                                  
                                  const descuentoNumero = parseFloat(value);
                                  // Validar que sea un número válido entre 0 y 100
                                  if (isNaN(descuentoNumero) || descuentoNumero < 0 || descuentoNumero > 100) {
                                    return;
                                  }
                                  
                                  // Actualizar estado local inmediatamente para mejor UX
                                  setBalanceRows(prevRows => 
                                    prevRows.map(r => 
                                      r.usuario_id === row.usuario_id 
                                        ? { ...r, descuento: descuentoNumero }
                                        : r
                                    )
                                  );
                                }}
                                onBlur={async (e) => {
                                  const value = e.target.value;
                                  if (value === '') {
                                    // Si está vacío, establecer a 0
                                    const res = await updateCuotaDescuento(row.usuario_id, selectedYear, selectedMonth, 0);
                                    if (res.success) {
                                      const cuotas = await fetchCuotasMensuales(selectedYear, selectedMonth);
                                      const rows: Array<{ usuario_id: string; nombre: string; email: string; monto: number; montoOriginal: number; estado: 'pendiente'|'abonada'|'vencida'; descuento: number; tipoPago: 'transferencia' | 'efectivo' }> = [];
                                      let totalAbonado = 0;
                                      let totalPendiente = 0;
                                      for (const c of cuotas) {
                                        const u = allUsers.find(u => u.id === c.usuario_id);
                                        const nombre = u ? (u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : (u.full_name || u.email)) : c.usuario_id;
                                        const email = u?.email || '';
                                        const montoOriginal = Number(c.monto_total) || 0;
                                        const descuentoPorcentaje = Number(c.descuento_porcentaje) || 0;
                                        const montoConDescuento = Number(c.monto_con_descuento) || montoOriginal;
                                        const estado = (c.estado_pago as any) || 'pendiente';
                                        const tipoPago = tipoPagoMap[c.usuario_id] || 'transferencia';
                                        rows.push({ 
                                          usuario_id: c.usuario_id, 
                                          nombre, 
                                          email, 
                                          monto: montoConDescuento, 
                                          montoOriginal,
                                          estado, 
                                          descuento: descuentoPorcentaje,
                                          tipoPago
                                        });
                                        if (estado === 'abonada') totalAbonado += montoConDescuento; else totalPendiente += montoConDescuento;
                                      }
                                      
                                      // Ordenar filas alfabéticamente por nombre
                                      rows.sort((a, b) => {
                                        const nombreA = a.nombre.toLowerCase().trim();
                                        const nombreB = b.nombre.toLowerCase().trim();
                                        return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
                                      });
                                      
                                      setBalanceRows(rows);
                                      setBalanceTotals({ totalAbonado, totalPendiente });
                                    }
                                    return;
                                  }
                                  
                                  const descuentoNumero = parseFloat(value);
                                  if (isNaN(descuentoNumero) || descuentoNumero < 0 || descuentoNumero > 100) {
                                    // Si el valor es inválido, restaurar el valor original
                                    setBalanceRows(prevRows => 
                                      prevRows.map(r => 
                                        r.usuario_id === row.usuario_id 
                                          ? { ...r, descuento: row.descuento }
                                          : r
                                      )
                                    );
                                    return;
                                  }
                                  
                                  // Persistir en BD cuando se pierde el foco
                                  const res = await updateCuotaDescuento(row.usuario_id, selectedYear, selectedMonth, descuentoNumero);
                                  if (res.success) {
                                    // Recargar cuotas para reflejar los cambios
                                    const cuotas = await fetchCuotasMensuales(selectedYear, selectedMonth);
                                    const rows: Array<{ usuario_id: string; nombre: string; email: string; monto: number; montoOriginal: number; estado: 'pendiente'|'abonada'|'vencida'; descuento: number; tipoPago: 'transferencia' | 'efectivo' }> = [];
                                    let totalAbonado = 0;
                                    let totalPendiente = 0;
                                    for (const c of cuotas) {
                                      const u = allUsers.find(u => u.id === c.usuario_id);
                                      const nombre = u ? (u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : (u.full_name || u.email)) : c.usuario_id;
                                      const email = u?.email || '';
                                      const montoOriginal = Number(c.monto_total) || 0;
                                      const descuentoPorcentaje = Number(c.descuento_porcentaje) || 0;
                                      const montoConDescuento = Number(c.monto_con_descuento) || montoOriginal;
                                      const estado = (c.estado_pago as any) || 'pendiente';
                                      const tipoPago = tipoPagoMap[c.usuario_id] || 'transferencia';
                                      rows.push({ 
                                        usuario_id: c.usuario_id, 
                                        nombre, 
                                        email, 
                                        monto: montoConDescuento, 
                                        montoOriginal,
                                        estado, 
                                        descuento: descuentoPorcentaje,
                                        tipoPago
                                      });
                                      if (estado === 'abonada') totalAbonado += montoConDescuento; else totalPendiente += montoConDescuento;
                                    }
                                    
                                    // Ordenar filas alfabéticamente por nombre
                                    rows.sort((a, b) => {
                                      const nombreA = a.nombre.toLowerCase().trim();
                                      const nombreB = b.nombre.toLowerCase().trim();
                                      return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
                                    });
                                    
                                    setBalanceRows(rows);
                                    setBalanceTotals({ totalAbonado, totalPendiente });
                                    showSuccess('Descuento aplicado', `Se aplicó un ${descuentoNumero}% de descuento`);
                                  } else {
                                    showError('Error', 'No se pudo aplicar el descuento');
                                    // Restaurar el valor original en caso de error
                                    setBalanceRows(prevRows => 
                                      prevRows.map(r => 
                                        r.usuario_id === row.usuario_id 
                                          ? { ...r, descuento: row.descuento }
                                          : r
                                      )
                                    );
                                  }
                                }}
                                className="w-[100px] h-8 text-center"
                                placeholder="0"
                              />
                              <span className="text-sm text-muted-foreground">%</span>
                            </div>
                          </td>
                          <td className="p-3">
                            {/* Dropdown Tipo de Pago - Solo indicador visual */}
                            <Select
                              value={row.tipoPago || 'transferencia'}
                              onValueChange={(v) => {
                                const tipoPago = v as 'transferencia' | 'efectivo';
                                // Actualizar solo en estado local (no se persiste en BD)
                                setTipoPago(row.usuario_id, tipoPago);
                                setBalanceRows(prevRows => 
                                  prevRows.map(r => 
                                    r.usuario_id === row.usuario_id 
                                      ? { ...r, tipoPago }
                                      : r
                                  )
                                );
                              }}
                            >
                              <SelectTrigger className="w-[140px] h-8">
                                <SelectValue placeholder="Tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="transferencia">Transferencia</SelectItem>
                                <SelectItem value="efectivo">Efectivo</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUserForHistory(row.usuario_id);
                                setShowHistoryModal(true);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Gestión de Turnos */}
          <TabsContent value="turnos" className="mt-6 w-full max-w-full pb-20 md:pb-8">
            <TurnoManagement />
          </TabsContent>

          {/* Tab de Calendario */}
          <TabsContent value="calendario" className="mt-6 w-full max-w-full pb-20 md:pb-8">
            <div className="mb-4 flex justify-end">
              <Button 
                onClick={() => {
                  setFechaSeleccionadaFeriado(null);
                  setShowFeriadosModal(true);
                }}
                className="bg-white text-gray-900 hover:bg-gray-100 border border-white"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Gestionar feriados
              </Button>
            </div>
            <CalendarView 
              isAdminView={true}
              onDateLongPress={(date) => {
                // Verificar que la fecha sea futura (después de hoy)
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                const fechaComparar = new Date(date);
                fechaComparar.setHours(0, 0, 0, 0);
                
                // Solo permitir configurar feriados/fin de semana para fechas futuras
                if (fechaComparar <= hoy) {
                  return;
                }
                
                // Detectar si es fin de semana (sábado=6, domingo=0)
                const diaSemana = date.getDay();
                const esFinSemana = diaSemana === 0 || diaSemana === 6;
                
                if (esFinSemana) {
                  setFechaSeleccionadaFinSemana(date);
                  setShowFinSemanaModal(true);
                } else {
                  setFechaSeleccionadaFeriado(date);
                  setShowFeriadosModal(true);
                }
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* User Details Modal */}
      {showUserDetails && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overscroll-contain">
          <Card className="relative w-full max-w-md max-h-[85vh] overflow-hidden">
            <button
              type="button"
              onClick={() => { 
                setShowUserDetails(false); 
              }}
              aria-label="Cerrar"
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <CardContent className="space-y-4 overflow-y-auto max-h-[65vh] px-2 overscroll-contain">
              <div className="text-center pt-1">
                <h3 className="text-[17px] font-semibold">Detalles de usuario</h3>
              </div>
              <div>
                <label className="text-sm font-medium">Nombre Completo</label>
                <p className="text-sm text-muted-foreground">{getDisplayFullName(selectedUser)}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Teléfono</label>
                <p className="text-sm text-muted-foreground">
                  {(selectedUser.phone || '').toString().trim() || 'No especificado'}
                </p>
              </div>
              

              
              <div>
                <label className="text-sm font-medium">Días de Asistencia</label>
                {(() => {
                    if (!selectedUser || !selectedUser.horarios_recurrentes || selectedUser.horarios_recurrentes.length === 0) {
                      return <p className="text-sm text-muted-foreground">Sin horarios recurrentes configurados</p>;
                    }
                    
                    // Extraer todos los días únicos de todos los horarios
                    const diasSet = new Set<string>();
                    for (const h of selectedUser.horarios_recurrentes) {
                      if (h.dias_semana && Array.isArray(h.dias_semana)) {
                        h.dias_semana.forEach(dia => diasSet.add(dia));
                      }
                    }
                    
                    if (diasSet.size === 0) {
                      return <p className="text-sm text-muted-foreground">Sin horarios recurrentes configurados</p>;
                    }
                    
                    // Mapear días de texto a números para ordenar
                    const diaMap: Record<string, number> = {
                      'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 
                      'Viernes': 5, 'Sábado': 6, 'Domingo': 7
                    };
                    
                    const dias = Array.from(diasSet)
                      .map(dia => diaMap[dia] || 0)
                      .filter(d => d !== 0)
                      .sort((a, b) => a - b);
                    
                    return (
                      <div className="flex flex-wrap gap-2">
                        {dias.map(d => (
                          <span key={d} className="px-2 py-1 rounded bg-muted text-sm">
                            {getDiaCorto(d)}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmación eliminar usuario */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="w-[85vw] sm:w-[380px] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas desactivar a {deleteTarget?.name || 'este usuario'}?
              El usuario quedará inactivo a partir del mes siguiente. Sus datos históricos se mantendrán, pero no podrá realizar nuevas reservas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:flex-1">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteUser} className="w-full sm:flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Historial de Usuario */}
      {showHistoryModal && selectedUserForHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">
                Historial de Balance - {balanceRows.find(r => r.usuario_id === selectedUserForHistory)?.nombre || 'Usuario'}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedUserForHistory(null);
                  setUserHistory([]);
                }}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[60vh]">
              {userHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hay historial de pagos para este usuario.</p>
              ) : (
                <div className="space-y-3">
                  {userHistory.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium">{item.mes} {item.anio}</p>
                        <p className="text-sm text-muted-foreground">
                          ${item.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <span className={`text-sm font-medium ${
                          item.estado === 'Abonado' ? 'text-green-600' : 
                          item.estado === 'Vencido' ? 'text-red-600' : 
                          'text-muted-foreground'
                        }`}>
                          {item.estado}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navbar Mobile - fija en bottom, solo visible en móvil */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
        <div className="grid grid-cols-4 h-16">
          <button
            onClick={() => handleTabChange('usuarios')}
            className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
              activeTab === 'usuarios' ? 'text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-[10px] font-medium">Usuarios</span>
          </button>
          
          <button
            onClick={() => handleTabChange('balance')}
            className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
              activeTab === 'balance' ? 'text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wallet className="h-5 w-5" />
            <span className="text-[10px] font-medium">Balance</span>
          </button>
          
          <button
            onClick={() => handleTabChange('turnos')}
            className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
              activeTab === 'turnos' ? 'text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[10px] font-medium">Config</span>
          </button>
          
          <button
            onClick={() => handleTabChange('calendario')}
            className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
              activeTab === 'calendario' ? 'text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="h-5 w-5" />
            <span className="text-[10px] font-medium">Agenda</span>
          </button>
        </div>
      </nav>

      {/* Modal de Configuración de Feriados */}
      <FeriadosConfigModal
        open={showFeriadosModal}
        onClose={() => {
          setShowFeriadosModal(false);
          setFechaSeleccionadaFeriado(null);
        }}
        fechaSeleccionada={fechaSeleccionadaFeriado}
        onFeriadoGuardado={() => {
          // Recargar datos si es necesario
        }}
      />

      {/* Modal de Configuración de Fin de Semana */}
      <FinSemanaConfigModal
        open={showFinSemanaModal}
        onClose={() => {
          setShowFinSemanaModal(false);
          setFechaSeleccionadaFinSemana(null);
        }}
        fechaSeleccionada={fechaSeleccionadaFinSemana}
        onFinSemanaGuardado={() => {
          // Recargar datos si es necesario
        }}
      />

    </div>
  );
}

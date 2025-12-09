import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: 'client' | 'admin';
  created_at: string;
  is_active?: boolean;
  horarios_recurrentes?: {
    turno_nombre: string;
    dias_semana: string[];
  }[];
}

const DIA_SEMANA_MAP: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const DIA_SEMANA_NOMBRE_MAP: Record<string, number> = Object.entries(DIA_SEMANA_MAP).reduce(
  (acc, [numero, nombre]) => {
    acc[nombre] = Number(numero);
    return acc;
  },
  {} as Record<string, number>
);

export const useAdmin = () => {
  const { user } = useAuthContext();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  // Estado de periodo (mes/año) compartido para Usuarios
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1..12

  // Caché para verificación de admin (evitar recargas innecesarias)
  const adminCheckCacheRef = useRef<{ userId: string | null; isAdmin: boolean | null; timestamp: number }>({ 
    userId: null, 
    isAdmin: null, 
    timestamp: 0 
  });
  const ADMIN_CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutos en caché

  // Utilidad de ocultamiento local (soft-delete en interfaz)
  const getHiddenUserIds = (): string[] => {
    try {
      const raw = localStorage.getItem('adminHiddenUsers');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const addHiddenUserId = (id: string) => {
    const curr = new Set(getHiddenUserIds());
    curr.add(id);
    localStorage.setItem('adminHiddenUsers', JSON.stringify(Array.from(curr)));
  };

  // Verificar si el usuario actual es administrador (con caché)
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        adminCheckCacheRef.current = { userId: null, isAdmin: false, timestamp: 0 };
        return;
      }

      const now = Date.now();
      const cached = adminCheckCacheRef.current;
      
      // Si ya tenemos un resultado en caché para este usuario y no ha expirado, usar caché
      if (cached.userId === user.id && cached.isAdmin !== null && (now - cached.timestamp) < ADMIN_CACHE_DURATION_MS) {
        setIsAdmin(cached.isAdmin);
        setIsLoading(false);
        return;
      }

      try {
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session || !session?.user) {
          console.warn('⚠️ Problema con sesión, usando fallback por email');
          const isAdminByEmail = checkAdminByEmail(user.email || '');
          setIsAdmin(isAdminByEmail);
          adminCheckCacheRef.current = { userId: user.id, isAdmin: isAdminByEmail, timestamp: Date.now() };
          setIsLoading(false);
          return;
        }
        
        console.log('✅ Sesión activa:', session.user.email);

        // Intentar consulta por ID
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, role, created_at')
          .eq('id', user.id)
          .single();


        // Si falla por ID, intentar por email
        if (error && user.email) {
          const { data: emailData, error: emailError } = await supabase
            .from('profiles')
            .select('id, email, role, created_at')
            .eq('email', user.email)
            .single();


          if (!emailError && emailData) {
            const isUserAdmin = emailData.role === 'admin';
            console.log('✅ Rol obtenido por email:', emailData.role, '-> isAdmin:', isUserAdmin);
            setIsAdmin(isUserAdmin);
            adminCheckCacheRef.current = { userId: user.id, isAdmin: isUserAdmin, timestamp: Date.now() };
          } else {
            console.error('❌ Error en ambas consultas:', { error, emailError });
            // Fallback: verificar admin por email (SIEMPRE usar fallback si las consultas fallan)
            const isAdminByEmail = checkAdminByEmail(user.email || '');
            console.log('⚠️ Usando fallback checkAdminByEmail:', user.email, '-> isAdmin:', isAdminByEmail);
            setIsAdmin(isAdminByEmail);
            adminCheckCacheRef.current = { userId: user.id, isAdmin: isAdminByEmail, timestamp: Date.now() };
          }
        } else if (!error && data) {
          const isUserAdmin = data.role === 'admin';
          console.log('✅ Rol obtenido por ID:', data.role, '-> isAdmin:', isUserAdmin);
          setIsAdmin(isUserAdmin);
          adminCheckCacheRef.current = { userId: user.id, isAdmin: isUserAdmin, timestamp: Date.now() };
        } else {
          console.error('❌ Error verificando rol de admin:', error);
          // Fallback: verificar admin por email (SIEMPRE usar fallback si hay error)
          const isAdminByEmail = checkAdminByEmail(user.email || '');
          console.log('⚠️ Usando fallback checkAdminByEmail:', user.email, '-> isAdmin:', isAdminByEmail);
          setIsAdmin(isAdminByEmail);
          adminCheckCacheRef.current = { userId: user.id, isAdmin: isAdminByEmail, timestamp: Date.now() };
        }
      } catch (err) {
        console.error('❌ Error inesperado verificando admin:', err);
        // Fallback final: verificar admin por email (SIEMPRE usar fallback en caso de error)
        const isAdminByEmail = checkAdminByEmail(user?.email || '');
        console.log('⚠️ Fallback final checkAdminByEmail:', user?.email, '-> isAdmin:', isAdminByEmail);
        setIsAdmin(isAdminByEmail);
        adminCheckCacheRef.current = { userId: user?.id || null, isAdmin: isAdminByEmail, timestamp: Date.now() };
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  const fetchHorariosRecurrentes = useCallback(async (): Promise<Record<string, Set<string>>> => {
    try {
      const { data, error } = await supabase
        .from('vista_horarios_usuarios')
        .select('usuario_id, dia_semana, activo')
        .eq('activo', true);

      if (error) {
        console.error('❌ Error obteniendo horarios recurrentes:', error);
        return {};
      }

      return (data || []).reduce<Record<string, Set<string>>>((acc, row: any) => {
        const diaNombre = DIA_SEMANA_MAP[row.dia_semana];
        if (!diaNombre) return acc;
        if (!acc[row.usuario_id]) {
          acc[row.usuario_id] = new Set<string>();
        }
        acc[row.usuario_id].add(diaNombre);
        return acc;
      }, {});
    } catch (err) {
      console.error('❌ Error inesperado obteniendo horarios recurrentes:', err);
      return {};
    }
  }, []);

  // Nueva función para obtener horarios con horas de inicio
  const fetchHorariosConHoras = useCallback(async (): Promise<Record<string, Array<{ dia: string; hora_inicio: string }>>> => {
    try {
      const { data, error } = await supabase
        .from('horarios_recurrentes_usuario')
        .select('usuario_id, dia_semana, hora_inicio, activo')
        .eq('activo', true);

      if (error) {
        console.error('❌ Error obteniendo horarios con horas:', error);
        return {};
      }

      return (data || []).reduce<Record<string, Array<{ dia: string; hora_inicio: string }>>>((acc, row: any) => {
        const diaNombre = DIA_SEMANA_MAP[row.dia_semana];
        if (!diaNombre) return acc;
        if (!acc[row.usuario_id]) {
          acc[row.usuario_id] = [];
        }
        acc[row.usuario_id].push({ dia: diaNombre, hora_inicio: row.hora_inicio });
        return acc;
      }, {});
    } catch (err) {
      console.error('❌ Error inesperado obteniendo horarios con horas:', err);
      return {};
    }
  }, []);

  // Obtener todos los usuarios (solo para admins)
  const fetchAllUsers = useCallback(async () => {
    if (!isAdmin) {
      console.warn('⚠️ fetchAllUsers llamado pero isAdmin es false');
      return;
    }
    
    console.log('🔄 Iniciando fetchAllUsers...');
    
    // Verificar sesión antes de hacer la consulta
    const { data: sessionCheck } = await supabase.auth.getSession();
    if (!sessionCheck?.session) {
      console.error('❌ No hay sesión activa al intentar fetchAllUsers');
      setAllUsers([]);
      return;
    }
    console.log('✅ Sesión verificada:', sessionCheck.session.user.email);

    try {
      console.log('📡 Consultando profiles...');
      const [{ data, error }, horariosMap] = await Promise.all([
        supabase
        .from('profiles')
        .select('id, email, role, created_at, full_name, first_name, last_name, phone, is_active, fecha_desactivacion')
        .order('created_at', { ascending: false }),
        fetchHorariosRecurrentes()
      ]);


      if (error) {
        console.error('❌ Error obteniendo usuarios:', error);
        console.error('❌ Detalles del error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        console.error('❌ Esto generalmente indica un problema de RLS o permisos');
        setAllUsers([]);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No se encontraron usuarios en la base de datos');
        console.warn('⚠️ Verifica las políticas RLS en Supabase');
        setAllUsers([]);
        return;
      }
      
      console.log('✅ Usuarios cargados:', data.length);

        const clientes = data.filter(u => u.role === 'client');

      const usersWithHorarios = (data || []).map(user => {
        const diasSet = horariosMap[user.id];
        const diasOrdenados = diasSet ? Array.from(diasSet)
          .sort((a, b) => (DIA_SEMANA_NOMBRE_MAP[a] ?? 99) - (DIA_SEMANA_NOMBRE_MAP[b] ?? 99)) : [];

        return {
          ...user,
          horarios_recurrentes: diasOrdenados.length > 0 ? [{
            turno_nombre: 'Horarios recurrentes',
            dias_semana: diasOrdenados
          }] : []
        };
      });

      // Filtrar usuarios: mostrar todos (activos e inactivos) pero marcar los inactivos
      // Los usuarios inactivos son aquellos con is_active = false O con fecha_desactivacion <= hoy
      const hoy = new Date().toISOString().split('T')[0];
      const usuariosMarcados = usersWithHorarios.map(user => {
        const estaInactivo = user.is_active === false || 
          (user.fecha_desactivacion && user.fecha_desactivacion <= hoy);
        return {
          ...user,
          is_active: !estaInactivo,
          fecha_desactivacion: user.fecha_desactivacion || null
        };
      });
      
      setAllUsers(usuariosMarcados);
    } catch (err) {
      console.error('❌ Error inesperado obteniendo usuarios:', err);
    }
  }, [isAdmin, fetchHorariosRecurrentes]);

  // Lectura de cuotas por mes/año
  const fetchCuotasMensuales = useCallback(async (anio: number, mes: number) => {
    try {
      const { data, error } = await supabase
        .from('cuotas_mensuales')
        .select('usuario_id, anio, mes, clases_previstas, tarifa_unitaria, monto_total, estado_pago, descuento_porcentaje, monto_con_descuento')
        .eq('anio', anio)
        .eq('mes', mes);
      if (error) {
        console.error('Error leyendo cuotas_mensuales:', error);
        return [] as any[];
      }
      return data || [];
    } catch (err) {
      console.error('Error inesperado leyendo cuotas_mensuales:', err);
      return [] as any[];
    }
  }, []);

  // Actualizar estado_pago por usuario (persistir en BD)
  // Si el mes seleccionado es el mes actual, redirige automáticamente al mes siguiente
  const updateCuotaEstadoPago = useCallback(async (usuarioId: string, anio: number, mes: number, estado: 'pendiente' | 'abonada' | 'vencida') => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // Si el mes seleccionado es el mes actual, redirigir al mes siguiente
      let targetAnio = anio;
      let targetMes = mes;
      
      if (anio === currentYear && mes === currentMonth) {
        // Redirigir al mes siguiente
        targetMes = currentMonth === 12 ? 1 : currentMonth + 1;
        targetAnio = currentMonth === 12 ? currentYear + 1 : currentYear;
      }
      
      const { error } = await supabase
        .from('cuotas_mensuales')
        .update({ estado_pago: estado, generado_el: new Date().toISOString() })
        .eq('usuario_id', usuarioId)
        .eq('anio', targetAnio)
        .eq('mes', targetMes);
      if (error) {
        console.error('Error actualizando estado_pago:', error);
        return { success: false, error: error.message, redirected: targetAnio !== anio || targetMes !== mes, targetAnio, targetMes };
      }
      return { success: true, redirected: targetAnio !== anio || targetMes !== mes, targetAnio, targetMes };
    } catch (err) {
      console.error('Error inesperado actualizando estado_pago:', err);
      return { success: false, error: 'Error inesperado' };
    }
  }, []);

  // Actualizar descuento de una cuota mensual
  // Si el mes seleccionado es el mes actual, redirige automáticamente al mes siguiente
  const updateCuotaDescuento = useCallback(async (usuarioId: string, anio: number, mes: number, descuentoPorcentaje: number) => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // Los descuentos SIEMPRE se aplican al mes seleccionado (incluso si es el mes actual)
      // porque son abonos en efectivo que se aplican al mes corriente
      let targetAnio = anio;
      let targetMes = mes;
      
      // Primero obtenemos el monto_total actual (o creamos la cuota si no existe)
      const { data: cuotaActual, error: fetchError } = await supabase
        .from('cuotas_mensuales')
        .select('monto_total')
        .eq('usuario_id', usuarioId)
        .eq('anio', targetAnio)
        .eq('mes', targetMes)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error obteniendo cuota actual:', fetchError);
        return { success: false, error: fetchError.message };
      }

      // Si no existe la cuota, necesitamos obtenerla del mes actual o calcularla
      let montoTotal = 0;
      if (!cuotaActual) {
        // Si es el mes actual y no existe cuota, intentar obtener del mes actual
        if (anio === currentYear && mes === currentMonth) {
          const { data: cuotaActualMes } = await supabase
            .from('cuotas_mensuales')
            .select('monto_total')
            .eq('usuario_id', usuarioId)
            .eq('anio', currentYear)
            .eq('mes', currentMonth)
            .maybeSingle();
          
          if (cuotaActualMes) {
            montoTotal = Number(cuotaActualMes.monto_total) || 0;
          } else {
            // Si no hay cuota, no podemos aplicar descuento
            return { success: false, error: 'No se encontró la cuota para aplicar el descuento' };
          }
        } else {
          // Si no es el mes actual y no existe cuota, no podemos aplicar descuento
          return { success: false, error: 'No se encontró la cuota para aplicar el descuento' };
        }
      } else {
        montoTotal = Number(cuotaActual.monto_total) || 0;
      }

      const montoConDescuento = montoTotal * (1 - descuentoPorcentaje / 100);

      // Actualizamos el descuento y el monto con descuento
      const { error } = await supabase
        .from('cuotas_mensuales')
        .update({ 
          descuento_porcentaje: descuentoPorcentaje,
          monto_con_descuento: montoConDescuento
        })
        .eq('usuario_id', usuarioId)
        .eq('anio', targetAnio)
        .eq('mes', targetMes);

      if (error) {
        console.error('Error actualizando descuento:', error);
        return { success: false, error: error.message };
      }

      // Disparar evento para actualizar el balance del usuario
      window.dispatchEvent(new CustomEvent('balance:refresh'));

      return { success: true };
    } catch (err) {
      console.error('Error inesperado actualizando descuento:', err);
      return { success: false, error: 'Error inesperado' };
    }
  }, []);

  // Obtener solo usuarios administradores
  const fetchAdminUsers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, created_at, full_name, first_name, last_name, phone')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error obteniendo admins:', error);
        return;
      }

      setAdminUsers(data || []);
    } catch (err) {
      console.error('Error inesperado obteniendo admins:', err);
    }
  }, [isAdmin]);

  // Cambiar rol de usuario
  const changeUserRole = async (userId: string, newRole: 'client' | 'admin') => {
    if (!isAdmin) return { success: false, error: 'No tienes permisos de administrador' };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        console.error('Error cambiando rol:', error);
        return { success: false, error: error.message };
      }

      // Actualizar listas locales
      await fetchAllUsers();
      await fetchAdminUsers();

      return { success: true };
    } catch (err) {
      console.error('Error inesperado cambiando rol:', err);
      return { success: false, error: 'Error inesperado' };
    }
  };

  // Desactivar usuario (marcar como inactivo a partir del mes siguiente)
  const deleteUser = async (userId: string) => {
    if (!isAdmin) return { success: false, error: 'No tienes permisos de administrador' };

    try {
      // Calcular el primer día del mes siguiente
      const ahora = new Date();
      const primerDiaMesSiguiente = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
      const fechaDesactivacion = primerDiaMesSiguiente.toISOString().split('T')[0]; // Formato YYYY-MM-DD

      // Actualizar el perfil: establecer fecha de desactivación (el usuario seguirá activo hasta esa fecha)
      const { error } = await supabase
        .from('profiles')
        .update({
          fecha_desactivacion: fechaDesactivacion,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error desactivando usuario:', error);
        return { success: false, error: error.message || 'No se pudo desactivar el usuario' };
      }

      // Recargar listas de usuarios
      await fetchAllUsers();
      await fetchAdminUsers();
      
      return { success: true };
    } catch (err) {
      console.error('Error inesperado desactivando usuario:', err);
      return { success: false, error: 'Error inesperado' };
    }
  };

  // Verificar si un email puede ser configurado como admin
  const canBeAdmin = (email: string): boolean => {
    const adminEmails = [
      'agaru.corp@gmail.com', // ✅ Email admin principal
      'lucasmaldacena@gmail.com' // ✅ Admin recientemente creado
    ];
    return adminEmails.includes(email.toLowerCase());
  };

  // Función de emergencia para verificar admin por email
  const checkAdminByEmail = (email: string): boolean => {
    const adminEmails = [
      'agaru.corp@gmail.com',
      'lucasmaldacena@gmail.com'
    ];
    return adminEmails.includes(email?.toLowerCase() || '');
  };

  // ==================== FUNCIONES DE AUSENCIAS ====================

  // Obtener todas las ausencias activas
  const fetchAusencias = useCallback(async () => {
    if (!isAdmin) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('ausencias_admin')
        .select('*')
        .eq('activo', true)
        .order('fecha_inicio', { ascending: false });

      if (error) {
        console.error('❌ Error obteniendo ausencias:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('❌ Error inesperado obteniendo ausencias:', err);
      return [];
    }
  }, [isAdmin]);

  // Crear ausencia única
  const createAusenciaUnica = useCallback(async (
    fechaInicio: string,
    clasesCanceladas: number[],
    motivo: string | null = null
  ) => {
    if (!isAdmin) {
      return { success: false, error: 'No tienes permisos de administrador' };
    }

    try {
      const { data, error } = await supabase
        .from('ausencias_admin')
        .insert({
          tipo_ausencia: 'unica',
          fecha_inicio: fechaInicio,
          fecha_fin: null,
          clases_canceladas: clasesCanceladas,
          motivo: motivo,
          activo: true
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creando ausencia única:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('❌ Error inesperado creando ausencia única:', err);
      return { success: false, error: 'Error inesperado' };
    }
  }, [isAdmin]);

  // Crear ausencia por período
  const createAusenciaPeriodo = useCallback(async (
    fechaDesde: string,
    fechaHasta: string,
    motivo: string | null = null
  ) => {
    if (!isAdmin) {
      return { success: false, error: 'No tienes permisos de administrador' };
    }

    try {
      const { data, error } = await supabase
        .from('ausencias_admin')
        .insert({
          tipo_ausencia: 'periodo',
          fecha_inicio: fechaDesde,
          fecha_fin: fechaHasta,
          clases_canceladas: null,
          motivo: motivo,
          activo: true
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creando ausencia por período:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('❌ Error inesperado creando ausencia por período:', err);
      return { success: false, error: 'Error inesperado' };
    }
  }, [isAdmin]);

  // Eliminar ausencia
  const deleteAusencia = useCallback(async (ausenciaId: string) => {
    if (!isAdmin) {
      return { success: false, error: 'No tienes permisos de administrador' };
    }

    try {
      const { error } = await supabase
        .from('ausencias_admin')
        .update({ activo: false })
        .eq('id', ausenciaId);

      if (error) {
        console.error('❌ Error eliminando ausencia:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('❌ Error inesperado eliminando ausencia:', err);
      return { success: false, error: 'Error inesperado' };
    }
  }, [isAdmin]);

  return {
    isAdmin,
    isLoading,
    adminUsers,
    allUsers,
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
    fetchAllUsers,
    fetchAdminUsers,
    changeUserRole,
    deleteUser,
    fetchCuotasMensuales,
    updateCuotaEstadoPago,
    updateCuotaDescuento,
    canBeAdmin,
    fetchHorariosConHoras,
    // Funciones de ausencias
    fetchAusencias,
    createAusenciaUnica,
    createAusenciaPeriodo,
    deleteAusencia,
  };
};

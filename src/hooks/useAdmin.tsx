import { useState, useEffect, useCallback } from 'react';
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
  horarios_recurrentes?: {
    turno_nombre: string;
    dias_semana: string[];
  }[];
}

export const useAdmin = () => {
  const { user } = useAuthContext();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  // Estado de periodo (mes/año) compartido para Usuarios
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1..12

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

  // Verificar si el usuario actual es administrador
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data: session, error: sessionError } = await supabase.auth.getSession();

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
            setIsAdmin(isUserAdmin);
          } else {
            console.error('❌ Error en ambas consultas:', { error, emailError });
            // Fallback: verificar admin por email
            const isAdminByEmail = checkAdminByEmail(user.email || '');
            setIsAdmin(isAdminByEmail);
          }
        } else if (!error && data) {
          const isUserAdmin = data.role === 'admin';
          setIsAdmin(isUserAdmin);
        } else {
          console.error('❌ Error verificando rol de admin:', error);
          // Fallback: verificar admin por email
          const isAdminByEmail = checkAdminByEmail(user.email || '');
          setIsAdmin(isAdminByEmail);
        }
      } catch (err) {
        console.error('❌ Error inesperado verificando admin:', err);
        // Fallback final: verificar admin por email
        const isAdminByEmail = checkAdminByEmail(user?.email || '');
        setIsAdmin(isAdminByEmail);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  // Obtener horarios recurrentes de un usuario específico
  const fetchUserHorarios = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('horarios_recurrentes_usuario')
        .select(`
          turno_id,
          dias_semana,
          turnos (
            nombre
          )
        `)
        .eq('usuario_id', userId);

      if (error) {
        console.warn('Error obteniendo horarios:', error.message);
        return [];
      }

      return data?.map(hr => ({
        turno_nombre: (hr.turnos as any)?.nombre || 'Turno sin nombre',
        dias_semana: hr.dias_semana || []
      })) || [];
    } catch (err) {
      console.error('Error inesperado obteniendo horarios:', err);
      return [];
    }
  }, []);

  // Obtener todos los usuarios (solo para admins)
  const fetchAllUsers = useCallback(async () => {
    if (!isAdmin) {
      return;
    }


    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, created_at, full_name, first_name, last_name, phone')
        .order('created_at', { ascending: false });


      if (error) {
        console.error('❌ Error obteniendo usuarios:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No se encontraron usuarios en la base de datos');
        setAllUsers([]);
        return;
      }

        const clientes = data.filter(u => u.role === 'client');

      // Obtener horarios para cada usuario de manera individual
      const usersWithHorarios = await Promise.all(
        (data || []).map(async (user) => {
          const horarios = await fetchUserHorarios(user.id);
          return {
            ...user,
            horarios_recurrentes: horarios
          };
        })
      );

      // Filtrar usuarios ocultos (soft-delete en sistema)
      const hidden = new Set(getHiddenUserIds());
      const visibleUsers = usersWithHorarios.filter(u => !hidden.has(u.id));
      setAllUsers(visibleUsers);
    } catch (err) {
      console.error('❌ Error inesperado obteniendo usuarios:', err);
    }
  }, [isAdmin, fetchUserHorarios]);

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
  const updateCuotaEstadoPago = useCallback(async (usuarioId: string, anio: number, mes: number, estado: 'pendiente' | 'abonada' | 'vencida') => {
    try {
      const { error } = await supabase
        .from('cuotas_mensuales')
        .update({ estado_pago: estado, generado_el: new Date().toISOString() })
        .eq('usuario_id', usuarioId)
        .eq('anio', anio)
        .eq('mes', mes);
      if (error) {
        console.error('Error actualizando estado_pago:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('Error inesperado actualizando estado_pago:', err);
      return { success: false, error: 'Error inesperado' };
    }
  }, []);

  // Actualizar descuento de una cuota mensual
  const updateCuotaDescuento = useCallback(async (usuarioId: string, anio: number, mes: number, descuentoPorcentaje: number) => {
    try {
      // Primero obtenemos el monto_total actual
      const { data: cuotaActual, error: fetchError } = await supabase
        .from('cuotas_mensuales')
        .select('monto_total')
        .eq('usuario_id', usuarioId)
        .eq('anio', anio)
        .eq('mes', mes)
        .single();

      if (fetchError) {
        console.error('Error obteniendo cuota actual:', fetchError);
        return { success: false, error: fetchError.message };
      }

      const montoTotal = Number(cuotaActual.monto_total) || 0;
      const montoConDescuento = montoTotal * (1 - descuentoPorcentaje / 100);

      // Actualizamos el descuento y el monto con descuento
      const { error } = await supabase
        .from('cuotas_mensuales')
        .update({ 
          descuento_porcentaje: descuentoPorcentaje,
          monto_con_descuento: montoConDescuento
        })
        .eq('usuario_id', usuarioId)
        .eq('anio', anio)
        .eq('mes', mes);

      if (error) {
        console.error('Error actualizando descuento:', error);
        return { success: false, error: error.message };
      }

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

  // Eliminar usuario
  const deleteUser = async (userId: string) => {
    if (!isAdmin) return { success: false, error: 'No tienes permisos de administrador' };

    // Soft-delete a nivel de sistema: ocultar en Admin sin tocar la BD
    try {
      addHiddenUserId(userId);
      await fetchAllUsers();
      await fetchAdminUsers();
      return { success: true };
    } catch (err) {
      console.error('Error realizando soft-delete:', err);
      return { success: false, error: 'Error inesperado' };
    }
  };

  // Verificar si un email puede ser configurado como admin
  const canBeAdmin = (email: string): boolean => {
    const adminEmails = [
      'gastondigilio@gmail.com',
      'fede.rz87@gmail.com',
      'agaru.corp@gmail.com' // ✅ Email admin principal
    ];
    return adminEmails.includes(email.toLowerCase());
  };

  // Función de emergencia para verificar admin por email
  const checkAdminByEmail = (email: string): boolean => {
    return email === 'agaru.corp@gmail.com';
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
    // Funciones de ausencias
    fetchAusencias,
    createAusenciaUnica,
    createAusenciaPeriodo,
    deleteAusencia,
  };
};

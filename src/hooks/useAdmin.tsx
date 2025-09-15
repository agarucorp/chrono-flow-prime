import { useState, useEffect } from 'react';
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

  // Verificar si el usuario actual es administrador
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error verificando rol de admin:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data?.role === 'admin');
        }
      } catch (err) {
        console.error('Error inesperado verificando admin:', err);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  // Obtener horarios recurrentes de un usuario específico
  const fetchUserHorarios = async (userId: string) => {
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
  };

  // Obtener todos los usuarios (solo para admins)
  const fetchAllUsers = async () => {
    if (!isAdmin) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, created_at, full_name, first_name, last_name, phone')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error obteniendo usuarios:', error);
        return;
      }

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

      setAllUsers(usersWithHorarios);
    } catch (err) {
      console.error('Error inesperado obteniendo usuarios:', err);
    }
  };

  // Obtener solo usuarios administradores
  const fetchAdminUsers = async () => {
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
  };

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

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error eliminando usuario:', error);
        return { success: false, error: error.message };
      }

      // Actualizar listas locales
      await fetchAllUsers();
      await fetchAdminUsers();

      return { success: true };
    } catch (err) {
      console.error('Error inesperado eliminando usuario:', err);
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

  return {
    isAdmin,
    isLoading,
    adminUsers,
    allUsers,
    fetchAllUsers,
    fetchAdminUsers,
    changeUserRole,
    deleteUser,
    canBeAdmin,
  };
};

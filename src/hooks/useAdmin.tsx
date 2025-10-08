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

  // Verificar si el usuario actual es administrador
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        console.log('❌ No hay usuario autenticado');
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        console.log('🔍 Verificando admin para usuario:', {
          email: user.email,
          id: user.id,
          aud: user.aud,
          role: user.role
        });

        // Verificar primero la sesión de Supabase
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        console.log('📱 Sesión actual:', { session: session.data?.session?.user?.email, error: sessionError });

        // Intentar consulta por ID
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, role, created_at')
          .eq('id', user.id)
          .single();

        console.log('📊 Respuesta de la consulta por ID:', { data, error });

        // Si falla por ID, intentar por email
        if (error && user.email) {
          console.log('🔄 Reintentando consulta por email...');
          const { data: emailData, error: emailError } = await supabase
            .from('profiles')
            .select('id, email, role, created_at')
            .eq('email', user.email)
            .single();

          console.log('📧 Respuesta de la consulta por email:', { data: emailData, error: emailError });

          if (!emailError && emailData) {
            const isUserAdmin = emailData.role === 'admin';
            setIsAdmin(isUserAdmin);
            console.log('✅ Usuario encontrado por email:', emailData);
            console.log('✅ Admin status:', isUserAdmin, 'for user:', user.email);
          } else {
            console.error('❌ Error en ambas consultas:', { error, emailError });
            // Fallback: verificar admin por email
            const isAdminByEmail = checkAdminByEmail(user.email || '');
            setIsAdmin(isAdminByEmail);
            console.log('🔄 Usando verificación por email como fallback:', isAdminByEmail);
          }
        } else if (!error && data) {
          const isUserAdmin = data.role === 'admin';
          setIsAdmin(isUserAdmin);
          console.log('✅ Usuario encontrado por ID:', data);
          console.log('✅ Admin status:', isUserAdmin, 'for user:', user.email);
        } else {
          console.error('❌ Error verificando rol de admin:', error);
          // Fallback: verificar admin por email
          const isAdminByEmail = checkAdminByEmail(user.email || '');
          setIsAdmin(isAdminByEmail);
          console.log('🔄 Usando verificación por email como fallback:', isAdminByEmail);
        }
      } catch (err) {
        console.error('❌ Error inesperado verificando admin:', err);
        // Fallback final: verificar admin por email
        const isAdminByEmail = checkAdminByEmail(user?.email || '');
        setIsAdmin(isAdminByEmail);
        console.log('🔄 Usando verificación por email como fallback final:', isAdminByEmail);
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
      console.log('❌ No se puede obtener usuarios: no eres admin');
      return;
    }

    console.log('🔄 Obteniendo todos los usuarios de Supabase...');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, created_at, full_name, first_name, last_name, phone')
        .order('created_at', { ascending: false });

      console.log('📊 Respuesta de Supabase:', { 
        total: data?.length || 0, 
        error: error?.message,
        usuarios: data 
      });

      if (error) {
        console.error('❌ Error obteniendo usuarios:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No se encontraron usuarios en la base de datos');
        setAllUsers([]);
        return;
      }

      console.log(`✅ Se encontraron ${data.length} usuarios en total`);
      const clientes = data.filter(u => u.role === 'client');
      console.log(`👥 De los cuales ${clientes.length} son clientes`);

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
      console.log('✅ Usuarios cargados exitosamente');
    } catch (err) {
      console.error('❌ Error inesperado obteniendo usuarios:', err);
    }
  }, [isAdmin, fetchUserHorarios]);

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

  // Función de emergencia para verificar admin por email
  const checkAdminByEmail = (email: string): boolean => {
    return email === 'agaru.corp@gmail.com';
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

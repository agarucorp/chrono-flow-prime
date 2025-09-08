import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export const useAdminRedirect = () => {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsChecking(false);
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
          const isUserAdmin = data?.role === 'admin';
          setIsAdmin(isUserAdmin);
          
          // Si es admin, redirigir al panel de admin
          if (isUserAdmin) {
            navigate('/admin');
          }
        }
      } catch (err) {
        console.error('Error inesperado verificando admin:', err);
        setIsAdmin(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAdminStatus();
  }, [user, navigate]);

  return { isAdmin, isChecking };
};

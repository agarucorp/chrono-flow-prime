import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';

export const useFirstTimeUser = () => {
  const { user } = useAuthContext();
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkFirstTimeUser();
    } else {
      setIsFirstTime(null);
      setLoading(false);
    }
  }, [user]);

  const checkFirstTimeUser = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Verificar si el usuario ya tiene horarios recurrentes configurados
      const { data, error } = await supabase
        .from('horarios_recurrentes_usuario')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .limit(1);

      if (error) {
        console.error('Error verificando usuario primerizo:', error);
        // Si la tabla no existe aún, asumir que es primera vez
        if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
          console.log('Tabla horarios_recurrentes_usuario no existe aún, asumiendo primera vez');
          setIsFirstTime(true);
        } else {
          setIsFirstTime(false);
        }
        return;
      }

      // Si no hay horarios recurrentes, es la primera vez
      setIsFirstTime(data.length === 0);
    } catch (error) {
      console.error('Error inesperado:', error);
      // En caso de error, asumir que no es primera vez para evitar bloqueos
      setIsFirstTime(false);
    } finally {
      setLoading(false);
    }
  };

  return { isFirstTime, loading, refetch: checkFirstTimeUser };
};

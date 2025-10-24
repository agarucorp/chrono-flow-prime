import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface TarifaDiaEntrenamiento {
  id: number;
  dias_por_semana: number;
  tarifa_mensual: number;
  moneda: string;
  descripcion: string;
  activo: boolean;
}

export const useTarifasDiasEntrenamiento = () => {
  const [tarifas, setTarifas] = useState<TarifaDiaEntrenamiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTarifas();
  }, []);

  const fetchTarifas = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('tarifas_dias_entrenamiento')
        .select('*')
        .eq('activo', true)
        .order('dias_por_semana', { ascending: true });

      if (fetchError) {
        console.error('Error cargando tarifas:', fetchError);
        setError('No se pudieron cargar las tarifas');
        return;
      }

      setTarifas(data || []);
    } catch (err) {
      console.error('Error inesperado:', err);
      setError('Error inesperado al cargar tarifas');
    } finally {
      setLoading(false);
    }
  };

  const formatPrecio = (tarifa: number, moneda: string = 'ARS'): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(tarifa);
  };

  const getTarifaPorDias = (dias: number): TarifaDiaEntrenamiento | undefined => {
    return tarifas.find(t => t.dias_por_semana === dias);
  };

  return {
    tarifas,
    loading,
    error,
    formatPrecio,
    getTarifaPorDias,
    refetch: fetchTarifas
  };
};


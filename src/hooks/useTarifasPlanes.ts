import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface PaquetePrecio {
  dias: number;
  /** null mientras carga o si no se pudo leer: nunca se muestra un precio inventado. */
  precioPorClase: number | null;
}

// El precio real es el que el admin configura en Configuración
// (configuracion_admin.combo_N_tarifa). Hasta tenerlo, los planes se listan sin precio.
const PAQUETES_SIN_PRECIO: PaquetePrecio[] = [1, 2, 3, 4, 5].map((dias) => ({
  dias,
  precioPorClase: null,
}));

type FilaTarifas = Record<`combo_${1 | 2 | 3 | 4 | 5}_tarifa`, number | string | null>;

export const useTarifasPlanes = () => {
  const [paquetes, setPaquetes] = useState<PaquetePrecio[]>(PAQUETES_SIN_PRECIO);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      const { data, error } = await supabase.rpc('fn_tarifas_planes');
      if (cancelado) return;

      const fila = (Array.isArray(data) ? data[0] : data) as FilaTarifas | null;
      if (error || !fila) {
        if (error) console.error('Error cargando tarifas de planes:', error);
        setLoading(false);
        return;
      }

      setPaquetes(
        PAQUETES_SIN_PRECIO.map((p) => {
          const valor = Number(fila[`combo_${p.dias}_tarifa` as keyof FilaTarifas]);
          return valor > 0 ? { ...p, precioPorClase: valor } : p;
        })
      );
      setLoading(false);
    };

    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  return { paquetes, loading };
};

/** Precio en pesos, o "—" si todavía no se conoce. */
export const formatPrecioPlan = (precio: number | null | undefined): string =>
  precio == null
    ? '—'
    : new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(precio);

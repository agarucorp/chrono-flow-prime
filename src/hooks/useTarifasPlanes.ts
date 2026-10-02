import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface PaquetePrecio {
  dias: number;
  precioPorClase: number;
}

// Solo se usan mientras carga o si la consulta falla: el precio real es el que
// el admin configura en Configuración (configuracion_admin.combo_N_tarifa).
const PAQUETES_PRECIOS_RESPALDO: PaquetePrecio[] = [
  { dias: 1, precioPorClase: 12500 },
  { dias: 2, precioPorClase: 11250 },
  { dias: 3, precioPorClase: 10000 },
  { dias: 4, precioPorClase: 8750 },
  { dias: 5, precioPorClase: 7500 },
];

type FilaTarifas = Record<`combo_${1 | 2 | 3 | 4 | 5}_tarifa`, number | string | null>;

export const useTarifasPlanes = () => {
  const [paquetes, setPaquetes] = useState<PaquetePrecio[]>(PAQUETES_PRECIOS_RESPALDO);
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
        PAQUETES_PRECIOS_RESPALDO.map((p) => {
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

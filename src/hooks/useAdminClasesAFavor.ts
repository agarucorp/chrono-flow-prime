import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface AlumnoConClasesAFavor {
  usuarioId: string;
  nombre: string;
  cantidad: number;
  /** Fecha (YYYY-MM-DD) en que vence la primera. */
  proximoVencimiento: string;
}

/**
 * Alumnos con clases a favor sin usar, para el panel admin.
 *
 * Sale de fn_admin_clases_a_favor, que aplica las mismas reglas que ve el
 * alumno. Se recarga cuando cambian cancelaciones o vacantes, y al volver a la
 * pestaña (las clases a favor vencen con el paso de los días).
 */
export const useAdminClasesAFavor = (enabled: boolean) => {
  const [alumnos, setAlumnos] = useState<AlumnoConClasesAFavor[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('fn_admin_clases_a_favor');
    if (error) {
      console.warn('No se pudieron cargar las clases a favor:', error.message);
      setAlumnos([]);
      return;
    }
    setAlumnos(
      (data ?? []).map((r: any) => ({
        usuarioId: r.usuario_id,
        nombre: r.nombre,
        cantidad: Number(r.cantidad),
        proximoVencimiento: r.proximo_vencimiento,
      }))
    );
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAlumnos([]);
      return;
    }

    load();

    // Varias filas cambian juntas (cancelación + cuota), así que se agrupan.
    const reloadSoon = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(load, 500);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') reloadSoon();
    };

    const events = ['turnosCancelados:updated', 'turnosVariables:updated', 'clasesDelMes:updated', 'balance:refresh'];
    events.forEach((e) => window.addEventListener(e, reloadSoon));
    document.addEventListener('visibilitychange', onVisible);

    const channel = supabase
      .channel('admin-clases-a-favor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_cancelados' }, reloadSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_variables' }, reloadSoon)
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reloadSoon));
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [enabled, load]);

  const porUsuario = useMemo(
    () => Object.fromEntries(alumnos.map((a) => [a.usuarioId, a])) as Record<string, AlumnoConClasesAFavor>,
    [alumnos]
  );
  const total = useMemo(() => alumnos.reduce((acc, a) => acc + a.cantidad, 0), [alumnos]);

  return { alumnos, porUsuario, total };
};

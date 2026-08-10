import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RecordDisciplina, RecordEntry } from '@/lib/records';

export function useRecords() {
  const [disciplinas, setDisciplinas] = useState<RecordDisciplina[]>([]);
  const [entries, setEntries] = useState<RecordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [discRes, entrRes] = await Promise.all([
        supabase
          .from('record_disciplinas')
          .select('*')
          .order('orden', { ascending: true })
          .order('nombre', { ascending: true }),
        supabase
          .from('record_entries')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      if (discRes.error) throw discRes.error;
      if (entrRes.error) throw entrRes.error;

      setDisciplinas((discRes.data || []) as RecordDisciplina[]);
      setEntries((entrRes.data || []) as RecordEntry[]);
    } catch (e: any) {
      console.error('Error cargando records:', e);
      setError(e?.message || 'No se pudieron cargar los records');
      setDisciplinas([]);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { disciplinas, entries, loading, error, reload: load };
}

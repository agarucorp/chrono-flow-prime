export type RecordUnidad = 'kg' | 'tiempo';

export interface RecordDisciplina {
  id: string;
  nombre: string;
  unidad: RecordUnidad;
  orden: number;
  created_at?: string;
  updated_at?: string;
}

export interface RecordEntry {
  id: string;
  disciplina_id: string;
  alumno_nombre: string;
  valor: string;
  created_at?: string;
  updated_at?: string;
}

export function formatRecordValor(valor: string, unidad: RecordUnidad): string {
  const v = (valor || '').trim();
  if (!v) return '—';
  if (unidad === 'kg') return `${v} kg`;
  return v;
}

/** Valida kg (número positivo) o tiempo (m:ss / mm:ss / h:mm:ss). */
export function isValidRecordValor(valor: string, unidad: RecordUnidad): boolean {
  const v = valor.trim();
  if (!v) return false;
  if (unidad === 'kg') {
    return /^\d+([.,]\d+)?$/.test(v) && Number(v.replace(',', '.')) > 0;
  }
  return /^(\d{1,2}:)?[0-5]?\d:[0-5]\d([.,]\d{1,3})?$/.test(v) || /^\d+[.,]\d+$/.test(v);
}

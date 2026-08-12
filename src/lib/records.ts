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

/**
 * Normaliza el valor a número comparable para ranking.
 * - kg → kilogramos
 * - tiempo → segundos totales
 * Devuelve null si no se puede parsear.
 */
export function parseRecordValorScore(valor: string, unidad: RecordUnidad): number | null {
  const v = (valor || '').trim().replace(',', '.');
  if (!v) return null;

  if (unidad === 'kg') {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Decimal puro (segundos) p.ej. "92.5"
  if (/^\d+(\.\d+)?$/.test(v) && !v.includes(':')) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  // h:mm:ss | mm:ss | m:ss(.ms)
  const parts = v.split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

/**
 * Ranking: menor tiempo primero, mayor peso primero.
 * Empates: nombre A→Z, luego id estable.
 */
export function sortRecordsByRanking(
  entries: RecordEntry[],
  unidad: RecordUnidad
): RecordEntry[] {
  return [...entries].sort((a, b) => {
    const sa = parseRecordValorScore(a.valor, unidad);
    const sb = parseRecordValorScore(b.valor, unidad);

    if (sa == null && sb == null) {
      return a.alumno_nombre.localeCompare(b.alumno_nombre, 'es') || a.id.localeCompare(b.id);
    }
    if (sa == null) return 1;
    if (sb == null) return -1;

    if (unidad === 'tiempo') {
      if (sa !== sb) return sa - sb; // menor tiempo primero
    } else if (sa !== sb) {
      return sb - sa; // mayor peso primero
    }

    return a.alumno_nombre.localeCompare(b.alumno_nombre, 'es') || a.id.localeCompare(b.id);
  });
}

export type RecordMedal = 'oro' | 'plata' | 'bronce';

/** Medalla para puestos 1–3 (índice 0-based). */
export function getRecordMedal(rankIndex: number): RecordMedal | null {
  if (rankIndex === 0) return 'oro';
  if (rankIndex === 1) return 'plata';
  if (rankIndex === 2) return 'bronce';
  return null;
}

export const RECORD_MEDAL_STYLES: Record<
  RecordMedal,
  { label: string; className: string; ring: string }
> = {
  oro: {
    label: '1°',
    className: 'bg-[#D4AF37] text-black',
    ring: 'ring-[#D4AF37]/40',
  },
  plata: {
    label: '2°',
    className: 'bg-[#C0C0C0] text-black',
    ring: 'ring-[#C0C0C0]/40',
  },
  bronce: {
    label: '3°',
    className: 'bg-[#CD7F32] text-black',
    ring: 'ring-[#CD7F32]/40',
  },
};

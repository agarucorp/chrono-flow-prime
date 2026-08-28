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
 * Empates de valor: nombre A→Z, luego id estable (solo desempata el orden visual).
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

function scoresTied(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a === b;
}

/**
 * Puesto 1-based sobre una lista ya ordenada.
 * Mismo peso o mismo tiempo → el mismo número; el siguiente salta
 * (1, 2, 2, 4). El orden entre empatados no cambia el puesto.
 */
export function getRecordPlaceNumbers(
  entries: RecordEntry[],
  unidad: RecordUnidad
): number[] {
  const places = new Array<number>(entries.length);
  let i = 0;
  while (i < entries.length) {
    const score = parseRecordValorScore(entries[i].valor, unidad);
    let j = i + 1;
    while (
      j < entries.length &&
      scoresTied(score, parseRecordValorScore(entries[j].valor, unidad))
    ) {
      j++;
    }
    const place = i + 1;
    for (let k = i; k < j; k++) places[k] = place;
    i = j;
  }
  return places;
}

export type RecordMedal = 'oro' | 'plata' | 'bronce';

/** Medalla para puestos 1–3 (número de puesto, no índice de fila). */
export function getRecordMedal(place: number): RecordMedal | null {
  if (place === 1) return 'oro';
  if (place === 2) return 'plata';
  if (place === 3) return 'bronce';
  return null;
}

export const RECORD_MEDAL_STYLES: Record<
  RecordMedal,
  { label: string; className: string; ring: string }
> = {
  oro: {
    label: '1°',
    className: 'bg-[hsl(var(--medal-gold))] text-black',
    ring: 'ring-[hsl(var(--medal-gold))]/40',
  },
  plata: {
    label: '2°',
    className: 'bg-[hsl(var(--medal-silver))] text-black',
    ring: 'ring-[hsl(var(--medal-silver))]/40',
  },
  bronce: {
    label: '3°',
    className: 'bg-[hsl(var(--medal-bronze))] text-black',
    ring: 'ring-[hsl(var(--medal-bronze))]/40',
  },
};

/**
 * Horas en la app: se guardan en BD como TIME (24h). Aquí solo formateo para UI.
 * Estilo compacto: 8am, 12pm, 9pm; si hay minutos ≠ 0 → 8:30am.
 */

export function normalizeTimeToHhMm(hora: string | null | undefined): string {
  if (hora == null || hora === '') return '';
  const s = String(hora).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?/);
  if (!match) return s.length >= 5 ? s.substring(0, 5) : s;
  const h = match[1].padStart(2, '0');
  const m = match[2].padStart(2, '0');
  return `${h}:${m}`;
}

/** Una hora → "8am", "12pm", "9pm" (en punto); con minutos → "8:30am". */
export function formatClockAmPm(hora: string | null | undefined): string {
  const hhmm = normalizeTimeToHhMm(hora);
  if (!hhmm) return '';
  const [hs, ms] = hhmm.split(':');
  let h = parseInt(hs, 10);
  const m = parseInt(ms, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? 'pm' : 'am';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const minPart = m === 0 ? '' : `:${String(m).padStart(2, '0')}`;
  return `${h12}${minPart}${period}`;
}

/** Rango → "8am – 9am" */
export function formatClockRangeAmPm(
  inicio: string | null | undefined,
  fin: string | null | undefined,
  sep = ' – '
): string {
  const a = formatClockAmPm(inicio);
  const b = formatClockAmPm(fin);
  if (!a && !b) return '';
  if (!a) return b;
  if (!b) return a;
  return `${a}${sep}${b}`;
}

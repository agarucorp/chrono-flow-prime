/**
 * Fechas de calendario en zona local (Argentina) sin UTC drift.
 * Evitar `toISOString().split('T')[0]` para días de negocio.
 */

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

/** Nombre de mes en minúscula (índice 0–11). */
export function monthNameEs(monthIndex0: number): string {
  return MESES_ES[((monthIndex0 % 12) + 12) % 12];
}

/** "agosto 2026" o, si asTitle, "Agosto 2026" (mes como primera palabra). */
export function formatMonthYearEs(date: Date, asTitle = false): string {
  const s = `${monthNameEs(date.getMonth())} ${date.getFullYear()}`;
  return asTitle ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Solo el mes; asTitle → "Agosto", si no → "agosto". */
export function formatMonthEs(date: Date, asTitle = false): string {
  const s = monthNameEs(date.getMonth());
  return asTitle ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Fuerza meses en minúscula dentro de un texto (español). */
export function lowercaseSpanishMonths(text: string): string {
  return text.replace(
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/gi,
    (m) => m.toLowerCase()
  );
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayLocal(): string {
  return formatLocalDate(new Date());
}

/** Año/mes de negocio en Argentina (alineado con RPCs de cuotas). */
export function getArgentinaYearMonth(date: Date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { year, month };
}

export function addDaysLocal(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfMonthLocal(year: number, month1to12: number): Date {
  return new Date(year, month1to12 - 1, 1);
}

export function endOfMonthLocal(year: number, month1to12: number): Date {
  return new Date(year, month1to12, 0);
}

export function startOfMonthStr(year: number, month1to12: number): string {
  return formatLocalDate(startOfMonthLocal(year, month1to12));
}

export function endOfMonthStr(year: number, month1to12: number): string {
  return formatLocalDate(endOfMonthLocal(year, month1to12));
}

/** Normaliza TIME de Postgres a HH:mm para comparaciones. */
export function normalizeTimeHhMm(hora: string | null | undefined): string {
  if (hora == null || hora === "") return "";
  const s = String(hora).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return s.length >= 5 ? s.substring(0, 5) : s;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

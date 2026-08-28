const STORAGE_KEY = 'malda_preview_alumno';
const EVENT = 'malda:preview-alumno';

export function isAlumnoPreview(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function startAlumnoPreview() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function stopAlumnoPreview() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

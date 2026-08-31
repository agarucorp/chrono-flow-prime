export const AUTH_STORAGE_KEY = 'maldagym_supabase_auth';
export const REMEMBER_SESSION_KEY = 'maldagym_remember_session';

/**
 * Storage de la sesión de supabase-js.
 *
 * Por defecto la sesión vive en localStorage (como Instagram en el navegador):
 * cerrar la pestaña no te desloguea. Si el usuario elige "Solo esta vez",
 * pasa a sessionStorage y se pierde al cerrar el navegador.
 *
 * El fallback a sessionStorage en getItem evita desloguear a quien todavía
 * tenga la sesión ahí de una versión anterior.
 */
export function shouldRememberSession(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(REMEMBER_SESSION_KEY) !== '0';
}

export function setRememberSession(remember: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REMEMBER_SESSION_KEY, remember ? '1' : '0');
  const raw =
    localStorage.getItem(AUTH_STORAGE_KEY) ?? sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return;
  if (remember) {
    localStorage.setItem(AUTH_STORAGE_KEY, raw);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } else {
    sessionStorage.setItem(AUTH_STORAGE_KEY, raw);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function writeAuthValue(key: string, value: string) {
  if (key === AUTH_STORAGE_KEY && !shouldRememberSession()) {
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, value);
  if (key === AUTH_STORAGE_KEY) {
    sessionStorage.removeItem(key);
  }
}

function readAuthValue(key: string) {
  if (key === AUTH_STORAGE_KEY && !shouldRememberSession()) {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  }
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

export const authStorage: Storage = {
  get length() {
    return localStorage.length;
  },
  clear() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  },
  key(index: number) {
    return localStorage.key(index);
  },
  getItem(key: string) {
    return readAuthValue(key);
  },
  setItem(key: string, value: string) {
    writeAuthValue(key, value);
  },
  removeItem(key: string) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

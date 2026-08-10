/** Preferencia "mantener sesión" + storage adaptativo para supabase-js. */

export const REMEMBER_SESSION_KEY = 'maldagym_remember_session';
export const AUTH_STORAGE_KEY = 'maldagym_supabase_auth';

export function getRememberSession(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(REMEMBER_SESSION_KEY) === '1';
}

export function setRememberSession(remember: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REMEMBER_SESSION_KEY, remember ? '1' : '0');
}

/**
 * Si "mantener sesión" está activo → localStorage.
 * Si no → sessionStorage (se pierde al cerrar la pestaña).
 */
export const authStorage: Storage = {
  get length() {
    return getRememberSession() ? localStorage.length : sessionStorage.length;
  },
  clear() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  },
  key(index: number) {
    return (getRememberSession() ? localStorage : sessionStorage).key(index);
  },
  getItem(key: string) {
    if (key !== AUTH_STORAGE_KEY) {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    }
    if (getRememberSession()) {
      return localStorage.getItem(key);
    }
    return sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (key !== AUTH_STORAGE_KEY) {
      localStorage.setItem(key, value);
      return;
    }
    if (getRememberSession()) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem(key: string) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

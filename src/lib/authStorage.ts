export const AUTH_STORAGE_KEY = 'maldagym_supabase_auth';

/**
 * Storage de la sesión de supabase-js.
 *
 * La sesión siempre vive en localStorage. Antes había una preferencia
 * "mantener sesión iniciada" que la mandaba a sessionStorage; el fallback a
 * sessionStorage en getItem queda solo para no desloguear a quien todavía
 * tenga la sesión guardada ahí de la versión anterior.
 */
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
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    localStorage.setItem(key, value);
    if (key === AUTH_STORAGE_KEY) {
      sessionStorage.removeItem(key);
    }
  },
  removeItem(key: string) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

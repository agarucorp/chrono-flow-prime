/** Helpers para callbacks de Auth (confirm email / recovery) con PKCE o hash legacy. */

export function parseAuthUrlParams(search = window.location.search, hash = window.location.hash) {
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const queryParams = new URLSearchParams(search);
  const type = hashParams.get('type') || queryParams.get('type');
  return {
    type,
    hasCode: queryParams.has('code'),
    hasAccessToken: hashParams.has('access_token'),
    error: queryParams.get('error') || hashParams.get('error'),
    errorDescription:
      queryParams.get('error_description') || hashParams.get('error_description'),
  };
}

/** Link de confirmación de cuenta (signup/email) hacia /login. */
export function isEmailConfirmCallback(search?: string, hash?: string) {
  const { type, hasCode, hasAccessToken, error } = parseAuthUrlParams(search, hash);
  if (error) return false;
  if (type === 'recovery') return false;
  if (type === 'signup' || type === 'email') return true;
  // PKCE: redirectTo=/login suele venir solo con ?code= (sin type)
  if (hasCode && window.location.pathname.startsWith('/login')) return true;
  if (hasAccessToken && type !== 'recovery') return true;
  return false;
}

/** Link de recuperación de contraseña. */
export function isRecoveryCallback(search?: string, hash?: string) {
  const { type, hasCode, hasAccessToken } = parseAuthUrlParams(search, hash);
  if (type === 'recovery') return true;
  // PKCE sin type en /reset-password
  if (hasCode && window.location.pathname.startsWith('/reset-password')) return true;
  if (hasAccessToken && type === 'recovery') return true;
  return false;
}

export function cleanAuthParamsFromUrl(path: string) {
  window.history.replaceState({}, document.title, path);
}

/** Espera a que detectSessionInUrl / exchange termine (PKCE). */
export async function waitForAuthSession(
  getSession: () => Promise<{ data: { session: unknown } }>,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
) {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const intervalMs = opts.intervalMs ?? 250;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await getSession();
    if (data.session) return data.session;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

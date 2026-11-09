import { supabase } from '@/lib/supabase';

// Clave pública VAPID. La privada está en vault (push_vapid_privada).
const VAPID_PUBLICA = 'BCiWpXhf-C-FWYjdt6xVpdnHMzD-WD6vMA8n5OL6tEVmu1XMs8T2ICvzlJ5kJ_9bIwmKFQcrsr2eU_CO0QgMhOQ';

// La base solo acepta y solo avisa a esta cuenta (fn_push_es_receptor).
const CUENTA_AVISOS = 'lucasmaldacena@gmail.com';

export function recibeAvisos(email: string | null | undefined): boolean {
  return (email || '').trim().toLowerCase() === CUENTA_AVISOS;
}

export type EstadoAvisos =
  | 'cargando'
  | 'activos'
  | 'inactivos'
  | 'bloqueados'
  | 'instalar_ios'
  | 'no_soportado';

function esIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function abiertaComoApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function soportaAvisos(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function claveABytes(base64: string): Uint8Array {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}

async function suscripcionActual(): Promise<PushSubscription | null> {
  const registro = await navigator.serviceWorker.getRegistration('/');
  return registro ? registro.pushManager.getSubscription() : null;
}

async function guardar(usuarioId: string, suscripcion: PushSubscription): Promise<void> {
  const datos = suscripcion.toJSON();
  const { error } = await supabase.from('push_suscripciones').upsert(
    {
      usuario_id: usuarioId,
      endpoint: suscripcion.endpoint,
      p256dh: datos.keys?.p256dh ?? '',
      auth: datos.keys?.auth ?? '',
      dispositivo: navigator.userAgent.slice(0, 200),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
}

export async function estadoAvisos(usuarioId: string): Promise<EstadoAvisos> {
  if (!soportaAvisos()) {
    return esIOS() && !abiertaComoApp() ? 'instalar_ios' : 'no_soportado';
  }
  if (Notification.permission === 'denied') return 'bloqueados';
  const suscripcion = await suscripcionActual();
  if (!suscripcion || Notification.permission !== 'granted') return 'inactivos';
  // Se vuelve a guardar por si el celular renovó la suscripción.
  await guardar(usuarioId, suscripcion).catch(() => undefined);
  return 'activos';
}

/** Tiene que llamarse desde un toque del usuario: iOS solo pide permiso así. */
export async function activarAvisos(usuarioId: string): Promise<EstadoAvisos> {
  const permiso = await Notification.requestPermission();
  if (permiso === 'denied') return 'bloqueados';
  if (permiso !== 'granted') return 'inactivos';

  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const registro = await navigator.serviceWorker.ready;
  const suscripcion = (await registro.pushManager.getSubscription())
    ?? (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: claveABytes(VAPID_PUBLICA),
    }));
  await guardar(usuarioId, suscripcion);
  return 'activos';
}

export async function desactivarAvisos(): Promise<EstadoAvisos> {
  const suscripcion = await suscripcionActual();
  if (suscripcion) {
    await supabase.from('push_suscripciones').delete().eq('endpoint', suscripcion.endpoint);
    await suscripcion.unsubscribe();
  }
  return 'inactivos';
}

// Solo recibe avisos para el admin. No guarda nada en caché: la app siempre
// se carga de la red como hasta ahora.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { body: event.data ? event.data.text() : '' };
  }

  // iOS da de baja el permiso si un aviso llega y no se muestra.
  event.waitUntil(
    self.registration.showNotification(datos.title || 'MALDA', {
      body: datos.body || '',
      tag: datos.tag,
      icon: '/favicon.png',
      data: { url: datos.url || '/admin' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/admin', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        if ('focus' in ventana) return ventana.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

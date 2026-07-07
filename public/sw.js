const CACHE = 'chronos-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Tocco su una notifica: porta in primo piano l'app (o la apre).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients[0];
      if (client) return client.focus();
      return self.clients.openWindow('.');
    })
  );
});

// Network-first con fallback alla cache: l'app resta usabile offline.
// L'API di sincronizzazione è esclusa: sono dati, non file dell'app,
// e non devono MAI essere serviti da una cache.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (
    request.method !== 'GET' ||
    !request.url.startsWith(self.location.origin) ||
    request.url.includes('api.php')
  )
    return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(request);
        return cached ?? Response.error();
      }
    })
  );
});

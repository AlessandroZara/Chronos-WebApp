// v2: aggiunta la gestione Web Push (il numero forza la pulizia delle
// cache dei service worker precedenti alla prima attivazione).
const CACHE = 'chronos-v2';

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

// Arrivo di un messaggio Web Push dal server (funziona anche ad app
// chiusa: è il push service del browser a svegliare il service worker).
// Payload atteso: JSON { title, body, url? }; se il server manda testo
// semplice lo mostriamo come corpo con titolo di ripiego.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || '⏳ Chronos', {
      body: payload.body || '',
      icon: './icon.svg',
      badge: './icon.svg',
      // Conservato nella notifica: notificationclick lo usa per aprire
      // la pagina giusta (es. './#calendar' per un promemoria evento).
      data: { url: payload.url || '.' },
    })
  );
});

// Tocco su una notifica: porta in primo piano l'app (o la apre
// all'indirizzo indicato dal payload push, se presente).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '.';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients[0];
      if (client) return client.focus();
      return self.clients.openWindow(url);
    })
  );
});

// Il push service può invalidare o ruotare la subscription (succede,
// anche se di rado): proviamo subito a ricrearla con le stesse opzioni.
// L'invio della nuova subscription al server arriverà con lo step
// successivo; intanto la pagina la risalva al prossimo avvio tramite
// ensurePushSubscription().
self.addEventListener('pushsubscriptionchange', (event) => {
  const options = event.oldSubscription ? event.oldSubscription.options : null;
  if (!options) return;
  event.waitUntil(self.registration.pushManager.subscribe(options).catch(() => null));
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

// Service worker: "network-first" — hent ALTID den nyeste version fra nettet,
// og fald kun tilbage på cache, hvis du er offline. Det fjerner cache-bøvlet,
// hvor browseren ellers genbruger gamle kodefiler.

const CACHE = 'rig-cache-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // { cache: 'no-store' } omgår browserens HTTP-cache, så vi altid får friske filer.
    fetch(e.request, { cache: 'no-store' })
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request)) // offline → brug sidst gemte
  );
});

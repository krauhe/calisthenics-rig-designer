// Service worker: "network-first" — hent ALTID den nyeste version fra nettet,
// og fald kun tilbage på cache, hvis du er offline. Det fjerner cache-bøvlet,
// hvor browseren ellers genbruger gamle kodefiler.

const CACHE = 'rig-cache-v2';

self.addEventListener('install', () => self.skipWaiting());

// Ryd gamle cache-versioner op, så cachen ikke vokser for evigt og gamle
// (omdøbte/slettede) filer ikke bliver liggende.
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // { cache: 'no-store' } omgår browserens HTTP-cache, så vi altid får friske filer.
    fetch(e.request, { cache: 'no-store' })
      .then((resp) => {
        // Cache kun GODE svar — et 404/500 (fx midt i et deploy) må aldrig
        // overskrive en fungerende kopi i cachen.
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(e.request)) // offline → brug sidst gemte
  );
});

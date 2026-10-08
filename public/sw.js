/* Service worker de Parvis : permet l'installation et l'ouverture hors connexion.
   Les appels vers d'autres sites (Supabase, plus tard) ne sont jamais mis en cache. */
const CACHE = 'parvis-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './manifest.webmanifest', './icon.svg'])));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  if (new URL(r.url).origin !== location.origin) return;

  // Page : le réseau d'abord (version à jour), sinon la copie gardée.
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put('./', cp)); return res; })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Fichiers (noms uniques à chaque version) : la copie gardée d'abord.
  e.respondWith(
    caches.match(r).then(hit => hit || fetch(r).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
      return res;
    }))
  );
});

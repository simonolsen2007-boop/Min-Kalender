const CACHE = 'kalenderai-v3';
const ASSETS = [
  '/KalenderAI/',
  '/KalenderAI/index.html',
  '/KalenderAI/manifest.json',
  '/KalenderAI/css/style.css',
  '/KalenderAI/js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Cache-first for Google Fonts (CSS + font files) — needed for offline
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(response => {
            cache.put(e.request, response.clone());
            return response;
          });
        })
      ).catch(() => caches.match(e.request))
    );
    return;
  }

  // Network-first with cache fallback for everything else
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

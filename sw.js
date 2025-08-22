/* sw.js */
const CACHE = 'limni-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  // icons
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  // third-party script (cached after first successful fetch)
  'https://unpkg.com/suncalc@1.9.0/suncalc.js'
];

// Install: pre-cache app shell (ignore 3rd-party failures)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(
        APP_SHELL.map(url =>
          fetch(url, { mode: 'no-cors' })
            .then(resp => cache.put(url, resp.clone()))
            .catch(() => {/* ignore if offline on first load */})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - HTML navigations: network-first, fallback to cache (so updates show up)
// - Same-origin assets: cache-first
// - Cross-origin (images/CDNs): cache-first with network fallback (opaque allowed)
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Navigations: network-first
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return resp;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return resp;
      }))
    );
    return;
  }

  // Cross-origin (e.g., unpkg, remote images): cache-first
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req, { mode: 'no-cors' }).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return resp;
    }).catch(() => cached))
  );
});

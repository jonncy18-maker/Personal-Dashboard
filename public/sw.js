// Service worker for the Personal Dashboard PWA. Deliberately conservative
// about data freshness: hashed static assets are cache-first (they're
// immutable), pages are network-first with an offline fallback, and API
// routes are never cached — this app depends on live data (GitHub/Vercel/
// Calendar/Gmail-derived), and the in-app refresh button assumes fresh reads.

const CACHE = 'personal-os-v2';
const SHELL = '/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(SHELL))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function cacheFirst(request) {
  return caches.match(request).then(
    (hit) =>
      hit ||
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
  );
}

function networkFirst(request) {
  return fetch(request)
    .then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
      return res;
    })
    .catch(() =>
      caches.match(request).then((hit) => hit || caches.match(SHELL))
    );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never serve API data from cache — freshness matters more than offline here.
  if (url.pathname.startsWith('/api/')) return;

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:png|svg|ico|webmanifest|woff2?)$/.test(url.pathname);

  event.respondWith(isStatic ? cacheFirst(request) : networkFirst(request));
});

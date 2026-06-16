/* TourneyOps service worker. Caches the app shell + hashed build assets for
 * offline use. The API (/api) and websockets (/socket.io) are never cached. */
const VERSION = 'tms-cache-v1';
const APP_SHELL = ['/', '/index.html', '/trophy.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin alone
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  // SPA navigations: network-first so fresh HTML wins, fall back to the cached
  // shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  // Static assets: cache-first, then network (caching hashed build output).
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((res) => {
            const cacheable = res.ok && (url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname));
            if (cacheable) {
              const copy = res.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return res;
          })
          .catch(() => cached)
    )
  );
});

// Optional web-push scaffold: shows a notification when the server sends one.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'TourneyOps', body: event.data.text() };
  }
  const title = payload.title || 'TourneyOps';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/trophy.svg',
      badge: '/trophy.svg',
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(target));
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    })
  );
});

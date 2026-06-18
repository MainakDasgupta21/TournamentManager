/* TourneyOps service worker. Caches the app shell + hashed build assets for
 * offline use. The API (/api) and websockets (/socket.io) are never cached. */
const SW_VERSION = new URL(self.location.href).searchParams.get('v') || 'v1';
const VERSION = `tms-cache-${SW_VERSION}`;
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
  let targetUrl;
  try {
    targetUrl = new URL(target, self.location.origin);
  } catch {
    targetUrl = new URL('/', self.location.origin);
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => {
        try {
          const current = new URL(c.url);
          return (
            current.origin === targetUrl.origin &&
            current.pathname === targetUrl.pathname &&
            current.search === targetUrl.search
          );
        } catch {
          return false;
        }
      });
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl.href);
    })
  );
});

/* Shopfloor Pros — service worker
   Its whole job is to make the app open instantly and say something
   sensible when there's no signal.

   Deliberately conservative: the app shell is cached, but nothing from
   Supabase is. A shop must never see yesterday's job list and think it's
   today's. Stale data in a shop is worse than no data. */

const VERSION = 'sfp-v1';
const SHELL = [
  '/app.html',
  '/portal.html',
  '/icon-192.png',
  '/icon-512.png',
  '/offline.html',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // a missing file shouldn't block install
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET') return;

  // Never cache anything from the database or storage. Always live.
  if (url.hostname.endsWith('supabase.co')) return;

  // Pages: try the network, fall back to what we have, then to a
  // page that explains rather than a browser error.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('/offline.html')))
    );
    return;
  }

  // Everything else: serve from cache if we have it, otherwise fetch and keep it.
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        if (res.ok && (url.origin === location.origin || url.hostname.includes('jsdelivr'))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit)
    )
  );
});

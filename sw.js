/* FFP Passport — Service Worker (v2)
   Deliberately CONSERVATIVE. Its only jobs are (a) make the app installable (Android/Chrome require a SW
   with a fetch handler) and (b) provide an offline fallback for the static home-screen icons. It NEVER
   caches HTML or JS, so a Netlify deploy is always served fresh — no stale-page bugs.

   v2 (2026-07-02) — ROOT-CAUSE FIX for "the app icon won't update":
   v1 served /assets/icons/* CACHE-FIRST under a fixed cache name ('ffp-static-v1'). Because the cache name
   never changed, the FIRST icons a device ever cached were pinned forever — new deploys of the icons were
   ignored (the SW answered from its stale cache before the network was hit), so the home-screen / PWA icon
   never updated no matter how many times we re-uploaded or reinstalled. Fixes:
     1) Cache name bumped to 'ffp-static-v2' → the activate handler deletes 'ffp-static-v1' (purging the old
        icons) the moment this SW takes over.
     2) Icons are now NETWORK-FIRST: fetch from the network and use that (updating the cache), only falling
        back to cache when offline. So a fresh icon ALWAYS wins when online. */
const CACHE = 'ffp-static-v2';
const PRECACHE = [
  '/assets/icons/ffp-icon-192.png?v=3',
  '/assets/icons/ffp-icon-512.png?v=3',
  '/assets/icons/ffp-maskable-192.png?v=3',
  '/assets/icons/ffp-maskable-512.png?v=3',
  '/assets/icons/ffp-apple-touch-180.png?v=3'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); }).catch(function () {}));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      // Delete EVERY old cache (incl. the stale 'ffp-static-v1' that pinned the old icons).
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  // NETWORK-FIRST for our own icon files only. Everything else (HTML, JS, CSS, API, images) falls through
  // to the network untouched. Network-first means a freshly deployed icon is always used when online; the
  // cache is only a fallback for offline. This is what lets the icon actually update.
  if (url.origin === self.location.origin && url.pathname.indexOf('/assets/icons/') === 0) {
    event.respondWith(
      fetch(req).then(function (res) {
        try { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); } catch (e) {}
        return res;
      }).catch(function () { return caches.match(req); })
    );
  }
});

/* ── WEB PUSH ─────────────────────────────────────────────────────────────────────────────
   Show a notification when the backend sends a push, and focus/open the app when it's tapped. The
   payload is JSON: { title, body, url, icon }. Works even when the app is fully closed. */
self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { try { data = { body: event.data && event.data.text() }; } catch (e2) {} }
  var title = data.title || 'FFP Passport';
  var options = {
    body: data.body || '',
    icon: data.icon || '/assets/icons/ffp-icon-192.png?v=3',
    badge: '/assets/icons/ffp-favicon-32.png?v=3',
    data: { url: data.url || '/ffp-member-dashboard.html' }
  };
  if (data.tag) { options.tag = data.tag; options.renotify = true; }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/ffp-member-dashboard.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if ('focus' in c) { try { c.navigate(url); } catch (e) {} return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

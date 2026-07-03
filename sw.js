/* FFP Passport — Service Worker (v3)
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
// v3 (2026-07-03): PHOTO CACHE. Supabase Storage image URLs are content-versioned (resize width + the ?v= the uploader
// appends change whenever the image changes), so they're safe to serve CACHE-FIRST — repeat scrolls / app re-opens /
// profile revisits pull photos straight from the device with zero network. Capped so it can't grow unbounded.
const IMG_CACHE = 'ffp-img-v1';
const IMG_HOST = 'kxzyuofecmtymablnmak.supabase.co';
const IMG_MAX = 260;                        // keep the most-recent ~260 photos on device
function trimImgCache() {
  caches.open(IMG_CACHE).then(function (c) {
    c.keys().then(function (keys) {
      if (keys.length <= IMG_MAX) return;
      for (var i = 0; i < keys.length - IMG_MAX; i++) c.delete(keys[i]);   // evict oldest
    });
  }).catch(function () {});
}
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
      // Delete old caches (incl. stale 'ffp-static-v1') but KEEP the photo cache (IMG_CACHE) across deploys.
      return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== IMG_CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  // CACHE-FIRST for Supabase Storage photos (URLs are content-versioned, so a cached copy is never stale). This is
  // what makes re-scrolls / app re-opens / profile revisits load photos instantly with no network. Cross-origin image
  // requests come back opaque — still cacheable & displayable.
  if (url.host === IMG_HOST && url.pathname.indexOf('/storage/v1/') === 0) {
    event.respondWith(
      caches.open(IMG_CACHE).then(function (c) {
        return c.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            try { if (res && (res.ok || res.type === 'opaque')) { c.put(req, res.clone()); trimImgCache(); } } catch (e) {}
            return res;
          });
        });
      })
    );
    return;
  }
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

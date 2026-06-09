/* FFP Passport - PWA install helper
   (1) Registers the service worker. (2) Auto-shows a tasteful "Install the app" banner on mobile (Android =
   native beforeinstallprompt; iOS Safari = Share -> Add to Home Screen hint), hidden once installed or for
   14 days after dismissal. (3) Exposes window.FFPInstall so an explicit button (e.g. in Profile) can trigger
   the install on demand, regardless of the auto-banner's state. */
(function () {
  'use strict';

  // 1) Register the service worker (root scope). Best-effort; never block the app.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (e) { console.warn('[FFP PWA] SW register failed', e); });
    });
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var isSafari = /^((?!chrome|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
  var deferredPrompt = null;   // set when Android/Chrome offers beforeinstallprompt

  function recentlyDismissed() {
    try { var until = parseInt(localStorage.getItem('ffp_pwa_dismiss_until') || '0', 10); return !!(until && Date.now() < until); }
    catch (e) { return false; }
  }
  function dismiss() {
    var b = document.getElementById('ffp-pwa-banner');
    if (b && b.parentNode) b.parentNode.removeChild(b);
    try { localStorage.setItem('ffp_pwa_dismiss_until', String(Date.now() + 14 * 24 * 60 * 60 * 1000)); } catch (e) {}
  }

  function banner(innerHTML) {
    if (document.getElementById('ffp-pwa-banner')) return;
    var el = document.createElement('div');
    el.id = 'ffp-pwa-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Install FFP Passport');
    el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:460px;margin:0 auto;' +
      'background:#0f1e2e;border:1px solid rgba(43,168,224,.35);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.5);' +
      'padding:14px 14px 14px 14px;color:#e8eef4;font-family:Montserrat,system-ui,sans-serif;' +
      'display:flex;gap:12px;align-items:center;animation:ffppwaIn .25s ease;';
    el.innerHTML =
      '<img src="/assets/icons/ffp-icon-192.png" alt="" width="46" height="46" style="border-radius:11px;flex:0 0 auto;background:#fff;">' +
      '<div style="flex:1;min-width:0;">' + innerHTML + '</div>' +
      '<button id="ffp-pwa-x" aria-label="Dismiss" style="flex:0 0 auto;background:none;border:none;color:#7b8b9c;font-size:22px;line-height:1;cursor:pointer;padding:2px 4px;align-self:flex-start;">&times;</button>';
    document.body.appendChild(el);

    if (!document.getElementById('ffp-pwa-style')) {
      var style = document.createElement('style');
      style.id = 'ffp-pwa-style';
      style.textContent = '@keyframes ffppwaIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}';
      document.head.appendChild(style);
    }

    var x = document.getElementById('ffp-pwa-x');
    if (x) x.addEventListener('click', dismiss);
    var install = document.getElementById('ffp-pwa-install');
    if (install) install.addEventListener('click', doInstall);
  }

  function doInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; dismiss(); });
  }

  function androidBannerHTML() {
    return '<div style="font-size:14px;font-weight:800;letter-spacing:-.1px;">Install FFP Passport</div>' +
      '<div style="font-size:12px;color:#9fb4c4;margin-top:2px;line-height:1.4;">Add it to your home screen - opens full-screen and keeps you signed in.</div>' +
      '<button id="ffp-pwa-install" style="margin-top:10px;background:#1980AD;color:#fff;border:none;border-radius:9px;padding:9px 16px;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;">Install</button>';
  }
  function iosHelp() {
    banner(
      '<div style="font-size:14px;font-weight:800;letter-spacing:-.1px;">Add FFP Passport to your home screen</div>' +
      '<div style="font-size:12px;color:#9fb4c4;margin-top:3px;line-height:1.5;">Tap the Share button ' +
      '<span style="display:inline-block;vertical-align:-3px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2ba8e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></span> ' +
      'then <strong style="color:#e8eef4;">Add to Home Screen</strong>. It opens full-screen and keeps you signed in.</div>'
    );
  }
  function genericHelp() {
    banner(
      '<div style="font-size:14px;font-weight:800;letter-spacing:-.1px;">Open this on your phone</div>' +
      '<div style="font-size:12px;color:#9fb4c4;margin-top:3px;line-height:1.5;">To add FFP Passport to your home screen, open <strong style="color:#e8eef4;">ffppassport.com</strong> in your mobile browser, then use the browser menu &rarr; <strong style="color:#e8eef4;">Add to Home Screen</strong>.</div>'
    );
  }

  // Android / desktop Chrome: capture the install opportunity (ALWAYS — so the Profile button can use it),
  // and auto-show the banner only when not installed + not recently dismissed.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone() && !recentlyDismissed()) {
      setTimeout(function () { banner(androidBannerHTML()); }, 2500);
    }
    if (typeof window.ffpRefreshInstallRow === 'function') window.ffpRefreshInstallRow();
  });
  window.addEventListener('appinstalled', function () { deferredPrompt = null; dismiss(); if (typeof window.ffpRefreshInstallRow === 'function') window.ffpRefreshInstallRow(); });

  // iOS Safari auto-banner (no beforeinstallprompt there).
  if (isIOS && isSafari && !isStandalone() && !recentlyDismissed()) {
    window.addEventListener('load', function () { setTimeout(iosHelp, 2500); });
  }

  // Public API — for an explicit "Add to home screen" control (Profile).
  window.FFPInstall = {
    isStandalone: isStandalone,
    // 'installed' | 'android' (native prompt ready) | 'ios' | 'unavailable' (desktop / not yet eligible)
    status: function () {
      if (isStandalone()) return 'installed';
      if (deferredPrompt) return 'android';
      if (isIOS) return 'ios';
      return 'unavailable';
    },
    // Trigger the right install path for this device. Returns the status it acted on.
    prompt: function () {
      if (isStandalone()) return 'installed';
      if (deferredPrompt) { doInstall(); return 'android'; }
      if (isIOS) { iosHelp(); return 'ios'; }
      genericHelp(); return 'unavailable';
    }
  };

  // ── WEB PUSH ──────────────────────────────────────────────────────────────────────────────
  // Opt-in phone notifications. The Profile toggle calls window.FFPPush. The VAPID public key is public by
  // design; the matching private key lives only in the backend (Vercel env).
  var VAPID_PUBLIC = 'BPx1WNwnR2fXuLgS6LFvUSRsT7Xhm-PkSyhROdfkzCOQImwKXiLk0R15Q8WWANEyeiGGQL2gy87QTzm2EU4bgE4';
  var PUSH_API = 'https://ffp-passport-backend.vercel.app';
  function urlB64ToUint8(b64) {
    var pad = '='.repeat((4 - (b64.length % 4)) % 4);
    var base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function pushSupported() { return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window); }
  function swReady() { return ('serviceWorker' in navigator) ? navigator.serviceWorker.ready : Promise.resolve(null); }

  window.FFPPush = {
    supported: pushSupported,
    // 'subscribed' | 'default' (can turn on) | 'denied' | 'ios-needs-install' | 'unsupported'
    status: function () {
      if (isIOS && !isStandalone() && !pushSupported()) return Promise.resolve('ios-needs-install');
      if (!pushSupported()) return Promise.resolve('unsupported');
      if (Notification.permission === 'denied') return Promise.resolve('denied');
      return swReady().then(function (reg) {
        if (!reg) return 'default';
        return reg.pushManager.getSubscription().then(function (sub) {
          return (sub && Notification.permission === 'granted') ? 'subscribed' : 'default';
        });
      }).catch(function () { return 'default'; });
    },
    enable: function (memberId) {
      if (!memberId) return Promise.resolve({ ok: false, error: 'not signed in' });
      if (isIOS && !isStandalone()) return Promise.resolve({ ok: false, error: 'ios-needs-install' });
      if (!pushSupported()) return Promise.resolve({ ok: false, error: 'unsupported' });
      return Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') return { ok: false, error: perm };
        return swReady().then(function (reg) {
          return reg.pushManager.getSubscription().then(function (sub) {
            return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC) });
          });
        }).then(function (sub) {
          return fetch(PUSH_API + '/api/push/subscribe', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: memberId, subscription: sub.toJSON(), user_agent: navigator.userAgent })
          }).then(function (r) { return r.json(); }).then(function (j) { return { ok: !!(j && j.success), data: j }; });
        });
      }).catch(function (e) { return { ok: false, error: e.message }; });
    },
    disable: function () {
      return swReady().then(function (reg) {
        if (!reg) return { ok: true };
        return reg.pushManager.getSubscription().then(function (sub) {
          if (!sub) return { ok: true };
          var ep = sub.endpoint;
          return sub.unsubscribe().then(function () {
            return fetch(PUSH_API + '/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: ep }) });
          }).then(function () { return { ok: true }; });
        });
      }).catch(function (e) { return { ok: false, error: e.message }; });
    },
    test: function (memberId) {
      if (!memberId) return Promise.resolve({ ok: false });
      return fetch(PUSH_API + '/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: memberId }) })
        .then(function (r) { return r.json(); }).catch(function (e) { return { ok: false, error: e.message }; });
    }
  };
})();

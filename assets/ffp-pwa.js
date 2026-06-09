/* FFP Passport — PWA install helper
   (1) Registers the service worker. (2) Shows a tasteful "Install the app" banner: on Android/Chrome it uses
   the native beforeinstallprompt; on iOS Safari (which has no prompt API) it shows the Share -> Add to Home
   Screen instructions. Hides itself when already installed (standalone) and remembers a dismissal for 14 days. */
(function () {
  'use strict';

  // 1) Register the service worker (root scope). Best-effort; never block the app.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (e) { console.warn('[FFP PWA] SW register failed', e); });
    });
  }

  // Already installed? Then never show the banner.
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  if (isStandalone()) return;

  // Respect a recent dismissal (14 days).
  try {
    var until = parseInt(localStorage.getItem('ffp_pwa_dismiss_until') || '0', 10);
    if (until && Date.now() < until) return;
  } catch (e) {}

  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var isSafari = /^((?!chrome|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
  var deferredPrompt = null;

  function dismiss() {
    var b = document.getElementById('ffp-pwa-banner');
    if (b) b.parentNode.removeChild(b);
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

    var style = document.createElement('style');
    style.textContent = '@keyframes ffppwaIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}';
    document.head.appendChild(style);

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

  // Android / desktop Chrome: native install prompt.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(function () {
      banner(
        '<div style="font-size:14px;font-weight:800;letter-spacing:-.1px;">Install FFP Passport</div>' +
        '<div style="font-size:12px;color:#9fb4c4;margin-top:2px;line-height:1.4;">Add it to your home screen — opens full-screen and keeps you signed in.</div>' +
        '<button id="ffp-pwa-install" style="margin-top:10px;background:#1980AD;color:#fff;border:none;border-radius:9px;padding:9px 16px;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;">Install</button>'
      );
    }, 2500);
  });

  window.addEventListener('appinstalled', function () { dismiss(); });

  // iOS Safari: no prompt API — show the manual Share -> Add to Home Screen hint.
  if (isIOS && isSafari) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        banner(
          '<div style="font-size:14px;font-weight:800;letter-spacing:-.1px;">Add FFP Passport to your home screen</div>' +
          '<div style="font-size:12px;color:#9fb4c4;margin-top:3px;line-height:1.5;">Tap the Share button ' +
          '<span style="display:inline-block;vertical-align:-3px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2ba8e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></span> ' +
          'then <strong style="color:#e8eef4;">Add to Home Screen</strong>. It opens full-screen and keeps you signed in.</div>'
        );
      }, 2500);
    });
  }
})();

/* ═══════════════════════════════════════════════════════════════
   FFP Native Push bridge — Phase 1 (2026-06-28)
   Registers the device's FCM push token with the backend WHEN running inside the Capacitor native app.
   In a normal browser this is a NO-OP (returns immediately). Web push (VAPID) is unaffected.
   Wired into the dashboards in Phase 3 (native shell) via <script src="assets/ffp-native-push.js?v=FFP_BUILD">.
   Requires the native plugin @capacitor-firebase/messaging (added in the Capacitor shell).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var API = 'https://ffp-passport-backend.vercel.app';

  function isNative() { try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; } }
  if (!isNative()) return;   // browser / PWA → nothing to do (web push handles those)

  function refreshTok() { try { return (window.FFPAuth && FFPAuth.getRefresh && FFPAuth.getRefresh()) || localStorage.getItem('ffp_refresh') || sessionStorage.getItem('ffp_refresh'); } catch (e) { return null; } }
  function platform() { try { return (window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || null; } catch (e) { return null; } }
  function plugin() { try { return window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseMessaging; } catch (e) { return null; } }
  async function post(path, body) { try { await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) {} }

  async function register() {
    var FM = plugin(); if (!FM) { console.warn('[ffp-native-push] FirebaseMessaging plugin missing'); return; }
    try {
      try { await FM.requestPermissions(); } catch (e) {}
      var res = await FM.getToken();                 // { token }
      var token = res && (res.token || res);
      var rf = refreshTok();
      if (token && rf) await post('/api/push/register-device', { refresh: rf, token: token, platform: platform() });
      // keep the token current if the OS rotates it
      try { FM.addListener && FM.addListener('tokenReceived', function (ev) { var t = ev && (ev.token || ev); var r = refreshTok(); if (t && r) post('/api/push/register-device', { refresh: r, token: t, platform: platform() }); }); } catch (e) {}
      // tap a push → open the deep-linked screen inside the app
      try { FM.addListener && FM.addListener('notificationActionPerformed', function (ev) { var url = ev && ev.notification && ev.notification.data && ev.notification.data.url; if (url) { try { location.assign(url); } catch (e) {} } }); } catch (e) {}
    } catch (e) { console.warn('[ffp-native-push] register failed', e && e.message); }
  }

  // Wait for the member session, then register.
  var tries = 0;
  (function wait() { if (refreshTok()) { register(); return; } if (tries++ < 40) setTimeout(wait, 500); })();

  // Call window.ffpNativePush.unregister() on logout so the device stops receiving pushes for that account.
  window.ffpNativePush = {
    unregister: async function () {
      var FM = plugin(); var rf = refreshTok(); if (!FM || !rf) return;
      try { var res = await FM.getToken(); var token = res && (res.token || res); if (token) await post('/api/push/unregister-device', { refresh: rf, token: token }); } catch (e) {}
    }
  };
  console.log('[FFP Native Push v1] active (native)');
})();

/* FFP Realtime Helper — v2
   Shared utility used by every loader to subscribe to Supabase postgres_changes.
   One consistent pattern across admin, provider, and member dashboards.

   v2 (2026-05-31) — FIX: authenticate the realtime SOCKET with our custom JWT.
   ffp-api-integration applies the JWT as an HTTP Authorization header (for REST/RLS
   reads) but the realtime websocket has its own auth and was connecting as ANON —
   so RLS-protected tables delivered NO change events. v2 calls
   supabase.realtime.setAuth(ffp_jwt) before subscribing, so the socket authenticates
   as the member/admin and RLS policies (member_id = auth.uid() / is_admin / provider)
   authorise the change stream. (Requires REPLICA IDENTITY FULL on the tables — done.)

   Usage in a loader:
     FFPRealtime.subscribe('ffp-admin-events', 'events', null, refresh);
     FFPRealtime.subscribe('ffp-member-events', 'rsvps', 'member_id=eq.' + uid, refresh);
*/
(function () {
  'use strict';

  var channels = {};

  function applyRealtimeAuth() {
    try {
      var jwt = localStorage.getItem('ffp_jwt');
      if (jwt && window.supabase && window.supabase.realtime &&
          typeof window.supabase.realtime.setAuth === 'function') {
        window.supabase.realtime.setAuth(jwt);
      }
    } catch (e) { /* non-fatal */ }
  }

  function waitForSupabase(cb) {
    if (window.supabase && typeof window.supabase.channel === 'function') {
      cb();
      return;
    }
    setTimeout(function () { waitForSupabase(cb); }, 200);
  }

  function doSubscribe(channelName, table, filter, callback) {
    if (channels[channelName]) return;
    try {
      // v2: authenticate the realtime socket with the JWT so RLS-protected
      // tables deliver changes (our JWT lives in localStorage, not a Supabase session).
      applyRealtimeAuth();

      var config = { event: '*', schema: 'public', table: table };
      if (filter) config.filter = filter;

      var ch = window.supabase.channel(channelName);
      ch.on('postgres_changes', config, function (payload) {
        try { callback(payload); }
        catch (e) { console.error('[FFPRealtime] callback error for ' + channelName + ':', e); }
      });
      ch.subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          console.log('[FFPRealtime] ✓ ' + channelName + ' (table: ' + table + ', filter: ' + (filter || 'none') + ')');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[FFPRealtime] ' + status + ' for ' + channelName);
        }
      });
      channels[channelName] = ch;
    } catch (e) {
      console.error('[FFPRealtime] subscribe failed for ' + channelName + ':', e);
    }
  }

  window.FFPRealtime = {
    subscribe: function (channelName, table, filter, callback) {
      if (!channelName || !table || typeof callback !== 'function') {
        console.error('[FFPRealtime] bad args:', channelName, table, callback);
        return;
      }
      waitForSupabase(function () { doSubscribe(channelName, table, filter, callback); });
    },
    unsubscribe: function (channelName) {
      var ch = channels[channelName];
      if (ch && typeof window.supabase.removeChannel === 'function') {
        try { window.supabase.removeChannel(ch); } catch (e) {}
      }
      delete channels[channelName];
    },
    list: function () { return Object.keys(channels); },
    cleanup: function () {
      Object.keys(channels).forEach(function (n) { window.FFPRealtime.unsubscribe(n); });
    }
  };

  window.addEventListener('beforeunload', function () { window.FFPRealtime.cleanup(); });
})();

/* FFP Realtime Helper — v1
   Shared utility used by every loader to subscribe to Supabase postgres_changes.
   One consistent pattern across admin, provider, and member dashboards.

   Usage in a loader:
     FFPRealtime.subscribe('ffp-admin-deals', 'deals', null, refresh);
     FFPRealtime.subscribe('ffp-member-events', 'rsvps', 'member_id=eq.' + uid, refresh);
     FFPRealtime.subscribe('ffp-provider-checkins', 'claims', null, refresh);

   Args:
     channelName: unique string per panel (avoids dup subscriptions)
     table:       table name in public schema
     filter:      postgres-style filter string or null for all rows
     callback:    runs on every INSERT/UPDATE/DELETE that matches
*/
(function () {
  'use strict';

  var channels = {};

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
      var config = { event: '*', schema: 'public', table: table };
      if (filter) config.filter = filter;

      var ch = window.supabase.channel(channelName);
      ch.on('postgres_changes', config, function (payload) {
        try { callback(payload); }
        catch (e) { console.error('[FFPRealtime] callback error for ' + channelName + ':', e); }
      });
      ch.subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          console.log('[FFPRealtime] \u2713 ' + channelName + ' (table: ' + table + ', filter: ' + (filter || 'none') + ')');
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

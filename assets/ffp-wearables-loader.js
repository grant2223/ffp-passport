/* ═══════════════════════════════════════════════════════════════
   FFP WEARABLES LOADER · v1
   File path: assets/ffp-wearables-loader.js (repo root /assets)
   On-load log: [FFP Wearables v1] Loaded ✓
   Lazy-loaded on Profile open (member dashboard _panelLoaderSrc['panel-profile']).
   Owns the Profile › "Connected devices" section: WHOOP (live) + Garmin (coming soon).
   All logic lives HERE, not inline in the dashboard HTML.
     - render()     → paints #mp-wearables from POST /api/wearables/status
     - connect(p)   → POST /api/wearables/connect → opens the provider auth widget
     - disconnect(p)→ POST /api/wearables/disconnect → re-render
   The OAuth return (?wearable=...) toast is handled inline in the dashboard (must run on page load).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var API = 'https://ffp-passport-backend.vercel.app';
  function refreshTok() { try { return localStorage.getItem('ffp_refresh'); } catch (e) { return null; } }

  window.ffpWearables = {
    async render() {
      var host = document.getElementById('mp-wearables'); if (!host) return;
      var connected = {};
      var rf = refreshTok();
      if (rf) {
        try {
          var r = await fetch(API + '/api/wearables/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: rf }) });
          var j = await r.json();
          (j && j.providers || []).forEach(function (p) { connected[p.provider] = p; });
        } catch (e) {}
      }
      function syncLabel(p) { if (!p || !p.last_synced_at) return 'Connected'; try { return 'Synced ' + new Date(p.last_synced_at).toLocaleDateString(); } catch (e) { return 'Connected'; } }
      function row(provider, name, sub, live) {
        var c = connected[provider], right, status;
        if (!live) { right = '<span style="font-size:11px;font-weight:800;color:var(--muted);">Coming soon</span>'; status = '<div style="font-size:11px;color:var(--muted);margin-top:2px;">' + sub + '</div>'; }
        else if (c) {
          right = '<button type="button" onclick="ffpWearables.disconnect(\'' + provider + '\')" style="background:none;border:1px solid var(--border-mid);color:var(--muted);border-radius:9px;padding:7px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Disconnect</button>';
          status = '<div style="font-size:11px;color:#16a34a;font-weight:800;margin-top:2px;">' + syncLabel(c) +
            ' · <a onclick="ffpWearables.sync(\'' + provider + '\')" style="color:#1980AD;cursor:pointer;">Sync now</a></div>';
        } else {
          right = '<button type="button" onclick="ffpWearables.connect(\'' + provider + '\')" style="background:#1980AD;border:none;color:#fff;border-radius:9px;padding:8px 16px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Connect</button>';
          status = '<div style="font-size:11px;color:var(--muted);margin-top:2px;">' + sub + '</div>';
        }
        return '<div style="display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid var(--border);">' +
          '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:800;color:var(--text);">' + name + '</div>' + status + '</div>' + right + '</div>';
      }
      host.innerHTML = row('whoop', 'WHOOP', 'Auto-log your workouts, heart rate & calories', true) +
        row('garmin', 'Garmin', 'Auto-log your workouts (coming soon)', false) +
        '<div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.5;">Connect a device and your workouts log to your Passport automatically — no manual entry.</div>';
    },
    async connect(provider) {
      var rf = refreshTok();
      if (!rf) { if (window.showToast) showToast('Please sign in again', 'error'); return; }
      try {
        var r = await fetch(API + '/api/wearables/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: rf, provider: provider }) });
        var j = await r.json().catch(function () { return null; });
        if (j && j.url) { window.location.href = j.url; return; }
        if (window.showToast) showToast(provider === 'whoop' ? 'WHOOP isn’t switched on yet' : 'Not available yet', 'error');
      } catch (e) { if (window.showToast) showToast('Could not start connect', 'error'); }
    },
    async sync(provider) {
      var rf = refreshTok(); if (!rf) return;
      if (window.showToast) showToast('Syncing from ' + provider.toUpperCase() + '…');
      try {
        var r = await fetch(API + '/api/wearables/' + provider + '/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: rf }) });
        var j = await r.json().catch(function () { return null; });
        if (j && j.ok) {
          if (window.showToast) showToast('Synced ' + (j.synced || 0) + ' workout' + (j.synced === 1 ? '' : 's') + (j.synced ? '' : ' (nothing new)'), 'success');
          try { if (window.loadJourneyLogs) window.loadJourneyLogs(); } catch (e) {}
          this.render();
        } else { if (window.showToast) showToast('Sync failed — try again', 'error'); }
      } catch (e) { if (window.showToast) showToast('Sync failed — try again', 'error'); }
    },
    async disconnect(provider) {
      if (!window.confirm('Disconnect ' + provider.toUpperCase() + '? Your past activities stay, but new ones won’t sync.')) return;
      var rf = refreshTok();
      try { await fetch(API + '/api/wearables/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: rf, provider: provider }) }); } catch (e) {}
      if (window.showToast) showToast(provider.toUpperCase() + ' disconnected');
      this.render();
    }
  };

  // First open: the Profile body may render slightly after this loader injects — poll briefly for the
  // section, then paint. Re-opens are driven by the dashboard's panel-show hook calling render().
  var tries = 0;
  (function tryRender() {
    if (document.getElementById('mp-wearables')) { window.ffpWearables.render(); return; }
    if (tries++ < 40) setTimeout(tryRender, 150);
  })();
  console.log('[FFP Wearables v1] Loaded ✓');
})();

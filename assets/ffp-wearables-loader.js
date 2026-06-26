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
        '<div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.5;">Connect a device and your workouts log to your Passport automatically — no manual entry.</div>' +
        (connected['whoop'] ? '<div style="font-size:10.5px;color:var(--muted);margin-top:8px;">Workouts synced from WHOOP.</div>' : '');
      if (connected['whoop']) { try { this._renderDaily(); } catch (e) {} }
    },
    async _renderDaily() {
      var rf = refreshTok(); if (!rf) return;
      var days = [];
      try {
        var r = await fetch(API + '/api/wearables/daily', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: rf }) });
        var j = await r.json(); days = (j && j.days) || [];
      } catch (e) { return; }
      if (!days.length) return;
      function latest(k) { for (var i = 0; i < days.length; i++) { if (days[i][k] != null) return days[i][k]; } return null; }
      var rec = latest('recovery_pct'), strain = latest('strain'), rhr = latest('resting_hr'), hrv = latest('hrv_ms');
      var sleeps = days.filter(function (d) { return d.sleep_hours != null; }).slice(0, 7);
      var lastSleep = sleeps.length ? sleeps[0].sleep_hours : null;
      var avgSleep = sleeps.length ? (Math.round(sleeps.reduce(function (a, d) { return a + Number(d.sleep_hours); }, 0) / sleeps.length * 10) / 10) : null;
      var tiles = [];
      if (rec != null) tiles.push(['Recovery', rec + '%']);
      if (strain != null) tiles.push(['Strain', String(strain)]);
      if (lastSleep != null) tiles.push(['Sleep', lastSleep + 'h']);
      if (rhr != null) tiles.push(['Rest HR', String(rhr)]);
      if (hrv != null) tiles.push(['HRV', hrv + 'ms']);
      if (!tiles.length) return;
      var host = document.getElementById('mp-wearables'); if (!host) return;
      var card = '<div style="margin-top:14px;background:rgba(43,168,224,0.06);border-radius:14px;padding:14px 16px;">' +
        '<div style="font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;">From WHOOP · latest</div>' +
        '<div style="display:flex;gap:16px;flex-wrap:wrap;">' +
        tiles.map(function (t) { return '<div style="text-align:center;min-width:52px;"><div style="font-size:20px;font-weight:800;color:var(--text);">' + t[1] + '</div><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin-top:2px;">' + t[0] + '</div></div>'; }).join('') +
        '</div>' +
        (avgSleep != null ? '<div style="font-size:11px;color:var(--muted);margin-top:10px;">7-night sleep average: ' + avgSleep + 'h</div>' : '') +
        '</div>';
      host.insertAdjacentHTML('beforeend', card);
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

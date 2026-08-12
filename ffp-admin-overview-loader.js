/* FFP Admin Overview Loader — v10 (2026-08-09)
   v10: FIX blank Overview. The panel was calling admin_overview() before Supabase had
        finished RESTORING its auth session (ffp-admin-auth dispatches 'ffp-admin-ready'
        synchronously from localStorage, ahead of supabase.auth). The RPC therefore fired
        ANONYMOUS → is_admin() false → 'not authorized' → the loader swallowed the error →
        every KPI stayed as a dash. Now load() first awaits a real session
        (supabase.auth.getSession, polled) and RETRIES once on any error/empty result, and
        the dashboard re-fires refresh() whenever the Overview panel is shown.
   v9: event-driven — loads on confirmed admin session (ffp-admin-ready), never races a
       timeout into an unauthenticated "not authorized" call.
   v8 (history):
   v8: Content badge + queue card now use REAL content_submissions pending count
       (content_pending) instead of the events/experiences/challenges rollup — those
       pending listings already show on their own sidebar badges (Events/etc.).
   v7 (2026-05-31)
   ONE round-trip: calls admin_overview() RPC for every KPI, action-queue count,
   sidebar pending badge, and recent-activity row (was ~13 separate queries → the
   page was serializing them behind the browser's 6-connection limit ≈ 15s).
   Default panel, so it loads eagerly; owns the sidebar pending badges. Realtime
   triggers a single debounced re-call. USD. Admin reads via is_admin (RPC guard).
*/
(function () {
  'use strict';

  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  async function waitFor(check, ms) {
    var t = 0, lim = Math.ceil((ms || 20000) / 100);
    while (!check() && t < lim) { await new Promise(function (r) { setTimeout(r, 100); }); t++; }
    return check();
  }
  function dnum(n) { return Number(n || 0).toLocaleString(); }

  function setKpi(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; }
  function setDeltaFor(id, txt) {
    var el = document.getElementById(id); if (!el) return;
    var tile = el.closest('.kpi-tile'); if (!tile) return;
    var d = tile.querySelector('.kpi-delta');
    if (d) d.innerHTML = txt ? ('<span class="material-icons">insights</span>' + esc(txt)) : '';
  }
  function setNavBadge(panel, n) {
    var link = document.querySelector('.sidebar-link[data-panel="' + panel + '"]');
    if (!link) return;
    var b = link.querySelector('.ffp-pending-badge');
    if (n > 0) { if (!b) { b = document.createElement('span'); b.className = 'sidebar-link-badge ffp-pending-badge'; link.appendChild(b); } b.textContent = n > 99 ? '99+' : String(n); b.style.display = ''; }
    else if (b) { b.style.display = 'none'; }
  }
  function setIdBadge(id, n) { var b = document.getElementById(id); if (!b) return; b.textContent = n > 99 ? '99+' : String(n); b.style.display = n > 0 ? '' : 'none'; }
  function setContentBadge(n) { var b = document.getElementById('badge-content'); if (!b) return; b.textContent = n > 99 ? '99+' : String(n); b.style.display = n > 0 ? '' : 'none'; }
  function setQueue(route, count, meta) {
    var card = document.querySelector('#panel-overview .queue-card[onclick*="' + route + '"]');
    if (!card) return;
    var c = card.querySelector('.queue-card-count'); if (c) c.textContent = count;
    var m = card.querySelector('.queue-card-meta'); if (m) m.textContent = meta;
    card.classList.toggle('urgent', count > 0);
  }
  function rel(ts) {
    if (!ts) return '';
    var diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }
  function initial(n) { return (n && n.length) ? n[0].toUpperCase() : '?'; }

  // The admin client authenticates via a stored JWT header (persistSession:false), so
  // supabase.auth.getSession() is ALWAYS empty — polling it just wasted up to 15s on every load.
  // What actually makes admin_overview() authorised is the stored JWT / admin identity, so wait for THAT.
  async function waitForSession(ms) {
    var lim = Math.ceil((ms || 6000) / 100);
    for (var i = 0; i < lim; i++) {
      if (window.FFP_ADMIN || (window.FFPAuth && FFPAuth.getJwt && FFPAuth.getJwt())) return true;
      await new Promise(function (r) { setTimeout(r, 100); });
    }
    return false;
  }

  var _loadedOnce = false;
  async function load(attempt) {
    attempt = attempt || 0;
    try {
      if (!window.supabase) return;
      await waitForSession(attempt === 0 ? 6000 : 2000);
      var r = await window.supabase.rpc('admin_overview');
      if (r.error || !r.data) {
        // Session may still be attaching on first paint — retry a couple of times before giving up.
        if (attempt < 4) { setTimeout(function () { load(attempt + 1); }, 700); return; }
        console.warn('[FFP Admin Overview] rpc:', r.error && r.error.message);
        return;
      }
      _loadedOnce = true;
      var d = r.data; if (!d) return;

      setKpi('kpi-total-members', dnum(d.members_total));
      setKpi('kpi-active', dnum(d.active_30d));
      var mrr = document.getElementById('kpi-mrr');
      if (mrr) mrr.innerHTML = '<span style="font-size:14px; color:var(--muted);">$</span> ' + dnum(d.mrr_usd);
      setKpi('kpi-providers', dnum(d.providers_approved));
      setDeltaFor('kpi-active', d.members_total ? (Math.round(d.active_30d / d.members_total * 100) + '% of members') : '');
      setDeltaFor('kpi-providers', d.apps_pending + ' pending');

      var contentPending = (d.content_pending || 0);
      setQueue('panel-providers', d.apps_pending, d.apps_pending ? 'Awaiting review' : 'None waiting');
      setQueue('panel-payouts', d.payouts_pending_count, d.payouts_pending_count ? ('$' + dnum(d.payouts_pending_sum) + ' total') : 'None pending');
      setQueue('panel-content', contentPending, contentPending ? 'Submissions to review' : 'None pending');
      setQueue('panel-referrals', d.referrals_pending, d.referrals_pending ? 'To verify' : 'None pending');
      var total = (d.apps_pending || 0) + (d.payouts_pending_count || 0) + contentPending + (d.referrals_pending || 0);
      setKpi('queue-total-count', total + ' item' + (total === 1 ? '' : 's'));

      setNavBadge('panel-events', d.events_pending);
      setNavBadge('panel-experiences', d.experiences_pending);
      setNavBadge('panel-challenges', d.challenges_pending);
      setContentBadge(contentPending);
      setIdBadge('badge-payouts', d.payouts_pending_count);
      setIdBadge('badge-referrals', d.referrals_pending);
      setIdBadge('badge-feedback', d.feedback_new);

      var feed = document.getElementById('activity-feed');
      if (feed) {
        var items = d.recent || [];
        feed.innerHTML = items.length ? items.map(function (it) {
          return '<tr><td class="text-muted nowrap">' + esc(rel(it.ts)) + '</td>' +
            '<td><div style="display:flex;align-items:center;gap:10px;"><div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#1980AD,#2ba8e0);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">' + esc(initial(it.who)) + '</div><strong>' + esc(it.who) + '</strong></div></td>' +
            '<td class="text-muted">' + esc(it.what) + '</td></tr>';
        }).join('') : '<tr><td colspan="3" class="text-muted" style="text-align:center;padding:24px;">No activity yet</td></tr>';
      }
    } catch (e) {
      if (attempt < 4) { setTimeout(function () { load(attempt + 1); }, 700); return; }
      console.error('[FFP Admin Overview] load:', e);
    }
  }

  async function init() {
    var ready = await waitFor(function () { return window.supabase && document.getElementById('panel-overview'); }, 20000);
    if (!ready) return;
    window.FFPAdminOverview = { refresh: function () { load(0); } };
    // v10: fire load() once the admin identity is known, but load() itself waits for the
    // Supabase SESSION before calling the RPC (so it can't run anonymous). Cover every timing:
    //  (a) the ffp-admin-ready event (sign-in after this loader initialised),
    //  (b) a poll for window.FFP_ADMIN in case the event fired before this listener attached.
    document.addEventListener('ffp-admin-ready', function () { load(0); });
    (async function () {
      var ok = await waitFor(function () { return !!window.FFP_ADMIN; }, 20000);
      if (ok) { try { await load(0); console.log('[FFP Admin Overview v10] loaded ✓'); } catch (e) { console.error(e); } }
    })();
    if (window.FFPRealtime) {
      var t = null, bump = function () { clearTimeout(t); t = setTimeout(load, 800); };
      ['events', 'trips', 'challenges', 'provider_applications', 'payouts', 'referrals', 'members', 'providers', 'activity_logs'].forEach(function (tbl) {
        window.FFPRealtime.subscribe('admin-ov-' + tbl, tbl, null, bump);
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* FFP Admin Overview Loader — v7 (2026-05-31)
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

  async function load() {
    try {
      var r = await window.supabase.rpc('admin_overview');
      if (r.error) { console.warn('[FFP Admin Overview] rpc:', r.error.message); return; }
      var d = r.data; if (!d) return;

      setKpi('kpi-total-members', dnum(d.members_total));
      setKpi('kpi-active', dnum(d.active_30d));
      var mrr = document.getElementById('kpi-mrr');
      if (mrr) mrr.innerHTML = '<span style="font-size:14px; color:var(--muted);">$</span> ' + dnum(d.mrr_usd);
      setKpi('kpi-providers', dnum(d.providers_approved));
      setDeltaFor('kpi-active', d.members_total ? (Math.round(d.active_30d / d.members_total * 100) + '% of members') : '');
      setDeltaFor('kpi-providers', d.apps_pending + ' pending');

      var content = (d.events_pending || 0) + (d.experiences_pending || 0) + (d.challenges_pending || 0);
      setQueue('panel-providers', d.apps_pending, d.apps_pending ? 'Awaiting review' : 'None waiting');
      setQueue('panel-payouts', d.payouts_pending_count, d.payouts_pending_count ? ('$' + dnum(d.payouts_pending_sum) + ' total') : 'None pending');
      setQueue('panel-content', content, content ? 'Listings to review' : 'None pending');
      setQueue('panel-referrals', d.referrals_pending, d.referrals_pending ? 'To verify' : 'None pending');
      var total = (d.apps_pending || 0) + (d.payouts_pending_count || 0) + content + (d.referrals_pending || 0);
      setKpi('queue-total-count', total + ' item' + (total === 1 ? '' : 's'));

      setNavBadge('panel-events', d.events_pending);
      setNavBadge('panel-experiences', d.experiences_pending);
      setNavBadge('panel-challenges', d.challenges_pending);
      setContentBadge(content);
      setIdBadge('badge-payouts', d.payouts_pending_count);
      setIdBadge('badge-referrals', d.referrals_pending);

      var feed = document.getElementById('activity-feed');
      if (feed) {
        var items = d.recent || [];
        feed.innerHTML = items.length ? items.map(function (it) {
          return '<tr><td class="text-muted nowrap">' + esc(rel(it.ts)) + '</td>' +
            '<td><div style="display:flex;align-items:center;gap:10px;"><div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#1980AD,#2ba8e0);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">' + esc(initial(it.who)) + '</div><strong>' + esc(it.who) + '</strong></div></td>' +
            '<td class="text-muted">' + esc(it.what) + '</td></tr>';
        }).join('') : '<tr><td colspan="3" class="text-muted" style="text-align:center;padding:24px;">No activity yet</td></tr>';
      }
    } catch (e) { console.error('[FFP Admin Overview] load:', e); }
  }

  async function init() {
    var ready = await waitFor(function () { return window.supabase && document.getElementById('panel-overview'); }, 20000);
    if (!ready) return;
    await waitFor(function () { return window.FFP_ADMIN || (window.FFPAuth && window.FFPAuth.getMember && window.FFPAuth.getMember()); }, 20000);
    try { await load(); console.log('[FFP Admin Overview v7] loaded ✓ (single RPC)'); } catch (e) { console.error(e); }
    window.FFPAdminOverview = { refresh: load };
    if (window.FFPRealtime) {
      var t = null, bump = function () { clearTimeout(t); t = setTimeout(load, 800); };
      ['events', 'experiences', 'challenges', 'provider_applications', 'payouts', 'referrals', 'members', 'providers', 'activity_logs'].forEach(function (tbl) {
        window.FFPRealtime.subscribe('admin-ov-' + tbl, tbl, null, bump);
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

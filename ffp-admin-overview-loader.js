/* FFP Admin Overview Loader — v5 (realtime + owns sidebar pending badges) (2026-05-31)
   v3: fills EMPTY hooks in the cleaned Overview (demo data removed from the HTML
       per the no-patches rule). No overwriting, no text-matching.
   Replaces the static demo numbers on the admin Overview with REAL data.
   Per-panel-loader pattern; patches #panel-overview at runtime. One <script> tag
   (root, after ffp-admin-providers-loader.js).

   v2 (clean-structure pass):
   - Binds to STABLE hooks (element IDs + the queue cards' existing App.go route),
     never to visible label text → safe against copy/label changes.
     Needs two tiny IDs added to the dashboard: #kpi-mrr and #queue-total-count.
   - Runs all independent Supabase reads in PARALLEL (Promise.all) → fast load.
   - Helpers kept self-contained per current loader convention (shared ffp-utils.js
     is a separate, deferred refactor — out of scope pre-launch).

   KPIs: Total Members / Active 30d (distinct activity_logs) / MRR (approved provider
   fees, AED→USD peg) / Approved Providers (+ real "N pending").
   Action queue: applications / payouts / content (events+exp+challenges) / referrals.
   Recent activity: merged real feed (signups + provider applications + payouts).

   CURRENCY: member/platform = USD (the _aed columns store USD for member-facing
   amounts per the confirmed decision); provider billing = AED. MRR converts AED→USD.
   To change MRR basis or currency, edit AED_PER_USD / the providers query only.
*/
(function () {
  'use strict';

  var AED_PER_USD = 3.6725; // AED pegged to USD

  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  async function waitFor(check, ms) {
    var t = 0, lim = Math.ceil((ms || 20000) / 100);
    while (!check() && t < lim) { await new Promise(function (r) { setTimeout(r, 100); }); t++; }
    return check();
  }
  function usd(aed) { return Math.round((aed || 0) / AED_PER_USD); }

  // ── data helpers (return primitives/arrays; callers Promise.all them) ──
  async function countEq(table, col, val) {
    try { var r = await window.supabase.from(table).select('*', { count: 'exact', head: true }).eq(col, val); return r.error ? 0 : (r.count || 0); }
    catch (e) { return 0; }
  }
  async function countAll(table) {
    try { var r = await window.supabase.from(table).select('*', { count: 'exact', head: true }); return r.error ? 0 : (r.count || 0); }
    catch (e) { return 0; }
  }
  async function selData(table, sel, fn) {
    try { var q = window.supabase.from(table).select(sel); if (fn) q = fn(q); var r = await q; if (r.error) { console.warn('[FFP Admin Overview] ' + table + ':', r.error.message); return []; } return r.data || []; }
    catch (e) { console.warn('[FFP Admin Overview] ' + table, e); return []; }
  }

  // ── DOM hooks (stable IDs + route selectors only) ──
  function setKpi(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; }
  function setNavBadge(panel, n) {
    var link = document.querySelector('.sidebar-link[data-panel="' + panel + '"]');
    if (!link) return;
    var b = link.querySelector('.ffp-pending-badge');
    if (n > 0) { if (!b) { b = document.createElement('span'); b.className = 'sidebar-link-badge ffp-pending-badge'; link.appendChild(b); } b.textContent = n > 99 ? '99+' : String(n); b.style.display = ''; }
    else if (b) { b.style.display = 'none'; }
  }
  function setDeltaFor(id, txt) {
    var el = document.getElementById(id); if (!el) return;
    var tile = el.closest('.kpi-tile'); if (!tile) return;
    var d = tile.querySelector('.kpi-delta');
    if (d) d.innerHTML = txt ? ('<span class="material-icons">insights</span>' + esc(txt)) : '';
  }
  function setQueueByRoute(route, count, meta) {
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

  async function loadActivity() {
    var feed = document.getElementById('activity-feed');
    if (!feed) return;

    var res = await Promise.all([
      selData('members', 'full_name, given_names, email, paid, created_at', function (q) { return q.order('created_at', { ascending: false }).limit(6); }),
      selData('provider_applications', 'business_name, contact_name, created_at', function (q) { return q.order('created_at', { ascending: false }).limit(6); }),
      selData('payouts', 'amount_aed, requested_at', function (q) { return q.order('requested_at', { ascending: false }).limit(6); })
    ]);

    var items = [];
    res[0].forEach(function (m) {
      var nm = m.full_name || m.given_names || (m.email ? m.email.split('@')[0] : 'New member');
      items.push({ ts: m.created_at, who: nm, what: 'Signed up' + (m.paid ? ' · paid' : '') });
    });
    res[1].forEach(function (a) { items.push({ ts: a.created_at, who: a.business_name || a.contact_name || 'Business', what: 'Submitted provider application' }); });
    res[2].forEach(function (p) { items.push({ ts: p.requested_at, who: 'Member', what: 'Requested payout · $' + (p.amount_aed || 0).toLocaleString() }); });

    items = items.filter(function (x) { return x.ts; }).sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); }).slice(0, 8);

    feed.innerHTML = items.length ? items.map(function (it) {
      return '<tr>' +
        '<td class="text-muted nowrap">' + esc(rel(it.ts)) + '</td>' +
        '<td><div style="display:flex;align-items:center;gap:10px;">' +
          '<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#1980AD,#2ba8e0);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">' + esc(initial(it.who)) + '</div>' +
          '<strong>' + esc(it.who) + '</strong></div></td>' +
        '<td class="text-muted">' + esc(it.what) + '</td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="3" class="text-muted" style="text-align:center;padding:24px;">No activity yet</td></tr>';
  }

  async function loadOverview() {
    var since = new Date(Date.now() - 30 * 86400000).toISOString();

    var r = await Promise.all([
      countAll('members'),                                                   // 0
      countEq('providers', 'status', 'approved'),                            // 1
      selData('activity_logs', 'member_id', function (q) { return q.gte('logged_at', since); }), // 2
      selData('providers', 'monthly_fee_aed', function (q) { return q.eq('status', 'approved'); }), // 3
      countEq('provider_applications', 'status', 'pending'),                 // 4
      countEq('referrals', 'status', 'pending'),                             // 5
      selData('payouts', 'amount_aed', function (q) { return q.eq('status', 'pending'); }),         // 6
      countEq('events', 'status', 'pending'),                                // 7
      countEq('experiences', 'status', 'pending'),                           // 8
      countEq('challenges', 'status', 'pending')                             // 9
    ]);

    var membersTotal = r[0], providersApproved = r[1];
    var activeSet = {}; r[2].forEach(function (x) { if (x.member_id) activeSet[x.member_id] = 1; });
    var active = Object.keys(activeSet).length;
    var mrrUsd = usd(r[3].reduce(function (a, p) { return a + (p.monthly_fee_aed || 0); }, 0));
    var appsPending = r[4], refsPending = r[5];
    var payoutCount = r[6].length, payoutSum = r[6].reduce(function (a, p) { return a + (p.amount_aed || 0); }, 0);
    var contentPending = r[7] + r[8] + r[9];
    setNavBadge('panel-events', r[7]); setNavBadge('panel-experiences', r[8]); setNavBadge('panel-challenges', r[9]);

    // KPIs (by stable ID)
    setKpi('kpi-total-members', membersTotal.toLocaleString());
    setKpi('kpi-active', active.toLocaleString());
    var mrr = document.getElementById('kpi-mrr');
    if (mrr) mrr.innerHTML = '<span style="font-size:14px; color:var(--muted);">$</span> ' + mrrUsd.toLocaleString();
    setKpi('kpi-providers', providersApproved.toLocaleString());

    setDeltaFor('kpi-active', membersTotal ? (Math.round(active / membersTotal * 100) + '% of members') : '');
    setDeltaFor('kpi-providers', appsPending + ' pending');

    // Action queue (by stable route selector)
    setQueueByRoute('panel-providers', appsPending, appsPending ? 'Awaiting review' : 'None waiting');
    setQueueByRoute('panel-payouts', payoutCount, payoutCount ? ('$' + payoutSum.toLocaleString() + ' total') : 'None pending');
    setQueueByRoute('panel-content', contentPending, contentPending ? 'Listings to review' : 'None pending');
    setQueueByRoute('panel-referrals', refsPending, refsPending ? 'To verify' : 'None pending');

    var total = appsPending + payoutCount + contentPending + refsPending;
    setKpi('queue-total-count', total + ' item' + (total === 1 ? '' : 's'));

    await loadActivity();
  }

  async function init() {
    var ready = await waitFor(function () { return window.supabase && document.getElementById('panel-overview'); }, 20000);
    if (!ready) { console.warn('[FFP Admin Overview] not ready'); return; }
    await waitFor(function () { return window.FFP_ADMIN || (window.FFPAuth && window.FFPAuth.getMember && window.FFPAuth.getMember()); }, 20000);
    try { await loadOverview(); console.log('[FFP Admin Overview v3] loaded ✓'); }
    catch (e) { console.error('[FFP Admin Overview] init:', e); }
    window.FFPAdminOverview = { refresh: loadOverview };
    if (window.FFPRealtime) {
      var _ovTables = ['events','experiences','challenges','provider_applications','payouts','referrals','members','providers','activity_logs'];
      var _ovT = null;
      var _ovBump = function () { clearTimeout(_ovT); _ovT = setTimeout(loadOverview, 800); };
      _ovTables.forEach(function (tbl) { window.FFPRealtime.subscribe('admin-ov-' + tbl, tbl, null, _ovBump); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

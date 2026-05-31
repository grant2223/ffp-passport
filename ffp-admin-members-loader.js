/* FFP Admin Members Loader — v4 (2026-05-31)
   v4: event-driven fetch on confirmed admin session (ffp-admin-ready) — fixes empty list
       when the loader initialised before sign-in.
   v3 (history):
   v3: also fetch tier_expires_at so the admin can see/set a tier expiry per member.
   v1 (history):
   Wires the admin Members panel to real Supabase data + real-time.
   Per-panel-loader pattern: overrides AdminMembers' data + render with live rows
   (the inline demo array is stripped from the dashboard). Renders into #members-tbody
   via the panel's existing render(); search/filter chips keep working.

   Admin reads all members via is_admin RLS. Balance shown as-is (USD per decision).
   Real-time: refreshes on any members change (signup, tier/balance/status update).
*/
(function () {
  'use strict';

  function getAM() { return (typeof AdminMembers !== 'undefined') ? AdminMembers : null; }
  function toast(m, k) { if (typeof window.showToast === 'function') { try { window.showToast(m, k || 'info'); return; } catch (e) {} } console.log('[FFP Admin Members]', m); }
  async function waitFor(check, ms) {
    var t = 0, lim = Math.ceil((ms || 15000) / 100);
    while (!check() && t < lim) { await new Promise(function (r) { setTimeout(r, 100); }); t++; }
    return check();
  }

  function mapForUi(row) {
    var name = row.full_name || row.given_names || (row.email ? row.email.split('@')[0] : 'Member');
    var days = row.created_at ? Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000) : 0;
    return {
      id: row.id,
      full_name: name,
      initial: (name[0] || '?').toUpperCase(),
      email: row.email || '',
      city: row.city || '',
      tier: row.tier || 'member',
      tier_expires_at: row.tier_expires_at || null,
      balance: Number(row.balance_aed || 0),
      daysAgo: days,
      status: row.status || 'active'
    };
  }

  async function fetchMembers() {
    try {
      var res = await window.supabase
        .from('members')
        .select('id, full_name, given_names, email, city, tier, tier_expires_at, balance_aed, status, created_at')
        .order('created_at', { ascending: false });
      if (res.error) { console.error('[FFP Admin Members] fetch:', res.error); toast('Could not load members', 'error'); return []; }
      return (res.data || []).map(mapForUi);
    } catch (e) { console.error('[FFP Admin Members] fetch threw:', e); return []; }
  }

  async function refresh() {
    var am = getAM();
    if (!am) return;
    am.data = await fetchMembers();
    if (typeof am.render === 'function') { try { am.render(); } catch (e) { console.error('[FFP Admin Members] render:', e); } }
  }

  async function init() {
    var ok = await waitFor(function () { return window.supabase && typeof AdminMembers !== 'undefined'; }, 15000);
    if (!ok) { console.error('[FFP Admin Members] dependencies never loaded'); return; }
    var am = getAM();
    am.init = function () { refresh(); };
    am.refresh = refresh;

    // v4: fetch only when the admin session is confirmed (event-driven, no race).
    document.addEventListener('ffp-admin-ready', function () { refresh(); });
    if (window.FFP_ADMIN) refresh();
    console.log('[FFP Admin Members v4] ready');

    if (window.FFPRealtime) {
      window.FFPRealtime.subscribe('admin-members', 'members', null, function () { refresh(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

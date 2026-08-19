/* FFP Admin Members Loader — v6 (2026-08-20)
   v6: admin account management — grant comp Passport, downgrade Passport→Standard, and cancel a
       member's Stripe subscription (no future charge). Actions call the admin-gated backend
       /api/admin/member/subscription; the member drawer's "Manage account" buttons trigger them.
   v5: realtime refresh is suppressed while an admin is editing a tier/expiry control, so
       the expiry date picker is not destroyed mid-selection.
   v4 (history):
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

  // Membership TYPE — what kind of account this really is. Standard (free), Passport (Monthly / Annual /
  // Lifetime / Comp), or NOT a member at all (Partner contact = owns a provider; Test/system account).
  // A "· Pro" suffix flags coaches (professionals table) whose Passport is usually a comp.
  function classify(row, owners, pros) {
    var email = (row.email || '').toLowerCase();
    var isSys = email === 'providers@findfitpeople.com' || email === 'admin@findfitpeople.com' || /^deleted\+/.test(email) || /@ffp\.invalid$/.test(email);
    var ownsProvider = !!owners[row.id];
    var isPro = !!pros[row.id];
    var passport = (row.membership || 'free') === 'passport';
    var plan = row.plan || '';
    var hasSub = !!row.stripe_subscription_id;
    var lifetime = plan === 'lifetime';
    var label, bg, fg;
    if (ownsProvider) { label = 'Partner contact'; bg = 'rgba(224,137,30,.18)'; fg = '#e0a35a'; }
    else if (isSys) { label = 'Test / system'; bg = 'rgba(255,255,255,.06)'; fg = '#7c8a91'; }
    else if (passport) {
      if (lifetime) { label = 'Passport · Lifetime'; bg = 'rgba(255,204,0,.16)'; fg = '#f2c94c'; }
      else if (plan === 'annual') { label = 'Passport · Annual'; bg = 'rgba(43,168,224,.16)'; fg = '#5cc1ef'; }
      else if (plan === 'monthly') { label = 'Passport · Monthly'; bg = 'rgba(43,168,224,.16)'; fg = '#5cc1ef'; }
      else if (hasSub) { label = 'Passport · Sub'; bg = 'rgba(43,168,224,.16)'; fg = '#5cc1ef'; }
      else { label = 'Passport · Comp'; bg = 'rgba(124,92,255,.16)'; fg = '#a99bff'; }
      if (isPro) label += ' · Pro';
    }
    else { label = 'Standard' + (isPro ? ' · Pro' : ''); bg = 'rgba(255,255,255,.07)'; fg = '#9dbdd0'; }
    return { label: label, bg: bg, fg: fg, passport: passport, nosub: !hasSub, lifetime: lifetime };
  }

  function mapForUi(row, owners, pros) {
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
      status: row.status || 'active',
      role: row.role || 'member',
      verified: !!row.verified,
      mtype: classify(row, owners || {}, pros || {})
    };
  }

  async function fetchMembers() {
    try {
      var out = await Promise.all([
        window.supabase.from('members')
          .select('id, full_name, given_names, email, city, tier, tier_expires_at, balance_aed, status, created_at, role, verified, membership, plan, stripe_subscription_id')
          .order('created_at', { ascending: false }),
        window.supabase.from('providers').select('owner_user_id').not('owner_user_id', 'is', null),
        window.supabase.from('professionals').select('member_id')
      ]);
      var res = out[0];
      if (res.error) { console.error('[FFP Admin Members] fetch:', res.error); toast('Could not load members', 'error'); return []; }
      var owners = {}; (out[1] && out[1].data || []).forEach(function (r) { if (r.owner_user_id) owners[r.owner_user_id] = 1; });
      var pros = {}; (out[2] && out[2].data || []).forEach(function (r) { if (r.member_id) pros[r.member_id] = 1; });
      // Show member-login accounts (role='member'); any that own a provider are still shown but flagged
      // "Partner contact" so the admin can see they're not a real member. Provider/admin login rows stay out.
      return (res.data || []).map(function (row) { return mapForUi(row, owners, pros); })
        .filter(function (m) { return m.role === 'member'; });
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

    // Admin marks a member verified (checked as a real/safe person) — or removes it.
    am.toggleVerified = async function (id, val) {
      try {
        var res = await window.supabase.from('members').update({ verified: !!val }).eq('id', id);
        if (res.error) { console.error('[Members] toggleVerified', res.error); toast('Could not update verified status', 'error'); return; }
        var row = (am.data || []).filter(function (x) { return x.id === id; })[0];
        if (row) row.verified = !!val;
        if (typeof am.render === 'function') am.render();
        if (window.AuditLog) AuditLog.add(null, (val ? 'verified' : 'un-verified') + ' member ' + (row ? (row.full_name || row.email) : id));
        toast(val ? 'Member marked verified ✓' : 'Verified status removed', 'success');
      } catch (e) { console.error('[Members] toggleVerified threw', e); toast('Update failed', 'error'); }
    };

    // Admin marks/unmarks a member as Lifetime (only meaningful for a Passport account with no live
    // subscription — Lifetime can't be derived from data, so it's an explicit admin flag on members.plan).
    am.setLifetime = async function (id, on) {
      try {
        var res = await window.supabase.from('members').update({ plan: on ? 'lifetime' : null }).eq('id', id);
        if (res.error) { console.error('[Members] setLifetime', res.error); toast('Could not update', 'error'); return; }
        if (window.AuditLog) { var row = (am.data || []).filter(function (x) { return x.id === id; })[0]; AuditLog.add(null, (on ? 'marked lifetime' : 'removed lifetime') + ' — ' + (row ? (row.full_name || row.email) : id)); }
        toast(on ? 'Marked Lifetime ★' : 'Lifetime removed', 'success');
        refresh();
      } catch (e) { console.error('[Members] setLifetime threw', e); toast('Update failed', 'error'); }
    };

    // v6: admin account management — flip Standard↔Passport + cancel subscription (no future charge).
    // Membership changes + Stripe cancel go through the admin-gated backend so Stripe is handled server-side.
    var BACKEND = 'https://ffp-passport-backend.vercel.app';
    function jwtHeader() { var t = null; try { t = localStorage.getItem('ffp_jwt'); } catch (e) {} return t ? { 'Authorization': 'Bearer ' + t } : {}; }
    async function adminSub(id, action, months) {
      var res = await fetch(BACKEND + '/api/admin/member/subscription', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, jwtHeader()),
        body: JSON.stringify({ member_id: id, action: action, months: months })
      });
      var out = await res.json().catch(function () { return {}; });
      if (!res.ok || out.error) throw new Error(out.error || ('HTTP ' + res.status));
      return out;
    }
    async function afterChange(id, label) {
      if (window.AuditLog) AuditLog.add(null, label + ' — member ' + id);
      await refresh();
      // Reopen the drawer so it reflects the new membership state.
      try { if (window.Drawer && Drawer.current && Drawer.current.data && Drawer.current.data.id === id) Drawer.openMember(id); } catch (e) {}
    }
    am.grantPassport = async function (id) {
      if (!confirm('Switch this member to a Passport account? (No Stripe charge — use for members who have paid another way.)')) return;
      try { await adminSub(id, 'grant_passport', 12); toast('Switched to Passport', 'success'); await afterChange(id, 'switched to Passport'); }
      catch (e) { console.error('[Members] grantPassport', e); toast(e.message || 'Could not switch to Passport', 'error'); }
    };
    am.makeStandard = async function (id) {
      if (!confirm('Downgrade this member to Standard now and stop any future charge?')) return;
      try { await adminSub(id, 'make_standard'); toast('Downgraded to Standard · no future charge', 'success'); await afterChange(id, 'downgraded to Standard'); }
      catch (e) { console.error('[Members] makeStandard', e); toast(e.message || 'Could not downgrade', 'error'); }
    };
    am.cancelSubscription = async function (id) {
      if (!confirm('Cancel this member\'s subscription so they are NOT charged again? They keep Passport until the current period ends.')) return;
      try { await adminSub(id, 'cancel'); toast('Subscription cancelled · no future charge', 'success'); await afterChange(id, 'cancelled subscription'); }
      catch (e) { console.error('[Members] cancelSubscription', e); toast(e.message || 'Could not cancel', 'error'); }
    };

    // v4: fetch only when the admin session is confirmed (event-driven, no race).
    document.addEventListener('ffp-admin-ready', function () { refresh(); });
    if (window.FFP_ADMIN) refresh();
    console.log('[FFP Admin Members v4] ready');

    if (window.FFPRealtime) {
      window.FFPRealtime.subscribe('admin-members', 'members', null, function () {
        // v5: never rebuild the table while the admin is mid-edit on a tier/expiry control,
        // or we'd wipe the open date picker. Re-render once they're done.
        var ae = document.activeElement;
        if (ae && ae.classList && (ae.classList.contains('tier-select') || ae.classList.contains('tier-expiry'))) return;
        refresh();
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* FFP Admin Members Loader — v7 (2026-08-29)
   v7: NEW full-screen member INFO PAGE (AdminMembers.info) — clicking a member row opens a read view:
       identity (email/phone/gender/DOB+age/nationality/location), membership & billing (Premium/Standard,
       plan, renews, Stripe customer/subscription, balance), account (since/status/profile-complete/
       referral code/referred-by→links to that member/activities logged), + Manage-account actions
       (downgrade/switch to Premium, cancel, set referrer, erase). Row click was Drawer.openMember →
       now AdminMembers.info. Fetches the full member row fresh by id (works from the provider page link too).
   --- v6 ---
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

  // ─── Member INFO PAGE (full-screen read view) ───
  function e_(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtD(d) { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (x) { return '—'; } }
  function ageFrom(dob) { if (!dob) return null; var b = new Date(dob), n = new Date(); var a = n.getFullYear() - b.getFullYear(); var m = n.getMonth() - b.getMonth(); if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--; return a; }
  function injectInfoStylesM() {
    if (document.getElementById('ffp-info-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-info-css';
    css.textContent = [
      '.pinfo-ov{position:fixed;inset:0;z-index:9990;background:#06101a;overflow-y:auto;font-family:Montserrat,system-ui,sans-serif;color:#eaf1f6;display:none;}',
      '.pinfo-ov.open{display:block;}',
      '.pinfo-wrap{max-width:940px;margin:0 auto;padding:26px 20px 70px;}',
      '.pinfo-crumb{display:flex;align-items:center;gap:7px;color:#8499a8;font-size:13px;font-weight:700;margin-bottom:14px;cursor:pointer;width:max-content;}',
      '.pinfo-crumb .material-icons{font-size:18px;color:#2b9fd0;}',
      '.pinfo-shell{background:#0a141c;border:1px solid rgba(255,255,255,.09);border-radius:20px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.5);}',
      '.pinfo-hero{position:relative;padding:26px 30px 22px;background:radial-gradient(120% 150% at 88% -20%,rgba(43,159,208,.22),transparent 55%),linear-gradient(135deg,#143046,#0b1a26);border-bottom:1px solid rgba(255,255,255,.09);}',
      '.pinfo-hbar{display:flex;align-items:flex-start;gap:18px;}',
      '.pinfo-mono{width:74px;height:74px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:900;font-size:24px;color:#3a2600;background:linear-gradient(160deg,#ffe07a,#f4b400);box-shadow:0 10px 24px rgba(244,180,0,.36);overflow:hidden;}',
      '.pinfo-mono img{width:100%;height:100%;object-fit:cover;}',
      '.pinfo-hmid{flex:1;min-width:0;}',
      '.pinfo-name{font-size:27px;font-weight:900;letter-spacing:-.02em;line-height:1.06;}',
      '.pinfo-sub{margin-top:5px;color:#c7d7e1;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.pinfo-sub .dot{color:#5f7482;}',
      '.pinfo-acts{display:flex;gap:10px;flex:none;flex-wrap:wrap;}',
      '.pinfo-btn{border:0;border-radius:11px;padding:11px 16px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;}',
      '.pinfo-btn .material-icons{font-size:18px;}',
      '.pinfo-btn.gold{background:linear-gradient(180deg,#ffd23d,#f0b400);color:#3a2600;}',
      '.pinfo-btn.ghost{background:rgba(255,255,255,.06);color:#dbe8f0;}',
      '.pinfo-btn.danger{background:transparent;color:#f0938a;border:1px solid rgba(226,87,76,.4);}',
      '.pinfo-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;}',
      '.pinfo-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;}',
      '.pinfo-chip .material-icons{font-size:15px;}',
      '.pc-grn{background:rgba(47,189,119,.16);color:#57d79a;}',
      '.pc-gold{background:rgba(255,204,0,.16);color:#ffd54a;}',
      '.pc-blue{background:rgba(43,159,208,.18);color:#7fcdec;}',
      '.pc-grey{background:rgba(255,255,255,.08);color:#b8c9d4;}',
      '.pc-amb{background:rgba(240,168,60,.16);color:#f6c072;}',
      '.pc-red{background:rgba(226,87,76,.16);color:#f0938a;}',
      '.pinfo-body{padding:8px 30px 26px;}',
      '.pinfo-sec{padding:20px 0;border-bottom:1px solid rgba(255,255,255,.09);}',
      '.pinfo-sec:last-child{border-bottom:0;}',
      '.pinfo-sec h3{font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7fa0b2;margin-bottom:14px;display:flex;align-items:center;gap:8px;}',
      '.pinfo-sec h3 .material-icons{font-size:18px;color:#2b9fd0;}',
      '.pinfo-rows{display:grid;grid-template-columns:1fr 1fr;column-gap:40px;}',
      '.pinfo-row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.055);}',
      '.pinfo-row .k{color:#8499a8;font-size:13.5px;font-weight:600;flex:none;}',
      '.pinfo-row .v{color:#eaf1f6;font-size:13.5px;font-weight:700;text-align:right;word-break:break-word;}',
      '.pinfo-row .v.mut{color:#5f7482;font-weight:600;}',
      '.pinfo-row .v a{color:#7fcdec;text-decoration:none;cursor:pointer;}',
      '.pinfo-row .v .ok{color:#2fbd77;}.pinfo-row .v .no{color:#f0a83c;}',
      '@media(max-width:720px){.pinfo-rows{grid-template-columns:1fr;}.pinfo-hbar{flex-wrap:wrap;}.pinfo-acts{width:100%;}}'
    ].join('');
    document.head.appendChild(css);
  }
  function closeMemberInfo() {
    var ov = document.getElementById('ffp-member-info');
    if (ov) { ov.classList.remove('open'); ov.innerHTML = ''; }
    document.body.style.overflow = '';
  }
  function mRow(k, v, cls) { return '<div class="pinfo-row"><span class="k">' + k + '</span><span class="v ' + (cls || '') + '">' + (v == null || v === '' ? '—' : v) + '</span></div>'; }
  async function openMemberInfo(id) {
    injectInfoStylesM();
    var ov = document.getElementById('ffp-member-info');
    if (!ov) { ov = document.createElement('div'); ov.id = 'ffp-member-info'; ov.className = 'pinfo-ov'; document.body.appendChild(ov); }
    document.body.style.overflow = 'hidden';
    ov.classList.add('open'); ov.scrollTop = 0;
    ov.innerHTML = '<div class="pinfo-wrap"><div class="pinfo-crumb" onclick="AdminMembers.closeInfo()"><span class="material-icons">arrow_back</span> Members</div><div class="pinfo-shell"><div class="pinfo-body"><div class="pinfo-sec" style="text-align:center;color:#5f7482;padding:50px 0;">Loading…</div></div></div></div>';

    var m = null, refName = null, acts = null;
    try {
      var r = await window.supabase.from('members')
        .select('id,full_name,given_names,surname,email,phone,gender,date_of_birth,nationality,city,country,membership,passport_tier,passport_expires_at,plan,stripe_customer_id,stripe_subscription_id,referred_by,referral_code,profile_complete,verified,role,status,created_at,balance_aed,photo_url')
        .eq('id', id).maybeSingle();
      m = r && r.data ? r.data : null;
      if (m && m.referred_by) {
        var rr = await window.supabase.from('members').select('id,given_names,surname,full_name').eq('id', m.referred_by).maybeSingle();
        if (rr && rr.data) refName = [rr.data.given_names, rr.data.surname].filter(Boolean).join(' ') || rr.data.full_name || null;
      }
      var ac = await window.supabase.from('activity_logs').select('id', { count: 'exact', head: true }).eq('member_id', id);
      acts = ac && typeof ac.count === 'number' ? ac.count : null;
    } catch (x) { /* non-fatal */ }
    if (!m) { ov.querySelector('.pinfo-body').innerHTML = '<div class="pinfo-sec" style="text-align:center;color:#f0938a;padding:50px 0;">Could not load this member.</div>'; return; }

    var e = e_;
    var name = [m.given_names, m.surname].filter(Boolean).join(' ') || m.full_name || (m.email ? m.email.split('@')[0] : 'Member');
    var premium = (m.membership === 'passport');
    var planMap = { annual: 'Annual', monthly: 'Monthly', lifetime: 'Lifetime' };
    var planLabel = premium ? ('Premium' + (m.plan && planMap[m.plan] ? ' · ' + planMap[m.plan] : '')) : 'Standard (free)';
    var age = ageFrom(m.date_of_birth);
    var photo = m.photo_url ? '<div class="pinfo-mono"><img src="' + e(m.photo_url) + '" alt=""></div>' : '<div class="pinfo-mono">' + e((name[0] || '?').toUpperCase()) + '</div>';
    var idline = [age != null ? age : null, m.gender, m.nationality].filter(Boolean).map(e).join(' &middot; ');
    var locStr = [m.city, m.country].filter(Boolean).map(e).join(', ') || '—';

    function chip(cls, icon, txt) { return '<span class="pinfo-chip ' + cls + '">' + (icon ? '<span class="material-icons">' + icon + '</span>' : '') + e(txt) + '</span>'; }
    var stActive = (m.status || 'active') === 'active';
    var chips = [
      premium ? chip('pc-gold', 'verified', 'Premium') : chip('pc-grey', '', 'Standard'),
      chip(stActive ? 'pc-grn' : 'pc-red', stActive ? 'check_circle' : 'block', (m.status || 'active').charAt(0).toUpperCase() + (m.status || 'active').slice(1)),
      m.profile_complete ? chip('pc-grn', '', 'Profile complete') : chip('pc-amb', 'error_outline', 'Profile incomplete'),
      m.verified ? chip('pc-blue', 'verified_user', 'Verified') : chip('pc-grey', '', 'Member')
    ].join('');

    var idRows =
      mRow('Email', e(m.email || '—')) +
      mRow('Phone', m.phone ? e(m.phone) : '—') +
      mRow('Gender', e(m.gender || '—')) +
      mRow('Date of birth', m.date_of_birth ? (fmtD(m.date_of_birth) + (age != null ? ' &middot; ' + age : '')) : '—') +
      mRow('Nationality', e(m.nationality || '—')) +
      mRow('Location', locStr);

    var billRows =
      mRow('Plan', planLabel) +
      mRow('Renews', premium && m.passport_expires_at ? fmtD(m.passport_expires_at) : '—') +
      mRow('Stripe customer', m.stripe_customer_id ? '<span class="mut">' + e(m.stripe_customer_id) + '</span>' : '—') +
      mRow('Stripe subscription', m.stripe_subscription_id ? '<span class="mut">' + e(String(m.stripe_subscription_id).slice(0, 10) + '…' + String(m.stripe_subscription_id).slice(-6)) + '</span>' : '—') +
      mRow('Balance', '$' + Number(m.balance_aed || 0)) +
      mRow('Passport card', 'Issued');

    var acctRows =
      mRow('Member since', fmtD(m.created_at)) +
      mRow('Status', '<span class="' + (stActive ? 'ok' : 'no') + '">' + e((m.status || 'active').charAt(0).toUpperCase() + (m.status || 'active').slice(1)) + '</span>') +
      mRow('Profile complete', m.profile_complete ? '<span class="ok">Yes</span>' : '<span class="no">No</span>') +
      mRow('Referral code', e(m.referral_code || '—')) +
      mRow('Referred by', m.referred_by ? (refName ? '<a onclick="AdminMembers.info(\'' + m.referred_by + '\')">' + e(refName) + '</a>' : 'Yes') : '—') +
      mRow('Activities logged', acts != null ? acts : '—');

    var manageBtns = '';
    if (premium) {
      manageBtns += '<button class="pinfo-btn ghost" onclick="AdminMembers.makeStandard(\'' + id + '\')"><span class="material-icons">arrow_downward</span>Downgrade to Standard</button>';
      if (m.stripe_subscription_id) manageBtns += '<button class="pinfo-btn ghost" onclick="AdminMembers.cancelSubscription(\'' + id + '\')"><span class="material-icons">cancel</span>Cancel subscription</button>';
    } else {
      manageBtns += '<button class="pinfo-btn ghost" onclick="AdminMembers.grantPassport(\'' + id + '\')"><span class="material-icons">upgrade</span>Switch to Premium</button>';
    }
    manageBtns += '<button class="pinfo-btn ghost" onclick="AdminMembers.setReferrer(\'' + id + '\')"><span class="material-icons">group_add</span>Set referrer</button>';
    manageBtns += '<button class="pinfo-btn danger" onclick="if(AdminMembers.eraseData){AdminMembers.eraseData(\'' + id + '\')}else{alert(\'Erase not available\')}"><span class="material-icons">delete_forever</span>Erase account</button>';

    ov.innerHTML =
      '<div class="pinfo-wrap">' +
        '<div class="pinfo-crumb" onclick="AdminMembers.closeInfo()"><span class="material-icons">arrow_back</span> Members / ' + e(name) + '</div>' +
        '<div class="pinfo-shell">' +
          '<div class="pinfo-hero">' +
            '<div class="pinfo-hbar">' +
              photo +
              '<div class="pinfo-hmid">' +
                '<div class="pinfo-name">' + e(name) + '</div>' +
                '<div class="pinfo-sub">' + (idline || '—') + ' <span class="dot">·</span> ' + locStr + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="pinfo-chips">' + chips + '</div>' +
          '</div>' +
          '<div class="pinfo-body">' +
            '<div class="pinfo-sec"><h3><span class="material-icons">badge</span>Identity</h3><div class="pinfo-rows">' + idRows + '</div></div>' +
            '<div class="pinfo-sec"><h3><span class="material-icons">card_membership</span>Membership &amp; billing</h3><div class="pinfo-rows">' + billRows + '</div></div>' +
            '<div class="pinfo-sec"><h3><span class="material-icons">account_circle</span>Account</h3><div class="pinfo-rows">' + acctRows + '</div></div>' +
            '<div class="pinfo-sec"><h3><span class="material-icons">tune</span>Manage account</h3><div style="display:flex;gap:10px;flex-wrap:wrap">' + manageBtns + '</div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
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

  function mapForUi(row, owners, pros, byId) {
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
      referred_by: row.referred_by || null,
      referred_by_name: (row.referred_by && byId && byId[row.referred_by]) ? byId[row.referred_by] : null,
      mtype: classify(row, owners || {}, pros || {})
    };
  }

  async function fetchMembers() {
    try {
      var out = await Promise.all([
        window.supabase.from('members')
          .select('id, full_name, given_names, email, city, tier, tier_expires_at, balance_aed, status, created_at, role, verified, membership, plan, stripe_subscription_id, referred_by')
          .order('created_at', { ascending: false }),
        window.supabase.from('providers').select('owner_user_id').not('owner_user_id', 'is', null),
        window.supabase.from('professionals').select('member_id')
      ]);
      var res = out[0];
      if (res.error) { console.error('[FFP Admin Members] fetch:', res.error); toast('Could not load members', 'error'); return []; }
      var owners = {}; (out[1] && out[1].data || []).forEach(function (r) { if (r.owner_user_id) owners[r.owner_user_id] = 1; });
      var pros = {}; (out[2] && out[2].data || []).forEach(function (r) { if (r.member_id) pros[r.member_id] = 1; });
      // id → display name, to resolve each member's referrer (referred_by) to a readable name in the drawer.
      var byId = {}; (res.data || []).forEach(function (r) { byId[r.id] = r.full_name || r.given_names || (r.email ? r.email.split('@')[0] : 'Member'); });
      // Show member-login accounts (role='member'); any that own a provider are still shown but flagged
      // "Partner contact" so the admin can see they're not a real member. Provider/admin login rows stay out.
      return (res.data || []).map(function (row) { return mapForUi(row, owners, pros, byId); })
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
    am.info = function (id) { openMemberInfo(id); };
    am.closeInfo = function () { closeMemberInfo(); };

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
      // If the full info page is open, re-render it so it reflects the new state.
      try {
        var ov = document.getElementById('ffp-member-info');
        if (ov && ov.classList.contains('open')) { openMemberInfo(id); return; }
      } catch (e) {}
      // Otherwise reopen the drawer if it was the surface in use.
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
    // Assign a referrer to this member (e.g. someone who signed up without the ref link). Sets referred_by AND
    // tags their live Stripe subscription so the referrer earns commission on every FUTURE invoice.
    am.setReferrer = async function (id) {
      var q = window.prompt('Who referred this member? Enter the referrer\'s email or referral code:');
      if (!q) return; q = q.trim(); if (!q) return;
      try {
        var res = await fetch(BACKEND + '/api/admin/member/set-referrer', {
          method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, jwtHeader()),
          body: JSON.stringify({ member_id: id, referrer: q })
        });
        var out = await res.json().catch(function () { return {}; });
        if (!res.ok || out.error) throw new Error(out.error || ('HTTP ' + res.status));
        toast('Referrer set: ' + (out.referrer || q) + (out.sub_updated ? ' · future invoices will credit them' : ' · no live subscription yet'), 'success');
        await afterChange(id, 'set referrer → ' + (out.referrer || q));
      } catch (e) { console.error('[Members] setReferrer', e); toast(e.message || 'Could not set referrer', 'error'); }
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

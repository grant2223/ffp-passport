/* FFP Admin Auth Gate — v7 (2026-06-03) UNIFIED AUTH — no more second login
   v7: COMPLETE REWRITE. Replaces the old Supabase-OTP overlay (v4, ~340 lines) with a
       tiny role-check page guard, mirroring ffp-provider-auth.js v5. Sign-in for ALL
       roles (member / provider / admin) now happens ONCE at /login → "Get My Code" →
       6-digit code. By the time you reach this page you're already signed in (the
       unified login stores ffp_member + ffp_jwt in localStorage); ffp-api-integration.js
       applies that JWT to window.supabase, and because the admin's member.id EQUALS their
       admin_users.id, auth.uid() resolves and is_admin() passes server-side. This page no
       longer prompts for email/OTP at all — that was the duplicate login.

       Security note: this client gate is UX only. Real access is enforced server-side by
       is_admin() + RLS on the applied JWT — a tampered localStorage role can't read admin
       data without a valid admin JWT. So we gate on the stored role and let the server be
       the source of truth (same model as the member/provider gates).

   Prerequisite: the user's row in `members` must have role = 'admin' (or 'super_admin'),
   and a matching row in `admin_users` keyed by the same id.

   Load order in ffp-admin-dashboard.html (after the supabase CDN + ffp-api-integration.js):
     <script src="ffp-admin-auth.js"></script>
*/
(function () {
  'use strict';

  // ─── Page guard — bail unless we're on the admin dashboard ───
  var path = (location.pathname || '').toLowerCase();
  var isAdminPage = /admin/.test(path) || !!document.querySelector('#panel-providers, [data-admin-page]');
  if (!isAdminPage) {
    console.log('[FFP Admin Auth v7] Not an admin page — bailing out. (URL: ' + path + ')');
    return;
  }

  // ─── Hide the page until the role check passes (prevents flashing admin data) ───
  var hide = document.createElement('style');
  hide.id = 'ffp-admin-auth-hide';
  hide.textContent =
    'body > *:not(#ffp-admin-auth-msg){visibility:hidden !important;}' +
    'body{overflow:hidden !important;}';
  (document.head || document.documentElement).appendChild(hide);

  function reveal() {
    var h = document.getElementById('ffp-admin-auth-hide'); if (h) h.remove();
    var m = document.getElementById('ffp-admin-auth-msg'); if (m && m.parentNode) m.parentNode.removeChild(m);
  }

  function readMember() {
    try { var r = localStorage.getItem('ffp_member'); return r ? JSON.parse(r) : null; }
    catch (e) { console.warn('[FFP Admin Auth v7] Could not parse ffp_member:', e); return null; }
  }

  // Reveal the dashboard + expose identity. effRole = 'super'/'ops'/'content' (full) or 'staff' (limited).
  function applyIdentity(effRole, m) {
    window.FFP_ADMIN = { role: effRole, email: m.email || null, id: m.id };
    var isStaff = String(effRole || '').toLowerCase() === 'staff';
    try {
      if (isStaff) document.body.classList.add('ffp-role-staff');   // hides owner-only panels (see dashboard CSS)
      var roleText = isStaff ? 'Staff' : String(effRole || 'admin').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      var nm = document.getElementById('ffp-admin-name'); if (nm) nm.textContent = m.email || 'Admin';
      var rl = document.getElementById('ffp-admin-role'); if (rl) rl.textContent = roleText;
      var av = document.getElementById('ffp-admin-avatar'); if (av) av.textContent = ((m.email || 'A')[0] || 'A').toUpperCase();
      var id = document.getElementById('ffp-admin-identity'); if (id) id.title = 'Signed in as ' + (m.email || 'admin');
    } catch (e) {}
    reveal();
    document.dispatchEvent(new CustomEvent('ffp-admin-ready', { detail: { role: effRole, staff: isStaff } }));
    console.log('[FFP Admin Auth v7] Access granted ✓ ' + (m.email || '') + ' · role=' + effRole);
  }

  function bounceNonAdmin(role) {
    console.warn('[FFP Admin Auth v7] role="' + role + '" is not admin — redirecting');
    location.href = (role === 'provider') ? 'https://partner.findfitpeople.com/' : '/ffp-member-dashboard.html';
  }

  function gate() {
    var m = readMember();

    // No signed-in user → go sign in once at the shared login (same as member/provider).
    if (!m || !m.id) {
      console.warn('[FFP Admin Auth v7] No signed-in member — redirecting to /login');
      location.href = '/login';
      return;
    }

    var role = String(m.role || '').toLowerCase();
    // Full admins (by members.role) go straight in.
    if (role === 'admin' || role === 'super_admin' || role === 'super') { applyIdentity(m.role, m); return; }

    // Otherwise they may have been granted STAFF access — a row in admin_users keyed by their member id.
    // is_admin() lets them read it; if present, admit them at that role (limited UI for 'staff').
    if (window.supabase && window.supabase.from) {
      window.supabase.from('admin_users').select('role').eq('id', m.id).maybeSingle().then(function (res) {
        if (res && res.data) { applyIdentity(res.data.role || 'staff', m); }
        else { bounceNonAdmin(role); }
      }, function () { bounceNonAdmin(role); });
    } else {
      bounceNonAdmin(role);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gate);
  } else {
    gate();
  }
})();

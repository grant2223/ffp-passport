/* FFP Admin Auth Gate — v5 (UNIFIED)
   v5: COMPLETE REWRITE. Replaces the Supabase Auth OTP overlay (v4, 335 lines)
       with a tiny role-check page guard (~30 lines). All sign-in now goes
       through the same /login → "Get My Code" → 6-digit code flow used by
       members and providers. The backend's /api/auth/signin redirects to
       /ffp-admin-dashboard.html when member.role === 'admin', so by the
       time a user reaches the admin dashboard they're already signed in
       and have localStorage.ffp_member set. This script just checks the
       role and bounces non-admins back to /login.

   Prerequisite: the user's row in `members` must have role = 'admin'.

   Drop in to ffp-admin-dashboard.html — same script tag as before:
     <script src="ffp-admin-auth.js"></script>
*/
(function () {
  'use strict';

  // ─── Page guard — only run on admin dashboard ───
  var path = (location.pathname || '').toLowerCase();
  var isAdminPage = /admin/.test(path) || !!document.querySelector('[data-admin-page]');
  if (!isAdminPage) {
    console.log('[FFP Admin Auth v5] Not an admin page — bailing out.');
    return;
  }

  // ─── Read the signed-in member from localStorage (set by /api/auth/signin) ───
  var member = null;
  try {
    var raw = localStorage.getItem('ffp_member');
    if (raw) member = JSON.parse(raw);
  } catch (e) {
    console.warn('[FFP Admin Auth v5] Could not parse ffp_member:', e);
  }

  // ─── No signed-in member at all → bounce to /login ───
  if (!member || !member.id) {
    console.warn('[FFP Admin Auth v5] No signed-in member — redirecting to /login');
    location.href = '/login';
    return;
  }

  // ─── Wrong role → bounce to whichever dashboard matches their role ───
  if (member.role !== 'admin') {
    console.warn('[FFP Admin Auth v5] role="' + member.role + '" is not admin — redirecting away');
    if (member.role === 'provider') {
      location.href = '/ffp-provider-dashboard.html';
    } else {
      location.href = '/ffp-member-dashboard.html';
    }
    return;
  }

  // ─── Admin verified — let the dashboard render ───
  window.FFP_ADMIN = { id: member.id, email: member.email, role: 'admin' };
  console.log('[FFP Admin Auth v5] Access granted ✓ ' + member.email);
  document.dispatchEvent(new CustomEvent('ffp-admin-ready', { detail: window.FFP_ADMIN }));
})();

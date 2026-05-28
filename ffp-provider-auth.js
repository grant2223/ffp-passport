/* FFP Provider Auth Gate — v4 (UNIFIED)
   v4: COMPLETE REWRITE. Replaces the Supabase Auth OTP integration (v3,
       311 lines) with a tiny role-check page guard, mirroring the admin
       v5 pattern. All sign-in for ALL roles (member / provider / admin)
       now goes through the same /login → "Get My Code" → 6-digit code
       flow. The backend's /api/auth/signin redirects to this dashboard
       when member.role === 'provider'. This script just verifies the
       role and either reveals the dashboard or bounces to /login.

   The provider dashboard HTML still contains an old #auth-screen / "Apply
   to join" overlay (from v3 design). This v4 hides it via CSS on load to
   prevent flicker — new provider applications should go through a separate
   apply flow page when that's built (Phase 4 work). The dashboard's
   built-in enterDashboard() function is called to transition the view
   cleanly into the dashboard mode.

   Prerequisite: the user's row in `members` must have role = 'provider'.

   Drop in to ffp-provider-dashboard.html — same script tag as before:
     <script src="ffp-provider-auth.js"></script>
*/
(function () {
  'use strict';

  // ─── Hide the legacy #auth-screen overlay immediately to prevent flicker ───
  // The provider dashboard HTML carries an inline auth UI from v3. Unified
  // auth doesn't use it; the user is already signed in by the time they reach
  // this page (otherwise the role check below bounces them to /login).
  var hideCss = document.createElement('style');
  hideCss.id = 'ffp-provider-auth-hide-legacy';
  hideCss.textContent = '#auth-screen{display:none !important;}';
  if (document.head) document.head.appendChild(hideCss);

  // ─── Read the signed-in member from localStorage (set by /api/auth/signin) ───
  var member = null;
  try {
    var raw = localStorage.getItem('ffp_member');
    if (raw) member = JSON.parse(raw);
  } catch (e) {
    console.warn('[FFP Provider Auth v4] Could not parse ffp_member:', e);
  }

  // ─── No signed-in member at all → bounce to /login ───
  if (!member || !member.id) {
    console.warn('[FFP Provider Auth v4] No signed-in member — redirecting to /login');
    location.href = '/login';
    return;
  }

  // ─── Wrong role → bounce to whichever dashboard matches their role ───
  if (member.role !== 'provider') {
    console.warn('[FFP Provider Auth v4] role="' + member.role + '" is not provider — redirecting');
    if (member.role === 'admin') {
      location.href = '/ffp-admin-dashboard.html';
    } else {
      location.href = '/ffp-member-dashboard.html';
    }
    return;
  }

  // ─── Provider verified — let the dashboard render ───
  window.FFP_PROVIDER = {
    id:    member.id,
    email: member.email,
    role:  'provider',
    business_name: member.business_name || member.full_name || ''
  };
  console.log('[FFP Provider Auth v4] Access granted ✓ ' + member.email);

  // If the dashboard exposes its own enterDashboard() (existing v3-era
  // function that hides #auth-screen and reveals the panels), call it now
  // for a clean transition into the dashboard view.
  function ready() {
    if (typeof window.enterDashboard === 'function') {
      try { window.enterDashboard(); } catch (e) {
        console.warn('[FFP Provider Auth v4] enterDashboard() threw:', e);
      }
    }
    document.dispatchEvent(new CustomEvent('ffp-provider-ready', { detail: window.FFP_PROVIDER }));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();

/* =============================================================
   FFP Passport — API Integration Module (v6)
   v6 (2026-05-29) — FIX: setSession was failing with "Auth session
       missing" because Supabase Auth's setSession validates that the
       user exists in auth.users — but our custom-auth members live in
       the members table only, never in auth.users. The JWT is still
       cryptographically valid (signed with SUPABASE_JWT_SECRET) and
       Postgres will happily decode it to expose auth.uid() inside RLS.
       v6 stops trying to use setSession and instead attaches the JWT
       as a global Authorization header on the Supabase client by
       rebuilding the client when JWT changes. This is the standard
       pattern for externally-issued JWTs (server-side mint, no Supabase
       Auth user). RLS works because Postgres reads the JWT from the
       header, decodes its sub claim, and exposes it as auth.uid().
   v5 (2026-05-29) — JWT BRIDGE for Supabase RLS:
       Backend v13 now returns a Supabase-compatible HS256 JWT in
       signin and onboard responses. v5 of this module:
         - Stores the jwt in localStorage.ffp_jwt alongside ffp_token
           and ffp_member
         - Calls window.supabase.auth.setSession({access_token: jwt,
           refresh_token: ''}) so auth.uid() returns member.id inside
           Postgres
         - autoInit re-applies the session on every page load (so a
           reloaded dashboard doesn't lose its Supabase Auth context)
         - ffpLogout clears the jwt AND calls supabase.auth.signOut
       Effect: every existing RLS policy (member_id = auth.uid() OR
       is_admin()) now evaluates correctly for custom-auth members.
       Loaders can hit Supabase directly without per-call backend
       round-trips. provider_hours RLS bug (task #32) also fixes.

   Backend: https://ffp-passport-backend.vercel.app
   Endpoints: /api/auth/signup, /api/auth/signin, /api/auth/reset
   v4: SIGNIN flow now calls /api/auth/reset (generates + emails a
       fresh 6-digit code) instead of the previous no-op early-return.
       The old "permanent code model" relied on the Stripe webhook
       emailing the code at signup so users had it stored — backend v7
       removed that, so signin now needs to fire the email itself.
       Every login = "send me a code" → email → enter code → in.
   v3.1: Adds window.supabase client instantiation so admin auth works.
         Keeps v3 FFPAuth/FFPApi behaviour intact.
   ============================================================= */
(function (window) {
  'use strict';
  // ── Supabase client setup (NEW in v3.1) ──────────────────────
  // Required for ffp-admin-auth.js which uses Supabase Auth directly.
  var SUPABASE_URL = 'https://kxzyuofecmtymablnmak.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4enl1b2ZlY210eW1hYmxubWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDM1MTYsImV4cCI6MjA5NTAxOTUxNn0.cWn0x1AeD-x9C-HHf9MShXbFRWdkWi5RMgHLgWJwOuE';
  // v6: Cache the SDK module reference BEFORE overwriting window.supabase
  // with the client instance. We need it to rebuild the client later when
  // a JWT arrives (the client instance doesn't have createClient on it).
  var SUPABASE_SDK = null;
  if (window.supabase && window.supabase.createClient) {
    SUPABASE_SDK = window.supabase;
    try {
      window.supabase = SUPABASE_SDK.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('[FFP] Supabase client initialised (anon — JWT applied on demand)');
    } catch (e) {
      console.error('[FFP] Supabase init failed:', e);
    }
  } else {
    console.warn('[FFP] Supabase SDK not found — ensure the CDN script tag loads BEFORE ffp-api-integration.js');
  }
  // ─────────────────────────────────────────────────────────────
  var API_BASE = 'https://ffp-passport-backend.vercel.app';
  var TOKEN_KEY = 'ffp_token';
  var MEMBER_KEY = 'ffp_member';
  var JWT_KEY    = 'ffp_jwt';      // v5: Supabase-compatible HS256 JWT for RLS auth.uid()
  var FFPAuth = {
    getToken: function () {
      try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
    },
    setToken: function (token) {
      try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
    },
    getMember: function () {
      try {
        var raw = localStorage.getItem(MEMBER_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    setMember: function (member) {
      try { localStorage.setItem(MEMBER_KEY, JSON.stringify(member)); } catch (e) {}
    },
    // v5: JWT bridge helpers
    getJwt: function () {
      try { return localStorage.getItem(JWT_KEY); } catch (e) { return null; }
    },
    setJwt: function (jwt) {
      try { localStorage.setItem(JWT_KEY, jwt || ''); } catch (e) {}
    },
    // v6: Apply the stored JWT by rebuilding the Supabase client with
    // the JWT as a global Authorization header. (v5 used setSession but
    // that validates against auth.users which our custom-auth members
    // don't exist in.) Postgres decodes the JWT from the header and
    // exposes its sub claim as auth.uid() inside RLS policies — which is
    // all we actually need. Synchronous in effect (no network round-trip
    // until the next query), but returns a promise for API compatibility.
    applySupabaseSession: function () {
      var jwt = this.getJwt();
      if (!jwt) return Promise.resolve(null);
      if (!SUPABASE_SDK || !SUPABASE_SDK.createClient) {
        console.warn('[FFP v6] Cannot apply JWT — SDK reference missing. Ensure supabase-js CDN loads BEFORE ffp-api-integration.js.');
        return Promise.resolve(null);
      }
      try {
        window.supabase = SUPABASE_SDK.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: {
            headers: { Authorization: 'Bearer ' + jwt }
          }
        });
        console.log('[FFP v6] Supabase client rebuilt with JWT — auth.uid() will resolve to member.id in RLS');
        return Promise.resolve({ success: true });
      } catch (e) {
        console.error('[FFP v6] Failed to rebuild client with JWT:', e);
        return Promise.resolve({ error: e });
      }
    },
    clear: function () {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(MEMBER_KEY);
        localStorage.removeItem(JWT_KEY);
      } catch (e) {}
      // v6: rebuild the Supabase client without the JWT header so any subsequent
      // queries fall back to anon (matching the now-cleared localStorage state).
      if (SUPABASE_SDK && SUPABASE_SDK.createClient) {
        try {
          window.supabase = SUPABASE_SDK.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch (e) {}
      }
    },
    isAuthenticated: function () {
      return !!this.getToken();
    }
  };
  function call(path, options) {
    options = options || {};
    var headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    var token = FFPAuth.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var fetchOpts = {
      method: options.method || 'GET',
      headers: headers,
      mode: 'cors',
      credentials: 'omit'
    };
    if (options.body) fetchOpts.body = JSON.stringify(options.body);
    return fetch(API_BASE + path, fetchOpts).then(function (res) {
      if (res.status === 401) {
        FFPAuth.clear();
        if (!/login\.html$/.test(window.location.pathname)) {
          window.location.href = 'login.html';
        }
        return { error: 'Unauthorized' };
      }
      return res.json().catch(function () { return { error: 'Invalid JSON response' }; });
    }).catch(function (err) {
      console.error('FFPApi call failed:', path, err);
      return { error: err && err.message ? err.message : 'Network error' };
    });
  }
  var FFPApi = {
    requestCode: function (email, fullName, flow) {
      // v4: signin and reset both call /api/auth/reset (generates + emails fresh code).
      // The v3.1 "permanent code model" no-op for signin was removed — backend v7
      // suppresses the Stripe-webhook code email, so signin must fire the email itself.
      var path;
      var body = { email: email };
      if (flow === 'signup') {
        path = '/api/auth/signup';
        if (fullName) body.full_name = fullName;
      } else if (flow === 'reset' || flow === 'signin') {
        path = '/api/auth/reset';
      } else {
        return Promise.resolve({ error: 'Unknown flow: ' + flow });
      }
      return call(path, { method: 'POST', body: body });
    },
    verifyCode: function (email, code, flow) {
      return call('/api/auth/signin', {
        method: 'POST',
        body: { email: email, code: code }
      }).then(function (res) {
        if (res && res.token) {
          FFPAuth.setToken(res.token);
          if (res.member) FFPAuth.setMember(res.member);
          // v5: store JWT + apply Supabase session before resolving so the
          // page that called verifyCode can immediately use window.supabase
          // with the correct auth.uid().
          if (res.jwt) {
            FFPAuth.setJwt(res.jwt);
            return FFPAuth.applySupabaseSession().then(function () { return res; });
          }
        }
        return res;
      });
    },
    // v5: helper for profile-complete and any other page that calls
    // /api/onboard/from-stripe directly (not via verifyCode). Pass the
    // response object — if it has a jwt, we persist + apply the session.
    applyOnboardResponse: function (res) {
      if (!res) return Promise.resolve(res);
      if (res.member) FFPAuth.setMember(res.member);
      if (res.jwt) {
        FFPAuth.setJwt(res.jwt);
        return FFPAuth.applySupabaseSession().then(function () { return res; });
      }
      return Promise.resolve(res);
    },
    getMemberProfile: function () { return call('/api/members/me'); },
    getDeals: function (filters) {
      var q = filters ? '?' + new URLSearchParams(filters).toString() : '';
      return call('/api/deals' + q);
    },
    redeemDeal: function (dealId) {
      return call('/api/deals/' + dealId + '/redeem', { method: 'POST' });
    },
    getVenueProfile: function () { return call('/api/provider/venue'); },
    getVenueStats: function () { return call('/api/provider/stats'); },
    getAdminDashboard: function () { return call('/api/admin/dashboard'); }
  };
  function handleAPIError(error, fallback) {
    console.error('FFP API error:', error);
    var msg = (error && error.message) || fallback || 'Something went wrong.';
    alert(msg);
  }
  function autoInit() {
    // v5: Re-apply Supabase Auth session on every page load — without this,
    // a reloaded dashboard would have no auth.uid() and every RLS-protected
    // query would silently fail. Fires asynchronously; loaders that run
    // before this resolves will retry (they already poll for window.supabase).
    if (FFPAuth.getJwt()) {
      FFPAuth.applySupabaseSession();
    }
    var path = window.location.pathname.toLowerCase();
    if (path.indexOf('ffp-member-dashboard') !== -1) {
      if (!FFPAuth.isAuthenticated()) return;
      var stored = FFPAuth.getMember();
      if (stored) applyProfileToDashboard(stored);
      return;
    }
    if (path.indexOf('ffp-provider') !== -1) {
      if (!FFPAuth.isAuthenticated()) return;
      var v = FFPAuth.getMember();
      if (v) {
        var nameEl = document.querySelector('[data-venue-name]');
        if (nameEl && v.full_name) nameEl.textContent = v.full_name;
      }
      return;
    }
  }
  function applyProfileToDashboard(profile) {
    var map = {
      'pass-name': profile.full_name,
      'pass-passport-num': profile.passport_no || profile.passport_number,
      'pass-email': profile.email
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && map[id]) el.textContent = map[id];
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
  window.FFPAuth = FFPAuth;
  window.FFPApi = FFPApi;
  window.handleAPIError = handleAPIError;
  window.ffpLogout = function () {
    FFPAuth.clear();
    window.location.href = 'login.html';
  };
})(window);

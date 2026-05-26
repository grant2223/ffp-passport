/* ============================================================================
   FFP Passport — API Integration Module (v4)
   ============================================================================
   Architecture:
     - Supabase Auth handles login (email OTP, 6-digit codes)
     - Supabase JS client used directly from dashboards for data
     - Vercel backend only handles the Stripe webhook
   
   Loaded BEFORE this file in HTML:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   
   Public API maintained for compatibility with login.html:
     FFPApi.requestCode(email, fullName, flow)  — sends OTP code
     FFPApi.verifyCode(email, code, flow)       — verifies code, returns member
     FFPApi.getMemberProfile()                   — fetches current member
     FFPAuth.isAuthenticated()                   — true if signed in
     FFPAuth.getMember()                         — cached member object
     FFPAuth.clear()                             — sign out
     ffpLogout()                                 — sign out + redirect to login
     window.supabase                             — the live Supabase client (for dashboards)
   ============================================================================ */
(function (window) {
  'use strict';

  // ── Configuration ─────────────────────────────────────────────────────────
  var SUPABASE_URL = 'https://kxzyuofecmtymablnmak.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4enl1b2ZlY210eW1hYmxubWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDM1MTYsImV4cCI6MjA5NTAxOTUxNn0.cWn0x1AeD-x9C-HHf9MShXbFRWdkWi5RMgHLgWJwOuE';

  // ── Initialise Supabase client ────────────────────────────────────────────
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[FFP] Supabase JS SDK not loaded. Add this BEFORE ffp-api-integration.js:\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    return;
  }

  var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  // Expose the client globally so dashboards can use `supabase.from('deals')...` etc.
  window.supabase = supabase;


  // ── Helper: fetch member + determine role (member / provider / admin) ─────
  async function loadEnrichedMember(userId) {
    // 1. Fetch the members row
    var memberRes = await supabase
      .from('members')
      .select('*')
      .eq('id', userId)
      .single();

    if (memberRes.error || !memberRes.data) {
      return { error: 'Failed to load member profile' };
    }
    var member = memberRes.data;

    // 2. Check if they're in admin_users
    var adminRes = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (adminRes.data) {
      member.role = 'admin';
      return { member: member };
    }

    // 3. Check if they own a provider
    var providerRes = await supabase
      .from('providers')
      .select('id')
      .eq('owner_user_id', userId)
      .maybeSingle();

    member.role = providerRes.data ? 'provider' : 'member';
    return { member: member };
  }


  // ── FFPApi — same interface login.html expects ────────────────────────────
  var FFPApi = {
    /**
     * Sends a fresh 6-digit OTP code to the user's email.
     * Flows:
     *   signin — sends OTP (real email)
     *   signup — no-op (signup happens via Stripe payment, webhook creates user)
     *   reset  — sends OTP (same as signin)
     */
    requestCode: async function (email, fullName, flow) {
      if (flow === 'signup') {
        // Signup happens via Stripe — no code request needed from this page
        return { success: true };
      }
      try {
        var res = await supabase.auth.signInWithOtp({
          email: email,
          options: {
            shouldCreateUser: false  // Only paid members (created by Stripe webhook) can sign in
          }
        });
        if (res.error) {
          // Common case: user not found = haven't paid yet
          var msg = res.error.message || 'Failed to send code';
          if (/signups not allowed|user.*not.*found|invalid/i.test(msg)) {
            msg = 'No account found for that email. Please complete payment first.';
          }
          return { error: msg };
        }
        return { success: true };
      } catch (err) {
        return { error: err.message || 'Network error' };
      }
    },

    /**
     * Verifies the 6-digit code and signs the user in.
     * Returns: { success: true, member, token } or { error }
     */
    verifyCode: async function (email, code, flow) {
      try {
        var res = await supabase.auth.verifyOtp({
          email: email,
          token: String(code).trim(),
          type: 'email'
        });

        if (res.error || !res.data || !res.data.user) {
          var msg = (res.error && res.error.message) || 'Invalid or expired code';
          if (/expired/i.test(msg)) msg = 'Code expired. Request a new one.';
          else if (/invalid/i.test(msg)) msg = 'Wrong code. Try again.';
          return { error: msg };
        }

        // Fetch enriched member profile (with role)
        var enriched = await loadEnrichedMember(res.data.user.id);
        if (enriched.error) {
          return { error: enriched.error };
        }

        // Cache for sync access by older code paths
        try {
          localStorage.setItem('ffp_member', JSON.stringify(enriched.member));
          localStorage.setItem('ffp_token', res.data.session.access_token);
        } catch (e) {}

        return {
          success: true,
          member: enriched.member,
          token: res.data.session.access_token
        };
      } catch (err) {
        return { error: err.message || 'Verification failed' };
      }
    },

    /**
     * Get current member profile. Returns the member object or { error }.
     */
    getMemberProfile: async function () {
      var userRes = await supabase.auth.getUser();
      if (userRes.error || !userRes.data || !userRes.data.user) {
        return { error: 'Not authenticated' };
      }
      var enriched = await loadEnrichedMember(userRes.data.user.id);
      if (enriched.error) return { error: enriched.error };
      return enriched.member;
    }
  };


  // ── FFPAuth — session helpers ─────────────────────────────────────────────
  var FFPAuth = {
    isAuthenticated: async function () {
      var res = await supabase.auth.getSession();
      return !!(res.data && res.data.session);
    },
    getToken: function () {
      try { return localStorage.getItem('ffp_token'); } catch (e) { return null; }
    },
    setToken: function (token) {
      try { localStorage.setItem('ffp_token', token); } catch (e) {}
    },
    getMember: function () {
      try {
        var raw = localStorage.getItem('ffp_member');
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    setMember: function (member) {
      try { localStorage.setItem('ffp_member', JSON.stringify(member)); } catch (e) {}
    },
    clear: async function () {
      try {
        localStorage.removeItem('ffp_token');
        localStorage.removeItem('ffp_member');
      } catch (e) {}
      try { await supabase.auth.signOut(); } catch (e) {}
    }
  };


  // ── Globals ───────────────────────────────────────────────────────────────
  window.FFPApi = FFPApi;
  window.FFPAuth = FFPAuth;
  window.ffpLogout = async function () {
    await FFPAuth.clear();
    window.location.href = 'login.html';
  };


  // ── Auto-redirect: if already signed in and on login page, go to dashboard
  function isOnLoginPage() {
    var path = (window.location.pathname || '').toLowerCase();
    return /login/i.test(path);
  }

  async function autoSessionCheck() {
    if (!isOnLoginPage()) return;
    var res = await supabase.auth.getSession();
    if (!res.data || !res.data.session) return;

    var enriched = await loadEnrichedMember(res.data.session.user.id);
    if (enriched.error || !enriched.member) return;

    var destinations = {
      member:   'ffp-member-dashboard.html',
      provider: 'ffp-provider.html',
      admin:    'ffp-admin.html'
    };

    if (!enriched.member.profile_complete) {
      window.location.href = 'ffp-profile-complete.html?id=' + enriched.member.id;
    } else {
      window.location.href = destinations[enriched.member.role] || destinations.member;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoSessionCheck);
  } else {
    autoSessionCheck();
  }

})(window);

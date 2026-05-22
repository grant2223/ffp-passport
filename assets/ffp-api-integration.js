/* =============================================================
   FFP Passport — API Integration Module (v3)
   Backend: https://ffp-passport-backend.vercel.app
   Endpoints: /api/auth/signup, /api/auth/signin, /api/auth/reset
   v3: signin flow advances to code screen without API call (permanent code model)
   ============================================================= */
(function (window) {
  'use strict';

  var API_BASE = 'https://ffp-passport-backend.vercel.app';
  var TOKEN_KEY = 'ffp_token';
  var MEMBER_KEY = 'ffp_member';

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
    clear: function () {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(MEMBER_KEY);
      } catch (e) {}
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
      // SIGNIN flow uses a permanent code — no API call, just advance UI to code entry
      if (flow === 'signin') {
        return Promise.resolve({ success: true });
      }
      var path;
      var body = { email: email };
      if (flow === 'signup') {
        path = '/api/auth/signup';
        if (fullName) body.full_name = fullName;
      } else if (flow === 'reset') {
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
        }
        return res;
      });
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
    var path = window.location.pathname.toLowerCase();
    if (path.indexOf('ffp-member-dashboard') !== -1) {
      if (!FFPAuth.isAuthenticated()) return;
      // Use stored member data first (from sign-in response)
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

/* =============================================================
   FFP Passport — API Integration Module (v2 — corrected endpoints)
   Backend: https://ffp-passport-backend.vercel.app
   Endpoints: /api/auth/signup, /api/auth/signin, /api/auth/reset
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
      return { error: err.message || 'Network error' };
    });
  }

  var FFPApi = {
    requestCode: function (email, fullName, flow) {
      var path;
      var body = { email: email };
      if (flow === 'signup') {
        path = '/api/auth/signup';
        if (fullName) body.full_name = fullName;
      } else if (flow === 'reset') {
        path = '/api/auth/reset';
      } else {
        path = '/api/auth/signin';
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
      FFPApi.getMemberProfile().then(function (profile) {
        if (!profile || profile.error) return;
        applyProfileToDashboard(profile);
      });
      return;
    }
    if (path.indexOf('ffp-provider') !== -1) {
      if (!FFPAuth.isAuthenticated()) return;
      FFPApi.getVenueProfile().then(function (v) {
        if (!v || v.error) return;
        var nameEl = document.querySelector('[data-venue-name]');
        if (nameEl) nameEl.textContent = v.name;
      });
      return;
    }
    if (path.indexOf('ffp-admin') !== -1) {
      if (!FFPAuth.isAuthenticated()) return;
      FFPApi.getAdminDashboard().then(function (d) {
        if (!d || d.error) return;
        var mEl = document.querySelector('[data-total-members]');
        var rEl = document.querySelector('[data-total-revenue]');
        if (mEl && d.total_members != null) mEl.textContent = d.total_members;
        if (rEl && d.total_revenue != null) rEl.textContent = 'AED ' + d.total_revenue;
      });
    }
  }

  function applyProfileToDashboard(profile) {
    var map = {
      'pass-name': profile.full_name,
      'pass-passport-num': profile.passport_number,
      'pass-dob': profile.dob,
      'pass-nationality': profile.nationality,
      'pass-city': profile.city
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

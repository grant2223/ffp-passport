/* =============================================================
   FFP Passport — API Integration Module
   Backend: https://ffp-passport-backend.vercel.app
   Loads on every HTML page. Handles auth, API calls, page init.
   ============================================================= */
(function (window) {
  'use strict';

  // ---------- CONFIG ----------
  var API_BASE = 'https://ffp-passport-backend.vercel.app';
  var TOKEN_KEY = 'ffp_token';
  var MEMBER_KEY = 'ffp_member';

  // ---------- AUTH ----------
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

  // ---------- CORE API CALL ----------
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

  // ---------- API METHODS ----------
  var FFPApi = {
    // --- Auth ---
    requestCode: function (email, fullName, flow) {
      return call('/api/auth/request-code', {
        method: 'POST',
        body: { email: email, full_name: fullName, flow: flow }
      });
    },
    verifyCode: function (email, code, flow) {
      return call('/api/auth/verify-code', {
        method: 'POST',
        body: { email: email, code: code, flow: flow }
      }).then(function (res) {
        if (res && res.token) {
          FFPAuth.setToken(res.token);
          if (res.member) FFPAuth.setMember(res.member);
        }
        return res;
      });
    },

    // --- Member ---
    getMemberProfile: function () { return call('/api/members/me'); },
    updateMemberProfile: function (data) {
      return call('/api/members/me', { method: 'PATCH', body: data });
    },

    // --- Deals ---
    getDeals: function (filters) {
      var q = filters ? '?' + new URLSearchParams(filters).toString() : '';
      return call('/api/deals' + q);
    },
    redeemDeal: function (dealId) {
      return call('/api/deals/' + dealId + '/redeem', { method: 'POST' });
    },

    // --- Events ---
    getEvents: function () { return call('/api/events'); },
    rsvpEvent: function (eventId) {
      return call('/api/events/' + eventId + '/rsvp', { method: 'POST' });
    },

    // --- Challenges ---
    getChallenges: function () { return call('/api/challenges'); },
    joinChallenge: function (challengeId) {
      return call('/api/challenges/' + challengeId + '/join', { method: 'POST' });
    },

    // --- Meet & Move ---
    getMatches: function () { return call('/api/matches'); },
    getMeetups: function () { return call('/api/meetups'); },

    // --- Ambassador / Referrals ---
    getAmbassadorStats: function () { return call('/api/ambassador/stats'); },
    getReferralCode: function () { return call('/api/ambassador/code'); },

    // --- Notifications ---
    getNotifications: function () { return call('/api/notifications'); },

    // --- Provider portal ---
    getVenueProfile: function () { return call('/api/provider/venue'); },
    getVenueStats: function () { return call('/api/provider/stats'); },
    getVenueRedemptions: function () { return call('/api/provider/redemptions'); },
    scanMemberQR: function (qrToken) {
      return call('/api/provider/scan', { method: 'POST', body: { qr: qrToken } });
    },

    // --- Admin ---
    getAdminDashboard: function () { return call('/api/admin/dashboard'); },
    getAllMembers: function (filters) {
      var q = filters ? '?' + new URLSearchParams(filters).toString() : '';
      return call('/api/admin/members' + q);
    },
    getAllVenues: function () { return call('/api/admin/venues'); }
  };

  // ---------- ERROR HELPER ----------
  function handleAPIError(error, fallback) {
    console.error('FFP API error:', error);
    var msg = (error && error.message) || fallback || 'Something went wrong.';
    alert(msg);
  }

  // ---------- PAGE AUTO-INIT ----------
  // Detects page by filename and runs the right bootstrap.
  function autoInit() {
    var path = window.location.pathname.toLowerCase();

    // member dashboard
    if (path.indexOf('ffp-member-dashboard') !== -1 || path.indexOf('/member') !== -1) {
      if (!FFPAuth.isAuthenticated()) {
        // Demo mode: don't force redirect if there's no token — leave the demo data visible.
        // Uncomment next line to enforce auth:
        // window.location.href = 'login.html';
        return;
      }
      FFPApi.getMemberProfile().then(function (profile) {
        if (!profile || profile.error) return;
        applyProfileToDashboard(profile);
      });
      return;
    }

    // provider portal
    if (path.indexOf('ffp-provider') !== -1 || path.indexOf('/provider') !== -1) {
      if (!FFPAuth.isAuthenticated()) return;
      FFPApi.getVenueProfile().then(function (v) {
        if (!v || v.error) return;
        var nameEl = document.querySelector('[data-venue-name]');
        if (nameEl) nameEl.textContent = v.name;
      });
      return;
    }

    // admin dashboard
    if (path.indexOf('ffp-admin') !== -1 || path.indexOf('/admin') !== -1) {
      if (!FFPAuth.isAuthenticated()) return;
      FFPApi.getAdminDashboard().then(function (d) {
        if (!d || d.error) return;
        var mEl = document.querySelector('[data-total-members]');
        var rEl = document.querySelector('[data-total-revenue]');
        if (mEl && d.total_members != null) mEl.textContent = d.total_members;
        if (rEl && d.total_revenue != null) rEl.textContent = 'AED ' + d.total_revenue;
      });
      return;
    }
  }

  function applyProfileToDashboard(profile) {
    // Selector list designed to be safe: only updates if elements exist.
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

  // Hook into DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // ---------- EXPORT ----------
  window.FFPAuth = FFPAuth;
  window.FFPApi = FFPApi;
  window.handleAPIError = handleAPIError;

  // Logout helper available globally
  window.ffpLogout = function () {
    FFPAuth.clear();
    window.location.href = 'login.html';
  };
})(window);

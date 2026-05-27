/* FFP Provider Check-ins Loader — v1
   Wires the Check-ins panel to real Supabase data.
   - Verify a member's claim code (XXXX-XXXX format)
   - Shows member name + deal title in confirm modal
   - Confirm → UPDATE claims set status='verified', verified_at=now(), verified_by=me
   - Recent check-ins list shows real verified claims (last 50)
   - Error cases: invalid code, wrong venue, already used, expired

   Requires SQL: RLS policies on claims + ffp_generate_claim_code() function
   (provider_read, provider_verify, member_own, admin_all).
*/
(function () {
  'use strict';

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Check-ins]', msg);
  }
  async function waitFor(check, ms) {
    var tries = 0; var limit = Math.ceil((ms || 15000) / 100);
    while (!check() && tries < limit) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    return check();
  }
  function escHtml(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function injectStyles() {
    if (document.getElementById('ffp-provider-checkins-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-provider-checkins-css';
    css.textContent = [
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',
      '#panel-checkins{overflow-x:hidden;}',
      // Subtle highlight when a code is being verified
      '.code-input{font-family:"JetBrains Mono", "Courier New", monospace !important; letter-spacing:2px !important; text-align:center !important; text-transform:uppercase !important;}'
    ].join('');
    document.head.appendChild(css);
  }

  // ─── Format helpers ───
  function firstName(member) {
    if (!member) return 'Unknown member';
    if (member.given_names) return member.given_names.split(' ')[0];
    if (member.full_name) return member.full_name.split(' ')[0];
    return 'Member';
  }
  function fullName(member) {
    if (!member) return 'Unknown member';
    return member.full_name || member.given_names || 'Member';
  }
  function letterFor(member) {
    var n = fullName(member);
    return n.charAt(0).toUpperCase();
  }
  function relTime(iso) {
    if (!iso) return '';
    if (typeof window.fmtRelative === 'function') {
      try { return window.fmtRelative(new Date(iso).getTime()); } catch (e) {}
    }
    var diff = Date.now() - new Date(iso).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return new Date(iso).toLocaleDateString();
  }

  // ─── Fetch recent check-ins for this provider ───
  async function fetchRecentCheckins() {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) return [];
    // RLS limits to claims on my deals. We want verified ones, recent first.
    var res = await window.supabase
      .from('claims')
      .select('id, member_id, deal_id, claim_code, status, verified_at, created_at, members(full_name, given_names, photo_url, tier), deals(title)')
      .order('verified_at', { ascending: false, nullsFirst: false })
      .limit(50);
    if (res.error) {
      console.error('[FFP Check-ins] fetch:', res.error);
      toast('Could not load check-ins', 'error');
      return [];
    }
    return res.data || [];
  }

  async function refresh() {
    if (typeof checkIns === 'undefined') return;
    var rows = await fetchRecentCheckins();
    // Map to the existing in-memory shape used by renderCheckIns
    checkIns.length = 0;
    rows.forEach(function (r) {
      if (r.status !== 'verified') return;  // only show verified in the recent list
      checkIns.push({
        id: r.id,
        member_name: fullName(r.members),
        member_letter: letterFor(r.members),
        listing: (r.deals && r.deals.title) || 'Deal',
        code: r.claim_code || '',
        ts: r.verified_at ? new Date(r.verified_at).getTime() : Date.now(),
        status: r.status
      });
    });
    if (typeof window.renderCheckIns === 'function') {
      try { window.renderCheckIns(); } catch (e) {}
    }
  }

  // ─── Lookup a claim by code ───
  async function lookupClaim(code) {
    var res = await window.supabase
      .from('claims')
      .select('id, member_id, deal_id, claim_code, status, verified_at, created_at, members(full_name, given_names, photo_url, tier), deals(title)')
      .eq('claim_code', code)
      .maybeSingle();
    if (res.error) {
      console.error('[FFP Check-ins] lookup:', res.error);
      return { error: res.error.message };
    }
    return { data: res.data };
  }

  // ─── Verify code (the main flow) ───
  async function realVerifyClaimCode() {
    var input = document.getElementById('claim-code-input');
    if (!input) return;
    var code = (input.value || '').trim().toUpperCase();
    if (code.length < 9) {
      toast('Enter the full 8-character code', 'error');
      return;
    }

    try {
      var { data: claim, error } = await lookupClaim(code);

      if (error) {
        toast('Lookup failed: ' + error, 'error');
        return;
      }

      if (!claim) {
        toast('Invalid code — or it\u2019s for a different venue', 'error');
        return;
      }

      if (claim.status === 'verified') {
        var when = claim.verified_at ? new Date(claim.verified_at).toLocaleString() : 'previously';
        toast('Already used (' + when + ')', 'error');
        return;
      }
      if (claim.status === 'expired') {
        toast('This code has expired', 'error');
        return;
      }
      if (claim.status === 'rejected') {
        toast('This claim was rejected', 'error');
        return;
      }
      if (claim.status !== 'pending') {
        toast('Code status: ' + claim.status, 'error');
        return;
      }

      // Pending — show confirm modal
      showVerifyModal(claim);
    } catch (e) {
      console.error('[FFP Check-ins] verify:', e);
      toast(e.message || 'Verify failed', 'error');
    }
  }

  function showVerifyModal(claim) {
    var member = claim.members || {};
    var dealTitle = (claim.deals && claim.deals.title) || 'Deal';
    var name = fullName(member);
    var tier = member.tier ? (member.tier.charAt(0).toUpperCase() + member.tier.slice(1)) : 'Member';
    var photo = member.photo_url
      ? '<div style="width:72px;height:72px;margin:0 auto 14px;border-radius:50%;background:#0a1825 url(' + escHtml(member.photo_url) + ') center/cover;border:2px solid rgba(74,222,128,.35);"></div>'
      : '<div style="width:72px;height:72px;margin:0 auto 14px;border-radius:50%;background:rgba(74,222,128,.15);color:var(--ffp-green);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;">' + escHtml(letterFor(member)) + '</div>';

    var body =
      '<div style="text-align:center;padding:12px 0 22px;">' +
        photo +
        '<div style="font-size:18px;font-weight:800;margin-bottom:4px;">' + escHtml(name) + '</div>' +
        '<div style="font-size:12px;font-weight:600;color:var(--ffp-text-muted);letter-spacing:.3px;">' + escHtml(tier) + ' \u00b7 FFP Passport</div>' +
        '<div style="margin-top:14px;padding:12px 16px;background:var(--ffp-bg-3);border-radius:var(--r-md);display:inline-block;">' +
          '<div style="font-size:10px;font-weight:800;color:var(--ffp-text-muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Claiming</div>' +
          '<div style="font-size:13px;font-weight:800;">' + escHtml(dealTitle) + '</div>' +
        '</div>' +
      '</div>';

    var foot =
      '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-pri" onclick="confirmCheckIn(\'' + claim.id + '\')">' +
        '<span class="ms">check</span> Confirm check-in' +
      '</button>';

    if (typeof window.openModalShell === 'function') {
      window.openModalShell('sm', 'Code verified', body, foot);
    }
  }

  // ─── Confirm check-in — UPDATE claim ───
  async function realConfirmCheckIn(claimId) {
    if (!claimId) return;
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) {
      toast('Provider not loaded', 'error');
      return;
    }
    try {
      // Get current user uid for verified_by
      var sess = await window.supabase.auth.getUser();
      var uid = sess && sess.data && sess.data.user ? sess.data.user.id : null;

      var res = await window.supabase
        .from('claims')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString(),
          verified_by: uid
        })
        .eq('id', claimId)
        .eq('status', 'pending');  // only verify if still pending (avoids race)
      if (res.error) throw res.error;

      var input = document.getElementById('claim-code-input');
      if (input) input.value = '';
      if (typeof window.closeModal === 'function') window.closeModal();
      toast('Checked in \u2014 member earns activity log entry', 'success');
      await refresh();
    } catch (e) {
      console.error('[FFP Check-ins] confirm:', e);
      toast(e.message || 'Check-in failed', 'error');
    }
  }

  // ─── QR scanner placeholder ───
  function realScanQR() {
    // Detect mobile; real camera integration deferred to Phase 3
    var isMobile = /iPhone|iPad|Android/.test(navigator.userAgent);
    if (isMobile) {
      toast('QR scanner: camera support coming in mobile app build', 'info');
    } else {
      toast('QR scanner works on mobile camera \u2014 use code input on desktop', 'info');
    }
  }

  // ─── Init ───
  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth &&
             typeof window.renderCheckIns === 'function' &&
             typeof checkIns !== 'undefined';
    }, 15000);
    if (!ok) { console.error('[FFP Check-ins] deps never loaded'); return; }

    var authed = await waitFor(function () {
      return !!(window.FFP_PROVIDER && window.FFP_PROVIDER.id);
    }, 30000);
    if (!authed) { console.warn('[FFP Check-ins] FFP_PROVIDER not set'); return; }

    injectStyles();

    try {
      await refresh();
      console.log('[FFP Check-ins v1] Loaded \u2713');
    } catch (e) {
      console.error('[FFP Check-ins] initial load:', e);
    }

    // Override the dashboard's functions
    window.verifyClaimCode = realVerifyClaimCode;
    window.confirmCheckIn = realConfirmCheckIn;

    // Hook up QR scan button (override its onclick if we can find it)
    var scanBtn = document.querySelector('#panel-checkins button[onclick*="QR scanner"]');
    if (scanBtn) {
      scanBtn.setAttribute('onclick', 'event.preventDefault(); window.ffpScanQR && window.ffpScanQR();');
      window.ffpScanQR = realScanQR;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

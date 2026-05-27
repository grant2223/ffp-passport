/* ═══════════════════════════════════════════════════════════════
   FFP CLAIMS LOADER · CURRENT VERSION: v1
   File path: assets/ffp-claims-loader.js
   On-load log: [FFP Claims v1] Loaded ✓
   ═══════════════════════════════════════════════════════════════ */

/* WHAT v1 DOES — Phase 2.3.5:
   Replaces the fake auto-approval claim flow with real Supabase behaviour.

   Flow:
     1. Member taps Claim on a deal
     2. INSERT into claims table with status='pending' + auto-generated XXXX-XXXX code
     3. Waiting modal shows the code prominently — member shows it at venue
     4. Provider types code into their Check-ins panel (Phase 2.2)
     5. Provider verifies → status='verified' in DB
     6. Realtime subscription fires → modal flips to Approved state
     7. Member is locked from re-claiming (one-time use enforced by status check)

   Pairs with: ffp-provider-checkins-loader.js (already shipped in Phase 2.2)
   Requires: assets/ffp-realtime.js loaded BEFORE this file
*/

(function () {
  'use strict';

  var activeClaim = null;       // current in-flight claim row
  var activeChannelName = null; // realtime channel for this claim
  var currentUserId = null;
  var currentMemberName = '';

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Claims]', msg);
  }

  async function waitFor(check, ms) {
    var tries = 0;
    var limit = Math.ceil((ms || 15000) / 100);
    while (!check() && tries < limit) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    return check();
  }

  function injectStyles() {
    if (document.getElementById('ffp-claims-styles')) return;
    var s = document.createElement('style');
    s.id = 'ffp-claims-styles';
    s.textContent =
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}' +
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}' +
      // Code display injected into the waiting modal
      '#ffp-claim-code-block{margin:18px 22px;padding:18px;background:rgba(255,204,0,0.08);border:1.5px solid rgba(255,204,0,0.4);border-radius:12px;text-align:center;}' +
      '#ffp-claim-code-block .ffp-cc-label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#FFCC00;margin-bottom:8px;}' +
      '#ffp-claim-code-block .ffp-cc-value{font-size:32px;font-weight:800;font-family:monospace;color:#FFCC00;letter-spacing:4px;margin-bottom:6px;}' +
      '#ffp-claim-code-block .ffp-cc-hint{font-size:11px;color:var(--muted,#8a99a8);line-height:1.5;}';
    document.head.appendChild(s);
  }

  // Inject the code display into the existing waiting modal
  function ensureCodeBlock() {
    var waiting = document.getElementById('claim-state-waiting');
    if (!waiting) return null;
    var block = document.getElementById('ffp-claim-code-block');
    if (block) return block;
    block = document.createElement('div');
    block.id = 'ffp-claim-code-block';
    block.innerHTML =
      '<div class="ffp-cc-label">Your claim code</div>' +
      '<div class="ffp-cc-value" id="ffp-claim-code-value">— — — —</div>' +
      '<div class="ffp-cc-hint">Show this code to staff at the venue. They\'ll verify it on their device and your claim will be approved.</div>';

    // Insert before the "Cancel request" button
    var cancelBtn = waiting.querySelector('.await-cancel');
    if (cancelBtn && cancelBtn.parentNode) {
      cancelBtn.parentNode.insertBefore(block, cancelBtn);
    } else {
      waiting.appendChild(block);
    }
    return block;
  }

  function setWaitingState(deal, code) {
    document.getElementById('claim-state-waiting').style.display = '';
    document.getElementById('claim-state-approved').style.display = 'none';
    document.getElementById('claim-state-declined').style.display = 'none';
    document.getElementById('claim-partner-w').textContent = deal.venue || '';
    document.getElementById('claim-deal-w').textContent = deal.perk || '';
    var logo = document.getElementById('claim-logo');
    if (logo) logo.textContent = (deal.letter || (deal.venue || '?')[0] || '?').toUpperCase();
    ensureCodeBlock();
    var codeEl = document.getElementById('ffp-claim-code-value');
    if (codeEl) codeEl.textContent = code || '— — — —';
    document.getElementById('claim-backdrop').classList.add('open');
  }

  function setApprovedState(deal, claim) {
    document.getElementById('claim-state-waiting').style.display = 'none';
    document.getElementById('claim-state-approved').style.display = '';
    document.getElementById('claim-state-declined').style.display = 'none';
    document.getElementById('claim-partner-a').textContent = deal.venue || '';
    document.getElementById('claim-deal-a').textContent = deal.perk || '';
    var name = currentMemberName || 'Member';
    var memEl = document.getElementById('claim-member-name');
    if (memEl) memEl.textContent = name;
    var timeStr = claim.verified_at
      ? new Date(claim.verified_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    var timeEl = document.getElementById('claim-time');
    if (timeEl) timeEl.textContent = timeStr;
    var idEl = document.getElementById('claim-id');
    if (idEl) idEl.textContent = claim.claim_code || claim.id.slice(0, 6);

    // Lock the deal so member can't re-claim
    if (typeof Deals !== 'undefined' && Deals.claimed && deal.id) {
      Deals.claimed.add(deal.id);
      if (typeof Deals.render === 'function') {
        try { Deals.render(); } catch (e) {}
      }
    }
  }

  function setDeclinedState(deal, reason) {
    document.getElementById('claim-state-waiting').style.display = 'none';
    document.getElementById('claim-state-approved').style.display = 'none';
    document.getElementById('claim-state-declined').style.display = '';
    document.getElementById('claim-partner-d').textContent = deal.venue || '';
    document.getElementById('claim-deal-d').textContent = deal.perk || '';
    // Show reason if a declined-reason element exists; otherwise it's silently dropped
    var reasonEl = document.getElementById('claim-decline-reason');
    if (reasonEl && reason) reasonEl.textContent = reason;
  }

  function closeModal() {
    document.getElementById('claim-backdrop').classList.remove('open');
    teardownRealtime();
    activeClaim = null;
  }

  function teardownRealtime() {
    if (activeChannelName && window.FFPRealtime) {
      window.FFPRealtime.unsubscribe(activeChannelName);
      activeChannelName = null;
    }
  }

  function subscribeToClaim(claimId, deal) {
    if (!window.FFPRealtime) {
      console.warn('[FFP Claims] FFPRealtime helper not loaded — verification won\'t auto-update');
      return;
    }
    teardownRealtime();
    var name = 'ffp-claim-' + claimId;
    activeChannelName = name;
    window.FFPRealtime.subscribe(name, 'claims', 'id=eq.' + claimId, function (payload) {
      var row = payload && payload.new;
      if (!row) return;
      console.log('[FFP Claims] realtime update:', row.status);
      if (row.status === 'verified') {
        activeClaim = row;
        setApprovedState(deal, row);
      } else if (row.status === 'rejected' || row.status === 'declined') {
        setDeclinedState(deal, row.notes || '');
      }
    });
  }

  // ─── Real startClaim: insert a pending claim, show code, listen for verification ───
  async function startClaim(dealId) {
    if (typeof Deals === 'undefined') return;
    var deal = (Deals.data || []).find(function (d) { return d.id === dealId; });
    if (!deal) {
      toast('Deal not found', 'error');
      return;
    }
    if (Deals.claimed && Deals.claimed.has(dealId)) {
      toast('You\'ve already claimed this deal', 'info');
      return;
    }
    if (!currentUserId) {
      toast('Please sign in to claim deals', 'error');
      return;
    }

    // Open modal in waiting state with placeholder while we insert
    setWaitingState(deal, '— — — —');

    try {
      // Best-case: claim_code has a DEFAULT in the schema (ffp_generate_claim_code()).
      // Try insert without claim_code; fall back to RPC if needed.
      var insertRes = await window.supabase
        .from('claims')
        .insert({
          member_id: currentUserId,
          deal_id: dealId,
          status: 'pending'
        })
        .select('id, claim_code, status')
        .single();

      if (insertRes.error) {
        // Maybe claim_code column doesn't have a default — try generating via RPC
        if (/null value in column "claim_code"/i.test(insertRes.error.message || '')) {
          var rpcRes = await window.supabase.rpc('ffp_generate_claim_code');
          if (rpcRes.error) throw rpcRes.error;
          var code = rpcRes.data;
          insertRes = await window.supabase
            .from('claims')
            .insert({
              member_id: currentUserId,
              deal_id: dealId,
              status: 'pending',
              claim_code: code
            })
            .select('id, claim_code, status')
            .single();
          if (insertRes.error) throw insertRes.error;
        } else {
          throw insertRes.error;
        }
      }

      activeClaim = insertRes.data;
      setWaitingState(deal, activeClaim.claim_code || '????-????');
      subscribeToClaim(activeClaim.id, deal);
    } catch (e) {
      console.error('[FFP Claims] startClaim:', e);
      toast(e.message || 'Could not create claim', 'error');
      closeModal();
    }
  }

  // ─── Cancel: mark claim as cancelled (or delete) ───
  async function cancelClaim() {
    if (!activeClaim) {
      closeModal();
      return;
    }
    var claimId = activeClaim.id;
    try {
      // Delete the pending claim entirely (member changed their mind before showing the code)
      var res = await window.supabase
        .from('claims')
        .delete()
        .eq('id', claimId)
        .eq('status', 'pending');
      if (res.error) {
        console.warn('[FFP Claims] cancel delete:', res.error);
        // Non-fatal — modal closes anyway
      }
    } catch (e) {
      console.warn('[FFP Claims] cancel exception:', e);
    }
    closeModal();
  }

  function closeClaim() {
    closeModal();
  }

  // ─── Init ───
  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && typeof Deals !== 'undefined' && document.getElementById('claim-backdrop');
    }, 20000);
    if (!ok) {
      console.error('[FFP Claims] dependencies never loaded');
      return;
    }

    // Get current user
    try {
      var sess = await window.supabase.auth.getUser();
      if (sess && sess.data && sess.data.user) {
        currentUserId = sess.data.user.id;
        // Try to fetch member name for the approved state display
        var memRes = await window.supabase
          .from('members')
          .select('full_name, given_names')
          .eq('id', currentUserId)
          .maybeSingle();
        if (!memRes.error && memRes.data) {
          currentMemberName = memRes.data.full_name || memRes.data.given_names || '';
        }
      }
    } catch (e) {
      console.warn('[FFP Claims] auth fetch:', e);
    }

    // Override Deals module methods
    if (typeof Deals.startClaim === 'function') Deals.startClaim = startClaim;
    if (typeof Deals.cancelClaim === 'function') Deals.cancelClaim = cancelClaim;
    if (typeof Deals.closeClaim === 'function') Deals.closeClaim = closeClaim;
    // Remove the demo simulate functions
    if (typeof Deals.simulateApprove === 'function') Deals.simulateApprove = function () {};
    if (typeof Deals.simulateDecline === 'function') Deals.simulateDecline = function () {};

    injectStyles();

    // On member's existing claims (already pending), lock those deal cards so they can't re-claim
    try {
      var existing = await window.supabase
        .from('claims')
        .select('deal_id, status')
        .eq('member_id', currentUserId)
        .in('status', ['pending', 'verified']);
      if (!existing.error && existing.data && Deals.claimed) {
        existing.data.forEach(function (c) {
          if (c.deal_id) Deals.claimed.add(c.deal_id);
        });
        if (typeof Deals.render === 'function') {
          try { Deals.render(); } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[FFP Claims] existing claims fetch:', e);
    }

    console.log('[FFP Claims v1] Loaded \u2713');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

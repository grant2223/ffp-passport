/* FFP Provider Earnings Loader — v1
   Wires the Provider Earnings panel to real Supabase data.
   - Hero card: Total earned (lifetime) + Pending balance + Member tier
   - Earning methods reference (5 methods with tier rates)
   - Recent transactions (last 30)
   - Payout history
   - Request Payout button (enabled when pending >= AED 500)

   Data source: transactions + payouts tables (RLS scoped to member_id = auth.uid()).
*/
(function () {
  'use strict';

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Earnings]', msg);
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
  function fmtAED(n) {
    var v = Number(n) || 0;
    return 'AED ' + v.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  // Category → label map (matches FFP earnings categories)
  var CATEGORY_LABELS = {
    referrals: 'Member referral',
    deals: 'Deal commission',
    events: 'Event hosting',
    providers: 'Provider referral',
    activities: 'Activity log',
    meet_move: 'Meet & Move',
    challenges: 'Challenge prize',
    content: 'Content creation',
    payout: 'Payout'
  };

  // Earning methods reference (the 5 live methods per FFP brand)
  var EARNING_METHODS = [
    {
      key: 'refer',
      title: 'Refer a member',
      desc: 'Share your code. When they join and pay their membership, you earn.',
      rates: { Member: 25, Supporter: 50, Ambassador: 100 }
    },
    {
      key: 'content',
      title: 'Create content',
      desc: 'Post photos, reviews, or videos of FFP venues. Admin reviews and pays per approved piece.',
      rates: { Member: 10, Supporter: 25, Ambassador: 50 }
    },
    {
      key: 'promote-provider',
      title: 'Promote a provider',
      desc: 'Refer a new business to list on FFP. Earn when their first member books.',
      rates: { Member: 100, Supporter: 200, Ambassador: 400 }
    },
    {
      key: 'host-event',
      title: 'Host an event',
      desc: 'Run an FFP-sanctioned event or Meet & Move. Earn per confirmed attendee.',
      rates: { Member: 10, Supporter: 25, Ambassador: 50 }
    },
    {
      key: 'win-challenge',
      title: 'Win a challenge',
      desc: 'Place on a leaderboard. Prize amounts vary per challenge.',
      rates: { Member: 'varies', Supporter: 'varies', Ambassador: 'varies' }
    }
  ];

  function injectStyles() {
    if (document.getElementById('ffp-provider-earnings-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-provider-earnings-css';
    css.textContent = [
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',
      'select{appearance:none;-webkit-appearance:none;-moz-appearance:none;' +
        'background-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238a99a8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E");' +
        'background-repeat:no-repeat;background-position:right 12px center;background-size:16px;padding-right:36px;}',

      '.ffp-earn-hero{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:20px;}',
      '@media(max-width:780px){.ffp-earn-hero{grid-template-columns:1fr;}}',
      '.ffp-earn-stat{background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:14px;padding:18px 20px;}',
      '.ffp-earn-stat-label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--ffp-text-muted);margin-bottom:8px;}',
      '.ffp-earn-stat-val{font-size:28px;font-weight:800;color:var(--ffp-text);line-height:1.1;}',
      '.ffp-earn-stat-sub{font-size:11px;color:var(--ffp-text-muted);margin-top:6px;}',
      '.ffp-earn-tier-pill{display:inline-block;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;background:rgba(43,168,224,0.12);color:#2ba8e0;border:1px solid rgba(43,168,224,0.3);}',
      '.ffp-earn-tier-pill.supporter{background:rgba(74,222,128,0.12);color:#4ade80;border-color:rgba(74,222,128,0.3);}',
      '.ffp-earn-tier-pill.ambassador{background:rgba(255,204,0,0.12);color:#FFCC00;border-color:rgba(255,204,0,0.3);}',

      '.ffp-earn-payout-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:12px;margin-bottom:20px;}',
      '.ffp-earn-payout-msg{font-size:12px;color:var(--ffp-text-muted);flex:1;}',

      '.ffp-earn-section{background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:14px;padding:18px 20px;margin-bottom:16px;}',
      '.ffp-earn-section-title{font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--ffp-text);margin-bottom:14px;}',

      '.ffp-earn-method-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',
      '@media(max-width:680px){.ffp-earn-method-grid{grid-template-columns:1fr;}}',
      '.ffp-earn-method{padding:14px;background:var(--ffp-bg-3);border-radius:10px;border:1px solid var(--ffp-border);}',
      '.ffp-earn-method-h{font-size:13px;font-weight:700;color:var(--ffp-text);margin-bottom:4px;}',
      '.ffp-earn-method-d{font-size:11px;color:var(--ffp-text-muted);line-height:1.5;margin-bottom:10px;}',
      '.ffp-earn-method-rates{display:flex;gap:8px;flex-wrap:wrap;}',
      '.ffp-earn-rate-pill{font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(43,168,224,0.08);color:var(--ffp-text-muted);border:1px solid rgba(43,168,224,0.18);}',
      '.ffp-earn-rate-pill b{color:var(--ffp-text);}',

      '.ffp-earn-tx-list{display:flex;flex-direction:column;gap:0;}',
      '.ffp-earn-tx{display:grid;grid-template-columns:1fr auto auto;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid var(--ffp-border);}',
      '.ffp-earn-tx:last-child{border-bottom:none;}',
      '.ffp-earn-tx-main{min-width:0;}',
      '.ffp-earn-tx-title{font-size:13px;font-weight:700;color:var(--ffp-text);}',
      '.ffp-earn-tx-meta{font-size:11px;color:var(--ffp-text-muted);margin-top:2px;}',
      '.ffp-earn-tx-amt{font-size:14px;font-weight:800;color:#4ade80;text-align:right;white-space:nowrap;}',
      '.ffp-earn-tx-amt.out{color:#ef4444;}',
      '.ffp-earn-tx-status{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:5px;white-space:nowrap;}',
      '.ffp-earn-tx-status.pending{background:rgba(255,204,0,0.12);color:#FFCC00;border:1px solid rgba(255,204,0,0.28);}',
      '.ffp-earn-tx-status.paid{background:rgba(74,222,128,0.12);color:#4ade80;border:1px solid rgba(74,222,128,0.28);}',
      '.ffp-earn-tx-status.rejected{background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.28);}',

      '.ffp-earn-empty{text-align:center;padding:30px 14px;color:var(--ffp-text-muted);font-size:12px;}'
    ].join('');
    document.head.appendChild(css);
  }

  function getOwnerUid() {
    if (window.FFP_PROVIDER && window.FFP_PROVIDER.owner_user_id) {
      return window.FFP_PROVIDER.owner_user_id;
    }
    return null;
  }

  async function getMyUid() {
    var sess = await window.supabase.auth.getUser();
    return sess && sess.data && sess.data.user ? sess.data.user.id : null;
  }

  // Compute provider's current tier from transactions
  // Tiers based on category count thresholds per FFP brand rules:
  //  - Member (default)
  //  - Supporter: 2+ in any 4 of 7 categories
  //  - Ambassador: 8+ in any 4 of 7 categories
  function computeTier(transactions) {
    var TIER_CATEGORIES = ['referrals', 'deals', 'events', 'providers', 'activities', 'meet_move', 'challenges'];
    var counts = {};
    TIER_CATEGORIES.forEach(function (c) { counts[c] = 0; });
    transactions.forEach(function (tx) {
      if (tx.type === 'in' && tx.status === 'paid' && counts[tx.category] != null) {
        counts[tx.category]++;
      }
    });
    var ambassadorCount = TIER_CATEGORIES.filter(function (c) { return counts[c] >= 8; }).length;
    var supporterCount = TIER_CATEGORIES.filter(function (c) { return counts[c] >= 2; }).length;
    if (ambassadorCount >= 4) return 'Ambassador';
    if (supporterCount >= 4) return 'Supporter';
    return 'Member';
  }

  async function fetchAll(uid) {
    var [txRes, poRes] = await Promise.all([
      window.supabase
        .from('transactions')
        .select('id, type, amount_aed, source, category, status, notes, created_at')
        .eq('member_id', uid)
        .order('created_at', { ascending: false })
        .limit(50),
      window.supabase
        .from('payouts')
        .select('id, amount_aed, method, status, processed_at, requested_at, notes')
        .eq('member_id', uid)
        .order('requested_at', { ascending: false })
        .limit(20)
    ]);
    if (txRes.error) console.warn('[FFP Earnings] tx fetch:', txRes.error);
    if (poRes.error) console.warn('[FFP Earnings] payouts fetch:', poRes.error);
    return {
      transactions: txRes.data || [],
      payouts: poRes.data || []
    };
  }

  function calcTotals(transactions, payouts) {
    // Lifetime earned = sum of all paid 'in' transactions (excluding payout deductions)
    var lifetime = 0;
    var pending = 0;
    transactions.forEach(function (tx) {
      if (tx.type === 'in' && tx.category !== 'payout') {
        if (tx.status === 'paid') lifetime += Number(tx.amount_aed) || 0;
        else if (tx.status === 'pending') pending += Number(tx.amount_aed) || 0;
      }
    });
    // Subtract all paid/approved payouts from lifetime to get available balance
    var paidOut = 0;
    var pendingPayout = 0;
    payouts.forEach(function (p) {
      var amt = Number(p.amount_aed) || 0;
      if (p.status === 'paid') paidOut += amt;
      else if (p.status === 'pending' || p.status === 'approved') pendingPayout += amt;
    });
    var available = Math.max(0, lifetime - paidOut - pendingPayout);
    return { lifetime: lifetime, pending: pending, paidOut: paidOut, pendingPayout: pendingPayout, available: available };
  }

  function renderHero(totals, tier) {
    var tierLower = tier.toLowerCase();
    return (
      '<div class="ffp-earn-hero">' +
        '<div class="ffp-earn-stat">' +
          '<div class="ffp-earn-stat-label">Total earned</div>' +
          '<div class="ffp-earn-stat-val">' + escHtml(fmtAED(totals.lifetime)) + '</div>' +
          '<div class="ffp-earn-stat-sub">Lifetime paid earnings</div>' +
        '</div>' +
        '<div class="ffp-earn-stat">' +
          '<div class="ffp-earn-stat-label">Available balance</div>' +
          '<div class="ffp-earn-stat-val">' + escHtml(fmtAED(totals.available)) + '</div>' +
          '<div class="ffp-earn-stat-sub">' +
            (totals.pending > 0 ? '+ ' + escHtml(fmtAED(totals.pending)) + ' pending approval' : 'Ready to withdraw') +
          '</div>' +
        '</div>' +
        '<div class="ffp-earn-stat">' +
          '<div class="ffp-earn-stat-label">Your tier</div>' +
          '<div class="ffp-earn-stat-val">' +
            '<span class="ffp-earn-tier-pill ' + tierLower + '">' + escHtml(tier) + '</span>' +
          '</div>' +
          '<div class="ffp-earn-stat-sub">Higher tiers earn more per action</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderPayoutBar(available, pendingPayout) {
    var canRequest = available >= 500;
    var msg;
    if (pendingPayout > 0) {
      msg = '<b>' + escHtml(fmtAED(pendingPayout)) + '</b> payout in progress';
    } else if (canRequest) {
      msg = '<b>' + escHtml(fmtAED(available)) + '</b> available to withdraw';
    } else {
      var needed = Math.max(0, 500 - available);
      msg = 'Minimum withdrawal is AED 500. Earn <b>' + escHtml(fmtAED(needed)) + '</b> more to request.';
    }
    return (
      '<div class="ffp-earn-payout-row">' +
        '<div class="ffp-earn-payout-msg">' + msg + '</div>' +
        '<button class="btn ' + (canRequest && pendingPayout === 0 ? 'btn-pri' : 'btn-ghost') + '" ' +
          (canRequest && pendingPayout === 0 ? '' : 'disabled ') +
          'onclick="ffpRequestPayout(' + available + ')">' +
          '<span class="ms">payments</span> Request payout' +
        '</button>' +
      '</div>'
    );
  }

  function renderMethods(tier) {
    var rows = EARNING_METHODS.map(function (m) {
      var rates = ['Member', 'Supporter', 'Ambassador'].map(function (t) {
        var r = m.rates[t];
        var current = t === tier;
        return '<span class="ffp-earn-rate-pill" style="' + (current ? 'background:rgba(255,204,0,0.12);border-color:rgba(255,204,0,0.28);color:#FFCC00;' : '') + '">' +
                  escHtml(t) + ': <b>' + (typeof r === 'number' ? 'AED ' + r : escHtml(r)) + '</b>' +
               '</span>';
      }).join('');
      return (
        '<div class="ffp-earn-method">' +
          '<div class="ffp-earn-method-h">' + escHtml(m.title) + '</div>' +
          '<div class="ffp-earn-method-d">' + escHtml(m.desc) + '</div>' +
          '<div class="ffp-earn-method-rates">' + rates + '</div>' +
        '</div>'
      );
    }).join('');
    return (
      '<div class="ffp-earn-section">' +
        '<div class="ffp-earn-section-title">How you earn</div>' +
        '<div class="ffp-earn-method-grid">' + rows + '</div>' +
      '</div>'
    );
  }

  function renderTransactions(transactions) {
    if (!transactions.length) {
      return (
        '<div class="ffp-earn-section">' +
          '<div class="ffp-earn-section-title">Recent transactions</div>' +
          '<div class="ffp-earn-empty">No transactions yet. Refer a member or host an event to start earning.</div>' +
        '</div>'
      );
    }
    var rows = transactions.map(function (tx) {
      var amount = (tx.type === 'out' ? '−' : '+') + fmtAED(tx.amount_aed);
      var cat = CATEGORY_LABELS[tx.category] || tx.category || '—';
      return (
        '<div class="ffp-earn-tx">' +
          '<div class="ffp-earn-tx-main">' +
            '<div class="ffp-earn-tx-title">' + escHtml(tx.source || cat) + '</div>' +
            '<div class="ffp-earn-tx-meta">' + escHtml(cat) + ' \u00b7 ' + escHtml(fmtDate(tx.created_at)) +
              (tx.notes ? ' \u00b7 ' + escHtml(tx.notes) : '') +
            '</div>' +
          '</div>' +
          '<div class="ffp-earn-tx-amt' + (tx.type === 'out' ? ' out' : '') + '">' + escHtml(amount) + '</div>' +
          '<div class="ffp-earn-tx-status ' + escHtml(tx.status) + '">' + escHtml(tx.status) + '</div>' +
        '</div>'
      );
    }).join('');
    return (
      '<div class="ffp-earn-section">' +
        '<div class="ffp-earn-section-title">Recent transactions</div>' +
        '<div class="ffp-earn-tx-list">' + rows + '</div>' +
      '</div>'
    );
  }

  function renderPayouts(payouts) {
    if (!payouts.length) {
      return (
        '<div class="ffp-earn-section">' +
          '<div class="ffp-earn-section-title">Payout history</div>' +
          '<div class="ffp-earn-empty">No payouts requested yet.</div>' +
        '</div>'
      );
    }
    var rows = payouts.map(function (p) {
      var when = fmtDate(p.processed_at || p.requested_at);
      return (
        '<div class="ffp-earn-tx">' +
          '<div class="ffp-earn-tx-main">' +
            '<div class="ffp-earn-tx-title">' + escHtml('Payout via ' + (p.method || 'bank')) + '</div>' +
            '<div class="ffp-earn-tx-meta">' + escHtml(when) + (p.notes ? ' \u00b7 ' + escHtml(p.notes) : '') + '</div>' +
          '</div>' +
          '<div class="ffp-earn-tx-amt out">−' + escHtml(fmtAED(p.amount_aed)) + '</div>' +
          '<div class="ffp-earn-tx-status ' + escHtml(p.status) + '">' + escHtml(p.status) + '</div>' +
        '</div>'
      );
    }).join('');
    return (
      '<div class="ffp-earn-section">' +
        '<div class="ffp-earn-section-title">Payout history</div>' +
        '<div class="ffp-earn-tx-list">' + rows + '</div>' +
      '</div>'
    );
  }

  async function refresh() {
    var uid = await getMyUid();
    if (!uid) return;
    var panel = document.getElementById('panel-earnings');
    if (!panel) return;

    var data = await fetchAll(uid);
    var totals = calcTotals(data.transactions, data.payouts);
    var tier = computeTier(data.transactions);

    // Wire up the global payout request function for this user's available balance
    window.ffpRequestPayout = function (available) {
      requestPayout(uid, available);
    };

    panel.innerHTML =
      '<div class="ph">Earnings</div>' +
      '<div class="psub">Track your AED earnings and request payouts. Minimum withdrawal: AED 500.</div>' +
      renderHero(totals, tier) +
      renderPayoutBar(totals.available, totals.pendingPayout) +
      renderMethods(tier) +
      renderTransactions(data.transactions) +
      renderPayouts(data.payouts);
  }

  async function requestPayout(uid, available) {
    if (available < 500) {
      toast('Minimum payout is AED 500', 'error');
      return;
    }
    var amount = prompt('Enter amount to withdraw (AED, max ' + available + '):', String(available));
    if (amount === null) return;
    var amt = Number(amount);
    if (!amt || isNaN(amt) || amt < 500) {
      toast('Amount must be at least AED 500', 'error');
      return;
    }
    if (amt > available) {
      toast('Amount exceeds available balance', 'error');
      return;
    }
    var method = prompt('Payout method (bank or other):', 'bank');
    if (method === null) return;
    method = (method || '').toLowerCase().trim();
    if (method !== 'bank' && method !== 'other') {
      toast('Method must be "bank" or "other"', 'error');
      return;
    }
    var bankDetails = '';
    if (method === 'bank') {
      bankDetails = prompt('Enter bank account details (IBAN, account holder, bank name):', '') || '';
      if (!bankDetails.trim()) {
        toast('Bank details required', 'error');
        return;
      }
    }
    try {
      var res = await window.supabase.from('payouts').insert({
        member_id: uid,
        amount_aed: amt,
        method: method,
        status: 'pending',
        bank_details: bankDetails || null,
        requested_at: new Date().toISOString()
      });
      if (res.error) throw res.error;
      toast('Payout requested. Admin will process within 7 days.', 'success');
      await refresh();
    } catch (e) {
      console.error('[FFP Earnings] requestPayout:', e);
      toast(e.message || 'Payout request failed', 'error');
    }
  }

  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth && document.getElementById('panel-earnings');
    }, 15000);
    if (!ok) {
      console.error('[FFP Earnings] dependencies never loaded');
      return;
    }

    // Wait for provider auth (FFP_PROVIDER set by provider profile loader)
    var authed = await waitFor(function () {
      return !!(window.FFP_PROVIDER && window.FFP_PROVIDER.id);
    }, 30000);
    if (!authed) {
      console.warn('[FFP Earnings] FFP_PROVIDER not set');
      return;
    }

    injectStyles();

    try {
      await refresh();
      console.log('[FFP Provider Earnings v1] Loaded \u2713');
    } catch (e) {
      console.error('[FFP Earnings] initial load:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* FFP Earnings Loader — v1
   Wires Earnings module in ffp-member-dashboard.html to Supabase.
   Reads:  members (referral_code), transactions (balance + history),
           referrals (stats), claims, rsvps, activity_logs, meetup_attendees,
           challenge_entries (category counters for tier computation)
   Writes: submitPayout → inserts payouts row + transactions row (status pending)
   Tier is computed locally from the category counters (Member/Supporter/Ambassador).
*/
(function () {
  'use strict';
  var retries = 0;
  var MAX_RETRIES = 30;
  var currentUserId = null;
  var wrapped = false;

  function injectStyles() {
    if (document.getElementById('ffp-earnings-loader-styles')) return;
    var s = document.createElement('style');
    s.id = 'ffp-earnings-loader-styles';
    s.textContent =
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}' +
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}';
    document.head.appendChild(s);
  }

  function daysAgoFromIso(iso) {
    if (!iso) return 0;
    var d = new Date(iso); d.setHours(0, 0, 0, 0);
    var t = new Date();   t.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((t - d) / 86400000));
  }

  // DB category → display category label
  function categoryLabel(cat) {
    switch (cat) {
      case 'referrals': return 'Referral reward';
      case 'deals':     return 'Deal reward';
      case 'events':    return 'Event reward';
      case 'providers': return 'Provider reward';
      case 'activities':return 'Activity reward';
      case 'meet_move': return 'Meet & Move reward';
      case 'challenges':return 'Challenge reward';
      case 'content':   return 'Content reward';
      case 'payout':    return 'Payout';
      default:          return cat || 'Reward';
    }
  }

  function txSourceFromRow(row) {
    if (row.source) return row.source;
    if (row.notes)  return row.notes;
    return categoryLabel(row.category);
  }

  // Compute balance: sum(in.paid) − sum(out where status in paid/pending)
  function computeBalance(rows) {
    var bal = 0;
    rows.forEach(function (r) {
      var amt = Number(r.amount_aed) || 0;
      if (r.type === 'in'  && r.status === 'paid') bal += amt;
      else if (r.type === 'out' && (r.status === 'paid' || r.status === 'pending')) bal -= amt;
    });
    return Math.round(bal);
  }

  // Count rows helper (head: true → just the count, no data)
  async function countRows(table, filterFn) {
    try {
      var q = window.supabase.from(table).select('*', { count: 'exact', head: true });
      q = filterFn(q);
      var res = await q;
      if (res.error) {
        console.error('[FFP Earnings] count ' + table + ':', res.error);
        return 0;
      }
      return res.count || 0;
    } catch (e) {
      console.error('[FFP Earnings] count ' + table + ':', e);
      return 0;
    }
  }

  async function loadFromSupabase() {
    if (!window.supabase || typeof Earnings === 'undefined') {
      if (retries < MAX_RETRIES) { retries++; setTimeout(loadFromSupabase, 200); }
      return;
    }
    injectStyles();

    try {
      var userRes = await window.supabase.auth.getUser();
      if (userRes.error || !userRes.data || !userRes.data.user) {
        console.log('[FFP Earnings] No user — keeping sample');
        return;
      }
      currentUserId = userRes.data.user.id;

      // 1. Referral code from members
      var memRes = await window.supabase
        .from('members')
        .select('referral_code')
        .eq('id', currentUserId)
        .maybeSingle();

      if (!memRes.error && memRes.data && memRes.data.referral_code) {
        Earnings.referralCode = memRes.data.referral_code;
      } else if (memRes.error) {
        console.error('[FFP Earnings] members read:', memRes.error);
      }

      // 2. Transactions (balance + history)
      var txRes = await window.supabase
        .from('transactions')
        .select('id, type, amount_aed, source, category, status, notes, created_at')
        .eq('member_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txRes.error) {
        console.error('[FFP Earnings] transactions read:', txRes.error);
      } else {
        var txRows = txRes.data || [];
        Earnings.balance = computeBalance(txRows);
        Earnings.transactions = txRows.map(function (r) {
          return {
            type: r.type,
            amount: Math.round(Number(r.amount_aed) || 0),
            source: txSourceFromRow(r),
            category: categoryLabel(r.category),
            daysAgo: daysAgoFromIso(r.created_at),
            status: r.status === 'pending' ? 'pending review'
                  : r.status === 'paid'    ? null
                  : r.status === 'rejected'? 'rejected'
                  : r.status
          };
        });
      }

      // 3. Referral stats (total, earned, pending)
      var refRes = await window.supabase
        .from('referrals')
        .select('status, reward_aed')
        .eq('referrer_id', currentUserId);

      if (refRes.error) {
        console.error('[FFP Earnings] referrals read:', refRes.error);
      } else {
        var refs = refRes.data || [];
        var total = refs.length;
        var earned = 0, pending = 0;
        refs.forEach(function (r) {
          var amt = Number(r.reward_aed) || 0;
          if (r.status === 'paid') earned += amt;
          if (r.status === 'pending' || r.status === 'signed_up') pending++;
        });
        Earnings.referralStats = {
          total: total,
          earned: Math.round(earned),
          pending: pending
        };
      }

      // 4. Category counters (parallel) — drive tier computation
      var counters = await Promise.all([
        // referrals: signed up or paid
        countRows('referrals', function (q) {
          return q.eq('referrer_id', currentUserId).in('status', ['signed_up', 'paid']);
        }),
        // deals: claims
        countRows('claims', function (q) {
          return q.eq('member_id', currentUserId);
        }),
        // events: rsvps marked attended
        countRows('rsvps', function (q) {
          return q.eq('member_id', currentUserId).eq('status', 'attended');
        }),
        // providers: no check-in feature yet
        Promise.resolve(0),
        // activities logged
        countRows('activity_logs', function (q) {
          return q.eq('member_id', currentUserId);
        }),
        // meet & move attended
        countRows('meetup_attendees', function (q) {
          return q.eq('member_id', currentUserId).eq('status', 'attended');
        }),
        // challenges entered
        countRows('challenge_entries', function (q) {
          return q.eq('member_id', currentUserId);
        })
      ]);

      // Dashboard categories order: referrals, deals, events, providers, logs, meet, challenges
      var catKeys = ['referrals', 'deals', 'events', 'providers', 'logs', 'meet', 'challenges'];
      Earnings.categories.forEach(function (cat, i) {
        var idx = catKeys.indexOf(cat.key);
        if (idx >= 0 && idx < counters.length) cat.current = counters[idx];
      });

      // 5. Wrap submitPayout
      wrapWrites();

      // 6. Re-render if Earnings panel is visible
      var panel = document.getElementById('panel-earnings');
      if (panel && panel.classList.contains('active') && typeof Earnings.render === 'function') {
        Earnings.render();
      }

      console.log('[FFP Earnings] Loaded from Supabase ✓');
    } catch (err) {
      console.error('[FFP Earnings] Unexpected error:', err);
    }
  }

  function wrapWrites() {
    if (wrapped) return;
    wrapped = true;

    var origSubmitPayout = Earnings.submitPayout.bind(Earnings);
    Earnings.submitPayout = async function () {
      // Capture amount + method BEFORE original runs (original closes modal + clears state)
      var amount = this._payoutAmount;
      var methodInput = document.querySelector('input[name="po-method"]:checked');
      var method = methodInput ? methodInput.value : 'bank';
      // Guard locally (mirror original's checks) so we don't insert if the user is bouncing off limits
      if (amount < 500 || amount > this.balance) {
        origSubmitPayout();
        return;
      }
      origSubmitPayout();
      if (!currentUserId) return;
      try {
        // 1. Insert payout request
        var payoutRes = await window.supabase.from('payouts').insert({
          member_id: currentUserId,
          amount_aed: amount,
          method: method,
          status: 'pending',
          requested_at: new Date().toISOString()
        }).select('id').single();
        if (payoutRes.error) {
          console.error('[FFP Earnings] payout insert:', payoutRes.error);
          return;
        }
        // 2. Mirror to transactions so balance math reflects the reservation
        var txRes = await window.supabase.from('transactions').insert({
          member_id: currentUserId,
          type: 'out',
          amount_aed: amount,
          source: 'Payout request — ' + (method === 'bank' ? 'bank transfer' : 'other'),
          category: 'payout',
          status: 'pending',
          related_id: payoutRes.data.id,
          created_at: new Date().toISOString()
        });
        if (txRes.error) {
          // Non-fatal — payout still recorded. Admin can reconcile.
          console.error('[FFP Earnings] payout transaction mirror:', txRes.error);
        }
      } catch (e) {
        console.error('[FFP Earnings] payout submit:', e);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(loadFromSupabase, 400); });
  } else {
    setTimeout(loadFromSupabase, 400);
  }
  window.ffpReloadEarnings = loadFromSupabase;
})();

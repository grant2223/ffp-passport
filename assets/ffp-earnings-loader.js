/* FFP Earnings Loader — v3
   Wires Earnings module in ffp-member-dashboard.html to Supabase.
   Reads:  members (referral_code), transactions (balance + history),
           referrals (stats), claims, rsvps, activity_logs, meetup_attendees,
           challenge_entries (category counters for tier computation)
   Writes: submitPayout → inserts payouts row + transactions row (status pending)
   Tier is computed locally from the category counters (Member/Supporter/Ambassador).

   v3 changes:
   - REPLACES openPayout wrap with MutationObserver watching #payout-modal-backdrop
   - Bank fields inject reliably regardless of how the modal is opened
   - Re-checks injection on every modal show (handles modal re-use)
   - Stricter IBAN validation (UAE IBANs start with AE + 21 chars total)
   - Auto-formats IBAN to uppercase, strips spaces

   v2 changes (kept):
   - INJECTS bank account fields (holder name, IBAN, bank name) into the payout modal
   - For "Other" method, injects a free-text textarea
   - Validates bank_details is non-empty before submission
   - Adds confirm() before submitting (real money — be deliberate)
   - Stores bank_details on the payouts row so admin can do the transfer immediately
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

  // ─── v2: Inject bank_details + IBAN/account name fields into the existing payout modal ───
  function injectBankFieldsIntoModal() {
    var modal = document.querySelector('#payout-modal-backdrop .detail-modal');
    if (!modal) return;
    if (modal.querySelector('#ffp-bank-details-block')) return;  // already injected

    var methodBlock = modal.querySelector('.payout-method-block');
    if (!methodBlock) return;

    var bankBlock = document.createElement('div');
    bankBlock.id = 'ffp-bank-details-block';
    bankBlock.style.cssText = 'margin-top:14px;padding:14px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.18);border-radius:10px;';
    bankBlock.innerHTML =
      '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted-lt,#8a99a8);margin-bottom:10px;">Bank account details (required for bank transfer)</div>' +
      '<input id="ffp-payout-bank-name" type="text" placeholder="Account holder name (as on card)" style="width:100%;background:rgba(0,0,0,0.25);border:1px solid rgba(43,168,224,0.25);border-radius:8px;padding:10px 12px;font-size:13px;font-weight:600;color:#fff;font-family:Montserrat,sans-serif;margin-bottom:8px;outline:none;">' +
      '<input id="ffp-payout-iban" type="text" placeholder="IBAN" style="width:100%;background:rgba(0,0,0,0.25);border:1px solid rgba(43,168,224,0.25);border-radius:8px;padding:10px 12px;font-size:13px;font-weight:600;color:#fff;font-family:Montserrat,sans-serif;margin-bottom:8px;outline:none;">' +
      '<input id="ffp-payout-bank" type="text" placeholder="Bank name (e.g. Emirates NBD)" style="width:100%;background:rgba(0,0,0,0.25);border:1px solid rgba(43,168,224,0.25);border-radius:8px;padding:10px 12px;font-size:13px;font-weight:600;color:#fff;font-family:Montserrat,sans-serif;outline:none;">' +
      '<div style="font-size:10px;color:var(--muted,#6a90a8);margin-top:8px;line-height:1.5;">Stored only for this payout. We never store card details.</div>';
    methodBlock.parentNode.insertBefore(bankBlock, methodBlock.nextSibling);

    var otherBlock = document.createElement('div');
    otherBlock.id = 'ffp-other-details-block';
    otherBlock.style.cssText = 'display:none;margin-top:14px;padding:14px;background:rgba(255,204,0,0.06);border:1px solid rgba(255,204,0,0.18);border-radius:10px;';
    otherBlock.innerHTML =
      '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted-lt,#8a99a8);margin-bottom:10px;">How should we reach you?</div>' +
      '<textarea id="ffp-payout-other" rows="3" placeholder="Tell us how you\'d like to receive your payout (e.g. crypto wallet, in-person cash pickup, etc.)" style="width:100%;background:rgba(0,0,0,0.25);border:1px solid rgba(255,204,0,0.25);border-radius:8px;padding:10px 12px;font-size:13px;font-weight:600;color:#fff;font-family:Montserrat,sans-serif;outline:none;resize:vertical;"></textarea>';
    methodBlock.parentNode.insertBefore(otherBlock, bankBlock.nextSibling);

    // Show/hide based on method radio
    modal.querySelectorAll('input[name="po-method"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        var m = radio.value;
        bankBlock.style.display = (m === 'bank') ? '' : 'none';
        otherBlock.style.display = (m === 'other') ? '' : 'none';
      });
    });
  }

  function collectBankDetails() {
    var methodInput = document.querySelector('input[name="po-method"]:checked');
    var method = methodInput ? methodInput.value : 'bank';
    if (method === 'bank') {
      var name = (document.getElementById('ffp-payout-bank-name') || {}).value || '';
      var iban = (document.getElementById('ffp-payout-iban') || {}).value || '';
      var bank = (document.getElementById('ffp-payout-bank') || {}).value || '';
      name = name.trim();
      iban = iban.trim().replace(/\s+/g, '').toUpperCase();
      bank = bank.trim();
      if (!name || !iban || !bank) {
        showToast('Please fill in account holder name, IBAN, and bank name', 'error');
        return null;
      }
      // UAE IBANs are 23 chars total: AE + 2 check digits + 19 account digits
      if (!/^AE\d{21}$/.test(iban)) {
        showToast('IBAN must start with AE followed by 21 digits (23 characters total)', 'error');
        return null;
      }
      return {
        method: 'bank',
        bank_details: 'Account holder: ' + name + '\nIBAN: ' + iban + '\nBank: ' + bank
      };
    } else {
      var other = (document.getElementById('ffp-payout-other') || {}).value || '';
      other = other.trim();
      if (!other) {
        showToast('Please tell us how you\'d like to receive your payout', 'error');
        return null;
      }
      return { method: 'other', bank_details: other };
    }
  }

  function showToast(msg, kind) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, kind || 'info'); return; } catch (e) {} }
    console.log('[FFP Earnings]', msg);
  }

  // Hook into modal opening via MutationObserver (more reliable than wrapping openPayout)
  // — watches for the .open class being added to the modal backdrop, then injects.
  function startModalObserver() {
    var backdrop = document.getElementById('payout-modal-backdrop');
    if (!backdrop) {
      // Retry until DOM is ready (modal HTML is inline so should be ready after DOMContentLoaded)
      setTimeout(startModalObserver, 500);
      return;
    }
    if (backdrop._ffpObserver) return; // already wired
    backdrop._ffpObserver = true;

    function check() {
      if (backdrop.classList.contains('open')) {
        // Slight delay so any other DOM updates settle
        setTimeout(injectBankFieldsIntoModal, 30);
      }
    }
    // Initial check
    check();
    // Watch for class changes
    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          check();
        }
      });
    });
    obs.observe(backdrop, { attributes: true, attributeFilter: ['class'] });
  }

  function wrapWrites() {
    if (wrapped) return;
    wrapped = true;

    startModalObserver();

    var origSubmitPayout = Earnings.submitPayout.bind(Earnings);
    Earnings.submitPayout = async function () {
      // Capture amount + method BEFORE original runs (original closes modal + clears state)
      var amount = this._payoutAmount;
      // Guard amount before collecting bank details
      if (amount < 500) { showToast('Minimum payout is AED 500', 'error'); return; }
      if (amount > this.balance) { showToast('Amount exceeds balance', 'error'); return; }

      // Collect + validate bank/other details BEFORE the original closes the modal
      var details = collectBankDetails();
      if (!details) return;  // validation failed, modal stays open

      // Final confirmation — this is real money
      if (!confirm('Submit payout request for AED ' + amount.toLocaleString() + ' via ' + details.method + '?\n\nAdmin will review and contact you within 3\u20135 business days.')) {
        return;
      }

      origSubmitPayout();  // closes modal + clears state
      if (!currentUserId) return;
      try {
        // 1. Insert payout request (now WITH bank_details)
        var payoutRes = await window.supabase.from('payouts').insert({
          member_id: currentUserId,
          amount_aed: amount,
          method: details.method,
          bank_details: details.bank_details,
          status: 'pending',
          requested_at: new Date().toISOString()
        }).select('id').single();
        if (payoutRes.error) {
          console.error('[FFP Earnings] payout insert:', payoutRes.error);
          showToast('Payout request failed: ' + payoutRes.error.message, 'error');
          return;
        }
        // 2. Mirror to transactions so balance math reflects the reservation
        var txRes = await window.supabase.from('transactions').insert({
          member_id: currentUserId,
          type: 'out',
          amount_aed: amount,
          source: 'Payout request \u2014 ' + (details.method === 'bank' ? 'bank transfer' : 'other'),
          category: 'payout',
          status: 'pending',
          related_id: payoutRes.data.id,
          created_at: new Date().toISOString()
        });
        if (txRes.error) {
          // Non-fatal — payout still recorded. Admin can reconcile.
          console.error('[FFP Earnings] payout transaction mirror:', txRes.error);
        }
        showToast('Payout requested. Admin will review within 3\u20135 business days.', 'success');
      } catch (e) {
        console.error('[FFP Earnings] payout submit:', e);
        showToast(e.message || 'Payout request failed', 'error');
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

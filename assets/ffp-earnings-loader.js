/* FFP Earnings Loader — v6
   v6 changes:
   - DEDICATED "Your Payouts" section in Earnings panel (above Recent activity).
     Shows ONLY payouts (not earnings transactions). Big status pills, clear
     amount, requested + processed dates, View Receipt button on Paid, rejection
     reason inline for Rejected. Empty state when no payouts yet.
   - REAL-TIME updates via Supabase Realtime: when admin approves/rejects/pays
     a member's payout, the member's panel auto-updates without refresh. Balance,
     transactions, and Payouts section all reflect new state immediately.
   - "View receipt" button kept on Recent activity rows for backward consistency,
     but the Payouts section is now the primary place to track payment status.

   v5 changes (kept):
   - Member can view payment receipts for paid payouts (image or PDF inline)

   v4 changes (kept):
   - Bank fields: clearer labels, IBAN format hint with live validation, branch city
*/
(function () {
  'use strict';
  var retries = 0;
  var MAX_RETRIES = 30;
  var currentUserId = null;
  var wrapped = false;
  var memberPayouts = [];
  var realtimeChannel = null;

  function injectStyles() {
    if (document.getElementById('ffp-earnings-loader-styles')) return;
    var s = document.createElement('style');
    s.id = 'ffp-earnings-loader-styles';
    s.textContent =
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}' +
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}' +
      // ─── Dedicated Payouts section ───
      '#ffp-payouts-section{margin:18px 0;}' +
      '#ffp-payouts-section .ffp-po-title-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}' +
      '#ffp-payouts-section .ffp-po-title{font-size:14px;font-weight:800;color:var(--text,#e8eef4);letter-spacing:0.3px;}' +
      '#ffp-payouts-section .ffp-po-subtitle{font-size:11px;color:var(--muted,#8a99a8);margin-top:2px;}' +
      '#ffp-payouts-section .ffp-po-list{background:rgba(43,168,224,0.04);border:1px solid var(--border-mid,rgba(43,168,224,0.30));border-radius:12px;overflow:hidden;}' +
      '#ffp-payouts-section .ffp-po-empty{padding:24px 16px;text-align:center;color:var(--muted,#8a99a8);font-size:12px;}' +
      '#ffp-payouts-section .ffp-po-row{padding:14px 16px;border-bottom:1px solid rgba(43,168,224,0.10);display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start;}' +
      '#ffp-payouts-section .ffp-po-row:last-child{border-bottom:none;}' +
      '#ffp-payouts-section .ffp-po-amount{font-size:18px;font-weight:800;color:var(--text,#e8eef4);letter-spacing:-0.3px;}' +
      '#ffp-payouts-section .ffp-po-method{font-size:11px;color:var(--muted,#8a99a8);text-transform:uppercase;letter-spacing:1px;margin-top:3px;}' +
      '#ffp-payouts-section .ffp-po-dates{font-size:11px;color:var(--muted,#8a99a8);margin-top:6px;line-height:1.5;}' +
      '#ffp-payouts-section .ffp-po-dates b{color:var(--text,#e8eef4);font-weight:600;}' +
      '#ffp-payouts-section .ffp-po-pill{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;padding:5px 10px;border-radius:6px;white-space:nowrap;}' +
      '#ffp-payouts-section .ffp-po-pill.pending{background:rgba(255,204,0,0.12);color:#FFCC00;border:1px solid rgba(255,204,0,0.35);}' +
      '#ffp-payouts-section .ffp-po-pill.approved{background:rgba(43,168,224,0.12);color:#7dd3fc;border:1px solid rgba(43,168,224,0.35);}' +
      '#ffp-payouts-section .ffp-po-pill.paid{background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.40);}' +
      '#ffp-payouts-section .ffp-po-pill.rejected{background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.35);}' +
      '#ffp-payouts-section .ffp-po-reason{margin-top:8px;padding:8px 10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;font-size:11px;color:#fca5a5;line-height:1.5;}' +
      '#ffp-payouts-section .ffp-po-view-btn{margin-top:8px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.35);color:#4ade80;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;display:inline-flex;align-items:center;gap:5px;}' +
      '#ffp-payouts-section .ffp-po-view-btn:hover{filter:brightness(1.15);}' +
      '@media (max-width: 480px){' +
        '#ffp-payouts-section .ffp-po-row{grid-template-columns:1fr;}' +
        '#ffp-payouts-section .ffp-po-pill{justify-self:start;}' +
      '}';
    document.head.appendChild(s);
  }

  // ─── Dedicated Payouts section renderer ───
  function renderPayoutsSection() {
    var panel = document.getElementById('panel-earnings');
    if (!panel) return;

    var section = document.getElementById('ffp-payouts-section');
    if (!section) {
      section = document.createElement('div');
      section.id = 'ffp-payouts-section';
      // Inject above the Recent activity section
      var recentList = document.getElementById('earn-tx-list');
      if (recentList) {
        // Insert before the parent of earn-tx-list (its section container)
        var parent = recentList.parentNode;
        // Find the section-title above it, if any, to insert before that header block
        var insertBeforeNode = recentList;
        // Walk up to find the appropriate container
        var probe = recentList;
        for (var i = 0; i < 4 && probe.parentNode; i++) {
          if (probe.previousElementSibling && /section-title/i.test(probe.previousElementSibling.className || '')) {
            insertBeforeNode = probe.previousElementSibling;
            break;
          }
          probe = probe.parentNode;
        }
        insertBeforeNode.parentNode.insertBefore(section, insertBeforeNode);
      } else {
        panel.appendChild(section);
      }
    }

    var titleRow =
      '<div class="ffp-po-title-row">' +
        '<div>' +
          '<div class="ffp-po-title">Your Payouts</div>' +
          '<div class="ffp-po-subtitle">Track every withdrawal request and its status</div>' +
        '</div>' +
      '</div>';

    if (!memberPayouts.length) {
      section.innerHTML = titleRow +
        '<div class="ffp-po-list">' +
          '<div class="ffp-po-empty">' +
            'No payouts yet. When your balance reaches AED 500, request your first one above.' +
          '</div>' +
        '</div>';
      return;
    }

    var rows = memberPayouts.map(function (p) {
      var amt = Math.round(Number(p.amount_aed) || 0);
      var status = p.status || 'pending';
      var statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      if (status === 'pending') statusLabel = 'Under review';

      var dates =
        '<b>Requested:</b> ' + escHtml(fmtNiceDate(p.requested_at));
      if (p.processed_at && (status === 'paid' || status === 'rejected')) {
        var processedLabel = status === 'paid' ? 'Transferred' : 'Reviewed';
        dates += '<br><b>' + processedLabel + ':</b> ' + escHtml(fmtNiceDate(p.processed_at));
      }
      if (status === 'approved') {
        dates += '<br><b>Expected by:</b> ' + escHtml(plus14DaysFrom(p.requested_at));
      }

      var rejectionBlock = '';
      if (status === 'rejected' && p.notes) {
        rejectionBlock = '<div class="ffp-po-reason"><b>Reason:</b> ' + escHtml(p.notes) + '</div>';
      }

      var receiptBtn = '';
      if (status === 'paid' && (p.receipt_url || p.notes)) {
        var poJson = encodeURIComponent(JSON.stringify({
          notes: p.notes || '',
          receiptUrl: p.receipt_url || ''
        }));
        receiptBtn =
          '<button class="ffp-po-view-btn" onclick="ffpOpenReceiptFromAttr(this)" data-payout="' + poJson + '">' +
            '<span class="material-icons" style="font-size:14px;">receipt_long</span>View receipt' +
          '</button>';
      }

      return '<div class="ffp-po-row">' +
        '<div>' +
          '<div class="ffp-po-amount">AED ' + amt.toLocaleString() + '</div>' +
          '<div class="ffp-po-method">' + escHtml(p.method || 'bank') + ' transfer</div>' +
          '<div class="ffp-po-dates">' + dates + '</div>' +
          rejectionBlock +
          receiptBtn +
        '</div>' +
        '<div class="ffp-po-pill ' + escHtml(status) + '">' + escHtml(statusLabel) + '</div>' +
      '</div>';
    }).join('');

    section.innerHTML = titleRow + '<div class="ffp-po-list">' + rows + '</div>';
  }

  // Global handler for receipt button in Payouts section
  window.ffpOpenReceiptFromAttr = function (btn) {
    try {
      var data = JSON.parse(decodeURIComponent(btn.getAttribute('data-payout') || '{}'));
      openReceiptModal({ _ffpNotes: data.notes, _ffpReceiptUrl: data.receiptUrl });
    } catch (e) {
      console.error('[FFP Earnings] receipt open:', e);
    }
  };

  function fmtNiceDate(iso) {
    if (!iso) return '\u2014';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '\u2014';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }
  function plus14DaysFrom(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    d.setDate(d.getDate() + 14);
    return fmtNiceDate(d.toISOString());
  }

  // ─── Real-time subscription so panel auto-updates on admin changes ───
  function subscribeRealtime() {
    if (realtimeChannel) return;
    if (!window.supabase || typeof window.supabase.channel !== 'function') return;
    realtimeChannel = window.supabase
      .channel('ffp-member-earnings-' + (currentUserId || 'anon'))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'payouts', filter: 'member_id=eq.' + currentUserId },
        function () { loadFromSupabase(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: 'member_id=eq.' + currentUserId },
        function () { loadFromSupabase(); }
      )
      .subscribe();
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
        .select('id, type, amount_aed, source, category, status, notes, related_id, created_at')
        .eq('member_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txRes.error) {
        console.error('[FFP Earnings] transactions read:', txRes.error);
      } else {
        var txRows = txRes.data || [];
        Earnings.balance = computeBalance(txRows);

        // For paid payouts, fetch the receipt URL from payouts table
        var paidPayoutIds = txRows
          .filter(function (r) { return r.category === 'payout' && r.status === 'paid' && r.related_id; })
          .map(function (r) { return r.related_id; });
        var receiptMap = {};
        if (paidPayoutIds.length) {
          try {
            var poRes = await window.supabase
              .from('payouts')
              .select('id, receipt_url')
              .in('id', paidPayoutIds);
            if (!poRes.error && poRes.data) {
              poRes.data.forEach(function (p) {
                if (p.receipt_url) receiptMap[p.id] = p.receipt_url;
              });
            }
          } catch (e) {
            console.warn('[FFP Earnings] receipt fetch:', e);
          }
        }

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
                  : r.status,
            // Carry these through for the receipt button injection
            _ffpRawCategory: r.category,
            _ffpRawStatus: r.status,
            _ffpNotes: r.notes || '',
            _ffpReceiptUrl: r.related_id ? (receiptMap[r.related_id] || '') : ''
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

      // 5. Fetch dedicated payouts list for the Payouts section
      var poRes = await window.supabase
        .from('payouts')
        .select('id, amount_aed, method, status, bank_details, notes, receipt_url, requested_at, processed_at')
        .eq('member_id', currentUserId)
        .order('requested_at', { ascending: false })
        .limit(30);
      if (poRes.error) {
        console.error('[FFP Earnings] payouts read:', poRes.error);
        memberPayouts = [];
      } else {
        memberPayouts = poRes.data || [];
      }
      renderPayoutsSection();

      // 6. Wrap submitPayout
      wrapWrites();

      // 7. Re-render if Earnings panel is visible
      var panel = document.getElementById('panel-earnings');
      if (panel && panel.classList.contains('active') && typeof Earnings.render === 'function') {
        Earnings.render();
      }

      // 8. Subscribe to real-time updates so the panel auto-updates
      subscribeRealtime();

      console.log('[FFP Earnings v6] Loaded from Supabase \u2713');
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

    var inputStyle = 'width:100%;background:rgba(0,0,0,0.25);border:1px solid rgba(43,168,224,0.25);border-radius:8px;padding:10px 12px;font-size:13px;font-weight:600;color:#fff;font-family:Montserrat,sans-serif;outline:none;box-sizing:border-box;';
    var labelStyle = 'font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted-lt,#8a99a8);margin-bottom:4px;display:block;';
    var hintStyle = 'font-size:10px;color:var(--muted,#6a90a8);margin-top:4px;line-height:1.4;display:block;';

    var bankBlock = document.createElement('div');
    bankBlock.id = 'ffp-bank-details-block';
    bankBlock.style.cssText = 'margin-top:14px;padding:14px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.18);border-radius:10px;';
    bankBlock.innerHTML =
      '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted-lt,#8a99a8);margin-bottom:12px;">Bank account details (required for bank transfer)</div>' +

      '<div style="margin-bottom:10px;">' +
        '<label style="' + labelStyle + '">Exact account holder name</label>' +
        '<input id="ffp-payout-bank-name" type="text" placeholder="As shown on bank account." style="' + inputStyle + '">' +
        '<span style="' + hintStyle + '">Must match the name on the bank account exactly. Transfers to a different name will be rejected.</span>' +
      '</div>' +

      '<div style="margin-bottom:10px;">' +
        '<label style="' + labelStyle + '">IBAN</label>' +
        '<input id="ffp-payout-iban" type="text" placeholder="AE07 0331 2345 6789 0123 456" maxlength="29" autocomplete="off" autocapitalize="characters" style="' + inputStyle + 'letter-spacing:1px;font-family:monospace;">' +
        '<span id="ffp-iban-hint" style="' + hintStyle + '">UAE IBAN: starts with AE followed by 21 digits (23 characters total).</span>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
        '<div>' +
          '<label style="' + labelStyle + '">Bank name</label>' +
          '<input id="ffp-payout-bank" type="text" placeholder="e.g. Emirates NBD" style="' + inputStyle + '">' +
        '</div>' +
        '<div>' +
          '<label style="' + labelStyle + '">Branch city</label>' +
          '<input id="ffp-payout-city" type="text" placeholder="e.g. Dubai" style="' + inputStyle + '">' +
        '</div>' +
      '</div>' +

      '<div style="font-size:10px;color:var(--muted,#6a90a8);margin-top:10px;line-height:1.5;">Stored only for this payout. We never store card details.</div>';
    methodBlock.parentNode.insertBefore(bankBlock, methodBlock.nextSibling);

    var otherBlock = document.createElement('div');
    otherBlock.id = 'ffp-other-details-block';
    otherBlock.style.cssText = 'display:none;margin-top:14px;padding:14px;background:rgba(255,204,0,0.06);border:1px solid rgba(255,204,0,0.18);border-radius:10px;';
    otherBlock.innerHTML =
      '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted-lt,#8a99a8);margin-bottom:10px;">How should we reach you?</div>' +
      '<textarea id="ffp-payout-other" rows="3" placeholder="Tell us how you\'d like to receive your payout (e.g. crypto wallet, in-person cash pickup, etc.)" style="width:100%;background:rgba(0,0,0,0.25);border:1px solid rgba(255,204,0,0.25);border-radius:8px;padding:10px 12px;font-size:13px;font-weight:600;color:#fff;font-family:Montserrat,sans-serif;outline:none;resize:vertical;box-sizing:border-box;"></textarea>';
    methodBlock.parentNode.insertBefore(otherBlock, bankBlock.nextSibling);

    // Live IBAN formatting: auto-uppercase, group every 4 chars with spaces, validate live
    var ibanInput = document.getElementById('ffp-payout-iban');
    var ibanHint = document.getElementById('ffp-iban-hint');
    if (ibanInput && ibanHint) {
      ibanInput.addEventListener('input', function () {
        var raw = (ibanInput.value || '').replace(/\s+/g, '').toUpperCase();
        // Cap at 23 chars
        if (raw.length > 23) raw = raw.slice(0, 23);
        // Format in groups of 4
        var formatted = raw.match(/.{1,4}/g);
        formatted = formatted ? formatted.join(' ') : '';
        if (ibanInput.value !== formatted) {
          var pos = ibanInput.selectionStart;
          ibanInput.value = formatted;
          // Restore cursor near end-ish
          try { ibanInput.setSelectionRange(formatted.length, formatted.length); } catch (e) {}
        }
        // Live validation feedback
        if (raw.length === 0) {
          ibanHint.style.color = 'var(--muted,#6a90a8)';
          ibanHint.textContent = 'UAE IBAN: starts with AE followed by 21 digits (23 characters total).';
        } else if (/^AE\d{21}$/.test(raw)) {
          ibanHint.style.color = '#4ade80';
          ibanHint.textContent = 'Valid UAE IBAN format \u2713';
        } else if (raw.length < 23) {
          ibanHint.style.color = '#FFCC00';
          ibanHint.textContent = raw.length + '/23 characters \u2014 keep going';
        } else {
          ibanHint.style.color = '#ef4444';
          ibanHint.textContent = 'Invalid: must be AE + 21 digits';
        }
      });
    }

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
      var city = (document.getElementById('ffp-payout-city') || {}).value || '';
      name = name.trim();
      iban = iban.trim().replace(/\s+/g, '').toUpperCase();
      bank = bank.trim();
      city = city.trim();
      if (!name || !iban || !bank || !city) {
        showToast('Please fill in all bank fields (name, IBAN, bank, city)', 'error');
        return null;
      }
      if (!/^AE\d{21}$/.test(iban)) {
        showToast('IBAN must be AE followed by 21 digits (23 characters total)', 'error');
        return null;
      }
      return {
        method: 'bank',
        bank_details:
          'Account holder: ' + name + '\n' +
          'IBAN: ' + iban + '\n' +
          'Bank: ' + bank + '\n' +
          'Branch city: ' + city
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

  // After Earnings.render(), inject "View receipt" buttons on paid payout rows
  function wrapRender() {
    if (typeof Earnings === 'undefined' || typeof Earnings.render !== 'function') {
      setTimeout(wrapRender, 200);
      return;
    }
    var orig = Earnings.render.bind(Earnings);
    Earnings.render = function () {
      orig();
      // Wait one tick for DOM to settle, then inject buttons
      setTimeout(injectReceiptButtons, 30);
    };
  }

  function injectReceiptButtons() {
    var list = document.getElementById('earn-tx-list');
    if (!list || !Earnings || !Earnings.transactions) return;
    var rows = list.querySelectorAll('.earn-tx-row');
    Earnings.transactions.forEach(function (t, i) {
      var row = rows[i];
      if (!row) return;
      if (row.querySelector('.ffp-view-receipt-btn')) return;  // already injected
      // Only inject for paid payouts that have a receipt URL OR receipt notes
      if (t._ffpRawCategory !== 'payout' || t._ffpRawStatus !== 'paid') return;
      if (!t._ffpReceiptUrl && !t._ffpNotes) return;

      var metaEl = row.querySelector('.earn-tx-meta');
      if (!metaEl) return;
      var btn = document.createElement('button');
      btn.className = 'ffp-view-receipt-btn';
      btn.style.cssText = 'margin-left:8px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.35);color:#4ade80;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;display:inline-flex;align-items:center;gap:4px;';
      btn.innerHTML = '<span class="material-icons" style="font-size:12px;">receipt_long</span>View receipt';
      btn.onclick = function (e) {
        e.stopPropagation();
        openReceiptModal(t);
      };
      metaEl.appendChild(btn);
    });
  }

  function openReceiptModal(t) {
    // Close any existing
    var existing = document.getElementById('ffp-receipt-modal');
    if (existing) existing.remove();

    var fileBlock = '';
    if (t._ffpReceiptUrl) {
      var url = t._ffpReceiptUrl;
      var isPdf = /\.pdf$/i.test(url);
      if (isPdf) {
        fileBlock =
          '<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(74,222,128,0.25);">' +
            '<a href="' + escAttr(url) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.35);color:#4ade80;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;font-family:Montserrat,sans-serif;">' +
              '<span class="material-icons" style="font-size:18px;">picture_as_pdf</span>Open PDF receipt' +
            '</a>' +
          '</div>';
      } else {
        fileBlock =
          '<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(74,222,128,0.25);">' +
            '<div style="color:#4ade80;font-size:11px;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:1.2px;">Bank transfer confirmation</div>' +
            '<a href="' + escAttr(url) + '" target="_blank" rel="noopener">' +
              '<img src="' + escAttr(url) + '" alt="Transfer receipt" style="max-width:100%;border-radius:8px;border:1px solid rgba(74,222,128,0.25);display:block;cursor:zoom-in;">' +
            '</a>' +
            '<div style="margin-top:6px;font-size:10px;color:#6a90a8;">Tap to open full size</div>' +
          '</div>';
      }
    }

    // Strip the URL line from notes for display (it's shown as the image/PDF instead)
    var displayNotes = (t._ffpNotes || '').replace(/\nReceipt:\s*https?:\/\/\S+/, '');

    var overlay = document.createElement('div');
    overlay.id = 'ffp-receipt-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,8,20,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Montserrat,sans-serif;';
    overlay.innerHTML =
      '<div style="background:#0f1e2e;border:1px solid #1a2f44;border-radius:16px;width:100%;max-width:520px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.6);overflow:hidden;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #1a2f44;">' +
          '<div style="color:#e8eef4;font-size:16px;font-weight:700;">Payment receipt</div>' +
          '<button onclick="document.getElementById(\'ffp-receipt-modal\').remove()" style="background:transparent;border:none;color:#8a99a8;cursor:pointer;font-size:24px;line-height:1;padding:0 4px;">&times;</button>' +
        '</div>' +
        '<div style="padding:20px;overflow-y:auto;flex:1;">' +
          (displayNotes
            ? '<div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.28);border-radius:10px;padding:14px;">' +
                '<div style="color:#e8eef4;font-size:13px;line-height:1.7;white-space:pre-wrap;font-family:monospace;">' + escHtml(displayNotes) + '</div>' +
              '</div>'
            : '<div style="color:#8a99a8;font-size:13px;">No payment details recorded.</div>'
          ) +
          fileBlock +
        '</div>' +
        '<div style="padding:14px 20px;border-top:1px solid #1a2f44;text-align:right;">' +
          '<button onclick="document.getElementById(\'ffp-receipt-modal\').remove()" style="background:rgba(43,168,224,0.12);border:1px solid rgba(43,168,224,0.35);color:#7dd3fc;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;">Close</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }


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
    wrapRender();

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

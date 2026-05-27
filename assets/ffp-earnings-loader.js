/* FFP Earnings Loader — v9
   v9 fixes from v8:
   - Payouts + Earnings log sections now inject IMMEDIATELY AFTER the Refer-a-friend
     CTA (correct anchor). Previously they got placed inside Recent activity and were
     unreachable.
   - "How tiers work" dropdown now MOVES the original DOM (not clones), preserving
     IDs and existing render bindings. Pre-triggers Earnings.toggleTierCards() so the
     content is rendered and visible when the dropdown opens.
   - Both lists default to showing latest 5 entries with a "Show all (N)" toggle.
     Cleaner first impression; full history one tap away.

   v8 changes (kept):
   - Time filters + summary stats on Payouts and Earnings log
   - Tiers & Ways to earn as collapsed dropdowns in two-column row

   v7 changes (kept):
   - Uses shared FFPRealtime helper (requires assets/ffp-realtime.js loaded first)

   v6 changes (kept):
   - Real-time updates + dedicated payouts section

   v5/v4 changes (kept):
   - View receipt modal, IBAN format validation, branch city
*/
(function () {
  'use strict';
  var retries = 0;
  var MAX_RETRIES = 30;
  var currentUserId = null;
  var wrapped = false;
  var memberPayouts = [];
  var allTransactions = [];
  var payoutFilter = 'all';
  var earningsFilter = 'all';
  var payoutShowAll = false;       // v9
  var earningsShowAll = false;     // v9
  var DEFAULT_VISIBLE_ROWS = 5;    // v9
  var layoutBuilt = false;

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
      // v9: anchor to Refer-a-friend CTA (insert right after it)
      var anchor = panel.querySelector('.earn-refer-cta');
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(section, anchor.nextSibling);
      } else {
        // Fallback: try tier badge card, then panel head, then just append
        var fallback = panel.querySelector('.tier-badge-card') || panel.querySelector('.earn-hero');
        if (fallback && fallback.parentNode) {
          fallback.parentNode.insertBefore(section, fallback.nextSibling);
        } else {
          panel.appendChild(section);
        }
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

  // ─── v8 LAYOUT BUILDER ───
  // Restructures the existing earnings panel into the new clear hierarchy.
  // Idempotent — safe to call repeatedly; rebuilds the filter-driven sections
  // on every call but only moves DOM elements once.
  function rebuildLayout() {
    var panel = document.getElementById('panel-earnings');
    if (!panel) return;

    // Inject v8 styles once
    injectV8Styles();

    if (!layoutBuilt) {
      moveTiersAndWaysToBottomRow(panel);
      layoutBuilt = true;
    }

    renderEarningsLog();
    refreshPayoutsSectionWithFilter();
  }

  function injectV8Styles() {
    if (document.getElementById('ffp-earnings-v8-styles')) return;
    var s = document.createElement('style');
    s.id = 'ffp-earnings-v8-styles';
    s.textContent =
      // Two-column row for dropdowns
      '#ffp-bottom-dropdowns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px;}' +
      '@media(max-width:560px){#ffp-bottom-dropdowns{grid-template-columns:1fr;}}' +
      '.ffp-dd{background:rgba(43,168,224,0.04);border:1px solid var(--border-mid,rgba(43,168,224,0.30));border-radius:12px;overflow:hidden;}' +
      '.ffp-dd-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer;user-select:none;}' +
      '.ffp-dd-head:hover{background:rgba(43,168,224,0.06);}' +
      '.ffp-dd-title{font-size:13px;font-weight:700;color:var(--text,#e8eef4);}' +
      '.ffp-dd-chevron{transition:transform 0.2s ease;color:var(--muted,#8a99a8);}' +
      '.ffp-dd.open .ffp-dd-chevron{transform:rotate(180deg);}' +
      '.ffp-dd-body{display:none;padding:0 16px 16px;}' +
      '.ffp-dd.open .ffp-dd-body{display:block;}' +
      // Filter chips
      '.ffp-filter-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;}' +
      '.ffp-chip{background:rgba(43,168,224,0.06);border:1px solid var(--border-mid,rgba(43,168,224,0.25));color:var(--muted,#8a99a8);padding:5px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;letter-spacing:0.3px;}' +
      '.ffp-chip:hover{color:var(--text,#e8eef4);}' +
      '.ffp-chip.active{background:rgba(43,168,224,0.16);border-color:#2ba8e0;color:#7dd3fc;}' +
      // Summary stats row
      '.ffp-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;padding:12px 14px;background:rgba(0,0,0,0.18);border-radius:10px;}' +
      '.ffp-summary.two{grid-template-columns:repeat(2,1fr);}' +
      '.ffp-summary-cell{text-align:center;}' +
      '.ffp-summary-label{font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted,#8a99a8);margin-bottom:3px;}' +
      '.ffp-summary-val{font-size:15px;font-weight:800;color:var(--text,#e8eef4);}' +
      '.ffp-summary-val.green{color:#4ade80;}' +
      '.ffp-summary-val.yellow{color:#FFCC00;}' +
      '.ffp-summary-val.red{color:#fca5a5;}' +
      // Earnings log row
      '#ffp-earnings-log .ffp-earn-row{display:grid;grid-template-columns:36px 1fr auto;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(43,168,224,0.10);align-items:center;}' +
      '#ffp-earnings-log .ffp-earn-row:last-child{border-bottom:none;}' +
      '#ffp-earnings-log .ffp-earn-icon{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(74,222,128,0.12);color:#4ade80;}' +
      '#ffp-earnings-log .ffp-earn-icon.out{background:rgba(239,68,68,0.12);color:#fca5a5;}' +
      '#ffp-earnings-log .ffp-earn-name{font-size:13px;font-weight:700;color:var(--text,#e8eef4);}' +
      '#ffp-earnings-log .ffp-earn-meta{font-size:11px;color:var(--muted,#8a99a8);margin-top:2px;}' +
      '#ffp-earnings-log .ffp-earn-amt{font-size:14px;font-weight:800;color:#4ade80;white-space:nowrap;}' +
      '#ffp-earnings-log .ffp-earn-amt.out{color:#fca5a5;}' +
      '#ffp-earnings-log .ffp-earn-empty{padding:24px 16px;text-align:center;color:var(--muted,#8a99a8);font-size:12px;}' +
      // v9: Show all / show less toggle
      '.ffp-show-toggle{padding:12px 14px;border-top:1px solid rgba(43,168,224,0.10);text-align:center;background:rgba(43,168,224,0.02);}' +
      '.ffp-show-toggle-btn{background:transparent;border:1px solid var(--border-mid,rgba(43,168,224,0.25));color:#7dd3fc;padding:6px 14px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;letter-spacing:0.3px;}' +
      '.ffp-show-toggle-btn:hover{background:rgba(43,168,224,0.08);}';
    document.head.appendChild(s);
  }

  // Move "How tiers work" and "Ways to earn" sections into a two-column dropdown row at the bottom.
  function moveTiersAndWaysToBottomRow(panel) {
    var sections = panel.querySelectorAll('.ct-section');
    var tiersSection = null, waysSection = null;
    sections.forEach(function (sec) {
      var title = (sec.querySelector('.ct-section-title') || {}).textContent || '';
      if (/how tiers work/i.test(title)) tiersSection = sec;
      else if (/ways to earn/i.test(title)) waysSection = sec;
    });

    // Hide "Recent activity" — we render our own Earnings log instead
    sections.forEach(function (sec) {
      var title = (sec.querySelector('.ct-section-title') || {}).textContent || '';
      if (/recent activity/i.test(title)) sec.style.display = 'none';
    });

    // v9: pre-trigger tier cards render so content is available when dropdown opens
    if (typeof Earnings !== 'undefined' && typeof Earnings.toggleTierCards === 'function') {
      var tierCardsEl = document.getElementById('tier-cards');
      if (tierCardsEl && !tierCardsEl.innerHTML.trim()) {
        try {
          Earnings.toggleTierCards();  // renders + toggles open
          // Force display regardless of toggle state — our dropdown controls visibility now
          tierCardsEl.style.display = 'block';
        } catch (e) {
          console.warn('[FFP Earnings] tier cards pre-render:', e);
        }
      } else if (tierCardsEl) {
        tierCardsEl.style.display = 'block';
      }
    }

    // Build the two-column dropdown row
    var bottomRow = document.createElement('div');
    bottomRow.id = 'ffp-bottom-dropdowns';

    if (tiersSection) bottomRow.appendChild(wrapAsDropdown('How tiers work', tiersSection));
    if (waysSection) bottomRow.appendChild(wrapAsDropdown('Ways to earn', waysSection));

    // Append bottom row to end of panel
    panel.appendChild(bottomRow);
  }

  function wrapAsDropdown(title, originalSection) {
    var dd = document.createElement('div');
    dd.className = 'ffp-dd';
    var head = document.createElement('div');
    head.className = 'ffp-dd-head';
    head.innerHTML =
      '<div class="ffp-dd-title">' + escHtml(title) + '</div>' +
      '<span class="material-icons ffp-dd-chevron">expand_more</span>';
    head.onclick = function () { dd.classList.toggle('open'); };
    var body = document.createElement('div');
    body.className = 'ffp-dd-body';

    // v9: MOVE original section's contents into body (preserves IDs + bindings).
    // Hide the section header (we already have title in dd head).
    var sectionHead = originalSection.querySelector('.ct-section-head');
    if (sectionHead) sectionHead.style.display = 'none';
    while (originalSection.firstChild) {
      body.appendChild(originalSection.firstChild);
    }
    // Hide the now-empty original wrapper
    originalSection.style.display = 'none';

    dd.appendChild(head);
    dd.appendChild(body);
    return dd;
  }

  // ─── Time filters ───
  function withinFilter(dateIso, filter) {
    if (!dateIso || filter === 'all') return true;
    var d = new Date(dateIso);
    if (isNaN(d.getTime())) return false;
    var now = new Date();
    if (filter === 'thismonth') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (filter === 'lastmonth') {
      var lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
    }
    if (filter === '6mo') {
      var c = new Date(now); c.setMonth(c.getMonth() - 6);
      return d >= c;
    }
    if (filter === 'year') {
      var y = new Date(now); y.setFullYear(y.getFullYear() - 1);
      return d >= y;
    }
    return true;
  }

  function buildFilterChips(currentFilter, onChange) {
    var opts = [
      { k: 'thismonth', l: 'This month' },
      { k: 'lastmonth', l: 'Last month' },
      { k: '6mo',       l: '6 months' },
      { k: 'year',      l: '1 year' },
      { k: 'all',       l: 'All time' }
    ];
    return '<div class="ffp-filter-row">' +
      opts.map(function (o) {
        return '<button class="ffp-chip' + (o.k === currentFilter ? ' active' : '') + '" data-filter="' + o.k + '">' + escHtml(o.l) + '</button>';
      }).join('') +
    '</div>';
  }

  // ─── Refresh payouts section with current filter + summary stats ───
  function refreshPayoutsSectionWithFilter() {
    var section = document.getElementById('ffp-payouts-section');
    if (!section) return;

    var filtered = memberPayouts.filter(function (p) {
      return withinFilter(p.requested_at, payoutFilter);
    });

    // Summary stats
    var totalPaid = 0, totalPending = 0, totalRejected = 0;
    filtered.forEach(function (p) {
      var amt = Number(p.amount_aed) || 0;
      if (p.status === 'paid') totalPaid += amt;
      else if (p.status === 'pending' || p.status === 'approved') totalPending += amt;
      else if (p.status === 'rejected') totalRejected += amt;
    });

    var titleRow =
      '<div class="ffp-po-title-row">' +
        '<div>' +
          '<div class="ffp-po-title">Your Payouts</div>' +
          '<div class="ffp-po-subtitle">Track every withdrawal request and its status</div>' +
        '</div>' +
      '</div>';

    var filterChips = buildFilterChips(payoutFilter);

    var summary =
      '<div class="ffp-summary">' +
        '<div class="ffp-summary-cell"><div class="ffp-summary-label">Paid</div><div class="ffp-summary-val green">AED ' + Math.round(totalPaid).toLocaleString() + '</div></div>' +
        '<div class="ffp-summary-cell"><div class="ffp-summary-label">In progress</div><div class="ffp-summary-val yellow">AED ' + Math.round(totalPending).toLocaleString() + '</div></div>' +
        '<div class="ffp-summary-cell"><div class="ffp-summary-label">Rejected</div><div class="ffp-summary-val red">AED ' + Math.round(totalRejected).toLocaleString() + '</div></div>' +
      '</div>';

    var rowsHtml;
    if (!filtered.length) {
      rowsHtml = '<div class="ffp-po-list"><div class="ffp-po-empty">No payouts in this period.</div></div>';
    } else {
      // v9: show only first DEFAULT_VISIBLE_ROWS unless "show all" is toggled
      var visible = payoutShowAll ? filtered : filtered.slice(0, DEFAULT_VISIBLE_ROWS);
      var hiddenCount = filtered.length - visible.length;

      var rows = visible.map(function (p) {
        var amt = Math.round(Number(p.amount_aed) || 0);
        var status = p.status || 'pending';
        var statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        if (status === 'pending') statusLabel = 'Under review';

        var dates = '<b>Requested:</b> ' + escHtml(fmtNiceDate(p.requested_at));
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
      rowsHtml = '<div class="ffp-po-list">' + rows + '</div>';
      // v9: Show all / Show less toggle
      if (filtered.length > DEFAULT_VISIBLE_ROWS) {
        rowsHtml += '<div class="ffp-show-toggle">' +
          '<button class="ffp-show-toggle-btn" data-target="payouts">' +
            (payoutShowAll ? 'Show less' : 'Show all (' + filtered.length + ')') +
          '</button>' +
        '</div>';
      }
    }

    section.innerHTML = titleRow + filterChips + summary + rowsHtml;

    // Wire filter chips
    section.querySelectorAll('.ffp-chip').forEach(function (btn) {
      btn.onclick = function () {
        payoutFilter = btn.getAttribute('data-filter');
        payoutShowAll = false;  // reset show-all when filter changes
        refreshPayoutsSectionWithFilter();
      };
    });
    // Wire show-all toggle
    var toggleBtn = section.querySelector('.ffp-show-toggle-btn');
    if (toggleBtn) {
      toggleBtn.onclick = function () {
        payoutShowAll = !payoutShowAll;
        refreshPayoutsSectionWithFilter();
      };
    }
  }

  // ─── Earnings log section (replaces Recent activity) ───
  function renderEarningsLog() {
    var panel = document.getElementById('panel-earnings');
    if (!panel) return;

    var section = document.getElementById('ffp-earnings-log');
    if (!section) {
      section = document.createElement('div');
      section.id = 'ffp-earnings-log';
      section.style.marginTop = '18px';
      // Insert AFTER the payouts section
      var payouts = document.getElementById('ffp-payouts-section');
      if (payouts && payouts.parentNode) {
        payouts.parentNode.insertBefore(section, payouts.nextSibling);
      } else {
        panel.appendChild(section);
      }
    }

    // Filter transactions by date AND exclude payout category (those are in Your Payouts)
    var filtered = (allTransactions || []).filter(function (r) {
      if (r.category === 'payout') return false;
      return withinFilter(r.created_at, earningsFilter);
    });

    // Summary stats
    var totalEarned = 0, totalPending = 0;
    filtered.forEach(function (r) {
      var amt = Number(r.amount_aed) || 0;
      if (r.type === 'in') {
        if (r.status === 'paid') totalEarned += amt;
        else if (r.status === 'pending') totalPending += amt;
      }
    });

    var titleRow =
      '<div class="ffp-po-title-row">' +
        '<div>' +
          '<div class="ffp-po-title">Earnings log</div>' +
          '<div class="ffp-po-subtitle">Every referral and reward you\'ve earned</div>' +
        '</div>' +
      '</div>';

    var filterChips = buildFilterChips(earningsFilter);

    var summary =
      '<div class="ffp-summary two">' +
        '<div class="ffp-summary-cell"><div class="ffp-summary-label">Earned</div><div class="ffp-summary-val green">AED ' + Math.round(totalEarned).toLocaleString() + '</div></div>' +
        '<div class="ffp-summary-cell"><div class="ffp-summary-label">Pending</div><div class="ffp-summary-val yellow">AED ' + Math.round(totalPending).toLocaleString() + '</div></div>' +
      '</div>';

    var listHtml;
    if (!filtered.length) {
      listHtml = '<div class="ffp-po-list"><div class="ffp-earn-empty">No earnings in this period.</div></div>';
    } else {
      // v9: show only first DEFAULT_VISIBLE_ROWS unless "show all" is toggled
      var visible = earningsShowAll ? filtered : filtered.slice(0, DEFAULT_VISIBLE_ROWS);
      var rows = visible.map(function (r) {
        var isIn = r.type === 'in';
        var amt = Math.round(Number(r.amount_aed) || 0);
        var icon = isIn ? 'add' : 'remove';
        var sign = isIn ? '+' : '\u2212';
        var statusText = r.status === 'pending' ? 'pending review' : r.status === 'rejected' ? 'rejected' : '';
        var src = r.source || categoryLabel(r.category);
        var meta = categoryLabel(r.category) + ' \u00b7 ' + daysAgoLabel(r.created_at) + (statusText ? ' \u00b7 ' + statusText : '');
        return '<div class="ffp-earn-row">' +
          '<div class="ffp-earn-icon' + (isIn ? '' : ' out') + '"><span class="material-icons" style="font-size:18px;">' + icon + '</span></div>' +
          '<div>' +
            '<div class="ffp-earn-name">' + escHtml(src) + '</div>' +
            '<div class="ffp-earn-meta">' + escHtml(meta) + '</div>' +
          '</div>' +
          '<div class="ffp-earn-amt' + (isIn ? '' : ' out') + '">' + sign + amt + '</div>' +
        '</div>';
      }).join('');
      listHtml = '<div class="ffp-po-list">' + rows + '</div>';
      // v9: Show all toggle
      if (filtered.length > DEFAULT_VISIBLE_ROWS) {
        listHtml += '<div class="ffp-show-toggle">' +
          '<button class="ffp-show-toggle-btn" data-target="earnings">' +
            (earningsShowAll ? 'Show less' : 'Show all (' + filtered.length + ')') +
          '</button>' +
        '</div>';
      }
    }

    section.innerHTML = titleRow + filterChips + summary + listHtml;

    section.querySelectorAll('.ffp-chip').forEach(function (btn) {
      btn.onclick = function () {
        earningsFilter = btn.getAttribute('data-filter');
        earningsShowAll = false;
        renderEarningsLog();
      };
    });
    var toggleBtn = section.querySelector('.ffp-show-toggle-btn');
    if (toggleBtn) {
      toggleBtn.onclick = function () {
        earningsShowAll = !earningsShowAll;
        renderEarningsLog();
      };
    }
  }

  function daysAgoLabel(iso) {
    if (!iso) return '\u2014';
    var d = new Date(iso); d.setHours(0,0,0,0);
    var t = new Date();   t.setHours(0,0,0,0);
    var n = Math.max(0, Math.round((t - d) / 86400000));
    if (n === 0) return 'Today';
    if (n === 1) return 'Yesterday';
    if (n < 30) return n + ' days ago';
    return fmtNiceDate(iso);
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

  // ─── Real-time subscription via shared FFPRealtime helper ───
  function subscribeRealtime() {
    if (!currentUserId) return;
    if (!window.FFPRealtime) {
      console.warn('[FFP Earnings] FFPRealtime helper not loaded — auto-updates disabled. Add assets/ffp-realtime.js before this script.');
      return;
    }
    var ch = 'ffp-member-earnings-' + currentUserId;
    window.FFPRealtime.subscribe(ch + '-payouts', 'payouts', 'member_id=eq.' + currentUserId, function () {
      loadFromSupabase();
    });
    window.FFPRealtime.subscribe(ch + '-transactions', 'transactions', 'member_id=eq.' + currentUserId, function () {
      loadFromSupabase();
    });
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
        allTransactions = txRows;  // v8: keep full list for time filtering
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
      rebuildLayout();  // v8: full panel layout restructure

      // 6. Wrap submitPayout
      wrapWrites();

      // 7. Re-render if Earnings panel is visible
      var panel = document.getElementById('panel-earnings');
      if (panel && panel.classList.contains('active') && typeof Earnings.render === 'function') {
        Earnings.render();
      }

      // 8. Subscribe to real-time updates so the panel auto-updates
      subscribeRealtime();

      console.log('[FFP Earnings v9] Loaded from Supabase \u2713');
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

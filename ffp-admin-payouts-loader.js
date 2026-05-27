/* FFP Admin Payouts Loader — v7
   v7 changes:
   - Refactored to use shared FFPRealtime helper (assets/ffp-realtime.js)
     instead of inline channel subscription. Cleaner, consistent platform-wide
     pattern. Requires ffp-realtime.js to load BEFORE this file.

   v6 changes (kept):
   - Real-time auto-updates via Supabase Realtime

   v5 changes (kept):
   - MARK PAID: file upload for transfer receipt
   - VIEW MODAL: shows receipt image inline / PDF link

   v4 changes (kept):
   - VIEW MODAL bank details parsed with big labels + per-field Copy buttons

   v3 changes (kept):
   - MARK PAID full receipt: sending bank, transfer date, time, ref

   v2 changes (kept):
   - Inline reject modal, approve "expected by" date, 0-rows detection, banners
*/
(function () {
  'use strict';

  function getAP() { return (typeof AdminPayouts !== 'undefined') ? AdminPayouts : null; }
  function toast(msg, kind) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, kind || 'info'); return; } catch (e) {} }
    console.log('[FFP Admin Payouts]', msg);
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
  function fmtDays(iso) {
    if (!iso) return '—';
    if (typeof window.fmtDays === 'function') {
      try { var d = new Date(iso); var days = Math.floor((Date.now() - d.getTime()) / 86400000); return window.fmtDays(days); } catch (e) {}
    }
    var d = new Date(iso);
    var days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days < 1) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 30) return days + ' days ago';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()];
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  }

  function injectStyles() {
    if (document.getElementById('ffp-admin-payouts-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-admin-payouts-css';
    css.textContent = [
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',
      'select{appearance:none;-webkit-appearance:none;-moz-appearance:none;' +
        'background-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238a99a8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E");' +
        'background-repeat:no-repeat;background-position:right 12px center;background-size:16px;padding-right:36px;}'
    ].join('');
    document.head.appendChild(css);
  }

  function letterFor(name) {
    return (name && name.length) ? name[0].toUpperCase() : '?';
  }

  function memberName(m) {
    if (!m) return 'Unknown member';
    return m.full_name || m.given_names || m.email || 'Member';
  }

  function mapForUi(row) {
    var m = row.members || {};
    return {
      id: row.id,
      member: memberName(m),
      memberEmail: m.email || '',
      initial: letterFor(memberName(m)),
      amount: Number(row.amount_aed) || 0,
      method: row.method || 'bank',
      bankDetails: row.bank_details || '',
      notes: row.notes || '',
      receiptUrl: row.receipt_url || '',
      status: row.status || 'pending',
      requestedAt: row.requested_at || row.created_at || null,
      processedAt: row.processed_at || null,
      _raw: row
    };
  }

  async function fetchPayouts() {
    var res = await window.supabase
      .from('payouts')
      .select('id, member_id, amount_aed, method, status, processed_by, processed_at, bank_details, notes, receipt_url, requested_at, members(full_name, given_names, email)')
      .order('requested_at', { ascending: false });
    if (res.error) {
      console.error('[FFP Admin Payouts] fetch:', res.error);
      toast('Could not load payouts', 'error');
      return [];
    }
    return (res.data || []).map(mapForUi);
  }

  async function refresh() {
    var ap = getAP();
    if (!ap) return;
    ap.data = await fetchPayouts();
    realRender();
  }

  function tabCounts(data) {
    var c = { pending: 0, approved: 0, paid: 0, rejected: 0 };
    data.forEach(function (p) { if (c[p.status] != null) c[p.status]++; });
    return c;
  }

  function realRender() {
    var ap = getAP();
    if (!ap) return;
    var tab = ap.tab || 'pending';
    var rows = (ap.data || []).filter(function (p) { return p.status === tab; });
    if (ap.search) {
      rows = rows.filter(function (p) {
        return p.member.toLowerCase().indexOf(ap.search) >= 0 ||
               (p.memberEmail || '').toLowerCase().indexOf(ap.search) >= 0;
      });
    }

    // Update tab counts
    var counts = tabCounts(ap.data || []);
    var tabsEl = document.querySelector('#panel-payouts .tabs');
    if (tabsEl) {
      tabsEl.innerHTML =
        '<button class="tab-btn' + (tab === 'pending' ? ' active' : '') + '" data-tab="pending" onclick="AdminPayouts.setTab(\'pending\')">Pending <span class="count">' + counts.pending + '</span></button>' +
        '<button class="tab-btn' + (tab === 'approved' ? ' active' : '') + '" data-tab="approved" onclick="AdminPayouts.setTab(\'approved\')">Approved <span class="count">' + counts.approved + '</span></button>' +
        '<button class="tab-btn' + (tab === 'paid' ? ' active' : '') + '" data-tab="paid" onclick="AdminPayouts.setTab(\'paid\')">Paid <span class="count">' + counts.paid + '</span></button>' +
        '<button class="tab-btn' + (tab === 'rejected' ? ' active' : '') + '" data-tab="rejected" onclick="AdminPayouts.setTab(\'rejected\')">Rejected <span class="count">' + counts.rejected + '</span></button>';
    }

    var metaEl = document.getElementById('AdminPayouts-meta');
    if (metaEl) metaEl.textContent = rows.length + ' item' + (rows.length === 1 ? '' : 's');

    var body = document.getElementById('payouts-tbody');
    if (!body) return;
    body.innerHTML = rows.length === 0
      ? '<tr><td colspan="5" class="text-muted" style="text-align:center; padding:30px;">No payouts in this tab</td></tr>'
      : rows.map(function (p) {
          var actBtns = '';
          if (p.status === 'pending') {
            actBtns += '<button class="btn btn-sm btn-blue" onclick="AdminPayouts.approve(\'' + p.id + '\')"><span class="material-icons">check</span>Approve</button>';
            actBtns += '<button class="btn btn-sm btn-danger" onclick="AdminPayouts.reject(\'' + p.id + '\')"><span class="material-icons">close</span>Reject</button>';
          } else if (p.status === 'approved') {
            actBtns += '<button class="btn btn-sm btn-primary" onclick="AdminPayouts.markPaid(\'' + p.id + '\')"><span class="material-icons">done_all</span>Mark Paid</button>';
          }
          actBtns += '<button class="btn btn-sm btn-ghost" onclick="AdminPayouts.view(\'' + p.id + '\')" title="View"><span class="material-icons">visibility</span></button>';

          return '<tr>' +
            '<td><span class="cell-avatar">' + escHtml(p.initial) + '</span><span class="cell-name">' + escHtml(p.member) + '</span></td>' +
            '<td class="f-tabular text-yellow" style="font-weight:800;"><span class="aed">' + p.amount.toLocaleString() + '</span></td>' +
            '<td class="text-muted">' + escHtml(p.method) + '</td>' +
            '<td class="text-muted nowrap">' + escHtml(fmtDays(p.requestedAt)) + '</td>' +
            '<td><div class="table-actions">' + actBtns + '</div></td>' +
          '</tr>';
        }).join('');
  }

  // Parse structured bank_details text into labeled fields, then render with
  // big readable values + per-field copy buttons. Resilient: if parsing fails
  // it falls back to a monospace block of the raw text.
  function renderBankCard(rawText) {
    var fields = parseBankDetails(rawText);
    if (!fields.length) {
      // Fallback: just show raw text in big mono
      return '<div style="background:#0a1825;border:1px solid #1a2f44;border-radius:12px;padding:18px;margin:14px 0;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
          '<div style="color:#FFCC00;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Bank details (transfer to)</div>' +
          '<button onclick="ffpCopyText(this, ' + JSON.stringify(rawText).replace(/"/g, '&quot;') + ')" style="background:rgba(255,204,0,0.12);border:1px solid rgba(255,204,0,0.35);color:#FFCC00;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;">Copy all</button>' +
        '</div>' +
        '<div style="color:#e8eef4;font-size:15px;line-height:1.7;white-space:pre-wrap;font-family:monospace;">' + escHtml(rawText) + '</div>' +
        '</div>';
    }

    var rowsHtml = fields.map(function (f) {
      var isIban = /iban/i.test(f.label);
      var valueStyle = isIban
        ? 'font-size:20px;font-weight:800;font-family:monospace;color:#FFCC00;letter-spacing:1.5px;'
        : 'font-size:17px;font-weight:700;color:#e8eef4;';
      var copyJson = JSON.stringify(f.value).replace(/"/g, '&quot;');
      return '<div style="padding:12px 0;border-bottom:1px solid #1a2f44;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;">' +
          '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;">' + escHtml(f.label) + '</div>' +
          '<button onclick="ffpCopyText(this, ' + copyJson + ')" style="background:rgba(43,168,224,0.12);border:1px solid rgba(43,168,224,0.35);color:#7dd3fc;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;">Copy</button>' +
        '</div>' +
        '<div style="' + valueStyle + 'word-break:break-all;">' + escHtml(f.value) + '</div>' +
      '</div>';
    }).join('');

    return '<div style="background:#0a1825;border:1px solid #1a2f44;border-radius:12px;padding:18px;margin:14px 0;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<div style="color:#FFCC00;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Bank details (transfer to)</div>' +
        '<button onclick="ffpCopyText(this, ' + JSON.stringify(rawText).replace(/"/g, '&quot;') + ')" style="background:rgba(255,204,0,0.12);border:1px solid rgba(255,204,0,0.35);color:#FFCC00;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;">Copy all</button>' +
      '</div>' +
      rowsHtml.replace(/border-bottom:1px solid #1a2f44;(?=[^]*$)/, '') +  // remove trailing border on last
    '</div>';
  }

  function parseBankDetails(text) {
    if (!text) return [];
    var lines = String(text).split('\n');
    var fields = [];
    lines.forEach(function (line) {
      var colonIdx = line.indexOf(':');
      if (colonIdx <= 0) return;
      var label = line.slice(0, colonIdx).trim();
      var value = line.slice(colonIdx + 1).trim();
      if (label && value) fields.push({ label: label, value: value });
    });
    return fields;
  }

  // Global copy function (button onclick handler)
  window.ffpCopyText = function (btn, text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      var orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.style.background = 'rgba(74,222,128,0.15)';
      btn.style.borderColor = 'rgba(74,222,128,0.5)';
      btn.style.color = '#4ade80';
      setTimeout(function () {
        btn.textContent = orig;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 1500);
    } catch (e) {
      console.error('[FFP Copy]', e);
    }
  };
  // ─── Mirror transaction status update ───
  // The member earnings loader inserts a mirror transactions row when a payout
  // is requested (related_id = payout.id, category='payout', type='out', status='pending').
  // Keep that mirror in sync when admin processes the payout.
  async function updateMirrorTransaction(payoutId, newTxStatus) {
    try {
      var res = await window.supabase
        .from('transactions')
        .update({ status: newTxStatus })
        .eq('related_id', payoutId)
        .eq('category', 'payout');
      if (res.error) {
        console.warn('[FFP Admin Payouts] mirror tx update:', res.error);
        // Non-fatal — admin can reconcile manually
      }
    } catch (e) {
      console.warn('[FFP Admin Payouts] mirror tx update exception:', e);
    }
  }

  async function getMyAdminUid() {
    try {
      var sess = await window.supabase.auth.getUser();
      return sess && sess.data && sess.data.user ? sess.data.user.id : null;
    } catch (e) { return null; }
  }

  // ─── Custom action modal (replaces native confirm/prompt) ───
  function openActionModal(opts) {
    // opts: { title, bodyHtml, primaryLabel, primaryClass, onConfirm, validate }
    if (typeof window.closeAdminModal === 'function') window.closeAdminModal();
    var overlay = document.createElement('div');
    overlay.id = 'ffp-admin-action-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,8,20,0.78);z-index:100001;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML =
      '<div style="background:#0f1e2e;border:1px solid #1a2f44;border-radius:16px;width:100%;max-width:480px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.6);overflow:hidden;font-family:Montserrat,sans-serif;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #1a2f44;">' +
          '<div style="color:#e8eef4;font-size:16px;font-weight:700;">' + escHtml(opts.title) + '</div>' +
          '<button id="ffp-action-close" style="background:transparent;border:none;color:#8a99a8;cursor:pointer;font-size:24px;line-height:1;padding:0 4px;">&times;</button>' +
        '</div>' +
        '<div style="padding:20px;overflow-y:auto;flex:1;color:#cfd6dc;font-size:13px;line-height:1.55;">' + opts.bodyHtml + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #1a2f44;">' +
          '<button id="ffp-action-cancel" class="btn btn-ghost">Cancel</button>' +
          '<button id="ffp-action-confirm" class="btn ' + (opts.primaryClass || 'btn-blue') + '">' + escHtml(opts.primaryLabel || 'Confirm') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    function close() {
      var ov = document.getElementById('ffp-admin-action-overlay');
      if (ov) ov.remove();
    }
    document.getElementById('ffp-action-close').onclick = close;
    document.getElementById('ffp-action-cancel').onclick = close;
    document.getElementById('ffp-action-confirm').onclick = async function () {
      if (typeof opts.validate === 'function') {
        var err = opts.validate(overlay);
        if (err) { showActionError(err); return; }
      }
      var btn = document.getElementById('ffp-action-confirm');
      btn.disabled = true; btn.textContent = 'Working\u2026';
      try {
        await opts.onConfirm(overlay);
        close();
      } catch (e) {
        btn.disabled = false; btn.textContent = opts.primaryLabel || 'Confirm';
        showActionError(e && e.message ? e.message : 'Action failed');
      }
    };
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  }

  function showActionError(msg) {
    var existing = document.getElementById('ffp-action-error');
    if (existing) existing.remove();
    var overlay = document.getElementById('ffp-admin-action-overlay');
    if (!overlay) return;
    var err = document.createElement('div');
    err.id = 'ffp-action-error';
    err.style.cssText = 'background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;padding:10px 12px;border-radius:8px;font-size:12px;margin-top:10px;';
    err.textContent = msg;
    overlay.querySelector('div[style*="overflow-y"]').appendChild(err);
  }

  function plus14Days() {
    var d = new Date();
    d.setDate(d.getDate() + 14);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function bigToast(msg, kind) {
    // Always also use the regular toast for accessibility
    toast(msg, kind);
    // ALSO show an inline banner at top of payouts panel that lingers
    var panel = document.getElementById('panel-payouts');
    if (!panel) return;
    var existing = document.getElementById('ffp-payouts-banner');
    if (existing) existing.remove();
    var banner = document.createElement('div');
    banner.id = 'ffp-payouts-banner';
    var bg = kind === 'success' ? 'rgba(74,222,128,0.12)' : kind === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(43,168,224,0.12)';
    var border = kind === 'success' ? 'rgba(74,222,128,0.35)' : kind === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(43,168,224,0.35)';
    var fg = kind === 'success' ? '#4ade80' : kind === 'error' ? '#fca5a5' : '#7dd3fc';
    banner.style.cssText = 'background:' + bg + ';border:1px solid ' + border + ';color:' + fg + ';padding:12px 16px;border-radius:10px;font-size:13px;font-weight:600;margin:0 0 16px 0;display:flex;align-items:center;gap:10px;';
    banner.innerHTML = '<span class="material-icons" style="font-size:18px;">' + (kind === 'success' ? 'check_circle' : kind === 'error' ? 'error' : 'info') + '</span><span>' + escHtml(msg) + '</span>';
    var section = panel.querySelector('.section');
    if (section) section.insertBefore(banner, section.firstChild);
    setTimeout(function () {
      if (banner && banner.parentNode) banner.remove();
    }, 6000);
  }

  function switchTab(tab) {
    var ap = getAP();
    if (!ap) return;
    ap.tab = tab;
    realRender();
  }

  // ─── Actions ───
  function approve(id) {
    var ap = getAP();
    var p = ap.data.find(function (x) { return x.id === id; });
    if (!p) return;

    var bodyHtml =
      '<div style="margin-bottom:14px;">You\'re approving a payout for <b style="color:#e8eef4;">' + escHtml(p.member) + '</b>.</div>' +
      '<div style="background:#0a1825;border:1px solid #1a2f44;border-radius:10px;padding:14px;margin-bottom:14px;">' +
        '<div style="color:#8a99a8;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Amount</div>' +
        '<div style="color:#FFCC00;font-size:24px;font-weight:800;">AED ' + p.amount.toLocaleString() + '</div>' +
      '</div>' +
      '<div style="background:rgba(43,168,224,0.08);border:1px solid rgba(43,168,224,0.25);border-radius:10px;padding:14px;margin-bottom:14px;">' +
        '<div style="color:#7dd3fc;font-size:12px;font-weight:700;margin-bottom:4px;">Expected payout by ' + plus14Days() + '</div>' +
        '<div style="color:#8a99a8;font-size:11px;line-height:1.5;">Payouts are processed in weekly batches. Approving here marks it as queued for the next batch.</div>' +
      '</div>' +
      '<div style="color:#8a99a8;font-size:11px;font-style:italic;">After approving, do the bank transfer when the batch runs, then come back and click <b>Mark Paid</b> on this row.</div>';

    openActionModal({
      title: 'Approve payout',
      bodyHtml: bodyHtml,
      primaryLabel: 'Approve',
      primaryClass: 'btn-blue',
      onConfirm: async function () {
        var uid = await getMyAdminUid();
        var res = await window.supabase
          .from('payouts')
          .update({ status: 'approved', processed_by: uid })
          .eq('id', id)
          .eq('status', 'pending')
          .select('id');
        if (res.error) throw res.error;
        if (!res.data || res.data.length === 0) {
          throw new Error('Could not approve — may have been processed already. Refresh and try again.');
        }
        await refresh();
        switchTab('approved');
        bigToast('Approved \u2014 expected payout by ' + plus14Days() + '. Do the bank transfer, then Mark Paid.', 'success');
      }
    });
  }

  function reject(id) {
    var ap = getAP();
    var p = ap.data.find(function (x) { return x.id === id; });
    if (!p) return;

    var bodyHtml =
      '<div style="margin-bottom:14px;">You\'re rejecting a payout for <b style="color:#e8eef4;">' + escHtml(p.member) + '</b> (AED ' + p.amount.toLocaleString() + ').</div>' +
      '<div style="margin-bottom:14px;color:#8a99a8;font-size:12px;">The AED will be returned to the member\'s balance. Please explain the reason — this is shown to the member.</div>' +
      '<textarea id="ffp-reject-reason" rows="4" placeholder="e.g. We could not verify the source of these earnings. Please contact us to discuss."' +
      ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:10px 12px;color:#e8eef4;font-size:13px;font-family:Montserrat,sans-serif;outline:none;resize:vertical;"></textarea>' +
      '<div style="font-size:10px;color:#6a90a8;margin-top:6px;">Minimum 10 characters.</div>';

    openActionModal({
      title: 'Reject payout',
      bodyHtml: bodyHtml,
      primaryLabel: 'Reject payout',
      primaryClass: 'btn-danger',
      validate: function () {
        var t = (document.getElementById('ffp-reject-reason') || {}).value || '';
        t = t.trim();
        if (t.length < 10) return 'Please write a clear reason for the member (min 10 characters).';
        return null;
      },
      onConfirm: async function () {
        var reason = (document.getElementById('ffp-reject-reason').value || '').trim();
        var uid = await getMyAdminUid();
        var res = await window.supabase
          .from('payouts')
          .update({ status: 'rejected', processed_by: uid, processed_at: new Date().toISOString(), notes: reason })
          .eq('id', id)
          .eq('status', 'pending')
          .select('id');
        if (res.error) throw res.error;
        if (!res.data || res.data.length === 0) {
          throw new Error('Could not reject — may have been processed already. Refresh and try again.');
        }
        await updateMirrorTransaction(id, 'rejected');
        await refresh();
        switchTab('rejected');
        bigToast('Rejected \u2014 AED ' + p.amount.toLocaleString() + ' returned to ' + p.member + '\'s balance.', 'success');
      }
    });
  }

  function markPaid(id) {
    var ap = getAP();
    var p = ap.data.find(function (x) { return x.id === id; });
    if (!p) return;

    var todayIso = new Date().toISOString().slice(0, 10);
    var nowTime = new Date().toTimeString().slice(0, 5);

    var bodyHtml =
      '<div style="margin-bottom:14px;">Record the bank transfer receipt for <b style="color:#e8eef4;">' + escHtml(p.member) + '</b> (<span style="color:#FFCC00;font-weight:800;">AED ' + p.amount.toLocaleString() + '</span>).</div>' +
      '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:12px;margin-bottom:16px;">' +
        '<div style="color:#fca5a5;font-size:12px;font-weight:700;margin-bottom:4px;">This cannot be undone.</div>' +
        '<div style="color:#8a99a8;font-size:11px;line-height:1.5;">Only mark Paid AFTER the transfer is complete and you have proof. The details below are saved as the member\'s receipt.</div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">' +
        '<div>' +
          '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Transfer date</div>' +
          '<input id="ffp-paid-date" type="date" value="' + todayIso + '"' +
            ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:9px 10px;color:#e8eef4;font-size:13px;font-family:Montserrat,sans-serif;outline:none;box-sizing:border-box;">' +
        '</div>' +
        '<div>' +
          '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Transfer time</div>' +
          '<input id="ffp-paid-time" type="time" value="' + nowTime + '"' +
            ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:9px 10px;color:#e8eef4;font-size:13px;font-family:Montserrat,sans-serif;outline:none;box-sizing:border-box;">' +
        '</div>' +
      '</div>' +

      '<div style="margin-bottom:10px;">' +
        '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Sending bank account name</div>' +
        '<input id="ffp-paid-sending-bank" type="text" placeholder="The FFP account the money came from (e.g. FFP Operations - Emirates NBD)"' +
          ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:9px 10px;color:#e8eef4;font-size:13px;font-family:Montserrat,sans-serif;outline:none;box-sizing:border-box;">' +
      '</div>' +

      '<div style="margin-bottom:10px;">' +
        '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Payment reference / transaction ID</div>' +
        '<input id="ffp-paid-ref" type="text" placeholder="Bank reference or transaction number"' +
          ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:9px 10px;color:#e8eef4;font-size:13px;font-family:Montserrat,sans-serif;outline:none;box-sizing:border-box;">' +
      '</div>' +

      '<div style="margin-bottom:10px;">' +
        '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Transfer receipt (photo or PDF, max 5MB)</div>' +
        '<input id="ffp-paid-receipt-file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"' +
          ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:9px 10px;color:#e8eef4;font-size:12px;font-family:Montserrat,sans-serif;outline:none;box-sizing:border-box;cursor:pointer;">' +
        '<div id="ffp-paid-receipt-status" style="font-size:10px;color:#6a90a8;margin-top:4px;">Upload a screenshot of the bank transfer confirmation. The member will see this as proof of payment.</div>' +
      '</div>' +

      '<div>' +
        '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Additional notes (optional)</div>' +
        '<textarea id="ffp-paid-extra" rows="2" placeholder="Any extra info for the member"' +
          ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:9px 10px;color:#e8eef4;font-size:13px;font-family:Montserrat,sans-serif;outline:none;resize:vertical;box-sizing:border-box;"></textarea>' +
      '</div>';

    openActionModal({
      title: 'Mark payout as Paid',
      bodyHtml: bodyHtml,
      primaryLabel: 'Save receipt & lock Paid',
      primaryClass: 'btn-primary',
      validate: function () {
        var date = (document.getElementById('ffp-paid-date') || {}).value || '';
        var sendingBank = ((document.getElementById('ffp-paid-sending-bank') || {}).value || '').trim();
        var ref = ((document.getElementById('ffp-paid-ref') || {}).value || '').trim();
        var fileEl = document.getElementById('ffp-paid-receipt-file');
        if (!date) return 'Transfer date is required';
        if (!sendingBank) return 'Sending bank account name is required';
        if (!ref) return 'Payment reference is required';
        if (fileEl && fileEl.files && fileEl.files[0]) {
          var f = fileEl.files[0];
          if (f.size > 5 * 1024 * 1024) return 'Receipt file is too large (max 5MB)';
        }
        return null;
      },
      onConfirm: async function () {
        var date = document.getElementById('ffp-paid-date').value;
        var time = (document.getElementById('ffp-paid-time') || {}).value || '';
        var sendingBank = document.getElementById('ffp-paid-sending-bank').value.trim();
        var ref = document.getElementById('ffp-paid-ref').value.trim();
        var extra = ((document.getElementById('ffp-paid-extra') || {}).value || '').trim();
        var fileEl = document.getElementById('ffp-paid-receipt-file');
        var file = fileEl && fileEl.files ? fileEl.files[0] : null;

        // Upload receipt file (if provided)
        var receiptUrl = null;
        if (file) {
          var statusEl = document.getElementById('ffp-paid-receipt-status');
          if (statusEl) { statusEl.textContent = 'Uploading\u2026'; statusEl.style.color = '#FFCC00'; }
          var ext = (file.name.split('.').pop() || 'bin').toLowerCase();
          var path = 'payouts/' + id + '/' + Date.now() + '.' + ext;
          var upRes = await window.supabase.storage
            .from('payout-receipts')
            .upload(path, file, { upsert: true, contentType: file.type });
          if (upRes.error) {
            throw new Error('Receipt upload failed: ' + upRes.error.message);
          }
          var urlRes = window.supabase.storage.from('payout-receipts').getPublicUrl(path);
          receiptUrl = urlRes && urlRes.data ? urlRes.data.publicUrl : null;
          if (statusEl) { statusEl.textContent = 'Uploaded \u2713'; statusEl.style.color = '#4ade80'; }
        }

        // Structured receipt text — readable for both admin and member
        var receipt =
          'Payment receipt\n' +
          'Amount: AED ' + p.amount.toLocaleString() + '\n' +
          'Reference: ' + ref + '\n' +
          'Transferred: ' + date + (time ? ' ' + time : '') + '\n' +
          'Sending bank: ' + sendingBank +
          (extra ? '\nNotes: ' + extra : '') +
          (receiptUrl ? '\nReceipt: ' + receiptUrl : '');

        // Real transfer timestamp
        var transferIso;
        try {
          transferIso = new Date(date + 'T' + (time || '12:00') + ':00').toISOString();
        } catch (e) {
          transferIso = new Date().toISOString();
        }

        var uid = await getMyAdminUid();
        var res = await window.supabase
          .from('payouts')
          .update({
            status: 'paid',
            processed_by: uid,
            processed_at: transferIso,
            notes: receipt,
            receipt_url: receiptUrl
          })
          .eq('id', id)
          .eq('status', 'approved')
          .select('id');
        if (res.error) throw res.error;
        if (!res.data || res.data.length === 0) {
          throw new Error('Could not mark Paid — was not in Approved status. Refresh and try again.');
        }
        // Mirror tx gets same receipt info
        await updateMirrorTransactionFull(id, 'paid', receipt);
        await refresh();
        switchTab('paid');
        bigToast('Paid \u2014 receipt saved' + (receiptUrl ? ' with file' : '') + '. Ref: ' + ref, 'success');
      }
    });
  }

  // Full mirror tx update — sets status AND notes (used by markPaid for receipt)
  async function updateMirrorTransactionFull(payoutId, newStatus, notes) {
    try {
      var res = await window.supabase
        .from('transactions')
        .update({ status: newStatus, notes: notes })
        .eq('related_id', payoutId)
        .eq('category', 'payout');
      if (res.error) {
        console.warn('[FFP Admin Payouts] mirror tx full update:', res.error);
      }
    } catch (e) {
      console.warn('[FFP Admin Payouts] mirror tx full update exception:', e);
    }
  }

  function viewPayout(id) {
    var ap = getAP();
    var p = ap.data.find(function (x) { return x.id === id; });
    if (!p) return;

    var statusPill = '<span class="pill pill-' + escHtml(p.status) + '">' + escHtml(p.status) + '</span>';
    var bankBlock = '';
    if (p.method === 'bank' && p.bankDetails) {
      bankBlock = renderBankCard(p.bankDetails);
    } else if (p.method !== 'bank') {
      bankBlock = '<div style="color:#8a99a8;font-size:12px;margin:14px 0;font-style:italic;">No bank details. Method: <b>' + escHtml(p.method) + '</b>. Contact member directly.</div>';
    } else {
      bankBlock = '<div style="color:#ef4444;font-size:12px;margin:14px 0;font-weight:600;">Bank details missing on this payout. Contact the member.</div>';
    }

    var receiptBlock = '';
    if (p.status === 'paid' && p.notes && p.notes.indexOf('Payment receipt') === 0) {
      var receiptFileBlock = '';
      if (p.receiptUrl) {
        var isPdf = /\.pdf$/i.test(p.receiptUrl);
        if (isPdf) {
          receiptFileBlock =
            '<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(74,222,128,0.25);">' +
              '<a href="' + escHtml(p.receiptUrl) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.35);color:#4ade80;padding:8px 14px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700;">' +
                '<span class="material-icons" style="font-size:18px;">picture_as_pdf</span>View PDF receipt' +
              '</a>' +
            '</div>';
        } else {
          receiptFileBlock =
            '<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(74,222,128,0.25);">' +
              '<div style="color:#4ade80;font-size:11px;font-weight:700;margin-bottom:6px;">Transfer confirmation</div>' +
              '<a href="' + escHtml(p.receiptUrl) + '" target="_blank" rel="noopener">' +
                '<img src="' + escHtml(p.receiptUrl) + '" alt="Transfer receipt" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid rgba(74,222,128,0.25);display:block;cursor:zoom-in;">' +
              '</a>' +
            '</div>';
        }
      }
      // Render structured receipt minus the URL line (which is shown as the inline image/link)
      var displayNotes = p.notes.replace(/\nReceipt:\s*https?:\/\/\S+/, '');
      receiptBlock =
        '<div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.28);border-radius:10px;padding:14px;margin:14px 0;">' +
          '<div style="color:#4ade80;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">Payment receipt</div>' +
          '<div style="color:#e8eef4;font-size:13px;line-height:1.7;white-space:pre-wrap;font-family:monospace;">' + escHtml(displayNotes) + '</div>' +
          receiptFileBlock +
        '</div>';
    }

    var content =
      '<div style="text-align:center;margin-bottom:18px;">' +
        '<div style="font-size:32px;font-weight:800;color:#FFCC00;letter-spacing:-1px;">AED ' + p.amount.toLocaleString() + '</div>' +
        '<div style="color:#8a99a8;font-size:12px;margin-top:4px;">Requested by</div>' +
        '<div style="color:#e8eef4;font-size:16px;font-weight:700;margin-top:2px;">' + escHtml(p.member) + '</div>' +
        (p.memberEmail ? '<div style="color:#8a99a8;font-size:11px;">' + escHtml(p.memberEmail) + '</div>' : '') +
      '</div>' +
      bankBlock +
      receiptBlock +
      '<div style="color:#cfd6dc;font-size:12px;margin-bottom:6px;"><b style="color:#8a99a8;">Requested:</b> ' + escHtml(fmtDateTime(p.requestedAt)) + '</div>' +
      (p.processedAt ? '<div style="color:#cfd6dc;font-size:12px;margin-bottom:6px;"><b style="color:#8a99a8;">' + (p.status === 'paid' ? 'Transferred' : 'Processed') + ':</b> ' + escHtml(fmtDateTime(p.processedAt)) + '</div>' : '') +
      (p.notes && !receiptBlock ? '<div style="color:#cfd6dc;font-size:12px;margin-bottom:6px;"><b style="color:#8a99a8;">Notes:</b> ' + escHtml(p.notes) + '</div>' : '') +
      '<div style="color:#cfd6dc;font-size:12px;margin-top:10px;"><b style="color:#8a99a8;">Status:</b> ' + statusPill + '</div>';

    var foot = '<button class="btn btn-ghost" onclick="closeAdminModal()">Close</button>';
    if (p.status === 'pending') {
      foot = '<button class="btn btn-danger" onclick="closeAdminModal(); AdminPayouts.reject(\'' + p.id + '\')"><span class="material-icons">close</span>Reject</button>' +
             '<button class="btn btn-blue" onclick="closeAdminModal(); AdminPayouts.approve(\'' + p.id + '\')"><span class="material-icons">check</span>Approve</button>';
    } else if (p.status === 'approved') {
      foot = '<button class="btn btn-ghost" onclick="closeAdminModal()">Close</button>' +
             '<button class="btn btn-primary" onclick="closeAdminModal(); AdminPayouts.markPaid(\'' + p.id + '\')"><span class="material-icons">done_all</span>Mark Paid</button>';
    }

    if (typeof window.openAdminModal === 'function') {
      window.openAdminModal('Payout request', content, foot);
    } else { _openAdminModal('Payout request', content, foot); }
  }

  // Fallback modal (if no other admin loader has loaded one yet)
  function _openAdminModal(title, content, footer) {
    if (typeof window.closeAdminModal === 'function') window.closeAdminModal();
    var overlay = document.createElement('div');
    overlay.id = 'ffp-admin-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,8,20,0.75);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML =
      '<div style="background:#0f1e2e;border:1px solid #1a2f44;border-radius:16px;width:100%;max-width:540px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #1a2f44;">' +
          '<div style="color:#e8eef4;font-size:16px;font-weight:600;">' + escHtml(title) + '</div>' +
          '<button onclick="closeAdminModal()" style="background:transparent;border:none;color:#8a99a8;cursor:pointer;font-size:24px;line-height:1;padding:0 4px;">&times;</button>' +
        '</div>' +
        '<div style="padding:20px;overflow-y:auto;flex:1;">' + content + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #1a2f44;">' + footer + '</div>' +
      '</div>';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) window.closeAdminModal(); });
    document.body.appendChild(overlay);
    window.closeAdminModal = function () {
      var ov = document.getElementById('ffp-admin-modal-overlay');
      if (ov) ov.remove();
    };
  }

  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && typeof AdminPayouts !== 'undefined';
    }, 15000);
    if (!ok) { console.error('[FFP Admin Payouts] deps never loaded'); return; }

    var authed = await waitFor(function () { return !!(window.FFP_ADMIN); }, 30000);
    if (!authed) { console.warn('[FFP Admin Payouts] FFP_ADMIN not set'); return; }

    injectStyles();
    var ap = getAP();
    ap.tab = 'pending';
    ap.init = function () { refresh(); };
    ap.setTab = function (tab) { ap.tab = tab; realRender(); };
    ap.onSearch = function (q) { ap.search = (q || '').toLowerCase().trim(); realRender(); };
    ap.render = realRender;
    ap.approve = approve;
    ap.reject = reject;
    ap.markPaid = markPaid;
    ap.view = viewPayout;
    ap.refresh = refresh;

    try {
      await refresh();
      // Real-time updates via shared helper
      if (window.FFPRealtime) {
        window.FFPRealtime.subscribe('ffp-admin-payouts', 'payouts', null, function () {
          refresh();
        });
      } else {
        console.warn('[FFP Admin Payouts] FFPRealtime helper not loaded — auto-updates disabled. Add assets/ffp-realtime.js before this script.');
      }
      console.log('[FFP Admin Payouts v7] Loaded \u2713');
    } catch (e) {
      console.error('[FFP Admin Payouts] initial load:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

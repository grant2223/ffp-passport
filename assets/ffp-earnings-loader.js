/* FFP Admin Payouts Loader — v3
   v3 changes:
   - MARK PAID modal now captures a full receipt: sending bank, transfer date,
     transfer time, payment reference. All saved to payouts.notes as structured
     text the member can read.
   - The mirror transactions row is ALSO updated with the same receipt info in
     its notes column, so it shows up in the member's earnings history.
   - View modal now displays the full receipt for paid payouts, formatted clearly.

   v2 changes (kept):
   - REPLACES native prompt() with inline modal containing textarea for rejection reason
   - APPROVE modal shows "Expected payout by [today + 14 days]" so admin can communicate timing
   - All actions: detect 0 rows affected → show "may have been processed already" error
   - After action success: auto-switch to destination tab so admin sees the row in its new home
   - Longer-lasting success toasts (no more "did anything happen?" confusion)
   - Mirror transaction sync on reject/markPaid unchanged from v1
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
      status: row.status || 'pending',
      requestedAt: row.requested_at || row.created_at || null,
      processedAt: row.processed_at || null,
      _raw: row
    };
  }

  async function fetchPayouts() {
    var res = await window.supabase
      .from('payouts')
      .select('id, member_id, amount_aed, method, status, processed_by, processed_at, bank_details, notes, requested_at, members(full_name, given_names, email)')
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
      '<div style="margin-bottom:14px;">Record the bank transfer receipt for <b style="color:#e8eef4;">' + escHtml(p.member) + '</b> (AED ' + p.amount.toLocaleString() + ').</div>' +
      '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:12px;margin-bottom:16px;">' +
        '<div style="color:#fca5a5;font-size:12px;font-weight:700;margin-bottom:4px;">This cannot be undone.</div>' +
        '<div style="color:#8a99a8;font-size:11px;line-height:1.5;">Only mark Paid AFTER the transfer is complete and you have proof. The details below are saved as the member\'s receipt.</div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">' +
        '<div>' +
          '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Transfer date</div>' +
          '<input id="ffp-paid-date" type="date" value="' + todayIso + '"' +
            ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:9px 10px;color:#e8eef4;font-size:13px;font-family:Montserrat,sans-serif;outline:none;">' +
        '</div>' +
        '<div>' +
          '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Transfer time</div>' +
          '<input id="ffp-paid-time" type="time" value="' + nowTime + '"' +
            ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:9px 10px;color:#e8eef4;font-size:13px;font-family:Montserrat,sans-serif;outline:none;">' +
        '</div>' +
      '</div>' +

      '<div style="margin-bottom:10px;">' +
        '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Sending bank (FFP operations account)</div>' +
        '<input id="ffp-paid-sending-bank" type="text" placeholder="e.g. Emirates NBD — FFP Operations"' +
          ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:9px 10px;color:#e8eef4;font-size:13px;font-family:Montserrat,sans-serif;outline:none;">' +
      '</div>' +

      '<div style="margin-bottom:10px;">' +
        '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Payment reference / transaction ID</div>' +
        '<input id="ffp-paid-ref" type="text" placeholder="Bank reference or transaction number"' +
          ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:9px 10px;color:#e8eef4;font-size:13px;font-family:Montserrat,sans-serif;outline:none;">' +
      '</div>' +

      '<div>' +
        '<div style="color:#8a99a8;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Additional notes (optional)</div>' +
        '<textarea id="ffp-paid-extra" rows="2" placeholder="Any extra info for the member"' +
          ' style="width:100%;background:rgba(0,0,0,0.3);border:1px solid #2a4055;border-radius:8px;padding:9px 10px;color:#e8eef4;font-size:13px;font-family:Montserrat,sans-serif;outline:none;resize:vertical;"></textarea>' +
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
        if (!date) return 'Transfer date is required';
        if (!sendingBank) return 'Sending bank is required';
        if (!ref) return 'Payment reference is required';
        return null;
      },
      onConfirm: async function () {
        var date = document.getElementById('ffp-paid-date').value;
        var time = (document.getElementById('ffp-paid-time') || {}).value || '';
        var sendingBank = document.getElementById('ffp-paid-sending-bank').value.trim();
        var ref = document.getElementById('ffp-paid-ref').value.trim();
        var extra = ((document.getElementById('ffp-paid-extra') || {}).value || '').trim();

        // Structured receipt text — readable for both admin and member
        var receipt =
          'Payment receipt\n' +
          'Reference: ' + ref + '\n' +
          'Transferred: ' + date + (time ? ' ' + time : '') + '\n' +
          'Sending bank: ' + sendingBank +
          (extra ? '\nNotes: ' + extra : '');

        // Real transfer timestamp (when the bank actually moved the money)
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
            notes: receipt
          })
          .eq('id', id)
          .eq('status', 'approved')
          .select('id');
        if (res.error) throw res.error;
        if (!res.data || res.data.length === 0) {
          throw new Error('Could not mark Paid — was not in Approved status. Refresh and try again.');
        }
        // Update mirror transaction with same receipt info so member sees it in their earnings history
        await updateMirrorTransactionFull(id, 'paid', receipt);
        await refresh();
        switchTab('paid');
        bigToast('Paid \u2014 receipt saved. Status locked. Ref: ' + ref, 'success');
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
    var bankBlock = p.method === 'bank' && p.bankDetails
      ? '<div style="background:#0a1825;border:1px solid #1a2f44;border-radius:10px;padding:14px;margin:14px 0;">' +
          '<div style="color:#8a99a8;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">Bank details (use these to transfer)</div>' +
          '<div style="color:#e8eef4;font-size:13px;line-height:1.6;white-space:pre-wrap;font-family:monospace;">' + escHtml(p.bankDetails) + '</div>' +
        '</div>'
      : '<div style="color:#8a99a8;font-size:12px;margin:14px 0;font-style:italic;">No bank details on file. Method: <b>' + escHtml(p.method) + '</b>. Contact member directly.</div>';

    var receiptBlock = '';
    if (p.status === 'paid' && p.notes && p.notes.indexOf('Payment receipt') === 0) {
      // Render the structured receipt
      receiptBlock =
        '<div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.28);border-radius:10px;padding:14px;margin:14px 0;">' +
          '<div style="color:#4ade80;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">Payment receipt</div>' +
          '<div style="color:#e8eef4;font-size:13px;line-height:1.7;white-space:pre-wrap;font-family:monospace;">' + escHtml(p.notes) + '</div>' +
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
      console.log('[FFP Admin Payouts v1] Loaded \u2713');
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

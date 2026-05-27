/* FFP Admin Payouts Loader — v1
   Wires the admin Payouts panel to real Supabase data.
   - Fetches payouts joined with members (full_name, given_names, email)
   - Tabs: Pending / Approved / Paid / Rejected (default: Pending)
   - Pending row actions: Approve (→ approved) / Reject (→ rejected) / View
   - Approved row actions: Mark Paid (→ paid) / View
   - Paid/Rejected row actions: View only
   - When reject or mark paid: updates mirror transactions row (related_id = payout.id)
   - View modal shows: member, amount, method, bank details (CRITICAL for actual bank transfer)
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

  // ─── Actions ───
  async function approve(id) {
    if (!confirm('Approve this payout? The member will be notified and you should arrange the bank transfer next.')) return;
    try {
      var uid = await getMyAdminUid();
      var res = await window.supabase
        .from('payouts')
        .update({ status: 'approved', processed_by: uid })
        .eq('id', id)
        .eq('status', 'pending');  // race guard
      if (res.error) throw res.error;
      toast('Payout approved — process the bank transfer, then mark Paid', 'success');
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Payouts] approve:', e);
      toast(e.message || 'Approve failed', 'error');
    }
  }

  async function reject(id) {
    var reason = prompt('Reason for rejection (will be shown to member):', '');
    if (reason === null) return;  // cancelled
    try {
      var uid = await getMyAdminUid();
      var res = await window.supabase
        .from('payouts')
        .update({ status: 'rejected', processed_by: uid, processed_at: new Date().toISOString(), notes: reason || null })
        .eq('id', id)
        .eq('status', 'pending');
      if (res.error) throw res.error;
      // Release the AED back to member's balance by marking mirror tx rejected
      await updateMirrorTransaction(id, 'rejected');
      toast('Payout rejected — AED released back to member balance', 'success');
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Payouts] reject:', e);
      toast(e.message || 'Reject failed', 'error');
    }
  }

  async function markPaid(id) {
    if (!confirm('Confirm the bank transfer is complete and you have proof of payment. Mark this payout as Paid?')) return;
    try {
      var uid = await getMyAdminUid();
      var res = await window.supabase
        .from('payouts')
        .update({ status: 'paid', processed_by: uid, processed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'approved');
      if (res.error) throw res.error;
      // Mirror tx → paid (locks it in the member's lifetime out total)
      await updateMirrorTransaction(id, 'paid');
      toast('Payout marked as Paid', 'success');
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Payouts] markPaid:', e);
      toast(e.message || 'Mark Paid failed', 'error');
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

    var content =
      '<div style="text-align:center;margin-bottom:18px;">' +
        '<div style="font-size:32px;font-weight:800;color:#FFCC00;letter-spacing:-1px;">AED ' + p.amount.toLocaleString() + '</div>' +
        '<div style="color:#8a99a8;font-size:12px;margin-top:4px;">Requested by</div>' +
        '<div style="color:#e8eef4;font-size:16px;font-weight:700;margin-top:2px;">' + escHtml(p.member) + '</div>' +
        (p.memberEmail ? '<div style="color:#8a99a8;font-size:11px;">' + escHtml(p.memberEmail) + '</div>' : '') +
      '</div>' +
      bankBlock +
      '<div style="color:#cfd6dc;font-size:12px;margin-bottom:6px;"><b style="color:#8a99a8;">Requested:</b> ' + escHtml(fmtDateTime(p.requestedAt)) + '</div>' +
      (p.processedAt ? '<div style="color:#cfd6dc;font-size:12px;margin-bottom:6px;"><b style="color:#8a99a8;">Processed:</b> ' + escHtml(fmtDateTime(p.processedAt)) + '</div>' : '') +
      (p.notes ? '<div style="color:#cfd6dc;font-size:12px;margin-bottom:6px;"><b style="color:#8a99a8;">Notes:</b> ' + escHtml(p.notes) + '</div>' : '') +
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

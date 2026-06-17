// ════════════════════════════════════════════════════════════════════════
// FFP Admin — APPOINTMENTS view — v1 (2026-06-16)
// Two tabs:
//   • Sessions remaining — every client package across all facilities, with a sessions-remaining bar.
//   • Sessions report — platform-wide totals (gross / tax / coach commission / facility net) + by-provider
//     + a detail list of every session. Money recognised per COMPLETED session.
// RPCs: admin_client_packages, admin_appointments_overview, admin_appointments_list.
// ════════════════════════════════════════════════════════════════════════
window.AdminAppts = (function () {
  var _packages = [], _tab = 'remaining', _q = '', _loaded = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n, ccy) {
    var v = Number(n || 0);
    return (ccy || 'AED') + ' ' + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function rangeBounds(key) {
    var now = new Date(), from = null, to = null;
    var som = function (y, m) { return new Date(y, m, 1); };
    if (key === 'this_month') { from = som(now.getFullYear(), now.getMonth()); to = som(now.getFullYear(), now.getMonth() + 1); }
    else if (key === 'last_month') { from = som(now.getFullYear(), now.getMonth() - 1); to = som(now.getFullYear(), now.getMonth()); }
    else if (key === 'last_30') { to = new Date(now.getTime() + 86400000); from = new Date(now.getTime() - 30 * 86400000); }
    else if (key === 'this_year') { from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear() + 1, 0, 1); }
    return { from: from ? from.toISOString() : null, to: to ? to.toISOString() : null };
  }

  function setTab(tab) {
    _tab = tab;
    document.querySelectorAll('#panel-appointments .tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    var rem = document.getElementById('aa-remaining-pane'), rep = document.getElementById('aa-report-pane');
    if (rem) rem.style.display = (tab === 'remaining') ? '' : 'none';
    if (rep) rep.style.display = (tab === 'report') ? '' : 'none';
    if (tab === 'report') renderReport();
    else renderRemaining();
  }

  async function loadRemaining() {
    var host = document.getElementById('aa-remaining-host'); if (host) host.innerHTML = '<div style="padding:16px;color:var(--muted);">Loading…</div>';
    try {
      var r = await window.supabase.rpc('admin_client_packages', { p_q: '' });
      _packages = (r && r.data) ? r.data : [];
    } catch (e) { _packages = []; }
    _loaded = true;
    renderRemaining();
  }
  function onSearch(q) { _q = (q || '').toLowerCase().trim(); renderRemaining(); }

  function renderRemaining() {
    var host = document.getElementById('aa-remaining-host'); if (!host) return;
    var meta = document.getElementById('aa-remaining-meta');
    var rows = _packages.filter(function (p) {
      if (!_q) return true;
      return ((p.member_name || '') + ' ' + (p.member_email || '') + ' ' + (p.provider_name || '')).toLowerCase().indexOf(_q) !== -1;
    });
    if (meta) meta.textContent = rows.length + (rows.length === 1 ? ' package' : ' packages');
    if (!rows.length) { host.innerHTML = '<div style="padding:18px;color:var(--muted);">No client packages' + (_q ? ' match your search.' : ' sold yet.') + '</div>'; return; }
    var html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="text-align:left;color:var(--muted);">' +
      '<th style="padding:9px 10px;">Client</th><th style="padding:9px 10px;">Facility</th><th style="padding:9px 10px;">Package</th>' +
      '<th style="padding:9px 10px;">Remaining</th><th style="padding:9px 10px;">Status</th><th style="padding:9px 10px;">Expiry</th></tr></thead><tbody>';
    rows.forEach(function (p) {
      var pct = p.sessions_total ? Math.round(100 * p.sessions_remaining / p.sessions_total) : 0;
      var low = p.sessions_remaining <= 1;
      html += '<tr style="border-top:1px solid var(--border);">' +
        '<td style="padding:9px 10px;"><div style="font-weight:700;">' + esc(p.member_name || p.member_email || '—') + '</div><div style="color:var(--muted);font-size:12px;">' + esc(p.member_email || '') + '</div></td>' +
        '<td style="padding:9px 10px;">' + esc(p.provider_name || '—') + '</td>' +
        '<td style="padding:9px 10px;">' + esc(p.name || 'Package') + (p.service_name ? '<div style="color:var(--muted);font-size:12px;">' + esc(p.service_name) + '</div>' : '') + '</td>' +
        '<td style="padding:9px 10px;"><div style="display:flex;align-items:center;gap:8px;">' +
          '<div style="width:90px;height:7px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + (low ? '#f39c12' : 'var(--blue,#2ba8e0)') + ';"></div></div>' +
          '<b style="color:' + (low ? '#f39c12' : 'inherit') + ';">' + p.sessions_remaining + ' / ' + p.sessions_total + '</b></div></td>' +
        '<td style="padding:9px 10px;">' + esc(p.status) + '</td>' +
        '<td style="padding:9px 10px;color:var(--muted);">' + (p.expiry_date || '—') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    host.innerHTML = html;
  }

  async function renderReport() {
    var host = document.getElementById('aa-report-host'); if (!host) return;
    host.innerHTML = '<div style="padding:16px;color:var(--muted);">Loading…</div>';
    var key = (document.getElementById('aa-rep-range') || {}).value || 'this_month';
    var b = rangeBounds(key);
    var ov = null, list = [];
    try {
      var res = await Promise.all([
        window.supabase.rpc('admin_appointments_overview', { p_from: b.from, p_to: b.to }),
        window.supabase.rpc('admin_appointments_list', { p_from: b.from, p_to: b.to, p_provider: null })
      ]);
      ov = (res[0] && res[0].data) ? res[0].data : null;
      list = (res[1] && res[1].data) ? res[1].data : [];
    } catch (e) {}
    if (!ov) { host.innerHTML = '<div style="padding:16px;color:var(--muted);">Could not load the report.</div>'; return; }
    var s = ov.summary || {};
    var kpi = function (label, val, color) {
      return '<div style="flex:1;min-width:130px;background:var(--card,#141b22);border:1px solid var(--border);border-radius:12px;padding:13px 15px;">' +
        '<div style="color:var(--muted);font-size:12px;margin-bottom:4px;">' + label + '</div>' +
        '<div style="font-weight:800;font-size:20px;' + (color ? 'color:' + color + ';' : '') + '">' + val + '</div></div>';
    };
    var html = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 8px;">' +
      kpi('Gross revenue', money(s.gross_aed)) + kpi('Tax', money(s.tax_aed)) +
      kpi('Coach commission', money(s.commission_aed), '#f39c12') + kpi('Facility net', money(s.net_aed), '#22c55e') +
    '</div>';
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">' +
      kpi('Completed', s.completed || 0, '#22c55e') + kpi('Awaiting confirm', s.completed_pending || 0, '#f39c12') +
      kpi('No-shows', s.no_show || 0, '#ef4444') + kpi('Cancelled', s.cancelled || 0) +
      kpi('Unpaid', (s.unpaid_count || 0) + ' · ' + money(s.unpaid_aed), (s.unpaid_count ? '#ef4444' : null)) +
    '</div>';
    // by provider
    var bp = ov.by_provider || [];
    html += '<h3 style="margin:18px 0 8px;">By facility</h3>';
    if (!bp.length) html += '<div style="color:var(--muted);">No completed sessions in this period.</div>';
    else {
      html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="text-align:left;color:var(--muted);"><th style="padding:8px 10px;">Facility</th><th style="padding:8px 10px;">Sessions</th><th style="padding:8px 10px;">Gross</th><th style="padding:8px 10px;">Commission</th><th style="padding:8px 10px;">Facility net</th></tr></thead><tbody>';
      bp.forEach(function (p) {
        html += '<tr style="border-top:1px solid var(--border);"><td style="padding:8px 10px;font-weight:700;">' + esc(p.provider_name) + '</td>' +
          '<td style="padding:8px 10px;">' + p.sessions + '</td><td style="padding:8px 10px;">' + money(p.gross_aed) + '</td>' +
          '<td style="padding:8px 10px;color:#f39c12;">' + money(p.commission_aed) + '</td><td style="padding:8px 10px;color:#22c55e;">' + money(p.net_aed) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    // detail list
    html += '<h3 style="margin:18px 0 8px;">Every session (' + list.length + ')</h3>';
    if (!list.length) html += '<div style="color:var(--muted);">No sessions in this period.</div>';
    else {
      html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12.5px;">' +
        '<thead><tr style="text-align:left;color:var(--muted);"><th style="padding:7px 9px;">When</th><th style="padding:7px 9px;">Facility</th><th style="padding:7px 9px;">Coach</th><th style="padding:7px 9px;">Client</th><th style="padding:7px 9px;">Service</th><th style="padding:7px 9px;">Status</th><th style="padding:7px 9px;">Pay</th><th style="padding:7px 9px;">Gross</th><th style="padding:7px 9px;">Commission</th><th style="padding:7px 9px;">Net</th></tr></thead><tbody>';
      list.forEach(function (a) {
        var when = new Date(a.start_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' + new Date(a.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        var done = a.status === 'completed';
        html += '<tr style="border-top:1px solid var(--border);' + (a.status === 'cancelled' || a.status === 'no_show' ? 'opacity:.6;' : '') + '">' +
          '<td style="padding:7px 9px;white-space:nowrap;">' + when + '</td>' +
          '<td style="padding:7px 9px;">' + esc(a.provider_name || '—') + '</td>' +
          '<td style="padding:7px 9px;">' + esc(a.coach_name || '—') + '</td>' +
          '<td style="padding:7px 9px;">' + esc(a.member_name || '—') + '</td>' +
          '<td style="padding:7px 9px;">' + esc(a.service_name || '—') + '</td>' +
          '<td style="padding:7px 9px;">' + esc(a.status) + '</td>' +
          '<td style="padding:7px 9px;">' + esc(a.payment_status || '') + '</td>' +
          '<td style="padding:7px 9px;">' + (done ? money(a.price_aed, a.currency) : '—') + '</td>' +
          '<td style="padding:7px 9px;color:#f39c12;">' + (done ? money(a.commission_aed, a.currency) : '—') + '</td>' +
          '<td style="padding:7px 9px;color:#22c55e;">' + (done ? money(a.payout_aed, a.currency) : '—') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    host.innerHTML = html;
  }

  // self-init on first open (lazy-loaded by App._lazyInit)
  try { loadRemaining(); } catch (e) {}

  return { setTab: setTab, onSearch: onSearch, renderReport: renderReport, renderRemaining: renderRemaining, loadRemaining: loadRemaining };
})();

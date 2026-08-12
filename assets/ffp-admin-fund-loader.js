/* FFP Admin — Community Fund (tracking). 5% of every Passport subscription payment is ring-fenced to
   the member's city fund (rolling up to country). Read-only Phase 1: per-country/city balances +
   contributions + members, plus a recent-contributions ledger. Depends on window.supabase + is_admin RPCs
   admin_community_funds() / admin_fund_contributions(). Renders into #fund-body. */
(function () {
  var sb = function () { return window.supabase; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  function money(v, ccy) {
    var n = Number(v || 0);
    if (!ccy || ccy === 'USD') return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return esc(ccy) + ' ' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(s) { try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }

  function kpi(label, val) {
    return '<div style="flex:1;min-width:150px;background:#fff;border:1px solid #eef2f5;border-radius:12px;padding:14px 16px;">' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#8a99a8;">' + esc(label) + '</div>' +
      '<div style="font-size:22px;font-weight:900;color:#12232f;margin-top:4px;">' + val + '</div></div>';
  }

  async function render() {
    var el = document.getElementById('fund-body');
    if (!el) return;
    el.innerHTML = '<div style="padding:20px;color:#8a99a8;">Loading Community Fund…</div>';
    var d = {}, ledger = [];
    try {
      var r = await sb().rpc('admin_community_funds');
      if (r.error) throw r.error;
      d = r.data || {};
      var lr = await sb().rpc('admin_fund_contributions', { p_limit: 50 });
      ledger = (lr && !lr.error && Array.isArray(lr.data)) ? lr.data : [];
    } catch (e) {
      el.innerHTML = '<div style="padding:20px;color:#d9534f;">Couldn’t load the fund: ' + esc(e.message || '') + '</div>';
      return;
    }
    if (d && d.error) { el.innerHTML = '<div style="padding:20px;color:#d9534f;">Not authorised.</div>'; return; }

    var countries = Array.isArray(d.countries) ? d.countries : [];
    var head =
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;">' +
        kpi('Total fund', money(d.total_amount)) +
        kpi('Contributions', String(d.total_contributions || 0)) +
        kpi('Members contributing', String(d.total_members || 0)) +
        kpi('Cities', String(countries.reduce(function (a, c) { return a + ((c.cities || []).length); }, 0))) +
      '</div>' +
      '<div style="background:#eef6fb;border:1px solid #cfe6f3;border-radius:10px;padding:10px 14px;margin:6px 0 18px;color:#1b5b7a;font-size:12.5px;line-height:1.5;">' +
        '<b>5%</b> of every paid Passport subscription is ring-fenced to the member’s city fund. This is tracking only — no funds are disbursed here yet.</div>';

    if (!countries.length) {
      el.innerHTML = head + '<div style="padding:24px;color:#8a99a8;">No contributions yet. Funds start accruing on the next paid Passport renewal/subscription.</div>';
      return;
    }

    var body = countries.map(function (c) {
      var cities = (c.cities || []).map(function (ci) {
        return '<tr style="border-bottom:1px solid #f1f4f6;">' +
          '<td style="padding:9px 12px;font-weight:700;color:#12232f;">' + esc(ci.city || 'Unknown') + '</td>' +
          '<td style="padding:9px 12px;text-align:right;font-weight:800;color:#127a52;">' + money(ci.amount) + '</td>' +
          '<td style="padding:9px 12px;text-align:center;color:#5b6b75;">' + (ci.members || 0) + '</td>' +
          '<td style="padding:9px 12px;text-align:center;color:#8a99a8;">' + (ci.contributions || 0) + '</td>' +
          '<td style="padding:9px 12px;text-align:right;color:#8a99a8;font-size:12px;">' + (ci.last_at ? fmtDate(ci.last_at) : '') + '</td>' +
          '</tr>';
      }).join('');
      return '<div style="background:#fff;border:1px solid #eef2f5;border-radius:12px;padding:14px 16px;margin-bottom:14px;">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px;">' +
          '<div style="font-size:16px;font-weight:900;color:#12232f;">' + esc(c.country || 'Unknown') + '</div>' +
          '<div style="font-size:18px;font-weight:900;color:#127a52;">' + money(c.amount) + '<span style="font-size:12px;font-weight:700;color:#8a99a8;"> · ' + (c.members || 0) + ' members</span></div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
          '<thead><tr style="text-align:left;color:#8a99a8;font-size:11px;text-transform:uppercase;letter-spacing:.4px;">' +
          '<th style="padding:6px 12px;">City</th><th style="padding:6px 12px;text-align:right;">Fund</th><th style="padding:6px 12px;text-align:center;">Members</th><th style="padding:6px 12px;text-align:center;">Contribs</th><th style="padding:6px 12px;text-align:right;">Last</th>' +
          '</tr></thead><tbody>' + cities + '</tbody></table>' +
        '</div>';
    }).join('');

    var recent = ledger.length
      ? '<div style="font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#8a99a8;margin:20px 2px 8px;">Recent contributions</div>' +
        ledger.map(function (f) {
          return '<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #eef2f5;border-radius:10px;padding:9px 13px;margin-bottom:8px;">' +
            '<div style="flex:1;min-width:0;"><div style="font-weight:700;color:#12232f;">' + esc(f.member || 'Member') + '</div>' +
            '<div style="font-size:12px;color:#8a99a8;">' + esc([f.city, f.country].filter(Boolean).join(', ') || 'Unknown') + ' · ' + fmtDate(f.created_at) + '</div></div>' +
            '<div style="font-weight:800;color:#127a52;">' + money(f.amount, f.currency) + '</div></div>';
        }).join('')
      : '';

    el.innerHTML = head + body + recent;
  }

  window.AdminFund = { render: render };
  try { render(); } catch (e) {}
})();

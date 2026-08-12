/* FFP Admin — Community Fund. 5% of every Passport subscription payment is ring-fenced to the member's
   city fund (rolling up to country). Phase 1 tracking + Phase 2 disbursement: a fund's AVAILABLE balance
   = contributions − grants. Admin records grants (money paid OUT to a good cause); executing the actual
   payment is external. Depends on window.supabase + openModal/closeModal/showToast + is_admin RPCs
   admin_community_funds / admin_fund_contributions / admin_fund_grant_save / admin_fund_grants_list /
   admin_fund_grant_delete. Renders into #fund-body. */
(function () {
  var sb = function () { return window.supabase; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  function money(v, ccy) {
    var n = Number(v || 0);
    if (!ccy || ccy === 'USD') return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return esc(ccy) + ' ' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(s) { try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  function toast(m, k) { if (window.showToast) showToast(m, k || 'info'); }

  function kpi(label, val, color) {
    return '<div style="flex:1;min-width:140px;background:#fff;border:1px solid #eef2f5;border-radius:12px;padding:14px 16px;">' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#8a99a8;">' + esc(label) + '</div>' +
      '<div style="font-size:22px;font-weight:900;color:' + (color || '#12232f') + ';margin-top:4px;">' + val + '</div></div>';
  }

  async function render() {
    var el = document.getElementById('fund-body');
    if (!el) return;
    el.innerHTML = '<div style="padding:20px;color:#8a99a8;">Loading Community Fund…</div>';
    var d = {}, ledger = [], grants = [];
    try {
      var r = await sb().rpc('admin_community_funds');
      if (r.error) throw r.error;
      d = r.data || {};
      var lr = await sb().rpc('admin_fund_contributions', { p_limit: 40 });
      ledger = (lr && !lr.error && Array.isArray(lr.data)) ? lr.data : [];
      var gr = await sb().rpc('admin_fund_grants_list', { p_limit: 100 });
      grants = (gr && !gr.error && Array.isArray(gr.data)) ? gr.data : [];
    } catch (e) {
      el.innerHTML = '<div style="padding:20px;color:#d9534f;">Couldn’t load the fund: ' + esc(e.message || '') + '</div>';
      return;
    }
    if (d && d.error) { el.innerHTML = '<div style="padding:20px;color:#d9534f;">Not authorised.</div>'; return; }

    var countries = Array.isArray(d.countries) ? d.countries : [];
    var head =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">' +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;flex:1;">' +
          kpi('Available', money(d.total_available), '#127a52') +
          kpi('Raised (all time)', money(d.total_raised)) +
          kpi('Granted out', money(d.total_granted), '#b5771a') +
          kpi('Members', String(d.total_members || 0)) +
        '</div>' +
        '<button onclick="AdminFund.grant()" style="padding:11px 18px;border:none;background:#1980AD;color:#fff;border-radius:10px;font-weight:800;cursor:pointer;white-space:nowrap;"><span class="material-icons" style="vertical-align:-5px;font-size:19px;">volunteer_activism</span> Record a grant</button>' +
      '</div>' +
      '<div style="background:#eef6fb;border:1px solid #cfe6f3;border-radius:10px;padding:10px 14px;margin:0 0 18px;color:#1b5b7a;font-size:12.5px;line-height:1.5;">' +
        '<b>5%</b> of every paid Passport subscription is ring-fenced to the member’s city fund. <b>Available = raised − granted.</b> Recording a grant tracks money committed to a cause — you make the actual payment externally.</div>';

    var body = countries.length ? countries.map(function (c) {
      var cities = (c.cities || []).map(function (ci) {
        return '<tr style="border-bottom:1px solid #f1f4f6;">' +
          '<td style="padding:9px 12px;font-weight:700;color:#12232f;">' + esc(ci.city || 'Unknown') + '</td>' +
          '<td style="padding:9px 12px;text-align:right;font-weight:800;color:#127a52;">' + money(ci.available) + '</td>' +
          '<td style="padding:9px 12px;text-align:right;color:#5b6b75;">' + money(ci.raised) + '</td>' +
          '<td style="padding:9px 12px;text-align:right;color:#b5771a;">' + money(ci.granted) + '</td>' +
          '<td style="padding:9px 12px;text-align:center;color:#8a99a8;">' + (ci.members || 0) + '</td>' +
          '<td style="padding:9px 12px;text-align:right;"><button onclick="AdminFund.grant(' + JSON.stringify(esc(ci.city || '')) + ',' + JSON.stringify(esc(c.country || '')) + ')" style="border:1px solid #d7dee5;background:#fff;border-radius:8px;padding:5px 11px;font-size:12px;font-weight:800;color:#1980AD;cursor:pointer;">Grant</button></td>' +
          '</tr>';
      }).join('');
      return '<div style="background:#fff;border:1px solid #eef2f5;border-radius:12px;padding:14px 16px;margin-bottom:14px;">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px;">' +
          '<div style="font-size:16px;font-weight:900;color:#12232f;">' + esc(c.country || 'Unknown') + '</div>' +
          '<div style="font-size:16px;font-weight:900;color:#127a52;">' + money(c.available) + ' available<span style="font-size:12px;font-weight:700;color:#8a99a8;"> · ' + (c.members || 0) + ' members</span></div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
          '<thead><tr style="text-align:left;color:#8a99a8;font-size:11px;text-transform:uppercase;letter-spacing:.4px;">' +
          '<th style="padding:6px 12px;">City</th><th style="padding:6px 12px;text-align:right;">Available</th><th style="padding:6px 12px;text-align:right;">Raised</th><th style="padding:6px 12px;text-align:right;">Granted</th><th style="padding:6px 12px;text-align:center;">Members</th><th></th>' +
          '</tr></thead><tbody>' + cities + '</tbody></table>' +
        '</div>';
    }).join('') : '<div style="padding:24px;color:#8a99a8;">No contributions yet. Funds start accruing on the next paid Passport renewal/subscription.</div>';

    var grantsList = grants.length
      ? '<div style="font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#8a99a8;margin:22px 2px 8px;">Grants (' + grants.length + ')</div>' +
        grants.map(function (g) {
          return '<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #eef2f5;border-radius:10px;padding:10px 13px;margin-bottom:8px;">' +
            '<div style="flex:1;min-width:0;"><div style="font-weight:800;color:#12232f;">' + esc(g.cause) + '</div>' +
            '<div style="font-size:12px;color:#8a99a8;">' + esc([g.city, g.country].filter(Boolean).join(', ') || 'Unassigned') + (g.paid_at ? ' · ' + fmtDate(g.paid_at) : ' · ' + fmtDate(g.created_at)) + (g.status === 'planned' ? ' · Planned' : '') + '</div></div>' +
            '<div style="font-weight:800;color:#b5771a;white-space:nowrap;">' + money(g.amount, g.currency) + '</div>' +
            '<button onclick="AdminFund.editGrant(' + JSON.stringify(g).replace(/'/g, '&#39;').replace(/"/g, '&quot;') + ')" title="Edit" style="border:none;background:none;cursor:pointer;color:#1980AD;"><span class="material-icons" style="font-size:18px;">edit</span></button>' +
            '<button onclick="AdminFund.deleteGrant(\'' + g.id + '\')" title="Delete" style="border:none;background:none;cursor:pointer;color:#d9534f;"><span class="material-icons" style="font-size:18px;">delete</span></button>' +
            '</div>';
        }).join('')
      : '';

    var recent = ledger.length
      ? '<div style="font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#8a99a8;margin:22px 2px 8px;">Recent contributions</div>' +
        ledger.map(function (f) {
          return '<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #eef2f5;border-radius:10px;padding:9px 13px;margin-bottom:8px;">' +
            '<div style="flex:1;min-width:0;"><div style="font-weight:700;color:#12232f;">' + esc(f.member || 'Member') + '</div>' +
            '<div style="font-size:12px;color:#8a99a8;">' + esc([f.city, f.country].filter(Boolean).join(', ') || 'Unknown') + ' · ' + fmtDate(f.created_at) + '</div></div>' +
            '<div style="font-weight:800;color:#127a52;">' + money(f.amount, f.currency) + '</div></div>';
        }).join('')
      : '';

    el.innerHTML = head + body + grantsList + recent;
  }

  var editingGrantId = null;
  var inCss = 'width:100%;padding:10px 12px;border:1px solid #d7dee5;border-radius:10px;font:inherit;box-sizing:border-box;background:#fff;color:#12232f;';
  function fld(label, inner, hint) { return '<div style="margin-bottom:12px;"><label style="display:block;font-size:12px;font-weight:700;color:#43525c;margin-bottom:5px;">' + esc(label) + '</label>' + inner + (hint ? '<div style="font-size:11px;color:#8a99a8;margin-top:4px;">' + esc(hint) + '</div>' : '') + '</div>'; }
  function gv(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; }

  function grant(city, country, existing) {
    if (typeof window.openModal !== 'function') { alert('Admin modal unavailable on this page.'); return; }
    var o = existing || {};
    editingGrantId = o.id || null;
    var today = new Date().toISOString().slice(0, 10);
    var body =
      fld('Cause / recipient *', '<input id="fg-cause" value="' + esc(o.cause || '') + '" placeholder="e.g. Youth football kits — Al Nasr" style="' + inCss + '">') +
      '<div style="display:flex;gap:10px;">' +
        '<div style="flex:1">' + fld('Amount *', '<input id="fg-amount" type="number" value="' + esc(o.amount != null ? o.amount : '') + '" placeholder="0.00" style="' + inCss + '">') + '</div>' +
        '<div style="width:110px">' + fld('Currency', '<input id="fg-currency" value="' + esc(o.currency || 'USD') + '" style="' + inCss + '">') + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;">' +
        '<div style="flex:1">' + fld('City', '<input id="fg-city" value="' + esc(o.city != null ? o.city : (city || '')) + '" placeholder="e.g. Dubai" style="' + inCss + '">') + '</div>' +
        '<div style="flex:1">' + fld('Country', '<input id="fg-country" value="' + esc(o.country != null ? o.country : (country || '')) + '" placeholder="e.g. United Arab Emirates" style="' + inCss + '">') + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;">' +
        '<div style="flex:1">' + fld('Status', '<select id="fg-status" style="' + inCss + '"><option value="paid"' + (o.status !== 'planned' ? ' selected' : '') + '>Paid</option><option value="planned"' + (o.status === 'planned' ? ' selected' : '') + '>Planned</option></select>') + '</div>' +
        '<div style="flex:1">' + fld('Date', '<input id="fg-paid_at" type="date" value="' + esc(o.paid_at ? String(o.paid_at).slice(0, 10) : today) + '" style="' + inCss + '">') + '</div>' +
      '</div>' +
      fld('Notes', '<textarea id="fg-description" rows="2" placeholder="What the grant supports" style="' + inCss + ';resize:vertical">' + esc(o.description || '') + '</textarea>', 'Recording tracks the commitment — make the actual payment externally.');
    var foot = '<button onclick="closeModal()" style="padding:10px 16px;border:1px solid #d7dee5;background:#fff;border-radius:10px;font-weight:700;cursor:pointer;">Cancel</button>' +
      '<button onclick="AdminFund.saveGrant()" style="padding:10px 18px;border:none;background:#1980AD;color:#fff;border-radius:10px;font-weight:800;cursor:pointer;">' + (editingGrantId ? 'Save' : 'Record grant') + '</button>';
    window.openModal((editingGrantId ? 'Edit grant' : 'Record a grant'), body, foot, { fullbleed: true });
  }

  async function saveGrant() {
    if (!gv('fg-cause')) { toast('Cause is required', 'error'); return; }
    if (!gv('fg-amount') || Number(gv('fg-amount')) <= 0) { toast('Enter an amount', 'error'); return; }
    var payload = {
      cause: gv('fg-cause'), amount: gv('fg-amount'), currency: gv('fg-currency') || 'USD',
      city: gv('fg-city'), country: gv('fg-country'), status: gv('fg-status') || 'paid',
      paid_at: gv('fg-paid_at') || null, description: gv('fg-description') || null
    };
    try {
      var r = await sb().rpc('admin_fund_grant_save', { p_id: editingGrantId, p: payload });
      if (r.error) throw r.error;
      if (r.data && r.data.error) throw new Error(r.data.error);
      if (window.closeModal) closeModal();
      toast(editingGrantId ? 'Grant updated' : 'Grant recorded', 'success');
      editingGrantId = null;
      render();
    } catch (e) { toast(e.message || 'Could not save', 'error'); }
  }

  async function deleteGrant(id) {
    if (!window.confirm('Delete this grant? The amount returns to the fund’s available balance.')) return;
    try { var r = await sb().rpc('admin_fund_grant_delete', { p_id: id }); if (r.error) throw r.error; toast('Grant deleted', 'success'); render(); }
    catch (e) { toast(e.message || 'Could not delete', 'error'); }
  }

  window.AdminFund = {
    render: render,
    grant: function (city, country) { grant(city, country, null); },
    editGrant: function (g) { grant(null, null, g); },
    saveGrant: saveGrant,
    deleteGrant: deleteGrant
  };
  try { render(); } catch (e) {}
})();

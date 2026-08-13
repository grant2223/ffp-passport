/* FFP Admin — WGA (World's Greatest Adventures). Moderate member-suggested destinations
   (approve onto the public vote list / reject), review every submitted dream and mark dreams
   "made real", and edit the tile's launch date + "next dream drops" banner text.
   Depends on window.supabase (authed via JWT header) + openModal/closeModal/showToast + is_admin RPCs
   wga_admin_destinations / wga_admin_destination_decide / wga_admin_destination_add /
   wga_admin_dreams / wga_admin_make_real / wga_settings_set. Renders into #wga-body. */
(function () {
  var sb = function () { return window.supabase; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var toast = function (m, k) { if (window.showToast) showToast(m, k || 'info'); };
  function fmtDate(s) { try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }

  function kpi(label, val, color) {
    return '<div style="flex:1;min-width:130px;background:#fff;border:1px solid #eef2f5;border-radius:12px;padding:14px 16px;">' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#8a99a8;">' + esc(label) + '</div>' +
      '<div style="font-size:22px;font-weight:900;color:' + (color || '#12232f') + ';margin-top:4px;">' + val + '</div></div>';
  }

  var dests = [], dreams = [], settings = {};

  async function loadAll() {
    var dr = await sb().rpc('wga_admin_destinations');
    dests = (dr && !dr.error && Array.isArray(dr.data)) ? dr.data : [];
    var mr = await sb().rpc('wga_admin_dreams', { p_limit: 300 });
    dreams = (mr && !mr.error && Array.isArray(mr.data)) ? mr.data : [];
    try { var sr = await sb().from('wga_settings').select('key,value'); (sr.data || []).forEach(function (r) { settings[r.key] = r.value; }); } catch (e) {}
  }

  function destRow(d) {
    var pending = d.status === 'pending';
    var actions = pending
      ? '<button onclick="AdminWGA.decide(\'' + d.id + '\',true)" style="padding:7px 12px;border:none;background:#1e9e75;color:#fff;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Approve</button>' +
        '<button onclick="AdminWGA.decide(\'' + d.id + '\',false)" style="padding:7px 12px;border:none;background:#f1f4f6;color:#d9534f;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Reject</button>'
      : '<button onclick="AdminWGA.decide(\'' + d.id + '\',false)" style="padding:7px 12px;border:none;background:#f1f4f6;color:#8a99a8;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Remove</button>';
    return '<tr style="border-bottom:1px solid #f1f4f6;">' +
      '<td style="padding:10px 12px;font-weight:800;color:#12232f;">' + esc(d.name) +
        (pending ? ' <span style="background:#fff3d6;color:#9a6a00;font-size:10px;font-weight:900;padding:2px 7px;border-radius:100px;margin-left:6px;">PENDING</span>' : '') +
        '<div style="font-size:12px;font-weight:600;color:#8a99a8;margin-top:2px;">' + esc(d.blurb || '') + (d.suggested_by ? ' · suggested by ' + esc(d.suggested_by) : '') + '</div></td>' +
      '<td style="padding:10px 12px;text-align:center;font-weight:900;color:#1980AD;">' + (d.votes || 0) + '</td>' +
      '<td style="padding:10px 12px;text-align:right;white-space:nowrap;">' + actions + '</td></tr>';
  }

  function dreamRow(d) {
    return '<tr style="border-bottom:1px solid #f1f4f6;">' +
      '<td style="padding:10px 12px;">' +
        '<div style="font-weight:700;color:#12232f;">' + esc(d.dream) + '</div>' +
        '<div style="font-size:12px;font-weight:600;color:#8a99a8;margin-top:2px;">' + esc(d.member_name) + (d.member_city ? ' · ' + esc(d.member_city) : '') + (d.category ? ' · ' + esc(d.category) : '') + ' · ' + fmtDate(d.created_at) + '</div></td>' +
      '<td style="padding:10px 12px;text-align:center;font-weight:900;color:#e0447a;">' + (d.boosts || 0) + '</td>' +
      '<td style="padding:10px 12px;text-align:right;white-space:nowrap;">' +
        (d.made_real
          ? '<button onclick="AdminWGA.makeReal(\'' + d.id + '\',false)" style="padding:7px 12px;border:none;background:#e7f6ef;color:#127a52;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;"><span class="material-icons" style="font-size:15px;vertical-align:-3px;">emoji_events</span> Made real</button>'
          : '<button onclick="AdminWGA.makeReal(\'' + d.id + '\',true)" style="padding:7px 12px;border:none;background:#1980AD;color:#fff;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Mark made real</button>') +
      '</td></tr>';
  }

  async function render() {
    var el = document.getElementById('wga-body');
    if (!el) return;
    el.innerHTML = '<div style="padding:20px;color:#8a99a8;">Loading WGA…</div>';
    try { await loadAll(); } catch (e) { el.innerHTML = '<div style="padding:20px;color:#d9534f;">Couldn’t load WGA: ' + esc(e.message || '') + '</div>'; return; }

    var pending = dests.filter(function (d) { return d.status === 'pending'; }).length;
    var madeReal = dreams.filter(function (d) { return d.made_real; }).length;

    var kpis = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
      kpi('Dreams shared', String(dreams.length)) +
      kpi('Dreams made real', String(madeReal), '#127a52') +
      kpi('Destinations', String(dests.filter(function (d) { return d.status === 'approved'; }).length)) +
      kpi('Suggestions to review', String(pending), pending ? '#b5771a' : '#12232f') +
    '</div>';

    var destHead = '<div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 10px;">' +
      '<h2 style="font-size:16px;font-weight:900;color:#12232f;margin:0;">Vote destinations</h2>' +
      '<button onclick="AdminWGA.addDest()" style="padding:9px 15px;border:none;background:#1980AD;color:#fff;border-radius:9px;font-weight:800;cursor:pointer;font-size:13px;"><span class="material-icons" style="font-size:17px;vertical-align:-4px;">add_location_alt</span> Add destination</button></div>';
    var destTable = '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eef2f5;border-radius:12px;overflow:hidden;">' +
      '<thead><tr style="background:#f7f9fb;"><th style="text-align:left;padding:9px 12px;font-size:11px;color:#8a99a8;">Place</th><th style="padding:9px 12px;font-size:11px;color:#8a99a8;">Votes</th><th></th></tr></thead><tbody>' +
      (dests.length ? dests.map(destRow).join('') : '<tr><td colspan="3" style="padding:16px;color:#8a99a8;">No destinations yet.</td></tr>') +
      '</tbody></table>';

    var dreamHead = '<h2 style="font-size:16px;font-weight:900;color:#12232f;margin:22px 0 10px;">Dreams</h2>';
    var dreamTable = '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eef2f5;border-radius:12px;overflow:hidden;">' +
      '<thead><tr style="background:#f7f9fb;"><th style="text-align:left;padding:9px 12px;font-size:11px;color:#8a99a8;">Dream</th><th style="padding:9px 12px;font-size:11px;color:#8a99a8;">Boosts</th><th></th></tr></thead><tbody>' +
      (dreams.length ? dreams.map(dreamRow).join('') : '<tr><td colspan="3" style="padding:16px;color:#8a99a8;">No dreams submitted yet.</td></tr>') +
      '</tbody></table>';

    var setBox = '<h2 style="font-size:16px;font-weight:900;color:#12232f;margin:22px 0 10px;">Tile settings</h2>' +
      '<div style="background:#fff;border:1px solid #eef2f5;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;max-width:520px;">' +
        '<label style="font-size:12px;font-weight:800;color:#5f6f7d;">“Next dream drops” banner text' +
          '<input id="wga-next" value="' + esc(settings.next_drop_text || '') + '" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #e7ecf0;border-radius:9px;font-size:14px;"></label>' +
        '<label style="font-size:12px;font-weight:800;color:#5f6f7d;">Launch date (ISO, e.g. 2026-10-26T00:00:00+04:00)' +
          '<input id="wga-launch" value="' + esc(settings.launch_at || '') + '" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #e7ecf0;border-radius:9px;font-size:14px;"></label>' +
        '<button onclick="AdminWGA.saveSettings()" style="align-self:flex-start;padding:10px 18px;border:none;background:#1980AD;color:#fff;border-radius:9px;font-weight:800;cursor:pointer;">Save settings</button>' +
      '</div>';

    el.innerHTML = kpis + destHead + destTable + dreamHead + dreamTable + setBox;
  }

  window.AdminWGA = {
    refresh: render,
    decide: async function (id, approve) {
      if (!approve && !confirm('Remove this destination?')) return;
      var r = await sb().rpc('wga_admin_destination_decide', { p_id: id, p_approve: approve });
      if (r.error) return toast(r.error.message || 'Failed', 'error');
      toast(approve ? 'Approved' : 'Removed', 'success'); render();
    },
    makeReal: async function (id, on) {
      var r = await sb().rpc('wga_admin_make_real', { p_dream: id, p_on: on });
      if (r.error) return toast(r.error.message || 'Failed', 'error');
      toast(on ? 'Marked made real' : 'Unmarked', 'success'); render();
    },
    addDest: function () {
      if (typeof window.openModal !== 'function') { alert('Admin modal unavailable on this page.'); return; }
      var body = '<div style="display:flex;flex-direction:column;gap:12px;">' +
        '<label style="font-size:12px;font-weight:800;color:#5f6f7d;">Name<input id="ad-name" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #e7ecf0;border-radius:9px;"></label>' +
        '<label style="font-size:12px;font-weight:800;color:#5f6f7d;">Blurb<input id="ad-blurb" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #e7ecf0;border-radius:9px;" placeholder="Table Mountain trails & ocean racing"></label>' +
        '<label style="font-size:12px;font-weight:800;color:#5f6f7d;">Image URL (optional)<input id="ad-img" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #e7ecf0;border-radius:9px;"></label>' +
        '</div>';
      var footer = '<button class="btn" onclick="closeModal()">Cancel</button>' +
        '<button class="btn" style="background:#1980AD;color:#fff;" onclick="AdminWGA.submitDest()">Add</button>';
      window.openModal('Add destination', body, footer);
    },
    submitDest: async function () {
      var name = (document.getElementById('ad-name').value || '').trim();
      if (!name) return toast('Enter a name', 'error');
      var r = await sb().rpc('wga_admin_destination_add', { p_name: name, p_blurb: (document.getElementById('ad-blurb').value || '').trim() || null, p_image: (document.getElementById('ad-img').value || '').trim() || null });
      if (r.error) return toast(r.error.message || 'Failed', 'error');
      if (window.closeModal) closeModal(); toast('Destination added', 'success'); render();
    },
    saveSettings: async function () {
      var next = document.getElementById('wga-next').value;
      var launch = document.getElementById('wga-launch').value;
      var a = await sb().rpc('wga_settings_set', { p_key: 'next_drop_text', p_value: next });
      var b = await sb().rpc('wga_settings_set', { p_key: 'launch_at', p_value: launch });
      if ((a && a.error) || (b && b.error)) return toast('Save failed', 'error');
      settings.next_drop_text = next; settings.launch_at = launch;
      toast('Settings saved', 'success');
    }
  };

  render();
})();

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

  // Downscale + re-encode any image to a small JPEG so large/HEIC uploads don't fail.
  function toJpeg(file, maxDim, q) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth || img.width, hh = img.naturalHeight || img.height;
          if (!w || !hh) { reject(new Error('empty')); return; }
          if (w > maxDim || hh > maxDim) { var s = Math.min(maxDim / w, maxDim / hh); w = Math.round(w * s); hh = Math.round(hh * s); }
          var c = document.createElement('canvas'); c.width = w; c.height = hh;
          var ctx = c.getContext('2d'); if (!ctx) { reject(new Error('no ctx')); return; }
          ctx.drawImage(img, 0, 0, w, hh);
          c.toBlob(function (b) { b ? resolve(b) : reject(new Error('encode')); }, 'image/jpeg', q || 0.85);
        };
        img.onerror = function () { reject(new Error('decode')); };
        img.src = fr.result;
      };
      fr.onerror = function () { reject(new Error('read')); };
      fr.readAsDataURL(file);
    });
  }

  function kpi(label, val, color) {
    return '<div style="flex:1;min-width:130px;background:#fff;border:1px solid #eef2f5;border-radius:12px;padding:14px 16px;">' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#8a99a8;">' + esc(label) + '</div>' +
      '<div style="font-size:22px;font-weight:900;color:' + (color || '#12232f') + ';margin-top:4px;">' + val + '</div></div>';
  }

  var dests = [], dreams = [], settings = {}, things = [], updates = [], route = [];

  async function loadAll() {
    try { var rr = await sb().rpc('wga_admin_route_list'); route = (rr && !rr.error && Array.isArray(rr.data)) ? rr.data : []; } catch (e) { route = []; }
    var dr = await sb().rpc('wga_admin_destinations');
    dests = (dr && !dr.error && Array.isArray(dr.data)) ? dr.data : [];
    var mr = await sb().rpc('wga_admin_dreams', { p_limit: 300 });
    dreams = (mr && !mr.error && Array.isArray(mr.data)) ? mr.data : [];
    var th = await sb().rpc('wga_admin_things');
    things = (th && !th.error && Array.isArray(th.data)) ? th.data : [];
    var up = await sb().rpc('wga_admin_updates_list');
    updates = (up && !up.error && Array.isArray(up.data)) ? up.data : [];
    settings = {};
    try { var sr = await sb().from('wga_settings').select('key,value'); (sr.data || []).forEach(function (r) { settings[r.key] = r.value; }); } catch (e) {}
  }

  function destRow(d) {
    var pending = d.status === 'pending';
    var actions = pending
      ? '<button onclick="AdminWGA.decide(\'' + d.id + '\',true)" style="padding:7px 12px;border:none;background:#1e9e75;color:#fff;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Approve</button>' +
        '<button onclick="AdminWGA.decide(\'' + d.id + '\',false)" style="padding:7px 12px;border:none;background:#f1f4f6;color:#d9534f;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Reject</button>'
      : '<button onclick="AdminWGA.route(\'' + d.id + '\',' + (d.confirmed ? 'false' : 'true') + ')" style="padding:7px 12px;border:none;background:' + (d.confirmed ? '#e7f6ef;color:#127a52' : '#eef4f8;color:#1980AD') + ';border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;margin-right:6px;">' + (d.confirmed ? '✓ On route' : 'Add to route') + '</button>' +
        '<button onclick="AdminWGA.decide(\'' + d.id + '\',false)" style="padding:7px 12px;border:none;background:#f1f4f6;color:#8a99a8;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Remove</button>';
    return '<tr style="border-bottom:1px solid #f1f4f6;">' +
      '<td style="padding:10px 12px;font-weight:800;color:#12232f;">' + esc(d.name) +
        (pending ? ' <span style="background:#fff3d6;color:#9a6a00;font-size:10px;font-weight:900;padding:2px 7px;border-radius:100px;margin-left:6px;">PENDING</span>' : '') +
        '<div style="font-size:12px;font-weight:600;color:#8a99a8;margin-top:2px;">' + esc(d.blurb || '') + (d.suggested_by ? ' · suggested by ' + esc(d.suggested_by) : '') + '</div></td>' +
      '<td style="padding:10px 12px;text-align:center;font-weight:900;color:#1980AD;">' + (d.votes || 0) + '</td>' +
      '<td style="padding:10px 12px;text-align:right;white-space:nowrap;">' + actions + '</td></tr>';
  }

  function thingRow(t) {
    var pending = t.status === 'pending';
    var actions = pending
      ? '<button onclick="AdminWGA.thingDecide(\'' + t.id + '\',true)" style="padding:7px 12px;border:none;background:#1e9e75;color:#fff;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Approve</button>' +
        '<button onclick="AdminWGA.thingDecide(\'' + t.id + '\',false)" style="padding:7px 12px;border:none;background:#f1f4f6;color:#d9534f;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Reject</button>'
      : '<button onclick="AdminWGA.thingDecide(\'' + t.id + '\',false)" style="padding:7px 12px;border:none;background:#f1f4f6;color:#8a99a8;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Remove</button>';
    return '<tr style="border-bottom:1px solid #f1f4f6;">' +
      '<td style="padding:10px 12px;font-weight:800;color:#12232f;">' + esc(t.name) +
        (pending ? ' <span style="background:#fff3d6;color:#9a6a00;font-size:10px;font-weight:900;padding:2px 7px;border-radius:100px;margin-left:6px;">PENDING</span>' : '') +
        '<div style="font-size:12px;font-weight:600;color:#8a99a8;margin-top:2px;">' + esc(t.blurb || '') + (t.suggested_by ? ' · suggested by ' + esc(t.suggested_by) : '') + '</div></td>' +
      '<td style="padding:10px 12px;text-align:center;font-weight:900;color:#1980AD;">' + (t.votes || 0) + '</td>' +
      '<td style="padding:10px 12px;text-align:right;white-space:nowrap;">' + actions + '</td></tr>';
  }

  function routeRow(r) {
    var badge = { confirmed: ['#e7f6ef', '#127a52', 'Confirmed'], voting: ['#fff3d6', '#9a6a00', 'Voting now'], tbd: ['#eef2f5', '#8a99a8', 'TBD'] }[r.status] || ['#eef2f5', '#8a99a8', r.status];
    var dates = r.date_from ? (fmtDate(r.date_from) + (r.date_to ? '–' + fmtDate(r.date_to) : '')) : '';
    return '<tr style="border-bottom:1px solid #f1f4f6;">' +
      '<td style="padding:10px 12px;font-weight:800;color:#12232f;">' + esc(r.month_label || '') + '</td>' +
      '<td style="padding:10px 12px;"><div style="font-weight:800;color:#12232f;">' + esc(r.name) + '</div><div style="font-size:12px;font-weight:600;color:#8a99a8;">' + esc([r.city, r.country, dates].filter(Boolean).join(' · ')) + '</div></td>' +
      '<td style="padding:10px 12px;text-align:center;"><span style="background:' + badge[0] + ';color:' + badge[1] + ';font-size:10px;font-weight:900;padding:3px 9px;border-radius:100px;">' + badge[2] + '</span></td>' +
      '<td style="padding:10px 12px;text-align:right;white-space:nowrap;">' +
        '<button onclick="AdminWGA.editRoute(\'' + r.id + '\')" style="padding:7px 12px;border:none;background:#eef4f8;color:#1980AD;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;margin-right:6px;">Edit</button>' +
        '<button onclick="AdminWGA.removeRoute(\'' + r.id + '\')" style="padding:7px 12px;border:none;background:#f1f4f6;color:#d9534f;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Delete</button></td></tr>';
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

    // THINGS TO DO poll
    var thingHead = '<div style="display:flex;justify-content:space-between;align-items:center;margin:22px 0 10px;">' +
      '<h2 style="font-size:16px;font-weight:900;color:#12232f;margin:0;">Things to do (poll)</h2>' +
      '<button onclick="AdminWGA.addThing()" style="padding:9px 15px;border:none;background:#1980AD;color:#fff;border-radius:9px;font-weight:800;cursor:pointer;font-size:13px;"><span class="material-icons" style="font-size:17px;vertical-align:-4px;">add</span> Add thing</button></div>';
    var thingTable = '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eef2f5;border-radius:12px;overflow:hidden;">' +
      '<thead><tr style="background:#f7f9fb;"><th style="text-align:left;padding:9px 12px;font-size:11px;color:#8a99a8;">Experience</th><th style="padding:9px 12px;font-size:11px;color:#8a99a8;">Votes</th><th></th></tr></thead><tbody>' +
      (things.length ? things.map(thingRow).join('') : '<tr><td colspan="3" style="padding:16px;color:#8a99a8;">No things to do yet.</td></tr>') +
      '</tbody></table>';

    // UPDATES (ticker)
    var updHead = '<div style="display:flex;justify-content:space-between;align-items:center;margin:22px 0 10px;">' +
      '<h2 style="font-size:16px;font-weight:900;color:#12232f;margin:0;">Tour updates</h2>' +
      '<button onclick="AdminWGA.addUpdate()" style="padding:9px 15px;border:none;background:#1980AD;color:#fff;border-radius:9px;font-weight:800;cursor:pointer;font-size:13px;"><span class="material-icons" style="font-size:17px;vertical-align:-4px;">campaign</span> Post update</button></div>';
    var updTable = '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eef2f5;border-radius:12px;overflow:hidden;"><tbody>' +
      (updates.length ? updates.map(function (u) { return '<tr style="border-bottom:1px solid #f1f4f6;"><td style="padding:10px 12px;font-weight:700;color:#12232f;">' + esc(u.text) + '<div style="font-size:11px;color:#8a99a8;margin-top:2px;">' + fmtDate(u.created_at) + '</div></td><td style="padding:10px 12px;text-align:right;"><button onclick="AdminWGA.removeUpdate(\'' + u.id + '\')" style="padding:6px 11px;border:none;background:#f1f4f6;color:#d9534f;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Delete</button></td></tr>'; }).join('') : '<tr><td style="padding:16px;color:#8a99a8;">No updates posted.</td></tr>') +
      '</tbody></table>';

    // THE 2027 ROUTE (schedule)
    var routeHead = '<div style="display:flex;justify-content:space-between;align-items:center;margin:22px 0 10px;">' +
      '<h2 style="font-size:16px;font-weight:900;color:#12232f;margin:0;">The 2027 route (schedule)</h2>' +
      '<button onclick="AdminWGA.addRoute()" style="padding:9px 15px;border:none;background:#1980AD;color:#fff;border-radius:9px;font-weight:800;cursor:pointer;font-size:13px;"><span class="material-icons" style="font-size:17px;vertical-align:-4px;">route</span> Add stop</button></div>';
    var routeTable = '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eef2f5;border-radius:12px;overflow:hidden;">' +
      '<thead><tr style="background:#f7f9fb;"><th style="text-align:left;padding:9px 12px;font-size:11px;color:#8a99a8;">Month</th><th style="text-align:left;padding:9px 12px;font-size:11px;color:#8a99a8;">Stop</th><th style="padding:9px 12px;font-size:11px;color:#8a99a8;">Status</th><th></th></tr></thead><tbody>' +
      (route.length ? route.map(routeRow).join('') : '<tr><td colspan="4" style="padding:16px;color:#8a99a8;">No stops yet. Add each month\'s confirmed destination.</td></tr>') +
      '</tbody></table>';

    var setBox = '<h2 style="font-size:16px;font-weight:900;color:#12232f;margin:22px 0 10px;">Tile settings</h2>' +
      '<div style="background:#fff;border:1px solid #eef2f5;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;max-width:520px;">' +
        '<label style="font-size:12px;font-weight:800;color:#5f6f7d;">Votes to unlock the next stop (goal)' +
          '<input id="wga-goal" value="' + esc(settings.vote_goal || '25000') + '" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #e7ecf0;border-radius:9px;font-size:14px;"></label>' +
        '<label style="font-size:12px;font-weight:800;color:#5f6f7d;">Round label (shown on the app hero, e.g. “September round”)' +
          '<input id="wga-round" value="' + esc(settings.round_label || '') + '" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #e7ecf0;border-radius:9px;font-size:14px;"></label>' +
        '<label style="font-size:12px;font-weight:800;color:#5f6f7d;">Voting closes (ISO, e.g. 2026-10-26T00:00:00+04:00)' +
          '<input id="wga-close" value="' + esc(settings.vote_close_at || '') + '" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #e7ecf0;border-radius:9px;font-size:14px;"></label>' +
        '<label style="font-size:12px;font-weight:800;color:#5f6f7d;">Itinerary link (where “Join us” goes, e.g. /explore)' +
          '<input id="wga-itin" value="' + esc(settings.itinerary_url || '') + '" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #e7ecf0;border-radius:9px;font-size:14px;"></label>' +
        '<button onclick="AdminWGA.saveSettings()" style="align-self:flex-start;padding:10px 18px;border:none;background:#1980AD;color:#fff;border-radius:9px;font-weight:800;cursor:pointer;">Save settings</button>' +
      '</div>';

    el.innerHTML = kpis + routeHead + routeTable + destHead + destTable + thingHead + thingTable + updHead + updTable + dreamHead + dreamTable + setBox;
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
      var fld = 'display:block;width:100%;margin-top:6px;padding:11px 12px;border:1px solid #e7ecf0;border-radius:9px;font:inherit;font-size:14px;box-sizing:border-box;';
      var lbl = 'font-size:12px;font-weight:800;color:#5f6f7d;';
      var body = '<div style="display:flex;flex-direction:column;gap:16px;">' +
        '<label style="' + lbl + '">Name<input id="ad-name" style="' + fld + '" placeholder="Interlaken, Switzerland"></label>' +
        '<label style="' + lbl + '">Blurb<input id="ad-blurb" style="' + fld + '" placeholder="Table Mountain trails & ocean racing"></label>' +
        '<div><div style="' + lbl + 'margin-bottom:7px;">Image</div>' +
          '<div id="ad-img-tile" onclick="document.getElementById(\'ad-img-file\').click()" style="display:flex;align-items:center;gap:12px;border:1px dashed #cfdbe3;border-radius:10px;padding:12px;cursor:pointer;background:#fff;">' +
            '<div id="ad-img-prev" style="width:52px;height:52px;border-radius:9px;background:#eef2f5;display:flex;align-items:center;justify-content:center;color:#8a99a8;flex:none;"><span class="material-icons">image</span></div>' +
            '<div id="ad-img-txt" style="font-size:13px;font-weight:700;color:#5b6b75;">Tap to upload an image</div>' +
          '</div>' +
          '<input id="ad-img-file" type="file" accept="image/*" style="display:none" onchange="AdminWGA.uploadImg(this)">' +
          '<input type="hidden" id="ad-img" value="">' +
        '</div>' +
        '</div>';
      var footer = '<button class="btn" onclick="closeModal()">Cancel</button>' +
        '<button class="btn" style="background:#1980AD;color:#fff;" onclick="AdminWGA.submitDest()">Add</button>';
      window.openModal('Add destination', body, footer);
    },
    uploadImg: async function (input) {
      var file = input.files && input.files[0]; if (!file) return;
      var txt = document.getElementById('ad-img-txt'), prev = document.getElementById('ad-img-prev');
      if (txt) txt.textContent = 'Uploading…';
      try {
        var blob = file, ext = 'jpg', ctype = 'image/jpeg';
        try { blob = await toJpeg(file, 1000, 0.85); } catch (e) { blob = file; ext = (file.name.split('.').pop() || 'jpg').toLowerCase(); ctype = file.type || 'image/jpeg'; }
        var path = Date.now() + '-' + Math.random().toString(16).slice(2, 8) + '.' + ext;
        var up = await sb().storage.from('wga-images').upload(path, blob, { upsert: true, contentType: ctype, cacheControl: '3600' });
        if (up.error) throw up.error;
        var url = sb().storage.from('wga-images').getPublicUrl(path).data.publicUrl;
        var hid = document.getElementById('ad-img'); if (hid) hid.value = url;
        if (prev) { prev.style.background = "#eef2f5 url('" + url + "') center/cover no-repeat"; prev.innerHTML = ''; }
        if (txt) txt.textContent = 'Uploaded ✓ — tap to change';
      } catch (e) { if (txt) txt.textContent = 'Upload failed — try again'; toast(e.message || 'Upload failed', 'error'); }
    },
    submitDest: async function () {
      var name = (document.getElementById('ad-name').value || '').trim();
      if (!name) return toast('Enter a name', 'error');
      var r = await sb().rpc('wga_admin_destination_add', { p_name: name, p_blurb: (document.getElementById('ad-blurb').value || '').trim() || null, p_image: (document.getElementById('ad-img').value || '').trim() || null });
      if (r.error) return toast(r.error.message || 'Failed', 'error');
      if (window.closeModal) closeModal(); toast('Destination added', 'success'); render();
    },
    route: async function (id, on) {
      var r = await sb().rpc('wga_admin_route_toggle', { p_dest: id, p_on: on });
      if (r.error) return toast(r.error.message || 'Failed', 'error');
      toast(on ? 'Added to route' : 'Removed from route', 'success'); render();
    },
    addThing: function () {
      if (typeof window.openModal !== 'function') { alert('Admin modal unavailable on this page.'); return; }
      var fld = 'display:block;width:100%;margin-top:6px;padding:11px 12px;border:1px solid #e7ecf0;border-radius:9px;font:inherit;font-size:14px;box-sizing:border-box;';
      var lbl = 'font-size:12px;font-weight:800;color:#5f6f7d;';
      var body = '<div style="display:flex;flex-direction:column;gap:16px;">' +
        '<label style="' + lbl + '">Experience<input id="at-name" style="' + fld + '" placeholder="Shark cage dive"></label>' +
        '<label style="' + lbl + '">Blurb<input id="at-blurb" style="' + fld + '" placeholder="Face a great white off the coast"></label>' +
        '<div><div style="' + lbl + 'margin-bottom:7px;">Image</div>' +
          '<div onclick="document.getElementById(\'at-img-file\').click()" style="display:flex;align-items:center;gap:12px;border:1px dashed #cfdbe3;border-radius:10px;padding:12px;cursor:pointer;background:#fff;">' +
            '<div id="at-img-prev" style="width:52px;height:52px;border-radius:9px;background:#eef2f5;display:flex;align-items:center;justify-content:center;color:#8a99a8;flex:none;"><span class="material-icons">image</span></div>' +
            '<div id="at-img-txt" style="font-size:13px;font-weight:700;color:#5b6b75;">Tap to upload an image</div></div>' +
          '<input id="at-img-file" type="file" accept="image/*" style="display:none" onchange="AdminWGA.uploadThingImg(this)">' +
          '<input type="hidden" id="at-img" value=""></div>' +
        '</div>';
      window.openModal('Add thing to do', body, '<button class="btn" onclick="closeModal()">Cancel</button><button class="btn" style="background:#1980AD;color:#fff;" onclick="AdminWGA.submitThing()">Add</button>');
    },
    uploadThingImg: async function (input) {
      var file = input.files && input.files[0]; if (!file) return;
      var txt = document.getElementById('at-img-txt'), prev = document.getElementById('at-img-prev');
      if (txt) txt.textContent = 'Uploading…';
      try {
        var blob = file, ext = 'jpg', ctype = 'image/jpeg';
        try { blob = await toJpeg(file, 1000, 0.85); } catch (e) { blob = file; ext = (file.name.split('.').pop() || 'jpg').toLowerCase(); ctype = file.type || 'image/jpeg'; }
        var path = 'thing-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8) + '.' + ext;
        var up = await sb().storage.from('wga-images').upload(path, blob, { upsert: true, contentType: ctype, cacheControl: '3600' });
        if (up.error) throw up.error;
        var url = sb().storage.from('wga-images').getPublicUrl(path).data.publicUrl;
        document.getElementById('at-img').value = url;
        if (prev) { prev.style.background = "#eef2f5 url('" + url + "') center/cover no-repeat"; prev.innerHTML = ''; }
        if (txt) txt.textContent = 'Uploaded ✓ — tap to change';
      } catch (e) { if (txt) txt.textContent = 'Upload failed — try again'; toast(e.message || 'Upload failed', 'error'); }
    },
    submitThing: async function () {
      var name = (document.getElementById('at-name').value || '').trim();
      if (!name) return toast('Enter an experience', 'error');
      var r = await sb().rpc('wga_admin_thing_add', { p_name: name, p_blurb: (document.getElementById('at-blurb').value || '').trim() || null, p_image: (document.getElementById('at-img').value || '').trim() || null });
      if (r.error) return toast(r.error.message || 'Failed', 'error');
      if (window.closeModal) closeModal(); toast('Added', 'success'); render();
    },
    thingDecide: async function (id, approve) {
      if (!approve && !confirm('Remove this experience?')) return;
      var r = await sb().rpc('wga_admin_thing_decide', { p_id: id, p_approve: approve });
      if (r.error) return toast(r.error.message || 'Failed', 'error');
      toast(approve ? 'Approved' : 'Removed', 'success'); render();
    },
    addUpdate: function () {
      if (typeof window.openModal !== 'function') { alert('Admin modal unavailable on this page.'); return; }
      var fld = 'display:block;width:100%;margin-top:6px;padding:11px 12px;border:1px solid #e7ecf0;border-radius:9px;font:inherit;font-size:14px;box-sizing:border-box;';
      var lbl = 'font-size:12px;font-weight:800;color:#5f6f7d;';
      var body = '<div style="display:flex;flex-direction:column;gap:16px;">' +
        '<label style="' + lbl + '">Update text<input id="au-text" style="' + fld + '" placeholder="Cape Town just took the lead 🎉"></label>' +
        '<label style="' + lbl + '">Link (optional, e.g. /explore)<input id="au-link" style="' + fld + '" placeholder="/explore"></label></div>';
      window.openModal('Post tour update', body, '<button class="btn" onclick="closeModal()">Cancel</button><button class="btn" style="background:#1980AD;color:#fff;" onclick="AdminWGA.submitUpdate()">Post</button>');
    },
    submitUpdate: async function () {
      var text = (document.getElementById('au-text').value || '').trim();
      if (!text) return toast('Enter the update', 'error');
      var r = await sb().rpc('wga_admin_update_add', { p_text: text, p_link: (document.getElementById('au-link').value || '').trim() || null });
      if (r.error) return toast(r.error.message || 'Failed', 'error');
      if (window.closeModal) closeModal(); toast('Update posted', 'success'); render();
    },
    removeUpdate: async function (id) {
      if (!confirm('Delete this update?')) return;
      var r = await sb().rpc('wga_admin_update_remove', { p_id: id });
      if (r.error) return toast(r.error.message || 'Failed', 'error');
      toast('Deleted', 'success'); render();
    },
    saveSettings: async function () {
      var goal = document.getElementById('wga-goal').value;
      var round = document.getElementById('wga-round').value;
      var close = document.getElementById('wga-close').value;
      var itin = document.getElementById('wga-itin').value;
      await sb().rpc('wga_settings_set', { p_key: 'vote_goal', p_value: goal });
      await sb().rpc('wga_settings_set', { p_key: 'round_label', p_value: round });
      await sb().rpc('wga_settings_set', { p_key: 'vote_close_at', p_value: close });
      await sb().rpc('wga_settings_set', { p_key: 'itinerary_url', p_value: itin });
      settings.vote_goal = goal; settings.round_label = round; settings.vote_close_at = close; settings.itinerary_url = itin;
      toast('Settings saved', 'success');
    },
    addRoute: function () { AdminWGA.editRoute(null); },
    editRoute: function (id) {
      if (typeof window.openModal !== 'function') { alert('Admin modal unavailable on this page.'); return; }
      var r = id ? (route.filter(function (x) { return x.id === id; })[0] || {}) : {};
      var fld = 'display:block;width:100%;margin-top:6px;padding:11px 12px;border:1px solid #e7ecf0;border-radius:9px;font:inherit;font-size:14px;box-sizing:border-box;';
      var lbl = 'font-size:12px;font-weight:800;color:#5f6f7d;';
      function opt(v, l, cur) { return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + l + '</option>'; }
      var body = '<input type="hidden" id="rt-id" value="' + esc(r.id || '') + '"><div style="display:flex;flex-direction:column;gap:14px;">' +
        '<label style="' + lbl + '">Month label<input id="rt-month" style="' + fld + '" value="' + esc(r.month_label || '') + '" placeholder="Feb 2027"></label>' +
        '<label style="' + lbl + '">Destination<input id="rt-name" style="' + fld + '" value="' + esc(r.name || '') + '" placeholder="Cape Town"></label>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><label style="' + lbl + '">City<input id="rt-city" style="' + fld + '" value="' + esc(r.city || '') + '"></label><label style="' + lbl + '">Country<input id="rt-country" style="' + fld + '" value="' + esc(r.country || '') + '"></label></div>' +
        '<label style="' + lbl + '">Image URL<input id="rt-img" style="' + fld + '" value="' + esc(r.image_url || '') + '" placeholder="https://…"></label>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><label style="' + lbl + '">From<input id="rt-from" type="date" style="' + fld + '" value="' + esc(r.date_from || '') + '"></label><label style="' + lbl + '">To<input id="rt-to" type="date" style="' + fld + '" value="' + esc(r.date_to || '') + '"></label></div>' +
        '<label style="' + lbl + '">Status<select id="rt-status" style="' + fld + '">' + opt('confirmed', 'Confirmed', r.status || 'confirmed') + opt('voting', 'Voting now', r.status) + opt('tbd', 'TBD', r.status) + '</select></label></div>';
      window.openModal(id ? 'Edit stop' : 'Add stop', body, '<button class="btn" onclick="closeModal()">Cancel</button><button class="btn" style="background:#1980AD;color:#fff;" onclick="AdminWGA.submitRoute()">Save</button>');
    },
    submitRoute: async function () {
      var id = (document.getElementById('rt-id').value || '') || null;
      var p = { month_label: v('rt-month'), name: v('rt-name'), city: v('rt-city'), country: v('rt-country'), image_url: v('rt-img'), date_from: v('rt-from') || null, date_to: v('rt-to') || null, status: v('rt-status') };
      if (!p.name) return toast('Enter a destination', 'error');
      var r = await sb().rpc('wga_admin_route_save', { p_id: id, p: p });
      if (r.error) return toast(r.error.message || 'Failed', 'error');
      if (window.closeModal) closeModal(); toast('Saved', 'success'); render();
    },
    removeRoute: async function (id) {
      if (!confirm('Delete this stop?')) return;
      var r = await sb().rpc('wga_admin_route_remove', { p_id: id });
      if (r.error) return toast(r.error.message || 'Failed', 'error');
      toast('Deleted', 'success'); render();
    }
  };
  function v(id) { var e = document.getElementById(id); return e ? (e.value || '').trim() : ''; }

  render();
})();

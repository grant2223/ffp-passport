/* FFP Admin — Giveaways. Partner-provided prizes (admin-loaded, linked to a provider). Passport-only;
   members earn entries by being active during the window. Create/edit a giveaway (partner, prize, image,
   dates, status, eligibility: location radius or global, visitors-only, gender, age), draw a winner, delete.
   Depends on window.supabase (authed via JWT header) + openModal/closeModal/showToast + is_admin RPCs
   admin_giveaways_list / admin_giveaway_save / admin_giveaway_delete / admin_giveaway_draw. Renders into #giveaways-body. */
(function () {
  var sb = function () { return window.supabase; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var toast = function (m, k) { if (window.showToast) showToast(m, k || 'info'); };
  function fmtDate(s) { try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function toLocalInput(s) { if (!s) return ''; try { var d = new Date(s); var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); } catch (e) { return ''; } }

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
    return '<div style="flex:1;min-width:120px;background:#fff;border:1px solid #eef2f5;border-radius:12px;padding:14px 16px;">' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#8a99a8;">' + esc(label) + '</div>' +
      '<div style="font-size:22px;font-weight:900;color:' + (color || '#12232f') + ';margin-top:4px;">' + val + '</div></div>';
  }

  var rows = [];
  var editing = null;   // giveaway being edited (or null for new)

  async function loadAll() {
    try {
      var s = sb(); if (!s) { rows = []; return; }
      var r = await s.rpc('admin_giveaways_list');
      rows = (r && !r.error && Array.isArray(r.data)) ? r.data : [];
    } catch (e) { console.error('[Giveaways] loadAll:', e); rows = []; }
  }

  function statusPill(s) {
    var map = { draft: ['#fff3d6', '#9a6a00', 'DRAFT'], open: ['#e3f6ec', '#1e9e63', 'OPEN'], drawn: ['#e8eef4', '#4a6072', 'DRAWN'], cancelled: ['#fbe7e6', '#c0392b', 'CANCELLED'] };
    var m = map[s] || map.draft;
    return '<span style="background:' + m[0] + ';color:' + m[1] + ';font-size:10px;font-weight:900;padding:2px 8px;border-radius:100px;">' + m[2] + '</span>';
  }

  function crit(g) {
    var bits = [];
    bits.push(g.location_mode === 'global' ? 'Worldwide' : ('Within ' + (g.radius_km || 50) + ' km'));
    if (g.visitors_only) bits.push('Visitors only');
    if (g.gender) bits.push(g.gender);
    if (g.min_age || g.max_age) bits.push('Age ' + (g.min_age || '') + '–' + (g.max_age || ''));
    return bits.join(' · ');
  }

  function row(g) {
    var canDraw = g.status === 'open';
    return '<tr style="border-bottom:1px solid #f1f4f6;">' +
      '<td style="padding:11px 12px;">' +
        '<div style="display:flex;align-items:center;gap:11px;">' +
          '<div style="width:46px;height:46px;border-radius:9px;flex:none;background:#eef2f5 ' + (g.image_url ? "url('" + esc(g.image_url) + "') center/cover no-repeat" : '') + ';"></div>' +
          '<div><div style="font-weight:800;color:#12232f;">' + esc(g.prize || g.title) + ' ' + statusPill(g.status) + '</div>' +
          '<div style="font-size:12px;font-weight:600;color:#8a99a8;margin-top:2px;">' + esc(g.provider_name || 'No partner') + ' · ' + esc(crit(g)) + '</div></div>' +
        '</div></td>' +
      '<td style="padding:11px 12px;text-align:center;font-size:13px;color:#5b6b75;">' + fmtDate(g.starts_at) + ' → ' + fmtDate(g.draw_at) + '</td>' +
      '<td style="padding:11px 12px;text-align:center;font-weight:900;color:#1980AD;">' + (g.entrants || 0) + '</td>' +
      '<td style="padding:11px 12px;text-align:center;font-weight:700;color:#12232f;">' + (g.winner ? esc(g.winner) : '—') + '</td>' +
      '<td style="padding:11px 12px;text-align:right;white-space:nowrap;">' +
        (canDraw ? '<button onclick="AdminGiveaways.draw(\'' + g.id + '\')" style="padding:7px 12px;border:none;background:#1e9e75;color:#fff;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Draw</button> ' : '') +
        '<button onclick="AdminGiveaways.edit(\'' + g.id + '\')" style="padding:7px 12px;border:none;background:#eef2f5;color:#12232f;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Edit</button> ' +
        '<button onclick="AdminGiveaways.remove(\'' + g.id + '\')" style="padding:7px 10px;border:none;background:#fbe7e6;color:#c0392b;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Delete</button>' +
      '</td></tr>';
  }

  async function render() {
    var el = document.getElementById('giveaways-body');
    if (!el) return;
    el.innerHTML = '<div style="padding:20px;color:#8a99a8;">Loading…</div>';
    await loadAll();
    var open = rows.filter(function (g) { return g.status === 'open'; }).length;
    var drawn = rows.filter(function (g) { return g.status === 'drawn'; }).length;
    var kpis = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
      kpi('Total', rows.length) + kpi('Live', open, '#1e9e63') + kpi('Drawn', drawn, '#4a6072') + '</div>';
    var head = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<div style="font-size:13px;font-weight:700;color:#5b6b75;">Partner giveaways — Passport members only. Members earn entries by staying active.</div>' +
      '<button onclick="AdminGiveaways.create()" style="padding:10px 16px;border:none;background:#1980AD;color:#fff;border-radius:9px;font-weight:800;cursor:pointer;">+ New giveaway</button></div>';
    var table = rows.length === 0
      ? '<div style="padding:30px;text-align:center;color:#8a99a8;">No giveaways yet — create one and link it to a partner.</div>'
      : '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eef2f5;border-radius:12px;overflow:hidden;">' +
        '<thead><tr style="background:#f7f9fb;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#8a99a8;">' +
        '<th style="padding:10px 12px;">Prize · partner · who</th><th style="padding:10px 12px;text-align:center;">Window</th><th style="padding:10px 12px;text-align:center;">Entrants</th><th style="padding:10px 12px;text-align:center;">Winner</th><th style="padding:10px 12px;"></th></tr></thead>' +
        '<tbody>' + rows.map(row).join('') + '</tbody></table></div>';
    el.innerHTML = kpis + head + table;
  }

  function form(g) {
    g = g || {};
    var fld = 'display:block;width:100%;margin-top:6px;padding:11px 12px;border:1px solid #e7ecf0;border-radius:9px;font:inherit;font-size:14px;box-sizing:border-box;';
    var lbl = 'font-size:12px;font-weight:800;color:#5f6f7d;';
    var w = g.entry_weights || { optin: 1, activity: 1, checkin: 2, referral: 5 };
    return '<div style="display:flex;flex-direction:column;gap:15px;">' +
      '<label style="' + lbl + '">Partner<div style="position:relative;">' +
        '<input id="gw-prov-q" style="' + fld + '" placeholder="Search a partner…" value="' + esc(g.provider_name || '') + '" oninput="AdminGiveaways.searchProv(this.value)" autocomplete="off">' +
        '<input type="hidden" id="gw-prov" value="' + esc(g.provider_id || '') + '">' +
        '<div id="gw-prov-opts" style="position:absolute;left:0;right:0;top:100%;z-index:5;background:#fff;border:1px solid #e7ecf0;border-radius:9px;margin-top:3px;box-shadow:0 8px 20px rgba(15,34,48,.12);display:none;max-height:200px;overflow:auto;"></div>' +
      '</div></label>' +
      '<label style="' + lbl + '">Prize name<input id="gw-prize" style="' + fld + '" placeholder="WHOOP 4.0 + 12-month membership" value="' + esc(g.prize || g.title || '') + '"></label>' +
      '<div style="display:flex;gap:12px;">' +
        '<label style="' + lbl + 'flex:1;">Value (optional, $)<input id="gw-value" type="number" style="' + fld + '" placeholder="360" value="' + (g.prize_value != null ? g.prize_value : '') + '"></label>' +
        '<label style="' + lbl + 'flex:1;">Status<select id="gw-status" style="' + fld + '">' +
          ['draft', 'open', 'drawn', 'cancelled'].map(function (s) { return '<option value="' + s + '"' + ((g.status || 'draft') === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
      '</div>' +
      '<label style="' + lbl + '">Description<textarea id="gw-desc" rows="3" style="' + fld + '" placeholder="What they win + why it matters">' + esc(g.description || '') + '</textarea></label>' +
      '<div><div style="' + lbl + 'margin-bottom:7px;">Prize image</div>' +
        '<div onclick="document.getElementById(\'gw-img-file\').click()" style="display:flex;align-items:center;gap:12px;border:1px dashed #cfdbe3;border-radius:10px;padding:12px;cursor:pointer;background:#fff;">' +
          '<div id="gw-img-prev" style="width:52px;height:52px;border-radius:9px;flex:none;background:#eef2f5 ' + (g.image_url ? "url('" + esc(g.image_url) + "') center/cover no-repeat" : '') + ';display:flex;align-items:center;justify-content:center;color:#8a99a8;">' + (g.image_url ? '' : '<span class="material-icons">image</span>') + '</div>' +
          '<div id="gw-img-txt" style="font-size:13px;font-weight:700;color:#5b6b75;">' + (g.image_url ? 'Uploaded ✓ — tap to change' : 'Tap to upload an image') + '</div>' +
        '</div>' +
        '<input id="gw-img-file" type="file" accept="image/*" style="display:none" onchange="AdminGiveaways.uploadImg(this)">' +
        '<input type="hidden" id="gw-img" value="' + esc(g.image_url || '') + '">' +
      '</div>' +
      '<div style="display:flex;gap:12px;">' +
        '<label style="' + lbl + 'flex:1;">Opens<input id="gw-starts" type="datetime-local" style="' + fld + '" value="' + toLocalInput(g.starts_at) + '"></label>' +
        '<label style="' + lbl + 'flex:1;">Draw date<input id="gw-draw" type="datetime-local" style="' + fld + '" value="' + toLocalInput(g.draw_at) + '"></label>' +
      '</div>' +
      '<div style="border-top:1px solid #eef2f5;padding-top:13px;"><div style="' + lbl + 'margin-bottom:9px;">Who can enter <span style="font-weight:600;color:#8a99a8;">(Passport members only, always)</span></div>' +
        '<div style="display:flex;gap:12px;">' +
          '<label style="' + lbl + 'flex:1;">Location<select id="gw-locmode" style="' + fld + '" onchange="AdminGiveaways.toggleRadius()">' +
            '<option value="radius"' + ((g.location_mode || 'radius') === 'radius' ? ' selected' : '') + '>Near the partner</option>' +
            '<option value="global"' + (g.location_mode === 'global' ? ' selected' : '') + '>Worldwide</option></select></label>' +
          '<label style="' + lbl + 'flex:1;" id="gw-radwrap">Radius (km)<input id="gw-radius" type="number" style="' + fld + '" value="' + (g.radius_km || 50) + '"></label>' +
        '</div>' +
        '<div style="display:flex;gap:12px;margin-top:12px;">' +
          '<label style="' + lbl + 'flex:1;">Gender<select id="gw-gender" style="' + fld + '">' +
            '<option value="">Any</option>' +
            '<option value="Male"' + (g.gender === 'Male' ? ' selected' : '') + '>Male</option>' +
            '<option value="Female"' + (g.gender === 'Female' ? ' selected' : '') + '>Female</option></select></label>' +
          '<label style="' + lbl + 'flex:1;">Min age<input id="gw-minage" type="number" style="' + fld + '" value="' + (g.min_age != null ? g.min_age : '') + '"></label>' +
          '<label style="' + lbl + 'flex:1;">Max age<input id="gw-maxage" type="number" style="' + fld + '" value="' + (g.max_age != null ? g.max_age : '') + '"></label>' +
        '</div>' +
        '<label style="display:flex;align-items:center;gap:9px;margin-top:12px;font-size:13px;font-weight:700;color:#5b6b75;cursor:pointer;">' +
          '<input type="checkbox" id="gw-visitors" ' + (g.visitors_only ? 'checked' : '') + ' style="width:18px;height:18px;">Only members who have checked in at this partner</label>' +
      '</div>' +
      '<div style="border-top:1px solid #eef2f5;padding-top:13px;"><div style="' + lbl + 'margin-bottom:9px;">Entries per action <span style="font-weight:600;color:#8a99a8;">(more active = better odds)</span></div>' +
        '<div style="display:flex;gap:12px;">' +
          '<label style="' + lbl + 'flex:1;">Activity<input id="gw-w-act" type="number" style="' + fld + '" value="' + (w.activity != null ? w.activity : 1) + '"></label>' +
          '<label style="' + lbl + 'flex:1;">Check-in<input id="gw-w-chk" type="number" style="' + fld + '" value="' + (w.checkin != null ? w.checkin : 2) + '"></label>' +
          '<label style="' + lbl + 'flex:1;">Referral<input id="gw-w-ref" type="number" style="' + fld + '" value="' + (w.referral != null ? w.referral : 5) + '"></label>' +
        '</div></div>' +
      '</div>';
  }

  window.AdminGiveaways = {
    refresh: render,
    create: function () {
      if (typeof window.openModal !== 'function') { alert('Admin modal unavailable on this page.'); return; }
      editing = null;
      window.openModal('New giveaway', form(null),
        '<button class="btn" onclick="closeModal()">Cancel</button><button class="btn" style="background:#1980AD;color:#fff;" onclick="AdminGiveaways.save()">Save</button>');
      setTimeout(this.toggleRadius, 30);
    },
    edit: function (id) {
      editing = rows.find(function (g) { return g.id === id; }) || null;
      if (!editing) return;
      window.openModal('Edit giveaway', form(editing),
        '<button class="btn" onclick="closeModal()">Cancel</button><button class="btn" style="background:#1980AD;color:#fff;" onclick="AdminGiveaways.save()">Save</button>');
      setTimeout(this.toggleRadius, 30);
    },
    toggleRadius: function () {
      var m = document.getElementById('gw-locmode'), w = document.getElementById('gw-radwrap');
      if (m && w) w.style.display = (m.value === 'global') ? 'none' : '';
    },
    searchProv: async function (q) {
      var box = document.getElementById('gw-prov-opts'); if (!box) return;
      document.getElementById('gw-prov').value = '';   // typing clears the locked pick until re-selected
      q = (q || '').trim();
      if (q.length < 2) { box.style.display = 'none'; return; }
      var r = await sb().from('providers').select('id,business_name,city').ilike('business_name', '%' + q + '%').limit(8);
      var list = (r && !r.error && r.data) ? r.data : [];
      if (!list.length) { box.innerHTML = '<div style="padding:10px 12px;color:#8a99a8;font-size:13px;">No partners found</div>'; box.style.display = 'block'; return; }
      box.innerHTML = list.map(function (p) {
        return '<div onclick="AdminGiveaways.pickProv(\'' + p.id + '\',\'' + esc((p.business_name || '').replace(/'/g, ' ')) + '\')" style="padding:10px 12px;cursor:pointer;font-size:14px;border-bottom:1px solid #f1f4f6;">' + esc(p.business_name) + (p.city ? ' <span style="color:#8a99a8;font-size:12px;">· ' + esc(p.city) + '</span>' : '') + '</div>';
      }).join('');
      box.style.display = 'block';
    },
    pickProv: function (id, name) {
      document.getElementById('gw-prov').value = id;
      document.getElementById('gw-prov-q').value = name;
      var box = document.getElementById('gw-prov-opts'); if (box) box.style.display = 'none';
    },
    uploadImg: async function (input) {
      var file = input.files && input.files[0]; if (!file) return;
      var txt = document.getElementById('gw-img-txt'), prev = document.getElementById('gw-img-prev');
      if (txt) txt.textContent = 'Uploading…';
      try {
        var blob = file, ext = 'jpg', ctype = 'image/jpeg';
        try { blob = await toJpeg(file, 1200, 0.85); } catch (e) { blob = file; ext = (file.name.split('.').pop() || 'jpg').toLowerCase(); ctype = file.type || 'image/jpeg'; }
        var path = Date.now() + '-' + Math.random().toString(16).slice(2, 8) + '.' + ext;
        var up = await sb().storage.from('giveaway-images').upload(path, blob, { upsert: true, contentType: ctype, cacheControl: '3600' });
        if (up.error) throw up.error;
        var url = sb().storage.from('giveaway-images').getPublicUrl(path).data.publicUrl;
        document.getElementById('gw-img').value = url;
        if (prev) { prev.style.background = "#eef2f5 url('" + url + "') center/cover no-repeat"; prev.innerHTML = ''; }
        if (txt) txt.textContent = 'Uploaded ✓ — tap to change';
      } catch (e) { if (txt) txt.textContent = 'Upload failed — try again'; toast(e.message || 'Upload failed', 'error'); }
    },
    save: async function () {
      var val = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
      var prize = val('gw-prize').trim();
      var draw = val('gw-draw');
      if (!prize) return toast('Enter a prize name', 'error');
      if (!draw) return toast('Set a draw date', 'error');
      var p = {
        provider_id: val('gw-prov') || null,
        title: prize, prize: prize,
        prize_value: val('gw-value') || null,
        image_url: val('gw-img') || null,
        description: val('gw-desc').trim() || null,
        starts_at: val('gw-starts') ? new Date(val('gw-starts')).toISOString() : null,
        draw_at: new Date(draw).toISOString(),
        status: val('gw-status') || 'draft',
        location_mode: val('gw-locmode') || 'radius',
        radius_km: val('gw-radius') || 50,
        visitors_only: !!(document.getElementById('gw-visitors') && document.getElementById('gw-visitors').checked),
        gender: val('gw-gender') || null,
        min_age: val('gw-minage') || null,
        max_age: val('gw-maxage') || null,
        entry_weights: { optin: 1, activity: Number(val('gw-w-act') || 1), checkin: Number(val('gw-w-chk') || 2), referral: Number(val('gw-w-ref') || 5) }
      };
      var r = await sb().rpc('admin_giveaway_save', { p_id: editing ? editing.id : null, p: p });
      if (r.error) return toast(r.error.message || 'Save failed', 'error');
      if (window.closeModal) closeModal();
      toast('Giveaway saved', 'success'); render();
    },
    draw: async function (id) {
      if (!confirm('Draw a winner now? This closes the giveaway and cannot be undone.')) return;
      var r = await sb().rpc('admin_giveaway_draw', { p_id: id });
      if (r.error) return toast(r.error.message || 'Draw failed', 'error');
      if (r.data && r.data.error === 'no_entrants') return toast('No eligible entrants to draw from', 'error');
      toast('Winner: ' + ((r.data && r.data.winner_name) || 'drawn'), 'success'); render();
    },
    remove: async function (id) {
      if (!confirm('Delete this giveaway? This removes it and all its entries.')) return;
      var r = await sb().rpc('admin_giveaway_delete', { p_id: id });
      if (r.error) return toast(r.error.message || 'Delete failed', 'error');
      toast('Deleted', 'success'); render();
    }
  };

  async function boot() {
    var t = 0;
    while (!window.supabase && t < 100) { await new Promise(function (r) { setTimeout(r, 100); }); t++; }
    try { await render(); } catch (e) { console.error('[Giveaways] boot render:', e); var el = document.getElementById('giveaways-body'); if (el) el.innerHTML = '<div style="padding:24px;color:#c0392b;">Could not load giveaways. Reload the page.</div>'; }
  }
  document.addEventListener('ffp-admin-ready', function () { boot(); });
  boot();
})();

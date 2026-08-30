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
      // hard timeout so the panel can NEVER hang on "Loading…" if the request stalls
      var r = await Promise.race([
        s.rpc('admin_giveaways_list'),
        new Promise(function (res) { setTimeout(function () { res({ error: { message: 'timeout' } }); }, 8000); })
      ]);
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

  var COLS = 'grid-template-columns:1fr 150px 90px 120px 190px;';
  function row(g) {
    var chip = { open: 'ax-c-open', draft: 'ax-c-draft', drawn: 'ax-c-drawn', cancelled: 'ax-c-cancel' }[g.status] || 'ax-c-draft';
    var canDraw = g.status === 'open';
    return '<div class="ax-grow" style="' + COLS + '">' +
      '<div style="display:flex;align-items:center;gap:13px;min-width:0;">' +
        '<span style="width:46px;height:46px;border-radius:11px;flex:none;background:#0a1620 ' + (g.image_url ? "url('" + esc(g.image_url) + "') center/cover no-repeat" : '') + ';box-shadow:0 4px 12px rgba(0,0,0,.35);"></span>' +
        '<div style="min-width:0;"><b style="font-size:14px;font-weight:800;color:#eaf1f6;">' + esc(g.prize || g.title) + ' <span class="ax-chip ' + chip + '">' + String(g.status || '').toUpperCase() + '</span></b>' +
        '<div style="font-size:11.5px;color:#8aa0ad;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(g.provider_name || 'No partner') + ' · ' + esc(crit(g)) + '</div></div></div>' +
      '<div style="font-size:12.5px;color:#8aa0ad;font-weight:600;">' + fmtDate(g.starts_at) + ' → ' + fmtDate(g.draw_at) + '</div>' +
      '<div style="font-size:16px;font-weight:900;color:#2b9fd0;">' + (g.entrants || 0) + '</div>' +
      '<div style="font-size:13px;font-weight:700;color:#eaf1f6;">' + (g.winner ? esc(g.winner) : '—') + '</div>' +
      '<div style="display:flex;gap:7px;justify-content:flex-end;">' +
        (canDraw ? '<button class="ax-a draw" onclick="AdminGiveaways.draw(\'' + g.id + '\')">Draw</button>' : '') +
        '<button class="ax-a edit" onclick="AdminGiveaways.edit(\'' + g.id + '\')">Edit</button>' +
        '<button class="ax-a del" onclick="AdminGiveaways.remove(\'' + g.id + '\')">Delete</button></div>' +
    '</div>';
  }

  async function render() {
    var el = document.getElementById('giveaways-body');
    for (var i = 0; i < 40 && !el; i++) { await new Promise(function (r) { setTimeout(r, 100); }); el = document.getElementById('giveaways-body'); }
    if (!el) return;
    el.innerHTML = '<div style="padding:20px;color:#8aa0ad;">Loading…</div>';
    await loadAll();
    var open = rows.filter(function (g) { return g.status === 'open'; }).length;
    var drawn = rows.filter(function (g) { return g.status === 'drawn'; }).length;
    var ent = rows.reduce(function (s, g) { return s + (g.entrants || 0); }, 0);
    var stats = '<div class="ax-stats"><div class="hero"><div class="n live">' + open + '</div><div class="k">Live now</div></div><div class="sep"></div>' +
      '<div class="s"><div class="n">' + rows.length + '</div><div class="k">Total</div></div>' +
      '<div class="s"><div class="n">' + drawn + '</div><div class="k">Drawn</div></div>' +
      '<div class="s"><div class="n">' + ent + '</div><div class="k">Entrants</div></div></div>';
    var head = '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">' +
      '<div style="flex:1;font-size:13px;font-weight:600;color:#8aa0ad;">Partner giveaways — Passport members only. Members earn entries by staying active.</div>' +
      '<button class="ax-btn gold" onclick="AdminGiveaways.create()"><span class="material-icons">add</span>New giveaway</button></div>';
    var list = rows.length === 0
      ? '<div style="padding:34px;text-align:center;color:#8aa0ad;">No giveaways yet — create one and link it to a partner.</div>'
      : '<div class="ax-lhead" style="' + COLS + '"><span>Prize · partner</span><span>Window</span><span>Entrants</span><span>Winner</span><span></span></div>' + rows.map(row).join('');
    el.innerHTML = stats + head + list;
  }

  function form(g) {
    g = g || {};
    var w = g.entry_weights || { optin: 1, activity: 1, checkin: 2, referral: 5 };
    var opt = function (v, cur) { return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + (v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Any') + '</option>'; };
    return '' +
      '<div class="ax-sec"><h4>Prize &amp; partner</h4>' +
        '<div class="ax-f"><label>Partner</label>' +
          '<input id="gw-prov-q" class="ax-in" placeholder="Search a partner…" value="' + esc(g.provider_name || '') + '" oninput="AdminGiveaways.searchProv(this.value)" autocomplete="off">' +
          '<input type="hidden" id="gw-prov" value="' + esc(g.provider_id || '') + '">' +
          '<div id="gw-prov-opts" class="ax-pres" style="display:none;top:100%;max-height:220px;overflow:auto;"></div></div>' +
        '<div class="ax-f"><label>Prize name</label><input id="gw-prize" class="ax-in" placeholder="WHOOP 4.0 + 12-month membership" value="' + esc(g.prize || g.title || '') + '"></div>' +
        '<div class="ax-f2"><div class="ax-f"><label>Value ($)</label><input id="gw-value" type="number" class="ax-in" placeholder="360" value="' + (g.prize_value != null ? g.prize_value : '') + '"></div>' +
          '<div class="ax-f"><label>Status</label><select id="gw-status" class="ax-in">' + ['draft', 'open', 'drawn', 'cancelled'].map(function (s) { return opt(s, g.status || 'draft'); }).join('') + '</select></div></div>' +
        '<div class="ax-f"><label>Description</label><textarea id="gw-desc" rows="3" class="ax-in" placeholder="What they win + why it matters">' + esc(g.description || '') + '</textarea></div>' +
        '<div class="ax-f"><label>Prize image</label>' +
          '<div class="ax-drop" onclick="document.getElementById(\'gw-img-file\').click()"><span id="gw-img-prev" class="pv" style="' + (g.image_url ? "background-image:url('" + esc(g.image_url) + "')" : '') + '">' + (g.image_url ? '' : '<span class="material-icons">image</span>') + '</span><b id="gw-img-txt">' + (g.image_url ? 'Uploaded ✓ — tap to change' : 'Tap to upload an image') + '</b></div>' +
          '<input id="gw-img-file" type="file" accept="image/*" style="display:none" onchange="AdminGiveaways.uploadImg(this)"><input type="hidden" id="gw-img" value="' + esc(g.image_url || '') + '"></div>' +
      '</div>' +
      '<div class="ax-sec"><h4>Included</h4>' +
        '<div class="ax-f"><label>What\'s included</label><textarea id="gw-included" rows="3" class="ax-in" placeholder="e.g. WHOOP 4.0 band · 12-month membership · free shipping — one per line">' + esc(g.included || '') + '</textarea></div></div>' +
      '<div class="ax-sec"><h4>Window</h4>' +
        '<div class="ax-f2"><div class="ax-f"><label>Opens</label><input id="gw-starts" type="datetime-local" class="ax-in" value="' + toLocalInput(g.starts_at) + '"></div>' +
          '<div class="ax-f"><label>Draw date</label><input id="gw-draw" type="datetime-local" class="ax-in" value="' + toLocalInput(g.draw_at) + '"></div></div>' +
      '</div>' +
      '<div class="ax-sec"><h4>Who can enter <span style="text-transform:none;letter-spacing:0;color:#5f7482;font-weight:600">· Passport members only</span></h4>' +
        '<div class="ax-f2"><div class="ax-f"><label>Location</label><select id="gw-locmode" class="ax-in" onchange="AdminGiveaways.toggleRadius()"><option value="radius"' + ((g.location_mode || 'radius') === 'radius' ? ' selected' : '') + '>Near the partner</option><option value="global"' + (g.location_mode === 'global' ? ' selected' : '') + '>Worldwide</option></select></div>' +
          '<div class="ax-f" id="gw-radwrap"><label>Radius (km)</label><input id="gw-radius" type="number" class="ax-in" value="' + (g.radius_km || 50) + '"></div></div>' +
        '<div class="ax-f3"><div class="ax-f"><label>Gender</label><select id="gw-gender" class="ax-in"><option value="">Any</option><option value="Male"' + (g.gender === 'Male' ? ' selected' : '') + '>Male</option><option value="Female"' + (g.gender === 'Female' ? ' selected' : '') + '>Female</option></select></div>' +
          '<div class="ax-f"><label>Min age</label><input id="gw-minage" type="number" class="ax-in" value="' + (g.min_age != null ? g.min_age : '') + '"></div>' +
          '<div class="ax-f"><label>Max age</label><input id="gw-maxage" type="number" class="ax-in" value="' + (g.max_age != null ? g.max_age : '') + '"></div></div>' +
        '<label class="ax-check"><input type="checkbox" id="gw-visitors" ' + (g.visitors_only ? 'checked' : '') + '>Only members who have checked in at this partner</label>' +
      '</div>' +
      '<div class="ax-sec"><h4>Entries per action <span style="text-transform:none;letter-spacing:0;color:#5f7482;font-weight:600">· more active = better odds</span></h4>' +
        '<div class="ax-f3"><div class="ax-f"><label>Activity</label><input id="gw-w-act" type="number" class="ax-in" value="' + (w.activity != null ? w.activity : 1) + '"></div>' +
          '<div class="ax-f"><label>Check-in</label><input id="gw-w-chk" type="number" class="ax-in" value="' + (w.checkin != null ? w.checkin : 2) + '"></div>' +
          '<div class="ax-f"><label>Referral</label><input id="gw-w-ref" type="number" class="ax-in" value="' + (w.referral != null ? w.referral : 5) + '"></div></div>' +
      '</div>' +
      '<div class="ax-sec"><h4>Terms &amp; conditions</h4>' +
        '<div class="ax-f"><label>Terms members must accept</label><textarea id="gw-terms" rows="4" class="ax-in" placeholder="Eligibility, how the winner is drawn &amp; contacted, prize claim window, any exclusions…">' + esc(g.terms || '') + '</textarea></div></div>';
  }

  window.AdminGiveaways = {
    refresh: render,
    create: function () {
      var open = window.openSheet || window.openModal;
      if (typeof open !== 'function') { alert('Admin sheet unavailable on this page.'); return; }
      editing = null;
      open('New giveaway', form(null),
        '<button class="ax-btn ghost" onclick="closeSheet()">Cancel</button><button class="ax-btn blue" onclick="AdminGiveaways.save()"><span class="material-icons">check</span>Save giveaway</button>');
      setTimeout(this.toggleRadius, 30);
    },
    edit: function (id) {
      editing = rows.find(function (g) { return g.id === id; }) || null;
      if (!editing) return;
      (window.openSheet || window.openModal)('Edit giveaway', form(editing),
        '<button class="ax-btn ghost" onclick="closeSheet()">Cancel</button><button class="ax-btn blue" onclick="AdminGiveaways.save()"><span class="material-icons">check</span>Save giveaway</button>');
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
        return '<div onclick="AdminGiveaways.pickProv(\'' + p.id + '\',\'' + esc((p.business_name || '').replace(/'/g, ' ')) + '\')" style="padding:10px 12px;cursor:pointer;font-size:14px;font-weight:600;color:#eaf1f6;border-bottom:1px solid rgba(255,255,255,.08);">' + esc(p.business_name) + (p.city ? ' <span style="color:#8aa0ad;font-size:12px;font-weight:500;">· ' + esc(p.city) + '</span>' : '') + '</div>';
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
        included: val('gw-included').trim() || null,
        terms: val('gw-terms').trim() || null,
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
      if (window.closeSheet) closeSheet(); else if (window.closeModal) closeModal();
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

  // Wait for BOTH the supabase client AND the admin session (JWT/FFP_ADMIN) — admin_giveaways_list
  // is is_admin()-gated, so firing before auth is attached returns [] and the panel looks empty.
  function adminReady() { return window.supabase && (window.FFP_ADMIN || (window.FFPAuth && FFPAuth.getJwt && FFPAuth.getJwt())); }
  async function boot() {
    for (var i = 0; i < 80 && !adminReady(); i++) { await new Promise(function (r) { setTimeout(r, 100); }); }
    try { await render(); }
    catch (e) { console.error('[Giveaways] boot render:', e); var el = document.getElementById('giveaways-body'); if (el) el.innerHTML = '<div style="padding:24px;color:#c0392b;">Could not load giveaways. Reload the page.</div>'; }
  }
  document.addEventListener('ffp-admin-ready', function () { boot(); });
  boot();
})();

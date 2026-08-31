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

  // Menu of trackable FFP actions a giveaway can award entries for [key, label, default points]. All auto-verified.
  var EARN_ACTIONS = [
    ['activity', 'Log an activity', 1], ['checkin', 'Check in at a partner', 2], ['referral', 'Refer a friend', 5],
    ['event', 'Attend an event', 0], ['quest', 'Complete a quest task', 0], ['meetup', 'Host a meetup', 0],
    ['connection', 'Make a connection', 0], ['comment', 'Comment on the feed', 0], ['high_five', 'Give a High Five', 0]
  ];

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
    if (g.location_mode === 'global') bits.push('Worldwide');
    else if (g.location_mode === 'city') bits.push('In ' + (g.city || 'a city'));
    else if (g.location_mode === 'country') bits.push('In ' + (g.country || 'a country'));
    else bits.push('Within ' + (g.radius_km || 50) + ' km');
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
        '<div style="font-size:11.5px;color:#8aa0ad;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(g.provider_name || 'No partner') + ' · ' + esc(crit(g)) + (g.interim_enabled ? ' · <span style="color:#e6b23c;">★ ' + (g.finalist_count || 0) + ' finalist' + ((g.finalist_count || 0) === 1 ? '' : 's') + ' · every ' + (g.interim_every || 1) + ' ' + (g.interim_unit || 'day') + ((g.interim_every || 1) === 1 ? '' : 's') + '</span>' : '') + '</div></div></div>' +
      '<div style="font-size:12.5px;color:#8aa0ad;font-weight:600;">' + fmtDate(g.starts_at) + ' → ' + fmtDate(g.draw_at) + '</div>' +
      '<div style="font-size:16px;font-weight:900;color:#2b9fd0;">' + (g.entrants || 0) + '</div>' +
      '<div style="font-size:13px;font-weight:700;color:#eaf1f6;">' + (g.winner ? esc(g.winner) : '—') + '</div>' +
      '<div style="display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap;">' +
        (g.interim_enabled ? '<button class="ax-a" onclick="AdminGiveaways.viewFinalists(\'' + g.id + '\')">Finalists</button>' : '') +
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
        '<div class="ax-f"><label>Partner <span style="text-transform:none;letter-spacing:0;color:#5f7482;font-weight:600">· real FFP partners only — leave blank for a Find Fit People giveaway</span></label>' +
          '<input id="gw-prov-q" class="ax-in" placeholder="Search a claimed partner…" value="' + esc(g.provider_name || '') + '" oninput="AdminGiveaways.searchProv(this.value)" autocomplete="off">' +
          '<input type="hidden" id="gw-prov" value="' + esc(g.provider_id || '') + '">' +
          '<div id="gw-prov-opts" class="ax-pres" style="display:none;top:100%;max-height:220px;overflow:auto;"></div>' +
          '<button type="button" class="ax-btn ghost" style="margin-top:8px;" onclick="AdminGiveaways.ffpGiveaway()">Find Fit People giveaway — no partner</button></div>' +
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
      '<div class="ax-sec"><h4>Finalist draws <span style="text-transform:none;letter-spacing:0;color:#5f7482;font-weight:600">· optional recurring draws before the final</span></h4>' +
        '<label class="ax-check"><input type="checkbox" id="gw-intr" ' + (g.interim_enabled ? 'checked' : '') + ' onchange="AdminGiveaways.toggleInterim()">Run recurring finalist draws</label>' +
        '<div id="gw-intr-wrap" style="' + (g.interim_enabled ? '' : 'display:none') + '">' +
          '<div class="ax-f3"><div class="ax-f"><label>Every</label><input id="gw-intr-every" type="number" min="1" class="ax-in" value="' + (g.interim_every || 1) + '"></div>' +
            '<div class="ax-f"><label>Period</label><select id="gw-intr-unit" class="ax-in"><option value="day"' + ((g.interim_unit || 'day') === 'day' ? ' selected' : '') + '>Days</option><option value="week"' + (g.interim_unit === 'week' ? ' selected' : '') + '>Weeks</option></select></div>' +
            '<div class="ax-f"><label>Finalists each</label><input id="gw-intr-n" type="number" min="1" class="ax-in" value="' + (g.interim_finalists || 1) + '"></div></div>' +
          '<div style="font-size:12px;color:#8aa0ad;font-weight:600;margin-top:2px;">Each draw picks finalists at random from members who met the entry requirements that period (e.g. logged an activity that day). The final winner is drawn from all finalists. Runs automatically each night — you can also run it manually from the giveaway row.</div>' +
        '</div></div>' +
      '<div class="ax-sec"><h4>Who can enter <span style="text-transform:none;letter-spacing:0;color:#5f7482;font-weight:600">· Passport members only</span></h4>' +
        '<div class="ax-f2"><div class="ax-f"><label>Location</label><select id="gw-locmode" class="ax-in" onchange="AdminGiveaways.toggleRadius()">' +
            '<option value="radius"' + ((g.location_mode || 'radius') === 'radius' ? ' selected' : '') + '>Near the partner</option>' +
            '<option value="global"' + (g.location_mode === 'global' ? ' selected' : '') + '>Worldwide</option>' +
            '<option value="city"' + (g.location_mode === 'city' ? ' selected' : '') + '>In a city</option>' +
            '<option value="country"' + (g.location_mode === 'country' ? ' selected' : '') + '>In a country</option></select></div>' +
          '<div class="ax-f" id="gw-radwrap"><label>Radius (km)</label><input id="gw-radius" type="number" class="ax-in" value="' + (g.radius_km || 50) + '"></div>' +
          '<div class="ax-f" id="gw-citywrap" style="display:none"><label>City</label><input id="gw-city" class="ax-in" placeholder="e.g. Dubai" value="' + esc(g.city || '') + '"></div>' +
          '<div class="ax-f" id="gw-countrywrap" style="display:none"><label>Country</label><input id="gw-country" class="ax-in" list="gw-country-list" placeholder="e.g. United Arab Emirates" value="' + esc(g.country || '') + '"><datalist id="gw-country-list"></datalist></div></div>' +
        '<div class="ax-f3"><div class="ax-f"><label>Gender</label><select id="gw-gender" class="ax-in"><option value="">Any</option><option value="Male"' + (g.gender === 'Male' ? ' selected' : '') + '>Male</option><option value="Female"' + (g.gender === 'Female' ? ' selected' : '') + '>Female</option></select></div>' +
          '<div class="ax-f"><label>Min age</label><input id="gw-minage" type="number" class="ax-in" value="' + (g.min_age != null ? g.min_age : '') + '"></div>' +
          '<div class="ax-f"><label>Max age</label><input id="gw-maxage" type="number" class="ax-in" value="' + (g.max_age != null ? g.max_age : '') + '"></div></div>' +
        '<label class="ax-check"><input type="checkbox" id="gw-visitors" ' + (g.visitors_only ? 'checked' : '') + '>Only members who have checked in at this partner</label>' +
      '</div>' +
      '<div class="ax-sec"><h4>How they earn entries <span style="text-transform:none;letter-spacing:0;color:#5f7482;font-weight:600">· entering = 1 point · set points per action (0 = off)</span></h4>' +
        '<div class="ax-f3">' + EARN_ACTIONS.map(function (a) { var v = (w[a[0]] != null ? w[a[0]] : a[2]); return '<div class="ax-f"><label>' + a[1] + '</label><input id="gw-w-' + a[0] + '" type="number" min="0" class="ax-in" value="' + v + '"></div>'; }).join('') + '</div>' +
      '</div>' +
      '<div class="ax-sec"><h4>Terms &amp; conditions</h4>' +
        '<div class="ax-f"><label>Terms members must accept</label><textarea id="gw-terms" rows="4" class="ax-in" placeholder="Eligibility, how the winner is drawn &amp; contacted, prize claim window, any exclusions…">' + esc(g.terms || '') + '</textarea></div></div>' +
      '<div class="ax-sec"><h4>Sponsors <span style="text-transform:none;letter-spacing:0;color:#5f7482;font-weight:600">· title sponsor + partners</span></h4>' +
        (g.id ? '<div id="gw-spon"></div>' : '<div style="color:#8aa0ad;font-size:12.5px;font-weight:600;">Save the giveaway first — then add its sponsors here.</div>') + '</div>';
  }

  // --- Sponsor editor (reused shape: title banner + partner logos) ---
  async function sponUpload(input, cb) {
    var file = input.files && input.files[0]; if (!file) return;
    try {
      var blob = file, ext = 'jpg', ctype = 'image/jpeg';
      try { blob = await toJpeg(file, 1400, 0.86); } catch (e) { blob = file; ext = (file.name.split('.').pop() || 'jpg').toLowerCase(); ctype = file.type || 'image/jpeg'; }
      var path = 'giveaway/' + Date.now() + '-' + Math.random().toString(16).slice(2, 8) + '.' + ext;
      var up = await sb().storage.from('event-sponsors').upload(path, blob, { upsert: true, contentType: ctype, cacheControl: '3600' });
      if (up.error) throw up.error;
      cb(sb().storage.from('event-sponsors').getPublicUrl(path).data.publicUrl);
    } catch (e) { toast(e.message || 'Upload failed', 'error'); }
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
      var self = this;
      setTimeout(function () { self.toggleRadius(); self.renderSponsors(id); }, 30);
    },
    renderSponsors: async function (id) {
      var el = document.getElementById('gw-spon'); if (!el) return;
      var r = await sb().rpc('event_sponsors_list', { p_scope: 'giveaway', p_event: id });
      var list = (r && !r.error && r.data) ? r.data : [];
      var list_html = list.length ? list.map(function (s) {
        var tierChip = s.tier === 'title'
          ? '<span class="ax-chip" style="background:#3a2f10;color:#e6b23c;">TITLE</span>'
          : '<span class="ax-chip" style="background:#12313f;color:#7fb8d6;">PARTNER</span>';
        return '<div class="ax-grow" style="grid-template-columns:1fr 120px;">' +
          '<div style="display:flex;align-items:center;gap:12px;min-width:0;"><span style="width:44px;height:44px;border-radius:10px;flex:none;background:#fff ' + (s.logo_url ? "url('" + esc(s.logo_url) + "') center/contain no-repeat" : '') + ';"></span>' +
          '<div style="min-width:0;"><b style="color:#eaf1f6;font-size:14px;font-weight:800;">' + esc(s.name || 'Sponsor') + ' ' + tierChip + '</b>' + (s.link_url ? '<div style="font-size:11.5px;color:#8aa0ad;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(s.link_url) + '</div>' : '') + '</div></div>' +
          '<div style="text-align:right;"><button class="ax-a del" onclick="AdminGiveaways.sponRemove(\'' + s.id + '\',\'' + id + '\')">Remove</button></div></div>';
      }).join('') : '<div style="padding:14px 2px;color:#8aa0ad;font-size:12.5px;">No sponsors yet.</div>';
      el.innerHTML = list_html +
        '<div class="ax-sec" style="border:none;padding-top:12px;">' +
          '<div class="ax-drop" onclick="document.getElementById(\'spon-img-file\').click()"><span id="spon-img-prev" class="pv"><span class="material-icons">add_photo_alternate</span></span><b id="spon-img-txt">Tap to upload logo / banner</b></div>' +
          '<input id="spon-img-file" type="file" accept="image/*" style="display:none" onchange="AdminGiveaways.sponImg(this)"><input type="hidden" id="spon-img">' +
          '<div class="ax-f3" style="margin-top:10px;"><div class="ax-f"><label>Name</label><input id="spon-name" class="ax-in" placeholder="Sponsor name"></div>' +
            '<div class="ax-f"><label>Tier</label><select id="spon-tier" class="ax-in"><option value="partner">Official partner</option><option value="title">Title sponsor</option></select></div>' +
            '<div class="ax-f"><label>Link (optional)</label><input id="spon-link" class="ax-in" placeholder="https://…"></div></div>' +
          '<button class="ax-btn gold" style="margin-top:10px;" onclick="AdminGiveaways.sponAdd(\'' + id + '\')"><span class="material-icons">add</span>Add sponsor</button>' +
        '</div>';
    },
    sponImg: function (input) {
      var txt = document.getElementById('spon-img-txt'), prev = document.getElementById('spon-img-prev');
      if (txt) txt.textContent = 'Uploading…';
      sponUpload(input, function (url) {
        var h = document.getElementById('spon-img'); if (h) h.value = url;
        if (prev) { prev.style.background = "#fff url('" + url + "') center/contain no-repeat"; prev.innerHTML = ''; }
        if (txt) txt.textContent = 'Uploaded ✓ — tap to change';
      });
    },
    sponAdd: async function (id) {
      var v = function (x) { var e = document.getElementById(x); return e ? e.value.trim() : ''; };
      var name = v('spon-name'), logo = v('spon-img');
      if (!name && !logo) return toast('Add a sponsor name or logo', 'error');
      var r = await sb().rpc('event_sponsor_save', { p_scope: 'giveaway', p_event: id, p_id: null, p: { name: name || null, logo_url: logo || null, link_url: v('spon-link') || null, tier: v('spon-tier') || 'partner' } });
      if (r.error) return toast(r.error.message || 'Save failed', 'error');
      toast('Sponsor added', 'success'); this.renderSponsors(id);
    },
    sponRemove: async function (sid, id) {
      var r = await sb().rpc('event_sponsor_remove', { p_id: sid });
      if (r.error) return toast(r.error.message || 'Remove failed', 'error');
      this.renderSponsors(id);
    },
    toggleRadius: function () {
      var m = document.getElementById('gw-locmode'); if (!m) return;
      var v = m.value;
      var set = function (id, on) { var e = document.getElementById(id); if (e) e.style.display = on ? '' : 'none'; };
      set('gw-radwrap', v === 'radius');
      set('gw-citywrap', v === 'city');
      set('gw-countrywrap', v === 'country');
      if (v === 'country') AdminGiveaways.loadCountries();
    },
    _countries: null,
    loadCountries: async function () {
      var dl = document.getElementById('gw-country-list'); if (!dl) return;
      try {
        if (!AdminGiveaways._countries) {
          var r = await sb().from('taxonomy_items').select('label').eq('list_key', 'country').eq('active', true).order('label');
          AdminGiveaways._countries = (r && !r.error && r.data) ? r.data.map(function (x) { return x.label; }) : [];
        }
        dl.innerHTML = AdminGiveaways._countries.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
      } catch (e) { /* datalist is optional — free text still works */ }
    },
    toggleInterim: function () {
      var c = document.getElementById('gw-intr'), w = document.getElementById('gw-intr-wrap');
      if (c && w) w.style.display = c.checked ? '' : 'none';
    },
    runInterim: async function (id) {
      var r = await sb().rpc('admin_giveaway_interim_run', { p_id: id });
      if (r.error) return toast(r.error.message || 'Draw failed', 'error');
      if (r.data && r.data.error) return toast(r.data.error === 'interim_disabled' ? 'Turn on finalist draws first' : r.data.error, 'error');
      toast('Ran ' + ((r.data && r.data.periods) || 0) + ' draw(s) · ' + ((r.data && r.data.finalists) || 0) + ' finalist(s) added', 'success');
      render();
    },
    viewFinalists: async function (id) {
      var r = await sb().rpc('admin_giveaway_finalists', { p_id: id });
      var list = (r && !r.error && r.data) ? r.data : [];
      var body = list.length
        ? '<div class="ax-sec">' + list.map(function (f) {
            return '<div class="ax-grow" style="grid-template-columns:1fr 160px;">' +
              '<div style="display:flex;align-items:center;gap:12px;min-width:0;"><span style="width:38px;height:38px;border-radius:50%;flex:none;background:#0a1620 ' + (f.photo ? "url('" + esc(f.photo) + "') center/cover no-repeat" : '') + ';"></span><b style="color:#eaf1f6;font-weight:700;font-size:14px;">' + esc(f.name || 'Member') + '</b></div>' +
              '<div style="color:#8aa0ad;font-weight:600;font-size:12.5px;">' + fmtDate(f.period_start) + '</div></div>';
          }).join('') + '</div>'
        : '<div style="padding:34px;text-align:center;color:#8aa0ad;">No finalists drawn yet. Run the draw to pick this period’s finalists.</div>';
      (window.openSheet || window.openModal)('Finalists (' + list.length + ')', body,
        '<button class="ax-btn ghost" onclick="closeSheet()">Close</button><button class="ax-btn blue" onclick="AdminGiveaways.runInterim(\'' + id + '\')"><span class="material-icons">casino</span>Run draws now</button>');
    },
    searchProv: async function (q) {
      var box = document.getElementById('gw-prov-opts'); if (!box) return;
      document.getElementById('gw-prov').value = '';   // typing clears the locked pick until re-selected
      q = (q || '').trim();
      if (q.length < 2) { box.style.display = 'none'; return; }
      // Only REAL partners (a claimed FFP account) — never the scraped directory.
      var r = await sb().from('providers').select('id,business_name,city').not('owner_user_id', 'is', null).ilike('business_name', '%' + q + '%').limit(8);
      var list = (r && !r.error && r.data) ? r.data : [];
      if (!list.length) { box.innerHTML = '<div style="padding:10px 12px;color:#8a99a8;font-size:13px;">No real partners found — only claimed FFP partners can be linked. Leave blank for a Find Fit People giveaway.</div>'; box.style.display = 'block'; return; }
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
    ffpGiveaway: function () {   // FFP (us) can list unlimited giveaways with no partner attached
      var h = document.getElementById('gw-prov'); if (h) h.value = '';
      var q = document.getElementById('gw-prov-q'); if (q) q.value = '';
      var box = document.getElementById('gw-prov-opts'); if (box) box.style.display = 'none';
      toast('Find Fit People giveaway — no partner linked', 'info');
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
        city: val('gw-city').trim() || null,
        country: val('gw-country').trim() || null,
        visitors_only: !!(document.getElementById('gw-visitors') && document.getElementById('gw-visitors').checked),
        gender: val('gw-gender') || null,
        min_age: val('gw-minage') || null,
        max_age: val('gw-maxage') || null,
        entry_weights: (function () { var o = { optin: 1 }; EARN_ACTIONS.forEach(function (a) { o[a[0]] = Number(val('gw-w-' + a[0]) || 0); }); return o; })(),
        interim_enabled: !!(document.getElementById('gw-intr') && document.getElementById('gw-intr').checked),
        interim_unit: val('gw-intr-unit') || 'day',
        interim_every: Number(val('gw-intr-every') || 1),
        interim_finalists: Number(val('gw-intr-n') || 1)
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

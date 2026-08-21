/* FFP Admin — Explore Banners loader (v3)
   Self-injects a sidebar link + panel + full CRUD for the app's promo banners.
   Table: explore_banners (title, subtitle, cta_label, link, image_url, city, placement, active, sort_order).
   v3 (2026-08-21): (a) DESTINATION PICKER — quick page chips (Explore home/Classes/Experiences/Events/
       Trips/Offers) + a partner search that fills the link with /provider/<id>, so admins don't type raw
       URLs. (b) PLACEMENT targeting — "Show it on" select (Explore & Home / Explore only / Home only),
       new `placement` column; the FFP App filters banners by it (explore_home RPC = explore/both, Home
       feed HomeBanner = home/both). "Shows on" column added to the table.
   Loaded directly (not lazy) so it can inject its own nav link + panel on page load. */
(function () {
  'use strict';
  var TABLE = 'explore_banners';
  function esc(s) { if (window.escHtml) return window.escHtml(s); return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(m, k) { if (window.showToast) { try { window.showToast(m, k || 'info'); return; } catch (e) {} } try { console.log('[Banners]', m); } catch (e) {} }
  function waitFor(cond, ms) { var t = 0, l = Math.ceil((ms || 30000) / 100); return new Promise(function (res) { (function tick() { var ok = false; try { ok = cond(); } catch (e) {} if (ok || t >= l) return res(ok); t++; setTimeout(tick, 100); })(); }); }

  var Banners = {
    data: [],
    async load() {
      try {
        var r = await window.supabase.from(TABLE).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
        if (r.error) { toast('Load failed: ' + r.error.message, 'error'); return; }
        this.data = r.data || []; this.render();
      } catch (e) { toast('Load error', 'error'); }
    },
    render() {
      var b = document.getElementById('banners-tbody'); if (!b) return;
      if (!this.data.length) { b.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#8a9aa4;padding:26px;">No banners yet — tap “Add banner”.</td></tr>'; return; }
      var placeLbl = function (pl) { return pl === 'explore' ? 'Explore' : (pl === 'home' ? 'Home' : 'Explore & Home'); };
      b.innerHTML = this.data.map(function (d) {
        return '<tr>' +
          '<td><strong>' + esc(d.title || '(image banner)') + '</strong><div style="font-size:11px;color:#8a9aa4;margin-top:2px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(d.subtitle || '') + '</div></td>' +
          '<td>' + esc(d.city || 'All') + '</td>' +
          '<td><span class="ffp-bplace">' + placeLbl(d.placement || 'both') + '</span></td>' +
          '<td>' + esc(d.cta_label || '') + '</td>' +
          '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#5b6b75;">' + esc(d.link || '') + '</td>' +
          '<td><span class="ffp-bpill' + (d.active ? ' on' : '') + '">' + (d.active ? 'Active' : 'Off') + '</span></td>' +
          '<td style="white-space:nowrap;text-align:right;">' +
            '<button class="btn btn-sm btn-ghost" onclick="AdminBanners.toggle(\'' + d.id + '\')" title="' + (d.active ? 'Turn off' : 'Turn on') + '"><span class="material-icons">' + (d.active ? 'toggle_on' : 'toggle_off') + '</span></button>' +
            '<button class="btn btn-sm btn-ghost" onclick="AdminBanners.edit(\'' + d.id + '\')" title="Edit"><span class="material-icons">edit</span></button>' +
            '<button class="btn btn-sm btn-danger" onclick="AdminBanners.del(\'' + d.id + '\')" title="Delete"><span class="material-icons">delete</span></button>' +
          '</td></tr>';
      }).join('');
    },
    add() { this.openForm(null); },
    edit(id) { this.openForm(this.data.find(function (x) { return x.id === id; }) || null); },
    openForm(d) {
      d = d || {}; var isNew = !d.id;
      function fld(label, id, val, type, opt) { return '<label class="ffp-bfld"><span>' + label + (opt ? ' <em class="ffp-bopt">Optional</em>' : '') + '</span><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val) + '"></label>'; }
      var ov = document.createElement('div'); ov.className = 'ffp-bmodal'; ov.id = 'ffp-bmodal';
      ov.innerHTML = '<div class="ffp-bmodal-card"><div class="ffp-bmodal-h"><h3>' + (isNew ? 'Add banner' : 'Edit banner') + '</h3><button class="btn btn-sm btn-ghost" onclick="AdminBanners.close()"><span class="material-icons">close</span></button></div>' +
        '<div class="ffp-bmodal-b">' +
          fld('Headline', 'b_title', d.title || '', 'text', true) +
          fld('Subtitle', 'b_subtitle', d.subtitle || '', 'text', true) +
          fld('Button label', 'b_cta', d.cta_label || '', 'text', true) +
          '<div class="ffp-bfld"><span>Where it links <em class="ffp-bopt">Optional</em></span>' +
            '<input id="b_link" type="text" value="' + esc(d.link || '') + '" placeholder="/provider/123 or /explore/sessions">' +
            '<div class="ffp-bquick">' +
              [['Explore home', '/explore'], ['Classes', '/explore/sessions'], ['Experiences', '/explore/experiences'], ['Events', '/explore/events'], ['Trips', '/explore/trips'], ['Offers', '/passport/offers']]
                .map(function (q) { return '<button type="button" class="ffp-bqchip" onclick="AdminBanners.setLink(\'' + q[1] + '\')">' + q[0] + '</button>'; }).join('') +
            '</div>' +
            '<div class="ffp-bprov"><input id="b_provq" placeholder="…or search a partner to link to its page" oninput="AdminBanners.searchProv(this.value)"><div id="b_provres" class="ffp-bprovres"></div></div>' +
          '</div>' +
          '<div class="ffp-bfld"><span>Banner image</span>' +
            '<input type="hidden" id="b_image" value="' + esc(d.image_url || '') + '">' +
            '<div class="ffp-bup">' +
              '<div class="ffp-bup-prev" id="b_image_prev"' + (d.image_url ? ' style="background-image:url(\'' + esc(d.image_url) + '\')"' : '') + '></div>' +
              '<div class="ffp-bup-side">' +
                '<button type="button" class="btn btn-sm btn-blue" onclick="document.getElementById(\'b_image_file\').click()"><span class="material-icons">upload</span>Upload image</button>' +
                '<button type="button" class="btn btn-sm btn-ghost" id="b_image_rm" onclick="AdminBanners.clearImage()"' + (d.image_url ? '' : ' style="display:none"') + '>Remove</button>' +
                '<div class="ffp-bup-hint">JPG or PNG · under 5MB · shown on the Explore promo card</div>' +
              '</div>' +
              '<input type="file" id="b_image_file" accept="image/*" style="display:none" onchange="AdminBanners.uploadImage(this)">' +
            '</div>' +
          '</div>' +
          fld('City (blank = all cities)', 'b_city', d.city || '', 'text', true) +
          '<div class="ffp-bfld"><span>Show it on</span><select id="b_placement" class="ffp-bsel">' +
            ['both:Explore & Home', 'explore:Explore home only', 'home:Home feed only'].map(function (o) { var v = o.split(':')[0], l = o.split(':')[1]; return '<option value="' + v + '"' + (((d.placement || 'both') === v) ? ' selected' : '') + '>' + l + '</option>'; }).join('') +
          '</select></div>' +
          fld('Sort order (lower = first)', 'b_sort', (d.sort_order != null ? d.sort_order : 0), 'number') +
          '<label class="ffp-bck"><input type="checkbox" id="b_active" ' + ((d.active == null || d.active) ? 'checked' : '') + '> Active (visible in the app)</label>' +
        '</div>' +
        '<div class="ffp-bmodal-f"><button class="btn btn-ghost" onclick="AdminBanners.close()">Cancel</button><button class="btn btn-blue" onclick="AdminBanners.save(' + (isNew ? 'null' : '\'' + d.id + '\'') + ')"><span class="material-icons">save</span>Save</button></div>' +
        '</div>';
      document.body.appendChild(ov);
    },
    close() { var m = document.getElementById('ffp-bmodal'); if (m) m.remove(); },
    async uploadImage(input) {
      var file = input && input.files && input.files[0]; if (!file) return;
      if (!/^image\//.test(file.type)) { toast('Please choose an image file', 'error'); input.value = ''; return; }
      if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); input.value = ''; return; }
      var prev = document.getElementById('b_image_prev');
      if (prev) prev.classList.add('loading');
      try {
        var ext = (String(file.name).split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        var path = 'explore-banners/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        var up = await window.supabase.storage.from('site-images').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
        if (up.error) throw up.error;
        var pub = window.supabase.storage.from('site-images').getPublicUrl(path);
        var url = (pub && pub.data && pub.data.publicUrl) ? pub.data.publicUrl : '';
        if (!url) throw new Error('No public URL returned');
        var h = document.getElementById('b_image'); if (h) h.value = url;
        if (prev) { prev.style.backgroundImage = "url('" + url + "')"; prev.classList.remove('loading'); }
        var rm = document.getElementById('b_image_rm'); if (rm) rm.style.display = '';
        toast('Image uploaded');
      } catch (e) { if (prev) prev.classList.remove('loading'); toast('Upload failed: ' + (e.message || ''), 'error'); }
      finally { input.value = ''; }
    },
    clearImage() {
      var h = document.getElementById('b_image'); if (h) h.value = '';
      var prev = document.getElementById('b_image_prev'); if (prev) prev.style.backgroundImage = '';
      var rm = document.getElementById('b_image_rm'); if (rm) rm.style.display = 'none';
    },
    async save(id) {
      var g = function (i) { var e = document.getElementById(i); return e ? String(e.value).trim() : ''; };
      var placeSel = document.getElementById('b_placement');
      var row = { title: g('b_title') || null, subtitle: g('b_subtitle') || null, cta_label: g('b_cta') || null, link: g('b_link') || null, image_url: g('b_image') || null, city: g('b_city') || null, placement: (placeSel && placeSel.value) || 'both', sort_order: parseInt(g('b_sort') || '0', 10) || 0, active: !!document.getElementById('b_active').checked, updated_at: new Date().toISOString() };
      if (!row.title && !row.image_url) { toast('Add a headline or an image', 'error'); return; }
      try {
        var r = id ? await window.supabase.from(TABLE).update(row).eq('id', id) : await window.supabase.from(TABLE).insert(row);
        if (r.error) throw r.error;
        toast('Saved'); this.close(); this.load();
      } catch (e) { toast('Save failed: ' + (e.message || ''), 'error'); }
    },
    async toggle(id) {
      var d = this.data.find(function (x) { return x.id === id; }); if (!d) return;
      try { var r = await window.supabase.from(TABLE).update({ active: !d.active, updated_at: new Date().toISOString() }).eq('id', id); if (r.error) throw r.error; this.load(); } catch (e) { toast('Update failed', 'error'); }
    },
    async del(id) {
      if (!window.confirm('Delete this banner? This cannot be undone.')) return;
      try { var r = await window.supabase.from(TABLE).delete().eq('id', id); if (r.error) throw r.error; toast('Deleted'); this.load(); } catch (e) { toast('Delete failed', 'error'); }
    },
    // Destination picker — quick pages + a partner search that fills the link with /provider/<id>.
    setLink(url) { var l = document.getElementById('b_link'); if (l) l.value = url; },
    async searchProv(q) {
      q = String(q || '').trim(); var box = document.getElementById('b_provres'); if (!box) return;
      if (q.length < 2) { box.innerHTML = ''; return; }
      try {
        var r = await window.supabase.from('providers').select('id,business_name,city').ilike('business_name', '%' + q + '%').eq('status', 'approved').limit(6);
        var rows = (r && r.data) || [];
        box.innerHTML = rows.length ? rows.map(function (p) {
          return '<button type="button" class="ffp-bprovitem" onclick="AdminBanners.pickProv(\'' + p.id + '\',\'' + esc(p.business_name).replace(/'/g, '&#39;') + '\')">' + esc(p.business_name) + '<small>' + esc(p.city || '') + '</small></button>';
        }).join('') : '<div class="ffp-bprovnone">No matches</div>';
      } catch (e) { box.innerHTML = ''; }
    },
    pickProv(id, name) {
      this.setLink('/provider/' + id);
      var box = document.getElementById('b_provres'); if (box) box.innerHTML = '';
      var q = document.getElementById('b_provq'); if (q) q.value = name;
      toast('Linked to ' + name);
    }
  };
  window.AdminBanners = Banners;

  function injectCss() {
    if (document.getElementById('ffp-banners-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-banners-css';
    s.textContent = '#panel-banners .ffp-bhead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap;}' +
      '.ffp-bpill{font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;background:#eef2f5;color:#5b6b75;}.ffp-bpill.on{background:#e3f6ec;color:#0a8f5f;}' +
      '.ffp-bmodal{position:fixed;inset:0;background:rgba(10,20,30,.5);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;}' +
      '.ffp-bmodal-card{background:#fff;border-radius:14px;width:100%;max-width:460px;max-height:92vh;overflow:auto;box-shadow:0 24px 60px rgba(10,30,45,.4);}' +
      '.ffp-bmodal-h{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #eef1f4;}' +
      '.ffp-bmodal-h h3{margin:0;font-size:18px;color:#12232f;font-weight:800;}' +
      '.ffp-bmodal-b{padding:16px 18px;}' +
      '.ffp-bfld{display:block;margin-bottom:13px;}.ffp-bfld span{display:block;font-size:12px;font-weight:700;color:#12232f;margin-bottom:5px;}' +
      '.ffp-bopt{display:inline-block;font-style:normal;font-size:9.5px;font-weight:800;color:#8a9aa4;background:#eef2f5;border-radius:6px;padding:2px 6px;margin-left:6px;text-transform:uppercase;letter-spacing:.4px;vertical-align:middle;}' +
      '.ffp-bfld input{width:100%;border:1px solid #d7dee4;border-radius:9px;padding:11px 12px;font:inherit;font-size:14px;box-sizing:border-box;color:#12232f;}' +
      '.ffp-bck{display:flex;align-items:center;gap:9px;font-weight:700;font-size:14px;margin-top:6px;color:#12232f;}' +
      '.ffp-bup{display:flex;gap:12px;align-items:stretch;}' +
      '.ffp-bup-prev{flex:none;width:120px;height:74px;border-radius:10px;background:#eef2f5 center/cover no-repeat;border:1px solid #d7dee4;position:relative;}' +
      '.ffp-bup-prev.loading::after{content:"Uploading…";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#5b6b75;background:rgba(238,242,245,.85);border-radius:10px;}' +
      '.ffp-bup-side{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:7px;justify-content:center;}' +
      '.ffp-bup-hint{font-size:11px;color:#8a9aa4;}' +
      '.ffp-bsel{width:100%;border:1px solid #d7dee4;border-radius:9px;padding:11px 12px;font:inherit;font-size:14px;box-sizing:border-box;color:#12232f;background:#fff;}' +
      '.ffp-bplace{font-size:11px;font-weight:700;color:#3b5566;background:#eef4f8;border-radius:6px;padding:3px 8px;white-space:nowrap;}' +
      '.ffp-bquick{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}' +
      '.ffp-bqchip{font-size:11.5px;font-weight:700;color:#1980ad;background:#eef4f8;border:1px solid #d7e5ee;border-radius:999px;padding:5px 11px;cursor:pointer;}' +
      '.ffp-bqchip:hover{background:#e2eef5;}' +
      '.ffp-bprov{position:relative;margin-top:8px;}' +
      '.ffp-bprov input{width:100%;border:1px solid #d7dee4;border-radius:9px;padding:10px 12px;font:inherit;font-size:13.5px;box-sizing:border-box;color:#12232f;}' +
      '.ffp-bprovres{margin-top:4px;display:flex;flex-direction:column;gap:3px;}' +
      '.ffp-bprovitem{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;text-align:left;background:#f6f9fb;border:1px solid #e6edf2;border-radius:8px;padding:8px 11px;font:inherit;font-size:13px;font-weight:700;color:#12232f;cursor:pointer;}' +
      '.ffp-bprovitem:hover{background:#eaf2f7;}' +
      '.ffp-bprovitem small{font-weight:600;color:#8a9aa4;}' +
      '.ffp-bprovnone{font-size:12px;color:#8a9aa4;padding:6px 2px;}' +
      '.ffp-bmodal-f{padding:14px 18px;border-top:1px solid #eef1f4;display:flex;justify-content:flex-end;gap:10px;}';
    document.head.appendChild(s);
  }
  function injectUi() {
    var nav = document.querySelector('.sidebar-nav');
    if (nav && !document.querySelector('.sidebar-link[data-panel="panel-banners"]')) {
      var a = document.createElement('a'); a.className = 'sidebar-link'; a.setAttribute('data-panel', 'panel-banners'); a.setAttribute('onclick', "App.go('panel-banners')");
      a.innerHTML = '<span class="material-icons">campaign</span>Explore banners';
      nav.appendChild(a);
    }
    var anyPanel = document.querySelector('.panel');
    if (anyPanel && !document.getElementById('panel-banners')) {
      var sec = document.createElement('section'); sec.className = 'panel'; sec.id = 'panel-banners';
      sec.innerHTML = '<div class="ffp-bhead"><div><h1 style="margin:0;font-size:24px;">Explore banners</h1><p style="margin:5px 0 0;color:#8a9aa4;font-size:13px;max-width:520px;">The promotional card shown on the app’s Explore home. Add a brand promo, set which city it shows in, and toggle it on or off — changes are live instantly, no deploy.</p></div>' +
        '<button class="btn btn-blue" onclick="AdminBanners.add()"><span class="material-icons">add</span>Add banner</button></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Banner</th><th>City</th><th>Shows on</th><th>Button</th><th>Link</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead><tbody id="banners-tbody"></tbody></table></div>';
      anyPanel.parentNode.appendChild(sec);
    }
    try { if (window.App && App.panelNames) App.panelNames['panel-banners'] = 'Explore banners'; } catch (e) {}
  }
  async function init() {
    await waitFor(function () { return window.supabase && document.querySelector('.sidebar-nav') && document.querySelector('.panel') && window.App; }, 30000);
    injectCss(); injectUi();
    // The banner list is RLS-protected server-side and authed via the stored JWT header, so it does NOT
    // need to wait for window.FFP_ADMIN (which was costing up to 30s). Load as soon as the client is ready.
    Banners.load();
    try { console.log('[FFP Admin Banners v2] loaded ✓'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

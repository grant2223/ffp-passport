/* FFP Admin — Explore Banners loader (v1)
   Self-injects a sidebar link + panel + full CRUD for the app's Explore promo card.
   Table: explore_banners (title, subtitle, cta_label, link, image_url, city, active, sort_order).
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
      if (!this.data.length) { b.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#8a9aa4;padding:26px;">No banners yet — tap “Add banner”.</td></tr>'; return; }
      b.innerHTML = this.data.map(function (d) {
        return '<tr>' +
          '<td><strong>' + esc(d.title) + '</strong><div style="font-size:11px;color:#8a9aa4;margin-top:2px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(d.subtitle || '') + '</div></td>' +
          '<td>' + esc(d.city || 'All') + '</td>' +
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
      function fld(label, id, val, type) { return '<label class="ffp-bfld"><span>' + label + '</span><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val) + '"></label>'; }
      var ov = document.createElement('div'); ov.className = 'ffp-bmodal'; ov.id = 'ffp-bmodal';
      ov.innerHTML = '<div class="ffp-bmodal-card"><div class="ffp-bmodal-h"><h3>' + (isNew ? 'Add banner' : 'Edit banner') + '</h3><button class="btn btn-sm btn-ghost" onclick="AdminBanners.close()"><span class="material-icons">close</span></button></div>' +
        '<div class="ffp-bmodal-b">' +
          fld('Headline', 'b_title', d.title || '') +
          fld('Subtitle', 'b_subtitle', d.subtitle || '') +
          fld('Button label', 'b_cta', d.cta_label || 'Learn more') +
          fld('Link (e.g. /provider/123 or /explore/sessions)', 'b_link', d.link || '') +
          fld('Image URL (optional)', 'b_image', d.image_url || '') +
          fld('City (blank = all cities)', 'b_city', d.city || '') +
          fld('Sort order (lower = first)', 'b_sort', (d.sort_order != null ? d.sort_order : 0), 'number') +
          '<label class="ffp-bck"><input type="checkbox" id="b_active" ' + ((d.active == null || d.active) ? 'checked' : '') + '> Active (visible in the app)</label>' +
        '</div>' +
        '<div class="ffp-bmodal-f"><button class="btn btn-ghost" onclick="AdminBanners.close()">Cancel</button><button class="btn btn-blue" onclick="AdminBanners.save(' + (isNew ? 'null' : '\'' + d.id + '\'') + ')"><span class="material-icons">save</span>Save</button></div>' +
        '</div>';
      document.body.appendChild(ov);
    },
    close() { var m = document.getElementById('ffp-bmodal'); if (m) m.remove(); },
    async save(id) {
      var g = function (i) { var e = document.getElementById(i); return e ? String(e.value).trim() : ''; };
      var row = { title: g('b_title'), subtitle: g('b_subtitle') || null, cta_label: g('b_cta') || null, link: g('b_link') || null, image_url: g('b_image') || null, city: g('b_city') || null, sort_order: parseInt(g('b_sort') || '0', 10) || 0, active: !!document.getElementById('b_active').checked, updated_at: new Date().toISOString() };
      if (!row.title) { toast('Headline is required', 'error'); return; }
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
      '.ffp-bmodal-h h3{margin:0;font-size:18px;}' +
      '.ffp-bmodal-b{padding:16px 18px;}' +
      '.ffp-bfld{display:block;margin-bottom:13px;}.ffp-bfld span{display:block;font-size:12px;font-weight:700;color:#5b6b75;margin-bottom:5px;}' +
      '.ffp-bfld input{width:100%;border:1px solid #d7dee4;border-radius:9px;padding:11px 12px;font:inherit;font-size:14px;box-sizing:border-box;}' +
      '.ffp-bck{display:flex;align-items:center;gap:9px;font-weight:700;font-size:14px;margin-top:6px;}' +
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
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Banner</th><th>City</th><th>Button</th><th>Link</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead><tbody id="banners-tbody"></tbody></table></div>';
      anyPanel.parentNode.appendChild(sec);
    }
    try { if (window.App && App.panelNames) App.panelNames['panel-banners'] = 'Explore banners'; } catch (e) {}
  }
  async function init() {
    await waitFor(function () { return window.supabase && document.querySelector('.sidebar-nav') && document.querySelector('.panel') && window.App; }, 30000);
    await waitFor(function () { return !!window.FFP_ADMIN; }, 30000);
    injectCss(); injectUi(); Banners.load();
    try { console.log('[FFP Admin Banners v1] loaded ✓'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* FFP Admin — Offers (BOGO) management.
   Admin adds/manages offers for partners NOT listed on the site (external), and can pause/delete
   any offer (partner-created ones included). Self-contained: depends on window.supabase,
   window.FFP_ADMIN, openModal/closeModal, showToast. Renders into #offers-list on load. */
(function () {
  var sb = function () { return window.supabase; };
  var adminId = function () { return window.FFP_ADMIN && window.FFP_ADMIN.id; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var editingId = null;

  var inputCss = 'width:100%;padding:10px 12px;border:1px solid #d7dee5;border-radius:10px;font:inherit;box-sizing:border-box;background:#fff;';
  function field(label, inner, hint) {
    return '<div style="margin-bottom:12px;"><label style="display:block;font-size:12px;font-weight:700;color:#43525c;margin-bottom:5px;">' + esc(label) + '</label>' + inner + (hint ? '<div style="font-size:11px;color:#8a99a8;margin-top:4px;">' + esc(hint) + '</div>' : '') + '</div>';
  }
  function inp(id, ph, type, val) { return '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '" style="' + inputCss + '">'; }
  function ta(id, ph, val) { return '<textarea id="' + id + '" placeholder="' + esc(ph || '') + '" rows="2" style="' + inputCss + ';resize:vertical">' + esc(val || '') + '</textarea>'; }
  function val(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; }

  // Offer categories come from the admin-editable taxonomy (list_key='offer_category').
  var CATS = [];
  function loadCats() {
    try { sb().from('taxonomy_items').select('value,label,sort_order').eq('list_key', 'offer_category').eq('active', true).order('sort_order').then(function (r) { if (!r.error && r.data) CATS = r.data; }); } catch (e) {}
  }
  function selectHtml(id, v) {
    var opts = '<option value="">Select a category…</option>' + CATS.map(function (c) { return '<option value="' + esc(c.value) + '"' + (c.value === v ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('');
    return '<select id="' + id + '" style="' + inputCss + '">' + opts + '</select>';
  }
  // Per-tier benefit input. Blank = not available to that tier.
  function tierRow(key, label, v) {
    return field(label, inp('of-tier-' + key, 'e.g. 10% off 1 meal', 'text', v || ''), 'Leave blank = not available to ' + label + ' tier.');
  }

  function formBody(o) {
    o = o || {}; var T = o.tiers || {};
    var h = '';
    h += field('Partner name', inp('of-partner', 'e.g. Green Bean Cafe', 'text', o.partner_name), 'The business the offer is for (not listed on the site).');
    var curLogo = o.logo_url || '';
    var logoInner =
      '<input id="of-logo" type="hidden" value="' + esc(curLogo) + '">' +
      '<div onclick="document.getElementById(\'of-logo-file\').click()" style="cursor:pointer;border:1.5px dashed #cbd5dd;border-radius:10px;padding:9px 11px;display:flex;align-items:center;gap:10px;background:#fff;">' +
        '<div id="of-logo-prev" style="width:42px;height:42px;border-radius:9px;flex:none;display:flex;align-items:center;justify-content:center;color:#8a99a8;background:#eef2f5' + (curLogo ? " url('" + esc(curLogo) + "') center/cover no-repeat" : '') + ';">' + (curLogo ? '' : '<span class="material-icons">add_photo_alternate</span>') + '</div>' +
        '<div id="of-logo-txt" style="font-size:12px;font-weight:700;color:#5b6b75;">' + (curLogo ? 'Tap to change logo' : 'Tap to upload a logo') + '</div>' +
      '</div>' +
      '<input id="of-logo-file" type="file" accept="image/*" style="display:none" onchange="AdminOffers.uploadLogo(this)">';
    h += '<div style="display:flex;gap:10px;">' +
         '<div style="flex:1">' + field('City', inp('of-city', 'e.g. Cairns', 'text', o.city)) + '</div>' +
         '<div style="flex:1">' + field('Logo', logoInner, 'Square image works best.') + '</div>' +
         '</div>';
    h += field('Category', selectHtml('of-category', o.category), 'Sets where it appears in the member Offers filter.');
    h += field('Offer title', inp('of-title', 'e.g. Meal discount', 'text', o.title), 'Short name for the offer.');
    h += field('Description', ta('of-desc', 'Short description shown to members', o.description));
    h += '<div style="font-size:12px;font-weight:800;color:#43525c;margin:8px 0 6px;">Benefit by tier</div>';
    h += tierRow('member', 'Member', T.member);
    h += tierRow('supporter', 'Supporter', T.supporter);
    h += tierRow('ambassador', 'Ambassador', T.ambassador);
    h += field('How members redeem', ta('of-redeem', 'The provider’s method — e.g. show the confirmation to staff, tell them the code, or scan at the desk', o.redeem_info));
    h += field('Terms / fine print', ta('of-terms', 'e.g. Dine-in only, one per visit', o.terms));
    h += '<div style="display:flex;gap:10px;">' +
         '<div style="flex:1">' + field('Valid from', inp('of-from', '', 'date', o.valid_from)) + '</div>' +
         '<div style="flex:1">' + field('Valid to', inp('of-to', '', 'date', o.valid_to)) + '</div>' +
         '<div style="width:120px">' + field('Per-member limit', inp('of-limit', '1', 'number', o.per_member_limit != null ? o.per_member_limit : 1)) + '</div>' +
         '</div>';
    return h;
  }

  async function save() {
    try {
      if (!adminId()) { window.showToast && showToast('Admin session not ready — reload.', 'error'); return; }
      if (!val('of-partner')) { window.showToast && showToast('Partner name is required', 'error'); return; }
      if (!val('of-title')) { window.showToast && showToast('Offer title is required', 'error'); return; }
      var tiers = { member: val('of-tier-member') || null, supporter: val('of-tier-supporter') || null, ambassador: val('of-tier-ambassador') || null };
      if (!tiers.member && !tiers.supporter && !tiers.ambassador) { window.showToast && showToast('Add a benefit for at least one tier', 'error'); return; }
      var row = {
        provider_id: null,
        partner_name: val('of-partner'),
        city: val('of-city') || null,
        logo_url: val('of-logo') || null,
        category: val('of-category') || null,
        tiers: tiers,
        title: val('of-title'),
        description: val('of-desc') || null,
        redeem_info: val('of-redeem') || null,
        terms: val('of-terms') || null,
        deal_type: 'bogo',
        valid_from: val('of-from') || null,
        valid_to: val('of-to') || null,
        per_member_limit: parseInt(val('of-limit') || '1', 10) || 1,
        source: 'admin',
        updated_at: new Date().toISOString()
      };
      window.showToast && showToast('Saving…', 'info');
      var res;
      if (editingId) { res = await sb().from('partner_offers').update(row).eq('id', editingId); }
      else { row.status = 'live'; row.created_by = adminId(); res = await sb().from('partner_offers').insert(row); }
      if (res.error) throw res.error;
      window.closeModal && closeModal();
      window.showToast && showToast(editingId ? 'Offer updated' : 'Offer added', 'check');
      editingId = null;
      renderList();
    } catch (e) { window.showToast && showToast(e.message || 'Save failed', 'error'); }
  }

  function openForm(o) {
    if (typeof window.openModal !== 'function') { alert('Admin modal system unavailable on this page.'); return; }
    if (!adminId()) { alert('Admin session not ready — reload and try again.'); return; }
    editingId = (o && o.id) || null;
    var footer = '<button onclick="closeModal()" style="padding:10px 16px;border:1px solid #d7dee5;background:#fff;border-radius:10px;font-weight:700;cursor:pointer;">Cancel</button>' +
                 '<button onclick="AdminOffers.save()" style="padding:10px 18px;border:none;background:#1980AD;color:#fff;border-radius:10px;font-weight:800;cursor:pointer;">' + (editingId ? 'Save' : 'Add offer') + '</button>';
    window.openModal((editingId ? 'Edit offer' : 'Add offer') + ' · Buy 1 Get 1 Free', formBody(o || {}), footer, { fullbleed: true });
  }

  async function setStatus(id, status) {
    try { var r = await sb().from('partner_offers').update({ status: status, updated_at: new Date().toISOString() }).eq('id', id); if (r.error) throw r.error; renderList(); }
    catch (e) { window.showToast && showToast(e.message || 'Update failed', 'error'); }
  }
  async function remove(id) {
    if (!window.confirm('Delete this offer? This cannot be undone.')) return;
    try { var r = await sb().from('partner_offers').delete().eq('id', id); if (r.error) throw r.error; window.showToast && showToast('Offer deleted', 'check'); renderList(); }
    catch (e) { window.showToast && showToast(e.message || 'Delete failed', 'error'); }
  }

  async function renderList() {
    var el = document.getElementById('offers-list');
    if (!el) return;
    el.innerHTML = '<div style="padding:20px;color:#8a99a8;">Loading offers…</div>';
    try {
      var r = await sb().from('partner_offers').select('*').order('created_at', { ascending: false });
      if (r.error) throw r.error;
      var rows = r.data || [];
      if (!rows.length) { el.innerHTML = '<div style="padding:24px;color:#8a99a8;">No offers yet. Add one with the button above.</div>'; return; }
      // Surface the review queue: pending offers first, otherwise newest-first (already sorted by created).
      rows.sort(function (a, b) { return (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1); });
      var pendingCount = rows.filter(function (o) { return o.status === 'pending'; }).length;
      var badge = function (s) {
        var map = { live: ['#e3f4ea', '#127a52', 'Live'], pending: ['#fff3d6', '#8a6100', 'Pending review'], paused: ['#f0f2f4', '#8a99a8', 'Paused'], rejected: ['#fdecea', '#c0392b', 'Rejected'] };
        var x = map[s] || ['#f0f2f4', '#8a99a8', s || '—'];
        return '<span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:20px;background:' + x[0] + ';color:' + x[1] + ';">' + esc(x[2]) + '</span>';
      };
      var body = rows.map(function (o) {
        var live = o.status === 'live';
        var pending = o.status === 'pending';
        var valid = [o.valid_from, o.valid_to].filter(Boolean).join(' → ') || 'No dates';
        var src = o.source === 'admin' ? 'External (admin)' : 'Partner';
        var actions =
          // Review actions for partner-submitted offers awaiting verification.
          (pending ? '<button onclick="AdminOffers.setStatus(\'' + o.id + '\',\'live\')" title="Approve & publish" style="border:none;background:none;cursor:pointer;color:#127a52;font-size:18px;"><span class="material-icons">check_circle</span></button>' +
                     '<button onclick="AdminOffers.setStatus(\'' + o.id + '\',\'rejected\')" title="Reject" style="border:none;background:none;cursor:pointer;color:#c0392b;font-size:18px;"><span class="material-icons">cancel</span></button>' : '') +
          '<button onclick=\'AdminOffers.edit(' + JSON.stringify(o).replace(/'/g, "&#39;") + ')\' title="Edit" style="border:none;background:none;cursor:pointer;color:#1980AD;font-size:18px;"><span class="material-icons">edit</span></button>' +
          ((live || o.status === 'paused') ? '<button onclick="AdminOffers.setStatus(\'' + o.id + '\',\'' + (live ? 'paused' : 'live') + '\')" title="' + (live ? 'Pause' : 'Activate') + '" style="border:none;background:none;cursor:pointer;color:#5b6b75;font-size:18px;"><span class="material-icons">' + (live ? 'pause_circle' : 'play_circle') + '</span></button>' : '') +
          '<button onclick="AdminOffers.remove(\'' + o.id + '\')" title="Delete" style="border:none;background:none;cursor:pointer;color:#d9534f;font-size:18px;"><span class="material-icons">delete</span></button>';
        return '<tr style="border-bottom:1px solid #eef2f5;' + (pending ? 'background:#fffdf5;' : '') + '">' +
          '<td style="padding:10px 12px;"><b>' + esc(o.partner_name || '—') + '</b><div style="font-size:11px;color:#8a99a8;">' + esc(o.city || '') + ' · ' + src + '</div></td>' +
          '<td style="padding:10px 12px;">' + esc(o.title || '') + '</td>' +
          '<td style="padding:10px 12px;font-size:12px;color:#5b6b75;">' + esc(valid) + '</td>' +
          '<td style="padding:10px 12px;text-align:center;">' + (o.redeemed_count || 0) + '</td>' +
          '<td style="padding:10px 12px;">' + badge(o.status) + '</td>' +
          '<td style="padding:10px 12px;white-space:nowrap;text-align:right;">' + actions + '</td></tr>';
      }).join('');
      var queue = pendingCount ? '<div style="background:#fff8e6;border:1px solid #f2e2a8;border-radius:10px;padding:10px 14px;margin-bottom:12px;color:#7a5c00;font-size:13px;font-weight:700;">' + pendingCount + ' offer' + (pendingCount > 1 ? 's' : '') + ' awaiting review — approve to publish to members.</div>' : '';
      el.innerHTML = queue + '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="text-align:left;color:#8a99a8;font-size:11px;text-transform:uppercase;letter-spacing:.4px;">' +
        '<th style="padding:8px 12px;">Partner</th><th style="padding:8px 12px;">Offer</th><th style="padding:8px 12px;">Valid</th><th style="padding:8px 12px;text-align:center;">Redeemed</th><th style="padding:8px 12px;">Status</th><th></th>' +
        '</tr></thead><tbody>' + body + '</tbody></table>';
    } catch (e) { el.innerHTML = '<div style="padding:20px;color:#d9534f;">Couldn’t load offers: ' + esc(e.message || '') + '</div>'; }
  }

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
  async function uploadLogo(input) {
    var file = input.files && input.files[0]; if (!file) return;
    var txt = document.getElementById('of-logo-txt'), prev = document.getElementById('of-logo-prev');
    if (txt) txt.textContent = 'Uploading…';
    try {
      var blob = file, ext = 'jpg', ctype = 'image/jpeg';
      try { blob = await toJpeg(file, 512, 0.85); } catch (e) { blob = file; ext = (file.name.split('.').pop() || 'jpg').toLowerCase(); ctype = file.type || 'image/jpeg'; }
      var path = 'offers/' + Date.now() + '-' + Math.random().toString(16).slice(2, 8) + '.' + ext;
      var up = await sb().storage.from('provider-logos').upload(path, blob, { upsert: true, contentType: ctype, cacheControl: '3600' });
      if (up.error) throw up.error;
      var url = sb().storage.from('provider-logos').getPublicUrl(path).data.publicUrl;
      var hid = document.getElementById('of-logo'); if (hid) hid.value = url;
      if (prev) { prev.style.background = "#eef2f5 url('" + url + "') center/cover no-repeat"; prev.innerHTML = ''; }
      if (txt) txt.textContent = 'Logo uploaded ✓ — tap to change';
    } catch (e) { if (txt) txt.textContent = 'Upload failed — try again'; window.showToast && showToast(e.message || 'Upload failed', 'error'); }
  }

  window.AdminOffers = { openForm: openForm, edit: function (o) { openForm(o); }, save: save, setStatus: setStatus, remove: remove, render: renderList, uploadLogo: uploadLogo };
  // Self-render when the loader is fetched (panel first opened).
  try { loadCats(); renderList(); } catch (e) {}
})();

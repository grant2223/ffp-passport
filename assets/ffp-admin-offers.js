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

  function formBody(o) {
    o = o || {};
    var h = '';
    h += field('Partner name', inp('of-partner', 'e.g. Green Bean Cafe', 'text', o.partner_name), 'The business the offer is for (not listed on the site).');
    h += '<div style="display:flex;gap:10px;">' +
         '<div style="flex:1">' + field('City', inp('of-city', 'e.g. Cairns', 'text', o.city)) + '</div>' +
         '<div style="flex:1">' + field('Logo URL', inp('of-logo', 'https://…', 'text', o.logo_url)) + '</div>' +
         '</div>';
    h += field('Offer title', inp('of-title', 'Buy 1 Get 1 Free smoothie', 'text', o.title), 'This is a Buy-1-Get-1-Free deal.');
    h += field('Description', ta('of-desc', 'Short description shown to members', o.description));
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
      var row = {
        provider_id: null,
        partner_name: val('of-partner'),
        city: val('of-city') || null,
        logo_url: val('of-logo') || null,
        title: val('of-title'),
        description: val('of-desc') || null,
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
    window.openModal((editingId ? 'Edit offer' : 'Add offer') + ' · Buy 1 Get 1 Free', formBody(o || {}), footer);
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
      var body = rows.map(function (o) {
        var live = o.status === 'live';
        var valid = [o.valid_from, o.valid_to].filter(Boolean).join(' → ') || 'No dates';
        var src = o.source === 'admin' ? 'External (admin)' : 'Partner';
        return '<tr style="border-bottom:1px solid #eef2f5;">' +
          '<td style="padding:10px 12px;"><b>' + esc(o.partner_name || '—') + '</b><div style="font-size:11px;color:#8a99a8;">' + esc(o.city || '') + ' · ' + src + '</div></td>' +
          '<td style="padding:10px 12px;">' + esc(o.title || '') + '</td>' +
          '<td style="padding:10px 12px;font-size:12px;color:#5b6b75;">' + esc(valid) + '</td>' +
          '<td style="padding:10px 12px;text-align:center;">' + (o.redeemed_count || 0) + '</td>' +
          '<td style="padding:10px 12px;"><span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:20px;background:' + (live ? '#e3f4ea;color:#127a52' : '#f0f2f4;color:#8a99a8') + ';">' + esc(o.status) + '</span></td>' +
          '<td style="padding:10px 12px;white-space:nowrap;text-align:right;">' +
            '<button onclick=\'AdminOffers.edit(' + JSON.stringify(o).replace(/'/g, "&#39;") + ')\' title="Edit" style="border:none;background:none;cursor:pointer;color:#1980AD;font-size:18px;"><span class="material-icons">edit</span></button>' +
            '<button onclick="AdminOffers.setStatus(\'' + o.id + '\',\'' + (live ? 'paused' : 'live') + '\')" title="' + (live ? 'Pause' : 'Activate') + '" style="border:none;background:none;cursor:pointer;color:#5b6b75;font-size:18px;"><span class="material-icons">' + (live ? 'pause_circle' : 'play_circle') + '</span></button>' +
            '<button onclick="AdminOffers.remove(\'' + o.id + '\')" title="Delete" style="border:none;background:none;cursor:pointer;color:#d9534f;font-size:18px;"><span class="material-icons">delete</span></button>' +
          '</td></tr>';
      }).join('');
      el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="text-align:left;color:#8a99a8;font-size:11px;text-transform:uppercase;letter-spacing:.4px;">' +
        '<th style="padding:8px 12px;">Partner</th><th style="padding:8px 12px;">Offer</th><th style="padding:8px 12px;">Valid</th><th style="padding:8px 12px;text-align:center;">Redeemed</th><th style="padding:8px 12px;">Status</th><th></th>' +
        '</tr></thead><tbody>' + body + '</tbody></table>';
    } catch (e) { el.innerHTML = '<div style="padding:20px;color:#d9534f;">Couldn’t load offers: ' + esc(e.message || '') + '</div>'; }
  }

  window.AdminOffers = { openForm: openForm, edit: function (o) { openForm(o); }, save: save, setStatus: setStatus, remove: remove, render: renderList };
  // Self-render when the loader is fetched (panel first opened).
  try { renderList(); } catch (e) {}
})();

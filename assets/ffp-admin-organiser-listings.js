/* FFP Admin — Organiser Listings (Stage 1 UI)
   Admin adds an EVENT or EXPERIENCE on behalf of an external ORGANISER (an unclaimed provider),
   saved as DRAFT then PUBLISHED. Registration is EXTERNAL only (organiser sign-up URL).
   Backed by the admin RPCs: admin_org_providers / admin_create_org_provider /
   admin_save_event / admin_save_experience / admin_publish_listing (all admin_users-gated).
   Self-contained: depends only on window.supabase, window.FFP_ADMIN, openModal/closeModal, showToast.
   After a save it reloads the panel data via the loader's own hook if present, else a soft reload. */
(function () {
  'use strict';
  var sb = function () { return window.supabase; };
  var adminId = function () { return window.FFP_ADMIN && window.FFP_ADMIN.id; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var lines = function (v) { return (v || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };

  var ORGS = [];

  function field(label, inner, hint) {
    return '<label style="display:block;margin:0 0 12px">' +
      '<span style="display:block;font-size:12px;font-weight:700;color:var(--muted,#7b8ca0);margin:0 0 5px">' + esc(label) + '</span>' +
      inner + (hint ? '<span style="display:block;font-size:11px;color:var(--muted,#7b8ca0);margin-top:3px">' + esc(hint) + '</span>' : '') + '</label>';
  }
  var inputCss = 'width:100%;padding:10px 12px;border:1px solid var(--border,#263442);border-radius:10px;background:var(--bg2,#0f1c28);color:var(--text,#e8eef4);font-size:15px;box-sizing:border-box';
  function inp(id, ph, type) { return '<input id="' + id + '" type="' + (type || 'text') + '" placeholder="' + esc(ph || '') + '" style="' + inputCss + '">'; }
  function ta(id, ph) { return '<textarea id="' + id + '" placeholder="' + esc(ph || '') + '" rows="3" style="' + inputCss + ';resize:vertical"></textarea>'; }

  function orgPicker() {
    var opts = ORGS.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.business_name) + (o.claimed ? ' (claimed)' : '') + '</option>'; }).join('');
    return field('Organiser',
      '<select id="ol-org" onchange="AdminOrgListing._toggleNewOrg()" style="' + inputCss + '">' +
        '<option value="">— choose organiser —</option>' + opts +
        '<option value="__new">＋ New organiser…</option></select>' +
      '<div id="ol-neworg" style="display:none;margin-top:8px">' +
        inp('ol-org-name', 'Organiser / company name') +
        '<div style="height:8px"></div>' + inp('ol-org-email', 'Contact email (for the claim link later)', 'email') +
      '</div>',
      'The event/experience is hosted under this organiser. They can claim it later.');
  }

  function formBody(kind) {
    var isEvent = kind === 'event';
    var h = orgPicker();
    h += field('Title *', inp('ol-title', isEvent ? 'e.g. Dubai Desert Ultra' : 'e.g. Hatta Kayak Experience'));
    h += '<div style="display:flex;gap:10px">' +
      '<div style="flex:1">' + field('Category', inp('ol-category', 'e.g. running, adventure')) + '</div>' +
      '<div style="flex:1">' + field('Activity', inp('ol-activity', 'e.g. Trail run, Kayaking')) + '</div></div>';
    if (isEvent) {
      h += '<div style="display:flex;gap:10px">' +
        '<div style="flex:1">' + field('Starts *', inp('ol-starts', '', 'datetime-local')) + '</div>' +
        '<div style="flex:1">' + field('Ends', inp('ol-ends', '', 'datetime-local')) + '</div></div>';
    } else {
      h += field('Duration (minutes)', inp('ol-duration', 'e.g. 180', 'number'));
    }
    h += '<div style="display:flex;gap:10px">' +
      '<div style="flex:1">' + field('City', inp('ol-city', 'e.g. Dubai')) + '</div>' +
      (isEvent ? '<div style="flex:1">' + field('Area', inp('ol-area', 'e.g. Al Qudra')) + '</div>' : '') +
      '<div style="flex:1">' + field('Country', inp('ol-country', 'e.g. United Arab Emirates')) + '</div></div>';
    h += field('Venue / meeting point', inp('ol-venue', 'e.g. Al Qudra Cycle Track'));
    h += '<div style="display:flex;gap:10px">' +
      '<div style="flex:1">' + field('Price (AED)', inp('ol-price', '0', 'number')) + '</div>' +
      '<div style="flex:1">' + field('Capacity', inp('ol-capacity', 'optional', 'number')) + '</div></div>';
    h += field('Hero image URL', inp('ol-hero', 'https://…'), 'Paste an image URL (uploads come later).');
    h += field('External sign-up URL *', inp('ol-ext', 'https://organiser.example/register'), 'Members are sent here to register (external registration only).');
    h += field('Short description', ta('ol-desc', 'One or two lines about the ' + kind + '.'));
    h += field('Highlights (one per line)', ta('ol-highlights', '50 km course\nAid stations every 10 km'));
    h += field('What’s included (one per line)', ta('ol-included', 'Finisher medal\nHydration'));
    return h;
  }

  function collect(kind) {
    var f = {
      title: val('ol-title'), category: val('ol-category'), activity: val('ol-activity'),
      city: val('ol-city'), country: val('ol-country'), venue: val('ol-venue'), meeting_point: val('ol-venue'),
      price_aed: val('ol-price'), capacity: val('ol-capacity'), hero_image_url: val('ol-hero'),
      external_ref: val('ol-ext'), description: val('ol-desc'),
      highlights: lines(val('ol-highlights')), what_included: lines(val('ol-included'))
    };
    if (kind === 'event') { f.starts_at = val('ol-starts'); f.ends_at = val('ol-ends'); f.area = val('ol-area'); f.about = val('ol-desc'); }
    else { f.duration_min = val('ol-duration'); }
    return f;
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  async function resolveOrg() {
    var sel = val('ol-org');
    if (sel === '__new') {
      var name = val('ol-org-name');
      if (!name) { throw new Error('Enter the new organiser name'); }
      var r = await sb().rpc('admin_create_org_provider', { p_admin: adminId(), p_name: name, p_email: val('ol-org-email') || null });
      if (r.error) throw r.error;
      return r.data;
    }
    if (!sel) throw new Error('Choose an organiser');
    return sel;
  }

  async function save(kind, publish) {
    try {
      if (!adminId()) { window.showToast && showToast('Admin session not ready — reload.', 'error'); return; }
      if (!val('ol-title')) { window.showToast && showToast('Title is required', 'error'); return; }
      if (kind === 'event' && !val('ol-starts')) { window.showToast && showToast('Start date/time is required', 'error'); return; }
      if (!val('ol-ext')) { window.showToast && showToast('External sign-up URL is required', 'error'); return; }
      window.showToast && showToast(publish ? 'Publishing…' : 'Saving draft…', 'info');
      var provider = await resolveOrg();
      var fn = kind === 'event' ? 'admin_save_event' : 'admin_save_experience';
      var r = await sb().rpc(fn, { p_admin: adminId(), p_provider: provider, p_fields: collect(kind), p_publish: !!publish, p_id: null });
      if (r.error) throw r.error;
      window.closeModal && closeModal();
      window.showToast && showToast((kind === 'event' ? 'Event' : 'Experience') + (publish ? ' published' : ' saved as draft'), 'check');
      reload(kind);
    } catch (e) {
      console.error('[AdminOrgListing] save', e);
      window.showToast && showToast(e.message || 'Save failed', 'error');
    }
  }

  function reload(kind) {
    // use the panel loader's own reload hook if it exposed one, else a soft page reload
    var hook = kind === 'event' ? window.ffpReloadEvents : window.ffpReloadExperiences;
    if (typeof hook === 'function') { try { hook(); return; } catch (e) {} }
    setTimeout(function () { location.reload(); }, 700);
  }

  var AdminOrgListing = {
    _toggleNewOrg: function () { var b = document.getElementById('ol-neworg'); if (b) b.style.display = (val('ol-org') === '__new') ? 'block' : 'none'; },
    async open(kind) {
      kind = kind === 'experience' ? 'experience' : 'event';
      if (!adminId()) { window.showToast && showToast('Admin session not ready — reload.', 'error'); return; }
      try {
        var r = await sb().rpc('admin_org_providers', { p_admin: adminId() });
        ORGS = (r && !r.error && Array.isArray(r.data)) ? r.data : [];
      } catch (e) { ORGS = []; }
      var title = 'Add ' + (kind === 'event' ? 'Event' : 'Experience') + ' (organiser)';
      var footer =
        '<button class="btn" onclick="closeModal()">Cancel</button>' +
        '<button class="btn" onclick="AdminOrgListing.saveDraft(\'' + kind + '\')">Save as draft</button>' +
        '<button class="btn btn-primary" onclick="AdminOrgListing.publish(\'' + kind + '\')">Publish</button>';
      window.openModal(title, formBody(kind), footer);
    },
    saveDraft: function (kind) { save(kind, false); },
    publish: function (kind) { save(kind, true); },

    // ---- Organiser management: claim links + manual assign (Stage 2 handoff) ----
    async organisers() {
      if (!adminId()) { window.showToast && showToast('Admin session not ready — reload.', 'error'); return; }
      var list = [];
      try { var r = await sb().rpc('admin_org_providers', { p_admin: adminId() }); list = (r && !r.error && Array.isArray(r.data)) ? r.data : []; } catch (e) {}
      var rows = list.length ? list.map(function (o) {
        var meta = esc(o.contact_email || 'no email') + ' · ' + (o.claimed ? 'claimed' : 'unclaimed');
        var actions = o.claimed
          ? '<span style="font-size:12px;color:#1a8a5a;font-weight:700">✓ owned</span>'
          : '<button class="btn" onclick="AdminOrgListing._copyClaim(\'' + o.id + '\')">Copy claim link</button>' +
            '<button class="btn" onclick="AdminOrgListing._assign(\'' + o.id + '\')">Assign owner</button>';
        return '<div style="display:flex;align-items:center;gap:8px;padding:11px 0;border-bottom:1px solid var(--border,#263442)">' +
          '<div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(o.business_name) + '</div>' +
          '<div style="font-size:12px;color:var(--muted,#7b8ca0)">' + meta + '</div></div>' + actions + '</div>';
      }).join('') : '<p style="color:var(--muted,#7b8ca0)">No organisers yet — one is created when you add an event or experience.</p>';
      window.openModal('Organisers', rows, '<button class="btn" onclick="closeModal()">Close</button>');
    },
    async _copyClaim(pid) {
      try {
        var r = await sb().rpc('admin_generate_claim_link', { p_admin: adminId(), p_provider: pid });
        if (r.error) throw r.error;
        var url = location.origin + '/claim.html?token=' + encodeURIComponent(r.data);
        try { await navigator.clipboard.writeText(url); window.showToast && showToast('Claim link copied — send it to the organiser', 'check'); }
        catch (e) { window.prompt('Copy this claim link and send it to the organiser:', url); }
      } catch (e) { window.showToast && showToast(e.message || 'Could not generate claim link', 'error'); }
    },
    async _assign(pid) {
      var email = window.prompt('Assign owner — enter the organiser’s FFP account email (they must already have an FFP account):');
      if (!email) return;
      try {
        var r = await sb().rpc('admin_assign_provider_owner', { p_admin: adminId(), p_provider: pid, p_email: email });
        if (r.error) throw r.error;
        window.showToast && showToast('Owner assigned: ' + ((r.data && r.data.member_name) || email), 'check');
        this.organisers();
      } catch (e) { window.showToast && showToast(e.message || 'Assign failed', 'error'); }
    }
  };
  window.AdminOrgListing = AdminOrgListing;
})();

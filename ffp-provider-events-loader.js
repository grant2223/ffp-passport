/* FFP Provider Events Loader — v8 (2026-06-05)
   v8: CATEGORY STANDARDISATION — removed the dead 23-granular FFP_CATEGORIES array (unused since v4 swapped
       the category dropdown for the activity picker). Events now derive their category from the activity
       picker, which reads activity_types.category — standardised platform-wide to the 6
       (fitness/sports/wellness/recovery/adventure/food). The granular values are preserved in
       activity_types.subcategory. No live behaviour change; dead-code + comment cleanup only.
   v7: GUEST LIST inside the event modal — injectEventRoster() calls provider_event_roster(p_me,p_event)
       (owner-gated SECURITY DEFINER RPC) and shows each RSVP'd member (photo + name + city) with a
       "Going" / "Checked in" badge + a "N going · M checked in" header. Lets providers see who's coming
       and who actually showed up (via venue-QR check-in). node-checked.
   v6 (rebuilt form: Country/City taxonomy cascade required, Area+Venue optional,
   Location pin, End date/time, numeric Price (AED); flow Basics→When→Where→Pricing→Good-to-know; save via provider_save_listing RPC)
    — v3 close edit modal after delete; v4
   v4 changes (Grant's feedback):
   - Activity picker (379 activities, searchable, grouped by category) replaces
     the broad-category dropdown — pick "Padel" not "Racquet sports".
   - Reuses window.FFPPicker exposed by the experiences loader (no extra script tag).
   - Stores both activity + category on each event row.
   v3: Removed "Who is this for?" + thin chevron CSS.
   v2: FFP 23-category taxonomy + re-approval rule.
   v1: Initial wiring.
*/
(function () {
  'use strict';

  // Categories are standardised platform-wide to the 6 (fitness/sports/wellness/recovery/adventure/food)
  // and derived from the activity picker (activity_types.category). No hard-coded category list here.

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Provider Events]', msg);
  }
  async function waitFor(check, ms) {
    var tries = 0; var limit = Math.ceil((ms || 15000) / 100);
    while (!check() && tries < limit) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    return check();
  }
  function escHtml(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function injectStyles() {
    if (document.getElementById('ffp-provider-events-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-provider-events-css';
    css.textContent = [
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',
      '#panel-events{overflow-x:hidden;}',
      '.modal select, .modal .select, .modal-body select, .modal-body .select{color-scheme:dark;}',
      '.modal select option, .modal-body select option{background:#0f1e2e !important;color:#f5f7fa !important;}',
      '.modal select option:checked, .modal-body select option:checked{background:#2ba8e0 !important;color:#082335 !important;}',

      // FFP thin chevron-down on all selects in dashboard panels + modals
      // (replaces native OS block arrow with brand-standard line chevron)
      'select.select, select.input,' +
      ' #panel-overview select, #panel-profile select, #panel-deals select, #panel-events select,' +
      ' #panel-experiences select, #panel-challenges select, #panel-checkins select,' +
      ' .modal select, .modal-body select {' +
        'appearance:none;-webkit-appearance:none;-moz-appearance:none;' +
        'background-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238a99a8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E");' +
        'background-repeat:no-repeat;' +
        'background-position:right 12px center;' +
        'background-size:16px;' +
        'padding-right:36px;' +
      '}',
      // Hide IE/Edge legacy select arrow
      'select.select::-ms-expand, select.input::-ms-expand{display:none;}',

      // Picker button (matches experiences loader styling)
      '.ffp-picker-btn{' +
        'width:100%;display:flex;align-items:center;justify-content:space-between;' +
        'background:#0a1825;border:1px solid #1a2f44;border-radius:10px;' +
        'padding:11px 14px;color:#e8eef4;font-size:14px;font-family:inherit;cursor:pointer;' +
        'text-align:left;}',
      '.ffp-picker-btn:hover{border-color:#2a4564;}',
      '.ffp-picker-btn.placeholder{color:#6c7a8b;}',
      '.ffp-picker-btn .caret{flex-shrink:0;margin-left:10px;color:#8a99a8;}',
      '.ffp-picker-btn .picked{display:flex;flex-direction:column;line-height:1.3;gap:1px;overflow:hidden;}',
      '.ffp-picker-btn .picked .name{color:#e8eef4;font-weight:500;}',
      '.ffp-picker-btn .picked .group{color:#8a99a8;font-size:11px;}'
    ].join('');
    document.head.appendChild(css);
  }

  function mapForUi(row) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var fmt = function (v) { if (!v) return ['', '']; var x = new Date(v); if (isNaN(x.getTime())) return ['', '']; return [x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()), pad(x.getHours()) + ':' + pad(x.getMinutes())]; };
    var sd = fmt(row.starts_at), ed = fmt(row.ends_at);
    var d = sd[0], t = sd[1];
    return {
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      about: row.about || '',
      activity: row.activity || '',
      category: row.category || '',
      intensity: row.fitness_level || 'Social',
      event_date: d || '',
      event_time: t,
      end_date: ed[0] || '',
      end_time: ed[1] || '',
      country: row.country || '',
      venue: row.venue || '',
      city: row.city || '',
      area: row.area || '',
      setting: row.setting || '',
      capacity: row.capacity || 0,
      price_aed: (row.price_aed != null ? row.price_aed : ''),
      cost: row.cost || '',
      parking: row.parking || '',
      facilities: row.facilities || '',
      bring: row.bring || '',
      who: row.who_for || '',
      hero_url: row.hero_image_url || null,
      status: row.status || 'pending',
      verified: row.status === 'live',
      featured: !!row.featured,
      rsvps: 0,
      capacity_pct: 0,
      created_at: row.created_at ? row.created_at.slice(0, 10) : '',
      _raw: row
    };
  }

  async function fetchEvents() {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) return [];
    var providerId = window.FFP_PROVIDER.id;
    var res = await window.supabase
      .from('events')
      .select('id, provider_id, title, description, about, activity, category, fitness_level, group_filter, hero_image_url, country, city, venue, area, setting, starts_at, ends_at, capacity, price_aed, cost, parking, facilities, bring, who_for, status, featured, created_at, updated_at')
      .eq('provider_id', providerId)
      .order('starts_at', { ascending: true });
    if (res.error) {
      console.error('[FFP Provider Events] fetch:', res.error);
      toast('Could not load events', 'error');
      return [];
    }
    return (res.data || []).map(mapForUi);
  }

  async function refresh() {
    if (typeof events === 'undefined') return;
    var rows = await fetchEvents();
    events.length = 0;
    rows.forEach(function (r) { events.push(r); });
    if (typeof window.renderEvents === 'function') { try { window.renderEvents(); } catch (e) {} }
    if (typeof window.renderNav === 'function')   { try { window.renderNav();   } catch (e) {} }
  }

  function buildStartsAt(dateStr, timeStr) {
    if (!dateStr) return null;
    var t = (timeStr && timeStr.length >= 4) ? timeStr : '00:00';
    var d = new Date(dateStr + 'T' + t + ':00');
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function escHtmlSafe(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setActivityBtn(btn, name, category) {
    btn.dataset.value = name || '';
    btn.dataset.category = category || '';
    if (name) {
      btn.classList.remove('placeholder');
      btn.innerHTML =
        '<div class="picked"><div class="name">' + escHtmlSafe(name) + '</div>' +
        (category ? '<div class="group">' + escHtmlSafe(category) + '</div>' : '') +
        '</div>' +
        '<span class="ms caret">expand_more</span>';
    } else {
      btn.classList.add('placeholder');
      btn.innerHTML = '<span>Choose activity…</span><span class="ms caret">expand_more</span>';
    }
  }

  // Replace the category <select> with an activity picker button
  function swapCategoryForPicker(currentActivity, currentCategory) {
    var sel = document.getElementById('em-category');
    if (!sel) return;
    var fieldDiv = sel.closest('.field');
    if (!fieldDiv) return;

    // Update label
    var labelDiv = fieldDiv.querySelector('.label');
    if (labelDiv) {
      labelDiv.innerHTML = 'Activity <span class="req">*</span> <span class="label-hint">— what is it?</span>';
    }

    // Build picker button
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ffp-picker-btn placeholder';
    btn.id = 'em-activity-btn';
    btn.dataset.value = '';
    btn.dataset.category = '';
    btn.innerHTML = '<span>Choose activity…</span><span class="ms caret">expand_more</span>';

    // Replace the select element
    sel.parentNode.replaceChild(btn, sel);

    // Initialize state
    if (currentActivity) {
      setActivityBtn(btn, currentActivity, currentCategory);
    }

    // Wire click
    btn.addEventListener('click', function () {
      if (window.FFPPicker && typeof window.FFPPicker.openActivity === 'function') {
        window.FFPPicker.openActivity(btn.dataset.value, function (name, cat) {
          setActivityBtn(btn, name, cat);
        });
      } else {
        console.error('[FFP Events] FFPPicker not loaded — is experiences loader present?');
        toast('Activity picker not ready', 'error');
      }
    });
  }

  // Populate Country + City selects from the shared taxonomy (FFP_TAX.cities), with a country->city cascade.
  function fillEventLocation(existing) {
    var TAX = window.FFP_TAX;
    var cny = document.getElementById('em-country');
    var cty = document.getElementById('em-city');
    if (!cny || !cty || !TAX || !TAX.cities) return;
    var prof = window.providerProfile || {};
    var countries = Object.keys(TAX.cities).sort();
    var selCountry = (existing && existing.country) || prof.country || 'United Arab Emirates';
    var selCity = (existing && existing.city) || prof.city || '';
    if (countries.indexOf(selCountry) === -1) selCountry = countries[0] || '';
    cny.innerHTML = countries.map(function (c) { return '<option' + (c === selCountry ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    function fillCities(country, keepCity) {
      var list = (TAX.cities[country] || []).slice();
      cty.innerHTML = '<option value="">Select city…</option>' + list.map(function (c) { return '<option' + (c === keepCity ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    }
    fillCities(cny.value, selCity);
    cny.addEventListener('change', function () { fillCities(cny.value, ''); });
  }

  function patchModalAfterOpen(editingId) {
    // Find the activity/category for editing event
    var existing = editingId ? events.find(function (x) { return x.id === editingId; }) : null;
    var currentActivity = existing ? (existing.activity || '') : '';
    var currentCategory = existing ? (existing.category || '') : '';

    swapCategoryForPicker(currentActivity, currentCategory);
    fillEventLocation(existing);

    // Remove "Who is this for?" field — every event is for FFP members anyway
    var whoEl = document.getElementById('em-who');
    if (whoEl) {
      var fieldEl = whoEl.closest('.field');
      if (fieldEl && fieldEl.parentNode) fieldEl.parentNode.removeChild(fieldEl);
    }

    // Clean prior re-approval note
    var modal = document.querySelector('.modal');
    if (!modal) return;
    var existingNote = modal.querySelector('.ffp-reapproval-note');
    if (existingNote) existingNote.remove();
  }

  function showReapprovalNoteIfNeeded(id) {
    if (!id) return;
    var existing = events.find(function (x) { return x.id === id; });
    if (!existing) return;
    if (existing.status !== 'live' && existing.status !== 'paused') return;
    // Inject a help strip into the modal body
    var modalBody = document.querySelector('.modal .modal-body, .modal-body');
    if (!modalBody) return;
    if (modalBody.querySelector('.ffp-reapproval-note')) return;
    var note = document.createElement('div');
    note.className = 'help-strip ffp-reapproval-note';
    note.style.marginTop = '14px';
    note.innerHTML = '<span class="ms">info</span><div><b>This event is approved.</b> Saving changes will send it back to admin for re-approval.</div>';
    modalBody.appendChild(note);
  }

  // ─── Save (INSERT / UPDATE) ───
  async function realSaveEvent(id) {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) { toast('Provider not loaded', 'error'); return; }
    var get = function (key) {
      var el = document.getElementById('em-' + key);
      return el ? (el.value || '').trim() : '';
    };
    var title    = get('title');
    var date     = get('date');
    var actBtn   = document.getElementById('em-activity-btn');
    var activity = actBtn ? actBtn.dataset.value : '';
    var category = actBtn ? actBtn.dataset.category : '';
    var country  = get('country');
    var city     = get('city');
    if (!title)    { toast('Title is required', 'error'); return; }
    if (!activity) { toast('Activity is required', 'error'); return; }
    if (!date)     { toast('Start date is required', 'error'); return; }
    if (!country)  { toast('Country is required', 'error'); return; }
    if (!city)     { toast('City is required', 'error'); return; }

    var startsAt = buildStartsAt(date, get('time'));
    var endDate  = get('end-date');
    var endsAt   = endDate ? buildStartsAt(endDate, get('end-time')) : null;
    var photoSlot = document.getElementById('listing-photo-slot');
    var heroUrl = (photoSlot && photoSlot.dataset.url) ? photoSlot.dataset.url : null;
    if (heroUrl === '') heroUrl = null;
    var capRaw = get('capacity');
    var capacity = capRaw ? parseInt(capRaw, 10) : null;
    if (capacity != null && isNaN(capacity)) capacity = null;
    var priceRaw = get('price');
    var priceNum = priceRaw ? parseFloat(priceRaw) : null;
    if (priceNum != null && isNaN(priceNum)) priceNum = null;
    var desc = get('description');

    var payload = {
      title: title,
      description: desc || null,
      about: desc || null,
      activity: activity,
      category: category || null,
      fitness_level: get('intensity') || null,
      starts_at: startsAt,
      ends_at: endsAt,
      country: country || null,
      city: city || null,
      area: get('area') || null,
      venue: get('venue') || null,
      capacity: capacity,
      price_aed: priceNum,
      parking: get('parking') || null,
      facilities: get('facilities') || null,
      bring: get('bring') || null,
      hero_image_url: heroUrl
    };

    var reapprovalNote = '';
    try {
      if (id) {
        // edit via SECURITY DEFINER RPC (auth.uid trap blocks direct .update). Keeps current status.
        var upd = await window.supabase.rpc('provider_save_listing', { p_kind: 'event', p_provider: (window.FFP_PROVIDER || {}).id, p_id: id, p: payload });
        if (upd.error) throw upd.error;
        if (!upd.data) throw new Error('Update failed — not found or not permitted');
        toast('Event updated', 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
      } else {
        var ins = await window.supabase.rpc('provider_save_listing', { p_kind: 'event', p_provider: (window.FFP_PROVIDER || {}).id, p_id: null, p: payload });
        if (ins.error) throw ins.error;
        if (!ins.data) throw new Error('Submit failed — please try again');
        if (typeof window.closeModal === 'function') window.closeModal();
        if (typeof window.showSubmittedModal === 'function') {
          try { window.showSubmittedModal('event'); } catch (e) {}
        } else {
          toast('Submitted for review', 'success');
        }
      }
      await refresh();
    } catch (e) {
      console.error('[FFP Provider Events] save:', e);
      var msg = e.message || 'Save failed';
      if (/policy|permission|denied|rls/i.test(msg)) msg = 'Save blocked by RLS';
      else if (/does not exist/i.test(msg))         msg = 'Schema mismatch — see console';
      toast(msg, 'error');
    }
  }

  async function realDeleteEvent(id) {
    if (!id) return;
    var doDelete = async function () {
      try {
        var res = await window.supabase.rpc('provider_delete_listing', { p_kind: 'event', p_provider: (window.FFP_PROVIDER||{}).id, p_id: id });
        if (!res.error && res.data !== 'deleted') throw new Error('Delete failed — not found or not permitted');
        if (res.error) throw res.error;
        toast('Event deleted', 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
        await refresh();
      } catch (e) {
        console.error('[FFP Provider Events] delete:', e);
        toast(e.message || 'Delete failed', 'error');
      }
    };
    if (typeof window.openConfirm === 'function') {
      window.openConfirm('Delete this event?', 'Members with RSVPs will be notified. This cannot be undone.', doDelete);
    } else {
      if (confirm('Delete this event?')) await doDelete();
    }
  }

  // ─── Init ───
  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth &&
             typeof window.renderEvents === 'function' &&
             typeof events !== 'undefined' &&
             typeof window.openEventModal === 'function';
    }, 15000);
    if (!ok) { console.error('[FFP Provider Events] dependencies never loaded'); return; }

    var authed = await waitFor(function () {
      return !!(window.FFP_PROVIDER && window.FFP_PROVIDER.id);
    }, 30000);
    if (!authed) { console.warn('[FFP Provider Events] FFP_PROVIDER not set'); return; }

    injectStyles();

    try {
      await refresh();
      console.log('[FFP Provider Events] loaded v6 \u2014 rebuilt form (taxonomy country/city, end, price) \u2713');
    } catch (e) {
      console.error('[FFP Provider Events] initial load:', e);
    }

    // v2: GUEST LIST — show who RSVP'd (passport info) + who's checked in, inside the event modal.
    async function injectEventRoster(editingId) {
      if (!editingId) return;   // only for existing events
      var modalBody = document.querySelector('.modal .modal-body, .modal-body');
      if (!modalBody || document.getElementById('ffp-ev-roster')) return;
      var me = (window.FFPAuth && window.FFPAuth.getMember && window.FFPAuth.getMember()) || null;
      var meId = me && me.id; if (!meId) return;
      function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
      var sec = document.createElement('div');
      sec.id = 'ffp-ev-roster'; sec.className = 'field';
      sec.innerHTML = '<div class="label">Guest list</div><div id="ffp-ev-roster-body" style="font-size:13px;color:#9fb4c4;padding:4px 0;">Loading…</div>';
      modalBody.appendChild(sec);
      try {
        var res = await window.supabase.rpc('provider_event_roster', { p_me: meId, p_event: editingId });
        var rows = (res && res.data) || [];
        var body = document.getElementById('ffp-ev-roster-body'); if (!body) return;
        if (!rows.length) {
          body.innerHTML = 'No RSVPs yet. When members RSVP, their FFP Passport appears here — they check in with it at the venue on the day.';
          return;
        }
        var inCount = rows.filter(function (r) { return r.checked_in; }).length;
        body.innerHTML = '<div style="margin-bottom:8px;font-weight:700;color:#cfe0ee;">' + rows.length + ' going · ' + inCount + ' checked in</div>' + rows.map(function (p) {
          var nm = p.full_name || ((p.given_names || '') + ' ' + (p.surname || '')).trim() || 'Member';
          var av = p.photo_url
            ? '<span style="width:36px;height:36px;border-radius:50%;flex-shrink:0;background:#0a1825 url(\'' + p.photo_url + '\') center/cover;"></span>'
            : '<span style="width:36px;height:36px;border-radius:50%;flex-shrink:0;background:#13324a;color:#cfe0ee;display:flex;align-items:center;justify-content:center;font-weight:800;">' + esc(nm.charAt(0).toUpperCase()) + '</span>';
          var badge = p.checked_in
            ? '<span style="background:#16a34a;color:#fff;font-size:11px;font-weight:700;border-radius:6px;padding:3px 9px;flex-shrink:0;">Checked in</span>'
            : '<span style="background:rgba(43,168,224,0.12);color:#2ba8e0;font-size:11px;font-weight:700;border-radius:6px;padding:3px 9px;flex-shrink:0;">Going</span>';
          var loc = [p.city, p.country].filter(Boolean).join(', ');
          return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.07);">' + av +
            '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;color:#e8eef4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(nm) + '</div>' +
            (loc ? '<div style="font-size:11px;color:#8a99a8;">' + esc(loc) + '</div>' : '') + '</div>' + badge + '</div>';
        }).join('');
      } catch (e) {
        var b = document.getElementById('ffp-ev-roster-body'); if (b) b.innerHTML = 'Could not load the guest list.';
      }
    }

    // Wrap openEventModal to swap category → activity picker + remove who_for + show re-approval note
    var origOpenEventModal = window.openEventModal;
    window.openEventModal = function (id) {
      try { origOpenEventModal(id); } catch (e) { console.error('[FFP Provider Events] orig modal:', e); }
      setTimeout(function () {
        patchModalAfterOpen(id);
        showReapprovalNoteIfNeeded(id);
        try { injectEventRoster(id); } catch (e) { console.error('[FFP Provider Events] roster:', e); }
      }, 50);
    };

    window.saveEvent = realSaveEvent;
    window.confirmDeleteEvent = realDeleteEvent;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

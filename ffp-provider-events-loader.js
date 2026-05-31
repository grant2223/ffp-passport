/* FFP Provider Events Loader — v5
   v5: count real RSVPs per event (batched rsvps query, rsvps_provider_read RLS)
       so the card shows live RSVP count + filled %. Was hardcoded 0.
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

  // FFP master taxonomy — 23 categories. Used on EVERY content creation form.
  var FFP_CATEGORIES = [
    'Running & walking', 'Athletics & track', 'Cycling', 'Swimming', 'Watersports',
    'Racquet sports', 'Team sports', 'Combat sports', 'Gymnastics', 'Strength & fitness',
    'Mind-body & yoga', 'Dance & rhythm', 'Outdoor & adventure', 'Recovery & wellness',
    'Golf', 'Equestrian', 'Shooting & target sports', 'Cue & precision sports',
    'Air & extreme', 'Snow sports', 'Motorsports', 'Skateboard & roller', 'Multi-sport & events'
  ];

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
    var d = null, t = '';
    if (row.starts_at) {
      var dt = new Date(row.starts_at);
      if (!isNaN(dt.getTime())) {
        var pad = function (n) { return String(n).padStart(2, '0'); };
        d = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
        t = pad(dt.getHours()) + ':' + pad(dt.getMinutes());
      }
    }
    return {
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      about: row.about || '',
      activity: row.activity || '',
      category: row.category || '',
      intensity: row.fitness_level || 'Beginner',
      event_date: d || '',
      event_time: t,
      venue: row.venue || '',
      city: row.city || '',
      area: row.area || '',
      setting: row.setting || '',
      capacity: row.capacity || 0,
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
      .select('id, provider_id, title, description, about, activity, category, fitness_level, group_filter, hero_image_url, city, venue, area, setting, starts_at, ends_at, capacity, price_aed, cost, parking, facilities, bring, who_for, status, featured, created_at, updated_at')
      .eq('provider_id', providerId)
      .order('starts_at', { ascending: true });
    if (res.error) {
      console.error('[FFP Provider Events] fetch:', res.error);
      toast('Could not load events', 'error');
      return [];
    }
    return (res.data || []).map(mapForUi);
  }

  // v5: count real RSVPs per event (one batched query) so the card shows live
  // numbers. Provider reads these via the rsvps_provider_read RLS policy.
  async function attachRsvpCounts(rows) {
    if (!rows || !rows.length) return rows;
    var ids = rows.map(function (r) { return r.id; });
    try {
      var res = await window.supabase.from('rsvps').select('event_id, status').in('event_id', ids);
      if (res.error) { console.warn('[FFP Provider Events] rsvp counts:', res.error.message); return rows; }
      var tally = {};
      (res.data || []).forEach(function (x) { if (x.status !== 'cancelled') tally[x.event_id] = (tally[x.event_id] || 0) + 1; });
      rows.forEach(function (r) {
        r.rsvps = tally[r.id] || 0;
        r.capacity_pct = r.capacity ? Math.min(100, Math.round((r.rsvps / r.capacity) * 100)) : 0;
      });
    } catch (e) { console.warn('[FFP Provider Events] rsvp counts threw:', e); }
    return rows;
  }

  async function refresh() {
    if (typeof events === 'undefined') return;
    var rows = await fetchEvents();
    await attachRsvpCounts(rows);
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

  function patchModalAfterOpen(editingId) {
    // Find the activity/category for editing event
    var existing = editingId ? events.find(function (x) { return x.id === editingId; }) : null;
    var currentActivity = existing ? (existing.activity || '') : '';
    var currentCategory = existing ? (existing.category || '') : '';

    swapCategoryForPicker(currentActivity, currentCategory);

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
    if (!title)    { toast('Title is required', 'error'); return; }
    if (!date)     { toast('Date is required', 'error'); return; }
    if (!activity) { toast('Activity is required', 'error'); return; }

    var startsAt = buildStartsAt(date, get('time'));
    var photoSlot = document.getElementById('listing-photo-slot');
    var heroUrl = (photoSlot && photoSlot.dataset.url) ? photoSlot.dataset.url : null;
    if (heroUrl === '') heroUrl = null;
    var capRaw = get('capacity');
    var capacity = capRaw ? parseInt(capRaw, 10) : null;
    if (capacity != null && isNaN(capacity)) capacity = null;

    var payload = {
      title: title,
      description: get('description') || null,
      about: get('about') || null,
      activity: activity,
      category: category || null,
      fitness_level: get('intensity') || null,
      starts_at: startsAt,
      venue: get('venue') || null,
      city: get('city') || null,
      area: get('area') || null,
      setting: get('setting') || null,
      capacity: capacity,
      cost: get('cost') || null,
      parking: get('parking') || null,
      facilities: get('facilities') || null,
      bring: get('bring') || null,
      hero_image_url: heroUrl
    };

    var reapprovalNote = '';
    try {
      if (id) {
        var existing = events.find(function (x) { return x.id === id; });
        if (existing && (existing.status === 'live' || existing.status === 'paused')) {
          payload.status = 'pending';
          reapprovalNote = ' (sent back for re-approval)';
        }
        var upd = await window.supabase.from('events').update(payload).eq('id', id);
        if (upd.error) throw upd.error;
        toast('Event updated' + reapprovalNote, 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
      } else {
        payload.provider_id = window.FFP_PROVIDER.id;
        payload.status = 'pending';
        var ins = await window.supabase.from('events').insert(payload).select().single();
        if (ins.error) throw ins.error;
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
        var res = await window.supabase.from('events').delete().eq('id', id);
        if (res.error) throw res.error;
        toast('Event deleted', 'success');
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
      console.log('[FFP Provider Events v5] Loaded from Supabase \u2713');
    } catch (e) {
      console.error('[FFP Provider Events] initial load:', e);
    }

    // Wrap openEventModal to swap category → activity picker + remove who_for + show re-approval note
    var origOpenEventModal = window.openEventModal;
    window.openEventModal = function (id) {
      try { origOpenEventModal(id); } catch (e) { console.error('[FFP Provider Events] orig modal:', e); }
      setTimeout(function () {
        patchModalAfterOpen(id);
        showReapprovalNoteIfNeeded(id);
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

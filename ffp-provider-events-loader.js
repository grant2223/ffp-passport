/* FFP Provider Events Loader — v2
   v2 changes (Grant's feedback):
   - Categories swapped to FFP-ACTIVITY-TAXONOMY 23 (was ad-hoc Fitness/Padel/etc)
   - Category is REQUIRED — validated before save
   - RE-APPROVAL on edit: if existing status was 'live' or 'paused', UPDATE forces status='pending'
   - Same scrollbar + dark dropdown CSS as v1
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
      '.modal select option:checked, .modal-body select option:checked{background:#2ba8e0 !important;color:#082335 !important;}'
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
      .select('id, provider_id, title, description, about, category, fitness_level, group_filter, hero_image_url, city, venue, area, setting, starts_at, ends_at, capacity, price_aed, cost, parking, facilities, bring, who_for, status, featured, created_at, updated_at')
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

  // ─── Patch the existing openEventModal to swap categories after it opens ───
  function patchModalCategories() {
    var sel = document.getElementById('em-category');
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML =
      '<option value="">Choose category…</option>' +
      FFP_CATEGORIES.map(function (c) {
        return '<option value="' + escHtml(c) + '"' + (current === c ? ' selected' : '') + '>' + escHtml(c) + '</option>';
      }).join('');

    // Inject re-approval notice if editing a live/paused event
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
    var category = get('category');
    if (!title)    { toast('Title is required', 'error'); return; }
    if (!date)     { toast('Date is required', 'error'); return; }
    if (!category) { toast('Category is required', 'error'); return; }

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
      category: category,
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
      who_for: get('who') || null,
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
      console.log('[FFP Provider Events v2] Loaded from Supabase \u2713');
    } catch (e) {
      console.error('[FFP Provider Events] initial load:', e);
    }

    // Wrap openEventModal to swap categories + show re-approval note
    var origOpenEventModal = window.openEventModal;
    window.openEventModal = function (id) {
      try { origOpenEventModal(id); } catch (e) { console.error('[FFP Provider Events] orig modal:', e); }
      setTimeout(function () {
        patchModalCategories();
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

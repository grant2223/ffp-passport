/* FFP Provider Events Loader — v1
   Wires the provider dashboard's Events panel to real Supabase data.

   Add ONE script tag to ffp-provider-dashboard.html (already added per the global block):
     <script src="ffp-provider-events-loader.js"></script>

   What it does:
   - Waits for FFP_PROVIDER, fetches events WHERE provider_id = me
   - Replaces the in-memory `events` array, calls renderEvents() to repaint
   - Overrides saveEvent() to INSERT new events / UPDATE existing rows
   - Overrides confirmDeleteEvent() to DELETE from DB
   - Combines em-date + em-time into starts_at (timestamptz)
   - Maps form fields → real schema columns (fitness_level not "intensity", etc.)
   - Kills native scrollbars on this page (FFP rule)
   - Darkens browser-native dropdowns inside the modal

   Required SQL (run once — see message): adds 8 form-only columns + RLS.

   On insert: status='pending', provider_id=me. Admin approves → status='live'.
   RSVP counts deferred (Phase 2 Check-ins panel) — shows 0 for now.
*/
(function () {
  'use strict';

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

  function injectStyles() {
    if (document.getElementById('ffp-provider-events-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-provider-events-css';
    css.textContent = [
      // Kill all native scrollbars — FFP-wide rule
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',
      // Kill horizontal overflow on the events panel
      '#panel-events{overflow-x:hidden;}',
      // Native selects inside modal: dark
      '.modal select, .modal .select, .modal-body select, .modal-body .select{color-scheme:dark;}',
      '.modal select option, .modal-body select option{background:#0f1e2e !important;color:#f5f7fa !important;}',
      '.modal select option:checked, .modal-body select option:checked{background:#2ba8e0 !important;color:#082335 !important;}'
    ].join('');
    document.head.appendChild(css);
  }

  // ─── Map DB row → in-memory shape used by renderEvents() ───
  function mapForUi(row) {
    var d = null, t = '';
    if (row.starts_at) {
      var dt = new Date(row.starts_at);
      if (!isNaN(dt.getTime())) {
        // Use local time (Dubai for FFP) — ISO without TZ for date input
        var yyyy = dt.getFullYear();
        var mm = String(dt.getMonth() + 1).padStart(2, '0');
        var dd = String(dt.getDate()).padStart(2, '0');
        var hh = String(dt.getHours()).padStart(2, '0');
        var mn = String(dt.getMinutes()).padStart(2, '0');
        d = yyyy + '-' + mm + '-' + dd;
        t = hh + ':' + mn;
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
      rsvps: 0,  // Real counts wired in Phase 2 (Check-ins)
      capacity_pct: 0,
      created_at: row.created_at ? row.created_at.slice(0, 10) : '',
      _raw: row
    };
  }

  // ─── Fetch events for this provider ───
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
    if (typeof events === 'undefined') {
      console.warn('[FFP Provider Events] in-memory events array not defined yet');
      return;
    }
    var rows = await fetchEvents();
    // Replace in-memory array
    events.length = 0;
    rows.forEach(function (r) { events.push(r); });
    if (typeof window.renderEvents === 'function') {
      try { window.renderEvents(); } catch (e) {}
    }
    if (typeof window.renderNav === 'function') {
      try { window.renderNav(); } catch (e) {}
    }
  }

  // ─── Save (INSERT or UPDATE) ───
  function buildStartsAt(dateStr, timeStr) {
    if (!dateStr) return null;
    var t = (timeStr && timeStr.length >= 4) ? timeStr : '00:00';
    // Construct as local-time ISO. Browser interprets as local TZ.
    // For provider in UAE, this stores the correct moment in UTC.
    var d = new Date(dateStr + 'T' + t + ':00');
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function realSaveEvent(id) {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) {
      toast('Provider not loaded', 'error');
      return;
    }
    var get = function (key) {
      var el = document.getElementById('em-' + key);
      return el ? (el.value || '').trim() : '';
    };

    var title = get('title');
    var date  = get('date');
    if (!title) { toast('Title is required', 'error'); return; }
    if (!date)  { toast('Date is required', 'error'); return; }

    var time = get('time');
    var startsAt = buildStartsAt(date, time);

    var photoSlot = document.getElementById('listing-photo-slot');
    var heroUrl = (photoSlot && photoSlot.dataset.url) ? photoSlot.dataset.url : null;
    if (heroUrl === '') heroUrl = null;

    var capRaw = get('capacity');
    var capacity = capRaw ? parseInt(capRaw, 10) : null;
    if (capacity != null && isNaN(capacity)) capacity = null;

    var payload = {
      title:           title,
      description:     get('description') || null,
      about:           get('about') || null,
      category:        get('category') || null,
      fitness_level:   get('intensity') || null,
      starts_at:       startsAt,
      venue:           get('venue') || null,
      city:            get('city') || null,
      area:            get('area') || null,
      setting:         get('setting') || null,
      capacity:        capacity,
      cost:            get('cost') || null,
      parking:         get('parking') || null,
      facilities:      get('facilities') || null,
      bring:           get('bring') || null,
      who_for:         get('who') || null,
      hero_image_url:  heroUrl
    };

    try {
      if (id) {
        // UPDATE
        var upd = await window.supabase.from('events').update(payload).eq('id', id);
        if (upd.error) throw upd.error;
        toast('Event updated', 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
      } else {
        // INSERT
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
      if (/policy|permission|denied|rls/i.test(msg)) {
        msg = 'Save blocked by RLS — check events policies + provider status';
      } else if (/does not exist/i.test(msg)) {
        msg = 'Schema mismatch — see console';
      }
      toast(msg, 'error');
    }
  }

  // ─── Delete ───
  async function realDeleteEvent(id) {
    if (!id) return;
    if (typeof window.openConfirm === 'function') {
      window.openConfirm('Delete this event?', 'Members with RSVPs will be notified. This cannot be undone.', async function () {
        await doDelete(id);
      });
    } else {
      if (!confirm('Delete this event?')) return;
      await doDelete(id);
    }
  }
  async function doDelete(id) {
    try {
      var res = await window.supabase.from('events').delete().eq('id', id);
      if (res.error) throw res.error;
      toast('Event deleted', 'success');
      await refresh();
    } catch (e) {
      console.error('[FFP Provider Events] delete:', e);
      toast(e.message || 'Delete failed', 'error');
    }
  }

  // ─── Init ───
  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth &&
             typeof window.renderEvents === 'function' &&
             typeof events !== 'undefined';
    }, 15000);
    if (!ok) {
      console.error('[FFP Provider Events] dependencies never loaded');
      return;
    }

    var authed = await waitFor(function () {
      return !!(window.FFP_PROVIDER && window.FFP_PROVIDER.id);
    }, 30000);
    if (!authed) {
      console.warn('[FFP Provider Events] FFP_PROVIDER not set — provider not authenticated');
      return;
    }

    injectStyles();

    // Replace in-memory demo with real data
    try {
      await refresh();
      console.log('[FFP Provider Events v1] Loaded from Supabase \u2713');
    } catch (e) {
      console.error('[FFP Provider Events] initial load:', e);
    }

    // Override save + delete
    window.saveEvent = realSaveEvent;
    window.confirmDeleteEvent = realDeleteEvent;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

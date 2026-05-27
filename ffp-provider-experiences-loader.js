/* FFP Provider Experiences Loader — v1
   Wires the provider dashboard's Experiences panel to real Supabase data.

   Conforms to FFP rules captured in memory:
   - Category from FFP-ACTIVITY-TAXONOMY 23 — REQUIRED
   - Re-approval on edit of approved/live content (status → pending)
   - No native scrollbars; dark dropdowns in the modal

   Schema additions (run once):
     experiences.overview (text), country, category, what_included (text), flights_info (text)
   Plus RLS for own / admin / public-select.

   Form ↔ DB mapping:
     xm-title           → title
     xm-description     → description
     xm-overview        → overview              (new column)
     xm-category        → category              (new column, REQUIRED, taxonomy)
     xm-type            → exp_type              (Format: Fitness/Adventure/Wellness/Retreat/...)
     xm-fitness-level   → fitness_level
     xm-start, xm-end   → starts_at, ends_at    (date)
     xm-country         → country               (new column)
     xm-destination     → destination
     xm-price           → price_aed
     xm-capacity        → capacity
     includes chips     → what_included         (newline-joined text)
     excludes chips     → what_not_included     (newline-joined text)
     xm-accommodation   → accommodation
     xm-flights         → flights_info          (new column; flights_included boolean unused for now)
     xm-travel-reqs     → travel_reqs
     xm-fitness-reqs    → fitness_reqs
     itinerary builder  → itinerary             (jsonb)
     photo              → hero_image_url
*/
(function () {
  'use strict';

  var FFP_CATEGORIES = [
    'Running & walking', 'Athletics & track', 'Cycling', 'Swimming', 'Watersports',
    'Racquet sports', 'Team sports', 'Combat sports', 'Gymnastics', 'Strength & fitness',
    'Mind-body & yoga', 'Dance & rhythm', 'Outdoor & adventure', 'Recovery & wellness',
    'Golf', 'Equestrian', 'Shooting & target sports', 'Cue & precision sports',
    'Air & extreme', 'Snow sports', 'Motorsports', 'Skateboard & roller', 'Multi-sport & events'
  ];

  var EXP_FORMATS = ['Fitness', 'Adventure', 'Wellness', 'Retreat', 'Sports Event', 'Hybrid'];
  var FITNESS_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite', 'Professional'];

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Provider Experiences]', msg);
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
  function arrFromText(s) {
    if (!s) return [];
    return String(s).split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 0; });
  }
  function textFromArr(a) {
    if (!a || !a.length) return null;
    return a.filter(function (x) { return x && String(x).trim(); }).join('\n') || null;
  }

  function injectStyles() {
    if (document.getElementById('ffp-provider-experiences-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-provider-experiences-css';
    css.textContent = [
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',
      '#panel-experiences{overflow-x:hidden;}',
      '.modal select, .modal .select, .modal-body select, .modal-body .select{color-scheme:dark;}',
      '.modal select option, .modal-body select option{background:#0f1e2e !important;color:#f5f7fa !important;}',
      '.modal select option:checked, .modal-body select option:checked{background:#2ba8e0 !important;color:#082335 !important;}',
      'input.input[type="date"]{color-scheme:dark;}'
    ].join('');
    document.head.appendChild(css);
  }

  // ─── DB → UI shape ───
  function mapForUi(row) {
    return {
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      overview: row.overview || '',
      category: row.category || '',
      experience_type: row.exp_type || 'Fitness',
      start_date: row.starts_at || '',
      end_date: row.ends_at || '',
      duration_days: row.duration_days || 0,
      country: row.country || '',
      destination: row.destination || '',
      price_aed: row.price_aed || '',
      price_includes: arrFromText(row.what_included),
      price_excludes: arrFromText(row.what_not_included),
      accommodation: row.accommodation || '',
      flights: row.flights_info || '',
      travel_reqs: row.travel_reqs || '',
      fitness_reqs: row.fitness_reqs || '',
      fitness_level: row.fitness_level || 'Beginner',
      itinerary: Array.isArray(row.itinerary) ? row.itinerary : [],
      hero_url: row.hero_image_url || null,
      status: row.status || 'pending',
      verified: row.status === 'live',
      featured: !!row.featured,
      applications: 0,  // Wired in Phase 2
      capacity: row.capacity || 0,
      created_at: row.created_at ? row.created_at.slice(0, 10) : '',
      _raw: row
    };
  }

  async function fetchExperiences() {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) return [];
    var providerId = window.FFP_PROVIDER.id;
    var res = await window.supabase
      .from('experiences')
      .select('id, provider_id, title, description, overview, exp_type, category, hero_image_url, destination, country, starts_at, ends_at, duration_days, price_aed, what_not_included, what_included, itinerary, accommodation, flights_info, flights_included, travel_reqs, fitness_reqs, fitness_level, packing_list, good_to_know, capacity, status, featured, created_at, updated_at')
      .eq('provider_id', providerId)
      .order('starts_at', { ascending: true });
    if (res.error) {
      console.error('[FFP Provider Experiences] fetch:', res.error);
      toast('Could not load experiences', 'error');
      return [];
    }
    return (res.data || []).map(mapForUi);
  }

  async function refresh() {
    if (typeof experiences === 'undefined') return;
    var rows = await fetchExperiences();
    experiences.length = 0;
    rows.forEach(function (r) { experiences.push(r); });
    if (typeof window.renderExperiences === 'function') { try { window.renderExperiences(); } catch (e) {} }
    if (typeof window.renderNav === 'function')         { try { window.renderNav();         } catch (e) {} }
  }

  // ─── Replacement openExperienceModal — adds Category, keeps everything else ───
  function realOpenExperienceModal(id) {
    var editing = id ? experiences.find(function (x) { return x.id === id; }) : null;
    var e = editing || {
      title: '', description: '', overview: '', experience_type: 'Fitness', category: '',
      start_date: '', end_date: '',
      country: '', destination: '', price_aed: '',
      price_includes: [], price_excludes: [],
      accommodation: '', flights: '', travel_reqs: '',
      fitness_reqs: '', fitness_level: 'Beginner',
      itinerary: [], hero_url: null, capacity: '', status: ''
    };
    // Bridge the page-level mutable arrays
    window.modalItinerary = JSON.parse(JSON.stringify(e.itinerary || []));
    window.modalIncludes  = (e.price_includes || []).slice();
    window.modalExcludes  = (e.price_excludes || []).slice();

    var body =
      '<div class="form-section">' +
        '<div class="form-section-title">Photo</div>' +
        '<div id="listing-photo-slot" data-url="' + escHtml(e.hero_url || '') + '"></div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">Overview</div>' +
        '<div class="form-grid">' +
          '<div class="field full">' +
            '<div class="label">Title <span class="req">*</span></div>' +
            '<input class="input" id="xm-title" value="' + escHtml(e.title) + '" placeholder="e.g. Hatta Mountain Endurance Camp">' +
          '</div>' +
          '<div class="field full">' +
            '<div class="label">Short description</div>' +
            '<input class="input" id="xm-description" value="' + escHtml(e.description) + '" placeholder="One-sentence summary">' +
          '</div>' +
          '<div class="field full">' +
            '<div class="label">Overview</div>' +
            '<textarea class="textarea" id="xm-overview" rows="4" placeholder="The full story — what makes this experience unique">' + escHtml(e.overview) + '</textarea>' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">Category <span class="req">*</span></div>' +
            '<select class="select" id="xm-category">' +
              '<option value="">Choose category…</option>' +
              FFP_CATEGORIES.map(function (c) {
                return '<option value="' + escHtml(c) + '"' + (e.category === c ? ' selected' : '') + '>' + escHtml(c) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">Format <span class="label-hint">— optional</span></div>' +
            '<select class="select" id="xm-type">' +
              EXP_FORMATS.map(function (t) {
                return '<option value="' + escHtml(t) + '"' + (e.experience_type === t ? ' selected' : '') + '>' + escHtml(t) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">Fitness level required</div>' +
            '<select class="select" id="xm-fitness-level">' +
              FITNESS_LEVELS.map(function (l) {
                return '<option value="' + escHtml(l) + '"' + (e.fitness_level === l ? ' selected' : '') + '>' + escHtml(l) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">When &amp; where</div>' +
        '<div class="form-grid">' +
          '<div class="field"><div class="label">Start date <span class="req">*</span></div>' +
            '<input class="input" type="date" id="xm-start" value="' + escHtml(e.start_date) + '"></div>' +
          '<div class="field"><div class="label">End date <span class="req">*</span></div>' +
            '<input class="input" type="date" id="xm-end" value="' + escHtml(e.end_date) + '"></div>' +
          '<div class="field"><div class="label">Country</div>' +
            '<input class="input" id="xm-country" value="' + escHtml(e.country) + '" placeholder="e.g. United Arab Emirates"></div>' +
          '<div class="field"><div class="label">Destination</div>' +
            '<input class="input" id="xm-destination" value="' + escHtml(e.destination) + '" placeholder="e.g. Hatta, Dubai"></div>' +
        '</div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">Price</div>' +
        '<div class="form-grid">' +
          '<div class="field"><div class="label">Price per person (AED) <span class="req">*</span></div>' +
            '<input class="input" type="number" id="xm-price" value="' + escHtml(e.price_aed) + '" placeholder="e.g. 1850"></div>' +
          '<div class="field"><div class="label">Capacity</div>' +
            '<input class="input" type="number" id="xm-capacity" value="' + escHtml(e.capacity) + '" placeholder="e.g. 16"></div>' +
          '<div class="field full"><div class="label">What\'s included</div>' +
            '<div class="chip-input-wrap" id="xm-includes-wrap"></div></div>' +
          '<div class="field full"><div class="label">What\'s NOT included</div>' +
            '<div class="chip-input-wrap" id="xm-excludes-wrap"></div></div>' +
        '</div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">Itinerary</div>' +
        '<div class="itin-wrap" id="xm-itinerary"></div>' +
        '<button class="itin-add-day" type="button" onclick="addItinDay()"><span class="ms">add</span> Add a day</button>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">Practical info</div>' +
        '<div class="form-grid">' +
          '<div class="field full"><div class="label">Accommodation</div>' +
            '<textarea class="textarea" id="xm-accommodation" rows="2" placeholder="Where members stay, room type, amenities">' + escHtml(e.accommodation) + '</textarea></div>' +
          '<div class="field full"><div class="label">Flights / Transport</div>' +
            '<textarea class="textarea" id="xm-flights" rows="2" placeholder="Are flights included? Group transport? Self-arrival?">' + escHtml(e.flights) + '</textarea></div>' +
          '<div class="field full"><div class="label">Travel requirements</div>' +
            '<textarea class="textarea" id="xm-travel-reqs" rows="2" placeholder="Visas, vaccinations, insurance">' + escHtml(e.travel_reqs) + '</textarea></div>' +
          '<div class="field full"><div class="label">Fitness requirements</div>' +
            '<textarea class="textarea" id="xm-fitness-reqs" rows="2" placeholder="What members should be able to do before joining">' + escHtml(e.fitness_reqs) + '</textarea></div>' +
        '</div>' +
      '</div>' +
      (editing && (e.status === 'live' || e.status === 'paused')
        ? '<div class="help-strip" style="margin-top:14px;"><span class="ms">info</span><div><b>This experience is approved.</b> Saving changes will send it back to admin for re-approval.</div></div>'
        : '');

    var foot =
      (editing ? '<button class="btn btn-ghost left" onclick="confirmDeleteExperience(\'' + editing.id + '\'); closeModal()"><span class="ms">delete</span> Delete</button>' : '') +
      '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-pri" onclick="saveExperience(\'' + (editing ? editing.id : '') + '\')">' +
        (editing ? 'Save changes' : 'Submit for review') +
      '</button>';

    if (typeof window.openModalShell === 'function') {
      window.openModalShell('lg', (editing ? 'Edit experience' : 'New experience'), body, foot);
    }
    if (typeof window.renderListingUploader === 'function') {
      try { window.renderListingUploader(e.hero_url); } catch (er) {}
    }
    if (typeof window.renderItinerary === 'function') {
      try { window.renderItinerary(); } catch (er) {}
    }
    if (typeof window.renderChips === 'function') {
      try { window.renderChips('xm-includes-wrap', window.modalIncludes, 'includes'); } catch (er) {}
      try { window.renderChips('xm-excludes-wrap', window.modalExcludes, 'excludes'); } catch (er) {}
    }
  }

  // ─── Save ───
  function computeDurationDays(startDate, endDate) {
    if (!startDate || !endDate) return null;
    var s = new Date(startDate);
    var e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    return Math.max(1, Math.round((e - s) / 86400000) + 1);
  }

  async function realSaveExperience(id) {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) { toast('Provider not loaded', 'error'); return; }
    var get = function (key) {
      var el = document.getElementById('xm-' + key);
      return el ? (el.value || '').trim() : '';
    };

    var title    = get('title');
    var category = get('category');
    var start    = get('start');
    var end      = get('end');
    var price    = get('price');

    if (!title)    { toast('Title is required', 'error'); return; }
    if (!category) { toast('Category is required', 'error'); return; }
    if (!start)    { toast('Start date is required', 'error'); return; }
    if (!end)      { toast('End date is required', 'error'); return; }
    if (!price)    { toast('Price is required', 'error'); return; }

    var photoSlot = document.getElementById('listing-photo-slot');
    var heroUrl = (photoSlot && photoSlot.dataset.url) ? photoSlot.dataset.url : null;
    if (heroUrl === '') heroUrl = null;

    var capRaw = get('capacity');
    var capacity = capRaw ? parseInt(capRaw, 10) : null;
    if (capacity != null && isNaN(capacity)) capacity = null;

    var priceNum = parseFloat(price);
    if (isNaN(priceNum)) priceNum = null;

    var payload = {
      title:           title,
      description:     get('description') || null,
      overview:        get('overview') || null,
      category:        category,
      exp_type:        get('type') || null,
      fitness_level:   get('fitness-level') || null,
      starts_at:       start,
      ends_at:         end,
      duration_days:   computeDurationDays(start, end),
      country:         get('country') || null,
      destination:     get('destination') || null,
      price_aed:       priceNum,
      capacity:        capacity,
      what_included:     textFromArr(window.modalIncludes),
      what_not_included: textFromArr(window.modalExcludes),
      accommodation:   get('accommodation') || null,
      flights_info:    get('flights') || null,
      travel_reqs:     get('travel-reqs') || null,
      fitness_reqs:    get('fitness-reqs') || null,
      itinerary:       Array.isArray(window.modalItinerary) ? window.modalItinerary : [],
      hero_image_url:  heroUrl
    };

    var reapprovalNote = '';
    try {
      if (id) {
        var existing = experiences.find(function (x) { return x.id === id; });
        if (existing && (existing.status === 'live' || existing.status === 'paused')) {
          payload.status = 'pending';
          reapprovalNote = ' (sent back for re-approval)';
        }
        var upd = await window.supabase.from('experiences').update(payload).eq('id', id);
        if (upd.error) throw upd.error;
        toast('Experience updated' + reapprovalNote, 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
      } else {
        payload.provider_id = window.FFP_PROVIDER.id;
        payload.status = 'pending';
        payload.featured = false;
        var ins = await window.supabase.from('experiences').insert(payload).select().single();
        if (ins.error) throw ins.error;
        if (typeof window.closeModal === 'function') window.closeModal();
        if (typeof window.showSubmittedModal === 'function') {
          try { window.showSubmittedModal('experience'); } catch (er) {}
        } else {
          toast('Submitted for review', 'success');
        }
      }
      await refresh();
    } catch (e) {
      console.error('[FFP Provider Experiences] save:', e);
      var msg = e.message || 'Save failed';
      if (/policy|permission|denied|rls/i.test(msg)) msg = 'Save blocked by RLS';
      else if (/does not exist/i.test(msg))         msg = 'Schema mismatch — run the experiences SQL';
      toast(msg, 'error');
    }
  }

  async function realDeleteExperience(id) {
    if (!id) return;
    var doDelete = async function () {
      try {
        var res = await window.supabase.from('experiences').delete().eq('id', id);
        if (res.error) throw res.error;
        toast('Experience deleted', 'success');
        await refresh();
      } catch (e) {
        console.error('[FFP Provider Experiences] delete:', e);
        toast(e.message || 'Delete failed', 'error');
      }
    };
    if (typeof window.openConfirm === 'function') {
      window.openConfirm('Delete this experience?', 'Members who applied keep their record, but no new applications can be made.', doDelete);
    } else {
      if (confirm('Delete this experience?')) await doDelete();
    }
  }

  // ─── Init ───
  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth &&
             typeof window.renderExperiences === 'function' &&
             typeof experiences !== 'undefined';
    }, 15000);
    if (!ok) { console.error('[FFP Provider Experiences] dependencies never loaded'); return; }

    var authed = await waitFor(function () {
      return !!(window.FFP_PROVIDER && window.FFP_PROVIDER.id);
    }, 30000);
    if (!authed) { console.warn('[FFP Provider Experiences] FFP_PROVIDER not set'); return; }

    injectStyles();

    try {
      await refresh();
      console.log('[FFP Provider Experiences v1] Loaded from Supabase \u2713');
    } catch (e) {
      console.error('[FFP Provider Experiences] initial load:', e);
    }

    window.openExperienceModal       = realOpenExperienceModal;
    window.saveExperience            = realSaveExperience;
    window.confirmDeleteExperience   = realDeleteExperience;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

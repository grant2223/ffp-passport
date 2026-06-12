/* FFP Provider TOURS & CLASSES Loader (the `classes` table — one-off Tours + recurring Classes) — v5 (2026-06-12)
   v5: BOOKABLE DATES + Tours/Classes views. (1) The form now captures DATE(S) → creates class_sessions via
       provider_save_class_session (Tour = 1 date, Class = add many); edits load via provider_list_class_sessions
       and can add/remove (provider_delete_class_session). This is what makes a listing actually bookable
       (members book item_type='class_session'). (2) One panel, two views — setClassView('tour'|'class') filters
       the list; Tours = subtype 'tour'/legacy null, Classes = subtype 'class'.
   v4: TOURS-ONLY — this module is now the partner "Tours" tab (one-off activities: jet ski, bungy, canyoning).
       Recurring CLASSES moved to the Sessions tab (provider_sessions). Default listing_subtype='tour'; all
       user-facing copy/toasts say "tour"; empty state → New tour.
   v3: CLASS vs TOUR — openClassModal(id, newSubtype) tags new listings as 'class' (recurring: yoga/tennis/group
       class) or 'tour' (one-off: jet ski/bungy/canyoning); modal title says "New class"/"New tour"/"Edit …";
       hidden #cm-subtype carries it; on save, provider_set_class_subtype persists classes.listing_subtype (the
       shared field the booking platform splits Classes vs Tours on). Cards show a Class/Tour tag; fetch includes it.
   v2: LEVELS + CITY PICKER — (1) replaced the orphan "Difficulty" box (Beginner/Intermediate/Advanced/All
       levels) with "Fitness level required" reading window.FFP_TAX.attendeeLevels (Not Tried/Social/
       Competitive/Representative/Professional + All Levels) and saving to fitness_level — the SAME connected
       scale as a member's own ability (verified provider_save_listing class branch persists fitness_level).
       (2) Country/City native dropdowns replaced with the shared searchable picker (window.FFPPicker) — the
       same component as Trips and the activity field — so every listing form looks and behaves identically.
   v1 (2026-06-12)
   The partner create/edit form for single-session classes & tours (the `classes` table, shown to members as
   "Experiences" on findfitpeople.com). Self-contained modal via openModalShell, full GetYourGuide-parity fields.
   Save: provider_save_listing kind='class' (new rows insert as DRAFT). Publish/unpublish: provider_set_listing_status.
   Delete: provider_delete_listing kind='class'. Duplicate: dashboard duplicateListing('class', id) → provider_duplicate_listing.
   Renders cards into #cls-grid (panel-classes). Lazy-loaded by ensureProviderLoader('classes'). */
(function () {
  'use strict';
  function sb() { return window.supabase; }
  function provId() { return (window.FFP_PROVIDER || {}).id; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function toast(m, k) { if (typeof window.showToast === 'function') { try { window.showToast(m, k || 'info'); return; } catch (e) {} } console.log('[FFP Classes]', m); }
  function arrFromText(s) { return s ? String(s).split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x.length; }) : []; }
  function joinArr(a) { return (Array.isArray(a) ? a : []).join('\n'); }
  function intn(v) { return v ? (isNaN(parseInt(v, 10)) ? null : parseInt(v, 10)) : null; }
  function num(v) { return v ? (isNaN(parseFloat(v)) ? null : parseFloat(v)) : null; }

  // Fallback only — the canonical level list is window.FFP_TAX.attendeeLevels (the member ability scale +
  // "All Levels"). The form saves the chosen value to fitness_level so it connects to a member's ability.
  var FITNESS_LEVELS = ['All Levels', 'Not Tried', 'Social', 'Competitive', 'Representative', 'Professional'];

  // Tracks the session-date ids loaded into the open modal, so we can delete any the partner removed.
  var _cmSessOrig = [];

  // ── data ──
  async function fetchClasses() {
    if (!provId()) return [];
    var res = await sb().from('classes')
      .select('id, provider_id, title, description, category, activity, venue, city, country, duration_min, capacity, price_aed, hero_image_url, status, booking_source, highlights, what_included, what_not_included, meeting_point, meeting_lat, meeting_lng, what_to_bring, not_allowed, know_before, languages, min_age, difficulty, fitness_level, wheelchair_accessible, accessibility_notes, free_cancellation_hours, cancellation_policy, distance_km, listing_subtype, created_at')
      .eq('provider_id', provId())
      .order('created_at', { ascending: false });
    if (res.error) { console.error('[FFP Classes] fetch', res.error); toast('Could not load tours', 'error'); return []; }
    return res.data || [];
  }
  async function refresh() {
    var rows = await fetchClasses();
    if (!Array.isArray(window.classesList)) window.classesList = [];
    window.classesList.length = 0;
    rows.forEach(function (r) { window.classesList.push(r); });
    renderClasses();
    if (typeof window.renderNav === 'function') { try { window.renderNav(); } catch (e) {} }
  }

  // Which view is showing: 'tour' (one-off Tours) or 'class' (recurring Classes). Both = the classes table.
  var _clsView = 'tour';
  window.setClassView = function (v) {
    _clsView = (v === 'class') ? 'class' : 'tour';
    var tt = document.getElementById('cls-tab-tour'), tc = document.getElementById('cls-tab-class');
    if (tt) tt.classList.toggle('active', _clsView === 'tour');
    if (tc) tc.classList.toggle('active', _clsView === 'class');
    renderClasses();
  };

  // ── list render ──
  function renderClasses() {
    var grid = document.getElementById('cls-grid');
    if (!grid) return;
    var all = Array.isArray(window.classesList) ? window.classesList : [];
    // Tours = subtype 'tour' (or legacy null); Classes = subtype 'class'.
    var list = all.filter(function (c) { return _clsView === 'class' ? c.listing_subtype === 'class' : c.listing_subtype !== 'class'; });
    var sEl = document.getElementById('cls-search');
    var q = (sEl && sEl.value || '').trim().toLowerCase();
    var items = q ? list.filter(function (c) { return (c.title || '').toLowerCase().indexOf(q) >= 0 || (c.activity || '').toLowerCase().indexOf(q) >= 0; }) : list;
    var isClass = _clsView === 'class';
    if (!items.length) {
      if (typeof window.emptyState === 'function') {
        grid.innerHTML = list.length
          ? window.emptyState('No matches', 'Try a different search.', '', '')
          : (isClass
              ? window.emptyState('No classes yet', 'Recurring sessions members book — yoga, tennis lessons, group fitness. Add your first one (with its dates).', 'New class', 'openCreateClass(\'class\')')
              : window.emptyState('No tours yet', 'One-off activities members book — jet ski, bungy, canyoning, a guided tour. Add your first one (with its date).', 'New tour', 'openCreateClass(\'tour\')'));
      } else {
        grid.innerHTML = '<div style="padding:40px;text-align:center;color:#9dbdd0;">' + (list.length ? 'No matches' : (isClass ? 'No classes yet' : 'No tours yet')) + '</div>';
      }
      return;
    }
    grid.innerHTML = items.map(classCard).join('');
  }
  function heroStyle(url) { return url ? ('style="background-image:url(\'' + esc(url) + '\')"') : ''; }
  function classCard(c) {
    var st = c.status || 'draft';
    return '<div class="listing-card">' +
      '<div class="lc-hero" ' + heroStyle(c.hero_image_url) + '>' +
        '<div class="lc-status-pill ' + esc(st) + '">' + esc(st) + '</div>' +
        (c.activity ? '<div class="lc-cat-pill">' + esc(c.activity) + '</div>' : '') +
      '</div>' +
      '<div class="lc-body">' +
        '<div class="lc-title">' + esc(c.title || 'Untitled') + '</div>' +
        '<div class="lc-sub">' + esc(c.description || '') + '</div>' +
        '<div class="lc-meta">' +
          (c.listing_subtype ? '<span><span class="ms">' + (c.listing_subtype === 'tour' ? 'tour' : 'fitness_center') + '</span>' + (c.listing_subtype === 'tour' ? 'Tour' : 'Class') + '</span>' : '') +
          (c.city ? '<span><span class="ms">place</span>' + esc(c.city) + '</span>' : '') +
          (c.duration_min ? '<span><span class="ms">schedule</span>' + c.duration_min + ' min</span>' : '') +
          (c.booking_source && c.booking_source !== 'native' ? '<span><span class="ms">sync</span>' + esc(c.booking_source) + '</span>' : '') +
        '</div>' +
        '<div class="lc-stat-row">' +
          '<div class="lc-stat"><div class="lc-stat-val">AED ' + (c.price_aed || 0) + '</div><div class="lc-stat-lbl">Per person</div></div>' +
          '<div class="lc-stat"><div class="lc-stat-val">' + (c.capacity || 0) + '</div><div class="lc-stat-lbl">Capacity</div></div>' +
          '<div class="lc-stat"><div class="lc-stat-val">' + (c.min_age || '—') + '</div><div class="lc-stat-lbl">Min age</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="lc-actions">' +
        '<button class="btn btn-sec btn-sm" onclick="openClassModal(\'' + c.id + '\')"><span class="ms">edit</span> Edit</button>' +
        (st === 'live'
          ? '<button class="btn btn-ghost btn-sm" onclick="setClassStatus(\'' + c.id + '\',\'paused\')"><span class="ms">pause</span> Unpublish</button>'
          : '<button class="btn btn-blue btn-sm" onclick="setClassStatus(\'' + c.id + '\',\'live\')"><span class="ms">publish</span> Go live</button>') +
        '<button class="btn btn-ghost btn-sm" title="Duplicate" onclick="duplicateListing(\'class\',\'' + c.id + '\')"><span class="ms">content_copy</span></button>' +
        '<button class="btn btn-ghost btn-sm" title="Delete" onclick="confirmDeleteClass(\'' + c.id + '\')"><span class="ms">delete</span></button>' +
      '</div>' +
    '</div>';
  }

  // ── modal (create / edit) ──
  function openClassModal(id, newSubtype) {
    var c = (id && Array.isArray(window.classesList)) ? window.classesList.find(function (x) { return x.id === id; }) : null;
    var e = c || {};
    // 'class' = recurring/instructional, 'tour' = one-off activity. Both live in `classes`; the booking
    // platform splits them by this. New listings get it from the create chooser; edits keep the saved value.
    var subtype = (c && c.listing_subtype) || newSubtype || 'tour';
    var kindWord = subtype === 'tour' ? 'tour' : (subtype === 'class' ? 'class' : 'experience');
    var ll = (e.meeting_lat != null && e.meeting_lng != null) ? (e.meeting_lat + ', ' + e.meeting_lng) : '';
    var TAX = window.FFP_TAX || {};
    var cities = TAX.cities || {};
    var countries = Object.keys(cities).sort();
    var selCountry = e.country || (window.providerProfile || {}).country || 'United Arab Emirates';
    if (countries.length && countries.indexOf(selCountry) === -1) selCountry = countries[0];

    var body =
      '<input type="hidden" id="cm-subtype" value="' + esc(subtype) + '">' +
      '<div class="form-section"><div class="form-section-title">Photo</div>' +
        '<div id="listing-photo-slot" data-url="' + esc(e.hero_image_url || '') + '"></div></div>' +
      '<div class="form-section"><div class="form-section-title">Basics</div><div class="form-grid">' +
        '<div class="field full"><div class="label">Title <span class="req">*</span></div>' +
          '<input class="input" id="cm-title" value="' + esc(e.title || '') + '" placeholder="e.g. Sunset Kayak Tour"></div>' +
        '<div class="field full"><div class="label">Short description</div>' +
          '<input class="input" id="cm-description" value="' + esc(e.description || '') + '" placeholder="One-sentence summary members see on the card"></div>' +
        '<div class="field"><div class="label">Activity <span class="req">*</span></div>' +
          '<button type="button" class="ffp-picker-btn placeholder" id="cm-activity-btn" data-value="" data-category=""><span>Choose activity…</span><span class="ms caret">expand_more</span></button></div>' +
        '<div class="field"><div class="label">Fitness level required</div>' +
          '<select class="select" id="cm-fitness-level">' + ((window.FFP_TAX && window.FFP_TAX.attendeeLevels && window.FFP_TAX.attendeeLevels.length) ? window.FFP_TAX.attendeeLevels : FITNESS_LEVELS).map(function (d) { return '<option' + (((e.fitness_level || 'All Levels') === d) ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></div>' +
      '</div></div>' +
      '<div class="form-section"><div class="form-section-title">When &amp; where</div><div class="form-grid">' +
        '<div class="field"><div class="label">Country <span class="req">*</span></div>' +
          '<button type="button" class="ffp-picker-btn placeholder" id="cm-country-btn" data-value=""><span>Choose country…</span><span class="ms caret">expand_more</span></button></div>' +
        '<div class="field"><div class="label">City</div>' +
          '<button type="button" class="ffp-picker-btn placeholder" id="cm-city-btn" data-value="" data-country=""><span>Choose city…</span><span class="ms caret">expand_more</span></button></div>' +
        '<div class="field"><div class="label">Venue</div><input class="input" id="cm-venue" value="' + esc(e.venue || '') + '" placeholder="e.g. Kite Beach"></div>' +
        '<div class="field"><div class="label">Duration (min)</div><input class="input" type="number" id="cm-duration" value="' + esc(e.duration_min || '') + '" placeholder="e.g. 60"></div>' +
        '<div class="field"><div class="label">Capacity</div><input class="input" type="number" id="cm-capacity" value="' + esc(e.capacity || '') + '" placeholder="e.g. 12"></div>' +
        '<div class="field"><div class="label">Price per person (AED) <span class="req">*</span></div><input class="input" type="number" id="cm-price" value="' + esc(e.price_aed != null ? e.price_aed : '') + '" placeholder="e.g. 150"></div>' +
      '</div></div>' +
      '<div class="form-section"><div class="form-section-title">' + (subtype === 'tour' ? 'Date &amp; time' : 'Dates &amp; times') + '</div>' +
        '<div class="psub" style="margin:-4px 0 10px;">' + (subtype === 'tour' ? 'When does this run? Members book this date. (Required for members to be able to book.)' : 'Add each time this class runs — members book a specific date. Add as many as you need. (Required for members to be able to book.)') + '</div>' +
        '<div id="cm-sessions"></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="cm-add-session" style="margin-top:6px;"><span class="ms">add</span> Add ' + (subtype === 'tour' ? 'date' : 'another date') + '</button>' +
      '</div>' +
      '<div class="form-section"><div class="form-section-title">Details</div><div class="form-grid">' +
        '<div class="field full"><div class="label">Highlights <span class="label-hint">— one per line</span></div><textarea class="textarea" id="cm-highlights" rows="3" placeholder="Eiffel-tower views\nAudio guide in 14 languages\nSmall group">' + esc(joinArr(e.highlights)) + '</textarea></div>' +
        '<div class="field full"><div class="label">What\'s included <span class="label-hint">— one per line</span></div><textarea class="textarea" id="cm-includes" rows="3" placeholder="Kayak &amp; paddle\nLife vest\nLocal guide">' + esc(joinArr(e.what_included)) + '</textarea></div>' +
        '<div class="field full"><div class="label">What\'s NOT included <span class="label-hint">— one per line</span></div><textarea class="textarea" id="cm-excludes" rows="2" placeholder="Hotel pickup\nGratuities">' + esc(joinArr(e.what_not_included)) + '</textarea></div>' +
        '<div class="field full"><div class="label">What to bring <span class="label-hint">— one per line</span></div><textarea class="textarea" id="cm-bring" rows="2" placeholder="Swimwear\nTowel\nWater">' + esc(joinArr(e.what_to_bring)) + '</textarea></div>' +
      '</div></div>' +
      '<div class="form-section"><div class="form-section-title">Good to know</div><div class="form-grid">' +
        '<div class="field full"><div class="label">Meeting point</div><input class="input" id="cm-meeting-point" value="' + esc(e.meeting_point || '') + '" placeholder="e.g. Pier 3, by the Bateaux Parisiens sign"></div>' +
        '<div class="field"><div class="label">Map coordinates <span class="label-hint">— paste &quot;lat, lng&quot;</span></div><input class="input" id="cm-latlng" value="' + esc(ll) + '" placeholder="e.g. 25.14, 55.19"></div>' +
        '<div class="field"><div class="label">Minimum age</div><input class="input" type="number" id="cm-min-age" value="' + esc(e.min_age || '') + '" placeholder="e.g. 12"></div>' +
        '<div class="field"><div class="label">Languages <span class="label-hint">— one per line</span></div><textarea class="textarea" id="cm-languages" rows="2" placeholder="English\nArabic">' + esc(joinArr(e.languages)) + '</textarea></div>' +
        '<div class="field"><div class="label">Distance (km) <span class="label-hint">— for tours</span></div><input class="input" type="number" id="cm-distance" value="' + esc(e.distance_km || '') + '" placeholder="e.g. 4"></div>' +
        '<div class="field full"><div class="label">Not allowed <span class="label-hint">— one per line</span></div><textarea class="textarea" id="cm-not-allowed" rows="2" placeholder="Oversized luggage\nPets (assistance dogs OK)">' + esc(joinArr(e.not_allowed)) + '</textarea></div>' +
        '<div class="field full"><div class="label">Know before you go <span class="label-hint">— one per line</span></div><textarea class="textarea" id="cm-know-before" rows="2" placeholder="Departures every 30 min\nArrive 15 min early">' + esc(joinArr(e.know_before)) + '</textarea></div>' +
        '<div class="field"><div class="label">Wheelchair accessible</div><select class="select" id="cm-wheelchair"><option value="">—</option><option value="true"' + (e.wheelchair_accessible === true ? ' selected' : '') + '>Yes</option><option value="false"' + (e.wheelchair_accessible === false ? ' selected' : '') + '>No</option></select></div>' +
        '<div class="field"><div class="label">Free cancellation <span class="label-hint">— hours before</span></div><input class="input" type="number" id="cm-cancel-hours" value="' + esc(e.free_cancellation_hours || '') + '" placeholder="e.g. 24"></div>' +
        '<div class="field full"><div class="label">Accessibility notes</div><input class="input" id="cm-accessibility" value="' + esc(e.accessibility_notes || '') + '" placeholder="e.g. Step-free boarding; accessible WC"></div>' +
        '<div class="field full"><div class="label">Cancellation policy</div><input class="input" id="cm-cancel-policy" value="' + esc(e.cancellation_policy || '') + '" placeholder="e.g. Free cancellation up to 24h before"></div>' +
      '</div></div>';

    var foot =
      (c ? '<button class="btn btn-ghost left" onclick="confirmDeleteClass(\'' + c.id + '\')"><span class="ms">delete</span> Delete</button>' : '') +
      '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-pri" onclick="saveClass(\'' + (c ? c.id : '') + '\')">' + (c ? 'Save changes' : 'Create as draft') + '</button>';

    if (typeof window.openModalShell === 'function') window.openModalShell('lg', (c ? 'Edit ' : 'New ') + kindWord, body, foot);
    if (typeof window.renderListingUploader === 'function') { try { window.renderListingUploader(e.hero_image_url || ''); } catch (er) {} }

    setTimeout(function () {
      var aBtn = document.getElementById('cm-activity-btn');
      if (aBtn) {
        if (e.activity) {
          aBtn.classList.remove('placeholder'); aBtn.dataset.value = e.activity; aBtn.dataset.category = e.category || '';
          aBtn.innerHTML = '<div class="picked"><div class="name">' + esc(e.activity) + '</div>' + (e.category ? '<div class="group">' + esc(e.category) + '</div>' : '') + '</div><span class="ms caret">expand_more</span>';
        }
        aBtn.addEventListener('click', function () {
          if (window.FFPPicker && window.FFPPicker.openActivity) {
            window.FFPPicker.openActivity(aBtn.dataset.value, function (name, cat) {
              aBtn.classList.remove('placeholder'); aBtn.dataset.value = name || ''; aBtn.dataset.category = cat || '';
              aBtn.innerHTML = '<div class="picked"><div class="name">' + esc(name) + '</div>' + (cat ? '<div class="group">' + esc(cat) + '</div>' : '') + '</div><span class="ms caret">expand_more</span>';
            });
          } else { toast('Activity picker not ready', 'error'); }
        });
      }
      // Country + City — shared searchable pickers (same component as Trips & the activity field).
      var coBtn = document.getElementById('cm-country-btn');
      var ciBtn = document.getElementById('cm-city-btn');
      var setBtn = function (btn, val, ph) {
        if (!btn) return;
        btn.dataset.value = val || '';
        if (val) { btn.classList.remove('placeholder'); btn.innerHTML = '<span>' + esc(val) + '</span><span class="ms caret">expand_more</span>'; }
        else { btn.classList.add('placeholder'); btn.innerHTML = '<span>' + ph + '</span><span class="ms caret">expand_more</span>'; }
      };
      var initCountry = e.country || selCountry || '';
      if (initCountry) setBtn(coBtn, initCountry, 'Choose country…');
      if (ciBtn) ciBtn.dataset.country = initCountry;
      if (e.city) setBtn(ciBtn, e.city, 'Choose city…');
      if (coBtn) coBtn.addEventListener('click', function () {
        if (!(window.FFPPicker && window.FFPPicker.openCountry)) { toast('Picker not ready', 'error'); return; }
        window.FFPPicker.openCountry(coBtn.dataset.value, function (name) {
          setBtn(coBtn, name, 'Choose country…');
          if (ciBtn && ciBtn.dataset.country !== name) { ciBtn.dataset.country = name; setBtn(ciBtn, '', 'Choose city…'); }
        });
      });
      if (ciBtn) ciBtn.addEventListener('click', function () {
        if (!(window.FFPPicker && window.FFPPicker.openCity)) { toast('Picker not ready', 'error'); return; }
        window.FFPPicker.openCity(ciBtn.dataset.country || (coBtn ? coBtn.dataset.value : ''), ciBtn.dataset.value, function (name) { setBtn(ciBtn, name, 'Choose city…'); });
      });

      // ── Bookable dates (class_sessions) — members book a specific date ──
      var sessWrap = document.getElementById('cm-sessions');
      var addSessBtn = document.getElementById('cm-add-session');
      _cmSessOrig = [];
      var fmtLocal = function (ts) { if (!ts) return ''; var d = new Date(ts); if (isNaN(d.getTime())) return ''; return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
      var bindSessDel = function () { sessWrap.querySelectorAll('.cm-sess-del').forEach(function (b) { b.onclick = function () { var r = b.closest('.cm-sess-row'); if (r) r.remove(); }; }); };
      var addSessRow = function (val, sid) {
        sessWrap.insertAdjacentHTML('beforeend',
          '<div class="cm-sess-row" data-id="' + esc(sid || '') + '" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">' +
            '<input class="input cm-sess-dt" type="datetime-local" value="' + esc(val || '') + '" style="flex:1;color-scheme:dark;">' +
            '<button type="button" class="btn btn-ghost btn-sm cm-sess-del" title="Remove"><span class="ms">close</span></button>' +
          '</div>');
        bindSessDel();
      };
      if (sessWrap) {
        if (addSessBtn) addSessBtn.onclick = function () { addSessRow('', ''); };
        if (c && c.id) {
          sb().rpc('provider_list_class_sessions', { p_provider: provId(), p_class: c.id }).then(function (r) {
            var rows = (r && r.data) ? r.data : [];
            sessWrap.innerHTML = '';
            if (rows.length) { rows.forEach(function (s) { _cmSessOrig.push(s.id); addSessRow(fmtLocal(s.starts_at), s.id); }); }
            else { addSessRow('', ''); }
          }).catch(function () { addSessRow('', ''); });
        } else {
          addSessRow('', '');
        }
      }
    }, 50);
  }

  // ── save / status / delete ──
  async function saveClass(id) {
    if (!provId()) { toast('Provider not loaded', 'error'); return; }
    var g = function (k) { var el = document.getElementById('cm-' + k); return el ? (el.value || '').trim() : ''; };
    var title = g('title');
    var aBtn = document.getElementById('cm-activity-btn');
    var activity = aBtn ? aBtn.dataset.value : '';
    var category = aBtn ? aBtn.dataset.category : '';
    if (!title) { toast('Title is required', 'error'); return; }
    if (!activity) { toast('Activity is required', 'error'); return; }
    var price = g('price'); if (!price) { toast('Price is required', 'error'); return; }
    var coBtn = document.getElementById('cm-country-btn'), ciBtn = document.getElementById('cm-city-btn');
    var country = coBtn ? (coBtn.dataset.value || '') : '', city = ciBtn ? (ciBtn.dataset.value || '') : '';
    if (!country) { toast('Country is required', 'error'); return; }
    var photoSlot = document.getElementById('listing-photo-slot');
    var heroUrl = (photoSlot && photoSlot.dataset.url) ? photoSlot.dataset.url : null; if (heroUrl === '') heroUrl = null;
    var mLat = null, mLng = null, llv = g('latlng');
    if (llv) { var pp = llv.split(','); if (pp.length >= 2) { var a = parseFloat(pp[0]), b = parseFloat(pp[1]); if (!isNaN(a)) mLat = a; if (!isNaN(b)) mLng = b; } }
    var wheel = g('wheelchair');

    var payload = {
      title: title, description: g('description') || null, activity: activity, category: category || null,
      fitness_level: g('fitness-level') || null, country: country || null, city: city || null, venue: g('venue') || null,
      duration_min: intn(g('duration')), capacity: intn(g('capacity')), price_aed: num(price), hero_image_url: heroUrl,
      highlights: arrFromText(g('highlights')), what_included: arrFromText(g('includes')), what_not_included: arrFromText(g('excludes')),
      what_to_bring: arrFromText(g('bring')), not_allowed: arrFromText(g('not-allowed')), know_before: arrFromText(g('know-before')),
      languages: arrFromText(g('languages')), meeting_point: g('meeting-point') || null, meeting_lat: mLat, meeting_lng: mLng,
      min_age: intn(g('min-age')), distance_km: num(g('distance')), wheelchair_accessible: (wheel === '' ? null : wheel === 'true'),
      accessibility_notes: g('accessibility') || null, free_cancellation_hours: intn(g('cancel-hours')), cancellation_policy: g('cancel-policy') || null
    };
    try {
      var res = await sb().rpc('provider_save_listing', { p_kind: 'class', p_provider: provId(), p_id: id || null, p: payload });
      if (res.error) throw res.error;
      if (!res.data) throw new Error('Save failed — not found or not permitted');
      // Persist the Class/Tour subtype (the shared field the booking platform splits on).
      var subtype = g('subtype');
      if (subtype) { try { await sb().rpc('provider_set_class_subtype', { p_provider: provId(), p_id: res.data, p_subtype: subtype }); } catch (e2) { console.warn('[FFP Classes] subtype', e2); } }
      // Bookable dates → class_sessions (members book a specific date). Tour = one, Class = recurring.
      var _cid = res.data, _dur = intn(g('duration')), _cap = intn(g('capacity')), _kept = [];
      var _rows = Array.prototype.slice.call(document.querySelectorAll('#cm-sessions .cm-sess-row'));
      for (var _i = 0; _i < _rows.length; _i++) {
        var _dt = _rows[_i].querySelector('.cm-sess-dt'); var _val = _dt ? (_dt.value || '').trim() : '';
        if (!_val) continue;
        var _d = new Date(_val); if (isNaN(_d.getTime())) continue;
        var _endIso = _dur ? new Date(_d.getTime() + _dur * 60000).toISOString() : null;
        var _existing = _rows[_i].getAttribute('data-id') || null;
        try {
          var _sr = await sb().rpc('provider_save_class_session', { p_provider: provId(), p_class: _cid, p_id: _existing, p_starts: _d.toISOString(), p_ends: _endIso, p_capacity: _cap });
          if (_sr && _sr.data) _kept.push(_sr.data);
        } catch (e3) { console.warn('[FFP Tours] session save', e3); }
      }
      for (var _j = 0; _j < _cmSessOrig.length; _j++) {
        if (_kept.indexOf(_cmSessOrig[_j]) < 0) { try { await sb().rpc('provider_delete_class_session', { p_provider: provId(), p_id: _cmSessOrig[_j] }); } catch (e4) {} }
      }
      if (typeof window.closeModal === 'function') window.closeModal();
      toast(id ? 'Saved' : 'Saved as a draft — tap “Go live” to publish', 'success');
      await refresh();
    } catch (er) { console.error('[FFP Classes] save', er); toast(er.message || 'Save failed', 'error'); }
  }

  async function setClassStatus(id, status) {
    try {
      var res = await sb().rpc('provider_set_listing_status', { p_kind: 'class', p_provider: provId(), p_id: id, p_status: status });
      if (res.error) throw res.error;
      toast(status === 'live' ? 'Tour is now live' : 'Tour unpublished', 'success');
      await refresh();
    } catch (er) { console.error('[FFP Classes] status', er); toast('Could not update status', 'error'); }
  }

  function confirmDeleteClass(id) {
    var doIt = async function () {
      try {
        var res = await sb().rpc('provider_delete_listing', { p_kind: 'class', p_provider: provId(), p_id: id });
        if (res.error) throw res.error;
        toast('Tour deleted', 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
        await refresh();
      } catch (er) { console.error('[FFP Classes] delete', er); toast('Delete failed', 'error'); }
    };
    if (typeof window.openConfirm === 'function') window.openConfirm('Delete this tour?', 'This cannot be undone.', doIt);
    else if (confirm('Delete this tour?')) doIt();
  }

  // ── expose ──
  window.renderClasses = renderClasses;
  window.openClassModal = openClassModal;
  window.saveClass = saveClass;
  window.setClassStatus = setClassStatus;
  window.confirmDeleteClass = confirmDeleteClass;
  window.FFPReload = window.FFPReload || {};
  window.FFPReload['class'] = refresh;

  // ── init ──
  function waitFor(cond, ms) { return new Promise(function (resolve) { var t0 = Date.now(); (function poll() { if (cond()) return resolve(true); if (Date.now() - t0 > ms) return resolve(false); setTimeout(poll, 200); })(); }); }
  (async function init() {
    var ok = await waitFor(function () { return window.supabase && window.FFP_PROVIDER && window.FFP_PROVIDER.id; }, 30000);
    if (!ok) { console.warn('[FFP Classes] deps not ready'); return; }
    await refresh();
    console.log('[FFP Provider Classes] loaded v1 ✓');
  })();
})();

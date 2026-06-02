/* FFP Provider Profile Loader — v7
   v7 (2026-06-02): added "Activities we offer" (chips → providers.activities[]) + "Venue
       location" (current-location capture → providers.latitude/longitude) to the profile,
       injected into #panel-profile. These feed the member venue check-in (activity list +
       GPS on-site verification). Also fixed: country was read but missing from the select.
   v6: country + city use the shared FFPLocation cascade (assets/ffp-location-picker.js) —
       no longer wraps pf-city as its own searchable picker; loads/saves provider.country.
   v5: hide native scrollbar on the panel (content still scrolls).
*/
(function () {
  'use strict';

  var DAY_TO_INT = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };
  var INT_TO_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Refined option lists — businesses/organizations, not individuals
  var CATEGORIES = [
    'Fitness studio',
    'Wellness centre',
    'Padel club',
    'Pilates / Yoga',
    'Climbing',
    'Combat sports',
    'Recovery / Spa',
    'Performance lab',
    'Nutrition / Cafe',
    'Adventure / Outdoor',
    'Personal Training',
    'Retail',
    'Other'
  ];

  var PROVIDER_TYPES = [
    'Single location',
    'Multi-location',
    'Remote / Online',
    'Event organizer'
  ];

  var UAE_CITIES = [
    'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman',
    'Ras Al Khaimah', 'Fujairah', 'Al Ain', 'Umm Al Quwain'
  ];

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Provider Profile]', msg);
  }
  async function waitFor(check, ms) {
    var tries = 0; var limit = Math.ceil((ms || 15000) / 100);
    while (!check() && tries < limit) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    return check();
  }
  function trimTime(t) { return t ? String(t).slice(0, 5) : ''; }
  function defaultHoursObj() {
    var h = {};
    INT_TO_DAY.forEach(function (day) { h[day] = { open: '', close: '', closed: false }; });
    return h;
  }
  function escText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Inject CSS fixes ───
  function injectStyles() {
    if (document.getElementById('ffp-provider-profile-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-provider-profile-css';
    css.textContent = [
      // Kill all native scrollbars on this page (FFP-wide rule)
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',

      // Kill horizontal overflow
      '#panel-profile{overflow-x:hidden;}',
      '#panel-profile .form-grid{max-width:100%;}',

      // Native dropdowns → dark (color-scheme + option background)
      '#panel-profile select, #panel-profile .select{color-scheme:dark;}',
      '#panel-profile select option{background:#0f1e2e !important;color:#f5f7fa !important;}',
      '#panel-profile select option:checked{background:#2ba8e0 !important;color:#082335 !important;}',

      // Custom picker (replaces native select look entirely)
      '.ffp-pp-pick{position:relative;width:100%;}',
      '.ffp-pp-pick-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:8px;color:#f5f7fa;padding:10px 12px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;text-align:left;}',
      '.ffp-pp-pick-btn:hover{border-color:#2ba8e0;}',
      '.ffp-pp-pick-btn.placeholder{color:#8a99a8;}',
      '.ffp-pp-pick-btn .material-symbols-outlined,.ffp-pp-pick-btn .ms{font-size:18px;color:#8a99a8;}',
      '.ffp-pp-pick-menu{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#0f1e2e;border:1px solid rgba(43,168,224,0.30);border-radius:8px;max-height:260px;overflow-y:auto;z-index:9000;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.4);padding:4px;}',
      '.ffp-pp-pick-menu.open{display:block;}',
      '.ffp-pp-pick-item{padding:9px 12px;border-radius:6px;font-size:13px;font-weight:600;color:#f5f7fa;cursor:pointer;}',
      '.ffp-pp-pick-item:hover{background:rgba(43,168,224,0.10);}',
      '.ffp-pp-pick-item.active{background:rgba(43,168,224,0.15);color:#2ba8e0;}',

      // Phone country-code picker: preserve flex layout side-by-side with .phone-num
      '#panel-profile .phone-input .ffp-pp-pick{width:152px;flex-shrink:0;}',
      '#panel-profile .phone-input .ffp-pp-pick-btn{border-radius:8px 0 0 8px;border-right:1px solid rgba(43,168,224,0.10);padding:11px 14px;}',
      '#panel-profile .phone-input .ffp-pp-pick-menu{min-width:260px;width:auto;left:0;right:auto;}',
      '#panel-profile .phone-input .input.phone-num{border-radius:0 8px 8px 0;border-left:none;}'
    ].join('');
    document.head.appendChild(css);
  }

  // ─── Refine panel UI: subtitle, category options, type options ───
  function refineUI() {
    // Subtitle clarity — businesses/organizations only
    var sub = document.querySelector('#panel-profile .psub');
    if (sub) {
      sub.innerHTML = 'For <b>businesses and organizations</b> only. Individual trainers and coaches should join as a member instead. Changes go to admin for review before going live.';
    }

    // Replace category options
    var catSel = document.getElementById('pf-category');
    if (catSel) {
      var current = catSel.value;
      catSel.innerHTML = '<option value="">Choose category</option>' +
        CATEGORIES.map(function (c) { return '<option value="' + escText(c) + '">' + escText(c) + '</option>'; }).join('');
      if (current) catSel.value = current;
    }

    // Replace provider type options
    var typeSel = document.getElementById('pf-type');
    if (typeSel) {
      var currentT = typeSel.value;
      typeSel.innerHTML = '<option value="">Choose type</option>' +
        PROVIDER_TYPES.map(function (t) { return '<option value="' + escText(t) + '">' + escText(t) + '</option>'; }).join('');
      if (currentT) typeSel.value = currentT;
    }

    // Wire up the custom dark pickers on top of existing <select>s
    wrapSelectAsPicker('pf-category',  'Choose category');
    wrapSelectAsPicker('pf-type',      'Choose type');
    wrapSelectAsPicker('pf-phone-cc',  'Code');
  }

  // ─── Custom dark picker wrapper ───
  // Hides the native <select> and renders a dark dropdown that mirrors it. On selection,
  // the underlying <select>.value is set and a change event fires so existing handlers work.
  function wrapSelectAsPicker(selectId, placeholder) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    // If we've already wrapped this select, just refresh the label
    if (sel.dataset.ffpPickerWrapped === '1') {
      refreshPickerLabel(sel);
      return;
    }
    sel.dataset.ffpPickerWrapped = '1';
    sel.style.display = 'none';

    var wrap = document.createElement('div');
    wrap.className = 'ffp-pp-pick';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ffp-pp-pick-btn placeholder';
    btn.innerHTML = '<span class="ffp-pp-pick-label">' + escText(placeholder) + '</span><span class="ms material-symbols-outlined">expand_more</span>';
    var menu = document.createElement('div');
    menu.className = 'ffp-pp-pick-menu';

    function rebuildMenu() {
      var html = '';
      Array.prototype.forEach.call(sel.options, function (opt) {
        if (!opt.value && !opt.textContent.trim()) return;
        if (!opt.value) return; // skip the placeholder ("")
        var active = (opt.value === sel.value) ? ' active' : '';
        html += '<div class="ffp-pp-pick-item' + active + '" data-value="' + escText(opt.value) + '">' + escText(opt.textContent) + '</div>';
      });
      menu.innerHTML = html;
      menu.querySelectorAll('.ffp-pp-pick-item').forEach(function (it) {
        it.addEventListener('click', function () {
          sel.value = it.dataset.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          refreshPickerLabel(sel);
          closeMenu();
        });
      });
    }
    function openMenu() {
      // Close any other open menus
      document.querySelectorAll('.ffp-pp-pick-menu.open').forEach(function (m) { m.classList.remove('open'); });
      rebuildMenu();
      menu.classList.add('open');
    }
    function closeMenu() { menu.classList.remove('open'); }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.classList.contains('open')) closeMenu(); else openMenu();
    });

    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(btn);
    wrap.appendChild(menu);

    // Refresh label whenever the underlying <select> changes (from code or user)
    sel.addEventListener('change', function () { refreshPickerLabel(sel); });

    refreshPickerLabel(sel);
  }

  function refreshPickerLabel(sel) {
    if (!sel || sel.dataset.ffpPickerWrapped !== '1') return;
    var wrap = sel.previousSibling;
    if (!wrap || !wrap.classList || !wrap.classList.contains('ffp-pp-pick')) return;
    var btn = wrap.querySelector('.ffp-pp-pick-btn');
    var label = wrap.querySelector('.ffp-pp-pick-label');
    if (!btn || !label) return;
    var selectedOpt = sel.options[sel.selectedIndex];
    var hasValue = sel.value && selectedOpt && selectedOpt.value;
    if (hasValue) {
      label.textContent = selectedOpt.textContent;
      btn.classList.remove('placeholder');
    } else {
      // Use the placeholder from the first option ("Choose ...") if present
      var placeholderText = sel.options[0] ? sel.options[0].textContent : '';
      label.textContent = placeholderText || '';
      btn.classList.add('placeholder');
    }
  }

  // Close pickers on outside click
  document.addEventListener('click', function () {
    document.querySelectorAll('.ffp-pp-pick-menu.open').forEach(function (m) { m.classList.remove('open'); });
  });

  // ─── Fetch ───
  async function fetchProfile() {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) return null;
    var id = window.FFP_PROVIDER.id;

    var provRes = await window.supabase
      .from('providers')
      .select('id, business_name, letter_mark, category, provider_type, country, city, area, address, contact_email, contact_phone, website, instagram, about, logo_url, hero_photo_url, status, activities, latitude, longitude')
      .eq('id', id).single();
    if (provRes.error) throw provRes.error;

    var hoursRes = await window.supabase
      .from('provider_hours')
      .select('day_of_week, opens, closes, closed')
      .eq('provider_id', id);
    if (hoursRes.error) console.warn('[FFP Provider Profile] hours read error:', hoursRes.error.message);

    var p = provRes.data;
    var profile = {
      business_name: p.business_name || '',
      letter_mark:   p.letter_mark || (p.business_name ? p.business_name[0].toUpperCase() : 'P'),
      category:      p.category || '',
      provider_type: p.provider_type || '',
      city:          p.city || '',
      country:       p.country || '',
      area:          p.area || '',
      address:       p.address || '',
      phone:         p.contact_phone || '',
      website:       p.website || '',
      about:         p.about || '',
      status:        p.status,
      verified:      p.status === 'approved',
      logo_url:      p.logo_url || null,
      hero_url:      p.hero_photo_url || null,
      activities:    Array.isArray(p.activities) ? p.activities : [],
      latitude:      (p.latitude  != null) ? Number(p.latitude)  : null,
      longitude:     (p.longitude != null) ? Number(p.longitude) : null,
      hours:         defaultHoursObj()
    };
    (hoursRes && hoursRes.data ? hoursRes.data : []).forEach(function (h) {
      var day = INT_TO_DAY[h.day_of_week];
      if (!day) return;
      profile.hours[day] = {
        open:   trimTime(h.opens),
        close:  trimTime(h.closes),
        closed: !!h.closed
      };
    });
    return profile;
  }

  // ─── Save ───
  async function realSaveProfile() {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) { toast('Provider not loaded', 'error'); return; }
    var id = window.FFP_PROVIDER.id;

    var businessName = (document.getElementById('pf-business-name').value || '').trim();
    var category     = document.getElementById('pf-category').value;
    var providerType = document.getElementById('pf-type').value;
    var city         = document.getElementById('pf-city').value;
    var country      = (document.getElementById('pf-country') || {}).value || '';
    var area         = (document.getElementById('pf-area').value || '').trim();
    var address      = (document.getElementById('pf-address').value || '').trim();
    var phone        = (typeof window.getPhoneValue === 'function') ? window.getPhoneValue() : '';
    var website      = (document.getElementById('pf-website').value || '').trim();
    var about        = (document.getElementById('pf-about').value || '').trim();
    var letterMark   = (businessName || 'P').charAt(0).toUpperCase();

    if (!businessName) { toast('Business name is required', 'error'); return; }
    if (!category)     { toast('Category is required', 'error'); return; }
    if (!city)         { toast('City is required', 'error'); return; }

    // Hours — AUTO-CLOSE any day where times are empty (no invalid open-but-no-times state)
    var hoursRows = [];
    var autoClosedCount = 0;
    document.querySelectorAll('#hours-grid .hours-row').forEach(function (row) {
      var day = row.dataset.day;
      var dayInt = DAY_TO_INT[day];
      if (dayInt === undefined) return;
      var checkbox = row.querySelector('.hours-closed input[type="checkbox"]');
      var manuallyClosed = !!(checkbox && checkbox.checked) || row.classList.contains('is-closed');
      var openEl  = row.querySelector('[data-field="open"]');
      var closeEl = row.querySelector('[data-field="close"]');
      var openVal  = openEl ? (openEl.value || '').trim() : '';
      var closeVal = closeEl ? (closeEl.value || '').trim() : '';
      var noTimes = !openVal && !closeVal;
      var closed = manuallyClosed || noTimes;
      if (!manuallyClosed && noTimes) autoClosedCount++;
      hoursRows.push({
        provider_id: id,
        day_of_week: dayInt,
        opens:   closed ? null : (openVal || null),
        closes:  closed ? null : (closeVal || null),
        closed:      closed
      });
    });

    var logoUrl = (typeof providerProfile !== 'undefined' && providerProfile.logo_url) ? providerProfile.logo_url : null;
    var heroUrl = (typeof providerProfile !== 'undefined' && providerProfile.hero_url) ? providerProfile.hero_url : null;
    var saveBtn = document.querySelector('#panel-profile .btn-pri');
    if (saveBtn) saveBtn.disabled = true;

    try {
      var provRes = await window.supabase.from('providers').update({
        business_name:  businessName,
        letter_mark:    letterMark,
        category:       category,
        provider_type:  providerType || null,
        city:           city,
        country:        country || null,
        area:           area || null,
        address:        address || null,
        contact_phone:  phone || null,
        website:        website || null,
        about:          about || null,
        logo_url:       logoUrl,
        hero_photo_url: heroUrl,
        activities:     (_provExtras.activities && _provExtras.activities.length) ? _provExtras.activities : null,
        latitude:       (_provExtras.lat != null) ? _provExtras.lat : null,
        longitude:      (_provExtras.lng != null) ? _provExtras.lng : null
      }).eq('id', id);
      if (provRes.error) throw provRes.error;

      var delRes = await window.supabase.from('provider_hours').delete().eq('provider_id', id);
      if (delRes.error) throw delRes.error;
      if (hoursRows.length > 0) {
        var insRes = await window.supabase.from('provider_hours').insert(hoursRows);
        if (insRes.error) throw insRes.error;
      }

      // Sync providerProfile in memory
      if (typeof providerProfile !== 'undefined') {
        providerProfile.business_name = businessName;
        providerProfile.letter_mark   = letterMark;
        providerProfile.category      = category;
        providerProfile.provider_type = providerType;
        providerProfile.city          = city;
        providerProfile.country       = country;
        providerProfile.area          = area;
        providerProfile.address       = address;
        providerProfile.phone         = phone;
        providerProfile.website       = website;
        providerProfile.about         = about;
        hoursRows.forEach(function (h) {
          var day = INT_TO_DAY[h.day_of_week];
          providerProfile.hours[day] = {
            open: trimTime(h.opens),
            close: trimTime(h.closes),
            closed: !!h.closed
          };
        });
      }

      // Update sidebar foot + topbar
      var sbName = document.getElementById('sb-foot-name');
      var sbMark = document.getElementById('sb-foot-mark');
      if (sbName) sbName.textContent = businessName || 'Your business';
      if (sbMark) sbMark.textContent = letterMark;
      window.FFP_PROVIDER.business_name = businessName;

      if (typeof window.renderProfileCompletion === 'function') { try { window.renderProfileCompletion(); } catch (e) {} }
      if (typeof window.setSaveBar === 'function') { try { window.setSaveBar(false); } catch (e) {} }

      var msg = 'Profile saved';
      if (autoClosedCount > 0) msg += ' (' + autoClosedCount + ' day' + (autoClosedCount > 1 ? 's' : '') + ' auto-marked closed)';
      toast(msg, 'success');
    } catch (e) {
      console.error('[FFP Provider Profile] save:', e);
      var emsg = e.message || 'Save failed';
      if (/policy|permission|denied|rls/i.test(emsg)) {
        emsg = 'Save blocked by RLS — check provider/provider_hours policies';
      } else if (/does not exist/i.test(emsg)) {
        emsg = 'Schema mismatch — see console for details';
      }
      toast(emsg, 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  // ─── Activities offered + venue location (injected into #panel-profile) ───
  var _provExtras = { activities: [], lat: null, lng: null };

  function injectExtrasCss() {
    if (document.getElementById('pf-extras-css')) return;
    var s = document.createElement('style'); s.id = 'pf-extras-css';
    s.textContent =
      '#pf-extras{margin:6px 0 18px;display:flex;flex-direction:column;gap:18px;}' +
      '#pf-extras .pf-extras-sec{display:flex;flex-direction:column;gap:8px;}' +
      '#pf-extras .pf-extras-lbl{font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#8a99a8;}' +
      '#pf-extras .pf-extras-hint{font-weight:600;letter-spacing:0;text-transform:none;color:#6a90a8;}' +
      '#pf-extras .pf-extras-add{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}' +
      '#pf-extras .pf-extras-add .input{flex:1;min-width:160px;}' +
      '#pf-extras .pf-extras-btn{background:#FFCC00;color:#082335;border:none;border-radius:9px;padding:10px 16px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;}' +
      '#pf-extras .pf-extras-btn.alt{background:rgba(43,168,224,.12);color:#cfe0ec;border:1px solid rgba(43,168,224,.3);}' +
      '#pf-extras .pf-chips{display:flex;flex-wrap:wrap;gap:7px;}' +
      '#pf-extras .pf-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(43,168,224,.12);border:1px solid rgba(43,168,224,.28);border-radius:100px;padding:5px 6px 5px 12px;font-size:12px;font-weight:700;color:#e8eef4;}' +
      '#pf-extras .pf-chip button{background:rgba(255,255,255,.12);border:none;color:#cfe0ec;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:13px;line-height:1;}' +
      '#pf-extras .pf-loc-status{font-size:12px;color:#8a99a8;font-weight:600;}';
    document.head.appendChild(s);
  }
  function injectProviderExtras() {
    var panel = document.getElementById('panel-profile');
    if (!panel || document.getElementById('pf-extras')) return;
    injectExtrasCss();
    var saveBtn = panel.querySelector('.btn-pri');
    var anchor = saveBtn ? (saveBtn.closest('.form-actions') || saveBtn) : null;
    var acts = ((window.FFP_TAX && window.FFP_TAX.activities) || []).map(function (a) { return (a && a.n) ? a.n : a; });
    var dl = acts.map(function (a) { return '<option value="' + escText(a) + '">'; }).join('');
    var box = document.createElement('div');
    box.id = 'pf-extras';
    box.innerHTML =
      '<div class="pf-extras-sec">' +
        '<label class="pf-extras-lbl">Activities we offer <span class="pf-extras-hint">— what members can pick when they check in</span></label>' +
        '<div class="pf-extras-add"><input id="pf-act-input" class="input" list="pf-act-list" placeholder="Type an activity, then Add"><datalist id="pf-act-list">' + dl + '</datalist><button type="button" id="pf-act-add" class="pf-extras-btn">Add</button></div>' +
        '<div id="pf-act-chips" class="pf-chips"></div>' +
      '</div>' +
      '<div class="pf-extras-sec">' +
        '<label class="pf-extras-lbl">Venue location <span class="pf-extras-hint">— verifies members are on-site at check-in</span></label>' +
        '<div class="pf-extras-add"><button type="button" id="pf-loc-btn" class="pf-extras-btn alt"><span class="material-icons" style="font-size:16px;vertical-align:middle;">my_location</span> Use current location</button><span id="pf-loc-status" class="pf-loc-status">Not set</span></div>' +
      '</div>';
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor);
    else panel.appendChild(box);
    document.getElementById('pf-act-add').onclick = addAct;
    document.getElementById('pf-act-input').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); addAct(); } };
    document.getElementById('pf-loc-btn').onclick = captureLocation;
    renderActChips();
  }
  function addAct() {
    var inp = document.getElementById('pf-act-input'); if (!inp) return;
    var v = (inp.value || '').trim(); if (!v) return;
    if (!_provExtras.activities.some(function (a) { return a.toLowerCase() === v.toLowerCase(); })) _provExtras.activities.push(v);
    inp.value = ''; renderActChips();
  }
  window.__pfRemoveAct = function (v) { _provExtras.activities = _provExtras.activities.filter(function (a) { return a !== v; }); renderActChips(); };
  function renderActChips() {
    var c = document.getElementById('pf-act-chips'); if (!c) return;
    c.innerHTML = _provExtras.activities.length
      ? _provExtras.activities.map(function (a) { return '<span class="pf-chip">' + escText(a) + '<button type="button" onclick="__pfRemoveAct(&quot;' + escText(a).replace(/"/g, '') + '&quot;)">&times;</button></span>'; }).join('')
      : '<span class="pf-loc-status">None yet — add the activities members can do here.</span>';
  }
  function captureLocation() {
    var st = document.getElementById('pf-loc-status');
    if (!navigator.geolocation) { if (st) st.textContent = 'Location not supported on this device'; return; }
    if (st) st.textContent = 'Getting location…';
    navigator.geolocation.getCurrentPosition(
      function (p) { _provExtras.lat = +p.coords.latitude.toFixed(6); _provExtras.lng = +p.coords.longitude.toFixed(6); if (st) st.textContent = '✓ Set (' + _provExtras.lat + ', ' + _provExtras.lng + ')'; },
      function () { if (st) st.textContent = 'Couldn’t get location — allow it and try at the venue'; },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
  }
  function populateProviderExtras(profile) {
    _provExtras.activities = Array.isArray(profile.activities) ? profile.activities.slice() : [];
    _provExtras.lat = (profile.latitude != null) ? profile.latitude : null;
    _provExtras.lng = (profile.longitude != null) ? profile.longitude : null;
    renderActChips();
    var st = document.getElementById('pf-loc-status');
    if (st) st.textContent = (_provExtras.lat != null && _provExtras.lng != null) ? ('✓ Set (' + _provExtras.lat + ', ' + _provExtras.lng + ')') : 'Not set';
  }

  // ─── Init ───
  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth &&
             typeof window.loadProfile === 'function' &&
             typeof providerProfile !== 'undefined';
    }, 15000);
    if (!ok) { console.error('[FFP Provider Profile] dependencies never loaded'); return; }

    var authed = await waitFor(function () { return !!(window.FFP_PROVIDER && window.FFP_PROVIDER.id); }, 30000);
    if (!authed) { console.warn('[FFP Provider Profile] FFP_PROVIDER not set — provider not authenticated yet'); return; }

    injectStyles();

    // Refine UI as soon as the profile panel exists in the DOM
    refineUI();
    injectProviderExtras();

    try {
      var real = await fetchProfile();
      if (real) {
        Object.assign(providerProfile, real);
        populateProviderExtras(real);
        // If user is on the profile panel, repaint
        var profilePanel = document.getElementById('panel-profile');
        if (profilePanel && profilePanel.classList.contains('active')) {
          try { window.loadProfile(); } catch (e) {}
          // After loadProfile, refresh picker labels (selects got new values)
          ['pf-category', 'pf-type', 'pf-phone-cc'].forEach(function (id) {
            var s = document.getElementById(id);
            if (s) refreshPickerLabel(s);
          });
        }
        console.log('[FFP Provider Profile v2] Loaded from Supabase \u2713');
      }
    } catch (e) {
      console.error('[FFP Provider Profile] load:', e);
      toast('Could not load profile', 'error');
    }

    // Override saveProfile to write to Supabase
    window.saveProfile = realSaveProfile;

    // Re-run UI refinements after the dashboard calls loadProfile() (panel switch)
    var origLoadProfile = window.loadProfile;
    window.loadProfile = function () {
      try { origLoadProfile(); } catch (e) {}
      refineUI();
      ['pf-category', 'pf-type', 'pf-phone-cc'].forEach(function (id) {
        var s = document.getElementById(id);
        if (s) refreshPickerLabel(s);
      });
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

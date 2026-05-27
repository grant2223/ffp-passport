/* FFP Provider Profile Loader — v1
   Wires the provider dashboard's Profile panel to real Supabase data.

   Add ONE script tag to ffp-provider-dashboard.html AFTER ffp-provider-auth.js:
     <script src="ffp-provider-profile-loader.js"></script>

   What it does:
   1. Waits for the provider auth gate to set window.FFP_PROVIDER
   2. Fetches the provider row from `providers` (RLS: own row)
   3. Fetches operating hours from `provider_hours` (RLS: own rows)
   4. Replaces the in-memory providerProfile{} with real values
   5. Calls the dashboard's existing loadProfile() so the form populates
   6. Overrides saveProfile() to UPDATE the DB on save (providers row + provider_hours replace)
   7. Updates sidebar foot + window.FFP_PROVIDER on successful save

   Required SQL (run once — see message):
   - Provider UPDATE RLS policy + trigger to block admin-only fields
   - provider_hours RLS (own + admin)

   Photo uploads (logo / hero):
   - The existing handleUpload() reads files as data URLs and stores them in providerProfile
   - saveProfile() writes whatever URL/data-URL is set to the DB columns
   - TODO: replace with real Supabase Storage upload in a later ship (data URLs work but bloat rows)

   Architecture: hooks into existing globals (providerProfile, loadProfile, saveProfile,
   getPhoneValue, setPhoneValue, renderProfileCompletion). Does NOT build a separate UI.
*/
(function () {
  'use strict';

  // Day mapping — dashboard uses names, DB uses int 0-6 (Sun-Sat per master progress)
  var DAY_TO_INT = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };
  var INT_TO_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Provider Profile]', msg);
  }

  async function waitFor(check, ms) {
    var tries = 0;
    var limit = Math.ceil((ms || 15000) / 100);
    while (!check() && tries < limit) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    return check();
  }

  function trimTime(t) {
    // DB returns "HH:MM:SS" — form needs "HH:MM"
    if (!t) return '';
    return String(t).slice(0, 5);
  }

  function defaultHoursObj() {
    var h = {};
    INT_TO_DAY.forEach(function (day) {
      h[day] = { open: '', close: '', closed: false };
    });
    return h;
  }

  // ─── Fetch ───
  async function fetchProfile() {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) return null;
    var id = window.FFP_PROVIDER.id;

    var provRes = await window.supabase
      .from('providers')
      .select('id, business_name, letter_mark, category, provider_type, city, area, address, contact_email, contact_phone, website, instagram, about, logo_url, hero_photo_url, status, paid_until, subscription_tier, monthly_fee_aed, featured')
      .eq('id', id)
      .single();
    if (provRes.error) throw provRes.error;

    var hoursRes = await window.supabase
      .from('provider_hours')
      .select('day_of_week, open_time, close_time, closed')
      .eq('provider_id', id);
    if (hoursRes.error) {
      console.warn('[FFP Provider Profile] hours read error:', hoursRes.error.message);
      // Don't fail entire load if hours table is empty/restricted — proceed with empty hours
    }

    var p = provRes.data;
    var profile = {
      business_name: p.business_name || '',
      letter_mark:   p.letter_mark || (p.business_name ? p.business_name[0].toUpperCase() : 'P'),
      category:      p.category || '',
      provider_type: p.provider_type || '',
      city:          p.city || '',
      area:          p.area || '',
      address:       p.address || '',
      phone:         p.contact_phone || '',
      website:       p.website || '',
      about:         p.about || '',
      status:        p.status,
      verified:      p.status === 'approved',
      logo_url:      p.logo_url || null,
      hero_url:      p.hero_photo_url || null,
      // Stash extra fields available for reference (read-only on this panel)
      _contact_email: p.contact_email,
      _instagram:     p.instagram,
      _paid_until:    p.paid_until,
      _tier:          p.subscription_tier,
      _featured:      p.featured,
      hours: defaultHoursObj()
    };

    (hoursRes && hoursRes.data ? hoursRes.data : []).forEach(function (h) {
      var day = INT_TO_DAY[h.day_of_week];
      if (!day) return;
      profile.hours[day] = {
        open:   trimTime(h.open_time),
        close:  trimTime(h.close_time),
        closed: !!h.closed
      };
    });
    return profile;
  }

  // ─── Save ───
  async function realSaveProfile() {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) {
      toast('Provider not loaded', 'error');
      return;
    }
    var id = window.FFP_PROVIDER.id;

    var businessName = (document.getElementById('pf-business-name').value || '').trim();
    var category     = document.getElementById('pf-category').value;
    var providerType = document.getElementById('pf-type').value;
    var city         = document.getElementById('pf-city').value;
    var area         = (document.getElementById('pf-area').value || '').trim();
    var address      = (document.getElementById('pf-address').value || '').trim();
    var phone        = (typeof window.getPhoneValue === 'function') ? window.getPhoneValue() : '';
    var website      = (document.getElementById('pf-website').value || '').trim();
    var about        = (document.getElementById('pf-about').value || '').trim();
    var letterMark   = (businessName || 'P').charAt(0).toUpperCase();

    if (!businessName) { toast('Business name is required', 'error'); return; }
    if (!category)     { toast('Category is required', 'error'); return; }
    if (!city)         { toast('City is required', 'error'); return; }

    // Capture hours from form
    var hoursRows = [];
    document.querySelectorAll('#hours-grid .hours-row').forEach(function (row) {
      var day = row.dataset.day;
      var dayInt = DAY_TO_INT[day];
      if (dayInt === undefined) return;
      var checkbox = row.querySelector('.hours-closed input[type="checkbox"]');
      var closed = !!(checkbox && checkbox.checked) || row.classList.contains('is-closed');
      var openEl  = row.querySelector('[data-field="open"]');
      var closeEl = row.querySelector('[data-field="close"]');
      var openTime  = closed ? null : (openEl ? openEl.value : null) || null;
      var closeTime = closed ? null : (closeEl ? closeEl.value : null) || null;
      hoursRows.push({
        provider_id: id,
        day_of_week: dayInt,
        open_time:   openTime,
        close_time:  closeTime,
        closed:      closed
      });
    });

    // Read photo URLs from providerProfile (handleUpload puts data URLs there)
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
        area:           area || null,
        address:        address || null,
        contact_phone:  phone || null,
        website:        website || null,
        about:          about || null,
        logo_url:       logoUrl,
        hero_photo_url: heroUrl
      }).eq('id', id);
      if (provRes.error) throw provRes.error;

      // Replace provider_hours rows for this provider
      var delRes = await window.supabase.from('provider_hours').delete().eq('provider_id', id);
      if (delRes.error) throw delRes.error;
      if (hoursRows.length > 0) {
        var insRes = await window.supabase.from('provider_hours').insert(hoursRows);
        if (insRes.error) throw insRes.error;
      }

      // Sync in-memory providerProfile so Discard works correctly after save
      if (typeof providerProfile !== 'undefined') {
        providerProfile.business_name = businessName;
        providerProfile.letter_mark   = letterMark;
        providerProfile.category      = category;
        providerProfile.provider_type = providerType;
        providerProfile.city          = city;
        providerProfile.area          = area;
        providerProfile.address       = address;
        providerProfile.phone         = phone;
        providerProfile.website       = website;
        providerProfile.about         = about;
        // Refresh hours from what we just saved
        hoursRows.forEach(function (h) {
          var day = INT_TO_DAY[h.day_of_week];
          providerProfile.hours[day] = {
            open:   trimTime(h.open_time),
            close:  trimTime(h.close_time),
            closed: !!h.closed
          };
        });
      }

      // Refresh sidebar foot + topbar (the dashboard's UI bits)
      var sbName = document.getElementById('sb-foot-name');
      var sbMark = document.getElementById('sb-foot-mark');
      if (sbName) sbName.textContent = businessName || 'Your business';
      if (sbMark) sbMark.textContent = letterMark;

      // Update window.FFP_PROVIDER so other panels see the new name
      window.FFP_PROVIDER.business_name = businessName;

      if (typeof window.renderProfileCompletion === 'function') {
        try { window.renderProfileCompletion(); } catch (e) {}
      }
      if (typeof window.setSaveBar === 'function') {
        try { window.setSaveBar(false); } catch (e) {}
      }
      toast('Profile saved', 'success');
    } catch (e) {
      console.error('[FFP Provider Profile] save:', e);
      var msg = e.message || 'Save failed';
      // Friendlier hints for common RLS issues
      if (/policy|permission|denied|rls/i.test(msg)) {
        msg = 'Save blocked — check provider RLS policies on providers + provider_hours';
      }
      toast(msg, 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  // ─── Init ───
  async function init() {
    // Dependencies: Supabase + dashboard globals
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth &&
             typeof window.loadProfile === 'function' &&
             typeof providerProfile !== 'undefined';
    }, 15000);
    if (!ok) {
      console.error('[FFP Provider Profile] dependencies never loaded');
      return;
    }

    // Wait for the auth gate to grant access (sets FFP_PROVIDER)
    var authed = await waitFor(function () {
      return !!(window.FFP_PROVIDER && window.FFP_PROVIDER.id);
    }, 30000);
    if (!authed) {
      console.warn('[FFP Provider Profile] FFP_PROVIDER not set — provider not authenticated yet');
      return;
    }

    // Pull real data into the in-memory providerProfile
    try {
      var real = await fetchProfile();
      if (real) {
        Object.assign(providerProfile, real);
        // If the user is already on the profile panel, repaint it now
        var profilePanel = document.getElementById('panel-profile');
        if (profilePanel && profilePanel.classList.contains('active')) {
          try { window.loadProfile(); } catch (e) {}
        }
        console.log('[FFP Provider Profile] Loaded from Supabase \u2713');
      }
    } catch (e) {
      console.error('[FFP Provider Profile] load:', e);
      toast('Could not load profile', 'error');
    }

    // Override saveProfile to write to Supabase
    window.saveProfile = realSaveProfile;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

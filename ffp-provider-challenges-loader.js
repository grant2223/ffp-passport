/* close edit modal after delete
/*  Provider Challenges Loader — v1
   Wires the provider dashboard's Challenges panel to real Supabase data.
   Provider challenges only: organizer sets rules and uploads results at end.
   (Member-hosted challenges are a separate flow — schema decision pending.)

   What it does:
   - Waits for FFP_PROVIDER, fetches challenges WHERE provider_id = me, challenge_type='provider'
   - Replaces in-memory `challenges` array, calls renderChallenges()
   - Overrides openChallengeModal with activity picker (uses window.FFPPicker)
   - Overrides saveChallenge() → INSERT / UPDATE
   - Overrides confirmDeleteChallenge() → DELETE
   - Re-approval rule on edit of live/paused
   - Scrollbar hide + thin chevron + picker btn CSS

   Schema mapping:
     cm-title       → title
     cm-description → description
     cm-activity    → activity (NEW, via picker) + category (auto-derived)
     cm-metric      → metric
     cm-venue       → venue
     cm-prize       → prize_description
     cm-start       → starts_at (date stored as timestamptz at 00:00)
     cm-end         → ends_at
     photo          → hero_image_url
     challenge_type → 'provider' (hardcoded — member challenges are separate)

   Participant counts deferred — shows 0 (real counts from challenge_entries in Phase 2).
*/
(function () {
  'use strict';

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Provider Challenges]', msg);
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
    if (document.getElementById('ffp-provider-challenges-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-provider-challenges-css';
    css.textContent = [
      // Kill native scrollbars (FFP-wide rule)
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',
      '#panel-challenges{overflow-x:hidden;}',
      // Thin chevron on selects
      'select.select, select.input, #panel-challenges select, .modal select, .modal-body select {' +
        'appearance:none;-webkit-appearance:none;-moz-appearance:none;' +
        'background-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238a99a8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E");' +
        'background-repeat:no-repeat;background-position:right 12px center;background-size:16px;' +
        'padding-right:36px;color-scheme:dark;}',
      '.modal select option{background:#0f1e2e !important;color:#f5f7fa !important;}',
      'input.input[type="date"]{color-scheme:dark;}',
      // Picker button — matches other content loaders
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

  function setActivityBtn(btn, name, category) {
    btn.dataset.value = name || '';
    btn.dataset.category = category || '';
    if (name) {
      btn.classList.remove('placeholder');
      btn.innerHTML =
        '<div class="picked"><div class="name">' + escHtml(name) + '</div>' +
        (category ? '<div class="group">' + escHtml(category) + '</div>' : '') +
        '</div>' +
        '<span class="ms caret">expand_more</span>';
    } else {
      btn.classList.add('placeholder');
      btn.innerHTML = '<span>Choose activity…</span><span class="ms caret">expand_more</span>';
    }
  }

  // ─── DB → UI shape ───
  function mapForUi(row) {
    var startD = row.starts_at ? row.starts_at.slice(0, 10) : '';
    var endD   = row.ends_at   ? row.ends_at.slice(0, 10)   : '';
    return {
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      challenge_type: row.challenge_type || 'provider',
      activity: row.activity || '',
      category: row.category || '',
      metric: row.metric || '',
      venue: row.venue || '',
      city: row.city || '',
      start_date: startD,
      end_date: endD,
      prize: row.prize_description || '',
      hero_url: row.hero_image_url || null,
      status: row.status || 'pending',
      featured: !!row.featured,
      participants: 0,  // Wired in Phase 2
      results_uploaded: row.status === 'past',
      created_at: row.created_at ? row.created_at.slice(0, 10) : '',
      _raw: row
    };
  }

  async function fetchChallenges() {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) return [];
    var res = await window.supabase
      .from('challenges')
      .select('id, provider_id, challenge_type, title, description, activity, category, hero_image_url, metric, venue, city, starts_at, ends_at, prize_description, verification, status, featured, created_at, updated_at')
      .eq('provider_id', window.FFP_PROVIDER.id)
      .order('starts_at', { ascending: false });
    if (res.error) {
      console.error('[FFP Challenges] fetch:', res.error);
      toast('Could not load challenges', 'error');
      return [];
    }
    return (res.data || []).map(mapForUi);
  }

  async function refresh() {
    if (typeof challenges === 'undefined') return;
    var rows = await fetchChallenges();
    challenges.length = 0;
    rows.forEach(function (r) { challenges.push(r); });
    if (typeof window.renderChallenges === 'function') { try { window.renderChallenges(); } catch (e) {} }
    if (typeof window.renderNav === 'function')        { try { window.renderNav();        } catch (e) {} }
  }

  // ─── Modal — full override ───
  function realOpenChallengeModal(id) {
    var editing = id ? challenges.find(function (x) { return x.id === id; }) : null;
    var defaultVenue = (window.providerProfile && window.providerProfile.business_name) || '';
    var c = editing || {
      title: '', description: '', activity: '', category: '',
      metric: '', venue: defaultVenue,
      start_date: '', end_date: '', prize: '',
      hero_url: null, status: ''
    };

    var body =
      '<div class="help-strip">' +
        '<span class="ms">info</span>' +
        '<div><b>Provider challenge:</b> you set the rules and upload results at the end. Members see a leaderboard with your results. No FFP coins — prizes are physical only.</div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">Photo</div>' +
        '<div id="listing-photo-slot" data-url="' + escHtml(c.hero_url || '') + '"></div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-title">Challenge</div>' +
        '<div class="form-grid">' +
          '<div class="field full">' +
            '<div class="label">Title <span class="req">*</span></div>' +
            '<input class="input" id="cm-title" value="' + escHtml(c.title) + '" placeholder="e.g. Forge May Strength Push">' +
          '</div>' +
          '<div class="field full">' +
            '<div class="label">Description</div>' +
            '<textarea class="textarea" id="cm-description" rows="3" placeholder="The rules — what entrants do, how scores are recorded">' + escHtml(c.description) + '</textarea>' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">Activity <span class="req">*</span> <span class="label-hint">— what is it?</span></div>' +
            '<button type="button" class="ffp-picker-btn placeholder" id="cm-activity-btn" data-value="" data-category="">' +
              '<span>Choose activity…</span><span class="ms caret">expand_more</span>' +
            '</button>' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">Metric <span class="label-hint">— how scores are measured</span></div>' +
            '<input class="input" id="cm-metric" value="' + escHtml(c.metric) + '" placeholder="e.g. Combined PR kg increase">' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">Venue</div>' +
            '<input class="input" id="cm-venue" value="' + escHtml(c.venue) + '" placeholder="Where it happens">' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">Prize <span class="label-hint">— physical gift only</span></div>' +
            '<input class="input" id="cm-prize" value="' + escHtml(c.prize) + '" placeholder="e.g. Recovery kit for top 3">' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">Start date <span class="req">*</span></div>' +
            '<input class="input" type="date" id="cm-start" value="' + escHtml(c.start_date) + '">' +
          '</div>' +
          '<div class="field">' +
            '<div class="label">End date <span class="req">*</span></div>' +
            '<input class="input" type="date" id="cm-end" value="' + escHtml(c.end_date) + '">' +
          '</div>' +
        '</div>' +
      '</div>' +
      (editing && (c.status === 'live' || c.status === 'paused')
        ? ''
        : '');

    var foot =
      (editing ? '<button class="btn btn-ghost left" onclick="confirmDeleteChallenge(\'' + editing.id + '\')"><span class="ms">delete</span> Delete</button>' : '') +
      '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-pri" onclick="saveChallenge(\'' + (editing ? editing.id : '') + '\')">' +
        (editing ? 'Save changes' : 'Submit for review') +
      '</button>';

    if (typeof window.openModalShell === 'function') {
      window.openModalShell('lg', (editing ? 'Edit challenge' : 'New challenge'), body, foot);
    }
    if (typeof window.renderListingUploader === 'function') {
      try { window.renderListingUploader(c.hero_url); } catch (e) {}
    }

    // Wire activity picker
    setTimeout(function () {
      var btn = document.getElementById('cm-activity-btn');
      if (!btn) return;
      if (c.activity || c.category) {
        setActivityBtn(btn, c.activity || c.category, c.category);
      }
      btn.addEventListener('click', function () {
        if (window.FFPPicker && typeof window.FFPPicker.openActivity === 'function') {
          window.FFPPicker.openActivity(btn.dataset.value, function (name, cat) {
            setActivityBtn(btn, name, cat);
          });
        } else {
          console.error('[FFP Challenges] FFPPicker not loaded');
          toast('Activity picker not ready', 'error');
        }
      });
    }, 50);
  }

  // ─── Save ───
  function dateToTimestamp(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  async function realSaveChallenge(id) {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) { toast('Provider not loaded', 'error'); return; }
    var get = function (key) {
      var el = document.getElementById('cm-' + key);
      return el ? (el.value || '').trim() : '';
    };

    var title = get('title');
    var actBtn = document.getElementById('cm-activity-btn');
    var activity = actBtn ? actBtn.dataset.value : '';
    var category = actBtn ? actBtn.dataset.category : '';
    var startDate = get('start');
    var endDate = get('end');

    if (!title)     { toast('Title is required', 'error'); return; }
    if (!activity)  { toast('Activity is required', 'error'); return; }
    if (!startDate) { toast('Start date is required', 'error'); return; }
    if (!endDate)   { toast('End date is required', 'error'); return; }

    var photoSlot = document.getElementById('listing-photo-slot');
    var heroUrl = (photoSlot && photoSlot.dataset.url) ? photoSlot.dataset.url : null;
    if (heroUrl === '') heroUrl = null;

    var payload = {
      title:             title,
      description:       get('description') || null,
      activity:          activity,
      category:          category || null,
      metric:            get('metric') || null,
      venue:             get('venue') || null,
      prize_description: get('prize') || null,
      starts_at:         dateToTimestamp(startDate),
      ends_at:           dateToTimestamp(endDate),
      hero_image_url:    heroUrl
    };

    var reapprovalNote = '';
    try {
      if (id) {
        // edit via SECURITY DEFINER RPC (auth.uid trap blocks direct .update). Keeps current status.
        var upd = await window.supabase.rpc('provider_save_listing', { p_kind: 'challenge', p_provider: (window.FFP_PROVIDER || {}).id, p_id: id, p: payload });
        if (upd.error) throw upd.error;
        if (!upd.data) throw new Error('Update failed — not found or not permitted');
        toast('Challenge updated', 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
      } else {
        var ins = await window.supabase.rpc('provider_save_listing', { p_kind: 'challenge', p_provider: (window.FFP_PROVIDER || {}).id, p_id: null, p: payload });
        if (ins.error) throw ins.error;
        if (!ins.data) throw new Error('Submit failed — please try again');
        if (typeof window.closeModal === 'function') window.closeModal();
        if (typeof window.showSubmittedModal === 'function') {
          try { window.showSubmittedModal('challenge'); } catch (e) {}
        } else {
          toast('Submitted for review', 'success');
        }
      }
      await refresh();
    } catch (e) {
      console.error('[FFP Challenges] save:', e);
      var msg = e.message || 'Save failed';
      if (/policy|permission|denied|rls/i.test(msg)) msg = 'Save blocked by RLS';
      else if (/does not exist/i.test(msg))         msg = 'Schema mismatch — run the challenges SQL';
      toast(msg, 'error');
    }
  }

  async function realDeleteChallenge(id) {
    if (!id) return;
    var doDelete = async function () {
      try {
        var res = await window.supabase.rpc('provider_delete_listing', { p_kind: 'challenge', p_provider: (window.FFP_PROVIDER||{}).id, p_id: id });
        if (!res.error && res.data !== 'deleted') throw new Error('Delete failed — not found or not permitted');
        if (res.error) throw res.error;
        toast('Challenge deleted', 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
        await refresh();
      } catch (e) {
        console.error('[FFP Challenges] delete:', e);
        toast(e.message || 'Delete failed', 'error');
      }
    };
    if (typeof window.openConfirm === 'function') {
      window.openConfirm('Delete this challenge?', 'Members who entered keep their record, but no new entries can be made. This cannot be undone.', doDelete);
    } else {
      if (confirm('Delete this challenge?')) await doDelete();
    }
  }

  // ─── Init ───
  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth &&
             typeof window.renderChallenges === 'function' &&
             typeof challenges !== 'undefined';
    }, 15000);
    if (!ok) { console.error('[FFP Challenges] dependencies never loaded'); return; }

    var authed = await waitFor(function () {
      return !!(window.FFP_PROVIDER && window.FFP_PROVIDER.id);
    }, 30000);
    if (!authed) { console.warn('[FFP Challenges] FFP_PROVIDER not set'); return; }

    injectStyles();

    try {
      await refresh();
      console.log('[FFP Challenges v1] Loaded from Supabase \u2713');
    } catch (e) {
      console.error('[FFP Challenges] initial load:', e);
    }

    window.openChallengeModal     = realOpenChallengeModal;
    window.saveChallenge          = realSaveChallenge;
    window.confirmDeleteChallenge = realDeleteChallenge;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

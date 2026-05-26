/* ═══════════════════════════════════════════════════════════════════════
   FFP PROFILE LOADER (v3)
   ───────────────────────────────────────────────────────────────────────
   v3 changes:
   - SAVES GENDER (requires `gender` column in members table — run the
     add-gender-column.sql migration first)
   - Injects a big, clear SAVE BUTTON at the top of the profile panel
     with visible states: All saved / Save changes / Saving / Saved / Failed
   - Manual save still triggers via button; auto-save still runs in background
═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let serverSnapshot = null;
  let saveTimer = null;
  let isSaving = false;
  let currentUid = null;
  let retries = 0;
  const MAX_RETRIES = 30;
  const AUTOSAVE_DELAY = 1500;

  // ─── Inject CSS for save bar + error toast ───────────────────────────
  function injectStyles() {
    if (document.getElementById('ffp-profile-loader-styles')) return;
    const s = document.createElement('style');
    s.id = 'ffp-profile-loader-styles';
    s.textContent = `
      .toast.ffp-error{border-color:#ef4444 !important;}
      .toast.ffp-error .material-icons{color:#ef4444 !important;}

      .ffp-savebar{
        position:sticky;top:0;z-index:90;
        background:linear-gradient(180deg,#0f1e2e 0%,#0f1e2e 85%,rgba(15,30,46,0));
        padding:14px 0 18px;margin:-4px 0 14px;
        display:flex;align-items:center;justify-content:space-between;gap:12px;
      }
      .ffp-savebar-status{
        font-size:12px;font-weight:700;color:#6a90a8;
        display:flex;align-items:center;gap:6px;
        flex:1;min-width:0;
      }
      .ffp-savebar-status .material-icons{font-size:16px;}
      .ffp-savebar-status.dirty{color:#facc15;}
      .ffp-savebar-status.saving{color:#9dbdd0;}
      .ffp-savebar-status.saved{color:#22c55e;}
      .ffp-savebar-status.error{color:#ef4444;}

      .ffp-savebar-btn{
        background:#2ba8e0;color:#fff;border:none;border-radius:10px;
        padding:11px 22px;font-size:14px;font-weight:800;cursor:pointer;
        font-family:'Montserrat',sans-serif;
        display:flex;align-items:center;gap:7px;
        transition:all .15s;letter-spacing:.3px;
        min-width:140px;justify-content:center;
      }
      .ffp-savebar-btn:hover:not(:disabled){background:#1980AD;}
      .ffp-savebar-btn:disabled{
        background:rgba(43,168,224,.15);color:#6a90a8;cursor:default;
      }
      .ffp-savebar-btn.dirty{background:#2ba8e0;color:#fff;}
      .ffp-savebar-btn.dirty:hover{background:#1980AD;}
      .ffp-savebar-btn.error{background:#ef4444;color:#fff;}
      .ffp-savebar-btn.error:hover{background:#dc2626;}
      .ffp-savebar-btn .material-icons{font-size:16px;}

      @keyframes ffp-spin{to{transform:rotate(360deg);}}
      .ffp-savebar-btn.saving .material-icons{animation:ffp-spin 1s linear infinite;}
    `;
    document.head.appendChild(s);
  }

  // ─── Save bar rendering ──────────────────────────────────────────────
  let saveBarState = 'idle'; // idle | dirty | saving | saved | error

  function renderSaveBar() {
    const bar = document.getElementById('ffp-savebar');
    if (!bar) return;

    let statusIcon, statusText, btnIcon, btnText, statusClass, btnClass, btnDisabled;

    switch (saveBarState) {
      case 'dirty':
        statusIcon = 'edit'; statusText = 'Unsaved changes';
        btnIcon = 'save'; btnText = 'Save Changes';
        statusClass = 'dirty'; btnClass = 'dirty'; btnDisabled = false;
        break;
      case 'saving':
        statusIcon = 'sync'; statusText = 'Saving…';
        btnIcon = 'sync'; btnText = 'Saving…';
        statusClass = 'saving'; btnClass = 'saving'; btnDisabled = true;
        break;
      case 'saved':
        statusIcon = 'check_circle'; statusText = 'All changes saved';
        btnIcon = 'check'; btnText = 'Saved';
        statusClass = 'saved'; btnClass = ''; btnDisabled = true;
        break;
      case 'error':
        statusIcon = 'error'; statusText = 'Save failed — tap to retry';
        btnIcon = 'refresh'; btnText = 'Retry Save';
        statusClass = 'error'; btnClass = 'error'; btnDisabled = false;
        break;
      default: // idle
        statusIcon = 'check_circle'; statusText = 'All changes saved';
        btnIcon = 'check'; btnText = 'Saved';
        statusClass = ''; btnClass = ''; btnDisabled = true;
    }

    bar.querySelector('.ffp-savebar-status').className = 'ffp-savebar-status ' + statusClass;
    bar.querySelector('.ffp-savebar-status').innerHTML =
      '<span class="material-icons">' + statusIcon + '</span>' +
      '<span>' + statusText + '</span>';

    const btn = bar.querySelector('.ffp-savebar-btn');
    btn.className = 'ffp-savebar-btn ' + btnClass;
    btn.disabled = btnDisabled;
    btn.innerHTML =
      '<span class="material-icons">' + btnIcon + '</span>' +
      '<span>' + btnText + '</span>';
  }

  function setSaveBarState(state) {
    saveBarState = state;
    renderSaveBar();
  }

  function injectSaveBar() {
    const body = document.getElementById('profile-body');
    if (!body) return;
    if (document.getElementById('ffp-savebar')) return; // already present

    const bar = document.createElement('div');
    bar.id = 'ffp-savebar';
    bar.className = 'ffp-savebar';
    bar.innerHTML =
      '<div class="ffp-savebar-status">' +
        '<span class="material-icons">check_circle</span>' +
        '<span>All changes saved</span>' +
      '</div>' +
      '<button class="ffp-savebar-btn" disabled>' +
        '<span class="material-icons">check</span>' +
        '<span>Saved</span>' +
      '</button>';

    body.parentNode.insertBefore(bar, body);

    bar.querySelector('.ffp-savebar-btn').addEventListener('click', function () {
      clearTimeout(saveTimer);
      saveProfileToSupabase(true);
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────
  function formatPassportDate(isoDate) {
    if (!isoDate) return '';
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    return String(d.getDate()).padStart(2, '0') + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function snapshotProfileData() {
    if (typeof MemberProfile === 'undefined' || !MemberProfile.data) return null;
    return JSON.stringify({
      givenNames:  MemberProfile.data.givenNames,
      surname:     MemberProfile.data.surname,
      dobDay:      MemberProfile.data.dobDay,
      dobMonth:    MemberProfile.data.dobMonth,
      dobYear:     MemberProfile.data.dobYear,
      gender:      MemberProfile.data.gender,
      country:     MemberProfile.data.country,
      city:        MemberProfile.data.city,
      nationality: MemberProfile.data.nationality,
      sports:      MemberProfile.data.sports
    });
  }

  // ─── Load profile from Supabase ──────────────────────────────────────
  async function loadProfileFromSupabase() {
    if (!window.supabase || !window.supabase.auth || typeof MemberProfile === 'undefined') {
      if (retries < MAX_RETRIES) {
        retries++;
        setTimeout(loadProfileFromSupabase, 200);
      } else {
        console.error('[FFP Profile Loader] Supabase or MemberProfile not available.');
      }
      return;
    }

    try {
      const sessionRes = await window.supabase.auth.getSession();
      if (!sessionRes.data || !sessionRes.data.session) {
        console.warn('[FFP Profile Loader] No active session.');
        return;
      }
      currentUid = sessionRes.data.session.user.id;

      const [memberRes, metaRes] = await Promise.all([
        window.supabase.from('members').select('*').eq('id', currentUid).single(),
        window.supabase.from('profile_meta').select('*').eq('member_id', currentUid).maybeSingle()
      ]);

      if (memberRes.error) {
        console.error('[FFP Profile Loader] Could not load member:', memberRes.error);
        return;
      }

      const member = memberRes.data;
      const meta = (metaRes && metaRes.data) || {};

      let dobDay = '', dobMonth = '', dobYear = '';
      if (member.date_of_birth) {
        const parts = String(member.date_of_birth).split('-');
        dobYear = parts[0] || '';
        dobMonth = parts[1] || '';
        dobDay = parts[2] || '';
      }

      let sports = [];
      if (Array.isArray(meta.skills)) {
        sports = meta.skills.map(function (s) { return { name: s.name, level: s.level }; });
      } else if (meta.skills && typeof meta.skills === 'object') {
        sports = Object.keys(meta.skills).map(function (name) {
          return { name: name, level: meta.skills[name] };
        });
      }

      const memberSince = member.created_at ? formatPassportDate(member.created_at) : '';

      Object.assign(MemberProfile.data, {
        givenNames:     member.given_names || MemberProfile.data.givenNames || '',
        surname:        member.surname || MemberProfile.data.surname || '',
        email:          member.email || MemberProfile.data.email || '',
        dobDay:         dobDay,
        dobMonth:       dobMonth,
        dobYear:        dobYear,
        gender:         member.gender || MemberProfile.data.gender || 'Male',
        country:        member.country || MemberProfile.data.country || '',
        city:           member.city || MemberProfile.data.city || '',
        nationality:    member.nationality || MemberProfile.data.nationality || '',
        memberSince:    memberSince,
        passportNumber: member.passport_no || MemberProfile.data.passportNumber || '',
        issueDate:      memberSince,
        expiryDate:     '31 DEC 2026',
        sports:         sports.length > 0 ? sports : (MemberProfile.data.sports || [])
      });

      serverSnapshot = snapshotProfileData();

      injectStyles();

      // Wrap MemberProfile.render once so save bar is re-injected after re-renders
      if (typeof MemberProfile.render === 'function' && !window._ffpProfileRenderWrapped) {
        const originalRender = MemberProfile.render.bind(MemberProfile);
        MemberProfile.render = function () {
          originalRender();
          setTimeout(function () {
            injectSaveBar();
            renderSaveBar();
          }, 30);
        };
        window._ffpProfileRenderWrapped = true;
      }

      const panel = document.getElementById('panel-profile');
      if (panel && panel.classList.contains('active') && typeof MemberProfile.render === 'function') {
        MemberProfile.render();
      } else {
        // Panel not yet active — inject when it becomes visible
        injectSaveBar();
        renderSaveBar();
      }

      attachAutoSave();
      console.log('[FFP Profile Loader] Profile loaded from Supabase ✓');

    } catch (err) {
      console.error('[FFP Profile Loader] Unexpected error:', err);
    }
  }

  // ─── Auto-save: debounced 1.5s after change ──────────────────────────
  function attachAutoSave() {
    document.addEventListener('input', queueSave, true);
    document.addEventListener('change', queueSave, true);
    document.addEventListener('click', queueSaveDelayed, true);
  }

  function queueSave(e) {
    const panel = document.getElementById('panel-profile');
    if (!panel || !panel.contains(e.target)) return;
    // Ignore clicks on the save bar itself
    if (e.target.closest('#ffp-savebar')) return;
    markDirty();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveProfileToSupabase(false); }, AUTOSAVE_DELAY);
  }

  function queueSaveDelayed(e) {
    const panel = document.getElementById('panel-profile');
    if (!panel || !panel.contains(e.target)) return;
    if (e.target.closest('#ffp-savebar')) return;
    markDirty();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveProfileToSupabase(false); }, 2000);
  }

  function markDirty() {
    if (!serverSnapshot) return;
    const current = snapshotProfileData();
    if (current !== serverSnapshot) {
      setSaveBarState('dirty');
    }
  }

  async function saveProfileToSupabase(manual) {
    if (isSaving || !serverSnapshot || !currentUid) return;

    const currentSnapshot = snapshotProfileData();
    if (currentSnapshot === serverSnapshot && !manual) return;

    isSaving = true;
    setSaveBarState('saving');

    try {
      const dy = MemberProfile.data.dobYear;
      const dm = MemberProfile.data.dobMonth;
      const dd = MemberProfile.data.dobDay;
      const dob = (dy && dm && dd)
        ? dy + '-' + String(dm).padStart(2, '0') + '-' + String(dd).padStart(2, '0')
        : null;

      const fullName = ((MemberProfile.data.givenNames || '') + ' ' + (MemberProfile.data.surname || '')).trim();

      const updatePayload = {
        given_names:   MemberProfile.data.givenNames,
        surname:       MemberProfile.data.surname,
        full_name:     fullName,
        date_of_birth: dob,
        gender:        MemberProfile.data.gender,
        country:       MemberProfile.data.country,
        city:          MemberProfile.data.city,
        nationality:   MemberProfile.data.nationality
      };

      console.log('[FFP Profile Loader] Saving payload:', updatePayload);

      const memberUpdate = await window.supabase
        .from('members')
        .update(updatePayload)
        .eq('id', currentUid);

      if (memberUpdate.error) {
        console.error('[FFP Profile Loader] Save failed. Full error:', {
          code:    memberUpdate.error.code,
          message: memberUpdate.error.message,
          details: memberUpdate.error.details,
          hint:    memberUpdate.error.hint
        });
        setSaveBarState('error');
        isSaving = false;
        return;
      }

      // Save sports to profile_meta
      const sportsArr = (MemberProfile.data.sports || []).map(function (s) {
        return { name: s.name, level: s.level, shared: false };
      });
      const metaUpdate = await window.supabase
        .from('profile_meta')
        .upsert({ member_id: currentUid, skills: sportsArr }, { onConflict: 'member_id' });

      if (metaUpdate.error) {
        console.error('[FFP Profile Loader] Skills save failed:', metaUpdate.error);
      }

      serverSnapshot = currentSnapshot;
      setSaveBarState('saved');
      console.log('[FFP Profile Loader] Profile saved ✓');

      // After 2s of "Saved" → go back to idle (also "All saved" state)
      setTimeout(function () {
        if (saveBarState === 'saved') setSaveBarState('idle');
      }, 2000);

    } catch (err) {
      console.error('[FFP Profile Loader] Save exception:', err);
      setSaveBarState('error');
    } finally {
      isSaving = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(loadProfileFromSupabase, 300);
    });
  } else {
    setTimeout(loadProfileFromSupabase, 300);
  }

  window.ffpReloadProfile = loadProfileFromSupabase;
  window.ffpSaveProfile = function () { saveProfileToSupabase(true); };
})();

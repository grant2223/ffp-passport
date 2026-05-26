/* ═══════════════════════════════════════════════════════════════════════
   FFP PROFILE LOADER (v6)
   ───────────────────────────────────────────────────────────────────────
   v6 changes:
   - GLOBAL no-scrollbar rule baked into injected styles (applies to every
     element on the dashboard, including dropdown popups)
   - All v5 features retained
═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let serverSnapshot = null;
  let isSaving = false;
  let currentUid = null;
  let retries = 0;
  const MAX_RETRIES = 30;

  // ─── Inject CSS for save button + error toast styling ────────────────
  function injectStyles() {
    if (document.getElementById('ffp-profile-loader-styles')) return;
    const s = document.createElement('style');
    s.id = 'ffp-profile-loader-styles';
    s.textContent = `
      /* ── FFP RULE: no default browser scrollbars anywhere ── */
      *::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}
      *{-ms-overflow-style:none !important;scrollbar-width:none !important;}

      /* ── Error toast (dashboard toast is green by default) ── */
      .toast.ffp-error{border-color:#ef4444 !important;}
      .toast.ffp-error .material-icons{color:#ef4444 !important;}

      /* ── Save Changes button at the bottom of profile ── */
      #ffp-save-btn-wrap{
        margin-top:24px;
        padding-top:18px;
        border-top:1px solid rgba(43,168,224,.15);
      }
      .ffp-save-btn{
        display:flex;align-items:center;justify-content:center;gap:8px;
        width:100%;padding:15px;
        background:#2ba8e0;color:#fff;border:none;border-radius:12px;
        font-size:15px;font-weight:800;cursor:pointer;
        font-family:'Montserrat',sans-serif;
        letter-spacing:.3px;
        transition:background .15s;
      }
      .ffp-save-btn:hover:not(:disabled){background:#1980AD;}
      .ffp-save-btn:disabled{
        background:rgba(43,168,224,.25);color:#9dbdd0;cursor:default;
      }
      .ffp-save-btn .material-icons{font-size:18px;}
      @keyframes ffp-spin{to{transform:rotate(360deg);}}
      .ffp-save-btn.saving .material-icons{animation:ffp-spin 1s linear infinite;}

      /* ── 3-column DOB picker ── */
      .field-card-dob3{
        background:rgba(43,168,224,.05);
        border:1px solid rgba(43,168,224,.18);
        border-radius:12px;
        padding:12px 14px;
      }
      .field-card-dob3 .field-card-label-top{
        font-size:10px;font-weight:800;color:#6a90a8;
        letter-spacing:.6px;text-transform:uppercase;margin-bottom:8px;
      }
      .dob3-row{
        display:grid;
        grid-template-columns:1fr 1.4fr 1fr;
        gap:8px;
      }
      .dob3-select{
        width:100%;
        background:rgba(43,168,224,.08);
        border:1px solid rgba(43,168,224,.22);
        border-radius:8px;
        padding:11px 12px;
        font-size:14px;
        font-weight:600;
        color:#fff;
        font-family:'Montserrat',sans-serif;
        appearance:none;
        -webkit-appearance:none;
        cursor:pointer;
        outline:none;
        transition:border-color .15s;
        background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236a90a8' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>");
        background-position:right 8px center;
        background-repeat:no-repeat;
        background-size:12px;
        padding-right:28px;
      }
      .dob3-select:focus{border-color:#2ba8e0;}
      .dob3-select option{background:#0b1c28;color:#fff;}
      .dob3-select.empty{color:#6a90a8;}
    `;
    document.head.appendChild(s);
  }

  // ─── Toast helper (uses dashboard's existing showToast + adds error styling) ──
  function showStatusToast(msg, isError) {
    if (typeof showToast !== 'function') return;
    showToast(msg, isError ? 'error' : 'check');
    const t = document.getElementById('ffp-toast');
    if (t) {
      if (isError) t.classList.add('ffp-error');
      else t.classList.remove('ffp-error');
    }
  }

  // ─── Save button at bottom of profile ────────────────────────────────
  function injectSaveButton() {
    const body = document.getElementById('profile-body');
    if (!body) return;

    // Remove existing if present (so re-renders don't duplicate)
    const existing = document.getElementById('ffp-save-btn-wrap');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'ffp-save-btn-wrap';
    wrap.innerHTML =
      '<button class="ffp-save-btn" id="ffp-save-profile-btn">' +
        '<span class="material-icons">save</span>' +
        '<span>Save Changes</span>' +
      '</button>';
    body.appendChild(wrap);

    document.getElementById('ffp-save-profile-btn').addEventListener('click', function () {
      saveProfileToSupabase();
    });
  }

  function setSaveButtonState(state) {
    const btn = document.getElementById('ffp-save-profile-btn');
    if (!btn) return;
    btn.classList.remove('saving');
    switch (state) {
      case 'saving':
        btn.classList.add('saving');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons">sync</span><span>Saving…</span>';
        break;
      case 'saved':
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons">check</span><span>Saved</span>';
        setTimeout(function () { setSaveButtonState('idle'); }, 2000);
        break;
      case 'error':
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">save</span><span>Save Changes</span>';
        break;
      default: // idle
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">save</span><span>Save Changes</span>';
    }
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

  // ─── Patch DOB card with three clean dropdowns ───────────────────────
  function patchDOBCard() {
    if (typeof MemberProfile === 'undefined') return;
    if (window._ffpDobPatched) return;

    const MONTH_NAMES = [
      { num:'01', name:'January' }, { num:'02', name:'February' }, { num:'03', name:'March' },
      { num:'04', name:'April' },   { num:'05', name:'May' },      { num:'06', name:'June' },
      { num:'07', name:'July' },    { num:'08', name:'August' },   { num:'09', name:'September' },
      { num:'10', name:'October' }, { num:'11', name:'November' }, { num:'12', name:'December' }
    ];

    MemberProfile.renderDOBCard = function () {
      const currentYear = new Date().getFullYear();
      const maxYear = currentYear - 13;
      const minYear = 1900;

      let dayOptions = '<option value="" ' + (!this.data.dobDay ? 'selected' : '') + '>Day</option>';
      for (let d = 1; d <= 31; d++) {
        const v = String(d).padStart(2, '0');
        dayOptions += '<option value="' + v + '"' + (this.data.dobDay === v ? ' selected' : '') + '>' + d + '</option>';
      }

      let monthOptions = '<option value="" ' + (!this.data.dobMonth ? 'selected' : '') + '>Month</option>';
      MONTH_NAMES.forEach(function (m) {
        monthOptions += '<option value="' + m.num + '"' +
                       (MemberProfile.data.dobMonth === m.num ? ' selected' : '') +
                       '>' + m.name + '</option>';
      });

      let yearOptions = '<option value="" ' + (!this.data.dobYear ? 'selected' : '') + '>Year</option>';
      for (let y = maxYear; y >= minYear; y--) {
        yearOptions += '<option value="' + y + '"' + (this.data.dobYear === String(y) ? ' selected' : '') + '>' + y + '</option>';
      }

      return '<div class="field-card field-card-dob3">' +
               '<div class="field-card-label-top">Date of Birth</div>' +
               '<div class="dob3-row">' +
                 '<select class="dob3-select' + (this.data.dobDay ? '' : ' empty') + '" ' +
                          'onchange="MemberProfile.data.dobDay = this.value; ' +
                                    'this.classList.toggle(\'empty\', !this.value);">' +
                   dayOptions +
                 '</select>' +
                 '<select class="dob3-select' + (this.data.dobMonth ? '' : ' empty') + '" ' +
                          'onchange="MemberProfile.data.dobMonth = this.value; ' +
                                    'this.classList.toggle(\'empty\', !this.value);">' +
                   monthOptions +
                 '</select>' +
                 '<select class="dob3-select' + (this.data.dobYear ? '' : ' empty') + '" ' +
                          'onchange="MemberProfile.data.dobYear = this.value; ' +
                                    'this.classList.toggle(\'empty\', !this.value);">' +
                   yearOptions +
                 '</select>' +
               '</div>' +
             '</div>';
    };

    window._ffpDobPatched = true;
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
      patchDOBCard();

      // Wrap MemberProfile.render so the Save button is re-injected after re-renders
      if (typeof MemberProfile.render === 'function' && !window._ffpProfileRenderWrapped) {
        const originalRender = MemberProfile.render.bind(MemberProfile);
        MemberProfile.render = function () {
          originalRender();
          setTimeout(injectSaveButton, 30);
        };
        window._ffpProfileRenderWrapped = true;
      }

      // Trigger render if panel is already open, otherwise just inject the button
      const panel = document.getElementById('panel-profile');
      if (panel && panel.classList.contains('active') && typeof MemberProfile.render === 'function') {
        MemberProfile.render();
      } else {
        injectSaveButton();
      }

      console.log('[FFP Profile Loader] Profile loaded from Supabase ✓');

    } catch (err) {
      console.error('[FFP Profile Loader] Unexpected error:', err);
    }
  }

  // ─── Save profile to Supabase ────────────────────────────────────────
  async function saveProfileToSupabase() {
    if (isSaving || !currentUid) return;

    isSaving = true;
    setSaveButtonState('saving');

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
        setSaveButtonState('error');
        showStatusToast('Save failed', true);
        isSaving = false;
        return;
      }

      const sportsArr = (MemberProfile.data.sports || []).map(function (s) {
        return { name: s.name, level: s.level, shared: false };
      });
      const metaUpdate = await window.supabase
        .from('profile_meta')
        .upsert({ member_id: currentUid, skills: sportsArr }, { onConflict: 'member_id' });

      if (metaUpdate.error) {
        console.error('[FFP Profile Loader] Skills save failed:', metaUpdate.error);
      }

      serverSnapshot = snapshotProfileData();
      setSaveButtonState('saved');
      showStatusToast('Saved', false);
      console.log('[FFP Profile Loader] Profile saved ✓');

    } catch (err) {
      console.error('[FFP Profile Loader] Save exception:', err);
      setSaveButtonState('error');
      showStatusToast('Save failed', true);
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
  window.ffpSaveProfile = saveProfileToSupabase;
})();

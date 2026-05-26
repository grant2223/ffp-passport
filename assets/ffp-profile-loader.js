/* ═══════════════════════════════════════════════════════════════════════
   FFP PROFILE LOADER (v2)
   ───────────────────────────────────────────────────────────────────────
   v2 changes:
   - Removed `gender` from save (column not yet in members schema)
   - Full Supabase error logging (code, message, details, hint)
   - Distinct error toast styling (red border + red icon)
═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let serverSnapshot = null;
  let saveTimer = null;
  let isSaving = false;
  let currentUid = null;
  let retries = 0;
  const MAX_RETRIES = 30;

  // ─── Inject error toast styling once ─────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ffp-profile-loader-styles')) return;
    const s = document.createElement('style');
    s.id = 'ffp-profile-loader-styles';
    s.textContent =
      '.toast.ffp-error{border-color:#ef4444 !important;}' +
      '.toast.ffp-error .material-icons{color:#ef4444 !important;}';
    document.head.appendChild(s);
  }

  function showStatusToast(msg, isError) {
    if (typeof showToast !== 'function') return;
    showToast(msg, isError ? 'error' : 'check');
    const t = document.getElementById('ffp-toast');
    if (t) {
      if (isError) t.classList.add('ffp-error');
      else t.classList.remove('ffp-error');
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

      const panel = document.getElementById('panel-profile');
      if (panel && panel.classList.contains('active') && typeof MemberProfile.render === 'function') {
        MemberProfile.render();
      }

      attachAutoSave();
      injectStyles();
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
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProfileToSupabase, 1500);
  }

  function queueSaveDelayed(e) {
    const panel = document.getElementById('panel-profile');
    if (!panel || !panel.contains(e.target)) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProfileToSupabase, 2000);
  }

  async function saveProfileToSupabase() {
    if (isSaving || !serverSnapshot || !currentUid) return;

    const currentSnapshot = snapshotProfileData();
    if (currentSnapshot === serverSnapshot) return;

    isSaving = true;
    try {
      const dy = MemberProfile.data.dobYear;
      const dm = MemberProfile.data.dobMonth;
      const dd = MemberProfile.data.dobDay;
      const dob = (dy && dm && dd)
        ? dy + '-' + String(dm).padStart(2, '0') + '-' + String(dd).padStart(2, '0')
        : null;

      const fullName = ((MemberProfile.data.givenNames || '') + ' ' + (MemberProfile.data.surname || '')).trim();

      // NOTE: `gender` removed in v2 — not yet in schema
      const updatePayload = {
        given_names:   MemberProfile.data.givenNames,
        surname:       MemberProfile.data.surname,
        full_name:     fullName,
        date_of_birth: dob,
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
        showStatusToast('Save failed', true);
        isSaving = false;
        return;
      }

      // Save sports/skills to profile_meta
      const sportsArr = (MemberProfile.data.sports || []).map(function (s) {
        return { name: s.name, level: s.level, shared: false };
      });
      const metaUpdate = await window.supabase
        .from('profile_meta')
        .upsert({ member_id: currentUid, skills: sportsArr }, { onConflict: 'member_id' });

      if (metaUpdate.error) {
        console.error('[FFP Profile Loader] Skills save failed:', {
          code:    metaUpdate.error.code,
          message: metaUpdate.error.message,
          details: metaUpdate.error.details,
          hint:    metaUpdate.error.hint
        });
      }

      serverSnapshot = currentSnapshot;
      showStatusToast('Saved', false);
      console.log('[FFP Profile Loader] Profile saved ✓');

    } catch (err) {
      console.error('[FFP Profile Loader] Save exception:', err);
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

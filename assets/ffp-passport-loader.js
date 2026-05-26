/* ═══════════════════════════════════════════════════════════════════════
   FFP PROFILE LOADER (v1)
   ───────────────────────────────────────────────────────────────────────
   Fetches the signed-in member's data into MemberProfile.data on load,
   then auto-saves changes back to Supabase 1.5s after the user stops
   editing. Uses the dashboard's existing showToast() function for UX.

   Wires the following fields to Supabase `members` table:
     given_names, surname, full_name, date_of_birth, gender,
     country, city, nationality
   Wires sports to `profile_meta.skills` as a JSONB array.

   Does NOT save:
     email          — tied to Supabase Auth, requires separate update flow
     phone fields   — not yet in DB schema (will add later)
     pin            — not yet in DB schema
     preferences    — not yet in DB schema
     professional   — admin-verified, members can declare but not save here
     photo          — needs Supabase Storage bucket (separate task)

   Requires (loaded BEFORE this file):
     1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
     2. assets/ffp-api-integration.js
     3. (passport-loader is independent, no order requirement)
═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let serverSnapshot = null;   // last-saved state as JSON string, for diffing
  let saveTimer = null;
  let isSaving = false;
  let currentUid = null;
  let retries = 0;
  const MAX_RETRIES = 30;

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

      // Fetch in parallel
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

      // Parse date_of_birth (format: YYYY-MM-DD)
      let dobDay = '', dobMonth = '', dobYear = '';
      if (member.date_of_birth) {
        const parts = String(member.date_of_birth).split('-');
        dobYear = parts[0] || '';
        dobMonth = parts[1] || '';
        dobDay = parts[2] || '';
      }

      // Map skills: support both array format and object format
      let sports = [];
      if (Array.isArray(meta.skills)) {
        sports = meta.skills.map(function (s) {
          return { name: s.name, level: s.level };
        });
      } else if (meta.skills && typeof meta.skills === 'object') {
        sports = Object.keys(meta.skills).map(function (name) {
          return { name: name, level: meta.skills[name] };
        });
      }

      const memberSince = member.created_at ? formatPassportDate(member.created_at) : '';

      // Populate MemberProfile.data (mutate in place — keeps other defaults intact)
      Object.assign(MemberProfile.data, {
        givenNames:     member.given_names || MemberProfile.data.givenNames || '',
        surname:        member.surname || MemberProfile.data.surname || '',
        email:          member.email || MemberProfile.data.email || '',
        dobDay:         dobDay,
        dobMonth:       dobMonth,
        dobYear:        dobYear,
        gender:         member.gender || 'X',
        country:        member.country || MemberProfile.data.country || '',
        city:           member.city || MemberProfile.data.city || '',
        nationality:    member.nationality || MemberProfile.data.nationality || '',
        memberSince:    memberSince,
        passportNumber: member.passport_no || MemberProfile.data.passportNumber || '',
        issueDate:      memberSince,
        expiryDate:     '31 DEC 2026',
        sports:         sports.length > 0 ? sports : (MemberProfile.data.sports || [])
      });

      // Take snapshot AFTER populating — this becomes the baseline for diffing
      serverSnapshot = snapshotProfileData();

      // Re-render profile panel if it's already visible
      const panel = document.getElementById('panel-profile');
      if (panel && panel.classList.contains('active') && typeof MemberProfile.render === 'function') {
        MemberProfile.render();
      }

      // Attach auto-save listeners
      attachAutoSave();

      console.log('[FFP Profile Loader] Profile loaded from Supabase ✓');

    } catch (err) {
      console.error('[FFP Profile Loader] Unexpected error:', err);
    }
  }

  // ─── Auto-save: debounced 1.5s after change ──────────────────────────
  function attachAutoSave() {
    // Use capture-phase to catch all events bubbling out of profile panel
    document.addEventListener('input', queueSave, true);
    document.addEventListener('change', queueSave, true);
    // Click handles button-driven changes (remove sport, etc.)
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
    // For clicks, give the dashboard render cycle a moment, then check
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProfileToSupabase, 2000);
  }

  async function saveProfileToSupabase() {
    if (isSaving || !serverSnapshot || !currentUid) return;

    const currentSnapshot = snapshotProfileData();
    if (currentSnapshot === serverSnapshot) return;  // no actual changes

    isSaving = true;
    try {
      // Build date_of_birth from parts
      const dy = MemberProfile.data.dobYear;
      const dm = MemberProfile.data.dobMonth;
      const dd = MemberProfile.data.dobDay;
      const dob = (dy && dm && dd)
        ? dy + '-' + String(dm).padStart(2, '0') + '-' + String(dd).padStart(2, '0')
        : null;

      const fullName = ((MemberProfile.data.givenNames || '') + ' ' + (MemberProfile.data.surname || '')).trim();

      // Update members table
      const memberUpdate = await window.supabase
        .from('members')
        .update({
          given_names:   MemberProfile.data.givenNames,
          surname:       MemberProfile.data.surname,
          full_name:     fullName,
          date_of_birth: dob,
          gender:        MemberProfile.data.gender,
          country:       MemberProfile.data.country,
          city:          MemberProfile.data.city,
          nationality:   MemberProfile.data.nationality
        })
        .eq('id', currentUid);

      if (memberUpdate.error) {
        console.error('[FFP Profile Loader] Save failed:', memberUpdate.error);
        if (typeof showToast === 'function') showToast('Save failed', 'error');
        isSaving = false;
        return;
      }

      // Upsert profile_meta with sports (preserve other fields if present)
      const sportsArr = (MemberProfile.data.sports || []).map(function (s) {
        return { name: s.name, level: s.level, shared: false };
      });
      const metaUpdate = await window.supabase
        .from('profile_meta')
        .upsert({ member_id: currentUid, skills: sportsArr }, { onConflict: 'member_id' });

      if (metaUpdate.error) {
        console.error('[FFP Profile Loader] Skills save failed:', metaUpdate.error);
      }

      // Update snapshot to current state
      serverSnapshot = currentSnapshot;
      if (typeof showToast === 'function') showToast('Saved');
      console.log('[FFP Profile Loader] Profile saved ✓');

    } catch (err) {
      console.error('[FFP Profile Loader] Save error:', err);
      if (typeof showToast === 'function') showToast('Save failed', 'error');
    } finally {
      isSaving = false;
    }
  }

  // ─── Run on DOM ready ────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(loadProfileFromSupabase, 300);
    });
  } else {
    setTimeout(loadProfileFromSupabase, 300);
  }

  // Expose for manual reload / debugging
  window.ffpReloadProfile = loadProfileFromSupabase;
  window.ffpSaveProfile = saveProfileToSupabase;
})();

/* ═══════════════════════════════════════════════════════════════════════
   FFP PASSPORT LOADER (v3)
   ───────────────────────────────────────────────────────────────────────
   Fetches the signed-in member's data from Supabase and renders it into
   the passport card. Mutates the global `memberPassport` object and wraps
   the dashboard's existing `applyPassportData()` function so that fields
   without `data-field` attributes also stay in sync.

   v3 changes:
   - TYPE field on passport card now shows FFP tier (MEMBER / SUPPORTER /
     AMBASSADOR) instead of hardcoded "F"
   - COUNTRY field shows the member's country of residence (from
     members.country) instead of hardcoded "UNITED ARAB EMIRATES"
   - applyPassportData is wrapped so these fields update live whenever the
     dashboard refreshes the passport (e.g. via MemberProfile.syncToPassport)

   Requires (load in this order in the dashboard HTML <head>):
     1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
     2. assets/ffp-api-integration.js
     3. assets/ffp-passport-loader.js  ← this file
═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Nationality → ISO 3-letter country code ─────────────────────────
  const NATIONALITY_TO_CODE = {
    'Emirati':'ARE','American':'USA','British':'GBR','Australian':'AUS',
    'Canadian':'CAN','South African':'ZAF','Indian':'IND','Pakistani':'PAK',
    'Filipino':'PHL','Egyptian':'EGY','Jordanian':'JOR','Lebanese':'LBN',
    'Syrian':'SYR','Iranian':'IRN','French':'FRA','German':'DEU','Italian':'ITA',
    'Spanish':'ESP','Portuguese':'PRT','Dutch':'NLD','Belgian':'BEL','Swiss':'CHE',
    'Polish':'POL','Russian':'RUS','Ukrainian':'UKR','Czech':'CZE','Romanian':'ROU',
    'Greek':'GRC','Turkish':'TUR','Brazilian':'BRA','Argentinian':'ARG',
    'Mexican':'MEX','Colombian':'COL','Chilean':'CHL','Chinese':'CHN','Japanese':'JPN',
    'Korean':'KOR','Thai':'THA','Vietnamese':'VNM','Singaporean':'SGP',
    'Malaysian':'MYS','Indonesian':'IDN','Saudi':'SAU','Kuwaiti':'KWT',
    'Qatari':'QAT','Bahraini':'BHR','Omani':'OMN','Iraqi':'IRQ','Nigerian':'NGA',
    'Kenyan':'KEN','Ghanaian':'GHA','Moroccan':'MAR','Algerian':'DZA',
    'Tunisian':'TUN','Ethiopian':'ETH','New Zealander':'NZL','Irish':'IRL',
    'Scottish':'GBR','Welsh':'GBR','Other':'XXX'
  };

  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const MEMBERSHIP_YEAR = 2026;

  // ─── Format helpers ──────────────────────────────────────────────────
  function formatPassportDate(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    return day + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function formatMRZ(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yy + mm + dd;
  }

  function computeInitials(givenNames, surname) {
    const g = (givenNames || '').trim();
    const s = (surname || '').trim();
    const gI = g.charAt(0).toUpperCase();
    const sI = s.charAt(0).toUpperCase();
    return (gI + sI) || 'FF';
  }

  // ─── Retry guard ─────────────────────────────────────────────────────
  let retries = 0;
  const MAX_RETRIES = 30; // ~6 seconds total

  async function loadPassportFromSupabase() {
    // Wait for Supabase SDK to be ready
    if (!window.supabase || !window.supabase.auth) {
      if (retries < MAX_RETRIES) {
        retries++;
        setTimeout(loadPassportFromSupabase, 200);
      } else {
        console.error('[FFP Passport Loader] Supabase SDK never loaded. Check network or CDN.');
      }
      return;
    }

    try {
      // Check session — redirect to login if not signed in
      const sessionRes = await window.supabase.auth.getSession();
      if (!sessionRes.data || !sessionRes.data.session) {
        console.warn('[FFP Passport Loader] No active session — redirecting to login.');
        window.location.href = 'login.html';
        return;
      }

      const uid = sessionRes.data.session.user.id;

      // Fetch member row
      const memberRes = await window.supabase
        .from('members')
        .select('*')
        .eq('id', uid)
        .single();

      if (memberRes.error) {
        console.error('[FFP Passport Loader] Could not load member:', memberRes.error);
        return;
      }
      const member = memberRes.data;
      if (!member) {
        console.warn('[FFP Passport Loader] No member row found for uid:', uid);
        return;
      }

      // Build the updated passport object
      const countryCode = NATIONALITY_TO_CODE[member.nationality] || 'XXX';
      const issueDate = member.created_at
        ? formatPassportDate(member.created_at)
        : formatPassportDate(new Date().toISOString());

      const updated = {
        surname:        (member.surname || '').toUpperCase(),
        givenNames:     (member.given_names || '').toUpperCase(),
        initials:       computeInitials(member.given_names, member.surname),
        nationality:    (member.nationality || '').toUpperCase(),
        countryCode:    countryCode,
        country:        (member.country || '').toUpperCase(),
        tier:           (member.tier || 'MEMBER').toUpperCase(),
        gender:         (member.gender || 'X').toUpperCase(),
        genderCode:     (member.gender || 'X').charAt(0).toUpperCase(),
        dob:            formatPassportDate(member.date_of_birth),
        dobMRZ:         formatMRZ(member.date_of_birth),
        issueDate:      issueDate,
        expiryDate:     '31 DEC ' + MEMBERSHIP_YEAR,
        expiryMRZ:      String(MEMBERSHIP_YEAR).slice(-2) + '1231',
        passportNumber: member.passport_no || 'FFP-' + MEMBERSHIP_YEAR + '-0000'
      };

      // Mutate the existing memberPassport object (works for const obj)
      if (typeof memberPassport !== 'undefined') {
        Object.assign(memberPassport, updated);
      } else if (typeof window.memberPassport !== 'undefined') {
        Object.assign(window.memberPassport, updated);
      } else {
        console.warn('[FFP Passport Loader] memberPassport not found in scope. Dashboard may be using a different variable name.');
        return;
      }

      // Wrap applyPassportData() once so that every render (including
      // profile-driven updates via MemberProfile.syncToPassport) also refreshes
      // the elements that don't have data-field attributes:
      //   - .pass-mini-val (TYPE = FFP tier, COUNTRY = country of residence)
      //   - .pass-passnum  (PASSPORT NO. at top right)
      if (typeof window.applyPassportData === 'function' && !window._ffpPassportWrapped) {
        const originalApplyPassportData = window.applyPassportData;
        window.applyPassportData = function () {
          originalApplyPassportData.apply(this, arguments);

          const miniVals = document.querySelectorAll('.pass-mini-val');
          // First .pass-mini-val = TYPE (was hardcoded "F", now shows FFP tier)
          if (miniVals[0] && memberPassport.tier) {
            miniVals[0].textContent = memberPassport.tier;
          }
          // Second .pass-mini-val = COUNTRY of residence
          if (miniVals[1] && memberPassport.country) {
            miniVals[1].textContent = memberPassport.country;
          }
          // .pass-passnum at top right
          const passNumEl = document.querySelector('.pass-passnum');
          if (passNumEl && memberPassport.passportNumber) {
            passNumEl.textContent = memberPassport.passportNumber;
          }
        };
        window._ffpPassportWrapped = true;
      }

      // Re-render the passport card (will trigger our wrapped function too)
      if (typeof applyPassportData === 'function') {
        applyPassportData();
        console.log('[FFP Passport Loader] Passport rendered with Supabase data ✓');
      } else if (typeof window.applyPassportData === 'function') {
        window.applyPassportData();
        console.log('[FFP Passport Loader] Passport rendered with Supabase data ✓');
      } else {
        console.warn('[FFP Passport Loader] applyPassportData() function not found.');
      }

      // Cache for offline / faster next load
      try {
        localStorage.setItem('ffp_passport', JSON.stringify(updated));
      } catch (e) {}

    } catch (err) {
      console.error('[FFP Passport Loader] Unexpected error:', err);
    }
  }

  // ─── Run on DOM ready ────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(loadPassportFromSupabase, 100);
    });
  } else {
    setTimeout(loadPassportFromSupabase, 100);
  }

  // Expose globally for manual re-render after edits
  window.ffpReloadPassport = loadPassportFromSupabase;
})();

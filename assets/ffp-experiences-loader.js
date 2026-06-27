/* ═══════════════════════════════════════════════════════════════════════
   FFP EXPERIENCES LOADER (v1)
   ───────────────────────────────────────────────────────────────────────
   Fetches live experiences + their organising providers from Supabase,
   plus the current user's applications. Replaces the dashboard's
   hardcoded Experiences.data sample.

   Reads:
     - experiences (status = 'live') joined with providers (status = 'approved')
     - applications for current user (to populate Experiences.applied Set)
     - applications count per experience (for "taken" slot count)

   Requires:
     1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
     2. assets/ffp-api-integration.js
═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let retries = 0;
  const MAX_RETRIES = 30;

  function injectStyles() {
    if (document.getElementById('ffp-experiences-loader-styles')) return;
    const s = document.createElement('style');
    s.id = 'ffp-experiences-loader-styles';
    s.textContent = `
      *::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}
      *{-ms-overflow-style:none !important;scrollbar-width:none !important;}
    `;
    document.head.appendChild(s);
  }

  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Format date range "10–19 Oct 2026" or "30 Oct – 2 Nov 2026"
  function formatDateRange(startsAt, endsAt) {
    if (!startsAt) return '';
    const s = new Date(startsAt + (startsAt.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(s.getTime())) return '';
    if (!endsAt) {
      return s.getDate() + ' ' + MONTH_ABBR[s.getMonth()] + ' ' + s.getFullYear();
    }
    const e = new Date(endsAt + (endsAt.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(e.getTime())) return s.getDate() + ' ' + MONTH_ABBR[s.getMonth()] + ' ' + s.getFullYear();
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return s.getDate() + '–' + e.getDate() + ' ' + MONTH_ABBR[s.getMonth()] + ' ' + s.getFullYear();
    }
    return s.getDate() + ' ' + MONTH_ABBR[s.getMonth()] + ' – ' +
           e.getDate() + ' ' + MONTH_ABBR[e.getMonth()] + ' ' + e.getFullYear();
  }

  // Format AED price with thousands separator
  function formatAed(amount) {
    if (!amount) return '';
    const n = Math.round(parseFloat(amount));
    return 'AED ' + n.toLocaleString('en-US');
  }

  // Compute a sensible deposit suggestion: ~20% rounded to nearest 500
  function suggestDeposit(priceAed) {
    if (!priceAed) return '';
    const raw = parseFloat(priceAed) * 0.20;
    const rounded = Math.round(raw / 500) * 500;
    return formatAed(Math.max(500, rounded));
  }

  // Map exp_type → banner cover style hint expected by the dashboard
  function mapCoverStyle(expType) {
    const t = String(expType || '').toLowerCase();
    if (t === 'retreat')      return 'retreat';
    if (t === 'sports event') return 'sports';
    if (t === 'adventure')    return 'adventure';
    if (t === 'fitness')      return 'fitness';
    if (t === 'wellness')     return 'wellness';
    if (t === 'hybrid')       return 'hybrid';
    return 'retreat';
  }

  // Build "includes" array dynamically from the schema columns that have data
  function buildIncludes(row) {
    const out = [];
    if (row.accommodation)   out.push({ cat: 'Accommodation', text: row.accommodation });
    if (row.flights_included) out.push({ cat: 'Flights', text: 'Included' });
    if (row.travel_reqs)     out.push({ cat: 'Travel', text: row.travel_reqs });
    if (row.fitness_reqs)    out.push({ cat: 'Fitness Required', text: row.fitness_reqs });
    if (row.packing_list)    out.push({ cat: 'Packing List', text: row.packing_list });
    if (row.good_to_know)    out.push({ cat: 'Good to Know', text: row.good_to_know });
    return out;
  }

  function mapExperienceRow(row, takenCount) {
    const provider = row.provider || {};
    const capacity = row.capacity || 0;
    const taken = takenCount || 0;
    const durationNights = row.duration_days || 0;

    return {
      id:         row.id,
      title:      row.title || '',
      location:   row.destination || '',
      dates:      formatDateRange(row.starts_at, row.ends_at),
      duration:   durationNights ? (durationNights + ' nights') : '',
      from:       formatAed(row.price_aed),
      deposit:    suggestDeposit(row.price_aed),
      organizer:  provider.business_name || 'Unknown organiser',
      orgLetter:  provider.letter_mark || (provider.business_name || '?').charAt(0).toUpperCase(),
      category:   row.exp_type || 'Retreat',
      spots:      capacity,
      taken:      taken,
      cover:      mapCoverStyle(row.exp_type),
      img:        row.hero_image_url || '',
      verified:   provider.status === 'approved',
      fitness:    row.fitness_level === 'All' ? 'All levels' : (row.fitness_level || ''),
      about:      row.description || '',
      includes:   buildIncludes(row),
      notIncluded: row.what_not_included || '',
      who:        row.fitness_reqs || '',
      full:       capacity > 0 && taken >= capacity
    };
  }

  async function loadExperiencesFromSupabase() {
    if (!window.supabase || typeof Experiences === 'undefined') {
      if (retries < MAX_RETRIES) {
        retries++;
        setTimeout(loadExperiencesFromSupabase, 200);
      } else {
        console.error('[FFP Experiences Loader] Supabase or Experiences module not available.');
      }
      return;
    }

    injectStyles();

    try {
      const expRes = await window.supabase
        .from('trips')
        .select('*, provider:providers!inner(business_name, letter_mark, category, provider_type, city, area, status)')
        .eq('status', 'live')
        .eq('provider.status', 'approved')
        .order('starts_at', { ascending: true });

      if (expRes.error) {
        console.error('[FFP Experiences Loader] Could not load experiences:', {
          code:    expRes.error.code,
          message: expRes.error.message,
          details: expRes.error.details,
          hint:    expRes.error.hint
        });
        console.warn('[FFP Experiences Loader] Keeping sample data fallback.');
        return;
      }

      const expRows = expRes.data || [];

      if (expRows.length === 0) {
        console.log('[FFP Experiences Loader] No live experiences in Supabase yet — keeping sample data.');
        return;
      }

      // Count applications + flag current user's
      const expIds = expRows.map(function (e) { return e.id; });
      let userAppliedIds = new Set();
      let countsByExp = {};

      const sessionRes = await window.supabase.auth.getSession();
      const uid = sessionRes.data && sessionRes.data.session ? sessionRes.data.session.user.id : null;

      const appsRes = await window.supabase
        .from('applications')
        .select('experience_id, member_id')
        .in('experience_id', expIds)
        .in('status', ['applied', 'approved', 'paid']);

      if (!appsRes.error && appsRes.data) {
        appsRes.data.forEach(function (a) {
          countsByExp[a.experience_id] = (countsByExp[a.experience_id] || 0) + 1;
          if (uid && a.member_id === uid) userAppliedIds.add(a.experience_id);
        });
      }

      Experiences.data = expRows.map(function (e) {
        return mapExperienceRow(e, countsByExp[e.id] || 0);
      });
      Experiences.applied = userAppliedIds;

      const panel = document.getElementById('panel-experiences');
      if (panel && panel.classList.contains('active') && typeof Experiences.render === 'function') {
        Experiences.render();
      }

      console.log('[FFP Experiences Loader] Loaded ' + expRows.length + ' live experiences from Supabase ✓');

    } catch (err) {
      console.error('[FFP Experiences Loader] Unexpected error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(loadExperiencesFromSupabase, 500);
    });
  } else {
    setTimeout(loadExperiencesFromSupabase, 500);
  }

  window.ffpReloadExperiences = loadExperiencesFromSupabase;
})();

/* ═══════════════════════════════════════════════════════════════════════
   FFP EVENTS LOADER (v2)
   ───────────────────────────────────────────────────────────────────────
   v2 changes:
   - Matches actual deployed schema:
     * events.capacity (was spots_total)
     * events.price_aed numeric (no cost_label column)
     * events.fitness_level (Beginner / Intermediate / Advanced / Elite / Professional)
     * events.group_filter (any / women / men / mixed)
     * NO setting / parking_info / facilities_info / weather_policy /
       what_to_bring / audience columns — these default to empty for now
   - Maps fitness_level → dashboard's "intensity" field
   - Builds "who" string from fitness_level + group_filter

   Requires:
     1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
     2. assets/ffp-api-integration.js
═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let retries = 0;
  const MAX_RETRIES = 30;

  function injectStyles() {
    if (document.getElementById('ffp-events-loader-styles')) return;
    const s = document.createElement('style');
    s.id = 'ffp-events-loader-styles';
    s.textContent = `
      *::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}
      *{-ms-overflow-style:none !important;scrollbar-width:none !important;}
    `;
    document.head.appendChild(s);
  }

  const DAY_ABBR   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function formatEventDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    return DAY_ABBR[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_ABBR[d.getMonth()];
  }

  function formatEventTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return hours + ':' + minutes + ' ' + ampm;
  }

  function calculateDaysAway(timestamp) {
    if (!timestamp) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const event = new Date(timestamp);
    event.setHours(0, 0, 0, 0);
    return Math.round((event - now) / (1000 * 60 * 60 * 24));
  }

  // Map FFP 5-level fitness_level → dashboard's intensity vocabulary
  function mapFitnessToIntensity(fitnessLevel) {
    if (!fitnessLevel) return '';
    const lvl = String(fitnessLevel).toLowerCase();
    if (lvl === 'beginner')     return 'Low';
    if (lvl === 'intermediate') return 'Moderate';
    if (lvl === 'advanced')     return 'High';
    if (lvl === 'elite')        return 'High';
    if (lvl === 'professional') return 'High';
    return fitnessLevel;
  }

  // Build "who" audience string from fitness_level + group_filter
  // Real group_filter values: 'open' | 'mixed' | 'women_only' | 'men_only'
  function buildAudienceString(fitnessLevel, groupFilter) {
    const parts = [];
    if (fitnessLevel && fitnessLevel !== 'All') parts.push(fitnessLevel + ' level');
    else if (fitnessLevel === 'All') parts.push('All levels');
    if (groupFilter === 'open')        parts.push('Open to all');
    else if (groupFilter === 'mixed')      parts.push('Mixed group');
    else if (groupFilter === 'women_only') parts.push('Women only');
    else if (groupFilter === 'men_only')   parts.push('Men only');
    return parts.join(' · ');
  }

  // Format price as cost label
  function formatCost(priceAed) {
    const p = parseFloat(priceAed);
    if (!p || p === 0) return 'Free for members';
    return 'AED ' + p;
  }

  // Map a Supabase event row + joined provider into Events.data shape
  function mapEventRow(row, joinedCount) {
    const provider = row.provider || {};
    const capacity = row.capacity || 0;
    const joined = joinedCount || 0;
    return {
      id:           row.id,
      title:        row.title || '',
      date:         formatEventDate(row.starts_at),
      time:         formatEventTime(row.starts_at),
      venue:        row.venue || provider.business_name || '',
      city:         row.city || provider.city || '',
      organizer:    provider.business_name || 'Unknown organiser',
      orgLetter:    provider.letter_mark || (provider.business_name || '?').charAt(0).toUpperCase(),
      category:     row.category || 'Other',
      spots:        capacity,
      joined:       joined,
      cost:         formatCost(row.price_aed),
      daysAway:     calculateDaysAway(row.starts_at),
      setting:      '',
      parking:      '',
      facilities:   '',
      weather:      '',
      intensity:    mapFitnessToIntensity(row.fitness_level),
      about:        row.description || '',
      bring:        '',
      who:          buildAudienceString(row.fitness_level, row.group_filter),
      img:          row.hero_image_url || '',
      verified:     provider.status === 'approved',
      full:         capacity > 0 && joined >= capacity
    };
  }

  async function loadEventsFromSupabase() {
    if (!window.supabase || typeof Events === 'undefined') {
      if (retries < MAX_RETRIES) {
        retries++;
        setTimeout(loadEventsFromSupabase, 200);
      } else {
        console.error('[FFP Events Loader] Supabase or Events module not available.');
      }
      return;
    }

    injectStyles();

    try {
      const eventsRes = await window.supabase
        .from('events')
        .select('*, provider:providers!inner(business_name, letter_mark, category, provider_type, city, area, status)')
        .eq('status', 'live')
        .eq('provider.status', 'approved')
        .order('starts_at', { ascending: true });

      if (eventsRes.error) {
        console.error('[FFP Events Loader] Could not load events:', {
          code:    eventsRes.error.code,
          message: eventsRes.error.message,
          details: eventsRes.error.details,
          hint:    eventsRes.error.hint
        });
        console.warn('[FFP Events Loader] Keeping sample data fallback.');
        return;
      }

      const eventRows = eventsRes.data || [];

      if (eventRows.length === 0) {
        console.log('[FFP Events Loader] No live events in Supabase yet — keeping sample data.');
        return;
      }

      // Fetch all "going" RSVPs for these events to count attendees + flag user RSVPs
      const eventIds = eventRows.map(function (e) { return e.id; });

      let userRsvpedIds = new Set();
      let countsByEvent = {};

      const sessionRes = await window.supabase.auth.getSession();
      const uid = sessionRes.data && sessionRes.data.session ? sessionRes.data.session.user.id : null;

      const rsvpsRes = await window.supabase
        .from('rsvps')
        .select('event_id, member_id')
        .in('event_id', eventIds)
        .eq('status', 'going');

      if (!rsvpsRes.error && rsvpsRes.data) {
        rsvpsRes.data.forEach(function (r) {
          countsByEvent[r.event_id] = (countsByEvent[r.event_id] || 0) + 1;
          if (uid && r.member_id === uid) userRsvpedIds.add(r.event_id);
        });
      }

      Events.data = eventRows.map(function (e) {
        return mapEventRow(e, countsByEvent[e.id] || 0);
      });
      Events.rsvped = userRsvpedIds;

      const panel = document.getElementById('panel-events');
      if (panel && panel.classList.contains('active') && typeof Events.render === 'function') {
        Events.render();
      }

      console.log('[FFP Events Loader] Loaded ' + eventRows.length + ' live events from Supabase ✓');

    } catch (err) {
      console.error('[FFP Events Loader] Unexpected error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(loadEventsFromSupabase, 500);
    });
  } else {
    setTimeout(loadEventsFromSupabase, 500);
  }

  window.ffpReloadEvents = loadEventsFromSupabase;
})();

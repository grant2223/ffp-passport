/* ═══════════════════════════════════════════════════════════════════════
   FFP DEALS LOADER (v3)
   ───────────────────────────────────────────────────────────────────────
   v3 changes:
   - Matches actual deployed schema:
     * deals.title (was perk), deals.description (was breakdown)
     * deals.hero_image_url (was hero_photo_url)
     * deals.offer_label → mapped to dashboard's "valid" short label
     * deals.terms → mapped to dashboard's "booking" detail text
     * deals.max_redemptions_per_member → mapped to "limits" string
     * providers.about (provider-level, not per deal)
   - Fields not in schema (frequency, service, hot) default to safe values

   Requires:
     1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
     2. assets/ffp-api-integration.js
═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let retries = 0;
  const MAX_RETRIES = 30;

  function injectStyles() {
    if (document.getElementById('ffp-deals-loader-styles')) return;
    const s = document.createElement('style');
    s.id = 'ffp-deals-loader-styles';
    s.textContent = `
      /* FFP RULE: no default browser scrollbars anywhere */
      *::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}
      *{-ms-overflow-style:none !important;scrollbar-width:none !important;}
    `;
    document.head.appendChild(s);
  }

  // Map a Supabase deal row + joined provider into the dashboard Deals.data shape
  function mapDealRow(row) {
    const provider = row.provider || {};

    // Build a "limits" string from max_redemptions_per_member if set
    let limits = '';
    if (row.max_redemptions_per_member && row.max_redemptions_per_member > 0 && row.max_redemptions_per_member < 999) {
      limits = 'Max ' + row.max_redemptions_per_member + ' per member';
    } else {
      limits = 'No restriction';
    }

    return {
      id:           row.id,
      venue:        provider.business_name || 'Unknown provider',
      letter:       provider.letter_mark || (provider.business_name || '?').charAt(0).toUpperCase(),
      perk:         row.title || '',
      breakdown:    row.description || '',
      about:        provider.about || '',
      category:     row.category || provider.category || 'Other',
      area:         provider.area || '',
      valid:        row.offer_label || '',
      booking:      row.terms || '',
      limits:       limits,
      frequency:    '',
      providerType: provider.provider_type || '',
      service:      '',
      city:         provider.city || '',
      verified:     provider.status === 'approved',
      featured:     row.featured === true,
      hot:          false,
      img:          row.hero_image_url || ''
    };
  }

  async function loadDealsFromSupabase() {
    if (!window.supabase || typeof Deals === 'undefined') {
      if (retries < MAX_RETRIES) {
        retries++;
        setTimeout(loadDealsFromSupabase, 200);
      } else {
        console.error('[FFP Deals Loader] Supabase or Deals module not available.');
      }
      return;
    }

    injectStyles();

    try {
      const res = await window.supabase
        .from('deals')
        .select('*, provider:providers!inner(business_name, letter_mark, category, provider_type, city, area, about, status)')
        .eq('status', 'live')
        .eq('provider.status', 'approved');

      if (res.error) {
        console.error('[FFP Deals Loader] Could not load deals:', {
          code:    res.error.code,
          message: res.error.message,
          details: res.error.details,
          hint:    res.error.hint
        });
        console.warn('[FFP Deals Loader] Keeping sample data fallback.');
        return;
      }

      const rows = res.data || [];

      if (rows.length === 0) {
        console.log('[FFP Deals Loader] No live deals in Supabase yet — keeping sample data.');
        return;
      }

      Deals.data = rows.map(mapDealRow);

      const panel = document.getElementById('panel-deals');
      if (panel && panel.classList.contains('active') && typeof Deals.render === 'function') {
        Deals.render();
      }

      console.log('[FFP Deals Loader] Loaded ' + rows.length + ' live deals from Supabase ✓');

    } catch (err) {
      console.error('[FFP Deals Loader] Unexpected error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(loadDealsFromSupabase, 400);
    });
  } else {
    setTimeout(loadDealsFromSupabase, 400);
  }

  window.ffpReloadDeals = loadDealsFromSupabase;
})();

/* ═══════════════════════════════════════════════════════════════════════
   FFP DEALS LOADER (v2)
   ───────────────────────────────────────────────────────────────────────
   v2 changes:
   - Removed `verified` from the providers SELECT (column doesn't exist
     in deployed schema). verified is now derived from provider.status === 'approved'.
═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let retries = 0;
  const MAX_RETRIES = 30;

  // ─── Global no-scrollbar rule (FFP HARD RULE) ────────────────────────
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

  // ─── Map a Supabase deal row + joined provider into the Deals.data shape ──
  function mapDealRow(row) {
    const provider = row.provider || {};
    return {
      id:           row.id,
      venue:        provider.business_name || 'Unknown provider',
      letter:       provider.letter_mark || (provider.business_name || '?').charAt(0).toUpperCase(),
      perk:         row.perk || '',
      breakdown:    row.breakdown || '',
      about:        row.about || '',
      category:     row.category || provider.category || 'Other',
      area:         provider.area || '',
      valid:        row.valid || '',
      booking:      row.booking || '',
      limits:       row.limits || '',
      frequency:    row.frequency || '',
      providerType: provider.provider_type || '',
      service:      row.service || '',
      city:         provider.city || '',
      verified:     provider.status === 'approved',
      featured:     row.featured === true,
      hot:          row.hot === true,
      img:          row.hero_photo_url || ''
    };
  }

  // ─── Load deals from Supabase ────────────────────────────────────────
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
      // Fetch live deals with their approved providers
      const res = await window.supabase
        .from('deals')
        .select('*, provider:providers!inner(business_name, letter_mark, category, provider_type, city, area, status)')
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

      // Replace the dashboard's Deals.data with real rows
      Deals.data = rows.map(mapDealRow);

      // Re-render if the deals panel is currently visible
      const panel = document.getElementById('panel-deals');
      if (panel && panel.classList.contains('active') && typeof Deals.render === 'function') {
        Deals.render();
      }

      console.log('[FFP Deals Loader] Loaded ' + rows.length + ' live deals from Supabase ✓');

    } catch (err) {
      console.error('[FFP Deals Loader] Unexpected error:', err);
    }
  }

  // ─── Run on DOM ready ────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(loadDealsFromSupabase, 400);
    });
  } else {
    setTimeout(loadDealsFromSupabase, 400);
  }

  // Expose for manual reload / debugging
  window.ffpReloadDeals = loadDealsFromSupabase;
})();

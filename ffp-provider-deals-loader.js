/* FFP Provider Deals Loader — v1
   Wires the provider dashboard's Deals panel to real Supabase data.

   Script tag already in the global block — just upload this file to repo root.

   What it does:
   - Waits for FFP_PROVIDER, fetches deals WHERE provider_id = me
   - Replaces the in-memory `deals` array, calls renderDeals() to repaint
   - Overrides saveDeal() to INSERT / UPDATE
   - Overrides toggleDeal() to UPDATE status (live ↔ paused)
   - Overrides confirmDeleteDeal() to DELETE
   - Kills native scrollbars (FFP rule)
   - Darkens dropdowns inside the deal modal

   Required SQL (run once — see message): 5 form-only columns + RLS.

   Form → DB mapping:
     dm-perk      → title
     dm-breakdown → offer_label
     dm-about     → description
     dm-category  → category
     dm-service   → service
     dm-valid     → valid_when
     dm-booking   → booking_method
     dm-limits    → limits
     dm-frequency → frequency
     hero photo   → hero_image_url

   Claims counts deferred (members.claims table) — shows 0 for now.
*/
(function () {
  'use strict';

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Provider Deals]', msg);
  }
  async function waitFor(check, ms) {
    var tries = 0; var limit = Math.ceil((ms || 15000) / 100);
    while (!check() && tries < limit) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    return check();
  }

  function injectStyles() {
    if (document.getElementById('ffp-provider-deals-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-provider-deals-css';
    css.textContent = [
      // Kill all native scrollbars — FFP-wide rule
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',
      // Kill horizontal overflow on the deals panel
      '#panel-deals{overflow-x:hidden;}',
      // Native selects inside modal: dark (matches events loader for consistency)
      '.modal select, .modal .select, .modal-body select, .modal-body .select{color-scheme:dark;}',
      '.modal select option, .modal-body select option{background:#0f1e2e !important;color:#f5f7fa !important;}',
      '.modal select option:checked, .modal-body select option:checked{background:#2ba8e0 !important;color:#082335 !important;}'
    ].join('');
    document.head.appendChild(css);
  }

  // ─── DB → UI shape ───
  function mapForUi(row) {
    return {
      id: row.id,
      perk: row.title || '',
      breakdown: row.offer_label || '',
      about: row.description || '',
      category: row.category || '',
      service: row.service || '',
      valid: row.valid_when || '',
      booking: row.booking_method || '',
      limits: row.limits || '',
      frequency: row.frequency || '',
      hero_url: row.hero_image_url || null,
      status: row.status || 'pending',
      featured: !!row.featured,
      claims: 0,            // Wired in Phase 2 (Check-ins / claims)
      claims_this_month: 0, // Same
      created_at: row.created_at ? row.created_at.slice(0, 10) : '',
      _raw: row
    };
  }

  // ─── Fetch ───
  async function fetchDeals() {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) return [];
    var providerId = window.FFP_PROVIDER.id;
    var res = await window.supabase
      .from('deals')
      .select('id, provider_id, title, description, category, hero_image_url, offer_label, offer_price_aed, original_price_aed, terms, status, featured, starts_at, ends_at, max_redemptions_per_member, service, valid_when, booking_method, limits, frequency, created_at, updated_at')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });
    if (res.error) {
      console.error('[FFP Provider Deals] fetch:', res.error);
      toast('Could not load deals', 'error');
      return [];
    }
    return (res.data || []).map(mapForUi);
  }

  async function refresh() {
    if (typeof deals === 'undefined') {
      console.warn('[FFP Provider Deals] in-memory deals array not defined yet');
      return;
    }
    var rows = await fetchDeals();
    deals.length = 0;
    rows.forEach(function (r) { deals.push(r); });
    if (typeof window.renderDeals === 'function') {
      try { window.renderDeals(); } catch (e) {}
    }
    if (typeof window.renderNav === 'function') {
      try { window.renderNav(); } catch (e) {}
    }
  }

  // ─── Save (INSERT / UPDATE) ───
  async function realSaveDeal(id) {
    if (!window.FFP_PROVIDER || !window.FFP_PROVIDER.id) {
      toast('Provider not loaded', 'error');
      return;
    }
    var get = function (key) {
      var el = document.getElementById('dm-' + key);
      return el ? (el.value || '').trim() : '';
    };

    var perk = get('perk');
    if (!perk) { toast('Headline perk is required', 'error'); return; }

    var photoSlot = document.getElementById('listing-photo-slot');
    var heroUrl = (photoSlot && photoSlot.dataset.url) ? photoSlot.dataset.url : null;
    if (heroUrl === '') heroUrl = null;

    var payload = {
      title:            perk,
      offer_label:      get('breakdown') || null,
      description:      get('about') || null,
      category:         get('category') || null,
      service:          get('service') || null,
      valid_when:       get('valid') || null,
      booking_method:   get('booking') || null,
      limits:           get('limits') || null,
      frequency:        get('frequency') || null,
      hero_image_url:   heroUrl
    };

    try {
      if (id) {
        var upd = await window.supabase.from('deals').update(payload).eq('id', id);
        if (upd.error) throw upd.error;
        toast('Deal updated', 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
      } else {
        payload.provider_id = window.FFP_PROVIDER.id;
        payload.status = 'pending';
        payload.featured = false;
        var ins = await window.supabase.from('deals').insert(payload).select().single();
        if (ins.error) throw ins.error;
        if (typeof window.closeModal === 'function') window.closeModal();
        if (typeof window.showSubmittedModal === 'function') {
          try { window.showSubmittedModal('deal'); } catch (e) {}
        } else {
          toast('Submitted for review', 'success');
        }
      }
      await refresh();
    } catch (e) {
      console.error('[FFP Provider Deals] save:', e);
      var msg = e.message || 'Save failed';
      if (/policy|permission|denied|rls/i.test(msg)) {
        msg = 'Save blocked by RLS — check deals policies + provider status';
      } else if (/does not exist/i.test(msg)) {
        msg = 'Schema mismatch — see console';
      }
      toast(msg, 'error');
    }
  }

  // ─── Pause / Resume ───
  async function realToggleDeal(id, newStatus) {
    if (!id || !newStatus) return;
    if (newStatus !== 'live' && newStatus !== 'paused') return;
    try {
      var res = await window.supabase.from('deals').update({ status: newStatus }).eq('id', id);
      if (res.error) throw res.error;
      toast(newStatus === 'paused' ? 'Deal paused' : 'Deal resumed', 'success');
      await refresh();
    } catch (e) {
      console.error('[FFP Provider Deals] toggle:', e);
      toast(e.message || 'Status change failed', 'error');
    }
  }

  // ─── Delete ───
  async function realDeleteDeal(id) {
    if (!id) return;
    var doDelete = async function () {
      try {
        var res = await window.supabase.from('deals').delete().eq('id', id);
        if (res.error) throw res.error;
        toast('Deal deleted', 'success');
        await refresh();
      } catch (e) {
        console.error('[FFP Provider Deals] delete:', e);
        toast(e.message || 'Delete failed', 'error');
      }
    };
    if (typeof window.openConfirm === 'function') {
      window.openConfirm('Delete this deal?', 'Members who already claimed it keep their record, but no new claims can be made.', doDelete);
    } else {
      if (confirm('Delete this deal?')) await doDelete();
    }
  }

  // ─── Init ───
  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth &&
             typeof window.renderDeals === 'function' &&
             typeof deals !== 'undefined';
    }, 15000);
    if (!ok) {
      console.error('[FFP Provider Deals] dependencies never loaded');
      return;
    }

    var authed = await waitFor(function () {
      return !!(window.FFP_PROVIDER && window.FFP_PROVIDER.id);
    }, 30000);
    if (!authed) {
      console.warn('[FFP Provider Deals] FFP_PROVIDER not set — provider not authenticated');
      return;
    }

    injectStyles();

    try {
      await refresh();
      console.log('[FFP Provider Deals v1] Loaded from Supabase \u2713');
    } catch (e) {
      console.error('[FFP Provider Deals] initial load:', e);
    }

    window.saveDeal = realSaveDeal;
    window.toggleDeal = realToggleDeal;
    window.confirmDeleteDeal = realDeleteDeal;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

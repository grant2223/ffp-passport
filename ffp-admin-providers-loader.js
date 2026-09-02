/* FFP Admin Providers Loader — v7 (2026-08-29)
   v7: NEW full-screen provider INFO PAGE (AdminProviders.info) — clicking a provider row opens a
       read view: identity + status chips (approved/tier/venue-or-brand/verified/booking/payments),
       a CONTACT PERSON block (owner member name/email/phone, when they signed up, their FFP account
       status, link to their member info page), Business details, Account & billing, and internal
       notes. Hero buttons reuse Manage account / Edit subscription / Open-as. Fetch now also selects
       activities, google_rating, payments_status, stripe_account_id, maps_url. Row click was
       Drawer.openProvider → now AdminProviders.info.
   --- v6 ---
   v6: NEW per-row "Verify for Refer & earn" toggle (shield icon) on approved/lapsed partners — sets
       providers.approved_by (the admin-verified gate the backend referral check requires). Self-signup
       partners join with approved_by=null (not referral-eligible) until an admin verifies them here.
       Fetch now selects approved_by; mapForUi exposes `verified`.
   --- v5 ---
   v5: the panel was showing nothing useful because fetchProviders() pulled the WHOLE directory
       (~113k auto-discovered listings, owner null / status approved) → capped at 1000 junk rows
       or errored. It now fetches only MANAGEABLE providers (owner_user_id set, i.e. human-claimed
       partners, OR any non-approved status needing action). Real partners now show with full
       management (tier/expiry/fee, approve/suspend/feature).
   --- v4 ---
   Clean restructure based on Grant's feedback (v3 was messy):
   - Tier badge shown on every row (Standard / Premium / Partner color-coded)
   - Tier filter chips above the table (All / Standard / Premium / Partner)
   - Featured tab REMOVED — featured is just a row toggle now (star icon)
   - Expiry uses a real date picker, not duration chips (quick-set buttons remain as shortcuts)
   - Unified "Edit Subscription" modal for changing tier / expiry / fee anytime
   - Tier badge AND expiry line are both clickable → open Edit Sub modal

   Architecture: patches the dashboard's existing AdminProviders module
   (`const AdminProviders = {...}`). Loads after ffp-admin-auth.js.

   SQL prerequisites (run once if not already):
     ALTER TABLE providers ADD COLUMN IF NOT EXISTS paid_until timestamptz;
     ALTER TABLE providers ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'standard';
     ALTER TABLE providers ADD COLUMN IF NOT EXISTS monthly_fee_aed numeric(10,2);
     -- status check now includes 'lapsed' (see earlier SQL)
     -- admin RLS for SELECT, UPDATE, INSERT on providers (see earlier SQL)
*/
(function () {
  'use strict';

  var TIER_DEFAULTS = {
    standard: { fee: 500,  label: 'Standard', color: '#8a99a8' },
    premium:  { fee: 1000, label: 'Premium',  color: '#FFCC00' },
    partner:  { fee: 2000, label: 'Partner',  color: '#a855f7' }
  };
  var TIERS = ['standard', 'premium', 'partner'];

  // ─── State ───
  var state = {
    tierFilter: 'all'  // 'all' | 'standard' | 'premium' | 'partner'
  };

  // ─── Helpers ───
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function getAP() {
    try { return (typeof AdminProviders !== 'undefined') ? AdminProviders : null; }
    catch (e) { return null; }
  }
  function escHtmlSafe(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg, kind) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, kind || 'info'); return; } catch (e) {} }
    console.log('[FFP Admin Providers]', msg);
  }
  function logAction(action) {
    if (window.AuditLog && typeof window.AuditLog.add === 'function') {
      try { window.AuditLog.add('Admin', action); } catch (e) {}
    }
    console.log('[FFP Admin Providers] action:', action);
  }
  function daysBetween(a, b) { return Math.floor((a.getTime() - b.getTime()) / 86400000); }
  function isoDate(d) { return d.toISOString().slice(0, 10); }
  function fmtDateNice(d) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  async function waitFor(check, ms) {
    var tries = 0; var limit = Math.ceil((ms || 10000) / 100);
    while (!check() && tries < limit) { await new Promise(function (r) { setTimeout(r, 100); }); tries++; }
    return check();
  }

  // ─── Inject styles ───
  function injectStyles() {
    if ($('#ffp-admin-providers-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-admin-providers-css';
    css.textContent = [
      // Status pills (new ones)
      '.pill-lapsed{background:rgba(249,115,22,0.18);color:#f97316;}',
      '.pill-archived{background:rgba(138,153,168,0.18);color:#8a99a8;}',

      // Tier badge — color-coded chip on every row
      '.ffp-tier-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;cursor:pointer;transition:filter 0.15s;}',
      '.ffp-tier-badge:hover{filter:brightness(1.25);}',
      '.ffp-tier-badge .material-icons{font-size:11px;}',
      '.ffp-tier-standard{background:rgba(138,153,168,0.15);color:#a8b3c0;border:1px solid rgba(138,153,168,0.30);}',
      '.ffp-tier-premium{background:rgba(255,204,0,0.15);color:#FFCC00;border:1px solid rgba(255,204,0,0.30);}',
      '.ffp-tier-partner{background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid rgba(168,85,247,0.30);}',

      // Expiry display — bigger, clickable
      '.ffp-expiry{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;cursor:pointer;transition:filter 0.15s;margin-left:6px;}',
      '.ffp-expiry:hover{filter:brightness(1.25);}',
      '.ffp-expiry .material-icons{font-size:13px;}',
      '.ffp-expiry.ok{color:#8a99a8;background:rgba(138,153,168,0.10);}',
      '.ffp-expiry.warn{color:#FFCC00;background:rgba(255,204,0,0.10);}',
      '.ffp-expiry.bad{color:#ef4444;background:rgba(239,68,68,0.10);}',

      // Provider name row (second line under name)
      '.ffp-row-meta{display:flex;align-items:center;gap:2px;margin-top:4px;flex-wrap:wrap;}',
      '.ffp-row-featured-star{color:#FFCC00;font-size:14px;margin-left:4px;vertical-align:middle;}',

      // Tier filter chips (above table)
      '.ffp-tier-filter{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid rgba(43,168,224,0.10);flex-wrap:wrap;}',
      '.ffp-tier-filter-label{font-size:10px;text-transform:uppercase;letter-spacing:0.7px;color:#8a99a8;font-weight:800;margin-right:4px;}',
      '.ffp-tier-filter-chip{padding:5px 12px;border-radius:999px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.25);color:#a8b3c0;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;text-transform:capitalize;}',
      '.ffp-tier-filter-chip:hover{color:#f5f7fa;}',
      '.ffp-tier-filter-chip.active{background:#2ba8e0;color:#082335;border-color:#2ba8e0;}',

      // Modal (shared) — FULL-BLEED sheet (locked admin rule: no centered card, no box-in-box). The sheet
      // fills the viewport; head/body/foot sit in a centered readable column so wide screens aren't sparse.
      '.ffp-pm-backdrop{position:fixed;inset:0;background:#0b1622;z-index:9999;display:none;align-items:stretch;justify-content:stretch;padding:0;font-family:Montserrat,sans-serif;}',
      '.ffp-pm-backdrop.open{display:flex;}',
      '.ffp-pm-sheet{background:#0f1e2e;border:none;border-radius:0;width:100%;max-width:none;height:100dvh;color:#f5f7fa;overflow:hidden;max-height:none;display:flex;flex-direction:column;}',
      '.ffp-pm-head{padding:18px 20px 14px;border-bottom:1px solid rgba(43,168,224,0.15);display:flex;justify-content:space-between;align-items:flex-start;gap:10px;position:sticky;top:0;background:#0f1e2e;z-index:2;width:100%;max-width:720px;margin:0 auto;}',
      '.ffp-pm-title{font-size:18px;font-weight:800;}',
      '.ffp-pm-sub{font-size:12px;color:#8a99a8;margin-top:2px;}',
      '.ffp-pm-close{background:transparent;border:none;color:#8a99a8;cursor:pointer;font-family:inherit;padding:4px;}',
      '.ffp-pm-close:hover{color:#f5f7fa;}',
      '.ffp-pm-body{padding:18px 20px;overflow-y:auto;flex:1;width:100%;max-width:720px;margin:0 auto;}',
      '.ffp-pm-row{margin-bottom:14px;}',
      '.ffp-pm-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:0.6px;font-weight:800;color:#8a99a8;margin-bottom:6px;}',
      '.ffp-pm-input{width:100%;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:8px;color:#f5f7fa;padding:10px 12px;font-size:13px;font-weight:600;font-family:inherit;color-scheme:dark;}',
      '.ffp-pm-input:focus{outline:none;border-color:#2ba8e0;}',
      // Native <select> popups use the control background — the translucent input bg renders the open list
      // white/unreadable, so give selects + their options a solid dark surface.
      'select.ffp-pm-input{background-color:#12232f;background-image:none;-webkit-appearance:none;appearance:none;background-repeat:no-repeat;background-position:right 10px center;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238a99a8\' stroke-width=\'3\'><path d=\'M6 9l6 6 6-6\'/></svg>");padding-right:30px;}',
      '.ffp-pm-input option{background-color:#12232f;color:#f5f7fa;}',
      'input.ffp-pm-input[type="date"]{cursor:pointer;color-scheme:dark;}',

      // Tier chips inside modal
      '.ffp-pm-tier-chips{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}',
      '.ffp-pm-tier-chip{padding:10px 8px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:8px;color:#f5f7fa;font-size:12px;font-weight:700;cursor:pointer;text-align:center;font-family:inherit;text-transform:capitalize;}',
      '.ffp-pm-tier-chip[data-tier="standard"].active{background:#8a99a8;color:#082335;border-color:#8a99a8;}',
      '.ffp-pm-tier-chip[data-tier="premium"].active{background:#FFCC00;color:#082335;border-color:#FFCC00;}',
      '.ffp-pm-tier-chip[data-tier="partner"].active{background:#a855f7;color:#fff;border-color:#a855f7;}',

      // Quick-set date buttons
      '.ffp-pm-quickset{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;}',
      '.ffp-pm-quickset button{padding:6px 10px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:6px;color:#a8b3c0;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.ffp-pm-quickset button:hover{color:#f5f7fa;border-color:#2ba8e0;}',
      '.ffp-pm-quickset button.active{background:#2ba8e0;color:#082335;border-color:#2ba8e0;}',

      // Status chips (Add modal — pending vs approved)
      '.ffp-pm-status-chips{display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
      '.ffp-pm-status-chips button{padding:10px 8px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:8px;color:#f5f7fa;font-size:12px;font-weight:700;cursor:pointer;text-align:center;font-family:inherit;}',
      '.ffp-pm-status-chips button.active{background:#2ba8e0;color:#082335;border-color:#2ba8e0;}',

      '.ffp-pm-foot{padding:12px 20px 18px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid rgba(43,168,224,0.15);position:sticky;bottom:0;background:#0f1e2e;width:100%;max-width:720px;margin:0 auto;}',
      '.ffp-pm-btn{padding:9px 16px;font-size:13px;font-weight:800;border-radius:8px;border:none;cursor:pointer;font-family:inherit;}',
      '.ffp-pm-btn-primary{background:#FFCC00;color:#082335;}',
      '.ffp-pm-btn-primary:hover{filter:brightness(1.05);}',
      '.ffp-pm-btn-primary:disabled{opacity:0.5;cursor:not-allowed;}',
      '.ffp-pm-btn-ghost{background:transparent;color:#8a99a8;border:1px solid rgba(43,168,224,0.30);}',
      '.ffp-pm-btn-ghost:hover{color:#f5f7fa;}',
      '.ffp-pm-preview{padding:10px 12px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.15);border-radius:8px;font-size:12px;color:#f5f7fa;line-height:1.5;}',
      '.ffp-pm-preview b{color:#2ba8e0;}'
    ].join('');
    document.head.appendChild(css);
  }

  // ─── Hide the Featured tab (Grant's request: it's noise) ───
  function removeFeaturedTab() {
    var featuredTab = $('#providers-tabs [data-tab="featured"]');
    if (featuredTab) featuredTab.remove();
  }

  // ─── Add Lapsed + Archived tabs (still useful as status filters) ───
  function injectExtraTabs() {
    var tabs = $('#providers-tabs');
    if (!tabs) return;
    if (!$('#providers-tabs [data-tab="lapsed"]')) {
      var suspended = $('#providers-tabs [data-tab="suspended"]');
      var lap = document.createElement('button');
      lap.className = 'tab-btn';
      lap.dataset.tab = 'lapsed';
      lap.setAttribute('onclick', "AdminProviders.setTab('lapsed')");
      lap.innerHTML = 'Lapsed <span class="count" id="prov-count-lapsed">0</span>';
      if (suspended) tabs.insertBefore(lap, suspended);
      else tabs.appendChild(lap);
    }
    if (!$('#providers-tabs [data-tab="archived"]')) {
      var arc = document.createElement('button');
      arc.className = 'tab-btn';
      arc.dataset.tab = 'archived';
      arc.setAttribute('onclick', "AdminProviders.setTab('archived')");
      arc.innerHTML = 'Archived <span class="count" id="prov-count-archived">0</span>';
      tabs.appendChild(arc);
    }
  }

  // ─── Tier filter chips (above table) ───
  function injectTierFilter() {
    if ($('#ffp-tier-filter-row')) return;
    var tabs = $('#providers-tabs');
    if (!tabs) return;
    var row = document.createElement('div');
    row.className = 'ffp-tier-filter';
    row.id = 'ffp-tier-filter-row';
    row.innerHTML =
      '<span class="ffp-tier-filter-label">Tier</span>' +
      '<button class="ffp-tier-filter-chip active" data-tier="all" type="button">All</button>' +
      TIERS.map(function (t) {
        return '<button class="ffp-tier-filter-chip" data-tier="' + t + '" type="button">' + t + '</button>';
      }).join('');
    tabs.parentNode.insertBefore(row, tabs.nextSibling);
    $$('#ffp-tier-filter-row .ffp-tier-filter-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        $$('#ffp-tier-filter-row .ffp-tier-filter-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        state.tierFilter = chip.dataset.tier;
        getAP().render();
      });
    });
  }

  // ─── Modals ───
  function injectModals() {
    if ($('#ffp-pm-approve-backdrop')) return;
    var dateInputId = ['approve', 'edit', 'add'].map(function (key) { return 'ffp-pm-' + key + '-date'; });
    var html =
      // APPROVE modal
      '<div class="ffp-pm-backdrop" id="ffp-pm-approve-backdrop">' +
        '<div class="ffp-pm-sheet" onclick="event.stopPropagation();">' +
          '<div class="ffp-pm-head">' +
            '<div><div class="ffp-pm-title">Approve provider</div>' +
            '<div class="ffp-pm-sub" id="ffp-pm-approve-bizname"></div></div>' +
            '<button class="ffp-pm-close" type="button" data-close="approve"><span class="material-icons">close</span></button>' +
          '</div>' +
          '<div class="ffp-pm-body">' +
            tierFieldHtml('approve') +
            dateFieldHtml('approve', 'Subscription ends') +
            feeFieldHtml('approve') +
            '<div class="ffp-pm-row"><div class="ffp-pm-preview" id="ffp-pm-approve-preview"></div></div>' +
          '</div>' +
          '<div class="ffp-pm-foot">' +
            '<button class="ffp-pm-btn ffp-pm-btn-ghost" type="button" data-close="approve">Cancel</button>' +
            '<button class="ffp-pm-btn ffp-pm-btn-primary" type="button" id="ffp-pm-approve-confirm">Approve</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // EDIT SUBSCRIPTION modal (replaces v3's "Extend")
      '<div class="ffp-pm-backdrop" id="ffp-pm-edit-backdrop">' +
        '<div class="ffp-pm-sheet" onclick="event.stopPropagation();">' +
          '<div class="ffp-pm-head">' +
            '<div><div class="ffp-pm-title">Edit subscription</div>' +
            '<div class="ffp-pm-sub" id="ffp-pm-edit-bizname"></div></div>' +
            '<button class="ffp-pm-close" type="button" data-close="edit"><span class="material-icons">close</span></button>' +
          '</div>' +
          '<div class="ffp-pm-body">' +
            tierFieldHtml('edit') +
            dateFieldHtml('edit', 'Expires on') +
            feeFieldHtml('edit') +
            '<div class="ffp-pm-row"><div class="ffp-pm-preview" id="ffp-pm-edit-preview"></div></div>' +
          '</div>' +
          '<div class="ffp-pm-foot">' +
            '<button class="ffp-pm-btn ffp-pm-btn-ghost" type="button" data-close="edit">Cancel</button>' +
            '<button class="ffp-pm-btn ffp-pm-btn-primary" type="button" id="ffp-pm-edit-confirm">Save changes</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // ADD PROVIDER modal
      '<div class="ffp-pm-backdrop" id="ffp-pm-add-backdrop">' +
        '<div class="ffp-pm-sheet" style="max-width:560px;" onclick="event.stopPropagation();">' +
          '<div class="ffp-pm-head">' +
            '<div><div class="ffp-pm-title">Add provider</div>' +
            '<div class="ffp-pm-sub">Create a new provider account manually</div></div>' +
            '<button class="ffp-pm-close" type="button" data-close="add"><span class="material-icons">close</span></button>' +
          '</div>' +
          '<div class="ffp-pm-body">' +
            '<div class="ffp-pm-row"><label class="ffp-pm-label">Business name *</label>' +
            '<input type="text" class="ffp-pm-input" id="ffp-pm-add-name" placeholder="e.g. Forge Fitness DXB"></div>' +
            '<div class="ffp-pm-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
              '<div><label class="ffp-pm-label">Category *</label>' +
                '<input type="text" class="ffp-pm-input" id="ffp-pm-add-category" list="ffp-pm-add-cats" placeholder="Sports">' +
                '<datalist id="ffp-pm-add-cats">' +
                  '<option value="Sports"><option value="Fitness"><option value="Wellness">' +
                  '<option value="Adventure"><option value="Recovery"><option value="Nutrition">' +
                '</datalist></div>' +
              '<div><label class="ffp-pm-label">City *</label>' +
                '<input type="text" class="ffp-pm-input" id="ffp-pm-add-city" list="ffp-pm-add-cities" placeholder="Dubai">' +
                '<datalist id="ffp-pm-add-cities">' +
                  '<option value="Dubai"><option value="Abu Dhabi"><option value="Sharjah"><option value="Ajman">' +
                  '<option value="Ras Al Khaimah"><option value="Fujairah"><option value="Al Ain"><option value="Umm Al Quwain">' +
                '</datalist></div>' +
            '</div>' +
            '<div class="ffp-pm-row"><label class="ffp-pm-label">Contact email *</label>' +
            '<input type="email" class="ffp-pm-input" id="ffp-pm-add-email" placeholder="bookings@business.ae"></div>' +
            '<div class="ffp-pm-row"><label class="ffp-pm-label">Contact phone</label>' +
            '<input type="tel" class="ffp-pm-input" id="ffp-pm-add-phone" placeholder="+971..."></div>' +
            '<div class="ffp-pm-row"><label class="ffp-pm-label">Initial status</label>' +
              '<div class="ffp-pm-status-chips" id="ffp-pm-add-status-chips">' +
                '<button class="active" data-status="pending" type="button">Pending review</button>' +
                '<button data-status="approved" type="button">Approved (set subscription)</button>' +
              '</div></div>' +
            '<div id="ffp-pm-add-sub-fields" style="display:none;">' +
              tierFieldHtml('add') +
              dateFieldHtml('add', 'Subscription ends') +
              feeFieldHtml('add') +
              '<div class="ffp-pm-row"><div class="ffp-pm-preview" id="ffp-pm-add-preview"></div></div>' +
            '</div>' +
          '</div>' +
          '<div class="ffp-pm-foot">' +
            '<button class="ffp-pm-btn ffp-pm-btn-ghost" type="button" data-close="add">Cancel</button>' +
            '<button class="ffp-pm-btn ffp-pm-btn-primary" type="button" id="ffp-pm-add-confirm">Add provider</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // EDIT ACCOUNT DETAILS modal (main details + brand/booking + owner + notes + delete/merge/impersonate)
      '<div class="ffp-pm-backdrop" id="ffp-pm-details-backdrop">' +
        '<div class="ffp-pm-sheet" style="max-width:640px;" onclick="event.stopPropagation();">' +
          '<div class="ffp-pm-head">' +
            '<div><div class="ffp-pm-title">Edit account</div>' +
            '<div class="ffp-pm-sub" id="ffp-pm-details-bizname"></div></div>' +
            '<button class="ffp-pm-close" type="button" data-close="details"><span class="material-icons">close</span></button>' +
          '</div>' +
          '<div class="ffp-pm-body">' +
            '<div class="ffp-pm-row"><label class="ffp-pm-label">Business name</label><input type="text" class="ffp-pm-input" id="pd-name"></div>' +
            '<div class="ffp-pm-row" style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:end;">' +
              '<div><label class="ffp-pm-label">Logo</label><div style="display:flex;align-items:center;gap:10px;">' +
                '<div id="pd-logo-prev" style="width:52px;height:52px;border-radius:12px;background:#12232f center/cover no-repeat;border:1px solid #24323d;flex:none;"></div>' +
                '<button type="button" class="ffp-pm-btn ffp-pm-btn-ghost" id="pd-logo-btn">Upload</button>' +
                '<input type="file" accept="image/*" id="pd-logo-file" style="display:none;"><input type="hidden" id="pd-logo-url"></div></div>' +
              '<div><label class="ffp-pm-label">Banner</label><div style="display:flex;align-items:center;gap:10px;">' +
                '<div id="pd-hero-prev" style="width:96px;height:52px;border-radius:10px;background:#12232f center/cover no-repeat;border:1px solid #24323d;flex:none;"></div>' +
                '<button type="button" class="ffp-pm-btn ffp-pm-btn-ghost" id="pd-hero-btn">Upload</button>' +
                '<input type="file" accept="image/*" id="pd-hero-file" style="display:none;"><input type="hidden" id="pd-hero-url"></div></div>' +
            '</div>' +
            '<div class="ffp-pm-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
              '<div><label class="ffp-pm-label">Category</label><select class="ffp-pm-input" id="pd-category"><option value="">— Select —</option></select></div>' +
              '<div><label class="ffp-pm-label">City</label><input type="text" class="ffp-pm-input" id="pd-city"></div></div>' +
            '<div class="ffp-pm-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
              '<div><label class="ffp-pm-label">Area</label><input type="text" class="ffp-pm-input" id="pd-area"></div>' +
              '<div><label class="ffp-pm-label">Country</label><input type="text" class="ffp-pm-input" id="pd-country"></div></div>' +
            '<div class="ffp-pm-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
              '<div><label class="ffp-pm-label">Contact email</label><input type="email" class="ffp-pm-input" id="pd-email"></div>' +
              '<div><label class="ffp-pm-label">Contact phone</label><input type="tel" class="ffp-pm-input" id="pd-phone"></div></div>' +
            '<div class="ffp-pm-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
              '<div><label class="ffp-pm-label">Website</label><input type="text" class="ffp-pm-input" id="pd-website"></div>' +
              '<div><label class="ffp-pm-label">Instagram</label><input type="text" class="ffp-pm-input" id="pd-instagram"></div></div>' +
            '<div class="ffp-pm-row"><label class="ffp-pm-label">About</label><textarea class="ffp-pm-input" id="pd-about" rows="3"></textarea></div>' +
            '<div class="ffp-pm-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
              '<div><label class="ffp-pm-label">Account type</label><select class="ffp-pm-input" id="pd-brand"><option value="venue">Venue / provider</option><option value="brand">Product brand</option><option value="organizer">Event organizer</option></select></div>' +
              '<div><label class="ffp-pm-label">Bookings</label><select class="ffp-pm-input" id="pd-bookmode"><option value="native">On FFP (native)</option><option value="external">External link</option></select></div></div>' +
            '<div class="ffp-pm-row" id="pd-bookurl-row" style="display:none;"><label class="ffp-pm-label">External booking URL</label><input type="text" class="ffp-pm-input" id="pd-bookurl" placeholder="https://..."></div>' +
            '<div class="ffp-pm-row"><label class="ffp-pm-label">Owner login email <span style="font-weight:500;color:#8a99a8;">— must be an existing member</span></label>' +
              '<div style="display:flex;gap:8px;"><input type="email" class="ffp-pm-input" id="pd-owner" placeholder="owner@email.com" style="flex:1;"><button class="ffp-pm-btn ffp-pm-btn-ghost" type="button" id="pd-reassign">Reassign</button></div></div>' +
            '<div class="ffp-pm-row"><label class="ffp-pm-label">Internal notes <span style="font-weight:500;color:#8a99a8;">— admin only</span></label><textarea class="ffp-pm-input" id="pd-notes" rows="2"></textarea></div>' +
            '<div class="ffp-pm-row" style="border-top:1px solid #e7ecf0;padding-top:12px;display:flex;flex-wrap:wrap;gap:8px;">' +
              '<button class="ffp-pm-btn ffp-pm-btn-ghost" type="button" id="pd-openas"><span class="material-icons" style="font-size:16px;vertical-align:-3px;">login</span> Open dashboard as</button>' +
              '<button class="ffp-pm-btn ffp-pm-btn-ghost" type="button" id="pd-merge"><span class="material-icons" style="font-size:16px;vertical-align:-3px;">merge</span> Merge duplicate…</button>' +
              '<button class="ffp-pm-btn ffp-pm-btn-ghost" type="button" id="pd-delete" style="color:#c0392b;margin-left:auto;"><span class="material-icons" style="font-size:16px;vertical-align:-3px;">delete</span> Delete</button>' +
            '</div>' +
          '</div>' +
          '<div class="ffp-pm-foot">' +
            '<button class="ffp-pm-btn ffp-pm-btn-ghost" type="button" data-close="details">Cancel</button>' +
            '<button class="ffp-pm-btn ffp-pm-btn-primary" type="button" id="ffp-pm-details-confirm">Save details</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    // Wire modal close handlers
    $$('[data-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        var key = el.getAttribute('data-close');
        if (key === 'approve') closeApprove();
        if (key === 'edit')    closeEdit();
        if (key === 'add')     closeAdd();
        if (key === 'details')  closeDetails();
      });
    });
    ['approve', 'edit', 'add', 'details'].forEach(function (key) {
      var backdrop = $('#ffp-pm-' + key + '-backdrop');
      if (!backdrop) return;
      backdrop.addEventListener('click', function (e) {
        if (e.target.id === backdrop.id) {
          if (key === 'approve') closeApprove();
          if (key === 'edit') closeEdit();
          if (key === 'add') closeAdd();
          if (key === 'details') closeDetails();
        }
      });
    });

    // Wire chip handlers for each modal
    wireTierChips('approve');
    wireTierChips('edit');
    wireTierChips('add');
    wireDateChips('approve');
    wireDateChips('edit');
    wireDateChips('add');
    $('#ffp-pm-approve-confirm').addEventListener('click', confirmApprove);
    $('#ffp-pm-edit-confirm').addEventListener('click', confirmEdit);
    $('#ffp-pm-add-confirm').addEventListener('click', confirmAddProvider);
    // Edit-details modal wiring
    $('#ffp-pm-details-confirm').addEventListener('click', confirmDetails);
    $('#pd-bookmode').addEventListener('change', function () { $('#pd-bookurl-row').style.display = (this.value === 'external') ? '' : 'none'; });
    $('#pd-brand').addEventListener('change', function () { _fillPdCategory(this.value === 'brand' ? 'brand' : 'venue', '', false); });
    $('#pd-logo-btn').addEventListener('click', function () { $('#pd-logo-file').click(); });
    $('#pd-hero-btn').addEventListener('click', function () { $('#pd-hero-file').click(); });
    $('#pd-logo-file').addEventListener('change', function () { _pdUploadImg('logo', this); });
    $('#pd-hero-file').addEventListener('change', function () { _pdUploadImg('hero', this); });
    // Populate the Add-provider Category datalist from the live venue taxonomy (was a stale hardcoded list)
    _loadPdTax().then(function () { var dl = document.getElementById('ffp-pm-add-cats'); if (dl && _pdTax) dl.innerHTML = (_pdTax.venue || []).map(function (c) { return '<option value="' + escHtmlSafe(c.value) + '">'; }).join(''); });
    $('#pd-reassign').addEventListener('click', reassignOwner);
    $('#pd-openas').addEventListener('click', function () { openAsProvider(pendingDetailsId); });
    $('#pd-merge').addEventListener('click', function () { mergeProvider(pendingDetailsId); });
    $('#pd-delete').addEventListener('click', function () { deleteProvider(pendingDetailsId); });

    // Add modal: status chips toggle subscription fields
    $$('#ffp-pm-add-status-chips button').forEach(function (chip) {
      chip.addEventListener('click', function () {
        $$('#ffp-pm-add-status-chips button').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var status = chip.dataset.status;
        $('#ffp-pm-add-sub-fields').style.display = (status === 'approved') ? 'block' : 'none';
        updatePreview('add');
      });
    });

    // Fee inputs trigger preview updates
    ['approve', 'edit', 'add'].forEach(function (key) {
      $('#ffp-pm-' + key + '-fee').addEventListener('input', function () { updatePreview(key); });
      $('#ffp-pm-' + key + '-date').addEventListener('change', function () { updatePreview(key); });
    });
  }

  // Shared HTML builders
  function tierFieldHtml(key) {
    return '<div class="ffp-pm-row"><label class="ffp-pm-label">Subscription tier</label>' +
      '<div class="ffp-pm-tier-chips" id="ffp-pm-' + key + '-tier-chips">' +
        TIERS.map(function (t) {
          return '<button class="ffp-pm-tier-chip' + (t === 'standard' ? ' active' : '') + '" data-tier="' + t + '" type="button">' + TIER_DEFAULTS[t].label + '</button>';
        }).join('') +
      '</div></div>';
  }
  function dateFieldHtml(key, labelText) {
    return '<div class="ffp-pm-row"><label class="ffp-pm-label">' + labelText + '</label>' +
      '<input type="date" class="ffp-pm-input" id="ffp-pm-' + key + '-date">' +
      '<div class="ffp-pm-quickset" id="ffp-pm-' + key + '-quickset">' +
        '<button type="button" data-add-days="30">+1 mo</button>' +
        '<button type="button" data-add-days="90">+3 mo</button>' +
        '<button type="button" data-add-days="180">+6 mo</button>' +
        '<button type="button" data-add-days="365">+1 yr</button>' +
      '</div></div>';
  }
  function feeFieldHtml(key) {
    return '<div class="ffp-pm-row"><label class="ffp-pm-label">Monthly fee (AED)</label>' +
      '<input type="number" min="0" step="50" class="ffp-pm-input" id="ffp-pm-' + key + '-fee" value="500"></div>';
  }

  // Chip wiring
  function wireTierChips(key) {
    $$('#ffp-pm-' + key + '-tier-chips .ffp-pm-tier-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        $$('#ffp-pm-' + key + '-tier-chips .ffp-pm-tier-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var tier = chip.dataset.tier;
        var feeInput = $('#ffp-pm-' + key + '-fee');
        if (feeInput && TIER_DEFAULTS[tier]) feeInput.value = TIER_DEFAULTS[tier].fee;
        updatePreview(key);
      });
    });
  }
  function wireDateChips(key) {
    $$('#ffp-pm-' + key + '-quickset button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var days = parseInt(btn.dataset.addDays, 10);
        // Base = current paid_until if in future, else now
        var base;
        if (key === 'edit' && pendingEditId) {
          var p = getAP().data.find(function (x) { return x.id === pendingEditId; });
          base = (p && p.paid_until && new Date(p.paid_until) > new Date()) ? new Date(p.paid_until) : new Date();
        } else {
          base = new Date();
        }
        var newDate = new Date(base.getTime() + days * 86400000);
        $('#ffp-pm-' + key + '-date').value = isoDate(newDate);
        updatePreview(key);
      });
    });
  }

  // ─── Selected values ───
  function selectedTier(key) {
    var el = $('#ffp-pm-' + key + '-tier-chips .ffp-pm-tier-chip.active');
    return el ? el.dataset.tier : 'standard';
  }
  function selectedDate(key) {
    var v = $('#ffp-pm-' + key + '-date').value;
    return v ? new Date(v + 'T23:59:59') : null;  // end of day
  }
  function selectedFee(key) {
    return parseFloat($('#ffp-pm-' + key + '-fee').value) || 0;
  }
  function selectedAddStatus() {
    var el = $('#ffp-pm-add-status-chips button.active');
    return el ? el.dataset.status : 'pending';
  }

  // ─── Preview ───
  function updatePreview(key) {
    var elId = '#ffp-pm-' + key + '-preview';
    var el = $(elId);
    if (!el) return;
    if (key === 'add' && selectedAddStatus() === 'pending') { el.innerHTML = ''; return; }
    var tier = selectedTier(key);
    var date = selectedDate(key);
    var fee  = selectedFee(key);
    if (!date) { el.innerHTML = 'Pick an expiry date.'; return; }
    var days = daysBetween(date, new Date());
    var verb = (key === 'approve') ? 'Approves' : (key === 'edit' ? 'Updates to' : 'Added as');
    var extra = '';
    if (key === 'edit' && pendingEditId) {
      var p = getAP().data.find(function (x) { return x.id === pendingEditId; });
      if (p && p.status === 'lapsed' && date > new Date()) {
        extra = '<br>Will reinstate from <b>lapsed</b> back to <b>approved</b>.';
      }
    }
    el.innerHTML = verb + ' <b>' + tier + '</b> at <b>AED ' + fee.toFixed(0) + '/mo</b>.<br>' +
      'Expires <b>' + fmtDateNice(date) + '</b> (' + days + ' days from today).' + extra;
  }

  // ─── Modal open/close ───
  var pendingApproveId = null;
  var pendingEditId = null;
  var pendingDetailsId = null;

  function openApprove(id) {
    var p = getAP().data.find(function (x) { return x.id === id; });
    if (!p) return;
    pendingApproveId = id;
    $('#ffp-pm-approve-bizname').textContent = p.business_name + (p.city ? ' \u00b7 ' + p.city : '');
    setActiveTier('approve', 'standard');
    var defaultEnd = new Date(Date.now() + 90 * 86400000);
    $('#ffp-pm-approve-date').value = isoDate(defaultEnd);
    $('#ffp-pm-approve-fee').value = TIER_DEFAULTS.standard.fee;
    $('#ffp-pm-approve-confirm').disabled = false;
    updatePreview('approve');
    $('#ffp-pm-approve-backdrop').classList.add('open');
  }
  function closeApprove() { $('#ffp-pm-approve-backdrop').classList.remove('open'); pendingApproveId = null; }

  function openEdit(id) {
    var p = getAP().data.find(function (x) { return x.id === id; });
    if (!p) return;
    pendingEditId = id;
    $('#ffp-pm-edit-bizname').textContent = p.business_name + (p.city ? ' \u00b7 ' + p.city : '');
    setActiveTier('edit', p.subscription_tier || 'standard');
    var currentExp = p.paid_until ? new Date(p.paid_until) : new Date(Date.now() + 90 * 86400000);
    $('#ffp-pm-edit-date').value = isoDate(currentExp);
    $('#ffp-pm-edit-fee').value = p.monthly_fee_aed != null ? p.monthly_fee_aed : (TIER_DEFAULTS[p.subscription_tier] || TIER_DEFAULTS.standard).fee;
    $('#ffp-pm-edit-confirm').disabled = false;
    updatePreview('edit');
    $('#ffp-pm-edit-backdrop').classList.add('open');
  }
  function closeEdit() { $('#ffp-pm-edit-backdrop').classList.remove('open'); pendingEditId = null; }

  // ─── Category taxonomy (venue = 'category', brand = 'brand_category') ───
  var _pdTax = null;
  async function _loadPdTax() {
    if (_pdTax) return _pdTax;
    var t = { venue: [], brand: [] };
    try {
      var r = await window.supabase.from('taxonomy_items').select('list_key,value,label,sort_order').in('list_key', ['category', 'brand_category']).eq('active', true).order('sort_order', { ascending: true });
      (r.data || []).forEach(function (x) { (x.list_key === 'brand_category' ? t.brand : t.venue).push({ value: x.value, label: x.label || x.value }); });
      _pdTax = t;
    } catch (e) { console.error('[providers] category taxonomy load', e); }
    return _pdTax || t;
  }
  function _fillPdCategory(type, current, keepUnknown) {
    var sel = document.getElementById('pd-category'); if (!sel) return;
    var list = (type === 'brand') ? ((_pdTax && _pdTax.brand) || []) : ((_pdTax && _pdTax.venue) || []);
    var opts = '<option value="">— Select —</option>', found = false;
    list.forEach(function (c) { if (c.value === current) found = true; opts += '<option value="' + escHtmlSafe(c.value) + '"' + (c.value === current ? ' selected' : '') + '>' + escHtmlSafe(c.label) + '</option>'; });
    if (keepUnknown && current && !found) opts += '<option value="' + escHtmlSafe(current) + '" selected>' + escHtmlSafe(current) + '</option>';
    sel.innerHTML = opts;
  }

  // ─── Logo / banner upload (admin can add branding for a provider) ───
  async function _pdUploadImg(kind, input) {
    var f = input.files && input.files[0]; if (!f || !pendingDetailsId) return;
    var bucket = kind === 'logo' ? 'provider-logos' : 'provider-heroes';
    var btn = document.getElementById('pd-' + kind + '-btn'); var was = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
    try {
      var ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      var path = pendingDetailsId + '/' + kind + '-' + Date.now() + '.' + ext;
      var up = await window.supabase.storage.from(bucket).upload(path, f, { upsert: true, contentType: f.type || 'image/jpeg', cacheControl: '3600' });
      if (up.error) throw up.error;
      var url = window.supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      var h = document.getElementById('pd-' + kind + '-url'); if (h) h.value = url;
      var pv = document.getElementById('pd-' + kind + '-prev'); if (pv) pv.style.backgroundImage = "url('" + url + "')";
      toast((kind === 'logo' ? 'Logo' : 'Banner') + ' uploaded — Save details to apply', 'success');
    } catch (e) { console.error('[providers] image upload', e); toast('Upload failed — try again', 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = was || 'Upload'; } input.value = ''; }
  }

  // ─── Edit account details (main details + brand/booking + owner + notes + delete/merge/impersonate) ───
  function openDetails(id) {
    var pm = getAP().data.find(function (x) { return x.id === id; });
    if (!pm) return;
    var p = pm._raw || pm;   // full provider row (mapped object only carries a subset)
    pendingDetailsId = id;
    var v = function (k, val) { var el = document.getElementById(k); if (el) el.value = (val != null ? val : ''); };
    $('#ffp-pm-details-bizname').textContent = p.business_name + (p.city ? ' · ' + p.city : '');
    v('pd-name', p.business_name); v('pd-city', p.city); v('pd-area', p.area);
    var _ptype = p.is_organizer ? 'organizer' : (p.is_brand ? 'brand' : 'venue');
    _loadPdTax().then(function () { _fillPdCategory(_ptype === 'brand' ? 'brand' : 'venue', p.category || '', true); });
    var setImg = function (kind, url) { var h = document.getElementById('pd-' + kind + '-url'); if (h) h.value = url || ''; var pv = document.getElementById('pd-' + kind + '-prev'); if (pv) pv.style.backgroundImage = url ? "url('" + url + "')" : 'none'; };
    setImg('logo', p.logo_url); setImg('hero', p.hero_photo_url);
    v('pd-country', p.country); v('pd-email', p.contact_email); v('pd-phone', p.contact_phone);
    v('pd-website', p.website); v('pd-instagram', p.instagram); v('pd-about', p.about); v('pd-notes', p.admin_notes);
    v('pd-owner', p.contact_email);
    $('#pd-brand').value = p.is_organizer ? 'organizer' : (p.is_brand ? 'brand' : 'venue');
    $('#pd-bookmode').value = (p.booking_mode === 'external') ? 'external' : 'native';
    v('pd-bookurl', p.external_booking_url);
    $('#pd-bookurl-row').style.display = (p.booking_mode === 'external') ? '' : 'none';
    $('#pd-openas').style.display = p.owner_user_id ? '' : 'none';   // impersonation needs an owner account
    $('#ffp-pm-details-backdrop').classList.add('open');
  }
  function closeDetails() { $('#ffp-pm-details-backdrop').classList.remove('open'); pendingDetailsId = null; }

  async function confirmDetails() {
    if (!pendingDetailsId) return;
    var g = function (k) { var el = document.getElementById(k); return el ? el.value.trim() : ''; };
    var name = g('pd-name'); if (!name) { toast('Business name is required', 'error'); return; }
    var patch = {
      business_name: name, category: g('pd-category') || null, city: g('pd-city') || null,
      area: g('pd-area') || null, country: g('pd-country') || null,
      contact_email: g('pd-email') || null, contact_phone: g('pd-phone') || null,
      website: g('pd-website') || null, instagram: g('pd-instagram') || null,
      about: g('pd-about') || null, admin_notes: g('pd-notes') || null,
      is_brand: ($('#pd-brand').value === 'brand'),
      is_organizer: ($('#pd-brand').value === 'organizer'),
      booking_mode: $('#pd-bookmode').value, external_booking_url: g('pd-bookurl') || null,
      logo_url: g('pd-logo-url') || null, hero_photo_url: g('pd-hero-url') || null
    };
    var btn = $('#ffp-pm-details-confirm'); btn.disabled = true;
    try {
      var res = await window.supabase.from('providers').update(patch).eq('id', pendingDetailsId);
      if (res.error) throw res.error;
      toast('Account details saved', 'success');
      logAction('edited provider details · ' + name);
      closeDetails(); await refresh();
    } catch (e) { toast(e.message || 'Save failed', 'error'); btn.disabled = false; }
  }

  async function reassignOwner() {
    if (!pendingDetailsId) return;
    var email = ($('#pd-owner').value || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email', 'error'); return; }
    if (!window.confirm('Reassign this account to ' + email + '? They must already have an FFP account.')) return;
    try {
      var r = await window.supabase.rpc('admin_provider_reassign_owner', { p_id: pendingDetailsId, p_email: email });
      if (r.error) throw r.error;
      if (r.data && r.data.error === 'no_member') { toast('No FFP account with that email — they must sign up first.', 'error'); return; }
      toast('Owner reassigned to ' + email, 'success');
      logAction('reassigned provider owner → ' + email);
      closeDetails(); await refresh();
    } catch (e) { toast(e.message || 'Reassign failed', 'error'); }
  }

  async function openAsProvider(id) {
    var pm = getAP().data.find(function (x) { return x.id === id; });
    if (!pm) return;
    var p = pm._raw || pm;
    if (!p.owner_user_id) { toast('No owner account to open as', 'error'); return; }
    var jwt = (window.FFPAuth && FFPAuth.getJwt && FFPAuth.getJwt()) || (function () { try { return localStorage.getItem('ffp_jwt') || ''; } catch (e) { return ''; } })();
    var btn = $('#pd-openas'); var lbl = btn ? btn.innerHTML : ''; if (btn) { btn.disabled = true; btn.textContent = 'Opening…'; }
    try {
      var r = await fetch((window.FFP_BACKEND || 'https://ffp-passport-backend.vercel.app') + '/api/admin/provider/impersonate', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
        body: JSON.stringify({ provider_id: id })
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok || !j.url) throw new Error(j.error || 'Could not create a sign-in link');
      logAction('opened dashboard as ' + p.business_name);
      window.open(j.url, '_blank');
    } catch (e) { toast(e.message || 'Impersonation failed', 'error'); }
    if (btn) { btn.disabled = false; btn.innerHTML = lbl; }
  }

  async function deleteProvider(id) {
    var p = getAP().data.find(function (x) { return x.id === id; });
    if (!p) return;
    if (!window.confirm('Permanently delete "' + p.business_name + '"? This removes the listing and its offers. This cannot be undone.')) return;
    try {
      var r = await window.supabase.rpc('admin_provider_delete', { p_id: id });
      if (r.error) throw r.error;
      toast('Provider deleted', 'info'); logAction('deleted provider ' + p.business_name);
      closeDetails(); await refresh();
    } catch (e) { toast(e.message || 'Delete failed', 'error'); }
  }

  async function mergeProvider(keepId) {
    var keep = getAP().data.find(function (x) { return x.id === keepId; });
    if (!keep) return;
    var dupId = window.prompt('Merge a DUPLICATE listing INTO "' + keep.business_name + '".\nPaste the duplicate provider ID to merge (it will be deleted, its data folded in):');
    if (!dupId) return; dupId = dupId.trim();
    if (dupId === keepId) { toast('That is the same provider', 'error'); return; }
    try {
      var r = await window.supabase.rpc('admin_provider_merge', { p_keep: keepId, p_dup: dupId });
      if (r.error) throw r.error;
      toast('Merged — duplicate removed', 'success'); logAction('merged ' + dupId + ' into ' + keep.business_name);
      closeDetails(); await refresh();
    } catch (e) { toast(e.message || 'Merge failed', 'error'); }
  }

  function openAdd() {
    $('#ffp-pm-add-name').value = '';
    $('#ffp-pm-add-category').value = '';
    $('#ffp-pm-add-city').value = '';
    $('#ffp-pm-add-email').value = '';
    $('#ffp-pm-add-phone').value = '';
    $$('#ffp-pm-add-status-chips button').forEach(function (c) { c.classList.toggle('active', c.dataset.status === 'pending'); });
    setActiveTier('add', 'standard');
    $('#ffp-pm-add-date').value = isoDate(new Date(Date.now() + 90 * 86400000));
    $('#ffp-pm-add-fee').value = TIER_DEFAULTS.standard.fee;
    $('#ffp-pm-add-sub-fields').style.display = 'none';
    $('#ffp-pm-add-confirm').disabled = false;
    $('#ffp-pm-add-backdrop').classList.add('open');
    setTimeout(function () { try { $('#ffp-pm-add-name').focus(); } catch (e) {} }, 50);
  }
  function closeAdd() { $('#ffp-pm-add-backdrop').classList.remove('open'); }

  function setActiveTier(key, tier) {
    $$('#ffp-pm-' + key + '-tier-chips .ffp-pm-tier-chip').forEach(function (c) {
      c.classList.toggle('active', c.dataset.tier === tier);
    });
  }

  // ─── Confirm handlers ───
  async function confirmApprove() {
    if (!pendingApproveId) return;
    var tier = selectedTier('approve');
    var date = selectedDate('approve');
    var fee  = selectedFee('approve');
    if (!date) { toast('Pick an expiry date', 'error'); return; }
    var btn = $('#ffp-pm-approve-confirm');
    btn.disabled = true;
    var p = getAP().data.find(function (x) { return x.id === pendingApproveId; });
    try {
      var res = await window.supabase.from('providers').update({
        status: 'approved',
        subscription_tier: tier,
        monthly_fee_aed: fee,
        paid_until: date.toISOString(),
        approved_at: new Date().toISOString()
      }).eq('id', pendingApproveId);
      if (res.error) throw res.error;
      toast('Approved \u00b7 ' + (p ? p.business_name : ''), 'success');
      logAction('approved provider ' + (p ? p.business_name : pendingApproveId) + ' (' + tier + ', until ' + isoDate(date) + ', AED ' + fee + '/mo)');
      closeApprove();
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Providers] approve:', e);
      toast(e.message || 'Approve failed', 'error');
      btn.disabled = false;
    }
  }

  async function confirmEdit() {
    if (!pendingEditId) return;
    var tier = selectedTier('edit');
    var date = selectedDate('edit');
    var fee  = selectedFee('edit');
    if (!date) { toast('Pick an expiry date', 'error'); return; }
    var p = getAP().data.find(function (x) { return x.id === pendingEditId; });
    var btn = $('#ffp-pm-edit-confirm');
    btn.disabled = true;
    try {
      var patch = { subscription_tier: tier, monthly_fee_aed: fee, paid_until: date.toISOString() };
      if (p && p.status === 'lapsed' && date > new Date()) patch.status = 'approved';
      var res = await window.supabase.from('providers').update(patch).eq('id', pendingEditId);
      if (res.error) throw res.error;
      toast('Subscription updated', 'success');
      logAction('edited subscription for ' + (p ? p.business_name : pendingEditId) + ' \u2192 ' + tier + ', until ' + isoDate(date));
      closeEdit();
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Providers] edit:', e);
      toast(e.message || 'Update failed', 'error');
      btn.disabled = false;
    }
  }

  async function confirmAddProvider() {
    var name     = $('#ffp-pm-add-name').value.trim();
    var category = $('#ffp-pm-add-category').value.trim();
    var city     = $('#ffp-pm-add-city').value.trim();
    var email    = $('#ffp-pm-add-email').value.trim().toLowerCase();
    var phone    = $('#ffp-pm-add-phone').value.trim();
    var status   = selectedAddStatus();
    if (!name || !category || !city || !email) { toast('Fill all required fields', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email', 'error'); return; }
    var payload = {
      business_name: name,
      letter_mark: (name[0] || '?').toUpperCase(),
      category: category, city: city, contact_email: email,
      contact_phone: phone || null,
      status: status, featured: false
    };
    if (status === 'approved') {
      var tier = selectedTier('add');
      var date = selectedDate('add');
      var fee  = selectedFee('add');
      if (!date) { toast('Pick an expiry date', 'error'); return; }
      payload.subscription_tier = tier;
      payload.monthly_fee_aed = fee;
      payload.paid_until = date.toISOString();
      payload.approved_at = new Date().toISOString();
    }
    var btn = $('#ffp-pm-add-confirm');
    btn.disabled = true;
    try {
      var res = await window.supabase.from('providers').insert(payload);
      if (res.error) throw res.error;
      toast('Provider added \u00b7 ' + name, 'success');
      logAction('added provider ' + name + ' (status=' + status + ')');
      closeAdd();
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Providers] add:', e);
      toast(e.message || 'Add failed (check INSERT RLS policy)', 'error');
      btn.disabled = false;
    }
  }

  // ─── Data layer ───
  async function fetchProviders() {
    // MANAGEABLE providers only. The directory has ~113k auto-discovered listings (owner_user_id
    // null, status 'approved'); those are not individually managed and would otherwise flood the
    // panel (and cap out at 1000). Show only human-claimed / signed-up providers (owner set) plus
    // anything needing action (pending / suspended / lapsed / archived).
    var res = await window.supabase
      .from('providers')
      .select('id, business_name, letter_mark, category, city, country, status, featured, created_at, paid_until, subscription_tier, monthly_fee_aed, contact_email, contact_phone, area, address, owner_user_id, about, website, instagram, hero_photo_url, logo_url, latitude, longitude, approved_at, approved_by, business_access, business_access_requested_at, admin_notes, is_brand, is_organizer, booking_mode, external_booking_url, activities, google_rating, payments_status, stripe_account_id, maps_url')
      .or('owner_user_id.not.is.null,status.neq.approved')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (res.error) {
      console.error('[FFP Admin Providers] fetch:', res.error);
      toast('Could not load providers', 'error');
      return [];
    }
    return res.data || [];
  }

  function mapForUi(p) {
    var created = p.created_at ? new Date(p.created_at) : new Date();
    return {
      id: p.id,
      business_name: p.business_name,
      letter: (p.letter_mark || (p.business_name || '?')[0] || '?').toUpperCase(),
      category: p.category, city: p.city, status: p.status,
      daysAgo: daysBetween(new Date(), created),
      featured: !!p.featured,
      paid_until: p.paid_until,
      subscription_tier: p.subscription_tier || (p.status === 'approved' || p.status === 'lapsed' ? 'standard' : null),
      monthly_fee_aed: p.monthly_fee_aed,
      business_access: !!p.business_access,
      business_access_requested_at: p.business_access_requested_at || null,
      verified: !!p.approved_by,   // admin-verified → unlocks partner Refer & earn (needs complete profile too)
      _raw: p
    };
  }

  async function refresh() {
    var raw = await fetchProviders();
    getAP().data = raw.map(mapForUi);
    getAP().render();
    updateCounts();
  }

  function updateCounts() {
    var counts = { pending: 0, approved: 0, lapsed: 0, suspended: 0, archived: 0 };
    getAP().data.forEach(function (p) {
      if (counts[p.status] != null) counts[p.status]++;
    });
    setCount('prov-count-pending', counts.pending);
    setCount('prov-count-approved', counts.approved);
    setCount('prov-count-lapsed', counts.lapsed);
    setCount('prov-count-suspended', counts.suspended);
    setCount('prov-count-archived', counts.archived);
  }
  function setCount(id, n) { var el = document.getElementById(id); if (el) el.textContent = n; }

  // ─── Row render ───
  function tierBadgeHtml(p) {
    if (!p.subscription_tier) return '';
    var t = p.subscription_tier;
    return '<span class="ffp-tier-badge ffp-tier-' + t + '" onclick="event.stopPropagation(); AdminProviders.editSub(\'' + p.id + '\')" title="Change tier / extend">' + TIER_DEFAULTS[t].label + '</span>';
  }
  function expiryHtml(p) {
    if (!p.paid_until) return '';
    var expires = new Date(p.paid_until);
    var days = Math.floor((expires.getTime() - Date.now()) / 86400000);
    var dateStr = fmtDateNice(expires);
    var clickAttr = 'onclick="event.stopPropagation(); AdminProviders.editSub(\'' + p.id + '\')"';
    var title = 'Click to change expiry';
    if (days < 0) {
      return '<span class="ffp-expiry bad" ' + clickAttr + ' title="' + title + '"><span class="material-icons">error_outline</span>Expired ' + Math.abs(days) + 'd ago \u00b7 ' + dateStr + '</span>';
    }
    if (days < 7) {
      return '<span class="ffp-expiry warn" ' + clickAttr + ' title="' + title + '"><span class="material-icons">schedule</span>' + days + 'd left \u00b7 ' + dateStr + '</span>';
    }
    return '<span class="ffp-expiry ok" ' + clickAttr + ' title="' + title + '"><span class="material-icons">event</span>Until ' + dateStr + ' (' + days + 'd)</span>';
  }

  function rowActions(p) {
    // Manage-account (edit details, brand/booking, owner, notes, delete/merge, open-as) — available on every row.
    var manage = '<button class="btn btn-sm btn-ghost" title="Manage account · edit details" onclick="AdminProviders.details(\'' + p.id + '\')"><span class="material-icons">manage_accounts</span></button>';
    if (p.status === 'pending') {
      return manage +
             '<button class="btn btn-sm btn-blue" onclick="AdminProviders.approve(\'' + p.id + '\')"><span class="material-icons">check</span>Approve</button>' +
             '<button class="btn btn-sm btn-danger" onclick="AdminProviders.reject(\'' + p.id + '\')">Reject</button>';
    }
    if (p.status === 'approved' || p.status === 'lapsed') {
      return manage +
             '<button class="btn btn-sm btn-ghost" title="Edit subscription" onclick="AdminProviders.editSub(\'' + p.id + '\')"><span class="material-icons">edit_calendar</span></button>' +
             '<button class="btn btn-sm ' + (p.verified ? 'btn-blue' : 'btn-ghost') + '" title="' + (p.verified ? 'Verified for Refer & earn — click to remove' : 'Verify this partner for Refer & earn') + '" onclick="AdminProviders.toggleVerify(\'' + p.id + '\')"><span class="material-icons">' + (p.verified ? 'verified_user' : 'gpp_maybe') + '</span></button>' +
             '<button class="btn btn-sm btn-ghost" title="' + (p.featured ? 'Unfeature' : 'Feature') + '" onclick="AdminProviders.toggleFeatured(\'' + p.id + '\')"><span class="material-icons">' + (p.featured ? 'star' : 'star_border') + '</span></button>' +
             '<button class="btn btn-sm btn-ghost" title="Suspend" onclick="AdminProviders.suspend(\'' + p.id + '\')"><span class="material-icons">block</span></button>';
    }
    if (p.status === 'suspended') {
      return manage +
             '<button class="btn btn-sm btn-blue" title="Reinstate" onclick="AdminProviders.reinstate(\'' + p.id + '\')"><span class="material-icons">refresh</span></button>' +
             '<button class="btn btn-sm btn-ghost" title="Archive" onclick="AdminProviders.archive(\'' + p.id + '\')"><span class="material-icons">archive</span></button>';
    }
    return manage;
  }

  function renderRow(p) {
    var meta = '';
    if (p.subscription_tier || p.paid_until) {
      meta = '<div class="ffp-row-meta">' + tierBadgeHtml(p) + expiryHtml(p) + '</div>';
    }
    var star = p.featured ? '<span class="ffp-row-featured-star material-icons" title="Featured">star</span>' : '';
    return '<tr>' +
      '<td onclick="AdminProviders.info(\'' + p.id + '\')" style="cursor:pointer;" title="Open info page">' +
        '<span class="cell-avatar" style="background:var(--yellow); color:#0a0a0a;">' + escHtmlSafe(p.letter) + '</span>' +
        '<span class="cell-name">' + escHtmlSafe(p.business_name) + star + '</span>' +
        meta +
      '</td>' +
      '<td class="text-muted">' + escHtmlSafe(p.category || '') + '</td>' +
      '<td class="text-muted">' + escHtmlSafe(p.city || '') + '</td>' +
      '<td class="text-muted nowrap">' + (typeof window.fmtDays === 'function' ? window.fmtDays(p.daysAgo) : (p.daysAgo + 'd ago')) + '</td>' +
      '<td><span class="pill pill-' + p.status + '">' + p.status + '</span></td>' +
      '<td><div class="table-actions">' + rowActions(p) + '</div></td>' +
    '</tr>';
  }

  // ─── Patch AdminProviders ───
  function patchAdminProviders() {
    var AP = getAP();
    AP.filtered = function () {
      var rows = this.data;
      // Tab filter
      if (this.tab === 'featured') rows = rows.filter(function (p) { return p.featured && p.status === 'approved'; });
      else rows = rows.filter(function (p) { return p.status === this.tab; }, this);
      // Tier filter
      if (state.tierFilter !== 'all') {
        rows = rows.filter(function (p) { return p.subscription_tier === state.tierFilter; });
      }
      // Search
      if (this.search) {
        var q = this.search;
        rows = rows.filter(function (p) {
          return (p.business_name || '').toLowerCase().indexOf(q) !== -1 ||
                 (p.category || '').toLowerCase().indexOf(q) !== -1 ||
                 (p.city || '').toLowerCase().indexOf(q) !== -1;
        });
      }
      return rows;
    };
    AP.render = function () {
      var rows = this.filtered();
      var metaEl = document.getElementById('AdminProviders-meta');
      if (metaEl) {
        var bits = [];
        if (this.search) bits.push(rows.length + ' match');
        else bits.push(rows.length + ' total');
        if (state.tierFilter !== 'all') bits.push(state.tierFilter);
        metaEl.textContent = bits.join(' \u00b7 ');
      }
      var tbody = document.getElementById('providers-tbody');
      if (!tbody) return;
      tbody.innerHTML = rows.map(renderRow).join('') ||
        '<tr><td colspan="6" class="text-muted" style="text-align:center; padding:30px;">No providers match</td></tr>';
    };
    AP.approve = function (id) { openApprove(id); };
    AP.editSub = function (id) { openEdit(id); };
    AP.details = function (id) { openDetails(id); };
    AP.info = function (id) { openInfo(id); };
    AP.closeInfo = function () { closeInfo(); };
    AP.openAs = function (id) { openAsProvider(id); };
    AP.openAddModal = function () { openAdd(); };

    AP.reject = async function (id) {
      if (!confirm('Reject and archive this provider?')) return;
      var p = AP.data.find(function (x) { return x.id === id; });
      try {
        var res = await window.supabase.from('providers').update({ status: 'archived' }).eq('id', id);
        if (res.error) throw res.error;
        toast('Archived' + (p ? ' \u00b7 ' + p.business_name : ''), 'info');
        logAction('rejected provider ' + (p ? p.business_name : id));
        await refresh();
      } catch (e) { console.error(e); toast(e.message || 'Reject failed', 'error'); }
    };
    AP.archive = async function (id) {
      if (!confirm('Archive this provider?')) return;
      var p = AP.data.find(function (x) { return x.id === id; });
      try {
        var res = await window.supabase.from('providers').update({ status: 'archived' }).eq('id', id);
        if (res.error) throw res.error;
        toast('Archived' + (p ? ' \u00b7 ' + p.business_name : ''), 'info');
        logAction('archived provider ' + (p ? p.business_name : id));
        await refresh();
      } catch (e) { console.error(e); toast(e.message || 'Archive failed', 'error'); }
    };
    AP.suspend = async function (id) {
      if (!confirm('Suspend this provider? Their content will be hidden from members.')) return;
      var p = AP.data.find(function (x) { return x.id === id; });
      try {
        var res = await window.supabase.from('providers').update({ status: 'suspended' }).eq('id', id);
        if (res.error) throw res.error;
        toast('Suspended' + (p ? ' \u00b7 ' + p.business_name : ''), 'info');
        logAction('suspended provider ' + (p ? p.business_name : id));
        await refresh();
      } catch (e) { console.error(e); toast(e.message || 'Suspend failed', 'error'); }
    };
    AP.toggleBusiness = async function (id) {
      var p = AP.data.find(function (x) { return x.id === id; });
      var turnOn = !(p && p.business_access);
      try {
        var patch = turnOn
          ? { business_access: true, business_access_at: new Date().toISOString(), business_access_by: (window.FFP_ADMIN && window.FFP_ADMIN.id) || null }
          : { business_access: false };
        var res = await window.supabase.from('providers').update(patch).eq('id', id);
        if (res.error) throw res.error;
        toast(turnOn ? 'Business access granted ($99/mo section)' : 'Business access revoked', turnOn ? 'check' : 'info');
        logAction((turnOn ? 'granted' : 'revoked') + ' Business access · ' + (p ? p.business_name : id));
        await refresh();
        try { if (window.Drawer && typeof Drawer.openProvider === 'function') Drawer.openProvider(id); } catch (e) {}
      } catch (e) { console.error(e); toast(e.message || 'Update failed', 'error'); }
    };
    AP.reinstate = async function (id) {
      var p = AP.data.find(function (x) { return x.id === id; });
      if (!p) return;
      var newStatus = (p.paid_until && new Date(p.paid_until) > new Date()) ? 'approved' : 'lapsed';
      try {
        var res = await window.supabase.from('providers').update({ status: newStatus }).eq('id', id);
        if (res.error) throw res.error;
        toast('Reinstated as ' + newStatus, 'success');
        logAction('reinstated provider ' + p.business_name + ' to ' + newStatus);
        await refresh();
      } catch (e) { console.error(e); toast(e.message || 'Reinstate failed', 'error'); }
    };
    // Verify a partner for Refer & earn: sets providers.approved_by (the admin-verified gate in the
    // backend referral check — needs a complete profile too). Toggling off removes eligibility.
    AP.toggleVerify = async function (id) {
      var p = AP.data.find(function (x) { return x.id === id; });
      if (!p) return;
      var makeVerified = !p.verified;
      var admin = window.FFP_ADMIN && window.FFP_ADMIN.id;
      if (makeVerified && !admin) { toast('Admin sign-in required', 'error'); return; }
      try {
        var patch = makeVerified
          ? { approved_by: admin, approved_at: (p._raw && p._raw.approved_at) || new Date().toISOString() }
          : { approved_by: null };
        var res = await window.supabase.from('providers').update(patch).eq('id', id);
        if (res.error) throw res.error;
        toast(makeVerified ? 'Verified · Refer & earn unlocked' : 'Verification removed', makeVerified ? 'success' : 'info');
        logAction((makeVerified ? 'verified' : 'un-verified') + ' provider for referrals · ' + p.business_name);
        await refresh();
      } catch (e) { console.error(e); toast(e.message || 'Update failed', 'error'); }
    };
    AP.toggleFeatured = async function (id) {
      var p = AP.data.find(function (x) { return x.id === id; });
      if (!p) return;
      var newVal = !p.featured;
      try {
        var res = await window.supabase.from('providers').update({ featured: newVal }).eq('id', id);
        if (res.error) throw res.error;
        toast(newVal ? 'Featured \u00b7 ' + p.business_name : 'Unfeatured', 'info');
        logAction((newVal ? 'featured' : 'unfeatured') + ' provider ' + p.business_name);
        await refresh();
      } catch (e) { console.error(e); toast(e.message || 'Update failed', 'error'); }
    };
  }

  // ─── Provider INFO PAGE (full-screen read view) ───
  function injectInfoStyles() {
    if ($('#ffp-info-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-info-css';
    css.textContent = [
      '.pinfo-ov{position:fixed;inset:0;z-index:9990;background:#06101a;overflow-y:auto;font-family:Montserrat,system-ui,sans-serif;color:#eaf1f6;display:none;}',
      '.pinfo-ov.open{display:block;}',
      '.pinfo-wrap{max-width:940px;margin:0 auto;padding:26px 20px 70px;}',
      '.pinfo-crumb{display:flex;align-items:center;gap:7px;color:#8499a8;font-size:13px;font-weight:700;margin-bottom:14px;cursor:pointer;width:max-content;}',
      '.pinfo-crumb .material-icons{font-size:18px;color:#2b9fd0;}',
      '.pinfo-shell{background:#0a141c;border:1px solid rgba(255,255,255,.09);border-radius:20px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.5);}',
      '.pinfo-hero{position:relative;padding:26px 30px 22px;background:radial-gradient(120% 150% at 88% -20%,rgba(43,159,208,.22),transparent 55%),linear-gradient(135deg,#143046,#0b1a26);border-bottom:1px solid rgba(255,255,255,.09);}',
      '.pinfo-hbar{display:flex;align-items:flex-start;gap:18px;}',
      '.pinfo-mono{width:74px;height:74px;border-radius:20px;flex:none;display:grid;place-items:center;font-weight:900;font-size:26px;color:#06212e;background:linear-gradient(160deg,#7fd0f0,#2b9fd0);box-shadow:0 10px 24px rgba(43,159,208,.4);overflow:hidden;}',
      '.pinfo-mono.g{background:linear-gradient(160deg,#ffe07a,#f4b400);color:#3a2600;}',
      '.pinfo-mono img{width:100%;height:100%;object-fit:cover;}',
      '.pinfo-hmid{flex:1;min-width:0;}',
      '.pinfo-name{font-size:27px;font-weight:900;letter-spacing:-.02em;line-height:1.06;}',
      '.pinfo-sub{margin-top:5px;color:#c7d7e1;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.pinfo-sub .dot{color:#5f7482;}',
      '.pinfo-sub .star{color:#FFCC00;font-weight:800;display:inline-flex;align-items:center;gap:3px;}',
      '.pinfo-sub .star .material-icons{font-size:16px;}',
      '.pinfo-acts{display:flex;gap:10px;flex:none;flex-wrap:wrap;}',
      '.pinfo-btn{border:0;border-radius:11px;padding:11px 16px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;}',
      '.pinfo-btn .material-icons{font-size:18px;}',
      '.pinfo-btn.gold{background:linear-gradient(180deg,#ffd23d,#f0b400);color:#3a2600;}',
      '.pinfo-btn.blue{background:transparent;color:#bfe0f0;border:1.5px solid rgba(120,190,225,.45);}',
      '.pinfo-btn.ghost{background:rgba(255,255,255,.06);color:#dbe8f0;}',
      '.pinfo-btn.danger{background:transparent;color:#f0938a;border:1px solid rgba(226,87,76,.4);}',
      '.pinfo-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;}',
      '.pinfo-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;}',
      '.pinfo-chip .material-icons{font-size:15px;}',
      '.pc-grn{background:rgba(47,189,119,.16);color:#57d79a;}',
      '.pc-gold{background:rgba(255,204,0,.16);color:#ffd54a;}',
      '.pc-blue{background:rgba(43,159,208,.18);color:#7fcdec;}',
      '.pc-grey{background:rgba(255,255,255,.08);color:#b8c9d4;}',
      '.pc-amb{background:rgba(240,168,60,.16);color:#f6c072;}',
      '.pc-red{background:rgba(226,87,76,.16);color:#f0938a;}',
      '.pinfo-body{padding:8px 30px 26px;}',
      '.pinfo-sec{padding:20px 0;border-bottom:1px solid rgba(255,255,255,.09);}',
      '.pinfo-sec:last-child{border-bottom:0;}',
      '.pinfo-sec h3{font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7fa0b2;margin-bottom:14px;display:flex;align-items:center;gap:8px;}',
      '.pinfo-sec h3 .material-icons{font-size:18px;color:#2b9fd0;}',
      '.pinfo-rows{display:grid;grid-template-columns:1fr 1fr;column-gap:40px;}',
      '.pinfo-row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.055);}',
      '.pinfo-row .k{color:#8499a8;font-size:13.5px;font-weight:600;flex:none;}',
      '.pinfo-row .v{color:#eaf1f6;font-size:13.5px;font-weight:700;text-align:right;word-break:break-word;}',
      '.pinfo-row .v.mut{color:#5f7482;font-weight:600;}',
      '.pinfo-row .v a{color:#7fcdec;text-decoration:none;}',
      '.pinfo-row .v .ok{color:#2fbd77;}.pinfo-row .v .no{color:#f0a83c;}',
      '.pinfo-full{grid-column:1 / -1;}',
      '.pinfo-about{color:#c3d3dd;font-size:14px;font-weight:500;line-height:1.55;max-width:70ch;}',
      '.pinfo-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;}',
      '.pinfo-tag{background:rgba(255,255,255,.06);color:#cfe0ea;font-size:12.5px;font-weight:700;padding:6px 12px;border-radius:9px;}',
      '.pinfo-contact{display:flex;align-items:center;gap:16px;background:linear-gradient(120deg,#12283a,#0e1f2b);border:1px solid rgba(255,255,255,.09);border-radius:15px;padding:16px 18px;flex-wrap:wrap;}',
      '.pinfo-cav{width:52px;height:52px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:900;font-size:18px;color:#06212e;background:linear-gradient(160deg,#9adcf3,#3ba7d6);}',
      '.pinfo-cinfo{flex:1;min-width:180px;}',
      '.pinfo-cname{font-size:16px;font-weight:800;}',
      '.pinfo-crole{font-size:12.5px;font-weight:700;color:#8499a8;margin-top:1px;}',
      '.pinfo-clines{display:flex;gap:18px;flex-wrap:wrap;margin-top:7px;color:#c3d3dd;font-size:13px;font-weight:600;}',
      '.pinfo-clines span{display:inline-flex;align-items:center;gap:6px;}',
      '.pinfo-clines .material-icons{font-size:16px;color:#5f7482;}',
      '.pinfo-clink{color:#7fcdec;font-weight:800;font-size:13px;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:4px;flex:none;}',
      '.pinfo-clink .material-icons{font-size:17px;}',
      '.pinfo-note{background:transparent;border:1px dashed rgba(255,255,255,.16);border-radius:12px;padding:13px 15px;color:#b7c8d3;font-size:13.5px;font-weight:500;line-height:1.5;}',
      '@media(max-width:720px){.pinfo-rows{grid-template-columns:1fr;}.pinfo-hbar{flex-wrap:wrap;}.pinfo-acts{width:100%;}}'
    ].join('');
    document.head.appendChild(css);
  }
  function ensureInfoOverlay() {
    var ov = document.getElementById('ffp-prov-info');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'ffp-prov-info';
      ov.className = 'pinfo-ov';
      document.body.appendChild(ov);
    }
    return ov;
  }
  function closeInfo() {
    var ov = document.getElementById('ffp-prov-info');
    if (ov) { ov.classList.remove('open'); ov.innerHTML = ''; }
    document.body.style.overflow = '';
  }
  function infoRow(k, v, cls) {
    return '<div class="pinfo-row"><span class="k">' + k + '</span><span class="v ' + (cls || '') + '">' + (v == null || v === '' ? '—' : v) + '</span></div>';
  }
  function fmtNice(d) { try { return fmtDateNice(new Date(d)); } catch (e) { return '—'; } }

  async function openInfo(id) {
    var pm = getAP().data.find(function (x) { return x.id === id; });
    if (!pm) return;
    var p = pm._raw || pm;
    injectInfoStyles();
    var ov = ensureInfoOverlay();
    document.body.style.overflow = 'hidden';
    ov.classList.add('open');
    ov.scrollTop = 0;
    ov.innerHTML = '<div class="pinfo-wrap"><div class="pinfo-crumb" onclick="AdminProviders.closeInfo()"><span class="material-icons">arrow_back</span> Providers / ' + escHtmlSafe(p.business_name || '') + '</div><div class="pinfo-shell"><div class="pinfo-body"><div class="pinfo-sec" style="text-align:center;color:#5f7482;padding:50px 0;">Loading…</div></div></div></div>';

    // fetch the contact person (owner member) + any claim application contact
    var owner = null, app = null;
    try {
      if (p.owner_user_id) {
        var or_ = await window.supabase.from('members')
          .select('id,given_names,surname,full_name,email,phone,membership,city,created_at')
          .eq('id', p.owner_user_id).maybeSingle();
        owner = or_ && or_.data ? or_.data : null;
      }
      var ar_ = await window.supabase.from('provider_applications')
        .select('contact_name,email,phone,status,created_at')
        .eq('claim_provider_id', id).order('created_at', { ascending: false }).limit(1);
      app = ar_ && ar_.data && ar_.data[0] ? ar_.data[0] : null;
    } catch (e) { /* non-fatal */ }

    var e = escHtmlSafe;
    var tier = p.subscription_tier || 'standard';
    var tierLabel = (TIER_DEFAULTS[tier] || TIER_DEFAULTS.standard).label;
    var isBrand = !!p.is_brand;
    var isOrganizer = !!p.is_organizer;
    var typeLabel = isOrganizer ? 'Event organizer' : (isBrand ? 'Brand' : 'Venue');
    var verified = !!p.approved_by;
    var external = p.booking_mode === 'external';
    var paid = p.payments_status === 'connected';
    var loc = [p.area, p.city, p.country].filter(function (x) { return x && x !== p.city || (x === p.city); }); // keep simple below
    var locStr = [p.city, p.country].filter(Boolean).map(e).join(', ') || '—';

    // status chip
    var stMap = { approved: ['pc-grn', 'check_circle', 'Approved'], pending: ['pc-amb', 'schedule', 'Pending'], lapsed: ['pc-amb', 'error_outline', 'Lapsed'], suspended: ['pc-red', 'block', 'Suspended'], archived: ['pc-grey', 'archive', 'Archived'] };
    var st = stMap[p.status] || ['pc-grey', 'help', p.status || '—'];
    function chip(cls, icon, txt) { return '<span class="pinfo-chip ' + cls + '">' + (icon ? '<span class="material-icons">' + icon + '</span>' : '') + e(txt) + '</span>'; }

    var chips = [
      chip(st[0], st[1], st[2]),
      chip('pc-grey', '', tierLabel + ' tier'),
      chip('pc-grey', '', typeLabel),
      verified ? chip('pc-blue', 'verified_user', 'Verified for referrals') : chip('pc-grey', 'gpp_maybe', 'Not verified'),
      external ? chip('pc-grey', 'open_in_new', 'External booking') : chip('pc-grey', 'event_available', 'FFP booking'),
      paid ? chip('pc-grn', 'credit_card', 'Payments connected') : chip('pc-amb', 'credit_card_off', 'Payments not connected')
    ].join('');

    // contact person
    var ownerName = owner ? ([owner.given_names, owner.surname].filter(Boolean).join(' ') || owner.full_name || '') : '';
    var contactName = ownerName || (app && app.contact_name) || '';
    var contactEmail = (owner && owner.email) || p.contact_email || (app && app.email) || '';
    var contactPhone = (owner && owner.phone) || p.contact_phone || (app && app.phone) || '';
    var cav = (contactName ? contactName[0] : (p.business_name || '?')[0] || '?').toUpperCase();
    // The owner is the provider's LOGIN / business contact — NOT a consumer FFP member. Never label them
    // with a member tier (Standard/Premium); that conflates a partner contact with a paying member.
    var roleLine;
    if (owner) {
      roleLine = 'Owner login &middot; business contact &middot; login created ' + fmtNice(owner.created_at);
    } else if (app) {
      roleLine = 'Applied to claim &middot; ' + fmtNice(app.created_at) + ' &middot; not yet an owner login';
    } else {
      roleLine = 'No owner login — unclaimed listing';
    }
    var contactHtml =
      '<div class="pinfo-contact">' +
        '<div class="pinfo-cav">' + e(cav) + '</div>' +
        '<div class="pinfo-cinfo">' +
          '<div class="pinfo-cname">' + (contactName ? e(contactName) : 'Account holder <span style="color:#5f7482;font-weight:600;font-size:13px">· no name on file</span>') + '</div>' +
          '<div class="pinfo-crole">' + roleLine + '</div>' +
          '<div class="pinfo-clines">' +
            (contactEmail ? '<span><span class="material-icons">mail</span>' + e(contactEmail) + '</span>' : '') +
            (contactPhone ? '<span><span class="material-icons">call</span>' + e(contactPhone) + '</span>' : '') +
          '</div>' +
        '</div>' +
        (owner ? '<a class="pinfo-clink" onclick="AdminProviders.closeInfo(); if(window.AdminMembers&&AdminMembers.info){AdminMembers.info(\'' + owner.id + '\')}else if(window.Drawer&&Drawer.openMember){Drawer.openMember(\'' + owner.id + '\')}">Open owner account <span class="material-icons">chevron_right</span></a>' : '') +
      '</div>';

    // business rows
    var acts = Array.isArray(p.activities) ? p.activities : [];
    var actsHtml = acts.length
      ? '<div class="pinfo-row pinfo-full" style="flex-direction:column;align-items:flex-start;gap:8px;border-bottom:0;"><span class="k">Activities</span><div class="pinfo-tags">' + acts.map(function (a) { return '<span class="pinfo-tag">' + e(a) + '</span>'; }).join('') + '</div></div>'
      : '';
    var aboutHtml = p.about
      ? '<div class="pinfo-row pinfo-full" style="flex-direction:column;align-items:flex-start;gap:6px;border-bottom:0;"><span class="k">About</span><p class="pinfo-about">' + e(p.about) + '</p></div>'
      : '';
    var webHtml = p.website ? '<a href="' + e(p.website) + '" target="_blank" rel="noopener">' + e((p.website || '').replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a>' : '—';
    var igHtml = p.instagram ? e(p.instagram) : '—';
    var bookHtml = external ? ('External' + (p.external_booking_url ? ' &middot; <a href="' + e(p.external_booking_url) + '" target="_blank" rel="noopener">link</a>' : '')) : 'On FFP (native)';

    var businessRows =
      infoRow('Category', e(p.category || '—')) +
      infoRow('Type', typeLabel) +
      infoRow('Location', locStr) +
      infoRow('Website', webHtml) +
      infoRow('Instagram', igHtml) +
      infoRow('Google rating', p.google_rating != null ? (p.google_rating + ' ★') : '—') +
      '<div class="pinfo-row pinfo-full"><span class="k">Booking</span><span class="v">' + bookHtml + '</span></div>' +
      actsHtml + aboutHtml;

    // account & billing rows
    var payVal = paid ? '<span class="ok">Connected</span>' + (p.stripe_account_id ? ' <span style="color:#5f7482;font-weight:600">· ' + e(p.stripe_account_id) + '</span>' : '') : '<span class="no">Not connected</span>';
    var billRows =
      infoRow('Listing status', '<span class="' + (p.status === 'approved' ? 'ok' : 'no') + '">' + e((p.status || '').charAt(0).toUpperCase() + (p.status || '').slice(1)) + '</span>') +
      infoRow('Subscription', tierLabel + (tier === 'standard' ? ' (free)' : '')) +
      infoRow('Renews / paid until', p.paid_until ? fmtNice(p.paid_until) : '—') +
      infoRow('Monthly fee', p.monthly_fee_aed != null ? ('AED ' + p.monthly_fee_aed) : '—') +
      '<div class="pinfo-row"><span class="k">Payments (Stripe)</span><span class="v">' + payVal + '</span></div>' +
      infoRow('Verified for referrals', verified ? '<span class="ok">Yes</span>' : '<span class="no">No</span>') +
      infoRow('Listed since', fmtNice(p.created_at)) +
      infoRow('Approved on', p.approved_at ? fmtNice(p.approved_at) : '—');

    var notesHtml = p.admin_notes
      ? '<div class="pinfo-note">' + e(p.admin_notes) + '</div>'
      : '<div class="pinfo-note">No notes yet — use Manage account to add context (owner spoken to, verification done, follow-ups)…</div>';

    var monoHtml = p.logo_url
      ? '<div class="pinfo-mono"><img src="' + e(p.logo_url) + '" alt=""></div>'
      : '<div class="pinfo-mono">' + e((p.business_name || '?')[0] || '?').toUpperCase() + '</div>';

    ov.innerHTML =
      '<div class="pinfo-wrap">' +
        '<div class="pinfo-crumb" onclick="AdminProviders.closeInfo()"><span class="material-icons">arrow_back</span> Providers / ' + e(p.business_name || '') + '</div>' +
        '<div class="pinfo-shell">' +
          '<div class="pinfo-hero">' +
            '<div class="pinfo-hbar">' +
              monoHtml +
              '<div class="pinfo-hmid">' +
                '<div class="pinfo-name">' + e(p.business_name || '—') + '</div>' +
                '<div class="pinfo-sub">' + e(p.category || 'Uncategorised') + ' <span class="dot">·</span> ' + locStr +
                  (p.google_rating != null ? ' <span class="dot">·</span> <span class="star"><span class="material-icons">star</span>' + p.google_rating + '</span>' : '') +
                '</div>' +
              '</div>' +
              '<div class="pinfo-acts">' +
                '<button class="pinfo-btn gold" onclick="AdminProviders.details(\'' + id + '\')"><span class="material-icons">manage_accounts</span>Manage account</button>' +
                ((p.status === 'approved' || p.status === 'lapsed') ? '<button class="pinfo-btn blue" onclick="AdminProviders.editSub(\'' + id + '\')"><span class="material-icons">edit_calendar</span>Edit subscription</button>' : '') +
                (p.owner_user_id ? '<button class="pinfo-btn ghost" onclick="AdminProviders.openAs(\'' + id + '\')"><span class="material-icons">login</span>Open as</button>' : '') +
              '</div>' +
            '</div>' +
            '<div class="pinfo-chips">' + chips + '</div>' +
          '</div>' +
          '<div class="pinfo-body">' +
            '<div class="pinfo-sec"><h3><span class="material-icons">contact_page</span>Contact person</h3>' + contactHtml + '</div>' +
            ((isBrand || isOrganizer) ? '' : '<div class="pinfo-sec"><h3><span class="material-icons">storefront</span>Business</h3><div class="pinfo-rows">' + businessRows + '</div></div>') +
            '<div class="pinfo-sec"><h3><span class="material-icons">receipt_long</span>Account &amp; billing status</h3><div class="pinfo-rows">' + billRows + '</div></div>' +
            '<div class="pinfo-sec"><h3><span class="material-icons">sticky_note_2</span>Internal notes <span style="font-weight:600;letter-spacing:0;text-transform:none;color:#5f7482;font-size:12px">(admin only)</span></h3>' + notesHtml + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ─── Boot ───
  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth && getAP();
    }, 15000);
    if (!ok) {
      console.error('[FFP Admin Providers] dependencies never loaded');
      return;
    }
    await waitFor(function () { return !!window.FFP_ADMIN; }, 10000);

    injectStyles();
    removeFeaturedTab();
    injectExtraTabs();
    injectTierFilter();
    injectModals();
    patchAdminProviders();
    await refresh();
    if (window.FFPRealtime) window.FFPRealtime.subscribe('admin-providers', 'providers', null, function () { refresh(); });
    console.log('[FFP Admin Providers v4] Wired to Supabase \u2713');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

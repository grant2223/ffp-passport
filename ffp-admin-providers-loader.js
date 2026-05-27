/* FFP Admin Providers Loader — v4
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

      // Modal (shared)
      '.ffp-pm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px;font-family:Montserrat,sans-serif;}',
      '.ffp-pm-backdrop.open{display:flex;}',
      '.ffp-pm-sheet{background:#0f1e2e;border:1px solid rgba(43,168,224,0.30);border-radius:14px;width:100%;max-width:480px;color:#f5f7fa;overflow:hidden;max-height:90vh;display:flex;flex-direction:column;}',
      '.ffp-pm-head{padding:18px 20px 12px;border-bottom:1px solid rgba(43,168,224,0.15);display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}',
      '.ffp-pm-title{font-size:16px;font-weight:800;}',
      '.ffp-pm-sub{font-size:12px;color:#8a99a8;margin-top:2px;}',
      '.ffp-pm-close{background:transparent;border:none;color:#8a99a8;cursor:pointer;font-family:inherit;padding:4px;}',
      '.ffp-pm-close:hover{color:#f5f7fa;}',
      '.ffp-pm-body{padding:16px 20px;overflow-y:auto;}',
      '.ffp-pm-row{margin-bottom:14px;}',
      '.ffp-pm-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:0.6px;font-weight:800;color:#8a99a8;margin-bottom:6px;}',
      '.ffp-pm-input{width:100%;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:8px;color:#f5f7fa;padding:10px 12px;font-size:13px;font-weight:600;font-family:inherit;color-scheme:dark;}',
      '.ffp-pm-input:focus{outline:none;border-color:#2ba8e0;}',
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

      '.ffp-pm-foot{padding:12px 20px 18px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid rgba(43,168,224,0.15);}',
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
      });
    });
    ['approve', 'edit', 'add'].forEach(function (key) {
      var backdrop = $('#ffp-pm-' + key + '-backdrop');
      backdrop.addEventListener('click', function (e) {
        if (e.target.id === backdrop.id) {
          if (key === 'approve') closeApprove();
          if (key === 'edit') closeEdit();
          if (key === 'add') closeAdd();
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
    var res = await window.supabase
      .from('providers')
      .select('id, business_name, letter_mark, category, city, status, featured, created_at, paid_until, subscription_tier, monthly_fee_aed, contact_email, contact_phone, area, address, owner_user_id, about, website, instagram, hero_photo_url, logo_url, latitude, longitude, approved_at')
      .order('created_at', { ascending: false });
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
    if (p.status === 'pending') {
      return '<button class="btn btn-sm btn-blue" onclick="AdminProviders.approve(\'' + p.id + '\')"><span class="material-icons">check</span>Approve</button>' +
             '<button class="btn btn-sm btn-danger" onclick="AdminProviders.reject(\'' + p.id + '\')">Reject</button>';
    }
    if (p.status === 'approved' || p.status === 'lapsed') {
      return '<button class="btn btn-sm btn-ghost" title="Edit subscription" onclick="AdminProviders.editSub(\'' + p.id + '\')"><span class="material-icons">edit_calendar</span></button>' +
             '<button class="btn btn-sm btn-ghost" title="' + (p.featured ? 'Unfeature' : 'Feature') + '" onclick="AdminProviders.toggleFeatured(\'' + p.id + '\')"><span class="material-icons">' + (p.featured ? 'star' : 'star_border') + '</span></button>' +
             '<button class="btn btn-sm btn-ghost" title="Suspend" onclick="AdminProviders.suspend(\'' + p.id + '\')"><span class="material-icons">block</span></button>';
    }
    if (p.status === 'suspended') {
      return '<button class="btn btn-sm btn-blue" title="Reinstate" onclick="AdminProviders.reinstate(\'' + p.id + '\')"><span class="material-icons">refresh</span></button>' +
             '<button class="btn btn-sm btn-ghost" title="Archive" onclick="AdminProviders.archive(\'' + p.id + '\')"><span class="material-icons">archive</span></button>';
    }
    return '<span class="text-muted" style="font-size:12px;">\u2014</span>';
  }

  function renderRow(p) {
    var meta = '';
    if (p.subscription_tier || p.paid_until) {
      meta = '<div class="ffp-row-meta">' + tierBadgeHtml(p) + expiryHtml(p) + '</div>';
    }
    var star = p.featured ? '<span class="ffp-row-featured-star material-icons" title="Featured">star</span>' : '';
    return '<tr>' +
      '<td onclick="Drawer.openProvider(\'' + p.id + '\')" style="cursor:pointer;">' +
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
    console.log('[FFP Admin Providers v4] Wired to Supabase \u2713');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

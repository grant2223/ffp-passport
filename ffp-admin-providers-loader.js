/* FFP Admin Providers Loader — v1
   Wires the admin dashboard's existing AdminProviders module to real Supabase data.
   Replaces hardcoded demo data + demo approve/reject with real CRUD against the
   providers table. Adds subscription approval modal, extend modal, suspend/reinstate.

   Add ONE script tag to ffp-admin-dashboard.html AFTER ffp-admin-auth.js:
     <script src="ffp-admin-providers-loader.js"></script>

   Required SQL (run once — see message): adds paid_until, subscription_tier,
   monthly_fee_aed, the 'lapsed' status, admin RLS, and the lapse-flip function.

   Architecture: this loader patches the existing window.AdminProviders module
   (preserving the existing UI in #panel-providers) instead of building an overlay.
*/
(function () {
  'use strict';

  // Tier defaults (admin can override per-provider)
  var TIER_DEFAULTS = {
    standard: { fee: 500 },
    premium:  { fee: 1000 },
    partner:  { fee: 2000 }
  };

  // ─── Helpers ───
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function escHtmlSafe(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Admin Providers]', msg);
  }
  function logAction(action) {
    if (window.AuditLog && typeof window.AuditLog.add === 'function') {
      try {
        var who = (window.FFP_ADMIN && window.FFP_ADMIN.role) ? 'Admin' : 'Unknown';
        window.AuditLog.add(who, action);
      } catch (e) {}
    }
    console.log('[FFP Admin Providers] action:', action);
  }
  function daysBetween(a, b) {
    return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
  }
  function isoDate(d) { return d.toISOString().slice(0, 10); }

  async function waitFor(check, ms) {
    var tries = 0; var limit = Math.ceil((ms || 10000) / 100);
    while (!check() && tries < limit) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    return check();
  }

  // ─── Inject Lapsed tab + small status styles ───
  function injectLapsedTab() {
    var tabs = $('#providers-tabs');
    if (!tabs) return;
    if ($('#providers-tabs [data-tab="lapsed"]')) return;
    var suspended = $('#providers-tabs [data-tab="suspended"]');
    var btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.tab = 'lapsed';
    btn.setAttribute('onclick', "AdminProviders.setTab('lapsed')");
    btn.innerHTML = 'Lapsed <span class="count" id="prov-count-lapsed">0</span>';
    if (suspended) tabs.insertBefore(btn, suspended);
    else tabs.appendChild(btn);

    // Add Archived tab if missing
    if (!$('#providers-tabs [data-tab="archived"]')) {
      var arc = document.createElement('button');
      arc.className = 'tab-btn';
      arc.dataset.tab = 'archived';
      arc.setAttribute('onclick', "AdminProviders.setTab('archived')");
      arc.innerHTML = 'Archived <span class="count" id="prov-count-archived">0</span>';
      tabs.appendChild(arc);
    }
  }

  function injectStyles() {
    if ($('#ffp-admin-providers-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-admin-providers-css';
    css.textContent = [
      '.pill-lapsed{background:rgba(249,115,22,0.18);color:#f97316;}',
      '.pill-archived{background:rgba(138,153,168,0.18);color:#8a99a8;}',
      '.ffp-sub-info{font-size:10px;font-weight:600;margin-top:2px;line-height:1.2;}',
      '.ffp-sub-info.ok{color:#8a99a8;}',
      '.ffp-sub-info.warn{color:#FFCC00;}',
      '.ffp-sub-info.bad{color:#ef4444;}',
      /* Modal */
      '.ffp-pm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px;font-family:Montserrat,sans-serif;}',
      '.ffp-pm-backdrop.open{display:flex;}',
      '.ffp-pm-sheet{background:#0f1e2e;border:1px solid rgba(43,168,224,0.30);border-radius:14px;width:100%;max-width:480px;color:#f5f7fa;overflow:hidden;}',
      '.ffp-pm-head{padding:18px 20px 12px;border-bottom:1px solid rgba(43,168,224,0.15);display:flex;justify-content:space-between;align-items:center;}',
      '.ffp-pm-title{font-size:16px;font-weight:800;}',
      '.ffp-pm-sub{font-size:12px;color:#8a99a8;margin-top:2px;}',
      '.ffp-pm-close{background:transparent;border:none;color:#8a99a8;cursor:pointer;font-family:inherit;}',
      '.ffp-pm-close:hover{color:#f5f7fa;}',
      '.ffp-pm-body{padding:16px 20px;}',
      '.ffp-pm-row{margin-bottom:14px;}',
      '.ffp-pm-label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;font-weight:800;color:#8a99a8;margin-bottom:6px;}',
      '.ffp-pm-input{width:100%;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:8px;color:#f5f7fa;padding:10px 12px;font-size:13px;font-weight:600;font-family:inherit;}',
      '.ffp-pm-input:focus{outline:none;border-color:#2ba8e0;}',
      '.ffp-pm-tier-chips{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}',
      '.ffp-pm-tier-chip{padding:10px 8px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:8px;color:#f5f7fa;font-size:12px;font-weight:700;cursor:pointer;text-align:center;font-family:inherit;text-transform:capitalize;}',
      '.ffp-pm-tier-chip.active{background:#FFCC00;color:#082335;border-color:#FFCC00;}',
      '.ffp-pm-duration-chips{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}',
      '.ffp-pm-duration-chip{padding:10px 4px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:8px;color:#f5f7fa;font-size:12px;font-weight:700;cursor:pointer;text-align:center;font-family:inherit;}',
      '.ffp-pm-duration-chip.active{background:#2ba8e0;color:#082335;border-color:#2ba8e0;}',
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

  // ─── Modals ───
  function injectModals() {
    if ($('#ffp-pm-approve-backdrop')) return;
    var html =
      '<div class="ffp-pm-backdrop" id="ffp-pm-approve-backdrop">' +
        '<div class="ffp-pm-sheet" onclick="event.stopPropagation();">' +
          '<div class="ffp-pm-head">' +
            '<div>' +
              '<div class="ffp-pm-title">Approve provider</div>' +
              '<div class="ffp-pm-sub" id="ffp-pm-approve-bizname"></div>' +
            '</div>' +
            '<button class="ffp-pm-close" type="button" data-close="approve"><span class="material-icons">close</span></button>' +
          '</div>' +
          '<div class="ffp-pm-body">' +
            '<div class="ffp-pm-row">' +
              '<label class="ffp-pm-label">Subscription tier</label>' +
              '<div class="ffp-pm-tier-chips" id="ffp-pm-tier-chips">' +
                '<button class="ffp-pm-tier-chip active" data-tier="standard" type="button">Standard</button>' +
                '<button class="ffp-pm-tier-chip" data-tier="premium" type="button">Premium</button>' +
                '<button class="ffp-pm-tier-chip" data-tier="partner" type="button">Partner</button>' +
              '</div>' +
            '</div>' +
            '<div class="ffp-pm-row">' +
              '<label class="ffp-pm-label">Initial period</label>' +
              '<div class="ffp-pm-duration-chips" id="ffp-pm-duration-chips">' +
                '<button class="ffp-pm-duration-chip" data-months="1" type="button">1 mo</button>' +
                '<button class="ffp-pm-duration-chip active" data-months="3" type="button">3 mo</button>' +
                '<button class="ffp-pm-duration-chip" data-months="6" type="button">6 mo</button>' +
                '<button class="ffp-pm-duration-chip" data-months="12" type="button">12 mo</button>' +
              '</div>' +
            '</div>' +
            '<div class="ffp-pm-row">' +
              '<label class="ffp-pm-label">Monthly fee (AED)</label>' +
              '<input type="number" min="0" step="50" class="ffp-pm-input" id="ffp-pm-fee" value="500">' +
            '</div>' +
            '<div class="ffp-pm-row">' +
              '<div class="ffp-pm-preview" id="ffp-pm-preview"></div>' +
            '</div>' +
          '</div>' +
          '<div class="ffp-pm-foot">' +
            '<button class="ffp-pm-btn ffp-pm-btn-ghost" type="button" data-close="approve">Cancel</button>' +
            '<button class="ffp-pm-btn ffp-pm-btn-primary" type="button" id="ffp-pm-approve-confirm">Approve</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="ffp-pm-backdrop" id="ffp-pm-extend-backdrop">' +
        '<div class="ffp-pm-sheet" onclick="event.stopPropagation();">' +
          '<div class="ffp-pm-head">' +
            '<div>' +
              '<div class="ffp-pm-title">Extend subscription</div>' +
              '<div class="ffp-pm-sub" id="ffp-pm-extend-bizname"></div>' +
            '</div>' +
            '<button class="ffp-pm-close" type="button" data-close="extend"><span class="material-icons">close</span></button>' +
          '</div>' +
          '<div class="ffp-pm-body">' +
            '<div class="ffp-pm-row">' +
              '<label class="ffp-pm-label">Extend by</label>' +
              '<div class="ffp-pm-duration-chips" id="ffp-pm-extend-chips">' +
                '<button class="ffp-pm-duration-chip" data-months="1" type="button">1 mo</button>' +
                '<button class="ffp-pm-duration-chip active" data-months="3" type="button">3 mo</button>' +
                '<button class="ffp-pm-duration-chip" data-months="6" type="button">6 mo</button>' +
                '<button class="ffp-pm-duration-chip" data-months="12" type="button">12 mo</button>' +
              '</div>' +
            '</div>' +
            '<div class="ffp-pm-row">' +
              '<div class="ffp-pm-preview" id="ffp-pm-extend-preview"></div>' +
            '</div>' +
          '</div>' +
          '<div class="ffp-pm-foot">' +
            '<button class="ffp-pm-btn ffp-pm-btn-ghost" type="button" data-close="extend">Cancel</button>' +
            '<button class="ffp-pm-btn ffp-pm-btn-primary" type="button" id="ffp-pm-extend-confirm">Extend</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    // Close handlers
    $$('[data-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        var which = el.getAttribute('data-close');
        if (which === 'approve') closeApproveModal();
        if (which === 'extend') closeExtendModal();
      });
    });
    $('#ffp-pm-approve-backdrop').addEventListener('click', function (e) {
      if (e.target.id === 'ffp-pm-approve-backdrop') closeApproveModal();
    });
    $('#ffp-pm-extend-backdrop').addEventListener('click', function (e) {
      if (e.target.id === 'ffp-pm-extend-backdrop') closeExtendModal();
    });

    // Tier chips
    $$('#ffp-pm-tier-chips .ffp-pm-tier-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        $$('#ffp-pm-tier-chips .ffp-pm-tier-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var tier = chip.dataset.tier;
        // Auto-fill fee from tier default
        var feeInput = $('#ffp-pm-fee');
        if (feeInput && TIER_DEFAULTS[tier]) feeInput.value = TIER_DEFAULTS[tier].fee;
        updateApprovePreview();
      });
    });
    // Duration chips
    $$('#ffp-pm-duration-chips .ffp-pm-duration-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        $$('#ffp-pm-duration-chips .ffp-pm-duration-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        updateApprovePreview();
      });
    });
    $('#ffp-pm-fee').addEventListener('input', updateApprovePreview);

    // Extend chips
    $$('#ffp-pm-extend-chips .ffp-pm-duration-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        $$('#ffp-pm-extend-chips .ffp-pm-duration-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        updateExtendPreview();
      });
    });

    $('#ffp-pm-approve-confirm').addEventListener('click', confirmApprove);
    $('#ffp-pm-extend-confirm').addEventListener('click', confirmExtend);
  }

  var pendingApproveId = null;
  var pendingExtendId = null;

  function openApproveModal(id) {
    var p = window.AdminProviders.data.find(function (x) { return x.id === id; });
    if (!p) return;
    pendingApproveId = id;
    $('#ffp-pm-approve-bizname').textContent = p.business_name + ' \u00b7 ' + (p.city || '');
    // Reset to defaults
    $$('#ffp-pm-tier-chips .ffp-pm-tier-chip').forEach(function (c) { c.classList.toggle('active', c.dataset.tier === 'standard'); });
    $$('#ffp-pm-duration-chips .ffp-pm-duration-chip').forEach(function (c) { c.classList.toggle('active', c.dataset.months === '3'); });
    $('#ffp-pm-fee').value = TIER_DEFAULTS.standard.fee;
    updateApprovePreview();
    $('#ffp-pm-approve-backdrop').classList.add('open');
  }
  function closeApproveModal() { $('#ffp-pm-approve-backdrop').classList.remove('open'); pendingApproveId = null; }

  function openExtendModal(id) {
    var p = window.AdminProviders.data.find(function (x) { return x.id === id; });
    if (!p) return;
    pendingExtendId = id;
    $('#ffp-pm-extend-bizname').textContent = p.business_name + ' \u00b7 ' + (p.city || '');
    $$('#ffp-pm-extend-chips .ffp-pm-duration-chip').forEach(function (c) { c.classList.toggle('active', c.dataset.months === '3'); });
    updateExtendPreview();
    $('#ffp-pm-extend-backdrop').classList.add('open');
  }
  function closeExtendModal() { $('#ffp-pm-extend-backdrop').classList.remove('open'); pendingExtendId = null; }

  function selectedTier() {
    var el = $('#ffp-pm-tier-chips .ffp-pm-tier-chip.active');
    return el ? el.dataset.tier : 'standard';
  }
  function selectedApproveMonths() {
    var el = $('#ffp-pm-duration-chips .ffp-pm-duration-chip.active');
    return el ? parseInt(el.dataset.months, 10) : 3;
  }
  function selectedExtendMonths() {
    var el = $('#ffp-pm-extend-chips .ffp-pm-duration-chip.active');
    return el ? parseInt(el.dataset.months, 10) : 3;
  }

  function updateApprovePreview() {
    var tier = selectedTier();
    var months = selectedApproveMonths();
    var fee = parseFloat($('#ffp-pm-fee').value) || 0;
    var until = new Date(Date.now() + months * 30 * 86400 * 1000);
    $('#ffp-pm-preview').innerHTML =
      'Approves as <b>' + tier + '</b> tier at <b>AED ' + fee.toFixed(0) + '/mo</b>.<br>' +
      'Subscription valid until <b>' + isoDate(until) + '</b> (' + months + ' month' + (months > 1 ? 's' : '') + ').';
  }
  function updateExtendPreview() {
    var p = pendingExtendId ? window.AdminProviders.data.find(function (x) { return x.id === pendingExtendId; }) : null;
    if (!p) return;
    var months = selectedExtendMonths();
    var base = (p.paid_until && new Date(p.paid_until) > new Date()) ? new Date(p.paid_until) : new Date();
    var until = new Date(base.getTime() + months * 30 * 86400 * 1000);
    var note = p.status === 'lapsed' ? '<br>This will also reinstate status from <b>lapsed</b> to <b>approved</b>.' : '';
    $('#ffp-pm-extend-preview').innerHTML =
      'New paid-until date: <b>' + isoDate(until) + '</b>' + note;
  }

  async function confirmApprove() {
    if (!pendingApproveId) return;
    var tier = selectedTier();
    var months = selectedApproveMonths();
    var fee = parseFloat($('#ffp-pm-fee').value) || 0;
    var until = new Date(Date.now() + months * 30 * 86400 * 1000);
    var btn = $('#ffp-pm-approve-confirm');
    btn.disabled = true;
    var p = window.AdminProviders.data.find(function (x) { return x.id === pendingApproveId; });
    try {
      var res = await window.supabase
        .from('providers')
        .update({
          status: 'approved',
          subscription_tier: tier,
          monthly_fee_aed: fee,
          paid_until: until.toISOString()
        })
        .eq('id', pendingApproveId);
      if (res.error) throw res.error;
      toast('Approved \u00b7 ' + (p ? p.business_name : ''), 'success');
      logAction('approved provider ' + (p ? p.business_name : pendingApproveId) + ' (' + tier + ', ' + months + 'mo, AED ' + fee + '/mo)');
      closeApproveModal();
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Providers] approve:', e);
      toast(e.message || 'Approve failed', 'error');
      btn.disabled = false;
    }
  }

  async function confirmExtend() {
    if (!pendingExtendId) return;
    var p = window.AdminProviders.data.find(function (x) { return x.id === pendingExtendId; });
    if (!p) return;
    var months = selectedExtendMonths();
    var base = (p.paid_until && new Date(p.paid_until) > new Date()) ? new Date(p.paid_until) : new Date();
    var until = new Date(base.getTime() + months * 30 * 86400 * 1000);
    var btn = $('#ffp-pm-extend-confirm');
    btn.disabled = true;
    try {
      var patch = { paid_until: until.toISOString() };
      // Reinstate from lapsed if extending past now
      if (p.status === 'lapsed' && until > new Date()) patch.status = 'approved';
      var res = await window.supabase.from('providers').update(patch).eq('id', pendingExtendId);
      if (res.error) throw res.error;
      toast('Extended by ' + months + ' month' + (months > 1 ? 's' : ''), 'success');
      logAction('extended provider ' + p.business_name + ' by ' + months + ' months');
      closeExtendModal();
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Providers] extend:', e);
      toast(e.message || 'Extend failed', 'error');
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
    var days = daysBetween(new Date(), created);
    return {
      id: p.id,
      business_name: p.business_name,
      letter: (p.letter_mark || (p.business_name || '?')[0] || '?').toUpperCase(),
      category: p.category,
      city: p.city,
      status: p.status,
      daysAgo: days,
      featured: !!p.featured,
      paid_until: p.paid_until,
      subscription_tier: p.subscription_tier,
      monthly_fee_aed: p.monthly_fee_aed,
      _raw: p
    };
  }

  async function refresh() {
    var raw = await fetchProviders();
    window.AdminProviders.data = raw.map(mapForUi);
    window.AdminProviders.render();
    updateCounts();
  }

  function updateCounts() {
    var counts = { pending: 0, approved: 0, lapsed: 0, suspended: 0, archived: 0, featured: 0 };
    window.AdminProviders.data.forEach(function (p) {
      if (counts[p.status] != null) counts[p.status]++;
      if (p.featured && p.status === 'approved') counts.featured++;
    });
    setCount('prov-count-pending', counts.pending);
    setCount('prov-count-approved', counts.approved);
    setCount('prov-count-featured', counts.featured);
    setCount('prov-count-lapsed', counts.lapsed);
    setCount('prov-count-suspended', counts.suspended);
    setCount('prov-count-archived', counts.archived);
  }
  function setCount(id, n) { var el = document.getElementById(id); if (el) el.textContent = n; }

  // ─── Render row (replaces demo's row template) ───
  function renderSubInfo(p) {
    if (!p.paid_until) return '';
    var expires = new Date(p.paid_until);
    var days = Math.floor((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    var tier = p.subscription_tier || 'standard';
    if (days < 0) {
      return '<div class="ffp-sub-info bad">Expired ' + Math.abs(days) + 'd ago \u00b7 ' + tier + '</div>';
    }
    if (days < 7) {
      return '<div class="ffp-sub-info warn">Expires in ' + days + 'd \u00b7 ' + tier + '</div>';
    }
    return '<div class="ffp-sub-info ok">' + tier + ' \u00b7 until ' + isoDate(expires) + '</div>';
  }

  function rowActions(p) {
    if (p.status === 'pending') {
      return '<button class="btn btn-sm btn-blue" onclick="AdminProviders.approve(\'' + p.id + '\')"><span class="material-icons">check</span>Approve</button>' +
             '<button class="btn btn-sm btn-danger" onclick="AdminProviders.reject(\'' + p.id + '\')">Reject</button>';
    }
    if (p.status === 'approved' || p.status === 'lapsed') {
      return '<button class="btn btn-sm btn-ghost" title="Extend subscription" onclick="AdminProviders.extendSubscription(\'' + p.id + '\')"><span class="material-icons">event_available</span></button>' +
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
    return '<tr>' +
      '<td onclick="Drawer.openProvider(\'' + p.id + '\')" style="cursor:pointer;">' +
        '<span class="cell-avatar" style="background:var(--yellow); color:#0a0a0a;">' + escHtmlSafe(p.letter) + '</span>' +
        '<span class="cell-name">' + escHtmlSafe(p.business_name) + '</span>' +
        renderSubInfo(p) +
      '</td>' +
      '<td class="text-muted">' + escHtmlSafe(p.category || '') + '</td>' +
      '<td class="text-muted">' + escHtmlSafe(p.city || '') + '</td>' +
      '<td class="text-muted nowrap">' + (typeof window.fmtDays === 'function' ? window.fmtDays(p.daysAgo) : (p.daysAgo + 'd ago')) + '</td>' +
      '<td>' +
        '<span class="pill pill-' + p.status + '">' + p.status + '</span>' +
        (p.featured ? '<span class="pill pill-featured" style="margin-left:4px;">Featured</span>' : '') +
      '</td>' +
      '<td><div class="table-actions">' + rowActions(p) + '</div></td>' +
    '</tr>';
  }

  // ─── Patch AdminProviders methods ───
  function patchAdminProviders() {
    var AP = window.AdminProviders;

    // Custom filtered() to include 'lapsed' and 'archived' tabs
    AP.filtered = function () {
      var rows = this.data;
      if (this.tab === 'featured') rows = rows.filter(function (p) { return p.featured && p.status === 'approved'; });
      else rows = rows.filter(function (p) { return p.status === this.tab; }, this);
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
      if (metaEl) metaEl.textContent = this.search ? rows.length + ' match' : rows.length + ' total';
      var tbody = document.getElementById('providers-tbody');
      if (!tbody) return;
      tbody.innerHTML = rows.map(renderRow).join('') ||
        '<tr><td colspan="6" class="text-muted" style="text-align:center; padding:30px;">No providers match</td></tr>';
    };

    AP.approve = function (id) { openApproveModal(id); };
    AP.extendSubscription = function (id) { openExtendModal(id); };

    AP.reject = async function (id) {
      if (!confirm('Reject and archive this provider?')) return;
      var p = AP.data.find(function (x) { return x.id === id; });
      try {
        var res = await window.supabase.from('providers').update({ status: 'archived' }).eq('id', id);
        if (res.error) throw res.error;
        toast('Archived' + (p ? ' \u00b7 ' + p.business_name : ''), 'info');
        logAction('rejected provider ' + (p ? p.business_name : id));
        await refresh();
      } catch (e) {
        console.error('[FFP Admin Providers] reject:', e);
        toast(e.message || 'Reject failed', 'error');
      }
    };

    AP.archive = async function (id) {
      if (!confirm('Archive this provider? They will no longer appear.')) return;
      var p = AP.data.find(function (x) { return x.id === id; });
      try {
        var res = await window.supabase.from('providers').update({ status: 'archived' }).eq('id', id);
        if (res.error) throw res.error;
        toast('Archived' + (p ? ' \u00b7 ' + p.business_name : ''), 'info');
        logAction('archived provider ' + (p ? p.business_name : id));
        await refresh();
      } catch (e) {
        console.error('[FFP Admin Providers] archive:', e);
        toast(e.message || 'Archive failed', 'error');
      }
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
      } catch (e) {
        console.error('[FFP Admin Providers] suspend:', e);
        toast(e.message || 'Suspend failed', 'error');
      }
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
      } catch (e) {
        console.error('[FFP Admin Providers] reinstate:', e);
        toast(e.message || 'Reinstate failed', 'error');
      }
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
      } catch (e) {
        console.error('[FFP Admin Providers] toggleFeatured:', e);
        toast(e.message || 'Update failed', 'error');
      }
    };

    AP.openAddModal = function () {
      toast('Manual add: coming in next ship — use the Apply flow on partner.html for now', 'info');
    };
  }

  // ─── Boot ───
  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.auth && window.AdminProviders;
    }, 15000);
    if (!ok) {
      console.error('[FFP Admin Providers] dependencies never loaded');
      return;
    }
    // Wait for admin auth to grant access (FFP_ADMIN set) — but don't block forever
    await waitFor(function () { return !!window.FFP_ADMIN; }, 10000);

    injectStyles();
    injectLapsedTab();
    injectModals();
    patchAdminProviders();
    await refresh();
    console.log('[FFP Admin Providers] Wired to Supabase \u2713');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

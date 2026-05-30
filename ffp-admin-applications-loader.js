/* FFP Admin — Provider Applications queue — v1
   Self-injecting admin panel for reviewing provider_applications.
   - Adds an "Applications" sidebar link + panel to the admin dashboard.
   - Reads pending/approved/rejected applications via window.supabase (admin RLS).
   - Reject  → updates the application row (status=rejected + reason) via Supabase.
   - Approve → opens a tier/expiry/fee modal, then POSTs to the backend
     /api/admin/provision-provider (admin-authenticated with the Supabase JWT),
     which creates the provider account + sends the invite email.
   Loads after ffp-admin-auth.js + ffp-api-integration.js.
*/
(function () {
  'use strict';

  var API_BASE = 'https://ffp-passport-backend.vercel.app';
  var TIER_DEFAULTS = {
    standard: { fee: 500,  label: 'Standard' },
    premium:  { fee: 1000, label: 'Premium'  },
    partner:  { fee: 2000, label: 'Partner'   }
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function toast(msg, icon) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, icon); return; } catch (e) {} }
    console.log('[FFP Applications]', msg);
  }
  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function isoDate(d) { return d.toISOString().slice(0, 10); }
  async function waitFor(check, ms) {
    var tries = 0, limit = Math.ceil((ms || 15000) / 100);
    while (!check() && tries < limit) { await new Promise(function (r) { setTimeout(r, 100); }); tries++; }
    return check();
  }
  function jwtHeader() {
    var t = null;
    try { t = localStorage.getItem('ffp_jwt'); } catch (e) {}
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }

  // ─── Inject styles (scoped) ───
  function injectStyles() {
    if ($('#ffp-apps-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-apps-css';
    css.textContent = [
      '.ffp-apps-tierchips{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}',
      '.ffp-apps-tierchip{padding:10px 8px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:8px;color:#f5f7fa;font-size:12px;font-weight:700;cursor:pointer;text-align:center;font-family:inherit;}',
      '.ffp-apps-tierchip.active{background:#2ba8e0;color:#082335;border-color:#2ba8e0;}',
      '.ffp-apps-quick{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;}',
      '.ffp-apps-quick button{padding:6px 10px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:6px;color:#a8b3c0;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.ffp-apps-quick button:hover{color:#f5f7fa;border-color:#2ba8e0;}',
      '.ffp-apps-preview{padding:10px 12px;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.15);border-radius:8px;font-size:12px;color:#f5f7fa;line-height:1.5;margin-top:12px;}',
      '.ffp-apps-about{font-size:11px;color:#8a99a8;margin-top:2px;max-width:520px;}'
    ].join('');
    document.head.appendChild(css);
  }

  // ─── Inject sidebar link + panel ───
  function injectUI() {
    // Register the panel name with the router (App is a bare global const, not on window)
    try { if (typeof App !== 'undefined' && App.panelNames) App.panelNames['panel-applications'] = 'Applications'; } catch (e) {}

    // Sidebar link — placed right after Providers (Approvals section)
    if (!$('.sidebar-link[data-panel="panel-applications"]')) {
      var providersLink = $('.sidebar-link[data-panel="panel-providers"]');
      if (providersLink) {
        var a = document.createElement('a');
        a.className = 'sidebar-link';
        a.setAttribute('data-panel', 'panel-applications');
        a.setAttribute('onclick', "App.go('panel-applications')");
        a.innerHTML = '<span class="material-icons">inbox</span>Applications <span class="sidebar-link-badge" id="badge-applications" style="display:none;">0</span>';
        providersLink.parentNode.insertBefore(a, providersLink.nextSibling);
      }
    }

    // Panel
    if (!$('#panel-applications')) {
      var main = $('.main') || document.body;
      var sec = document.createElement('section');
      sec.className = 'panel';
      sec.id = 'panel-applications';
      sec.innerHTML =
        '<div class="panel-head"><h1>Provider Applications</h1>' +
          '<div class="panel-head-sub">Businesses applying to join. Approve to create their provider account + send an invite.</div></div>' +
        '<div class="section">' +
          '<div class="search-row">' +
            '<div class="search-input-wrap"><span class="material-icons">search</span>' +
            '<input type="text" placeholder="Search by business, contact, email, city..." oninput="AdminApplications.onSearch(this.value)"></div>' +
            '<div class="search-meta" id="AdminApplications-meta"></div>' +
          '</div>' +
          '<div class="tabs" id="apps-tabs">' +
            '<button class="tab-btn active" data-tab="pending" onclick="AdminApplications.setTab(\'pending\')">Pending <span class="count" id="apps-count-pending">0</span></button>' +
            '<button class="tab-btn" data-tab="approved" onclick="AdminApplications.setTab(\'approved\')">Approved <span class="count" id="apps-count-approved">0</span></button>' +
            '<button class="tab-btn" data-tab="rejected" onclick="AdminApplications.setTab(\'rejected\')">Rejected <span class="count" id="apps-count-rejected">0</span></button>' +
          '</div>' +
          '<div class="section-body"><table class="table"><thead>' +
            '<tr><th>Business</th><th>Contact</th><th>Location</th><th>Category</th><th>Applied</th><th></th></tr>' +
          '</thead><tbody id="apps-tbody"></tbody></table></div>' +
        '</div>';
      main.appendChild(sec);
    }
  }

  // ─── Data + render ───
  var AdminApplications = {
    tab: 'pending',
    search: '',
    data: [],

    async load() {
      var res = await window.supabase
        .from('provider_applications')
        .select('id, business_name, contact_name, email, phone, category, provider_type, country, city, website, about, status, created_at')
        .order('created_at', { ascending: false });
      if (res.error) { console.error('[FFP Applications] load:', res.error); toast('Could not load applications', 'error'); this.data = []; }
      else this.data = res.data || [];
      this.updateCounts();
      this.render();
    },

    updateCounts() {
      var c = { pending: 0, approved: 0, rejected: 0 };
      this.data.forEach(function (a) { if (c[a.status] != null) c[a.status]++; });
      ['pending','approved','rejected'].forEach(function (k) {
        var el = document.getElementById('apps-count-' + k); if (el) el.textContent = c[k];
      });
      var badge = document.getElementById('badge-applications');
      if (badge) { badge.textContent = c.pending; badge.style.display = c.pending > 0 ? '' : 'none'; }
    },

    setTab(tab) {
      this.tab = tab;
      var tabsEl = document.getElementById('apps-tabs');
      if (tabsEl) Array.prototype.forEach.call(tabsEl.querySelectorAll('.tab-btn'), function (b) {
        b.classList.toggle('active', b.dataset.tab === tab);
      });
      this.render();
    },
    onSearch(q) { this.search = (q || '').toLowerCase().trim(); this.render(); },

    filtered() {
      var self = this;
      var rows = this.data.filter(function (a) { return a.status === self.tab; });
      if (this.search) {
        rows = rows.filter(function (a) {
          return [a.business_name, a.contact_name, a.email, a.city, a.country, a.category]
            .filter(Boolean).join(' ').toLowerCase().indexOf(self.search) !== -1;
        });
      }
      return rows;
    },

    render() {
      var rows = this.filtered();
      var meta = document.getElementById('AdminApplications-meta');
      if (meta) meta.textContent = (this.search ? rows.length + ' match' : rows.length + ' total');
      var tbody = document.getElementById('apps-tbody');
      if (!tbody) return;
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center; padding:30px;">No ' + this.tab + ' applications</td></tr>';
        return;
      }
      var self = this;
      tbody.innerHTML = rows.map(function (a) {
        var loc = [a.city, a.country].filter(Boolean).join(', ');
        var cat = [a.category, a.provider_type].filter(Boolean).join(' · ');
        var actions = '';
        if (a.status === 'pending') {
          actions =
            '<button class="btn btn-sm btn-blue" onclick="AdminApplications.approve(\'' + a.id + '\')"><span class="material-icons">check</span>Approve</button>' +
            '<button class="btn btn-sm btn-danger" onclick="AdminApplications.reject(\'' + a.id + '\')">Reject</button>';
        } else {
          actions = '<span class="pill pill-' + (a.status === 'approved' ? 'approved' : 'rejected') + '">' + a.status + '</span>';
        }
        return '<tr>' +
          '<td><span class="cell-avatar" style="background:var(--yellow); color:#0a0a0a;">' + esc((a.business_name||'?').charAt(0).toUpperCase()) + '</span>' +
            '<span class="cell-name">' + esc(a.business_name) + '</span>' +
            (a.website ? '<div class="cell-meta" style="margin-left:36px;">' + esc(a.website) + '</div>' : '') +
            (a.about ? '<div class="ffp-apps-about" style="margin-left:36px;">' + esc(a.about.slice(0,120)) + (a.about.length>120?'…':'') + '</div>' : '') + '</td>' +
          '<td>' + esc(a.contact_name) + '<div class="cell-meta">' + esc(a.email) + (a.phone ? ' · ' + esc(a.phone) : '') + '</div></td>' +
          '<td class="text-muted">' + esc(loc) + '</td>' +
          '<td class="text-muted">' + esc(cat) + '</td>' +
          '<td class="text-muted nowrap">' + fmtDate(a.created_at) + '</td>' +
          '<td><div class="table-actions">' + actions + '</div></td>' +
        '</tr>';
      }).join('');
    },

    // ─── Reject (Supabase update; admin RLS) ───
    async reject(id) {
      var a = this.data.find(function (x) { return x.id === id; });
      if (!a) return;
      var reason = window.prompt('Reject "' + (a.business_name || 'application') + '"? Optional reason (emailed later if you add one):', '');
      if (reason === null) return; // cancelled
      try {
        var res = await window.supabase.from('provider_applications')
          .update({ status: 'rejected', rejection_reason: reason || null, reviewed_at: new Date().toISOString() })
          .eq('id', id);
        if (res.error) throw res.error;
        toast('Application rejected', 'close');
        await this.load();
      } catch (e) { console.error(e); toast(e.message || 'Reject failed', 'error'); }
    },

    // ─── Approve (tier/expiry/fee modal → provision endpoint) ───
    approve(id) {
      var a = this.data.find(function (x) { return x.id === id; });
      if (!a) return;
      this._pendingId = id;
      var defaultEnd = new Date(Date.now() + 365 * 86400000); // 1 year default
      var body =
        '<div style="font-size:13px;color:var(--muted);margin-bottom:14px;">Approving <strong style="color:var(--text);">' + esc(a.business_name) + '</strong> (' + esc(a.email) + '). This creates their provider account and emails an invite.</div>' +
        '<div class="field"><label class="field-label">Subscription tier</label>' +
          '<div class="ffp-apps-tierchips" id="apps-tierchips">' +
            Object.keys(TIER_DEFAULTS).map(function (t) {
              return '<button type="button" class="ffp-apps-tierchip' + (t==='standard'?' active':'') + '" data-tier="' + t + '">' + TIER_DEFAULTS[t].label + '</button>';
            }).join('') +
          '</div></div>' +
        '<div class="field"><label class="field-label">Subscription ends</label>' +
          '<input type="date" class="field-input" id="apps-date" value="' + isoDate(defaultEnd) + '">' +
          '<div class="ffp-apps-quick" id="apps-quick">' +
            '<button type="button" data-days="30">+1 mo</button><button type="button" data-days="90">+3 mo</button>' +
            '<button type="button" data-days="180">+6 mo</button><button type="button" data-days="365">+1 yr</button>' +
          '</div></div>' +
        '<div class="field"><label class="field-label">Monthly fee (AED)</label>' +
          '<input type="number" min="0" step="50" class="field-input" id="apps-fee" value="500"></div>' +
        '<div class="ffp-apps-preview" id="apps-preview"></div>';
      var footer =
        '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
        '<button class="btn btn-primary" id="apps-confirm">Approve &amp; create provider</button>';
      window.openModal('Approve application', body, footer);
      this._wireModal();
    },

    _wireModal() {
      var self = this;
      var chips = document.getElementById('apps-tierchips');
      if (chips) Array.prototype.forEach.call(chips.querySelectorAll('.ffp-apps-tierchip'), function (chip) {
        chip.addEventListener('click', function () {
          Array.prototype.forEach.call(chips.querySelectorAll('.ffp-apps-tierchip'), function (c) { c.classList.remove('active'); });
          chip.classList.add('active');
          var fee = document.getElementById('apps-fee');
          if (fee && TIER_DEFAULTS[chip.dataset.tier]) fee.value = TIER_DEFAULTS[chip.dataset.tier].fee;
          self._preview();
        });
      });
      var quick = document.getElementById('apps-quick');
      if (quick) Array.prototype.forEach.call(quick.querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () {
          var d = new Date(Date.now() + parseInt(b.dataset.days, 10) * 86400000);
          document.getElementById('apps-date').value = isoDate(d);
          self._preview();
        });
      });
      var dateEl = document.getElementById('apps-date'); if (dateEl) dateEl.addEventListener('change', function () { self._preview(); });
      var feeEl = document.getElementById('apps-fee'); if (feeEl) feeEl.addEventListener('input', function () { self._preview(); });
      var confirm = document.getElementById('apps-confirm'); if (confirm) confirm.addEventListener('click', function () { self._confirm(); });
      this._preview();
    },

    _selTier() { var el = document.querySelector('#apps-tierchips .ffp-apps-tierchip.active'); return el ? el.dataset.tier : 'standard'; },
    _selDate() { var v = document.getElementById('apps-date').value; return v ? new Date(v + 'T23:59:59') : null; },
    _selFee()  { return parseFloat(document.getElementById('apps-fee').value) || 0; },

    _preview() {
      var el = document.getElementById('apps-preview'); if (!el) return;
      var d = this._selDate();
      if (!d) { el.textContent = 'Pick an expiry date.'; return; }
      el.innerHTML = 'Creates a <b>' + this._selTier() + '</b> provider at <b>AED ' + this._selFee().toFixed(0) + '/mo</b>, active until <b>' + fmtDate(d) + '</b>. An invite email with their login code is sent on approval.';
    },

    async _confirm() {
      if (!this._pendingId) return;
      var date = this._selDate();
      if (!date) { toast('Pick an expiry date', 'error'); return; }
      var btn = document.getElementById('apps-confirm');
      if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
      try {
        var res = await fetch(API_BASE + '/api/admin/provision-provider', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, jwtHeader()),
          body: JSON.stringify({
            application_id: this._pendingId,
            subscription_tier: this._selTier(),
            paid_until: date.toISOString(),
            monthly_fee_aed: this._selFee()
          })
        });
        var out = await res.json().catch(function () { return {}; });
        if (!res.ok || out.error) throw new Error(out.error || ('HTTP ' + res.status));
        if (typeof window.closeModal === 'function') window.closeModal();
        toast('Provider approved + invited', 'check');
        try { if (typeof AuditLog !== 'undefined' && AuditLog.add) AuditLog.add('Admin', 'approved provider application'); } catch (e) {}
        await this.load();
      } catch (e) {
        console.error('[FFP Applications] provision:', e);
        toast(e.message || 'Approval failed', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Approve & create provider'; }
      }
    },

    init() { injectStyles(); injectUI(); this.load(); }
  };

  window.AdminApplications = AdminApplications;

  async function boot() {
    var ok = await waitFor(function () {
      return window.supabase && window.supabase.from && (typeof App !== 'undefined') && document.querySelector('.main');
    }, 15000);
    if (!ok) { console.error('[FFP Applications] dependencies never loaded'); return; }
    await waitFor(function () { return !!window.FFP_ADMIN; }, 10000);
    AdminApplications.init();
    console.log('[FFP Admin Applications v1] Loaded ✓');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

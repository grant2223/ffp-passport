/* FFP Admin Deals Loader — v1
   Wires the admin dashboard's Deals panel to real Supabase data.
   - Fetches all deals with provider join (business name + letter mark)
   - Tabs: Pending / Live / Paused / Archived (replaces existing live/pending/featured/paused)
   - Default tab = 'pending' so admin sees the approval queue first
   - Approve: status → 'live'
   - Reject: status → 'archived'
   - Feature toggle: featured boolean
   - View detail: opens compact modal with photo + description + all fields
*/
(function () {
  'use strict';

  function getAD() { return (typeof AdminDeals !== 'undefined') ? AdminDeals : null; }
  function toast(msg, kind) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, kind || 'info'); return; } catch (e) {} }
    console.log('[FFP Admin Deals]', msg);
  }
  async function waitFor(check, ms) {
    var tries = 0; var limit = Math.ceil((ms || 15000) / 100);
    while (!check() && tries < limit) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    return check();
  }
  function escHtml(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function injectStyles() {
    if (document.getElementById('ffp-admin-deals-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-admin-deals-css';
    css.textContent = [
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',
      'select{appearance:none;-webkit-appearance:none;-moz-appearance:none;' +
        'background-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238a99a8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E");' +
        'background-repeat:no-repeat;background-position:right 12px center;background-size:16px;padding-right:36px;}'
    ].join('');
    document.head.appendChild(css);
  }

  function letterFor(name) {
    return (name && name.length) ? name[0].toUpperCase() : '?';
  }

  function mapForUi(row) {
    var p = row.providers || {};
    return {
      id: row.id,
      provider: p.business_name || 'Unknown',
      pLetter: p.letter_mark || letterFor(p.business_name),
      perk: row.title || '',
      activity: row.activity || '',
      category: row.category || '—',
      offering_type: row.offering_type || '',
      status: row.status || 'pending',
      featured: !!row.featured,
      hot: false,
      hero_url: row.hero_image_url || null,
      description: row.description || '',
      valid_when: row.valid_when || '',
      booking_method: row.booking_method || '',
      created_at: row.created_at || '',
      _raw: row
    };
  }

  async function fetchDeals() {
    var res = await window.supabase
      .from('deals')
      .select('id, provider_id, title, description, activity, category, offering_type, hero_image_url, valid_when, booking_method, status, featured, created_at, providers!inner(business_name, letter_mark)')
      .order('created_at', { ascending: false });
    if (res.error) {
      console.error('[FFP Admin Deals] fetch:', res.error);
      toast('Could not load deals', 'error');
      return [];
    }
    return (res.data || []).map(mapForUi);
  }

  async function refresh() {
    var ad = getAD();
    if (!ad) return;
    ad.data = await fetchDeals();
    realRender();
  }

  function tabCounts(data) {
    var c = { pending: 0, live: 0, paused: 0, archived: 0 };
    data.forEach(function (d) { if (c[d.status] != null) c[d.status]++; });
    return c;
  }

  function realRender() {
    var ad = getAD();
    if (!ad) return;
    var tab = ad.tab || 'pending';
    var rows = (ad.data || []).filter(function (d) { return d.status === tab; });
    if (ad.search) {
      rows = rows.filter(function (d) {
        return d.provider.toLowerCase().indexOf(ad.search) >= 0 ||
               d.perk.toLowerCase().indexOf(ad.search) >= 0 ||
               (d.activity || '').toLowerCase().indexOf(ad.search) >= 0 ||
               d.category.toLowerCase().indexOf(ad.search) >= 0;
      });
    }

    // Update tab pills with counts
    var counts = tabCounts(ad.data || []);
    var tabsEl = document.querySelector('#panel-deals .tabs');
    if (tabsEl) {
      tabsEl.innerHTML =
        '<button class="tab-btn' + (tab === 'pending' ? ' active' : '') + '" data-tab="pending" onclick="AdminDeals.setTab(\'pending\')">Pending <span class="count">' + counts.pending + '</span></button>' +
        '<button class="tab-btn' + (tab === 'live' ? ' active' : '') + '" data-tab="live" onclick="AdminDeals.setTab(\'live\')">Live <span class="count">' + counts.live + '</span></button>' +
        '<button class="tab-btn' + (tab === 'paused' ? ' active' : '') + '" data-tab="paused" onclick="AdminDeals.setTab(\'paused\')">Paused <span class="count">' + counts.paused + '</span></button>' +
        '<button class="tab-btn' + (tab === 'archived' ? ' active' : '') + '" data-tab="archived" onclick="AdminDeals.setTab(\'archived\')">Archived <span class="count">' + counts.archived + '</span></button>';
    }

    var metaEl = document.getElementById('AdminDeals-meta');
    if (metaEl) metaEl.textContent = rows.length + ' item' + (rows.length === 1 ? '' : 's');

    var body = document.getElementById('deals-tbody');
    if (!body) return;
    body.innerHTML = rows.length === 0
      ? '<tr><td colspan="6" class="text-muted" style="text-align:center; padding:30px;">No deals in this tab</td></tr>'
      : rows.map(function (d) {
          var actCol = d.activity ? escHtml(d.activity) : escHtml(d.category);
          var actBtns = '';
          if (d.status === 'pending') {
            actBtns += '<button class="btn btn-sm btn-blue" onclick="AdminDeals.approve(\'' + d.id + '\')"><span class="material-icons">check</span>Approve</button>';
            actBtns += '<button class="btn btn-sm btn-danger" onclick="AdminDeals.reject(\'' + d.id + '\')"><span class="material-icons">close</span>Reject</button>';
          } else if (d.status === 'live' || d.status === 'paused') {
            actBtns += '<button class="btn btn-sm btn-ghost" onclick="AdminDeals.feature(\'' + d.id + '\')" title="' + (d.featured ? 'Unfeature' : 'Feature') + '"><span class="material-icons">' + (d.featured ? 'star' : 'star_border') + '</span></button>';
            actBtns += '<button class="btn btn-sm btn-ghost" onclick="AdminDeals.togglePause(\'' + d.id + '\')" title="' + (d.status === 'live' ? 'Pause' : 'Resume') + '"><span class="material-icons">' + (d.status === 'live' ? 'pause' : 'play_arrow') + '</span></button>';
          }
          actBtns += '<button class="btn btn-sm btn-ghost" onclick="AdminDeals.view(\'' + d.id + '\')" title="View"><span class="material-icons">visibility</span></button>';

          return '<tr>' +
            '<td><span class="cell-avatar" style="background:var(--yellow); color:#0a0a0a;">' + escHtml(d.pLetter) + '</span><span class="cell-name">' + escHtml(d.provider) + '</span></td>' +
            '<td>' + escHtml(d.perk) + '</td>' +
            '<td class="text-muted">' + actCol + '</td>' +
            '<td><span class="pill pill-' + d.status + '">' + d.status + '</span></td>' +
            '<td>' + (d.featured ? '<span class="pill pill-featured">Featured</span>' : '') + '</td>' +
            '<td><div class="table-actions">' + actBtns + '</div></td>' +
          '</tr>';
        }).join('');
  }

  async function approve(id) {
    try {
      var res = await window.supabase.from('deals').update({ status: 'live' }).eq('id', id);
      if (res.error) throw res.error;
      toast('Deal approved — now live', 'success');
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Deals] approve:', e);
      toast(e.message || 'Approve failed', 'error');
    }
  }

  async function reject(id) {
    if (!confirm('Reject this deal? It will be archived. Provider can re-submit a corrected version.')) return;
    try {
      var res = await window.supabase.from('deals').update({ status: 'archived' }).eq('id', id);
      if (res.error) throw res.error;
      toast('Deal rejected', 'success');
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Deals] reject:', e);
      toast(e.message || 'Reject failed', 'error');
    }
  }

  async function feature(id) {
    var ad = getAD();
    var d = ad.data.find(function (x) { return x.id === id; });
    if (!d) return;
    var newVal = !d.featured;
    try {
      var res = await window.supabase.from('deals').update({ featured: newVal }).eq('id', id);
      if (res.error) throw res.error;
      toast(newVal ? 'Featured' : 'Unfeatured', 'success');
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Deals] feature:', e);
      toast(e.message || 'Feature toggle failed', 'error');
    }
  }

  async function togglePause(id) {
    var ad = getAD();
    var d = ad.data.find(function (x) { return x.id === id; });
    if (!d) return;
    var newStatus = (d.status === 'live') ? 'paused' : 'live';
    try {
      var res = await window.supabase.from('deals').update({ status: newStatus }).eq('id', id);
      if (res.error) throw res.error;
      toast(newStatus === 'paused' ? 'Deal paused' : 'Deal resumed', 'success');
      await refresh();
    } catch (e) {
      console.error('[FFP Admin Deals] togglePause:', e);
      toast(e.message || 'Status toggle failed', 'error');
    }
  }

  function viewDeal(id) {
    var ad = getAD();
    var d = ad.data.find(function (x) { return x.id === id; });
    if (!d) return;
    var heroHtml = d.hero_url
      ? '<div style="height:160px;background:#0a1825 url(' + escHtml(d.hero_url) + ') center/cover;border-radius:12px;margin-bottom:16px;"></div>'
      : '<div style="height:90px;background:#0a1825;border-radius:12px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;color:#6c7a8b;">No photo</div>';

    var content =
      heroHtml +
      '<h2 style="margin:0 0 4px;color:#e8eef4;font-size:18px;">' + escHtml(d.perk) + '</h2>' +
      '<div style="color:#8a99a8;font-size:13px;margin-bottom:14px;">' + escHtml(d.provider) + ' · ' + escHtml(d.activity || d.category) + (d.offering_type ? ' · ' + escHtml(d.offering_type) : '') + '</div>' +
      (d.description ? '<div style="color:#cfd6dc;font-size:14px;line-height:1.5;margin-bottom:14px;white-space:pre-wrap;">' + escHtml(d.description) + '</div>' : '') +
      (d.valid_when ? '<div style="color:#cfd6dc;font-size:13px;margin-bottom:8px;"><b style="color:#8a99a8;">Valid:</b> ' + escHtml(d.valid_when) + '</div>' : '') +
      (d.booking_method ? '<div style="color:#cfd6dc;font-size:13px;margin-bottom:14px;"><b style="color:#8a99a8;">Booking:</b> <a href="' + escHtml(d.booking_method) + '" target="_blank" style="color:#2ba8e0;">' + escHtml(d.booking_method) + '</a></div>' : '') +
      '<div style="color:#6c7a8b;font-size:12px;">Status: <span class="pill pill-' + d.status + '">' + d.status + '</span></div>';

    var foot = '<button class="btn btn-ghost" onclick="closeAdminModal()">Close</button>';
    if (d.status === 'pending') {
      foot = '<button class="btn btn-danger" onclick="closeAdminModal(); AdminDeals.reject(\'' + d.id + '\')"><span class="material-icons">close</span>Reject</button>' +
             '<button class="btn btn-blue" onclick="closeAdminModal(); AdminDeals.approve(\'' + d.id + '\')"><span class="material-icons">check</span>Approve</button>';
    }
    openAdminModal('Deal preview', content, foot);
  }

  // Lightweight admin modal (independent of dashboard's modal)
  function openAdminModal(title, content, footer) {
    closeAdminModal();
    var overlay = document.createElement('div');
    overlay.id = 'ffp-admin-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,8,20,0.75);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML =
      '<div style="background:#0f1e2e;border:1px solid #1a2f44;border-radius:16px;width:100%;max-width:540px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #1a2f44;">' +
          '<div style="color:#e8eef4;font-size:16px;font-weight:600;">' + escHtml(title) + '</div>' +
          '<button onclick="closeAdminModal()" style="background:transparent;border:none;color:#8a99a8;cursor:pointer;font-size:24px;line-height:1;padding:0 4px;">&times;</button>' +
        '</div>' +
        '<div style="padding:20px;overflow-y:auto;flex:1;">' + content + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #1a2f44;">' + footer + '</div>' +
      '</div>';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeAdminModal();
    });
    document.body.appendChild(overlay);
  }
  window.closeAdminModal = function () {
    var ov = document.getElementById('ffp-admin-modal-overlay');
    if (ov) ov.remove();
  };

  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && typeof AdminDeals !== 'undefined';
    }, 15000);
    if (!ok) { console.error('[FFP Admin Deals] dependencies never loaded'); return; }

    // Wait for admin auth (FFP_ADMIN set by admin auth loader)
    var authed = await waitFor(function () { return !!(window.FFP_ADMIN); }, 30000);
    if (!authed) {
      console.warn('[FFP Admin Deals] FFP_ADMIN not set — admin not authenticated');
      return;
    }

    injectStyles();
    var ad = getAD();
    ad.tab = 'pending';  // default to pending so admin sees approval queue first
    ad.init = function () { refresh(); };
    ad.setTab = function (tab) { ad.tab = tab; realRender(); };
    ad.onSearch = function (q) { ad.search = (q || '').toLowerCase().trim(); realRender(); };
    ad.render = realRender;
    ad.approve = approve;
    ad.reject = reject;
    ad.feature = feature;
    ad.togglePause = togglePause;
    ad.view = viewDeal;
    ad.refresh = refresh;

    try {
      await refresh();
      console.log('[FFP Admin Deals v1] Loaded from Supabase \u2713');
    } catch (e) {
      console.error('[FFP Admin Deals] initial load:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

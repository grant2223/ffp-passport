/* FFP Admin TOURS Loader — v1 (2026-06-12)
   Wires the admin "Tours" panel to real Supabase data (the `classes` table = one-off Tours).
   Mirrors ffp-admin-experiences-loader.js. Tabs: Pending / Live / Paused / Archived (default 'pending').
   Approve → classes.status='live'; Reject → 'archived'. Pushes a pending badge to the sidebar link.
*/
(function () {
  'use strict';

  function getAX() { return (typeof AdminTours !== 'undefined') ? AdminTours : null; }
  function toast(msg, kind) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, kind || 'info'); return; } catch (e) {} }
    console.log('[FFP Admin Tours]', msg);
  }
  async function waitFor(check, ms) {
    var tries = 0, limit = Math.ceil((ms || 15000) / 100);
    while (!check() && tries < limit) { await new Promise(function (r) { setTimeout(r, 100); }); tries++; }
    return check();
  }
  function escHtml(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function letterFor(name) { return (name && name.length) ? name[0].toUpperCase() : '?'; }

  function mapForUi(row) {
    var p = row.providers || {};
    return {
      id: row.id,
      title: row.title || '',
      organizer: p.business_name || 'Unknown',
      pLetter: p.letter_mark || letterFor(p.business_name),
      activity: row.activity || '',
      category: row.category || '',
      city: row.city || '',
      country: row.country || '',
      price_aed: row.price_aed || 0,
      capacity: row.capacity || 0,
      status: row.status || 'pending',
      fitness_level: row.fitness_level || '',
      hero_url: row.hero_image_url || null,
      description: row.description || '',
      _raw: row
    };
  }

  async function fetchTours() {
    var res = await window.supabase
      .from('classes')
      .select('id, title, description, activity, category, hero_image_url, city, country, price_aed, capacity, fitness_level, status, created_at, providers!inner(business_name, letter_mark)')
      .order('created_at', { ascending: false });
    if (res.error) { console.error('[FFP Admin Tours] fetch:', res.error); toast('Could not load tours', 'error'); return []; }
    return (res.data || []).map(mapForUi);
  }

  async function refresh() {
    var ax = getAX(); if (!ax) return;
    ax.data = await fetchTours();
    realRender();
  }

  function tabCounts(data) {
    var c = { pending: 0, live: 0, paused: 0, archived: 0 };
    data.forEach(function (d) { if (c[d.status] != null) c[d.status]++; });
    return c;
  }

  function setNavBadge(panel, n) {
    var link = document.querySelector('.sidebar-link[data-panel="' + panel + '"]');
    if (!link) return;
    var b = link.querySelector('.ffp-pending-badge');
    if (n > 0) {
      if (!b) { b = document.createElement('span'); b.className = 'sidebar-link-badge ffp-pending-badge'; link.appendChild(b); }
      b.textContent = n > 99 ? '99+' : String(n); b.style.display = '';
    } else if (b) { b.style.display = 'none'; }
  }

  function realRender() {
    var ax = getAX(); if (!ax) return;
    var tab = ax.tab || 'pending';
    var rows = (ax.data || []).filter(function (d) { return d.status === tab; });
    if (ax.search) {
      rows = rows.filter(function (d) {
        return d.title.toLowerCase().indexOf(ax.search) >= 0 ||
               d.organizer.toLowerCase().indexOf(ax.search) >= 0 ||
               (d.activity || '').toLowerCase().indexOf(ax.search) >= 0 ||
               (d.city || '').toLowerCase().indexOf(ax.search) >= 0;
      });
    }

    var counts = tabCounts(ax.data || []);
    setNavBadge('panel-tours', counts.pending);
    var tabsHTML =
      '<button class="tab-btn' + (tab === 'pending' ? ' active' : '') + '" data-tab="pending" onclick="AdminTours.setTab(\'pending\')">Pending <span class="count">' + counts.pending + '</span></button>' +
      '<button class="tab-btn' + (tab === 'live' ? ' active' : '') + '" data-tab="live" onclick="AdminTours.setTab(\'live\')">Live <span class="count">' + counts.live + '</span></button>' +
      '<button class="tab-btn' + (tab === 'paused' ? ' active' : '') + '" data-tab="paused" onclick="AdminTours.setTab(\'paused\')">Paused <span class="count">' + counts.paused + '</span></button>' +
      '<button class="tab-btn' + (tab === 'archived' ? ' active' : '') + '" data-tab="archived" onclick="AdminTours.setTab(\'archived\')">Archived <span class="count">' + counts.archived + '</span></button>';

    var tabsEl = document.querySelector('#panel-tours .tabs');
    if (!tabsEl) {
      var searchRow = document.querySelector('#panel-tours .search-row');
      if (searchRow) {
        var tabsDiv = document.createElement('div'); tabsDiv.className = 'tabs';
        searchRow.parentNode.insertBefore(tabsDiv, searchRow.nextSibling);
        tabsEl = tabsDiv;
      }
    }
    if (tabsEl) tabsEl.innerHTML = tabsHTML;

    var metaEl = document.getElementById('AdminTours-meta');
    if (metaEl) metaEl.textContent = rows.length + ' item' + (rows.length === 1 ? '' : 's');

    var body = document.getElementById('tours-tbody');
    if (!body) return;
    body.innerHTML = rows.length === 0
      ? '<tr><td colspan="5" class="text-muted" style="text-align:center; padding:30px;">No experiences in this tab</td></tr>'
      : rows.map(function (d) {
          var actBtns = '';
          if (d.status === 'pending') {
            actBtns += '<button class="btn btn-sm btn-blue" onclick="AdminTours.approve(\'' + d.id + '\')"><span class="material-icons">check</span>Approve</button>';
            actBtns += '<button class="btn btn-sm btn-danger" onclick="AdminTours.reject(\'' + d.id + '\')"><span class="material-icons">close</span>Reject</button>';
          }
          actBtns += '<button class="btn btn-sm btn-ghost" onclick="AdminTours.view(\'' + d.id + '\')" title="View"><span class="material-icons">visibility</span></button>';
          return '<tr>' +
            '<td><strong>' + escHtml(d.title) + '</strong></td>' +
            '<td>' + (d.activity ? '<span class="pill pill-verified">' + escHtml(d.activity) + '</span>' : '<span class="text-muted">—</span>') + '</td>' +
            '<td class="text-muted">' + escHtml(d.organizer) + '</td>' +
            '<td class="text-muted nowrap">' + escHtml(d.city || '—') + '</td>' +
            '<td><div class="table-actions">' + actBtns + '</div></td>' +
          '</tr>';
        }).join('');
  }

  async function approve(id) {
    try {
      var res = await window.supabase.from('classes').update({ status: 'live' }).eq('id', id);
      if (res.error) throw res.error;
      toast('Experience approved — now live', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Approve failed', 'error'); }
  }
  async function reject(id) {
    if (!confirm('Reject this experience? It will be archived.')) return;
    try {
      var res = await window.supabase.from('classes').update({ status: 'archived' }).eq('id', id);
      if (res.error) throw res.error;
      toast('Experience rejected', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Reject failed', 'error'); }
  }

  function viewTour(id) {
    var ax = getAX();
    var d = (ax.data || []).find(function (x) { return x.id === id; });
    if (!d) return;
    var heroHtml = d.hero_url
      ? '<div style="height:160px;background:#0a1825 url(' + escHtml(d.hero_url) + ') center/cover;border-radius:12px;margin-bottom:16px;"></div>'
      : '<div style="height:90px;background:#0a1825;border-radius:12px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;color:#6c7a8b;">No photo</div>';
    var content =
      heroHtml +
      '<h2 style="margin:0 0 4px;color:#e8eef4;font-size:18px;">' + escHtml(d.title) + '</h2>' +
      '<div style="color:#8a99a8;font-size:13px;margin-bottom:14px;">' + escHtml(d.organizer) + ' · ' + escHtml(d.activity || d.category) + (d.fitness_level ? ' · ' + escHtml(d.fitness_level) : '') + '</div>' +
      '<div style="color:#cfd6dc;font-size:13px;margin-bottom:8px;"><b style="color:#8a99a8;">Where:</b> ' + escHtml((d.city ? d.city + ', ' : '') + d.country) + '</div>' +
      '<div style="color:#cfd6dc;font-size:13px;margin-bottom:14px;"><b style="color:#8a99a8;">Price:</b> AED ' + d.price_aed + ' · <b style="color:#8a99a8;">Capacity:</b> ' + d.capacity + '</div>' +
      (d.description ? '<div style="color:#cfd6dc;font-size:14px;line-height:1.5;margin-bottom:10px;white-space:pre-wrap;">' + escHtml(d.description) + '</div>' : '') +
      '<div style="color:#6c7a8b;font-size:12px;">Status: <span class="pill pill-' + d.status + '">' + d.status + '</span></div>';
    var foot = '<button class="btn btn-ghost" onclick="closeAdminModal()">Close</button>';
    if (d.status === 'pending') {
      foot = '<button class="btn btn-danger" onclick="closeAdminModal(); AdminTours.reject(\'' + d.id + '\')"><span class="material-icons">close</span>Reject</button>' +
             '<button class="btn btn-blue" onclick="closeAdminModal(); AdminTours.approve(\'' + d.id + '\')"><span class="material-icons">check</span>Approve</button>';
    }
    if (typeof window.openAdminModal === 'function') window.openAdminModal('Experience preview', content, foot);
  }

  async function init() {
    var ok = await waitFor(function () { return window.supabase && typeof AdminTours !== 'undefined'; }, 15000);
    if (!ok) { console.error('[FFP Admin Tours] deps never loaded'); return; }
    var authed = await waitFor(function () { return !!(window.FFP_ADMIN); }, 30000);
    if (!authed) { console.warn('[FFP Admin Tours] FFP_ADMIN not set'); return; }

    var ax = getAX();
    ax.tab = 'pending';
    ax.init = function () { refresh(); };
    ax.setTab = function (tab) { ax.tab = tab; realRender(); };
    ax.onSearch = function (q) { ax.search = (q || '').toLowerCase().trim(); realRender(); };
    ax.render = realRender;
    ax.approve = approve;
    ax.reject = reject;
    ax.view = viewTour;
    ax.refresh = refresh;
    refresh();
    if (window.FFPRealtime) window.FFPRealtime.subscribe('admin-tours', 'classes', null, function () { refresh(); });
    console.log('[FFP Admin Tours v1] Loaded ✓');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

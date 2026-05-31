/* FFP Admin Experiences Loader — v3 — sidebar pending badge + realtime
   Wires admin Experiences panel to real Supabase data.
   Tabs: Pending / Live / Past / Closed / Archived (injected — panel had none)
   Default tab = 'pending'.
*/
(function () {
  'use strict';

  function getAX() { return (typeof AdminExperiences !== 'undefined') ? AdminExperiences : null; }
  function toast(msg, kind) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, kind || 'info'); return; } catch (e) {} }
    console.log('[FFP Admin Experiences]', msg);
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
  function letterFor(name) { return (name && name.length) ? name[0].toUpperCase() : '?'; }

  function fmtDateRange(start, end) {
    if (!start || !end) return '—';
    var s = new Date(start), e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    if (sameMonth) return s.getDate() + '–' + e.getDate() + ' ' + months[e.getMonth()];
    return s.getDate() + ' ' + months[s.getMonth()] + '–' + e.getDate() + ' ' + months[e.getMonth()];
  }

  function mapForUi(row) {
    var p = row.providers || {};
    return {
      id: row.id,
      title: row.title || '',
      type: row.exp_type || '',
      organizer: p.business_name || 'Unknown',
      pLetter: p.letter_mark || letterFor(p.business_name),
      activity: row.activity || '',
      category: row.category || '',
      country: row.country || '',
      destination: row.destination || '',
      dates: fmtDateRange(row.starts_at, row.ends_at),
      starts_at: row.starts_at || '',
      ends_at: row.ends_at || '',
      duration_days: row.duration_days || 0,
      price_aed: row.price_aed || 0,
      capacity: row.capacity || 0,
      apps: 0,
      status: row.status || 'pending',
      featured: !!row.featured,
      fitness_level: row.fitness_level || '',
      hero_url: row.hero_image_url || null,
      description: row.description || '',
      overview: row.overview || '',
      _raw: row
    };
  }

  async function fetchExperiences() {
    var res = await window.supabase
      .from('experiences')
      .select('id, title, description, overview, activity, category, exp_type, hero_image_url, country, destination, starts_at, ends_at, duration_days, price_aed, capacity, fitness_level, status, featured, created_at, providers!inner(business_name, letter_mark)')
      .order('starts_at', { ascending: false });
    if (res.error) {
      console.error('[FFP Admin Experiences] fetch:', res.error);
      toast('Could not load experiences', 'error');
      return [];
    }
    return (res.data || []).map(mapForUi);
  }

  async function refresh() {
    var ax = getAX();
    if (!ax) return;
    ax.data = await fetchExperiences();
    realRender();
  }

  function tabCounts(data) {
    var c = { pending: 0, live: 0, past: 0, closed: 0, archived: 0 };
    data.forEach(function (d) { if (c[d.status] != null) c[d.status]++; });
    return c;
  }

  // v2: push the pending count to the sidebar link badge — same pattern as
  // the applications loader (#badge-applications). Updates live on every render
  // (load + tab change + after approve/reject), so admin is notified of pending items.
  function setNavBadge(panel, n) {
    var link = document.querySelector('.sidebar-link[data-panel="' + panel + '"]');
    if (!link) return;
    var b = link.querySelector('.ffp-pending-badge');
    if (n > 0) {
      if (!b) { b = document.createElement('span'); b.className = 'sidebar-link-badge ffp-pending-badge'; link.appendChild(b); }
      b.textContent = n > 99 ? '99+' : String(n);
      b.style.display = '';
    } else if (b) { b.style.display = 'none'; }
  }

  function realRender() {
    var ax = getAX();
    if (!ax) return;
    var tab = ax.tab || 'pending';
    var rows = (ax.data || []).filter(function (d) { return d.status === tab; });
    if (ax.search) {
      rows = rows.filter(function (d) {
        return d.title.toLowerCase().indexOf(ax.search) >= 0 ||
               d.organizer.toLowerCase().indexOf(ax.search) >= 0 ||
               (d.activity || '').toLowerCase().indexOf(ax.search) >= 0 ||
               (d.country || '').toLowerCase().indexOf(ax.search) >= 0;
      });
    }

    var counts = tabCounts(ax.data || []);
    setNavBadge('panel-experiences', counts.pending);
    var tabsHTML =
      '<button class="tab-btn' + (tab === 'pending' ? ' active' : '') + '" data-tab="pending" onclick="AdminExperiences.setTab(\'pending\')">Pending <span class="count">' + counts.pending + '</span></button>' +
      '<button class="tab-btn' + (tab === 'live' ? ' active' : '') + '" data-tab="live" onclick="AdminExperiences.setTab(\'live\')">Live <span class="count">' + counts.live + '</span></button>' +
      '<button class="tab-btn' + (tab === 'past' ? ' active' : '') + '" data-tab="past" onclick="AdminExperiences.setTab(\'past\')">Past <span class="count">' + counts.past + '</span></button>' +
      '<button class="tab-btn' + (tab === 'closed' ? ' active' : '') + '" data-tab="closed" onclick="AdminExperiences.setTab(\'closed\')">Closed <span class="count">' + counts.closed + '</span></button>' +
      '<button class="tab-btn' + (tab === 'archived' ? ' active' : '') + '" data-tab="archived" onclick="AdminExperiences.setTab(\'archived\')">Archived <span class="count">' + counts.archived + '</span></button>';

    // Inject tabs if not present
    var tabsEl = document.querySelector('#panel-experiences .tabs');
    if (!tabsEl) {
      var searchRow = document.querySelector('#panel-experiences .search-row');
      if (searchRow) {
        var tabsDiv = document.createElement('div');
        tabsDiv.className = 'tabs';
        searchRow.parentNode.insertBefore(tabsDiv, searchRow.nextSibling);
        tabsEl = tabsDiv;
      }
    }
    if (tabsEl) tabsEl.innerHTML = tabsHTML;

    var metaEl = document.getElementById('AdminExperiences-meta');
    if (metaEl) metaEl.textContent = rows.length + ' item' + (rows.length === 1 ? '' : 's');

    var body = document.getElementById('experiences-tbody');
    if (!body) return;
    body.innerHTML = rows.length === 0
      ? '<tr><td colspan="6" class="text-muted" style="text-align:center; padding:30px;">No experiences in this tab</td></tr>'
      : rows.map(function (d) {
          var actBtns = '';
          if (d.status === 'pending') {
            actBtns += '<button class="btn btn-sm btn-blue" onclick="AdminExperiences.approve(\'' + d.id + '\')"><span class="material-icons">check</span>Approve</button>';
            actBtns += '<button class="btn btn-sm btn-danger" onclick="AdminExperiences.reject(\'' + d.id + '\')"><span class="material-icons">close</span>Reject</button>';
          } else if (d.status === 'live') {
            actBtns += '<button class="btn btn-sm btn-ghost" onclick="AdminExperiences.feature(\'' + d.id + '\')" title="' + (d.featured ? 'Unfeature' : 'Feature') + '"><span class="material-icons">' + (d.featured ? 'star' : 'star_border') + '</span></button>';
          }
          actBtns += '<button class="btn btn-sm btn-ghost" onclick="AdminExperiences.view(\'' + d.id + '\')" title="View"><span class="material-icons">visibility</span></button>';

          return '<tr>' +
            '<td><strong>' + escHtml(d.title) + '</strong>' + (d.featured ? ' <span class="pill pill-featured">Featured</span>' : '') + '</td>' +
            '<td>' + (d.type ? '<span class="pill pill-verified">' + escHtml(d.type) + '</span>' : '<span class="text-muted">—</span>') + '</td>' +
            '<td class="text-muted">' + escHtml(d.organizer) + '</td>' +
            '<td class="text-muted nowrap">' + escHtml(d.dates) + '</td>' +
            '<td class="f-tabular"><strong class="text-yellow">' + d.apps + '</strong>/' + d.capacity + '</td>' +
            '<td><div class="table-actions">' + actBtns + '</div></td>' +
          '</tr>';
        }).join('');
  }

  async function approve(id) {
    try {
      var res = await window.supabase.from('experiences').update({ status: 'live' }).eq('id', id);
      if (res.error) throw res.error;
      toast('Experience approved — now live', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Approve failed', 'error'); }
  }
  async function reject(id) {
    if (!confirm('Reject this experience? It will be archived.')) return;
    try {
      var res = await window.supabase.from('experiences').update({ status: 'archived' }).eq('id', id);
      if (res.error) throw res.error;
      toast('Experience rejected', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Reject failed', 'error'); }
  }
  async function feature(id) {
    var ax = getAX();
    var d = ax.data.find(function (x) { return x.id === id; });
    if (!d) return;
    var newVal = !d.featured;
    try {
      var res = await window.supabase.from('experiences').update({ featured: newVal }).eq('id', id);
      if (res.error) throw res.error;
      toast(newVal ? 'Featured' : 'Unfeatured', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Feature toggle failed', 'error'); }
  }

  function viewExperience(id) {
    var ax = getAX();
    var d = ax.data.find(function (x) { return x.id === id; });
    if (!d) return;
    var heroHtml = d.hero_url
      ? '<div style="height:160px;background:#0a1825 url(' + escHtml(d.hero_url) + ') center/cover;border-radius:12px;margin-bottom:16px;"></div>'
      : '<div style="height:90px;background:#0a1825;border-radius:12px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;color:#6c7a8b;">No photo</div>';

    var content =
      heroHtml +
      '<h2 style="margin:0 0 4px;color:#e8eef4;font-size:18px;">' + escHtml(d.title) + '</h2>' +
      '<div style="color:#8a99a8;font-size:13px;margin-bottom:14px;">' + escHtml(d.organizer) + ' · ' + escHtml(d.activity || d.category) + (d.type ? ' · ' + escHtml(d.type) : '') + (d.fitness_level ? ' · ' + escHtml(d.fitness_level) : '') + '</div>' +
      '<div style="color:#cfd6dc;font-size:13px;margin-bottom:8px;"><b style="color:#8a99a8;">When:</b> ' + escHtml(d.dates) + ' (' + d.duration_days + ' day' + (d.duration_days !== 1 ? 's' : '') + ')</div>' +
      '<div style="color:#cfd6dc;font-size:13px;margin-bottom:8px;"><b style="color:#8a99a8;">Where:</b> ' + escHtml((d.destination ? d.destination + ', ' : '') + d.country) + '</div>' +
      '<div style="color:#cfd6dc;font-size:13px;margin-bottom:14px;"><b style="color:#8a99a8;">Price:</b> AED ' + d.price_aed + ' · <b style="color:#8a99a8;">Capacity:</b> ' + d.capacity + '</div>' +
      (d.description ? '<div style="color:#cfd6dc;font-size:14px;line-height:1.5;margin-bottom:10px;white-space:pre-wrap;">' + escHtml(d.description) + '</div>' : '') +
      (d.overview ? '<div style="color:#cfd6dc;font-size:13px;line-height:1.5;margin-bottom:14px;white-space:pre-wrap;"><b style="color:#8a99a8;">Overview:</b><br>' + escHtml(d.overview) + '</div>' : '') +
      '<div style="color:#6c7a8b;font-size:12px;">Status: <span class="pill pill-' + d.status + '">' + d.status + '</span></div>';

    var foot = '<button class="btn btn-ghost" onclick="closeAdminModal()">Close</button>';
    if (d.status === 'pending') {
      foot = '<button class="btn btn-danger" onclick="closeAdminModal(); AdminExperiences.reject(\'' + d.id + '\')"><span class="material-icons">close</span>Reject</button>' +
             '<button class="btn btn-blue" onclick="closeAdminModal(); AdminExperiences.approve(\'' + d.id + '\')"><span class="material-icons">check</span>Approve</button>';
    }
    if (typeof window.openAdminModal === 'function') {
      window.openAdminModal('Experience preview', content, foot);
    } else { _openAdminModal('Experience preview', content, foot); }
  }

  function _openAdminModal(title, content, footer) {
    if (typeof window.closeAdminModal === 'function') window.closeAdminModal();
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
    overlay.addEventListener('click', function (e) { if (e.target === overlay) window.closeAdminModal(); });
    document.body.appendChild(overlay);
    window.closeAdminModal = function () {
      var ov = document.getElementById('ffp-admin-modal-overlay');
      if (ov) ov.remove();
    };
  }

  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && typeof AdminExperiences !== 'undefined';
    }, 15000);
    if (!ok) { console.error('[FFP Admin Experiences] deps never loaded'); return; }
    var authed = await waitFor(function () { return !!(window.FFP_ADMIN); }, 30000);
    if (!authed) { console.warn('[FFP Admin Experiences] FFP_ADMIN not set'); return; }

    var ax = getAX();
    ax.tab = 'pending';
    ax.init = function () { refresh(); };
    ax.setTab = function (tab) { ax.tab = tab; realRender(); };
    ax.onSearch = function (q) { ax.search = (q || '').toLowerCase().trim(); realRender(); };
    ax.render = realRender;
    ax.approve = approve;
    ax.reject = reject;
    ax.feature = feature;
    ax.view = viewExperience;
    ax.refresh = refresh;
    if (window.FFPRealtime) window.FFPRealtime.subscribe('admin-experiences', 'experiences', null, function () { refresh(); });

    try {
      console.log('[FFP Admin Experiences v1] Loaded \u2713');
    } catch (e) { console.error('[FFP Admin Experiences] init load:', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();

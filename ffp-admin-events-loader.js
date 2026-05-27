/* FFP Admin Events Loader — v1
   Wires admin Events panel to real Supabase data.
   Tabs: Pending / Live / Past / Cancelled / Archived (replaces upcoming/past/cancelled)
   Default tab = 'pending' so admin sees approval queue first.
*/
(function () {
  'use strict';

  function getAE() { return (typeof AdminEvents !== 'undefined') ? AdminEvents : null; }
  function toast(msg, kind) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, kind || 'info'); return; } catch (e) {} }
    console.log('[FFP Admin Events]', msg);
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
  function letterFor(name) {
    return (name && name.length) ? name[0].toUpperCase() : '?';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
  }

  function mapForUi(row) {
    var p = row.providers || {};
    return {
      id: row.id,
      title: row.title || '',
      organizer: p.business_name || 'Unknown',
      pLetter: p.letter_mark || letterFor(p.business_name),
      activity: row.activity || '',
      category: row.category || '',
      starts_at: row.starts_at || '',
      date: fmtDate(row.starts_at),
      city: row.city || '',
      venue: row.venue || '',
      capacity: row.capacity || 0,
      rsvps: 0,
      status: row.status || 'pending',
      featured: !!row.featured,
      fitness_level: row.fitness_level || '',
      group_filter: row.group_filter || '',
      hero_url: row.hero_image_url || null,
      description: row.description || '',
      about: row.about || '',
      _raw: row
    };
  }

  async function fetchEvents() {
    var res = await window.supabase
      .from('events')
      .select('id, title, description, about, activity, category, hero_image_url, city, venue, starts_at, ends_at, capacity, fitness_level, group_filter, status, featured, created_at, providers!inner(business_name, letter_mark)')
      .order('starts_at', { ascending: false });
    if (res.error) {
      console.error('[FFP Admin Events] fetch:', res.error);
      toast('Could not load events', 'error');
      return [];
    }
    return (res.data || []).map(mapForUi);
  }

  async function refresh() {
    var ae = getAE();
    if (!ae) return;
    ae.data = await fetchEvents();
    realRender();
  }

  function tabCounts(data) {
    var c = { pending: 0, live: 0, past: 0, cancelled: 0, archived: 0 };
    data.forEach(function (d) { if (c[d.status] != null) c[d.status]++; });
    return c;
  }

  function realRender() {
    var ae = getAE();
    if (!ae) return;
    var tab = ae.tab || 'pending';
    var rows = (ae.data || []).filter(function (d) { return d.status === tab; });
    if (ae.search) {
      rows = rows.filter(function (d) {
        return d.title.toLowerCase().indexOf(ae.search) >= 0 ||
               d.organizer.toLowerCase().indexOf(ae.search) >= 0 ||
               (d.activity || '').toLowerCase().indexOf(ae.search) >= 0;
      });
    }

    var counts = tabCounts(ae.data || []);
    var tabsHTML =
      '<button class="tab-btn' + (tab === 'pending' ? ' active' : '') + '" data-tab="pending" onclick="AdminEvents.setTab(\'pending\')">Pending <span class="count">' + counts.pending + '</span></button>' +
      '<button class="tab-btn' + (tab === 'live' ? ' active' : '') + '" data-tab="live" onclick="AdminEvents.setTab(\'live\')">Live <span class="count">' + counts.live + '</span></button>' +
      '<button class="tab-btn' + (tab === 'past' ? ' active' : '') + '" data-tab="past" onclick="AdminEvents.setTab(\'past\')">Past <span class="count">' + counts.past + '</span></button>' +
      '<button class="tab-btn' + (tab === 'cancelled' ? ' active' : '') + '" data-tab="cancelled" onclick="AdminEvents.setTab(\'cancelled\')">Cancelled <span class="count">' + counts.cancelled + '</span></button>' +
      '<button class="tab-btn' + (tab === 'archived' ? ' active' : '') + '" data-tab="archived" onclick="AdminEvents.setTab(\'archived\')">Archived <span class="count">' + counts.archived + '</span></button>';

    var tabsEl = document.querySelector('#panel-events .tabs');
    if (!tabsEl) {
      // Inject tabs after search-row
      var searchRow = document.querySelector('#panel-events .search-row');
      if (searchRow) {
        var tabsDiv = document.createElement('div');
        tabsDiv.className = 'tabs';
        searchRow.parentNode.insertBefore(tabsDiv, searchRow.nextSibling);
        tabsEl = tabsDiv;
      }
    }
    if (tabsEl) tabsEl.innerHTML = tabsHTML;

    var metaEl = document.getElementById('AdminEvents-meta');
    if (metaEl) metaEl.textContent = rows.length + ' item' + (rows.length === 1 ? '' : 's');

    var body = document.getElementById('events-tbody');
    if (!body) return;
    body.innerHTML = rows.length === 0
      ? '<tr><td colspan="5" class="text-muted" style="text-align:center; padding:30px;">No events in this tab</td></tr>'
      : rows.map(function (e) {
          var actBtns = '';
          if (e.status === 'pending') {
            actBtns += '<button class="btn btn-sm btn-blue" onclick="AdminEvents.approve(\'' + e.id + '\')"><span class="material-icons">check</span>Approve</button>';
            actBtns += '<button class="btn btn-sm btn-danger" onclick="AdminEvents.reject(\'' + e.id + '\')"><span class="material-icons">close</span>Reject</button>';
          } else if (e.status === 'live') {
            actBtns += '<button class="btn btn-sm btn-ghost" onclick="AdminEvents.feature(\'' + e.id + '\')" title="' + (e.featured ? 'Unfeature' : 'Feature') + '"><span class="material-icons">' + (e.featured ? 'star' : 'star_border') + '</span></button>';
            actBtns += '<button class="btn btn-sm btn-danger" onclick="AdminEvents.cancel(\'' + e.id + '\')" title="Cancel"><span class="material-icons">close</span></button>';
          }
          actBtns += '<button class="btn btn-sm btn-ghost" onclick="AdminEvents.view(\'' + e.id + '\')" title="View"><span class="material-icons">visibility</span></button>';

          return '<tr>' +
            '<td><strong>' + escHtml(e.title) + '</strong>' + (e.featured ? ' <span class="pill pill-featured">Featured</span>' : '') + '</td>' +
            '<td class="text-muted">' + escHtml(e.organizer) + '</td>' +
            '<td class="text-muted nowrap">' + escHtml(e.date) + '</td>' +
            '<td class="f-tabular"><strong class="text-yellow">' + e.rsvps + '</strong>/' + e.capacity + '</td>' +
            '<td><div class="table-actions">' + actBtns + '</div></td>' +
          '</tr>';
        }).join('');
  }

  async function approve(id) {
    try {
      var res = await window.supabase.from('events').update({ status: 'live' }).eq('id', id);
      if (res.error) throw res.error;
      toast('Event approved — now live', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Approve failed', 'error'); }
  }
  async function reject(id) {
    if (!confirm('Reject this event? It will be archived. Provider can re-submit.')) return;
    try {
      var res = await window.supabase.from('events').update({ status: 'archived' }).eq('id', id);
      if (res.error) throw res.error;
      toast('Event rejected', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Reject failed', 'error'); }
  }
  async function cancelEvent(id) {
    if (!confirm('Cancel this live event? RSVP\'d members will be notified.')) return;
    try {
      var res = await window.supabase.from('events').update({ status: 'cancelled' }).eq('id', id);
      if (res.error) throw res.error;
      toast('Event cancelled', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Cancel failed', 'error'); }
  }
  async function feature(id) {
    var ae = getAE();
    var d = ae.data.find(function (x) { return x.id === id; });
    if (!d) return;
    var newVal = !d.featured;
    try {
      var res = await window.supabase.from('events').update({ featured: newVal }).eq('id', id);
      if (res.error) throw res.error;
      toast(newVal ? 'Featured' : 'Unfeatured', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Feature toggle failed', 'error'); }
  }

  function viewEvent(id) {
    var ae = getAE();
    var d = ae.data.find(function (x) { return x.id === id; });
    if (!d) return;
    var heroHtml = d.hero_url
      ? '<div style="height:160px;background:#0a1825 url(' + escHtml(d.hero_url) + ') center/cover;border-radius:12px;margin-bottom:16px;"></div>'
      : '<div style="height:90px;background:#0a1825;border-radius:12px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;color:#6c7a8b;">No photo</div>';

    var when = '—';
    if (d.starts_at) {
      var dt = new Date(d.starts_at);
      if (!isNaN(dt.getTime())) when = dt.toLocaleString();
    }

    var content =
      heroHtml +
      '<h2 style="margin:0 0 4px;color:#e8eef4;font-size:18px;">' + escHtml(d.title) + '</h2>' +
      '<div style="color:#8a99a8;font-size:13px;margin-bottom:14px;">' + escHtml(d.organizer) + ' · ' + escHtml(d.activity || d.category) + (d.fitness_level ? ' · ' + escHtml(d.fitness_level) : '') + '</div>' +
      '<div style="color:#cfd6dc;font-size:13px;margin-bottom:8px;"><b style="color:#8a99a8;">When:</b> ' + escHtml(when) + '</div>' +
      '<div style="color:#cfd6dc;font-size:13px;margin-bottom:14px;"><b style="color:#8a99a8;">Where:</b> ' + escHtml((d.venue ? d.venue + ', ' : '') + d.city) + '</div>' +
      (d.description ? '<div style="color:#cfd6dc;font-size:14px;line-height:1.5;margin-bottom:14px;white-space:pre-wrap;">' + escHtml(d.description) + '</div>' : '') +
      (d.about ? '<div style="color:#cfd6dc;font-size:13px;line-height:1.5;margin-bottom:14px;white-space:pre-wrap;"><b style="color:#8a99a8;">About:</b> ' + escHtml(d.about) + '</div>' : '') +
      '<div style="color:#cfd6dc;font-size:13px;margin-bottom:8px;"><b style="color:#8a99a8;">Capacity:</b> ' + d.capacity + '</div>' +
      '<div style="color:#6c7a8b;font-size:12px;">Status: <span class="pill pill-' + d.status + '">' + d.status + '</span></div>';

    var foot = '<button class="btn btn-ghost" onclick="closeAdminModal()">Close</button>';
    if (d.status === 'pending') {
      foot = '<button class="btn btn-danger" onclick="closeAdminModal(); AdminEvents.reject(\'' + d.id + '\')"><span class="material-icons">close</span>Reject</button>' +
             '<button class="btn btn-blue" onclick="closeAdminModal(); AdminEvents.approve(\'' + d.id + '\')"><span class="material-icons">check</span>Approve</button>';
    }
    if (typeof window.openAdminModal === 'function') {
      window.openAdminModal('Event preview', content, foot);
    } else {
      _openAdminModal('Event preview', content, foot);
    }
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
      return window.supabase && typeof AdminEvents !== 'undefined';
    }, 15000);
    if (!ok) { console.error('[FFP Admin Events] dependencies never loaded'); return; }
    var authed = await waitFor(function () { return !!(window.FFP_ADMIN); }, 30000);
    if (!authed) { console.warn('[FFP Admin Events] FFP_ADMIN not set'); return; }

    var ae = getAE();
    ae.tab = 'pending';
    ae.init = function () { refresh(); };
    ae.setTab = function (tab) { ae.tab = tab; realRender(); };
    ae.onSearch = function (q) { ae.search = (q || '').toLowerCase().trim(); realRender(); };
    ae.render = realRender;
    ae.approve = approve;
    ae.reject = reject;
    ae.cancel = cancelEvent;
    ae.feature = feature;
    ae.view = viewEvent;
    ae.refresh = refresh;

    try {
      await refresh();
      console.log('[FFP Admin Events v1] Loaded from Supabase \u2713');
    } catch (e) {
      console.error('[FFP Admin Events] initial load:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

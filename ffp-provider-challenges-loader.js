/* FFP Admin Challenges Loader — v2 — sidebar pending badge
   Wires admin Challenges panel to real Supabase data.
   Tabs: Pending / Live / Past / Archived (replaces ffp/provider/member kind filter)
   Default tab = 'pending'.
   Both provider AND member-hosted challenges show in same queue with a Kind column.
*/
(function () {
  'use strict';

  function getAC() { return (typeof AdminChallenges !== 'undefined') ? AdminChallenges : null; }
  function toast(msg, kind) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg, kind || 'info'); return; } catch (e) {} }
    console.log('[FFP Admin Challenges]', msg);
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

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()];
  }

  function mapForUi(row) {
    var p = row.providers || {};
    return {
      id: row.id,
      title: row.title || '',
      kind: row.challenge_type || 'provider',
      organizer: p.business_name || (row.challenge_type === 'member' ? 'Member' : 'Unknown'),
      activity: row.activity || '',
      category: row.category || '',
      metric: row.metric || '',
      venue: row.venue || '',
      ends: fmtDate(row.ends_at),
      starts_at: row.starts_at || '',
      ends_at: row.ends_at || '',
      prize: row.prize_description || '',
      participants: 0,
      status: row.status || 'pending',
      featured: !!row.featured,
      hero_url: row.hero_image_url || null,
      description: row.description || '',
      _raw: row
    };
  }

  async function fetchChallenges() {
    var res = await window.supabase
      .from('challenges')
      .select('id, title, description, activity, category, challenge_type, hero_image_url, metric, venue, city, starts_at, ends_at, prize_description, verification, status, featured, created_at, providers(business_name, letter_mark)')
      .order('created_at', { ascending: false });
    if (res.error) {
      console.error('[FFP Admin Challenges] fetch:', res.error);
      toast('Could not load challenges', 'error');
      return [];
    }
    return (res.data || []).map(mapForUi);
  }

  async function refresh() {
    var ac = getAC();
    if (!ac) return;
    ac.data = await fetchChallenges();
    realRender();
  }

  function tabCounts(data) {
    var c = { pending: 0, live: 0, past: 0, archived: 0 };
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
    var ac = getAC();
    if (!ac) return;
    var tab = ac.tab || 'pending';
    var rows = (ac.data || []).filter(function (d) { return d.status === tab; });
    if (ac.search) {
      rows = rows.filter(function (d) {
        return d.title.toLowerCase().indexOf(ac.search) >= 0 ||
               d.organizer.toLowerCase().indexOf(ac.search) >= 0 ||
               (d.activity || '').toLowerCase().indexOf(ac.search) >= 0;
      });
    }

    var counts = tabCounts(ac.data || []);
    setNavBadge('panel-challenges', counts.pending);
    var tabsHTML =
      '<button class="tab-btn' + (tab === 'pending' ? ' active' : '') + '" data-tab="pending" onclick="AdminChallenges.setTab(\'pending\')">Pending <span class="count">' + counts.pending + '</span></button>' +
      '<button class="tab-btn' + (tab === 'live' ? ' active' : '') + '" data-tab="live" onclick="AdminChallenges.setTab(\'live\')">Live <span class="count">' + counts.live + '</span></button>' +
      '<button class="tab-btn' + (tab === 'past' ? ' active' : '') + '" data-tab="past" onclick="AdminChallenges.setTab(\'past\')">Past <span class="count">' + counts.past + '</span></button>' +
      '<button class="tab-btn' + (tab === 'archived' ? ' active' : '') + '" data-tab="archived" onclick="AdminChallenges.setTab(\'archived\')">Archived <span class="count">' + counts.archived + '</span></button>';

    var tabsEl = document.querySelector('#panel-challenges .tabs');
    if (tabsEl) tabsEl.innerHTML = tabsHTML;

    var metaEl = document.getElementById('AdminChallenges-meta');
    if (metaEl) metaEl.textContent = rows.length + ' item' + (rows.length === 1 ? '' : 's');

    var body = document.getElementById('challenges-tbody');
    if (!body) return;
    body.innerHTML = rows.length === 0
      ? '<tr><td colspan="6" class="text-muted" style="text-align:center; padding:30px;">No challenges in this tab</td></tr>'
      : rows.map(function (d) {
          var actBtns = '';
          if (d.status === 'pending') {
            actBtns += '<button class="btn btn-sm btn-blue" onclick="AdminChallenges.approve(\'' + d.id + '\')"><span class="material-icons">check</span>Approve</button>';
            actBtns += '<button class="btn btn-sm btn-danger" onclick="AdminChallenges.reject(\'' + d.id + '\')"><span class="material-icons">close</span>Reject</button>';
          } else if (d.status === 'live') {
            actBtns += '<button class="btn btn-sm btn-ghost" onclick="AdminChallenges.feature(\'' + d.id + '\')" title="' + (d.featured ? 'Unfeature' : 'Feature') + '"><span class="material-icons">' + (d.featured ? 'star' : 'star_border') + '</span></button>';
          }
          actBtns += '<button class="btn btn-sm btn-ghost" onclick="AdminChallenges.view(\'' + d.id + '\')" title="View"><span class="material-icons">visibility</span></button>';

          var kindPill = d.kind === 'member'
            ? '<span class="pill pill-supporter">Member</span>'
            : '<span class="pill pill-verified">Provider</span>';

          return '<tr>' +
            '<td><strong>' + escHtml(d.title) + '</strong>' + (d.featured ? ' <span class="pill pill-featured">Featured</span>' : '') + '</td>' +
            '<td>' + kindPill + '</td>' +
            '<td class="text-muted">' + escHtml(d.activity || d.category) + '</td>' +
            '<td class="text-muted">' + escHtml(d.organizer) + '</td>' +
            '<td class="text-muted nowrap">' + escHtml(d.ends) + '</td>' +
            '<td><div class="table-actions">' + actBtns + '</div></td>' +
          '</tr>';
        }).join('');
  }

  async function approve(id) {
    try {
      var res = await window.supabase.from('challenges').update({ status: 'live' }).eq('id', id);
      if (res.error) throw res.error;
      toast('Challenge approved — now live', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Approve failed', 'error'); }
  }
  async function reject(id) {
    if (!confirm('Reject this challenge? It will be archived.')) return;
    try {
      var res = await window.supabase.from('challenges').update({ status: 'archived' }).eq('id', id);
      if (res.error) throw res.error;
      toast('Challenge rejected', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Reject failed', 'error'); }
  }
  async function feature(id) {
    var ac = getAC();
    var d = ac.data.find(function (x) { return x.id === id; });
    if (!d) return;
    var newVal = !d.featured;
    try {
      var res = await window.supabase.from('challenges').update({ featured: newVal }).eq('id', id);
      if (res.error) throw res.error;
      toast(newVal ? 'Featured' : 'Unfeatured', 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Feature toggle failed', 'error'); }
  }

  function viewChallenge(id) {
    var ac = getAC();
    var d = ac.data.find(function (x) { return x.id === id; });
    if (!d) return;
    var heroHtml = d.hero_url
      ? '<div style="height:160px;background:#0a1825 url(' + escHtml(d.hero_url) + ') center/cover;border-radius:12px;margin-bottom:16px;"></div>'
      : '<div style="height:90px;background:#0a1825;border-radius:12px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;color:#6c7a8b;">No photo</div>';

    var content =
      heroHtml +
      '<h2 style="margin:0 0 4px;color:#e8eef4;font-size:18px;">' + escHtml(d.title) + '</h2>' +
      '<div style="color:#8a99a8;font-size:13px;margin-bottom:14px;">' + escHtml(d.organizer) + ' · ' + escHtml(d.kind === 'member' ? 'Member-hosted' : 'Provider') + ' · ' + escHtml(d.activity || d.category) + '</div>' +
      (d.metric ? '<div style="color:#cfd6dc;font-size:13px;margin-bottom:8px;"><b style="color:#8a99a8;">Metric:</b> ' + escHtml(d.metric) + '</div>' : '') +
      (d.venue ? '<div style="color:#cfd6dc;font-size:13px;margin-bottom:8px;"><b style="color:#8a99a8;">Venue:</b> ' + escHtml(d.venue) + '</div>' : '') +
      (d.prize ? '<div style="color:#cfd6dc;font-size:13px;margin-bottom:14px;"><b style="color:#8a99a8;">Prize:</b> ' + escHtml(d.prize) + '</div>' : '') +
      (d.description ? '<div style="color:#cfd6dc;font-size:14px;line-height:1.5;margin-bottom:14px;white-space:pre-wrap;">' + escHtml(d.description) + '</div>' : '') +
      '<div style="color:#cfd6dc;font-size:13px;margin-bottom:8px;"><b style="color:#8a99a8;">Ends:</b> ' + escHtml(d.ends) + '</div>' +
      '<div style="color:#6c7a8b;font-size:12px;">Status: <span class="pill pill-' + d.status + '">' + d.status + '</span></div>';

    var foot = '<button class="btn btn-ghost" onclick="closeAdminModal()">Close</button>';
    if (d.status === 'pending') {
      foot = '<button class="btn btn-danger" onclick="closeAdminModal(); AdminChallenges.reject(\'' + d.id + '\')"><span class="material-icons">close</span>Reject</button>' +
             '<button class="btn btn-blue" onclick="closeAdminModal(); AdminChallenges.approve(\'' + d.id + '\')"><span class="material-icons">check</span>Approve</button>';
    }
    if (typeof window.openAdminModal === 'function') {
      window.openAdminModal('Challenge preview', content, foot);
    } else { _openAdminModal('Challenge preview', content, foot); }
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
      return window.supabase && typeof AdminChallenges !== 'undefined';
    }, 15000);
    if (!ok) { console.error('[FFP Admin Challenges] deps never loaded'); return; }
    var authed = await waitFor(function () { return !!(window.FFP_ADMIN); }, 30000);
    if (!authed) { console.warn('[FFP Admin Challenges] FFP_ADMIN not set'); return; }

    var ac = getAC();
    ac.tab = 'pending';
    ac.init = function () { refresh(); };
    ac.setTab = function (tab) { ac.tab = tab; realRender(); };
    ac.onSearch = function (q) { ac.search = (q || '').toLowerCase().trim(); realRender(); };
    ac.render = realRender;
    ac.approve = approve;
    ac.reject = reject;
    ac.feature = feature;
    ac.view = viewChallenge;
    ac.refresh = refresh;

    try {
      await refresh();
      console.log('[FFP Admin Challenges v1] Loaded \u2713');
    } catch (e) { console.error('[FFP Admin Challenges] init load:', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();

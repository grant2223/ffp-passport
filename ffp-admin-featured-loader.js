/* FFP Admin FEATURED Loader — v2 (2026-06-13)
   v2: PER-DAY model. Partners request specific DAYS ($99 USD/day). Queue shows days + total + status.
       Lifecycle: Approve (→ partner pays upfront) → Set live (→ live on the chosen days) | Decline.
       Live shown only on paid days via is_featured_today(). admin_list_feature_requests + admin_decide_feature.
   v1: claim/monthly model (superseded).
*/
(function () {
  'use strict';
  function getAX() { return (typeof AdminFeatured !== 'undefined') ? AdminFeatured : null; }
  function toast(m, k) { if (typeof window.showToast === 'function') { try { window.showToast(m, k || 'info'); return; } catch (e) {} } console.log('[FFP Admin Featured]', m); }
  async function waitFor(check, ms) { var t = 0, lim = Math.ceil((ms || 15000) / 100); while (!check() && t < lim) { await new Promise(function (r) { setTimeout(r, 100); }); t++; } return check(); }
  function escHtml(s) { if (typeof window.escHtml === 'function') return window.escHtml(s); return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var TYPE_LABEL = { session: 'Session', class: 'Tour', experience: 'Trip', event: 'Event' };

  async function fetchRequests() {
    var res = await window.supabase.rpc('admin_list_feature_requests');
    if (res.error) { console.error('[FFP Admin Featured] fetch', res.error); toast('Could not load feature requests', 'error'); return []; }
    return res.data || [];
  }
  async function refresh() { var ax = getAX(); if (!ax) return; ax.data = await fetchRequests(); realRender(); }

  function setNavBadge(n) {
    var link = document.querySelector('.sidebar-link[data-panel="panel-featured"]'); if (!link) return;
    var b = link.querySelector('.ffp-pending-badge');
    if (n > 0) { if (!b) { b = document.createElement('span'); b.className = 'sidebar-link-badge ffp-pending-badge'; link.appendChild(b); } b.textContent = n > 99 ? '99+' : String(n); b.style.display = ''; }
    else if (b) { b.style.display = 'none'; }
  }

  function realRender() {
    var ax = getAX(); if (!ax) return;
    var rows = ax.data || [];
    if (ax.search) rows = rows.filter(function (d) { return (d.title || '').toLowerCase().indexOf(ax.search) >= 0 || (d.provider || '').toLowerCase().indexOf(ax.search) >= 0; });
    setNavBadge((ax.data || []).length);
    var metaEl = document.getElementById('AdminFeatured-meta'); if (metaEl) metaEl.textContent = rows.length + ' pending';
    var body = document.getElementById('featured-tbody'); if (!body) return;
    body.innerHTML = rows.length === 0
      ? '<tr><td colspan="5" class="text-muted" style="text-align:center; padding:30px;">No pending feature requests</td></tr>'
      : rows.map(function (d) {
          var days = d.days || []; var n = days.length;
          var total = (d.total_usd != null ? d.total_usd : n * 99);
          var daysList = days.slice(0, 6).join(', ') + (n > 6 ? ' +' + (n - 6) + ' more' : '');
          var statusPill = d.status === 'approved'
            ? '<span class="pill" style="background:rgba(74,222,128,.15);color:#4ade80;">Approved · awaiting payment</span>'
            : '<span class="pill" style="background:rgba(157,189,208,.15);color:#9dbdd0;">Pending</span>';
          var actions = d.status === 'approved'
            ? '<button class="btn btn-sm btn-blue" title="Payment received — make it live on the chosen days" onclick="AdminFeatured.decide(\'' + d.id + '\',\'live\')"><span class="material-icons">bolt</span>Set live</button>' +
              '<button class="btn btn-sm btn-danger" onclick="AdminFeatured.decide(\'' + d.id + '\',\'decline\')"><span class="material-icons">close</span>Decline</button>'
            : '<button class="btn btn-sm btn-blue" title="Approve the request — partner then pays upfront" onclick="AdminFeatured.decide(\'' + d.id + '\',\'approve\')"><span class="material-icons">check</span>Approve</button>' +
              '<button class="btn btn-sm btn-danger" onclick="AdminFeatured.decide(\'' + d.id + '\',\'decline\')"><span class="material-icons">close</span>Decline</button>';
          return '<tr>' +
            '<td><strong>' + escHtml(d.title || '(untitled)') + '</strong><div class="text-muted" style="font-size:11px;margin-top:2px;">' + statusPill + '</div></td>' +
            '<td><span class="pill pill-verified">' + escHtml(TYPE_LABEL[d.item_type] || d.item_type) + '</span></td>' +
            '<td class="text-muted">' + escHtml(d.provider || '—') + '</td>' +
            '<td class="text-muted nowrap">' + n + ' day' + (n !== 1 ? 's' : '') + ' · USD ' + total + '<div class="text-muted" style="font-size:11px;">' + escHtml(daysList) + '</div></td>' +
            '<td><div class="table-actions">' + actions + '</div></td>' +
          '</tr>';
        }).join('');
  }

  async function decide(id, decision) {
    try {
      var res = await window.supabase.rpc('admin_decide_feature', { p_request: id, p_decision: decision });
      if (res.error) throw res.error;
      if (res.data === 'forbidden') { toast('Admins only', 'error'); return; }
      var msg = decision === 'approve' ? 'Approved — partner pays upfront, then Set live'
              : decision === 'live' ? 'Live — featured on the chosen days'
              : 'Feature request declined';
      toast(msg, 'success');
      await refresh();
    } catch (e) { console.error(e); toast(e.message || 'Action failed', 'error'); }
  }

  async function init() {
    var ok = await waitFor(function () { return window.supabase && typeof AdminFeatured !== 'undefined'; }, 15000);
    if (!ok) { console.error('[FFP Admin Featured] deps never loaded'); return; }
    var authed = await waitFor(function () { return !!(window.FFP_ADMIN); }, 30000);
    if (!authed) { console.warn('[FFP Admin Featured] FFP_ADMIN not set'); return; }
    var ax = getAX();
    ax.init = function () { refresh(); };
    ax.onSearch = function (q) { ax.search = (q || '').toLowerCase().trim(); realRender(); };
    ax.render = realRender;
    ax.decide = decide;
    ax.refresh = refresh;
    refresh();
    if (window.FFPRealtime) window.FFPRealtime.subscribe('admin-featured', 'feature_requests', null, function () { refresh(); });
    console.log('[FFP Admin Featured v1] Loaded ✓');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

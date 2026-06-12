/* FFP Admin FEATURED Loader — v1 (2026-06-12)
   Wires the admin "Featured" panel to feature_requests via admin_list_feature_requests() + admin_decide_feature().
   Partners apply to feature a listing on the homepage ($99/mo); admin Approves (flips the listing's featured flag)
   or Declines. Pending badge on the sidebar link. Mirrors ffp-admin-experiences-loader.js.
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
          var fee = (d.currency || 'USD') + ' ' + (d.monthly_fee != null ? d.monthly_fee : 99) + '/mo';
          return '<tr>' +
            '<td><strong>' + escHtml(d.title || '(untitled)') + '</strong></td>' +
            '<td><span class="pill pill-verified">' + escHtml(TYPE_LABEL[d.item_type] || d.item_type) + '</span></td>' +
            '<td class="text-muted">' + escHtml(d.provider || '—') + '</td>' +
            '<td class="text-muted nowrap">' + escHtml(fee) + '</td>' +
            '<td><div class="table-actions">' +
              '<button class="btn btn-sm btn-blue" onclick="AdminFeatured.decide(\'' + d.id + '\',\'approve\')"><span class="material-icons">check</span>Approve</button>' +
              '<button class="btn btn-sm btn-danger" onclick="AdminFeatured.decide(\'' + d.id + '\',\'decline\')"><span class="material-icons">close</span>Decline</button>' +
            '</div></td>' +
          '</tr>';
        }).join('');
  }

  async function decide(id, decision) {
    try {
      var res = await window.supabase.rpc('admin_decide_feature', { p_request: id, p_decision: decision });
      if (res.error) throw res.error;
      if (res.data === 'forbidden') { toast('Admins only', 'error'); return; }
      toast(decision === 'approve' ? 'Featured — now on the homepage' : 'Feature request declined', 'success');
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

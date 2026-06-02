/* FFP Admin Settings Loader — v2 (2026-06-02)
   Connects the Settings panel: renders the FFP Team from public.admin_users (the signed-in
   admin shows their email via window.FFP_ADMIN), and loads the persisted Audit Log
   (public.admin_audit) via the dashboard's DB-backed AuditLog.load().
   Lazy-loaded when the Settings panel is first opened. */
(function () {
  'use strict';
  function sb() { return window.supabase; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  async function renderTeam() {
    var tb = document.getElementById('settings-team-tbody');
    if (!tb || !sb()) return;
    var meEmail = (window.FFP_ADMIN && window.FFP_ADMIN.email) || '';
    var meId = null;
    try { var u = await sb().auth.getUser(); meId = u && u.data && u.data.user && u.data.user.id; } catch (e) {}
    var res = await sb().from('admin_users').select('id, role, added_at').order('added_at', { ascending: true });
    if (res.error) {
      tb.innerHTML = '<tr><td colspan="5" class="text-muted" style="padding:14px;">Could not load team.</td></tr>';
      return;
    }
    var rows = res.data || [];
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="5" class="text-muted" style="padding:14px;">No admins.</td></tr>'; return; }
    tb.innerHTML = rows.map(function (a) {
      var isMe = meId && a.id === meId;
      var email = isMe && meEmail ? meEmail : '—';
      var roleLabel = String(a.role || 'admin').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      var name = isMe && meEmail ? meEmail : 'Admin';
      var letter = (isMe && meEmail ? meEmail[0] : 'A').toUpperCase();
      var added = a.added_at ? new Date(a.added_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      return '<tr>' +
        '<td><span class="cell-avatar">' + esc(letter) + '</span><span class="cell-name">' + esc(name) +
          (isMe ? ' <span class="text-muted" style="font-size:11px;">(you)</span>' : '') + '</span></td>' +
        '<td class="text-muted">' + esc(email) + '</td>' +
        '<td><span class="pill pill-ambassador">' + esc(roleLabel) + '</span></td>' +
        '<td class="text-muted">' + esc(added) + '</td>' +
        '<td></td></tr>';
    }).join('');
  }

  async function init() {
    if (!sb()) { setTimeout(init, 150); return; }
    await renderTeam();
    if (window.AuditLog && typeof window.AuditLog.load === 'function') { window.AuditLog.load(); }
    console.log('[FFP Admin Settings] loaded v1 ✓');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

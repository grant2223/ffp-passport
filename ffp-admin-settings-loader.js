/* FFP Admin Settings Loader — v1 (2026-06-01)
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
    // FFP uses a custom per-request JWT, not Supabase Auth — supabase.auth.getUser() is always null
    // here. The admin's id (== admin_users.id) is exposed as window.FFP_ADMIN.id.
    var meId = (window.FFP_ADMIN && window.FFP_ADMIN.id)
            || (window.FFPAuth && FFPAuth.getMember && (FFPAuth.getMember() || {}).id)
            || null;
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

  // ── Platform Config (public.platform_config key/value) ──
  var CFG_FIELDS = {
    membership_price_usd: 'cfg-membership',
    min_payout_usd: 'cfg-minpayout',
    ref_member_pct: 'cfg-ref-member',
    ref_supporter_pct: 'cfg-ref-supporter',
    ref_ambassador_pct: 'cfg-ref-ambassador'
  };
  async function loadConfig() {
    if (!sb()) return;
    var res = await sb().from('platform_config').select('key, value');
    if (res.error) { console.warn('[Settings] config load', res.error); return; }
    var map = {}; (res.data || []).forEach(function (r) { map[r.key] = r.value; });
    Object.keys(CFG_FIELDS).forEach(function (k) {
      var el = document.getElementById(CFG_FIELDS[k]);
      if (el && map[k] != null) el.value = map[k];
    });
  }
  async function saveConfig() {
    var btn = document.getElementById('cfg-save-btn');
    var msg = document.getElementById('cfg-save-msg');
    if (btn) btn.disabled = true;
    if (msg) { msg.textContent = 'Saving…'; msg.style.color = ''; }
    try {
      var rows = Object.keys(CFG_FIELDS).map(function (k) {
        var el = document.getElementById(CFG_FIELDS[k]);
        return { key: k, value: el ? String(el.value).trim() : null, updated_at: new Date().toISOString() };
      });
      var res = await sb().from('platform_config').upsert(rows, { onConflict: 'key' });
      if (res.error) throw res.error;
      if (msg) { msg.textContent = 'Saved ✓'; msg.style.color = '#22c55e'; }
      if (window.AuditLog) AuditLog.add(null, 'updated platform config');
    } catch (e) {
      console.error('[Settings] config save', e);
      if (msg) { msg.textContent = 'Save failed — ' + (e.message || 'try again'); msg.style.color = '#ef4444'; }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function init() {
    if (!sb()) { setTimeout(init, 150); return; }
    await renderTeam();
    if (window.AuditLog && typeof window.AuditLog.load === 'function') { window.AuditLog.load(); }
    await loadConfig();
    var saveBtn = document.getElementById('cfg-save-btn');
    if (saveBtn) saveBtn.onclick = saveConfig;
    console.log('[FFP Admin Settings] loaded v2 ✓ (team + audit + editable config)');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

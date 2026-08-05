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
    // Resolve each admin_users row to its member (email + name).
    var mmap = {};
    try {
      var mr = await sb().from('members').select('id, email, full_name, given_names').in('id', rows.map(function (a) { return a.id; }));
      (mr.data || []).forEach(function (m) { mmap[m.id] = m; });
    } catch (e) {}
    tb.innerHTML = rows.map(function (a) {
      var mm = mmap[a.id] || {};
      var isMe = meId && a.id === meId;
      var email = mm.email || (isMe && window.FFP_ADMIN && window.FFP_ADMIN.email) || '—';
      var name = mm.full_name || mm.given_names || (email !== '—' ? email : 'Admin');
      var isStaff = String(a.role || '').toLowerCase() === 'staff';
      var roleLabel = isStaff ? 'Staff' : String(a.role || 'admin').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      var letter = (name[0] || 'A').toUpperCase();
      var added = a.added_at ? new Date(a.added_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      var revoke = (isStaff && !isMe && email !== '—') ? '<button class="btn btn-sm btn-danger" onclick="AdminStaff.revoke(\'' + esc(email).replace(/'/g, "&#39;") + '\')"><span class="material-icons">person_remove</span>Revoke</button>' : '';
      return '<tr>' +
        '<td><span class="cell-avatar">' + esc(letter) + '</span><span class="cell-name">' + esc(name) +
          (isMe ? ' <span class="text-muted" style="font-size:11px;">(you)</span>' : '') + '</span></td>' +
        '<td class="text-muted">' + esc(email) + '</td>' +
        '<td><span class="pill ' + (isStaff ? 'pill-supporter' : 'pill-ambassador') + '">' + esc(roleLabel) + '</span></td>' +
        '<td class="text-muted">' + esc(added) + '</td>' +
        '<td>' + revoke + '</td></tr>';
    }).join('');
  }

  // ── Staff access grant / revoke (admin_grant_staff RPC) ──
  async function grantStaff() {
    var inp = document.getElementById('staff-email'), msg = document.getElementById('staff-msg'), btn = document.getElementById('staff-grant-btn');
    var email = inp ? String(inp.value || '').trim() : '';
    if (!email) { if (msg) { msg.textContent = 'Enter an email'; msg.style.color = '#ef4444'; } return; }
    if (btn) btn.disabled = true; if (msg) { msg.textContent = 'Granting…'; msg.style.color = ''; }
    try {
      var res = await sb().rpc('admin_grant_staff', { p_email: email, p_grant: true });
      var d = res.data || {};
      if (res.error || !d.ok) throw new Error((d && d.error) || (res.error && res.error.message) || 'failed');
      if (msg) { msg.textContent = 'Staff access granted ✓'; msg.style.color = '#22c55e'; }
      if (inp) inp.value = '';
      if (window.AuditLog) AuditLog.add(null, 'granted staff access to ' + email);
      renderTeam();
    } catch (e) {
      var m = e.message === 'no_member' ? 'No member with that email' : e.message === 'not_authorised' ? 'Not authorised' : (e.message || 'Failed');
      if (msg) { msg.textContent = m; msg.style.color = '#ef4444'; }
    } finally { if (btn) btn.disabled = false; }
  }
  async function revokeStaff(email) {
    if (!window.confirm('Revoke staff access for ' + email + '?')) return;
    try {
      var res = await sb().rpc('admin_grant_staff', { p_email: email, p_grant: false });
      var d = res.data || {};
      if (res.error || !d.ok) throw new Error((d && d.error) || 'failed');
      if (window.AuditLog) AuditLog.add(null, 'revoked staff access for ' + email);
      if (window.showToast) showToast('Staff access revoked', 'success');
      renderTeam();
    } catch (e) { if (window.showToast) showToast('Could not revoke — ' + (e.message || ''), 'error'); }
  }
  window.AdminStaff = { grant: grantStaff, revoke: revokeStaff };

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
    var grantBtn = document.getElementById('staff-grant-btn');
    if (grantBtn) grantBtn.onclick = grantStaff;
    var staffInp = document.getElementById('staff-email');
    if (staffInp) staffInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') grantStaff(); });
    console.log('[FFP Admin Settings] loaded v3 ✓ (team + staff access + audit + config)');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

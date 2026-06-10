/* FFP Admin Professionals Loader — v1 (2026-06-10)
   The public-listing VERIFICATION QUEUE for the Professionals Portal. A professional who ticks
   "List me on Find Fit People" moves to verification_status='pending' (professional_save_profile);
   this panel lets an admin review the profile and Approve or Reject (with a note).
   Data: professional_verification_list() (is_admin-gated) → pending rows.
   Actions: professional_set_verification(p_pro, 'approved'|'rejected', note).
   Renders into #pro-verify-root inside #panel-professionals. */
(function () {
  'use strict';
  function sb() { return window.supabase; }
  function toast(m, t) { if (window.showToast) return window.showToast(m, t); if (window.toast) return window.toast(m, t); console.log('[Pros]', m); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  function injectCss() {
    if (document.getElementById('ffp-pros-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-pros-css';
    s.textContent = [
      '#pro-verify-root .pv-empty{padding:30px;text-align:center;color:#8a99a8;font-size:13px;}',
      '#pro-verify-root .pv-card{display:flex;gap:14px;align-items:flex-start;border:1px solid rgba(43,168,224,.18);border-radius:14px;padding:14px 16px;margin-bottom:12px;background:#0f1e2e;}',
      '#pro-verify-root .pv-ph{width:54px;height:54px;border-radius:50%;flex:0 0 auto;background:#13283b center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-weight:800;color:#7fa7c4;overflow:hidden;}',
      '#pro-verify-root .pv-name{font-size:15px;font-weight:800;color:#fff;}',
      '#pro-verify-root .pv-meta{font-size:12px;color:#9db4c7;margin-top:2px;}',
      '#pro-verify-root .pv-bio{font-size:12px;color:#c7d6e3;margin-top:8px;line-height:1.5;}',
      '#pro-verify-root .pv-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
      '#pro-verify-root .pv-chip{font-size:11px;font-weight:700;color:#cbd9e6;border:1px solid rgba(43,168,224,.25);border-radius:20px;padding:3px 9px;}',
      '#pro-verify-root .pv-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}',
      '#pro-verify-root .pv-btn{border:none;border-radius:9px;padding:9px 16px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;}',
      '#pro-verify-root .pv-approve{background:#22c55e;color:#06210f;}',
      '#pro-verify-root .pv-reject{background:rgba(239,68,68,.14);color:#f07171;border:1px solid rgba(239,68,68,.4);}',
      '#pro-verify-root a.pv-link{color:#2ba8e0;font-size:12px;font-weight:700;text-decoration:none;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function initials(nm) { return (String(nm || '').split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2) || 'P').toUpperCase(); }

  function card(p) {
    var name = esc(p.display_name || ((p.given_names || '') + ' ' + (p.surname || '')).trim() || 'Professional');
    var types = (p.professional_types || []).map(function (t) { return '<span class="pv-chip">' + esc(t) + '</span>'; }).join('');
    var loc = [p.city, p.country].filter(Boolean).map(esc).join(', ');
    var ph = p.profile_photo_url
      ? '<div class="pv-ph" style="background-image:url(\'' + esc(p.profile_photo_url) + '\');"></div>'
      : '<div class="pv-ph">' + initials(name) + '</div>';
    return '<div class="pv-card" data-id="' + p.id + '">' + ph +
      '<div style="flex:1;min-width:0;">' +
        '<div class="pv-name">' + name + '</div>' +
        '<div class="pv-meta">' + (p.category ? esc(p.category) : '') + (loc ? ' · ' + loc : '') + (p.work_email ? ' · ' + esc(p.work_email) : '') + '</div>' +
        (p.headline ? '<div class="pv-meta" style="color:#cbd9e6;font-weight:600;margin-top:4px;">' + esc(p.headline) + '</div>' : '') +
        (types ? '<div class="pv-chips">' + types + '</div>' : '') +
        (p.bio ? '<div class="pv-bio">' + esc(p.bio) + '</div>' : '') +
        (p.slug ? '<div style="margin-top:8px;"><a class="pv-link" href="https://findfitpeople.com/pro/' + esc(p.slug) + '" target="_blank" rel="noopener">Preview public page ↗</a></div>' : '') +
        '<div class="pv-actions">' +
          '<button class="pv-btn pv-approve" data-act="approve">Approve &amp; publish</button>' +
          '<button class="pv-btn pv-reject" data-act="reject">Reject…</button>' +
        '</div>' +
      '</div></div>';
  }

  async function load() {
    var host = document.getElementById('pro-verify-root'); if (!host) return;
    host.innerHTML = '<div class="pv-empty">Loading…</div>';
    var res;
    try { res = await sb().rpc('professional_verification_list'); } catch (e) { host.innerHTML = '<div class="pv-empty">Could not load.</div>'; return; }
    var data = res && res.data;
    if (data && data.error) { host.innerHTML = '<div class="pv-empty">' + esc(data.error === 'forbidden' ? 'Admin sign-in required.' : data.error) + '</div>'; return; }
    var rows = Array.isArray(data) ? data : [];
    if (!rows.length) { host.innerHTML = '<div class="pv-empty">No professionals are waiting for review. 🎉</div>'; return; }
    host.innerHTML = '<p style="font-size:12px;color:#9db4c7;margin:0 0 14px;">' + rows.length + ' professional' + (rows.length === 1 ? '' : 's') + ' awaiting review. Approving makes the profile discoverable on Find Fit People.</p>' + rows.map(card).join('');
  }

  async function setStatus(id, status, note) {
    try {
      var r = await sb().rpc('professional_set_verification', { p_pro: id, p_status: status, p_note: note || null });
      if (r && r.data && r.data.error) { toast(r.data.error === 'forbidden' ? 'Admin sign-in required' : r.data.error, 'error'); return; }
      toast(status === 'approved' ? 'Approved — now live' : 'Rejected', 'success');
      load();
    } catch (e) { toast('Action failed', 'error'); }
  }

  function wire() {
    var host = document.getElementById('pro-verify-root'); if (!host || host._wired) return; host._wired = true;
    host.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.pv-btn'); if (!btn) return;
      var cardEl = btn.closest('.pv-card'); if (!cardEl) return;
      var id = cardEl.dataset.id, act = btn.dataset.act;
      if (act === 'approve') { setStatus(id, 'approved'); }
      else if (act === 'reject') { var note = prompt('Reason for the professional (optional):', ''); if (note === null) return; setStatus(id, 'rejected', note); }
    });
  }

  function init() {
    if (!sb()) { setTimeout(init, 150); return; }
    injectCss(); wire(); load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

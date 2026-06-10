/* FFP Pro Data-Sharing (member side) — v1 (2026-06-11)
   The member's control surface for professional access to their Calorie Tracker + Fitness Stats.
   A professional requests access (pro dashboard) → the member gets a notification + sees it here →
   Approve / Decline, and can Revoke an approved pro at any time. READ-ONLY for the pro; the member
   stays in control. Self-contained: builds its own modal, reads the member from FFPAuth, talks to
   member_pro_access_list / member_respond_pro_access. Exposes window.FFPProAccess.open().
   Auto-opens when the page is loaded with ?proaccess=1 (the notification deep-link). */
(function () {
  'use strict';
  var W = window;
  function sb() { return W.supabase; }
  function me() { try { return (W.FFPAuth && W.FFPAuth.getMember && W.FFPAuth.getMember()) || null; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function toast(m) { try { if (W.showToast) return W.showToast(m); } catch (e) {} }

  function injectCss() {
    if (document.getElementById('ffp-pacc-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-pacc-css';
    s.textContent = [
      '.pacc-ov{position:fixed;inset:0;background:rgba(4,12,20,.72);display:none;align-items:flex-end;justify-content:center;z-index:4000;}',
      '.pacc-ov.show{display:flex;}',
      '@media(min-width:560px){.pacc-ov{align-items:center;}}',
      '.pacc-card{width:100%;max-width:460px;max-height:88vh;overflow-y:auto;background:#0b1c28;border:1px solid rgba(43,168,224,.22);border-radius:18px 18px 0 0;padding:20px;}',
      '@media(min-width:560px){.pacc-card{border-radius:18px;}}',
      '.pacc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:4px;}',
      '.pacc-title{font-size:17px;font-weight:800;color:#fff;}',
      '.pacc-sub{font-size:12px;color:#8a99a8;line-height:1.5;margin:2px 0 16px;}',
      '.pacc-x{background:none;border:none;color:#8a99a8;cursor:pointer;font-size:22px;line-height:1;padding:0;}',
      '.pacc-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid rgba(43,168,224,.12);}',
      '.pacc-ph{width:44px;height:44px;border-radius:50%;flex:0 0 auto;background:#13283b center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-weight:800;color:#7fa7c4;overflow:hidden;}',
      '.pacc-nm{font-size:14px;font-weight:800;color:#fff;}',
      '.pacc-meta{font-size:11px;color:#8a99a8;margin-top:1px;}',
      '.pacc-actions{display:flex;gap:7px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end;}',
      '.pacc-btn{border:none;border-radius:8px;padding:8px 13px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;}',
      '.pacc-approve{background:#22c55e;color:#06210f;}',
      '.pacc-decline{background:rgba(255,255,255,.08);color:#cbd9e6;}',
      '.pacc-revoke{background:rgba(239,68,68,.14);color:#f07171;border:1px solid rgba(239,68,68,.4);}',
      '.pacc-pill{font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;background:rgba(34,197,94,.14);color:#22c55e;}',
      '.pacc-empty{padding:26px 6px;text-align:center;color:#8a99a8;font-size:13px;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function ensureOverlay() {
    var ov = document.getElementById('pacc-ov');
    if (ov) return ov;
    ov = document.createElement('div'); ov.id = 'pacc-ov'; ov.className = 'pacc-ov';
    ov.innerHTML = '<div class="pacc-card"><div class="pacc-head"><div class="pacc-title">Data sharing</div>' +
      '<button class="pacc-x" aria-label="Close">&times;</button></div>' +
      '<div class="pacc-sub">Professionals you train with can request read-only access to your Calorie Tracker &amp; Fitness Stats. You decide — and can turn it off any time.</div>' +
      '<div id="pacc-list"><div class="pacc-empty">Loading…</div></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.pacc-x').addEventListener('click', close);
    return ov;
  }
  function close() { var ov = document.getElementById('pacc-ov'); if (ov) ov.classList.remove('show'); }

  function initials(nm) { return (String(nm || '?').split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2) || '?').toUpperCase(); }

  function row(g) {
    var types = (g.pro_types && g.pro_types.length) ? g.pro_types.slice(0, 2).join(' · ') : (g.pro_category || 'Professional');
    var ph = g.pro_photo ? '<div class="pacc-ph" style="background-image:url(\'' + esc(g.pro_photo) + '\');"></div>' : '<div class="pacc-ph">' + initials(g.pro_name) + '</div>';
    var actions;
    if (g.status === 'pending') {
      actions = '<button class="pacc-btn pacc-approve" data-act="approve" data-id="' + g.grant_id + '">Approve</button>' +
                '<button class="pacc-btn pacc-decline" data-act="decline" data-id="' + g.grant_id + '">Decline</button>';
    } else {
      actions = '<span class="pacc-pill">Sharing</span><button class="pacc-btn pacc-revoke" data-act="revoke" data-id="' + g.grant_id + '">Stop</button>';
    }
    return '<div class="pacc-row">' + ph +
      '<div style="min-width:0;"><div class="pacc-nm">' + esc(g.pro_name || 'Professional') + '</div><div class="pacc-meta">' + esc(types) +
      (g.status === 'pending' ? ' · wants access' : '') + '</div></div>' +
      '<div class="pacc-actions">' + actions + '</div></div>';
  }

  async function load() {
    var listEl = document.getElementById('pacc-list'); if (!listEl) return;
    var m = me(); if (!m || !m.id) { listEl.innerHTML = '<div class="pacc-empty">Please sign in.</div>'; return; }
    listEl.innerHTML = '<div class="pacc-empty">Loading…</div>';
    var res;
    try { res = await sb().rpc('member_pro_access_list', { p_member: m.id }); } catch (e) { listEl.innerHTML = '<div class="pacc-empty">Could not load.</div>'; return; }
    var rows = (res && res.data) || [];
    if (!rows.length) { listEl.innerHTML = '<div class="pacc-empty">No professionals have requested access.</div>'; return; }
    // pending first (already ordered by the RPC)
    listEl.innerHTML = rows.map(row).join('');
  }

  async function respond(grantId, action) {
    var m = me(); if (!m || !m.id) return;
    try {
      var r = await sb().rpc('member_respond_pro_access', { p_member: m.id, p_grant: grantId, p_action: action });
      if (r && r.data && r.data.error) { toast('Could not update'); return; }
      toast(action === 'approve' ? 'Access approved' : (action === 'revoke' ? 'Access stopped' : 'Request declined'));
      load();
    } catch (e) { toast('Could not update'); }
  }

  function wire() {
    var ov = document.getElementById('pacc-ov'); if (!ov || ov._wired) return; ov._wired = true;
    ov.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.pacc-btn'); if (!b) return;
      respond(b.dataset.id, b.dataset.act);
    });
  }

  function open() {
    if (!sb()) { setTimeout(open, 200); return; }
    injectCss(); ensureOverlay(); wire();
    document.getElementById('pacc-ov').classList.add('show');
    load();
  }

  W.FFPProAccess = { open: open, reload: load };

  // Deep-link from the notification: /ffp-member-dashboard.html?proaccess=1
  try {
    if (/[?&]proaccess=1/.test(location.search)) {
      var go = function () { open(); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(go, 600); });
      else setTimeout(go, 600);
    }
  } catch (e) {}
})();

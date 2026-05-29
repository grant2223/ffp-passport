/* ═══════════════════════════════════════════════════════════════
   FFP PROVIDER QUEST CHECK-INS LOADER · v1
   File path: ffp-provider-quests-loader.js (repo root)
   On-load log: [FFP Quest Check-ins v1] Loaded ✓

   Injects a "Quest check-ins" card into #panel-checkins. Lists pending
   quest check-in requests for this provider (members who scanned in for a
   quest) and lets staff Approve / Decline. Approve calls the backend award
   transaction, which stamps the step and — on completion — awards the stamp,
   claims a prize slot if first-N, and recomputes the member's tier.

   Self-contained: reads window.FFP_PROVIDER (set by ffp-provider-auth) and
   talks to the FFP backend over HTTPS. No Supabase writes here — all award
   logic is server-side.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API = 'https://ffp-passport-backend.vercel.app';

  function toast(m, k) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(m, k || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Quest Check-ins]', m);
  }
  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function waitFor(check, ms) {
    return new Promise(function (resolve) {
      var t = 0, lim = Math.ceil((ms || 30000) / 150);
      var iv = setInterval(function () {
        if (check() || t++ >= lim) { clearInterval(iv); resolve(check()); }
      }, 150);
    });
  }
  function fullName(m) { if (!m) return 'Member'; return m.full_name || m.given_names || 'Member'; }
  function letterFor(m) { return fullName(m).charAt(0).toUpperCase(); }
  function relTime(iso) {
    if (!iso) return '';
    var d = Date.now() - new Date(iso).getTime();
    var mn = Math.floor(d / 60000);
    if (mn < 1) return 'just now';
    if (mn < 60) return mn + 'm ago';
    var h = Math.floor(mn / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }

  function providerId() { return window.FFP_PROVIDER && window.FFP_PROVIDER.id; }
  function approverId() { return (window.FFP_PROVIDER && (window.FFP_PROVIDER.member_id || window.FFP_PROVIDER.id)) || null; }

  function injectStyles() {
    if (document.getElementById('ffp-q-checkins-css')) return;
    var s = document.createElement('style');
    s.id = 'ffp-q-checkins-css';
    s.textContent = [
      '#ffp-q-checkins{margin-bottom:22px;}',
      '#ffp-q-checkins .qcard{background:var(--ffp-bg-2,#0f1e2e);border:1px solid rgba(43,168,224,0.18);border-radius:14px;padding:18px;}',
      '#ffp-q-checkins .qhead{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:4px;}',
      '#ffp-q-checkins .qhead .ms{color:#FFCC00;}',
      '#ffp-q-checkins .qsub{font-size:12px;color:var(--ffp-text-muted,#8a99a8);margin-bottom:14px;}',
      '#ffp-q-checkins .qrow{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid rgba(255,255,255,0.06);}',
      '#ffp-q-checkins .qav{width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(43,168,224,0.15);color:#2ba8e0;font-weight:800;background-size:cover;background-position:center;}',
      '#ffp-q-checkins .qinfo{flex:1;min-width:0;}',
      '#ffp-q-checkins .qname{font-size:13px;font-weight:800;}',
      '#ffp-q-checkins .qmeta{font-size:11px;color:var(--ffp-text-muted,#8a99a8);margin-top:2px;}',
      '#ffp-q-checkins .qbtns{display:flex;gap:8px;flex-shrink:0;}',
      '#ffp-q-checkins .qbtn{border:none;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:4px;}',
      '#ffp-q-checkins .qbtn .ms{font-size:16px;}',
      '#ffp-q-checkins .qbtn.app{background:#FFCC00;color:#000;}',
      '#ffp-q-checkins .qbtn.dec{background:rgba(255,255,255,0.08);color:#e8eef4;}',
      '#ffp-q-checkins .qempty{font-size:13px;color:var(--ffp-text-muted,#8a99a8);padding:8px 0;}'
    ].join('');
    document.head.appendChild(s);
  }

  var rows = [];

  function ensureContainer() {
    var panel = document.getElementById('panel-checkins');
    if (!panel) return null;
    var el = document.getElementById('ffp-q-checkins');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ffp-q-checkins';
      var anchor = panel.querySelector('.checkin-card');
      if (anchor) panel.insertBefore(el, anchor); else panel.appendChild(el);
    }
    return el;
  }

  function render() {
    var el = ensureContainer();
    if (!el) return;
    var list = rows.length
      ? rows.map(function (r) {
          var m = r.members || {}, q = r.quests || {};
          var av = m.photo_url
            ? '<div class="qav" style="background-image:url(' + esc(m.photo_url) + ')"></div>'
            : '<div class="qav">' + esc(letterFor(m)) + '</div>';
          return '<div class="qrow" id="qrow-' + r.id + '">' + av +
            '<div class="qinfo"><div class="qname">' + esc(fullName(m)) + '</div>' +
            '<div class="qmeta">' + esc(q.title || 'Quest') + ' · ' + relTime(r.requested_at) + '</div></div>' +
            '<div class="qbtns">' +
              '<button class="qbtn dec" onclick="FFPQuestCheckins.decline(\'' + r.id + '\')">Decline</button>' +
              '<button class="qbtn app" onclick="FFPQuestCheckins.approve(\'' + r.id + '\')"><span class="ms">check</span> Approve</button>' +
            '</div></div>';
        }).join('')
      : '<div class="qempty">No pending quest check-ins right now.</div>';
    el.innerHTML = '<div class="qcard"><div class="qhead"><span class="ms">flag</span> Quest check-ins</div>' +
      '<div class="qsub">Members who scanned in for a quest. Approve to stamp their step.</div>' + list + '</div>';
  }

  async function load() {
    var pid = providerId();
    if (!pid) return;
    try {
      var res = await fetch(API + '/api/quests/provider/' + pid + '/checkins?status=pending');
      var json = await res.json();
      rows = (json && json.checkins) ? json.checkins : [];
    } catch (e) { rows = []; }
    render();
  }

  async function approve(id) {
    try {
      var res = await fetch(API + '/api/quests/checkin/' + id + '/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: approverId() })
      });
      var json = await res.json();
      if (!res.ok || !json.success) { toast((json && json.error) || 'Approve failed', 'error'); return; }
      toast(json.completed ? 'Approved — quest complete! Stamp awarded.' : 'Approved — step stamped.', 'success');
      rows = rows.filter(function (r) { return r.id !== id; });
      render();
    } catch (e) { toast('Approve failed', 'error'); }
  }

  async function decline(id) {
    try {
      var res = await fetch(API + '/api/quests/checkin/' + id + '/decline', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
      if (!res.ok) { toast('Decline failed', 'error'); return; }
      toast('Declined', 'info');
      rows = rows.filter(function (r) { return r.id !== id; });
      render();
    } catch (e) { toast('Decline failed', 'error'); }
  }

  window.FFPQuestCheckins = { approve: approve, decline: decline, reload: load };

  async function init() {
    var ok = await waitFor(function () {
      return document.getElementById('panel-checkins') && providerId();
    }, 30000);
    if (!ok) { console.warn('[FFP Quest Check-ins] panel or provider not ready'); return; }
    injectStyles();
    await load();
    setInterval(load, 20000);   // light poll so new requests appear without a manual refresh
    console.log('[FFP Quest Check-ins v1] Loaded ✓');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

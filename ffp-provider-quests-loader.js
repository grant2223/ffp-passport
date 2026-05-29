/* ═══════════════════════════════════════════════════════════════
   FFP PROVIDER QUEST CHECK-INS LOADER · v2
   File path: ffp-provider-quests-loader.js (repo root)
   On-load log: [FFP Quest Check-ins v2] Loaded ✓

   Injects a "Quest check-ins" card into #panel-checkins: lists pending quest
   check-in requests for this provider and lets staff Approve / Decline.
   Approve calls the backend award transaction (stamps the step; on completion
   awards the stamp, claims a prize slot if first-N, recomputes tier).

   v2: render rows with the dashboard's native .checkin-row / .checkin-avatar /
       .btn classes (fixes v1's stretched-button layout); add a visitor count
       (total approved quest check-ins at this venue).
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
      '#ffp-q-checkins .qc-head{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;margin-bottom:4px;}',
      '#ffp-q-checkins .qc-head .ms{color:var(--ffp-yellow,#FFCC00);}',
      '#ffp-q-checkins .qc-pill{font-size:11px;font-weight:800;background:rgba(43,168,224,0.18);color:var(--ffp-blue,#2ba8e0);border-radius:20px;padding:2px 9px;}',
      '#ffp-q-checkins .qc-sub{font-size:12px;color:var(--ffp-text-muted,#8a99a8);margin-bottom:14px;}',
      '#ffp-q-checkins .qc-actions{display:flex;gap:8px;flex-shrink:0;}',
      '#ffp-q-checkins .qc-empty{font-size:13px;color:var(--ffp-text-muted,#8a99a8);padding:10px 2px;}',
      '#ffp-q-checkins .qc-visitors{display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--ffp-border,rgba(43,168,224,0.10));font-size:12px;font-weight:700;color:var(--ffp-text-muted,#8a99a8);}',
      '#ffp-q-checkins .qc-visitors b{color:var(--ffp-text,#e8eef4);font-size:15px;}',
      '#ffp-q-checkins .qc-visitors .ms{color:var(--ffp-yellow,#FFCC00);font-size:18px;}'
    ].join('');
    document.head.appendChild(s);
  }

  var rows = [];
  var approvedCount = 0;

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

  function rowHtml(r) {
    var m = r.members || {}, q = r.quests || {};
    var avatar = m.photo_url
      ? '<div class="checkin-avatar" style="background:#0a1825 url(' + esc(m.photo_url) + ') center/cover;"></div>'
      : '<div class="checkin-avatar">' + esc(letterFor(m)) + '</div>';
    return '<div class="checkin-row" id="qrow-' + r.id + '">' +
        avatar +
        '<div class="checkin-info">' +
          '<div class="checkin-name">' + esc(fullName(m)) + '</div>' +
          '<div class="checkin-listing">' + esc(q.title || 'Quest') + ' · ' + relTime(r.requested_at) + '</div>' +
        '</div>' +
        '<div class="qc-actions">' +
          '<button class="btn btn-ghost" onclick="FFPQuestCheckins.decline(\'' + r.id + '\')">Decline</button>' +
          '<button class="btn btn-pri" onclick="FFPQuestCheckins.approve(\'' + r.id + '\')"><span class="ms">check</span> Approve</button>' +
        '</div>' +
      '</div>';
  }

  function render() {
    var el = ensureContainer();
    if (!el) return;
    var list = rows.length
      ? '<div class="checkin-list">' + rows.map(rowHtml).join('') + '</div>'
      : '<div class="qc-empty">No pending quest check-ins right now.</div>';
    var pill = rows.length ? '<span class="qc-pill">' + rows.length + '</span>' : '';
    var visitors = '<div class="qc-visitors"><span class="ms">flag</span> <b>' +
      (approvedCount >= 100 ? '100+' : approvedCount) + '</b> quest check-ins approved at your venue</div>';
    el.innerHTML =
      '<div class="qc-head"><span class="ms">flag</span> Quest check-ins ' + pill + '</div>' +
      '<div class="qc-sub">Members who scanned in for a quest. Approve to stamp their step.</div>' +
      list + visitors;
  }

  async function fetchList(status) {
    var pid = providerId();
    if (!pid) return [];
    try {
      var res = await fetch(API + '/api/quests/provider/' + pid + '/checkins?status=' + status);
      var json = await res.json();
      return (json && json.checkins) ? json.checkins : [];
    } catch (e) { return []; }
  }

  async function load() {
    rows = await fetchList('pending');
    var approved = await fetchList('approved');
    approvedCount = approved.length;
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
      approvedCount += 1;
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
    console.log('[FFP Quest Check-ins v2] Loaded ✓');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

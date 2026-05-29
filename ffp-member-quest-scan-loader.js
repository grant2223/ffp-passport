/* ═══════════════════════════════════════════════════════════════
   FFP MEMBER QUEST SCAN / CHECK-IN LOADER · v1
   File path: ffp-member-quest-scan-loader-v1.js (repo root)
   On-load log: [FFP Quest Scan v1] Loaded ✓

   Adds the member-side check-in flow to the Quests panel:
   1. "Check in at a venue" button → in-app camera QR scan (html5-qrcode, loaded
      from CDN) OR a pasted code/link fallback. Also handles ?venue=<id> in the
      URL so a phone-camera scan of a venue link works without the in-app scanner.
   2. Reads the venue (provider) id → shows a context sheet (Quest / others soon).
   3. Quest → lists the member's live quests staked to that venue
      (GET /api/quests/venue/:provider_id) → member picks one.
   4. POST /api/quests/checkin → waiting screen polls until the provider approves
      or declines. On approval, refreshes the Quests panel.

   Venue QR payload accepted: a link containing ?venue=<uuid>, "ffpvenue:<uuid>",
   or a bare provider UUID.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API = 'https://ffp-passport-backend.vercel.app';
  var QR_LIB = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
  var _h5 = null;       // active scanner instance
  var _poll = null;     // active poll timer

  function memberId() {
    try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}')).id || ''; } catch (e) { return ''; }
  }
  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function waitFor(check, ms) {
    return new Promise(function (resolve) {
      var t = 0, lim = Math.ceil((ms || 20000) / 150);
      var iv = setInterval(function () { if (check() || t++ >= lim) { clearInterval(iv); resolve(check()); } }, 150);
    });
  }
  function parseVenue(text) {
    if (!text) return null;
    var uuid = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
    var m = String(text).match(/[?&]venue=([^&\s]+)/);
    if (m) { var u = m[1].match(uuid); return u ? u[0] : null; }
    var u2 = String(text).match(uuid);
    return u2 ? u2[0] : null;
  }

  function injectStyles() {
    if (document.getElementById('ffp-qscan-css')) return;
    var s = document.createElement('style');
    s.id = 'ffp-qscan-css';
    s.textContent = [
      '.q-scan-btn{width:100%;margin:0 0 18px;background:var(--q-yellow,#FFCC00);color:#000;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;}',
      '.q-scan-btn .material-icons{font-size:20px;}',
      '.qs-back{position:fixed;inset:0;background:rgba(4,10,16,0.82);z-index:9500;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(3px);}',
      '.qs-sheet{background:#0f1e2e;border:1px solid rgba(43,168,224,0.2);border-top-left-radius:22px;border-top-right-radius:22px;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;padding:20px 20px 28px;animation:qsUp .22s ease;}',
      '@keyframes qsUp{from{transform:translateY(40px);opacity:0;}to{transform:translateY(0);opacity:1;}}',
      '.qs-grip{width:40px;height:4px;border-radius:4px;background:rgba(255,255,255,0.4);margin:0 auto 16px;}',
      '.qs-title{font-size:19px;font-weight:800;color:#e8eef4;margin-bottom:4px;}',
      '.qs-sub{font-size:13px;color:#8a99a8;margin-bottom:18px;line-height:1.5;}',
      '#q-reader{width:100%;border-radius:14px;overflow:hidden;background:#000;min-height:240px;}',
      '.qs-opt{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.2);border-radius:14px;padding:15px;margin-bottom:10px;color:#e8eef4;cursor:pointer;}',
      '.qs-opt[disabled]{opacity:.45;cursor:default;}',
      '.qs-opt .material-icons{font-size:24px;color:var(--q-yellow,#FFCC00);}',
      '.qs-opt .ot{font-size:15px;font-weight:800;}',
      '.qs-opt .os{font-size:11.5px;color:#8a99a8;margin-top:2px;}',
      '.qs-quest{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid rgba(43,168,224,0.12);cursor:pointer;}',
      '.qs-quest .qt{font-size:14px;font-weight:800;color:#e8eef4;}',
      '.qs-quest .qm{font-size:11.5px;color:#8a99a8;margin-top:2px;text-transform:capitalize;}',
      '.qs-quest .material-icons{color:#8a99a8;}',
      '.qs-input{width:100%;background:#08131f;border:1px solid rgba(43,168,224,0.25);border-radius:10px;padding:12px;color:#e8eef4;font-size:14px;margin-top:6px;}',
      '.qs-btn{width:100%;margin-top:14px;background:var(--q-yellow,#FFCC00);color:#000;border:none;border-radius:11px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;}',
      '.qs-btn.ghost{background:rgba(255,255,255,0.08);color:#e8eef4;}',
      '.qs-spin{width:46px;height:46px;border-radius:50%;border:4px solid rgba(255,204,0,0.25);border-top-color:#FFCC00;margin:18px auto;animation:qsSpin 1s linear infinite;}',
      '@keyframes qsSpin{to{transform:rotate(360deg);}}',
      '.qs-center{text-align:center;}',
      '.qs-ok{width:64px;height:64px;border-radius:50%;background:rgba(74,222,128,0.16);color:#4ade80;display:flex;align-items:center;justify-content:center;margin:8px auto 14px;}',
      '.qs-ok .material-icons{font-size:36px;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── sheet ──
  function openSheet(html) {
    closeSheet();
    var b = document.createElement('div');
    b.className = 'qs-back'; b.id = 'qs-back';
    b.innerHTML = '<div class="qs-sheet"><div class="qs-grip"></div>' + html + '</div>';
    b.addEventListener('click', function (e) { if (e.target === b) closeSheet(); });
    document.body.appendChild(b);
  }
  function closeSheet() {
    stopScanner();
    if (_poll) { clearInterval(_poll); _poll = null; }
    var b = document.getElementById('qs-back'); if (b) b.remove();
  }
  window.FFPQuestScan = { close: closeSheet };

  function stopScanner() {
    if (_h5) { try { _h5.stop().then(function () { try { _h5.clear(); } catch (e) {} }).catch(function () {}); } catch (e) {} _h5 = null; }
  }

  // ── 1. scan ──
  function startScan() {
    openSheet(
      '<div class="qs-title">Check in</div>' +
      '<div class="qs-sub">Point your camera at the venue\'s FFP QR code.</div>' +
      '<div id="q-reader"></div>' +
      '<div class="qs-sub" style="margin:14px 0 0;">No camera? Paste the venue link or code:</div>' +
      '<input class="qs-input" id="q-manual" placeholder="Paste link or venue code">' +
      '<button class="qs-btn" onclick="FFPQuestScan._manual()">Continue</button>' +
      '<button class="qs-btn ghost" onclick="FFPQuestScan.close()">Cancel</button>'
    );
    loadQrLib(function (err) {
      if (err || !window.Html5Qrcode) return; // fallback input still available
      try {
        _h5 = new window.Html5Qrcode('q-reader');
        _h5.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } },
          function (decoded) { var v = parseVenue(decoded); if (v) { stopScanner(); openContext(v); } },
          function () {}
        ).catch(function () {});
      } catch (e) {}
    });
  }
  function manual() {
    var t = document.getElementById('q-manual');
    var v = parseVenue(t ? t.value : '');
    if (!v) { if (typeof window.showToast === 'function') window.showToast('Couldn\'t read a venue from that', 'error'); return; }
    openContext(v);
  }

  function loadQrLib(cb) {
    if (window.Html5Qrcode) return cb();
    var s = document.createElement('script');
    s.src = QR_LIB;
    s.onload = function () { cb(); };
    s.onerror = function () { cb(new Error('qr lib failed')); };
    document.head.appendChild(s);
  }

  // ── 2. context ──
  function openContext(providerId) {
    openSheet(
      '<div class="qs-title">What are you here for?</div>' +
      '<div class="qs-sub">Pick what you\'re checking in for at this venue.</div>' +
      '<button class="qs-opt" onclick="FFPQuestScan._quests(\'' + providerId + '\')">' +
        '<span class="material-icons">flag</span><div><div class="ot">Quest</div><div class="os">Stamp a step toward a quest</div></div></button>' +
      '<button class="qs-opt" disabled><span class="material-icons">event</span><div><div class="ot">Event</div><div class="os">Coming soon</div></div></button>' +
      '<button class="qs-opt" disabled><span class="material-icons">flight</span><div><div class="ot">Experience</div><div class="os">Coming soon</div></div></button>' +
      '<button class="qs-btn ghost" onclick="FFPQuestScan.close()">Cancel</button>'
    );
  }

  // ── 3. pick quest ──
  async function pickQuest(providerId) {
    openSheet('<div class="qs-title">Your quests here</div><div class="qs-spin"></div>');
    var mid = memberId();
    var quests = [];
    try {
      var res = await fetch(API + '/api/quests/venue/' + providerId + (mid ? ('?member_id=' + encodeURIComponent(mid)) : ''));
      var json = await res.json();
      quests = (json && json.quests) ? json.quests : [];
    } catch (e) {}
    if (!quests.length) {
      openSheet('<div class="qs-title">Your quests here</div><div class="qs-sub">No live quests at this venue yet. Check back soon.</div><button class="qs-btn ghost" onclick="FFPQuestScan.close()">Close</button>');
      return;
    }
    var list = quests.map(function (q) {
      var pc = (q.progress && q.progress.completed_count) || 0;
      return '<div class="qs-quest" onclick="FFPQuestScan._send(\'' + providerId + '\',\'' + q.id + '\')">' +
        '<div><div class="qt">' + esc(q.title) + '</div><div class="qm">' + esc(q.scope) + ' · ' + esc(q.category) + ' · ' + pc + ' of ' + q.target_count + ' stamped</div></div>' +
        '<span class="material-icons">chevron_right</span></div>';
    }).join('');
    openSheet('<div class="qs-title">Your quests here</div><div class="qs-sub">Tap the quest you want to stamp.</div>' + list +
      '<button class="qs-btn ghost" onclick="FFPQuestScan.close()">Cancel</button>');
  }

  // ── 4. send + wait ──
  async function send(providerId, questId) {
    openSheet('<div class="qs-title">Sending your request…</div><div class="qs-spin"></div>');
    var mid = memberId();
    if (!mid) { resultMsg('error', 'Not signed in', 'Please sign in again.'); return; }
    var checkinId = null;
    try {
      var res = await fetch(API + '/api/quests/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: mid, quest_id: questId, provider_id: providerId })
      });
      var json = await res.json();
      if (!res.ok || !json.success) { resultMsg('error', 'Couldn\'t check in', (json && json.error) || 'Please try again.'); return; }
      checkinId = json.checkin_id;
    } catch (e) { resultMsg('error', 'Couldn\'t check in', 'Network error — try again.'); return; }
    waitApproval(checkinId);
  }

  function waitApproval(id) {
    openSheet(
      '<div class="qs-center"><div class="qs-title">Waiting for the venue</div>' +
      '<div class="qs-sub">Show this to the staff — they\'ll approve your check-in on their side.</div>' +
      '<div class="qs-spin"></div>' +
      '<button class="qs-btn ghost" onclick="FFPQuestScan.close()">Cancel</button></div>'
    );
    var tries = 0;
    _poll = setInterval(async function () {
      tries++;
      if (tries > 100) { clearInterval(_poll); _poll = null; return; } // ~5 min
      try {
        var res = await fetch(API + '/api/quests/checkin/' + id);
        var json = await res.json();
        var st = json && json.checkin && json.checkin.status;
        if (st === 'approved') {
          clearInterval(_poll); _poll = null;
          resultMsg('ok', 'Stamped!', 'The venue approved your check-in. Nice work.');
          if (window.Quests && typeof window.Quests.load === 'function') { try { window.Quests.load(); } catch (e) {} }
        } else if (st === 'declined') {
          clearInterval(_poll); _poll = null;
          resultMsg('error', 'Not approved', 'The venue didn\'t approve this check-in.');
        }
      } catch (e) {}
    }, 3000);
  }

  function resultMsg(kind, title, sub) {
    if (_poll) { clearInterval(_poll); _poll = null; }
    var icon = kind === 'ok'
      ? '<div class="qs-ok"><span class="material-icons">check</span></div>'
      : '<div class="qs-ok" style="background:rgba(239,68,68,0.16);color:#ef4444;"><span class="material-icons">close</span></div>';
    openSheet('<div class="qs-center">' + icon + '<div class="qs-title">' + esc(title) + '</div>' +
      '<div class="qs-sub">' + esc(sub) + '</div>' +
      '<button class="qs-btn" onclick="FFPQuestScan.close()">Done</button></div>');
  }

  // expose flow steps used by inline onclick
  window.FFPQuestScan._manual = manual;
  window.FFPQuestScan._quests = pickQuest;
  window.FFPQuestScan._send = send;

  function injectButton() {
    var panel = document.getElementById('panel-quests');
    if (!panel || document.getElementById('q-scan-btn')) return;
    var head = panel.querySelector('.user-panel-head');
    var btn = document.createElement('button');
    btn.id = 'q-scan-btn';
    btn.className = 'q-scan-btn';
    btn.innerHTML = '<span class="material-icons">qr_code_scanner</span> Check in at a venue';
    btn.addEventListener('click', startScan);
    if (head && head.parentNode) head.parentNode.insertBefore(btn, head.nextSibling);
    else panel.insertBefore(btn, panel.firstChild);
  }

  async function init() {
    var ok = await waitFor(function () { return document.getElementById('panel-quests'); }, 20000);
    if (!ok) { console.warn('[FFP Quest Scan] quests panel not found'); return; }
    injectStyles();
    injectButton();
    // handle ?venue=<id> from a phone-camera scan of a venue link
    var v = parseVenue(window.location.search);
    if (v) {
      var navBtn = document.querySelector('.nav-item[data-panel="panel-quests"]');
      if (navBtn) navBtn.click();
      setTimeout(function () { openContext(v); }, 400);
    }
    console.log('[FFP Quest Scan v1] Loaded ✓');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

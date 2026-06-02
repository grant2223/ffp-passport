/* ═══════════════════════════════════════════════════════════════
   FFP MEMBER CHECK-IN LOADER — v2 (2026-06-02)
   SINGLE source of truth for member VENUE CHECK-IN (≠ Log Activity).

   CHECK-IN (this file) = "I'm physically at a provider's venue."
     Scan the venue QR (in-app camera) OR arrive via a phone-camera scan of
     the venue link (?venue=<provider_id>) → resolve the provider → show ONLY
     that provider's own activities (providers.activities) → tap one → GPS →
     venue_checkin_activity RPC logs it + marks verified if on-site (≤250 m).
     It NEVER shows the full activity taxonomy. If the venue has listed no
     activities, we say so rather than falling back to the full list.

   LOG ACTIVITY (separate — the dashboard's own Log Activity button/modal) =
     "I did something anywhere" (run, swim, weights…). Full activity list, no
     provider, no GPS. That lives in ffp-member-dashboard.html, not here.

   v2 changes: removed the full-taxonomy fallback; full-page modal; activities
   shown as a scrollable list of tappable buttons (not a <select>).
   (No version suffix in the filename — version lives here + the ?v= cache-bust.)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var QR_LIB = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
  var _h5 = null;
  var _pickedAct = '';

  function sb() { return window.supabase; }
  function memberId() { try { var m = JSON.parse(localStorage.getItem('ffp_member') || '{}'); return m && m.id; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function toast(m, k) { if (typeof window.showToast === 'function') { try { window.showToast(m, k || 'info'); return; } catch (e) {} } console.log('[FFP Check-in]', m); }
  function parseVenue(t) {
    if (!t) return null;
    var m = String(t).match(/[?&]venue=([0-9a-fA-F-]{36})/); if (m) return m[1];
    m = String(t).match(/ffpvenue:([0-9a-fA-F-]{36})/); if (m) return m[1];
    var s = String(t).trim(); if (/^[0-9a-fA-F-]{36}$/.test(s)) return s;
    return null;
  }

  function injectCss() {
    if (document.getElementById('ffp-ci-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-ci-css';
    s.textContent = [
      '#ci-back{position:fixed;inset:0;z-index:9000;background:rgba(4,10,18,.66);display:flex;align-items:flex-end;justify-content:center;}',
      '@media(min-width:560px){#ci-back{align-items:center;}}',
      '#ci-back .ci-sheet{width:100%;max-width:480px;background:#0f1e2e;border:1px solid rgba(43,168,224,.22);border-radius:18px 18px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom));max-height:90vh;overflow-y:auto;}',
      '@media(min-width:560px){#ci-back .ci-sheet{border-radius:18px;}}',
      /* full-page variant for the activity-pick step */
      '#ci-back .ci-sheet.full{max-width:560px;height:100dvh;max-height:100dvh;border-radius:0;overflow:hidden;display:flex;flex-direction:column;}',
      '@media(min-width:560px){#ci-back .ci-sheet.full{height:92vh;max-height:92vh;border-radius:18px;}}',
      '#ci-back .ci-acts{display:flex;flex-direction:column;gap:9px;overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;min-height:0;margin:2px 0 12px;padding:2px;}',
      '#ci-back .ci-act{width:100%;text-align:left;background:#081420;border:1.5px solid rgba(43,168,224,.28);border-radius:12px;color:#e8eef4;font-size:15px;font-weight:700;padding:15px 16px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:space-between;gap:10px;}',
      '#ci-back .ci-act:active{transform:scale(.99);}',
      '#ci-back .ci-act.sel{border-color:#FFCC00;background:rgba(255,204,0,.12);color:#fff;}',
      '#ci-back .ci-act .tick{opacity:0;color:#FFCC00;font-weight:900;font-size:17px;}',
      '#ci-back .ci-act.sel .tick{opacity:1;}',
      '#ci-back .ci-foot{flex:0 0 auto;}',
      '#ci-back .ci-empty{font-size:14px;color:#9dbdd0;text-align:center;padding:30px 10px;line-height:1.6;}',
      '#ci-back .ci-grip{width:40px;height:4px;border-radius:4px;background:rgba(255,255,255,.18);margin:0 auto 14px;}',
      '#ci-back .ci-title{font-size:18px;font-weight:900;color:#fff;text-align:center;}',
      '#ci-back .ci-sub{font-size:13px;color:#9dbdd0;text-align:center;margin:6px 0 16px;line-height:1.5;}',
      '#ci-back .ci-input{width:100%;background:#081420;border:1px solid rgba(43,168,224,.3);border-radius:11px;color:#e8eef4;font-size:15px;font-weight:600;padding:13px 14px;font-family:inherit;box-sizing:border-box;}',
      '#ci-back select.ci-input{appearance:none;}',
      '#ci-back .ci-btn{width:100%;margin-top:12px;background:#FFCC00;color:#082335;border:none;border-radius:11px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;}',
      '#ci-back .ci-btn.ghost{background:transparent;color:#9dbdd0;border:1px solid rgba(43,168,224,.25);}',
      '#ci-back #ci-reader{width:100%;border-radius:12px;overflow:hidden;margin:4px 0;}',
      '#ci-back .ci-spin{width:34px;height:34px;border:3px solid rgba(43,168,224,.25);border-top-color:#2ba8e0;border-radius:50%;margin:24px auto;animation:ci-rot .8s linear infinite;}',
      '@keyframes ci-rot{to{transform:rotate(360deg);}}',
      '#ci-back .ci-ok{width:64px;height:64px;border-radius:50%;background:rgba(34,197,94,.16);color:#22c55e;display:flex;align-items:center;justify-content:center;margin:6px auto 12px;}',
      '#ci-back .ci-ok .material-icons{font-size:34px;}',
      '.ci-launch{width:100%;margin:0 0 18px;background:#FFCC00;color:#081420;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;font-family:inherit;}'
    ].join('');
    document.head.appendChild(s);
  }

  function openSheet(html, full) {
    closeSheet();
    var b = document.createElement('div'); b.id = 'ci-back';
    b.innerHTML = '<div class="ci-sheet' + (full ? ' full' : '') + '"><div class="ci-grip"></div>' + html + '</div>';
    b.addEventListener('click', function (e) { if (e.target === b) closeSheet(); });
    document.body.appendChild(b);
  }
  function closeSheet() { stopScanner(); var b = document.getElementById('ci-back'); if (b) b.remove(); }
  function stopScanner() { if (_h5) { try { _h5.stop().then(function () { try { _h5.clear(); } catch (e) {} }).catch(function () {}); } catch (e) {} _h5 = null; } }

  function loadQrLib(cb) {
    if (window.Html5Qrcode) return cb();
    var s = document.createElement('script'); s.src = QR_LIB;
    s.onload = function () { cb(); }; s.onerror = function () { cb(new Error('qr lib failed')); };
    document.head.appendChild(s);
  }

  // ── 1. in-app scan ──
  function startScan() {
    injectCss();
    openSheet(
      '<div class="ci-title">Check in</div>' +
      '<div class="ci-sub">Point your camera at the venue’s FFP QR code.</div>' +
      '<div id="ci-reader"></div>' +
      '<div class="ci-sub" style="margin:14px 0 0;">No camera? Paste the venue link or code:</div>' +
      '<input class="ci-input" id="ci-manual" placeholder="Paste link or venue code">' +
      '<button class="ci-btn" onclick="FFPCheckin._manual()">Continue</button>' +
      '<button class="ci-btn ghost" onclick="FFPCheckin.close()">Cancel</button>'
    );
    loadQrLib(function (err) {
      if (err || !window.Html5Qrcode) return;
      try {
        _h5 = new window.Html5Qrcode('ci-reader');
        _h5.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } },
          function (decoded) { var v = parseVenue(decoded); if (v) { stopScanner(); openContext(v); } },
          function () {}).catch(function () {});
      } catch (e) {}
    });
  }
  function manual() {
    var t = document.getElementById('ci-manual');
    var v = parseVenue(t ? t.value : '');
    if (!v) { toast('Couldn’t read a venue from that', 'error'); return; }
    openContext(v);
  }

  // ── 2. context: resolve provider + show its activities ──
  async function openContext(providerId) {
    injectCss();
    openSheet('<div class="ci-title">One sec…</div><div class="ci-spin"></div>');
    var prov = null;
    try {
      var r = await sb().from('providers').select('business_name, activities, status').eq('id', providerId).maybeSingle();
      prov = r.data;
    } catch (e) {}
    if (!prov) { resultMsg('error', 'Venue not found', 'That QR didn’t match an FFP venue.'); return; }
    _pickedAct = '';
    // CHECK-IN shows ONLY this provider's own activities. No full-taxonomy fallback —
    // logging an arbitrary activity (run/swim/weights anywhere) is the separate
    // "Log Activity" flow on the dashboard, not a venue check-in.
    var acts = (prov.activities && prov.activities.length) ? prov.activities.slice() : [];
    var name = esc(prov.business_name || 'this venue');
    if (!acts.length) {
      openSheet(
        '<div class="ci-title">You’re at ' + name + '</div>' +
        '<div class="ci-empty">This venue hasn’t listed its activities yet, so there’s nothing to check into here right now.<br><br>You can still log a workout from your passport using <b>Log Activity</b>.</div>' +
        '<div class="ci-foot"><button class="ci-btn ghost" onclick="FFPCheckin.close()">Close</button></div>',
        true
      );
      return;
    }
    var items = acts.map(function (a) {
      return '<button type="button" class="ci-act" data-val="' + esc(a) + '" onclick="FFPCheckin._pick(this)">' +
             '<span>' + esc(a) + '</span><span class="tick">✓</span></button>';
    }).join('');
    openSheet(
      '<div class="ci-title">You’re at ' + name + '</div>' +
      '<div class="ci-sub">What did you do here? Tap an activity — it saves to your passport.</div>' +
      '<div class="ci-acts">' + items + '</div>' +
      '<div class="ci-foot">' +
        '<input class="ci-input" id="ci-dur" type="number" inputmode="numeric" placeholder="Minutes (optional)">' +
        '<button class="ci-btn" style="margin-top:12px;" onclick="FFPCheckin._save(\'' + providerId + '\')">Check in</button>' +
        '<button class="ci-btn ghost" onclick="FFPCheckin.close()">Cancel</button>' +
      '</div>',
      true
    );
  }
  function pickAct(el) {
    if (!el) return;
    _pickedAct = el.getAttribute('data-val') || '';
    var list = el.parentNode ? el.parentNode.querySelectorAll('.ci-act') : [];
    for (var i = 0; i < list.length; i++) list[i].classList.remove('sel');
    el.classList.add('sel');
  }

  // ── 3. save (GPS best-effort → RPC) ──
  function save(providerId) {
    var mid = memberId();
    if (!mid) { resultMsg('error', 'Not signed in', 'Sign in to FFP Passport on this phone, then check in again.'); return; }
    var durEl = document.getElementById('ci-dur');
    var activity = _pickedAct || '';
    if (!activity) { toast('Tap an activity first', 'error'); return; }
    var minutes = durEl && durEl.value ? parseInt(durEl.value, 10) : null;
    openSheet('<div class="ci-title">Checking you in…</div><div class="ci-sub">Confirming you’re at the venue.</div><div class="ci-spin"></div>');
    getPosition(function (coords) { doSave(mid, providerId, activity, minutes, coords); });
  }
  function getPosition(cb) {
    if (!navigator.geolocation) { cb(null); return; }
    var done = false; var t = setTimeout(function () { if (!done) { done = true; cb(null); } }, 8000);
    navigator.geolocation.getCurrentPosition(
      function (p) { if (done) return; done = true; clearTimeout(t); cb({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      function () { if (done) return; done = true; clearTimeout(t); cb(null); },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 });
  }
  async function doSave(mid, providerId, activity, minutes, coords) {
    try {
      var res = await sb().rpc('venue_checkin_activity', {
        p_me: mid, p_provider: providerId, p_activity: activity,
        p_duration_min: (minutes && !isNaN(minutes)) ? minutes : null, p_notes: null,
        p_lat: coords ? coords.lat : null, p_lng: coords ? coords.lng : null
      });
      if (res.error || !res.data) throw (res.error || new Error('no data'));
      var verified = !!res.data.verified;
      resultMsg('ok', verified ? 'Checked in ✓' : 'Logged ✓',
        activity + ' added to your passport' + (verified ? ' · verified on-site.' : '.'));
      try { document.dispatchEvent(new CustomEvent('ffp-activity-logged')); } catch (e) {}
    } catch (e) { console.error('[FFP Check-in] save:', e); resultMsg('error', 'Couldn’t check in', 'Please try again.'); }
  }

  function resultMsg(kind, title, sub) {
    var icon = kind === 'ok'
      ? '<div class="ci-ok"><span class="material-icons">check</span></div>'
      : '<div class="ci-ok" style="background:rgba(239,68,68,.16);color:#ef4444;"><span class="material-icons">close</span></div>';
    openSheet(icon + '<div class="ci-title">' + esc(title) + '</div><div class="ci-sub">' + esc(sub) + '</div>' +
      '<button class="ci-btn" onclick="FFPCheckin.close()">Done</button>');
  }

  // ── public + boot ──
  window.FFPCheckin = { scan: startScan, close: closeSheet, _manual: manual, _save: save, _context: openContext, _pick: pickAct };

  function boot() {
    injectCss();
    // NO injected button — the single entry point is the "Scan QR" button on the Passport
    // panel (onclick="openScanLog()" → FFPCheckin.scan()). A phone-camera scan of the venue
    // link also lands here as ?venue=<id> and opens the check-in directly.
    var v = parseVenue(window.location.search);
    if (v) { setTimeout(function () { openContext(v); }, 600); }
    console.log('[FFP Member Check-in v2] Loaded ✓ (launch: Scan QR button / ?venue link)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ═══════════════════════════════════════════════════════════════
   FFP MEMBER CHECK-IN LOADER — v1 (2026-06-01)
   SINGLE source of truth for member venue check-in.
   Replaces ffp-member-quest-scan-loader.js AND the phantom ...-v2.js ref.
   (No version suffix in the filename — version lives here + the ?v= cache-bust.)

   Flow: tap "Check in at a venue" (in-app scanner) OR arrive via a phone-camera
   scan of the venue link (?venue=<provider_id>) → resolve the provider →
   "You're at [Provider] — what did you do?" showing the PROVIDER'S own activity
   list → pick one → request GPS → venue_checkin_activity RPC logs it to the
   member's passport and marks it verified if they're on-site (≤250 m).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var QR_LIB = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
  var _h5 = null;

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

  function openSheet(html) {
    closeSheet();
    var b = document.createElement('div'); b.id = 'ci-back';
    b.innerHTML = '<div class="ci-sheet"><div class="ci-grip"></div>' + html + '</div>';
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
    var acts = (prov.activities && prov.activities.length)
      ? prov.activities
      : ((window.FFP_TAX && window.FFP_TAX.activities) || []).map(function (a) { return (a && a.n) ? a.n : a; });
    var opts = acts.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + '</option>'; }).join('');
    openSheet(
      '<div class="ci-title">You’re at ' + esc(prov.business_name || 'this venue') + '</div>' +
      '<div class="ci-sub">What did you do here? It saves to your passport.</div>' +
      '<select class="ci-input" id="ci-act">' + (opts || '<option value="">No activities listed</option>') + '</select>' +
      '<input class="ci-input" id="ci-dur" type="number" inputmode="numeric" placeholder="Minutes (optional)" style="margin-top:10px;">' +
      '<button class="ci-btn" onclick="FFPCheckin._save(\'' + providerId + '\')">Check in</button>' +
      '<button class="ci-btn ghost" onclick="FFPCheckin.close()">Cancel</button>'
    );
  }

  // ── 3. save (GPS best-effort → RPC) ──
  function save(providerId) {
    var mid = memberId();
    if (!mid) { resultMsg('error', 'Not signed in', 'Sign in to FFP Passport on this phone, then check in again.'); return; }
    var actEl = document.getElementById('ci-act'), durEl = document.getElementById('ci-dur');
    var activity = actEl ? actEl.value : '';
    if (!activity) { toast('Pick an activity first', 'error'); return; }
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
  window.FFPCheckin = { scan: startScan, close: closeSheet, _manual: manual, _save: save, _context: openContext };

  function injectButton() {
    var panel = document.getElementById('panel-quests');
    if (!panel || document.getElementById('ci-launch-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'ci-launch-btn'; btn.className = 'ci-launch';
    btn.innerHTML = '<span class="material-icons">qr_code_scanner</span> Check in at a venue';
    btn.addEventListener('click', startScan);
    var hero = document.getElementById('quest-hero');
    if (hero && hero.parentNode) hero.parentNode.insertBefore(btn, hero.nextSibling);
    else panel.insertBefore(btn, panel.firstChild);
  }

  function boot() {
    injectCss();
    injectButton();
    // phone-camera scan of the venue link lands here as ?venue=<id>
    var v = parseVenue(window.location.search);
    if (v) { setTimeout(function () { openContext(v); }, 600); }
    console.log('[FFP Member Check-in v1] Loaded ✓');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ═══════════════════════════════════════════════════════════════
   FFP MEMBER CHECK-IN LOADER — v6 (2026-06-03)
   v6: SMOOTHER PHONE-QR FLOW. A phone-camera scan lands on the dashboard as ?venue=<id>; if the
       visitor isn't signed in, the auth gate used to redirect to login and DROP the venue, so
       they never reached the check-in. Now the dashboard <head> stashes the venue
       (localStorage 'ffp_pending_venue') BEFORE the auth redirect, and boot() resumes the
       check-in from the URL param OR the stash once signed in (then clears it). Signed-in scans
       open immediately as before.
   --- prior ---
   v5 (2026-06-03)
   v5: 2-HOUR PER-VENUE COOLDOWN. A member can't repeatedly check in at the SAME
       provider within 2 hours (server-enforced in venue_checkin_activity, which now
       returns {blocked:true, minutes_left, venue, message} instead of inserting).
       doSave shows a friendly "Already checked in here" sheet. A check-in at a
       DIFFERENT venue is unaffected.
   --- prior ---
   v4 (2026-06-02)
   v4: DECLUTTERED the check-in sheet. Active programs are now a single 3-across
       button row — Quest / Event / Challenge (a type is tappable only if it has
       live items; tap → that type's list, or straight in if there's only one).
       Removed the "just checking in — no activity" button. The check-in now has
       Minutes + Calories side by side (calories persisted via venue_checkin_activity
       p_calories). Programs/sub-flows + RPCs unchanged from v3.
   v3: ACTIVE PROGRAMS pinned to the TOP of the check-in sheet (yellow), only when
       the venue has a live quest/challenge/event (venue_active_programs RPC). Tap →
       quest: submit task (pending until provider approves, member_quest_submit);
       challenge: enter scorecard result (pending verify, member_challenge_submit);
       event: auto on-site check-in → passport (member_event_checkin, fires
       ffp-activity-logged). The provider's own activities + general check-in sit below.
   ─────────────────────────────────────────────────────────────────
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
   shown as a scrollable list of tappable buttons (not a <select>); the venue
   LOGO (or monogram) is shown at the top for a sense of belonging; a member can
   ALWAYS check in generally ("Just checking in — no activity" → activity "Visit"),
   whether or not the venue has listed activities. NEXT: pin this venue's active
   quests/challenges to the TOP of the list (quest_venues / challenges.provider_id).
   (No version suffix in the filename — version lives here + the ?v= cache-bust.)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var QR_LIB = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
  var _h5 = null;
  var _pickedAct = '';
  var _programs = null;   // { quests:[], challenges:[], events:[] } for the current venue
  var _provId = null;
  var _prov = null;

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
      '#ci-back .ci-logo{width:64px;height:64px;border-radius:16px;object-fit:cover;background:#081420;border:1px solid rgba(43,168,224,.28);display:block;margin:0 auto 10px;}',
      '#ci-back .ci-logo.mono{display:flex;align-items:center;justify-content:center;color:#FFCC00;font-weight:900;font-size:24px;}',
      /* active programs — 3-across category buttons (Quest / Event / Challenge) */
      '#ci-back .ci-seclbl{font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#9dbdd0;margin:2px 2px 8px;}',
      '#ci-back .ci-progrow{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:6px;}',
      '#ci-back .ci-progbtn{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(255,204,0,.10);border:1.5px solid #FFCC00;border-radius:14px;color:#fff;padding:15px 6px;min-height:80px;cursor:pointer;font-family:inherit;}',
      '#ci-back .ci-progbtn:active{transform:scale(.98);}',
      '#ci-back .ci-progbtn .material-icons{font-size:24px;color:#FFCC00;}',
      '#ci-back .ci-progbtn .lbl{font-size:12.5px;font-weight:800;}',
      '#ci-back .ci-progbtn .cnt{position:absolute;top:6px;right:8px;font-size:10px;font-weight:900;background:#FFCC00;color:#082335;border-radius:10px;padding:0 6px;line-height:16px;}',
      '#ci-back .ci-progbtn.off{background:#0b1a28;border-color:rgba(43,168,224,.16);color:#5f7689;cursor:default;}',
      '#ci-back .ci-progbtn.off .material-icons{color:#3f5568;}',
      '#ci-back .ci-dur2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',
      '#ci-back .ci-divlbl{display:flex;align-items:center;gap:10px;color:#9dbdd0;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;margin:10px 2px;}',
      '#ci-back .ci-divlbl::before,#ci-back .ci-divlbl::after{content:"";height:1px;flex:1;background:rgba(43,168,224,.22);}',
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

  // ── 2. context: resolve provider + active programs + activities ──
  async function openContext(providerId) {
    injectCss();
    openSheet('<div class="ci-title">One sec…</div><div class="ci-spin"></div>');
    var prov = null;
    try {
      var r = await sb().from('providers').select('business_name, activities, status, logo_url').eq('id', providerId).maybeSingle();
      prov = r.data;
    } catch (e) {}
    if (!prov) { resultMsg('error', 'Venue not found', 'That QR didn’t match an FFP venue.'); return; }
    // active quests/challenges/events for this venue (yellow, pinned at the top)
    _programs = { quests: [], challenges: [], events: [] };
    try {
      var pr = await sb().rpc('venue_active_programs', { p_provider: providerId });
      if (pr && pr.data) _programs = pr.data;
    } catch (e) {}
    _pickedAct = ''; _provId = providerId; _prov = prov;
    var name = esc(prov.business_name || 'this venue');
    var logo = logoHtml(prov);
    var progHtml = programsHtml();

    // CHECK-IN shows ONLY this provider's own activities (no full-taxonomy fallback) —
    // logging an arbitrary activity anywhere is the separate "Log Activity" flow. A member
    // can ALWAYS just check in (general visit), with or without listed activities.
    var acts = (prov.activities && prov.activities.length) ? prov.activities.slice() : [];
    var head = logo + '<div class="ci-title">You’re at ' + name + '</div>';

    var durFields =
      '<div class="ci-dur2">' +
        '<input class="ci-input" id="ci-dur" type="number" inputmode="numeric" placeholder="Minutes">' +
        '<input class="ci-input" id="ci-cal" type="number" inputmode="numeric" placeholder="Calories">' +
      '</div>';
    if (!acts.length) {
      openSheet(
        head + progHtml +
        '<div class="ci-sub">Check in to log your visit to this venue.</div>' +
        '<div class="ci-foot">' +
          durFields +
          '<button class="ci-btn" style="margin-top:12px;" onclick="FFPCheckin._save(\'' + providerId + '\',\'Visit\')">Check in</button>' +
          '<button class="ci-btn ghost" onclick="FFPCheckin.close()">Cancel</button>' +
        '</div>',
        true
      );
      return;
    }
    var items = acts.map(function (a) {
      return '<button type="button" class="ci-act" data-val="' + esc(a) + '" onclick="FFPCheckin._pick(this)">' +
             '<span>' + esc(a) + '</span><span class="tick">✓</span></button>';
    }).join('');
    var actLabel = progHtml ? '<div class="ci-divlbl">Or log your visit</div>' : '<div class="ci-sub">What did you do here? Tap an activity — it saves to your passport.</div>';
    openSheet(
      head + progHtml + actLabel +
      '<div class="ci-acts">' + items + '</div>' +
      '<div class="ci-foot">' +
        durFields +
        '<button class="ci-btn" style="margin-top:12px;" onclick="FFPCheckin._save(\'' + providerId + '\')">Check in</button>' +
        '<button class="ci-btn ghost" onclick="FFPCheckin.close()">Cancel</button>' +
      '</div>',
      true
    );
  }

  // Active programs as a clean 3-across row: Quest / Event / Challenge.
  // A type is tappable only if it has live items; tapping opens that type's list
  // (or goes straight in when there's only one). Hidden entirely if nothing's live.
  function programsHtml() {
    var p = _programs || {};
    var nq = (p.quests || []).length, ne = (p.events || []).length, nc = (p.challenges || []).length;
    if (!nq && !ne && !nc) return '';
    return '<div class="ci-seclbl">Available here now</div>' +
      '<div class="ci-progrow">' +
        progBtn('quest', 'flag', 'Quest', nq) +
        progBtn('event', 'event', 'Event', ne) +
        progBtn('challenge', 'emoji_events', 'Challenge', nc) +
      '</div>';
  }
  function progBtn(type, icon, label, n) {
    if (!n) return '<div class="ci-progbtn off"><span class="material-icons">' + icon + '</span><span class="lbl">' + label + '</span></div>';
    return '<button type="button" class="ci-progbtn" onclick="FFPCheckin._pickType(\'' + type + '\')">' +
           (n > 1 ? '<span class="cnt">' + n + '</span>' : '') +
           '<span class="material-icons">' + icon + '</span><span class="lbl">' + label + '</span></button>';
  }
  // Step 2: choose which item of that type (skip straight in when there's only one).
  function pickType(type) {
    var list = (_programs && _programs[type + 's']) || [];
    if (!list.length) return;
    if (list.length === 1) { program(type, 0); return; }
    var heading = type === 'quest' ? 'quest' : (type === 'event' ? 'event' : 'challenge');
    var items = list.map(function (it, i) {
      var sub = type === 'event' ? eventWhen(it.starts_at)
              : (type === 'challenge' ? (it.metric ? ('Enter your ' + it.metric) : '')
              : (it.target_count ? ('Complete ' + it.target_count) : ''));
      return '<button type="button" class="ci-act" onclick="FFPCheckin._program(\'' + type + '\',' + i + ')">' +
             '<span>' + esc(it.title || heading) + (sub ? ('<br><span style="font-size:11.5px;color:#9dbdd0;font-weight:600;">' + esc(sub) + '</span>') : '') + '</span>' +
             '<span class="tick" style="opacity:1;">›</span></button>';
    }).join('');
    openSheet(
      '<div class="ci-seclbl">Choose a ' + esc(heading) + '</div>' +
      '<div class="ci-acts">' + items + '</div>' +
      '<div class="ci-foot"><button class="ci-btn ghost" onclick="FFPCheckin._context(\'' + _provId + '\')">Back</button></div>',
      true
    );
  }
  function eventWhen(ts) {
    if (!ts) return 'Event';
    try { var d = new Date(ts); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return 'Event'; }
  }
  function logoHtml(prov) {
    if (prov && prov.logo_url) return '<img class="ci-logo" src="' + esc(prov.logo_url) + '" alt="" onerror="this.style.display=\'none\'">';
    var n = (prov && prov.business_name) ? prov.business_name.trim().charAt(0).toUpperCase() : '?';
    return '<div class="ci-logo mono">' + esc(n) + '</div>';
  }
  function pickAct(el) {
    if (!el) return;
    _pickedAct = el.getAttribute('data-val') || '';
    var list = el.parentNode ? el.parentNode.querySelectorAll('.ci-act') : [];
    for (var i = 0; i < list.length; i++) list[i].classList.remove('sel');
    el.classList.add('sel');
  }

  // ── 3. save (GPS best-effort → RPC) ──
  function save(providerId, forced) {
    var mid = memberId();
    if (!mid) { resultMsg('error', 'Not signed in', 'Sign in to FFP Passport on this phone, then check in again.'); return; }
    var durEl = document.getElementById('ci-dur'), calEl = document.getElementById('ci-cal');
    var activity = forced || _pickedAct || '';
    if (!activity) { toast('Tap an activity first', 'error'); return; }
    var minutes = durEl && durEl.value ? parseInt(durEl.value, 10) : null;
    var calories = calEl && calEl.value ? parseInt(calEl.value, 10) : null;
    openSheet('<div class="ci-title">Checking you in…</div><div class="ci-sub">Confirming you’re at the venue.</div><div class="ci-spin"></div>');
    getPosition(function (coords) { doSave(mid, providerId, activity, minutes, calories, coords); });
  }
  function getPosition(cb) {
    if (!navigator.geolocation) { cb(null); return; }
    var done = false; var t = setTimeout(function () { if (!done) { done = true; cb(null); } }, 8000);
    navigator.geolocation.getCurrentPosition(
      function (p) { if (done) return; done = true; clearTimeout(t); cb({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      function () { if (done) return; done = true; clearTimeout(t); cb(null); },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 });
  }
  async function doSave(mid, providerId, activity, minutes, calories, coords) {
    try {
      var res = await sb().rpc('venue_checkin_activity', {
        p_me: mid, p_provider: providerId, p_activity: activity,
        p_duration_min: (minutes && !isNaN(minutes)) ? minutes : null,
        p_calories: (calories && !isNaN(calories)) ? calories : null, p_notes: null,
        p_lat: coords ? coords.lat : null, p_lng: coords ? coords.lng : null
      });
      if (res.error || !res.data) throw (res.error || new Error('no data'));
      // 2-hour per-venue cooldown: the RPC returns {blocked:true,...} instead of inserting.
      if (res.data.blocked) {
        resultMsg('error', 'Already checked in here',
          res.data.message || 'You can check in again at this venue in a couple of hours.');
        return;
      }
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

  // ── 4. programs: quest / challenge / event sub-flows ──
  function program(type, idx) {
    var list = (_programs && _programs[type + 's']) || [];
    var it = list[idx]; if (!it) { toast('That’s no longer available', 'error'); return; }
    var vname = esc((_prov && _prov.business_name) || 'this venue');
    if (type === 'quest') {
      openSheet(
        '<div class="ci-seclbl">Quest</div>' +
        '<div class="ci-title">' + esc(it.title || 'Quest') + '</div>' +
        '<div class="ci-sub">' + esc(it.description || 'Complete the task at this venue, then submit. It stays pending until ' + vname + ' approves it.') + '</div>' +
        '<div class="ci-foot">' +
          '<button class="ci-btn" onclick="FFPCheckin._questSubmit(' + idx + ')">I’ve completed this — submit</button>' +
          '<button class="ci-btn ghost" onclick="FFPCheckin._context(\'' + _provId + '\')">Back</button>' +
        '</div>', true
      );
    } else if (type === 'challenge') {
      openSheet(
        '<div class="ci-seclbl">Challenge</div>' +
        '<div class="ci-title">' + esc(it.title || 'Challenge') + '</div>' +
        '<div class="ci-sub">' + esc(it.description || 'Enter your result. It stays pending until ' + vname + ' verifies it.') + '</div>' +
        (it.metric ? '<div class="ci-seclbl" style="margin-top:6px;">Your ' + esc(it.metric) + '</div>' : '') +
        '<input class="ci-input" id="ci-score" type="text" inputmode="decimal" placeholder="' + esc(it.metric ? ('Your ' + it.metric) : 'Your result') + '">' +
        '<div class="ci-foot">' +
          '<button class="ci-btn" style="margin-top:12px;" onclick="FFPCheckin._challengeSubmit(' + idx + ')">Submit result</button>' +
          '<button class="ci-btn ghost" onclick="FFPCheckin._context(\'' + _provId + '\')">Back</button>' +
        '</div>', true
      );
    } else if (type === 'event') {
      openSheet(
        '<div class="ci-seclbl">Event</div>' +
        '<div class="ci-title">' + esc(it.title || 'Event') + '</div>' +
        '<div class="ci-sub">' + esc(eventWhen(it.starts_at)) + (it.activity ? (' · ' + esc(it.activity)) : '') + '</div>' +
        '<div class="ci-foot">' +
          '<button class="ci-btn" onclick="FFPCheckin._eventCheckin(' + idx + ')">Check in to this event</button>' +
          '<button class="ci-btn ghost" onclick="FFPCheckin._context(\'' + _provId + '\')">Back</button>' +
        '</div>', true
      );
    }
  }
  function questSubmit(idx) {
    var mid = memberId(); if (!mid) { resultMsg('error', 'Not signed in', 'Sign in to FFP Passport on this phone, then try again.'); return; }
    var it = ((_programs && _programs.quests) || [])[idx]; if (!it) return;
    openSheet('<div class="ci-title">Submitting…</div><div class="ci-spin"></div>');
    getPosition(function (coords) {
      sb().rpc('member_quest_submit', { p_me: mid, p_quest: it.id, p_provider: _provId, p_lat: coords ? coords.lat : null, p_lng: coords ? coords.lng : null })
        .then(function (res) {
          if (res.error || !res.data || res.data.ok === false) throw (res.error || new Error((res.data && res.data.error) || 'failed'));
          resultMsg('ok', 'Submitted ✓', 'Your quest step is pending approval from ' + esc((_prov && _prov.business_name) || 'the venue') + '.');
        })
        .catch(function (e) { console.error('[FFP Check-in] quest:', e); resultMsg('error', 'Couldn’t submit', 'Please try again.'); });
    });
  }
  function challengeSubmit(idx) {
    var mid = memberId(); if (!mid) { resultMsg('error', 'Not signed in', 'Sign in to FFP Passport on this phone, then try again.'); return; }
    var it = ((_programs && _programs.challenges) || [])[idx]; if (!it) return;
    var el = document.getElementById('ci-score'); var raw = el ? el.value.trim() : '';
    if (!raw) { toast('Enter your result first', 'error'); return; }
    var num = parseFloat(raw.replace(/[^0-9.\-]/g, '')); if (isNaN(num)) num = null;
    openSheet('<div class="ci-title">Submitting…</div><div class="ci-spin"></div>');
    sb().rpc('member_challenge_submit', { p_me: mid, p_challenge: it.id, p_score: num, p_score_text: raw })
      .then(function (res) {
        if (res.error || !res.data || res.data.ok === false) throw (res.error || new Error('failed'));
        resultMsg('ok', 'Result submitted ✓', 'Pending verification from ' + esc((_prov && _prov.business_name) || 'the venue') + '.');
      })
      .catch(function (e) { console.error('[FFP Check-in] challenge:', e); resultMsg('error', 'Couldn’t submit', 'Please try again.'); });
  }
  function eventCheckin(idx) {
    var mid = memberId(); if (!mid) { resultMsg('error', 'Not signed in', 'Sign in to FFP Passport on this phone, then try again.'); return; }
    var it = ((_programs && _programs.events) || [])[idx]; if (!it) return;
    openSheet('<div class="ci-title">Checking you in…</div><div class="ci-sub">Confirming you’re at the venue.</div><div class="ci-spin"></div>');
    getPosition(function (coords) {
      sb().rpc('member_event_checkin', { p_me: mid, p_event: it.id, p_provider: _provId, p_lat: coords ? coords.lat : null, p_lng: coords ? coords.lng : null })
        .then(function (res) {
          if (res.error || !res.data || res.data.ok === false) throw (res.error || new Error('failed'));
          var v = !!res.data.verified;
          resultMsg('ok', v ? 'Checked in ✓' : 'Checked in', esc(it.title || 'Event') + ' added to your passport' + (v ? ' · verified on-site.' : '.'));
          try { document.dispatchEvent(new CustomEvent('ffp-activity-logged')); } catch (e) {}
        })
        .catch(function (e) { console.error('[FFP Check-in] event:', e); resultMsg('error', 'Couldn’t check in', 'Please try again.'); });
    });
  }

  // ── public + boot ──
  window.FFPCheckin = {
    scan: startScan, close: closeSheet, _manual: manual, _save: save, _context: openContext, _pick: pickAct,
    _pickType: pickType, _program: program, _questSubmit: questSubmit, _challengeSubmit: challengeSubmit, _eventCheckin: eventCheckin
  };

  function pendingVenue() { try { return localStorage.getItem('ffp_pending_venue') || ''; } catch (e) { return ''; } }
  function clearPendingVenue() { try { localStorage.removeItem('ffp_pending_venue'); } catch (e) {} }

  function boot() {
    injectCss();
    // Entry points: the "Scan QR" button on the Passport panel (FFPCheckin.scan()), OR a
    // phone-camera scan of the venue link landing here as ?venue=<id>. For the phone-scan
    // case the visitor may not be signed in yet — the head-script stashes the venue and the
    // auth gate sends them to login; once they're back here signed in, we resume the check-in.
    var v = parseVenue(window.location.search) || pendingVenue();
    if (v) {
      if (memberId()) {
        clearPendingVenue();
        setTimeout(function () { openContext(v); }, 600);
      } else {
        // not signed in yet — keep it stashed; the check-in resumes after they log in
        try { localStorage.setItem('ffp_pending_venue', v); } catch (e) {}
      }
    }
    console.log('[FFP Member Check-in v6] Loaded ✓ (Scan QR / ?venue link / resume-after-login)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

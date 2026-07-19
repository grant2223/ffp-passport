/* FFP Coach AL — active-lifestyle coach (v2 — hub + tour)
   ONE surface now: a top-bar icon (#ffp-coach-btn) opens a FULL-SCREEN, FULL-BLEED Coach AL HUB.
     • HUB = state summary (streak / recovery / July-race gap / pillar counts) + Coach AL's live line
       + an inline composer that expands into the full chat + Log activity / Meetups.
     • CHAT = full-bleed thread (/api/coach/chat + /api/coach/history), Claude grounded in THIS member.
     • FIRST SIGNUP = Coach AL runs an interactive SPOTLIGHT TOUR (Log activity → Quests → Community → "this is me"),
       then opens the hub in onboarding mode (motivations quick-pick + one goal) so the member is set up right.
   The old inline Passport card is GONE — coach lives only in the modal. Lazy-loaded; self-boots.
   Cache-bust by this file's OWN ?v= on the <script> tag (NOT FFP_BUILD). */
(function () {
  'use strict';
  var FFP_API = 'https://ffp-passport-backend.vercel.app';
  var C = window.ffpCoach = window.ffpCoach || {};
  C._prof = C._prof || null;
  C._busy = false;

  function refresh() { try { return localStorage.getItem('ffp_refresh') || (window.FFPAuth && FFPAuth.getRefresh && FFPAuth.getRefresh()) || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
  function toast(m, t) { try { if (window.showToast) showToast(m, t); } catch (e) {} }
  function post(path, body) { return fetch(FFP_API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); }); }

  // Recovery badge label from a 0-100 recovery %.
  function recLabel(r) {
    if (r == null) return null;
    if (r >= 67) return 'Recovery ' + r + '% · green day';
    if (r >= 34) return 'Recovery ' + r + '% · steady';
    return 'Recovery ' + r + '% · take it easy';
  }

  var PILLARS = [['fitness', 'Fitness', '#2ba8e0'], ['sports', 'Sports', '#e5883a'], ['wellness', 'Wellness', '#7d59d0'], ['adventure', 'Adventure', '#4ecb8f'], ['recovery', 'Recovery', '#e0a94a']];
  // Pillar counts as a hairline-separated numeral row (no boxes — Apple/WHOOP).
  function pillarRow(counts) {
    counts = counts || {};
    return PILLARS.map(function (p) {
      var n = counts[p[0]] || 0, on = n > 0;
      return '<div style="flex:1;text-align:center;">'
        + '<div style="font-size:22px;font-weight:900;color:' + (on ? p[2] : '#33475a') + ';line-height:1;">' + n + '</div>'
        + '<div style="font-size:9px;font-weight:800;letter-spacing:.5px;color:' + (on ? '#7d94a6' : '#3f566a') + ';text-transform:uppercase;margin-top:5px;">' + p[1] + '</div></div>';
    }).join('');
  }

  // ── the Coach AL mark — ONE coach, chosen to match the member. COACH AL = ALBA (female) + LEO (male). ──
  // Artwork: assets/coach-female.svg (Alba), coach-male.svg (Leo), coach-neutral.svg (default when gender unknown).
  // Static files in the repo — no CDN, no runtime dependency. Swap a file to change that character everywhere;
  // bump COACH_ART below when you do, so devices pick up the new art.
  var COACH_ART = '1';
  function coachSrc() {
    var g = '';
    try { g = String((C._snap && (C._snap.gender || C._snap.sex)) || '').trim().toLowerCase(); } catch (e) {}
    if (g.indexOf('f') === 0 || g === 'woman' || g === 'w') return 'assets/coach-female.svg?v=' + COACH_ART;  // Alba
    if (g.indexOf('m') === 0 || g === 'man') return 'assets/coach-male.svg?v=' + COACH_ART;                    // Leo
    return 'assets/coach-neutral.svg?v=' + COACH_ART;
  }
  function alMark(px) {
    px = px || 40;
    return '<img src="' + coachSrc() + '" width="' + px + '" height="' + px + '" alt="Coach AL" style="display:block;flex:0 0 auto;border-radius:50%;">';
  }
  // keep the top-bar icon in step with the member once the snapshot lands
  C._syncTopbar = function () { try { var i = document.getElementById('ffp-coach-img'); if (i) i.src = coachSrc(); } catch (e) {} };

  // top-bar attention dot — shown when Coach AL has a fresh hook the member hasn't opened yet
  C._setBadge = function (on) { try { var d = document.getElementById('ffp-coach-dot'); if (d) d.style.display = on ? 'block' : 'none'; } catch (e) {} };

  /* ---- THE HUB (full-screen, full-bleed) ---- */
  C.openHub = function () {
    C._setBadge(false);
    if (document.getElementById('ffp-coach-hub-ov')) return;
    var ov = document.createElement('div'); ov.id = 'ffp-coach-hub-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100060;background:#081420;display:flex;flex-direction:column;font-family:inherit;';
    ov.innerHTML =
      '<div style="flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.06);max-width:660px;width:100%;margin:0 auto;box-sizing:border-box;">'
      +   '<span onclick="ffpCoach.closeHub()" class="material-icons" style="color:#8a99a8;cursor:pointer;">arrow_back</span>'
      +   alMark(34)
      +   '<div style="min-width:0;"><div id="ffp-coach-hub-name" style="font-size:15px;font-weight:900;color:#fff;">' + coachName() + '</div><div style="font-size:11px;color:#8a99a8;font-weight:700;">Coach AL · your active-lifestyle coach</div></div>'
      + '</div>'
      + '<div id="ffp-coach-hub-body" class="ffp-noscroll" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;max-width:660px;width:100%;margin:0 auto;box-sizing:border-box;">'
      +   '<div id="ffp-coach-thread" style="padding:16px 18px 8px;"></div>'
      + '</div>'
      + '<div id="ffp-hub-composer" style="flex:0 0 auto;padding:10px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.06);max-width:660px;width:100%;margin:0 auto;box-sizing:border-box;">'
      +   '<div style="display:flex;gap:9px;align-items:flex-end;">'
      +     '<textarea id="ffp-coach-input" rows="1" placeholder="Message Coach AL…" style="flex:1;resize:none;max-height:120px;background:#0e2032;border:1px solid rgba(255,255,255,.1);border-radius:14px;color:#e6eff7;font-family:inherit;font-size:14.5px;padding:11px 13px;outline:none;box-sizing:border-box;"></textarea>'
      +     '<button id="ffp-coach-send" onclick="ffpCoach.send()" aria-label="Send" style="flex:0 0 auto;width:44px;height:44px;border:none;border-radius:50%;background:#2ba8e0;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-icons">arrow_upward</span></button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(ov);
    injectNoScroll();
    var ta = document.getElementById('ffp-coach-input');
    if (ta) {
      ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); C.send(); } });
    }
    var rf = refresh();
    if (!rf) { renderHub(null); return; }
    // Fire the opener (the slow AI call) IN PARALLEL with the snapshot so it isn't snapshot-THEN-opener.
    // Coach name is best-effort from any cached snapshot; the message greets the MEMBER, not itself, so a
    // default here is fine — the header name is corrected the moment the snapshot lands.
    C._openerPromise = post('/api/coach/opener', { refresh: rf, coach: coachName() }).catch(function () { return null; });
    showThinking();
    post('/api/coach/snapshot', { refresh: rf }).then(function (j) {
      if (!document.getElementById('ffp-coach-hub-ov')) return;
      if (j && j.snapshot) { C._snap = j.snapshot || {}; C._hook = j.hook || {}; C._catalog = j.motivations_catalog || []; }
      C._syncTopbar(); updateHubName();
      if (C._snap && C._snap.onboarded === false) { C._openerPromise = null; renderHubOnboard(); } else renderHub(C._snap, C._hook);
    }).catch(function () { renderHub(C._snap, C._hook); });
  };
  // Coach persona name — Alba (female members), Leo (male), else Coach AL. Mirrors coachSrc()'s female-first check.
  function coachName() {
    var g = ''; try { g = String((C._snap && (C._snap.gender || C._snap.sex)) || '').trim().toLowerCase(); } catch (e) {}
    if (g.indexOf('f') === 0 || g === 'woman' || g === 'w') return 'Alba';
    if (g.indexOf('m') === 0 || g === 'man') return 'Leo';
    return 'Coach AL';
  }
  function updateHubName() { try { var el = document.getElementById('ffp-coach-hub-name'); if (el) el.textContent = coachName(); } catch (e) {} }
  // animated "thinking" bubble so the wait never looks frozen
  function showThinking() {
    var th = document.getElementById('ffp-coach-thread'); if (!th) return;
    th.innerHTML = '<div style="display:flex;justify-content:flex-start;margin:6px 0;"><div style="background:#12283b;padding:13px 16px;border-radius:16px;border-bottom-left-radius:5px;"><span class="ffp-typing"><i></i><i></i><i></i></span></div></div>';
  }
  C.closeHub = function () { var o = document.getElementById('ffp-coach-hub-ov'); if (o && o.parentNode) o.parentNode.removeChild(o); };

  // The hub IS the conversation (Grant 2026-07-18). It opens FRESH every time — no old thread, no stats
  // block, no big title. Coach AL proactively starts a substantive conversation grounded in the member's
  // real data (/api/coach/opener, generated fresh, not persisted). The composer is pinned below.
  function renderHub(s, h) {
    C._hook = h || C._hook;
    var comp = document.getElementById('ffp-hub-composer'); if (comp) comp.style.display = '';
    loadOpener();
  }

  function openerFallback() {
    var h = C._hook || {};
    if (h.line) return (h.headline ? h.headline + ' ' : '') + h.line;
    return 'Hey — I’m Coach AL. What are you moving toward this week? Tell me and I’ll help you get there.';
  }

  // Coach AL opens the conversation. Fresh each time; history is NOT loaded (the coach still remembers
  // server-side, so replies stay contextful once the member engages). Reuses the opener request already
  // fired in parallel at open (C._openerPromise) so there's no second round-trip.
  function loadOpener() {
    var th = document.getElementById('ffp-coach-thread'); if (!th) return;
    showThinking();
    var rf = refresh();
    if (!rf) { th.innerHTML = bubble('coach', nl2br(openerFallback())); return; }
    var p = C._openerPromise || post('/api/coach/opener', { refresh: rf, coach: coachName() });
    C._openerPromise = null;
    p.then(function (j) {
      var t2 = document.getElementById('ffp-coach-thread'); if (!t2) return;
      var opener = (j && j.opener) ? j.opener : openerFallback();
      t2.innerHTML = bubble('coach', nl2br(opener));
      scrollBottom();
      try { var inp = document.getElementById('ffp-coach-input'); if (inp) inp.focus(); } catch (e) {}
    }).catch(function () {
      var t2 = document.getElementById('ffp-coach-thread'); if (t2) t2.innerHTML = bubble('coach', nl2br(openerFallback()));
    });
  }

  // First-run onboarding, rendered INSIDE the hub (motivations quick-pick + one goal).
  C._selMot = C._selMot || {};
  C.toggleMot = function (key, el) {
    C._selMot[key] = !C._selMot[key];
    if (el) { var on = C._selMot[key]; el.style.background = on ? '#2ba8e0' : 'rgba(43,168,224,.10)'; el.style.color = on ? '#fff' : '#cfe1ef'; el.style.borderColor = on ? '#2ba8e0' : 'rgba(43,168,224,.22)'; }
  };
  function renderHubOnboard() {
    var body = document.getElementById('ffp-coach-hub-body'); if (!body) return;
    var comp = document.getElementById('ffp-hub-composer'); if (comp) comp.style.display = 'none';   // no chat until they're set up
    var name = (C._snap && C._snap.first_name) || 'there';
    var grid = (C._catalog || []).map(function (m) {
      return '<button type="button" onclick="ffpCoach.toggleMot(\'' + m.key + '\',this)" style="border:1px solid rgba(43,168,224,.22);background:rgba(43,168,224,.10);color:#cfe1ef;border-radius:12px;padding:13px 6px;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;line-height:1.15;text-align:center;"><span class="material-icons" style="font-size:20px;">' + esc(m.icon) + '</span>' + esc(m.label) + '</button>';
    }).join('');
    body.innerHTML =
      '<div style="padding:22px 18px 26px;">'
      + '<div style="color:#fff;font-size:22px;font-weight:900;line-height:1.2;">Hey ' + esc(name) + ', I’m Coach AL.</div>'
      + '<div style="color:#cfe1ef;font-size:14px;line-height:1.55;margin-top:8px;">I’ll help you build an active life your way — fitness, sport, wellness, adventure, and the people to share it with. First: <b style="color:#fff;">what brings you here?</b> Pick a few.</div>'
      + (grid ? '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-top:18px;">' + grid + '</div>' : '')
      + '<div style="color:#9fc0d6;font-size:12.5px;font-weight:800;margin:20px 0 8px;">One goal to start? (optional)</div>'
      + '<input id="ffp-onb-goal" type="text" placeholder="e.g. Move 4x a week, try 2 new sports" style="width:100%;box-sizing:border-box;background:#0a1826;border:1px solid rgba(43,168,224,.28);border-radius:12px;color:#e8eef4;font-family:inherit;font-size:14px;padding:12px 14px;outline:none;">'
      + '<button type="button" id="ffp-onb-go" onclick="ffpCoach.saveOnboard()" style="width:100%;margin-top:16px;background:#FFCC00;color:#082335;border:none;border-radius:13px;padding:15px;font-family:inherit;font-size:15px;font-weight:900;cursor:pointer;">Start my active life</button>'
      + '</div>';
  }
  C.saveOnboard = function () {
    var rf = refresh(); if (!rf) return;
    var mot = Object.keys(C._selMot || {}).filter(function (k) { return C._selMot[k]; });
    var goalEl = document.getElementById('ffp-onb-goal'); var goal = goalEl ? goalEl.value.trim() : '';
    var b = document.getElementById('ffp-onb-go'); if (b) { b.disabled = true; b.textContent = 'Setting up…'; }
    post('/api/coach/onboard', { refresh: rf, motivations: mot, goals: goal ? [{ label: goal }] : [] }).then(function () {
      C._selMot = {}; if (C._snap) C._snap.onboarded = true;
      // restore the hub shell (onboarding overwrote the body), then start the fresh conversation
      var body = document.getElementById('ffp-coach-hub-body');
      if (body) body.innerHTML = '<div id="ffp-coach-thread" style="padding:16px 18px 8px;"></div>';
      renderHub(C._snap, C._hook); toast('You’re all set — let’s move.', 'success');
    }).catch(function () { var b2 = document.getElementById('ffp-onb-go'); if (b2) { b2.disabled = false; b2.textContent = 'Start my active life'; } });
  };

  // Action handlers — reuse the app's existing wiring (Rule 5).
  C.logActivity = function () { try { if (window.openLogModal) return window.openLogModal(); } catch (e) {} toast('Open Log Activity from the Passport', 'info'); };
  C.goMeetups = function () { try { C.closeHub(); var b = document.querySelector('.nav-item[data-panel="panel-meetups"]'); if (b) return b.click(); } catch (e) {} };
  // legacy no-op: the inline Passport card was removed (coach lives in the modal). Kept so old shell calls are safe.
  C.render = function () {};

  /* ---- THE CHAT (full-screen, full-bleed) ---- */
  function bubble(role, html) {
    var mine = (role === 'user');
    return '<div style="display:flex;justify-content:' + (mine ? 'flex-end' : 'flex-start') + ';margin:10px 0;">' +
      '<div style="max-width:82%;padding:11px 14px;border-radius:16px;font-size:14.5px;line-height:1.5;' +
        (mine ? 'background:#2ba8e0;color:#fff;border-bottom-right-radius:5px;' : 'background:#12283b;color:#e6eff7;border-bottom-left-radius:5px;') + '">' + html + '</div></div>';
  }
  // the hub body is the scroller (summary + thread live inside it)
  function scrollBottom() {
    var b = document.getElementById('ffp-coach-hub-body') || document.getElementById('ffp-coach-thread');
    if (b) b.scrollTop = b.scrollHeight;
  }

  // The separate chat overlay is GONE — the hub IS the conversation. These stay as aliases so any
  // legacy caller (or an old cached shell) still lands somewhere sensible.
  C.openChat = function () { C.openHub(); };
  C.closeChat = function () { C.closeHub(); };

  C.send = function () {
    if (C._busy) return;
    var ta = document.getElementById('ffp-coach-input'); var th = document.getElementById('ffp-coach-thread'); if (!ta || !th) return;
    var msg = (ta.value || '').trim(); if (!msg) return;
    var rf = refresh(); if (!rf) { toast('Please sign in again', 'error'); return; }
    C._busy = true;
    ta.value = ''; ta.style.height = 'auto';
    th.insertAdjacentHTML('beforeend', bubble('user', nl2br(msg)));
    th.insertAdjacentHTML('beforeend', '<div id="ffp-coach-typing" style="display:flex;justify-content:flex-start;margin:10px 0;"><div style="background:#12283b;padding:13px 16px;border-radius:16px;border-bottom-left-radius:5px;"><span class="ffp-typing"><i></i><i></i><i></i></span></div></div>');
    scrollBottom();
    var sBtn = document.getElementById('ffp-coach-send'); if (sBtn) sBtn.style.opacity = '.5';
    post('/api/coach/chat', { refresh: rf, message: msg, coach: coachName() }).then(function (j) {
      var typing = document.getElementById('ffp-coach-typing'); if (typing) typing.remove();
      var reply = (j && j.reply) || 'I had a moment there — try me again in a sec.';
      var t2 = document.getElementById('ffp-coach-thread'); if (t2) { t2.insertAdjacentHTML('beforeend', bubble('coach', nl2br(reply))); scrollBottom(); }
    }).catch(function () {
      var typing = document.getElementById('ffp-coach-typing'); if (typing) typing.remove();
      var t2 = document.getElementById('ffp-coach-thread'); if (t2) { t2.insertAdjacentHTML('beforeend', bubble('coach', 'Connection dropped — try that again in a moment.')); scrollBottom(); }
    }).then(function () { C._busy = false; var b = document.getElementById('ffp-coach-send'); if (b) b.style.opacity = '1'; });
  };

  /* ---- THE FIRST-SIGNUP SPOTLIGHT TOUR ---- */
  // Steps point at REAL, present elements; any step whose target is missing is skipped (never breaks).
  C._tourSteps = [
    { sel: null, title: 'Hi, I’m Coach AL.', body: 'Welcome to FFP. Give me a minute and I’ll show you around — then help you get set up.' },
    { sel: '.nav-item[data-panel="panel-passport"]', title: 'Your Passport.', body: 'Home base. Every activity you log lands here and builds your active-life story.' },
    { sel: '#ffp-log-activity-btn', title: 'Log every activity.', body: 'Runs, matches, hikes, gym — log it here. It builds your Passport and scores your Quests.' },
    { sel: '.nav-item[data-panel="panel-quests"]', title: 'Quests.', body: 'Earn points for staying active, climb the leaderboard, and win alongside your team.' },
    { sel: '.nav-item[data-panel="panel-meet"]', title: 'Community.', body: 'Find people near you who play your sports — someone to train and move with.' },
    { sel: '#ffp-coach-btn', title: 'And this is me.', body: 'Tap here anytime for a plan, a nudge, or a chat about your active life.' },
    { sel: '#user-btn', title: 'Your toolkit.', body: 'Tap your avatar to reach everything below — here’s what’s inside.' },
    { sel: '.menu-item[data-panel="panel-workout"]', menu: true, title: 'AI Coach.', body: 'Tell the AI Coach your goal and it writes the workout for you in seconds.' },
    { sel: '.menu-item[data-panel="panel-workout-timer"]', menu: true, title: 'Workout Timer.', body: 'Intervals, rounds and a stopwatch to run your sessions.' },
    { sel: '.menu-item[data-panel="panel-calorie-tracker"]', menu: true, title: 'Calorie Tracker.', body: 'Log your meals and keep an eye on your daily intake.' },
    { sel: '.menu-item[data-panel="panel-earnings"]', menu: true, title: 'Earnings.', body: 'The points and rewards you earn for staying active add up here.' },
    { sel: '#ffp-menu-settings', menu: true, title: 'Connect your devices.', body: 'In Settings, link your watch or tracker so your workouts sync in automatically.' },
    { sel: null, title: 'Let’s set you up.', body: 'That’s the tour. Tell me what you’re here for and I’ll tailor everything to you.' }
  ];
  C._tourIdx = 0;

  C.startTour = function () {
    if (document.getElementById('ffp-coach-tour-ov')) return;
    injectNoScroll();
    var ov = document.createElement('div'); ov.id = 'ffp-coach-tour-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100070;font-family:inherit;';
    ov.innerHTML =
      '<div id="ffp-tour-catch" style="position:absolute;inset:0;"></div>'
      + '<div id="ffp-tour-dim" style="position:absolute;inset:0;background:rgba(4,10,16,.82);display:none;"></div>'
      + '<div id="ffp-tour-ring" style="position:absolute;border:2px solid #FFCC00;border-radius:14px;box-shadow:0 0 0 9999px rgba(4,10,16,.82);pointer-events:none;display:none;transition:top .28s,left .28s,width .28s,height .28s;"></div>'
      + '<div id="ffp-tour-card" style="position:absolute;left:20px;right:20px;background:#0e2032;border:1px solid rgba(43,168,224,.3);border-radius:18px;padding:18px;box-sizing:border-box;"></div>';
    document.body.appendChild(ov);
    C._tourIdx = 0;
    C._tourShow();
  };
  C._tourShow = function () {
    var st = C._tourSteps[C._tourIdx]; if (!st) return C.endTour(true);
    var ring = document.getElementById('ffp-tour-ring'), dim = document.getElementById('ffp-tour-dim'), card = document.getElementById('ffp-tour-card');
    if (!ring || !card) return;
    // open the avatar menu for the toolkit steps, close it otherwise
    var menu = document.getElementById('user-menu'); if (menu) { if (st.menu) menu.classList.add('show'); else menu.classList.remove('show'); }
    var target = st.sel ? document.querySelector(st.sel) : null;
    var rect = null; if (target) { try { rect = target.getBoundingClientRect(); } catch (e) {} }
    var vh = window.innerHeight || 640, vw = window.innerWidth || 380;
    if (rect && rect.width && rect.height && rect.bottom > 4 && rect.top < vh - 4) {
      var pad = 7;
      if (dim) dim.style.display = 'none';           // ring's box-shadow does the dimming (true cut-out)
      ring.style.display = 'block';
      ring.style.top = Math.max(4, rect.top - pad) + 'px';
      ring.style.left = Math.max(4, rect.left - pad) + 'px';
      ring.style.width = Math.min(vw - 8, rect.width + pad * 2) + 'px';
      ring.style.height = (rect.height + pad * 2) + 'px';
      // card goes below the target when it's in the top half, above it when it's low
      var below = rect.top < vh * 0.5;
      card.style.top = below ? Math.min(vh - 230, rect.bottom + pad + 12) + 'px' : '';
      card.style.bottom = below ? '' : (vh - rect.top + pad + 12) + 'px';
    } else {
      ring.style.display = 'none';
      if (dim) dim.style.display = 'block';            // no target → dim the whole screen
      card.style.bottom = ''; card.style.top = Math.round(vh * 0.34) + 'px';
    }
    var last = C._tourIdx >= C._tourSteps.length - 1;
    card.innerHTML =
      '<div style="display:flex;align-items:center;gap:9px;margin-bottom:11px;">' + alMark(26)
      + '<div style="color:#fff;font-weight:900;font-size:13px;">Coach AL · step ' + (C._tourIdx + 1) + ' of ' + C._tourSteps.length + '</div></div>'
      + '<div style="color:#fff;font-size:17px;font-weight:900;line-height:1.25;">' + esc(st.title) + '</div>'
      + '<div style="color:#cfe1ef;font-size:13.5px;line-height:1.5;margin-top:6px;">' + esc(st.body) + '</div>'
      + '<div style="display:flex;gap:10px;margin-top:16px;align-items:center;">'
      +   '<button onclick="ffpCoach.endTour(true)" style="background:none;border:none;color:#8a99a8;font-family:inherit;font-size:13px;font-weight:800;padding:11px 4px;cursor:pointer;">Skip tour</button>'
      +   '<button onclick="ffpCoach.tourNext()" style="flex:1;background:#FFCC00;color:#082335;border:none;border-radius:12px;padding:13px;font-family:inherit;font-size:14px;font-weight:900;cursor:pointer;">' + (last ? 'Set me up' : 'Next') + '</button>'
      + '</div>';
  };
  C.tourNext = function () { C._tourIdx++; if (C._tourIdx >= C._tourSteps.length) return C.endTour(true); C._tourShow(); };
  C.endTour = function (openHub) {
    try { localStorage.setItem('ffp_coach_tour_seen', '1'); } catch (e) {}
    var o = document.getElementById('ffp-coach-tour-ov'); if (o && o.parentNode) o.parentNode.removeChild(o);
    if (openHub) { try { C.openHub(); } catch (e) {} }
  };

  // Decide whether to auto-run the tour: only for a brand-new member (onboarded === false) who hasn't seen it.
  C._maybeTour = function () {
    var seen = false; try { seen = localStorage.getItem('ffp_coach_tour_seen') === '1'; } catch (e) {}
    if (seen) return;
    var rf = refresh(); if (!rf) return;
    post('/api/coach/snapshot', { refresh: rf }).then(function (j) {
      if (j && j.snapshot) { C._snap = j.snapshot; C._hook = j.hook || {}; C._catalog = j.motivations_catalog || []; }
      C._syncTopbar();                                   // swap the top-bar coach to match this member
      if (C._hook && C._hook.headline) C._setBadge(true);
      if (C._snap && C._snap.onboarded === false) { setTimeout(function () { try { C.startTour(); } catch (e) {} }, 900); }
    }).catch(function () {});
  };

  // hide scrollbars on our overlays (Grant: NO visible scrollbars, ever)
  function injectNoScroll() {
    if (document.getElementById('ffp-coach-css')) return;
    var st = document.createElement('style'); st.id = 'ffp-coach-css';
    st.textContent = '.ffp-noscroll{scrollbar-width:none;}.ffp-noscroll::-webkit-scrollbar{display:none;}'
      + '.ffp-typing{display:inline-flex;gap:5px;align-items:center;}'
      + '.ffp-typing i{width:7px;height:7px;border-radius:50%;background:#6f8ba0;display:inline-block;animation:ffpBlink 1.2s infinite both;}'
      + '.ffp-typing i:nth-child(2){animation-delay:.18s;}.ffp-typing i:nth-child(3){animation-delay:.36s;}'
      + '@keyframes ffpBlink{0%,70%,100%{opacity:.25;transform:translateY(0);}35%{opacity:1;transform:translateY(-3px);}}';
    document.head.appendChild(st);
  }

  // Capture the member's REAL timezone once on load (browser Intl) so reminders fire at THEIR local time.
  try { var _tz = (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone; var _rf = refresh(); if (_tz && _rf) post('/api/member/timezone', { refresh: _rf, tz: _tz }); } catch (e) {}
  // Self-boot: decide the tour + attention dot.
  try { C._maybeTour(); } catch (e) {}
})();

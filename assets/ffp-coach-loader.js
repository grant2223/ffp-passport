/* FFP Coach Grant — active-lifestyle coach (v1)
   Two surfaces, both fed by the existing coach engine (member_coach_profile via /api/coach/*):
     1) A state-aware coach CARD rendered into #ffp-coach-mount on the Passport (replaces the old 9 canned tips).
        Reads /api/coach/profile → coach_line + facts (recovery / momentum / at-risk) and shows tappable actions.
     2) A full-screen "Talk to Coach" CHAT (/api/coach/chat + /api/coach/history) — Claude grounded in THIS member.
   Lazy-loaded by the dashboard; self-boots. Full-screen modal is FULL-BLEED per the member-app convention. */
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

  // Recovery badge colour + label from a 0-100 recovery %.
  function recBadge(r) {
    if (r == null) return null;
    if (r >= 67) return { txt: 'Recovery ' + r + '% · green day', col: '#7fd0a0' };
    if (r >= 34) return { txt: 'Recovery ' + r + '% · steady', col: '#e0a94a' };
    return { txt: 'Recovery ' + r + '% · take it easy', col: '#e0a94a' };
  }
  function subtitle(f) {
    f = f || {};
    var rb = recBadge(f.latest_recovery); if (rb) return rb;
    if (f.at_risk || (f.last_active_days != null && f.last_active_days > 10)) return { txt: (f.last_active_days || 'A few') + ' days since your last log', col: '#8a99a8' };
    if (f.last_active_days === 0) return { txt: 'Logged today · nice', col: '#7fd0a0' };
    if (f.momentum === 'rising') return { txt: 'Building momentum', col: '#7fd0a0' };
    if (f.momentum === 'slipping') return { txt: 'A little down on last week', col: '#e0a94a' };
    return { txt: 'Your active-lifestyle coach', col: '#8a99a8' };
  }

  // Equal-width chip so all CTAs sit on ONE row (flex:1, centred, label truncates if tight).
  function chip(label, icon, handler, primary) {
    var bg = primary ? '#2ba8e0' : 'rgba(43,168,224,.12)', col = primary ? '#fff' : '#8fd0f0';
    return '<button type="button" onclick="' + handler + '" style="flex:1 1 0;min-width:0;background:' + bg + ';color:' + col + ';border:none;font-size:12px;font-weight:800;padding:9px 8px;border-radius:11px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:5px;"><span class="material-icons" style="font-size:15px;flex:0 0 auto;">' + icon + '</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(label) + '</span></button>';
  }

  // ── the coach CARD (snapshot-driven active-life summary, in Coach Grant's voice) ──
  var PILLARS = [['fitness', 'Fitness', '#2ba8e0'], ['sports', 'Sports', '#e5883a'], ['wellness', 'Wellness', '#7d59d0'], ['adventure', 'Adventure', '#4ecb8f'], ['recovery', 'Recovery', '#e0a94a']];
  function hookAction(a) { return (a === 'meetups' || a === 'host' || a === 'discover') ? "ffpCoach.goMeetups()" : "ffpCoach.logActivity()"; }
  function pillarStrip(counts) {
    counts = counts || {};
    return PILLARS.map(function (p) {
      var n = counts[p[0]] || 0, on = n > 0;
      return '<div style="flex:1;text-align:center;background:' + (on ? 'rgba(43,168,224,.10)' : 'rgba(255,255,255,.03)') + ';border-radius:9px;padding:8px 2px;">'
        + '<div style="font-size:15px;font-weight:900;color:' + (on ? p[2] : '#4a6579') + ';">' + n + '</div>'
        + '<div style="font-size:8.5px;font-weight:800;color:' + (on ? '#9fc0d6' : '#4a6579') + ';text-transform:uppercase;margin-top:1px;">' + p[1] + '</div></div>';
    }).join('');
  }
  function renderCard(mount, s, h) {
    var streak = s.streak || 0;
    var streakPill = streak >= 1 ? '<span style="background:rgba(255,138,42,.15);border:1px solid rgba(255,138,42,.5);color:#ffc08a;font-size:10px;font-weight:900;letter-spacing:1px;padding:3px 9px;border-radius:100px;flex:0 0 auto;">' + streak + '-DAY STREAK</span>' : '';
    var race = (s.race && s.race.rank) ? '<div style="font-size:11px;font-weight:700;color:#8fc7e8;margin-top:10px;">' + esc(s.race.quest || 'July race') + ': #' + s.race.rank + ' · ' + s.race.points + ' pts' + (s.race.gap_to_above > 0 ? ' · ' + s.race.gap_to_above + ' off ' + esc(s.race.above_name || 'the spot above') : '') + '</div>' : '';
    // Fixed 3-CTA row (Grant): Chat is the primary blue button — talking to Coach gets the best out of an active life.
    var acts = chip('Chat', 'chat', "ffpCoach.openChat()", true) + chip('Log activity', 'add', "ffpCoach.logActivity()") + chip('Meetups', 'groups', "ffpCoach.goMeetups()");
    mount.innerHTML =
      '<div style="background:#0e2032;border:1px solid rgba(43,168,224,.22);border-radius:18px;padding:16px;">'
      + '<div style="display:flex;align-items:center;gap:11px;margin-bottom:12px;">'
      +   '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#2ba8e0,#0d2b45);display:flex;align-items:center;justify-content:center;flex:0 0 auto;"><span style="color:#fff;font-weight:900;font-style:italic;font-size:14px;">G</span></div>'
      +   '<div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:900;color:#fff;letter-spacing:.5px;">COACH GRANT</div></div>' + streakPill
      + '</div>'
      + '<div style="font-size:16px;font-weight:900;color:#fff;line-height:1.2;">' + esc(h.headline || '') + '</div>'
      + '<div style="font-size:13.5px;line-height:1.5;color:#cfe1ef;margin-top:6px;">' + esc(h.line || '') + '</div>'
      + '<div style="display:flex;gap:5px;margin-top:13px;">' + pillarStrip(s.pillars && s.pillars.counts) + '</div>'
      + race
      + '<div style="display:flex;gap:8px;flex-wrap:nowrap;margin-top:13px;">' + acts + '</div>'
      + '</div>';
  }
  // First-run onboarding — Coach Grant intro + motivations quick-pick + one goal.
  C._selMot = C._selMot || {};
  C.toggleMot = function (key, el) {
    C._selMot[key] = !C._selMot[key];
    if (el) { var on = C._selMot[key]; el.style.background = on ? '#2ba8e0' : 'rgba(43,168,224,.10)'; el.style.color = on ? '#fff' : '#cfe1ef'; el.style.borderColor = on ? '#2ba8e0' : 'rgba(43,168,224,.22)'; }
  };
  function renderOnboard(mount) {
    var name = (C._snap && C._snap.first_name) || 'there';
    var grid = (C._catalog || []).map(function (m) {
      return '<button type="button" onclick="ffpCoach.toggleMot(\'' + m.key + '\',this)" style="border:1px solid rgba(43,168,224,.22);background:rgba(43,168,224,.10);color:#cfe1ef;border-radius:12px;padding:11px 6px;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;line-height:1.15;text-align:center;"><span class="material-icons" style="font-size:19px;">' + esc(m.icon) + '</span>' + esc(m.label) + '</button>';
    }).join('');
    mount.innerHTML =
      '<div style="background:#0e2032;border:1px solid rgba(43,168,224,.22);border-radius:18px;padding:18px;">'
      + '<div style="display:flex;align-items:center;gap:11px;margin-bottom:12px;"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#2ba8e0,#0d2b45);display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-weight:900;font-style:italic;font-size:15px;">G</span></div><div style="font-size:12.5px;font-weight:900;color:#fff;letter-spacing:.5px;">COACH GRANT</div></div>'
      + '<div style="font-size:17px;font-weight:900;color:#fff;line-height:1.25;">Hey ' + esc(name) + ', I’m Coach Grant.</div>'
      + '<div style="font-size:13.5px;color:#cfe1ef;line-height:1.5;margin-top:6px;">I’ll help you build an active life your way — fitness, sport, wellness, adventure, and the people to share it with. First: <b style="color:#fff;">what brings you here?</b> Pick a few.</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px;">' + grid + '</div>'
      + '<div style="font-size:12.5px;font-weight:800;color:#9fc0d6;margin:16px 0 7px;">One goal to start? (optional)</div>'
      + '<input id="ffp-onb-goal" type="text" placeholder="e.g. Move 4x a week, try 2 new sports" style="width:100%;box-sizing:border-box;background:#0a1826;border:1px solid rgba(43,168,224,.28);border-radius:11px;color:#e8eef4;font-family:inherit;font-size:14px;padding:11px 13px;outline:none;">'
      + '<button type="button" id="ffp-onb-go" onclick="ffpCoach.saveOnboard()" style="width:100%;margin-top:14px;background:#FFCC00;color:#082335;border:none;border-radius:12px;padding:14px;font-family:inherit;font-size:15px;font-weight:900;cursor:pointer;">Start my active life</button>'
      + '</div>';
  }
  C.saveOnboard = function () {
    var rf = refresh(); if (!rf) return;
    var mot = Object.keys(C._selMot || {}).filter(function (k) { return C._selMot[k]; });
    var goalEl = document.getElementById('ffp-onb-goal'); var goal = goalEl ? goalEl.value.trim() : '';
    var b = document.getElementById('ffp-onb-go'); if (b) { b.disabled = true; b.textContent = 'Setting up…'; }
    post('/api/coach/onboard', { refresh: rf, motivations: mot, goals: goal ? [{ label: goal }] : [] }).then(function () {
      C._selMot = {}; if (C._snap) C._snap.onboarded = true; C.render(); toast("You’re all set — let’s move.", 'success');
    }).catch(function () { var b2 = document.getElementById('ffp-onb-go'); if (b2) { b2.disabled = false; b2.textContent = 'Start my active life'; } });
  };
  // Basic Coach Grant card — the ALWAYS-shows fallback if the snapshot endpoint isn't there yet (old backend) or errors.
  function renderBasic(mount) {
    var acts = chip('Chat', 'chat', "ffpCoach.openChat()", true) + chip('Log activity', 'add', "ffpCoach.logActivity()") + chip('Meetups', 'groups', "ffpCoach.goMeetups()");
    mount.innerHTML = '<div style="background:#0e2032;border:1px solid rgba(43,168,224,.22);border-radius:18px;padding:16px;">'
      + '<div style="display:flex;align-items:center;gap:11px;margin-bottom:12px;"><div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#2ba8e0,#0d2b45);display:flex;align-items:center;justify-content:center;flex:0 0 auto;"><span style="color:#fff;font-weight:900;font-style:italic;font-size:14px;">G</span></div><div style="font-size:12.5px;font-weight:900;color:#fff;letter-spacing:.5px;">COACH GRANT</div></div>'
      + '<div style="font-size:15px;font-weight:900;color:#fff;line-height:1.25;">Ready when you are.</div>'
      + '<div style="font-size:13.5px;color:#cfe1ef;margin-top:6px;line-height:1.5;">Log a session, find people to move with, or chat with me about your active life.</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:nowrap;margin-top:13px;">' + acts + '</div></div>';
  }
  C.render = function () {
    var mount = document.getElementById('ffp-coach-mount'); if (!mount) return;
    var rf = refresh(); if (!rf) { mount.innerHTML = ''; return; }
    post('/api/coach/snapshot', { refresh: rf }).then(function (j) {
      var m2 = document.getElementById('ffp-coach-mount'); if (!m2) return;
      if (!j || j.error || !j.snapshot) { return renderBasic(m2); }   // old backend / no snapshot endpoint → never blank
      C._snap = j.snapshot || {}; C._hook = j.hook || {}; C._catalog = j.motivations_catalog || [];
      if (C._snap.onboarded === false) { renderOnboard(m2); return; }
      renderCard(m2, C._snap, C._hook);
    }).catch(function () { var m = document.getElementById('ffp-coach-mount'); if (m) renderBasic(m); });
  };

  // Action handlers — reuse the app's existing wiring (Rule 5).
  C.logActivity = function () { try { if (window.openLogModal) return window.openLogModal(); } catch (e) {} toast('Open Log Activity from the Passport', 'info'); };
  C.goMeetups = function () { try { var b = document.querySelector('.nav-item[data-panel="panel-meetups"]'); if (b) return b.click(); } catch (e) {} };

  // ── the CHAT (full-screen, full-bleed) ───────────────────────────────────────
  function bubble(role, html) {
    var mine = (role === 'user');
    return '<div style="display:flex;justify-content:' + (mine ? 'flex-end' : 'flex-start') + ';margin:10px 0;">' +
      '<div style="max-width:82%;padding:11px 14px;border-radius:16px;font-size:14.5px;line-height:1.5;' +
        (mine ? 'background:#2ba8e0;color:#fff;border-bottom-right-radius:5px;' : 'background:#12283b;color:#e6eff7;border-bottom-left-radius:5px;') + '">' + html + '</div></div>';
  }
  function scrollBottom() { var b = document.getElementById('ffp-coach-thread'); if (b) b.scrollTop = b.scrollHeight; }

  C.openChat = function () {
    if (document.getElementById('ffp-coach-ov')) return;
    var ov = document.createElement('div'); ov.id = 'ffp-coach-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100062;background:#081420;display:flex;flex-direction:column;font-family:inherit;';
    ov.innerHTML =
      '<div style="flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:14px 16px calc(14px);border-bottom:1px solid rgba(255,255,255,.06);max-width:660px;width:100%;margin:0 auto;box-sizing:border-box;">' +
        '<span onclick="ffpCoach.closeChat()" class="material-icons" style="color:#8a99a8;cursor:pointer;">arrow_back</span>' +
        '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#2ba8e0,#0d2b45);display:flex;align-items:center;justify-content:center;flex:0 0 auto;"><span style="color:#fff;font-weight:900;font-style:italic;font-size:14px;">G</span></div>' +
        '<div style="min-width:0;"><div style="font-size:15px;font-weight:900;color:#fff;">Coach Grant</div><div style="font-size:11px;color:#8a99a8;font-weight:700;">Your active-lifestyle coach</div></div>' +
      '</div>' +
      '<div id="ffp-coach-thread" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px 16px;max-width:660px;width:100%;margin:0 auto;box-sizing:border-box;"></div>' +
      '<div style="flex:0 0 auto;padding:10px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.06);max-width:660px;width:100%;margin:0 auto;box-sizing:border-box;">' +
        '<div style="display:flex;gap:9px;align-items:flex-end;">' +
          '<textarea id="ffp-coach-input" rows="1" placeholder="Ask Coach anything…" style="flex:1;resize:none;max-height:120px;background:#0e2032;border:1px solid rgba(255,255,255,.1);border-radius:14px;color:#e6eff7;font-family:inherit;font-size:14.5px;padding:11px 13px;outline:none;"></textarea>' +
          '<button id="ffp-coach-send" onclick="ffpCoach.send()" style="flex:0 0 auto;width:44px;height:44px;border:none;border-radius:50%;background:#2ba8e0;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-icons">arrow_upward</span></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    var ta = document.getElementById('ffp-coach-input');
    if (ta) {
      ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); C.send(); } });
      setTimeout(function () { try { ta.focus(); } catch (e) {} }, 120);
    }
    // Load history; greet if empty.
    var th = document.getElementById('ffp-coach-thread');
    th.innerHTML = '<div id="ffp-coach-load" style="text-align:center;color:#5f7d94;font-size:12px;padding:20px;">…</div>';
    post('/api/coach/history', { refresh: refresh() }).then(function (j) {
      var t2 = document.getElementById('ffp-coach-thread'); if (!t2) return;
      var msgs = (j && j.messages) || [];
      if (!msgs.length) {
        var opener = (C._hook && C._hook.line) ? (C._hook.headline + ' ' + C._hook.line) : 'Hey — I\'m Coach Grant. I\'m here for your training, motivation and finding people to move with. What\'s on your mind?';
        t2.innerHTML = bubble('coach', nl2br(opener));
      } else {
        t2.innerHTML = msgs.map(function (m) { return bubble(m.role === 'coach' ? 'coach' : 'user', nl2br(m.content)); }).join('');
      }
      scrollBottom();
    }).catch(function () { var t2 = document.getElementById('ffp-coach-thread'); if (t2) t2.innerHTML = bubble('coach', 'Hey — I\'m Coach Grant. What\'s on your mind?'); });
  };
  C.closeChat = function () { var o = document.getElementById('ffp-coach-ov'); if (o && o.parentNode) o.parentNode.removeChild(o); if (C._prof === null) C.render(); };

  C.send = function () {
    if (C._busy) return;
    var ta = document.getElementById('ffp-coach-input'); var th = document.getElementById('ffp-coach-thread'); if (!ta || !th) return;
    var msg = (ta.value || '').trim(); if (!msg) return;
    var rf = refresh(); if (!rf) { toast('Please sign in again', 'error'); return; }
    C._busy = true;
    ta.value = ''; ta.style.height = 'auto';
    th.insertAdjacentHTML('beforeend', bubble('user', nl2br(msg)));
    th.insertAdjacentHTML('beforeend', '<div id="ffp-coach-typing" style="display:flex;justify-content:flex-start;margin:10px 0;"><div style="background:#12283b;color:#8a99a8;padding:11px 16px;border-radius:16px;border-bottom-left-radius:5px;font-size:14px;">Coach is typing…</div></div>');
    scrollBottom();
    var sBtn = document.getElementById('ffp-coach-send'); if (sBtn) sBtn.style.opacity = '.5';
    post('/api/coach/chat', { refresh: rf, message: msg }).then(function (j) {
      var typing = document.getElementById('ffp-coach-typing'); if (typing) typing.remove();
      var reply = (j && j.reply) || 'I had a moment there — try me again in a sec.';
      var t2 = document.getElementById('ffp-coach-thread'); if (t2) { t2.insertAdjacentHTML('beforeend', bubble('coach', nl2br(reply))); scrollBottom(); }
    }).catch(function () {
      var typing = document.getElementById('ffp-coach-typing'); if (typing) typing.remove();
      var t2 = document.getElementById('ffp-coach-thread'); if (t2) { t2.insertAdjacentHTML('beforeend', bubble('coach', 'Connection dropped — try that again in a moment.')); scrollBottom(); }
    }).then(function () { C._busy = false; var b = document.getElementById('ffp-coach-send'); if (b) b.style.opacity = '1'; });
  };

  // v2: keep Coach Grant CURRENT — poll every 5 min while the card is on-screen, and refresh whenever the app
  // regains focus, so the line + state stay in step with the member through the day. Pauses while the chat is open.
  C._startPolling = function () {
    if (C._pollTimer) return;
    C._pollTimer = setInterval(function () {
      try { if (document.getElementById('ffp-coach-mount') && !document.getElementById('ffp-coach-ov')) C.render(); } catch (e) {}
    }, 5 * 60 * 1000);
  };
  try {
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && document.getElementById('ffp-coach-mount') && !document.getElementById('ffp-coach-ov')) { try { C.render(); } catch (e) {} }
    });
  } catch (e) {}
  // Capture the member's REAL timezone (browser Intl) once on load, so Coach Grant's 5pm reminder fires at THEIR
  // actual local 5pm — not a default. Fire-and-forget; backend only writes if it's a valid IANA zone.
  try { var _tz = (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone; var _rf = refresh(); if (_tz && _rf) post('/api/member/timezone', { refresh: _rf, tz: _tz }); } catch (e) {}
  // Self-boot: paint the card if its mount is already on the page + start the 5-min refresh.
  try { if (document.getElementById('ffp-coach-mount')) { C.render(); C._startPolling(); } } catch (e) {}
})();

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

  function chip(label, icon, handler, primary) {
    var bg = primary ? '#2ba8e0' : 'rgba(43,168,224,.12)', col = primary ? '#fff' : '#8fd0f0';
    return '<button type="button" onclick="' + handler + '" style="background:' + bg + ';color:' + col + ';border:none;font-size:12.5px;font-weight:800;padding:9px 14px;border-radius:11px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;"><span class="material-icons" style="font-size:15px;">' + icon + '</span>' + esc(label) + '</button>';
  }

  // ── the coach CARD ─────────────────────────────────────────────────────────
  C.render = function () {
    var mount = document.getElementById('ffp-coach-mount'); if (!mount) return;
    var rf = refresh(); if (!rf) { mount.innerHTML = ''; return; }
    post('/api/coach/profile', { refresh: rf }).then(function (j) {
      var mount2 = document.getElementById('ffp-coach-mount'); if (!mount2) return;
      if (!j || j.error) { mount2.innerHTML = ''; return; }
      C._prof = j;
      var f = j.facts || {};
      var line = j.coach_line || 'Log an activity today to keep your Trends moving — and tap below any time you want a hand.';
      var sub = subtitle(f);
      // Adaptive actions: low recovery → light session; quiet/at-risk → meet-up first; else log first.
      var low = (f.latest_recovery != null && f.latest_recovery < 34);
      var quiet = (f.at_risk || (f.last_active_days != null && f.last_active_days > 10));
      var acts = '';
      if (quiet) {
        acts += chip('See meet-ups', 'groups', "ffpCoach.goMeetups()", true);
        acts += chip('Log activity', 'add', "ffpCoach.logActivity()");
      } else if (low) {
        acts += chip('Log a light session', 'directions_walk', "ffpCoach.logActivity()", true);
      } else {
        acts += chip('Log activity', 'add', "ffpCoach.logActivity()", true);
        acts += chip('Find a meet-up', 'groups', "ffpCoach.goMeetups()");
      }
      acts += chip('Talk to Coach', 'auto_awesome', "ffpCoach.openChat()");
      mount2.innerHTML =
        '<div style="background:#0e2032;border:1px solid rgba(43,168,224,.22);border-radius:18px;padding:16px;">' +
          '<div style="display:flex;align-items:center;gap:11px;margin-bottom:12px;">' +
            '<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#2ba8e0,#0d2b45);display:flex;align-items:center;justify-content:center;flex:0 0 auto;"><span style="color:#fff;font-weight:900;font-style:italic;font-size:15px;">G</span></div>' +
            '<div style="min-width:0;"><div style="font-size:14px;font-weight:900;color:#fff;">Coach Grant</div><div style="font-size:11px;font-weight:700;color:' + sub.col + ';">' + esc(sub.txt) + '</div></div>' +
          '</div>' +
          '<div style="font-size:14.5px;line-height:1.55;color:#dfeaf3;">' + nl2br(line) + '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">' + acts + '</div>' +
        '</div>';
    }).catch(function () { var m = document.getElementById('ffp-coach-mount'); if (m) m.innerHTML = ''; });
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
        var opener = (C._prof && C._prof.coach_line) ? C._prof.coach_line : 'Hey — I\'m Coach Grant. I\'m here for your training, motivation and finding people to move with. What\'s on your mind?';
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

  // Self-boot: paint the card if its mount is already on the page.
  try { if (document.getElementById('ffp-coach-mount')) C.render(); } catch (e) {}
})();

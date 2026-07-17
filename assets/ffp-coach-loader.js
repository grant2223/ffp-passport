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
  C._pending = null;   // message queued from the hub composer, sent once the chat thread is ready

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

  // ── the Coach AL mark — a premium shoulders-up portrait (a woman + a man, gradient-shaded), NO box. Reused everywhere. ──
  var _alN = 0;
  function alMark(px) {
    px = px || 40; var w = Math.round(px * 1.154), u = 'a' + (++_alN);
    return '<svg width="' + w + '" height="' + px + '" viewBox="0 0 60 52" style="display:block;flex:0 0 auto;" aria-hidden="true">'
      + '<defs>'
      +   '<linearGradient id="skW' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d3b2"/><stop offset="1" stop-color="#e6ad84"/></linearGradient>'
      +   '<linearGradient id="skM' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9bd93"/><stop offset="1" stop-color="#cf9866"/></linearGradient>'
      +   '<linearGradient id="haW' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9572a"/><stop offset="1" stop-color="#6d3417"/></linearGradient>'
      +   '<linearGradient id="haM' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2a1d"/><stop offset="1" stop-color="#20140c"/></linearGradient>'
      +   '<linearGradient id="tpW' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6f91"/><stop offset="1" stop-color="#e24b6e"/></linearGradient>'
      +   '<linearGradient id="tpM' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fb0e6"/><stop offset="1" stop-color="#1c80b3"/></linearGradient>'
      + '</defs>'
      + '<path d="M28 52 L29.5 42.5 Q30.5 39.2 34 38.6 L50 38.6 Q53.4 39.2 54.4 42.5 L56 52 Z" fill="url(#tpM' + u + ')"/>'
      + '<rect x="38.4" y="31" width="7.2" height="9" rx="3" fill="url(#skM' + u + ')"/>'
      + '<ellipse cx="42" cy="22" rx="10.6" ry="11.6" fill="url(#skM' + u + ')"/>'
      + '<circle cx="31.8" cy="23" r="2" fill="url(#skM' + u + ')"/><circle cx="52.2" cy="23" r="2" fill="url(#skM' + u + ')"/>'
      + '<path d="M31.5 21 Q31.2 8.5 42 8.5 Q52.8 8.5 52.5 21 Q52.6 16 49.5 13.4 Q46 11.2 42 11.2 Q35.5 11.2 33.4 14.8 Q31.7 17.3 31.5 21 Z" fill="url(#haM' + u + ')"/>'
      + '<path d="M37.2 21.2 q1.6 -1 3.2 0" stroke="#3a2519" stroke-width="0.9" fill="none" stroke-linecap="round"/>'
      + '<path d="M43.6 21.2 q1.6 -1 3.2 0" stroke="#3a2519" stroke-width="0.9" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="38.8" cy="23" rx="1.15" ry="1.45" fill="#31241c"/><ellipse cx="45.2" cy="23" rx="1.15" ry="1.45" fill="#31241c"/>'
      + '<circle cx="39.2" cy="22.5" r="0.4" fill="#fff" opacity="0.85"/><circle cx="45.6" cy="22.5" r="0.4" fill="#fff" opacity="0.85"/>'
      + '<path d="M41.4 24.5 q0.6 0.7 1.2 0" stroke="#b57b52" stroke-width="0.8" fill="none" stroke-linecap="round"/>'
      + '<path d="M39.6 27.6 Q42 29.2 44.4 27.6" stroke="#a85c48" stroke-width="1" fill="none" stroke-linecap="round"/>'
      + '<path d="M6 52 L7.6 42.5 Q8.6 39.2 12 38.6 L28 38.6 Q31.4 39.2 32.4 42.5 L34 52 Z" fill="url(#tpW' + u + ')"/>'
      + '<rect x="18.4" y="31" width="7.2" height="9" rx="3" fill="url(#skW' + u + ')"/>'
      + '<path d="M8.5 25 Q7.4 6.5 22 6.5 Q36.6 6.5 35.5 25 Q36.2 34.5 31 40.5 L29 33.5 Q33 26 32 20 Q32 10.2 22 10.2 Q12 10.2 12 20 Q11 26 15 33.5 L13 40.5 Q7.8 34.5 8.5 25 Z" fill="url(#haW' + u + ')"/>'
      + '<ellipse cx="22" cy="20.5" rx="10.6" ry="11.6" fill="url(#skW' + u + ')"/>'
      + '<path d="M11.6 19.5 Q12.4 9.4 22 9.4 Q31.6 9.4 32.4 19.5 Q30 12.4 22 12.4 Q16.4 12.4 14 16.2 Q12.6 13.6 11.6 19.5 Z" fill="url(#haW' + u + ')"/>'
      + '<path d="M13.4 15.6 Q10.6 24 12.4 33" stroke="#89441f" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.55"/>'
      + '<path d="M17.4 19.6 q1.6 -1 3.2 0" stroke="#5a3018" stroke-width="0.9" fill="none" stroke-linecap="round"/>'
      + '<path d="M23.4 19.6 q1.6 -1 3.2 0" stroke="#5a3018" stroke-width="0.9" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="18.8" cy="21.4" rx="1.15" ry="1.5" fill="#3a2418"/><ellipse cx="25.2" cy="21.4" rx="1.15" ry="1.5" fill="#3a2418"/>'
      + '<circle cx="19.2" cy="20.9" r="0.4" fill="#fff" opacity="0.85"/><circle cx="25.6" cy="20.9" r="0.4" fill="#fff" opacity="0.85"/>'
      + '<ellipse cx="16.4" cy="24.4" rx="1.5" ry="1" fill="#f2a58a" opacity="0.5"/><ellipse cx="27.6" cy="24.4" rx="1.5" ry="1" fill="#f2a58a" opacity="0.5"/>'
      + '<path d="M21.4 22.8 q0.6 0.7 1.2 0" stroke="#c9865c" stroke-width="0.8" fill="none" stroke-linecap="round"/>'
      + '<path d="M19.6 26 Q22 27.7 24.4 26" stroke="#c65f5f" stroke-width="1.05" fill="none" stroke-linecap="round"/>'
      + '</svg>';
  }

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
      +   '<div style="min-width:0;"><div style="font-size:15px;font-weight:900;color:#fff;">Coach AL</div><div style="font-size:11px;color:#8a99a8;font-weight:700;">Your active-lifestyle coach</div></div>'
      + '</div>'
      + '<div id="ffp-coach-hub-body" class="ffp-noscroll" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;max-width:660px;width:100%;margin:0 auto;box-sizing:border-box;">'
      +   '<div style="text-align:center;color:#5f7d94;font-size:12px;padding:40px;">…</div>'
      + '</div>';
    document.body.appendChild(ov);
    injectNoScroll();
    var rf = refresh();
    if (!rf) { renderHub(null); return; }
    post('/api/coach/snapshot', { refresh: rf }).then(function (j) {
      if (!document.getElementById('ffp-coach-hub-ov')) return;
      if (j && j.snapshot) { C._snap = j.snapshot || {}; C._hook = j.hook || {}; C._catalog = j.motivations_catalog || []; }
      if (C._snap && C._snap.onboarded === false) renderHubOnboard(); else renderHub(C._snap, C._hook);
    }).catch(function () { renderHub(C._snap, C._hook); });
  };
  C.closeHub = function () { var o = document.getElementById('ffp-coach-hub-ov'); if (o && o.parentNode) o.parentNode.removeChild(o); };

  function renderHub(s, h) {
    var body = document.getElementById('ffp-coach-hub-body'); if (!body) return;
    s = s || {}; h = h || {};
    var streak = s.streak || 0;
    var rl = recLabel(s.latest_recovery);
    var strip = [];
    if (streak >= 1) strip.push(streak + '-DAY STREAK');
    if (rl) strip.push(rl.replace(/^Recovery /, 'RECOVERY ').toUpperCase());
    var stripLine = strip.length ? '<div style="color:#ffc08a;font-size:11px;font-weight:900;letter-spacing:1.5px;">' + esc(strip.join(' · ')) + '</div>' : '';
    var headline = esc(h.headline || 'Ready when you are.');
    var line = esc(h.line || 'Log a session, find people to move with, or chat with me about your active life.');
    var race = (s.race && s.race.rank)
      ? '<div style="margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.07);"><div style="color:#8fc7e8;font-size:13px;font-weight:800;">' + esc(s.race.quest || 'July race') + ' · #' + s.race.rank + ' · ' + s.race.points + ' pts</div>'
        + (s.race.gap_to_above > 0 ? '<div style="color:#9fb3c4;font-size:12.5px;margin-top:3px;">' + s.race.gap_to_above + ' points off ' + esc(s.race.above_name || 'the spot above') + '.</div>' : '') + '</div>'
      : '';
    body.innerHTML =
      '<div style="padding:22px 18px 26px;">'
      +   stripLine
      +   '<div style="color:#fff;font-size:22px;font-weight:900;line-height:1.18;margin-top:' + (stripLine ? '10px' : '0') + ';">' + headline + '</div>'
      +   '<div style="color:#cfe1ef;font-size:14px;line-height:1.55;margin-top:8px;">' + line + '</div>'
      +   '<div style="display:flex;gap:14px;margin-top:24px;padding-top:18px;border-top:1px solid rgba(255,255,255,.07);">' + pillarRow(s.pillars && s.pillars.counts) + '</div>'
      +   race
      +   '<div style="margin-top:26px;">'
      +     '<div style="display:flex;gap:9px;align-items:flex-end;">'
      +       '<textarea id="ffp-hub-input" rows="1" placeholder="Message Coach AL…" style="flex:1;resize:none;max-height:120px;background:#0e2032;border:1px solid rgba(255,255,255,.1);border-radius:14px;color:#e6eff7;font-family:inherit;font-size:14.5px;padding:12px 14px;outline:none;box-sizing:border-box;"></textarea>'
      +       '<button onclick="ffpCoach.hubSend()" aria-label="Send" style="flex:0 0 auto;width:44px;height:44px;border:none;border-radius:50%;background:#2ba8e0;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-icons">arrow_upward</span></button>'
      +     '</div>'
      +     '<div onclick="ffpCoach.openChat()" style="text-align:center;color:#8fd0f0;font-size:12.5px;font-weight:800;margin-top:12px;cursor:pointer;">Open full conversation</div>'
      +   '</div>'
      +   '<div style="display:flex;margin-top:22px;border-top:1px solid rgba(255,255,255,.07);">'
      +     '<button onclick="ffpCoach.logActivity()" style="flex:1;background:none;border:none;color:#8fd0f0;font-family:inherit;font-size:13.5px;font-weight:800;padding:17px 8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;"><span class="material-icons" style="font-size:18px;">add</span>Log activity</button>'
      +     '<div style="width:1px;background:rgba(255,255,255,.07);margin:11px 0;"></div>'
      +     '<button onclick="ffpCoach.goMeetups()" style="flex:1;background:none;border:none;color:#8fd0f0;font-family:inherit;font-size:13.5px;font-weight:800;padding:17px 8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;"><span class="material-icons" style="font-size:18px;">groups</span>Meetups</button>'
      +   '</div>'
      + '</div>';
    var ta = document.getElementById('ffp-hub-input');
    if (ta) {
      ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); C.hubSend(); } });
    }
  }

  // hub composer → open the full chat and send what they typed
  C.hubSend = function () {
    var ta = document.getElementById('ffp-hub-input'); var msg = ta ? (ta.value || '').trim() : '';
    C._pending = msg || null;
    C.openChat();
  };

  // First-run onboarding, rendered INSIDE the hub (motivations quick-pick + one goal).
  C._selMot = C._selMot || {};
  C.toggleMot = function (key, el) {
    C._selMot[key] = !C._selMot[key];
    if (el) { var on = C._selMot[key]; el.style.background = on ? '#2ba8e0' : 'rgba(43,168,224,.10)'; el.style.color = on ? '#fff' : '#cfe1ef'; el.style.borderColor = on ? '#2ba8e0' : 'rgba(43,168,224,.22)'; }
  };
  function renderHubOnboard() {
    var body = document.getElementById('ffp-coach-hub-body'); if (!body) return;
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
  function scrollBottom() { var b = document.getElementById('ffp-coach-thread'); if (b) b.scrollTop = b.scrollHeight; }

  C.openChat = function () {
    if (document.getElementById('ffp-coach-ov')) { if (C._pending) { var t = document.getElementById('ffp-coach-input'); if (t) { t.value = C._pending; C._pending = null; C.send(); } } return; }
    var ov = document.createElement('div'); ov.id = 'ffp-coach-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100062;background:#081420;display:flex;flex-direction:column;font-family:inherit;';
    ov.innerHTML =
      '<div style="flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:14px 16px calc(14px);border-bottom:1px solid rgba(255,255,255,.06);max-width:660px;width:100%;margin:0 auto;box-sizing:border-box;">' +
        '<span onclick="ffpCoach.closeChat()" class="material-icons" style="color:#8a99a8;cursor:pointer;">arrow_back</span>' +
        alMark(34) +
        '<div style="min-width:0;"><div style="font-size:15px;font-weight:900;color:#fff;">Coach AL</div><div style="font-size:11px;color:#8a99a8;font-weight:700;">Your active-lifestyle coach</div></div>' +
      '</div>' +
      '<div id="ffp-coach-thread" class="ffp-noscroll" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px 16px;max-width:660px;width:100%;margin:0 auto;box-sizing:border-box;"></div>' +
      '<div style="flex:0 0 auto;padding:10px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.06);max-width:660px;width:100%;margin:0 auto;box-sizing:border-box;">' +
        '<div style="display:flex;gap:9px;align-items:flex-end;">' +
          '<textarea id="ffp-coach-input" rows="1" placeholder="Ask Coach anything…" style="flex:1;resize:none;max-height:120px;background:#0e2032;border:1px solid rgba(255,255,255,.1);border-radius:14px;color:#e6eff7;font-family:inherit;font-size:14.5px;padding:11px 13px;outline:none;"></textarea>' +
          '<button id="ffp-coach-send" onclick="ffpCoach.send()" style="flex:0 0 auto;width:44px;height:44px;border:none;border-radius:50%;background:#2ba8e0;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-icons">arrow_upward</span></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    injectNoScroll();
    var ta = document.getElementById('ffp-coach-input');
    if (ta) {
      ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); C.send(); } });
      setTimeout(function () { try { ta.focus(); } catch (e) {} }, 120);
    }
    var th = document.getElementById('ffp-coach-thread');
    th.innerHTML = '<div id="ffp-coach-load" style="text-align:center;color:#5f7d94;font-size:12px;padding:20px;">…</div>';
    post('/api/coach/history', { refresh: refresh() }).then(function (j) {
      var t2 = document.getElementById('ffp-coach-thread'); if (!t2) return;
      var msgs = (j && j.messages) || [];
      if (!msgs.length) {
        var opener = (C._hook && C._hook.line) ? (C._hook.headline + ' ' + C._hook.line) : 'Hey — I’m Coach AL. I’m here for your training, motivation and finding people to move with. What’s on your mind?';
        t2.innerHTML = bubble('coach', nl2br(opener));
      } else {
        t2.innerHTML = msgs.map(function (m) { return bubble(m.role === 'coach' ? 'coach' : 'user', nl2br(m.content)); }).join('');
      }
      scrollBottom();
      if (C._pending) { var inp = document.getElementById('ffp-coach-input'); if (inp) { inp.value = C._pending; C._pending = null; C.send(); } }
    }).catch(function () {
      var t2 = document.getElementById('ffp-coach-thread'); if (t2) t2.innerHTML = bubble('coach', 'Hey — I’m Coach AL. What’s on your mind?');
      if (C._pending) { var inp = document.getElementById('ffp-coach-input'); if (inp) { inp.value = C._pending; C._pending = null; C.send(); } }
    });
  };
  C.closeChat = function () { var o = document.getElementById('ffp-coach-ov'); if (o && o.parentNode) o.parentNode.removeChild(o); };

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
      if (C._hook && C._hook.headline) C._setBadge(true);
      if (C._snap && C._snap.onboarded === false) { setTimeout(function () { try { C.startTour(); } catch (e) {} }, 900); }
    }).catch(function () {});
  };

  // hide scrollbars on our overlays (Grant: NO visible scrollbars, ever)
  function injectNoScroll() {
    if (document.getElementById('ffp-coach-css')) return;
    var st = document.createElement('style'); st.id = 'ffp-coach-css';
    st.textContent = '.ffp-noscroll{scrollbar-width:none;}.ffp-noscroll::-webkit-scrollbar{display:none;}';
    document.head.appendChild(st);
  }

  // Capture the member's REAL timezone once on load (browser Intl) so reminders fire at THEIR local time.
  try { var _tz = (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone; var _rf = refresh(); if (_tz && _rf) post('/api/member/timezone', { refresh: _rf, tz: _tz }); } catch (e) {}
  // Self-boot: decide the tour + attention dot.
  try { C._maybeTour(); } catch (e) {}
})();

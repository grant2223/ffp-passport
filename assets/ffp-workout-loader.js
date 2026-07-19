/* FFP AI Workout — v3 (panel-workout)
   v3: HOME tabs (Recent default + Try These = ready-made workouts). Editor: per-warm-up/cool-down sec⇄min
       toggle, per-exercise Reps⇄Time mode, weight optional (Bodyweight). Full-width section straps.
       Runner: smaller exercise name, much larger set line / target / rep+weight fields, big rest timer (easy
       to read from a distance), time-based sets run as a countdown, bodyweight hides the weight field.
       Finish saves to Activities (opens Log Activity prefilled → add a photo → the existing share-card path).
   Flat, no cards/pills. Lazy-loaded by the dashboard; self-renders into #wk-root. */
(function () {
  'use strict';
  var FFP_API = 'https://ffp-passport-backend.vercel.app';
  var WK = window.FFPWorkout = window.FFPWorkout || {};
  WK.plan = WK.plan || null;
  WK.run = WK.run || null;
  WK._recent = WK._recent || [];
  WK._tab = WK._tab || 'recent';

  function memberId() { try { var m = window.FFPAuth && FFPAuth.getMember && FFPAuth.getMember(); return m && m.id; } catch (e) { return null; } }
  function sb() { return window.supabase; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function toast(m, t) { if (window.showToast) showToast(m, t); }
  function root() { return document.getElementById('wk-root'); }
  function firstInt(s, d) { var m = String(s == null ? '' : s).match(/\d+/); return m ? parseInt(m[0], 10) : d; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isBW(w) { var s = String(w == null ? '' : w).trim().toLowerCase(); return s === '' || /body|^bw$|n\/?a|none/.test(s); }
  // Time ONLY — minutes need "min", seconds "s/sec", or mm:ss. A bare "200m" is METRES (distance), NOT minutes.
  function parseTimeSec(s) { var t = String(s == null ? '' : s).toLowerCase().trim(); var m; if ((m = t.match(/^(\d{1,3}):(\d{2})$/))) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10); if ((m = t.match(/(\d+)\s*(?:min|mins|minutes?)\b/))) return parseInt(m[1], 10) * 60; if ((m = t.match(/(\d+)\s*(?:sec|secs|s)\b/))) return parseInt(m[1], 10); return null; }
  function isDistanceStr(s) { s = String(s == null ? '' : s); return /(\d+)\s*(?:km|m|meters?|metres?|miles?|mi|yd|yards?)\b/i.test(s) && !/\bmin/i.test(s); }
  function isCalStr(s) { return /\b(?:cal|cals|calorie|calories|kcal)\b/i.test(String(s == null ? '' : s)); }
  // Explicit exercise metric: reps | time | distance | calories. Honour e.metric if the generator set it; else infer.
  function classifyMetric(e) {
    if (e && /^(?:reps|time|distance|calories)$/.test(String(e.metric || ''))) return e.metric;
    if (e && e.mode === 'time') return 'time';
    var r = e ? e.reps : '', n = e ? e.name : '';
    if (isCalStr(r) || isCalStr(n)) return 'calories';
    if (isDistanceStr(r)) return 'distance';
    if (parseTimeSec(r) != null) return 'time';
    return 'reps';
  }
  // Bogus meta "exercise" like "Rounds 2–4 (repeat above sequence)" — volume belongs in `sets`, so drop these.
  function isRepeatMeta(name) { var s = String(name == null ? '' : name).toLowerCase(); return /\b(?:repeat|rounds?|circuit)\b/.test(s) && /(?:above|sequence|again|as written|as above|x\s*\d)/.test(s); }
  // Weight is a KG number only. Intensity words ("moderate", "match load") are NOT weight.
  function numWeight(w) { var s = String(w == null ? '' : w).trim(); return /^\d/.test(s) ? (s.match(/\d+(?:\.\d+)?/) || [''])[0] : ''; }
  function fmt(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m > 0 ? (m + ':' + String(s).padStart(2, '0')) : String(s); }

  function normPlan(p) {
    if (!p) return p;
    p.warmup = (p.warmup || []).map(function (w) { return { name: w.name || '', duration_sec: firstInt(w.duration_sec, 30), note: w.note || '', _u: (w.duration_sec >= 60 && w.duration_sec % 60 === 0) ? 'min' : 'sec' }; });
    p.cooldown = (p.cooldown || []).map(function (c) { return { name: c.name || '', duration_sec: firstInt(c.duration_sec, 30), note: c.note || '', _u: (c.duration_sec >= 60 && c.duration_sec % 60 === 0) ? 'min' : 'sec' }; });
    p.exercises = (p.exercises || []).filter(function (e) { return e && e.name && !isRepeatMeta(e.name); }).map(function (e) {
      var metric = classifyMetric(e);
      var mode = (metric === 'time') ? 'time' : 'reps';   // only 'time' runs a countdown; reps/distance/calories are a target
      var t = parseTimeSec(e.reps);
      var time_sec = (e.time_sec != null) ? firstInt(e.time_sec, 30) : (t != null ? t : 30);
      var wRaw = String(e.weight == null ? '' : e.weight).trim();
      var wNum = numWeight(wRaw);
      var note = e.note || '';
      if (wRaw && !wNum && !isBW(wRaw)) { note = note ? (note + ' · ' + wRaw) : wRaw; }   // intensity word → note, never the weight box
      return { name: e.name || '', metric: metric, mode: mode, sets: Math.max(1, firstInt(e.sets, 3)), reps: (e.reps != null ? String(e.reps) : '10'), time_sec: time_sec, rest_sec: firstInt(e.rest_sec, 75), weight: wNum, note: note, _u: (time_sec >= 60 && time_sec % 60 === 0) ? 'min' : 'sec' };
    });
    return p;
  }

  // ───────────────────────── ready-made workouts ─────────────────────────
  var PRESETS = [
    { title: 'Full body · dumbbells', focus: 'whole body', duration_min: 40,
      warmup: [{ name: 'Arm circles', duration_sec: 30 }, { name: 'Bodyweight squats', duration_sec: 45 }, { name: 'Hip openers', duration_sec: 45 }],
      exercises: [{ name: 'Goblet squat', sets: 4, reps: '10', rest_sec: 90, weight: 'moderate', note: 'Chest tall' }, { name: 'DB Romanian deadlift', sets: 3, reps: '12', rest_sec: 90, weight: 'moderate', note: 'Hinge at hips' }, { name: 'DB bench press', sets: 4, reps: '8-10', rest_sec: 75, weight: 'moderate' }, { name: 'One-arm DB row', sets: 3, reps: '10 each', rest_sec: 60, weight: 'moderate' }, { name: 'Plank', sets: 3, reps: '45s', rest_sec: 45, weight: 'bodyweight' }],
      cooldown: [{ name: 'Chest stretch', duration_sec: 30 }, { name: 'Hamstring stretch', duration_sec: 40 }] },
    { title: 'Upper body', focus: 'push & pull', duration_min: 35,
      warmup: [{ name: 'Band pull-aparts', duration_sec: 45 }, { name: 'Shoulder rolls', duration_sec: 30 }],
      exercises: [{ name: 'Push-ups', sets: 4, reps: '10-15', rest_sec: 60, weight: 'bodyweight' }, { name: 'DB shoulder press', sets: 3, reps: '10', rest_sec: 75, weight: 'moderate' }, { name: 'DB row', sets: 4, reps: '10', rest_sec: 60, weight: 'moderate' }, { name: 'Bicep curl', sets: 3, reps: '12', rest_sec: 45, weight: 'light' }, { name: 'Tricep dips', sets: 3, reps: '12', rest_sec: 45, weight: 'bodyweight' }],
      cooldown: [{ name: 'Doorway chest stretch', duration_sec: 40 }, { name: 'Tricep stretch', duration_sec: 30 }] },
    { title: 'Lower body / legs', focus: 'legs & glutes', duration_min: 35,
      warmup: [{ name: 'Leg swings', duration_sec: 45 }, { name: 'Walking lunges', duration_sec: 45 }, { name: 'Glute bridges', duration_sec: 45 }],
      exercises: [{ name: 'Back / goblet squat', sets: 4, reps: '8-10', rest_sec: 90, weight: 'moderate' }, { name: 'Romanian deadlift', sets: 4, reps: '10', rest_sec: 90, weight: 'moderate' }, { name: 'Walking lunges', sets: 3, reps: '10 each', rest_sec: 60, weight: 'moderate' }, { name: 'Calf raises', sets: 3, reps: '15', rest_sec: 40, weight: 'moderate' }],
      cooldown: [{ name: 'Quad stretch', duration_sec: 40 }, { name: 'Couch stretch', duration_sec: 45 }] },
    { title: 'Core finisher', focus: 'core', duration_min: 12,
      warmup: [{ name: 'Cat-cow', duration_sec: 40 }],
      exercises: [{ name: 'Plank', sets: 3, reps: '45s', rest_sec: 30, weight: 'bodyweight' }, { name: 'Bicycle crunches', sets: 3, reps: '20', rest_sec: 30, weight: 'bodyweight' }, { name: 'Dead bug', sets: 3, reps: '12 each', rest_sec: 30, weight: 'bodyweight' }, { name: 'Hollow hold', sets: 3, reps: '30s', rest_sec: 30, weight: 'bodyweight' }],
      cooldown: [{ name: 'Child’s pose', duration_sec: 40 }, { name: 'Cobra stretch', duration_sec: 30 }] },
    { title: 'HIIT · 20 min', focus: 'conditioning', duration_min: 20,
      warmup: [{ name: 'Jog on spot', duration_sec: 60 }, { name: 'Jumping jacks', duration_sec: 45 }],
      exercises: [{ name: 'Burpees', sets: 4, reps: '40s', rest_sec: 20, weight: 'bodyweight' }, { name: 'Mountain climbers', sets: 4, reps: '40s', rest_sec: 20, weight: 'bodyweight' }, { name: 'Squat jumps', sets: 4, reps: '40s', rest_sec: 20, weight: 'bodyweight' }, { name: 'High knees', sets: 4, reps: '40s', rest_sec: 20, weight: 'bodyweight' }],
      cooldown: [{ name: 'Walk it out', duration_sec: 60 }, { name: 'Quad stretch', duration_sec: 40 }] },
    { title: 'Mobility & stretch', focus: 'mobility', duration_min: 15,
      warmup: [{ name: 'Neck rolls', duration_sec: 30 }],
      exercises: [{ name: 'World’s greatest stretch', sets: 2, reps: '40s', rest_sec: 15, weight: 'bodyweight' }, { name: 'Hip 90/90', sets: 2, reps: '45s', rest_sec: 15, weight: 'bodyweight' }, { name: 'Thoracic rotations', sets: 2, reps: '40s', rest_sec: 15, weight: 'bodyweight' }, { name: 'Deep squat hold', sets: 2, reps: '45s', rest_sec: 15, weight: 'bodyweight' }],
      cooldown: [{ name: 'Forward fold', duration_sec: 45 }, { name: 'Pigeon stretch', duration_sec: 45 }] },
    { title: 'Bodyweight at home', focus: 'no equipment', duration_min: 30,
      warmup: [{ name: 'Jumping jacks', duration_sec: 45 }, { name: 'Arm circles', duration_sec: 30 }],
      exercises: [{ name: 'Push-ups', sets: 4, reps: '12', rest_sec: 60, weight: 'bodyweight' }, { name: 'Air squats', sets: 4, reps: '15', rest_sec: 60, weight: 'bodyweight' }, { name: 'Reverse lunges', sets: 3, reps: '10 each', rest_sec: 45, weight: 'bodyweight' }, { name: 'Plank', sets: 3, reps: '45s', rest_sec: 30, weight: 'bodyweight' }, { name: 'Glute bridges', sets: 3, reps: '15', rest_sec: 30, weight: 'bodyweight' }],
      cooldown: [{ name: 'Hamstring stretch', duration_sec: 40 }, { name: 'Chest stretch', duration_sec: 30 }] }
  ];

  // ───────────────────────── styles (flat, straps) ─────────────────────────
  function injectStyles() {
    if (document.getElementById('ffp-workout-styles')) return;
    var s = document.createElement('style'); s.id = 'ffp-workout-styles'; s.textContent =
      '#wk-root{padding:6px 2px 30px;}' +
      '.wk-prompt{width:100%;box-sizing:border-box;min-height:104px;background:rgba(255,255,255,.04);border:none;border-radius:14px;color:var(--text);font-size:16px;font-weight:500;font-family:inherit;padding:15px;resize:vertical;line-height:1.45;}' +
      '.wk-prompt::placeholder{color:var(--muted);}' +
      '.wk-cta{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;text-align:center;padding:19px;border-radius:14px;border:none;font-size:15px;font-weight:800;font-family:inherit;cursor:pointer;}' +
      '.wk-cta.pri{background:var(--yellow);color:#10202b;}' +
      '.wk-cta.blue{background:var(--blue);color:#fff;}' +
      '.wk-cta.soft{background:rgba(255,255,255,.07);color:var(--text);}' +
      '.wk-cta .material-icons{font-size:19px;}' +
      '.wk-link{background:none;border:none;color:var(--blue);font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer;padding:8px 0;}' +
      '.wk-hint{font-size:12px;color:var(--muted);margin-top:12px;line-height:1.5;}' +
      '.wk-tabs{display:flex;gap:26px;border-bottom:1px solid var(--border);margin:22px 2px 0;}' +
      '.wk-tab{padding:11px 0;font-size:14px;font-weight:800;color:var(--muted);border-bottom:2px solid transparent;cursor:pointer;background:none;border-top:none;border-left:none;border-right:none;font-family:inherit;}' +
      '.wk-tab.on{color:var(--text);border-bottom-color:var(--blue);}' +
      // full-width section strap
      '.wk-h{font-size:12px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--text);margin:24px -22px 8px;padding:11px 22px;background:rgba(255,255,255,.06);}' +
      '.wk-row{display:flex;align-items:center;gap:12px;padding:14px 2px;border-bottom:1px solid var(--border);cursor:pointer;}' +
      '.wk-row .nm{flex:1;min-width:0;}' +
      '.wk-row .t{font-size:15px;font-weight:700;color:var(--text);}' +
      '.wk-row .s{font-size:12px;color:var(--muted);font-weight:600;margin-top:3px;}' +
      '.wk-row .material-icons{color:var(--muted);}' +
      '.wk-eb{padding:14px 0;border-bottom:1px solid var(--border);}' +
      '.wk-eb-top{display:flex;align-items:center;gap:10px;}' +
      '.wk-nin{flex:1;background:none;border:none;border-bottom:1px solid transparent;color:var(--text);font-size:16px;font-weight:700;font-family:inherit;padding:2px 0;}' +
      '.wk-nin:focus{border-bottom-color:var(--blue);outline:none;}' +
      '.wk-del{background:none;border:none;color:var(--muted);font-size:22px;line-height:1;cursor:pointer;padding:0 2px;flex:0 0 auto;}' +
      '.wk-modetog{display:inline-flex;gap:2px;margin:10px 0 2px;background:rgba(255,255,255,.05);border-radius:8px;padding:2px;}' +
      '.wk-modetog button{background:none;border:none;color:var(--muted);font-size:12px;font-weight:800;font-family:inherit;padding:5px 12px;border-radius:6px;cursor:pointer;}' +
      '.wk-modetog button.on{background:var(--blue);color:#fff;}' +
      '.wk-mini{display:flex;gap:22px;margin-top:10px;flex-wrap:wrap;align-items:flex-end;}' +
      '.wk-mini label{display:block;font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin-bottom:2px;}' +
      '.wk-mini input{width:56px;background:none;border:none;border-bottom:1px solid var(--border-mid);color:var(--text);font-size:16px;font-weight:700;font-family:inherit;padding:3px 0;}' +
      '.wk-mini input.w{width:108px;}' +
      '.wk-mini input:focus{border-bottom-color:var(--blue);outline:none;}' +
      '.wk-unit{background:none;border:none;color:var(--blue);font-size:12px;font-weight:800;font-family:inherit;cursor:pointer;padding:3px 2px;margin-left:2px;}' +
      '.wk-erow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);}' +
      // runner
      '#wk-runner{position:fixed;inset:0;z-index:100060;background:#0a1520;display:none;flex-direction:column;}' +
      '#wk-runner.open{display:flex;}' +
      '.wkr-top{display:flex;align-items:center;gap:12px;padding:16px 18px 8px;}' +
      '.wkr-prog{flex:1;height:5px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;}' +
      '.wkr-prog > i{display:block;height:5px;background:var(--blue);border-radius:3px;transition:width .3s;}' +
      '.wkr-close{width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:#fff;cursor:pointer;flex:0 0 auto;}' +
      '.wkr-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px 20px;overflow-y:auto;}' +
      '.wkr-section{font-size:13px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--blue);}' +
      '.wkr-name{font-size:24px;font-weight:800;color:#fff;margin:6px 0 14px;line-height:1.1;}' +
      '.wkr-setline{font-size:34px;font-weight:800;color:#fff;margin-bottom:10px;line-height:1.05;}' +
      '.wkr-target{font-size:14px;font-weight:800;letter-spacing:.4px;color:var(--blue);margin-bottom:30px;line-height:1.3;}' +
      '.wkr-note{font-size:13px;color:#8a99a8;margin-top:16px;max-width:300px;}' +
      // Reps / Weight entry ~3x larger (Grant 2026-07-18): a big filled, tappable box with oversized numerals
      // — far easier to read + hit mid-set than the old thin underline.
      '.wkr-fills{display:flex;gap:18px;margin-bottom:26px;}' +
      '.wkr-fill label{display:block;font-size:15px;font-weight:800;letter-spacing:.6px;color:var(--muted);text-transform:uppercase;margin-bottom:11px;}' +
      '.wkr-fill input{box-sizing:border-box;width:152px;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.16);border-radius:18px;color:#fff;font-size:58px;font-weight:800;text-align:center;font-family:inherit;padding:16px 8px;line-height:1;}' +
      '.wkr-fill input:focus{border-color:var(--blue);outline:none;background:rgba(43,168,224,.10);}' +
      '.wkr-ring{width:190px;height:190px;border-radius:50%;border:6px solid rgba(43,168,224,.20);border-top-color:var(--blue);display:flex;align-items:center;justify-content:center;margin:8px auto 18px;}' +
      '.wkr-ring .t{font-size:62px;font-weight:800;color:#fff;}' +
      '.wkr-ring.rest{width:290px;height:290px;border-width:9px;margin:10px auto 22px;}' +
      '.wkr-ring.rest .t{font-size:142px;font-weight:800;line-height:1;}' +
      '.wkr-next{font-size:16px;color:#cdd7e0;font-weight:700;margin-bottom:6px;}' +
      '.wkr-foot{padding:14px 22px calc(env(safe-area-inset-bottom,0px) + 36px);display:flex;gap:12px;}' +
      '.wkr-foot .wk-cta{flex:1;}' +
      '.wkr-stats{display:flex;width:100%;max-width:330px;margin:22px 0 4px;}' +
      '.wk-stat{flex:1;text-align:center;}' +
      '.wk-stat + .wk-stat{border-left:1px solid rgba(255,255,255,.08);}' +
      '.wk-stat .v{font-size:27px;font-weight:800;color:#fff;}' +
      '.wk-stat .l{font-size:10px;font-weight:800;letter-spacing:.6px;color:var(--muted);text-transform:uppercase;margin-top:3px;}';
    document.head.appendChild(s);
  }

  // ───────────────────────── HOME (tabbed) ─────────────────────────
  WK.home = function () {
    injectStyles();
    var host = root(); if (!host) return;
    host.innerHTML =
      '<textarea class="wk-prompt" id="wk-prompt" placeholder="Describe your session — e.g. 35-min full-body dumbbell workout, go easy on my knees"></textarea>' +
      '<button class="wk-cta pri" style="margin-top:14px;" onclick="FFPWorkout.generate()"><span class="material-icons">bolt</span>Generate workout</button>' +
      '<div style="text-align:center;"><button class="wk-link" onclick="FFPWorkout.manual()">or build one manually</button></div>' +
      '<div class="wk-tabs">' +
        '<button class="wk-tab' + (WK._tab === 'recent' ? ' on' : '') + '" onclick="FFPWorkout.setTab(\'recent\')">Recent</button>' +
        '<button class="wk-tab' + (WK._tab === 'try' ? ' on' : '') + '" onclick="FFPWorkout.setTab(\'try\')">Try these</button>' +
      '</div>' +
      '<div id="wk-tabc"></div>';
    renderTab();
  };
  WK.setTab = function (t) { WK._tab = t; var ts = document.querySelectorAll('.wk-tab'); if (ts[0]) ts[0].classList.toggle('on', t === 'recent'); if (ts[1]) ts[1].classList.toggle('on', t === 'try'); renderTab(); };

  function renderTab() {
    var host = document.getElementById('wk-tabc'); if (!host) return;
    if (WK._tab === 'try') {
      host.innerHTML = PRESETS.map(function (p, i) {
        return '<div class="wk-row" onclick="FFPWorkout.openPreset(' + i + ')">' +
          '<div class="nm"><div class="t">' + esc(p.title) + '</div><div class="s">' + p.duration_min + ' min · ' + p.exercises.length + ' exercises · ' + esc(p.focus) + '</div></div>' +
          '<span class="material-icons">chevron_right</span></div>';
      }).join('');
      return;
    }
    host.innerHTML = '<div class="wk-hint">Loading…</div>';
    var mid = memberId();
    if (!sb() || !mid) { host.innerHTML = '<div class="wk-hint">Sign in to see your saved workouts.</div>'; return; }
    sb().from('workout_plans').select('id, title, focus, duration_min, plan, created_at').eq('member_id', mid).order('created_at', { ascending: false }).limit(12)
      .then(function (res) {
        if (res.error || WK._tab !== 'recent') { return; }
        WK._recent = res.data || [];
        if (!WK._recent.length) { host.innerHTML = '<div class="wk-hint">No workouts yet — generate one, pick a ready-made one from “Try these”, or build your own.</div>'; return; }
        host.innerHTML = WK._recent.map(function (r, i) {
          var ex = (r.plan && r.plan.exercises) ? r.plan.exercises.length : 0;
          return '<div class="wk-row" onclick="FFPWorkout.openRecent(' + i + ')">' +
            '<div class="nm"><div class="t">' + esc(r.title || 'Workout') + '</div>' +
            '<div class="s">' + (r.duration_min ? (r.duration_min + ' min · ') : '') + ex + ' exercises' + (r.focus ? (' · ' + esc(r.focus)) : '') + '</div></div>' +
            '<span class="material-icons">chevron_right</span></div>';
        }).join('');
      });
  }
  WK.openRecent = function (i) { var r = WK._recent[i]; if (r && r.plan) { WK.plan = normPlan(r.plan); WK._planId = r.id; WK.review(); } };
  WK.openPreset = function (i) { var p = PRESETS[i]; if (p) { WK.plan = normPlan(clone(p)); WK._planId = null; WK.review(); } };

  WK.manual = function () {
    WK.plan = normPlan({ title: 'My workout', focus: '', duration_min: 0,
      warmup: [{ name: '', duration_sec: 30 }], exercises: [{ name: '', sets: 3, reps: '10', rest_sec: 75, weight: '' }], cooldown: [{ name: '', duration_sec: 30 }] });
    WK._planId = null; WK.review();
  };

  // ───────────────────────── GENERATE ─────────────────────────
  WK.generate = function () {
    var t = document.getElementById('wk-prompt');
    var prompt = (t && t.value || '').trim();
    if (prompt.length < 3) { toast('Describe your workout first', 'error'); return; }
    var host = root();
    host.innerHTML = '<div style="text-align:center;padding:48px 16px;"><div style="width:34px;height:34px;border-radius:50%;border:3px solid rgba(43,168,224,.25);border-top-color:var(--blue);margin:0 auto 18px;animation:wkspin 0.8s linear infinite;"></div><div style="font-weight:700;color:var(--text);">Building your workout…</div><div class="wk-hint">Coaching up warm-up, sets and cool-down</div></div><style>@keyframes wkspin{to{transform:rotate(360deg);}}</style>';
    fetch(FFP_API + '/api/workout/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt, member_id: memberId() }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }, function () { return { ok: false, status: r.status, j: null }; }); })
      .then(function (res) {
        if (res.status === 503) { toast('Workout AI isn’t switched on yet', 'error'); WK.home(); return; }
        if (!res.ok || !res.j || !res.j.plan) { toast('Could not generate — try rephrasing', 'error'); WK.home(); return; }
        WK.plan = normPlan(res.j.plan); WK._planId = null; WK.plan._prompt = prompt;
        savePlan(prompt);
        WK.review();
      })
      .catch(function () { toast('Network error — try again', 'error'); WK.home(); });
  };

  function savePlan(prompt) {
    var mid = memberId(); if (!sb() || !mid || !WK.plan) return;
    sb().from('workout_plans').insert({ member_id: mid, title: WK.plan.title, focus: WK.plan.focus, duration_min: WK.plan.duration_min, plan: WK.plan, source_prompt: prompt || '' }).select('id').single()
      .then(function (res) { if (!res.error && res.data) WK._planId = res.data.id; });
  }
  function persistPlan() {
    var mid = memberId(); if (!sb() || !mid || !WK.plan) return;
    var row = { member_id: mid, title: WK.plan.title || 'Workout', focus: WK.plan.focus || '', duration_min: WK.plan.duration_min || 0, plan: WK.plan, source_prompt: WK.plan._prompt || '' };
    if (WK._planId) sb().from('workout_plans').update(row).eq('id', WK._planId).then(function () {});
    else sb().from('workout_plans').insert(row).select('id').single().then(function (res) { if (!res.error && res.data) WK._planId = res.data.id; });
  }

  // ───────────────────────── REVIEW (flat, editable, straps) ─────────────────────────
  WK.review = function () {
    injectStyles();
    var host = root(); if (!host || !WK.plan) { WK.home(); return; }
    var p = WK.plan;
    function mob(sec, items) {
      return (items || []).map(function (w, i) {
        var disp = (w._u === 'min') ? Math.round(w.duration_sec / 60) : w.duration_sec;
        return '<div class="wk-erow">' +
          '<input class="wk-nin" placeholder="Movement" value="' + esc(w.name) + '" oninput="FFPWorkout.edit(\'' + sec + '\',' + i + ',\'name\',this.value)">' +
          '<input class="wk-nin" style="width:54px;flex:0 0 auto;text-align:right;" type="number" inputmode="numeric" value="' + esc(disp) + '" oninput="FFPWorkout.editDur(\'' + sec + '\',' + i + ',this.value)">' +
          '<button class="wk-unit" onclick="FFPWorkout.toggleUnit(\'' + sec + '\',' + i + ')">' + (w._u === 'min' ? 'min' : 'sec') + '</button>' +
          '<button class="wk-del" onclick="FFPWorkout.rm(\'' + sec + '\',' + i + ')">×</button></div>';
      }).join('');
    }
    var exs = (p.exercises || []).map(function (e, i) {
      var secondField = (e.mode === 'time')
        ? ('<div class="f"><label>Time</label><input type="number" inputmode="numeric" value="' + ((e._u === 'min') ? Math.round(e.time_sec / 60) : e.time_sec) + '" oninput="FFPWorkout.editTime(' + i + ',this.value)"><button class="wk-unit" onclick="FFPWorkout.toggleExUnit(' + i + ')">' + (e._u === 'min' ? 'min' : 'sec') + '</button></div>')
        : ('<div class="f"><label>Reps</label><input value="' + esc(e.reps) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'reps\',this.value)"></div>');
      return '<div class="wk-eb">' +
        '<div class="wk-eb-top"><input class="wk-nin" placeholder="Exercise name" value="' + esc(e.name) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'name\',this.value)"><button class="wk-del" onclick="FFPWorkout.rm(\'exercises\',' + i + ')">×</button></div>' +
        '<div class="wk-modetog"><button class="' + (e.mode !== 'time' ? 'on' : '') + '" onclick="FFPWorkout.setMode(' + i + ',\'reps\')">Reps</button><button class="' + (e.mode === 'time' ? 'on' : '') + '" onclick="FFPWorkout.setMode(' + i + ',\'time\')">Time</button></div>' +
        '<div class="wk-mini">' +
          '<div class="f"><label>Sets</label><input type="number" inputmode="numeric" value="' + esc(e.sets) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'sets\',this.value)"></div>' +
          secondField +
          '<div class="f"><label>Rest s</label><input type="number" inputmode="numeric" value="' + esc(e.rest_sec) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'rest_sec\',this.value)"></div>' +
          '<div class="f"><label>Weight</label><input class="w" placeholder="Bodyweight" value="' + esc(e.weight) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'weight\',this.value)"></div>' +
        '</div>' + '</div>';
    }).join('');
    host.innerHTML =
      '<input id="wk-title" value="' + esc(p.title || 'Workout') + '" oninput="FFPWorkout.editTitle(this.value)" style="width:100%;box-sizing:border-box;background:none;border:none;color:var(--text);font-size:22px;font-weight:800;font-family:inherit;padding:6px 2px;">' +
      '<div class="wk-h">Warm-up</div>' + mob('warmup', p.warmup) + '<button class="wk-link" onclick="FFPWorkout.add(\'warmup\')">+ Add warm-up</button>' +
      '<div class="wk-h">Workout</div>' + exs + '<button class="wk-link" onclick="FFPWorkout.add(\'exercises\')">+ Add exercise</button>' +
      '<div class="wk-h">Cool-down</div>' + mob('cooldown', p.cooldown) + '<button class="wk-link" onclick="FFPWorkout.add(\'cooldown\')">+ Add cool-down</button>' +
      '<div style="display:flex;gap:12px;margin-top:26px;">' +
        '<button class="wk-cta soft" style="flex:0 0 34%;" onclick="FFPWorkout.home()">Back</button>' +
        '<button class="wk-cta blue" onclick="FFPWorkout.start()"><span class="material-icons">play_arrow</span>Start workout</button>' +
      '</div>';
  };
  WK.editTitle = function (v) { if (WK.plan) WK.plan.title = v; };
  WK.edit = function (sec, i, field, v) { var a = WK.plan && WK.plan[sec]; if (!a || !a[i]) return; if (field === 'sets' || field === 'rest_sec') v = firstInt(v, field === 'sets' ? 1 : 60); a[i][field] = v; };
  WK.editDur = function (sec, i, v) { var a = WK.plan && WK.plan[sec]; if (!a || !a[i]) return; var f = a[i]._u === 'min' ? 60 : 1; a[i].duration_sec = Math.max(1, Math.round((parseFloat(v) || 0) * f)); };
  WK.toggleUnit = function (sec, i) { var a = WK.plan && WK.plan[sec]; if (!a || !a[i]) return; a[i]._u = a[i]._u === 'min' ? 'sec' : 'min'; WK.review(); };
  WK.editTime = function (i, v) { var a = WK.plan && WK.plan.exercises; if (!a || !a[i]) return; var f = a[i]._u === 'min' ? 60 : 1; a[i].time_sec = Math.max(1, Math.round((parseFloat(v) || 0) * f)); };
  WK.toggleExUnit = function (i) { var a = WK.plan && WK.plan.exercises; if (!a || !a[i]) return; a[i]._u = a[i]._u === 'min' ? 'sec' : 'min'; WK.review(); };
  WK.setMode = function (i, m) { var a = WK.plan && WK.plan.exercises; if (!a || !a[i]) return; a[i].mode = m; WK.review(); };
  WK.rm = function (sec, i) { var a = WK.plan && WK.plan[sec]; if (a) { a.splice(i, 1); WK.review(); } };
  WK.add = function (sec) {
    if (!WK.plan) return; if (!WK.plan[sec]) WK.plan[sec] = [];
    if (sec === 'exercises') WK.plan.exercises.push({ name: '', mode: 'reps', sets: 3, reps: '10', time_sec: 30, rest_sec: 75, weight: '', _u: 'sec' });
    else WK.plan[sec].push({ name: '', duration_sec: 30, _u: 'sec' });
    WK.review();
  };

  // ───────────────────────── GUIDED RUNNER ─────────────────────────
  function buildSteps(p) {
    var steps = [];
    (p.warmup || []).forEach(function (w) { if (w.name) steps.push({ kind: 'mob', section: 'Warm-up', name: w.name, dur: firstInt(w.duration_sec, 30) }); });
    (p.exercises || []).forEach(function (e, ei) {
      if (!e.name) return;
      var sets = Math.max(1, firstInt(e.sets, 1));
      for (var n = 1; n <= sets; n++) {
        steps.push({ kind: (e.mode === 'time' ? 'timeset' : 'set'), section: 'Workout', exIndex: ei, name: e.name, setNo: n, setsTotal: sets, metric: e.metric || 'reps', reps: e.reps, time_sec: firstInt(e.time_sec, 30), rest: firstInt(e.rest_sec, 0), weight: e.weight, note: e.note });
      }
    });
    (p.cooldown || []).forEach(function (c) { if (c.name) steps.push({ kind: 'mob', section: 'Cool-down', name: c.name, dur: firstInt(c.duration_sec, 30) }); });
    // PREP (Grant 2026-07-18): a get-ready countdown before anything starts, showing what's first so the
    // member can position themselves instead of being thrown straight into rep 1.
    if (steps.length) steps.unshift({ kind: 'prep', name: steps[0].name, section: steps[0].section || 'Warm-up', dur: 15 });
    return steps;
  }
  function ensureRunnerEl() {
    var el = document.getElementById('wk-runner'); if (el) return el;
    el = document.createElement('div'); el.id = 'wk-runner';
    el.innerHTML = '<div class="wkr-top"><button class="wkr-close" onclick="FFPWorkout.quit()"><span class="material-icons" style="vertical-align:-6px;">close</span></button><div class="wkr-prog"><i id="wkr-prog-fill" style="width:0%"></i></div></div><div class="wkr-body" id="wkr-body"></div><div class="wkr-foot" id="wkr-foot"></div>';
    document.body.appendChild(el); return el;
  }
  WK.start = function () {
    if (!WK.plan) return;
    var steps = buildSteps(WK.plan);
    if (!steps.length) { toast('Add at least one exercise', 'error'); return; }
    persistPlan();
    WK.run = { plan: WK.plan, steps: steps, i: 0, performed: [], startedAt: Date.now(), timer: null, lastWeight: {} };
    ensureRunnerEl().classList.add('open');
    renderStep();
  };
  function clearTimer() { if (WK.run && WK.run.timer) { clearInterval(WK.run.timer); WK.run.timer = null; } }
  function setProgress() { var f = document.getElementById('wkr-prog-fill'); if (f && WK.run) f.style.width = Math.round((WK.run.i / WK.run.steps.length) * 100) + '%'; }

  function renderStep() {
    clearTimer();
    var r = WK.run; if (!r) return;
    setProgress();
    if (r.i >= r.steps.length) { finish(); return; }
    var step = r.steps[r.i];
    var body = document.getElementById('wkr-body'), foot = document.getElementById('wkr-foot');
    if (step.kind === 'prep') {
      body.innerHTML = '<div class="wkr-section">Get ready</div>' +
        '<div class="wkr-name" style="font-size:26px;margin-bottom:6px;">First up: ' + esc(step.name) + '</div>' +
        '<div class="wkr-note" style="margin-bottom:6px;">' + esc(step.section || '') + ' · get into position</div>' +
        '<div class="wkr-ring"><div class="t" id="wkr-count">' + fmt(step.dur) + '</div></div>';
      foot.innerHTML = '<button class="wk-cta pri" onclick="FFPWorkout.next()">I’m ready — start</button>';
      countdown(step.dur, function () { WK.next(); });
      return;
    }
    if (step.kind === 'mob') {
      body.innerHTML = '<div class="wkr-section">' + esc(step.section) + '</div><div class="wkr-name" style="font-size:30px;margin-bottom:8px;">' + esc(step.name) + '</div><div class="wkr-ring"><div class="t" id="wkr-count">' + fmt(step.dur) + '</div></div>';
      foot.innerHTML = '<button class="wk-cta soft" onclick="FFPWorkout.next()">Skip</button><button class="wk-cta blue" onclick="FFPWorkout.next()">Done</button>';
      countdown(step.dur, function () { WK.next(); });
    } else if (step.kind === 'timeset') {
      body.innerHTML = '<div class="wkr-section">' + esc(step.section) + '</div><div class="wkr-name">' + esc(step.name) + '</div>' +
        '<div class="wkr-setline"><span style="color:var(--yellow);">Set ' + step.setNo + '</span> of ' + step.setsTotal + '</div>' +
        '<div class="wkr-ring"><div class="t" id="wkr-count">' + fmt(step.time_sec) + '</div></div>' +
        (step.note ? '<div class="wkr-note">' + esc(step.note) + '</div>' : '');
      foot.innerHTML = '<button class="wk-cta pri" onclick="FFPWorkout.completeTime()">Complete set</button>';
      countdown(step.time_sec, function () { WK.completeTime(); });
    } else {
      var metric = step.metric || 'reps';
      var wNum = numWeight(step.weight);
      var showWeight = (metric === 'reps') && !!wNum;                 // weight box ONLY for a loaded lift — never for cardio/distance/calories/bodyweight
      var primaryLabel = (metric === 'distance') ? 'Distance' : (metric === 'calories') ? 'Calories' : 'Reps';
      var repsHasUnit = /[a-z]/i.test(String(step.reps || ''));       // "200m" / "30 cal" already carry their unit
      var unitTxt = repsHasUnit ? '' : (metric === 'reps' ? ' reps' : (metric === 'distance' ? ' m' : metric === 'calories' ? ' cal' : ''));
      var prefPrimary = firstInt(step.reps, 10);
      var prefW = (r.lastWeight[step.exIndex] != null) ? r.lastWeight[step.exIndex] : wNum;
      body.innerHTML = '<div class="wkr-section">' + esc(step.section) + '</div><div class="wkr-name">' + esc(step.name) + '</div>' +
        '<div class="wkr-setline"><span style="color:var(--yellow);">Set ' + step.setNo + '</span> of ' + step.setsTotal + '</div>' +
        '<div class="wkr-target">Target ' + esc(step.reps) + unitTxt + (showWeight ? (' · ' + esc(wNum) + ' kg') : '') + '</div>' +
        '<div class="wkr-fills">' +
          '<div class="wkr-fill"><label>' + primaryLabel + '</label><input id="wkr-reps" type="number" inputmode="numeric" value="' + prefPrimary + '"></div>' +
          (showWeight ? '<div class="wkr-fill"><label>Weight kg</label><input id="wkr-weight" type="number" inputmode="decimal" value="' + esc(prefW) + '" placeholder="–"></div>' : '') +
        '</div>' +
        (step.note ? '<div class="wkr-note">' + esc(step.note) + '</div>' : '');
      foot.innerHTML = '<button class="wk-cta pri" onclick="FFPWorkout.completeSet()">Complete set</button>';
    }
  }

  function countdown(sec, done) {
    var r = WK.run; if (!r) return;
    var end = Date.now() + sec * 1000;
    r.timer = setInterval(function () {
      var rem = (end - Date.now()) / 1000;
      var c = document.getElementById('wkr-count'); if (c) c.textContent = fmt(rem);
      if (rem <= 0) { clearTimer(); done(); }
    }, 250);
  }

  WK.completeSet = function () {
    var r = WK.run; if (!r) return;
    var step = r.steps[r.i];
    var reps = firstInt((document.getElementById('wkr-reps') || {}).value, firstInt(step.reps, 0));
    var wEl = document.getElementById('wkr-weight');
    var weight = wEl && wEl.value !== '' ? (parseFloat(wEl.value) || 0) : 0;
    r.performed.push({ name: step.name, exIndex: step.exIndex, set: step.setNo, reps: reps, weight: weight });
    r.lastWeight[step.exIndex] = weight || '';
    afterSet(step);
  };
  WK.completeTime = function () {
    var r = WK.run; if (!r) return;
    var step = r.steps[r.i];
    r.performed.push({ name: step.name, exIndex: step.exIndex, set: step.setNo, time_sec: step.time_sec, weight: 0 });
    afterSet(step);
  };
  function afterSet(step) {
    var r = WK.run; var next = r.steps[r.i + 1];
    if (step.rest > 0 && next && (next.kind === 'set' || next.kind === 'timeset')) startRest(step.rest);
    else WK.next();
  }

  function startRest(sec) {
    var r = WK.run; if (!r) return;
    clearTimer();
    r._restEnd = Date.now() + sec * 1000;
    var next = r.steps[r.i + 1];
    var body = document.getElementById('wkr-body'), foot = document.getElementById('wkr-foot');
    body.innerHTML = '<div class="wkr-section">Rest</div><div class="wkr-ring rest"><div class="t" id="wkr-count">' + fmt(sec) + '</div></div>' +
      '<div class="wkr-next">Next: ' + (next ? esc(next.name) + ((next.kind === 'set' || next.kind === 'timeset') ? (' · Set ' + next.setNo) : '') : 'Finish') + '</div>';
    foot.innerHTML = '<button class="wk-cta soft" onclick="FFPWorkout.addRest()">+15s</button><button class="wk-cta blue" onclick="FFPWorkout.next()">Skip rest</button>';
    r.timer = setInterval(function () {
      var rem = (r._restEnd - Date.now()) / 1000;
      var c = document.getElementById('wkr-count'); if (c) c.textContent = fmt(rem);
      if (rem <= 0) { clearTimer(); WK.next(); }
    }, 250);
  }
  WK.addRest = function () { if (WK.run && WK.run._restEnd) WK.run._restEnd += 15000; };
  WK.next = function () { var r = WK.run; if (!r) return; r.i++; renderStep(); };

  WK.quit = function () {
    if (WK.run && WK.run.performed.length && !confirm('Leave this workout? Your progress won’t be saved.')) return;
    clearTimer();
    var el = document.getElementById('wk-runner'); if (el) el.classList.remove('open');
    WK.run = null; WK.home();
  };

  // ───────────────────────── FINISH → Activities + share ─────────────────────────
  function finish() {
    var r = WK.run; if (!r) return;
    clearTimer();
    var durSec = Math.round((Date.now() - r.startedAt) / 1000);
    var sets = r.performed.length;
    var volume = 0; r.performed.forEach(function (p) { volume += (p.reps || 0) * (p.weight || 0); });
    var exCount = (r.plan.exercises || []).filter(function (e) { return e.name; }).length;
    r._summary = { durSec: durSec, sets: sets, volume: Math.round(volume), exCount: exCount };
    var f = document.getElementById('wkr-prog-fill'); if (f) f.style.width = '100%';
    var bd = buildBreakdown(r.performed);
    var bdHtml = bd.map(function (g) {
      return '<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07);">' +
        '<span style="font-size:14px;font-weight:700;color:#fff;text-align:left;min-width:0;">' + esc(g.name) + '</span>' +
        '<span style="font-size:13px;color:#8a99a8;font-weight:600;white-space:nowrap;">' + esc(g.detail) + '</span></div>';
    }).join('');
    document.getElementById('wkr-body').innerHTML =
      '<div class="wkr-section">Complete</div><div class="wkr-name" style="font-size:28px;margin-bottom:10px;">' + esc(r.plan.title || 'Workout') + '</div>' +
      '<div class="wkr-stats">' +
        '<div class="wk-stat"><div class="v">' + fmt(durSec) + '</div><div class="l">Time</div></div>' +
        '<div class="wk-stat"><div class="v">' + sets + '</div><div class="l">Sets</div></div>' +
        '<div class="wk-stat"><div class="v">' + (volume >= 1000 ? (Math.round(volume / 100) / 10) + 'k' : Math.round(volume)) + '</div><div class="l">kg vol</div></div>' +
      '</div>' +
      (bdHtml ? ('<div style="width:100%;max-width:360px;margin:20px 0 2px;">' + bdHtml + '</div>') : '') +
      '<div id="wkr-coach" style="width:100%;max-width:360px;margin:16px 0 4px;font-size:13.5px;line-height:1.55;color:#cdd7e0;text-align:left;"><span style="color:#8a99a8;">Analysing your session…</span></div>';
    document.getElementById('wkr-foot').innerHTML = '<button class="wk-cta soft" onclick="FFPWorkout.justSave()">Done</button><button class="wk-cta pri" onclick="FFPWorkout.saveToPassport()"><span class="material-icons">photo_camera</span>Save to Passport</button>';
    fetchCoach(r);
  }

  // Group performed sets per exercise → a concise "6 · 6 · 5 · 5 reps @ 80kg" (or "45s · 45s") line.
  function buildBreakdown(performed) {
    var order = [], by = {};
    (performed || []).forEach(function (p) {
      var k = (p.exIndex != null ? 'e' + p.exIndex : p.name);
      if (!by[k]) { by[k] = { name: p.name, reps: [], times: [], weights: [] }; order.push(k); }
      if (p.time_sec) by[k].times.push(p.time_sec);
      else by[k].reps.push(p.reps);
      if (p.weight) by[k].weights.push(p.weight);
    });
    return order.map(function (k) {
      var g = by[k], detail;
      if (g.times.length) detail = g.times.map(function (t) { return fmt(t) + 's'; }).join(' · ');
      else detail = g.reps.join(' · ') + ' reps';
      if (g.weights.length) detail += ' @ ' + Math.max.apply(null, g.weights) + 'kg';
      return { name: g.name, detail: detail };
    });
  }

  // Short AI coaching note from what was actually performed.
  function fetchCoach(r) {
    var sm = r._summary || {};
    var sets = (r.performed || []).map(function (p) { return p.time_sec ? { name: p.name, time_sec: p.time_sec } : { name: p.name, reps: p.reps, weight: p.weight }; });
    fetch(FFP_API + '/api/workout/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: r.plan.title || 'Workout', duration_sec: sm.durSec || 0, total_volume: sm.volume || 0, sets: sets }) })
      .then(function (resp) { return resp.json().then(function (j) { return { ok: resp.ok, j: j }; }, function () { return { ok: false, j: null }; }); })
      .then(function (res) {
        var el = document.getElementById('wkr-coach'); if (!el) return;
        if (!res.ok || !res.j || !res.j.summary) { el.style.display = 'none'; return; }
        el.innerHTML = '<div style="color:var(--blue);font-weight:800;font-size:11px;letter-spacing:.7px;text-transform:uppercase;margin-bottom:4px;">Coach</div>' + esc(res.j.summary);
      })
      .catch(function () { var el = document.getElementById('wkr-coach'); if (el) el.style.display = 'none'; });
  }

  function logWorkoutSession() {
    var r = WK.run; if (!r) return; var mid = memberId(); var sm = r._summary || {};
    if (sb() && mid) {
      sb().from('workout_logs').insert({ member_id: mid, plan_id: WK._planId || null, title: r.plan.title || 'Workout', performed: r.performed, duration_sec: sm.durSec || 0, total_volume: sm.volume || 0, exercises_count: sm.exCount || 0, sets_count: sm.sets || 0 })
        .then(function (res) { if (res.error) console.error('[FFP Workout] save', res.error); });
    }
  }
  function closeRunner() { clearTimer(); var el = document.getElementById('wk-runner'); if (el) el.classList.remove('open'); }

  WK.justSave = function () { logWorkoutSession(); toast('Workout saved 💪'); closeRunner(); WK.run = null; WK.home(); };

  // Save to Activities: log the session, then open the existing Log Activity modal prefilled so the member can
  // add a photo / location → their normal Save → the shareable activity card (the natural share path).
  WK.saveToPassport = function () {
    var r = WK.run; if (!r) return; var sm = r._summary || {};
    logWorkoutSession();
    var title = r.plan.title || 'Workout';
    var durSec = sm.durSec || 0;
    // Carry the actual exercise list into the activity so the workout itself travels to the Passport /
    // share card (Grant 2026-07-18), not just an anonymous "N sets" summary.
    var exList = (r.plan.exercises || []).map(function (e) { return e.name; }).filter(Boolean);
    var notes = (exList.length ? exList.join(' · ') + '\n' : '')
      + (sm.sets || 0) + ' sets' + (sm.exCount ? (' · ' + sm.exCount + ' exercises') : '') + (sm.volume ? (' · ' + sm.volume + 'kg volume') : '');
    closeRunner(); WK.run = null; WK.home();
    if (typeof window.openLogModal !== 'function') { toast('Workout saved'); return; }
    try {
      openLogModal();
      var la = document.getElementById('log-activity'); if (la) la.value = title;
      if (typeof window.setLogDuration === 'function') setLogDuration(Math.max(60, durSec));
      var lc = document.getElementById('log-calories'); if (lc && !lc.value) lc.value = Math.max(1, Math.round((durSec / 60) * 6));
      var ln = document.getElementById('log-notes'); if (ln) ln.value = notes;
      ensureLogLocation();   // the Workout panel can open before MemberProfile loads → fill home city/country so Save isn't blocked
    } catch (e) { console.error('[FFP Workout] log modal', e); }
  };

  // Log Activity requires country + city. When opened from the Workout panel those selects can be empty
  // (MemberProfile not loaded yet), which silently blocks Save. Fill them from the member's saved profile.
  function ensureLogLocation() {
    var cny = document.getElementById('log-country'), cty = document.getElementById('log-city');
    if (!cny || !cty) return;
    function apply(country, city) {
      if (country && !cny.value) {
        var ok = false; for (var i = 0; i < cny.options.length; i++) { if (cny.options[i].value === country) { ok = true; break; } }
        if (!ok) cny.add(new Option(country, country));
        cny.value = country;
        if (typeof window.fillLogCities === 'function') fillLogCities();
      }
      var c = document.getElementById('log-city');
      if (city && c && !c.value) {
        if (typeof window._ensureSelectOption === 'function') { _ensureSelectOption(c, city); }
        else { var ok2 = false; for (var j = 0; j < c.options.length; j++) { if (c.options[j].value === city) { ok2 = true; break; } } if (!ok2) c.add(new Option(city, city)); c.value = city; }
      }
    }
    if (cny.value && cty.value) return;
    var m = (window.FFPAuth && FFPAuth.getMember && FFPAuth.getMember()) || {};
    apply(m.country, m.city);
    if (cny.value && document.getElementById('log-city').value) return;
    var mid = memberId(); if (!sb() || !mid) return;
    sb().from('members').select('country, city').eq('id', mid).maybeSingle().then(function (res) {
      if (!res || res.error || !res.data) return;
      apply(res.data.country, res.data.city);
    });
  }

  // boot
  injectStyles();
  WK.home();
  window.ffpReloadWorkout = function () { try { WK.home(); } catch (e) {} };
})();

/* FFP AI Workout — v2 (panel-workout)
   v2: WORLD-CLASS FLAT redesign — no cards/pills/boxed inputs. Clean section headers + hairline dividers,
       borderless underline inputs. Added MANUAL builder (build a workout from scratch) alongside AI generate.
   Flow: HOME (prompt + keyboard mic + suggestions + build-manually + recent) → GENERATE (/api/workout/generate)
         → REVIEW (fully editable warm-up / exercises / cool-down, add to any section) → GUIDED RUNNER
         (set-by-set quick-fill + rest timers, full-screen) → FINISH (summary + save + share).
   Lazy-loaded by the dashboard (_panelLoaderSrc['panel-workout']); self-renders into #wk-root on load. */
(function () {
  'use strict';
  var FFP_API = 'https://ffp-passport-backend.vercel.app';
  var WK = window.FFPWorkout = window.FFPWorkout || {};
  WK.plan = WK.plan || null;
  WK.run = WK.run || null;
  WK._recent = WK._recent || [];

  function memberId() { try { var m = window.FFPAuth && FFPAuth.getMember && FFPAuth.getMember(); return m && m.id; } catch (e) { return null; } }
  function sb() { return window.supabase; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function toast(m, t) { if (window.showToast) showToast(m, t); }
  function root() { return document.getElementById('wk-root'); }
  function firstInt(s, d) { var m = String(s == null ? '' : s).match(/\d+/); return m ? parseInt(m[0], 10) : d; }

  // ───────────────────────── styles (flat / borderless) ─────────────────────────
  function injectStyles() {
    if (document.getElementById('ffp-workout-styles')) return;
    var s = document.createElement('style'); s.id = 'ffp-workout-styles'; s.textContent =
      '#wk-root{padding:6px 2px 30px;}' +
      '.wk-prompt{width:100%;box-sizing:border-box;min-height:104px;background:rgba(255,255,255,.04);border:none;border-radius:14px;color:var(--text);font-size:16px;font-weight:500;font-family:inherit;padding:15px;resize:vertical;line-height:1.45;}' +
      '.wk-prompt::placeholder{color:var(--muted);}' +
      '.wk-cta{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;text-align:center;padding:15px;border-radius:14px;border:none;font-size:15px;font-weight:800;font-family:inherit;cursor:pointer;}' +
      '.wk-cta.pri{background:var(--yellow);color:#10202b;}' +
      '.wk-cta.blue{background:var(--blue);color:#fff;}' +
      '.wk-cta.soft{background:rgba(255,255,255,.07);color:var(--text);}' +
      '.wk-cta .material-icons{font-size:19px;}' +
      '.wk-link{background:none;border:none;color:var(--blue);font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer;padding:8px 0;}' +
      '.wk-try{font-size:13px;color:var(--muted);margin:18px 2px 4px;line-height:2.1;}' +
      '.wk-try a{color:var(--blue);font-weight:700;cursor:pointer;white-space:nowrap;}' +
      '.wk-hint{font-size:12px;color:var(--muted);margin-top:12px;line-height:1.5;}' +
      '.wk-h{font-size:11px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:var(--muted);margin:26px 2px 4px;}' +
      '.wk-row{display:flex;align-items:center;gap:12px;padding:14px 2px;border-bottom:1px solid var(--border);cursor:pointer;}' +
      '.wk-row .nm{flex:1;min-width:0;}' +
      '.wk-row .t{font-size:15px;font-weight:700;color:var(--text);}' +
      '.wk-row .s{font-size:12px;color:var(--muted);font-weight:600;margin-top:3px;}' +
      '.wk-row .material-icons{color:var(--muted);}' +
      // editable rows — flat underline inputs, no boxes
      '.wk-eb{padding:14px 0;border-bottom:1px solid var(--border);}' +
      '.wk-eb-top{display:flex;align-items:center;gap:10px;}' +
      '.wk-nin{flex:1;background:none;border:none;border-bottom:1px solid transparent;color:var(--text);font-size:16px;font-weight:700;font-family:inherit;padding:2px 0;}' +
      '.wk-nin:focus{border-bottom-color:var(--blue);outline:none;}' +
      '.wk-del{background:none;border:none;color:var(--muted);font-size:22px;line-height:1;cursor:pointer;padding:0 2px;flex:0 0 auto;}' +
      '.wk-mini{display:flex;gap:22px;margin-top:10px;flex-wrap:wrap;}' +
      '.wk-mini label{display:block;font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin-bottom:2px;}' +
      '.wk-mini input{width:58px;background:none;border:none;border-bottom:1px solid var(--border-mid);color:var(--text);font-size:16px;font-weight:700;font-family:inherit;padding:3px 0;}' +
      '.wk-mini input.w{width:104px;}' +
      '.wk-mini input:focus{border-bottom-color:var(--blue);outline:none;}' +
      '.wk-erow{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border);}' +
      '.wk-erow .secs{width:54px;flex:0 0 auto;}' +
      // runner — flat, ring-based
      '#wk-runner{position:fixed;inset:0;z-index:100060;background:#0a1520;display:none;flex-direction:column;}' +
      '#wk-runner.open{display:flex;}' +
      '.wkr-top{display:flex;align-items:center;gap:12px;padding:16px 18px 8px;}' +
      '.wkr-prog{flex:1;height:5px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;}' +
      '.wkr-prog > i{display:block;height:5px;background:var(--blue);border-radius:3px;transition:width .3s;}' +
      '.wkr-close{width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:#fff;cursor:pointer;flex:0 0 auto;}' +
      '.wkr-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18px 24px;}' +
      '.wkr-section{font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--blue);}' +
      '.wkr-name{font-size:28px;font-weight:800;color:#fff;margin:7px 0 4px;line-height:1.12;}' +
      '.wkr-setline{font-size:13px;font-weight:700;color:#aeb9c4;margin-bottom:12px;}' +
      '.wkr-target{font-size:13.5px;font-weight:700;color:var(--blue);margin-bottom:26px;}' +
      '.wkr-note{font-size:13px;color:#8a99a8;margin-top:14px;max-width:300px;}' +
      '.wkr-fills{display:flex;gap:40px;margin-bottom:26px;}' +
      '.wkr-fill label{display:block;font-size:10px;font-weight:800;letter-spacing:.7px;color:var(--muted);text-transform:uppercase;margin-bottom:6px;}' +
      '.wkr-fill input{width:104px;background:none;border:none;border-bottom:2px solid rgba(255,255,255,.16);color:#fff;font-size:42px;font-weight:800;text-align:center;font-family:inherit;padding-bottom:4px;}' +
      '.wkr-fill input:focus{border-bottom-color:var(--blue);outline:none;}' +
      '.wkr-ring{width:172px;height:172px;border-radius:50%;border:6px solid rgba(43,168,224,.20);border-top-color:var(--blue);display:flex;align-items:center;justify-content:center;margin:8px auto 18px;}' +
      '.wkr-ring .t{font-size:48px;font-weight:800;color:#fff;}' +
      '.wkr-next{font-size:13px;color:#8a99a8;font-weight:600;margin-bottom:6px;}' +
      '.wkr-foot{padding:14px 22px calc(env(safe-area-inset-bottom,0px) + 16px);display:flex;gap:12px;}' +
      '.wkr-foot .wk-cta{flex:1;}' +
      '.wkr-stats{display:flex;width:100%;max-width:330px;margin:22px 0 4px;}' +
      '.wk-stat{flex:1;text-align:center;}' +
      '.wk-stat + .wk-stat{border-left:1px solid rgba(255,255,255,.08);}' +
      '.wk-stat .v{font-size:27px;font-weight:800;color:#fff;}' +
      '.wk-stat .l{font-size:10px;font-weight:800;letter-spacing:.6px;color:var(--muted);text-transform:uppercase;margin-top:3px;}';
    document.head.appendChild(s);
  }

  // ───────────────────────── HOME ─────────────────────────
  var SUGG = ['Full body · 30 min', 'Upper body', 'Lower body', 'Core finisher', 'HIIT · 20 min', 'Mobility & stretch', 'Dumbbells only', 'Bodyweight at home'];

  WK.home = function () {
    injectStyles();
    var host = root(); if (!host) return;
    var sugg = SUGG.map(function (c) { return '<a onclick="FFPWorkout.useSugg(this)">' + esc(c) + '</a>'; }).join('<span style="color:var(--border-mid);"> · </span>');
    host.innerHTML =
      '<textarea class="wk-prompt" id="wk-prompt" placeholder="Describe your session — e.g. 35-min full-body dumbbell workout, go easy on my knees"></textarea>' +
      '<button class="wk-cta pri" style="margin-top:14px;" onclick="FFPWorkout.generate()"><span class="material-icons">bolt</span>Generate workout</button>' +
      '<div style="text-align:center;"><button class="wk-link" onclick="FFPWorkout.manual()">or build one manually</button></div>' +
      '<div class="wk-try">Try: ' + sugg + '</div>' +
      '<div class="wk-hint">Tip: tap your keyboard’s mic to speak it. Mention time, equipment, level or any injuries.</div>' +
      '<div class="wk-h">Recent workouts</div>' +
      '<div id="wk-recent"><div class="wk-hint">Loading…</div></div>';
    loadRecent();
  };

  WK.useSugg = function (a) {
    var t = document.getElementById('wk-prompt'); if (!t) return;
    var v = a.textContent.trim();
    t.value = t.value.trim() ? (t.value.trim() + ', ' + v) : v;
    t.focus();
  };

  function loadRecent() {
    var host = document.getElementById('wk-recent'); if (!host) return;
    var mid = memberId();
    if (!sb() || !mid) { host.innerHTML = '<div class="wk-hint">Sign in to see your saved workouts.</div>'; return; }
    sb().from('workout_plans').select('id, title, focus, duration_min, plan, created_at').eq('member_id', mid).order('created_at', { ascending: false }).limit(10)
      .then(function (res) {
        if (res.error) { host.innerHTML = ''; return; }
        WK._recent = res.data || [];
        if (!WK._recent.length) { host.innerHTML = '<div class="wk-hint">No workouts yet — generate or build your first one above.</div>'; return; }
        host.innerHTML = WK._recent.map(function (r, i) {
          var ex = (r.plan && r.plan.exercises) ? r.plan.exercises.length : 0;
          return '<div class="wk-row" onclick="FFPWorkout.openRecent(' + i + ')">' +
            '<div class="nm"><div class="t">' + esc(r.title || 'Workout') + '</div>' +
            '<div class="s">' + (r.duration_min ? (r.duration_min + ' min · ') : '') + ex + ' exercises' + (r.focus ? (' · ' + esc(r.focus)) : '') + '</div></div>' +
            '<span class="material-icons">chevron_right</span></div>';
        }).join('');
      });
  }
  WK.openRecent = function (i) { var r = WK._recent[i]; if (r && r.plan) { WK.plan = r.plan; WK._planId = r.id; WK.review(); } };

  // ───────────────────────── MANUAL ─────────────────────────
  WK.manual = function () {
    WK.plan = { title: 'My workout', focus: '', duration_min: 0,
      warmup: [{ name: '', duration_sec: 30, note: '' }],
      exercises: [{ name: '', sets: 3, reps: '10', rest_sec: 75, weight: '', note: '' }],
      cooldown: [{ name: '', duration_sec: 30, note: '' }] };
    WK._planId = null;
    WK._manual = true;
    WK.review();
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
        WK.plan = res.j.plan; WK._planId = null; WK._manual = false; WK.plan._prompt = prompt;
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

  // ───────────────────────── REVIEW (flat, fully editable) ─────────────────────────
  WK.review = function () {
    injectStyles();
    var host = root(); if (!host || !WK.plan) { WK.home(); return; }
    var p = WK.plan;
    function mob(sec, items) {
      return (items || []).map(function (w, i) {
        return '<div class="wk-erow">' +
          '<input class="wk-nin" placeholder="Movement name" value="' + esc(w.name) + '" oninput="FFPWorkout.edit(\'' + sec + '\',' + i + ',\'name\',this.value)">' +
          '<input class="wk-nin secs" type="number" inputmode="numeric" value="' + esc(w.duration_sec) + '" oninput="FFPWorkout.edit(\'' + sec + '\',' + i + ',\'duration_sec\',this.value)"><span class="s" style="color:var(--muted);font-size:11px;">sec</span>' +
          '<button class="wk-del" onclick="FFPWorkout.rm(\'' + sec + '\',' + i + ')">×</button></div>';
      }).join('');
    }
    var exs = (p.exercises || []).map(function (e, i) {
      return '<div class="wk-eb">' +
        '<div class="wk-eb-top"><input class="wk-nin" placeholder="Exercise name" value="' + esc(e.name) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'name\',this.value)"><button class="wk-del" onclick="FFPWorkout.rm(\'exercises\',' + i + ')">×</button></div>' +
        '<div class="wk-mini">' +
          '<div class="f"><label>Sets</label><input type="number" inputmode="numeric" value="' + esc(e.sets) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'sets\',this.value)"></div>' +
          '<div class="f"><label>Reps</label><input value="' + esc(e.reps) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'reps\',this.value)"></div>' +
          '<div class="f"><label>Rest s</label><input type="number" inputmode="numeric" value="' + esc(e.rest_sec) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'rest_sec\',this.value)"></div>' +
          '<div class="f"><label>Weight</label><input class="w" placeholder="—" value="' + esc(e.weight) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'weight\',this.value)"></div>' +
        '</div>' +
        (e.note ? '<div class="s" style="color:var(--muted);font-size:12px;margin-top:8px;">' + esc(e.note) + '</div>' : '') +
      '</div>';
    }).join('');
    host.innerHTML =
      '<input id="wk-title" value="' + esc(p.title || 'Workout') + '" oninput="FFPWorkout.editTitle(this.value)" style="width:100%;box-sizing:border-box;background:none;border:none;color:var(--text);font-size:22px;font-weight:800;font-family:inherit;padding:4px 2px;">' +
      '<div class="wk-h">Warm-up</div>' + mob('warmup', p.warmup) +
      '<button class="wk-link" onclick="FFPWorkout.add(\'warmup\')">+ Add warm-up</button>' +
      '<div class="wk-h">Workout</div>' + exs +
      '<button class="wk-link" onclick="FFPWorkout.add(\'exercises\')">+ Add exercise</button>' +
      '<div class="wk-h">Cool-down</div>' + mob('cooldown', p.cooldown) +
      '<button class="wk-link" onclick="FFPWorkout.add(\'cooldown\')">+ Add cool-down</button>' +
      '<div style="display:flex;gap:12px;margin-top:26px;">' +
        '<button class="wk-cta soft" style="flex:0 0 38%;" onclick="FFPWorkout.home()">Back</button>' +
        '<button class="wk-cta blue" onclick="FFPWorkout.start()"><span class="material-icons">play_arrow</span>Start workout</button>' +
      '</div>';
  };
  WK.editTitle = function (v) { if (WK.plan) WK.plan.title = v; };
  WK.edit = function (sec, i, field, v) {
    var arr = WK.plan && WK.plan[sec]; if (!arr || !arr[i]) return;
    if (field === 'sets' || field === 'rest_sec' || field === 'duration_sec') v = firstInt(v, field === 'sets' ? 1 : 30);
    arr[i][field] = v;
  };
  WK.rm = function (sec, i) { var arr = WK.plan && WK.plan[sec]; if (arr) { arr.splice(i, 1); WK.review(); } };
  WK.add = function (sec) {
    if (!WK.plan) return; if (!WK.plan[sec]) WK.plan[sec] = [];
    if (sec === 'exercises') WK.plan.exercises.push({ name: '', sets: 3, reps: '10', rest_sec: 75, weight: '', note: '' });
    else WK.plan[sec].push({ name: '', duration_sec: 30, note: '' });
    WK.review();
  };

  // ───────────────────────── GUIDED RUNNER ─────────────────────────
  function buildSteps(p) {
    var steps = [];
    (p.warmup || []).forEach(function (w) { if (w.name) steps.push({ kind: 'mob', section: 'Warm-up', name: w.name, dur: firstInt(w.duration_sec, 30), note: w.note }); });
    (p.exercises || []).forEach(function (e, ei) {
      if (!e.name) return;
      var sets = Math.max(1, firstInt(e.sets, 1));
      for (var s = 1; s <= sets; s++) steps.push({ kind: 'set', section: 'Workout', exIndex: ei, name: e.name, setNo: s, setsTotal: sets, reps: e.reps, rest: firstInt(e.rest_sec, 0), weight: e.weight, note: e.note });
    });
    (p.cooldown || []).forEach(function (c) { if (c.name) steps.push({ kind: 'mob', section: 'Cool-down', name: c.name, dur: firstInt(c.duration_sec, 30), note: c.note }); });
    return steps;
  }

  function ensureRunnerEl() {
    var el = document.getElementById('wk-runner');
    if (el) return el;
    el = document.createElement('div'); el.id = 'wk-runner';
    el.innerHTML =
      '<div class="wkr-top"><button class="wkr-close" onclick="FFPWorkout.quit()"><span class="material-icons" style="vertical-align:-6px;">close</span></button><div class="wkr-prog"><i id="wkr-prog-fill" style="width:0%"></i></div></div>' +
      '<div class="wkr-body" id="wkr-body"></div>' +
      '<div class="wkr-foot" id="wkr-foot"></div>';
    document.body.appendChild(el);
    return el;
  }

  WK.start = function () {
    if (!WK.plan) return;
    var steps = buildSteps(WK.plan);
    if (!steps.length) { toast('Add at least one exercise', 'error'); return; }
    WK.run = { plan: WK.plan, steps: steps, i: 0, performed: [], startedAt: Date.now(), resting: false, timer: null, lastWeight: {} };
    ensureRunnerEl().classList.add('open');
    renderStep();
  };

  function clearTimer() { if (WK.run && WK.run.timer) { clearInterval(WK.run.timer); WK.run.timer = null; } }
  function setProgress() { var f = document.getElementById('wkr-prog-fill'); if (f && WK.run) f.style.width = Math.round((WK.run.i / WK.run.steps.length) * 100) + '%'; }
  function fmt(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m > 0 ? (m + ':' + String(s).padStart(2, '0')) : String(s); }

  function renderStep() {
    clearTimer();
    var r = WK.run; if (!r) return;
    setProgress();
    if (r.i >= r.steps.length) { finish(); return; }
    var step = r.steps[r.i];
    var body = document.getElementById('wkr-body'), foot = document.getElementById('wkr-foot');
    if (step.kind === 'mob') {
      body.innerHTML =
        '<div class="wkr-section">' + esc(step.section) + '</div>' +
        '<div class="wkr-name">' + esc(step.name) + '</div>' +
        '<div class="wkr-ring"><div class="t" id="wkr-count">' + fmt(step.dur) + '</div></div>' +
        (step.note ? '<div class="wkr-note">' + esc(step.note) + '</div>' : '');
      foot.innerHTML = '<button class="wk-cta soft" onclick="FFPWorkout.next()">Skip</button><button class="wk-cta blue" onclick="FFPWorkout.next()">Done</button>';
      var end = Date.now() + step.dur * 1000;
      r.timer = setInterval(function () {
        var rem = (end - Date.now()) / 1000;
        var c = document.getElementById('wkr-count'); if (c) c.textContent = fmt(rem);
        if (rem <= 0) { clearTimer(); WK.next(); }
      }, 250);
    } else {
      var prefReps = firstInt(step.reps, 10);
      var prefW = (r.lastWeight[step.exIndex] != null) ? r.lastWeight[step.exIndex] : '';
      body.innerHTML =
        '<div class="wkr-section">' + esc(step.section) + '</div>' +
        '<div class="wkr-name">' + esc(step.name) + '</div>' +
        '<div class="wkr-setline">Set ' + step.setNo + ' of ' + step.setsTotal + '</div>' +
        '<div class="wkr-target">Target ' + esc(step.reps) + ' reps' + (step.weight ? (' · ' + esc(step.weight)) : '') + '</div>' +
        '<div class="wkr-fills">' +
          '<div class="wkr-fill"><label>Reps</label><input id="wkr-reps" type="number" inputmode="numeric" value="' + prefReps + '"></div>' +
          '<div class="wkr-fill"><label>Weight kg</label><input id="wkr-weight" type="number" inputmode="decimal" value="' + esc(prefW) + '" placeholder="–"></div>' +
        '</div>' +
        (step.note ? '<div class="wkr-note">' + esc(step.note) + '</div>' : '');
      foot.innerHTML = '<button class="wk-cta pri" onclick="FFPWorkout.completeSet()">Complete set</button>';
    }
  }

  WK.completeSet = function () {
    var r = WK.run; if (!r) return;
    var step = r.steps[r.i];
    var reps = firstInt((document.getElementById('wkr-reps') || {}).value, firstInt(step.reps, 0));
    var wEl = document.getElementById('wkr-weight');
    var weight = wEl && wEl.value !== '' ? (parseFloat(wEl.value) || 0) : 0;
    r.performed.push({ name: step.name, exIndex: step.exIndex, set: step.setNo, reps: reps, weight: weight });
    r.lastWeight[step.exIndex] = weight || '';
    var next = r.steps[r.i + 1];
    if (step.rest > 0 && next && next.kind === 'set') startRest(step.rest);
    else WK.next();
  };

  function startRest(sec) {
    var r = WK.run; if (!r) return;
    clearTimer();
    r.resting = true;
    r._restEnd = Date.now() + sec * 1000;
    var next = r.steps[r.i + 1];
    var body = document.getElementById('wkr-body'), foot = document.getElementById('wkr-foot');
    body.innerHTML =
      '<div class="wkr-section">Rest</div>' +
      '<div class="wkr-ring"><div class="t" id="wkr-count">' + fmt(sec) + '</div></div>' +
      '<div class="wkr-next">Next: ' + (next ? esc(next.name) + (next.kind === 'set' ? (' · Set ' + next.setNo) : '') : 'Finish') + '</div>';
    foot.innerHTML = '<button class="wk-cta soft" onclick="FFPWorkout.addRest()">+15s</button><button class="wk-cta blue" onclick="FFPWorkout.next()">Skip rest</button>';
    r.timer = setInterval(function () {
      var rem = (r._restEnd - Date.now()) / 1000;
      var c = document.getElementById('wkr-count'); if (c) c.textContent = fmt(rem);
      if (rem <= 0) { clearTimer(); r.resting = false; WK.next(); }
    }, 250);
  }
  WK.addRest = function () { if (WK.run && WK.run._restEnd) WK.run._restEnd += 15000; };
  WK.next = function () { var r = WK.run; if (!r) return; r.resting = false; r.i++; renderStep(); };

  WK.quit = function () {
    if (WK.run && WK.run.performed.length && !confirm('Leave this workout? Your progress won’t be saved.')) return;
    clearTimer();
    var el = document.getElementById('wk-runner'); if (el) el.classList.remove('open');
    WK.run = null;
    WK.home();
  };

  // ───────────────────────── FINISH ─────────────────────────
  function finish() {
    var r = WK.run; if (!r) return;
    clearTimer();
    var durSec = Math.round((Date.now() - r.startedAt) / 1000);
    var sets = r.performed.length;
    var volume = 0; r.performed.forEach(function (p) { volume += (p.reps || 0) * (p.weight || 0); });
    var exCount = (r.plan.exercises || []).filter(function (e) { return e.name; }).length;
    r._summary = { durSec: durSec, sets: sets, volume: Math.round(volume), exCount: exCount };
    var body = document.getElementById('wkr-body'), foot = document.getElementById('wkr-foot');
    var f = document.getElementById('wkr-prog-fill'); if (f) f.style.width = '100%';
    body.innerHTML =
      '<div class="wkr-section">Complete</div>' +
      '<div class="wkr-name">' + esc(r.plan.title || 'Workout') + '</div>' +
      '<div class="wkr-stats">' +
        '<div class="wk-stat"><div class="v">' + fmt(durSec) + '</div><div class="l">Time</div></div>' +
        '<div class="wk-stat"><div class="v">' + sets + '</div><div class="l">Sets</div></div>' +
        '<div class="wk-stat"><div class="v">' + (volume >= 1000 ? (Math.round(volume / 100) / 10) + 'k' : Math.round(volume)) + '</div><div class="l">kg vol</div></div>' +
      '</div>';
    foot.innerHTML = '<button class="wk-cta soft" onclick="FFPWorkout.share()">Share</button><button class="wk-cta pri" onclick="FFPWorkout.saveLog()">Save</button>';
  }

  WK.saveLog = function () {
    var r = WK.run; if (!r) return;
    var mid = memberId(); var sm = r._summary || {};
    if (sb() && mid) {
      sb().from('workout_logs').insert({
        member_id: mid, plan_id: WK._planId || null, title: r.plan.title || 'Workout',
        performed: r.performed, duration_sec: sm.durSec || 0, total_volume: sm.volume || 0,
        exercises_count: sm.exCount || 0, sets_count: sm.sets || 0
      }).then(function (res) { if (res.error) console.error('[FFP Workout] save', res.error); });
    }
    toast('Workout saved 💪');
    clearTimer();
    var el = document.getElementById('wk-runner'); if (el) el.classList.remove('open');
    WK.run = null;
    WK.home();
  };

  WK.share = function () {
    var r = WK.run; if (!r) return; var sm = r._summary || {};
    var txt = 'Just finished "' + (r.plan.title || 'a workout') + '" on FFP Passport — ' + (sm.sets || 0) + ' sets in ' + fmt(sm.durSec || 0) + (sm.volume ? (' · ' + sm.volume + 'kg volume') : '') + ' 💪';
    if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(function () { toast('Copied to clipboard'); }); }
    else { toast('Sharing not supported here'); }
  };

  // boot
  injectStyles();
  WK.home();
  window.ffpReloadWorkout = function () { try { WK.home(); } catch (e) {} };
})();

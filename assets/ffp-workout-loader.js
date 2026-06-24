/* FFP AI Workout — v1 (panel-workout)
   Flow: HOME (prompt + voice/keyboard mic + chips + recent) → GENERATE (/api/workout/generate via Claude)
         → REVIEW (editable warm-up / exercises / cool-down) → GUIDED RUNNER (set-by-set quick-fill + rest
         timers, full-screen) → FINISH (summary + save to workout_logs + share).
   Lazy-loaded by the member dashboard (_panelLoaderSrc['panel-workout']); self-renders into #wk-root on load.
   Persists generated plans to workout_plans and completed sessions to workout_logs (RLS = member_id auth.uid). */
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

  // ───────────────────────── styles ─────────────────────────
  function injectStyles() {
    if (document.getElementById('ffp-workout-styles')) return;
    var s = document.createElement('style'); s.id = 'ffp-workout-styles'; s.textContent =
      '#wk-root{padding:0 2px 24px;}' +
      '.wk-card{background:rgba(43,168,224,0.05);border:1px solid var(--border-mid);border-radius:14px;padding:16px;margin-bottom:14px;}' +
      '.wk-prompt{width:100%;min-height:92px;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:12px;color:var(--text);font-size:16px;font-weight:500;font-family:inherit;padding:13px;box-sizing:border-box;resize:vertical;}' +
      '.wk-chips{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0;}' +
      '.wk-chip{font-size:12.5px;font-weight:700;padding:8px 13px;border-radius:999px;border:1px solid var(--border-mid);background:rgba(43,168,224,0.06);color:var(--text);cursor:pointer;font-family:inherit;}' +
      '.wk-chip:active{border-color:var(--blue);}' +
      '.wk-btn{display:block;width:100%;text-align:center;padding:14px;border-radius:12px;border:none;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer;}' +
      '.wk-btn.pri{background:var(--yellow);color:#10202b;}' +
      '.wk-btn.blue{background:var(--blue);color:#fff;}' +
      '.wk-btn.ghost{background:transparent;border:1px solid var(--border-mid);color:var(--text);}' +
      '.wk-hint{font-size:11.5px;color:var(--muted);margin-top:10px;text-align:center;}' +
      '.wk-sec-h{font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);margin:16px 2px 8px;}' +
      '.wk-row{display:flex;align-items:center;gap:10px;padding:11px 2px;border-bottom:1px solid var(--border);}' +
      '.wk-row .nm{flex:1;min-width:0;font-size:14px;font-weight:700;color:var(--text);}' +
      '.wk-row .sub{font-size:11.5px;color:var(--muted);font-weight:600;margin-top:2px;}' +
      '.wk-x{flex:0 0 auto;width:26px;height:26px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:var(--muted);font-size:15px;line-height:24px;cursor:pointer;padding:0;}' +
      '.wk-ex{background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:11px;padding:11px 12px;margin-bottom:8px;}' +
      '.wk-ex-top{display:flex;align-items:center;gap:8px;margin-bottom:8px;}' +
      '.wk-ex-name{flex:1;background:transparent;border:none;color:var(--text);font-size:14px;font-weight:700;font-family:inherit;padding:2px 0;}' +
      '.wk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;}' +
      '.wk-fld label{display:block;font-size:9.5px;font-weight:800;letter-spacing:.4px;color:var(--muted);text-transform:uppercase;margin-bottom:3px;}' +
      '.wk-fld input{width:100%;box-sizing:border-box;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:8px;color:var(--text);font-size:15px;font-weight:700;font-family:inherit;padding:7px 8px;text-align:center;}' +
      '.wk-recent-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 2px;border-bottom:1px solid var(--border);cursor:pointer;}' +
      '.wk-recent-row .material-icons{color:var(--muted);}' +
      // runner overlay
      '#wk-runner{position:fixed;inset:0;z-index:100060;background:#0a1520;display:none;flex-direction:column;}' +
      '#wk-runner.open{display:flex;}' +
      '.wkr-top{display:flex;align-items:center;gap:12px;padding:16px 18px 8px;}' +
      '.wkr-prog{flex:1;height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;}' +
      '.wkr-prog > i{display:block;height:6px;background:var(--blue);border-radius:3px;transition:width .3s;}' +
      '.wkr-close{width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:#fff;cursor:pointer;flex:0 0 auto;}' +
      '.wkr-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18px 22px;}' +
      '.wkr-section{font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--blue);}' +
      '.wkr-name{font-size:26px;font-weight:800;color:#fff;margin:6px 0 4px;line-height:1.15;}' +
      '.wkr-setline{font-size:13px;font-weight:700;color:#aeb9c4;margin-bottom:14px;}' +
      '.wkr-target{display:inline-block;font-size:12.5px;font-weight:700;color:var(--blue);background:rgba(43,168,224,.12);padding:6px 12px;border-radius:9px;margin-bottom:18px;}' +
      '.wkr-note{font-size:13px;color:#8a99a8;margin-top:12px;max-width:300px;}' +
      '.wkr-fills{display:flex;gap:12px;width:100%;max-width:300px;margin-bottom:18px;}' +
      '.wkr-fill{flex:1;background:#0e1b2a;border:1px solid var(--border-mid);border-radius:12px;padding:10px;}' +
      '.wkr-fill label{display:block;font-size:10px;font-weight:800;letter-spacing:.5px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;}' +
      '.wkr-fill input{width:100%;box-sizing:border-box;background:transparent;border:none;color:#fff;font-size:30px;font-weight:800;text-align:center;font-family:inherit;}' +
      '.wkr-ring{width:170px;height:170px;border-radius:50%;border:6px solid rgba(43,168,224,.22);border-top-color:var(--blue);display:flex;align-items:center;justify-content:center;margin:10px auto 18px;}' +
      '.wkr-ring .t{font-size:46px;font-weight:800;color:#fff;}' +
      '.wkr-foot{padding:14px 22px calc(env(safe-area-inset-bottom,0px) + 18px);display:flex;gap:10px;}' +
      '.wkr-foot .wk-btn{flex:1;}' +
      '.wkr-next{font-size:12.5px;color:#8a99a8;font-weight:600;margin-bottom:8px;}' +
      '.wk-stat{flex:1;background:rgba(43,168,224,0.06);border-radius:11px;padding:12px;text-align:center;}' +
      '.wk-stat .v{font-size:22px;font-weight:800;color:#fff;}' +
      '.wk-stat .l{font-size:10px;font-weight:800;letter-spacing:.5px;color:var(--muted);text-transform:uppercase;margin-top:2px;}';
    document.head.appendChild(s);
  }

  // ───────────────────────── HOME ─────────────────────────
  var CHIPS = ['Full body · 30 min', 'Upper body', 'Lower body / legs', 'Core finisher', 'HIIT · 20 min', 'Mobility & stretch', 'Dumbbells only', 'Bodyweight at home'];

  WK.home = function () {
    injectStyles();
    var host = root(); if (!host) return;
    var chips = CHIPS.map(function (c) { return '<button class="wk-chip" onclick="FFPWorkout.useChip(this)">' + esc(c) + '</button>'; }).join('');
    host.innerHTML =
      '<div class="wk-card">' +
        '<textarea class="wk-prompt" id="wk-prompt" placeholder="Describe your session — e.g. 35-min full-body dumbbell workout, go easy on my knees"></textarea>' +
        '<div class="wk-chips">' + chips + '</div>' +
        '<button class="wk-btn pri" onclick="FFPWorkout.generate()"><span style="vertical-align:-3px;" class="material-icons">bolt</span> Generate workout</button>' +
        '<div class="wk-hint">Tip: use your keyboard’s mic to speak it. Mention time, equipment, level or any injuries.</div>' +
      '</div>' +
      '<div class="wk-sec-h">Recent workouts</div>' +
      '<div id="wk-recent"><div class="wk-hint" style="text-align:left;">Loading…</div></div>';
    loadRecent();
  };

  WK.useChip = function (btn) {
    var t = document.getElementById('wk-prompt'); if (!t) return;
    var v = btn.textContent.trim();
    t.value = t.value.trim() ? (t.value.trim() + ', ' + v) : v;
    t.focus();
  };

  function loadRecent() {
    var host = document.getElementById('wk-recent'); if (!host) return;
    var mid = memberId();
    if (!sb() || !mid) { host.innerHTML = '<div class="wk-hint" style="text-align:left;">Sign in to see your saved workouts.</div>'; return; }
    sb().from('workout_plans').select('id, title, focus, duration_min, plan, created_at').eq('member_id', mid).order('created_at', { ascending: false }).limit(10)
      .then(function (res) {
        if (res.error) { host.innerHTML = ''; return; }
        WK._recent = res.data || [];
        if (!WK._recent.length) { host.innerHTML = '<div class="wk-hint" style="text-align:left;">No workouts yet — generate your first one above.</div>'; return; }
        host.innerHTML = WK._recent.map(function (r, i) {
          var ex = (r.plan && r.plan.exercises) ? r.plan.exercises.length : 0;
          return '<div class="wk-recent-row" onclick="FFPWorkout.openRecent(' + i + ')">' +
            '<div style="min-width:0;"><div class="nm" style="font-size:14px;font-weight:700;color:var(--text);">' + esc(r.title || 'Workout') + '</div>' +
            '<div class="sub" style="font-size:11.5px;color:var(--muted);margin-top:2px;">' + (r.duration_min ? (r.duration_min + ' min · ') : '') + ex + ' exercises' + (r.focus ? (' · ' + esc(r.focus)) : '') + '</div></div>' +
            '<span class="material-icons">chevron_right</span></div>';
        }).join('');
      });
  }
  WK.openRecent = function (i) { var r = WK._recent[i]; if (r && r.plan) { WK.plan = r.plan; WK._planId = r.id; WK.review(); } };

  // ───────────────────────── GENERATE ─────────────────────────
  WK.generate = function () {
    var t = document.getElementById('wk-prompt');
    var prompt = (t && t.value || '').trim();
    if (prompt.length < 3) { toast('Describe your workout first', 'error'); return; }
    var host = root();
    host.innerHTML = '<div class="wk-card" style="text-align:center;padding:36px 16px;"><div style="width:34px;height:34px;border-radius:50%;border:3px solid rgba(43,168,224,.25);border-top-color:var(--blue);margin:0 auto 16px;animation:wkspin 0.8s linear infinite;"></div><div style="font-weight:700;">Building your workout…</div><div class="wk-hint">Coaching up warm-up, sets and cool-down</div></div>' +
      '<style>@keyframes wkspin{to{transform:rotate(360deg);}}</style>';
    fetch(FFP_API + '/api/workout/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt, member_id: memberId() }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }, function () { return { ok: false, status: r.status, j: null }; }); })
      .then(function (res) {
        if (res.status === 503) { toast('Workout AI isn’t switched on yet', 'error'); WK.home(); return; }
        if (!res.ok || !res.j || !res.j.plan) { toast('Could not generate — try rephrasing', 'error'); WK.home(); return; }
        WK.plan = res.j.plan;
        WK._planId = null;
        WK.plan._prompt = prompt;
        savePlan(prompt);
        WK.review();
      })
      .catch(function () { toast('Network error — try again', 'error'); WK.home(); });
  };

  function savePlan(prompt) {
    var mid = memberId(); if (!sb() || !mid || !WK.plan) return;
    sb().from('workout_plans').insert({ member_id: mid, title: WK.plan.title, focus: WK.plan.focus, duration_min: WK.plan.duration_min, plan: WK.plan, source_prompt: prompt || WK.plan._prompt || '' }).select('id').single()
      .then(function (res) { if (!res.error && res.data) WK._planId = res.data.id; });
  }

  // ───────────────────────── REVIEW (editable) ─────────────────────────
  WK.review = function () {
    injectStyles();
    var host = root(); if (!host || !WK.plan) { WK.home(); return; }
    var p = WK.plan;
    var warm = (p.warmup || []).map(function (w, i) {
      return '<div class="wk-row"><div><div class="nm">' + esc(w.name) + '</div><div class="sub">' + (w.duration_sec || 30) + 's' + (w.note ? (' · ' + esc(w.note)) : '') + '</div></div><button class="wk-x" onclick="FFPWorkout.rm(\'warmup\',' + i + ')">×</button></div>';
    }).join('') || '<div class="wk-hint" style="text-align:left;">No warm-up.</div>';
    var cool = (p.cooldown || []).map(function (c, i) {
      return '<div class="wk-row"><div><div class="nm">' + esc(c.name) + '</div><div class="sub">' + (c.duration_sec || 30) + 's' + (c.note ? (' · ' + esc(c.note)) : '') + '</div></div><button class="wk-x" onclick="FFPWorkout.rm(\'cooldown\',' + i + ')">×</button></div>';
    }).join('') || '<div class="wk-hint" style="text-align:left;">No cool-down.</div>';
    var exs = (p.exercises || []).map(function (e, i) {
      return '<div class="wk-ex">' +
        '<div class="wk-ex-top"><input class="wk-ex-name" value="' + esc(e.name) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'name\',this.value)"><button class="wk-x" onclick="FFPWorkout.rm(\'exercises\',' + i + ')">×</button></div>' +
        '<div class="wk-grid">' +
          '<div class="wk-fld"><label>Sets</label><input type="number" inputmode="numeric" value="' + esc(e.sets) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'sets\',this.value)"></div>' +
          '<div class="wk-fld"><label>Reps</label><input value="' + esc(e.reps) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'reps\',this.value)"></div>' +
          '<div class="wk-fld"><label>Rest s</label><input type="number" inputmode="numeric" value="' + esc(e.rest_sec) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'rest_sec\',this.value)"></div>' +
          '<div class="wk-fld"><label>Weight</label><input value="' + esc(e.weight) + '" oninput="FFPWorkout.edit(\'exercises\',' + i + ',\'weight\',this.value)"></div>' +
        '</div>' +
        (e.note ? '<div class="sub" style="margin-top:7px;">' + esc(e.note) + '</div>' : '') +
      '</div>';
    }).join('');
    host.innerHTML =
      '<div class="wk-card">' +
        '<input id="wk-title" value="' + esc(p.title || 'Workout') + '" oninput="FFPWorkout.editTitle(this.value)" style="width:100%;box-sizing:border-box;background:transparent;border:none;color:var(--text);font-size:19px;font-weight:800;font-family:inherit;padding:0 0 4px;">' +
        '<div class="sub" style="font-size:12px;color:var(--muted);">' + (p.duration_min ? (p.duration_min + ' min') : 'Custom') + (p.focus ? (' · ' + esc(p.focus)) : '') + '</div>' +
      '</div>' +
      '<div class="wk-sec-h">Warm-up</div>' + warm +
      '<div class="wk-sec-h">Workout</div>' + exs +
      '<button class="wk-btn ghost" style="margin:4px 0 4px;" onclick="FFPWorkout.addEx()">+ Add exercise</button>' +
      '<div class="wk-sec-h">Cool-down</div>' + cool +
      '<div style="display:flex;gap:8px;margin-top:18px;">' +
        '<button class="wk-btn ghost" style="flex:0 0 38%;" onclick="FFPWorkout.home()">New prompt</button>' +
        '<button class="wk-btn blue" style="flex:1;" onclick="FFPWorkout.start()"><span style="vertical-align:-3px;" class="material-icons">play_arrow</span> Start workout</button>' +
      '</div>';
  };
  WK.editTitle = function (v) { if (WK.plan) WK.plan.title = v; };
  WK.edit = function (sec, i, field, v) {
    var arr = WK.plan && WK.plan[sec]; if (!arr || !arr[i]) return;
    if (field === 'sets' || field === 'rest_sec') v = firstInt(v, field === 'sets' ? 1 : 60);
    arr[i][field] = v;
  };
  WK.rm = function (sec, i) { var arr = WK.plan && WK.plan[sec]; if (arr) { arr.splice(i, 1); WK.review(); } };
  WK.addEx = function () { if (!WK.plan) return; if (!WK.plan.exercises) WK.plan.exercises = []; WK.plan.exercises.push({ name: 'New exercise', sets: 3, reps: '10', rest_sec: 75, weight: '', note: '' }); WK.review(); };

  // ───────────────────────── GUIDED RUNNER ─────────────────────────
  function buildSteps(p) {
    var steps = [];
    (p.warmup || []).forEach(function (w) { steps.push({ kind: 'mob', section: 'Warm-up', name: w.name, dur: w.duration_sec || 30, note: w.note }); });
    (p.exercises || []).forEach(function (e, ei) {
      var sets = Math.max(1, firstInt(e.sets, 1));
      for (var s = 1; s <= sets; s++) steps.push({ kind: 'set', section: 'Workout', exIndex: ei, name: e.name, setNo: s, setsTotal: sets, reps: e.reps, rest: firstInt(e.rest_sec, 0), weight: e.weight, note: e.note });
    });
    (p.cooldown || []).forEach(function (c) { steps.push({ kind: 'mob', section: 'Cool-down', name: c.name, dur: c.duration_sec || 30, note: c.note }); });
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
    if (!steps.length) { toast('Nothing to run', 'error'); return; }
    WK.run = { plan: WK.plan, steps: steps, i: 0, performed: [], startedAt: Date.now(), resting: false, timer: null, lastWeight: {} };
    ensureRunnerEl().classList.add('open');
    renderStep();
  };

  function clearTimer() { if (WK.run && WK.run.timer) { clearInterval(WK.run.timer); WK.run.timer = null; } }

  function setProgress() {
    var f = document.getElementById('wkr-prog-fill'); if (!f || !WK.run) return;
    f.style.width = Math.round((WK.run.i / WK.run.steps.length) * 100) + '%';
  }

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
      foot.innerHTML = '<button class="wk-btn ghost" onclick="FFPWorkout.next()">Skip</button><button class="wk-btn blue" onclick="FFPWorkout.next()">Done ✓</button>';
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
        '<div class="wkr-target">Target: ' + esc(step.reps) + ' reps' + (step.weight ? (' · ' + esc(step.weight)) : '') + '</div>' +
        '<div class="wkr-fills">' +
          '<div class="wkr-fill"><label>Reps done</label><input id="wkr-reps" type="number" inputmode="numeric" value="' + prefReps + '"></div>' +
          '<div class="wkr-fill"><label>Weight kg</label><input id="wkr-weight" type="number" inputmode="decimal" value="' + esc(prefW) + '" placeholder="–"></div>' +
        '</div>' +
        (step.note ? '<div class="wkr-note">' + esc(step.note) + '</div>' : '');
      foot.innerHTML = '<button class="wk-btn pri" onclick="FFPWorkout.completeSet()">Complete set ✓</button>';
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
    var end = Date.now() + sec * 1000;
    r._restEnd = end;
    var next = r.steps[r.i + 1];
    var body = document.getElementById('wkr-body'), foot = document.getElementById('wkr-foot');
    body.innerHTML =
      '<div class="wkr-section">Rest</div>' +
      '<div class="wkr-ring"><div class="t" id="wkr-count">' + fmt(sec) + '</div></div>' +
      '<div class="wkr-next">Next: ' + (next ? esc(next.name) + (next.kind === 'set' ? (' · Set ' + next.setNo) : '') : 'Finish') + '</div>';
    foot.innerHTML = '<button class="wk-btn ghost" onclick="FFPWorkout.addRest()">+15s</button><button class="wk-btn blue" onclick="FFPWorkout.next()">Skip rest →</button>';
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
    var exCount = (r.plan.exercises || []).length;
    r._summary = { durSec: durSec, sets: sets, volume: Math.round(volume), exCount: exCount };
    var body = document.getElementById('wkr-body'), foot = document.getElementById('wkr-foot');
    setProgress();
    var f = document.getElementById('wkr-prog-fill'); if (f) f.style.width = '100%';
    body.innerHTML =
      '<div class="wkr-section">Complete</div>' +
      '<div class="wkr-name">' + esc(r.plan.title || 'Workout') + ' 💪</div>' +
      '<div style="display:flex;gap:8px;width:100%;max-width:320px;margin:18px 0 6px;">' +
        '<div class="wk-stat"><div class="v">' + fmt(durSec) + '</div><div class="l">Time</div></div>' +
        '<div class="wk-stat"><div class="v">' + sets + '</div><div class="l">Sets</div></div>' +
        '<div class="wk-stat"><div class="v">' + (volume >= 1000 ? (Math.round(volume / 100) / 10) + 'k' : Math.round(volume)) + '</div><div class="l">kg vol</div></div>' +
      '</div>';
    foot.innerHTML = '<button class="wk-btn ghost" onclick="FFPWorkout.share()">Share</button><button class="wk-btn pri" onclick="FFPWorkout.saveLog()">Save</button>';
  }

  WK.saveLog = function () {
    var r = WK.run; if (!r) { return; }
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

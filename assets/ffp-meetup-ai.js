/* FFP MEETUP AI — smart search + AI quick-create for the member Meetup panel.
   v1 (2026-06-25).

   DESIGN (world-class + future-proof):
   - The AI ONLY turns words into a structured intent/draft (server: /api/ai/parse, Haiku, fast & cheap).
     ALL ranking and ALL writes stay in deterministic, testable code here + the canonical host_meetup RPC.
     => no hallucinated results, model is swappable by one env var, everything unit-testable.
   - This module is ADDITIVE: it DECORATES window.MeetMove (wraps .filtered) and INJECTS its own UI.
     It never edits ffp-connections-core.js, so the fragile core is untouched and this is reversible.
   - Graceful degradation: if the AI endpoint is off/unreachable, smart search falls back to a plain
     keyword filter and quick-create just opens the normal Post-a-Meetup form.

   Integration points (verified 2026-06-25):
     panel  #panel-meetups · grid #meet-grid · post btn .post-meetup-btn (MeetMove.openPostForm)
     MeetMove.data items: {activity,cat,level,city,country,gender,_ts,_raw{sport,fitness_level,latitude,longitude},about,venue}
     MeetMove.filtered() -> array  ·  MeetMove.render() -> writes #meet-grid
     create form ids: pmf-title pmf-cat pmf-cat-display pmf-level pmf-date pmf-time pmf-capacity
                      pmf-country pmf-city pmf-venue pmf-gender pmf-age-from pmf-age-to pmf-desc
     member: window.FFPAuth.getMember()  ·  card cache: window.FFPCard.resolve(id)
*/
(function () {
  'use strict';
  var BACKEND = 'https://ffp-passport-backend.vercel.app';
  var CATS = ['racquet', 'running', 'cycling', 'swimming', 'team', 'combat', 'fitness', 'mind-body', 'adventure'];
  var LEVEL_ORDER = ['not tried', 'social', 'competitive', 'representative', 'professional'];

  var activeIntent = null;   // current smart-search intent (null = normal MeetMove behaviour)

  /* ---------------- tiny helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function lc(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function nowLocal() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function toast(msg, type) { try { if (typeof showToast === 'function') showToast(msg, type); } catch (e) {} }

  function myProfile() {
    var m = {};
    try { m = (window.FFPAuth && FFPAuth.getMember && FFPAuth.getMember()) || {}; } catch (e) { m = {}; }
    var prof = { id: m.id || null, city: lc(m.city), country: lc(m.country), sports: {}, level: '' };
    try {
      var card = (window.FFPCard && FFPCard.resolve && m.id) ? FFPCard.resolve(m.id) : null;
      if (card) {
        if (!prof.city && card.city) prof.city = lc(card.city);
        (Array.isArray(card.sports) ? card.sports : []).forEach(function (s) {
          if (s && s.name) prof.sports[lc(s.name)] = lc(s.level || '');
        });
      }
    } catch (e) {}
    return prof;
  }

  /* ---------------- deterministic ranking (the testable core) ----------------
     Pure: (item, intent, profile) -> number. Higher = better fit. No I/O. */
  function levelGap(a, b) {
    var i = LEVEL_ORDER.indexOf(lc(a)), j = LEVEL_ORDER.indexOf(lc(b));
    if (i < 0 || j < 0) return null;
    return Math.abs(i - j);
  }
  function scoreMeetup(item, intent, profile) {
    intent = intent || {}; profile = profile || { sports: {} };
    var raw = item._raw || {};
    var sport = lc(raw.sport || item.activity);
    var city = lc(item.city), country = lc(item.country), level = lc(raw.fitness_level || item.level);
    var score = 0;

    if (intent.sport && sport && lc(intent.sport) === sport) score += 50;
    else if (profile.sports && profile.sports.hasOwnProperty(sport)) score += 25; // personalization: a sport they play
    if (intent.category && item.cat && lc(intent.category) === lc(item.cat)) score += 18;

    if (intent.city && city && lc(intent.city) === city) score += 30;
    else if (profile.city && city && profile.city === city) score += 15;            // personalization: their city
    if (intent.country && country && lc(intent.country) === country) score += 8;
    else if (profile.country && country && profile.country === country) score += 5;

    if (intent.fitness_level) { var g = levelGap(intent.fitness_level, level); if (g != null) score += Math.max(0, 12 - g * 6); }
    else if (profile.sports && profile.sports[sport]) { var g2 = levelGap(profile.sports[sport], level); if (g2 != null) score += Math.max(0, 8 - g2 * 4); }

    (intent.keywords || []).forEach(function (k) {
      k = lc(k); if (!k) return;
      var hay = lc(item.activity) + ' ' + lc(item.venue) + ' ' + lc(item.about) + ' ' + sport;
      if (hay.indexOf(k) !== -1) score += 5;
    });

    // soonest-first nudge (closer events rank a touch higher)
    if (item._ts) { var days = (item._ts - Date.now()) / 86400000; if (days >= 0) score += Math.max(0, 8 - days); }
    return score;
  }

  function inDateWindow(ts, from, to) {
    if (!ts) return true;
    if (from) { var f = Date.parse(from); if (isFinite(f) && ts < f) return false; }
    if (to) { var t = Date.parse(to + 'T23:59:59'); if (isFinite(t) && ts > t) return false; }
    return true;
  }

  // rank + (soft) filter the already-filtered MeetMove array
  function rankAndFilter(arr, intent, profile) {
    var now = Date.now();
    var rows = arr.filter(function (m) { return !m._ts || m._ts >= now; });        // never show past
    if (intent && (intent.date_from || intent.date_to)) {
      var win = rows.filter(function (m) { return inDateWindow(m._ts, intent.date_from, intent.date_to); });
      if (win.length) rows = win;                                                   // only narrow if it leaves results
    }
    rows.forEach(function (m) { m._aiScore = scoreMeetup(m, intent, profile); });
    rows.sort(function (a, b) {
      if (b._aiScore !== a._aiScore) return b._aiScore - a._aiScore;               // best match first
      return (a._ts || 0) - (b._ts || 0);                                          // then soonest
    });
    return rows;
  }

  /* ---------------- decorate MeetMove.filtered (additive, reversible) ---------------- */
  function installDecorator() {
    if (!window.MeetMove || MeetMove._aiDecorated) return;
    var orig = MeetMove.filtered.bind(MeetMove);
    MeetMove.filtered = function () {
      var a = orig();
      if (activeIntent) { try { a = rankAndFilter(a, activeIntent, myProfile()); } catch (e) {} }
      return a;
    };
    MeetMove._aiDecorated = true;
  }

  /* ---------------- AI calls (parse only) ---------------- */
  function aiParse(kind, text) {
    return fetch(BACKEND + '/api/ai/parse', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: kind, text: text, now: nowLocal() })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }

  /* ---------------- smart search ---------------- */
  function summaryChips(intent) {
    var bits = [];
    if (intent.sport) bits.push(intent.sport);
    if (intent.fitness_level) bits.push(intent.fitness_level);
    if (intent.city) bits.push(intent.city);
    if (intent.date_from || intent.date_to) bits.push('soon');
    (intent.keywords || []).slice(0, 2).forEach(function (k) { if (bits.indexOf(k) < 0) bits.push(k); });
    return bits;
  }
  function setSummary(intent, count) {
    var el = $('ffp-ai-meet-summary'); if (!el) return;
    if (!intent) { el.innerHTML = ''; el.style.display = 'none'; return; }
    var chips = summaryChips(intent).map(function (b) { return '<span class="ffpai-chip">' + esc(b) + '</span>'; }).join('');
    el.innerHTML = '<span class="ffpai-best">Best matches' + (count != null ? ' (' + count + ')' : '') + '</span>' + chips +
      '<button type="button" class="ffpai-clear" id="ffp-ai-meet-clear">Clear</button>';
    el.style.display = 'flex';
    var c = $('ffp-ai-meet-clear'); if (c) c.onclick = clearSearch;
  }
  function clearSearch() {
    activeIntent = null;
    var q = $('ffp-ai-meet-q'); if (q) q.value = '';
    setSummary(null);
    try { MeetMove.render(); } catch (e) {}
  }
  function runSearch() {
    var q = $('ffp-ai-meet-q'); var text = q ? q.value.trim() : '';
    if (text.length < 2) { toast('Type what you are looking for', 'error'); return; }
    var btn = $('ffp-ai-meet-go'); if (btn) { btn.disabled = true; btn.textContent = '…'; }
    aiParse('meetup_search', text).then(function (r) {
      if (!r.ok || !r.j || !r.j.intent) {
        // graceful fallback: plain keyword search via MeetMove's own search box
        activeIntent = null; try { MeetMove.search = lc(text); MeetMove.render(); } catch (e) {}
        setSummary(null);
        toast(r.status === 503 ? 'AI is off — showing keyword results' : 'Showing keyword results');
        return;
      }
      activeIntent = r.j.intent;
      try { MeetMove.tab = 'discover'; MeetMove.search = ''; } catch (e) {}
      var rows; try { rows = MeetMove.filtered(); } catch (e) { rows = []; }
      try { MeetMove.render(); } catch (e) {}
      setSummary(activeIntent, rows ? rows.length : null);
    }).catch(function () {
      activeIntent = null; try { MeetMove.search = lc(text); MeetMove.render(); } catch (e) {}
      toast('Showing keyword results');
    }).then(function () { if (btn) { btn.disabled = false; btn.textContent = 'Search'; } });
  }

  /* ---------------- AI quick-create ---------------- */
  function setField(id, val) { var el = $(id); if (el && val != null && val !== '') el.value = val; }
  function prefillForm(d) {
    setField('pmf-title', d.title);
    if (d.sport) { setField('pmf-cat', d.sport); var disp = $('pmf-cat-display'); if (disp) disp.textContent = d.sport + (d.fitness_level ? ' · ' + d.fitness_level : ''); }
    setField('pmf-level', d.fitness_level);
    setField('pmf-date', d.date);
    setField('pmf-time', d.time || '18:00');
    if (d.max_people) setField('pmf-capacity', String(Math.max(2, Math.min(8, d.max_people))));
    setField('pmf-country', d.country);
    setField('pmf-city', d.city);
    if (d.venue) { setField('pmf-venue', d.venue); var ld = $('pmf-loc-display'); if (ld) ld.textContent = d.venue; }
    if (d.gender) setField('pmf-gender', d.gender);
    if (d.age_from) setField('pmf-age-from', String(d.age_from));
    if (d.age_to) setField('pmf-age-to', String(d.age_to));
    setField('pmf-desc', d.description);
  }
  function runCompose(text) {
    if (!text || text.trim().length < 3) { toast('Describe your meetup in a sentence', 'error'); return; }
    toast('Drafting your meetup…');
    aiParse('meetup_compose', text.trim()).then(function (r) {
      try { MeetMove.openPostForm(); } catch (e) {}
      if (r.ok && r.j && r.j.draft) { setTimeout(function () { prefillForm(r.j.draft); toast('Review the details, then post', 'success'); }, 60); }
      else { toast(r.status === 503 ? 'AI is off — fill it in below' : 'Fill in the details below'); }
    }).catch(function () { try { MeetMove.openPostForm(); } catch (e) {} toast('Fill in the details below'); });
  }
  function openComposePrompt() {
    var box = $('ffp-ai-compose-wrap'); if (!box) return;
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
    if (box.style.display === 'block') { var t = $('ffp-ai-compose-q'); if (t) t.focus(); }
  }

  /* ---------------- voice (Web Speech API, optional) ---------------- */
  function speechSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  function listen(targetId, micBtn) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    var rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    if (micBtn) micBtn.classList.add('rec');
    rec.onresult = function (e) { var t = (e.results[0][0].transcript || '').trim(); var el = $(targetId); if (el) el.value = t; };
    rec.onerror = function () { toast('Could not hear you — type instead'); };
    rec.onend = function () { if (micBtn) micBtn.classList.remove('rec'); };
    try { rec.start(); } catch (e) {}
  }

  /* ---------------- UI injection ---------------- */
  function styles() {
    if ($('ffp-meetup-ai-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-meetup-ai-css';
    s.textContent = [
      '.ffpai-wrap{margin:0 0 12px;}',
      '.ffpai-bar{display:flex;gap:8px;align-items:center;background:var(--bg-2,#0f1e2e);border:1px solid var(--border,rgba(43,168,224,.28));border-radius:12px;padding:8px 10px;}',
      '.ffpai-spark{color:var(--blue,#2ba8e0);font-size:20px;flex:0 0 auto;}',
      '.ffpai-input{flex:1;min-width:0;background:transparent;border:none;outline:none;color:var(--text,#e8eef4);font:inherit;font-size:14px;font-weight:600;}',
      '.ffpai-input::placeholder{color:var(--muted,#8a99a8);font-weight:500;}',
      '.ffpai-mic,.ffpai-go{flex:0 0 auto;border:none;border-radius:9px;cursor:pointer;font:inherit;font-weight:800;}',
      '.ffpai-mic{background:transparent;color:var(--muted,#8a99a8);font-size:20px;padding:4px 6px;display:flex;align-items:center;}',
      '.ffpai-mic.rec{color:#ef4444;animation:ffpaiPulse 1s infinite;}',
      '@keyframes ffpaiPulse{50%{opacity:.4;}}',
      '.ffpai-go{background:var(--blue,#2ba8e0);color:#04222f;font-size:13px;padding:8px 14px;}',
      '.ffpai-go:disabled{opacity:.6;cursor:default;}',
      '.ffpai-hint{font-size:11px;color:var(--muted,#8a99a8);margin:6px 2px 0;}',
      '.ffpai-summary{display:none;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 2px 0;}',
      '.ffpai-best{font-size:12px;font-weight:800;color:var(--blue,#2ba8e0);}',
      '.ffpai-chip{font-size:11px;font-weight:700;color:var(--text,#e8eef4);background:rgba(43,168,224,.16);border:1px solid var(--border,rgba(43,168,224,.28));border-radius:100px;padding:3px 10px;text-transform:capitalize;}',
      '.ffpai-clear{margin-left:auto;background:transparent;border:none;color:var(--muted,#8a99a8);font:inherit;font-size:12px;font-weight:700;cursor:pointer;text-decoration:underline;}',
      '.ffpai-create{display:inline-flex;align-items:center;gap:7px;background:transparent;border:1px solid var(--border,rgba(43,168,224,.34));border-radius:10px;color:var(--blue,#2ba8e0);font:inherit;font-size:13px;font-weight:800;padding:9px 14px;cursor:pointer;margin:0 0 12px;}',
      '.ffpai-create .material-icons{font-size:18px;}',
      '.ffpai-compose{display:none;background:var(--bg-2,#0f1e2e);border:1px solid var(--border,rgba(43,168,224,.28));border-radius:12px;padding:10px;margin:0 0 14px;}',
      '.ffpai-compose textarea{width:100%;background:var(--bg,#081420);border:1px solid var(--border,rgba(43,168,224,.28));border-radius:9px;color:var(--text,#e8eef4);font:inherit;font-size:14px;font-weight:500;padding:10px;resize:vertical;min-height:64px;}',
      '.ffpai-compose-row{display:flex;gap:8px;align-items:center;margin-top:8px;}'
    ].join('');
    document.head.appendChild(s);
  }

  function injectUI() {
    var panel = $('panel-meetups'); if (!panel || $('ffp-ai-meet-bar')) return;
    styles();
    var voice = speechSupported();

    // 1) Smart search bar — placed just before the tab row (#meet-tabs) or at the top of the panel.
    var search = document.createElement('div');
    search.className = 'ffpai-wrap'; search.id = 'ffp-ai-meet-bar';
    search.innerHTML =
      '<div class="ffpai-bar">' +
        '<span class="material-icons ffpai-spark">auto_awesome</span>' +
        '<input type="text" class="ffpai-input" id="ffp-ai-meet-q" placeholder="Find your meetup — e.g. beginner padel near me this weekend">' +
        (voice ? '<button type="button" class="ffpai-mic" id="ffp-ai-meet-mic" aria-label="Speak"><span class="material-icons">mic</span></button>' : '') +
        '<button type="button" class="ffpai-go" id="ffp-ai-meet-go">Search</button>' +
      '</div>' +
      '<div class="ffpai-summary" id="ffp-ai-meet-summary"></div>';
    var tabs = $('meet-tabs');
    if (tabs && tabs.parentNode) tabs.parentNode.insertBefore(search, tabs);
    else panel.insertBefore(search, panel.firstChild);

    $('ffp-ai-meet-go').onclick = runSearch;
    var qIn = $('ffp-ai-meet-q');
    if (qIn) qIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
    if (voice) { var mic = $('ffp-ai-meet-mic'); if (mic) mic.onclick = function () { listen('ffp-ai-meet-q', mic); }; }

    // 2) "Create with AI" — sibling of the existing Post-a-Meetup button.
    var postBtn = panel.querySelector('.post-meetup-btn');
    if (postBtn && postBtn.parentNode) {
      var create = document.createElement('button');
      create.type = 'button'; create.className = 'ffpai-create'; create.id = 'ffp-ai-create-btn';
      create.innerHTML = '<span class="material-icons">auto_awesome</span>Create with AI';
      create.onclick = openComposePrompt;
      postBtn.parentNode.insertBefore(create, postBtn.nextSibling);

      var compose = document.createElement('div');
      compose.className = 'ffpai-compose'; compose.id = 'ffp-ai-compose-wrap';
      compose.innerHTML =
        '<textarea id="ffp-ai-compose-q" placeholder="Describe it — e.g. 5-a-side football Saturday 6pm at Zabeel Park, 10 people, intermediate"></textarea>' +
        '<div class="ffpai-compose-row">' +
          (voice ? '<button type="button" class="ffpai-mic" id="ffp-ai-compose-mic" aria-label="Speak"><span class="material-icons">mic</span></button>' : '') +
          '<button type="button" class="ffpai-go" id="ffp-ai-compose-go" style="margin-left:auto;">Draft it</button>' +
        '</div>';
      create.parentNode.insertBefore(compose, create.nextSibling);

      $('ffp-ai-compose-go').onclick = function () { var t = $('ffp-ai-compose-q'); runCompose(t ? t.value : ''); };
      if (voice) { var cmic = $('ffp-ai-compose-mic'); if (cmic) cmic.onclick = function () { listen('ffp-ai-compose-q', cmic); }; }
    }
  }

  /* ---------------- boot: wait for MeetMove + the panel ---------------- */
  var tries = 0;
  (function waitReady() {
    if (window.MeetMove && $('panel-meetups')) { installDecorator(); injectUI(); }
    else if (tries++ < 120) { setTimeout(waitReady, 150); }
  })();
  // Re-inject if the panel is (re)rendered after we first run.
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-panel="panel-meetups"],[data-target="panel-meetups"]');
    if (t) setTimeout(function () { installDecorator(); injectUI(); }, 120);
  });

  // Expose the pure ranking for tests + future reuse.
  window.FFPMeetupAI = { scoreMeetup: scoreMeetup, rankAndFilter: rankAndFilter, _setIntent: function (i) { activeIntent = i; }, version: 'v1' };
})();

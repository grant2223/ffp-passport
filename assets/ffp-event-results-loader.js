/* FFP Event Results Loader — v1 (2026-06-07)
   Adds a "Results" tab to Fitness Stats (#panel-fitness-stats) — a member's external-event RACE RESUME.
   Self-contained (injects the tab + #fs-results-view + its own tab handler) so it doesn't touch the
   fragile fitness-stats core. Data via member_event_results / _save / _delete RPCs.
     - Brag strip: Events · Podiums · Top 10s (podium/top10 = best of overall OR age-group placing).
     - Log a result: event name (+ quick-pick catalog) · type · FFP date wheel (past dates) · result ·
       Individual/Team toggle (team name + teammates) · overall placing+field · age-group + place + field ·
       location · link · optional photo (quest-images). No native dropdowns/date inputs.
   window.FFPResults. Bump ?v= + FFP_BUILD on change. */
(function () {
  'use strict';
  function esc(s) { if (typeof window.escHtml === 'function') return window.escHtml(s); return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function attr(s) { return String(s == null ? '' : s).replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }
  function memberId() { try { if (window.FFPAuth && FFPAuth.getMember) { var m = FFPAuth.getMember(); if (m && m.id) return m.id; } } catch (e) {} try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}')).id || ''; } catch (e) { return ''; } }
  function rpc(n, a) { return window.supabase.rpc(n, a); }
  function toast(m, k) { if (typeof window.showToast === 'function') { try { window.showToast(m, k); return; } catch (e) {} } }
  function ord(n) { n = parseInt(n, 10); if (!n) return ''; var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  // Event list is an ADMIN-MANAGED TAXONOMY (event_catalog table). Loaded from DB; this is just a fallback.
  var FALLBACK = ['HYROX', 'Spartan Race', 'London Marathon', 'Parkrun', 'Ironman 70.3', 'CrossFit Open'];
  var catalog = null, catType = {};
  async function loadCatalog() {
    try {
      var r = await window.supabase.from('event_catalog').select('name,event_type').eq('active', true).order('sort_order', { ascending: true });
      if (!r.error && r.data && r.data.length) { catalog = r.data.map(function (x) { return x.name; }); r.data.forEach(function (x) { catType[x.name] = x.event_type; }); }
    } catch (e) {}
  }
  var TYPES = [['running', 'Run'], ['obstacle', 'Obstacle'], ['strength', 'Strength'], ['other', 'Other']];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function injectCss() {
    if (document.getElementById('ffp-er-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-er-css';
    s.textContent = [
      '.er-strip{display:flex;gap:8px;margin:14px 0 4px;}',
      '.er-stat{flex:1;background:#0f2336;border-radius:12px;padding:10px;text-align:center;}',
      '.er-stat .n{font-size:20px;font-weight:800;} .er-stat .l{font-size:11px;color:#8aa0b5;}',
      '.er-log{width:100%;background:#FFCC00;color:#081420;font-weight:800;border:none;border-radius:12px;padding:12px;font-size:14px;margin:8px 0 4px;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;}',
      '.er-log .material-icons{font-size:19px;}',
      '.er-sec{font-size:13px;font-weight:800;color:#cdd8e2;margin:14px 0 2px;}',
      '.er-row{display:flex;gap:12px;align-items:center;padding:12px 2px;border-top:1px solid rgba(255,255,255,0.06);cursor:pointer;}',
      '.er-ic{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;background:#16263a;color:#2ba8e0;}',
      '.er-ic .material-icons{font-size:20px;}',
      '.er-main{flex:1;min-width:0;}',
      '.er-name{font-size:13px;font-weight:700;color:#e8eef4;}',
      '.er-meta{font-size:11px;color:#8a99a8;margin-top:2px;}',
      '.er-tag{font-size:10px;font-weight:800;padding:1px 6px;border-radius:6px;margin-left:5px;}',
      '.er-tag.team{color:#cdb9ff;background:#2a2247;border:1px solid #4a3f7a;}',
      '.er-tag.pod{color:#081420;background:#FFCC00;}',
      '.er-tag.top{color:#081420;background:#36c97f;}',
      '.er-empty{font-size:12px;color:#8a99a8;padding:14px 2px;line-height:1.5;}',
      '.er-seg{display:flex;gap:8px;flex-wrap:wrap;}',
      '.er-seg-btn{flex:1;min-width:70px;padding:10px;border-radius:10px;border:1px solid #2a3f57;background:transparent;color:#9fb2c6;font-weight:800;font-size:13px;cursor:pointer;}',
      '.er-seg-btn.active{background:#FFCC00;color:#081420;border-color:#FFCC00;}',
      '.er-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;}',
      '.er-chip{font-size:11px;color:#cfe0ee;background:#13283c;border:1px solid #244a66;border-radius:20px;padding:5px 10px;cursor:pointer;}',
      '.er-two{display:flex;gap:8px;} .er-two > div{flex:1;}',
      '.er-photo{width:120px;height:120px;margin:2px auto 14px;border-radius:14px;border:2px dashed #2a3f57;background:#0e1c2c center/cover no-repeat;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#7c93ab;}',
      '.er-photo.set{border-style:solid;border-color:#1a2f44;} .er-photo .material-icons{font-size:30px;} .er-photo.set .material-icons{display:none;}',
      '#fs-results-view .er-del{width:100%;background:transparent;border:1px solid rgba(214,90,90,0.4);color:#d65a5a;border-radius:10px;padding:11px;font-weight:700;font-size:13px;cursor:pointer;margin-top:8px;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── Past-date wheel picker (Day / Month / Year). Reuses the global .ffp-dur-* styling. ──
  var DatePicker = (function () {
    var ITEM = 40, overlay = null, cols = {}, sel = { d: 0, mo: 0, y: 0 }, cb = null, raf = {}, years = [], built = false;
    function items(arr) { var h = '<div class="ffp-dur-spacer"></div>'; for (var i = 0; i < arr.length; i++) h += '<div class="ffp-dur-item" data-v="' + i + '">' + arr[i] + '</div>'; return h + '<div class="ffp-dur-spacer"></div>'; }
    function bind(u, max) { var col = cols[u]; col.addEventListener('scroll', function () { if (raf[u]) cancelAnimationFrame(raf[u]); raf[u] = requestAnimationFrame(function () { var idx = Math.max(0, Math.min(max, Math.round(col.scrollTop / ITEM))); sel[u] = idx; hi(u, idx); }); }); }
    function hi(u, idx) { var its = cols[u].querySelectorAll('.ffp-dur-item'); for (var i = 0; i < its.length; i++) its[i].classList.toggle('sel', i === idx); }
    function setNow(u, v, max) { v = Math.max(0, Math.min(max, v)); cols[u].scrollTop = v * ITEM; sel[u] = v; hi(u, v); }
    function build() {
      if (built) return; built = true;
      overlay = document.createElement('div'); overlay.className = 'ffp-dur-overlay'; overlay.id = 'ffp-erdate-overlay';
      overlay.innerHTML =
        '<div class="ffp-dur-sheet"><div class="ffp-dur-head">' +
          '<button type="button" class="ffp-dur-cancel">Cancel</button><div class="ffp-dur-title">Event date</div>' +
          '<button type="button" class="ffp-dur-done">Done</button></div>' +
        '<div class="ffp-dur-colhead"><span>Day</span><span>Month</span><span>Year</span></div>' +
        '<div class="ffp-dur-wheels"><div class="ffp-dur-center"></div>' +
          '<div class="ffp-dur-col" data-unit="d"></div><div class="ffp-dur-col" data-unit="mo"></div><div class="ffp-dur-col" data-unit="y"></div></div></div>';
      document.body.appendChild(overlay);
      cols.d = overlay.querySelector('[data-unit="d"]'); cols.mo = overlay.querySelector('[data-unit="mo"]'); cols.y = overlay.querySelector('[data-unit="y"]');
      var days = []; for (var i = 1; i <= 31; i++) days.push(i);
      var ynow = new Date().getFullYear(); years = []; for (var k = ynow; k >= ynow - 25; k--) years.push(k);
      cols.d.innerHTML = items(days); cols.mo.innerHTML = items(MON); cols.y.innerHTML = items(years);
      bind('d', 30); bind('mo', 11); bind('y', years.length - 1);
      overlay.querySelector('.ffp-dur-cancel').addEventListener('click', close);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      overlay.querySelector('.ffp-dur-done').addEventListener('click', function () {
        var y = years[sel.y], mo = sel.mo, day = Math.min(sel.d + 1, new Date(y, mo + 1, 0).getDate());
        var iso = y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        var label = day + ' ' + MON[mo] + ' ' + y;
        var fn = cb; close(); if (fn) fn({ iso: iso, label: label });
      });
    }
    function open(startIso, onDone) {
      build(); cb = onDone || null;
      var d = startIso ? new Date(startIso) : new Date(); if (isNaN(d)) d = new Date();
      var ynow = new Date().getFullYear(); var yi = Math.max(0, Math.min(years.length - 1, ynow - d.getFullYear()));
      overlay.classList.add('show');
      requestAnimationFrame(function () { setNow('d', d.getDate() - 1, 30); setNow('mo', d.getMonth(), 11); setNow('y', yi, years.length - 1); });
    }
    function close() { if (overlay) overlay.classList.remove('show'); cb = null; }
    return { open: open };
  })();

  function typeIcon(t) { return t === 'running' ? 'directions_run' : t === 'obstacle' ? 'terrain' : t === 'strength' ? 'fitness_center' : 'emoji_events'; }
  function placingText(r) {
    var parts = [];
    if (r.overall_place) parts.push(ord(r.overall_place) + (r.overall_field ? ' of ' + r.overall_field : '') + ' overall');
    if (r.ag_place) parts.push(ord(r.ag_place) + (r.age_group ? ' ' + r.age_group : ' age group'));
    return parts.join(' · ');
  }
  function bestPlace(r) { var ps = [r.overall_place, r.ag_place].filter(function (x) { return x; }); return ps.length ? Math.min.apply(null, ps) : null; }

  function renderInto(view, data) {
    var st = (data && data.stats) || { events: 0, podiums: 0, top10: 0 };
    var results = (data && data.results) || [];
    var html =
      '<div class="er-strip">' +
        '<div class="er-stat"><div class="n">' + st.events + '</div><div class="l">Events</div></div>' +
        '<div class="er-stat"><div class="n" style="color:#FFCC00;">' + st.podiums + '</div><div class="l">Podiums</div></div>' +
        '<div class="er-stat"><div class="n" style="color:#36c97f;">' + st.top10 + '</div><div class="l">Top 10s</div></div>' +
      '</div>' +
      '<button class="er-log" onclick="FFPResults.openLog()"><span class="material-icons">add</span>Log a result</button>' +
      '<div class="er-sec">Your results</div>';
    if (!results.length) {
      html += '<div class="er-empty">No results yet. Tap <b>Log a result</b> to start your race resume — marathons, HYROX, Spartan, CrossFit and more.</div>';
    } else {
      html += results.map(function (r) {
        var best = bestPlace(r);
        var tag = '';
        if (best && best <= 3) tag = '<span class="er-tag pod">Podium</span>';
        else if (best && best <= 10) tag = '<span class="er-tag top">Top 10</span>';
        var team = r.is_team ? '<span class="er-tag team">Team</span>' : '';
        var d = r.event_date ? new Date(r.event_date) : null;
        var dstr = d && !isNaN(d) ? (d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear()) : '';
        var meta = [dstr, r.result_text, placingText(r)].filter(Boolean).join(' · ');
        return '<div class="er-row" onclick="FFPResults.openEdit(\'' + attr(r.id) + '\')">' +
          '<div class="er-ic"><span class="material-icons">' + typeIcon(r.event_type) + '</span></div>' +
          '<div class="er-main"><div class="er-name">' + esc(r.event_name) + team + tag + '</div>' +
          '<div class="er-meta">' + esc(meta) + (r.is_team && r.team_name ? ' · ' + esc(r.team_name) : '') + '</div></div>' +
          '<span class="material-icons" style="color:#5f7185;">chevron_right</span></div>';
      }).join('');
    }
    view.innerHTML = html;
  }

  var _data = null;
  async function render() {
    var view = document.getElementById('fs-results-view'); if (!view) return;
    if (!window.supabase || !memberId()) { view.innerHTML = '<div class="er-empty">Sign in to see your results.</div>'; return; }
    if (!catalog) { try { await loadCatalog(); } catch (e) {} }
    try {
      var r = await rpc('member_event_results', { p_me: memberId() });
      if (r.error) throw r.error;
      _data = r.data || {}; renderInto(view, _data);
    } catch (e) { console.warn('[FFP Results]', e); var v = document.getElementById('fs-results-view'); if (v) v.innerHTML = '<div class="er-empty">Couldn’t load results — pull to refresh.</div>'; }
  }

  function ensureTab() {
    var tabs = document.getElementById('fs-tabs'); var panel = document.getElementById('panel-fitness-stats');
    if (!tabs || !panel) return false;
    if (!document.querySelector('#fs-tabs [data-fs-tab="results"]')) {
      var b = document.createElement('button'); b.className = 'tabs-underline-btn'; b.setAttribute('data-fs-tab', 'results'); b.textContent = 'Results';
      tabs.appendChild(b);
    }
    if (!document.getElementById('fs-results-view')) {
      var v = document.createElement('div'); v.id = 'fs-results-view'; v.style.display = 'none'; panel.appendChild(v);
    }
    if (!tabs._erHooked) {
      tabs._erHooked = true;
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('.tabs-underline-btn'); if (!btn) return;
        var t = btn.getAttribute('data-fs-tab'); var rv = document.getElementById('fs-results-view');
        if (t === 'results') {
          tabs.querySelectorAll('.tabs-underline-btn').forEach(function (x) { x.classList.remove('active'); });
          btn.classList.add('active');
          ['bio', 'activity', 'records', 'milestones'].forEach(function (k) { var el = document.getElementById('fs-' + k + '-view'); if (el) el.style.display = 'none'; });
          if (rv) rv.style.display = '';
          render();
        } else if (rv) { rv.style.display = 'none'; }
      });
    }
    return true;
  }

  // ───────── Log / edit form ─────────
  var F = { hero: '', mode: 'solo', type: 'running', dateIso: '', editId: null };
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  window.FFPResults = {
    reload: render,
    fillEvent: function (name) { var e = document.getElementById('er-name'); if (e) e.value = name; if (catType[name]) this.setType(catType[name]); },
    setType: function (t) { F.type = t; var b = document.querySelectorAll('#er-type .er-seg-btn'); for (var i = 0; i < b.length; i++) b[i].classList.toggle('active', b[i].getAttribute('data-v') === t); },
    setMode: function (m) {
      F.mode = m; var b = document.querySelectorAll('#er-mode .er-seg-btn'); for (var i = 0; i < b.length; i++) b[i].classList.toggle('active', b[i].getAttribute('data-v') === m);
      var tw = document.getElementById('er-team-wrap'); if (tw) tw.style.display = (m === 'team') ? '' : 'none';
    },
    pickDate: function () { DatePicker.open(F.dateIso || null, function (r) { F.dateIso = r.iso; var el = document.getElementById('er-date-btn'); if (el) el.textContent = r.label; }); },
    pickPhoto: function () {
      if (!window.FFPUpload || !window.FFPUpload.pick) { toast('Photo upload unavailable'); return; }
      window.FFPUpload.pick({ bucket: 'quest-images', key: 'event-result/' + memberId() + '-' + Date.now() + '.jpg', aspect: 1, outW: 900, outH: 900, title: 'Result photo',
        onDone: function (url) { F.hero = url || ''; var el = document.getElementById('er-photo'); if (el && url) { el.classList.add('set'); el.style.backgroundImage = "url('" + url + "')"; } },
        onError: function (e) { toast('Photo upload failed: ' + ((e && e.message) || 'unknown')); } });
    },
    openLog: function () { this._form(null); },
    openEdit: function (id) { var r = ((_data && _data.results) || []).filter(function (x) { return x.id === id; })[0]; this._form(r || null); },
    _form: function (r) {
      F.hero = (r && r.photo_url) || ''; F.mode = (r && r.is_team) ? 'team' : 'solo'; F.type = (r && r.event_type) || 'running';
      F.dateIso = (r && r.event_date) || ''; F.editId = (r && r.id) || null;
      var chips = (catalog || FALLBACK).map(function (n) { return '<span class="er-chip" onclick="FFPResults.fillEvent(\'' + attr(n) + '\')">' + esc(n) + '</span>'; }).join('');
      var typeBtns = TYPES.map(function (p) { return '<button type="button" class="er-seg-btn' + (F.type === p[0] ? ' active' : '') + '" data-v="' + p[0] + '" onclick="FFPResults.setType(\'' + p[0] + '\')">' + p[1] + '</button>'; }).join('');
      var dateLabel = '';
      if (F.dateIso) { var dd = new Date(F.dateIso); if (!isNaN(dd)) dateLabel = dd.getDate() + ' ' + MON[dd.getMonth()] + ' ' + dd.getFullYear(); }
      var teammates = (r && Array.isArray(r.teammates)) ? r.teammates.map(function (x) { return x.name || x; }).join(', ') : '';
      var body =
        '<div class="dm-body"><div class="dm-title">' + (r ? 'Edit result' : 'Log a result') + '</div></div>' +
        '<div class="submit-score-form">' +
          '<div class="er-photo" id="er-photo"' + (F.hero ? ' style="background-image:url(\'' + esc(F.hero) + '\');"' : '') + ' onclick="FFPResults.pickPhoto()"><span class="material-icons">add_a_photo</span></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Event</label><input type="text" id="er-name" class="submit-score-input" placeholder="e.g. London Marathon" value="' + esc((r && r.event_name) || '') + '">' +
            '<div class="er-chips">' + chips + '</div></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Type</label><div class="er-seg" id="er-type">' + typeBtns + '</div></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Date</label><button type="button" class="submit-score-input" id="er-date-btn" style="text-align:left;cursor:pointer;" onclick="FFPResults.pickDate()">' + (dateLabel || 'Tap to set the event date') + '</button></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Your result</label><input type="text" id="er-result" class="submit-score-input" placeholder="e.g. 3:24:11 or Rx 7:42" value="' + esc((r && r.result_text) || '') + '"></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Entered as</label><div class="er-seg" id="er-mode">' +
            '<button type="button" class="er-seg-btn' + (F.mode === 'solo' ? ' active' : '') + '" data-v="solo" onclick="FFPResults.setMode(\'solo\')">Individual</button>' +
            '<button type="button" class="er-seg-btn' + (F.mode === 'team' ? ' active' : '') + '" data-v="team" onclick="FFPResults.setMode(\'team\')">Team</button>' +
          '</div></div>' +
          '<div id="er-team-wrap" style="display:' + (F.mode === 'team' ? '' : 'none') + ';">' +
            '<div class="submit-score-row"><label class="submit-score-label">Team name</label><input type="text" id="er-team" class="submit-score-input" placeholder="e.g. Iron Crew" value="' + esc((r && r.team_name) || '') + '"></div>' +
            '<div class="submit-score-row"><label class="submit-score-label">Teammates (comma separated)</label><input type="text" id="er-mates" class="submit-score-input" placeholder="e.g. Sam, Lina, Omar" value="' + esc(teammates) + '"></div>' +
          '</div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Overall placing (optional)</label><div class="er-two">' +
            '<div><input type="number" inputmode="numeric" id="er-op" class="submit-score-input" placeholder="Position" value="' + esc((r && r.overall_place) || '') + '"></div>' +
            '<div><input type="number" inputmode="numeric" id="er-of" class="submit-score-input" placeholder="of (field)" value="' + esc((r && r.overall_field) || '') + '"></div></div></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Age group (optional)</label><input type="text" id="er-ag" class="submit-score-input" placeholder="e.g. M35-39" value="' + esc((r && r.age_group) || '') + '">' +
            '<div class="er-two" style="margin-top:8px;"><div><input type="number" inputmode="numeric" id="er-agp" class="submit-score-input" placeholder="AG position" value="' + esc((r && r.ag_place) || '') + '"></div>' +
            '<div><input type="number" inputmode="numeric" id="er-agf" class="submit-score-input" placeholder="of (AG field)" value="' + esc((r && r.ag_field) || '') + '"></div></div></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Location (optional)</label><input type="text" id="er-loc" class="submit-score-input" placeholder="e.g. Dubai, UAE" value="' + esc((r && r.location) || '') + '"></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Results link (optional)</label><input type="text" id="er-link" class="submit-score-input" placeholder="https://…" value="' + esc((r && r.link) || '') + '"></div>' +
        '</div>' +
        '<div class="dm-footer"><button class="btn-primary-yellow" onclick="FFPResults.save()">' + (r ? 'Save changes' : 'Add to my resume') + '</button>' +
          (r ? '<button class="er-del" onclick="FFPResults.del(\'' + attr(r.id) + '\')">Delete this result</button>' : '') + '</div>';
      openDetailModal(body);
    },
    save: async function () {
      var name = val('er-name'); if (!name) { toast('Add the event name'); return; }
      var me = memberId(); if (!me) { toast('Please sign in again'); return; }
      var mates = val('er-mates'); var matesArr = mates ? mates.split(',').map(function (x) { return { name: x.trim() }; }).filter(function (x) { return x.name; }) : [];
      var p = {
        event_name: name, event_type: F.type, event_date: F.dateIso || '', result_text: val('er-result'),
        is_team: (F.mode === 'team'), team_name: (F.mode === 'team') ? val('er-team') : '', teammates: (F.mode === 'team') ? matesArr : [],
        overall_place: val('er-op'), overall_field: val('er-of'), age_group: val('er-ag'), ag_place: val('er-agp'), ag_field: val('er-agf'),
        location: val('er-loc'), link: val('er-link'), photo_url: F.hero || ''
      };
      try {
        var r = await rpc('member_event_result_save', { p_me: me, p_id: F.editId || null, p: p });
        if (r.error) throw r.error;
        if (!r.data) { toast('Could not save'); return; }
        if (typeof closeDetailModal === 'function') closeDetailModal();
        toast(F.editId ? 'Result updated' : 'Added to your resume');
        F.editId = null; render();
      } catch (e) { console.error(e); toast(e.message || 'Save failed'); }
    },
    del: async function (id) {
      if (!window.confirm('Delete this result from your resume?')) return;
      var me = memberId(); if (!me) return;
      try {
        var r = await rpc('member_event_result_delete', { p_me: me, p_id: id });
        if (r.error) throw r.error;
        if (typeof closeDetailModal === 'function') closeDetailModal();
        toast('Result removed'); render();
      } catch (e) { console.error(e); toast(e.message || 'Delete failed'); }
    }
  };

  function init() {
    injectCss();
    var tries = 0;
    (function wait() { if (ensureTab()) return; if (tries++ < 40) setTimeout(wait, 300); })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

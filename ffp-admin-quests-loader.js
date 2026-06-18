/* ═══════════════════════════════════════════════════════════════
   FFP ADMIN QUESTS LOADER · v3 (2026-06-17) — REBUILD
   FFP quests are now POINT-scored MISSION CHECKLISTS with a leaderboard.
   This screen authors FFP (public, global) quests: details + a Missions builder
   (each mission has points, a proof type, a verifier, optional venue/GPS, and an
   auto-generated QR token), publish/pause/end, plus a Reviews queue to approve or
   reject member proof submissions (photo / partner-verified missions).
   Quest details still written directly to `quests` (admin is_admin() RLS); missions
   + reviews use SECURITY DEFINER RPCs (quest_save_task / quest_list_tasks /
   quest_delete_task / quest_pending_completions / quest_verify_completion).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var CATS = ['fitness', 'sports', 'wellness', 'recovery', 'adventure', 'food'];
  var PROOFS = [['auto', 'Auto (tracked)'], ['qr', 'Scan QR'], ['photo', 'Photo'], ['gps', 'GPS check-in'], ['photo_gps', 'Photo + GPS'], ['partner', 'Partner confirms'], ['referral', 'Bring a friend']];
  var VERIFIERS = [['auto', 'Auto'], ['partner', 'Partner'], ['admin', 'Admin']];

  function toast(m, k) { if (typeof window.showToast === 'function') { try { window.showToast(m, k || 'info'); return; } catch (e) {} } console.log('[FFP Admin Quests]', m); }
  function esc(s) { if (typeof window.escHtml === 'function') return window.escHtml(s); return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cap(s) { s = s || ''; return s.charAt(0).toUpperCase() + s.slice(1); }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function waitFor(check, ms) { return new Promise(function (resolve) { var t = 0, lim = Math.ceil((ms || 30000) / 150); var iv = setInterval(function () { if (check() || t++ >= lim) { clearInterval(iv); resolve(check()); } }, 150); }); }

  var S = { quests: [], providers: [], tab: 'live', editing: null, curQuest: null, taskEdit: null, reviews: [] };

  function injectStyles() {
    if (document.getElementById('ffp-admin-quests-css')) return;
    var css = document.createElement('style'); css.id = 'ffp-admin-quests-css';
    css.textContent = [
      '#panel-quests .aq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:18px;}',
      '#panel-quests .aq-card{background:#0f1e2e;border:1px solid #1a2f44;border-radius:14px;padding:16px;}',
      '#panel-quests .aq-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}',
      '#panel-quests .aq-title{font-size:15px;font-weight:800;color:#e8eef4;}',
      '#panel-quests .aq-meta{font-size:11px;color:#8a99a8;margin-top:3px;text-transform:capitalize;}',
      '#panel-quests .aq-pill{font-size:9px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:4px 9px;border-radius:5px;flex-shrink:0;}',
      '#panel-quests .aq-pill.live{background:#4ade80;color:#04210f;}#panel-quests .aq-pill.draft{background:rgba(255,204,0,.18);color:#FFCC00;}#panel-quests .aq-pill.ended{background:rgba(138,153,168,.18);color:#8a99a8;}',
      '#panel-quests .aq-reward{font-size:12px;color:#cfd6dc;margin:12px 0;display:flex;align-items:center;gap:6px;}#panel-quests .aq-reward .material-icons{font-size:16px;color:#b8965a;}',
      '#panel-quests .aq-foot{display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid #1a2f44;padding-top:12px;}',
      '.qf-row{margin-bottom:14px;}.qf-row label{display:block;font-size:11px;font-weight:700;color:#8a99a8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;}',
      '.qf-input,.qf-sel,.qf-area{width:100%;background:#08131f;border:1px solid #1a2f44;border-radius:9px;padding:11px 12px;color:#e8eef4;font-size:14px;font-family:inherit;box-sizing:border-box;}',
      '.qf-area{min-height:70px;resize:vertical;}.qf-two{display:flex;gap:12px;}.qf-two>div{flex:1;}',
      '.qt-card{display:flex;align-items:flex-start;gap:10px;background:#08131f;border:1px solid #1a2f44;border-radius:10px;padding:10px 12px;margin-bottom:8px;}',
      '.qt-card .qt-pts{font-weight:800;color:#FFCC00;font-size:13px;white-space:nowrap;}',
      '.qt-qr{font-family:monospace;font-size:11px;color:#2ba8e0;background:rgba(43,168,224,.1);padding:2px 6px;border-radius:5px;}'
    ].join('');
    document.head.appendChild(css);
  }

  function buildScaffold() {
    var panel = document.getElementById('panel-quests');
    if (!panel || panel.getAttribute('data-built')) return;
    panel.setAttribute('data-built', '1');
    panel.innerHTML =
      '<div class="panel-head"><h1>Quests</h1><div class="panel-head-actions">' +
        '<button class="btn btn-primary" onclick="AdminQuests.openForm()"><span class="material-icons">add</span>New FFP quest</button>' +
      '</div></div>' +
      '<div class="section"><div class="tabs" id="aq-tabs"></div><div class="aq-grid" id="aq-list"></div></div>';
  }

  async function fetchAll() {
    var q = await window.supabase.from('quests').select('*, quest_tasks(id)').order('created_at', { ascending: false });
    if (q.error) { console.error('[Admin Quests] quests:', q.error); }
    S.quests = q.data || [];
    var pr = await window.supabase.from('providers').select('id, business_name, status').order('business_name');
    S.providers = (pr.data || []).filter(function (p) { return p.status !== 'archived'; });
  }

  function renderTabs() {
    var el = document.getElementById('aq-tabs'); if (!el) return;
    var c = { live: 0, draft: 0, ended: 0 };
    S.quests.forEach(function (q) { if (c[q.status] != null) c[q.status]++; });
    el.innerHTML = ['live', 'draft', 'ended'].map(function (t) {
      return '<button class="tab-btn' + (S.tab === t ? ' active' : '') + '" onclick="AdminQuests.setTab(\'' + t + '\')">' + cap(t) + ' <span class="count">' + c[t] + '</span></button>';
    }).join('') + '<button class="tab-btn' + (S.tab === 'review' ? ' active' : '') + '" onclick="AdminQuests.setTab(\'review\')">Reviews</button>';
  }

  function renderList() {
    renderTabs();
    var el = document.getElementById('aq-list'); if (!el) return;
    if (S.tab === 'review') { renderReview(el); return; }
    var rows = S.quests.filter(function (q) { return q.status === S.tab; });
    if (!rows.length) { el.innerHTML = '<div style="color:#8a99a8;padding:24px;">No ' + S.tab + ' quests.</div>'; return; }
    el.innerHTML = rows.map(function (q) {
      var nTasks = (q.quest_tasks || []).length;
      var kind = q.owner_type === 'ffp' ? 'FFP' : q.owner_type === 'provider' ? 'Partner' : 'Member';
      var foot = '<button class="btn btn-sm btn-ghost" onclick="AdminQuests.openForm(\'' + q.id + '\')"><span class="material-icons">edit</span>Edit</button>';
      if (q.status === 'draft') foot += '<button class="btn btn-sm btn-blue" onclick="AdminQuests.setStatus(\'' + q.id + '\',\'live\')"><span class="material-icons">publish</span>Publish</button>';
      if (q.status === 'live') foot += '<button class="btn btn-sm btn-ghost" onclick="AdminQuests.setStatus(\'' + q.id + '\',\'draft\')"><span class="material-icons">pause</span>Unpublish</button>';
      if (q.status !== 'ended') foot += '<button class="btn btn-sm btn-ghost" onclick="AdminQuests.setStatus(\'' + q.id + '\',\'ended\')"><span class="material-icons">flag</span>End</button>';
      return '<div class="aq-card"><div class="aq-top"><div>' +
          '<div class="aq-title">' + esc(q.title) + '</div>' +
          '<div class="aq-meta">' + kind + ' · ' + esc(q.scope || '') + ' · ' + nTasks + ' task' + (nTasks === 1 ? '' : 's') + '</div>' +
        '</div><span class="aq-pill ' + q.status + '">' + q.status + '</span></div>' +
        '<div class="aq-reward"><span class="material-icons">military_tech</span> ' + (q.points_total || 0) + ' pts · ' + cap(q.leaderboard || 'none') + ' board</div>' +
        '<div class="aq-foot">' + foot + '</div></div>';
    }).join('');
  }

  // ── REVIEW QUEUE ──
  async function renderReview(el) {
    el.innerHTML = '<div style="color:#8a99a8;padding:20px;">Loading submissions…</div>';
    try { var r = await window.supabase.rpc('quest_pending_completions', { p_provider: null }); S.reviews = (r && r.data) ? r.data : []; }
    catch (e) { S.reviews = []; }
    if (!S.reviews.length) { el.innerHTML = '<div style="color:#8a99a8;padding:24px;">No submissions awaiting review.</div>'; return; }
    el.innerHTML = S.reviews.map(function (c) {
      var img = c.photo_proof ? '<div style="height:120px;border-radius:10px;background:#08131f center/cover no-repeat url(\'' + esc(c.photo_proof) + '\');margin:10px 0;"></div>' : '';
      return '<div class="aq-card"><div class="aq-title" style="font-size:14px;">' + esc(c.task_title) + '</div>' +
        '<div class="aq-meta">' + esc(c.quest_title) + ' · ' + esc(c.member_name || 'Member') + ' · +' + (c.points || 0) + ' pts</div>' + img +
        (c.note ? '<div style="font-size:12px;color:#cfd6dc;margin-bottom:8px;">“' + esc(c.note) + '”</div>' : '') +
        '<div class="aq-foot">' +
          '<button class="btn btn-sm btn-blue" onclick="AdminQuests.review(\'' + c.id + '\',\'approve\')"><span class="material-icons">check</span>Approve</button>' +
          '<button class="btn btn-sm btn-ghost" onclick="AdminQuests.review(\'' + c.id + '\',\'reject\')"><span class="material-icons">close</span>Reject</button>' +
        '</div></div>';
    }).join('');
  }
  async function review(id, decision) {
    try {
      var r = await window.supabase.rpc('quest_verify_completion', { p_id: id, p_decision: decision, p_by: 'FFP admin' });
      if (r && r.error) throw r.error;
      toast(decision === 'approve' ? 'Approved — points awarded' : 'Rejected', 'success');
      var el = document.getElementById('aq-list'); if (el) renderReview(el);
    } catch (e) { toast('Could not update', 'error'); }
  }

  // ── QUEST FORM (details) + MISSIONS builder — full-screen, taxonomy-driven ──
  function taxCountries() { var T = window.FFP_TAX || {}; return (T.cities && Object.keys(T.cities).length) ? Object.keys(T.cities).sort() : ['United Arab Emirates']; }
  function taxCities(country) { var T = window.FFP_TAX || {}; return (T.cities && T.cities[country]) ? T.cities[country] : []; }
  function taxCats() { return CATS; } // the 6 standard categories ARE the taxonomy (DB enforces these exact 6)

  function openForm(id) {
    var q = id ? S.quests.find(function (x) { return x.id === id; }) : null;
    S.editing = q || null; S.curQuest = q ? q.id : null; S.taskEdit = null;
    var cats = taxCats();
    var catOpts = cats.map(function (c) { return '<option value="' + esc(c) + '"' + (q && q.category === c ? ' selected' : '') + '>' + cap(c) + '</option>'; }).join('');
    var scopeOpts = ['city', 'country', 'global'].map(function (c) { return '<option value="' + c + '"' + (q && q.scope === c ? ' selected' : '') + '>' + cap(c) + '</option>'; }).join('');
    var lbOpts = [['global', 'Global + city/country'], ['quest', 'This quest only'], ['none', 'No leaderboard']].map(function (o) { return '<option value="' + o[0] + '"' + (q && q.leaderboard === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    var countries = taxCountries();
    var curCountry = q ? (q.country || '') : '';
    var countryOpts = '<option value="">— select —</option>' + countries.map(function (c) { return '<option value="' + esc(c) + '"' + (curCountry === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var cityList = taxCities(curCountry);
    var cityOpts = '<option value="">— select —</option>' + cityList.map(function (c) { return '<option value="' + esc(c) + '"' + (q && q.city === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var body =
      '<div class="qf-row"><label>Title</label><input class="qf-input" id="q-title" value="' + esc(q ? q.title : '') + '" placeholder="e.g. FFP World Streak"></div>' +
      '<div class="qf-row"><label>Description</label><textarea class="qf-area" id="q-desc" placeholder="What the member does">' + esc(q ? (q.description || '') : '') + '</textarea></div>' +
      '<div class="qf-row qf-two"><div><label>Category</label><select class="qf-sel" id="q-category">' + catOpts + '</select></div><div><label>Scope</label><select class="qf-sel" id="q-scope" onchange="AdminQuests.scopeChange()">' + scopeOpts + '</select></div></div>' +
      '<div class="qf-row qf-two" id="q-loc-row">' +
        '<div id="q-country-wrap"><label>Country</label><select class="qf-sel" id="q-country" onchange="AdminQuests.countryChange()">' + countryOpts + '</select></div>' +
        '<div id="q-city-wrap"><label>City</label><select class="qf-sel" id="q-city">' + cityOpts + '</select></div>' +
      '</div>' +
      '<div class="qf-row"><label>Leaderboard</label><select class="qf-sel" id="q-leaderboard">' + lbOpts + '</select></div>' +
      '<div class="qf-row"><label style="display:flex;align-items:center;gap:9px;cursor:pointer;text-transform:none;letter-spacing:0;font-size:13px;color:#cfd6dc;"><input type="checkbox" id="q-headline"' + (q && q.is_headline ? ' checked' : '') + '> <span><b>Headline quest</b> — featured big at the top of the member Passport (one at a time)</span></label></div>' +
      '<div class="qf-row"><label>Hero image</label>' +
        '<div id="q-hero-preview" onclick="document.getElementById(\'q-hero-file\').click()" style="height:300px;border-radius:12px;background-color:#0f2335;background-size:cover;background-position:center;background-repeat:no-repeat;border:2px dashed rgba(43,168,224,0.35);margin-bottom:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#8a99a8;font-size:13px;' + (q && q.hero_image_url ? "background-image:url('" + esc(q.hero_image_url) + "');border-style:solid;" : '') + '">' + (q && q.hero_image_url ? '' : '<span><span class="material-icons" style="vertical-align:-5px;">add_photo_alternate</span> Click to upload</span>') + '</div>' +
        '<input type="file" id="q-hero-file" accept="image/*" style="display:none" onchange="AdminQuests.uploadHero(this)">' +
        '<button type="button" class="btn btn-ghost" onclick="document.getElementById(\'q-hero-file\').click()"><span class="material-icons">upload</span> Upload image</button>' +
        '<input type="hidden" id="q-hero" value="' + esc(q ? (q.hero_image_url || '') : '') + '"></div>' +
      '<div id="q-missions-wrap" style="border-top:1px solid #1a2f44;padding-top:16px;margin-top:4px;">' +
        (q ? '<div style="font-size:14px;font-weight:800;color:#e8eef4;margin-bottom:10px;">Tasks <span style="font-weight:600;color:#8a99a8;font-size:12px;">· passport holders complete these for points</span></div><div id="q-task-list"></div>' + taskBuilderHtml()
           : '<div style="color:#8a99a8;font-size:13px;">Save the quest first, then add the tasks members complete.</div>') +
      '</div>';
    var foot = '<button class="btn btn-ghost" onclick="closeQuestModal()">Close</button>' +
      '<button class="btn btn-primary" onclick="AdminQuests.save()"><span class="material-icons">save</span>' + (q ? 'Save details' : 'Save & add tasks') + '</button>';
    openSheet(q ? 'Edit FFP quest' : 'New FFP quest', body, foot);
    scopeChange();
    if (q) renderTasks();
  }
  function scopeChange() {
    var s = val('q-scope');
    var cw = document.getElementById('q-country-wrap'), cityw = document.getElementById('q-city-wrap'), row = document.getElementById('q-loc-row');
    if (!row) return;
    if (s === 'global') { row.style.display = 'none'; }
    else { row.style.display = 'flex'; if (cw) cw.style.display = ''; if (cityw) cityw.style.display = (s === 'city') ? '' : 'none'; }
  }
  function countryChange() {
    var c = val('q-country'); var sel = document.getElementById('q-city'); if (!sel) return;
    var list = taxCities(c);
    sel.innerHTML = '<option value="">— select —</option>' + list.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
  }

  function taskBuilderHtml() {
    var proofOpts = PROOFS.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + '</option>'; }).join('');
    var verOpts = VERIFIERS.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + '</option>'; }).join('');
    var provOpts = '<option value="">— no specific venue —</option>' + S.providers.map(function (p) { return '<option value="' + p.id + '">' + esc(p.business_name) + '</option>'; }).join('');
    return '<div style="background:#0b1623;border:1px dashed #2a4a66;border-radius:10px;padding:12px;margin-top:10px;">' +
      '<div style="font-size:12px;font-weight:700;color:#cfd6dc;margin-bottom:8px;" id="qt-form-title">Add a task</div>' +
      '<div class="qf-row"><input class="qf-input" id="qt-title" placeholder="Task title — e.g. Scan our QR"></div>' +
      '<div class="qf-row"><input class="qf-input" id="qt-instr" placeholder="Instruction (optional)"></div>' +
      '<div class="qf-row qf-two"><div><label>Points</label><input class="qf-input" id="qt-points" type="number" min="0" value="5"></div>' +
        '<div><label>Proof</label><select class="qf-sel" id="qt-proof" onchange="AdminQuests.qtProofChange()">' + proofOpts + '</select></div></div>' +
      '<div class="qf-row qf-two"><div><label>Verified by</label><select class="qf-sel" id="qt-verifier">' + verOpts + '</select></div>' +
        '<div><label>Venue (optional)</label><select class="qf-sel" id="qt-provider">' + provOpts + '</select></div></div>' +
      '<div class="qf-row" id="qt-gps-row" style="display:none;"><label>GPS lat / lng / radius (m)</label><div class="qf-two" style="gap:8px;"><div><input class="qf-input" id="qt-lat" placeholder="lat"></div><div><input class="qf-input" id="qt-lng" placeholder="lng"></div><div><input class="qf-input" id="qt-radius" type="number" value="50"></div></div></div>' +
      '<div style="display:flex;gap:8px;"><button class="btn btn-sm btn-blue" id="qt-add-btn" onclick="AdminQuests.saveTask()"><span class="material-icons">add</span>Add task</button>' +
        '<button class="btn btn-sm btn-ghost" id="qt-cancel-btn" style="display:none;" onclick="AdminQuests.cancelTaskEdit()">Cancel edit</button></div>' +
      '</div>';
  }
  function qtProofChange() { var p = val('qt-proof'); var r = document.getElementById('qt-gps-row'); if (r) r.style.display = (p === 'gps' || p === 'photo_gps') ? 'block' : 'none'; }

  async function renderTasks() {
    var host = document.getElementById('q-task-list'); if (!host || !S.curQuest) return;
    var list = [];
    try { var r = await window.supabase.rpc('quest_list_tasks', { p_quest: S.curQuest }); list = (r && r.data) ? r.data : []; } catch (e) {}
    if (!list.length) { host.innerHTML = '<div style="color:#8a99a8;font-size:13px;margin-bottom:8px;">No tasks yet — add the first below.</div>'; return; }
    var pmap = {}; PROOFS.forEach(function (p) { pmap[p[0]] = p[1]; });
    host.innerHTML = list.map(function (t) {
      return '<div class="qt-card"><div style="flex:1;min-width:0;">' +
          '<div style="font-weight:700;color:#e8eef4;">' + esc(t.title) + '</div>' +
          '<div style="font-size:11px;color:#8a99a8;margin-top:2px;">' + esc(pmap[t.proof_type] || t.proof_type) + ' · ' + esc(t.verifier) + (t.qr_token ? ' · <span class="qt-qr">' + esc(t.qr_token) + '</span>' : '') + '</div>' +
        '</div><div class="qt-pts">+' + (t.points || 0) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;">' +
          '<button class="btn btn-sm btn-ghost" onclick="AdminQuests.editTask(\'' + t.id + '\')" style="padding:3px 7px;"><span class="material-icons" style="font-size:15px;">edit</span></button>' +
          '<button class="btn btn-sm btn-ghost" onclick="AdminQuests.deleteTask(\'' + t.id + '\')" style="padding:3px 7px;"><span class="material-icons" style="font-size:15px;">delete</span></button>' +
        '</div></div>';
    }).join('');
  }

  async function saveTask() {
    if (!S.curQuest) { toast('Save the quest first', 'error'); return; }
    var title = val('qt-title'); if (!title) { toast('Task needs a title', 'error'); return; }
    var p = {
      title: title, instruction: val('qt-instr') || null, points: parseInt(val('qt-points'), 10) || 0,
      proof_type: val('qt-proof') || 'auto', verifier: val('qt-verifier') || 'auto',
      provider_id: val('qt-provider') || null
    };
    var pt = p.proof_type;
    if (pt === 'gps' || pt === 'photo_gps') { p.lat = val('qt-lat') || null; p.lng = val('qt-lng') || null; p.radius_m = parseInt(val('qt-radius'), 10) || 50; }
    try {
      var r = await window.supabase.rpc('quest_save_task', { p_quest: S.curQuest, p_id: S.taskEdit, p: p });
      if (r && r.error) throw r.error;
      var d = (r && r.data) || {};
      toast(S.taskEdit ? 'Task updated' : 'Task added' + (d.qr_token ? ' · QR ' + d.qr_token : ''), 'success');
      cancelTaskEdit();
      await renderTasks();
      await fetchAll(); // refresh points_total in the list behind
    } catch (e) { toast('Could not save task', 'error'); }
  }
  async function editTask(id) {
    var r; try { r = await window.supabase.rpc('quest_list_tasks', { p_quest: S.curQuest }); } catch (e) { return; }
    var t = ((r && r.data) || []).find(function (x) { return x.id === id; }); if (!t) return;
    S.taskEdit = id;
    var set = function (i, v) { var e = document.getElementById(i); if (e) e.value = (v == null ? '' : v); };
    set('qt-title', t.title); set('qt-instr', t.instruction); set('qt-points', t.points);
    set('qt-proof', t.proof_type); set('qt-verifier', t.verifier); set('qt-provider', t.provider_id || '');
    set('qt-lat', t.lat); set('qt-lng', t.lng); set('qt-radius', t.radius_m || 50);
    qtProofChange();
    var ft = document.getElementById('qt-form-title'); if (ft) ft.textContent = 'Edit task';
    var ab = document.getElementById('qt-add-btn'); if (ab) ab.innerHTML = '<span class="material-icons">save</span>Update task';
    var cb = document.getElementById('qt-cancel-btn'); if (cb) cb.style.display = '';
  }
  function cancelTaskEdit() {
    S.taskEdit = null;
    ['qt-title', 'qt-instr', 'qt-lat', 'qt-lng'].forEach(function (i) { var e = document.getElementById(i); if (e) e.value = ''; });
    var pts = document.getElementById('qt-points'); if (pts) pts.value = '5';
    var pr = document.getElementById('qt-proof'); if (pr) pr.value = 'auto';
    var vr = document.getElementById('qt-verifier'); if (vr) vr.value = 'auto';
    var pv = document.getElementById('qt-provider'); if (pv) pv.value = '';
    qtProofChange();
    var ft = document.getElementById('qt-form-title'); if (ft) ft.textContent = 'Add a task';
    var ab = document.getElementById('qt-add-btn'); if (ab) ab.innerHTML = '<span class="material-icons">add</span>Add task';
    var cb = document.getElementById('qt-cancel-btn'); if (cb) cb.style.display = 'none';
  }
  async function deleteTask(id) {
    if (!window.confirm('Delete this task?')) return;
    try { var r = await window.supabase.rpc('quest_delete_task', { p_id: id }); if (r && r.error) throw r.error; await renderTasks(); await fetchAll(); }
    catch (e) { toast('Could not delete', 'error'); }
  }

  async function save() {
    try {
      var title = val('q-title'); if (!title) { toast('Title is required', 'error'); return; }
      var scope = val('q-scope'), country = val('q-country'), city = val('q-city');
      var payload = {
        title: title, description: val('q-desc') || null, category: val('q-category'), scope: scope,
        city: scope === 'city' ? (city || null) : null,
        country: (scope === 'city' || scope === 'country') ? (country || null) : null,
        leaderboard: val('q-leaderboard') || 'global', hero_image_url: val('q-hero') || null,
        is_headline: !!(document.getElementById('q-headline') && document.getElementById('q-headline').checked),
        updated_at: new Date().toISOString()
      };
      if (S.editing) {
        var up = await window.supabase.from('quests').update(payload).eq('id', S.editing.id);
        if (up.error) throw up.error;
        toast('Details saved', 'success');
        await fetchAll(); renderList();
      } else {
        payload.owner_type = 'ffp'; payload.visibility = 'public'; payload.reward_type = 'points';
        payload.eligibility = 'all'; payload.require_distinct_venues = false;
        payload.status = 'draft'; payload.active_from = new Date().toISOString(); payload.target_count = 1;
        var cr = await window.supabase.from('quests').insert(payload).select('*').single();
        if (cr.error) throw cr.error;
        S.editing = cr.data; S.curQuest = cr.data.id;
        toast('Quest created — now add its tasks', 'success');
        await fetchAll();
        openForm(cr.data.id); // reopen in edit mode → missions builder visible
      }
    } catch (e) { console.error('[Admin Quests] save:', e); toast(e.message || 'Save failed', 'error'); }
  }

  async function setStatus(id, status) {
    try {
      var patch = { status: status, updated_at: new Date().toISOString() };
      if (status === 'live') patch.active_from = new Date().toISOString();
      var res = await window.supabase.from('quests').update(patch).eq('id', id);
      if (res.error) throw res.error;
      toast(status === 'live' ? 'Quest is live' : status === 'draft' ? 'Unpublished' : 'Ended', 'success');
      await refresh();
    } catch (e) { toast(e.message || 'Update failed', 'error'); }
  }

  async function refresh() { await fetchAll(); renderList(); }

  function openSheet(title, content, footer) {
    closeQuestModal();
    var ov = document.createElement('div'); ov.id = 'ffp-quest-modal-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:#0a1722;z-index:100000;display:flex;flex-direction:column;';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #1a2f44;flex-shrink:0;">' +
        '<div style="color:#e8eef4;font-size:18px;font-weight:800;">' + esc(title) + '</div>' +
        '<button onclick="closeQuestModal()" style="background:transparent;border:none;color:#8a99a8;cursor:pointer;font-size:28px;line-height:1;">&times;</button></div>' +
      '<div style="flex:1;overflow-y:auto;padding:22px 20px;"><div style="max-width:680px;margin:0 auto;">' + content + '</div></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #1a2f44;flex-shrink:0;">' + footer + '</div>';
    document.body.appendChild(ov);
  }
  function openModal(title, content, footer) {
    closeQuestModal();
    var ov = document.createElement('div'); ov.id = 'ffp-quest-modal-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,8,20,0.75);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;';
    ov.innerHTML = '<div style="background:#0f1e2e;border:1px solid #1a2f44;border-radius:16px;width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #1a2f44;">' +
          '<div style="color:#e8eef4;font-size:16px;font-weight:700;">' + esc(title) + '</div>' +
          '<button onclick="closeQuestModal()" style="background:transparent;border:none;color:#8a99a8;cursor:pointer;font-size:24px;line-height:1;">&times;</button></div>' +
        '<div style="padding:20px;overflow-y:auto;flex:1;">' + content + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #1a2f44;">' + footer + '</div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) closeQuestModal(); });
    document.body.appendChild(ov);
  }
  window.closeQuestModal = function () { var o = document.getElementById('ffp-quest-modal-overlay'); if (o) o.remove(); };

  var HERO_BUCKET = 'quest-images';
  // Storage is uploaded DIRECTLY via native fetch (NOT window.supabase) so it bypasses the
  // ffp-api-integration global.fetch wrapper, which overrides Authorization with FFPAuth.getJwt()
  // — a stale/expired member JWT there was silently breaking admin uploads. Anon apikey has an
  // INSERT policy on quest-images (verified), so anon auth always works regardless of session state.
  var SB_URL = 'https://kxzyuofecmtymablnmak.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4enl1b2ZlY210eW1hYmxubWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDM1MTYsImV4cCI6MjA5NTAxOTUxNn0.cWn0x1AeD-x9C-HHf9MShXbFRWdkWi5RMgHLgWJwOuE';
  function compressImage(file, maxW, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image(); var url = URL.createObjectURL(file);
      img.onload = function () { var scale = Math.min(1, maxW / img.width); var w = Math.round(img.width * scale), h = Math.round(img.height * scale); var c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not process image')); }, 'image/jpeg', quality || 0.82); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
      img.src = url;
    });
  }
  async function uploadHero(input) {
    console.log('[Admin Quests] uploadHero fired');
    var file = input && input.files && input.files[0];
    if (!file) { console.warn('[Admin Quests] no file selected'); toast('No file selected', 'error'); return; }
    console.log('[Admin Quests] file:', file.name, file.type, file.size + ' bytes');
    // Upload the RAW file — NO canvas compression. compressImage()'s toBlob() callback can hang forever
    // on some images (large / HEIC / memory pressure), which leaves the upload stuck with no error. The
    // bucket accepts the raw file fine, so we skip that whole failure mode.
    var ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase();
    if (!/^(jpg|jpeg|png|webp|gif|heic|heif)$/.test(ext)) ext = 'jpg';
    var ct = file.type || 'image/jpeg';
    var path = 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    // Auth: use the signed-in admin's JWT (role=authenticated) — verified via DB probe that BOTH anon and
    // authenticated can insert into quest-images, and the live anon-only request was rejected by storage RLS
    // (403) for a role mismatch. The admin JWT is the same identity that loads all admin data + passes is_admin(),
    // and it's how every other bucket upload in the app authenticates. Fall back to the anon key if no JWT.
    var token = (window.FFPAuth && window.FFPAuth.getJwt && window.FFPAuth.getJwt()) || SB_ANON;
    console.log('[Admin Quests] auth token:', token === SB_ANON ? 'anon key' : 'admin JWT (' + token.slice(0, 12) + '…)');
    try {
      // Direct REST upload via NATIVE fetch (bypasses the SDK; full control + exact error surfacing).
      console.log('[Admin Quests] POST →', SB_URL + '/storage/v1/object/' + HERO_BUCKET + '/' + path);
      var resp = await window.fetch(SB_URL + '/storage/v1/object/' + HERO_BUCKET + '/' + path, {
        method: 'POST',
        headers: { 'apikey': SB_ANON, 'Authorization': 'Bearer ' + token, 'Content-Type': ct, 'x-upsert': 'true', 'cache-control': '3600' },
        body: file
      });
      console.log('[Admin Quests] upload response status:', resp && resp.status);
      if (!resp || !resp.ok) {
        var detail = ''; try { detail = await resp.text(); } catch (e) {}
        throw new Error('HTTP ' + (resp ? resp.status : '?') + (detail ? ' — ' + detail.slice(0, 200) : ''));
      }
      var publicUrl = SB_URL + '/storage/v1/object/public/' + HERO_BUCKET + '/' + path;
      var hid = document.getElementById('q-hero'); if (hid) hid.value = publicUrl;
      var pv = document.getElementById('q-hero-preview'); if (pv) { pv.style.backgroundImage = "url('" + publicUrl + "')"; pv.style.borderStyle = 'solid'; pv.innerHTML = ''; }
      console.log('[Admin Quests] upload OK →', publicUrl);
      toast('Image uploaded ✓', 'success');
    } catch (e) {
      console.error('[Admin Quests] upload error', e);
      toast('Upload failed: ' + ((e && e.message) || 'unknown — see console'), 'error');
    } finally { try { input.value = ''; } catch (e) {} }
  }

  window.AdminQuests = {
    openForm: openForm, save: save, setStatus: setStatus, refresh: refresh,
    setTab: function (t) { S.tab = t; renderList(); },
    uploadHero: uploadHero, qtProofChange: qtProofChange, scopeChange: scopeChange, countryChange: countryChange,
    saveTask: saveTask, editTask: editTask, cancelTaskEdit: cancelTaskEdit, deleteTask: deleteTask, review: review
  };

  async function init() {
    var ok = await waitFor(function () { return window.supabase && document.getElementById('panel-quests'); }, 30000);
    if (!ok) { console.warn('[FFP Admin Quests] supabase or panel not ready'); return; }
    await waitFor(function () { return !!window.FFP_ADMIN; }, 30000);
    if (window.App && window.App.panelNames) window.App.panelNames['panel-quests'] = 'Quests';
    injectStyles(); buildScaffold();
    try { await refresh(); console.log('[FFP Admin Quests v3] Loaded ✓'); } catch (e) { console.error('[FFP Admin Quests] initial load:', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

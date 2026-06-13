// ════════════════════════════════════════════════════════════════════════
// FFP Partner Portal — SESSIONS module (was "Scheduling") — v10 (2026-06-13)
// v10: TIMETABLE gains "Add session" (openAddSession) — pick a class + weekly-recurring (provider_add_template_slot)
//      OR a one-off date (provider_add_oneoff_session, tz via FFPTime). Each timetable thumb shows a present/capacity
//      badge (provider_attendance_counts). Attendance tab retired from the dashboard (check-in lives in Check-ins).
// v9: FEATURE button re-pointed to the CLASS (session_templates.featured) — featuring a class features it on the
//     homepage (not a single occurrence). Button shown on each class card.
// v8: REBUILD to match how facilities work. A facility defines a CLASS (template) once, lays out its WEEKLY
//     SCHEDULE (day + time + coach per slot), which generates the recurring session occurrences. Each occurrence
//     can be managed individually: substitute the coach, change capacity, or cancel that single date.
//     Class form has: title, activity (taxonomy picker), DESCRIPTION, capacity, price/session, duration, photo,
//     level + the weekly schedule rows (coach per slot, from the provider's staff). DB engine:
//     provider_save_session_template / provider_list_session_templates / provider_delete_session_template /
//     provider_cancel_session (+ provider_save_session for per-occurrence coach/capacity). Timetable shows the
//     weekly pattern (dedup by slot); tapping a slot manages that occurrence. Attendance + coach-bio unchanged.
// ════════════════════════════════════════════════════════════════════════
var _schedTemplates = [];   // class templates (the list)
var _schedSessions = [];    // generated occurrences (for timetable + attendance)
var _schedAttCounts = {};   // session_id -> present count (timetable badge)
var _coachBios = {};        // coach full_name -> { bio, role, photo }
var _schedStaff = [];       // provider's staff (for coach dropdowns)

function _schedProvId() {
  return (window.FFP_PROVIDER && window.FFP_PROVIDER.id) ||
         (typeof providerProfile !== 'undefined' && providerProfile.id) || null;
}
var DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function _loadSchedStaff() {
  var pid = _schedProvId(); if (!pid) return;
  try {
    var sr = await window.supabase.rpc('provider_list_staff', { p_provider: pid });
    _schedStaff = (sr && sr.data) ? sr.data : [];
    _coachBios = {};
    _schedStaff.forEach(function (c) { var nm = c.full_name || ''; if (nm) _coachBios[nm] = { bio: c.bio || '', role: c.role || '', photo: c.photo_url || '' }; });
  } catch (e) {}
}
function _coachOpts(selected) {
  return '<option value="">' + (_schedStaff.length ? 'Coach…' : 'No staff yet') + '</option>' +
    _schedStaff.map(function (c) { var nm = c.full_name || ''; return '<option value="' + escHtml(nm) + '"' + (selected === nm ? ' selected' : '') + '>' + escHtml(nm) + (c.role ? ' · ' + escHtml(c.role) : '') + '</option>'; }).join('');
}

// ── LIST: one card per class (template) ──
async function renderScheduling() {
  var host = document.getElementById('sched-list');
  if (!host) return;
  var pid = _schedProvId();
  if (!pid) { host.innerHTML = '<div class="empty-sub" style="text-align:left;">Sign in to manage classes.</div>'; return; }
  host.innerHTML = '<div class="psub" style="margin:10px 0;">Loading…</div>';
  await _loadSchedStaff();
  try {
    var r = await window.supabase.rpc('provider_list_session_templates', { p_provider: pid });
    _schedTemplates = (r && r.data) ? r.data : [];
  } catch (e) { _schedTemplates = []; }
  try {
    var ro = await window.supabase.rpc('provider_list_sessions', { p_provider: pid });
    _schedSessions = (ro && ro.data) ? ro.data : [];
  } catch (e) { _schedSessions = []; }
  if (!_schedTemplates.length) {
    host.innerHTML = emptyState('No classes yet', 'Create a class, set its weekly times, and assign a coach. Members will be able to book it.', 'New class', 'openTemplateModal()');
    return;
  }
  host.innerHTML = _schedTemplates.map(templateCard).join('');
}

function templateCard(t) {
  var slots = (t.slots || []).map(function (sl) {
    var tm = (sl.slot_time || '').slice(0, 5);
    return DOW_SHORT[sl.day_of_week] + ' ' + tm + (sl.coach ? ' · ' + escHtml(sl.coach) : '');
  });
  var meta = [];
  if (t.capacity) meta.push(t.capacity + ' spots');
  if (t.duration_min) meta.push(t.duration_min + ' min');
  if (t.price_aed != null && Number(t.price_aed) > 0) meta.push('AED ' + t.price_aed);
  if (t.fitness_level) meta.push(escHtml(t.fitness_level));
  return '<div style="background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:12px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
      '<div style="display:flex;gap:11px;min-width:0;align-items:flex-start;">' +
        (t.hero_image_url ? '<div style="width:46px;height:46px;border-radius:8px;flex:0 0 auto;background:#0a1825 url(\'' + escHtml(t.hero_image_url) + '\') center/cover no-repeat;"></div>' : '') +
        '<div style="min-width:0;">' +
          '<div style="font-weight:800;color:var(--ffp-text,#eaf2f8);">' + escHtml(t.title || 'Untitled class') + (t.activity ? ' <span class="psub" style="font-weight:600;">· ' + escHtml(t.activity) + '</span>' : '') + '</div>' +
          '<div class="psub" style="margin:3px 0 0;">' + (slots.length ? slots.join('  ·  ') : '<span style="color:#FFCC00;">No weekly times yet — edit to add</span>') + '</div>' +
          (meta.length ? '<div class="psub" style="margin:3px 0 0;">' + meta.join(' · ') + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex-shrink:0;">' +
        (typeof window.featureBtn === 'function' ? window.featureBtn('session', t.id, t.featured) : '') +
        '<div style="display:flex;gap:6px;">' +
          '<button class="btn btn-sec btn-sm" onclick="openTemplateModal(\'' + t.id + '\')"><span class="ms">edit</span></button>' +
          '<button class="btn btn-ghost btn-sm" onclick="confirmDeleteTemplate(\'' + t.id + '\')"><span class="ms">delete</span></button>' +
        '</div>' +
      '</div>' +
  '</div>';
}

// ── TIMETABLE: weekly pattern (one card per slot), tap to manage that occurrence ──
function _weeklyPattern(list) {
  // Dedup occurrences to one per recurring slot (slot_id) — else legacy series_id — else the row itself.
  var seen = {}, out = [];
  (list || []).forEach(function (s) {
    if (s.status === 'cancelled') return;
    var key = s.slot_id || s.series_id || s.id;
    if (seen[key]) { if (new Date(s.start_at) < new Date(seen[key].start_at)) seen[key] = s; return; }
    seen[key] = s;
  });
  Object.keys(seen).forEach(function (k) { out.push(seen[k]); });
  return out;
}

function renderTimetable() {
  var host = document.getElementById('timetable-host');
  if (!host) return;
  var pid = _schedProvId();
  var go = function () {
    var sessions = _weeklyPattern(_schedSessions);
    if (!sessions.length) { host.innerHTML = '<div class="psub" style="margin:10px 0;">No classes scheduled yet — add one in the Sessions tab.</div>'; return; }
    var days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    var byDay = [[], [], [], [], [], [], []];
    sessions.forEach(function (s) { var d = new Date(s.start_at); var dow = (d.getDay() + 6) % 7; byDay[dow].push(s); });
    byDay.forEach(function (arr) { arr.sort(function (a, b) { var da = new Date(a.start_at), db = new Date(b.start_at); return (da.getHours() * 60 + da.getMinutes()) - (db.getHours() * 60 + db.getMinutes()); }); });
    var html = '<div style="display:grid;grid-template-columns:repeat(7,minmax(118px,1fr));gap:8px;overflow-x:auto;padding-bottom:6px;">';
    days.forEach(function (day, i) {
      html += '<div style="min-width:118px;">' +
        '<div style="font-weight:800;color:var(--ffp-text,#eaf2f8);font-size:12px;margin-bottom:6px;text-align:center;text-transform:uppercase;letter-spacing:.04em;">' + day.slice(0, 3) + '</div>';
      if (!byDay[i].length) html += '<div class="psub" style="text-align:center;font-size:11px;opacity:.45;margin-top:4px;">—</div>';
      byDay[i].forEach(function (s) {
        var d = new Date(s.start_at); var t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        var present = _schedAttCounts[s.id] || 0;
        var cap = (s.capacity != null && s.capacity !== '') ? s.capacity : null;
        var badge = '<span style="float:right;font-size:11px;font-weight:800;color:' + (cap && present >= cap ? '#ff7a7a' : '#6fc6ef') + ';">' + present + (cap != null ? '/' + cap : '') + '</span>';
        html += '<div onclick="openOccurrence(\'' + s.id + '\')" title="' + present + (cap != null ? ' of ' + cap : '') + ' attending" style="cursor:pointer;background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-left:3px solid #2ba8e0;border-radius:8px;padding:7px 8px;margin-bottom:6px;">' +
          '<div style="font-weight:700;font-size:12px;color:var(--ffp-text,#eaf2f8);">' + escHtml(t) + badge + '</div>' +
          '<div style="font-size:12px;color:#cfd6dc;line-height:1.25;">' + escHtml(s.title) + '</div>' +
          (s.coach ? '<div class="psub" style="margin:2px 0 0;font-size:11px;">' + escHtml(s.coach) + '</div>' : '') +
        '</div>';
      });
      html += '</div>';
    });
    html += '</div>';
    host.innerHTML = html;
  };
  if (!pid) { go(); return; }
  host.innerHTML = '<div class="psub" style="margin:10px 0;">Loading…</div>';
  var loadCounts = window.supabase.rpc('provider_attendance_counts', { p_provider: pid })
    .then(function (rc) { _schedAttCounts = (rc && rc.data) ? rc.data : {}; }).catch(function () { _schedAttCounts = {}; });
  var loadSessions = _schedSessions.length
    ? Promise.resolve()
    : window.supabase.rpc('provider_list_sessions', { p_provider: pid }).then(function (r) { _schedSessions = (r && r.data) ? r.data : []; }).catch(function () { _schedSessions = []; });
  Promise.all([loadCounts, loadSessions]).then(go);
}

// ── ADD SESSION (from Timetable): pick a class, then weekly-recurring OR a one-off date ──
async function openAddSession() {
  var pid = _schedProvId(); if (!pid) return;
  if (!_schedTemplates.length) {
    try { var r = await window.supabase.rpc('provider_list_session_templates', { p_provider: pid }); _schedTemplates = (r && r.data) ? r.data : []; } catch (e) {}
    await _loadSchedStaff();
  }
  if (!_schedTemplates.length) {
    openModalShell('', 'Create a class first',
      '<div class="psub" style="margin:6px 0;">Add a session to the timetable by first creating a class in the Sessions tab, then place it on a day &amp; time here.</div>',
      '<button class="btn btn-ghost" onclick="closeModal()">Close</button>');
    return;
  }
  var clsOpts = '<option value="">Choose a class…</option>' + _schedTemplates.map(function (t) {
    return '<option value="' + t.id + '">' + escHtml(t.title || 'Class') + '</option>'; }).join('');
  var dayOpts = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function (d, i) {
    return '<option value="' + i + '"' + (i === 1 ? ' selected' : '') + '>' + d + '</option>'; }).join('');
  openModalShell('lg', 'Add session to timetable',
    '<div class="form-section"><div class="form-grid">' +
      '<div class="field full"><div class="label">Class</div><select class="select" id="as-template">' + clsOpts + '</select></div>' +
      '<div class="field full"><div class="label">When</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button type="button" class="btn btn-sec btn-sm as-mode" data-mode="weekly" onclick="_asSetMode(\'weekly\')" style="flex:1;">Repeats weekly</button>' +
          '<button type="button" class="btn btn-ghost btn-sm as-mode" data-mode="once" onclick="_asSetMode(\'once\')" style="flex:1;">One-off date</button>' +
        '</div></div>' +
      '<div class="field as-weekly"><div class="label">Day</div><select class="select" id="as-weekday">' + dayOpts + '</select></div>' +
      '<div class="field as-weekly"><div class="label">Time</div><input class="input" type="time" id="as-time" value="18:00" style="color-scheme:dark;"></div>' +
      '<div class="field full as-once" style="display:none;"><div class="label">Date &amp; time</div><input class="input" type="datetime-local" id="as-datetime" style="color-scheme:dark;"></div>' +
      '<div class="field full"><div class="label">Coach <span style="color:var(--ffp-text-dim,#8a99a8);">(optional)</span></div><select class="select" id="as-coach">' + _coachOpts('') + '</select></div>' +
    '</div></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-pri" onclick="saveAddSession()">Add to timetable</button>');
  _asSetMode('weekly');
}
function _asSetMode(mode) {
  window._asMode = mode;
  document.querySelectorAll('.as-mode').forEach(function (b) {
    var on = b.dataset.mode === mode;
    b.classList.toggle('btn-sec', on); b.classList.toggle('btn-ghost', !on);
  });
  document.querySelectorAll('.as-weekly').forEach(function (e) { e.style.display = mode === 'weekly' ? '' : 'none'; });
  document.querySelectorAll('.as-once').forEach(function (e) { e.style.display = mode === 'once' ? '' : 'none'; });
}
async function saveAddSession() {
  var pid = _schedProvId(); if (!pid) return;
  var tpl = (document.getElementById('as-template') || {}).value || '';
  if (!tpl) { showToast('Choose a class', 'error'); return; }
  var coach = (document.getElementById('as-coach') || {}).value || '';
  var mode = window._asMode || 'weekly';
  try {
    if (mode === 'weekly') {
      var time = (document.getElementById('as-time') || {}).value || '';
      if (!time) { showToast('Pick a time', 'error'); return; }
      var wd = (document.getElementById('as-weekday') || {}).value || '1';
      var r = await window.supabase.rpc('provider_add_template_slot', { p_provider: pid, p_template: tpl, p: { day_of_week: wd, slot_time: time, coach: coach } });
      if (r && r.error) throw r.error;
    } else {
      var dt = (document.getElementById('as-datetime') || {}).value || '';
      if (!dt) { showToast('Pick a date & time', 'error'); return; }
      var startIso = window.FFPTime ? window.FFPTime.toUTC(dt) : new Date(dt).toISOString();
      var r2 = await window.supabase.rpc('provider_add_oneoff_session', { p_provider: pid, p_template: tpl, p: { start_at: startIso, coach: coach } });
      if (r2 && r2.error) throw r2.error;
    }
    showToast('Session added', 'success');
    closeModal();
    _schedSessions = [];               // force refresh of occurrences
    renderTimetable();
    if (typeof renderScheduling === 'function') renderScheduling();
  } catch (e) { console.error('[FFP Sched] add session', e); showToast('Could not add session', 'error'); }
}

// Coach bio popup — the short bio captured on the staff record (people book for the coach).
function showCoachBio(enc) {
  var name = ''; try { name = decodeURIComponent(enc); } catch (e) { name = enc; }
  var c = _coachBios[name] || {};
  var avatar = c.photo
    ? '<div style="width:64px;height:64px;border-radius:50%;flex:0 0 auto;background:url(\'' + escHtml(c.photo) + '\') center/cover no-repeat;border:1px solid var(--ffp-border,#1d3346);"></div>'
    : '<div style="width:64px;height:64px;border-radius:50%;flex:0 0 auto;background:rgba(43,168,224,.16);color:#6fc6ef;display:flex;align-items:center;justify-content:center;"><span class="ms" style="font-size:30px;">person</span></div>';
  var body = '<div style="display:flex;gap:14px;align-items:flex-start;">' + avatar +
      '<div style="min-width:0;display:flex;flex-direction:column;gap:6px;">' +
        '<div style="font-weight:800;font-size:16px;color:var(--ffp-text,#eaf2f8);">' + escHtml(name) +
          (c.role ? ' <span class="psub" style="font-weight:600;">· ' + escHtml(c.role) + '</span>' : '') + '</div>' +
        '<div class="psub" style="margin:0;line-height:1.55;">' + (c.bio ? escHtml(c.bio) : 'No bio added yet — add one for this coach in the Staff tab.') + '</div>' +
      '</div>' +
    '</div>';
  openModalShell('', name || 'Coach', body, '<button class="btn btn-pri" onclick="closeModal()">Close</button>');
}

// ── CREATE / EDIT a class (template) + its weekly schedule ──
function openTemplateModal(id) {
  var t = (id && _schedTemplates.length) ? _schedTemplates.find(function (x) { return x.id === id; }) : null;
  var e = t || { title: '', activity: '', description: '', capacity: '', price_aed: '', duration_min: 60, hero_image_url: '', fitness_level: '', slots: [] };
  var levels = (window.FFP_TAX && window.FFP_TAX.attendeeLevels && window.FFP_TAX.attendeeLevels.length) ? window.FFP_TAX.attendeeLevels : ['All Levels', 'Not Tried', 'Social', 'Competitive', 'Representative', 'Professional'];
  var levelOpts = levels.map(function (l) { return '<option' + ((e.fitness_level || 'All Levels') === l ? ' selected' : '') + '>' + escHtml(l) + '</option>'; }).join('');

  openModalShell('lg', (t ? 'Edit class' : 'New class'), `
    <div class="form-section">
      <div class="form-section-title">Photo</div>
      <div id="listing-photo-slot" data-url="${escHtml(e.hero_image_url || '')}"></div>
    </div>
    <div class="form-section">
      <div class="form-section-title">The class</div>
      <div class="form-grid">
        <div class="field full"><div class="label">Class name <span class="req">*</span></div><input class="input" id="tpl-title" value="${escHtml(e.title || '')}" placeholder="e.g. Sunrise Yoga"></div>
        <div class="field"><div class="label">Activity <span class="req">*</span></div>
          <button type="button" class="ffp-picker-btn placeholder" id="tpl-activity-btn" data-value=""><span>Choose activity…</span><span class="ms caret">expand_more</span></button></div>
        <div class="field"><div class="label">Fitness level</div><select class="select" id="tpl-level">${levelOpts}</select></div>
        <div class="field full"><div class="label">Session description <span class="label-hint">— what the session includes, so members know what to expect</span></div><textarea class="textarea" id="tpl-description" rows="3" placeholder="e.g. A 60-min vinyasa flow for all levels — mats provided, bring water. Suitable for beginners.">${escHtml(e.description || '')}</textarea></div>
        <div class="field"><div class="label">Capacity <span class="req">*</span></div><input class="input" type="number" min="1" step="1" id="tpl-capacity" value="${escHtml(String(e.capacity || ''))}" placeholder="e.g. 12"></div>
        <div class="field"><div class="label">Duration (min)</div><input class="input" type="number" min="1" id="tpl-duration" value="${escHtml(String(e.duration_min || ''))}" placeholder="60"></div>
        <div class="field"><div class="label">Price per person <span class="label-hint">— per session (AED, 0 = free)</span></div><input class="input" type="number" min="0" id="tpl-price" value="${escHtml(String(e.price_aed || ''))}" placeholder="0 = Free"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Weekly schedule</div>
      <div class="psub" style="margin:-4px 0 10px;">Set the day, time and coach for each time this class runs in the week. (Members book a specific date; you can swap the coach or cancel a single date afterwards.)</div>
      <div id="tpl-slots"></div>
      <button type="button" class="btn btn-ghost btn-sm" id="tpl-add-slot" style="margin-top:4px;"><span class="ms">add</span> Add a time</button>
    </div>
  `, `
    ${t ? '<button class="btn btn-ghost left" onclick="confirmDeleteTemplate(\'' + t.id + '\')"><span class="ms">delete</span> Delete</button>' : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-pri" onclick="saveTemplate('${t ? t.id : ''}')">${t ? 'Save changes' : 'Create class'}</button>
  `);

  setTimeout(function () {
    if (typeof window.renderListingUploader === 'function') { try { window.renderListingUploader(e.hero_image_url || ''); } catch (er) {} }
    // Activity picker
    var aBtn = document.getElementById('tpl-activity-btn');
    var setA = function (name) {
      if (!aBtn) return; aBtn.dataset.value = name || '';
      if (name) { aBtn.classList.remove('placeholder'); aBtn.innerHTML = '<span>' + escHtml(name) + '</span><span class="ms caret">expand_more</span>'; }
      else { aBtn.classList.add('placeholder'); aBtn.innerHTML = '<span>Choose activity…</span><span class="ms caret">expand_more</span>'; }
    };
    if (e.activity) setA(e.activity);
    if (aBtn) aBtn.addEventListener('click', function () {
      if (window.FFPPicker && window.FFPPicker.openActivity) { window.FFPPicker.openActivity(aBtn.dataset.value, function (name) { setA(name); }); }
      else { showToast('Activity picker not ready', 'error'); }
    });
    // Weekly slot rows
    var addBtn = document.getElementById('tpl-add-slot');
    if (addBtn) addBtn.onclick = function () { _tplAddSlotRow('', '', ''); };
    var existing = (e.slots || []);
    if (existing.length) existing.forEach(function (sl) { _tplAddSlotRow(sl.day_of_week, (sl.slot_time || '').slice(0, 5), sl.coach || ''); });
    else _tplAddSlotRow('', '', '');
  }, 50);
}

// Add one weekly-schedule row (Day + Time + Coach).
function _tplAddSlotRow(dow, time, coach) {
  var wrap = document.getElementById('tpl-slots'); if (!wrap) return;
  var dayOpts = [['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'], ['4', 'Thursday'], ['5', 'Friday'], ['6', 'Saturday'], ['0', 'Sunday']]
    .map(function (d) { return '<option value="' + d[0] + '"' + (String(dow) === d[0] ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('');
  var row = document.createElement('div');
  row.className = 'tpl-slot-row';
  row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';
  row.innerHTML =
    '<select class="select tpl-slot-day" style="flex:1.1;"><option value="">Day…</option>' + dayOpts + '</select>' +
    '<input class="input tpl-slot-time" type="time" value="' + escHtml(time || '') + '" style="flex:1;color-scheme:dark;">' +
    '<select class="select tpl-slot-coach" style="flex:1.3;">' + _coachOpts(coach) + '</select>' +
    '<button type="button" class="btn btn-ghost btn-sm" title="Remove" onclick="this.closest(\'.tpl-slot-row\').remove()"><span class="ms">close</span></button>';
  wrap.appendChild(row);
  if (coach) { var cs = row.querySelector('.tpl-slot-coach'); if (cs) cs.value = coach; }
}

async function saveTemplate(id) {
  var g = function (i) { var el = document.getElementById('tpl-' + i); return el ? (el.value || '').trim() : ''; };
  var title = g('title');
  var aBtn = document.getElementById('tpl-activity-btn'); var activity = aBtn ? (aBtn.dataset.value || '') : '';
  if (!title) { showToast('Class name is required', 'error'); return; }
  if (!activity) { showToast('Activity is required', 'error'); return; }
  var capRaw = g('capacity'); var capacity = capRaw ? parseInt(capRaw, 10) : null;
  if (capacity != null && (isNaN(capacity) || capacity < 1)) { showToast('Capacity must be at least 1', 'error'); return; }
  var slots = [];
  Array.prototype.forEach.call(document.querySelectorAll('#tpl-slots .tpl-slot-row'), function (row) {
    var dow = row.querySelector('.tpl-slot-day').value;
    var tm = row.querySelector('.tpl-slot-time').value;
    var co = row.querySelector('.tpl-slot-coach').value;
    if (dow !== '' && tm) slots.push({ day_of_week: parseInt(dow, 10), slot_time: tm, coach: co || null });
  });
  if (!slots.length) { showToast('Add at least one weekly time', 'error'); return; }
  var pid = _schedProvId(); if (!pid) { showToast('Not signed in', 'error'); return; }
  var photoSlot = document.getElementById('listing-photo-slot');
  var heroUrl = (photoSlot && photoSlot.dataset.url) ? photoSlot.dataset.url : null; if (heroUrl === '') heroUrl = null;
  var payload = {
    title: title, activity: activity, description: g('description') || null,
    capacity: (capacity != null ? String(capacity) : ''), price_aed: g('price'), duration_min: g('duration'),
    hero_image_url: heroUrl, fitness_level: g('level') || null, slots: slots
  };
  try {
    var r = await window.supabase.rpc('provider_save_session_template', { p_provider: pid, p_id: id || null, p: payload });
    if (r && r.error) throw r.error;
    showToast(id ? 'Class updated — weekly schedule regenerated' : 'Class created — weekly sessions added', 'success');
    closeModal();
    renderScheduling();
  } catch (e) { console.error('[FFP Sessions] saveTemplate', e); showToast('Could not save class', 'error'); }
}

function confirmDeleteTemplate(id) {
  openModalShell('', 'Delete this class?', '<div class="psub" style="margin:6px 0;">This removes the class and its upcoming sessions from your schedule.</div>', '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doDeleteTemplate(\'' + id + '\')">Delete</button>');
}
async function doDeleteTemplate(id) {
  var pid = _schedProvId();
  try {
    var r = await window.supabase.rpc('provider_delete_session_template', { p_provider: pid, p_id: id });
    if (r && r.error) throw r.error;
    showToast('Class deleted', 'success');
  } catch (e) { showToast('Could not delete', 'error'); }
  closeModal();
  renderScheduling();
}

// ── Manage a SINGLE occurrence (one date): substitute coach, change capacity, or cancel ──
async function openOccurrence(id) {
  var pid = _schedProvId();
  if (!_schedStaff.length) await _loadSchedStaff();
  var s = (_schedSessions || []).find(function (x) { return x.id === id; }) || {};
  var d = new Date(s.start_at);
  var when = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  var body =
    '<div class="psub" style="margin:0 0 12px;"><b style="color:var(--ffp-text,#eaf2f8);">' + escHtml(s.title || 'Session') + '</b> — ' + when + '. Changes here apply to <b>this date only</b>.</div>' +
    '<div class="form-grid">' +
      '<div class="field"><div class="label">Coach <span class="label-hint">— substitute / cover</span></div><select class="select" id="occ-coach">' + _coachOpts(s.coach || '') + '</select></div>' +
      '<div class="field"><div class="label">Capacity</div><input class="input" type="number" min="1" id="occ-capacity" value="' + escHtml(String(s.capacity || '')) + '"></div>' +
    '</div>';
  var foot =
    '<button class="btn btn-ghost left" style="color:#ff6b6b;" onclick="cancelOccurrence(\'' + id + '\')"><span class="ms">event_busy</span> Cancel this session</button>' +
    '<button class="btn btn-ghost" onclick="closeModal()">Close</button>' +
    '<button class="btn btn-pri" onclick="saveOccurrence(\'' + id + '\')">Save changes</button>';
  openModalShell('', 'Manage session', body, foot);
}
async function saveOccurrence(id) {
  var pid = _schedProvId();
  var coach = (document.getElementById('occ-coach') || {}).value || '';
  var capRaw = (document.getElementById('occ-capacity') || {}).value || '';
  var capacity = capRaw ? parseInt(capRaw, 10) : null;
  if (capacity != null && (isNaN(capacity) || capacity < 1)) { showToast('Capacity must be at least 1', 'error'); return; }
  try {
    var r = await window.supabase.rpc('provider_save_session', { p_provider: pid, p_id: id, p: { coach: coach, capacity: (capacity != null ? String(capacity) : '') } });
    if (r && r.error) throw r.error;
    showToast('Session updated (this date)', 'success');
    closeModal();
    var ro = await window.supabase.rpc('provider_list_sessions', { p_provider: pid }); _schedSessions = (ro && ro.data) ? ro.data : [];
    renderTimetable();
  } catch (e) { showToast('Could not update', 'error'); }
}
async function cancelOccurrence(id) {
  var pid = _schedProvId();
  try {
    var r = await window.supabase.rpc('provider_cancel_session', { p_provider: pid, p_id: id });
    if (r && r.error) throw r.error;
    showToast('Session cancelled (this date)', 'success');
    closeModal();
    var ro = await window.supabase.rpc('provider_list_sessions', { p_provider: pid }); _schedSessions = (ro && ro.data) ? ro.data : [];
    renderTimetable();
  } catch (e) { showToast('Could not cancel', 'error'); }
}

// ════════════════════════════════════════════════════════════════════════
// ATTENDANCE (manual register) — Scheduling → Attendance tab.
// provider_session_attendance / provider_save_attendance / provider_attendance_counts.
// ════════════════════════════════════════════════════════════════════════
var _attCounts = {};
var _register = {};
var _regSession = null;

async function renderAttendance() {
  var host = document.getElementById('att-list');
  if (!host) return;
  var pid = _schedProvId();
  if (!pid) { host.innerHTML = '<div class="empty-sub" style="text-align:left;">Sign in to take attendance.</div>'; return; }
  host.innerHTML = '<div class="psub" style="margin:10px 0;">Loading…</div>';
  try {
    var rs = await window.supabase.rpc('provider_list_sessions', { p_provider: pid });
    _schedSessions = (rs && rs.data) ? rs.data : [];
    var rc = await window.supabase.rpc('provider_attendance_counts', { p_provider: pid });
    _attCounts = (rc && rc.data) ? rc.data : {};
  } catch (e) { _schedSessions = _schedSessions || []; _attCounts = {}; }
  if (!_schedSessions.length) {
    host.innerHTML = emptyState('No sessions yet', 'Create classes in the Sessions tab first, then take attendance here.', '', '');
    return;
  }
  host.innerHTML = _schedSessions.filter(function (s) { return s.status !== 'cancelled'; }).map(attRow).join('');
}

function attRow(s) {
  var d = new Date(s.start_at);
  var when = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' +
             d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  var present = _attCounts[s.id] || 0;
  var taken = present > 0;
  return '<div style="background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:11px 13px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
      '<div style="min-width:0;">' +
        '<div style="font-weight:800;color:var(--ffp-text,#eaf2f8);">' + escHtml(s.title) + '</div>' +
        '<div class="psub" style="margin:2px 0 0;">' + when + (taken ? ' · ' + present + ' present' : '') + '</div>' +
      '</div>' +
      '<button class="btn ' + (taken ? 'btn-sec' : 'btn-pri') + ' btn-sm" onclick="openRegister(\'' + s.id + '\')"><span class="ms">how_to_reg</span> ' + (taken ? 'Edit' : 'Register') + '</button>' +
  '</div>';
}

async function openRegister(sessionId) {
  var pid = _schedProvId();
  if (!pid) return;
  var s = (_schedSessions || []).find(function (x) { return x.id === sessionId; }) || {};
  _regSession = sessionId; _register = {};
  var members = [];
  try {
    var r = await window.supabase.rpc('provider_session_attendance', { p_provider: pid, p_session: sessionId });
    members = (r && r.data) ? r.data : [];
  } catch (e) { members = []; }
  members.forEach(function (m) { _register[m.member_id] = m.status; });
  var body, foot;
  if (!members.length) {
    body = '<div class="psub" style="margin:8px 0;">No members yet. Add members in the Members panel first, then come back to take attendance.</div>';
    foot = '<button class="btn btn-ghost" onclick="closeModal()">Close</button>';
  } else {
    body = '<input class="input" id="reg-search" placeholder="Search members…" style="margin-bottom:10px;" oninput="filterRegister()">' +
           '<div id="reg-rows">' + members.map(attMemberRow).join('') + '</div>';
    foot = '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="saveRegister()">Save register</button>';
  }
  openModalShell('lg', 'Register · ' + escHtml(s.title || 'Session'), body, foot);
}

function attMemberRow(m) {
  var present = _register[m.member_id] === 'present';
  var initials = (m.full_name || '?').split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
  return '<div class="reg-row" data-name="' + escHtml((m.full_name || '').toLowerCase()) + '" style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--ffp-border,#1d3346);">' +
      '<div style="width:32px;height:32px;border-radius:8px;background:rgba(43,168,224,.16);color:#6fc6ef;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0;">' + escHtml(initials) + '</div>' +
      '<div style="flex:1;min-width:0;font-weight:700;color:var(--ffp-text,#eaf2f8);">' + escHtml(m.full_name || '—') + '</div>' +
      '<button id="reg-btn-' + m.member_id + '" class="btn btn-sm ' + (present ? 'btn-pri' : 'btn-ghost') + '" onclick="toggleAtt(\'' + m.member_id + '\')">' +
        '<span class="ms">' + (present ? 'check_circle' : 'radio_button_unchecked') + '</span> ' + (present ? 'Present' : 'Absent') +
      '</button>' +
  '</div>';
}

function toggleAtt(memberId) {
  _register[memberId] = (_register[memberId] === 'present') ? 'absent' : 'present';
  var btn = document.getElementById('reg-btn-' + memberId);
  if (!btn) return;
  var present = _register[memberId] === 'present';
  btn.className = 'btn btn-sm ' + (present ? 'btn-pri' : 'btn-ghost');
  btn.innerHTML = '<span class="ms">' + (present ? 'check_circle' : 'radio_button_unchecked') + '</span> ' + (present ? 'Present' : 'Absent');
}

function filterRegister() {
  var box = document.getElementById('reg-search');
  var q = (box ? box.value : '').trim().toLowerCase();
  Array.prototype.forEach.call(document.querySelectorAll('#reg-rows .reg-row'), function (row) {
    row.style.display = (!q || row.getAttribute('data-name').indexOf(q) !== -1) ? '' : 'none';
  });
}

async function saveRegister() {
  var pid = _schedProvId();
  if (!pid || !_regSession) { closeModal(); return; }
  var marks = Object.keys(_register).map(function (mid) { return { member_id: mid, status: _register[mid] }; });
  try {
    var r = await window.supabase.rpc('provider_save_attendance', { p_provider: pid, p_session: _regSession, p_marks: marks });
    if (r && r.error) throw r.error;
    showToast('Register saved', 'success');
    closeModal();
    renderAttendance();
  } catch (e) { showToast('Could not save register', 'error'); }
}

// First open: this script is loaded by showPanel AFTER its synchronous render hook has run.
try { if (document.getElementById('sched-list')) renderScheduling(); } catch (e) {}

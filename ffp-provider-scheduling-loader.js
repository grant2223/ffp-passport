// ════════════════════════════════════════════════════════════════════════
// FFP Partner Portal — SESSIONS module (was "Scheduling") — v3 (2026-06-12)
// v3: COACH BIO POPUP — the coach name on each session is tappable → popup with that coach's short bio (from the
//     staff record, provider_staff.bio). People book for the coach. Coach bios fetched via provider_list_staff.
// v2: WORLD-CLASS FIELDS — the "New session" form was raw free-text; rebuilt to standard: Activity + City now use
//     the shared searchable taxonomy picker (window.FFPPicker, same as the listing forms — no free text), Coach is
//     a dropdown of the provider's own staff (provider_list_staff), Location is a Google Maps URL, Price labelled
//     "per person · per session", Capacity has min=1 (can't go negative). Required: Title, Activity, Date, Capacity≥1.
// FFP Partner Portal — SCHEDULING module  (Business → Scheduling)
// Deferred loader: registered in _provLoaderSrc and lazy-loaded by
// ensureProviderLoader() the first time the Scheduling panel is opened.
//
// Real DB module — provider_sessions table via SECURITY DEFINER RPCs
// (p_provider scoped):  provider_save_session / provider_list_sessions /
// provider_delete_session.  Provider id comes from window.FFP_PROVIDER.id.
//
// Functions are declared at top level so the panel's inline onclick handlers
// (openSessionModal / saveSession / confirmDeleteSession / doDeleteSession)
// resolve against global scope, exactly as the other portal panels do.
// ════════════════════════════════════════════════════════════════════════
var _schedSessions = [];
var _coachBios = {};   // coach full_name -> { bio, role } (from provider_list_staff) for the bio popup
var SESSION_TYPES = { class: 'Group class', pt: 'Personal training', team: 'Team training' };

function _schedProvId() {
  return (window.FFP_PROVIDER && window.FFP_PROVIDER.id) ||
         (typeof providerProfile !== 'undefined' && providerProfile.id) || null;
}

async function renderScheduling() {
  var host = document.getElementById('sched-list');
  if (!host) return;
  var pid = _schedProvId();
  if (!pid) { host.innerHTML = '<div class="empty-sub" style="text-align:left;">Sign in to manage sessions.</div>'; return; }
  host.innerHTML = '<div class="psub" style="margin:10px 0;">Loading…</div>';
  try {
    var r = await window.supabase.rpc('provider_list_sessions', { p_provider: pid });
    _schedSessions = (r && r.data) ? r.data : [];
  } catch (e) { _schedSessions = []; }
  // Coach bios (for the tappable coach popup) — from the provider's own staff.
  try {
    var sr = await window.supabase.rpc('provider_list_staff', { p_provider: pid });
    _coachBios = {};
    (sr && sr.data ? sr.data : []).forEach(function (c) { var nm = c.full_name || ''; if (nm) _coachBios[nm] = { bio: c.bio || '', role: c.role || '' }; });
  } catch (e) {}
  if (!_schedSessions.length) {
    host.innerHTML = emptyState('No sessions yet', 'Add your first class, PT slot or team session. Members will be able to book it.', 'New session', 'openSessionModal()');
    return;
  }
  host.innerHTML = _schedSessions.map(schedRow).join('');
}

function schedRow(s) {
  var d = new Date(s.start_at);
  var when = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' +
             d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  var typeLbl = SESSION_TYPES[s.session_type] || 'Session';
  var meta = [];
  if (s.coach) meta.push('<span style="color:#6fc6ef;cursor:pointer;text-decoration:underline;" onclick="showCoachBio(\'' + encodeURIComponent(s.coach) + '\')">Coach ' + escHtml(s.coach) + '</span>');
  if (s.session_type === 'team' && s.team_name) meta.push(escHtml(s.team_name));
  if (s.capacity) meta.push(s.capacity + ' spots');
  if (s.duration_min) meta.push(s.duration_min + ' min');
  if (s.price_aed != null && Number(s.price_aed) > 0) meta.push('AED ' + s.price_aed);
  if (s.recurrence === 'weekly') meta.push('Weekly');
  return '<div style="background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:12px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
      '<div style="min-width:0;">' +
        '<div style="font-weight:800;color:var(--ffp-text,#eaf2f8);">' + escHtml(s.title) + '</div>' +
        '<div class="psub" style="margin:3px 0 0;">' + when + (s.location ? ' · ' + escHtml(s.location) : '') + '</div>' +
        (meta.length ? '<div class="psub" style="margin:3px 0 0;">' + meta.join(' · ') + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex-shrink:0;">' +
        '<span class="ni-lock-pill" style="background:rgba(43,168,224,.14);color:#6fc6ef;">' + typeLbl + '</span>' +
        '<div style="display:flex;gap:6px;">' +
          '<button class="btn btn-sec btn-sm" onclick="openSessionModal(\'' + s.id + '\')"><span class="ms">edit</span></button>' +
          '<button class="btn btn-ghost btn-sm" onclick="confirmDeleteSession(\'' + s.id + '\')"><span class="ms">delete</span></button>' +
        '</div>' +
      '</div>' +
  '</div>';
}

// Coach bio popup — the short bio captured on the staff record (people book for the coach).
function showCoachBio(enc) {
  var name = ''; try { name = decodeURIComponent(enc); } catch (e) { name = enc; }
  var c = _coachBios[name] || {};
  var body = '<div style="display:flex;flex-direction:column;gap:8px;">' +
      '<div style="font-weight:800;font-size:16px;color:var(--ffp-text,#eaf2f8);">' + escHtml(name) +
        (c.role ? ' <span class="psub" style="font-weight:600;">· ' + escHtml(c.role) + '</span>' : '') + '</div>' +
      '<div class="psub" style="margin:0;line-height:1.55;">' + (c.bio ? escHtml(c.bio) : 'No bio added yet — add one for this coach in the Staff tab.') + '</div>' +
    '</div>';
  openModalShell('', name || 'Coach', body, '<button class="btn btn-pri" onclick="closeModal()">Close</button>');
}

async function openSessionModal(id) {
  var editing = id ? _schedSessions.find(function (x) { return x.id === id; }) : null;
  var s = editing || { session_type: 'class', title: '', activity: '', coach: '', start_at: '', duration_min: 60, capacity: '', price_aed: '', location: '', city: (typeof providerProfile !== 'undefined' ? (providerProfile.city || '') : ''), team_name: '', notes: '' };
  var pid = _schedProvId();
  var provCountry = (typeof providerProfile !== 'undefined' ? (providerProfile.country || 'United Arab Emirates') : 'United Arab Emirates');

  // COACH = chosen from the provider's own staff (not free text).
  var coaches = [];
  try { var cr = await window.supabase.rpc('provider_list_staff', { p_provider: pid }); coaches = (cr && cr.data) ? cr.data : []; } catch (e) {}
  var coachOpts = '<option value="">' + (coaches.length ? 'Select coach…' : 'No staff added yet — add them in the Staff tab') + '</option>' +
    coaches.map(function (c) { var nm = c.full_name || c.name || ''; return '<option value="' + escHtml(nm) + '"' + (s.coach === nm ? ' selected' : '') + '>' + escHtml(nm) + (c.role ? ' · ' + escHtml(c.role) : '') + '</option>'; }).join('');

  var dt = s.start_at ? new Date(s.start_at) : null;
  var dval = dt ? (dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2)) : '';
  var tval = dt ? (('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2)) : '';
  var repeatBlock = editing ? '' : `
    <div class="form-section">
      <div class="form-section-title">Repeats</div>
      <div class="form-grid">
        <div class="field"><div class="label">Repeat</div><select class="select" id="sm-recurrence"><option value="none">Does not repeat</option><option value="weekly">Weekly</option></select></div>
        <div class="field"><div class="label">Repeat until</div><input class="input" type="date" id="sm-repeat-until" value=""></div>
      </div>
      <div class="psub" style="margin:6px 2px 0;">Weekly creates one session each week up to this date (defaults to 12 weeks).</div>
    </div>`;
  openModalShell('lg', (editing ? 'Edit session' : 'New session'), `
    <div class="form-section">
      <div class="form-section-title">Type</div>
      <div class="form-grid">
        <div class="field full">
          <div class="label">Session type <span class="req">*</span></div>
          <select class="select" id="sm-type">
            <option value="class"${s.session_type === 'class' ? ' selected' : ''}>Group class — open booking</option>
            <option value="pt"${s.session_type === 'pt' ? ' selected' : ''}>Personal training — 1-to-1</option>
            <option value="team"${s.session_type === 'team' ? ' selected' : ''}>Team training — squad</option>
          </select>
        </div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Basics</div>
      <div class="form-grid">
        <div class="field full"><div class="label">Title <span class="req">*</span></div><input class="input" id="sm-title" value="${escHtml(s.title)}" placeholder="e.g. Sunset HIIT"></div>
        <div class="field"><div class="label">Activity <span class="req">*</span></div>
          <button type="button" class="ffp-picker-btn placeholder" id="sm-activity-btn" data-value=""><span>Choose activity…</span><span class="ms caret">expand_more</span></button></div>
        <div class="field"><div class="label">Coach</div><select class="select" id="sm-coach">${coachOpts}</select></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">When</div>
      <div class="form-grid">
        <div class="field"><div class="label">Date <span class="req">*</span></div><input class="input" type="date" id="sm-date" value="${dval}"></div>
        <div class="field"><div class="label">Time</div><input class="input" type="time" id="sm-time" value="${tval}"></div>
        <div class="field"><div class="label">Duration (min)</div><input class="input" type="number" min="1" id="sm-duration" value="${escHtml(String(s.duration_min || ''))}" placeholder="60"></div>
      </div>
    </div>
    ${repeatBlock}
    <div class="form-section">
      <div class="form-section-title">Capacity &amp; price</div>
      <div class="form-grid">
        <div class="field"><div class="label">Capacity <span class="req">*</span></div><input class="input" type="number" min="1" step="1" id="sm-capacity" value="${escHtml(String(s.capacity || ''))}" placeholder="e.g. 12 — use 1 for PT"></div>
        <div class="field"><div class="label">Price per person <span class="label-hint">— for this session (AED, 0 = free)</span></div><input class="input" type="number" min="0" id="sm-price" value="${escHtml(String(s.price_aed || ''))}" placeholder="0 = Free"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Where</div>
      <div class="form-grid">
        <div class="field"><div class="label">City</div>
          <button type="button" class="ffp-picker-btn placeholder" id="sm-city-btn" data-value="" data-country="${escHtml(provCountry)}"><span>Choose city…</span><span class="ms caret">expand_more</span></button></div>
        <div class="field"><div class="label">Location map link <span class="label-hint">— Google Maps URL</span></div><input class="input" type="url" id="sm-location" value="${escHtml(s.location || '')}" placeholder="https://maps.google.com/…"></div>
        <div class="field full"><div class="label">Team <span style="color:var(--ffp-text-dim,#6c7f90);">(team sessions only)</span></div><input class="input" id="sm-team" value="${escHtml(s.team_name || '')}" placeholder="e.g. U16 squad (optional)"></div>
        <div class="field full"><div class="label">Notes</div><textarea class="textarea" id="sm-notes" rows="2" placeholder="Anything members should know (optional)">${escHtml(s.notes || '')}</textarea></div>
      </div>
    </div>
  `, `
    ${editing ? '<button class="btn btn-ghost left" onclick="confirmDeleteSession(\'' + editing.id + '\')"><span class="ms">delete</span> Delete</button>' : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-pri" onclick="saveSession('${editing ? editing.id : ''}')">${editing ? 'Save changes' : 'Create session'}</button>
  `);

  // Wire the shared searchable pickers (same component as the listing forms) — no free-text taxonomy fields.
  setTimeout(function () {
    var aBtn = document.getElementById('sm-activity-btn');
    var setA = function (name) {
      if (!aBtn) return; aBtn.dataset.value = name || '';
      if (name) { aBtn.classList.remove('placeholder'); aBtn.innerHTML = '<span>' + escHtml(name) + '</span><span class="ms caret">expand_more</span>'; }
      else { aBtn.classList.add('placeholder'); aBtn.innerHTML = '<span>Choose activity…</span><span class="ms caret">expand_more</span>'; }
    };
    if (s.activity) setA(s.activity);
    if (aBtn) aBtn.addEventListener('click', function () {
      if (window.FFPPicker && window.FFPPicker.openActivity) { window.FFPPicker.openActivity(aBtn.dataset.value, function (name) { setA(name); }); }
      else { showToast('Activity picker not ready', 'error'); }
    });
    var cBtn = document.getElementById('sm-city-btn');
    var setC = function (name) {
      if (!cBtn) return; cBtn.dataset.value = name || '';
      if (name) { cBtn.classList.remove('placeholder'); cBtn.innerHTML = '<span>' + escHtml(name) + '</span><span class="ms caret">expand_more</span>'; }
      else { cBtn.classList.add('placeholder'); cBtn.innerHTML = '<span>Choose city…</span><span class="ms caret">expand_more</span>'; }
    };
    if (s.city) setC(s.city);
    if (cBtn) cBtn.addEventListener('click', function () {
      if (window.FFPPicker && window.FFPPicker.openCity) { window.FFPPicker.openCity(cBtn.dataset.country || provCountry, cBtn.dataset.value, function (name) { setC(name); }); }
      else { showToast('City picker not ready', 'error'); }
    });
  }, 50);
}

async function saveSession(id) {
  var g = function (i) { var el = document.getElementById('sm-' + i); return el ? (el.value || '').trim() : ''; };
  var title = g('title'); var date = g('date'); var time = g('time') || '00:00';
  var aBtn = document.getElementById('sm-activity-btn'); var activity = aBtn ? (aBtn.dataset.value || '') : '';
  var cBtn = document.getElementById('sm-city-btn'); var city = cBtn ? (cBtn.dataset.value || '') : '';
  if (!title) { showToast('Title is required', 'error'); return; }
  if (!activity) { showToast('Activity is required', 'error'); return; }
  if (!date) { showToast('Date is required', 'error'); return; }
  var capRaw = g('capacity');
  var capacity = capRaw ? parseInt(capRaw, 10) : null;
  if (capacity != null && (isNaN(capacity) || capacity < 1)) { showToast('Capacity must be at least 1', 'error'); return; }
  var pid = _schedProvId();
  if (!pid) { showToast('Not signed in', 'error'); return; }
  var startIso;
  try { startIso = new Date(date + 'T' + time).toISOString(); }
  catch (e) { showToast('Check the date and time', 'error'); return; }
  var payload = {
    session_type: g('type') || 'class', title: title, activity: activity, coach: g('coach'),
    start_at: startIso, duration_min: g('duration'), capacity: (capacity != null ? String(capacity) : ''),
    price_aed: g('price'), location: g('location'), city: city,
    team_name: g('team'), notes: g('notes'),
    recurrence: g('recurrence') || 'none', repeat_until: g('repeat-until')
  };
  var weekly = (!id && g('recurrence') === 'weekly');
  try {
    var r = await window.supabase.rpc('provider_save_session', { p_provider: pid, p_id: id || null, p: payload });
    if (r && r.error) throw r.error;
    showToast(id ? 'Session updated' : (weekly ? 'Weekly sessions created' : 'Session created'), 'success');
    closeModal();
    renderScheduling();
  } catch (e) { showToast('Could not save session', 'error'); }
}

function confirmDeleteSession(id) {
  openModalShell('', 'Delete session?', '<div class="psub" style="margin:6px 0;">This removes the session from your schedule.</div>', '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doDeleteSession(\'' + id + '\')">Delete</button>');
}

async function doDeleteSession(id) {
  var pid = _schedProvId();
  try {
    var r = await window.supabase.rpc('provider_delete_session', { p_provider: pid, p_id: id });
    if (r && r.error) throw r.error;
    showToast('Session deleted', 'success');
  } catch (e) { showToast('Could not delete', 'error'); }
  closeModal();
  renderScheduling();
}

// ════════════════════════════════════════════════════════════════════════
// ATTENDANCE (manual register) — Scheduling → Attendance tab.
// provider_session_attendance / provider_save_attendance / provider_attendance_counts.
// ════════════════════════════════════════════════════════════════════════
var _attCounts = {};
var _register = {};     // member_id -> 'present' | 'absent'  (current open register)
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
    host.innerHTML = emptyState('No sessions yet', 'Create sessions in the Calendar tab first, then take attendance here.', '', '');
    return;
  }
  host.innerHTML = _schedSessions.map(attRow).join('');
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

// First open: this script is loaded by showPanel AFTER its synchronous render
// hook has already run, so render now if the Scheduling panel is on screen.
try { if (document.getElementById('sched-list')) renderScheduling(); } catch (e) {}

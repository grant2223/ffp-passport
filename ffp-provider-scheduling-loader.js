// ════════════════════════════════════════════════════════════════════════
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
  if (s.coach) meta.push('Coach ' + escHtml(s.coach));
  if (s.session_type === 'team' && s.team_name) meta.push(escHtml(s.team_name));
  if (s.capacity) meta.push(s.capacity + ' spots');
  if (s.duration_min) meta.push(s.duration_min + ' min');
  if (s.price_aed != null && Number(s.price_aed) > 0) meta.push('AED ' + s.price_aed);
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

function openSessionModal(id) {
  var editing = id ? _schedSessions.find(function (x) { return x.id === id; }) : null;
  var s = editing || { session_type: 'class', title: '', activity: '', coach: '', start_at: '', duration_min: 60, capacity: '', price_aed: '', location: '', city: (typeof providerProfile !== 'undefined' ? (providerProfile.city || '') : ''), team_name: '', notes: '' };
  var dt = s.start_at ? new Date(s.start_at) : null;
  var dval = dt ? (dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2)) : '';
  var tval = dt ? (('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2)) : '';
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
        <div class="field"><div class="label">Activity</div><input class="input" id="sm-activity" value="${escHtml(s.activity || '')}" placeholder="e.g. HIIT"></div>
        <div class="field"><div class="label">Coach</div><input class="input" id="sm-coach" value="${escHtml(s.coach || '')}" placeholder="e.g. Lee"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">When</div>
      <div class="form-grid">
        <div class="field"><div class="label">Date <span class="req">*</span></div><input class="input" type="date" id="sm-date" value="${dval}"></div>
        <div class="field"><div class="label">Time</div><input class="input" type="time" id="sm-time" value="${tval}"></div>
        <div class="field"><div class="label">Duration (min)</div><input class="input" type="number" id="sm-duration" value="${escHtml(String(s.duration_min || ''))}" placeholder="60"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Capacity &amp; price</div>
      <div class="form-grid">
        <div class="field"><div class="label">Capacity</div><input class="input" type="number" id="sm-capacity" value="${escHtml(String(s.capacity || ''))}" placeholder="e.g. 12 — use 1 for PT"></div>
        <div class="field"><div class="label">Price (AED)</div><input class="input" type="number" id="sm-price" value="${escHtml(String(s.price_aed || ''))}" placeholder="0 = Free"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Where</div>
      <div class="form-grid">
        <div class="field"><div class="label">Location</div><input class="input" id="sm-location" value="${escHtml(s.location || '')}" placeholder="e.g. Main floor / Court 2"></div>
        <div class="field"><div class="label">City</div><input class="input" id="sm-city" value="${escHtml(s.city || '')}" placeholder="City"></div>
        <div class="field full"><div class="label">Team <span style="color:var(--ffp-text-dim,#6c7f90);">(team sessions only)</span></div><input class="input" id="sm-team" value="${escHtml(s.team_name || '')}" placeholder="e.g. U16 squad (optional)"></div>
        <div class="field full"><div class="label">Notes</div><textarea class="textarea" id="sm-notes" rows="2" placeholder="Anything members should know (optional)">${escHtml(s.notes || '')}</textarea></div>
      </div>
    </div>
  `, `
    ${editing ? '<button class="btn btn-ghost left" onclick="confirmDeleteSession(\'' + editing.id + '\')"><span class="ms">delete</span> Delete</button>' : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-pri" onclick="saveSession('${editing ? editing.id : ''}')">${editing ? 'Save changes' : 'Create session'}</button>
  `);
}

async function saveSession(id) {
  var g = function (i) { var el = document.getElementById('sm-' + i); return el ? el.value.trim() : ''; };
  var title = g('title'); var date = g('date'); var time = g('time') || '00:00';
  if (!title) { showToast('Title is required', 'error'); return; }
  if (!date) { showToast('Date is required', 'error'); return; }
  var pid = _schedProvId();
  if (!pid) { showToast('Not signed in', 'error'); return; }
  var startIso;
  try { startIso = new Date(date + 'T' + time).toISOString(); }
  catch (e) { showToast('Check the date and time', 'error'); return; }
  var payload = {
    session_type: g('type') || 'class', title: title, activity: g('activity'), coach: g('coach'),
    start_at: startIso, duration_min: g('duration'), capacity: g('capacity'),
    price_aed: g('price'), location: g('location'), city: g('city'),
    team_name: g('team'), notes: g('notes')
  };
  try {
    var r = await window.supabase.rpc('provider_save_session', { p_provider: pid, p_id: id || null, p: payload });
    if (r && r.error) throw r.error;
    showToast(id ? 'Session updated' : 'Session created', 'success');
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

// First open: this script is loaded by showPanel AFTER its synchronous render
// hook has already run, so render now if the Scheduling panel is on screen.
try { if (document.getElementById('sched-list')) renderScheduling(); } catch (e) {}

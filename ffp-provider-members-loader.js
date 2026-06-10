// ════════════════════════════════════════════════════════════════════════
// FFP Partner Portal — MEMBERS module  (Business → Members → Directory)
// Deferred loader: registered in _provLoaderSrc, lazy-loaded by
// ensureProviderLoader() the first time the Members panel is opened.
//
// Real DB module — provider_members table via SECURITY DEFINER RPCs
// (p_provider scoped): provider_save_member / provider_list_members /
// provider_delete_member.  Provider id from window.FFP_PROVIDER.id.
//
// Top-level function declarations so the panel's inline onclick handlers
// resolve against global scope (same convention as the other portal panels).
// ════════════════════════════════════════════════════════════════════════
var _members = [];
var MEMBER_STATUS = { active: 'Active', trial: 'Trial', lapsed: 'Lapsed', prospect: 'Prospect' };
var _memStatusStyle = {
  active:   'background:rgba(43,168,224,.16);color:#6fc6ef',
  trial:    'background:rgba(255,204,0,.16);color:#FFCC00',
  lapsed:   'background:rgba(255,255,255,.08);color:#9fb0bf',
  prospect: 'background:rgba(120,200,140,.18);color:#7fd49a'
};

function _memProvId() {
  return (window.FFP_PROVIDER && window.FFP_PROVIDER.id) ||
         (typeof providerProfile !== 'undefined' && providerProfile.id) || null;
}

async function renderMembers() {
  var host = document.getElementById('mem-list');
  if (!host) return;
  var pid = _memProvId();
  if (!pid) { host.innerHTML = '<div class="empty-sub" style="text-align:left;">Sign in to manage members.</div>'; return; }
  host.innerHTML = '<div class="psub" style="margin:10px 0;">Loading…</div>';
  try {
    var r = await window.supabase.rpc('provider_list_members', { p_provider: pid });
    _members = (r && r.data) ? r.data : [];
  } catch (e) { _members = []; }
  renderMembersList();
}

function renderMembersList() {
  var host = document.getElementById('mem-list');
  if (!host) return;
  var box = document.getElementById('mem-search');
  var q = (box ? box.value : '').trim().toLowerCase();
  var items = _members;
  if (q) {
    items = _members.filter(function (m) {
      return ((m.full_name || '') + ' ' + (m.email || '') + ' ' + (m.phone || '') + ' ' + (m.tags || '')).toLowerCase().indexOf(q) !== -1;
    });
  }
  if (!items.length) {
    host.innerHTML = _members.length
      ? '<div class="psub" style="margin:10px 2px;">No matches.</div>'
      : emptyState('No members yet', 'Add your first member. Bookings, memberships and attendance will all link back to them.', 'Add member', 'openMemberModal()');
    return;
  }
  host.innerHTML = '<div class="psub" style="margin:0 2px 8px;">' + _members.length + ' member' + (_members.length === 1 ? '' : 's') + '</div>' +
                   items.map(memberRow).join('');
}

function memberRow(m) {
  var initials = (m.full_name || '?').split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
  var st = m.member_status || 'active';
  var stStyle = _memStatusStyle[st] || _memStatusStyle.active;
  var contact = [];
  if (m.email) contact.push(escHtml(m.email));
  if (m.phone) contact.push(escHtml(m.phone));
  var tags = (m.tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  var tagHtml = tags.length
    ? '<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:5px;">' + tags.map(function (t) {
        return '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,.06);color:#9fb0bf;">' + escHtml(t) + '</span>';
      }).join('') + '</div>'
    : '';
  return '<div style="background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:11px 13px;margin-bottom:9px;display:flex;align-items:flex-start;gap:11px;">' +
      '<div style="width:38px;height:38px;border-radius:10px;background:rgba(43,168,224,.16);color:#6fc6ef;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;">' + escHtml(initials) + '</div>' +
      '<div style="min-width:0;flex:1;">' +
        '<div style="font-weight:800;color:var(--ffp-text,#eaf2f8);">' + escHtml(m.full_name || '—') + '</div>' +
        (contact.length ? '<div class="psub" style="margin:2px 0 0;">' + contact.join(' · ') + '</div>' : '') +
        tagHtml +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex-shrink:0;">' +
        '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;' + stStyle + '">' + (MEMBER_STATUS[st] || 'Active') + '</span>' +
        '<div style="display:flex;gap:6px;">' +
          '<button class="btn btn-sec btn-sm" onclick="openMemberModal(\'' + m.id + '\')"><span class="ms">edit</span></button>' +
          '<button class="btn btn-ghost btn-sm" onclick="confirmDeleteMember(\'' + m.id + '\')"><span class="ms">delete</span></button>' +
        '</div>' +
      '</div>' +
  '</div>';
}

function openMemberModal(id) {
  var editing = id ? _members.find(function (x) { return x.id === id; }) : null;
  var today = new Date();
  var todayStr = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
  var m = editing || { full_name: '', email: '', phone: '', member_status: 'active', tags: '', join_date: todayStr, city: (typeof providerProfile !== 'undefined' ? (providerProfile.city || '') : ''), notes: '' };
  var jd = m.join_date ? String(m.join_date).slice(0, 10) : '';
  openModalShell('lg', (editing ? 'Edit member' : 'Add member'), `
    <div class="form-section">
      <div class="form-section-title">Member</div>
      <div class="form-grid">
        <div class="field full"><div class="label">Full name <span class="req">*</span></div><input class="input" id="mm-full_name" value="${escHtml(m.full_name)}" placeholder="e.g. Sam Okafor"></div>
        <div class="field"><div class="label">Email</div><input class="input" id="mm-email" value="${escHtml(m.email || '')}" placeholder="name@email.com"></div>
        <div class="field"><div class="label">Phone</div><input class="input" id="mm-phone" value="${escHtml(m.phone || '')}" placeholder="+971 50 000 0000"></div>
        <div class="field">
          <div class="label">Status</div>
          <select class="select" id="mm-member_status">
            <option value="active"${m.member_status === 'active' ? ' selected' : ''}>Active</option>
            <option value="trial"${m.member_status === 'trial' ? ' selected' : ''}>Trial</option>
            <option value="lapsed"${m.member_status === 'lapsed' ? ' selected' : ''}>Lapsed</option>
            <option value="prospect"${m.member_status === 'prospect' ? ' selected' : ''}>Prospect</option>
          </select>
        </div>
        <div class="field"><div class="label">Joined</div><input class="input" type="date" id="mm-join_date" value="${jd}"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Details</div>
      <div class="form-grid">
        <div class="field"><div class="label">City</div><input class="input" id="mm-city" value="${escHtml(m.city || '')}" placeholder="City"></div>
        <div class="field"><div class="label">Tags</div><input class="input" id="mm-tags" value="${escHtml(m.tags || '')}" placeholder="comma,separated, e.g. monthly, pilates"></div>
        <div class="field full"><div class="label">Notes</div><textarea class="textarea" id="mm-notes" rows="2" placeholder="Anything to remember about this member (optional)">${escHtml(m.notes || '')}</textarea></div>
      </div>
    </div>
  `, `
    ${editing ? '<button class="btn btn-ghost left" onclick="confirmDeleteMember(\'' + editing.id + '\')"><span class="ms">delete</span> Delete</button>' : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-pri" onclick="saveMember('${editing ? editing.id : ''}')">${editing ? 'Save changes' : 'Add member'}</button>
  `);
}

async function saveMember(id) {
  var g = function (i) { var el = document.getElementById('mm-' + i); return el ? el.value.trim() : ''; };
  var fullName = g('full_name');
  if (!fullName) { showToast('Name is required', 'error'); return; }
  var pid = _memProvId();
  if (!pid) { showToast('Not signed in', 'error'); return; }
  var payload = {
    full_name: fullName, email: g('email'), phone: g('phone'),
    member_status: g('member_status') || 'active', tags: g('tags'),
    join_date: g('join_date'), city: g('city'), notes: g('notes')
  };
  try {
    var r = await window.supabase.rpc('provider_save_member', { p_provider: pid, p_id: id || null, p: payload });
    if (r && r.error) throw r.error;
    showToast(id ? 'Member updated' : 'Member added', 'success');
    closeModal();
    renderMembers();
  } catch (e) { showToast('Could not save member', 'error'); }
}

function confirmDeleteMember(id) {
  openModalShell('', 'Remove member?', '<div class="psub" style="margin:6px 0;">This removes the member from your directory.</div>', '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doDeleteMember(\'' + id + '\')">Remove</button>');
}

async function doDeleteMember(id) {
  var pid = _memProvId();
  try {
    var r = await window.supabase.rpc('provider_delete_member', { p_provider: pid, p_id: id });
    if (r && r.error) throw r.error;
    showToast('Member removed', 'success');
  } catch (e) { showToast('Could not remove member', 'error'); }
  closeModal();
  renderMembers();
}

// ════════════════════════════════════════════════════════════════════════
// TEAMS & ROSTERS  (Members → Teams & Rosters tab)
// provider_save_team / provider_list_teams / provider_team_roster /
// provider_save_team_roster / provider_delete_team.
// ════════════════════════════════════════════════════════════════════════
var _teams = [];
var _roster = {};      // member_id -> bool (in current roster edit)
var _rosterTeam = null;

async function renderTeams() {
  var host = document.getElementById('teams-list');
  if (!host) return;
  var pid = _memProvId();
  if (!pid) { host.innerHTML = '<div class="empty-sub" style="text-align:left;">Sign in to manage teams.</div>'; return; }
  host.innerHTML = '<div class="psub" style="margin:10px 0;">Loading…</div>';
  try {
    var r = await window.supabase.rpc('provider_list_teams', { p_provider: pid });
    _teams = (r && r.data) ? r.data : [];
  } catch (e) { _teams = []; }
  if (!_teams.length) {
    host.innerHTML = emptyState('No teams yet', 'Create a squad or training group, then add members to its roster.', 'New team', 'openTeamModal()');
    return;
  }
  host.innerHTML = _teams.map(teamRow).join('');
}

function teamRow(t) {
  var meta = [];
  if (t.sport) meta.push(escHtml(t.sport));
  if (t.age_group) meta.push(escHtml(t.age_group));
  if (t.coach) meta.push('Coach ' + escHtml(t.coach));
  var n = t.member_count || 0;
  return '<div style="background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:11px 13px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
      '<div style="min-width:0;">' +
        '<div style="font-weight:800;color:var(--ffp-text,#eaf2f8);">' + escHtml(t.name) + '</div>' +
        (meta.length ? '<div class="psub" style="margin:2px 0 0;">' + meta.join(' · ') + '</div>' : '') +
        '<div class="psub" style="margin:2px 0 0;">' + n + ' member' + (n === 1 ? '' : 's') + '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex-shrink:0;">' +
        '<button class="btn btn-pri btn-sm" onclick="openRoster(\'' + t.id + '\')"><span class="ms">group</span> Roster</button>' +
        '<div style="display:flex;gap:6px;">' +
          '<button class="btn btn-sec btn-sm" onclick="openTeamModal(\'' + t.id + '\')"><span class="ms">edit</span></button>' +
          '<button class="btn btn-ghost btn-sm" onclick="confirmDeleteTeam(\'' + t.id + '\')"><span class="ms">delete</span></button>' +
        '</div>' +
      '</div>' +
  '</div>';
}

function openTeamModal(id) {
  var editing = id ? _teams.find(function (x) { return x.id === id; }) : null;
  var t = editing || { name: '', sport: '', age_group: '', coach: '', notes: '' };
  openModalShell('lg', (editing ? 'Edit team' : 'New team'), `
    <div class="form-section">
      <div class="form-section-title">Team</div>
      <div class="form-grid">
        <div class="field full"><div class="label">Team name <span class="req">*</span></div><input class="input" id="tm-name" value="${escHtml(t.name)}" placeholder="e.g. U16 Squad"></div>
        <div class="field"><div class="label">Sport</div><input class="input" id="tm-sport" value="${escHtml(t.sport || '')}" placeholder="e.g. Football"></div>
        <div class="field"><div class="label">Age group</div><input class="input" id="tm-age_group" value="${escHtml(t.age_group || '')}" placeholder="e.g. U16"></div>
        <div class="field full"><div class="label">Coach</div><input class="input" id="tm-coach" value="${escHtml(t.coach || '')}" placeholder="e.g. Dan"></div>
        <div class="field full"><div class="label">Notes</div><textarea class="textarea" id="tm-notes" rows="2" placeholder="Optional">${escHtml(t.notes || '')}</textarea></div>
      </div>
    </div>
  `, `
    ${editing ? '<button class="btn btn-ghost left" onclick="confirmDeleteTeam(\'' + editing.id + '\')"><span class="ms">delete</span> Delete</button>' : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-pri" onclick="saveTeam('${editing ? editing.id : ''}')">${editing ? 'Save changes' : 'Create team'}</button>
  `);
}

async function saveTeam(id) {
  var g = function (i) { var el = document.getElementById('tm-' + i); return el ? el.value.trim() : ''; };
  var name = g('name');
  if (!name) { showToast('Team name is required', 'error'); return; }
  var pid = _memProvId();
  if (!pid) { showToast('Not signed in', 'error'); return; }
  var payload = { name: name, sport: g('sport'), age_group: g('age_group'), coach: g('coach'), notes: g('notes') };
  try {
    var r = await window.supabase.rpc('provider_save_team', { p_provider: pid, p_id: id || null, p: payload });
    if (r && r.error) throw r.error;
    showToast(id ? 'Team updated' : 'Team created', 'success');
    closeModal();
    renderTeams();
  } catch (e) { showToast('Could not save team', 'error'); }
}

function confirmDeleteTeam(id) {
  openModalShell('', 'Delete team?', '<div class="psub" style="margin:6px 0;">This removes the team and its roster. Members themselves are not deleted.</div>', '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doDeleteTeam(\'' + id + '\')">Delete</button>');
}

async function doDeleteTeam(id) {
  var pid = _memProvId();
  try {
    var r = await window.supabase.rpc('provider_delete_team', { p_provider: pid, p_id: id });
    if (r && r.error) throw r.error;
    showToast('Team deleted', 'success');
  } catch (e) { showToast('Could not delete team', 'error'); }
  closeModal();
  renderTeams();
}

async function openRoster(teamId) {
  var pid = _memProvId();
  if (!pid) return;
  var t = (_teams || []).find(function (x) { return x.id === teamId; }) || {};
  _rosterTeam = teamId; _roster = {};
  var members = [];
  try {
    var r = await window.supabase.rpc('provider_team_roster', { p_provider: pid, p_team: teamId });
    members = (r && r.data) ? r.data : [];
  } catch (e) { members = []; }
  members.forEach(function (m) { _roster[m.member_id] = !!m.in_team; });
  var body, foot;
  if (!members.length) {
    body = '<div class="psub" style="margin:8px 0;">No members yet. Add members in the Directory tab first, then build the roster here.</div>';
    foot = '<button class="btn btn-ghost" onclick="closeModal()">Close</button>';
  } else {
    body = '<input class="input" id="ros-search" placeholder="Search members…" style="margin-bottom:10px;" oninput="filterRoster()">' +
           '<div id="ros-rows">' + members.map(rosterRow).join('') + '</div>';
    foot = '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="saveRoster()">Save roster</button>';
  }
  openModalShell('lg', 'Roster · ' + escHtml(t.name || 'Team'), body, foot);
}

function rosterRow(m) {
  var inT = !!_roster[m.member_id];
  var initials = (m.full_name || '?').split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
  return '<div class="ros-row" data-name="' + escHtml((m.full_name || '').toLowerCase()) + '" style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--ffp-border,#1d3346);">' +
      '<div style="width:32px;height:32px;border-radius:8px;background:rgba(43,168,224,.16);color:#6fc6ef;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0;">' + escHtml(initials) + '</div>' +
      '<div style="flex:1;min-width:0;font-weight:700;color:var(--ffp-text,#eaf2f8);">' + escHtml(m.full_name || '—') + '</div>' +
      '<button id="ros-btn-' + m.member_id + '" class="btn btn-sm ' + (inT ? 'btn-pri' : 'btn-ghost') + '" onclick="toggleRosterMember(\'' + m.member_id + '\')">' +
        '<span class="ms">' + (inT ? 'check_circle' : 'add') + '</span> ' + (inT ? 'In team' : 'Add') +
      '</button>' +
  '</div>';
}

function toggleRosterMember(id) {
  _roster[id] = !_roster[id];
  var btn = document.getElementById('ros-btn-' + id);
  if (!btn) return;
  var inT = _roster[id];
  btn.className = 'btn btn-sm ' + (inT ? 'btn-pri' : 'btn-ghost');
  btn.innerHTML = '<span class="ms">' + (inT ? 'check_circle' : 'add') + '</span> ' + (inT ? 'In team' : 'Add');
}

function filterRoster() {
  var box = document.getElementById('ros-search');
  var q = (box ? box.value : '').trim().toLowerCase();
  Array.prototype.forEach.call(document.querySelectorAll('#ros-rows .ros-row'), function (row) {
    row.style.display = (!q || row.getAttribute('data-name').indexOf(q) !== -1) ? '' : 'none';
  });
}

async function saveRoster() {
  var pid = _memProvId();
  if (!pid || !_rosterTeam) { closeModal(); return; }
  var ids = Object.keys(_roster).filter(function (id) { return _roster[id]; });
  try {
    var r = await window.supabase.rpc('provider_save_team_roster', { p_provider: pid, p_team: _rosterTeam, p_members: ids });
    if (r && r.error) throw r.error;
    showToast('Roster saved', 'success');
    closeModal();
    renderTeams();
  } catch (e) { showToast('Could not save roster', 'error'); }
}

// First open: loaded by showPanel AFTER its synchronous render hook ran, so
// render now if the Members panel (Directory) is on screen.
try { if (document.getElementById('mem-list')) renderMembers(); } catch (e) {}

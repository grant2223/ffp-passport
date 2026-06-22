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
  active:   'background:rgba(25,128,173,.14);color:#13657f',
  trial:    'background:rgba(201,130,15,.16);color:#8a5a08',
  lapsed:   'background:rgba(15,37,49,.08);color:#566069',
  prospect: 'background:rgba(31,157,87,.16);color:#176b3d'
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
  var initials = ((m.full_name || ((m.given_names || '') + ' ' + (m.surname || ''))) || '?').trim().split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
  var st = m.member_status || 'active';
  var stStyle = _memStatusStyle[st] || _memStatusStyle.active;
  var contact = [];
  if (m.email) contact.push(escHtml(m.email));
  if (m.phone) contact.push(escHtml(m.phone));
  var tags = (m.tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  var tagHtml = tags.length
    ? '<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:5px;">' + tags.map(function (t) {
        return '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:var(--ffp-bg-3);color:var(--ffp-text-muted);">' + escHtml(t) + '</span>';
      }).join('') + '</div>'
    : '';
  var photoCol = m.photo_url
    ? '<div style="width:64px;flex:0 0 auto;background:url(\'' + escHtml(m.photo_url) + '\') center/cover no-repeat;"></div>'
    : '<div style="width:64px;flex:0 0 auto;background:rgba(25,128,173,.14);color:var(--ffp-blue);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;">' + escHtml(initials) + '</div>';
  return '<div style="background:rgba(15,37,49,.05);border:1px solid var(--ffp-border);border-radius:12px;overflow:hidden;margin-bottom:9px;display:flex;align-items:stretch;gap:0;min-height:68px;">' +
      photoCol +
      '<div style="min-width:0;flex:1;padding:11px 13px;cursor:pointer;" onclick="openClientProfile(\'' + m.id + '\')" title="Open client profile">' +
        '<div style="font-weight:800;color:var(--ffp-text);">' + escHtml(m.full_name || '—') + '</div>' +
        (contact.length ? '<div class="psub" style="margin:2px 0 0;">' + contact.join(' · ') + '</div>' : '') +
        tagHtml +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex-shrink:0;padding:11px 13px;">' +
        '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;' + stStyle + '">' + (MEMBER_STATUS[st] || 'Active') + '</span>' +
        '<div style="display:flex;gap:6px;">' +
          '<button class="btn btn-sec btn-sm" onclick="openClientProfile(\'' + m.id + '\')" title="Client profile"><span class="ms">person</span></button>' +
          '<button class="btn btn-sec btn-sm" onclick="openMembership(\'' + m.id + '\')" title="Membership"><span class="ms">card_membership</span></button>' +
          '<button class="btn btn-sec btn-sm" onclick="openMemberModal(\'' + m.id + '\')"><span class="ms">edit</span></button>' +
          '<button class="btn btn-ghost btn-sm" onclick="confirmDeleteMember(\'' + m.id + '\')"><span class="ms">delete</span></button>' +
        '</div>' +
      '</div>' +
  '</div>';
}

// ── platform-standard field helpers (reuse shared FFPPicker + .phone-cc / .phone-num) ──
function _memPhoneCodes() {
  var pc = (window.FFP_TAX && FFP_TAX.phoneCodes) || [];
  return pc.length ? pc : [{ code: '+971', flag: '🇦🇪', country: 'United Arab Emirates' }];
}
function _memSplitPhone(phone) {
  phone = (phone || '').trim();
  var codes = _memPhoneCodes().map(function (c) { return c.code; }).sort(function (a, b) { return b.length - a.length; });
  for (var i = 0; i < codes.length; i++) { if (phone.indexOf(codes[i]) === 0) return { cc: codes[i], num: phone.slice(codes[i].length).trim() }; }
  return { cc: (codes[0] || '+971'), num: phone };
}
function _memPhoneFieldHtml(cc, num) {
  var opts = _memPhoneCodes().map(function (c) {
    return '<option value="' + escHtml(c.code) + '"' + (c.code === cc ? ' selected' : '') + '>' + escHtml((c.flag ? c.flag + ' ' : '') + c.code) + '</option>';
  }).join('');
  return '<div class="phone-input">' +
      '<select class="phone-cc" id="mm-phone-cc">' + opts + '</select>' +
      '<input class="input phone-num" id="mm-phone-num" inputmode="tel" value="' + escHtml(num || '') + '" placeholder="50 000 0000">' +
    '</div>';
}
function _memGetPhone() {
  var cc = document.getElementById('mm-phone-cc'), num = document.getElementById('mm-phone-num');
  var n = num ? num.value.trim() : '';
  if (!n) return '';
  return (((cc && cc.value) ? cc.value : '') + ' ' + n).trim();
}
function _memCountryBtnHtml(country) {
  return '<button type="button" class="ffp-picker-btn' + (country ? '' : ' placeholder') + '" id="mm-country-btn" data-value="' + escHtml(country || '') + '" onclick="_memPickCountry()">' +
    '<span>' + (country ? escHtml(country) : 'Choose country…') + '</span><span class="ms caret">expand_more</span></button>';
}
function _memCityBtnHtml(country, city) {
  return '<button type="button" class="ffp-picker-btn' + (city ? '' : ' placeholder') + '" id="mm-city-btn" data-value="' + escHtml(city || '') + '" data-country="' + escHtml(country || '') + '" onclick="_memPickCity()">' +
    '<span>' + (city ? escHtml(city) : 'Choose city…') + '</span><span class="ms caret">expand_more</span></button>';
}
function _memPickCountry() {
  if (!window.FFPPicker) { showToast('Picker still loading — try again', 'info'); return; }
  var btn = document.getElementById('mm-country-btn');
  FFPPicker.openCountry(btn.dataset.value || '', function (name) {
    btn.dataset.value = name; btn.classList.remove('placeholder'); btn.querySelector('span').textContent = name;
    var cb = document.getElementById('mm-city-btn');
    if (cb) { cb.dataset.value = ''; cb.dataset.country = name; cb.classList.add('placeholder'); cb.querySelector('span').textContent = 'Choose city…'; }
  });
}
function _memPickCity() {
  if (!window.FFPPicker) { showToast('Picker still loading — try again', 'info'); return; }
  var btn = document.getElementById('mm-city-btn');
  var co = document.getElementById('mm-country-btn');
  var country = co ? (co.dataset.value || '') : '';
  if (!country) { showToast('Choose a country first', 'info'); return; }
  FFPPicker.openCity(country, btn.dataset.value || '', function (name) {
    btn.dataset.value = name; btn.classList.remove('placeholder'); btn.querySelector('span').textContent = name;
  });
}
function pickMemberPhoto() {
  if (!window.FFPUpload || !FFPUpload.pick) { showToast('Uploader still loading — try again', 'error'); return; }
  FFPUpload.pick({ bucket: 'quest-images', key: 'member-' + (_memProvId() || 'x') + '-' + Date.now(), aspect: 1, outW: 512, outH: 512, title: 'Member photo',
    onDone: function (url) {
      var h = document.getElementById('mm-photo_url'); if (h) h.value = url || '';
      var slot = document.getElementById('mm-photo');
      if (slot) { slot.style.background = url ? ("url('" + url + "') center/cover no-repeat") : 'var(--ffp-bg-3)'; slot.innerHTML = url ? '' : '<span class="ms" style="font-size:24px;">add_a_photo</span>'; }
      var btn = document.getElementById('mm-photo-btn'); if (btn) btn.innerHTML = '<span class="ms">photo_camera</span> Change photo';
    } });
}

function openMemberModal(id) {
  var editing = id ? _members.find(function (x) { return x.id === id; }) : null;
  var today = new Date();
  var todayStr = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
  var m = editing || { full_name: '', given_names: '', surname: '', email: '', phone: '', member_status: 'active', tags: '', join_date: todayStr, country: '', city: '', notes: '', photo_url: '' };
  var gn = m.given_names || '', sn = m.surname || '';
  if (!gn && !sn && m.full_name) { var pp = m.full_name.trim().split(/\s+/); sn = pp.length > 1 ? pp.pop() : ''; gn = pp.join(' '); }
  var jd = m.join_date ? String(m.join_date).slice(0, 10) : '';
  var ph = _memSplitPhone(m.phone);
  var photo = m.photo_url || '';
  var statusOpts = ['active', 'trial', 'lapsed', 'prospect'].map(function (s) { return '<option value="' + s + '"' + (m.member_status === s ? ' selected' : '') + '>' + MEMBER_STATUS[s] + '</option>'; }).join('');
  openModalShell('lg', (editing ? 'Edit member' : 'Add member'),
    '<button type="button" class="btn btn-sec" onclick="pullMemberFromPassport()" style="width:100%;justify-content:center;gap:8px;margin-bottom:14px;"><span class="ms">cloud_download</span> Pull from FFP Passport</button>' +
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">' +
      '<input type="hidden" id="mm-photo_url" value="' + escHtml(photo) + '">' +
      '<div id="mm-photo" onclick="pickMemberPhoto()" style="width:64px;height:64px;border-radius:12px;flex:0 0 auto;cursor:pointer;background:' + (photo ? ("url('" + escHtml(photo) + "') center/cover no-repeat") : 'var(--ffp-bg-3)') + ';border:1px solid var(--ffp-border-mid);display:flex;align-items:center;justify-content:center;color:var(--ffp-text-dim);overflow:hidden;">' + (photo ? '' : '<span class="ms" style="font-size:24px;">add_a_photo</span>') + '</div>' +
      '<button class="btn btn-sec btn-sm" type="button" id="mm-photo-btn" onclick="pickMemberPhoto()"><span class="ms">photo_camera</span> ' + (photo ? 'Change photo' : 'Add photo') + '</button>' +
    '</div>' +
    '<div class="form-section"><div class="form-section-title">Member</div><div class="form-grid">' +
      '<div class="field"><div class="label">Given names <span class="req">*</span></div><input class="input" id="mm-given_names" value="' + escHtml(gn) + '" placeholder="e.g. Sam"></div>' +
      '<div class="field"><div class="label">Surname</div><input class="input" id="mm-surname" value="' + escHtml(sn) + '" placeholder="e.g. Okafor"></div>' +
      '<div class="field"><div class="label">Email</div><input class="input" id="mm-email" value="' + escHtml(m.email || '') + '" placeholder="name@email.com"></div>' +
      '<div class="field"><div class="label">Phone</div>' + _memPhoneFieldHtml(ph.cc, ph.num) + '</div>' +
      '<div class="field"><div class="label">Status</div><select class="select" id="mm-member_status">' + statusOpts + '</select></div>' +
      '<div class="field"><div class="label">Joined</div><input class="input" type="date" id="mm-join_date" value="' + jd + '"></div>' +
    '</div></div>' +
    '<div class="form-section"><div class="form-section-title">Details</div><div class="form-grid">' +
      '<div class="field"><div class="label">Country</div>' + _memCountryBtnHtml(m.country || '') + '</div>' +
      '<div class="field"><div class="label">City</div>' + _memCityBtnHtml(m.country || '', m.city || '') + '</div>' +
      '<div class="field"><div class="label">Tags</div><input class="input" id="mm-tags" value="' + escHtml(m.tags || '') + '" placeholder="comma,separated, e.g. monthly, pilates"></div>' +
      '<div class="field full"><div class="label">Notes</div><textarea class="textarea" id="mm-notes" rows="2" placeholder="Anything to remember about this member (optional)">' + escHtml(m.notes || '') + '</textarea></div>' +
    '</div></div>',
    (editing ? '<button class="btn btn-ghost left" onclick="confirmDeleteMember(\'' + editing.id + '\')"><span class="ms">delete</span> Delete</button>' : '') +
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-pri" onclick="saveMember(\'' + (editing ? editing.id : '') + '\')">' + (editing ? 'Save changes' : 'Add member') + '</button>'
  );
}

async function saveMember(id) {
  var g = function (i) { var el = document.getElementById('mm-' + i); return el ? el.value.trim() : ''; };
  var given = g('given_names'), surname = g('surname');
  var fullName = (given + ' ' + surname).trim();
  if (!given) { showToast('Given name is required', 'error'); return; }
  var pid = _memProvId();
  if (!pid) { showToast('Not signed in', 'error'); return; }
  var coBtn = document.getElementById('mm-country-btn'), ciBtn = document.getElementById('mm-city-btn');
  var payload = {
    full_name: fullName, given_names: given, surname: surname,
    email: g('email'), phone: _memGetPhone(),
    member_status: g('member_status') || 'active', tags: g('tags'),
    join_date: g('join_date'),
    country: coBtn ? (coBtn.dataset.value || '') : '', city: ciBtn ? (ciBtn.dataset.value || '') : '',
    notes: g('notes'), photo_url: g('photo_url')
  };
  try {
    var r = await window.supabase.rpc('provider_save_member', { p_provider: pid, p_id: id || null, p: payload });
    if (r && r.error) throw r.error;
    showToast(id ? 'Member updated' : 'Member added', 'success');
    closeModal();
    renderMembers();
  } catch (e) { showToast('Could not save member', 'error'); }
}

async function pullMemberFromPassport() {
  var pid = _memProvId();
  var emailEl = document.getElementById('mm-email');
  var email = emailEl ? emailEl.value.trim() : '';
  if (!email) { showToast('Enter the member’s email first', 'error'); if (emailEl) emailEl.focus(); return; }
  if (!pid) { showToast('Not signed in', 'error'); return; }
  try {
    var r = await window.supabase.rpc('provider_passport_by_email', { p_provider: pid, p_email: email });
    if (r && r.error) throw r.error;
    var d = (r && r.data) ? r.data : null;
    if (!d || !d.has_account) { showToast('No FFP Passport account for that email', 'info'); return; }
    var set = function (idf, val) { var el = document.getElementById(idf); if (el && val != null && val !== '') el.value = val; };
    var gn = d.given_names || '', sn = d.surname || '';
    if (!gn && !sn && d.full_name) { var pp = d.full_name.trim().split(/\s+/); sn = pp.length > 1 ? pp.pop() : ''; gn = pp.join(' '); }
    set('mm-given_names', gn); set('mm-surname', sn);
    if (d.phone) { var sp = _memSplitPhone(d.phone); var cc = document.getElementById('mm-phone-cc'), num = document.getElementById('mm-phone-num'); if (cc) cc.value = sp.cc; if (num) num.value = sp.num; }
    if (d.photo_url) { var h = document.getElementById('mm-photo_url'); if (h) h.value = d.photo_url; var slot = document.getElementById('mm-photo'); if (slot) { slot.style.background = "url('" + d.photo_url + "') center/cover no-repeat"; slot.innerHTML = ''; } var pb = document.getElementById('mm-photo-btn'); if (pb) pb.innerHTML = '<span class="ms">photo_camera</span> Change photo'; }
    showToast('Pulled from Passport', 'success');
  } catch (e) { showToast('Could not pull from Passport', 'error'); }
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
      '<div style="width:32px;height:32px;border-radius:8px;background:rgba(25,128,173,.16);color:#6fc6ef;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0;">' + escHtml(initials) + '</div>' +
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

// ════════════════════════════════════════════════════════════════════════
// MEMBERSHIPS & PACKAGES  (Members → Memberships & Packages tab)
// Plans catalog: provider_save_plan / provider_list_plans / provider_delete_plan.
// Assignments:   provider_assign_plan / provider_member_plans / provider_cancel_member_plan.
// ════════════════════════════════════════════════════════════════════════
var _plans = [];
var PLAN_TYPES = { recurring: 'Recurring membership', pack: 'Class pack', term: 'Term membership' };
var _curMembershipMember = null;

async function renderPlans() {
  var host = document.getElementById('plans-list');
  if (!host) return;
  var pid = _memProvId();
  if (!pid) { host.innerHTML = '<div class="empty-sub" style="text-align:left;">Sign in to manage plans.</div>'; return; }
  host.innerHTML = '<div class="psub" style="margin:10px 0;">Loading…</div>';
  try {
    var r = await window.supabase.rpc('provider_list_plans', { p_provider: pid });
    _plans = (r && r.data) ? r.data : [];
  } catch (e) { _plans = []; }
  if (!_plans.length) {
    host.innerHTML = emptyState('No plans yet', 'Create a membership or class-pack, then assign it to members from the Directory.', 'New plan', 'openPlanModal()');
    return;
  }
  host.innerHTML = _plans.map(planRow).join('');
}

function planRow(p) {
  var meta = [PLAN_TYPES[p.plan_type] || 'Plan'];
  if (p.price_aed != null && p.price_aed !== '') meta.push(FFPCurrency.formatProvider(p.price_aed));
  if (p.plan_type === 'pack' && p.credits) meta.push(p.credits + ' credits');
  if (p.period_days) meta.push(p.period_days + ' days');
  var n = p.member_count || 0;
  return '<div style="background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:11px 13px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
      '<div style="min-width:0;">' +
        '<div style="font-weight:800;color:var(--ffp-text,#eaf2f8);">' + escHtml(p.name) + '</div>' +
        '<div class="psub" style="margin:2px 0 0;">' + meta.join(' · ') + '</div>' +
        '<div class="psub" style="margin:2px 0 0;">' + n + ' on this plan</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-shrink:0;">' +
        '<button class="btn btn-sec btn-sm" onclick="openPlanModal(\'' + p.id + '\')"><span class="ms">edit</span></button>' +
        '<button class="btn btn-ghost btn-sm" onclick="confirmDeletePlan(\'' + p.id + '\')"><span class="ms">delete</span></button>' +
      '</div>' +
  '</div>';
}

async function openPlanModal(id) {
  var editing = id ? _plans.find(function (x) { return x.id === id; }) : null;
  var p = editing || { name: '', plan_type: 'recurring', price_aed: '', credits: '', period_days: '', notes: '', pay_requirement: 'optional' };
  var _tpls = [];
  try { var _tr = await window.supabase.rpc('provider_list_session_templates', { p_provider: _memProvId() }); if (_tr && _tr.data) _tpls = _tr.data; } catch (e) {}
  var _selT = (p.template_ids && p.template_ids.length) ? p.template_ids : [];
  var _tplBoxes = _tpls.length
    ? _tpls.map(function (t) { var on = _selT.indexOf(t.id) >= 0; return '<label style="display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid var(--ffp-border-mid,#dbe3ea);border-radius:9px;cursor:pointer;background:' + (on ? 'rgba(25,128,173,0.07)' : 'transparent') + ';"><input type="checkbox" class="pm-works-cb" value="' + t.id + '"' + (on ? ' checked' : '') + ' style="width:17px;height:17px;flex:0 0 auto;cursor:pointer;"><span style="font-size:13px;font-weight:700;">' + escHtml(t.title || 'Session') + '</span></label>'; }).join('')
    : '<div class="psub" style="margin:0;">No sessions yet — create one in Scheduling, then it can be added to this plan.</div>';
  openModalShell('lg', (editing ? 'Edit plan' : 'New plan'), `
    <div class="form-section">
      <div class="form-section-title">Plan</div>
      <div class="form-grid">
        <div class="field full"><div class="label">Plan name <span class="req">*</span></div><input class="input" id="pl-name" value="${escHtml(p.name)}" placeholder="e.g. Monthly Unlimited"></div>
        <div class="field">
          <div class="label">Type</div>
          <select class="select" id="pl-plan_type">
            <option value="recurring"${p.plan_type === 'recurring' ? ' selected' : ''}>Recurring membership</option>
            <option value="pack"${p.plan_type === 'pack' ? ' selected' : ''}>Class pack</option>
            <option value="term"${p.plan_type === 'term' ? ' selected' : ''}>Term membership</option>
          </select>
        </div>
        <div class="field"><div class="label">Price (${FFPCurrency.providerCode()})</div><input class="input" type="number" id="pl-price_aed" value="${escHtml(String(p.price_aed || ''))}" placeholder="e.g. 300"></div>
        <div class="field"><div class="label">Credits <span style="color:var(--ffp-text-dim,#6c7f90);">(class packs)</span></div><input class="input" type="number" id="pl-credits" value="${escHtml(String(p.credits || ''))}" placeholder="e.g. 10"></div>
        <div class="field"><div class="label">Length in days <span style="color:var(--ffp-text-dim,#6c7f90);">(membership/term)</span></div><input class="input" type="number" id="pl-period_days" value="${escHtml(String(p.period_days || ''))}" placeholder="e.g. 30"></div>
        <div class="field full"><div class="label">How is this paid?</div>
          <select class="select" id="pl-pay_requirement">
            <option value="optional"${(p.pay_requirement === 'optional' || !p.pay_requirement) ? ' selected' : ''}>Pay online if available — otherwise you collect it</option>
            <option value="free"${p.pay_requirement === 'free' ? ' selected' : ''}>Free — no payment</option>
            <option value="required"${p.pay_requirement === 'required' ? ' selected' : ''}>Online payment required (needs Stripe)</option>
          </select>
          <div style="font-size:11px;color:var(--ffp-text-dim,#6c7f90);font-weight:600;margin-top:5px;">“Pay online” charges the member through your connected Stripe. Without Stripe, they buy it and you collect / record the payment yourself.</div>
        </div>
        <div class="field full"><div class="label">Works for which sessions?</div>
          <div style="display:flex;flex-direction:column;gap:6px;">${_tplBoxes}</div>
          <div style="font-size:11px;color:var(--ffp-text-dim,#6c7f90);font-weight:600;margin-top:5px;">Tick the sessions this plan can be used for. Leave all unticked to cover every session. (A membership = unlimited; a class pack spends one credit per booking.)</div>
        </div>
        <div class="field full"><div class="label">Notes</div><textarea class="textarea" id="pl-notes" rows="2" placeholder="Optional">${escHtml(p.notes || '')}</textarea></div>
      </div>
    </div>
  `, `
    ${editing ? '<button class="btn btn-ghost left" onclick="confirmDeletePlan(\'' + editing.id + '\')"><span class="ms">delete</span> Delete</button>' : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-pri" onclick="savePlan('${editing ? editing.id : ''}')">${editing ? 'Save changes' : 'Create plan'}</button>
  `);
}

async function savePlan(id) {
  var g = function (i) { var el = document.getElementById('pl-' + i); return el ? el.value.trim() : ''; };
  var name = g('name');
  if (!name) { showToast('Plan name is required', 'error'); return; }
  var pid = _memProvId();
  if (!pid) { showToast('Not signed in', 'error'); return; }
  var tids = Array.prototype.slice.call(document.querySelectorAll('.pm-works-cb')).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
  var payload = { name: name, plan_type: g('plan_type') || 'recurring', price_aed: g('price_aed'), credits: g('credits'), period_days: g('period_days'), notes: g('notes'), pay_requirement: g('pay_requirement') || 'optional', template_ids: tids };
  try {
    var r = await window.supabase.rpc('provider_save_plan', { p_provider: pid, p_id: id || null, p: payload });
    if (r && r.error) throw r.error;
    showToast(id ? 'Plan updated' : 'Plan created', 'success');
    closeModal();
    renderPlans();
  } catch (e) { showToast('Could not save plan', 'error'); }
}

function confirmDeletePlan(id) {
  openModalShell('', 'Delete plan?', '<div class="psub" style="margin:6px 0;">This removes the plan. Members already assigned keep their membership record.</div>', '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doDeletePlan(\'' + id + '\')">Delete</button>');
}

async function doDeletePlan(id) {
  var pid = _memProvId();
  try {
    var r = await window.supabase.rpc('provider_delete_plan', { p_provider: pid, p_id: id });
    if (r && r.error) throw r.error;
    showToast('Plan deleted', 'success');
  } catch (e) { showToast('Could not delete plan', 'error'); }
  closeModal();
  renderPlans();
}

// Manage one member's memberships (assign / view / cancel)
async function openMembership(memberId) {
  var pid = _memProvId();
  if (!pid) return;
  _curMembershipMember = memberId;
  var m = (_members || []).find(function (x) { return x.id === memberId; }) || {};
  if (!_plans.length) {
    try { var rp = await window.supabase.rpc('provider_list_plans', { p_provider: pid }); _plans = (rp && rp.data) ? rp.data : []; } catch (e) {}
  }
  var assigns = [];
  try { var r = await window.supabase.rpc('provider_member_plans', { p_provider: pid, p_member: memberId }); assigns = (r && r.data) ? r.data : []; } catch (e) {}
  var current = assigns.length ? assigns.map(membershipRow).join('') : '<div class="psub" style="margin:6px 0;">No memberships yet.</div>';
  var today = new Date();
  var todayStr = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
  var assignForm;
  if (_plans.length) {
    var opts = _plans.map(function (p) { return '<option value="' + p.id + '">' + escHtml(p.name) + '</option>'; }).join('');
    assignForm = '<div class="form-section"><div class="form-section-title">Assign a plan</div><div class="form-grid">' +
      '<div class="field"><div class="label">Plan</div><select class="select" id="asg-plan">' + opts + '</select></div>' +
      '<div class="field"><div class="label">Start</div><input class="input" type="date" id="asg-start" value="' + todayStr + '"></div>' +
      '<div class="field full"><button class="btn btn-pri" onclick="assignPlan(\'' + memberId + '\')"><span class="ms">add</span> Assign plan</button></div>' +
      '</div></div>';
  } else {
    assignForm = '<div class="psub" style="margin:8px 0;">Create a plan first in the Memberships &amp; Packages tab, then assign it here.</div>';
  }
  openModalShell('lg', 'Membership · ' + escHtml(m.full_name || 'Member'),
    '<div class="form-section"><div class="form-section-title">Current</div>' + current + '</div>' + assignForm,
    '<button class="btn btn-ghost" onclick="closeModal()">Close</button>');
}

function membershipRow(a) {
  var active = a.status === 'active';
  var stColor = active ? 'rgba(25,128,173,.16);color:#6fc6ef' : 'rgba(255,255,255,.08);color:#9fb0bf';
  var bits = [];
  if (a.expiry_date) bits.push('expires ' + a.expiry_date);
  if (a.credits_remaining != null) bits.push(a.credits_remaining + ' credits');
  if (a.start_date) bits.push('from ' + a.start_date);
  return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--ffp-border,#1d3346);">' +
      '<div style="min-width:0;">' +
        '<div style="font-weight:700;color:var(--ffp-text,#eaf2f8);">' + escHtml(a.plan_name || 'Plan') + '</div>' +
        (bits.length ? '<div class="psub" style="margin:2px 0 0;">' + bits.join(' · ') + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">' +
        '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + stColor + '">' + (a.status || 'active') + '</span>' +
        (active ? '<button class="btn btn-ghost btn-sm" onclick="cancelMemberPlan(\'' + a.id + '\')">Cancel</button>' : '') +
      '</div>' +
  '</div>';
}

async function assignPlan(memberId) {
  var pid = _memProvId();
  if (!pid) return;
  var sel = document.getElementById('asg-plan');
  var start = document.getElementById('asg-start');
  if (!sel || !sel.value) { showToast('Pick a plan', 'error'); return; }
  try {
    var r = await window.supabase.rpc('provider_assign_plan', { p_provider: pid, p_member: memberId, p_plan: sel.value, p_start: (start && start.value) ? start.value : null });
    if (r && r.error) throw r.error;
    showToast('Plan assigned', 'success');
    openMembership(memberId);
  } catch (e) { showToast('Could not assign plan', 'error'); }
}

async function cancelMemberPlan(assignId) {
  var pid = _memProvId();
  if (!pid) return;
  try {
    var r = await window.supabase.rpc('provider_cancel_member_plan', { p_provider: pid, p_id: assignId });
    if (r && r.error) throw r.error;
    showToast('Membership cancelled', 'success');
  } catch (e) { showToast('Could not cancel', 'error'); }
  if (_curMembershipMember) openMembership(_curMembershipMember);
}

// ════════════════════════════════════════════════════════════════════════
// COMMUNICATIONS  (Members → Communications tab)
// Compose + target + log only — delivery (email/push/SMS) wired later.
// provider_audience_count / provider_save_broadcast / provider_list_broadcasts /
// provider_delete_broadcast.
// ════════════════════════════════════════════════════════════════════════
var _broadcasts = [];
var COMMS_CHANNELS = { email: 'Email', push: 'Push', sms: 'SMS' };
var COMMS_STATUSES = { active: 'Active', trial: 'Trial', lapsed: 'Lapsed', prospect: 'Prospect' };

function _cmVal(i) { var el = document.getElementById('cm-' + i); return el ? el.value : ''; }

async function renderComms() {
  var host = document.getElementById('comms-list');
  if (!host) return;
  var pid = _memProvId();
  if (!pid) { host.innerHTML = '<div class="empty-sub" style="text-align:left;">Sign in to message members.</div>'; return; }
  host.innerHTML = '<div class="psub" style="margin:10px 0;">Loading…</div>';
  try {
    var r = await window.supabase.rpc('provider_list_broadcasts', { p_provider: pid });
    _broadcasts = (r && r.data) ? r.data : [];
  } catch (e) { _broadcasts = []; }
  if (!_broadcasts.length) {
    host.innerHTML = emptyState('No messages yet', 'Compose an announcement or reminder and choose who it goes to. Delivery switches on when channels are connected.', 'Compose message', 'openComposeModal()');
    return;
  }
  host.innerHTML = _broadcasts.map(broadcastRow).join('');
}

function broadcastRow(b) {
  var when = b.created_at ? String(b.created_at).slice(0, 10) : '';
  var sub = [];
  sub.push(b.audience_label || 'Everyone');
  sub.push((b.recipient_count || 0) + ' recipients');
  sub.push(COMMS_CHANNELS[b.channel] || 'Email');
  if (when) sub.push(when);
  return '<div style="background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:11px 13px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
      '<div style="min-width:0;">' +
        '<div style="font-weight:800;color:var(--ffp-text,#eaf2f8);">' + escHtml(b.subject || '(no subject)') + '</div>' +
        '<div class="psub" style="margin:2px 0 0;">' + sub.map(escHtml).join(' · ') + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:7px;flex-shrink:0;">' +
        '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:rgba(255,255,255,.08);color:#9fb0bf;">Logged</span>' +
        '<button class="btn btn-ghost btn-sm" onclick="confirmDeleteBroadcast(\'' + b.id + '\')"><span class="ms">delete</span></button>' +
      '</div>' +
  '</div>';
}

async function openComposeModal() {
  var pid = _memProvId();
  if (!pid) return;
  if (!_teams.length) {
    try { var rt = await window.supabase.rpc('provider_list_teams', { p_provider: pid }); _teams = (rt && rt.data) ? rt.data : []; } catch (e) {}
  }
  var teamOpts = _teams.map(function (t) { return '<option value="' + t.id + '">' + escHtml(t.name) + '</option>'; }).join('');
  var statusOpts = Object.keys(COMMS_STATUSES).map(function (k) { return '<option value="' + k + '">' + COMMS_STATUSES[k] + '</option>'; }).join('');
  openModalShell('lg', 'Compose message', `
    <div class="form-section">
      <div class="form-section-title">Channel</div>
      <div class="form-grid">
        <div class="field full">
          <select class="select" id="cm-channel">
            <option value="email">Email</option>
            <option value="push">Push notification</option>
            <option value="sms">SMS</option>
          </select>
          <div class="psub" style="margin:6px 2px 0;">Delivery switches on when channels are connected. For now this composes the message and logs who it would reach.</div>
        </div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Audience</div>
      <div class="form-grid">
        <div class="field"><div class="label">Send to</div><select class="select" id="cm-aud-type" onchange="commsAudienceChange()"><option value="all">Everyone</option><option value="team">A team</option><option value="status">By status</option></select></div>
        <div class="field" id="cm-aud-team-wrap" style="display:none;"><div class="label">Team</div><select class="select" id="cm-aud-team" onchange="_updateAudienceCount()">${teamOpts || '<option value="">No teams yet</option>'}</select></div>
        <div class="field" id="cm-aud-status-wrap" style="display:none;"><div class="label">Status</div><select class="select" id="cm-aud-status" onchange="_updateAudienceCount()">${statusOpts}</select></div>
        <div class="field full"><div class="psub" id="cm-count" style="margin:0;">Recipients: …</div></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Message</div>
      <div class="form-grid">
        <div class="field full"><div class="label">Subject</div><input class="input" id="cm-subject" placeholder="e.g. Class cancelled tomorrow"></div>
        <div class="field full"><div class="label">Message</div><textarea class="textarea" id="cm-body" rows="5" placeholder="What do you want to tell them?"></textarea></div>
      </div>
    </div>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-pri" onclick="sendBroadcast()">Save message</button>
  `);
  _updateAudienceCount();
}

function commsAudienceChange() {
  var t = _cmVal('aud-type');
  var tw = document.getElementById('cm-aud-team-wrap');
  var sw = document.getElementById('cm-aud-status-wrap');
  if (tw) tw.style.display = (t === 'team') ? '' : 'none';
  if (sw) sw.style.display = (t === 'status') ? '' : 'none';
  _updateAudienceCount();
}

async function _updateAudienceCount() {
  var pid = _memProvId();
  if (!pid) return;
  var t = _cmVal('aud-type');
  var ref = t === 'team' ? _cmVal('aud-team') : t === 'status' ? _cmVal('aud-status') : '';
  var lbl = document.getElementById('cm-count');
  if (lbl) lbl.textContent = 'Recipients: …';
  try {
    var r = await window.supabase.rpc('provider_audience_count', { p_provider: pid, p_type: t, p_ref: ref });
    var n = (r && r.data != null) ? r.data : 0;
    if (lbl) lbl.textContent = 'Recipients: ' + n;
  } catch (e) { if (lbl) lbl.textContent = 'Recipients: —'; }
}

async function sendBroadcast() {
  var pid = _memProvId();
  if (!pid) return;
  var t = _cmVal('aud-type');
  var ref = '', label = 'Everyone';
  if (t === 'team') {
    ref = _cmVal('aud-team');
    var team = _teams.find(function (x) { return x.id === ref; });
    label = 'Team: ' + (team ? team.name : '');
  } else if (t === 'status') {
    ref = _cmVal('aud-status');
    label = 'Status: ' + (COMMS_STATUSES[ref] || ref);
  }
  var subject = _cmVal('subject').trim();
  var body = _cmVal('body').trim();
  if (!body) { showToast('Write a message first', 'error'); return; }
  var payload = { channel: _cmVal('channel') || 'email', audience_type: t, audience_ref: ref, audience_label: label, subject: subject, body: body };
  try {
    var r = await window.supabase.rpc('provider_save_broadcast', { p_provider: pid, p: payload });
    if (r && r.error) throw r.error;
    showToast('Message saved', 'success');
    closeModal();
    renderComms();
  } catch (e) { showToast('Could not save message', 'error'); }
}

function confirmDeleteBroadcast(id) {
  openModalShell('', 'Delete message?', '<div class="psub" style="margin:6px 0;">This removes it from your message history.</div>', '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doDeleteBroadcast(\'' + id + '\')">Delete</button>');
}

async function doDeleteBroadcast(id) {
  var pid = _memProvId();
  try {
    var r = await window.supabase.rpc('provider_delete_broadcast', { p_provider: pid, p_id: id });
    if (r && r.error) throw r.error;
    showToast('Deleted', 'success');
  } catch (e) { showToast('Could not delete', 'error'); }
  closeModal();
  renderComms();
}

// First open: loaded by showPanel AFTER its synchronous render hook ran, so
// render now if the Members panel (Directory) is on screen.
try { if (document.getElementById('mem-list')) renderMembers(); } catch (e) {}

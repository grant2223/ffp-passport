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

// First open: loaded by showPanel AFTER its synchronous render hook ran, so
// render now if the Members panel (Directory) is on screen.
try { if (document.getElementById('mem-list')) renderMembers(); } catch (e) {}

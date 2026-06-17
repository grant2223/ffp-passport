// ════════════════════════════════════════════════════════════════════════
// FFP Partner Portal — APPOINTMENTS module — v1 (2026-06-16)
// 1-on-1 / coaching appointments, separate from the group-class Sessions timetable.
// Tabs: Calendar (book / check-in / trainer-done / facility-confirm / reschedule / cancel),
//       Services & Coaches (service + per-service tax + coach links w/ % or flat commission),
//       Availability (recurring weekly trainer slots), Packages (catalog + sell + sessions-remaining).
// DB (Phase 1/2): provider_services, provider_service_coaches, provider_trainer_slots,
//   provider_packages, provider_client_packages, provider_appointments + RPCs.
// Coach commission is frozen + released only on facility confirmation (provider_confirm_appointment).
// ════════════════════════════════════════════════════════════════════════
var _apStaff = [], _apServices = [], _apPackages = [], _apSlots = [], _apMembers = [], _apAppts = [];
var _apWeekStart = null;          // Monday 00:00 of the displayed week
var _apClientPkgCache = {};       // member_id -> [active client packages] (for booking)

var DOW_AP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function apProvId() {
  return (window.FFP_PROVIDER && window.FFP_PROVIDER.id) ||
         (typeof providerProfile !== 'undefined' && providerProfile.id) || null;
}
function apEsc(s) {
  if (window.escHtml) return window.escHtml(s);
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function apMoney(n) {
  try { return window.FFPCurrency ? window.FFPCurrency.formatProvider(n) : ('AED ' + (n || 0)); }
  catch (e) { return 'AED ' + (n || 0); }
}
function apCcy() { try { return window.FFPCurrency ? window.FFPCurrency.providerCode() : 'AED'; } catch (e) { return 'AED'; } }
function apToast(m, t) { try { showToast(m, t || 'success'); } catch (e) {} }
function apEnhance(ids) {
  if (!window.FFPSelect) return;
  setTimeout(function () {
    (ids || []).forEach(function (id) { var el = document.getElementById(id); if (el) { try { window.FFPSelect.enhance(el); } catch (e) {} } });
  }, 30);
}
function apMondayOf(d) {
  var x = new Date(d); x.setHours(0, 0, 0, 0);
  var day = x.getDay(); var diff = (day === 0 ? -6 : 1 - day); // make Monday the start
  x.setDate(x.getDate() + diff); return x;
}

// ── entry ──
async function renderAppointments() {
  if (!_apWeekStart) _apWeekStart = apMondayOf(new Date());
  await _apLoadConfig();
  apRenderCalendar();
}

async function _apLoadConfig() {
  var pid = apProvId(); if (!pid) return;
  try {
    var res = await Promise.all([
      window.supabase.rpc('provider_list_staff', { p_provider: pid }),
      window.supabase.rpc('provider_list_services', { p_provider: pid }),
      window.supabase.rpc('provider_list_packages', { p_provider: pid }),
      window.supabase.rpc('provider_list_trainer_slots', { p_provider: pid }),
      window.supabase.rpc('provider_searchable_members', { p_provider: pid, p_q: '' })
    ]);
    _apStaff    = (res[0] && res[0].data) ? res[0].data : [];
    _apServices = (res[1] && res[1].data) ? res[1].data : [];
    _apPackages = (res[2] && res[2].data) ? res[2].data : [];
    _apSlots    = (res[3] && res[3].data) ? res[3].data : [];
    _apMembers  = (res[4] && res[4].data) ? res[4].data : [];
  } catch (e) { /* leave whatever loaded */ }
}

// helper option builders
function _apStaffOpts(sel) {
  return '<option value="">Select a coach…</option>' + _apStaff.map(function (s) {
    return '<option value="' + s.id + '"' + (sel === s.id ? ' selected' : '') + '>' + apEsc(s.full_name || 'Coach') + (s.role ? ' · ' + apEsc(s.role) : '') + '</option>';
  }).join('');
}
function _apServiceOpts(sel, withAny) {
  return (withAny ? '<option value="">Any service</option>' : '<option value="">Select a service…</option>') +
    _apServices.map(function (s) {
      return '<option value="' + s.id + '"' + (sel === s.id ? ' selected' : '') + '>' + apEsc(s.name) + ' · ' + apMoney(s.price_aed) + '</option>';
    }).join('');
}
function _apMemberOpts(sel) {
  return '<option value="">Select a client…</option>' + _apMembers.map(function (m) {
    return '<option value="' + m.member_id + '"' + (sel === m.member_id ? ' selected' : '') + '>' + apEsc(m.full_name || m.email || '—') + '</option>';
  }).join('');
}

// ════════════════════════════════════════════════════════════════════════
// CALENDAR (booked appointments, by day) + week nav + actions
// ════════════════════════════════════════════════════════════════════════
function apShiftWeek(n) { var d = new Date(_apWeekStart); d.setDate(d.getDate() + n * 7); _apWeekStart = apMondayOf(d); apRenderCalendar(); }
function apThisWeek() { _apWeekStart = apMondayOf(new Date()); apRenderCalendar(); }

async function apRenderCalendar() {
  var pid = apProvId();
  var nav = document.getElementById('ap-week-nav');
  var host = document.getElementById('ap-calendar-host');
  if (!host) return;
  if (!_apWeekStart) _apWeekStart = apMondayOf(new Date());
  var end = new Date(_apWeekStart); end.setDate(end.getDate() + 7);
  if (nav) {
    var s = _apWeekStart, e = new Date(end); e.setDate(e.getDate() - 1);
    var label = s.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' – ' + e.toLocaleDateString([], { day: 'numeric', month: 'short' });
    nav.innerHTML =
      '<button class="btn btn-ghost btn-sm" onclick="apShiftWeek(-1)"><span class="ms">chevron_left</span></button>' +
      '<b style="color:var(--ffp-text,#eaf2f8);min-width:130px;text-align:center;display:inline-block;">' + label + '</b>' +
      '<button class="btn btn-ghost btn-sm" onclick="apShiftWeek(1)"><span class="ms">chevron_right</span></button>' +
      '<button class="btn btn-ghost btn-sm" onclick="apThisWeek()">Today</button>';
  }
  host.innerHTML = '<div class="psub" style="margin:10px 0;">Loading…</div>';
  try {
    var r = await window.supabase.rpc('provider_list_appointments', { p_provider: pid, p_from: _apWeekStart.toISOString(), p_to: end.toISOString() });
    _apAppts = (r && r.data) ? r.data : [];
  } catch (e) { _apAppts = []; }

  if (!_apServices.length && !_apStaff.length) {
    host.innerHTML = _apEmpty('Set up your coaching first', 'Add a service and link a coach (Services &amp; Coaches tab), then book appointments here.');
    return;
  }
  if (!_apAppts.length) {
    host.innerHTML = _apEmpty('No appointments this week', 'Use “Book appointment” to schedule a 1-on-1, or jump to another week.');
    return;
  }
  // group by day
  var byDay = {};
  _apAppts.forEach(function (a) {
    var d = new Date(a.start_at); var key = d.toDateString();
    (byDay[key] = byDay[key] || []).push(a);
  });
  var html = '';
  Object.keys(byDay).sort(function (x, y) { return new Date(x) - new Date(y); }).forEach(function (key) {
    var d = new Date(key);
    html += '<div style="margin:16px 0 6px;font-weight:800;color:var(--ffp-text,#eaf2f8);">' +
            d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' }) + '</div>';
    html += byDay[key].map(apApptCard).join('');
  });
  host.innerHTML = html;
}

function _apStatusChip(st) {
  var map = {
    scheduled:         ['Scheduled', '#6fc6ef', 'rgba(43,168,224,.16)'],
    checked_in:        ['Checked in', '#7ee0a8', 'rgba(46,204,113,.15)'],
    completed_pending: ['Awaiting confirm', '#ffcf8f', 'rgba(243,156,18,.16)'],
    completed:         ['Completed', '#7ee0a8', 'rgba(46,204,113,.18)'],
    no_show:           ['No-show', '#ff9b9b', 'rgba(255,107,107,.15)'],
    cancelled:         ['Cancelled', '#cbd6df', 'rgba(255,255,255,.08)']
  };
  var c = map[st] || [st, '#cbd6df', 'rgba(255,255,255,.08)'];
  return '<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;color:' + c[1] + ';background:' + c[2] + ';">' + c[0] + '</span>';
}
function _apPayChip(a) {
  var p = a.payment_status;
  var txt = p === 'package' ? 'Package' : p === 'paid' ? 'Paid' : p === 'comp' ? 'Comp' : 'Unpaid';
  var col = p === 'unpaid' ? ['#ff9b9b', 'rgba(255,107,107,.15)'] : ['#cbd6df', 'rgba(255,255,255,.08)'];
  return '<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;color:' + col[0] + ';background:' + col[1] + ';">' + txt + '</span>';
}

function apApptCard(a) {
  var d = new Date(a.start_at);
  var t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  var dim = (a.status === 'cancelled' || a.status === 'no_show');
  var acts = [];
  if (a.status === 'scheduled') {
    acts.push(_apBtn('apCheckin', a.id, 'how_to_reg', 'Check in', 'btn-sec'));
    acts.push(_apBtn('apTrainerDone', a.id, 'task_alt', 'Mark done', 'btn-ghost'));
    acts.push(_apBtn('apReschedule', a.id, 'edit_calendar', '', 'btn-ghost', 'Reschedule'));
    acts.push(_apBtn('apNoShow', a.id, 'person_off', '', 'btn-ghost', 'No-show'));
    acts.push(_apBtn('apCancel', a.id, 'close', '', 'btn-ghost', 'Cancel'));
  } else if (a.status === 'checked_in') {
    acts.push(_apBtn('apTrainerDone', a.id, 'task_alt', 'Mark done', 'btn-sec'));
    acts.push(_apBtn('apNoShow', a.id, 'person_off', '', 'btn-ghost', 'No-show'));
    acts.push(_apBtn('apCancel', a.id, 'close', '', 'btn-ghost', 'Cancel'));
  } else if (a.status === 'completed_pending') {
    acts.push(_apBtn('apConfirm', a.id, 'verified', 'Confirm completed', 'btn-pri'));
    acts.push(_apBtn('apCancel', a.id, 'close', '', 'btn-ghost', 'Cancel'));
  }
  var payoutLine = '';
  if (a.status === 'completed') {
    payoutLine = '<div class="psub" style="margin:6px 0 0;font-size:12px;">Value ' + apMoney(a.price_aed) +
      ' · tax ' + apMoney(a.tax_aed) + ' · coach ' + apMoney(a.commission_aed) + ' · facility net <b style="color:#7ee0a8;">' + apMoney(a.payout_aed) + '</b></div>';
  } else if (a.status === 'completed_pending') {
    payoutLine = '<div class="psub" style="margin:6px 0 0;font-size:12px;">Trainer marked done — confirm to release coach commission.</div>';
  }
  return '<div style="background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:11px 13px;margin-bottom:9px;' + (dim ? 'opacity:.6;' : '') + '">' +
      '<div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
        '<div style="min-width:54px;font-weight:800;color:var(--ffp-text,#eaf2f8);">' + t + '</div>' +
        '<div style="flex:1;min-width:160px;">' +
          '<div style="font-weight:800;color:var(--ffp-text,#eaf2f8);">' + apEsc(a.member_name || a.member_email || 'Client') + '</div>' +
          '<div class="psub" style="margin:2px 0 0;">' + apEsc(a.service_name || 'Service') + ' · ' + apEsc(a.coach_name || 'Coach') + ' · ' + (a.duration_min || 60) + ' min</div>' +
          payoutLine +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">' +
          '<div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;">' + _apStatusChip(a.status) + _apPayChip(a) + '</div>' +
        '</div>' +
      '</div>' +
      (acts.length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;justify-content:flex-end;">' + acts.join('') + '</div>' : '') +
  '</div>';
}
function _apBtn(fn, id, icon, label, cls, title) {
  return '<button class="btn ' + (cls || 'btn-ghost') + ' btn-sm"' + (title ? ' title="' + title + '"' : '') +
    ' onclick="' + fn + '(\'' + id + '\')"><span class="ms">' + icon + '</span>' + (label ? ' ' + label : '') + '</button>';
}
function _apEmpty(title, sub) {
  return '<div style="text-align:center;padding:30px 16px;border:1px dashed var(--ffp-border,#1d3346);border-radius:12px;">' +
    '<div style="font-weight:800;color:var(--ffp-text,#eaf2f8);">' + title + '</div>' +
    '<div class="psub" style="margin:6px 0 0;">' + sub + '</div></div>';
}

// ── calendar action handlers ──
async function _apRpc(fn, args, okMsg) {
  var pid = apProvId();
  try {
    var r = await window.supabase.rpc(fn, args);
    if (r && r.error) throw r.error;
    var res = (r && r.data) ? r.data : null;
    if (res && res.ok === false) {
      var em = {
        coach_busy: 'That coach already has a session at this time',
        no_sessions_left: 'No sessions left on that package',
        package_expired: 'That package has expired',
        no_package_selected: 'Pick which package to use',
        bad_state: 'That action isn’t available for this appointment',
        already_booked: 'Already booked'
      };
      apToast(em[res.error] || 'Could not complete that', 'error');
      return null;
    }
    if (okMsg) apToast(okMsg, 'success');
    return res || { ok: true };
  } catch (e) { apToast('Something went wrong', 'error'); return null; }
}
async function apCheckin(id)     { if (await _apRpc('provider_checkin_appointment', { p_provider: apProvId(), p_id: id }, 'Checked in')) apRenderCalendar(); }
async function apTrainerDone(id) {
  var a = _apAppts.find(function (x) { return x.id === id; }) || {};
  if (await _apRpc('provider_trainer_complete_appointment', { p_provider: apProvId(), p_id: id, p_staff: a.staff_id || null }, 'Marked done — awaiting facility confirmation')) apRenderCalendar();
}
async function apConfirm(id) {
  var by = (window.FFP_PROVIDER && window.FFP_PROVIDER.name) || 'Facility';
  var res = await _apRpc('provider_confirm_appointment', { p_provider: apProvId(), p_id: id, p_by: by }, 'Session confirmed — commission released');
  if (res) apRenderCalendar();
}
async function apNoShow(id) {
  if (!confirm('Mark this appointment as a no-show? The package session stays used.')) return;
  if (await _apRpc('provider_appointment_no_show', { p_provider: apProvId(), p_id: id, p_restore: false }, 'Marked no-show')) apRenderCalendar();
}
async function apCancel(id) {
  if (!confirm('Cancel this appointment? If it used a package session it will be credited back.')) return;
  if (await _apRpc('provider_cancel_appointment', { p_provider: apProvId(), p_id: id, p_restore: true }, 'Appointment cancelled')) apRenderCalendar();
}

// ── reschedule ──
function apReschedule(id) {
  var a = _apAppts.find(function (x) { return x.id === id; }) || {};
  var local = _apToLocalInput(a.start_at);
  var body =
    '<div class="form-section"><div class="form-grid">' +
      '<div class="field"><div class="label">New date &amp; time</div><input class="input" type="datetime-local" id="ap-rs-when" value="' + local + '"></div>' +
      '<div class="field"><div class="label">Coach</div><select class="select" id="ap-rs-coach">' + _apStaffOpts(a.staff_id) + '</select></div>' +
    '</div></div>';
  openModalShell('', 'Reschedule appointment',
    '<div class="psub" style="margin:0 0 10px;">' + apEsc(a.member_name || 'Client') + ' · ' + apEsc(a.service_name || '') + '</div>' + body,
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="apSaveReschedule(\'' + id + '\')">Save</button>');
  apEnhance(['ap-rs-coach']);
}
async function apSaveReschedule(id) {
  var when = (document.getElementById('ap-rs-when') || {}).value;
  var coach = (document.getElementById('ap-rs-coach') || {}).value || null;
  if (!when) { apToast('Pick a date and time', 'error'); return; }
  var iso = _apToISO(when);
  var res = await _apRpc('provider_reschedule_appointment', { p_provider: apProvId(), p_id: id, p_start: iso, p_staff: coach, p_duration: null }, 'Rescheduled');
  if (res) { closeModal(); apRenderCalendar(); }
}
function _apToLocalInput(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function _apToISO(localVal) {
  try { if (window.FFPTime && window.FFPTime.toUTC) return window.FFPTime.toUTC(localVal); } catch (e) {}
  return new Date(localVal).toISOString();
}

// ════════════════════════════════════════════════════════════════════════
// BOOK APPOINTMENT
// ════════════════════════════════════════════════════════════════════════
function apBookModal(prefillStart) {
  if (!_apServices.length) { apToast('Add a service first (Services & Coaches tab)', 'error'); return; }
  if (!_apStaff.length) { apToast('Add a coach in Staff first', 'error'); return; }
  var when = prefillStart || _apToLocalInput(new Date(Date.now() + 3600000).toISOString());
  var body =
    '<div class="form-section"><div class="form-grid">' +
      '<div class="field"><div class="label">Service <span class="req">*</span></div><select class="select" id="ap-bk-service" onchange="apBkServiceChange()">' + _apServiceOpts('') + '</select></div>' +
      '<div class="field"><div class="label">Coach <span class="req">*</span></div><select class="select" id="ap-bk-coach">' + _apStaffOpts('') + '</select></div>' +
      '<div class="field"><div class="label">Client <span class="req">*</span></div><select class="select" id="ap-bk-client" onchange="apBkClientChange()">' + _apMemberOpts('') + '</select></div>' +
      '<div class="field"><div class="label">Date &amp; time <span class="req">*</span></div><input class="input" type="datetime-local" id="ap-bk-when" value="' + when + '"></div>' +
      '<div class="field"><div class="label">Duration (min)</div><input class="input" type="number" min="5" step="5" id="ap-bk-duration" value="60"></div>' +
      '<div class="field"><div class="label">Payment</div><select class="select" id="ap-bk-pay" onchange="apBkPayChange()">' +
        '<option value="package">Use a package</option><option value="cash">Cash</option><option value="card">Card</option><option value="comp">Comp (free)</option><option value="unpaid">Unpaid / bill later</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="field" id="ap-bk-pkg-wrap" style="margin-top:10px;"><div class="label">Package to use</div><select class="select" id="ap-bk-pkg"><option value="">Select a client first…</option></select></div>' +
    '<div class="field" style="margin-top:10px;"><div class="label">Notes <span class="label-hint">— optional</span></div><input class="input" id="ap-bk-notes" placeholder="Anything the coach should know"></div>' +
    '</div>';
  openModalShell('lg', 'Book appointment', body,
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="apSaveBooking()"><span class="ms">event_available</span> Book</button>');
  apEnhance(['ap-bk-service', 'ap-bk-coach', 'ap-bk-client', 'ap-bk-pay', 'ap-bk-pkg']);
}
function apBkServiceChange() {
  var sid = (document.getElementById('ap-bk-service') || {}).value;
  var sv = _apServices.find(function (s) { return s.id === sid; });
  if (sv) {
    var dur = document.getElementById('ap-bk-duration'); if (dur && sv.duration_min) dur.value = sv.duration_min;
    // narrow coach list to linked coaches if any
    var coachSel = document.getElementById('ap-bk-coach');
    if (coachSel && sv.coaches && sv.coaches.length) {
      coachSel.innerHTML = '<option value="">Select a coach…</option>' + sv.coaches.map(function (c) {
        return '<option value="' + c.staff_id + '">' + apEsc(c.coach_name) + '</option>';
      }).join('');
      if (window.FFPSelect) { try { window.FFPSelect.enhance(coachSel); } catch (e) {} }
    }
  }
}
function apBkClientChange() { apRefreshBkPackages(); }
function apBkPayChange() {
  var wrap = document.getElementById('ap-bk-pkg-wrap');
  var pay = (document.getElementById('ap-bk-pay') || {}).value;
  if (wrap) wrap.style.display = (pay === 'package') ? '' : 'none';
  if (pay === 'package') apRefreshBkPackages();
}
async function apRefreshBkPackages() {
  var pay = (document.getElementById('ap-bk-pay') || {}).value;
  if (pay !== 'package') return;
  var mid = (document.getElementById('ap-bk-client') || {}).value;
  var sel = document.getElementById('ap-bk-pkg'); if (!sel) return;
  if (!mid) { sel.innerHTML = '<option value="">Select a client first…</option>'; return; }
  sel.innerHTML = '<option value="">Loading…</option>';
  var list = [];
  try {
    var r = await window.supabase.rpc('provider_list_client_packages', { p_provider: apProvId(), p_member: mid });
    list = ((r && r.data) ? r.data : []).filter(function (p) { return p.status === 'active' && p.sessions_remaining > 0; });
  } catch (e) {}
  _apClientPkgCache[mid] = list;
  if (!list.length) { sel.innerHTML = '<option value="">No active package — choose another payment</option>'; }
  else {
    sel.innerHTML = list.map(function (p) {
      return '<option value="' + p.id + '">' + apEsc(p.name || 'Package') + ' · ' + p.sessions_remaining + '/' + p.sessions_total + ' left</option>';
    }).join('');
  }
  if (window.FFPSelect) { try { window.FFPSelect.enhance(sel); } catch (e) {} }
}
async function apSaveBooking() {
  var service = (document.getElementById('ap-bk-service') || {}).value;
  var coach = (document.getElementById('ap-bk-coach') || {}).value;
  var client = (document.getElementById('ap-bk-client') || {}).value;
  var when = (document.getElementById('ap-bk-when') || {}).value;
  var dur = parseInt((document.getElementById('ap-bk-duration') || {}).value, 10) || 60;
  var pay = (document.getElementById('ap-bk-pay') || {}).value;
  var pkg = (document.getElementById('ap-bk-pkg') || {}).value;
  var notes = (document.getElementById('ap-bk-notes') || {}).value;
  if (!service || !coach || !client || !when) { apToast('Service, coach, client and time are required', 'error'); return; }
  if (pay === 'package' && !pkg) { apToast('Pick which package to use (or change the payment method)', 'error'); return; }
  var payload = {
    staff_id: coach, service_id: service, member_id: client, start_at: _apToISO(when),
    duration_min: dur, pay_with: pay, notes: notes
  };
  if (pay === 'package') payload.client_package_id = pkg;
  var res = await _apRpc('provider_book_appointment', { p_provider: apProvId(), p: payload }, 'Appointment booked');
  if (res) { closeModal(); apRenderCalendar(); }
}

// ════════════════════════════════════════════════════════════════════════
// SERVICES & COACHES
// ════════════════════════════════════════════════════════════════════════
function apRenderServices() {
  var host = document.getElementById('ap-services-host'); if (!host) return;
  if (!_apServices.length) { host.innerHTML = _apEmpty('No services yet', 'Add a service like “Personal Training (60 min)”, then link the coaches who deliver it.'); return; }
  host.innerHTML = _apServices.map(function (s) {
    var coaches = (s.coaches || []).map(function (c) {
      var comm = c.commission_type === 'flat' ? (apMoney(c.commission_value) + ' flat') : (c.commission_value + '%');
      return '<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 9px;border-radius:999px;color:#cbd6df;background:rgba(255,255,255,.06);margin:3px 4px 0 0;">' +
        apEsc(c.coach_name) + ' · ' + comm +
        '<button class="lk-x" title="Remove" onclick="apRemoveCoach(\'' + c.link_id + '\')" style="background:none;border:none;color:#ff9b9b;cursor:pointer;font-weight:800;">×</button></span>';
    }).join('');
    return '<div style="background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:13px 15px;margin-bottom:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">' +
        '<div style="min-width:180px;">' +
          '<div style="font-weight:800;color:var(--ffp-text,#eaf2f8);">' + apEsc(s.name) + (s.status !== 'active' ? ' <span class="psub">(inactive)</span>' : '') + '</div>' +
          '<div class="psub" style="margin:2px 0 0;">' + apMoney(s.price_aed) + ' · ' + (s.duration_min || 60) + ' min · tax ' + (s.tax_rate || 0) + '%' + (s.capacity > 1 ? ' · up to ' + s.capacity : '') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;">' +
          '<button class="btn btn-sec btn-sm" onclick="apServiceModal(\'' + s.id + '\')"><span class="ms">edit</span></button>' +
          '<button class="btn btn-ghost btn-sm" onclick="apDeleteService(\'' + s.id + '\')"><span class="ms">delete</span></button>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:10px;">' +
        '<div class="psub" style="margin:0 0 4px;">Coaches &amp; commission</div>' +
        (coaches || '<span class="psub">No coaches linked yet.</span>') +
        '<div style="margin-top:8px;"><button class="btn btn-ghost btn-sm" onclick="apAddCoachModal(\'' + s.id + '\')"><span class="ms">person_add</span> Link a coach</button></div>' +
      '</div>' +
    '</div>';
  }).join('');
}
function apServiceModal(id) {
  var s = _apServices.find(function (x) { return x.id === id; }) || { name: '', service_type: 'one_on_one', price_aed: '', duration_min: 60, capacity: 1, tax_rate: '', status: 'active' };
  var types = [['one_on_one', '1-on-1'], ['group', 'Group'], ['assessment', 'Assessment'], ['other', 'Other']];
  var body =
    '<div class="form-section"><div class="form-grid">' +
      '<div class="field" style="grid-column:1/-1;"><div class="label">Service name <span class="req">*</span></div><input class="input" id="ap-sv-name" value="' + apEsc(s.name) + '" placeholder="e.g. Personal Training (60 min)"></div>' +
      '<div class="field"><div class="label">Type</div><select class="select" id="ap-sv-type">' + types.map(function (t) { return '<option value="' + t[0] + '"' + (s.service_type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><div class="label">Price (' + apCcy() + ') <span class="req">*</span></div><input class="input" type="number" min="0" id="ap-sv-price" value="' + apEsc(String(s.price_aed || '')) + '" placeholder="0 = free"></div>' +
      '<div class="field"><div class="label">Duration (min)</div><input class="input" type="number" min="5" step="5" id="ap-sv-duration" value="' + apEsc(String(s.duration_min || 60)) + '"></div>' +
      '<div class="field"><div class="label">Tax rate (%)</div><input class="input" type="number" min="0" step="0.5" id="ap-sv-tax" value="' + apEsc(String(s.tax_rate || '')) + '" placeholder="e.g. 5"></div>' +
      '<div class="field"><div class="label">Capacity</div><input class="input" type="number" min="1" id="ap-sv-capacity" value="' + apEsc(String(s.capacity || 1)) + '"></div>' +
      '<div class="field"><div class="label">Status</div><select class="select" id="ap-sv-status"><option value="active"' + (s.status === 'active' ? ' selected' : '') + '>Active</option><option value="inactive"' + (s.status !== 'active' ? ' selected' : '') + '>Inactive</option></select></div>' +
    '</div></div>';
  openModalShell('', id ? 'Edit service' : 'Add service', body,
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="apSaveService(\'' + (id || '') + '\')">Save</button>');
  apEnhance(['ap-sv-type', 'ap-sv-status']);
}
async function apSaveService(id) {
  var name = (document.getElementById('ap-sv-name') || {}).value.trim();
  if (!name) { apToast('Service name is required', 'error'); return; }
  var p = {
    name: name, service_type: (document.getElementById('ap-sv-type') || {}).value,
    price_aed: (document.getElementById('ap-sv-price') || {}).value || '0',
    duration_min: (document.getElementById('ap-sv-duration') || {}).value || '60',
    tax_rate: (document.getElementById('ap-sv-tax') || {}).value || '0',
    capacity: (document.getElementById('ap-sv-capacity') || {}).value || '1',
    status: (document.getElementById('ap-sv-status') || {}).value || 'active'
  };
  var r = await _apRpc('provider_save_service', { p_provider: apProvId(), p_id: id || null, p: p }, 'Service saved');
  if (r) { closeModal(); await _apLoadConfig(); apRenderServices(); }
}
async function apDeleteService(id) {
  if (!confirm('Delete this service? Its coach links are removed too. Past appointments are kept.')) return;
  var r = await _apRpc('provider_delete_service', { p_provider: apProvId(), p_id: id }, 'Service deleted');
  if (r) { await _apLoadConfig(); apRenderServices(); }
}
function apAddCoachModal(serviceId) {
  if (!_apStaff.length) { apToast('Add a coach in Staff first', 'error'); return; }
  var body =
    '<div class="form-section"><div class="form-grid">' +
      '<div class="field" style="grid-column:1/-1;"><div class="label">Coach <span class="req">*</span></div><select class="select" id="ap-cc-staff">' + _apStaffOpts('') + '</select></div>' +
      '<div class="field"><div class="label">Commission type</div><select class="select" id="ap-cc-type" onchange="apCcTypeChange()"><option value="percent">% of session price</option><option value="flat">Flat amount</option></select></div>' +
      '<div class="field"><div class="label"><span id="ap-cc-vlabel">Percentage (%)</span></div><input class="input" type="number" min="0" step="0.5" id="ap-cc-value" value="" placeholder="e.g. 60"></div>' +
    '</div></div>';
  openModalShell('', 'Link a coach', body,
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="apSaveCoach(\'' + serviceId + '\')">Link</button>');
  apEnhance(['ap-cc-staff', 'ap-cc-type']);
}
function apCcTypeChange() {
  var t = (document.getElementById('ap-cc-type') || {}).value;
  var l = document.getElementById('ap-cc-vlabel'); if (l) l.textContent = (t === 'flat') ? ('Flat amount (' + apCcy() + ')') : 'Percentage (%)';
}
async function apSaveCoach(serviceId) {
  var staff = (document.getElementById('ap-cc-staff') || {}).value;
  var type = (document.getElementById('ap-cc-type') || {}).value || 'percent';
  var val = parseFloat((document.getElementById('ap-cc-value') || {}).value) || 0;
  if (!staff) { apToast('Pick a coach', 'error'); return; }
  var r = await _apRpc('provider_save_service_coach', { p_provider: apProvId(), p_service: serviceId, p_staff: staff, p_commission_type: type, p_commission_value: val }, 'Coach linked');
  if (r) { closeModal(); await _apLoadConfig(); apRenderServices(); }
}
async function apRemoveCoach(linkId) {
  var r = await _apRpc('provider_delete_service_coach', { p_provider: apProvId(), p_link: linkId }, 'Coach unlinked');
  if (r) { await _apLoadConfig(); apRenderServices(); }
}

// ════════════════════════════════════════════════════════════════════════
// AVAILABILITY (recurring trainer slots)
// ════════════════════════════════════════════════════════════════════════
function apRenderAvailability() {
  var host = document.getElementById('ap-availability-host'); if (!host) return;
  if (!_apSlots.length) { host.innerHTML = _apEmpty('No availability set', 'Add the weekly day/time slots each trainer is available for appointments.'); return; }
  // group by coach
  var byCoach = {};
  _apSlots.forEach(function (s) { (byCoach[s.coach_name || 'Coach'] = byCoach[s.coach_name || 'Coach'] || []).push(s); });
  var html = '';
  Object.keys(byCoach).sort().forEach(function (name) {
    html += '<div style="margin:6px 0 4px;font-weight:800;color:var(--ffp-text,#eaf2f8);">' + apEsc(name) + '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">' + byCoach[name].map(function (s) {
      return '<span style="display:inline-flex;align-items:center;gap:8px;background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:10px;padding:7px 11px;">' +
        '<b style="color:var(--ffp-text,#eaf2f8);">' + DOW_AP[s.day_of_week] + ' ' + s.slot_time + '</b>' +
        '<span class="psub">' + (s.service_name ? apEsc(s.service_name) : 'Any') + ' · ' + (s.duration_min || 60) + 'm</span>' +
        '<button class="btn btn-ghost btn-sm" onclick="apSlotModal(\'' + s.id + '\')"><span class="ms">edit</span></button>' +
        '<button class="btn btn-ghost btn-sm" onclick="apDeleteSlot(\'' + s.id + '\')"><span class="ms">delete</span></button>' +
      '</span>';
    }).join('') + '</div>';
  });
  host.innerHTML = html;
}
function apSlotModal(id) {
  if (!_apStaff.length) { apToast('Add a coach in Staff first', 'error'); return; }
  var s = _apSlots.find(function (x) { return x.id === id; }) || { staff_id: '', service_id: '', day_of_week: 1, slot_time: '09:00', duration_min: 60, status: 'active' };
  var dows = [1, 2, 3, 4, 5, 6, 0];
  var body =
    '<div class="form-section"><div class="form-grid">' +
      '<div class="field"><div class="label">Coach <span class="req">*</span></div><select class="select" id="ap-sl-staff">' + _apStaffOpts(s.staff_id) + '</select></div>' +
      '<div class="field"><div class="label">Service <span class="label-hint">— optional</span></div><select class="select" id="ap-sl-service">' + _apServiceOpts(s.service_id, true) + '</select></div>' +
      '<div class="field"><div class="label">Day</div><select class="select" id="ap-sl-dow">' + dows.map(function (d) { return '<option value="' + d + '"' + (s.day_of_week === d ? ' selected' : '') + '>' + DOW_AP[d] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><div class="label">Time</div><input class="input" type="time" id="ap-sl-time" value="' + apEsc(s.slot_time || '09:00') + '"></div>' +
      '<div class="field"><div class="label">Duration (min)</div><input class="input" type="number" min="5" step="5" id="ap-sl-duration" value="' + apEsc(String(s.duration_min || 60)) + '"></div>' +
    '</div></div>';
  openModalShell('', id ? 'Edit slot' : 'Add availability slot', body,
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="apSaveSlot(\'' + (id || '') + '\')">Save</button>');
  apEnhance(['ap-sl-staff', 'ap-sl-service', 'ap-sl-dow']);
}
async function apSaveSlot(id) {
  var staff = (document.getElementById('ap-sl-staff') || {}).value;
  var time = (document.getElementById('ap-sl-time') || {}).value;
  if (!staff || !time) { apToast('Coach and time are required', 'error'); return; }
  var p = {
    staff_id: staff, service_id: (document.getElementById('ap-sl-service') || {}).value || '',
    day_of_week: (document.getElementById('ap-sl-dow') || {}).value, slot_time: time,
    duration_min: (document.getElementById('ap-sl-duration') || {}).value || '60'
  };
  var r = await _apRpc('provider_save_trainer_slot', { p_provider: apProvId(), p_id: id || null, p: p }, 'Slot saved');
  if (r) { closeModal(); await _apLoadConfig(); apRenderAvailability(); }
}
async function apDeleteSlot(id) {
  if (!confirm('Delete this availability slot?')) return;
  var r = await _apRpc('provider_delete_trainer_slot', { p_provider: apProvId(), p_id: id }, 'Slot deleted');
  if (r) { await _apLoadConfig(); apRenderAvailability(); }
}

// ════════════════════════════════════════════════════════════════════════
// PACKAGES (catalog + sell + client packages with sessions remaining)
// ════════════════════════════════════════════════════════════════════════
async function apRenderPackages() {
  var host = document.getElementById('ap-packages-host');
  var chost = document.getElementById('ap-client-packages-host');
  if (host) {
    if (!_apPackages.length) { host.innerHTML = _apEmpty('No packages yet', 'Create a package like “10 PT Sessions” that clients can buy.'); }
    else {
      host.innerHTML = _apPackages.map(function (p) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:12px 14px;margin-bottom:9px;flex-wrap:wrap;">' +
          '<div style="min-width:180px;"><div style="font-weight:800;color:var(--ffp-text,#eaf2f8);">' + apEsc(p.name) + (p.status !== 'active' ? ' <span class="psub">(inactive)</span>' : '') + '</div>' +
          '<div class="psub" style="margin:2px 0 0;">' + p.sessions_count + ' sessions · ' + apMoney(p.price_aed) + ' · tax ' + (p.tax_rate || 0) + '%' + (p.service_name ? ' · ' + apEsc(p.service_name) : ' · any service') + (p.validity_days ? ' · valid ' + p.validity_days + 'd' : '') + '</div></div>' +
          '<div style="display:flex;gap:6px;">' +
            '<button class="btn btn-sec btn-sm" onclick="apSellModal(\'' + p.id + '\')"><span class="ms">sell</span> Sell</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="apPackageModal(\'' + p.id + '\')"><span class="ms">edit</span></button>' +
            '<button class="btn btn-ghost btn-sm" onclick="apDeletePackage(\'' + p.id + '\')"><span class="ms">delete</span></button>' +
          '</div></div>';
      }).join('');
    }
  }
  if (chost) {
    chost.innerHTML = '<div class="psub" style="margin:8px 0;">Loading…</div>';
    var list = [];
    try { var r = await window.supabase.rpc('provider_list_client_packages', { p_provider: apProvId() }); list = (r && r.data) ? r.data : []; } catch (e) {}
    if (!list.length) { chost.innerHTML = '<div class="psub" style="margin:6px 0;">No client packages sold yet.</div>'; }
    else {
      chost.innerHTML = list.map(function (cp) {
        var pct = cp.sessions_total ? Math.round(100 * cp.sessions_remaining / cp.sessions_total) : 0;
        var low = cp.sessions_remaining <= 1;
        var statusTxt = cp.status === 'active' ? '' : ' · ' + cp.status;
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:11px 14px;margin-bottom:8px;flex-wrap:wrap;">' +
          '<div style="min-width:170px;"><div style="font-weight:700;color:var(--ffp-text,#eaf2f8);">' + apEsc(cp.member_name || cp.member_email || '—') + '</div>' +
          '<div class="psub" style="margin:2px 0 0;">' + apEsc(cp.name || 'Package') + (cp.expiry_date ? ' · exp ' + cp.expiry_date : '') + statusTxt + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div style="width:120px;height:7px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + (low ? '#f39c12' : '#2ba8e0') + ';"></div></div>' +
            '<b style="color:' + (low ? '#ffcf8f' : 'var(--ffp-text,#eaf2f8)') + ';min-width:54px;text-align:right;">' + cp.sessions_remaining + ' / ' + cp.sessions_total + '</b>' +
          '</div></div>';
      }).join('');
    }
  }
}
function apPackageModal(id) {
  var p = _apPackages.find(function (x) { return x.id === id; }) || { name: '', service_id: '', sessions_count: 10, price_aed: '', tax_rate: '', validity_days: '', status: 'active' };
  var body =
    '<div class="form-section"><div class="form-grid">' +
      '<div class="field" style="grid-column:1/-1;"><div class="label">Package name <span class="req">*</span></div><input class="input" id="ap-pk-name" value="' + apEsc(p.name) + '" placeholder="e.g. 10 PT Sessions"></div>' +
      '<div class="field"><div class="label">Service <span class="label-hint">— optional</span></div><select class="select" id="ap-pk-service">' + _apServiceOpts(p.service_id, true) + '</select></div>' +
      '<div class="field"><div class="label">Sessions <span class="req">*</span></div><input class="input" type="number" min="1" id="ap-pk-sessions" value="' + apEsc(String(p.sessions_count || 1)) + '"></div>' +
      '<div class="field"><div class="label">Price (' + apCcy() + ')</div><input class="input" type="number" min="0" id="ap-pk-price" value="' + apEsc(String(p.price_aed || '')) + '"></div>' +
      '<div class="field"><div class="label">Tax rate (%)</div><input class="input" type="number" min="0" step="0.5" id="ap-pk-tax" value="' + apEsc(String(p.tax_rate || '')) + '"></div>' +
      '<div class="field"><div class="label">Validity (days) <span class="label-hint">— blank = no expiry</span></div><input class="input" type="number" min="1" id="ap-pk-validity" value="' + apEsc(String(p.validity_days || '')) + '"></div>' +
      '<div class="field"><div class="label">Status</div><select class="select" id="ap-pk-status"><option value="active"' + (p.status === 'active' ? ' selected' : '') + '>Active</option><option value="inactive"' + (p.status !== 'active' ? ' selected' : '') + '>Inactive</option></select></div>' +
    '</div></div>';
  openModalShell('', id ? 'Edit package' : 'Add package', body,
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="apSavePackage(\'' + (id || '') + '\')">Save</button>');
  apEnhance(['ap-pk-service', 'ap-pk-status']);
}
async function apSavePackage(id) {
  var name = (document.getElementById('ap-pk-name') || {}).value.trim();
  if (!name) { apToast('Package name is required', 'error'); return; }
  var p = {
    name: name, service_id: (document.getElementById('ap-pk-service') || {}).value || '',
    sessions_count: (document.getElementById('ap-pk-sessions') || {}).value || '1',
    price_aed: (document.getElementById('ap-pk-price') || {}).value || '0',
    tax_rate: (document.getElementById('ap-pk-tax') || {}).value || '0',
    validity_days: (document.getElementById('ap-pk-validity') || {}).value || '',
    status: (document.getElementById('ap-pk-status') || {}).value || 'active'
  };
  var r = await _apRpc('provider_save_package', { p_provider: apProvId(), p_id: id || null, p: p }, 'Package saved');
  if (r) { closeModal(); await _apLoadConfig(); apRenderPackages(); }
}
async function apDeletePackage(id) {
  if (!confirm('Delete this package? Already-sold client packages are kept.')) return;
  var r = await _apRpc('provider_delete_package', { p_provider: apProvId(), p_id: id }, 'Package deleted');
  if (r) { await _apLoadConfig(); apRenderPackages(); }
}
function apSellModal(packageId) {
  if (!_apPackages.length) { apToast('Create a package first', 'error'); return; }
  var pkgOpts = _apPackages.filter(function (p) { return p.status === 'active'; }).map(function (p) {
    return '<option value="' + p.id + '"' + (packageId === p.id ? ' selected' : '') + '>' + apEsc(p.name) + ' · ' + p.sessions_count + ' sessions · ' + apMoney(p.price_aed) + '</option>';
  }).join('');
  var body =
    '<div class="form-section"><div class="form-grid">' +
      '<div class="field" style="grid-column:1/-1;"><div class="label">Client <span class="req">*</span></div><select class="select" id="ap-sell-client">' + _apMemberOpts('') + '</select></div>' +
      '<div class="field" style="grid-column:1/-1;"><div class="label">Package <span class="req">*</span></div><select class="select" id="ap-sell-pkg">' + pkgOpts + '</select></div>' +
      '<div class="field"><div class="label">Payment taken</div><select class="select" id="ap-sell-pay"><option value="cash">Cash</option><option value="card">Card</option><option value="online">Online</option><option value="comp">Comp</option></select></div>' +
    '</div>' +
    '<div class="psub" style="margin-top:6px;">This records the sale and credits the sessions to the client. Each booked appointment counts one down.</div>' +
    '</div>';
  openModalShell('', 'Sell a package', body,
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="apDoSell()"><span class="ms">sell</span> Sell</button>');
  apEnhance(['ap-sell-client', 'ap-sell-pkg', 'ap-sell-pay']);
}
async function apDoSell() {
  var client = (document.getElementById('ap-sell-client') || {}).value;
  var pkg = (document.getElementById('ap-sell-pkg') || {}).value;
  var pay = (document.getElementById('ap-sell-pay') || {}).value || 'cash';
  if (!client || !pkg) { apToast('Pick a client and a package', 'error'); return; }
  var r = await _apRpc('provider_sell_package', { p_provider: apProvId(), p_member: client, p_package: pkg, p_pay_with: pay }, 'Package sold');
  if (r) { closeModal(); apRenderPackages(); }
}

// ════════════════════════════════════════════════════════════════════════
// REPORTS (completed sessions, revenue, tax, commission, net — by coach & service)
// ════════════════════════════════════════════════════════════════════════
function _apRangeBounds(key) {
  var now = new Date(), from = null, to = null;
  var startOfMonth = function (y, m) { return new Date(y, m, 1, 0, 0, 0); };
  if (key === 'this_month') { from = startOfMonth(now.getFullYear(), now.getMonth()); to = startOfMonth(now.getFullYear(), now.getMonth() + 1); }
  else if (key === 'last_month') { from = startOfMonth(now.getFullYear(), now.getMonth() - 1); to = startOfMonth(now.getFullYear(), now.getMonth()); }
  else if (key === 'last_30') { to = new Date(now.getTime() + 86400000); from = new Date(now.getTime() - 30 * 86400000); }
  else if (key === 'this_year') { from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear() + 1, 0, 1); }
  else { from = null; to = null; } // all time
  return { from: from ? from.toISOString() : null, to: to ? to.toISOString() : null };
}
async function apRenderReports() {
  var host = document.getElementById('ap-reports-host'); if (!host) return;
  var key = (document.getElementById('ap-rep-range') || {}).value || 'this_month';
  var b = _apRangeBounds(key);
  host.innerHTML = '<div class="psub" style="margin:10px 0;">Loading…</div>';
  var rep = null;
  try {
    var r = await window.supabase.rpc('provider_appointments_report', { p_provider: apProvId(), p_from: b.from, p_to: b.to });
    rep = (r && r.data) ? r.data : null;
  } catch (e) {}
  if (!rep) { host.innerHTML = _apEmpty('No report', 'Could not load the report — try again.'); return; }
  var s = rep.summary || {};
  var kpi = function (label, val, color) {
    return '<div style="flex:1;min-width:130px;background:var(--ffp-bg-2,#0f1f2c);border:1px solid var(--ffp-border,#1d3346);border-radius:12px;padding:13px 15px;">' +
      '<div class="psub" style="margin:0 0 4px;font-size:12px;">' + label + '</div>' +
      '<div style="font-weight:800;font-size:20px;color:' + (color || 'var(--ffp-text,#eaf2f8)') + ';">' + val + '</div></div>';
  };
  var money = apMoney;
  var html = '';
  // money KPIs
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">' +
    kpi('Gross revenue', money(s.gross_aed)) +
    kpi('Tax', money(s.tax_aed)) +
    kpi('Coach commission', money(s.commission_aed), '#ffcf8f') +
    kpi('Facility net', money(s.net_aed), '#7ee0a8') +
  '</div>';
  // session-count KPIs
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">' +
    kpi('Completed', s.completed || 0, '#7ee0a8') +
    kpi('Awaiting confirm', s.completed_pending || 0, '#ffcf8f') +
    kpi('No-shows', s.no_show || 0, '#ff9b9b') +
    kpi('Cancelled', s.cancelled || 0) +
    kpi('Unpaid', (s.unpaid_count || 0) + ' · ' + money(s.unpaid_aed), (s.unpaid_count ? '#ff9b9b' : null)) +
  '</div>';
  // by coach
  html += '<div class="form-section-title" style="margin-top:18px;">By coach</div>';
  var coaches = rep.by_coach || [];
  if (!coaches.length) html += '<div class="psub" style="margin:6px 0;">No completed sessions in this period.</div>';
  else {
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="text-align:left;color:#9fb3c2;">' +
      '<th style="padding:7px 8px;">Coach</th><th style="padding:7px 8px;">Sessions</th><th style="padding:7px 8px;">Gross</th><th style="padding:7px 8px;">Commission</th><th style="padding:7px 8px;">Facility net</th></tr></thead><tbody>';
    coaches.forEach(function (c) {
      html += '<tr style="border-top:1px solid var(--ffp-border,#1d3346);">' +
        '<td style="padding:7px 8px;font-weight:700;color:var(--ffp-text,#eaf2f8);">' + apEsc(c.coach_name) + '</td>' +
        '<td style="padding:7px 8px;">' + c.sessions + '</td>' +
        '<td style="padding:7px 8px;">' + money(c.gross_aed) + '</td>' +
        '<td style="padding:7px 8px;color:#ffcf8f;">' + money(c.commission_aed) + '</td>' +
        '<td style="padding:7px 8px;color:#7ee0a8;">' + money(c.net_aed) + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  // by service
  html += '<div class="form-section-title" style="margin-top:18px;">By service</div>';
  var svcs = rep.by_service || [];
  if (!svcs.length) html += '<div class="psub" style="margin:6px 0;">No completed sessions in this period.</div>';
  else {
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="text-align:left;color:#9fb3c2;">' +
      '<th style="padding:7px 8px;">Service</th><th style="padding:7px 8px;">Sessions</th><th style="padding:7px 8px;">Gross</th><th style="padding:7px 8px;">Tax</th><th style="padding:7px 8px;">Facility net</th></tr></thead><tbody>';
    svcs.forEach(function (sv) {
      html += '<tr style="border-top:1px solid var(--ffp-border,#1d3346);">' +
        '<td style="padding:7px 8px;font-weight:700;color:var(--ffp-text,#eaf2f8);">' + apEsc(sv.service_name) + '</td>' +
        '<td style="padding:7px 8px;">' + sv.sessions + '</td>' +
        '<td style="padding:7px 8px;">' + money(sv.gross_aed) + '</td>' +
        '<td style="padding:7px 8px;">' + money(sv.tax_aed) + '</td>' +
        '<td style="padding:7px 8px;color:#7ee0a8;">' + money(sv.net_aed) + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  host.innerHTML = html;
}

// First open: showPanel('appointments') calls renderAppointments(); this also covers the case
// where the script loads after the panel is already shown.
try { if (document.getElementById('ap-calendar-host') && document.getElementById('panel-appointments') && document.getElementById('panel-appointments').classList.contains('active')) renderAppointments(); } catch (e) {}

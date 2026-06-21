// ════════════════════════════════════════════════════════════════════════
// FFP Professional Portal — SERVICES (v1)
// A professional defines the SERVICES they offer (PT session / assessment /
// program / group / …). Each service has a per-session duration, a capacity,
// and a pricing mode the pro chooses:
//   • credit          — client BUYS the service (a package) → gets credits → books sessions later
//   • pay_per_session — client pays the per-session price each time they book
// Services drive the Scheduling timetable: each availability slot is FOR a service.
// Tables: pro_services / pro_slots(.service_id) / pro_client_packages(.service_id)
// RPCs:   pro_list_services / pro_save_service / pro_delete_service
// Uses the professional dashboard shell helpers (escHtml, showToast,
// openModalShell, closeModal, emptyState) + window.FFP_PROVIDER.id.
// ════════════════════════════════════════════════════════════════════════

function _svcCcy(){ return (window.FFP_PROVIDER&&FFP_PROVIDER.currency)||'AED'; }
function _svcMoney(n){ return window.FFPCurrency?FFPCurrency.format(n,_svcCcy()):(_svcCcy()+' '+Number(n||0).toLocaleString()); }
var _proServicesCache = [];
// A Service IS the typed offering (One on One / Group / Assessment) — same vocabulary the slots inherit.
var SERVICE_TYPES = (window.FFP_TAX && FFP_TAX.sessionTypes) || { one_to_one:'One on One', group:'Group', assessment:'Assessment' };

function _svcProvId(){ return (window.FFP_PROVIDER || {}).id || null; }
function _svcEsc(s){ return (typeof escHtml === 'function') ? escHtml(s == null ? '' : String(s)) : String(s == null ? '' : s); }
function _svcToast(m, t){ if (typeof showToast === 'function') showToast(m, t); }

async function _loadServicesCache(){
  var pid = _svcProvId(); if (!pid) { _proServicesCache = []; return _proServicesCache; }
  try { var r = await window.supabase.rpc('pro_list_services', { p_pro: pid }); _proServicesCache = (r && r.data) ? r.data : []; }
  catch (e) { console.error('[FFP Pro Services] list', e); _proServicesCache = []; }
  return _proServicesCache;
}

// Expose the services to other loaders (Scheduling reads this for its slot picker).
function proServices(){ return _proServicesCache; }
async function proEnsureServices(force){ if (_proServicesCache.length && !force) return _proServicesCache; return _loadServicesCache(); }

async function renderServices(){
  var box = document.getElementById('pro-services-list'); if (!box) return;
  box.innerHTML = '<div class="ov-empty" style="padding:16px;">Loading…</div>';
  await _loadServicesCache();
  if (!_proServicesCache.length) {
    box.innerHTML = (typeof emptyState === 'function')
      ? emptyState('No services yet', 'Add the services you offer — a PT session, an assessment, a 12-week program. Then set their times in Scheduling so clients can book.', 'New service', 'openServiceModal()')
      : '<div class="psub">No services yet.</div>';
    return;
  }
  box.innerHTML = _proServicesCache.map(serviceCard).join('');
}

function serviceCard(sv){
  var typeLbl = SERVICE_TYPES[sv.service_type] || _svcEsc(sv.service_type || 'Service');
  var price = (sv.price_aed != null && sv.price_aed !== '') ? (_svcMoney(sv.price_aed) + ' / session') : 'No single-session price set';
  var meta = [typeLbl];
  if (sv.duration_min) meta.push(sv.duration_min + ' min');
  if (sv.capacity && sv.capacity > 1) meta.push('up to ' + sv.capacity);
  meta.push((sv.slot_count || 0) + ' time' + ((sv.slot_count || 0) === 1 ? '' : 's') + ' in timetable');
  if (sv.package_count) meta.push(sv.package_count + ' package' + (sv.package_count === 1 ? '' : 's'));
  return '<div style="background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:10px;padding:12px 14px;margin-bottom:8px;">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'+
      '<div style="min-width:0;">'+
        '<div style="font-weight:800;color:var(--ffp-text);">'+_svcEsc(sv.name || 'Service')+'</div>'+
        '<div class="psub" style="margin:3px 0 0;">'+meta.join(' · ')+'</div>'+
        '<div class="psub" style="margin:4px 0 0;">'+price+'</div>'+
        (sv.description ? '<div class="psub" style="margin:5px 0 0;">'+_svcEsc(sv.description)+'</div>' : '')+
      '</div>'+
      '<div style="display:flex;gap:6px;flex:0 0 auto;">'+
        '<button class="btn btn-ghost btn-sm" onclick="openServiceModal(\''+sv.id+'\')" title="Edit"><span class="ms">edit</span></button>'+
        '<button class="btn btn-ghost btn-sm" onclick="confirmArchiveService(\''+sv.id+'\')" title="Archive"><span class="ms">delete</span></button>'+
      '</div>'+
    '</div>'+
  '</div>';
}

async function openServiceModal(id){
  var pid = _svcProvId(); if (!pid) return;
  if (!_proServicesCache.length) await _loadServicesCache();
  var editing = id ? _proServicesCache.find(function (x){ return x.id === id; }) : null;
  var s = editing || { name:'', service_type:'pt_session', description:'', duration_min:60, capacity:1, price_aed:'', location:'', free_cancellation_hours:24 };
  var typeOpts = Object.keys(SERVICE_TYPES).map(function (k){ return '<option value="'+k+'"'+(s.service_type===k?' selected':'')+'>'+SERVICE_TYPES[k]+'</option>'; }).join('');

  // Packages that can be used to book THIS service: bound to it specifically, to its type, or generic (any).
  var _pkgs = [];
  if (editing) { try { var _pr = await window.supabase.rpc('pro_list_packages', { p_pro: pid }); if (_pr && _pr.data) _pkgs = _pr.data; } catch (e) {} }
  var _applies = _pkgs.filter(function (pk){ var ids = pk.service_ids || []; return ids.length ? (ids.indexOf(s.id) >= 0) : true; });
  var _pkgHtml = !editing ? '' : (
    _applies.length
      ? '<div class="form-section-title" style="margin-top:6px;">Packages that book this service</div><div style="display:flex;flex-wrap:wrap;gap:6px;">'+_applies.map(function (pk){ return '<span style="font-size:12px;font-weight:700;background:rgba(10,62,68,0.08);border:1px solid var(--ffp-border-mid);border-radius:999px;padding:4px 11px;">'+_svcEsc(pk.name||'Package')+(pk.credits?(' · '+pk.credits+' credits'):'')+'</span>'; }).join('')+'</div>'
      : '<div class="psub" style="margin:6px 0 0;">No package books this service yet — a client needs one to book it. <a onclick="closeModal(); if(window.showPanel)showPanel(\'packages\')" style="color:var(--ffp-purple);font-weight:800;cursor:pointer;">Create a package</a>.</div>'
  );

  openModalShell('lg', (editing ? 'Edit service' : 'New service'),
    '<div class="form-section"><div class="form-section-title">Service</div><div class="form-grid">'+
      '<div class="field full"><div class="label">Name</div><input class="input" id="sv-name" value="'+_svcEsc(s.name||'')+'" placeholder="e.g. 60-min Personal Training"></div>'+
      '<div class="field"><div class="label">Type</div><select class="select" id="sv-service_type">'+typeOpts+'</select></div>'+
      '<div class="field"><div class="label">Session length (min)</div><input class="input" type="number" min="1" id="sv-duration_min" value="'+_svcEsc(String(s.duration_min||''))+'"></div>'+
      '<div class="field"><div class="label">Capacity <span style="color:var(--ffp-text-dim);">(per slot)</span></div><input class="input" type="number" min="1" id="sv-capacity" value="'+_svcEsc(String(s.capacity||1))+'"></div>'+
      '<div class="field"><div class="label">Price per session ('+_svcCcy()+')</div><input class="input" type="number" min="0" id="sv-price_aed" value="'+_svcEsc(String(s.price_aed==null?'':s.price_aed))+'" placeholder="For a single booking"></div>'+
      '<div class="field"><div class="label">Free cancellation (hrs) <span style="color:var(--ffp-text-dim);">(full refund/credit before start)</span></div><input class="input" type="number" min="0" step="1" id="sv-free_cancellation_hours" value="'+_svcEsc(String(s.free_cancellation_hours!=null?s.free_cancellation_hours:24))+'" placeholder="24"></div>'+
      '<div class="field"><div class="label">Location</div><input class="input" id="sv-location" value="'+_svcEsc(s.location||'')+'" placeholder="Optional"></div>'+
      '<div class="field full"><div class="label">Description</div><input class="input" id="sv-description" value="'+_svcEsc(s.description||'')+'" placeholder="What this service includes (optional)"></div>'+
      '<div class="field full"><label style="display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;background:rgba(10,62,68,0.07);border:1px solid var(--ffp-border-mid);border-radius:10px;padding:12px 14px;"><span style="display:flex;flex-direction:column;gap:2px;"><span style="font-size:13px;font-weight:800;color:var(--ffp-text);">Offer online</span><span style="font-size:11px;color:var(--ffp-text-dim);font-weight:600;">Members can self-book slots that use this service, up to capacity.</span></span><input type="checkbox" id="sv-bookable_online" '+(s.bookable_online?'checked':'')+' style="width:20px;height:20px;accent-color:var(--ffp-purple);flex:0 0 auto;cursor:pointer;"></label></div>'+
    '</div>'+
      '<div class="psub" style="margin:2px 0 0;">A client books this service using credits from a <b>Package</b>. Packages are created in the Packages tab and can be tied to this service, its type, or any service.</div>'+
      _pkgHtml+
    '</div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>'+
    '<button class="btn btn-pri" onclick="saveService(\''+(editing?editing.id:'')+'\')">'+(editing?'Save changes':'Create service')+'</button>'
  );
}

async function saveService(id){
  var pid = _svcProvId(); if (!pid) return;
  var g = function (k){ var el = document.getElementById('sv-' + k); return el ? (el.value || '').trim() : ''; };
  var name = g('name'); if (!name) { _svcToast('Name your service', 'error'); return; }
  var _onlineEl = document.getElementById('sv-bookable_online');
  var payload = {
    name: name, service_type: g('service_type') || 'pt_session', description: g('description'),
    duration_min: g('duration_min'), capacity: g('capacity') || '1',
    price_aed: g('price_aed'), location: g('location'),
    free_cancellation_hours: g('free_cancellation_hours'),
    bookable_online: !!(_onlineEl && _onlineEl.checked)
  };
  try {
    var r = await window.supabase.rpc('pro_save_service', { p_pro: pid, p_id: id || null, p: payload });
    if (r && r.error) throw r.error;
    _svcToast(id ? 'Service updated' : 'Service created', 'success');
    closeModal();
    await _loadServicesCache(); renderServices();
    // Keep the Scheduling slot picker fresh.
    if (typeof proEnsureServices === 'function') proEnsureServices(true);
  } catch (e) { console.error('[FFP Pro Services] save', e); _svcToast('Could not save service', 'error'); }
}

function confirmArchiveService(id){
  openModalShell('', 'Archive this service?',
    '<div class="psub" style="margin:6px 0;">It stops being offered and is hidden from your list. Existing timetable slots and client packages are kept.</div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>'+
    '<button class="btn btn-pri" onclick="archiveService(\''+id+'\')">Archive</button>');
}
async function archiveService(id){
  var pid = _svcProvId(); if (!pid) return;
  try {
    var r = await window.supabase.rpc('pro_delete_service', { p_pro: pid, p_id: id });
    if (r && r.error) throw r.error;
    _svcToast('Service archived', 'success');
  } catch (e) { _svcToast('Could not archive', 'error'); }
  closeModal();
  await _loadServicesCache(); renderServices();
}

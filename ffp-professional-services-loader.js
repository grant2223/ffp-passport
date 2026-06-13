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

var _proServicesCache = [];
var SERVICE_TYPES = {
  pt_session: 'Personal training session',
  assessment: 'Assessment',
  program:    'Program (e.g. 12-week)',
  group:      'Group session',
  other:      'Other'
};

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
  var price = (sv.price_aed != null && sv.price_aed !== '') ? ('AED ' + sv.price_aed) : '—';
  var pricing = (sv.pricing_mode === 'credit')
    ? (price + ' · ' + (sv.credits_granted || 1) + ' session' + ((sv.credits_granted || 1) > 1 ? 's' : '') + (sv.validity_days ? ' · ' + sv.validity_days + 'd' : '') + ' <span class="ni-lock-pill" style="background:rgba(127,90,240,.16);color:var(--ffp-purple,#9b7bf0);">credits</span>')
    : (price + ' / session <span class="ni-lock-pill" style="background:rgba(43,168,224,.14);color:#2ba8e0;">pay-per-session</span>');
  var meta = [typeLbl];
  if (sv.duration_min) meta.push(sv.duration_min + ' min');
  if (sv.capacity && sv.capacity > 1) meta.push('up to ' + sv.capacity);
  meta.push((sv.slot_count || 0) + ' time' + ((sv.slot_count || 0) === 1 ? '' : 's') + ' in timetable');
  return '<div style="background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:10px;padding:12px 14px;margin-bottom:8px;">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'+
      '<div style="min-width:0;">'+
        '<div style="font-weight:800;color:var(--ffp-text);">'+_svcEsc(sv.name || 'Service')+'</div>'+
        '<div class="psub" style="margin:3px 0 0;">'+meta.join(' · ')+'</div>'+
        '<div class="psub" style="margin:4px 0 0;">'+pricing+'</div>'+
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
  var s = editing || { name:'', service_type:'pt_session', description:'', duration_min:60, capacity:1, pricing_mode:'pay_per_session', price_aed:'', credits_granted:1, validity_days:'', location:'' };
  var typeOpts = Object.keys(SERVICE_TYPES).map(function (k){ return '<option value="'+k+'"'+(s.service_type===k?' selected':'')+'>'+SERVICE_TYPES[k]+'</option>'; }).join('');
  var modeOpts = [['pay_per_session','Pay per session'],['credit','Buy upfront (credits)']]
    .map(function (m){ return '<option value="'+m[0]+'"'+(s.pricing_mode===m[0]?' selected':'')+'>'+m[1]+'</option>'; }).join('');

  openModalShell('lg', (editing ? 'Edit service' : 'New service'),
    '<div class="form-section"><div class="form-section-title">Service</div><div class="form-grid">'+
      '<div class="field full"><div class="label">Name</div><input class="input" id="sv-name" value="'+_svcEsc(s.name||'')+'" placeholder="e.g. 60-min Personal Training"></div>'+
      '<div class="field"><div class="label">Type</div><select class="select" id="sv-service_type">'+typeOpts+'</select></div>'+
      '<div class="field"><div class="label">Session length (min)</div><input class="input" type="number" min="1" id="sv-duration_min" value="'+_svcEsc(String(s.duration_min||''))+'"></div>'+
      '<div class="field"><div class="label">Capacity <span style="color:var(--ffp-text-dim);">(per slot)</span></div><input class="input" type="number" min="1" id="sv-capacity" value="'+_svcEsc(String(s.capacity||1))+'"></div>'+
      '<div class="field"><div class="label">Location</div><input class="input" id="sv-location" value="'+_svcEsc(s.location||'')+'" placeholder="Optional"></div>'+
      '<div class="field full"><div class="label">Description</div><input class="input" id="sv-description" value="'+_svcEsc(s.description||'')+'" placeholder="What this service includes (optional)"></div>'+
    '</div></div>'+
    '<div class="form-section"><div class="form-section-title">Pricing</div><div class="form-grid">'+
      '<div class="field"><div class="label">How clients pay</div><select class="select" id="sv-pricing_mode" onchange="_svcToggleMode()">'+modeOpts+'</select></div>'+
      '<div class="field"><div class="label" id="sv-price-label">'+(s.pricing_mode==='credit'?'Package price (AED)':'Price per session (AED)')+'</div><input class="input" type="number" min="0" id="sv-price_aed" value="'+_svcEsc(String(s.price_aed==null?'':s.price_aed))+'"></div>'+
      '<div class="field sv-credit-only"><div class="label">Sessions included</div><input class="input" type="number" min="1" id="sv-credits_granted" value="'+_svcEsc(String(s.credits_granted||1))+'"></div>'+
      '<div class="field sv-credit-only"><div class="label">Valid for (days)</div><input class="input" type="number" min="1" id="sv-validity_days" value="'+_svcEsc(String(s.validity_days==null?'':s.validity_days))+'" placeholder="Optional"></div>'+
    '</div>'+
      '<div class="psub" style="margin:2px 0 0;">Credit services are bought once and grant a set number of sessions the client books later. Pay-per-session is charged each time they book.</div>'+
    '</div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>'+
    '<button class="btn btn-pri" onclick="saveService(\''+(editing?editing.id:'')+'\')">'+(editing?'Save changes':'Create service')+'</button>'
  );
  _svcToggleMode();
}

// Show/hide the credit-only fields + adapt the price label to the chosen mode.
function _svcToggleMode(){
  var mode = (document.getElementById('sv-pricing_mode') || {}).value || 'pay_per_session';
  var isCredit = mode === 'credit';
  document.querySelectorAll('.sv-credit-only').forEach(function (el){ el.style.display = isCredit ? '' : 'none'; });
  var lbl = document.getElementById('sv-price-label'); if (lbl) lbl.textContent = isCredit ? 'Package price (AED)' : 'Price per session (AED)';
}

async function saveService(id){
  var pid = _svcProvId(); if (!pid) return;
  var g = function (k){ var el = document.getElementById('sv-' + k); return el ? (el.value || '').trim() : ''; };
  var name = g('name'); if (!name) { _svcToast('Name your service', 'error'); return; }
  var mode = g('pricing_mode') || 'pay_per_session';
  var payload = {
    name: name, service_type: g('service_type') || 'pt_session', description: g('description'),
    duration_min: g('duration_min'), capacity: g('capacity') || '1', pricing_mode: mode,
    price_aed: g('price_aed'), location: g('location')
  };
  if (mode === 'credit') { payload.credits_granted = g('credits_granted') || '1'; payload.validity_days = g('validity_days'); }
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

// ════════════════════════════════════════════════════════════════════════
// FFP Professional Portal — SCHEDULING (dedicated; diverges from the partner model)
// A professional's week is built from each client's STANDING recurring slot.
// Reschedule a single week (an exception) or shift the slot for good.
// Tables: pro_slots / pro_slot_clients / pro_slot_exceptions / pro_clients
// RPCs: pro_week_schedule / pro_save_slot / pro_list_slots / pro_delete_slot /
//       pro_reschedule_occurrence / pro_cancel_occurrence / pro_*_client
// Uses the professional dashboard shell helpers (escHtml, showToast,
// openModalShell, closeModal, emptyState) + window.FFP_PROVIDER.id.
// ════════════════════════════════════════════════════════════════════════
var _proWeekStart = null;
var _proClients = [];
var SLOT_TYPES = { one_to_one: '1-to-1', assessment: 'Initial / assessment', small_group: 'Small group', large_group: 'Large group' };
var SLOT_SINGLE = { one_to_one: 1, assessment: 1 }; // single-person slot types (capacity = 1, no group count)
var WEEKDAYS = [['Mon',1],['Tue',2],['Wed',3],['Thu',4],['Fri',5],['Sat',6],['Sun',0]];
var _MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var _DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function _proProvId(){ return (window.FFP_PROVIDER&&window.FFP_PROVIDER.id)||(typeof providerProfile!=='undefined'&&providerProfile.id)||null; }
function _mondayOf(d){ var x=new Date(d); var day=x.getDay(); var diff=(day===0?-6:1-day); x.setDate(x.getDate()+diff); x.setHours(0,0,0,0); return x; }
function _isoDate(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function _mon(d){ return _MON[d.getMonth()]; }
function _fmtTime(t){ if(!t) return ''; var p=String(t).split(':'); var h=parseInt(p[0],10); var m=p[1]||'00'; var ap=h<12?'AM':'PM'; var h12=h%12; if(h12===0)h12=12; return h12+':'+m+' '+ap; }

async function _ensureProClients(force){
  if(_proClients.length && !force) return;
  var pid=_proProvId(); if(!pid) return;
  try{ var r=await window.supabase.rpc('pro_list_clients',{p_pro:pid}); _proClients=(r&&r.data)?r.data:[]; }catch(e){ _proClients=[]; }
}

async function renderScheduling(){
  var host=document.getElementById('pro-week'); if(!host) return;
  var pid=_proProvId(); if(!pid){ host.innerHTML='<div class="empty-sub" style="text-align:left;">Sign in to manage your schedule.</div>'; return; }
  if(!_proWeekStart) _proWeekStart=_mondayOf(new Date());
  var end=new Date(_proWeekStart); end.setDate(end.getDate()+6);
  var lbl=document.getElementById('pro-week-label');
  if(lbl) lbl.textContent=_proWeekStart.getDate()+' '+_mon(_proWeekStart)+' – '+end.getDate()+' '+_mon(end);
  host.innerHTML='<div class="psub" style="margin:10px 0;">Loading…</div>';
  var occs=[];
  try{ var r=await window.supabase.rpc('pro_week_schedule',{p_pro:pid,p_week_start:_isoDate(_proWeekStart)}); occs=(r&&r.data)?r.data:[]; }catch(e){ occs=[]; }
  host.innerHTML=renderWeekGrid(occs);
}
function proWeekShift(delta){ if(!_proWeekStart)_proWeekStart=_mondayOf(new Date()); _proWeekStart.setDate(_proWeekStart.getDate()+delta*7); renderScheduling(); }
function proWeekToday(){ _proWeekStart=_mondayOf(new Date()); renderScheduling(); }

function renderWeekGrid(occs){
  var byDate={}; occs.forEach(function(o){ (byDate[o.date]=byDate[o.date]||[]).push(o); });
  var anyEver=occs.length>0;
  var html='';
  for(var i=0;i<7;i++){
    var d=new Date(_proWeekStart); d.setDate(d.getDate()+i); var iso=_isoDate(d);
    var list=byDate[iso]||[];
    html+='<div style="margin-bottom:14px;">'+
      '<div style="font-size:11px;font-weight:800;letter-spacing:.5px;color:var(--ffp-text-dim);text-transform:uppercase;margin-bottom:6px;">'+_DAY[d.getDay()]+' '+d.getDate()+' '+_mon(d)+'</div>'+
      (list.length?list.map(occCard).join(''):'<div class="psub" style="margin:0 2px;color:var(--ffp-text-dim);">—</div>')+
    '</div>';
  }
  if(!anyEver) return emptyState('No standing slots yet','Add a standing slot for each client — it repeats every week. You can reschedule a single week or shift it for good.','New standing slot','openSlotModal()');
  return html;
}
function occCard(o){
  var typeLbl=SLOT_TYPES[o.slot_type]||'';
  var sub=[]; var nClients=(o.clients&&o.clients.length)||0;
  if(nClients) sub.push(o.clients.join(', '));
  sub.push(typeLbl);
  if(!SLOT_SINGLE[o.slot_type]&&o.capacity) sub.push(nClients+'/'+o.capacity);
  if(o.location) sub.push(o.location);
  return '<div onclick="openOccActions(\''+o.slot_id+'\',\''+o.date+'\')" style="background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:10px;padding:9px 12px;margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;">'+
    '<div style="min-width:0;"><div style="font-weight:800;color:var(--ffp-text);">'+_fmtTime(o.start_time)+' · '+escHtml(o.title||'Session')+(o.moved?' <span class="ni-lock-pill" style="background:rgba(255,204,0,.14);color:#FFCC00;">moved</span>':'')+'</div>'+
    (sub.length?'<div class="psub" style="margin:2px 0 0;">'+escHtml(sub.join(' · '))+'</div>':'')+'</div>'+
    '<span class="ms" style="color:var(--ffp-text-dim);">more_horiz</span>'+
  '</div>';
}

// ── New / edit standing slot ──
async function openSlotModal(id){
  var pid=_proProvId(); if(!pid) return;
  await _ensureProClients();
  var slots=_proSlotsCache||[];
  var editing=id?slots.find(function(s){return s.id===id;}):null;
  var s=editing||{ title:'', slot_type:'one_to_one', weekday:1, start_time:'18:00', duration_min:60, capacity:1, location:'', clients:[] };
  var chosen=(s.clients||[]).map(function(c){return c.id;});
  var clientList=_proClients.length
    ? _proClients.map(function(c){ var on=chosen.indexOf(c.id)!==-1; return '<label style="display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer;"><input type="checkbox" class="slot-cl" value="'+c.id+'" '+(on?'checked':'')+' style="width:16px;height:16px;accent-color:var(--ffp-purple);"> <span style="font-size:13px;">'+escHtml(c.full_name)+'</span></label>'; }).join('')
    : '<div class="psub" style="margin:4px 0;">No clients yet — add one below.</div>';
  var dayOpts=WEEKDAYS.map(function(w){ return '<option value="'+w[1]+'"'+(Number(s.weekday)===w[1]?' selected':'')+'>'+w[0]+'</option>'; }).join('');
  var typeOpts=Object.keys(SLOT_TYPES).map(function(k){ return '<option value="'+k+'"'+(s.slot_type===k?' selected':'')+'>'+SLOT_TYPES[k]+'</option>'; }).join('');
  openModalShell('lg',(editing?'Edit standing slot':'New standing slot'),
    '<div class="form-section"><div class="form-section-title">Slot</div><div class="form-grid">'+
      '<div class="field full"><div class="label">Title</div><input class="input" id="sl-title" value="'+escHtml(s.title||'')+'" placeholder="e.g. PT with Sam"></div>'+
      '<div class="field"><div class="label">Type</div><select class="select" id="sl-slot_type">'+typeOpts+'</select></div>'+
      '<div class="field"><div class="label">Capacity <span style="color:var(--ffp-text-dim);">(groups)</span></div><input class="input" type="number" id="sl-capacity" value="'+escHtml(String(s.capacity||1))+'"></div>'+
      '<div class="field"><div class="label">Day</div><select class="select" id="sl-weekday">'+dayOpts+'</select></div>'+
      '<div class="field"><div class="label">Time</div><input class="input" type="time" id="sl-start_time" value="'+escHtml(String(s.start_time||'18:00').slice(0,5))+'"></div>'+
      '<div class="field"><div class="label">Duration (min)</div><input class="input" type="number" id="sl-duration_min" value="'+escHtml(String(s.duration_min||60))+'"></div>'+
      '<div class="field"><div class="label">Location</div><input class="input" id="sl-location" value="'+escHtml(s.location||'')+'" placeholder="Optional"></div>'+
    '</div></div>'+
    '<div class="form-section"><div class="form-section-title">Who\'s in this slot</div>'+
      '<div id="sl-clients" style="max-height:170px;overflow-y:auto;border:1px solid var(--ffp-border);border-radius:10px;padding:6px 10px;">'+clientList+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:8px;"><input class="input" id="sl-newclient" placeholder="Add a client by name" style="flex:1;"><button class="btn btn-sec" onclick="addSlotClient()">Add</button></div>'+
    '</div>',
    (editing?'<button class="btn btn-ghost left" onclick="confirmEndSlot(\''+editing.id+'\')"><span class="ms">delete</span> End slot</button>':'')+
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>'+
    '<button class="btn btn-pri" onclick="saveSlot(\''+(editing?editing.id:'')+'\')">'+(editing?'Save':'Create slot')+'</button>');
}
async function addSlotClient(){
  var pid=_proProvId(); var inp=document.getElementById('sl-newclient'); var name=inp?inp.value.trim():'';
  if(!name){ showToast('Type a name','error'); return; }
  try{
    var r=await window.supabase.rpc('pro_save_client',{p_pro:pid,p_id:null,p:{full_name:name}});
    if(r&&r.error)throw r.error;
    await _ensureProClients(true);
    var box=document.getElementById('sl-clients');
    var chosen=[]; document.querySelectorAll('.slot-cl:checked').forEach(function(c){chosen.push(c.value);});
    if(r.data) chosen.push(r.data);
    box.innerHTML=_proClients.map(function(c){ var on=chosen.indexOf(c.id)!==-1; return '<label style="display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer;"><input type="checkbox" class="slot-cl" value="'+c.id+'" '+(on?'checked':'')+' style="width:16px;height:16px;accent-color:var(--ffp-purple);"> <span style="font-size:13px;">'+escHtml(c.full_name)+'</span></label>'; }).join('');
    inp.value='';
  }catch(e){ showToast('Could not add client','error'); }
}
async function saveSlot(id){
  var pid=_proProvId(); if(!pid) return;
  var g=function(i){var el=document.getElementById('sl-'+i);return el?el.value.trim():'';};
  var time=g('start_time'); if(!time){ showToast('Pick a time','error'); return; }
  var clientIds=[]; document.querySelectorAll('.slot-cl:checked').forEach(function(c){clientIds.push(c.value);});
  var payload={ title:g('title'), slot_type:g('slot_type')||'one_to_one', weekday:g('weekday'), start_time:time,
    duration_min:g('duration_min'), capacity:g('capacity'), location:g('location'), client_ids:clientIds };
  try{
    var r=await window.supabase.rpc('pro_save_slot',{p_pro:pid,p_id:id||null,p:payload});
    if(r&&r.error)throw r.error;
    showToast(id?'Slot updated':'Slot created','success');
    closeModal(); _loadSlotsCache().then(renderScheduling);
  }catch(e){ showToast('Could not save slot','error'); }
}
var _proSlotsCache=[];
async function _loadSlotsCache(){ var pid=_proProvId(); try{ var r=await window.supabase.rpc('pro_list_slots',{p_pro:pid}); _proSlotsCache=(r&&r.data)?r.data:[]; }catch(e){ _proSlotsCache=[]; } }

// ── Occurrence actions ──
function openOccActions(slotId,date){
  openModalShell('', 'Session options',
    '<div class="psub" style="margin:4px 0 12px;">'+escHtml(date)+'</div>'+
    '<div style="display:flex;flex-direction:column;gap:8px;">'+
      '<button class="btn btn-sec btn-block" onclick="openReschedule(\''+slotId+'\',\''+date+'\',\'this_week\')"><span class="ms">event_repeat</span> Reschedule just this week</button>'+
      '<button class="btn btn-sec btn-block" onclick="openReschedule(\''+slotId+'\',\''+date+'\',\'from_now\')"><span class="ms">update</span> Shift this slot from now on</button>'+
      '<button class="btn btn-ghost btn-block" onclick="cancelOcc(\''+slotId+'\',\''+date+'\')"><span class="ms">event_busy</span> Cancel just this week</button>'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(); _loadSlotsCache().then(function(){openSlotModal(\''+slotId+'\');})"><span class="ms">edit</span> Edit standing slot</button>'+
    '</div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Close</button>');
}
function openReschedule(slotId,date,scope){
  var hint=scope==='from_now'?'Pick the new day &amp; time — this changes the slot from here on.':'Move just this week\'s session. The slot stays put after.';
  openModalShell('', (scope==='from_now'?'Shift from now on':'Reschedule this week'),
    '<div class="psub" style="margin:4px 0 12px;">'+hint+'</div>'+
    '<div class="form-grid">'+
      '<div class="field"><div class="label">New date</div><input class="input" type="date" id="rs-date" value="'+escHtml(date)+'"></div>'+
      '<div class="field"><div class="label">New time</div><input class="input" type="time" id="rs-time"></div>'+
    '</div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>'+
    '<button class="btn btn-pri" onclick="doReschedule(\''+slotId+'\',\''+date+'\',\''+scope+'\')">Apply</button>');
}
async function doReschedule(slotId,date,scope){
  var pid=_proProvId();
  var nd=document.getElementById('rs-date'); var nt=document.getElementById('rs-time');
  try{
    var r=await window.supabase.rpc('pro_reschedule_occurrence',{p_pro:pid,p_slot:slotId,p_occ_date:date,p_scope:scope,p_new_date:(nd&&nd.value)?nd.value:date,p_new_time:(nt&&nt.value)?nt.value:null});
    if(r&&r.error)throw r.error;
    showToast('Rescheduled','success'); closeModal(); renderScheduling();
  }catch(e){ showToast('Could not reschedule','error'); }
}
async function cancelOcc(slotId,date){
  var pid=_proProvId();
  try{
    var r=await window.supabase.rpc('pro_cancel_occurrence',{p_pro:pid,p_slot:slotId,p_occ_date:date});
    if(r&&r.error)throw r.error;
    showToast('Cancelled for this week','success'); closeModal(); renderScheduling();
  }catch(e){ showToast('Could not cancel','error'); }
}
function confirmEndSlot(slotId){
  openModalShell('', 'End this slot?', '<div class="psub" style="margin:6px 0;">This removes the standing slot and stops it repeating. Past attendance is kept.</div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="endSlot(\''+slotId+'\')">End slot</button>');
}
async function endSlot(slotId){
  var pid=_proProvId();
  try{ var r=await window.supabase.rpc('pro_delete_slot',{p_pro:pid,p_id:slotId}); if(r&&r.error)throw r.error; showToast('Slot ended','success'); }catch(e){ showToast('Could not end slot','error'); }
  closeModal(); renderScheduling();
}

// First open: load slots cache then render the week.
try{ if(document.getElementById('pro-week')){ _loadSlotsCache().then(renderScheduling); } }catch(e){}

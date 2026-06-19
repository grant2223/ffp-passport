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
var _proView = 'week';      // 'week' | 'month'
var _proAnchor = null;      // a Date inside the current period
var _proWeekCache = {};     // weekStartISO -> occurrences (cleared on any mutation)
var _MONF = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var _proClients = [];
var SLOT_TYPES = (window.FFP_TAX && FFP_TAX.sessionTypes) || { one_to_one:'One on One', group:'Group', assessment:'Assessment' };
var SLOT_SINGLE = { one_to_one: 1, assessment: 1 }; // single-person slot types (capacity = 1, no group count)
function _sessTypeOpts(sel){
  return Object.keys(SLOT_TYPES).map(function(k){ return '<option value="'+k+'"'+((sel||'one_to_one')===k?' selected':'')+'>'+escHtml(SLOT_TYPES[k])+'</option>'; }).join('');
}
var WEEKDAYS = [['Mon',1],['Tue',2],['Wed',3],['Thu',4],['Fri',5],['Sat',6],['Sun',0]];
var _MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var _DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function _proProvId(){ return (window.FFP_PROVIDER&&window.FFP_PROVIDER.id)||(typeof providerProfile!=='undefined'&&providerProfile.id)||null; }
function _mondayOf(d){ var x=new Date(d); var day=x.getDay(); var diff=(day===0?-6:1-day); x.setDate(x.getDate()+diff); x.setHours(0,0,0,0); return x; }
function _isoDate(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function _mon(d){ return _MON[d.getMonth()]; }
function _fmtTime(t){ if(!t) return ''; var p=String(t).split(':'); var h=parseInt(p[0],10); var m=p[1]||'00'; var ap=h<12?'AM':'PM'; var h12=h%12; if(h12===0)h12=12; return h12+':'+m+' '+ap; }
function _today0(){ var d=new Date(); d.setHours(0,0,0,0); return d; }
function _addDays(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); x.setHours(0,0,0,0); return x; }
function _relLabel(d){ var diff=Math.round((d-_today0())/86400000); return diff===0?'Today':diff===-1?'Yesterday':diff===1?'Tomorrow':''; }
function _parseIso(iso){ var p=String(iso).split('-'); var d=new Date(+p[0],+p[1]-1,+p[2]); d.setHours(0,0,0,0); return d; }
function _injectSchedCss(){
  if(document.getElementById('pro-sched-css')) return;
  var s=document.createElement('style'); s.id='pro-sched-css';
  s.textContent=[
    '.seg{display:inline-flex;background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:9px;padding:2px;}',
    '.seg-btn{flex:1;text-align:center;background:none;border:none;color:var(--ffp-text-muted);font-family:inherit;font-size:13px;font-weight:800;padding:8px 14px;border-radius:7px;cursor:pointer;}',
    '.seg-btn.on{background:var(--ffp-purple);color:#fff;}',
    '.sched-day-h{font-size:14px;font-weight:800;letter-spacing:.3px;color:var(--ffp-text);margin:16px 2px 8px;}',
    '.sched-day-h.today{color:var(--ffp-purple);}',
    '.cal-head{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px;}',
    '.cal-head span{text-align:center;font-size:10px;font-weight:800;color:var(--ffp-text-dim);text-transform:uppercase;}',
    '.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}',
    '.cal-cell{position:relative;min-height:46px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:5px 0;background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:8px;color:var(--ffp-text);cursor:pointer;font-family:inherit;}',
    '.cal-cell.out{opacity:.35;}',
    '.cal-cell.today{border-color:var(--ffp-purple);}',
    '.cal-num{font-size:13px;font-weight:700;}',
    '.cal-dot{margin-top:4px;background:var(--ffp-purple);color:#fff;font-size:10px;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;}',
    '.ds-open{background:rgba(34,197,94,.15);color:#22c55e;font-size:11px;font-weight:800;padding:2px 9px;border-radius:100px;white-space:nowrap;}',
    '.ds-full{background:rgba(255,255,255,.07);color:var(--ffp-text-dim);font-size:11px;font-weight:800;padding:2px 9px;border-radius:100px;white-space:nowrap;}'
  ].join('');
  document.head.appendChild(s);
}

async function _ensureProClients(force){
  if(_proClients.length && !force) return;
  var pid=_proProvId(); if(!pid) return;
  try{ var r=await window.supabase.rpc('pro_list_clients',{p_pro:pid}); _proClients=(r&&r.data)?r.data:[]; }catch(e){ _proClients=[]; }
}

// Services drive the slot picker. Fetched here so Scheduling works even if the Services panel was never opened.
var _proSvc = [];
async function _ensureProSvc(force){
  if(_proSvc.length && !force) return _proSvc;
  var pid=_proProvId(); if(!pid) return _proSvc;
  try{ var r=await window.supabase.rpc('pro_list_services',{p_pro:pid}); _proSvc=(r&&r.data)?r.data:[]; }catch(e){ _proSvc=[]; }
  return _proSvc;
}
// Autofill duration/capacity/title from the chosen service when creating a slot.
function _slUpdateOnline(){
  var ind=document.getElementById('sl-online-ind'); if(!ind) return;
  var sel=document.getElementById('sl-service_id'); var sv=sel?_proSvc.find(function(x){return x.id===sel.value;}):null;
  if(sv && sv.bookable_online){ ind.innerHTML='<span class="ms" style="font-size:16px;vertical-align:-3px;color:#22c55e;">public</span> <b style="color:var(--ffp-text);">Bookable online</b> — members can self-book this slot, up to capacity.'; ind.style.borderColor='rgba(34,197,94,0.45)'; }
  else if(sv){ ind.innerHTML='<span class="ms" style="font-size:16px;vertical-align:-3px;color:var(--ffp-text-dim);">lock</span> Not offered online. Turn on “Offer online” on this service to let members self-book.'; ind.style.borderColor='var(--ffp-border)'; }
  else { ind.innerHTML='<span class="ms" style="font-size:16px;vertical-align:-3px;color:var(--ffp-text-dim);">public</span> Online booking follows the service’s “Offer online” setting.'; ind.style.borderColor='var(--ffp-border)'; }
}
function _slSvcPick(){
  var sel=document.getElementById('sl-service_id'); if(!sel) return;
  var sv=_proSvc.find(function(x){return x.id===sel.value;}); if(!sv){ _slUpdateOnline(); return; }
  var dur=document.getElementById('sl-duration_min'); if(dur && sv.duration_min) dur.value=sv.duration_min;
  var cap=document.getElementById('sl-capacity'); if(cap && sv.capacity) cap.value=sv.capacity;
  var loc=document.getElementById('sl-location'); if(loc && sv.location) loc.value=sv.location;
  var ttl=document.getElementById('sl-title'); if(ttl && !ttl.value) ttl.value=sv.name||'';
  _slUpdateOnline();
}

async function renderScheduling(){
  var host=document.getElementById('pro-week'); if(!host) return;
  var pid=_proProvId(); if(!pid){ host.innerHTML='<div class="empty-sub" style="text-align:left;">Sign in to manage your schedule.</div>'; return; }
  _injectSchedCss();
  if(!_proAnchor) _proAnchor=_today0();
  _setSegActive(_proView);
  host.innerHTML='<div class="psub" style="margin:10px 0;">Loading…</div>';
  if(_proView==='month') await renderMonth(host); else if(_proView==='day') await renderDay(host); else await renderWeek(host);
  try{ await _renderPausedStrap(host); }catch(e){}
}
// Paused standing slots — listed under the schedule with a Resume action (paused slots don't appear in the week/day views).
async function _renderPausedStrap(host){
  var pid=_proProvId(); if(!pid||!host) return;
  var rows=[]; try{ var r=await window.supabase.rpc('pro_paused_slots',{p_pro:pid}); rows=(r&&r.data)?r.data:[]; }catch(e){ rows=[]; }
  if(!rows.length) return;
  var dayName=function(wd){ for(var i=0;i<WEEKDAYS.length;i++){ if(WEEKDAYS[i][1]===Number(wd)) return WEEKDAYS[i][0]; } return ''; };
  var html='<div style="margin-top:18px;border:1px solid var(--ffp-border);border-radius:12px;padding:12px 14px;background:var(--ffp-bg-2);">'+
    '<div class="form-section-title" style="margin-bottom:6px;">Paused slots</div>'+
    rows.map(function(s){ return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--ffp-border);"><div style="flex:1;min-width:0;"><div style="font-weight:700;color:var(--ffp-text);font-size:13px;">'+escHtml(s.title||s.service_name||'Session')+'</div><div class="psub" style="margin:1px 0 0;">'+escHtml(dayName(s.weekday))+' · '+escHtml(String(s.start_time||'').slice(0,5))+'</div></div><button class="btn btn-sec btn-sm" onclick="resumeSlot(\''+s.id+'\')"><span class="ms">play_arrow</span> Resume</button></div>'; }).join('')+
    '</div>';
  host.insertAdjacentHTML('beforeend', html);
}
async function pauseSlot(id){
  var pid=_proProvId(); try{ var r=await window.supabase.rpc('pro_set_slot_status',{p_pro:pid,p_id:id,p_status:'paused'}); if(r&&r.error)throw r.error; showToast('Slot paused','success'); }catch(e){ showToast('Could not pause','error'); }
  closeModal(); _loadSlotsCache().then(_schedRefresh);
}
async function resumeSlot(id){
  var pid=_proProvId(); try{ var r=await window.supabase.rpc('pro_set_slot_status',{p_pro:pid,p_id:id,p_status:'active'}); if(r&&r.error)throw r.error; showToast('Slot resumed','success'); }catch(e){ showToast('Could not resume','error'); }
  _loadSlotsCache().then(_schedRefresh);
}
// Tap a session → manage who's in it directly (no full edit). Reuses pro_save_slot with only client_ids.
async function openSlotPeople(slotId){
  var pid=_proProvId(); if(!pid) return;
  await _ensureProClients();
  if(!(_proSlotsCache||[]).some(function(s){return s.id===slotId;})) await _loadSlotsCache();
  var slot=(_proSlotsCache||[]).find(function(s){return s.id===slotId;});
  if(!slot){ showToast('Could not load that slot — please reopen it','error'); return; }
  var chosen=(slot.clients||[]).map(function(c){return c.id;});
  var clientList=_proClients.length
    ? _proClients.map(function(c){ var on=chosen.indexOf(c.id)!==-1; return '<label style="display:flex;align-items:center;gap:9px;padding:8px 2px;cursor:pointer;border-bottom:1px solid var(--ffp-border);"><input type="checkbox" class="slp-cl" value="'+c.id+'" '+(on?'checked':'')+' style="width:17px;height:17px;accent-color:var(--ffp-purple);"> <span style="font-size:14px;">'+escHtml(c.full_name)+'</span></label>'; }).join('')
    : '<div class="psub" style="margin:4px 0;">No clients yet — add them in the Clients tab first.</div>';
  openModalShell('', 'Who\'s in this session',
    '<div class="psub" style="margin:0 0 8px;">Tick to add, untick to remove. Add new clients in the Clients tab.</div><div id="slp-clients" style="max-height:340px;overflow-y:auto;">'+clientList+'</div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="saveSlotPeople(\''+slotId+'\')">Save</button>');
}
async function saveSlotPeople(slotId){
  var pid=_proProvId(); var ids=[]; document.querySelectorAll('.slp-cl:checked').forEach(function(c){ids.push(c.value);});
  try{ var r=await window.supabase.rpc('pro_save_slot',{p_pro:pid,p_id:slotId,p:{client_ids:ids}}); if(r&&r.error)throw r.error; showToast('Updated','success'); closeModal(); _loadSlotsCache().then(_schedRefresh); }catch(e){ showToast('Could not update','error'); }
}
function _setRange(txt){ var el=document.getElementById('pro-sched-rangelbl'); if(el) el.textContent=txt; }
function _setSegActive(v){ var seg=document.getElementById('pro-view-seg'); if(!seg) return; seg.querySelectorAll('.seg-btn').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-view')===v); }); }
function proSetView(v){ _proView=v; renderScheduling(); }
function proSchedToday(){ _proAnchor=_today0(); renderScheduling(); }
function proPeriodShift(n){ if(!_proAnchor)_proAnchor=_today0(); if(_proView==='month'){ _proAnchor=new Date(_proAnchor.getFullYear(), _proAnchor.getMonth()+n, 1); } else if(_proView==='day'){ _proAnchor=_addDays(_proAnchor, n); } else { _proAnchor=_addDays(_proAnchor, n*7); } renderScheduling(); }
function _schedRefresh(){ _proWeekCache={}; renderScheduling(); }

// Fetch (and cache) the occurrences for the Mon–Sun week starting at Date ws.
async function _fetchWeek(ws){
  var key=_isoDate(ws);
  if(_proWeekCache[key]) return _proWeekCache[key];
  var pid=_proProvId(); var occs=[];
  try{ var r=await window.supabase.rpc('pro_week_schedule',{p_pro:pid,p_week_start:key}); occs=(r&&r.data)?r.data:[]; }catch(e){ occs=[]; }
  _proWeekCache[key]=occs; return occs;
}

async function renderWeek(host){
  var mon=_mondayOf(_proAnchor); var end=_addDays(mon,6);
  _setRange(mon.getDate()+' '+_mon(mon)+' – '+end.getDate()+' '+_mon(end));
  var occs=await _fetchWeek(mon);
  var byDate={}; occs.forEach(function(o){ (byDate[o.date]=byDate[o.date]||[]).push(o); });
  var todayIso=_isoDate(_today0()); var html='';
  for(var i=0;i<7;i++){
    var d=_addDays(mon,i); var iso=_isoDate(d); var isToday=iso===todayIso;
    var list=(byDate[iso]||[]).sort(function(a,b){return String(a.start_time).localeCompare(String(b.start_time));});
    html+='<div class="sched-day-h'+(isToday?' today':'')+'">'+_DAY[d.getDay()]+' '+d.getDate()+' '+_mon(d)+(isToday?' · Today':'')+'</div>'+
      (list.length?list.map(occCard).join(''):'<div class="psub" style="margin:0 2px;color:var(--ffp-text-dim);">—</div>');
  }
  host.innerHTML=html;
}

async function renderMonth(host){
  var first=new Date(_proAnchor.getFullYear(), _proAnchor.getMonth(), 1);
  _setRange(_MONF[first.getMonth()]+' '+first.getFullYear());
  var gridStart=_mondayOf(first); var occs=[];
  for(var w=0;w<6;w++){ var wk=await _fetchWeek(_addDays(gridStart,w*7)); occs=occs.concat(wk); }
  var cnt={}; occs.forEach(function(o){ cnt[o.date]=(cnt[o.date]||0)+1; });
  var todayIso=_isoDate(_today0());
  var html='<div class="cal-head"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div class="cal-grid">';
  for(var c=0;c<42;c++){
    var d=_addDays(gridStart,c); var iso=_isoDate(d); var inMonth=d.getMonth()===first.getMonth(); var isToday=iso===todayIso; var n=cnt[iso]||0;
    html+='<button class="cal-cell'+(inMonth?'':' out')+(isToday?' today':'')+'" onclick="proOpenDay(\''+iso+'\')">'+
      '<span class="cal-num">'+d.getDate()+'</span>'+(n?'<span class="cal-dot">'+n+'</span>':'')+'</button>';
  }
  html+='</div>';
  host.innerHTML=html;
}
function proOpenDay(iso){ _proAnchor=_parseIso(iso); _proView='day'; renderScheduling(); }

async function renderDay(host){
  var d=_proAnchor; var iso=_isoDate(d); var isToday=iso===_isoDate(_today0());
  _setRange(_DAY[d.getDay()]+' '+d.getDate()+' '+_mon(d)+(isToday?' · Today':''));
  var occs=await _fetchWeek(_mondayOf(d));
  var list=occs.filter(function(o){return o.date===iso;}).sort(function(a,b){return String(a.start_time).localeCompare(String(b.start_time));});
  if(!list.length){
    host.innerHTML='<div style="text-align:center;padding:34px 10px;color:var(--ffp-text-dim);"><div class="ms" style="font-size:32px;opacity:.5;">event_available</div><div class="psub" style="margin:8px 0 0;color:var(--ffp-text-dim);">No sessions on this day.</div></div>';
    return;
  }
  host.innerHTML=list.map(occCard).join('');
}
function occCard(o){
  var typeLbl=o.service_name||SLOT_TYPES[o.slot_type]||'';
  var nClients=(o.clients&&o.clients.length)||0;
  var cap=Number(o.capacity)||1;
  var openN=Math.max(0,cap-nClients);
  // Headline = the booked person's name (or names); falls back to the session type when the spot is open.
  var who=nClients?o.clients.join(', '):(typeLbl||o.title||'Session');
  var badge=openN>0?(cap===1?'<span class="ds-open">Available</span>':'<span class="ds-open">'+openN+' available</span>'):'<span class="ds-full">Full</span>';
  var sub=[];
  if(nClients && typeLbl) sub.push(typeLbl);   // type shown quietly when a name is the headline
  if(cap>1) sub.push(nClients+'/'+cap+' booked');
  if(o.location) sub.push(o.location);
  return '<div onclick="openOccActions(\''+o.slot_id+'\',\''+o.date+'\')" style="background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:10px;padding:10px 12px;margin-bottom:7px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;">'+
    '<div style="min-width:0;"><div style="font-weight:800;color:var(--ffp-text);">'+_fmtTime(o.start_time)+' · '+escHtml(who)+(o.moved?' <span class="ni-lock-pill" style="background:rgba(255,204,0,.14);color:#FFCC00;">moved</span>':'')+'</div>'+
    (sub.length?'<div class="psub" style="margin:2px 0 0;">'+escHtml(sub.join(' · '))+'</div>':'')+'</div>'+
    '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">'+badge+'<span class="ms" style="color:var(--ffp-text-dim);">more_horiz</span></div>'+
  '</div>';
}

// ── New / edit standing slot ──
async function openSlotModal(id){
  var pid=_proProvId(); if(!pid) return;
  await _ensureProClients();
  await _ensureProSvc(true);   // always refresh services so a just-added service shows in the picker
  // EDIT must never silently fall back to "New slot" (which inserts a duplicate at the default day/time).
  // If we're editing an id that isn't in the cache, reload; if it's still missing, abort with an error.
  if(id && !(_proSlotsCache||[]).some(function(s){return s.id===id;})) await _loadSlotsCache();
  var slots=_proSlotsCache||[];
  var editing=id?slots.find(function(s){return s.id===id;}):null;
  if(id && !editing){ showToast('Could not load that slot — please reopen it','error'); return; }
  var s=editing||{ title:'', service_id:'', weekday:1, start_time:'18:00', duration_min:'', capacity:'', location:'', clients:[] };
  var chosen=(s.clients||[]).map(function(c){return c.id;});
  var clientList=_proClients.length
    ? _proClients.map(function(c){ var on=chosen.indexOf(c.id)!==-1; return '<label style="display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer;"><input type="checkbox" class="slot-cl" value="'+c.id+'" '+(on?'checked':'')+' style="width:16px;height:16px;accent-color:var(--ffp-purple);"> <span style="font-size:13px;">'+escHtml(c.full_name)+'</span></label>'; }).join('')
    : '<div class="psub" style="margin:4px 0;">No clients yet — add them in the Clients tab first, then assign them here.</div>';
  var dayOpts=WEEKDAYS.map(function(w){ return '<option value="'+w[1]+'"'+(Number(s.weekday)===w[1]?' selected':'')+'>'+w[0]+'</option>'; }).join('');
  var svcOpts='<option value="">Choose a service…</option>'+_proSvc.map(function(v){ return '<option value="'+v.id+'"'+(s.service_id===v.id?' selected':'')+'>'+escHtml(v.name||'Service')+'</option>'; }).join('');
  openModalShell('lg',(editing?'Edit slot':'New slot'),
    '<div class="form-section"><div class="form-section-title">Slot</div><div class="form-grid">'+
      '<div class="field full"><div class="label">Service</div><select class="select" id="sl-service_id" onchange="_slSvcPick()">'+svcOpts+'</select></div>'+
      '<div class="field"><div class="label">Day</div><select class="select" id="sl-weekday">'+dayOpts+'</select></div>'+
      '<div class="field"><div class="label">Time</div><input class="input" type="time" id="sl-start_time" value="'+escHtml(String(s.start_time||'18:00').slice(0,5))+'"></div>'+
      '<div class="field"><div class="label">Duration (min)</div><input class="input" type="number" id="sl-duration_min" value="'+escHtml(String(s.duration_min||60))+'"></div>'+
      '<div class="field"><div class="label">Capacity <span style="color:var(--ffp-text-dim);">— spots available</span></div><input class="input" type="number" id="sl-capacity" value="'+escHtml(String(s.capacity||''))+'"></div>'+
      '<div class="field full"><div class="label">Location</div><input class="input" id="sl-location" value="'+escHtml(s.location||'')+'" placeholder="Optional"></div>'+
      '<div class="field full"><div class="label">Session note <span style="color:var(--ffp-text-dim);">— private to you</span></div><textarea class="textarea" id="sl-notes" rows="2" placeholder="e.g. focus on mobility; bring resistance bands">'+escHtml(s.notes||'')+'</textarea></div>'+
      '<div class="field full"><div id="sl-online-ind" style="font-size:12px;font-weight:600;color:var(--ffp-text-dim);background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:10px;padding:10px 12px;"></div></div>'+
    '</div></div>'+
    '<div class="form-section"><div class="form-section-title">Who\'s in this slot</div>'+
      '<div id="sl-clients" style="max-height:200px;overflow-y:auto;border:1px solid var(--ffp-border);border-radius:10px;padding:6px 10px;">'+clientList+'</div>'+
    '</div>',
    (editing?'<button class="btn btn-ghost left" onclick="confirmEndSlot(\''+editing.id+'\')"><span class="ms">delete</span> End slot</button>':'')+
    (editing?'<button class="btn btn-ghost" onclick="pauseSlot(\''+editing.id+'\')"><span class="ms">pause</span> Pause</button>':'')+
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>'+
    '<button class="btn btn-pri" onclick="saveSlot(\''+(editing?editing.id:'')+'\')">'+(editing?'Save':'Create slot')+'</button>');
  _slUpdateOnline();
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
var _savingSlot=false;
async function saveSlot(id){
  if(_savingSlot) return;   // guard against a double-tap firing two inserts
  var pid=_proProvId(); if(!pid) return;
  var g=function(i){var el=document.getElementById('sl-'+i);return el?el.value.trim():'';};
  var serviceId=g('service_id');
  var time=g('start_time'); if(!time){ showToast('Pick a time','error'); return; }
  var wd=g('weekday'); var dur=parseInt(g('duration_min'),10)||60;
  var _toMin=function(t){ var p=String(t).split(':'); return (parseInt(p[0],10)||0)*60+(parseInt(p[1],10)||0); };
  var ns=_toMin(time), ne=ns+dur;
  var clash=(_proSlotsCache||[]).some(function(sl){
    if(id && sl.id===id) return false;
    if(String(sl.weekday)!==String(wd)) return false;
    var ss=_toMin(String(sl.start_time||'').slice(0,5)), se=ss+(parseInt(sl.duration_min,10)||60);
    return ns < se && ss < ne;
  });
  if(clash){ showToast('That time overlaps another slot on the same day','error'); return; }
  var clientIds=[]; document.querySelectorAll('.slot-cl:checked').forEach(function(c){clientIds.push(c.value);});
  var payload={ service_id:serviceId, slot_type:g('slot_type')||'one_to_one', title:g('title'), weekday:g('weekday'), start_time:time,
    duration_min:g('duration_min'), capacity:g('capacity'), location:g('location'), notes:g('notes'), client_ids:clientIds };
  _savingSlot=true;
  try{
    var r=await window.supabase.rpc('pro_save_slot',{p_pro:pid,p_id:id||null,p:payload});
    if(r&&r.error)throw r.error;
    showToast(id?'Slot updated':'Slot created','success');
    closeModal(); _loadSlotsCache().then(_schedRefresh);
  }catch(e){ showToast('Could not save slot','error'); }
  finally{ _savingSlot=false; }
}
var _proSlotsCache=[];
async function _loadSlotsCache(){ var pid=_proProvId(); try{ var r=await window.supabase.rpc('pro_list_slots',{p_pro:pid}); _proSlotsCache=(r&&r.data)?r.data:[]; }catch(e){ _proSlotsCache=[]; } }

// ── Occurrence actions ──
function openOccActions(slotId,date){
  openModalShell('', 'Session options',
    '<div class="psub" style="margin:4px 0 12px;">'+escHtml(date)+'</div>'+
    '<div style="display:flex;flex-direction:column;gap:8px;">'+
      '<button class="btn btn-sec btn-block" onclick="closeModal(); openSlotPeople(\''+slotId+'\')"><span class="ms">group</span> Add or remove people</button>'+
      '<button class="btn btn-sec btn-block" onclick="openReschedule(\''+slotId+'\',\''+date+'\',\'this_week\')"><span class="ms">event_repeat</span> Reschedule just this week</button>'+
      '<button class="btn btn-sec btn-block" onclick="openReschedule(\''+slotId+'\',\''+date+'\',\'from_now\')"><span class="ms">update</span> Shift this slot from now on</button>'+
      '<button class="btn btn-ghost btn-block" onclick="cancelOcc(\''+slotId+'\',\''+date+'\')"><span class="ms">event_busy</span> Block this date (skip this week)</button>'+
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
    showToast('Rescheduled','success'); closeModal(); _schedRefresh();
  }catch(e){ showToast('Could not reschedule','error'); }
}
async function cancelOcc(slotId,date){
  var pid=_proProvId();
  try{
    var r=await window.supabase.rpc('pro_cancel_occurrence',{p_pro:pid,p_slot:slotId,p_occ_date:date});
    if(r&&r.error)throw r.error;
    showToast('Cancelled for this week','success'); closeModal(); _schedRefresh();
  }catch(e){ showToast('Could not cancel','error'); }
}
function confirmEndSlot(slotId){
  openModalShell('', 'End this slot?', '<div class="psub" style="margin:6px 0;">This removes the standing slot and stops it repeating. Past attendance is kept.</div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="endSlot(\''+slotId+'\')">End slot</button>');
}
async function endSlot(slotId){
  var pid=_proProvId();
  try{ var r=await window.supabase.rpc('pro_delete_slot',{p_pro:pid,p_id:slotId}); if(r&&r.error)throw r.error; showToast('Slot ended','success'); }catch(e){ showToast('Could not end slot','error'); }
  closeModal(); _schedRefresh();
}

// First open: load slots cache then render the week.
try{ if(document.getElementById('pro-week')){ _loadSlotsCache().then(renderScheduling); } }catch(e){}

// ════════════════════════════════════════════════════════════════════════
// FFP Professional Portal — CLIENT module (dedicated; on pro_* tables)
// Clients (pro_clients) + Packages (pro_packages / pro_client_packages) +
// Messages (pro_broadcasts). Shares the pro client roster with Scheduling.
// Uses the same panel ids + function names as the dashboard expects, so it
// drops in where the shared members loader used to sit. Professional id =
// window.FFP_PROVIDER.id. Helpers (escHtml/showToast/openModalShell/…) come
// from the dashboard shell.
// ════════════════════════════════════════════════════════════════════════
var _members = [];
var _plans = [];
var _broadcasts = [];
var _curMembershipMember = null;
var CLIENT_STATUS = (window.FFP_TAX && FFP_TAX.clientStatus) || { active: 'Active', paused: 'Paused', archived: 'Archived' };
var PKG_TYPES = (window.FFP_TAX && FFP_TAX.packageTypes) || { sessions: 'Session pack', recurring: 'Recurring', term: 'Term' };
var COMMS_CHANNELS = (window.FFP_TAX && FFP_TAX.commsChannels) || { email: 'Email', push: 'Push', sms: 'SMS' };
var _cstStyle = { active:'background:rgba(43,168,224,.16);color:#6fc6ef', paused:'background:rgba(255,204,0,.16);color:#FFCC00', archived:'background:rgba(255,255,255,.08);color:#9fb0bf' };

function _memProvId(){ return (window.FFP_PROVIDER&&window.FFP_PROVIDER.id)||(typeof providerProfile!=='undefined'&&providerProfile.id)||null; }
function _ccy2(){ return (window.FFP_PROVIDER&&FFP_PROVIDER.currency)||'AED'; }
function _money2(v){ var n=Number(v||0); if(window.FFPCurrency)return FFPCurrency.format(isNaN(n)?0:n,_ccy2()); return _ccy2()+' '+(isNaN(n)?0:n).toLocaleString(); }

// ── CLIENTS ──
async function renderMembers(){
  var host=document.getElementById('mem-list'); if(!host) return;
  var pid=_memProvId(); if(!pid){ host.innerHTML='<div class="empty-sub" style="text-align:left;">Sign in to manage clients.</div>'; return; }
  host.innerHTML='<div class="psub" style="margin:10px 0;">Loading…</div>';
  try{ var r=await window.supabase.rpc('pro_list_clients',{p_pro:pid}); _members=(r&&r.data)?r.data:[]; }catch(e){ _members=[]; }
  renderMembersList();
}
function renderMembersList(){
  var host=document.getElementById('mem-list'); if(!host) return;
  var box=document.getElementById('mem-search'); var q=(box?box.value:'').trim().toLowerCase();
  var items=_members;
  if(q) items=_members.filter(function(m){ return ((m.full_name||'')+' '+(m.email||'')+' '+(m.phone||'')+' '+(m.tags||'')).toLowerCase().indexOf(q)!==-1; });
  if(!items.length){ host.innerHTML=_members.length?'<div class="psub" style="margin:10px 2px;">No matches.</div>':emptyState('No clients yet','Add your first client. Scheduling, packages and payments all link back here.','Add client','openMemberModal()'); return; }
  host.innerHTML='<div class="psub" style="margin:0 2px 8px;">'+_members.length+' client'+(_members.length===1?'':'s')+'</div>'+items.map(memberRow).join('');
}
function memberRow(m){
  var initials=(m.full_name||'?').split(/\s+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();
  var st=m.status||'active'; var stStyle=_cstStyle[st]||_cstStyle.active;
  var contact=[];   // strap stays clean — phone/email live on the client profile
  var tags=(m.tags||'').split(',').map(function(t){return t.trim();}).filter(Boolean);
  var tagHtml=tags.length?'<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:5px;">'+tags.map(function(t){return '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,.06);color:#9fb0bf;">'+escHtml(t)+'</span>';}).join('')+'</div>':'';
  return '<div onclick="clientProfile(\''+m.id+'\')" style="background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:12px;padding:11px 13px;margin-bottom:9px;display:flex;align-items:center;gap:11px;cursor:pointer;">'+
    '<div style="width:38px;height:38px;border-radius:10px;background:rgba(139,92,246,.16);color:#c4b5fd;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;">'+escHtml(initials)+'</div>'+
    '<div style="min-width:0;flex:1;"><div style="font-weight:800;color:var(--ffp-text);">'+escHtml(m.full_name||'—')+'</div>'+(contact.length?'<div class="psub" style="margin:2px 0 0;">'+contact.join(' · ')+'</div>':'')+tagHtml+'</div>'+
    '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;flex-shrink:0;'+stStyle+'">'+(CLIENT_STATUS[st]||'Active')+'</span>'+
    '<span class="ms" style="color:var(--ffp-text-dim);flex-shrink:0;">chevron_right</span>'+
  '</div>';
}
// Tap a client strap → their profile, with everything you do for a client in one place.
function clientProfile(id){
  var m=_members.find(function(x){return x.id===id;}); if(!m){ showToast('Client not found','error'); return; }
  var st=m.status||'active'; var stStyle=_cstStyle[st]||_cstStyle.active;
  var jd=m.join_date?String(m.join_date).slice(0,10):'';
  // Legacy clients have only full_name — split it so Given/Surname still show.
  var gn=m.given_names||'', sn=m.surname||'';
  if(!gn && !sn && m.full_name){ var _np=String(m.full_name).trim().split(/\s+/); gn=_np.shift()||''; sn=_np.join(' '); }
  var tags=(m.tags||'').split(',').map(function(t){return t.trim();}).filter(Boolean);
  var fmtDob=function(d){ if(!d)return ''; try{ return new Date(String(d).slice(0,10)+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}); }catch(e){ return String(d).slice(0,10); } };
  // Passport-style rows — ALWAYS shown ("—" when empty) so the profile reads like a record.
  var prow=function(lbl,val){ return '<div style="display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid var(--ffp-border);"><span class="psub">'+lbl+'</span><span style="color:var(--ffp-text);font-weight:600;text-align:right;word-break:break-word;">'+(val?escHtml(val):'<span style="color:var(--ffp-text-dim);">—</span>')+'</span></div>'; };
  var mkRows=function(d){ return prow('Given name',d.given_names)+prow('Surname',d.surname)+prow('Gender',d.gender)+prow('Date of birth',fmtDob(d.date_of_birth))+prow('Email',d.email)+prow('Phone',d.phone)+prow('Nationality',d.nationality); };
  var act=function(ic,lbl,fn){ return '<button class="btn btn-sec btn-block" style="justify-content:flex-start;gap:9px;" onclick="closeModal();'+fn+'"><span class="ms">'+ic+'</span> '+lbl+'</button>'; };
  openModalShell('lg', escHtml(m.full_name||((gn+' '+sn).trim())||'Client'),
    '<div style="margin:-2px 0 12px;"><span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;'+stStyle+'">'+(CLIENT_STATUS[st]||'Active')+'</span></div>'+
    '<div id="cp-src" style="display:none;font-size:11px;font-weight:700;color:var(--ffp-purple);margin:0 0 8px;"><span class="ms" style="font-size:14px;vertical-align:-2px;">verified_user</span> Pulled from their FFP Passport</div>'+
    '<div id="cp-details">'+mkRows({given_names:gn,surname:sn,gender:m.gender,date_of_birth:m.date_of_birth,email:m.email,phone:m.phone,nationality:m.nationality})+'</div>'+
    (jd?prow('Client since', jd):'')+(tags.length?prow('Tags', tags.join(', ')):'')+
    (m.notes?'<div style="margin-top:12px;"><div class="psub" style="margin-bottom:5px;">Notes</div><div style="background:var(--ffp-bg-card);border:1px solid var(--ffp-border);border-radius:10px;padding:11px 13px;color:var(--ffp-text);line-height:1.6;white-space:pre-wrap;">'+escHtml(m.notes)+'</div></div>':'')+
    '<div style="display:flex;flex-direction:column;gap:8px;margin-top:18px;">'+
      act('health_and_safety','Connect client Passport','openClientHealth(\''+id+'\')')+
      act('card_membership','Packages','openMembership(\''+id+'\')')+
      act('assignment','Assessment form','clientAssessment(\''+id+'\')')+
      act('edit','Edit profile','openMemberModal(\''+id+'\')')+
    '</div>',
    '<button class="btn btn-ghost left" onclick="closeModal();confirmDeleteMember(\''+id+'\')"><span class="ms">delete</span> Delete client</button>'+
    '<button class="btn btn-ghost" onclick="closeModal()">Close</button>');
  // Auto-pull identity from the client's FFP Passport by email match (per Grant) — upgrades the rows in place.
  if(window.supabase){ try{ window.supabase.rpc('pro_client_passport',{p_pro:_memProvId(),p_client:id}).then(function(r){
    var d=(r&&r.data)||{}; if(!d.has_account) return;
    var el=document.getElementById('cp-details'); if(el) el.innerHTML=mkRows(d);
    var src=document.getElementById('cp-src'); if(src) src.style.display='';
  }).catch(function(){}); }catch(e){} }
}
// Placeholder until Grant defines the assessment fields/storage.
function clientAssessment(id){ showToast('Assessment form coming — tell me what it should capture','info'); }
function openMemberModal(id){
  var editing=id?_members.find(function(x){return x.id===id;}):null;
  var today=new Date(); var todayStr=today.getFullYear()+'-'+('0'+(today.getMonth()+1)).slice(-2)+'-'+('0'+today.getDate()).slice(-2);
  var m=editing||{full_name:'',email:'',phone:'',status:'active',tags:'',join_date:todayStr,notes:''};
  var jd=m.join_date?String(m.join_date).slice(0,10):'';
  openModalShell('lg',(editing?'Edit client':'Add client'),
    '<div class="form-section"><div class="form-section-title">Client</div><div class="form-grid">'+
      '<div class="field full"><div class="label">Full name <span class="req">*</span></div><input class="input" id="mm-full_name" value="'+escHtml(m.full_name)+'"></div>'+
      '<div class="field full"><div class="label">Email</div><input class="input" id="mm-email" value="'+escHtml(m.email||'')+'"></div>'+
      '<div class="field full"><div class="label">Phone</div>'+(window._phoneField?_phoneField('mm-phone'):'<input class="input" id="mm-phone" value="'+escHtml(m.phone||'')+'">')+'</div>'+
      '<div class="field"><div class="label">Status</div><select class="select" id="mm-status">'+Object.keys(CLIENT_STATUS).map(function(k){return '<option value="'+k+'"'+(m.status===k?' selected':'')+'>'+escHtml(CLIENT_STATUS[k])+'</option>';}).join('')+'</select></div>'+
      '<div class="field"><div class="label">Since</div><input class="input" type="date" id="mm-join_date" value="'+jd+'"></div>'+
      '<div class="field full"><div class="label">Tags</div><input class="input" id="mm-tags" value="'+escHtml(m.tags||'')+'" placeholder="comma,separated"></div>'+
      '<div class="field full"><div class="label">Notes</div><textarea class="textarea" id="mm-notes" rows="4">'+escHtml(m.notes||'')+'</textarea></div>'+
    '</div></div>',
    (editing?'<button class="btn btn-ghost left" onclick="confirmDeleteMember(\''+editing.id+'\')"><span class="ms">delete</span> Delete</button>':'')+
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>'+
    '<button class="btn btn-pri" onclick="saveMember(\''+(editing?editing.id:'')+'\')">'+(editing?'Save':'Add client')+'</button>');
  if(window._phoneSet) _phoneSet('mm-phone', m.phone||'');
}
async function saveMember(id){
  var g=function(i){var el=document.getElementById('mm-'+i);return el?el.value.trim():'';};
  var name=g('full_name'); if(!name){ showToast('Name is required','error'); return; }
  var pid=_memProvId(); if(!pid) return;
  var payload={full_name:name,email:g('email'),phone:(window._phoneGet?_phoneGet('mm-phone'):g('phone')),status:g('status')||'active',tags:g('tags'),join_date:g('join_date'),notes:g('notes')};
  try{ var r=await window.supabase.rpc('pro_save_client',{p_pro:pid,p_id:id||null,p:payload}); if(r&&r.error)throw r.error; showToast(id?'Client updated':'Client added','success'); closeModal(); renderMembers(); }catch(e){ showToast('Could not save client','error'); }
}
function confirmDeleteMember(id){ openModalShell('','Remove client?','<div class="psub" style="margin:6px 0;">This removes them from your client list.</div>','<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doDeleteMember(\''+id+'\')">Remove</button>'); }
async function doDeleteMember(id){ var pid=_memProvId(); try{ var r=await window.supabase.rpc('pro_delete_client',{p_pro:pid,p_id:id}); if(r&&r.error)throw r.error; showToast('Client removed','success'); }catch(e){ showToast('Could not remove','error'); } closeModal(); renderMembers(); }

// ─── Client health data (read-only, member-permissioned) ───
function _healthTile(v,l){ return '<div style="background:var(--ffp-bg-card);border:1px solid var(--ffp-border);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:18px;font-weight:900;">'+v+'</div><div class="psub" style="margin:2px 0 0;font-size:10px;text-transform:uppercase;">'+escHtml(l)+'</div></div>'; }
function _healthDate(ts){ if(!ts)return ''; try{ return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'}); }catch(e){ return ''; } }
function _healthTime(s){ if(!s)return '—'; s=+s; var m=Math.floor(s/60),ss=s%60; return m+':'+('0'+ss).slice(-2); }
async function openClientHealth(clientId){
  var pid=_memProvId(); if(!pid)return;
  var cl=(_members||[]).find(function(x){return x.id===clientId;})||{};
  openModalShell('lg','Health data · '+escHtml(cl.full_name||'Client'),'<div class="psub" style="padding:14px 0;">Checking access…</div>','<button class="btn btn-ghost" onclick="closeModal()">Close</button>');
  var st={};
  try{ var r=await window.supabase.rpc('pro_client_access_status',{p_pro:pid,p_client:clientId}); st=(r&&r.data)||{}; }catch(e){}
  var body=document.querySelector('#ffp-modal .mc-body'); if(!body)return;
  if(!st.has_member){
    body.innerHTML='<div class="psub" style="padding:8px 0;line-height:1.6;">No FFP Passport found for this client’s email. Read-only health data is only available for clients who hold an active FFP Passport — add their Passport email to their client record, then request access.</div>';
    return;
  }
  if(st.status==='approved'){ _renderClientData(clientId, cl); return; }
  if(!st.passport_active){
    body.innerHTML='<div class="psub" style="padding:8px 0;line-height:1.6;">This client has an FFP account but their Passport isn’t active right now — they’ll need an active Passport to share their data.</div>';
    return;
  }
  if(st.status==='pending'){
    body.innerHTML='<div style="text-align:center;padding:18px 6px;"><span class="ms" style="font-size:30px;color:var(--ffp-purple);">hourglass_top</span><div style="font-weight:800;margin-top:8px;">Request sent</div><div class="psub" style="margin-top:4px;">Waiting for '+escHtml(cl.full_name||'your client')+' to approve in their Passport. You’ll get a notification when they do.</div></div>';
    return;
  }
  var note=st.status==='declined'?'Your last request was declined.':(st.status==='revoked'?'Access was turned off by the client.':'');
  body.innerHTML='<div style="text-align:center;padding:14px 6px;"><span class="ms" style="font-size:30px;color:var(--ffp-purple);">health_and_safety</span>'+
    '<div style="font-weight:800;margin-top:8px;">View their Calorie Tracker &amp; Fitness Stats</div>'+
    '<div class="psub" style="margin:4px auto 14px;max-width:340px;">With permission, you can see '+escHtml(cl.full_name||'your client')+'’s nutrition and training stats — read-only. '+escHtml(note)+'</div>'+
    '<button class="btn btn-pri" onclick="requestClientAccess(\''+clientId+'\')"><span class="ms">lock_open</span> Request access</button></div>';
}
async function requestClientAccess(clientId){
  var pid=_memProvId(); if(!pid)return;
  try{
    var r=await window.supabase.rpc('pro_request_data_access',{p_pro:pid,p_client:clientId});
    var d=(r&&r.data)||{};
    if(d.error){ var msg=d.error==='no_member'?'No FFP account found for this client’s email':(d.error==='passport_inactive'?'Their Passport isn’t active right now':(d.error==='no_email'?'Add an email to this client first':'Could not send request')); showToast(msg,'error'); return; }
    showToast('Request sent','success'); openClientHealth(clientId);
  }catch(e){ showToast('Could not send request','error'); }
}
async function _renderClientData(clientId, cl){
  var pid=_memProvId();
  var memberId=null;
  try{ var s=await window.supabase.rpc('pro_client_access_status',{p_pro:pid,p_client:clientId}); memberId=(s&&s.data&&s.data.member_id)||null; }catch(e){}
  var body=document.querySelector('#ffp-modal .mc-body'); if(body)body.innerHTML='<div class="psub" style="padding:14px 0;">Loading…</div>';
  var d={};
  try{ var r=await window.supabase.rpc('pro_client_data',{p_pro:pid,p_member:memberId}); d=(r&&r.data)||{}; }catch(e){ d={error:'load'}; }
  body=document.querySelector('#ffp-modal .mc-body'); if(!body)return;
  if(d.error){ body.innerHTML='<div class="psub" style="padding:10px 0;">Couldn’t load — access may have changed.</div>'; return; }
  var c=d.calorie_today||{}; var f=d.fitness||{};
  var num=function(v,suf){ return (v===null||v===undefined||v==='')?'—':(v+(suf||'')); };
  var calHtml='<div class="form-section"><div class="form-section-title">Today’s nutrition</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">'+
    _healthTile(Math.round(c.calories||0),'kcal')+_healthTile(Math.round(c.protein_g||0)+'g','Protein')+_healthTile(Math.round(c.carbs_g||0)+'g','Carbs')+_healthTile(Math.round(c.fat_g||0)+'g','Fat')+'</div></div>';
  var prRows=[['Bench',num(f.pr_bench_kg,' kg')],['Squat',num(f.pr_squat_kg,' kg')],['Deadlift',num(f.pr_deadlift_kg,' kg')],
    ['5K',f.pr_5k_seconds?_healthTime(f.pr_5k_seconds):'—'],['10K',f.pr_10k_seconds?_healthTime(f.pr_10k_seconds):'—'],['Half',f.pr_21k_seconds?_healthTime(f.pr_21k_seconds):'—'],
    ['VO₂ max',num(f.vo2_max)],['Body fat',num(f.body_fat_pct,'%')],['Resting HR',num(f.resting_hr,' bpm')],['Weight',num(f.current_weight_kg,' kg')]];
  var fitHtml='<div class="form-section"><div class="form-section-title">Fitness stats</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px;">'+
    prRows.map(function(r){ return '<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--ffp-border);padding:7px 0;"><span class="psub" style="margin:0;">'+r[0]+'</span><span style="font-weight:800;font-size:13px;">'+r[1]+'</span></div>'; }).join('')+'</div></div>';
  var acts=d.activities||[];
  var actHtml='<div class="form-section"><div class="form-section-title">Recent activity ('+(d.activity_count_30d||0)+' in 30 days)</div>'+
    (acts.length?acts.map(function(a){ return '<div style="display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--ffp-border);padding:8px 0;"><div style="min-width:0;"><div style="font-weight:700;font-size:13px;">'+escHtml(a.activity||'Activity')+'</div><div class="psub" style="margin:1px 0 0;">'+_healthDate(a.logged_at)+'</div></div><div class="psub" style="margin:0;text-align:right;white-space:nowrap;">'+[(a.duration_min?a.duration_min+' min':''),(a.distance_km?a.distance_km+' km':''),(a.calories?a.calories+' kcal':'')].filter(Boolean).join(' · ')+'</div></div>'; }).join(''):'<div class="psub" style="padding:6px 0;">No recent activity.</div>')+'</div>';
  body.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span class="ms" style="color:#22c55e;">verified</span><span class="psub" style="margin:0;">Shared with permission · read-only</span></div>'+calHtml+fitHtml+actHtml;
}

// ── PACKAGES ──
async function renderPlans(){
  var host=document.getElementById('plans-list'); if(!host) return;
  var pid=_memProvId(); if(!pid){ host.innerHTML='<div class="empty-sub" style="text-align:left;">Sign in to manage packages.</div>'; return; }
  host.innerHTML='<div class="psub" style="margin:10px 0;">Loading…</div>';
  try{ var r=await window.supabase.rpc('pro_list_packages',{p_pro:pid}); _plans=(r&&r.data)?r.data:[]; }catch(e){ _plans=[]; }
  if(!_plans.length){ host.innerHTML=emptyState('No packages yet','Create a session pack or recurring package, then assign it to a client from the Clients tab.','New package','openPlanModal()'); return; }
  host.innerHTML=_plans.map(planRow).join('');
}
function planRow(p){
  var meta=[]; if(p.service_name)meta.push(p.service_name); meta.push(PKG_TYPES[p.pkg_type]||'Package'); if(p.price_aed!=null&&p.price_aed!=='')meta.push(_money2(p.price_aed)); if(p.credits)meta.push(p.credits+' sessions'); if(p.period_days)meta.push(p.period_days+' days');
  var n=p.client_count||0;
  return '<div style="background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:12px;padding:11px 13px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'+
    '<div style="min-width:0;"><div style="font-weight:800;color:var(--ffp-text);">'+escHtml(p.name)+'</div><div class="psub" style="margin:2px 0 0;">'+meta.join(' · ')+'</div><div class="psub" style="margin:2px 0 0;">'+n+' on this package</div></div>'+
    '<div style="display:flex;gap:6px;flex-shrink:0;"><button class="btn btn-sec btn-sm" onclick="openPlanModal(\''+p.id+'\')"><span class="ms">edit</span></button><button class="btn btn-ghost btn-sm" onclick="confirmDeletePlan(\''+p.id+'\')"><span class="ms">delete</span></button></div></div>';
}
var _memSvc=[];
async function _ensureMemSvc(){
  var pid=_memProvId(); if(!pid) return _memSvc;
  try{ var r=await window.supabase.rpc('pro_list_services',{p_pro:pid}); _memSvc=(r&&r.data)?r.data:[]; }catch(e){ _memSvc=[]; }
  return _memSvc;
}
async function openPlanModal(id){
  var editing=id?_plans.find(function(x){return x.id===id;}):null;
  var p=editing||{name:'',pkg_type:'sessions',credits:'',price_aed:'',period_days:'',notes:'',service_id:''};
  await _ensureMemSvc();
  var svcOpts='<option value="">— No specific service —</option>'+_memSvc.map(function(v){ return '<option value="'+v.id+'"'+(p.service_id===v.id?' selected':'')+'>'+escHtml(v.name||'Service')+'</option>'; }).join('');
  openModalShell('lg',(editing?'Edit package':'New package'),
    '<div class="form-section"><div class="form-section-title">Package</div><div class="form-grid">'+
      '<div class="field full"><div class="label">Name <span class="req">*</span></div><input class="input" id="pl-name" value="'+escHtml(p.name)+'" placeholder="e.g. 10 PT Sessions"></div>'+
      '<div class="field full"><div class="label">For which service</div><select class="select" id="pl-service_id">'+svcOpts+'</select></div>'+
      '<div class="field"><div class="label">Type</div><select class="select" id="pl-pkg_type"><option value="sessions"'+(p.pkg_type==='sessions'?' selected':'')+'>Session pack</option><option value="recurring"'+(p.pkg_type==='recurring'?' selected':'')+'>Recurring</option><option value="term"'+(p.pkg_type==='term'?' selected':'')+'>Term</option></select></div>'+
      '<div class="field"><div class="label">Price ('+_ccy2()+')</div><input class="input" type="number" id="pl-price_aed" value="'+escHtml(String(p.price_aed||''))+'"></div>'+
      '<div class="field"><div class="label">Sessions / credits</div><input class="input" type="number" id="pl-credits" value="'+escHtml(String(p.credits||''))+'" placeholder="e.g. 10"></div>'+
      '<div class="field"><div class="label">Valid days</div><input class="input" type="number" id="pl-period_days" value="'+escHtml(String(p.period_days||''))+'" placeholder="e.g. 60"></div>'+
      '<div class="field full"><div class="label">Notes</div><textarea class="textarea" id="pl-notes" rows="2">'+escHtml(p.notes||'')+'</textarea></div>'+
    '</div></div>',
    (editing?'<button class="btn btn-ghost left" onclick="confirmDeletePlan(\''+editing.id+'\')"><span class="ms">delete</span> Delete</button>':'')+
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="savePlan(\''+(editing?editing.id:'')+'\')">'+(editing?'Save':'Create')+'</button>');
}
async function savePlan(id){
  var g=function(i){var el=document.getElementById('pl-'+i);return el?el.value.trim():'';};
  var name=g('name'); if(!name){ showToast('Name is required','error'); return; }
  var pid=_memProvId();
  var payload={name:name,service_id:g('service_id'),pkg_type:g('pkg_type')||'sessions',price_aed:g('price_aed'),credits:g('credits'),period_days:g('period_days'),notes:g('notes')};
  try{ var r=await window.supabase.rpc('pro_save_package',{p_pro:pid,p_id:id||null,p:payload}); if(r&&r.error)throw r.error; showToast(id?'Package updated':'Package created','success'); closeModal(); renderPlans(); }catch(e){ showToast('Could not save package','error'); }
}
function confirmDeletePlan(id){ openModalShell('','Delete package?','<div class="psub" style="margin:6px 0;">Clients already assigned keep their record.</div>','<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doDeletePlan(\''+id+'\')">Delete</button>'); }
async function doDeletePlan(id){ var pid=_memProvId(); try{ var r=await window.supabase.rpc('pro_delete_package',{p_pro:pid,p_id:id}); if(r&&r.error)throw r.error; showToast('Package deleted','success'); }catch(e){ showToast('Could not delete','error'); } closeModal(); renderPlans(); }

// ── Client packages (Membership button) ──
async function openMembership(clientId){
  var pid=_memProvId(); if(!pid) return; _curMembershipMember=clientId;
  var m=(_members||[]).find(function(x){return x.id===clientId;})||{};
  if(!_plans.length){ try{ var rp=await window.supabase.rpc('pro_list_packages',{p_pro:pid}); _plans=(rp&&rp.data)?rp.data:[]; }catch(e){} }
  var assigns=[]; try{ var r=await window.supabase.rpc('pro_client_packages_list',{p_pro:pid,p_client:clientId}); assigns=(r&&r.data)?r.data:[]; }catch(e){}
  var current=assigns.length?assigns.map(membershipRow).join(''):'<div class="psub" style="margin:6px 0;">No packages yet.</div>';
  var today=new Date(); var todayStr=today.getFullYear()+'-'+('0'+(today.getMonth()+1)).slice(-2)+'-'+('0'+today.getDate()).slice(-2);
  var form;
  if(_plans.length){
    var opts=_plans.map(function(p){return '<option value="'+p.id+'">'+escHtml(p.name)+'</option>';}).join('');
    form='<div class="form-section"><div class="form-section-title">Assign a package</div><div class="form-grid">'+
      '<div class="field"><div class="label">Package</div><select class="select" id="asg-plan">'+opts+'</select></div>'+
      '<div class="field"><div class="label">Start</div><input class="input" type="date" id="asg-start" value="'+todayStr+'"></div>'+
      '<div class="field full"><button class="btn btn-pri" onclick="assignPlan(\''+clientId+'\')"><span class="ms">add</span> Assign</button></div></div></div>';
  } else { form='<div class="psub" style="margin:8px 0;">Create a package in the Packages tab first.</div>'; }
  openModalShell('lg','Packages · '+escHtml(m.full_name||'Client'),'<div class="form-section"><div class="form-section-title">Current</div>'+current+'</div>'+form,'<button class="btn btn-ghost" onclick="closeModal()">Close</button>');
}
function membershipRow(a){
  var active=a.status==='active'; var stColor=active?'rgba(43,168,224,.16);color:#6fc6ef':'rgba(255,255,255,.08);color:#9fb0bf';
  var bits=[]; if(a.credits_remaining!=null)bits.push(a.credits_remaining+' left'); if(a.expiry_date)bits.push('expires '+a.expiry_date);
  return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--ffp-border);">'+
    '<div style="min-width:0;"><div style="font-weight:700;color:var(--ffp-text);">'+escHtml(a.package_name||'Package')+'</div>'+(bits.length?'<div class="psub" style="margin:2px 0 0;">'+bits.join(' · ')+'</div>':'')+'</div>'+
    '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;"><span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:'+stColor+'">'+(a.status||'active')+'</span>'+(active?'<button class="btn btn-ghost btn-sm" onclick="cancelMemberPlan(\''+a.id+'\')">Cancel</button>':'')+'</div></div>';
}
async function assignPlan(clientId){
  var pid=_memProvId(); var sel=document.getElementById('asg-plan'); var start=document.getElementById('asg-start');
  if(!sel||!sel.value){ showToast('Pick a package','error'); return; }
  try{ var r=await window.supabase.rpc('pro_assign_package',{p_pro:pid,p_client:clientId,p_package:sel.value,p_start:(start&&start.value)?start.value:null}); if(r&&r.error)throw r.error; showToast('Package assigned','success'); openMembership(clientId); }catch(e){ showToast('Could not assign','error'); }
}
async function cancelMemberPlan(id){
  var pid=_memProvId(); try{ var r=await window.supabase.rpc('pro_cancel_client_package',{p_pro:pid,p_id:id}); if(r&&r.error)throw r.error; showToast('Cancelled','success'); }catch(e){ showToast('Could not cancel','error'); }
  if(_curMembershipMember) openMembership(_curMembershipMember);
}

// ── MESSAGES ──
function _cmVal(i){ var el=document.getElementById('cm-'+i); return el?el.value:''; }
async function renderComms(){
  var host=document.getElementById('comms-list'); if(!host) return;
  var pid=_memProvId(); if(!pid){ host.innerHTML='<div class="empty-sub" style="text-align:left;">Sign in to message clients.</div>'; return; }
  host.innerHTML='<div class="psub" style="margin:10px 0;">Loading…</div>';
  try{ var r=await window.supabase.rpc('pro_list_broadcasts',{p_pro:pid}); _broadcasts=(r&&r.data)?r.data:[]; }catch(e){ _broadcasts=[]; }
  if(!_broadcasts.length){ host.innerHTML=emptyState('No messages yet','Compose an announcement or reminder and pick who it goes to. Delivery switches on when channels connect.','Compose','openComposeModal()'); return; }
  host.innerHTML=_broadcasts.map(broadcastRow).join('');
}
function broadcastRow(b){
  var when=b.created_at?String(b.created_at).slice(0,10):''; var sub=[b.audience_label||'Everyone',(b.recipient_count||0)+' recipients',COMMS_CHANNELS[b.channel]||'Email']; if(when)sub.push(when);
  return '<div style="background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:12px;padding:11px 13px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'+
    '<div style="min-width:0;"><div style="font-weight:800;color:var(--ffp-text);">'+escHtml(b.subject||'(no subject)')+'</div><div class="psub" style="margin:2px 0 0;">'+sub.map(escHtml).join(' · ')+'</div></div>'+
    '<div style="display:flex;align-items:center;gap:7px;flex-shrink:0;"><span class="ni-lock-pill">Logged</span><button class="btn btn-ghost btn-sm" onclick="confirmDeleteBroadcast(\''+b.id+'\')"><span class="ms">delete</span></button></div></div>';
}
function openComposeModal(){
  var statusOpts=Object.keys(CLIENT_STATUS).map(function(k){return '<option value="'+k+'">'+CLIENT_STATUS[k]+'</option>';}).join('');
  openModalShell('lg','Compose message',
    '<div class="form-section"><div class="form-section-title">Channel</div><div class="form-grid"><div class="field full"><select class="select" id="cm-channel"><option value="email">Email</option><option value="push">Push</option><option value="sms">SMS</option></select><div class="psub" style="margin:6px 2px 0;">Composes &amp; logs who it would reach. Delivery switches on when channels connect.</div></div></div></div>'+
    '<div class="form-section"><div class="form-section-title">Audience</div><div class="form-grid">'+
      '<div class="field"><div class="label">Send to</div><select class="select" id="cm-aud-type" onchange="commsAudienceChange()"><option value="all">Everyone</option><option value="status">By status</option></select></div>'+
      '<div class="field" id="cm-aud-status-wrap" style="display:none;"><div class="label">Status</div><select class="select" id="cm-aud-status" onchange="_updateAudienceCount()">'+statusOpts+'</select></div>'+
      '<div class="field full"><div class="psub" id="cm-count" style="margin:0;">Recipients: …</div></div></div></div>'+
    '<div class="form-section"><div class="form-section-title">Message</div><div class="form-grid"><div class="field full"><div class="label">Subject</div><input class="input" id="cm-subject"></div><div class="field full"><div class="label">Message</div><textarea class="textarea" id="cm-body" rows="5"></textarea></div></div></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="sendBroadcast()">Save message</button>');
  _updateAudienceCount();
}
function commsAudienceChange(){ var t=_cmVal('aud-type'); var sw=document.getElementById('cm-aud-status-wrap'); if(sw)sw.style.display=(t==='status')?'':'none'; _updateAudienceCount(); }
async function _updateAudienceCount(){
  var pid=_memProvId(); if(!pid) return; var t=_cmVal('aud-type'); var ref=t==='status'?_cmVal('aud-status'):''; var lbl=document.getElementById('cm-count'); if(lbl)lbl.textContent='Recipients: …';
  try{ var r=await window.supabase.rpc('pro_audience_count',{p_pro:pid,p_type:t,p_ref:ref}); var n=(r&&r.data!=null)?r.data:0; if(lbl)lbl.textContent='Recipients: '+n; }catch(e){ if(lbl)lbl.textContent='Recipients: —'; }
}
async function sendBroadcast(){
  var pid=_memProvId(); if(!pid) return; var t=_cmVal('aud-type'); var ref='',label='Everyone';
  if(t==='status'){ ref=_cmVal('aud-status'); label='Status: '+(CLIENT_STATUS[ref]||ref); }
  var subject=_cmVal('subject').trim(); var body=_cmVal('body').trim(); if(!body){ showToast('Write a message first','error'); return; }
  var payload={channel:_cmVal('channel')||'email',audience_type:t,audience_ref:ref,audience_label:label,subject:subject,body:body};
  try{ var r=await window.supabase.rpc('pro_save_broadcast',{p_pro:pid,p:payload}); if(r&&r.error)throw r.error; showToast('Message saved','success'); closeModal(); renderComms(); }catch(e){ showToast('Could not save','error'); }
}
function confirmDeleteBroadcast(id){ openModalShell('','Delete message?','<div class="psub" style="margin:6px 0;">This removes it from your history.</div>','<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doDeleteBroadcast(\''+id+'\')">Delete</button>'); }
async function doDeleteBroadcast(id){ var pid=_memProvId(); try{ var r=await window.supabase.rpc('pro_delete_broadcast',{p_pro:pid,p_id:id}); if(r&&r.error)throw r.error; showToast('Deleted','success'); }catch(e){ showToast('Could not delete','error'); } closeModal(); renderComms(); }

// First open
try{ if(document.getElementById('mem-list')) renderMembers(); }catch(e){}

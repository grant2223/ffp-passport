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
var _cstStyle = { active:'background:rgba(43,168,224,.16);color:#6fc6ef', paused:'background:rgba(255,204,0,.16);color:#FFCC00', archived:'background:rgba(10,62,68,.08);color:#5a6b6e' };

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
  var tagHtml=tags.length?'<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:5px;">'+tags.map(function(t){return '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(10,62,68,.06);color:#5a6b6e;">'+escHtml(t)+'</span>';}).join('')+'</div>':'';
  return '<div onclick="clientProfile(\''+m.id+'\')" style="background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:12px;padding:11px 13px;margin-bottom:9px;display:flex;align-items:center;gap:11px;cursor:pointer;">'+
    '<div style="width:38px;height:38px;border-radius:10px;background:rgba(10,62,68,.16);color:#0a3e44;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;">'+escHtml(initials)+'</div>'+
    '<div style="min-width:0;flex:1;"><div style="font-weight:800;color:var(--ffp-text);">'+escHtml(m.full_name||'—')+'</div>'+(contact.length?'<div class="psub" style="margin:2px 0 0;">'+contact.join(' · ')+'</div>':'')+tagHtml+'</div>'+
    '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;flex-shrink:0;'+stStyle+'">'+(CLIENT_STATUS[st]||'Active')+'</span>'+
    '<span class="ms" style="color:var(--ffp-text-dim);flex-shrink:0;">chevron_right</span>'+
  '</div>';
}
// Tap a client strap → their profile, with everything you do for a client in one place.
async function clientProfile(id){
  // Reachable from Scheduling too — the client loader/_members may not be populated yet, so self-load.
  if(!(_members&&_members.length)){ try{ var rr=await window.supabase.rpc('pro_list_clients',{p_pro:_memProvId()}); if(rr&&rr.data) _members=rr.data; }catch(e){} }
  var m=(_members||[]).find(function(x){return x.id===id;}); if(!m){ showToast('Client not found','error'); return; }
  var st=m.status||'active'; var stStyle=_cstStyle[st]||_cstStyle.active;
  var jd=m.join_date?String(m.join_date).slice(0,10):'';
  var gn=m.given_names||'', sn=m.surname||'';
  if(!gn && !sn && m.full_name){ var _np=String(m.full_name).trim().split(/\s+/); gn=_np.shift()||''; sn=_np.join(' '); }
  var nm=(m.full_name||((gn+' '+sn).trim())||'Client');
  var tags=(m.tags||'').split(',').map(function(t){return t.trim();}).filter(Boolean);
  var fmtDob=function(d){ if(!d)return ''; try{ return new Date(String(d).slice(0,10)+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}); }catch(e){ return String(d).slice(0,10); } };
  var fmtSince=function(d){ if(!d)return ''; try{ return new Date(String(d).slice(0,10)+'T00:00:00').toLocaleDateString('en-GB',{month:'short',year:'numeric'}); }catch(e){ return String(d).slice(0,10); } };
  // Pull the client's FFP Passport up-front so we can show the real card when they hold one.
  var pp={}; try{ var pr=await window.supabase.rpc('pro_client_passport',{p_pro:_memProvId(),p_client:id}); pp=(pr&&pr.data)||{}; }catch(e){}
  var hasPass=!!pp.has_account;
  var email=(pp.email||m.email||''), phone=(pp.phone||m.phone||'');
  var head;
  if(hasPass && window.FFPPassportCard){
    // EXACT community passport card (shared canonical renderer). Both faces pre-built → flip is clean both ways.
    var _fd=window.ffpFmtPassDate||function(d){return d?String(d).slice(0,10):'';};
    var m2={ id:pp.id||'', name:nm, givenNames:pp.given_names||gn, surname:pp.surname||sn, photo:pp.photo_url||'',
      country:pp.country||pp.nationality||'', nationality:pp.nationality||pp.country||'', gender:pp.gender||'',
      dob:_fd(pp.date_of_birth), issueDate:_fd(pp.member_since), expiryDate:_fd(pp.member_since,1),
      memberType:pp.tier||'member', memberSince:pp.member_since?(function(){try{return new Date(pp.member_since).getFullYear();}catch(e){return '';}})():'' };
    // private back fields (sports/reliability/meetupsHosted/city) intentionally omitted — coach sees identity only.
    head='<div class="pass-container" style="margin:-2px 0 10px;">'+window.FFPPassportCard.render(m2,{flippable:true})+'</div>'+
      '<div style="font-size:10.5px;font-weight:700;color:var(--ffp-purple);margin:0 0 12px;text-align:center;"><span class="ms" style="font-size:13px;vertical-align:-2px;">verified_user</span> Pulled from their FFP Passport</div>';
  }
  else if(hasPass){ head=_ppCardHtml(pp, nm, id); }
  else {
    var cell=function(lbl,val){ return '<div style="padding:7px 2px;min-width:0;border-bottom:1px solid var(--ffp-border);"><div style="font-size:9.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:var(--ffp-text-dim);margin-bottom:2px;">'+lbl+'</div><div style="font-weight:700;color:var(--ffp-text);font-size:13px;word-break:break-word;line-height:1.3;">'+(val?escHtml(val):'<span style="color:var(--ffp-text-dim);font-weight:600;">—</span>')+'</div></div>'; };
    head='<div style="display:flex;align-items:center;gap:13px;margin:-2px 0 14px;">'+
      '<span style="width:52px;height:52px;border-radius:50%;background:rgba(124,58,237,0.14);color:var(--ffp-purple);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;flex:0 0 auto;">'+escHtml(nm.slice(0,1).toUpperCase())+'</span>'+
      '<div style="min-width:0;"><div style="font-weight:800;font-size:17px;color:var(--ffp-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(nm)+'</div>'+
        '<div style="margin-top:4px;display:flex;align-items:center;gap:7px;flex-wrap:wrap;"><span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;'+stStyle+'">'+(CLIENT_STATUS[st]||'Active')+'</span>'+(tags.length?'<span class="psub" style="margin:0;font-size:11px;">'+escHtml(tags.join(' · '))+'</span>':'')+'</div></div></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">'+cell('Email',email)+cell('Phone',phone)+cell('Date of birth',fmtDob(m.date_of_birth))+cell('Gender',m.gender)+cell('Nationality',m.nationality)+cell('Client since',fmtSince(jd))+'</div>';
  }
  var body=head+_contactRow(email,phone)+_fiveButtons(id)+'<div id="cp-notes-prev" style="margin-top:18px;"></div>';
  openModalShell('lg', escHtml(nm), body,
    '<button class="btn btn-ghost left" onclick="closeModal();confirmDeleteMember(\''+id+'\')"><span class="ms">delete</span> Delete client</button>'+
    '<button class="btn btn-ghost" onclick="closeModal()">Close</button>');
  // Scale the passport card to the modal width (the shared card is 540px-based and transform-scales to fit).
  if(hasPass && window.ffpScaleCards){ var _scp=function(){ try{ window.ffpScaleCards(document); }catch(e){} }; requestAnimationFrame(function(){ requestAnimationFrame(_scp); }); setTimeout(_scp,60); setTimeout(_scp,200); }
  // Recent note (latest), with View all on the opposite side.
  if(window.supabase){ try{ window.supabase.rpc('pro_list_client_notes',{p_pro:_memProvId(),p_client:id}).then(function(r){
    var notes=(r&&r.data)||[]; var host=document.getElementById('cp-notes-prev'); if(!host) return;
    var head2='<div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 8px;"><div style="font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--ffp-text-dim);">Recent note</div><button onclick="closeModal();openClientNotes(\''+id+'\')" style="background:none;border:none;color:var(--ffp-purple);font-size:11.5px;font-weight:800;cursor:pointer;">'+(notes.length?'View all →':'Add note')+'</button></div>';
    if(!notes.length){ host.innerHTML=head2+'<div class="psub" style="margin:0;">No notes yet — tap Notes to start tracking sessions.</div>'; return; }
    var n=notes[0];
    host.innerHTML=head2+'<div style="border-left:3px solid var(--ffp-purple);padding:1px 0 1px 10px;"><div style="font-size:12.5px;color:var(--ffp-text);line-height:1.5;white-space:pre-wrap;">'+escHtml(n.body||'')+'</div><div class="psub" style="margin:2px 0 0;font-size:10px;">'+cnWhen(n.created_at)+'</div></div>';
  }).catch(function(){}); }catch(e){} }
}
// ─── Passport flip card (shown when the client holds an FFP Passport) ───
function _ppEnsureCss(){
  if(document.getElementById('ppc-css')) return;
  var s=document.createElement('style'); s.id='ppc-css';
  s.textContent='.ppc-wrap{perspective:1400px;margin:-2px 0 4px;}.ppc-inner{position:relative;width:100%;transition:transform .6s cubic-bezier(.2,.7,.2,1);transform-style:preserve-3d;cursor:pointer;}.ppc-inner.flipped{transform:rotateY(180deg);}.ppc-face{border-radius:15px;overflow:hidden;-webkit-backface-visibility:hidden;backface-visibility:hidden;box-shadow:0 10px 28px rgba(10,62,68,.28);}.ppc-back{position:absolute;inset:0;transform:rotateY(180deg);}';
  document.head.appendChild(s);
}
function ppFlip(el){ if(el) el.classList.toggle('flipped'); }
function _ppCardHtml(pp, nm, id){
  _ppEnsureCss();
  var esc=escHtml;
  var photo = pp.photo_url ? 'background-image:url("'+String(pp.photo_url).replace(/["\\]/g,'')+'");background-size:cover;background-position:center top;' : '';
  var initial = esc((nm||'?').slice(0,1).toUpperCase());
  var fmtD=function(d){ if(!d)return '—'; try{return new Date(String(d).slice(0,10)+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}catch(e){return '—';} };
  var since = pp.member_since ? (function(){ try{return new Date(pp.member_since).toLocaleDateString('en-GB',{month:'short',year:'numeric'});}catch(e){return '—';} })() : '—';
  var tier = pp.tier ? String(pp.tier) : 'Passport';
  var active = !!pp.passport_active;
  var pf=function(lbl,val){ return '<div style="margin-bottom:5px;"><div style="font-size:8px;font-weight:800;letter-spacing:.6px;color:rgba(255,255,255,.55);">'+lbl+'</div><div style="font-size:12.5px;font-weight:700;color:#fff;line-height:1.25;word-break:break-word;">'+(val?esc(val):'—')+'</div></div>'; };
  var front='<div class="ppc-face ppc-front" style="position:relative;background:linear-gradient(135deg,#0a3e44,#0f5f72);padding:14px 15px;color:#fff;">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">'+
        '<div><div style="font-size:13px;font-weight:900;letter-spacing:1px;">FFP PASSPORT</div><div style="font-size:7.5px;letter-spacing:2px;color:rgba(255,255,255,.6);">WORLDWIDE · ACTIVE LIFESTYLE</div></div>'+
        '<div style="text-align:right;"><div style="font-size:8px;font-weight:800;color:rgba(255,255,255,.55);">PASSPORT NO.</div><div style="font-size:11px;font-weight:800;font-family:monospace;">'+esc(pp.passport_no||'—')+'</div></div>'+
      '</div>'+
      '<div style="display:flex;gap:12px;">'+
        '<div style="width:62px;height:78px;border-radius:8px;background:#0f5a7a;'+photo+'flex:0 0 auto;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.25);">'+(pp.photo_url?'':'<span style="font-size:28px;font-weight:900;color:#fff;">'+initial+'</span>')+'</div>'+
        '<div style="flex:1;min-width:0;">'+pf('SURNAME',pp.surname)+pf('GIVEN NAMES',pp.given_names)+
          '<div style="display:flex;gap:12px;"><div style="flex:1;">'+pf('NATIONALITY',pp.nationality)+'</div><div style="flex:1;">'+pf('DATE OF BIRTH',fmtD(pp.date_of_birth))+'</div></div></div>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.15);">'+
        '<span style="font-size:9px;font-weight:800;padding:3px 9px;border-radius:20px;background:rgba(255,255,255,.16);letter-spacing:.5px;">'+esc(String(tier).toUpperCase())+'</span>'+
        '<span style="font-size:9px;color:rgba(255,255,255,.6);">Since '+esc(since)+'</span>'+
        '<span style="font-size:9px;font-weight:800;color:'+(active?'#7CFFB2':'#ffd27c')+';">'+(active?'● ACTIVE':'○ INACTIVE')+'</span>'+
      '</div>'+
      '<div style="text-align:center;font-size:8px;color:rgba(255,255,255,.42);margin-top:7px;letter-spacing:.5px;">TAP TO FLIP ⟳</div>'+
    '</div>';
  var back='<div class="ppc-face ppc-back" style="background:linear-gradient(135deg,#0f5f72,#0a3e44);padding:15px;color:#fff;">'+
      '<div style="font-size:11px;font-weight:900;letter-spacing:1px;margin-bottom:12px;">IDENTITY · FFP PASSPORT</div>'+
      '<div style="display:flex;gap:14px;align-items:center;">'+
        '<div style="width:72px;height:72px;border-radius:10px;background:#fff;flex:0 0 auto;display:flex;align-items:center;justify-content:center;"><span class="ms" style="font-size:52px;color:#0a3e44;">qr_code_2</span></div>'+
        '<div style="flex:1;font-size:11px;line-height:1.65;min-width:0;">'+
          '<div><span style="color:rgba(255,255,255,.55);">No.</span> <b style="font-family:monospace;">'+esc(pp.passport_no||'—')+'</b></div>'+
          '<div><span style="color:rgba(255,255,255,.55);">Tier</span> <b>'+esc(tier)+'</b></div>'+
          '<div><span style="color:rgba(255,255,255,.55);">Expires</span> <b>'+fmtD(pp.passport_expires_at)+'</b></div>'+
          '<div><span style="color:rgba(255,255,255,.55);">Status</span> <b style="color:'+(active?'#7CFFB2':'#ffd27c')+';">'+(active?'Active':'Inactive')+'</b></div>'+
        '</div>'+
      '</div>'+
      '<div style="margin-top:13px;font-size:8.5px;color:rgba(255,255,255,.5);line-height:1.5;border-top:1px solid rgba(255,255,255,.15);padding-top:9px;">Verified by FFP Passport — matched to the client’s active Passport by email.</div>'+
      '<div style="text-align:center;font-size:8px;color:rgba(255,255,255,.42);margin-top:6px;letter-spacing:.5px;">TAP TO FLIP ⟳</div>'+
    '</div>';
  return '<div class="ppc-wrap"><div class="ppc-inner" onclick="ppFlip(this)">'+front+back+'</div></div>'+
    '<div style="font-size:10.5px;font-weight:700;color:var(--ffp-purple);margin:8px 0 12px;text-align:center;"><span class="ms" style="font-size:13px;vertical-align:-2px;">verified_user</span> Pulled from their FFP Passport</div>';
}
function _contactRow(email, phone){
  // Email + Phone always sit side by side. A missing one renders greyed-out/disabled (not hidden).
  var base='flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;border-radius:12px;font-weight:700;font-size:13px;text-decoration:none;';
  var on=base+'background:var(--ffp-bg-card);border:1px solid var(--ffp-border-mid);color:var(--ffp-text);';
  var off=base+'background:var(--ffp-bg-3,#eef3f4);border:1px solid var(--ffp-border);color:var(--ffp-text-dim);opacity:.55;cursor:default;';
  var em = email
    ? '<a href="mailto:'+escHtml(email)+'" style="'+on+'"><span class="ms" style="font-size:18px;color:var(--ffp-purple);">mail</span> Email</a>'
    : '<div style="'+off+'" title="No email on file"><span class="ms" style="font-size:18px;">mail</span> Email</div>';
  var ph = phone
    ? '<a href="tel:'+String(phone).replace(/[^+0-9]/g,'')+'" style="'+on+'"><span class="ms" style="font-size:18px;color:var(--ffp-purple);">call</span> Call</a>'
    : '<div style="'+off+'" title="No number yet — add one via Edit"><span class="ms" style="font-size:18px;">call</span> Call</div>';
  return '<div style="display:flex;gap:8px;margin:0 0 14px;">'+em+ph+'</div>';
}
function _fiveButtons(id){
  var sb=function(ic,lbl,fn){ return '<button onclick="closeModal();'+fn+'" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:10px 3px;background:var(--ffp-bg-card);border:1px solid var(--ffp-border-mid);border-radius:13px;cursor:pointer;color:var(--ffp-text);font-family:inherit;min-height:64px;"><span class="ms" style="font-size:20px;color:var(--ffp-purple);">'+ic+'</span><span style="font-size:9.5px;font-weight:700;text-align:center;line-height:1.1;">'+lbl+'</span></button>'; };
  return '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;">'+
    sb('health_and_safety','Health','openClientHealth(\''+id+'\')')+
    sb('card_membership','Packages','openMembership(\''+id+'\')')+
    sb('assignment','Forms','clientAssessment(\''+id+'\')')+
    sb('sticky_note_2','Notes','openClientNotes(\''+id+'\')')+
    sb('edit','Edit','openMemberModal(\''+id+'\')')+
  '</div>';
}
// ─── COACH NOTES (threaded, per client) ───
var _cnClient=null, _cnNotes=[];
function cnWhen(ts){ if(!ts) return ''; try{ var d=new Date(ts); return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+' · '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return String(ts).slice(0,10); } }
function openClientNotes(id){
  _cnClient=id;
  var m=(_members||[]).find(function(x){return x.id===id;})||{};
  openModalShell('lg','Notes · '+escHtml(m.full_name||'Client'),
    '<div style="display:flex;gap:8px;margin:0 0 14px;"><input id="cn-input" class="input" placeholder="Add a note — what they worked on, how they went…" style="flex:1;font-size:13px;" onkeydown="if(event.key===\'Enter\'){event.preventDefault();cnAdd();}"><button class="btn btn-pri btn-sm" onclick="cnAdd()"><span class="ms">add</span> Add</button></div>'+
    '<div id="cn-list"><div class="psub" style="padding:6px 0;">Loading…</div></div>',
    '<button class="btn btn-ghost left" onclick="clientProfile(\''+id+'\')">Back</button><button class="btn btn-ghost" onclick="closeModal()">Close</button>');
  cnLoad();
}
async function cnLoad(){
  var pid=_memProvId();
  try{ var r=await window.supabase.rpc('pro_list_client_notes',{p_pro:pid,p_client:_cnClient}); _cnNotes=(r&&r.data)||[]; }catch(e){ _cnNotes=[]; }
  cnRender();
}
function cnRender(){
  var host=document.getElementById('cn-list'); if(!host) return;
  host.innerHTML = _cnNotes.length ? _cnNotes.map(function(n){
    return '<div style="border-left:3px solid var(--ffp-purple);background:var(--ffp-bg-card);border-radius:0 10px 10px 0;padding:10px 13px;margin-bottom:8px;"><div style="font-size:13px;color:var(--ffp-text);line-height:1.55;white-space:pre-wrap;">'+escHtml(n.body||'')+'</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;"><div class="psub" style="margin:0;font-size:10.5px;">'+cnWhen(n.created_at)+'</div><button onclick="cnDelete(\''+n.id+'\')" style="background:none;border:none;color:var(--ffp-text-dim);cursor:pointer;font-size:11px;font-weight:700;">Delete</button></div></div>';
  }).join('') : '<div class="psub" style="padding:6px 0;">No notes yet — add the first one above to track what they’ve been working on.</div>';
}
async function cnAdd(){
  var inp=document.getElementById('cn-input'); if(!inp) return; var body=(inp.value||'').trim(); if(!body) return;
  var pid=_memProvId();
  try{ var r=await window.supabase.rpc('pro_add_client_note',{p_pro:pid,p_client:_cnClient,p_body:body}); if(r&&r.error) throw r.error;
    var d=(r&&r.data)||{}; _cnNotes.unshift({id:d.id,body:body,created_at:d.created_at||new Date().toISOString()}); inp.value=''; cnRender();
  }catch(e){ showToast('Could not add note','error'); }
}
async function cnDelete(nid){
  var pid=_memProvId();
  try{ var r=await window.supabase.rpc('pro_delete_client_note',{p_pro:pid,p_id:nid}); if(r&&r.error) throw r.error;
    _cnNotes=_cnNotes.filter(function(n){return String(n.id)!==String(nid);}); cnRender();
  }catch(e){ showToast('Could not delete','error'); }
}
// ─── ASSESSMENT FORMS (client record) — waivers, PAR-Q+, custom templates ───
var _afForms=[], _afClient=null, _afFields=[], _afEditTplId=null, _afTpls=[];
function afWhen(ts){ if(!ts) return ''; try{ return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return String(ts).slice(0,10); } }
function clientAssessment(id){
  _afClient=id;
  var m=(_members||[]).find(function(x){return x.id===id;})||{};
  openModalShell('lg','Forms · '+escHtml(m.full_name||'Client'),
    '<div style="display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap;"><button class="btn btn-pri btn-sm" onclick="afAssign()"><span class="ms">post_add</span> Assign form</button><button class="btn btn-sec btn-sm" onclick="afManageTemplates()"><span class="ms">tune</span> Manage templates</button></div>'+
    '<div id="af-list"><div class="psub" style="padding:6px 0;">Loading…</div></div>',
    '<button class="btn btn-ghost" onclick="closeModal()">Close</button>');
  afLoad();
}
async function afLoad(){
  var pid=_memProvId();
  try{ var r=await window.supabase.rpc('pro_list_client_forms',{p_pro:pid,p_client:_afClient}); _afForms=(r&&r.data)||[]; }catch(e){ _afForms=[]; }
  afRender();
}
function afStatusPill(f){
  if(f.status==='completed'){ var l=f.source==='upload'?'Uploaded':(f.requires_signature?'Signed':'Completed'); return '<span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;color:#fff;background:#15833f;white-space:nowrap;">'+l+'</span>'; }
  return '<span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;color:#7a4f00;background:#fbe2a8;white-space:nowrap;">Outstanding</span>';
}
function afToggle(el){ var dd=el.nextElementSibling; if(!dd) return; var hidden=(dd.style.display==='none'||dd.style.display===''); dd.style.display=hidden?'block':'none'; var ch=el.querySelector('.af-chev'); if(ch) ch.style.transform=hidden?'rotate(180deg)':'none'; }
function afRender(){
  var host=document.getElementById('af-list'); if(!host) return;
  if(!_afForms.length){ host.innerHTML='<div class="psub" style="padding:6px 0;">No forms yet — assign one above (e.g. a waiver or PAR-Q+).</div>'; return; }
  host.innerHTML=_afForms.map(function(f){
    var det='';
    if(f.status==='completed'){
      if(f.source==='upload'&&f.uploaded_file_url){ det+='<div style="margin-bottom:7px;"><a href="'+escHtml(f.uploaded_file_url)+'" target="_blank" rel="noopener" style="color:var(--ffp-purple);font-weight:700;font-size:12.5px;"><span class="ms" style="font-size:15px;vertical-align:-3px;">description</span> View uploaded copy</a></div>'; }
      var resp=f.responses||{}; (f.fields||[]).forEach(function(fl){ if(fl.type==='statement'||fl.type==='info') return; var v=resp[fl.key]; if(fl.type==='consent') v=(v?'Accepted':'Not accepted'); if(fl.type==='yesno') v=(v===true||v==='yes'?'Yes':(v===false||v==='no'?'No':v)); det+='<div style="font-size:12px;margin-bottom:5px;line-height:1.5;"><span class="psub" style="margin:0;">'+escHtml(fl.label||fl.key)+'</span><br><span style="font-weight:700;color:var(--ffp-text);">'+escHtml(v==null||v===''?'—':String(v))+'</span></div>'; });
      if(f.signature_name) det+='<div class="psub" style="font-size:12px;margin-top:7px;">Signed by <b style="color:var(--ffp-text);">'+escHtml(f.signature_name)+'</b> · '+afWhen(f.completed_at)+'</div>';
    } else {
      det+='<div class="psub" style="margin:0 0 8px;">Waiting on the client to complete &amp; sign in their app — or upload a signed copy here.</div>'+
        '<button class="btn btn-sec btn-sm" onclick="afUpload(\''+f.id+'\')"><span class="ms">upload_file</span> Upload signed copy</button>';
    }
    det+='<div style="margin-top:10px;display:flex;gap:16px;"><button onclick="afPreviewForm(\''+f.id+'\')" style="background:none;border:none;color:var(--ffp-purple);font-size:11px;font-weight:700;cursor:pointer;">Preview</button><button onclick="afRemove(\''+f.id+'\')" style="background:none;border:none;color:var(--ffp-text-dim);font-size:11px;font-weight:700;cursor:pointer;">Remove form</button></div>';
    var left='<div style="font-weight:700;color:var(--ffp-text);font-size:13px;">'+escHtml(f.title)+'</div><div class="psub" style="margin:0;">Assigned '+afWhen(f.assigned_at)+'</div>';
    return '<div style="border-bottom:1px solid var(--ffp-border);"><div onclick="afToggle(this)" style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 2px;cursor:pointer;"><div style="min-width:0;">'+left+'</div><div style="display:flex;align-items:center;gap:10px;flex:0 0 auto;">'+afStatusPill(f)+'<span class="ms af-chev" style="font-size:18px;color:var(--ffp-text-dim);">expand_more</span></div></div><div style="display:none;padding:0 2px 12px;">'+det+'</div></div>';
  }).join('');
}
function afUpload(fid){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*,application/pdf';
  inp.onchange=async function(){ var file=inp.files&&inp.files[0]; if(!file) return; var pid=_memProvId();
    try{ showToast('Uploading…','info');
      var path='pro-forms/'+pid+'/'+fid+'-'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      var up=await window.supabase.storage.from('form-files').upload(path,file,{upsert:true}); if(up.error) throw up.error;
      var pub=window.supabase.storage.from('form-files').getPublicUrl(path); var url=pub&&pub.data&&pub.data.publicUrl;
      var r=await window.supabase.rpc('pro_complete_form_upload',{p_pro:pid,p_form_id:fid,p_file_url:url}); if(r&&r.error) throw r.error;
      showToast('Uploaded','success'); afLoad();
    }catch(e){ showToast('Upload failed','error'); }
  };
  inp.click();
}
async function afRemove(fid){
  var pid=_memProvId();
  try{ var r=await window.supabase.rpc('pro_delete_client_form',{p_pro:pid,p_form_id:fid}); if(r&&r.error) throw r.error;
    _afForms=_afForms.filter(function(f){return String(f.id)!==String(fid);}); afRender();
  }catch(e){ showToast('Could not remove','error'); }
}
async function afAssign(){
  var pid=_memProvId();
  openModalShell('lg','Assign a form','<div class="psub" style="padding:8px 0;">Loading templates…</div>','<button class="btn btn-ghost" onclick="clientAssessment(\''+_afClient+'\')">Back</button>');
  try{ var r=await window.supabase.rpc('pro_list_form_templates',{p_pro:pid}); var tpls=(r&&r.data)||[];
    var body=tpls.length? tpls.map(function(t){ return '<button onclick="afDoAssign(\''+t.id+'\')" style="display:block;width:100%;text-align:left;border:1px solid var(--ffp-border-mid);background:var(--ffp-bg-card);border-radius:10px;padding:11px 13px;margin-bottom:8px;cursor:pointer;font-family:inherit;"><div style="font-weight:800;font-size:13px;color:var(--ffp-text);">'+escHtml(t.title)+'</div>'+(t.description?'<div class="psub" style="margin:2px 0 0;">'+escHtml(t.description)+'</div>':'')+'</button>'; }).join('') : '<div class="psub" style="padding:6px 0;">No templates yet. Create one with “Manage templates”.</div>';
    var mb=document.querySelector('#ffp-modal .mc-body'); if(mb) mb.innerHTML=body;
  }catch(e){ var mb=document.querySelector('#ffp-modal .mc-body'); if(mb) mb.innerHTML='<div class="psub">Could not load templates.</div>'; }
}
async function afDoAssign(tid){
  var pid=_memProvId();
  try{ var r=await window.supabase.rpc('pro_assign_form',{p_pro:pid,p_client:_afClient,p_template:tid}); if(r&&r.error) throw r.error;
    showToast('Form assigned','success'); clientAssessment(_afClient);
  }catch(e){ showToast('Could not assign','error'); }
}
async function afManageTemplates(){
  var pid=_memProvId();
  openModalShell('lg','Form templates','<div class="psub" style="padding:8px 0;">Loading…</div>','<button class="btn btn-ghost left" onclick="clientAssessment(\''+_afClient+'\')">Back</button><button class="btn btn-pri" onclick="afEditTemplate()"><span class="ms">add</span> New template</button>');
  try{ var r=await window.supabase.rpc('pro_list_form_templates',{p_pro:pid}); _afTpls=(r&&r.data)||[];
    var mb=document.querySelector('#ffp-modal .mc-body'); if(mb) mb.innerHTML=afTemplateListHtml();
  }catch(e){ var mb=document.querySelector('#ffp-modal .mc-body'); if(mb) mb.innerHTML='<div class="psub">Could not load.</div>'; }
}
function afTemplateListHtml(){
  var tpls=_afTpls||[];
  if(!tpls.length) return '<div class="psub" style="padding:6px 0;">No templates yet. Create your first — start from a Waiver or PAR-Q+ and adjust it.</div>';
  return tpls.map(function(t){ return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--ffp-border);"><div style="min-width:0;"><div style="font-weight:800;font-size:13px;color:var(--ffp-text);">'+escHtml(t.title)+'</div><div class="psub" style="margin:0;">'+((t.fields&&t.fields.length)||0)+' field'+(((t.fields&&t.fields.length)===1)?'':'s')+(t.requires_signature?' · signature':'')+'</div></div><div style="display:flex;gap:6px;flex:0 0 auto;"><button class="btn btn-sec btn-sm" onclick="afPreviewTpl(\''+t.id+'\')" title="Preview"><span class="ms">visibility</span></button><button class="btn btn-sec btn-sm" onclick="afEditTemplate(\''+t.id+'\')"><span class="ms">edit</span></button><button class="btn btn-ghost btn-sm" onclick="afDeleteTemplate(\''+t.id+'\')"><span class="ms">delete</span></button></div></div>'; }).join('');
}
function afEditTemplate(tid){
  var tpls=_afTpls||[], t=tid?tpls.filter(function(x){return x.id===tid;})[0]:null;
  _afEditTplId=tid||null; _afFields=t?(t.fields||[]).slice():[];
  var starter=!t?'<div style="margin-bottom:10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;"><span class="psub" style="margin:0;">Start from:</span><button class="btn btn-sec btn-sm" onclick="afStarter(\'waiver\')">Waiver</button><button class="btn btn-sec btn-sm" onclick="afStarter(\'parq\')">PAR-Q+</button></div>':'';
  var body=starter+
    '<div class="field"><div class="label">Title</div><input class="input" id="af-tpl-title" value="'+escHtml(t?t.title:'')+'" placeholder="e.g. Liability Waiver"></div>'+
    '<div class="field" style="margin-top:8px;"><div class="label">Description</div><input class="input" id="af-tpl-desc" value="'+escHtml(t?(t.description||''):'')+'" placeholder="Optional"></div>'+
    '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12.5px;color:var(--ffp-text);"><input type="checkbox" id="af-tpl-sig" '+((!t||t.requires_signature)?'checked':'')+'> Require signature</label>'+
    '<div style="margin-top:13px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--ffp-text-dim);">Fields</div><div id="af-tpl-fields"></div>'+
    '<button class="btn btn-sec btn-sm" style="margin-top:8px;" onclick="afAddField()"><span class="ms">add</span> Add field</button>';
  openModalShell('lg',tid?'Edit template':'New template', body, '<button class="btn btn-ghost left" onclick="afManageTemplates()">Back</button><button class="btn btn-sec" onclick="afPreview()"><span class="ms">visibility</span> Preview</button><button class="btn btn-pri" onclick="afSaveTemplate()"><span class="ms">save</span> Save</button>');
  afRenderFields();
}
function afPreviewTpl(tid){ var t=(_afTpls||[]).filter(function(x){return String(x.id)===String(tid);})[0]; if(t) _ffpFormPreview(t.title||'Untitled form', t.description||'', t.requires_signature!==false, t.fields||[], 'af-preview'); }
function afPreviewForm(fid){ var f=(_afForms||[]).filter(function(x){return String(x.id)===String(fid);})[0]; if(f) _ffpFormPreview(f.title||'Form', '', f.requires_signature!==false, f.fields||[], 'af-preview'); }
function afPreview(){
  var title=((document.getElementById('af-tpl-title')||{}).value||'').trim()||'Untitled form';
  var desc=((document.getElementById('af-tpl-desc')||{}).value||'').trim();
  var sig=!!(document.getElementById('af-tpl-sig')||{}).checked;
  var fields=(_afFields||[]).filter(function(f){return (f.label||'').trim();});
  _ffpFormPreview(title, desc, sig, fields, 'af-preview');
}
// Member-eye preview of a form template — renders exactly what the client sees when completing it.
function _ffpFormPreview(title, desc, sig, fields, ovId){
  var esc=window.escHtml||function(s){return String(s==null?'':s);};
  function fieldHtml(f){
    var req=f.required?' <span style="color:#ef4444;">*</span>':'';
    if(f.type==='statement'||f.type==='info') return '<div style="font-size:13.5px;color:#3a4a4e;line-height:1.65;margin-bottom:16px;white-space:pre-wrap;">'+esc(f.label||'')+'</div>';
    if(f.type==='consent') return '<label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:16px;"><input type="checkbox" disabled style="width:20px;height:20px;margin-top:1px;flex:0 0 auto;"><span style="font-size:13.5px;color:#3a4a4e;line-height:1.5;">'+esc(f.label||f.key)+req+'</span></label>';
    var lbl='<div style="font-weight:600;font-size:14px;color:#0f2531;margin-bottom:7px;line-height:1.45;">'+esc(f.label||f.key)+req+'</div>';
    var ctl;
    if(f.type==='textarea') ctl='<textarea disabled rows="3" placeholder="Their answer…" style="width:100%;border:1px solid #d7dee2;border-radius:10px;padding:10px 12px;font-size:16px;background:#f8fafb;color:#9aa7ad;"></textarea>';
    else if(f.type==='date') ctl='<div style="border:1px solid #d7dee2;border-radius:10px;padding:11px 12px;font-size:16px;background:#f8fafb;color:#9aa7ad;">DD / MM / YYYY</div>';
    else if(f.type==='yesno') ctl='<div style="display:flex;gap:10px;"><div style="flex:1;text-align:center;border:1px solid #d7dee2;border-radius:10px;padding:10px;font-size:15px;font-weight:700;color:#5a6b6e;background:#f8fafb;">Yes</div><div style="flex:1;text-align:center;border:1px solid #d7dee2;border-radius:10px;padding:10px;font-size:15px;font-weight:700;color:#5a6b6e;background:#f8fafb;">No</div></div>';
    else ctl='<div style="border:1px solid #d7dee2;border-radius:10px;padding:11px 12px;font-size:16px;background:#f8fafb;color:#9aa7ad;">Their answer…</div>';
    return '<div style="margin-bottom:16px;">'+lbl+ctl+'</div>';
  }
  var body=fields.map(fieldHtml).join('');
  if(sig) body+='<div style="margin-top:6px;border-top:1px dashed #d7dee2;padding-top:16px;"><div style="font-weight:600;font-size:14px;color:#0f2531;margin-bottom:7px;">Signature <span style="color:#ef4444;">*</span></div><div style="border:1px solid #d7dee2;border-radius:10px;height:70px;background:#f8fafb;display:flex;align-items:center;justify-content:center;color:#b8c2c6;font-size:13px;">Sign here</div><input disabled placeholder="Type full name to confirm" style="width:100%;margin-top:8px;border:1px solid #d7dee2;border-radius:10px;padding:11px 12px;font-size:16px;background:#f8fafb;color:#9aa7ad;"></div>';
  var old=document.getElementById(ovId); if(old) old.remove();
  var ov=document.createElement('div'); ov.id=ovId;
  ov.setAttribute('style','position:fixed;inset:0;z-index:2000000000;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto;');
  ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
  ov.innerHTML='<div style="width:100%;max-width:440px;background:#fff;border-radius:18px;overflow:hidden;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);">'+
    '<div style="background:#0f2531;color:#fff;padding:13px 18px;display:flex;align-items:center;justify-content:space-between;"><div style="font-size:11px;font-weight:800;opacity:.85;letter-spacing:.5px;">PREVIEW · WHAT THE CLIENT SEES</div><button onclick="var e=document.getElementById(\''+ovId+'\');if(e)e.remove();" style="background:rgba(255,255,255,.16);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:15px;">&#10005;</button></div>'+
    '<div style="padding:20px 18px;max-height:calc(100vh - 170px);overflow-y:auto;">'+
      '<div style="font-size:19px;font-weight:800;color:#0f2531;margin-bottom:4px;">'+esc(title)+'</div>'+
      (desc?'<div style="font-size:13px;color:#5a6b6e;line-height:1.5;margin-bottom:18px;">'+esc(desc)+'</div>':'<div style="margin-bottom:14px;"></div>')+
      (body||'<div style="color:#9aa7ad;font-size:13px;">No fields yet — add some to see the preview.</div>')+
      '<button disabled style="width:100%;margin-top:8px;background:#2ba8e0;color:#fff;border:none;border-radius:12px;padding:14px;font-size:16px;font-weight:700;opacity:.85;">Submit &amp; sign</button>'+
    '</div></div>';
  document.body.appendChild(ov);
}
function afStarter(kind){
  var ti=document.getElementById('af-tpl-title'), de=document.getElementById('af-tpl-desc');
  if(kind==='waiver'){
    if(ti)ti.value='Liability Waiver & Assumption of Risk';
    if(de)de.value='Please read carefully and sign before your first session.';
    _afFields=[
      {key:'dob',label:'Date of birth',type:'date',required:true},
      {key:'emergency_name',label:'Emergency contact — full name',type:'text',required:true},
      {key:'emergency_phone',label:'Emergency contact — phone number',type:'text',required:true},
      {key:'conditions',label:'Medical conditions, injuries, allergies or medications we should be aware of',type:'textarea',required:false},
      {key:'ack_risk',label:'I understand that physical exercise and the use of the facilities and equipment carry inherent risks, including the risk of serious injury, and I voluntarily assume all such risks.',type:'consent',required:true},
      {key:'ack_fit',label:'I confirm that I am in good physical condition and know of no medical reason I cannot safely participate, or I have obtained a doctor’s clearance to do so.',type:'consent',required:true},
      {key:'release',label:'I release, waive and discharge the trainer and their agents from any and all liability for injury, loss or damage arising from my participation, to the fullest extent permitted by law.',type:'consent',required:true},
      {key:'rules',label:'I agree to follow my trainer’s instructions and the safe-use guidelines for all equipment.',type:'consent',required:true},
      {key:'media',label:'(Optional) I consent to photos or video taken during sessions being used for promotion.',type:'consent',required:false}
    ];
  } else {
    if(ti)ti.value='Pre-exercise readiness (PAR-Q+)';
    if(de)de.value='A quick health screen before you start. Please answer every question honestly.';
    _afFields=[
      {key:'emergency_name',label:'Emergency contact — full name',type:'text',required:true},
      {key:'emergency_phone',label:'Emergency contact — phone number',type:'text',required:true},
      {key:'q1',label:'Has your doctor ever said that you have a heart condition or high blood pressure?',type:'yesno',required:true},
      {key:'q2',label:'Do you feel pain in your chest at rest, during your daily activities, or when you do physical activity?',type:'yesno',required:true},
      {key:'q3',label:'Do you lose balance because of dizziness, or have you lost consciousness in the last 12 months?',type:'yesno',required:true},
      {key:'q4',label:'Have you ever been diagnosed with another chronic medical condition (other than heart disease or high blood pressure)?',type:'yesno',required:true},
      {key:'q5',label:'Are you currently taking prescribed medication for a chronic medical condition?',type:'yesno',required:true},
      {key:'q6',label:'Do you have a bone, joint or soft-tissue (muscle, ligament or tendon) problem that could be made worse by becoming more physically active?',type:'yesno',required:true},
      {key:'q7',label:'Has your doctor ever said that you should only do medically-supervised physical activity?',type:'yesno',required:true},
      {key:'followup',label:'If you answered YES to any question above, please give brief details (the condition, medication, or what your doctor advised).',type:'textarea',required:false},
      {key:'declare',label:'I declare that I have read, understood and answered every question honestly. If I answered YES to any question, I will seek guidance from my doctor before becoming more active, and I will tell my trainer if my health changes.',type:'consent',required:true}
    ];
  }
  afRenderFields();
}
function afAddField(){ _afFields=_afFields||[]; _afFields.push({key:'f'+(_afFields.length+1)+'_'+Date.now().toString(36).slice(-3),label:'',type:'text',required:false}); afRenderFields(); }
function afRemoveField(i){ (_afFields||[]).splice(i,1); afRenderFields(); }
function afFieldSet(i,k,v){ if(!_afFields||!_afFields[i]) return; _afFields[i][k]=v; }
function afRenderFields(){
  var host=document.getElementById('af-tpl-fields'); if(!host) return; var fs=_afFields||[];
  var types=[['statement','Text / paragraph'],['text','Short text'],['textarea','Long text'],['yesno','Yes / No'],['date','Date'],['consent','Consent checkbox']];
  host.innerHTML=fs.length? fs.map(function(f,i){
    var opts=types.map(function(t){return '<option value="'+t[0]+'"'+(f.type===t[0]?' selected':'')+'>'+t[1]+'</option>';}).join('');
    var big=(f.type==='statement'||f.type==='textarea');
    var ph=(f.type==='statement')?'Written text / paragraph the client reads — e.g. the waiver wording or an instruction':'Question / label';
    var control = big
      ? '<textarea class="textarea" style="width:100%;display:block;min-height:'+(f.type==='statement'?'120':'88')+'px;" placeholder="'+ph+'" oninput="afFieldSet('+i+',\'label\',this.value)">'+escHtml(f.label||'')+'</textarea>'
      : '<input class="input" style="width:100%;display:block;" placeholder="'+ph+'" value="'+escHtml(f.label||'')+'" oninput="afFieldSet('+i+',\'label\',this.value)">';
    var reqLbl=(f.type==='statement')?'':'<label style="font-size:11.5px;color:var(--ffp-text-muted);display:flex;align-items:center;gap:5px;white-space:nowrap;"><input type="checkbox" '+(f.required?'checked':'')+' onchange="afFieldSet('+i+',\'required\',this.checked)">Required</label>';
    return '<div style="border:1px solid var(--ffp-border);border-radius:11px;padding:10px;margin-top:9px;background:var(--ffp-bg-2);">'+control+
      '<div style="display:flex;gap:10px;align-items:center;margin-top:9px;"><select class="select" style="max-width:170px;" onchange="afFieldSet('+i+',\'type\',this.value)">'+opts+'</select>'+reqLbl+'<div style="flex:1;"></div><button onclick="afRemoveField('+i+')" style="background:none;border:none;color:var(--ffp-text-dim);cursor:pointer;display:flex;align-items:center;gap:3px;font-size:11.5px;font-weight:700;"><span class="ms" style="font-size:17px;">delete</span> Remove</button></div></div>';
  }).join('') : '<div class="psub" style="padding:6px 0;">No fields yet — add one, or start from Waiver/PAR-Q+.</div>';
}
async function afSaveTemplate(){
  var pid=_memProvId();
  var title=((document.getElementById('af-tpl-title')||{}).value||'').trim(); if(!title){ showToast('Title required','error'); return; }
  var fields=(_afFields||[]).filter(function(f){return (f.label||'').trim();}).map(function(f,i){ return {key:f.key||('f'+i),label:f.label,type:f.type||'text',required:!!f.required}; });
  var payload={ title:title, description:(document.getElementById('af-tpl-desc')||{}).value||'', requires_signature:!!(document.getElementById('af-tpl-sig')||{}).checked, fields:fields };
  try{ var r=await window.supabase.rpc('pro_save_form_template',{p_pro:pid,p_id:_afEditTplId||null,p:payload}); if(r&&r.error) throw r.error; showToast('Template saved','success'); afManageTemplates(); }
  catch(e){ showToast('Could not save','error'); }
}
async function afDeleteTemplate(tid){
  var pid=_memProvId();
  try{ var r=await window.supabase.rpc('pro_delete_form_template',{p_pro:pid,p_id:tid}); if(r&&r.error) throw r.error; afManageTemplates(); }
  catch(e){ showToast('Could not delete','error'); }
}
function openMemberModal(id){
  var editing=id?_members.find(function(x){return x.id===id;}):null;
  var today=new Date(); var todayStr=today.getFullYear()+'-'+('0'+(today.getMonth()+1)).slice(-2)+'-'+('0'+today.getDate()).slice(-2);
  var m=editing||{full_name:'',given_names:'',surname:'',email:'',phone:'',status:'active',tags:'',join_date:todayStr,notes:''};
  var jd=m.join_date?String(m.join_date).slice(0,10):'';
  var gn=m.given_names||'', sn=m.surname||'';
  if(!gn && !sn && m.full_name){ var _np=String(m.full_name).trim().split(/\s+/); gn=_np.shift()||''; sn=_np.join(' '); }
  window._mmPulled=null;
  openModalShell('lg',(editing?'Edit client':'Add client'),
    '<button type="button" class="btn btn-sec btn-block" onclick="pullClientFromPassport()" style="justify-content:center;gap:8px;margin-bottom:6px;"><span class="ms">cloud_download</span> Pull from FFP Passport</button>'+
    '<div class="psub" id="mm-pull-hint" style="margin:0 0 14px;">Enter their email below, then tap to auto-fill from their Passport.</div>'+
    '<div class="form-section"><div class="form-section-title">Client</div><div class="form-grid">'+
      '<div class="field"><div class="label">Given names <span class="req">*</span></div><input class="input" id="mm-given_names" value="'+escHtml(gn)+'"></div>'+
      '<div class="field"><div class="label">Surname</div><input class="input" id="mm-surname" value="'+escHtml(sn)+'"></div>'+
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
// "Pull from FFP Passport" — look up the email entered in the form; if that person holds an FFP Passport, auto-fill the client.
async function pullClientFromPassport(){
  var pid=_memProvId(); var emEl=document.getElementById('mm-email'); var email=emEl?emEl.value.trim():'';
  var hint=document.getElementById('mm-pull-hint');
  if(!email){ if(hint){ hint.textContent='Enter their email below first, then tap Pull.'; hint.style.color=''; } showToast('Enter their email first','error'); if(emEl)emEl.focus(); return; }
  if(hint){ hint.textContent='Looking up…'; hint.style.color=''; }
  try{
    var r=await window.supabase.rpc('pro_passport_by_email',{p_pro:pid,p_email:email});
    var d=(r&&r.data)||{};
    if(!d.has_account){ window._mmPulled=null; if(hint){ hint.textContent='No FFP Passport found for that email — fill it in manually.'; hint.style.color='var(--ffp-text-dim)'; } showToast('No Passport found for that email','error'); return; }
    var gn=d.given_names||'', sn=d.surname||'';
    if(!gn && !sn && d.full_name){ var p=String(d.full_name).trim().split(/\s+/); gn=p.shift()||''; sn=p.join(' '); }
    var set=function(i,v){ var el=document.getElementById('mm-'+i); if(el)el.value=v||''; };
    set('given_names', gn); set('surname', sn);
    if(window._phoneSet && d.phone) _phoneSet('mm-phone', d.phone);
    window._mmPulled=d;
    if(hint){ hint.innerHTML='<span class="ms" style="font-size:15px;vertical-align:-3px;color:var(--ffp-purple);">verified_user</span> Pulled from '+escHtml(d.full_name||'their')+'’s FFP Passport'+(d.passport_active?'':' (Passport not active)'); hint.style.color='var(--ffp-purple)'; }
    showToast('Pulled from their Passport','success');
  }catch(e){ if(hint){ hint.textContent='Could not pull — try again.'; } showToast('Could not pull','error'); }
}
async function saveMember(id){
  var g=function(i){var el=document.getElementById('mm-'+i);return el?el.value.trim():'';};
  var given=g('given_names'), surname=g('surname'); var name=(given+' '+surname).trim();
  if(!given){ showToast('Given name is required','error'); return; }
  var pid=_memProvId(); if(!pid) return;
  var payload={full_name:name,given_names:given,surname:surname,email:g('email'),phone:(window._phoneGet?_phoneGet('mm-phone'):g('phone')),status:g('status')||'active',tags:g('tags'),join_date:g('join_date'),notes:g('notes')};
  // Persist gender/DOB/nationality pulled from their Passport (only if the email still matches the pulled one).
  var pulled=window._mmPulled||null;
  if(pulled && pulled.email && String(pulled.email).toLowerCase()===String(g('email')).toLowerCase()){
    if(pulled.gender)payload.gender=pulled.gender; if(pulled.date_of_birth)payload.date_of_birth=pulled.date_of_birth; if(pulled.nationality)payload.nationality=pulled.nationality;
  }
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
  var p=editing||{name:'',pkg_type:'sessions',credits:'',price_aed:'',period_days:'',notes:'',service_id:'',pay_requirement:'optional'};
  await _ensureMemSvc();
  if(!editing && (!_memSvc || !_memSvc.length)){
    openModalShell('', 'Create a service first',
      '<div class="psub" style="margin:6px 0;line-height:1.5;">A package is sold to pay for <b>a service</b> (a session, assessment, etc.). Add at least one service first, then build the package that pays for it.</div>',
      '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="closeModal(); if(window.showPanel)showPanel(\'services\')"><span class="ms">add</span> Go to Services</button>');
    return;
  }
  var _sel = (p.service_ids && p.service_ids.length) ? p.service_ids : (p.service_id ? [p.service_id] : []);
  var svcOpts=_memSvc.map(function(v){
    var on = _sel.indexOf(v.id) >= 0;
    return '<label style="display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid var(--ffp-border-mid);border-radius:9px;cursor:pointer;background:'+(on?'rgba(124,58,237,0.07)':'transparent')+';"><input type="checkbox" class="pl-works-cb" value="'+v.id+'"'+(on?' checked':'')+' style="width:17px;height:17px;accent-color:var(--ffp-purple);flex:0 0 auto;cursor:pointer;"><span style="font-size:13px;font-weight:700;color:var(--ffp-text);">'+escHtml(v.name||'Service')+'</span></label>';
  }).join('');
  openModalShell('lg',(editing?'Edit package':'New package'),
    '<div class="form-section"><div class="form-section-title">Package</div><div class="form-grid">'+
      '<div class="field full"><div class="label">Name <span class="req">*</span></div><input class="input" id="pl-name" value="'+escHtml(p.name)+'" placeholder="e.g. 10 PT Sessions"></div>'+
      '<div class="field full"><div class="label">Works for which services? <span class="req">*</span></div><div style="display:flex;flex-direction:column;gap:6px;">'+svcOpts+'</div><div style="font-size:11px;color:var(--ffp-text-dim);font-weight:600;margin-top:5px;">Tick the services these credits can book — tick as many as you like.</div></div>'+
      '<div class="field"><div class="label">Type</div><select class="select" id="pl-pkg_type"><option value="sessions"'+(p.pkg_type==='sessions'?' selected':'')+'>Session pack</option><option value="recurring"'+(p.pkg_type==='recurring'?' selected':'')+'>Recurring</option><option value="term"'+(p.pkg_type==='term'?' selected':'')+'>Term</option></select></div>'+
      '<div class="field"><div class="label">Price ('+_ccy2()+')</div><input class="input" type="number" id="pl-price_aed" value="'+escHtml(String(p.price_aed||''))+'"></div>'+
      '<div class="field"><div class="label">Sessions / credits</div><input class="input" type="number" id="pl-credits" value="'+escHtml(String(p.credits||''))+'" placeholder="e.g. 10"></div>'+
      '<div class="field"><div class="label">Valid days</div><input class="input" type="number" id="pl-period_days" value="'+escHtml(String(p.period_days||''))+'" placeholder="e.g. 60"></div>'+
      '<div class="field full"><div class="label">How is this paid?</div><select class="select" id="pl-pay_requirement">'+
        '<option value="optional"'+((p.pay_requirement==='optional'||!p.pay_requirement)?' selected':'')+'>Pay online if available — otherwise you collect it</option>'+
        '<option value="free"'+(p.pay_requirement==='free'?' selected':'')+'>Free — no payment</option>'+
        '<option value="required"'+(p.pay_requirement==='required'?' selected':'')+'>Online payment required (needs Stripe)</option>'+
      '</select></div>'+
      '<div class="field full"><div class="label">Notes</div><textarea class="textarea" id="pl-notes" rows="2">'+escHtml(p.notes||'')+'</textarea></div>'+
    '</div></div>',
    (editing?'<button class="btn btn-ghost left" onclick="confirmDeletePlan(\''+editing.id+'\')"><span class="ms">delete</span> Delete</button>':'')+
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="savePlan(\''+(editing?editing.id:'')+'\')">'+(editing?'Save':'Create')+'</button>');
}
async function savePlan(id){
  var g=function(i){var el=document.getElementById('pl-'+i);return el?el.value.trim():'';};
  var name=g('name'); if(!name){ showToast('Name is required','error'); return; }
  var svcIds=Array.prototype.slice.call(document.querySelectorAll('.pl-works-cb')).filter(function(c){return c.checked;}).map(function(c){return c.value;});
  if(!svcIds.length){ showToast('Tick at least one service this package works for','error'); return; }
  var pid=_memProvId();
  var payload={name:name,service_ids:svcIds,pkg_type:g('pkg_type')||'sessions',price_aed:g('price_aed'),credits:g('credits'),period_days:g('period_days'),notes:g('notes'),pay_requirement:g('pay_requirement')||'optional'};
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
  var active=a.status==='active'; var stColor=active?'rgba(43,168,224,.16);color:#6fc6ef':'rgba(10,62,68,.08);color:#5a6b6e';
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

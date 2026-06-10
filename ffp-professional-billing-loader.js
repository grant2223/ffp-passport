// ════════════════════════════════════════════════════════════════════════
// FFP Professional Portal — BILLING module (dedicated; on pro_payments)
// Payments / Invoices / Reports. status 'paid' = collected, 'pending' = invoice.
// Reports = pro_business_report (revenue + clients + packages + activity).
// Same panel ids + function names as the dashboard expects. pro id =
// window.FFP_PROVIDER.id. Shell helpers from the dashboard.
// ════════════════════════════════════════════════════════════════════════
var _billPayments = [];
var _billInvoices = [];
var _payClients = [];
var PAY_METHODS = { cash:'Cash', card:'Card', transfer:'Bank transfer', online:'Online', other:'Other' };

function _billProvId(){ return (window.FFP_PROVIDER&&window.FFP_PROVIDER.id)||(typeof providerProfile!=='undefined'&&providerProfile.id)||null; }
function _money(v){ var n=Number(v||0); return 'AED '+(isNaN(n)?0:n).toLocaleString(); }
function _metric(label,val){ return '<div style="flex:1;min-width:140px;background:#0c1d2b;border-radius:10px;padding:11px 13px;"><div class="psub" style="margin:0 0 3px;">'+label+'</div><div style="font-size:18px;font-weight:800;color:var(--ffp-text);">'+val+'</div></div>'; }
async function _ensureBillClients(){ if(_payClients.length) return; var pid=_billProvId(); if(!pid) return; try{ var r=await window.supabase.rpc('pro_list_clients',{p_pro:pid}); _payClients=(r&&r.data)?r.data:[]; }catch(e){ _payClients=[]; } }

async function renderPayments(){
  var host=document.getElementById('pay-list'); if(!host) return;
  var pid=_billProvId(); if(!pid){ host.innerHTML='<div class="empty-sub" style="text-align:left;">Sign in to manage payments.</div>'; return; }
  host.innerHTML='<div class="psub" style="margin:10px 0;">Loading…</div>'; var sum={};
  try{ var r=await window.supabase.rpc('pro_list_payments',{p_pro:pid,p_status:'paid'}); _billPayments=(r&&r.data)?r.data:[]; var rs=await window.supabase.rpc('pro_business_report',{p_pro:pid}); sum=(rs&&rs.data)?rs.data:{}; }catch(e){ _billPayments=[]; }
  var head='<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">'+_metric('Collected (all time)',_money(sum.collected_total))+_metric('This month',_money(sum.collected_month))+'</div>';
  if(!_billPayments.length){ host.innerHTML=head+emptyState('No payments yet','Record your first payment — cash, card or transfer.','Record payment',"openPaymentModal('','payment')"); return; }
  host.innerHTML=head+_billPayments.map(function(p){return payRow(p,'payment');}).join('');
}
async function renderInvoices(){
  var host=document.getElementById('inv-list'); if(!host) return;
  var pid=_billProvId(); if(!pid){ host.innerHTML='<div class="empty-sub" style="text-align:left;">Sign in to manage invoices.</div>'; return; }
  host.innerHTML='<div class="psub" style="margin:10px 0;">Loading…</div>'; var sum={};
  try{ var r=await window.supabase.rpc('pro_list_payments',{p_pro:pid,p_status:'pending'}); _billInvoices=(r&&r.data)?r.data:[]; var rs=await window.supabase.rpc('pro_business_report',{p_pro:pid}); sum=(rs&&rs.data)?rs.data:{}; }catch(e){ _billInvoices=[]; }
  var head='<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">'+_metric('Outstanding',_money(sum.outstanding_total))+'</div>';
  if(!_billInvoices.length){ host.innerHTML=head+emptyState('No invoices','Issue an invoice for money owed — mark it paid when it comes in.','New invoice',"openPaymentModal('','invoice')"); return; }
  host.innerHTML=head+_billInvoices.map(function(p){return payRow(p,'invoice');}).join('');
}
async function renderBillReports(){
  var host=document.getElementById('bill-reports'); if(!host) return;
  var pid=_billProvId(); if(!pid){ host.innerHTML='<div class="empty-sub" style="text-align:left;">Sign in to view reports.</div>'; return; }
  host.innerHTML='<div class="psub" style="margin:10px 0;">Loading…</div>'; var d={};
  try{ var rs=await window.supabase.rpc('pro_business_report',{p_pro:pid}); d=(rs&&rs.data)?rs.data:{}; }catch(e){}
  function sec(t){ return '<div class="psub" style="margin:18px 2px 8px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;font-size:11px;">'+t+'</div>'; }
  function grid(c){ return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">'+c.join('')+'</div>'; }
  function num(v){ return String(v||0); }
  host.innerHTML=
    sec('Revenue')+grid([_metric('Collected (all time)',_money(d.collected_total)),_metric('This month',_money(d.collected_month)),_metric('Outstanding',_money(d.outstanding_total))])+
    sec('Clients')+grid([_metric('Total',num(d.clients_total)),_metric('Active',num(d.clients_active)),_metric('Paused',num(d.clients_paused)),_metric('New this month',num(d.clients_new_month))])+
    sec('Packages & activity')+grid([_metric('Active packages',num(d.packages_active)),_metric('Expiring (30 days)',num(d.packages_expiring_30d)),_metric('Standing slots',num(d.standing_slots))]);
}
function payRow(p,mode){
  var date=mode==='invoice'?(p.due_date?'due '+p.due_date:''):(p.paid_on?p.paid_on:'');
  var sub=[]; if(p.client_name)sub.push(escHtml(p.client_name)); if(mode==='payment'&&p.method)sub.push(PAY_METHODS[p.method]||p.method); if(date)sub.push(date);
  var actions='';
  if(mode==='invoice') actions+='<button class="btn btn-pri btn-sm" onclick="markPaid(\''+p.id+'\')"><span class="ms">check</span> Mark paid</button>';
  actions+='<button class="btn btn-sec btn-sm" onclick="openPaymentModal(\''+p.id+'\',\''+mode+'\')"><span class="ms">edit</span></button><button class="btn btn-ghost btn-sm" onclick="confirmDeletePayment(\''+p.id+'\',\''+mode+'\')"><span class="ms">delete</span></button>';
  return '<div style="background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:12px;padding:11px 13px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'+
    '<div style="min-width:0;"><div style="font-weight:800;color:var(--ffp-text);">'+escHtml(p.description||'Payment')+'</div>'+(sub.length?'<div class="psub" style="margin:2px 0 0;">'+sub.join(' · ')+'</div>':'')+'</div>'+
    '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex-shrink:0;"><div style="font-weight:800;color:var(--ffp-text);">'+_money(p.amount_aed)+'</div><div style="display:flex;gap:6px;">'+actions+'</div></div></div>';
}
async function openPaymentModal(id,mode){
  await _ensureBillClients();
  var editing=id?(mode==='invoice'?_billInvoices:_billPayments).find(function(x){return x.id===id;}):null;
  var today=new Date(); var todayStr=today.getFullYear()+'-'+('0'+(today.getMonth()+1)).slice(-2)+'-'+('0'+today.getDate()).slice(-2);
  var p=editing||{client_id:'',description:'',amount_aed:'',method:'cash',paid_on:todayStr,due_date:''};
  var clientOpts='<option value="">— No client —</option>'+_payClients.map(function(c){return '<option value="'+c.id+'"'+(p.client_id===c.id?' selected':'')+'>'+escHtml(c.full_name||'—')+'</option>';}).join('');
  var when=mode==='invoice'
    ? '<div class="field"><div class="label">Due date</div><input class="input" type="date" id="pm-due_date" value="'+(p.due_date?String(p.due_date).slice(0,10):'')+'"></div>'
    : '<div class="field"><div class="label">Method</div><select class="select" id="pm-method">'+Object.keys(PAY_METHODS).map(function(k){return '<option value="'+k+'"'+(p.method===k?' selected':'')+'>'+PAY_METHODS[k]+'</option>';}).join('')+'</select></div><div class="field"><div class="label">Paid on</div><input class="input" type="date" id="pm-paid_on" value="'+(p.paid_on?String(p.paid_on).slice(0,10):todayStr)+'"></div>';
  openModalShell('lg',(editing?'Edit ':'')+(mode==='invoice'?'Invoice':'Payment'),
    '<div class="form-section"><div class="form-section-title">'+(mode==='invoice'?'Invoice':'Payment')+'</div><div class="form-grid">'+
      '<div class="field full"><div class="label">Description <span class="req">*</span></div><input class="input" id="pm-description" value="'+escHtml(p.description||'')+'" placeholder="'+(mode==='invoice'?'e.g. June block':'e.g. PT session')+'"></div>'+
      '<div class="field"><div class="label">Client</div><select class="select" id="pm-client_id">'+clientOpts+'</select></div>'+
      '<div class="field"><div class="label">Amount (AED) <span class="req">*</span></div><input class="input" type="number" id="pm-amount_aed" value="'+escHtml(String(p.amount_aed||''))+'"></div>'+
      when+
    '</div></div>',
    (editing?'<button class="btn btn-ghost left" onclick="confirmDeletePayment(\''+editing.id+'\',\''+mode+'\')"><span class="ms">delete</span> Delete</button>':'')+
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="savePayment(\''+(editing?editing.id:'')+'\',\''+mode+'\')">'+(editing?'Save':(mode==='invoice'?'Create invoice':'Record payment'))+'</button>');
}
async function savePayment(id,mode){
  var g=function(i){var el=document.getElementById('pm-'+i);return el?el.value.trim():'';};
  var desc=g('description'); var amount=g('amount_aed');
  if(!desc){ showToast('Description is required','error'); return; } if(!amount){ showToast('Amount is required','error'); return; }
  var pid=_billProvId(); if(!pid) return;
  var payload={description:desc,amount_aed:amount,client_id:g('client_id'),status:mode==='invoice'?'pending':'paid'};
  if(mode==='invoice'){ payload.due_date=g('due_date'); } else { payload.method=g('method')||'cash'; payload.paid_on=g('paid_on'); }
  try{ var r=await window.supabase.rpc('pro_save_payment',{p_pro:pid,p_id:id||null,p:payload}); if(r&&r.error)throw r.error; showToast(id?'Saved':(mode==='invoice'?'Invoice created':'Payment recorded'),'success'); closeModal(); if(mode==='invoice')renderInvoices(); else renderPayments(); }catch(e){ showToast('Could not save','error'); }
}
function markPaid(id){ openModalShell('','Mark as paid','<div class="form-section"><div class="form-section-title">Method</div><div class="form-grid"><div class="field full"><select class="select" id="mp-method">'+Object.keys(PAY_METHODS).map(function(k){return '<option value="'+k+'">'+PAY_METHODS[k]+'</option>';}).join('')+'</select></div></div></div>','<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doMarkPaid(\''+id+'\')">Mark paid</button>'); }
async function doMarkPaid(id){ var pid=_billProvId(); var m=document.getElementById('mp-method'); try{ var r=await window.supabase.rpc('pro_mark_paid',{p_pro:pid,p_id:id,p_method:m?m.value:'cash'}); if(r&&r.error)throw r.error; showToast('Marked paid','success'); }catch(e){ showToast('Could not update','error'); } closeModal(); renderInvoices(); renderPayments(); }
function confirmDeletePayment(id,mode){ openModalShell('',(mode==='invoice'?'Delete invoice?':'Delete payment?'),'<div class="psub" style="margin:6px 0;">This removes the record.</div>','<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doDeletePayment(\''+id+'\',\''+mode+'\')">Delete</button>'); }
async function doDeletePayment(id,mode){ var pid=_billProvId(); try{ var r=await window.supabase.rpc('pro_delete_payment',{p_pro:pid,p_id:id}); if(r&&r.error)throw r.error; showToast('Deleted','success'); }catch(e){ showToast('Could not delete','error'); } closeModal(); if(mode==='invoice')renderInvoices(); else renderPayments(); }

// First open
try{ if(document.getElementById('pay-list')) renderPayments(); }catch(e){}

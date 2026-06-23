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
var PAY_METHODS = (window.FFP_TAX && FFP_TAX.payMethods) || { cash:'Cash', card:'Card', transfer:'Bank transfer', online:'Online', other:'Other' };

function _billProvId(){ return (window.FFP_PROVIDER&&window.FFP_PROVIDER.id)||(typeof providerProfile!=='undefined'&&providerProfile.id)||null; }
function _ccy(){ return (window.FFP_PROVIDER&&FFP_PROVIDER.currency)||'AED'; }
function _money(v){ var n=Number(v||0); if(window.FFPCurrency)return FFPCurrency.format(isNaN(n)?0:n,_ccy()); return _ccy()+' '+(isNaN(n)?0:n).toLocaleString(); }
function _metric(label,val){ return '<div style="flex:1;min-width:140px;background:var(--ffp-bg-card);border:1px solid var(--ffp-border);border-radius:10px;padding:11px 13px;"><div class="psub" style="margin:0 0 3px;">'+label+'</div><div style="font-size:18px;font-weight:800;color:var(--ffp-text);">'+val+'</div></div>'; }
async function _ensureBillClients(){ if(_payClients.length) return; var pid=_billProvId(); if(!pid) return; try{ var r=await window.supabase.rpc('pro_list_clients',{p_pro:pid}); _payClients=(r&&r.data)?r.data:[]; }catch(e){ _payClients=[]; } }
var _billPackages = [];
async function _ensureBillPackages(){ if(_billPackages.length) return; var pid=_billProvId(); if(!pid) return; try{ var r=await window.supabase.rpc('pro_list_packages',{p_pro:pid}); _billPackages=(r&&r.data)?r.data:[]; }catch(e){ _billPackages=[]; } }
// A payment records a PACKAGE the client purchased (a package pays for a service). Picking one fills the
// description + auto-fills the price. "Other / one-off" reveals a free-text box for an ad-hoc charge.
function _payPkgPick(){
  var sel=document.getElementById('pm-service'); if(!sel) return;
  var opt=sel.options[sel.selectedIndex];
  var desc=document.getElementById('pm-description'); var amt=document.getElementById('pm-amount_aed');
  if(sel.value==='__custom'){ if(desc){ desc.style.display=''; if(!desc.value) desc.value=''; desc.focus(); } }
  else if(sel.value){ if(desc){ desc.style.display='none'; desc.value=opt.getAttribute('data-name')||opt.textContent; } var pr=opt.getAttribute('data-price'); if(amt && pr && !amt.value) amt.value=pr; }
  else { if(desc){ desc.style.display='none'; desc.value=''; } }
}

// ── Stripe Connect (online card payments) — mirrors the facility portal card ──
var PRO_BACKEND = (typeof PRO_API!=='undefined'&&PRO_API) || 'https://ffp-passport-backend.vercel.app';
function _proRefresh(){ try{ return (window.FFPAuth&&FFPAuth.getRefresh&&FFPAuth.getRefresh()) || localStorage.getItem('ffp_refresh') || sessionStorage.getItem('ffp_refresh'); }catch(e){ return null; } }
async function _proStripeCard(){
  var pid=_billProvId(); if(!pid) return '';
  var connected=false, status='not_connected', payouts=null, reqDue='';
  try{ var r=await window.supabase.from('professionals').select('stripe_account_id, payments_status, payouts_enabled, requirements_due, disabled_reason').eq('id',pid).maybeSingle();
       if(r&&r.data){ connected=!!r.data.stripe_account_id; status=r.data.payments_status||(connected?'connected':'not_connected'); payouts=r.data.payouts_enabled; reqDue=r.data.requirements_due||''; } }catch(e){}
  var reqCount=reqDue?reqDue.split(',').filter(Boolean).length:0;
  var wrap=function(inner){ return '<div style="background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:12px;padding:13px 15px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'+inner+'</div>'; };
  if(status==='connected'){
    var payoutWarn=(payouts===false)
      ? '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.4);border-radius:12px;padding:11px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><span class="ms" style="color:#f59e0b;font-size:20px;">account_balance_wallet</span><div style="flex:1;min-width:180px;"><div style="font-weight:700;font-size:12.5px;color:#f59e0b;">Payouts paused</div><div class="psub" style="margin:1px 0 0;font-size:11.5px;">You can take payments, but Stripe isn\'t paying out to your bank yet — finish your payout details in Stripe.</div></div><button class="btn btn-sec btn-sm" onclick="connectStripePro()">Resolve</button></div>'
      : '';
    return wrap('<span class="ms" style="color:#22c55e;font-size:22px;">verified</span>'+
      '<div style="flex:1;min-width:180px;"><div style="font-weight:700;font-size:13px;color:#22c55e;">Online payments connected</div>'+
      '<div class="psub" style="margin:2px 0 0;font-size:12px;">Clients can pay you by card on findfitpeople — money goes straight to your Stripe account, FFP takes no cut.</div></div>'+
      '<a class="btn btn-ghost btn-sm" href="https://dashboard.stripe.com" target="_blank" rel="noopener"><span class="ms">open_in_new</span> Stripe</a>')+payoutWarn;
  } else if(status==='restricted'){
    return wrap('<span class="ms" style="color:#ef4444;font-size:22px;">error</span>'+
      '<div style="flex:1;min-width:180px;"><div style="font-weight:700;font-size:13px;color:#ef4444;">Action needed — payments paused</div>'+
      '<div class="psub" style="margin:2px 0 0;font-size:12px;">Stripe has paused your account'+(reqCount?' until you provide '+reqCount+' more detail'+(reqCount>1?'s':''):' and needs more information')+'. New charges will fail until it\'s resolved.</div></div>'+
      '<button class="btn btn-pri btn-sm" onclick="connectStripePro()"><span class="ms">arrow_forward</span> Resolve in Stripe</button>');
  } else if(status==='onboarding'){
    return wrap('<span class="ms" style="color:#f59e0b;font-size:22px;">hourglass_top</span>'+
      '<div style="flex:1;min-width:180px;"><div style="font-weight:700;font-size:13px;color:#f59e0b;">Finish your Stripe setup</div>'+
      '<div class="psub" style="margin:2px 0 0;font-size:12px;">Your account was started but isn\'t ready to take payments yet — a few details are still needed.</div></div>'+
      '<button class="btn btn-pri btn-sm" onclick="connectStripePro()"><span class="ms">arrow_forward</span> Finish setup</button>');
  } else if(status==='disconnected'){
    return wrap('<span class="ms" style="color:#ef4444;font-size:22px;">link_off</span>'+
      '<div style="flex:1;min-width:180px;"><div style="font-weight:700;font-size:13px;color:#ef4444;">Stripe disconnected</div>'+
      '<div class="psub" style="margin:2px 0 0;font-size:12px;">Reconnect to keep taking online card payments from clients.</div></div>'+
      '<button class="btn btn-pri btn-sm" onclick="connectStripePro()"><span class="ms">link</span> Reconnect</button>');
  }
  return wrap('<span class="ms" style="color:var(--ffp-purple);font-size:22px;">credit_card</span>'+
    '<div style="flex:1;min-width:180px;"><div style="font-weight:700;font-size:13px;color:var(--ffp-text);">Take card payments online</div>'+
    '<div class="psub" style="margin:2px 0 0;font-size:12px;">Connect Stripe so clients can buy your packages and book sessions by card on findfitpeople. Money goes straight to you — FFP takes no cut. About a minute if you already have Stripe.</div></div>'+
    '<button class="btn btn-pri" onclick="connectStripePro()"><span class="ms">link</span> Connect Stripe</button>');
}
async function connectStripePro(){
  var pid=_billProvId(); var refresh=_proRefresh();
  if(!pid||!refresh){ showToast('Please sign in again to connect payments','error'); return; }
  try{
    var res=await fetch(PRO_BACKEND+'/api/pro/connect/start',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ refresh:refresh, professional_id:pid }) });
    var j=await res.json().catch(function(){return {};});
    if(j.already_connected){ showToast('Payments already connected ✓','success'); renderPayments(); return; }
    if(j.url){ window.location.href=j.url; return; }
    showToast(j.error||'Could not start Stripe connection','error');
  }catch(e){ showToast('Network error — please try again','error'); }
}

async function renderPayments(){
  var host=document.getElementById('pay-list'); if(!host) return;
  var pid=_billProvId(); if(!pid){ host.innerHTML='<div class="empty-sub" style="text-align:left;">Sign in to manage payments.</div>'; return; }
  host.innerHTML='<div class="psub" style="margin:10px 0;">Loading…</div>'; var sum={};
  try{ var r=await window.supabase.rpc('pro_list_payments',{p_pro:pid,p_status:'paid'}); _billPayments=(r&&r.data)?r.data:[]; var rs=await window.supabase.rpc('pro_business_report',{p_pro:pid}); sum=(rs&&rs.data)?rs.data:{}; }catch(e){ _billPayments=[]; }
  var card=await _proStripeCard();
  var head=card+'<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">'+_metric('Collected (all time)',_money(sum.collected_total))+_metric('This month',_money(sum.collected_month))+'</div>';
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
// Stable invoice number derived from the row (no separate sequence column) + tidy date.
function _invNo(p){ var y; try{ y=new Date(p.created_at).getFullYear(); }catch(e){ y=new Date().getFullYear(); } if(!y) y=new Date().getFullYear(); return 'INV-'+y+'-'+String(p.id||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,6).toUpperCase(); }
function _invDate(d){ if(!d) return '—'; try{ var s=String(d); return new Date(s.length<=10?s+'T00:00:00':s).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }catch(e){ return String(d).slice(0,10); } }
function payRow(p,mode){
  var date=mode==='invoice'?(p.due_date?'due '+_invDate(p.due_date):''):(p.paid_on?_invDate(p.paid_on):'');
  var sub=[]; if(p.client_name)sub.push(escHtml(p.client_name)); if(mode==='invoice')sub.push(_invNo(p)); if(mode==='payment'&&p.method)sub.push(PAY_METHODS[p.method]||p.method); if(date)sub.push(date);
  var actions='';
  if(mode==='invoice'){
    actions+='<button class="btn btn-pri btn-sm" onclick="openInvoicePreview(\''+p.id+'\')"><span class="ms">visibility</span> View &amp; send</button>'+
      '<button class="btn btn-sec btn-sm" onclick="markPaid(\''+p.id+'\')" title="Mark paid"><span class="ms">check</span></button>';
  } else {
    actions+='<button class="btn btn-sec btn-sm" onclick="openInvoicePreview(\''+p.id+'\')" title="View receipt"><span class="ms">visibility</span></button>';
  }
  actions+='<button class="btn btn-sec btn-sm" onclick="openPaymentModal(\''+p.id+'\',\''+mode+'\')" title="Edit"><span class="ms">edit</span></button><button class="btn btn-ghost btn-sm" onclick="confirmDeletePayment(\''+p.id+'\',\''+mode+'\')" title="Delete"><span class="ms">delete</span></button>';
  return '<div style="background:var(--ffp-bg-2);border:1px solid var(--ffp-border);border-radius:12px;padding:11px 13px;margin-bottom:9px;">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;"><div style="min-width:0;"><div style="font-weight:800;color:var(--ffp-text);">'+escHtml(p.description||'Payment')+'</div>'+(sub.length?'<div class="psub" style="margin:2px 0 0;">'+sub.join(' · ')+'</div>':'')+'</div>'+
    '<div style="font-weight:800;color:var(--ffp-text);white-space:nowrap;font-size:15px;">'+_money(p.amount_aed)+'</div></div>'+
    '<div style="display:flex;gap:6px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap;">'+actions+'</div></div>';
}
// ── Business info (the invoice FROM block) — fetched once ──
var _billBiz=null;
async function _ensureBillBiz(force){ if(_billBiz && !force) return _billBiz; var pid=_billProvId(); if(!pid) return {}; try{ var r=await window.supabase.from('professionals').select('display_name, work_email, phone, city, country, currency, bank_account_name, bank_name, bank_account_number, bank_iban, bank_swift, bank_notes').eq('id',pid).maybeSingle(); _billBiz=(r&&r.data)||{}; }catch(e){ _billBiz={}; } return _billBiz; }
// ── Bank details tab (shown on invoices) ──
async function renderBankDetails(){
  var host=document.getElementById('bank-details'); if(!host) return;
  var pid=_billProvId(); if(!pid){ host.innerHTML='<div class="empty-sub" style="text-align:left;">Sign in to manage bank details.</div>'; return; }
  host.innerHTML='<div class="psub" style="margin:10px 0;">Loading…</div>';
  var b=await _ensureBillBiz(true);
  var fld=function(id,lbl,val,ph){ return '<div class="field full"><div class="label">'+lbl+'</div><input class="input" id="bk-'+id+'" value="'+escHtml(val||'')+'"'+(ph?' placeholder="'+ph+'"':'')+'></div>'; };
  host.innerHTML='<div class="form-section"><div class="form-section-title">Where clients pay you</div><div class="form-grid">'+
    fld('bank_account_name','Account holder name',b.bank_account_name,'e.g. Forge Fitness FZ')+
    fld('bank_name','Bank name',b.bank_name,'e.g. Emirates NBD')+
    fld('bank_account_number','Account number',b.bank_account_number,'')+
    fld('bank_iban','IBAN',b.bank_iban,'AE…')+
    fld('bank_swift','SWIFT / BIC',b.bank_swift,'')+
    '<div class="field full"><div class="label">Other payment notes</div><textarea class="textarea" id="bk-bank_notes" rows="2" placeholder="e.g. PayPal/Wise, branch, reference to quote">'+escHtml(b.bank_notes||'')+'</textarea></div>'+
    '</div><div style="margin-top:12px;"><button class="btn btn-pri" onclick="saveBankDetails()"><span class="ms">save</span> Save bank details</button></div>'+
    '<div class="psub" style="margin:10px 0 0;font-size:11.5px;">These appear in the "Pay to" section of every invoice you send (unpaid invoices only).</div></div>';
}
async function saveBankDetails(){
  var pid=_billProvId(); if(!pid) return;
  var g=function(id){ var el=document.getElementById('bk-'+id); return el?el.value.trim():''; };
  var payload={ bank_account_name:g('bank_account_name'), bank_name:g('bank_name'), bank_account_number:g('bank_account_number'), bank_iban:g('bank_iban'), bank_swift:g('bank_swift'), bank_notes:g('bank_notes') };
  try{ var r=await window.supabase.rpc('pro_save_bank_details',{p_pro:pid,p:payload}); if(r&&r.error) throw r.error; _billBiz=null; await _ensureBillBiz(true); showToast('Bank details saved','success'); }
  catch(e){ showToast('Could not save','error'); }
}
function _invFind(id){ return (_billInvoices.concat(_billPayments)).find(function(x){return x.id===id;}); }
// ── Full invoice preview (proper invoice with every field a real invoice needs) ──
async function openInvoicePreview(id){
  var p=_invFind(id); if(!p){ showToast('Not found','error'); return; }
  await _ensureBillClients(); var biz=await _ensureBillBiz();
  var cl=_payClients.find(function(c){return c.id===p.client_id;})||{};
  var clName=p.client_name||cl.full_name||'Client', clEmail=cl.email||'', clPhone=cl.phone||'';
  var paid=(p.status==='paid'); var inv=_invNo(p); var amt=_money(p.amount_aed);
  var bizName=biz.display_name||(window.FFP_PROVIDER&&FFP_PROVIDER.name)||'Your business';
  var bizLines=[ (biz.city?[biz.city,biz.country].filter(Boolean).join(', '):''), biz.work_email||'', biz.phone||'' ].filter(Boolean).map(function(l){return '<div style="font-size:11px;color:#5a6b6e;">'+escHtml(l)+'</div>';}).join('');
  var clLines=[ clEmail, clPhone ].filter(Boolean).map(function(l){return '<div style="font-size:11px;color:#5a6b6e;">'+escHtml(l)+'</div>';}).join('');
  var statusPill=paid?'<span style="background:#15833f;color:#fff;font-size:10px;font-weight:800;padding:3px 9px;border-radius:5px;letter-spacing:.5px;">PAID</span>':'<span style="background:#fbe2a8;color:#7a4f00;font-size:10px;font-weight:800;padding:3px 9px;border-radius:5px;letter-spacing:.5px;">DUE</span>';
  var bankItems=[ biz.bank_account_name?'Account name: '+biz.bank_account_name:'', biz.bank_name?'Bank: '+biz.bank_name:'', biz.bank_account_number?'Account no: '+biz.bank_account_number:'', biz.bank_iban?'IBAN: '+biz.bank_iban:'', biz.bank_swift?'SWIFT/BIC: '+biz.bank_swift:'', biz.bank_notes||'' ].filter(Boolean);
  var bankBlock=(!paid && bankItems.length)?'<div style="margin-top:14px;border-top:1px solid #e9edef;padding-top:10px;"><div style="font-size:9px;font-weight:800;color:#9aa7ad;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Pay to</div>'+bankItems.map(function(l){return '<div style="font-size:11.5px;color:#3a4a4e;line-height:1.55;">'+escHtml(l)+'</div>';}).join('')+'</div>':'';
  var html='<div id="inv-doc" style="background:#fff;border:1px solid #e2e8ea;border-radius:12px;padding:20px;color:#1a1a1a;">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px;">'+
      '<div style="min-width:0;"><div style="font-size:17px;font-weight:900;color:#0a3e44;word-break:break-word;">'+escHtml(bizName)+'</div>'+bizLines+'</div>'+
      '<div style="text-align:right;flex:0 0 auto;"><div style="font-size:22px;font-weight:900;letter-spacing:2px;color:#0a3e44;">INVOICE</div><div style="font-size:11px;color:#5a6b6e;font-family:monospace;">'+escHtml(inv)+'</div><div style="margin-top:7px;">'+statusPill+'</div></div>'+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap;">'+
      '<div style="min-width:150px;"><div style="font-size:9px;font-weight:800;color:#9aa7ad;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Bill to</div><div style="font-weight:700;font-size:13px;color:#1a1a1a;">'+escHtml(clName)+'</div>'+clLines+'</div>'+
      '<div style="text-align:right;font-size:11.5px;color:#3a4a4e;"><div><b>Issued:</b> '+_invDate(p.created_at)+'</div>'+(p.due_date?'<div><b>Due:</b> '+_invDate(p.due_date)+'</div>':'')+(paid&&p.paid_on?'<div><b>Paid:</b> '+_invDate(p.paid_on)+(p.method?' ('+escHtml(PAY_METHODS[p.method]||p.method)+')':'')+'</div>':'')+'</div>'+
    '</div>'+
    '<table style="width:100%;border-collapse:collapse;font-size:12.5px;">'+
      '<tr style="border-bottom:2px solid #0a3e44;"><th style="text-align:left;padding:7px 4px;color:#0a3e44;font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;">Description</th><th style="text-align:right;padding:7px 4px;color:#0a3e44;font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;">Amount</th></tr>'+
      '<tr style="border-bottom:1px solid #e9edef;"><td style="padding:10px 4px;color:#1a1a1a;">'+escHtml(p.description||'Professional services')+'</td><td style="text-align:right;padding:10px 4px;font-weight:600;color:#1a1a1a;">'+amt+'</td></tr>'+
    '</table>'+
    '<div style="display:flex;justify-content:flex-end;margin-top:10px;"><div style="min-width:190px;"><div style="display:flex;justify-content:space-between;font-size:12px;padding:4px;color:#3a4a4e;"><span>Subtotal</span><span>'+amt+'</span></div><div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;padding:9px 4px;border-top:2px solid #0a3e44;color:#0a3e44;"><span>Total</span><span>'+amt+'</span></div></div></div>'+
    bankBlock+
    '<div style="margin-top:16px;font-size:10.5px;color:#7a878c;border-top:1px solid #e9edef;padding-top:10px;line-height:1.5;">'+(paid?'Thank you — this invoice has been paid in full.':'Payment due'+(p.due_date?' by '+_invDate(p.due_date):'')+'. Thank you for your business.')+'</div>'+
  '</div>';
  var foot='<button class="btn btn-ghost" onclick="closeModal()">Close</button>'+
    '<button class="btn btn-pri" onclick="shareInvoice(\''+id+'\')"><span class="ms">ios_share</span> Send / Share</button>';
  openModalShell('lg','Invoice · '+escHtml(clName), html, foot);
}
// ── Render the invoice to a JPEG and share it (with the pay-online link when the pro is Stripe-connected) ──
async function shareInvoice(id){
  var node=document.getElementById('inv-doc'); var p=_invFind(id);
  if(!node||!p){ showToast('Open the invoice first','error'); return; }
  showToast('Preparing invoice…','info');
  var biz=await _ensureBillBiz(); var bizName=biz.display_name||(window.FFP_PROVIDER&&FFP_PROVIDER.name)||'Your business';
  var inv=_invNo(p), fileName='Invoice-'+inv+'.jpg';
  // Pay-online link — only if this pro is Stripe-connected (409 otherwise → silently omit).
  var payUrl='';
  try{ var rr=await fetch(PRO_BACKEND+'/api/pay/invoice-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payment_id:id})}); var jj=await rr.json().catch(function(){return {};}); if(jj&&jj.url) payUrl=jj.url; }catch(e){}
  // Render the invoice node to a JPEG.
  var dataUrl='', blob=null;
  try{ if(typeof html2canvas==='function'){ var canvas=await html2canvas(node,{scale:2,backgroundColor:'#ffffff',useCORS:true}); dataUrl=canvas.toDataURL('image/jpeg',0.92); blob=await (await fetch(dataUrl)).blob(); } }catch(e){}
  var shareText='Invoice '+inv+' from '+bizName+' — '+_money(p.amount_aed)+'.'+(payUrl?'\n\nPay online: '+payUrl:'');
  // Native share with the image file (mobile → WhatsApp / email / Messages / etc.).
  try{
    if(blob && navigator.canShare){ var file=new File([blob],fileName,{type:'image/jpeg'}); if(navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:'Invoice '+inv,text:shareText}); return; } }
    if(navigator.share){ await navigator.share({title:'Invoice '+inv,text:shareText}); return; }
  }catch(e){ if(e&&e.name==='AbortError') return; }
  // Desktop fallback: download the JPEG (attach manually) + copy the pay link.
  if(dataUrl){ try{ var a=document.createElement('a'); a.href=dataUrl; a.download=fileName; a.click(); }catch(e){} }
  if(payUrl){ try{ navigator.clipboard && navigator.clipboard.writeText(payUrl); }catch(e){} }
  showToast(dataUrl?('Invoice saved as '+fileName+' — attach it to your email/WhatsApp'+(payUrl?' (pay link copied)':'')):'Could not generate the invoice image','info');
}
async function openPaymentModal(id,mode){
  await _ensureBillClients();
  await _ensureBillPackages();
  var editing=id?(mode==='invoice'?_billInvoices:_billPayments).find(function(x){return x.id===id;}):null;
  var today=new Date(); var todayStr=today.getFullYear()+'-'+('0'+(today.getMonth()+1)).slice(-2)+'-'+('0'+today.getDate()).slice(-2);
  var p=editing||{client_id:'',description:'',amount_aed:'',method:'cash',paid_on:todayStr,due_date:''};
  var clientOpts='<option value="">— No client —</option>'+_payClients.map(function(c){return '<option value="'+c.id+'"'+(p.client_id===c.id?' selected':'')+'>'+escHtml(c.full_name||'—')+'</option>';}).join('');
  // A payment records a PACKAGE purchase — force the catalog to exist first (no free-text fallback).
  if(!editing && !_billPackages.length){
    openModalShell('', '',
      '<div style="min-height:56vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px 22px;">'+
        '<div style="width:84px;height:84px;border-radius:22px;background:rgba(25,128,173,.12);display:flex;align-items:center;justify-content:center;margin-bottom:20px;"><span class="ms" style="font-size:44px;color:var(--ffp-blue,#1980AD);">card_membership</span></div>'+
        '<div style="font-size:24px;font-weight:800;color:var(--ffp-text,#0e2531);margin-bottom:12px;">Create a package first</div>'+
        '<div style="font-size:15px;color:var(--ffp-text-muted,#566069);line-height:1.65;max-width:460px;margin-bottom:26px;">A payment is the sale of a <b>package</b> — and a package pays for a service. Build at least one package, then come back here to record the sale.</div>'+
        '<button class="btn btn-pri" onclick="closeModal(); if(window.showPanel)showPanel(\'packages\')" style="padding:15px 30px;font-size:15px;"><span class="ms">add</span> Create a package</button>'+
      '</div>',
      '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>');
    return;
  }
  // A payment = a PACKAGE the client bought (a package pays for a service). Match an existing record to a package; else "Other".
  var _matchPkg=_billPackages.filter(function(s){return (s.name||'')===(p.description||'');})[0];
  var _isCustom=!!(p.description && !_matchPkg);
  var pkgOpts='<option value="">Choose a package…</option>'+
    _billPackages.map(function(s){ return '<option value="'+s.id+'" data-name="'+escHtml(s.name||'')+'" data-price="'+escHtml(String(s.price_aed==null?'':s.price_aed))+'"'+(_matchPkg&&_matchPkg.id===s.id?' selected':'')+'>'+escHtml(s.name||'Package')+(s.price_aed!=null?' · '+_ccy()+' '+s.price_aed:'')+'</option>'; }).join('')+
    '<option value="__custom"'+(_isCustom?' selected':'')+'>Other / one-off…</option>';
  var svcField = '<div class="field full"><div class="label">Package <span class="req">*</span></div>'+
        '<select class="select" id="pm-service" onchange="_payPkgPick()">'+pkgOpts+'</select>'+
        '<input class="input" id="pm-description" style="margin-top:8px;display:'+(_isCustom?'':'none')+';" value="'+escHtml(p.description||'')+'" placeholder="Describe this one-off charge">'+
      '</div>';
  var when=mode==='invoice'
    ? '<div class="field"><div class="label">Due date</div><input class="input" type="date" id="pm-due_date" value="'+(p.due_date?String(p.due_date).slice(0,10):'')+'"></div>'
    : '<div class="field"><div class="label">Method</div><select class="select" id="pm-method">'+Object.keys(PAY_METHODS).map(function(k){return '<option value="'+k+'"'+(p.method===k?' selected':'')+'>'+PAY_METHODS[k]+'</option>';}).join('')+'</select></div><div class="field"><div class="label">Paid on</div><input class="input" type="date" id="pm-paid_on" value="'+(p.paid_on?String(p.paid_on).slice(0,10):todayStr)+'"></div>';
  openModalShell('lg',(editing?'Edit ':'')+(mode==='invoice'?'Invoice':'Payment'),
    '<div class="form-section"><div class="form-section-title">'+(mode==='invoice'?'Invoice':'Payment')+'</div><div class="form-grid">'+
      svcField+
      '<div class="field"><div class="label">Client</div><select class="select" id="pm-client_id">'+clientOpts+'</select></div>'+
      '<div class="field"><div class="label">Amount ('+_ccy()+') <span class="req">*</span></div><input class="input" type="number" id="pm-amount_aed" value="'+escHtml(String(p.amount_aed||''))+'"></div>'+
      when+
    '</div></div>',
    (editing?'<button class="btn btn-ghost left" onclick="confirmDeletePayment(\''+editing.id+'\',\''+mode+'\')"><span class="ms">delete</span> Delete</button>':'')+
    '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="savePayment(\''+(editing?editing.id:'')+'\',\''+mode+'\')">'+(editing?'Save':(mode==='invoice'?'Create invoice':'Record payment'))+'</button>');
}
async function savePayment(id,mode){
  var g=function(i){var el=document.getElementById('pm-'+i);return el?el.value.trim():'';};
  var _svcSel=document.getElementById('pm-service');
  if(_svcSel && !_svcSel.value){ showToast('Choose a package (or “Other / one-off”)','error'); return; }
  var pkgId=(_svcSel && _svcSel.value && _svcSel.value!=='__custom') ? _svcSel.value : '';
  var desc=g('description'); var amount=g('amount_aed'); var clientId=g('client_id');
  if(!desc){ showToast('Add a description for this charge','error'); return; } if(!amount){ showToast('Amount is required','error'); return; }
  // Recording a real PACKAGE payment also GRANTS the client that package's credits → a client is required.
  var grantPackage = (!id && mode==='payment' && pkgId);
  if(grantPackage && !clientId){ showToast('Choose the client who bought this package — they receive its credits','error'); return; }
  var pid=_billProvId(); if(!pid) return;
  var payload={description:desc,amount_aed:amount,client_id:clientId,status:mode==='invoice'?'pending':'paid'};
  if(mode==='invoice'){ payload.due_date=g('due_date'); } else { payload.method=g('method')||'cash'; payload.paid_on=g('paid_on'); }
  try{
    var r=await window.supabase.rpc('pro_save_payment',{p_pro:pid,p_id:id||null,p:payload}); if(r&&r.error)throw r.error;
    var msg=id?'Saved':(mode==='invoice'?'Invoice created':'Payment recorded'); var ok=true;
    if(grantPackage){
      var gr=await window.supabase.rpc('pro_assign_package',{p_pro:pid,p_client:clientId,p_package:pkgId,p_start:(g('paid_on')||null)});
      if(gr && !gr.error && gr.data){ msg='Payment recorded — credits added to the client'; }
      else { msg='Payment saved, but couldn’t add the package credits — assign it from the Clients tab'; ok=false; }
    }
    showToast(msg, ok?'success':'error'); closeModal(); if(mode==='invoice')renderInvoices(); else renderPayments();
  }catch(e){ showToast('Could not save','error'); }
}
function markPaid(id){ openModalShell('','Mark as paid','<div class="form-section"><div class="form-section-title">Method</div><div class="form-grid"><div class="field full"><select class="select" id="mp-method">'+Object.keys(PAY_METHODS).map(function(k){return '<option value="'+k+'">'+PAY_METHODS[k]+'</option>';}).join('')+'</select></div></div></div>','<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doMarkPaid(\''+id+'\')">Mark paid</button>'); }
async function doMarkPaid(id){ var pid=_billProvId(); var m=document.getElementById('mp-method'); try{ var r=await window.supabase.rpc('pro_mark_paid',{p_pro:pid,p_id:id,p_method:m?m.value:'cash'}); if(r&&r.error)throw r.error; showToast('Marked paid','success'); }catch(e){ showToast('Could not update','error'); } closeModal(); renderInvoices(); renderPayments(); }
function confirmDeletePayment(id,mode){ openModalShell('',(mode==='invoice'?'Delete invoice?':'Delete payment?'),'<div class="psub" style="margin:6px 0;">This removes the record.</div>','<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-pri" onclick="doDeletePayment(\''+id+'\',\''+mode+'\')">Delete</button>'); }
async function doDeletePayment(id,mode){ var pid=_billProvId(); try{ var r=await window.supabase.rpc('pro_delete_payment',{p_pro:pid,p_id:id}); if(r&&r.error)throw r.error; showToast('Deleted','success'); }catch(e){ showToast('Could not delete','error'); } closeModal(); if(mode==='invoice')renderInvoices(); else renderPayments(); }

// First open
try{ if(document.getElementById('pay-list')) renderPayments(); }catch(e){}

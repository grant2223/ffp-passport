/* FFP Admin Content Loader — v1 (2026-05-31)
   Real content_submissions + member names → AdminContent.data + render + realtime.
*/
(function () {
  'use strict';
  function getAC(){ return (typeof AdminContent !== 'undefined') ? AdminContent : null; }
  async function waitFor(c, ms){ var t=0,l=Math.ceil((ms||15000)/100); while(!c()&&t<l){await new Promise(function(r){setTimeout(r,100);});t++;} return c(); }
  function mapForUi(row){
    var m = row.member || {}; var name = m.full_name || m.email || 'Member';
    return {
      id: row.id, initial: (name[0]||'?').toUpperCase(), member: name,
      title: row.title || '(untitled)', type: row.content_type || '', status: row.status || 'pending'
    };
  }
  async function fetchRows(){
    try {
      var res = await window.supabase.from('content_submissions')
        .select('id, content_type, title, status, created_at, member:member_id(full_name,email)')
        .order('created_at', { ascending: false });
      if (res.error) { console.warn('[FFP Admin Content]', res.error.message); return []; }
      return (res.data || []).map(mapForUi);
    } catch (e) { console.warn('[FFP Admin Content] threw', e); return []; }
  }
  async function refresh(){ var ac=getAC(); if(!ac)return; ac.data=await fetchRows(); if(typeof ac.render==='function'){try{ac.render();}catch(e){}} }
  async function init(){
    var ok=await waitFor(function(){return window.supabase && typeof AdminContent!=='undefined';},15000);
    if(!ok){console.error('[FFP Admin Content] deps never loaded');return;}
    await waitFor(function(){return !!window.FFP_ADMIN;},20000);
    var ac=getAC(); ac.init=function(){refresh();}; ac.refresh=refresh;
    try{ console.log('[FFP Admin Content v1] Loaded ✓'); }catch(e){console.error(e);}
    if(window.FFPRealtime) window.FFPRealtime.subscribe('admin-content','content_submissions',null,function(){refresh();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();

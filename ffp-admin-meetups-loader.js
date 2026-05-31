/* FFP Admin Meet & Move Loader — v1 (2026-05-31)
   Real meetups + host names + attendee counts → AdminMeetups.data + render + realtime.
*/
(function () {
  'use strict';
  function getAM(){ return (typeof AdminMeetups !== 'undefined') ? AdminMeetups : null; }
  async function waitFor(c, ms){ var t=0,l=Math.ceil((ms||15000)/100); while(!c()&&t<l){await new Promise(function(r){setTimeout(r,100);});t++;} return c(); }
  function fmtWhen(ts){ if(!ts)return '—'; var d=new Date(ts); if(isNaN(d))return '—';
    return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+' '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); }
  function mapForUi(row, counts){
    var host = (row.host && row.host.full_name) || 'Member';
    var current = counts[row.id] || 0;
    return {
      id: row.id,
      activity: row.title || row.sport || 'Meetup',
      host: host, hInit: (host[0]||'?').toUpperCase(),
      when: fmtWhen(row.meets_at),
      current: current, cap: current + '/' + (row.max_people || 0),
      kind: row.is_professional ? 'pro' : 'social',
      links: []
    };
  }
  async function fetchRows(){
    try {
      var res = await window.supabase.from('meetups')
        .select('id, title, sport, city, venue, meets_at, max_people, status, is_professional, host:host_member_id(full_name)')
        .order('meets_at', { ascending: false });
      if (res.error) { console.warn('[FFP Admin Meetups]', res.error.message); return []; }
      var att = await window.supabase.from('meetup_attendees').select('meetup_id, status');
      var counts = {};
      ((att && att.data) || []).forEach(function(a){ if(a.status!=='cancelled') counts[a.meetup_id]=(counts[a.meetup_id]||0)+1; });
      return (res.data || []).map(function(r){ return mapForUi(r, counts); });
    } catch (e) { console.warn('[FFP Admin Meetups] threw', e); return []; }
  }
  async function refresh(){ var am=getAM(); if(!am)return; am.data=await fetchRows(); if(typeof am.render==='function'){try{am.render();}catch(e){}} }
  async function init(){
    var ok=await waitFor(function(){return window.supabase && typeof AdminMeetups!=='undefined';},15000);
    if(!ok){console.error('[FFP Admin Meetups] deps never loaded');return;}
    await waitFor(function(){return !!window.FFP_ADMIN;},20000);
    var am=getAM(); am.init=function(){refresh();}; am.refresh=refresh;
    try{ console.log('[FFP Admin Meetups v1] Loaded ✓'); }catch(e){console.error(e);}
    if(window.FFPRealtime){
      window.FFPRealtime.subscribe('admin-meetups','meetups',null,function(){refresh();});
      window.FFPRealtime.subscribe('admin-meetup-att','meetup_attendees',null,function(){refresh();});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();

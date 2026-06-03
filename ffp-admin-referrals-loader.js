/* FFP Admin Referrals Loader — v4 (2026-06-03)
   Real referrals + member names (admin RLS) → AdminReferrals.data + render + realtime.
   v4: reward_aed now holds USD (no /3.6725); shown as $ (2-dp). Referrals auto-credit on signup
       (backend v63); panel is a record + 'Invalid' clawback. Leaderboard via admin_referral_leaderboard.
*/
(function () {
  'use strict';
  function getAR() { return (typeof AdminReferrals !== 'undefined') ? AdminReferrals : null; }
  async function waitFor(c, ms){ var t=0,l=Math.ceil((ms||15000)/100); while(!c()&&t<l){await new Promise(function(r){setTimeout(r,100);});t++;} return c(); }
  function days(ts){ return ts ? Math.floor((Date.now()-new Date(ts).getTime())/86400000) : 0; }
  function mapForUi(row){
    var rr = row.referrer || {}; var rd = row.referred || {};
    var referrer = rr.full_name || rr.email || 'Member';
    var referred = rd.full_name || rd.email || row.referred_email || '(pending)';
    return {
      id: row.id,
      referrer: referrer, rInit: (referrer[0]||'?').toUpperCase(), refTier: rr.tier || '',
      referred: referred, bInit: (referred[0]||'?').toUpperCase(),
      reward: (function(){ var n = Math.round((Number(row.reward_aed || 0)) * 100) / 100; return (Math.round(n*100)%100===0) ? String(Math.round(n)) : n.toFixed(2); })(), status: row.status || 'pending', daysAgo: days(row.created_at)
    };
  }
  async function fetchRows(){
    try {
      var res = await window.supabase.from('referrals')
        .select('id, status, reward_aed, created_at, referred_email, referrer:referrer_id(full_name,email,tier), referred:referred_member_id(full_name,email)')
        .order('created_at', { ascending: false });
      if (res.error) { console.warn('[FFP Admin Referrals]', res.error.message); return []; }
      return (res.data || []).map(mapForUi);
    } catch (e) { console.warn('[FFP Admin Referrals] threw', e); return []; }
  }
  async function refresh(){ var ar=getAR(); if(!ar)return; ar.data=await fetchRows(); if(typeof ar.render==='function'){try{ar.render();}catch(e){}} }
  async function init(){
    var ok=await waitFor(function(){return window.supabase && typeof AdminReferrals!=='undefined';},15000);
    if(!ok){console.error('[FFP Admin Referrals] deps never loaded');return;}
    await waitFor(function(){return !!window.FFP_ADMIN;},20000);
    var ar=getAR(); ar.init=function(){refresh();}; ar.refresh=refresh;
    try{ console.log('[FFP Admin Referrals v1] Loaded ✓'); }catch(e){console.error(e);}
    if(window.FFPRealtime) window.FFPRealtime.subscribe('admin-referrals','referrals',null,function(){refresh();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();

/* FFP Member Discovery Loader — v2 (realtime) (2026-05-31)
   PURPOSE — close the core launch loop:
     Members can now SEE and act on real provider listings. Populates the
     member dashboard's Events, Experiences and Challenges panels from Supabase
     (live listings from approved providers, via the *_member_read RLS policies)
     and wires the member actions:
        - Events:      RSVP  → insert into rsvps        (rsvps_self RLS)
        - Experiences: Apply → insert into applications  (applications_self RLS)
        - Challenges:  discovery only (provider challenges = "visit venue to compete";
                       no join table yet, so existing local behaviour is kept)

   ARCHITECTURE: runtime patch loader, same pattern as the provider loaders.
   References the page's top-level consts (Events/Experiences/Challenges/escHtml/
   showToast/FFPAuth) directly — classic scripts share the global lexical scope.
   Add ONE <script> tag to the member dashboard, after ffp-meet-move-loader.

   DEPENDS ON: ffp-api-integration (window.supabase authed via JWT),
   member_read RLS on events/experiences/challenges, providers_public_read,
   rsvps_self / applications_self insert policies.
*/
(function () {
  'use strict';

  // ── helpers ────────────────────────────────────────────────────────────────
  function toast(m, k) {
    if (typeof window.showToast === 'function') { try { window.showToast(m, k); return; } catch (e) {} }
    console.log('[FFP Discovery]', m);
  }
  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  async function waitFor(check, ms) {
    var t = 0, lim = Math.ceil((ms || 20000) / 100);
    while (!check() && t < lim) { await new Promise(function (r) { setTimeout(r, 100); }); t++; }
    return check();
  }
  function memberId() {
    try { if (window.FFPAuth && window.FFPAuth.getMember) { var m = window.FFPAuth.getMember(); if (m && m.id) return m.id; } } catch (e) {}
    try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}')).id || ''; } catch (e) { return ''; }
  }
  async function safeSelect(table, cols, applyFilters) {
    try {
      var q = window.supabase.from(table).select(cols);
      if (applyFilters) q = applyFilters(q);
      var res = await q;
      if (res.error) { console.warn('[FFP Discovery] ' + table + ':', res.error.message); return []; }
      return res.data || [];
    } catch (e) { console.warn('[FFP Discovery] ' + table + ' threw:', e); return []; }
  }

  // ── date formatting ──────────────────────────────────────────────────────────
  function fmtDay(d) { var dt = new Date(d); if (isNaN(dt)) return ''; return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function fmtTime(d) { var dt = new Date(d); if (isNaN(dt)) return ''; return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function daysAway(d) { var dt = new Date(d); if (isNaN(dt)) return 0; return Math.round((dt - new Date()) / 86400000); }
  function mo(dt) { return dt.toLocaleDateString('en-GB', { month: 'short' }); }
  function fmtRange(s, e) {
    var ds = new Date(s), de = new Date(e);
    if (isNaN(ds)) return '';
    if (isNaN(de) || +ds === +de) return ds.getDate() + ' ' + mo(ds);
    if (ds.getMonth() === de.getMonth() && ds.getFullYear() === de.getFullYear()) return ds.getDate() + '–' + de.getDate() + ' ' + mo(de);
    return ds.getDate() + ' ' + mo(ds) + ' – ' + de.getDate() + ' ' + mo(de);
  }
  function letter(provider, title) {
    if (provider && provider.letter_mark) return String(provider.letter_mark).charAt(0).toUpperCase();
    var n = (provider && provider.business_name) || title || 'F';
    return String(n).charAt(0).toUpperCase();
  }

  // ── EVENTS ───────────────────────────────────────────────────────────────────
  function mapEvent(r) {
    var p = r.providers || {};
    var cap = r.capacity || 0;
    return {
      id: r.id,
      title: r.title || 'Untitled event',
      category: r.category || r.activity || 'Fitness',
      city: r.city || '',
      venue: r.venue || (p.business_name || ''),
      date: fmtDay(r.starts_at),
      time: fmtTime(r.starts_at),
      daysAway: daysAway(r.ends_at || r.starts_at),
      img: r.hero_image_url || '',
      spots: cap,
      joined: 0,                     // members can't read others' RSVPs; show capacity + own state
      full: r.status === 'full',
      organizer: p.business_name || 'FFP Provider',
      orgLetter: letter(p, r.title),
      verified: true,
      cost: r.cost || (r.price_aed ? ('AED ' + r.price_aed) : 'See listing'),
      about: r.about || r.description || '',
      bring: r.bring || '',
      who: r.who_for || '',
      setting: r.setting || '',
      intensity: r.fitness_level || '',
      parking: r.parking || '',
      facilities: r.facilities || ''
    };
  }

  async function loadEvents() {
    if (typeof Events === 'undefined') return;
    var rows = await safeSelect('events',
      'id,provider_id,title,description,about,category,activity,hero_image_url,city,venue,area,starts_at,ends_at,capacity,price_aed,cost,status,fitness_level,setting,parking,facilities,bring,who_for,providers(business_name,letter_mark,city)',
      function (q) { return q.order('starts_at', { ascending: true }); });
    Events.data = rows.map(mapEvent);

    // member's own RSVPs → "going" set
    var mid = memberId();
    if (mid) {
      var mine = await safeSelect('rsvps', 'event_id,status', function (q) { return q.eq('member_id', mid); });
      Events.rsvped = new Set(mine.filter(function (x) { return x.status !== 'cancelled'; }).map(function (x) { return x.event_id; }));
    }

    // override RSVP to write to Supabase
    Events.confirmRSVP = async function (id) {
      var e = this.data.find(function (x) { return x.id === id; });
      if (!e) return;
      var m = memberId();
      if (!m) { toast('Please sign in again', 'error'); return; }
      try {
        var res = await window.supabase.from('rsvps').insert({ member_id: m, event_id: id, status: 'going' });
        if (res.error && !/duplicate|unique/i.test(res.error.message || '')) throw res.error;
        this.rsvped.add(id);
        this.render();
        toast('RSVP sent to ' + e.organizer + ' — see you on ' + e.date);
      } catch (err) {
        console.error('[FFP Discovery] rsvp:', err);
        toast(/policy|rls|denied/i.test(err.message || '') ? 'Could not RSVP (permission)' : 'Could not send RSVP', 'error');
      }
    };
    try { Events.render(); } catch (e) {}
  }

  // ── EXPERIENCES ────────────────────────────────────────────────────────────────
  function mapExperience(r) {
    var p = r.providers || {};
    var inc = (r.what_included || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var exc = (r.what_not_included || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    return {
      id: r.id,
      title: r.title || 'Untitled experience',
      category: r.exp_type || r.category || r.activity || 'Experience',
      organizer: p.business_name || 'FFP Provider',
      orgLetter: letter(p, r.title),
      verified: true,
      location: [r.destination, r.country].filter(Boolean).join(', '),
      dates: fmtRange(r.starts_at, r.ends_at),
      from: r.price_aed ? ('AED ' + r.price_aed) : 'On request',
      duration: r.duration_days ? (r.duration_days + ' days') : '',
      fitness: r.fitness_level || '',
      img: r.hero_image_url || '',
      cover: r.hero_image_url || '',
      spots: r.capacity || 0,
      taken: 0,
      full: r.status === 'full' || r.status === 'closed',
      who: r.fitness_reqs || r.travel_reqs || '',
      includes: inc,
      notIncluded: exc,
      deposit: '',
      about: r.overview || r.description || ''
    };
  }

  async function loadExperiences() {
    if (typeof Experiences === 'undefined') return;
    var rows = await safeSelect('experiences',
      'id,provider_id,title,description,overview,exp_type,activity,category,hero_image_url,destination,country,starts_at,ends_at,duration_days,price_aed,what_included,what_not_included,accommodation,flights_info,travel_reqs,fitness_reqs,fitness_level,capacity,status,providers(business_name,letter_mark)',
      function (q) { return q.order('starts_at', { ascending: true }); });
    Experiences.data = rows.map(mapExperience);

    var mid = memberId();
    if (mid) {
      var mine = await safeSelect('applications', 'experience_id,status', function (q) { return q.eq('member_id', mid); });
      Experiences.applied = new Set(mine.filter(function (x) { return x.status !== 'withdrawn'; }).map(function (x) { return x.experience_id; }));
    }

    Experiences.confirmApply = async function (id) {
      var x = this.data.find(function (e) { return e.id === id; });
      if (!x) return;
      var m = memberId();
      if (!m) { toast('Please sign in again', 'error'); return; }
      try {
        var res = await window.supabase.from('applications').insert({ member_id: m, experience_id: id, status: 'applied' });
        if (res.error && !/duplicate|unique/i.test(res.error.message || '')) throw res.error;
        this.applied.add(id);
        this.render();
        toast('Application sent to ' + x.organizer + ' — they review within 48 hours');
      } catch (err) {
        console.error('[FFP Discovery] apply:', err);
        toast(/policy|rls|denied/i.test(err.message || '') ? 'Could not apply (permission)' : 'Could not send application', 'error');
      }
    };
    try { Experiences.render(); } catch (e) {}
  }

  // ── CHALLENGES (discovery only) ──────────────────────────────────────────────
  function mapChallenge(r) {
    var p = r.providers || {};
    var st = (r.status === 'live') ? 'active' : 'past';
    var dleft = daysAway(r.ends_at);
    return {
      id: r.id,
      title: r.title || 'Untitled challenge',
      desc: r.description || '',
      cat: r.category || '',
      sport: r.activity || r.category || '',
      kind: r.challenge_type || 'provider',
      status: st,
      daysLeft: dleft > 0 ? dleft : 0,
      venue: r.venue || (p.business_name || ''),
      city: r.city || '',
      metric: r.metric || '',
      prize: r.prize_description || '',
      rules: r.description || '',
      endDate: fmtDay(r.ends_at),
      dateBadge: fmtRange(r.starts_at, r.ends_at),
      img: r.hero_image_url || '',
      organizer: p.business_name || 'FFP Provider',
      organizerLetter: letter(p, r.title),
      organizerVerified: true,
      participants: 0,
      leaderboard: []
    };
  }

  async function loadChallenges() {
    if (typeof Challenges === 'undefined') return;
    var rows = await safeSelect('challenges',
      'id,provider_id,challenge_type,title,description,category,activity,hero_image_url,metric,venue,city,starts_at,ends_at,prize_description,status,providers(business_name,letter_mark)',
      function (q) { return q.order('ends_at', { ascending: true }); });
    Challenges.data = rows.map(mapChallenge);
    try { Challenges.render(); } catch (e) {}
  }

  // ── init ───────────────────────────────────────────────────────────────────────
  async function init() {
    var ready = await waitFor(function () {
      return window.supabase &&
             typeof Events !== 'undefined' &&
             typeof Experiences !== 'undefined' &&
             typeof Challenges !== 'undefined';
    }, 20000);
    if (!ready) { console.warn('[FFP Discovery] modules/supabase not ready'); return; }

    try { await loadEvents(); }      catch (e) { console.error('[FFP Discovery] events:', e); }
    try { await loadExperiences(); } catch (e) { console.error('[FFP Discovery] experiences:', e); }
    try { await loadChallenges(); }  catch (e) { console.error('[FFP Discovery] challenges:', e); }
    console.log('[FFP Discovery v1] loaded ✓  events=' + (Events.data || []).length +
                ' experiences=' + (Experiences.data || []).length +
                ' challenges=' + (Challenges.data || []).length);

    // expose a manual refresh hook
    window.FFPDiscovery = { reload: async function () { await loadEvents(); await loadExperiences(); await loadChallenges(); } };

    // Real-time: new/edited live listings appear instantly; own RSVP/apply state stays in sync
    if (window.FFPRealtime) {
      var _dT = null;
      var _reload = function () { clearTimeout(_dT); _dT = setTimeout(function () { window.FFPDiscovery.reload(); }, 600); };
      ['events', 'experiences', 'challenges'].forEach(function (t) {
        window.FFPRealtime.subscribe('member-disc-' + t, t, null, _reload);
      });
      var _mid = memberId();
      if (_mid) {
        window.FFPRealtime.subscribe('member-disc-rsvps', 'rsvps', 'member_id=eq.' + _mid, function () { loadEvents(); });
        window.FFPRealtime.subscribe('member-disc-apps', 'applications', 'member_id=eq.' + _mid, function () { loadExperiences(); });
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

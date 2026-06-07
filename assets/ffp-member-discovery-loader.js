/* FFP Member Discovery Loader — v7 (2026-06-07)
   v7: MEMBER-CREATED CHALLENGES. Members can now POST a challenge to the community (not just join).
       - "Create a challenge" button (yellow) in the Challenges panel header → openCreate form
         (title/category/activity/metric/direction/end-date[max 30d]/desc/optional cover) → member_challenge_create.
       - REAL leaderboard: openDetail now fetches member_challenge_leaderboard (podium top-3 + rows to 10);
         was a hardcoded empty demo. Submit/Update score → member_challenge_submit_score (number, or time via
         FFPDurationPicker for "fastest wins"); optional proof photo via FFPUpload (bucket quest-images).
       - HOST verify badge per entry → member_challenge_verify_entry. No prize block for member challenges.
       - loadChallenges now filters status='live' (excludes pending/archived/taken-down); active/past by ends_at.
   v6: (2026-06-04)
   v6: Event RSVP now fires the EMAIL TRAIL — after rsvp_event succeeds, POSTs /api/events/notify
       {kind:'rsvp'} so the member gets a confirmation email and the provider gets an alert email
       (rsvp_event also drops an in-app notification on the provider's bell). RSVP toast updated to
       "You're confirmed — check in with your Passport at the venue on the day". Backend v73 + member
       dashboard v284 (copy fix) go with this.
   v5: Challenge card badge = LAST day of challenge (ends_at), per request (was starts_at).
   v4 (2026-06-01)
   v4: card date badges — Experience = first day of trip (startBadge); Challenge dateBadge is now
       an OBJECT (was a string -> blank badge bug) = last day to enter (starts_at).
   v3 (2026-06-01)
   v3: Events RSVP + Experiences apply now go through SECURITY DEFINER RPCs (rsvp_event /
       apply_experience) — the direct rsvps/applications inserts failed on auth.uid() for
       custom-JWT members (same class of bug as matches/connect). Reads unchanged.
 FFP Member Discovery Loader — v2 (realtime) (2026-05-31)
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
  function fmtDayBadge(d) { var dt = new Date(d); if (isNaN(dt)) return { top: '', mid: '', bot: '' }; var DN = ['SUN','MON','TUE','WED','THU','FRI','SAT'], MN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']; return { top: DN[dt.getDay()], mid: String(dt.getDate()), bot: MN[dt.getMonth()] }; }
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
        var res = await window.supabase.rpc('rsvp_event', { p_me: m, p_event: id });
        if (res.error && !/duplicate|unique/i.test(res.error.message || '')) throw res.error;
        this.rsvped.add(id);
        this.render();
        // v4: email the member a confirmation + the provider an alert (non-blocking). rsvp_event also
        // drops an in-app notification on the provider's bell.
        try { fetch('https://ffp-passport-backend.vercel.app/api/events/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'rsvp', event_id: id, member_id: m }) }); } catch (e) {}
        toast('You’re confirmed — check in with your Passport at the venue on the day');
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
      startBadge: fmtDayBadge(r.starts_at),
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
        var res = await window.supabase.rpc('apply_experience', { p_me: m, p_experience: id, p_notes: null });
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

  // ── CHALLENGES ───────────────────────────────────────────────────────────────
  function mapChallenge(r) {
    var p = r.providers || {};
    var kind = r.challenge_type || 'provider';
    var ended = r.ends_at ? (new Date(r.ends_at) < new Date()) : false;   // active/past by date, not status
    var st = ended ? 'past' : 'active';
    var dleft = daysAway(r.ends_at);
    var mid = memberId();
    return {
      id: r.id,
      title: r.title || 'Untitled challenge',
      desc: r.description || '',
      cat: r.category || '',
      sport: r.activity || r.category || '',
      kind: kind,
      status: st,
      direction: r.score_direction || 'high',
      hostId: r.host_member_id || '',
      isHost: !!(r.host_member_id && mid && r.host_member_id === mid),
      daysLeft: dleft > 0 ? dleft : 0,
      venue: r.venue || (p.business_name || ''),
      city: r.city || '',
      metric: r.metric || '',
      prize: r.prize_description || '',
      rules: r.description || '',
      endDate: fmtDay(r.ends_at),
      dateBadge: fmtDayBadge(r.ends_at),
      img: r.hero_image_url || '',
      organizer: kind === 'member' ? 'Member-hosted' : (p.business_name || 'FFP Provider'),
      organizerLetter: letter(p, r.title),
      organizerVerified: kind !== 'member',
      participants: 0,
      leaderboard: []
    };
  }

  async function loadChallenges() {
    if (typeof Challenges === 'undefined') return;
    // Only LIVE challenges are visible to members (excludes pending / archived / taken-down).
    var rows = await safeSelect('challenges',
      'id,provider_id,host_member_id,challenge_type,title,description,category,activity,hero_image_url,metric,score_direction,venue,city,starts_at,ends_at,prize_description,status,providers(business_name,letter_mark)',
      function (q) { return q.eq('status', 'live').order('ends_at', { ascending: true }); });
    Challenges.data = rows.map(mapChallenge);
    // own hosted challenges show under "My Challenges"
    try { Challenges.data.forEach(function (c) { if (c.isHost) Challenges.joined.add(c.id); }); } catch (e) {}
    try { Challenges.render(); } catch (e) {}
  }

  // ── MEMBER-CREATED CHALLENGES (real create / submit / leaderboard / verify) ──────
  var CH_CATS = ['Sports', 'Fitness', 'Wellness', 'Adventure', 'Community'];
  function chRpc(name, args) { return window.supabase.rpc(name, args); }
  function fmtSecs(s) { s = Math.max(0, Math.round(+s || 0)); var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; var pad = function (n) { return (n < 10 ? '0' : '') + n; }; return h > 0 ? (h + ':' + pad(m) + ':' + pad(ss)) : (m + ':' + pad(ss)); }
  function maxEndDate() { var d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); }
  async function chLeaderboard(cid) {
    try { var r = await chRpc('member_challenge_leaderboard', { p_challenge: cid, p_me: memberId() }); if (r.error) { console.warn('[FFP Challenges] lb:', r.error.message); return null; } return r.data || null; }
    catch (e) { console.warn('[FFP Challenges] lb threw:', e); return null; }
  }
  function lbRowHtml(e, isHost, cid) {
    var rankCls = e.rank === 1 ? 'gold' : e.rank === 2 ? 'silver' : e.rank === 3 ? 'bronze' : '';
    var av = e.photo_url ? '<span class="lb-avatar" style="background-image:url(\'' + esc(e.photo_url) + '\');background-size:cover;"></span>'
                         : '<div class="lb-avatar">' + esc(String(e.name || '?').charAt(0).toUpperCase()) + '</div>';
    var proof = e.proof_url ? ' <a href="' + esc(e.proof_url) + '" target="_blank" rel="noopener" class="lb-proof" onclick="event.stopPropagation();">proof</a>' : '';
    var verHtml = e.verified ? '<div class="lb-verified yes"><span class="material-icons">check</span>Verified</div>' : '<div class="lb-verified no">Unverified</div>';
    var hostBtn = isHost ? '<button class="lb-vbtn ' + (e.verified ? 'on' : '') + '" onclick="event.stopPropagation();Challenges.verifyEntry(\'' + e.entry_id + '\',' + (e.verified ? 'false' : 'true') + ',\'' + cid + '\')">' + (e.verified ? 'Unverify' : 'Verify') + '</button>' : '';
    return '<div class="lb-row ' + (e.is_me ? 'is-me' : '') + '">' +
      '<div class="lb-rank ' + rankCls + '">' + e.rank + '</div>' +
      '<div class="lb-name-row">' + av + '<div><div class="lb-name">' + esc(e.name) + (e.is_me ? '<span class="me-tag">You</span>' : '') + '</div></div></div>' +
      '<div class="lb-right"><div class="lb-score">' + esc(e.score_text || String(e.score)) + '</div>' + verHtml + proof + hostBtn + '</div>' +
    '</div>';
  }

  function wireMemberChallenges() {
    if (typeof Challenges === 'undefined') return;

    // Inject a one-time stylesheet (yellow create button, no boxes)
    if (!document.getElementById('ffp-chal-css')) {
      var st = document.createElement('style'); st.id = 'ffp-chal-css';
      st.textContent =
        '.chal-create-btn{display:inline-flex;align-items:center;gap:6px;margin-top:12px;background:#FFCC00;color:#081420;font-weight:800;border:none;border-radius:12px;padding:11px 16px;font-size:14px;cursor:pointer;}' +
        '.chal-create-btn .material-icons{font-size:19px;}' +
        '.lb-vbtn{margin-left:8px;background:transparent;border:1px solid #2a3f57;color:#9fb2c6;border-radius:8px;padding:4px 9px;font-size:11px;font-weight:700;cursor:pointer;}' +
        '.lb-vbtn.on{background:#123a25;border-color:#1f6b3f;color:#5fd08a;}' +
        '.lb-proof{margin-left:8px;font-size:11px;color:#7fb4ff;text-decoration:underline;}' +
        '.ch-dir-help{font-size:12px;color:var(--muted);margin-top:4px;}';
      document.head.appendChild(st);
    }
    // Inject "Create a challenge" button into the panel header
    try {
      var head = document.querySelector('#panel-challenges .user-panel-head');
      if (head && !document.getElementById('chal-create-btn')) {
        var b = document.createElement('button');
        b.id = 'chal-create-btn'; b.className = 'chal-create-btn';
        b.innerHTML = '<span class="material-icons">add</span>Create a challenge';
        b.onclick = function () { Challenges.openCreate(); };
        head.appendChild(b);
      }
    } catch (e) {}

    // ---- DETAIL with a REAL leaderboard (podium top 3 + rows to 10) ----
    Challenges.openDetail = async function (id) {
      var c = (this.data || []).find(function (x) { return x.id === id; });
      if (!c) return;
      var isMember = c.kind === 'member';
      var isPast = c.status === 'past';
      var lb = isMember ? await chLeaderboard(id) : null;
      var rows = (lb && lb.rows) || [];
      var isHost = !!(lb && lb.is_host);
      var count = (lb && lb.count) || 0;
      var myEntry = rows.filter(function (r) { return r.is_me; })[0];

      var lbHtml = rows.length
        ? rows.slice(0, 10).map(function (e) { return lbRowHtml(e, isHost, id); }).join('')
        : '<div class="lb-empty">No scores yet. ' + (isMember ? 'Be the first on the podium!' : 'Visit ' + esc(c.venue) + ' to compete.') + '</div>';

      var ctaButton = isPast
        ? '<button class="btn-primary-yellow past" disabled>Challenge Ended</button>'
        : isMember
          ? '<button class="btn-primary-yellow" onclick="Challenges.openSubmitScore(\'' + c.id + '\')">' + (myEntry ? 'Update my score' : 'Submit your score') + '</button>'
          : '<button class="btn-primary-blue" onclick="Challenges.joinProviderChallenge(\'' + c.id + '\')">' + (this.joined.has(c.id) ? "You're In — Visit Venue To Compete" : 'Join Challenge') + '</button>';

      var typeLabel = isMember ? 'Member Challenge' : 'Provider Challenge';
      var timeText = isPast ? 'Ended ' + esc(c.endDate) : esc(c.daysLeft + ' days left · Ends ' + c.endDate);
      var dirText = c.direction === 'low' ? 'Best score = fastest / lowest' : 'Best score = highest';

      var body =
        '<div class="chal-hero ' + (isMember ? 'member' : 'provider') + '">' +
          '<div class="chal-hero-eyebrow">' + typeLabel + ' &middot; ' + esc(c.sport) + '</div>' +
          '<div class="chal-hero-title">' + esc(c.title) + '</div>' +
          '<div class="chal-hero-time"><span class="material-icons">schedule</span>' + timeText + '</div>' +
        '</div>' +
        '<div class="dm-body" style="padding-top:18px;padding-bottom:8px;"><p style="font-size:13px;color:var(--text);line-height:1.5;">' + esc(c.desc) + '</p></div>' +
        '<div class="chal-info-bar">' +
          '<span class="item"><span class="avatar-sm">' + esc(c.organizerLetter) + '</span>' + esc(c.organizer) + (c.organizerVerified ? '<span class="material-icons verified-tick">verified</span>' : '') + '</span>' +
          '<span class="sep">&middot;</span>' +
          '<span class="item"><span class="material-icons">speed</span>' + esc(c.metric || 'Your score') + '</span>' +
          (c.city ? '<span class="sep">&middot;</span><span class="item"><span class="material-icons">location_on</span>' + esc(c.city) + '</span>' : '') +
        '</div>' +
        '<div class="dm-section"><div class="dm-section-label">How it works</div><p>' + esc(c.rules || ('Post your result for "' + (c.metric || 'this challenge') + '". ' + dirText + '. The host can mark entries verified.')) + '</p></div>' +
        (isMember ? '' :
          '<div class="prize-block"><div class="prize-block-icon"><span class="material-icons">card_giftcard</span></div><div class="prize-block-text"><div class="prize-block-label">Prize</div><div class="prize-block-desc">' + esc(c.prize || 'See listing') + '</div></div></div>') +
        '<div class="lb-section"><div class="lb-header"><div class="lb-header-title"><span class="material-icons">leaderboard</span>Leaderboard</div>' +
          '<div class="lb-header-count">' + count + ' ' + (count === 1 ? 'entry' : 'entries') + '</div></div>' + lbHtml + '</div>' +
        '<div class="dm-footer">' + ctaButton + '</div>';
      openDetailModal(body);
    };

    // ---- SUBMIT / UPDATE score (honor system) ----
    Challenges.openSubmitScore = function (id) {
      var c = (this.data || []).find(function (x) { return x.id === id; });
      if (!c) return;
      this._submittingId = id; this._proofUrl = ''; this._timeSecs = 0;
      var scoreField = (c.direction === 'low')
        ? '<button type="button" class="submit-score-input" id="ss-timebtn" onclick="Challenges.pickTime()" style="text-align:left;cursor:pointer;">Tap to set your time</button>'
        : '<input type="number" inputmode="decimal" step="any" id="ss-score" class="submit-score-input" placeholder="e.g. 80">';
      var body =
        '<div class="dm-body"><div class="dm-title">' + (c.direction === 'low' ? 'Submit your time' : 'Submit your score') + '</div>' +
          '<p style="font-size:13px;color:var(--muted);">For: <strong style="color:var(--text);">' + esc(c.title) + '</strong></p></div>' +
        '<div class="submit-score-form">' +
          '<div class="submit-score-row"><label class="submit-score-label">Your ' + (c.direction === 'low' ? 'time' : 'result') + (c.metric ? ' (' + esc(c.metric) + ')' : '') + '</label>' + scoreField + '</div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Proof photo (optional)</label>' +
            '<button type="button" class="submit-score-input" id="ss-proofbtn" onclick="Challenges.pickProof()" style="text-align:left;cursor:pointer;">Add a photo</button>' +
            '<div class="submit-score-hint">Share a photo so the host can verify it. The host marks verified entries with a green badge.</div></div>' +
        '</div>' +
        '<div class="dm-footer"><button class="btn-primary-yellow" onclick="Challenges.confirmSubmitScore()">Submit to leaderboard</button></div>';
      openDetailModal(body);
    };
    Challenges.pickTime = function () {
      var self = this;
      if (!window.FFPDurationPicker) { toast('Time picker unavailable'); return; }
      window.FFPDurationPicker.open(self._timeSecs || 0, function (r) {
        self._timeSecs = (r && r.total) || 0;
        var el = document.getElementById('ss-timebtn'); if (el) el.textContent = self._timeSecs > 0 ? fmtSecs(self._timeSecs) : 'Tap to set your time';
      });
    };
    Challenges.pickProof = function () {
      var self = this;
      if (!window.FFPUpload || !window.FFPUpload.pick) { toast('Photo upload unavailable'); return; }
      window.FFPUpload.pick({
        bucket: 'quest-images', key: 'challenge-proof/' + self._submittingId + '/' + memberId() + '-' + Date.now() + '.jpg',
        aspect: 4 / 3, outW: 1000, outH: 750, title: 'Add proof photo',
        onDone: function (url) { self._proofUrl = url || ''; var el = document.getElementById('ss-proofbtn'); if (el) el.textContent = url ? 'Photo added ✓ (tap to change)' : 'Add a photo'; },
        onError: function (e) { toast('Upload failed'); console.warn(e); }
      });
    };
    Challenges.confirmSubmitScore = async function () {
      var c = (this.data || []).find(function (x) { return x.id === this._submittingId; }, this);
      if (!c) return;
      var score, scoreText;
      if (c.direction === 'low') {
        score = this._timeSecs || 0;
        if (score <= 0) { toast('Set your time first'); return; }
        scoreText = fmtSecs(score);
      } else {
        var v = parseFloat((document.getElementById('ss-score') || {}).value);
        if (!isFinite(v)) { toast('Enter your result first'); return; }
        score = v; scoreText = String(v) + (c.metric ? ' ' + c.metric : '');
      }
      var me = memberId(); if (!me) { toast('Please sign in again'); return; }
      try {
        var r = await chRpc('member_challenge_submit_score', { p_me: me, p_challenge: c.id, p_score: score, p_score_text: scoreText, p_proof_url: this._proofUrl || null });
        if (r.error) throw r.error;
        if (!r.data) { toast('Could not submit — challenge may have ended'); return; }
        this.joined.add(c.id);
        if (typeof closeDetailModal === 'function') closeDetailModal();
        toast('Score submitted to the leaderboard');
        await loadChallenges();
        this.openDetail(c.id);
      } catch (e) { console.error(e); toast(e.message || 'Submit failed'); }
    };

    // ---- HOST verifies an entry ----
    Challenges.verifyEntry = async function (entryId, val, cid) {
      var me = memberId(); if (!me) return;
      try {
        var r = await chRpc('member_challenge_verify_entry', { p_me: me, p_entry: entryId, p_verified: !!val });
        if (r.error) throw r.error;
        if (r.data !== true) { toast('Only the host can verify'); return; }
        this.openDetail(cid);
      } catch (e) { console.error(e); toast(e.message || 'Verify failed'); }
    };

    // ---- CREATE a challenge ----
    Challenges.openCreate = function () {
      this._createHero = '';
      var cats = CH_CATS.map(function (x) { return '<option value="' + x + '">' + x + '</option>'; }).join('');
      var body =
        '<div class="dm-body"><div class="dm-title">Create a challenge</div>' +
          '<p style="font-size:13px;color:var(--muted);">Set a challenge for the community. Goes live straight away · max 30 days · leaderboard only.</p></div>' +
        '<div class="submit-score-form">' +
          '<div class="submit-score-row"><label class="submit-score-label">Title</label><input type="text" id="cc-title" class="submit-score-input" placeholder="e.g. June Push-up Challenge"></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Category</label><select id="cc-cat" class="ffp-select">' + cats + '</select></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Sport / activity</label><input type="text" id="cc-activity" class="submit-score-input" placeholder="e.g. Running, Push-ups, Padel"></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">What\'s measured</label><input type="text" id="cc-metric" class="submit-score-input" placeholder="e.g. reps, km, fastest 5K"></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Winner is…</label><select id="cc-dir" class="ffp-select"><option value="high">Most wins (reps, distance, count)</option><option value="low">Fastest wins (a time)</option></select><div class="ch-dir-help">How the leaderboard ranks entries.</div></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Ends on (max 30 days)</label><input type="date" id="cc-ends" class="submit-score-input" max="' + maxEndDate() + '"></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Description</label><textarea id="cc-desc" class="submit-score-input" rows="3" placeholder="The rules — how people log a fair result."></textarea></div>' +
          '<div class="submit-score-row"><label class="submit-score-label">Cover photo (optional)</label><button type="button" class="submit-score-input" id="cc-herobtn" onclick="Challenges.pickHero()" style="text-align:left;cursor:pointer;">Add a photo</button></div>' +
        '</div>' +
        '<div class="dm-footer"><button class="btn-primary-yellow" onclick="Challenges.saveCreate()">Publish challenge</button></div>';
      openDetailModal(body);
    };
    Challenges.pickHero = function () {
      var self = this;
      if (!window.FFPUpload || !window.FFPUpload.pick) { toast('Photo upload unavailable'); return; }
      window.FFPUpload.pick({
        bucket: 'quest-images', key: 'challenge-hero/' + memberId() + '-' + Date.now() + '.jpg',
        aspect: 16 / 9, outW: 1280, outH: 720, title: 'Cover photo',
        onDone: function (url) { self._createHero = url || ''; var el = document.getElementById('cc-herobtn'); if (el) el.textContent = url ? 'Photo added ✓ (tap to change)' : 'Add a photo'; },
        onError: function (e) { toast('Upload failed'); console.warn(e); }
      });
    };
    Challenges.saveCreate = async function () {
      var val = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
      var title = val('cc-title'); if (!title) { toast('Give your challenge a title'); return; }
      var metric = val('cc-metric'); if (!metric) { toast('Say what\'s measured (e.g. reps)'); return; }
      var ends = val('cc-ends'); if (!ends) { toast('Pick an end date'); return; }
      var endsIso = new Date(ends + 'T23:59:59').toISOString();
      var me = memberId(); if (!me) { toast('Please sign in again'); return; }
      var payload = {
        title: title, description: val('cc-desc'), activity: val('cc-activity'),
        category: (val('cc-cat') || 'Fitness').toLowerCase(), metric: metric,
        score_direction: val('cc-dir') || 'high', ends_at: endsIso, hero_image_url: this._createHero || ''
      };
      try {
        var r = await chRpc('member_challenge_create', { p_me: me, p_id: null, p: payload });
        if (r.error) throw r.error;
        if (!r.data) { toast('Could not create challenge'); return; }
        if (typeof closeDetailModal === 'function') closeDetailModal();
        toast('Challenge published — it\'s live!');
        await loadChallenges();
        Challenges.tab = 'active'; Challenges.render();
        this.openDetail(r.data);
      } catch (e) { console.error(e); toast(e.message || 'Create failed'); }
    };
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

    try { wireMemberChallenges(); } catch (e) { console.error('[FFP Discovery] wire challenges:', e); }
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

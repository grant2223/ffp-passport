/* FFP Connections Core - v1 (2026-06-07)
   Extracted verbatim from ffp-member-dashboard.html to de-bloat the dashboard and isolate the
   Connections panel (stabilization). Defines window.MeetMove (matches / discover / meetups) and
   window.CollectionView (your passport collection). Loaded as a CLASSIC (non-defer) script BEFORE the
   Matches-deck IIFE, which does Object.assign(MeetMove,...) at PARSE time - defer would run too late.
   The existing ffp-meet-move-loader.js still does the Supabase wiring at call-time. No logic changed. */
const MeetMove = {
  tab: 'discover',
  search: '',
  cat: 'all',
  when: 'all',
  gender: 'all',
  level: 'all',
  country: 'all',
  city: 'all',
  proOnly: false,
  
  // Matched members (sample) — production: GET /api/meet/matches?member_id=me
  matches: [],
  
  data: [],
  hostingIds: new Set(),
  
  init() {
    document.querySelectorAll('#meet-tabs .tabs-underline-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#meet-tabs .tabs-underline-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.tab = b.dataset.meetTab;
        this.render();
      });
    });
    document.getElementById('meet-search').addEventListener('input', e => { this.search = e.target.value.toLowerCase(); this.render(); });
    document.getElementById('meet-filter-cat').addEventListener('change', e => { this.cat = e.target.value; this.render(); });
    document.getElementById('meet-filter-when').addEventListener('change', e => { this.when = e.target.value; this.render(); });
    document.getElementById('meet-filter-gender').addEventListener('change', e => { this.gender = e.target.value; this.render(); });
    document.getElementById('meet-filter-level').addEventListener('change', e => { this.level = e.target.value; this.render(); });
    this.initLocationFilter();
    this.renderMatchStrip();
    this.render();
    this.loadMatches();
  },

  // v185: Country -> City cascade for the meet-up filters (shared FFP_TAX.cities). Default UAE.
  initLocationFilter() {
    var cs = document.getElementById('meet-filter-country');
    var ct = document.getElementById('meet-filter-city');
    if (!cs || !ct || !(window.FFP_TAX && FFP_TAX.cities)) return;
    var self = this;
    var countries = Object.keys(FFP_TAX.cities);
    cs.innerHTML = '<option value="all">All countries</option>' + countries.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
    function fillCities(country) {
      var list = (country !== 'all' && FFP_TAX.cities[country]) ? FFP_TAX.cities[country] : [];
      ct.innerHTML = '<option value="all">All cities</option>' + list.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
    }
    if (FFP_TAX.cities['United Arab Emirates']) { cs.value = 'United Arab Emirates'; self.country = 'United Arab Emirates'; fillCities('United Arab Emirates'); }
    else { fillCities('all'); }
    cs.addEventListener('change', function () { self.country = this.value; self.city = 'all'; fillCities(this.value); self.render(); });
    ct.addEventListener('change', function () { self.city = this.value; self.render(); });
  },
  
  renderMatchStrip() {
    // v183: the strip was replaced by a button + count pill.
    var pill = document.getElementById('meet-match-count');
    if (pill) {
      var n = (this.matches || []).filter(function (m) { return m.connection !== 'connected'; }).length;
      if (n > 0) { pill.textContent = n; pill.style.display = ''; } else { pill.style.display = 'none'; }
    }
    var scroll = document.getElementById('meet-match-scroll');
    if (!scroll) return;
    scroll.innerHTML = this.matches.slice(0, 8).map(m => {
      // Top 3 sports for display
      const sportsText = m.sports.slice(0, 3).map(s => escHtml(s.name)).join(' &middot; ');
      return `
        <div class="match-card-v2" onclick="MeetMove.openMemberDetail('${m.id}')">
          <div class="match-card-v2-pct">${m.match}%</div>
          <div class="match-card-v2-avatar"${m.photo ? ` style="background:#0a1825 url('${m.photo}') center/cover;"` : ''}>${m.photo ? '' : m.letter}</div>
          <div class="match-card-v2-name">${escHtml(m.name)}</div>
          <div class="match-card-v2-meta">${escHtml(m.age)} &middot; ${escHtml(m.city)}</div>
          <div class="match-card-v2-sports">${sportsText}</div>
          <div class="match-card-v2-rel">
            <span class="dot"></span>
            <span class="num">${m.trust.toFixed(1)}</span> reliability
          </div>
        </div>
      `;
    }).join('');
  },

  toggleFilters() {
    var w = document.getElementById('meet-filters-wrap');
    if (w) w.style.display = (w.style.display === 'none' || !w.style.display) ? 'flex' : 'none';
  },

  // v182: weighted matching from get_match_pool() RPC. Factors: shared activities + skill-level
  // closeness, location (city>country), gender, age closeness, recent activity.
  async loadMatches() {
    if (!window.supabase || typeof MemberProfile === 'undefined') return;
    // v189: pass member id explicitly — custom-JWT members don't resolve auth.uid()
    // reliably client-side (same reason getUser() fails), so get_match_pool(p_me) takes
    // the id directly. Resolve from FFPAuth/localStorage; retry briefly if not ready yet.
    var meId = null;
    try { meId = (window.FFPAuth && window.FFPAuth.getMember && (window.FFPAuth.getMember() || {}).id) || null; } catch (e) {}
    if (!meId) { try { meId = (JSON.parse(localStorage.getItem('ffp_member') || '{}') || {}).id || null; } catch (e) {} }
    if (!meId) {
      this._matchRetries = (this._matchRetries || 0) + 1;
      if (this._matchRetries <= 20) { var self = this; setTimeout(function () { self.loadMatches(); }, 250); }
      return;
    }
    try {
      var res = await window.supabase.rpc('get_match_pool', { p_me: meId });
      if (res.error) { console.warn('[FFP Matches]', res.error.message); return; }
      if (!res.data) return;
      var md = MemberProfile.data || {};
      var LV = { 'not tried': 0, social: 1, competitive: 2, representative: 3, professional: 4 };
      var myCity = String(md.city || '').toLowerCase();
      var myCountry = String(md.country || '').toLowerCase();
      var myGender = String(md.gender || '').toLowerCase();
      var myAge = md.dobYear ? (new Date().getFullYear() - parseInt(md.dobYear, 10)) : null;
      var mySkills = {};
      ((md.sports) || []).forEach(function (sp) { if (sp.name) mySkills[String(sp.name).toLowerCase()] = LV[String(sp.level || '').toLowerCase()]; });
      var now = Date.now();
      this.matches = (res.data || []).map(function (r) {
        if (window.FFPCard) window.FFPCard.register(r); // feed the one canonical card cache (keyed by id)
        var skills = Array.isArray(r.skills) ? r.skills : [];
        var sports = skills.map(function (sk) {
          var nm = sk.name || sk.skill || sk.sport || '';
          return { name: nm, level: sk.level || 'All levels', shared: mySkills.hasOwnProperty(String(nm).toLowerCase()) };
        }).filter(function (sp) { return sp.name; });
        var pts = 0, matchSports = [];
        sports.forEach(function (sp) {
          if (!sp.shared) return;
          pts += 16;
          var mine = mySkills[String(sp.name).toLowerCase()], theirs = LV[String(sp.level || '').toLowerCase()], lvlPct = 70;
          if (typeof mine === 'number' && typeof theirs === 'number') {
            var d = Math.abs(mine - theirs);
            if (d === 0) { pts += 10; lvlPct = 100; } else if (d === 1) { pts += 5; lvlPct = 85; }
          }
          matchSports.push({ icon: 'fitness_center', sport: sp.name, pct: lvlPct, points: [{ l: 'Level', v: sp.level }] });
        });
        var cityMatch = !!(myCity && r.city && myCity === String(r.city).toLowerCase());
        var countryMatch = !cityMatch && !!(myCountry && r.country && myCountry === String(r.country).toLowerCase());
        if (cityMatch) pts += 20; else if (countryMatch) pts += 8;
        var genderMatch = !!(myGender && r.gender && myGender === String(r.gender).toLowerCase());
        if (genderMatch) pts += 8;
        var ageClose = false, ad = (myAge && r.age) ? Math.abs(myAge - r.age) : null;
        if (ad !== null) { if (ad <= 5) { pts += 15; ageClose = true; } else if (ad <= 10) { pts += 8; } }
        var recent = false;
        if (r.last_active) { var days = (now - new Date(r.last_active).getTime()) / 86400000; if (days <= 30) { pts += 10; recent = true; } else if (days <= 90) { pts += 4; } }
        var score = Math.max(35, Math.min(99, pts + 35));
        var nm = r.name || 'Member';
        var conn = r.incoming ? 'incoming' : (r.conn_status === 'accepted' ? 'connected' : (r.conn_status === 'pending' ? 'requested' : 'none'));
        var matchOther = [];
        if (cityMatch) matchOther.push({ l: 'Same city', v: r.city }); else if (countryMatch) matchOther.push({ l: 'Same country', v: r.country });
        if (genderMatch) matchOther.push({ l: 'Same gender', v: (r.gender || '') });
        if (ageClose) matchOther.push({ l: 'Similar age', v: 'within 5 years' });
        if (recent) matchOther.push({ l: 'Recently active', v: 'last 30 days' });
        return {
          id: r.id, name: nm, letter: (nm[0] || '?').toUpperCase(), photo: r.photo_url || '',
          givenNames: r.given_names || (nm.split(' ')[0] || ''),
          surname: r.surname || (nm.split(' ').slice(1).join(' ') || ''),
          age: r.age || '', city: r.city || '', country: r.country || '',
          gender: String(r.gender || '').toLowerCase(), sports: sports,
          memberType: r.tier || 'member',
          memberSince: (r.member_since != null ? r.member_since : null),
          meetupsHosted: (r.meetups_hosted != null ? Number(r.meetups_hosted) : null),
          reliability: (r.reliability != null ? Number(r.reliability) : null),
          dob: (window.ffpFmtPassDate ? window.ffpFmtPassDate(r.dob) : ''),
          issueDate: (window.ffpFmtPassDate ? window.ffpFmtPassDate(r.joined_at) : ''),
          expiryDate: (window.ffpFmtPassDate ? window.ffpFmtPassDate(r.joined_at, 1) : ''),
          recent: recent,
          match: score, trust: 5.0, verified: false, joined: Date.now(), bio: '',
          meetups: 0, hosted: 0, profession: '',
          matchSports: matchSports, matchOther: matchOther, connection: conn
        };
      }).sort(function (a, b) { return b.match - a.match; });
      this.renderMatchStrip();
    } catch (e) { console.warn('[FFP Matches] load threw:', e); }
  },
  
  filtered() {
    let items = this.data.slice();
    // Clean split: Going/Hosting = UPCOMING; Past = your meetups (joined or hosted) that have happened.
    const _nowTs = Date.now();
    const _isPast = m => !!(m._ts && m._ts < _nowTs);
    if (this.tab === 'joined')       items = items.filter(m => m.joinedByMe && !m.isHostedByMe && !_isPast(m));
    else if (this.tab === 'hosting') items = items.filter(m => (this.hostingIds.has(m.id) || m.isHostedByMe));   // ALL you host (incl. past) — matches the count pill; past also appears in Past tab
    else if (this.tab === 'past')    items = items.filter(m => (m.joinedByMe || m.isHostedByMe) && _isPast(m));
    else if (this.tab === 'discover') {
      // Discover shows UPCOMING meetups only — drop ones whose start time has passed (3h grace so an
      // in-progress meetup doesn't vanish the instant it begins). _ts = meets_at epoch ms (0 = no date).
      // (reuses _nowTs declared at the top of filtered() — do NOT re-declare it here.)
      // v283: grace cut 3h → 30min, so a meetup drops off Discover ~30min after it starts (you can't
      // realistically join one that began hours ago). People who joined/host still see it in their own
      // tabs and in Past.
      items = items.filter(m => !m._ts || m._ts >= (_nowTs - 30 * 60 * 1000));
      // v195: browse filters apply ONLY on Discover — never hide your own Going/Hosting items
      if (this.search) items = items.filter(m =>
        m.activity.toLowerCase().includes(this.search) || m.host.toLowerCase().includes(this.search) || m.venue.toLowerCase().includes(this.search));
      if (this.cat !== 'all') items = items.filter(m => m.cat === this.cat);
      if (this.when !== 'all') items = items.filter(m => m.whenSlot === this.when);
      if (this.gender !== 'all') items = items.filter(m => m.gender === this.gender);
      if (this.level !== 'all') items = items.filter(m => m.level === this.level);
      if (this.country !== 'all' && this.city === 'all') {
        // Match on the meetup's COUNTRY directly. The old check (m.city in FFP_TAX.cities[country])
        // hid EVERY meetup whenever the taxonomy hadn't hydrated or a city wasn't in the list — the
        // recurring "no meetups on Discover" bug. Meetups with no country set are not hidden.
        items = items.filter(m => m.country ? (m.country === this.country) : true);
      }
      if (this.city !== 'all') items = items.filter(m => (m.city || '') === this.city);
      if (this.proOnly) items = items.filter(m => m.isProfessional);
    }
    if (!isMemberProfessional()) items = items.filter(m => !m.isProfessional);
    return items;
  },
  
  // Parse "Sat · 5 Apr · 7:00 AM" → { top:'SAT', mid:'5', bot:'APR' }
  parseDateBadge(whenStr) {
    const cleaned = whenStr.replace(/·/g, ' ');
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const dayName = parts[0] || '';
    const num = parts.find(p => /^\d+$/.test(p)) || '';
    const monAbbr = parts.find(p => /^[A-Za-z]{3,}$/.test(p) && p !== dayName && !/^\d/.test(p)) || '';
    return { top: dayName.toUpperCase(), mid: num, bot: monAbbr.toUpperCase().slice(0,3) };
  },
  
  // Extract time portion from "Sat · 5 Apr · 7:00 AM"
  extractTime(whenStr) {
    const m = whenStr.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);
    return m ? m[1].toUpperCase() : '';
  },
  
  toggleProOnly() {
    this.proOnly = !this.proOnly;
    var chip = document.getElementById('meet-pro-chip');
    if (chip) {
      chip.style.background = this.proOnly ? '#FFCC00' : 'rgba(255,204,0,0.10)';
      chip.style.color = this.proOnly ? '#081420' : '#FFCC00';
    }
    this.render();
  },

  render() {
    var _chipRow = document.getElementById('meet-pro-chip-row');
    if (_chipRow) _chipRow.style.display = isMemberProfessional() ? '' : 'none';
    // Tab counts — "Going" counts only UPCOMING (matches the Going list, which excludes past). Otherwise
    // a past join showed "2" with an empty list. Past joins live under the Past tab.
    const _nowC = Date.now();
    const joinedCount = this.data.filter(m => m.joinedByMe && !m.isHostedByMe && !(m._ts && m._ts < _nowC)).length;
    const hostingCount = this.data.filter(m => m.isHostedByMe || this.hostingIds.has(m.id)).length;
    document.getElementById('cnt-meet-joined').textContent = joinedCount;
    document.getElementById('cnt-meet-hosting').textContent = hostingCount;
    
    const items = this.filtered();
    const grid = document.getElementById('meet-grid');
    if (items.length === 0) {
      const msg = this.tab === 'hosting' ? "You're not hosting any meetups yet. Tap Post a Meetup above to create one."
                : this.tab === 'joined'  ? "You haven't joined any meetups yet."
                : this.tab === 'past'    ? "No past meetups yet."
                : 'No meetups match those filters.';
      grid.innerHTML = `<div class="feed-empty">${msg}</div>`;
      return;
    }
    
    const catLabel = {
      racquet:'Racquet', running:'Running', cycling:'Cycling', swimming:'Swimming',
      team:'Team Sport', combat:'Combat', fitness:'Fitness', 'mind-body':'Yoga / Mind-Body', adventure:'Adventure'
    };
    
    grid.innerHTML = items.map(m => {
      const isFull = m.joined >= m.capacity || m.full;
      const spotsLeft = Math.max(0, m.capacity - m.joined);
      const badge = this.parseDateBadge(m.when);
      const timeStr = this.extractTime(m.when);
      
      // Status badge (bottom-left)
      let statusBadge = '';
      if (m.joinedByMe)             statusBadge = '<div class="meetup-status-badge green">You\'re Going</div>';
      else if (m.pendingByMe)       statusBadge = '<div class="meetup-status-badge" style="background:#b45309;color:#fff;">Requested</div>';
      else if (this.hostingIds.has(m.id)) statusBadge = '<div class="meetup-status-badge blue">Hosting</div>';
      else if (isFull)              statusBadge = '<div class="meetup-status-badge red">Full</div>';
      else if (spotsLeft <= 2)      statusBadge = `<div class="meetup-status-badge">${spotsLeft} Spot${spotsLeft === 1 ? '' : 's'} Left</div>`;
      else                          statusBadge = `<div class="meetup-status-badge">${spotsLeft} Left</div>`;
      
      // Eyebrow
      const eyebrow = `<span class="cat">${escHtml(catLabel[m.cat] || m.cat)}</span>`;
      
      // Tag pills: gender, level, cost
      const pills = [];
      if (m.gender === 'women')      pills.push('LADIES ONLY');
      else if (m.gender === 'men')   pills.push('MEN ONLY');
      else                           pills.push('ANY GENDER');
      pills.push(m.level.toUpperCase());
      const isFreeCost = m.cost && m.cost.toLowerCase().includes('free');
      pills.push({ text: isFreeCost ? 'FREE' : m.cost.toUpperCase(), cls: isFreeCost ? 'free' : '' });
      const pillsHtml = pills.map(p => {
        if (typeof p === 'string') return `<span class="meetup-tag-pill">${escHtml(p)}</span>`;
        return `<span class="meetup-tag-pill ${p.cls || ''}">${escHtml(p.text)}</span>`;
      }).join('');
      
      const capacityTxt = `<span class="num-yellow">${m.joined}/${m.capacity}</span> joined`;
      
      return `
        <div class="meetup-card" onclick="MeetMove.openMeetupDetail('${m.id}')">
          <div class="meetup-cover-v2 taller ${m.img ? 'image' : m.cat}" ${m.img ? `style="background-image:url('${escHtml(m.img)}');"` : ''}>
            <div class="meetup-date-badge">
              <div class="meetup-date-top">${badge.top}</div>
              <div class="meetup-date-mid">${badge.mid}</div>
              <div class="meetup-date-bot">${badge.bot}</div>
            </div>
            ${statusBadge}
          </div>
          <div class="meetup-body">
            <div class="meetup-eyebrow">${eyebrow}</div>
            ${m.isProfessional ? '<span style="display:inline-block;margin-bottom:6px;font-size:9px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#FFCC00;background:rgba(255,204,0,0.12);border:1px solid rgba(255,204,0,0.4);border-radius:6px;padding:3px 8px;">Professionals</span>' : ''}
            <div class="meetup-title-v2">${escHtml(m.activity)}</div>
            <div class="meetup-meta-row">
              <span class="item"><span class="material-icons">schedule</span><span class="date-blue">${escHtml(m.when.replace(/·.*?·/, '·').trim())}</span></span>
              <span class="item"><span class="material-icons">location_on</span>${escHtml(m.venue)}${m.area ? ', ' + escHtml(m.area) : ''}</span>
            </div>
            <button class="meetup-view-btn" onclick="event.stopPropagation(); MeetMove.openMeetupDetail('${m.id}')">
              View Details <span class="material-icons">arrow_forward</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },
  
  openMeetupDetail(id) {
    const m = this.data.find(x => x.id === id);
    if (!m) return;
    const isFull = m.joined >= m.capacity || m.full;
    const isJoined = m.joinedByMe;
    let btnLabel = 'Request to Join';
    let btnDisabled = '';
    let btnClass = '';
    if (isJoined)     { btnLabel = "You're going"; btnDisabled = 'disabled'; }
    else if (m.pendingByMe) { btnLabel = 'Requested ✓ — awaiting host'; btnDisabled = 'disabled'; }
    else if (isFull)  { btnLabel = 'Full'; btnDisabled = 'disabled'; btnClass = 'sold-out'; }
    const body = `
      <div class="dm-cover ${m.cat === 'racquet' ? 'sports' : m.cat === 'mind-body' ? 'wellness' : m.cat === 'fitness' ? 'fitness' : m.cat === 'adventure' ? 'adventure' : 'sports'}">
        <span class="dm-cover-tag">${escHtml(m.cost || 'Free')}</span>
      </div>
      <div class="dm-body">
        <div class="dm-title">${escHtml(m.activity)}</div>
        <div class="dm-meta-row">
          <span class="item"><span class="material-icons">schedule</span>${escHtml(m.when)}</span>
          <span class="item"><span class="material-icons">location_on</span>${m.maps_url ? `<a href="${m.maps_url}" target="_blank" rel="noopener" style="color:var(--blue);text-decoration:none;">${escHtml(m.venue)}${m.area ? ', ' + escHtml(m.area) : ''} <span class="material-icons" style="font-size:13px;vertical-align:-2px;">open_in_new</span></a>` : (escHtml(m.venue) + (m.area ? ', ' + escHtml(m.area) : ''))}</span>
          <span class="item"><span class="material-icons">signal_cellular_alt</span>${escHtml(m.level)}</span>
        </div>
      </div>
      <div class="dm-section">
        <div class="dm-section-label">Details</div>
        <div class="dm-info-grid dm-info-3">
          <div class="dm-info-cell"><div class="k">Level</div><div class="v">${escHtml(m.level)}</div></div>
          <div class="dm-info-cell"><div class="k">Gender</div><div class="v">${m.gender === 'any' ? 'Any gender' : (m.gender === 'women' ? 'Female only' : 'Male only')}</div></div>
          <div class="dm-info-cell"><div class="k">Capacity</div><div class="v">${m.joined} of ${m.capacity}</div></div>
        </div>
      </div>
      <div class="dm-section">
        <div class="dm-section-label">About this meetup</div>
        <p>${escHtml(m.about || 'Member-hosted meetup.')}</p>
      </div>
      <div class="dm-section" id="ffp-whos-going">${this.whosGoingInline(m)}</div>
      <div class="dm-footer">
        <button class="btn-primary-yellow" style="margin-bottom:8px;background:transparent;color:#2ba8e0;box-shadow:none;border:1px solid rgba(43,168,224,0.45);" onclick="MeetMove.shareMeetup('${m.id}')"><span class="material-icons" style="font-size:16px;vertical-align:-3px;">share</span> Share this meet-up</button>
        ${m.isHostedByMe
          ? `<button class="btn-primary-yellow" style="margin-bottom:8px;" onclick="MeetMove.editMeetup('${m.id}')"><span class="material-icons" style="font-size:16px;vertical-align:-3px;">edit</span> Edit meet-up</button>
             <button class="btn-primary-yellow" style="background:#ef4444;color:#fff;box-shadow:0 6px 18px rgba(239,68,68,0.30);" onclick="MeetMove.cancelMeetup('${m.id}')">Cancel this meet-up</button>
             <div class="dm-footer-note">You're hosting this. Anyone who joined will be notified if you change or cancel it.</div>`
          : `<button class="btn-primary-yellow ${btnClass}" ${btnDisabled} onclick="MeetMove.requestJoin('${m.id}')">${btnLabel}</button>
             ${(m.joinedByMe || m.pendingByMe) ? `<button class="btn-primary-yellow" style="margin-top:8px;background:transparent;color:#ef4444;box-shadow:none;border:1px solid rgba(239,68,68,0.45);" onclick="MeetMove.leaveMeetup('${m.id}')">${m.pendingByMe ? 'Cancel request' : 'Cancel my spot'}</button>` : ''}
             <div class="dm-footer-note">Host approves who's in. You can cancel anytime before it starts.</div>`}
      </div>
    `;
    openDetailModal(body, true);
    if (window.ffpScaleCards) setTimeout(() => { try { window.ffpScaleCards(document.getElementById('ffp-whos-going')); } catch (e) {} }, 0);
  },

  // Who's going — rendered INLINE as part of the modal (host first). Data (m.attendees) is host-first
  // from the meet-move loader's buildAttendees(); reuses the FFPPassportCard component (defined in this file).
  whosGoingInline(m) {
    // ONE source of truth: every card resolves through window.FFPCard (keyed by member id).
    // Self → MemberProfile.data; others → the shared cache fed by the loader / matches RPC.
    const FC = window.FFPCard;
    const myId = FC ? FC._myId() : null;
    let people = ((m && m.attendees) || []).slice();
    // THE HOST ALWAYS SHOWS, FIRST. If I'm the host, force my id so the card resolves to MY passport.
    if (m) {
      const hostIdx = people.findIndex(p => p && p.isHost);
      if (hostIdx === -1) {
        people.unshift({ id: (m.isHostedByMe && myId) ? myId : (m.host_member_id || 'host'),
          name: m.host || 'Host', city: m.area || m.city || '', country: m.country || '', isHost: true });
      } else if (hostIdx > 0) {
        people.unshift(people.splice(hostIdx, 1)[0]);
      }
      if (m.isHostedByMe && myId && people[0]) people[0].id = myId;
    }
    const cap = (m && (m.capacity || m.spots)) || '';
    const n = people.length;
    const header = `<div class="dm-section-label">Who's going (${n}${cap ? '/' + cap : ''})</div>`;
    if (!n) {
      return header + `<div style="font-size:12px;color:var(--muted);">Be the first to join.</div>`;
    }
    const card = (p) => (FC ? (FC.resolve(p) || p) : p);
    // Carousel: one passport at a time with ‹ › arrows (like the Matches deck).
    if (window.FFPPassportCard && FC) {
      const slides = people.map((p, i) =>
        `<div class="wg-slide" data-i="${i}"${i === 0 ? '' : ' style="display:none;"'}>${window.FFPPassportCard.render(card(p), { context: 'attendee', role: (p.isHost ? 'HOST' : 'GOING'), flippable: true })}</div>`
      ).join('');
      const arrows = n > 1;
      return header +
        `<div class="wg-deck" id="wg-deck" data-idx="0" data-count="${n}">` +
          (arrows ? `<button class="wg-arrow" onclick="MeetMove.wgNav(-1)" aria-label="Previous">‹</button>` : '') +
          `<div class="wg-stage">${slides}</div>` +
          (arrows ? `<button class="wg-arrow" onclick="MeetMove.wgNav(1)" aria-label="Next">›</button>` : '') +
        `</div>` +
        (arrows
          ? `<div class="wg-counter"><span id="wg-pos">1</span> / ${n} · tap a passport to flip</div>`
          : `<div class="wg-counter">Tap the passport to flip</div>`);
    }
    const rows = people.map(p => {
      const d = card(p);
      const mine = myId && d && d.id === myId;
      const nm = escHtml(d.name || 'Member') + (mine ? ' (You)' : '');
      const av = d.photo
        ? `<span style="width:36px;height:36px;border-radius:50%;display:inline-block;flex-shrink:0;background:#0a1825 url('${d.photo}') center/cover;"></span>`
        : `<span style="width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:#13314a;color:#cfe3f2;font-weight:800;">${escHtml((d.name || 'M').charAt(0).toUpperCase())}</span>`;
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">${av}<div><div style="font-weight:700;font-size:13px;">${nm}${p.isHost ? ' <span style="font-size:9px;font-weight:800;color:#FFCC00;border:1px solid #FFCC00;border-radius:20px;padding:1px 7px;vertical-align:1px;">HOST</span>' : ''}</div>${d.city ? `<div style="font-size:11px;color:var(--muted);">${escHtml(d.city)}</div>` : ''}</div></div>`;
    }).join('');
    return header + rows;
  },

  // Who's going carousel navigation (prev/next).
  wgNav(dir) {
    const deck = document.getElementById('wg-deck');
    if (!deck) return;
    const count = parseInt(deck.getAttribute('data-count'), 10) || 1;
    let idx = ((parseInt(deck.getAttribute('data-idx'), 10) || 0) + dir + count) % count;
    deck.setAttribute('data-idx', idx);
    deck.querySelectorAll('.wg-slide').forEach(s => { s.style.display = (parseInt(s.getAttribute('data-i'), 10) === idx) ? 'block' : 'none'; });
    const pos = document.getElementById('wg-pos'); if (pos) pos.textContent = idx + 1;
    if (window.ffpScaleCards) { try { window.ffpScaleCards(deck); } catch (e) {} }
  },
  
  requestJoin(id) {
    const m = this.data.find(x => x.id === id);
    if (!m) return;
    m.joinedByMe = true;
    m.joined = Math.min(m.capacity, m.joined + 1);
    closeDetailModal();
    this.render();
    showToast(`Request sent to ${m.host} — they'll approve shortly`);
    // PRODUCTION: POST /api/meet/{id}/request
  },
  
  openMemberDetail(uid) {
    const u = this.matches.find(x => x.id === uid);
    if (!u) return;
    const joinedTxt = `Joined ${new Date(u.joined).toLocaleDateString('en-GB', { month:'short', year:'numeric' })}`;
    const sportsMatchHtml = u.matchSports.map(ms => `
      <div class="pm-match-block">
        <div class="pm-match-row-head">
          <span class="material-icons">${ms.icon}</span>
          <span class="sport-name">${escHtml(ms.sport)}</span>
          <span class="pct">${ms.pct}%</span>
        </div>
        <div class="pm-match-points">
          ${ms.points.map(p => `<span><span class="material-icons">check</span><strong>${escHtml(p.l)}:</strong> ${escHtml(p.v)}</span>`).join('')}
        </div>
      </div>
    `).join('');
    const otherMatchHtml = u.matchOther.map(o => `
      <div class="pm-match-other">
        <div class="tick"><span class="material-icons">check_circle</span></div>
        <div><strong>${escHtml(o.l)}</strong> <span class="muted">— ${escHtml(o.v)}</span></div>
      </div>
    `).join('');
    const sharedCount = u.matchSports.length;
    const summary = sharedCount > 0
      ? `Your <strong>${u.match}% match</strong> is built from <strong>${sharedCount} shared sport${sharedCount > 1 ? 's' : ''}</strong> plus city, age and stated interests.`
      : `Your <strong>${u.match}% match</strong> is based on city, age range and shared interests — no overlapping sports yet, but room to try something new together.`;
    const sportsListHtml = u.sports.map(s => `
      <div style="display:flex; align-items:center; gap:10px; padding:8px 4px; border-bottom:1px solid var(--border);">
        <div style="flex:1;"><strong style="font-size:13px;">${escHtml(s.name)}</strong>${s.shared ? ' <span style="display:inline-block; padding:1px 6px; background:rgba(74,222,128,0.15); color:#4ade80; border:1px solid rgba(74,222,128,0.30); border-radius:100px; font-size:9px; font-weight:800; margin-left:4px;">SHARED</span>' : ''}</div>
        <div style="font-size:11px; color:var(--muted); font-weight:700;">${escHtml(s.level)}</div>
      </div>
    `).join('');
    
    const body = `
      <div class="pm-head">
        <div class="pm-avatar"${u.photo ? ` style="background:#0a1825 url('${u.photo}') center/cover;"` : ''}>${u.photo ? '' : u.letter}</div>
        <div class="pm-name">
          ${escHtml(u.name)}${u.verified ? ' <span class="material-icons" style="font-size:18px; color:var(--blue);">verified</span>' : ''}
        </div>
        <div class="pm-pct-badge">${u.match}% MATCH</div>
        <div class="pm-meta">${escHtml(u.age)}<span class="sep">·</span>${escHtml(u.city)}<span class="sep">·</span>${u.gender === 'female' ? 'Female' : u.gender === 'male' ? 'Male' : ''}</div>
        <div class="pm-meta" style="margin-top:4px; font-size:11px;">${joinedTxt}${u.memberType === 'professional' ? ` <span class="sep">·</span> <span style="color:var(--yellow); font-weight:700;">Professional · ${escHtml(u.profession)}</span>` : ''}</div>
      </div>
      <div class="pm-bio">${escHtml(u.bio)}</div>
      <div class="dm-section">
        <div class="dm-section-label" style="color:var(--yellow); display:flex; align-items:center; gap:6px;"><span class="material-icons" style="font-size:14px;">auto_awesome</span>Why you match</div>
        <p style="margin-bottom:10px; font-size:12px; color:var(--muted); line-height:1.5;">${summary}</p>
        ${sportsMatchHtml}
        ${otherMatchHtml}
      </div>
      <div class="dm-section">
        <div class="dm-section-label">Sports &amp; level</div>
        ${sportsListHtml}
      </div>
      <div class="dm-section">
        <div class="dm-section-label">Activity on passport</div>
        <div class="pm-stats-grid">
          <div class="pm-stat-cell"><div class="pm-stat-n">${u.meetups}</div><div class="pm-stat-l">Meetups</div></div>
          <div class="pm-stat-cell"><div class="pm-stat-n">${u.hosted}</div><div class="pm-stat-l">Hosted</div></div>
          <div class="pm-stat-cell"><div class="pm-stat-n">${u.trust.toFixed(1)}</div><div class="pm-stat-l">Trust</div></div>
          <div class="pm-stat-cell"><div class="pm-stat-n">${u.verified ? 'Yes' : 'Pending'}</div><div class="pm-stat-l">Verified</div></div>
        </div>
      </div>
      <div class="dm-footer">
        ${u.connection === 'connected' ? '<button class="btn-primary-blue" disabled style="opacity:.7;">\u2713 Connected</button>' : (u.connection === 'requested' ? '<button class="btn-primary-yellow" disabled style="opacity:.6;">Added ✓</button>' : `<button class="btn-primary-yellow" onclick="MeetMove.requestConnect('${u.id}')">Add passport</button>`)}
        <div class="dm-footer-note">Connecting adds them to your circle — your meet-ups will reach them.</div>
      </div>
    `;
    openDetailModal(body);
  },
  
  // v181: connect via Supabase (RLS: requester_id must be me). Accept if they invited me.
  async requestConnect(uid) {
    const u = this.matches.find(x => x.id === uid);
    const member = (window.FFPAuth && window.FFPAuth.getMember && window.FFPAuth.getMember()) || null;
    if (!u || !member || !window.supabase) { closeDetailModal(); return; }
    try {
      if (u.connection === 'incoming') {
        const up = await window.supabase.from('member_connections').update({ status: 'accepted' })
          .eq('requester_id', uid).eq('addressee_id', member.id);
        if (up.error) { showToast('Could not connect — try again'); closeDetailModal(); return; }
        u.connection = 'connected';
        showToast(`You're connected with ` + u.name.split(' ')[0]);
      } else {
        const ins = await window.supabase.from('member_connections')
          .insert({ requester_id: member.id, addressee_id: uid, status: 'pending' });
        if (ins.error) { console.warn('[FFP Matches] connect:', ins.error.message); showToast('Could not send request — try again'); closeDetailModal(); return; }
        u.connection = 'requested';
        showToast(`Request sent to ` + u.name.split(' ')[0]);
      }
      this.renderMatchStrip();
      // Re-pull the dashboard connections immediately so the new connection's name shows without
      // leaving/returning to the app. (force=true bypasses the live-refresh throttle.)
      try { if (window.ffpRefreshLive) window.ffpRefreshLive(true); } catch (e) {}
    } catch (e) { showToast('Could not send request — try again'); }
    closeDetailModal();
  },
  
  openMatchesGrid() {
    var mk = function (m) {
      return `<div class="match-card" style="flex:auto;" onclick="closeDetailModal(); setTimeout(() => MeetMove.openMemberDetail('${m.id}'), 100);">
              <div class="match-card-avatar"${m.photo ? ` style="background:#0a1825 url('${m.photo}') center/cover;"` : ''}>${m.photo ? '' : m.letter}</div>
              <div class="match-card-name">${escHtml(m.name)}</div>
              <div class="match-card-meta">${escHtml(m.age)} &middot; ${escHtml(m.city)}</div>
              <div class="match-card-pct">${m.match}% MATCH</div>
            </div>`;
    };
    var grid = function (list, empty) {
      return list.length
        ? `<div style="display:grid; grid-template-columns:repeat(2,1fr); gap:10px;">${list.map(mk).join('')}</div>`
        : `<div style="font-size:12px;color:var(--muted);padding:12px 0 4px;">${empty}</div>`;
    };
    var suggestions = (this.matches || []).filter(function (m) { return m.connection !== 'connected'; });
    var connected = (this.matches || []).filter(function (m) { return m.connection === 'connected'; });
    const body = `
      <div class="dm-body">
        <div class="dm-title">Matches</div>
        <div class="mm-tabs" style="display:flex;gap:8px;margin:10px 0 14px;">
          <button class="mm-tab active" onclick="MeetMove.matchesTab('suggest', this)">Matching with</button>
          <button class="mm-tab" onclick="MeetMove.matchesTab('connected', this)">Connected with</button>
        </div>
        <div id="mm-list-suggest">${grid(suggestions, 'No matches yet — check back as more people join.')}</div>
        <div id="mm-list-connected" style="display:none;">${grid(connected, 'No connections yet — open a match and connect to start your circle.')}</div>
      </div>
    `;
    openDetailModal(body);
  },

  matchesTab(which, btn) {
    document.querySelectorAll('.mm-tab').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var sg = document.getElementById('mm-list-suggest'), cn = document.getElementById('mm-list-connected');
    if (sg) sg.style.display = (which === 'suggest') ? '' : 'none';
    if (cn) cn.style.display = (which === 'connected') ? '' : 'none';
  },
  
  openPostForm() {
    var g = function (id) { return document.getElementById(id); };
    var cnyS = g('pmf-country'), citS = g('pmf-city');
    var afS = g('pmf-age-from'), atS = g('pmf-age-to');
    // Date — native single-tap calendar; default today, can't pick the past.
    var dateI = g('pmf-date');
    if (dateI) {
      var _t = new Date(); var _today = _t.getFullYear() + '-' + String(_t.getMonth() + 1).padStart(2, '0') + '-' + String(_t.getDate()).padStart(2, '0');
      dateI.min = _today;
      if (!dateI.value) dateI.value = _today;
    }
    // Country -> City cascade (single unit, FFP_TAX.cities)
    if (cnyS && cnyS.options.length === 0 && window.FFP_TAX && FFP_TAX.cities) {
      var fillCities = function (country) {
        citS.innerHTML = '';
        var list = (country && FFP_TAX.cities[country]) ? FFP_TAX.cities[country] : [];
        citS.add(new Option(list.length ? 'Select city…' : 'Select a country first', ''));
        list.forEach(function (c) { citS.add(new Option(c, c)); });
      };
      cnyS.add(new Option('Select country…', ''));
      Object.keys(FFP_TAX.cities).forEach(function (c) { cnyS.add(new Option(c, c)); });
      cnyS.addEventListener('change', function () { fillCities(this.value); });
      if (FFP_TAX.cities['United Arab Emirates']) { cnyS.value = 'United Arab Emirates'; fillCities('United Arab Emirates'); }
      else { fillCities(''); }
    }
    // Age From / To
    if (afS && afS.options.length === 0) {
      for (var a = 18; a <= 99; a++) { afS.add(new Option(String(a), a)); atS.add(new Option(String(a), a)); }
      afS.value = '18'; atS.value = '99';
    }
    var tmEl = g('pmf-time'); if (tmEl && !tmEl.value) tmEl.value = '18:00';
    var acV = g('pmf-cat'), acL = g('pmf-level'), acD = g('pmf-cat-display');
    if (acV) acV.value = ''; if (acL) acL.value = '';
    if (acD) { acD.textContent = 'Choose activity & level'; acD.classList.remove('set'); }
    var ml = g('pmf-maplink'); if (ml) ml.style.display = 'none';
    ['pmf-venue','pmf-lat','pmf-lng','pmf-maps'].forEach(function (id) { var e = g(id); if (e) e.value = ''; });
    var ld = g('pmf-loc-display'); if (ld) { ld.textContent = 'Add location — search or drop a pin'; ld.classList.add('pmf-pick-ph'); ld.classList.remove('set'); }
    var _proField = g('pmf-pro-field'), _proCb = g('pmf-professional');
    if (_proCb) _proCb.checked = false;
    if (_proField) _proField.style.display = isMemberProfessional() ? '' : 'none';
    if (window.pmfClearCover) window.pmfClearCover();   // reset cover photo for a fresh post
    this._editId = null;
    var _pt = document.querySelector('#post-meetup-backdrop .dm-title'); if (_pt) _pt.textContent = 'Post a meetup';
    var _pb = document.querySelector('#post-meetup-backdrop .dm-footer .btn-primary-yellow'); if (_pb) _pb.textContent = 'Post Meetup';
    g('post-meetup-backdrop').classList.add('open');
  },

  editMeetup(id) {
    var item = (this.data || []).find(function (x) { return x.id === id; });
    var r = item && item._raw; if (!r) { if (typeof showToast === 'function') showToast('Could not load that meet-up', 'error'); return; }
    if (typeof closeDetailModal === 'function') closeDetailModal();
    this.openPostForm();
    var g = function (i) { return document.getElementById(i); };
    if (g('pmf-title')) g('pmf-title').value = r.title || '';
    if (typeof window.pmfTitleCount === 'function') window.pmfTitleCount();
    if (g('pmf-cat')) g('pmf-cat').value = r.sport || '';
    if (g('pmf-level')) g('pmf-level').value = r.fitness_level || '';
    var acD = g('pmf-cat-display'); if (acD && r.sport) { acD.textContent = r.sport + (r.fitness_level ? ' · ' + r.fitness_level : ''); acD.classList.remove('pmf-pick-ph'); acD.classList.add('set'); }
    if (r.meets_at) { var d = new Date(r.meets_at);
      if (g('pmf-date')) g('pmf-date').value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      if (g('pmf-time')) g('pmf-time').value = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    }
    if (g('pmf-capacity')) g('pmf-capacity').value = String(r.max_people || 4);
    if (r.country && g('pmf-country')) { g('pmf-country').value = r.country; g('pmf-country').dispatchEvent(new Event('change')); }
    if (r.city && g('pmf-city')) g('pmf-city').value = r.city;
    if (typeof pmfSetLocation === 'function') pmfSetLocation({ name: r.venue, lat: r.latitude, lng: r.longitude, maps_url: r.maps_url || ((r.latitude && r.longitude) ? ('https://www.google.com/maps?q=' + r.latitude + ',' + r.longitude) : '') });
    if (g('pmf-gender')) g('pmf-gender').value = r.group_filter === 'women_only' ? 'female' : (r.group_filter === 'men_only' ? 'male' : 'any');
    if (r.age_range && String(r.age_range).indexOf('-') >= 0) { var ar = String(r.age_range).split('-'); if (g('pmf-age-from')) g('pmf-age-from').value = ar[0]; if (g('pmf-age-to')) g('pmf-age-to').value = ar[1]; }
    if (g('pmf-desc')) g('pmf-desc').value = r.description || '';
    if (window.pmfSetCover) window.pmfSetCover(r.cover_url || '');   // prefill existing cover photo
    if (g('pmf-professional')) g('pmf-professional').checked = !!r.is_professional;
    this._editId = id;
    var pt = document.querySelector('#post-meetup-backdrop .dm-title'); if (pt) pt.textContent = 'Edit meet-up';
    var pb = document.querySelector('#post-meetup-backdrop .dm-footer .btn-primary-yellow'); if (pb) pb.textContent = 'Save changes';
  },

  acFilter(q) {
    var acR = document.getElementById('pmf-cat-results'); if (!acR) return;
    q = String(q || '').trim().toLowerCase();
    var list = (window.FFP_TAX && FFP_TAX.activities) ? FFP_TAX.activities : (window.ACTIVITIES_DB || []);
    var names = list.map(function (a) { return a.n || a.name || a; });
    var matched = names.filter(function (n) { return !q || String(n).toLowerCase().indexOf(q) >= 0; }).slice(0, 50);
    if (!matched.length) { acR.innerHTML = '<div class="pmf-ac-empty">No activities found</div>'; acR.style.display = 'block'; return; }
    acR.innerHTML = matched.map(function (n) {
      var safe = String(n).replace(/'/g, "\\'");
      return '<div class="pmf-ac-item" onclick="MeetMove.acPick(\'' + safe + '\')">' + (window.escHtml ? escHtml(n) : n) + '</div>';
    }).join('');
    acR.style.display = 'block';
  },
  acPick(name) {
    var acI = document.getElementById('pmf-cat-search'), acV = document.getElementById('pmf-cat'), acR = document.getElementById('pmf-cat-results');
    if (acI) acI.value = name; if (acV) acV.value = name; if (acR) { acR.innerHTML = ''; acR.style.display = 'none'; }
  },
  
  closePostForm() {
    document.getElementById('post-meetup-backdrop').classList.remove('open');
  },
  
  async submitPost() {
    var title    = document.getElementById('pmf-title').value.trim();
    var activity = document.getElementById('pmf-cat').value;
    var venue    = document.getElementById('pmf-venue').value.trim();
    var mapsUrl  = (document.getElementById('pmf-maps')||{}).value || '';
    var latV     = (document.getElementById('pmf-lat')||{}).value || '';
    var lngV     = (document.getElementById('pmf-lng')||{}).value || '';
    var country  = document.getElementById('pmf-country').value;
    var city     = document.getElementById('pmf-city').value.trim();
    var ageFrom  = document.getElementById('pmf-age-from').value;
    var ageTo    = document.getElementById('pmf-age-to').value;
    var ageRange = (ageFrom && ageTo) ? (ageFrom + '-' + ageTo) : '';
    if (!title)    { alert('Add a title.'); return; }
    if (!activity || !document.getElementById('pmf-level').value) { alert('Choose an activity and level.'); return; }
    if (!venue)    { alert('Add a location — tap "Add location" and pick the spot on the map.'); return; }
    if (!country)  { alert('Select a country.'); return; }
    if (!city)     { alert('Add a city.'); return; }
    if (!ageFrom || !ageTo) { alert('Select an age range (from and to).'); return; }
    if (parseInt(ageFrom, 10) > parseInt(ageTo, 10)) { alert('Age "from" must be less than or equal to "to".'); return; }
    var member = (window.FFPAuth && window.FFPAuth.getMember && window.FFPAuth.getMember()) || null;
    if (!member || !member.id) { alert('Please sign in again to post a meetup.'); return; }
    var dateStr = document.getElementById('pmf-date').value;
    if (!dateStr) { alert('Pick a date.'); return; }
    var tm = document.getElementById('pmf-time').value || '18:00';
    // Treat the entered date/time as LOCAL and store the true instant (was stored tz-less →
    // Postgres read it as UTC, then the card converted to local = +4h in UAE, e.g. 6am→10am).
    var meetsAt;
    try { meetsAt = new Date(dateStr + 'T' + tm).toISOString(); }
    catch (e) { meetsAt = dateStr + 'T' + tm + ':00'; }
    var g = document.getElementById('pmf-gender').value;
    var groupFilter = g === 'female' ? 'women_only' : (g === 'male' ? 'men_only' : null);
    var payload = {
      host_member_id: member.id,
      title: title,
      sport: activity,
      meets_at: meetsAt,
      venue: venue,
      maps_url: mapsUrl || null,
      latitude: latV || null,
      longitude: lngV || null,
      city: city,
      country: country,
      age_range: ageRange,
      max_people: parseInt(document.getElementById('pmf-capacity').value, 10) || 8,
      fitness_level: document.getElementById('pmf-level').value,
      group_filter: groupFilter,
      description: document.getElementById('pmf-desc').value.trim(),
      is_professional: !!(document.getElementById('pmf-professional') && document.getElementById('pmf-professional').checked),
      cover_url: (document.getElementById('pmf-cover') && document.getElementById('pmf-cover').value) || '',   // host photo (data URL)
      status: 'open'
    };
    var isEdit = !!this._editId;
    try {
      if (isEdit) {
        var ures = await window.supabase.rpc('update_meetup', { p_me: member.id, p_meetup: this._editId, p: payload });
        if (ures.error || ures.data !== true) { alert('Could not save changes' + (ures.error ? ': ' + ures.error.message : ' — only the host can edit this.')); return; }
      } else {
        var res = await window.supabase.rpc('host_meetup', { p_me: member.id, p: payload });
        if (res.error) { alert('Could not post: ' + res.error.message); return; }
        // Notify members who match THIS meet-up's criteria (city · gender · age range). Fire-and-forget.
        var _newMeetupId = res && res.data;
        if (_newMeetupId) {
          try {
            fetch('https://ffp-passport-backend.vercel.app/api/meetups/notify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ kind: 'new', meetup_id: _newMeetupId })
            }).catch(function () {});
          } catch (e) {}
        }
      }
    } catch (e) { alert('Could not save the meetup. Please try again.'); return; }
    this._editId = null;
    this.closePostForm();
    showToast(isEdit ? 'Meet-up updated' : 'Meetup posted — visible to matched members', 'send');
    ['pmf-title','pmf-venue','pmf-cost','pmf-desc','pmf-cat-search','pmf-cat'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
    if (typeof window.pmfTitleCount === 'function') window.pmfTitleCount();
    if (typeof window.ffpReloadMeetMove === 'function') { try { window.ffpReloadMeetMove(); } catch (e) {} }
  }
};
if (typeof MeetMove !== "undefined") window.MeetMove = MeetMove;

// v269: "My Collection" — the passports you've collected (member_connections_list, collection semantics).
// Reuses the already-loaded CONNECTIONS global; tap a person to open their passport detail.
const CollectionView = {
  _people: function () { return (typeof CONNECTIONS !== 'undefined' && Array.isArray(CONNECTIONS)) ? CONNECTIONS : []; },
  _myId: function () { try { return (window.FFPAuth && FFPAuth.getMember && (FFPAuth.getMember() || {}).id) || null; } catch (e) { return null; } },
  open: function () {
    var body = '<div class="cv-wrap"><h3 class="q-title">My collection</h3>' +
      '<p class="q-desc">Passports you’ve collected. Search, tap to view the card, recommend, or remove.</p>' +
      '<input id="cv-search" placeholder="Search your collection…" oninput="CollectionView._filter(this.value)" style="width:100%;box-sizing:border-box;padding:11px 14px;border-radius:10px;border:1px solid rgba(43,168,224,0.25);background:rgba(43,168,224,0.05);color:#e8eef4;font-size:14px;font-family:inherit;margin-bottom:12px;">' +
      '<div id="cv-list-host">' + this._listHtml('') + '</div></div>';
    if (typeof openDetailModal === 'function') openDetailModal(body);
  },
  _filter: function (q) { var h = document.getElementById('cv-list-host'); if (h) h.innerHTML = this._listHtml(q || ''); },
  _listHtml: function (q) {
    var people = this._people();
    q = (q || '').trim().toLowerCase();
    if (q) people = people.filter(function (p) { return ((p.name || '') + ' ' + (p.city || '')).toLowerCase().indexOf(q) !== -1; });
    if (!people.length) {
      return '<div class="cv-empty">' + (q ? 'No matches in your collection.' : 'No passports yet — add people from <b>People you might click with</b>, or from a meet-up’s Who’s going.') + '</div>';
    }
    return '<div class="cv-list">' + people.map(function (p) {
      var tag = p.mutual ? '<span class="cv-tag connected">Connected</span>' : '<span class="cv-tag added">Added</span>';
      var av = p.photo
        ? '<span class="cv-av" style="background:#0a1825 url(\'' + p.photo + '\') center/cover;"></span>'
        : '<span class="cv-av">' + escHtml((p.name || 'M').charAt(0).toUpperCase()) + '</span>';
      return '<div class="cv-row" onclick="CollectionView.openPerson(\'' + p.id + '\')">' + av +
        '<div class="cv-info"><div class="cv-name">' + escHtml(p.name || 'Member') + '</div>' +
        (p.city ? '<div class="cv-city">' + escHtml(p.city) + '</div>' : '') + '</div>' +
        tag + '<span class="material-icons cv-chev">chevron_right</span></div>';
    }).join('') + '</div>';
  },
  openPerson: async function (id) {
    var person = this._people().find(function (x) { return x.id === id; }) || {};
    var card = null;
    try {
      if (window.supabase) {
        var res = await window.supabase.rpc('members_cards', { p_ids: [id] });
        var row = (res && res.data && res.data[0]) || null;
        if (row && window.FFPCard && FFPCard.register) FFPCard.register(row);
        card = (window.FFPCard && FFPCard.resolve) ? FFPCard.resolve(id) : ((row && window.FFPCard && FFPCard.mapRow) ? FFPCard.mapRow(row) : null);
      }
    } catch (e) {}
    var cardHtml = (card && window.FFPPassportCard && FFPPassportCard.render)
      ? '<div style="display:flex;justify-content:center;padding:6px 0 2px;">' + FFPPassportCard.render(card, { flippable: true }) + '</div>' +
        '<div style="text-align:center;font-size:11px;color:var(--muted,#8a99a8);margin:6px 0 14px;">Tap the card to flip</div>'
      : '<div class="cv-empty">Couldn’t load this passport right now.</div>';
    var body = '<div class="cv-wrap"><h3 class="q-title">' + escHtml(person.name || (card && card.name) || 'Passport') + '</h3>' +
      cardHtml +
      '<div style="display:flex;gap:10px;">' +
        '<button class="btn-primary-blue" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;" onclick="CollectionView.openShare(\'' + id + '\')"><span class="material-icons" style="font-size:18px;">share</span> Recommend</button>' +
        '<button style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;background:rgba(214,90,90,0.12);color:#d65a5a;border:1px solid rgba(214,90,90,0.4);border-radius:10px;padding:12px 16px;font-weight:700;cursor:pointer;font-family:inherit;" onclick="CollectionView.remove(\'' + id + '\')"><span class="material-icons" style="font-size:18px;">delete</span></button>' +
      '</div></div>';
    if (typeof openDetailModal === 'function') openDetailModal(body);
    setTimeout(function () { try { window.ffpScaleCards && window.ffpScaleCards(); } catch (e) {} }, 30);
  },
  openShare: function (subjectId) {
    var recips = this._people().filter(function (p) { return p.id !== subjectId; });
    var body = '<div class="cv-wrap"><h3 class="q-title">Recommend this connection</h3>' +
      '<p class="q-desc">Send this passport to someone in your collection — it lands in their bell as a suggestion to connect.</p>';
    if (!recips.length) {
      body += '<div class="cv-empty">You need at least one other connection to recommend to.</div>';
    } else {
      body += '<div class="cv-list">' + recips.map(function (p) {
        var av = p.photo
          ? '<span class="cv-av" style="background:#0a1825 url(\'' + p.photo + '\') center/cover;"></span>'
          : '<span class="cv-av">' + escHtml((p.name || 'M').charAt(0).toUpperCase()) + '</span>';
        return '<div class="cv-row" onclick="CollectionView.doRecommend(\'' + subjectId + '\',\'' + p.id + '\')">' + av +
          '<div class="cv-info"><div class="cv-name">' + escHtml(p.name || 'Member') + '</div>' +
          (p.city ? '<div class="cv-city">' + escHtml(p.city) + '</div>' : '') + '</div>' +
          '<span class="material-icons cv-chev">send</span></div>';
      }).join('') + '</div>';
    }
    body += '</div>';
    if (typeof openDetailModal === 'function') openDetailModal(body);
  },
  doRecommend: async function (subjectId, toId) {
    var me = this._myId();
    if (!me || !window.supabase) { if (window.showToast) showToast('Please sign in again', 'error'); return; }
    try {
      var res = await window.supabase.rpc('member_recommend_passport', { p_me: me, p_to: toId, p_subject: subjectId });
      if (res.error) throw res.error;
      if (res.data && res.data.ok === false) throw new Error('invalid');
      if (window.showToast) showToast('Recommendation sent ✓', 'success');
      if (typeof closeDetailModal === 'function') closeDetailModal();
    } catch (e) { if (window.showToast) showToast('Couldn’t send — try again', 'error'); }
  },
  remove: async function (id) {
    var me = this._myId();
    if (!me || !window.supabase) { if (window.showToast) showToast('Please sign in again', 'error'); return; }
    var person = this._people().find(function (x) { return x.id === id; }) || {};
    if (!window.confirm('Remove ' + (person.name || 'this passport') + ' from your collection?')) return;
    try {
      var res = await window.supabase.rpc('member_connection_remove', { p_me: me, p_other: id });
      if (res.error) throw res.error;
      if (typeof CONNECTIONS !== 'undefined' && Array.isArray(CONNECTIONS)) {
        var i = CONNECTIONS.findIndex(function (x) { return x.id === id; });
        if (i >= 0) CONNECTIONS.splice(i, 1);
      }
      if (window.showToast) showToast('Removed from collection', 'success');
      this.open();
    } catch (e) { if (window.showToast) showToast('Couldn’t remove — try again', 'error'); }
  }
};
window.CollectionView = CollectionView;

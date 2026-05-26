/* ═══════════════════════════════════════════════════════════════════════
   FFP MEET & MOVE LOADER (v1)
   ───────────────────────────────────────────────────────────────────────
   Wires the member-hosted meetups (max 8 people incl. host).

   Reads:
     - meetups (status = 'open')
     - members (for host name, city, etc.) — separate query, no FK to members
     - profile_meta (for host's reliability_score)
     - meetup_attendees (to count joined + flag current user)

   Does NOT yet wire:
     - Member matching algorithm (matches array stays as dashboard sample)
     - Join / leave / host-create flows (separate writes loader)

   Requires:
     1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
     2. assets/ffp-api-integration.js
═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let retries = 0;
  const MAX_RETRIES = 30;

  function injectStyles() {
    if (document.getElementById('ffp-meet-move-loader-styles')) return;
    const s = document.createElement('style');
    s.id = 'ffp-meet-move-loader-styles';
    s.textContent = `
      *::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}
      *{-ms-overflow-style:none !important;scrollbar-width:none !important;}
    `;
    document.head.appendChild(s);
  }

  // ─── Sport → category + icon + default image ─────────────────────────
  const SPORT_MAP = {
    'padel':         { cat: 'racquet',   icon: 'sports_tennis',    img: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=600&q=70' },
    'tennis':        { cat: 'racquet',   icon: 'sports_tennis',    img: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=600&q=70' },
    'squash':        { cat: 'racquet',   icon: 'sports_tennis',    img: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=600&q=70' },
    'pickleball':    { cat: 'racquet',   icon: 'sports_tennis',    img: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=600&q=70' },
    'running':       { cat: 'running',   icon: 'directions_run',   img: 'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=600&q=70' },
    'trail running': { cat: 'running',   icon: 'directions_run',   img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=70' },
    'jogging':       { cat: 'running',   icon: 'directions_run',   img: 'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=600&q=70' },
    'yoga':          { cat: 'mind-body', icon: 'self_improvement', img: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&q=70' },
    'pilates':       { cat: 'mind-body', icon: 'self_improvement', img: 'https://images.unsplash.com/photo-1591291621164-2c6367723315?w=600&q=70' },
    'meditation':    { cat: 'mind-body', icon: 'self_improvement', img: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&q=70' },
    'breathwork':    { cat: 'mind-body', icon: 'self_improvement', img: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&q=70' },
    'hiit':          { cat: 'fitness',   icon: 'fitness_center',   img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&q=70' },
    'crossfit':      { cat: 'fitness',   icon: 'fitness_center',   img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=70' },
    'f45':           { cat: 'fitness',   icon: 'fitness_center',   img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&q=70' },
    'strength':      { cat: 'fitness',   icon: 'fitness_center',   img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=70' },
    'gym':           { cat: 'fitness',   icon: 'fitness_center',   img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=70' },
    'swimming':      { cat: 'swimming',  icon: 'pool',             img: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&q=70' },
    'open water':    { cat: 'swimming',  icon: 'pool',             img: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&q=70' },
    'hiking':        { cat: 'adventure', icon: 'hiking',           img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=70' },
    'bouldering':    { cat: 'adventure', icon: 'hiking',           img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=70' },
    'climbing':      { cat: 'adventure', icon: 'hiking',           img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=70' },
    'cycling':       { cat: 'adventure', icon: 'directions_bike',  img: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=600&q=70' },
    'boxing':        { cat: 'combat',    icon: 'sports_mma',       img: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&q=70' },
    'muay thai':     { cat: 'combat',    icon: 'sports_mma',       img: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&q=70' },
    'mma':           { cat: 'combat',    icon: 'sports_mma',       img: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&q=70' },
    'jiu jitsu':     { cat: 'combat',    icon: 'sports_mma',       img: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&q=70' }
  };
  const DEFAULT_SPORT = { cat: 'fitness', icon: 'fitness_center', img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&q=70' };

  function sportMeta(sport) {
    if (!sport) return DEFAULT_SPORT;
    return SPORT_MAP[String(sport).toLowerCase()] || DEFAULT_SPORT;
  }

  // ─── Date / time helpers ─────────────────────────────────────────────
  const DAY_ABBR   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Format meets_at as "Sat · 5 Apr · 7:00 AM"
  function formatWhen(meetsAt) {
    if (!meetsAt) return '';
    const d = new Date(meetsAt);
    if (isNaN(d.getTime())) return '';
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return DAY_ABBR[d.getDay()] + ' · ' + d.getDate() + ' ' + MONTH_ABBR[d.getMonth()] +
           ' · ' + hours + ':' + minutes + ' ' + ampm;
  }

  // Bucket meetup into when filter slot: this-weekend / this-week / next-week / later
  function whenSlot(meetsAt) {
    if (!meetsAt) return 'later';
    const d = new Date(meetsAt);
    if (isNaN(d.getTime())) return 'later';
    const now = new Date(); now.setHours(0,0,0,0);
    const target = new Date(d); target.setHours(0,0,0,0);
    const daysAway = Math.round((target - now) / (1000 * 60 * 60 * 24));
    if (daysAway < 0) return 'past';
    if (daysAway <= 1) return 'this-week';
    const dow = target.getDay();   // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) {
      if (daysAway <= 7) return 'this-weekend';
      if (daysAway <= 14) return 'next-week';
    }
    if (daysAway <= 7) return 'this-week';
    if (daysAway <= 14) return 'next-week';
    return 'later';
  }

  // Map group_filter to dashboard's gender filter
  function mapGroupFilter(g) {
    if (g === 'open' || !g) return 'any';
    if (g === 'women_only') return 'women';
    if (g === 'men_only')   return 'men';
    if (g === 'mixed')      return 'mixed';
    return 'any';
  }

  // ─── Main loader ─────────────────────────────────────────────────────
  async function loadMeetMoveFromSupabase() {
    if (!window.supabase || typeof MeetMove === 'undefined') {
      if (retries < MAX_RETRIES) {
        retries++;
        setTimeout(loadMeetMoveFromSupabase, 200);
      } else {
        console.error('[FFP Meet & Move Loader] Supabase or MeetMove module not available.');
      }
      return;
    }

    injectStyles();

    try {
      // 1. Fetch open meetups
      const meetupsRes = await window.supabase
        .from('meetups')
        .select('*')
        .eq('status', 'open')
        .order('meets_at', { ascending: true });

      if (meetupsRes.error) {
        console.error('[FFP Meet & Move Loader] Could not load meetups:', {
          code:    meetupsRes.error.code,
          message: meetupsRes.error.message,
          details: meetupsRes.error.details,
          hint:    meetupsRes.error.hint
        });
        console.warn('[FFP Meet & Move Loader] Keeping sample data fallback.');
        return;
      }

      const meetupRows = meetupsRes.data || [];
      if (meetupRows.length === 0) {
        console.log('[FFP Meet & Move Loader] No open meetups in Supabase yet — keeping sample data.');
        return;
      }

      // 2. Fetch host details (members + profile_meta)
      const hostIds = Array.from(new Set(meetupRows.map(function (m) { return m.host_member_id; })));
      const meetupIds = meetupRows.map(function (m) { return m.id; });

      const sessionRes = await window.supabase.auth.getSession();
      const uid = sessionRes.data && sessionRes.data.session ? sessionRes.data.session.user.id : null;

      const [hostsRes, metaRes, attendeesRes] = await Promise.all([
        window.supabase.from('members').select('id, full_name, given_names, surname, city').in('id', hostIds),
        window.supabase.from('profile_meta').select('member_id, reliability_score').in('member_id', hostIds),
        window.supabase.from('meetup_attendees').select('meetup_id, member_id, status').in('meetup_id', meetupIds)
      ]);

      const hostMap = {};
      if (!hostsRes.error && hostsRes.data) {
        hostsRes.data.forEach(function (h) { hostMap[h.id] = h; });
      }
      const metaMap = {};
      if (!metaRes.error && metaRes.data) {
        metaRes.data.forEach(function (m) { metaMap[m.member_id] = m; });
      }

      const joinedCount = {};
      const joinedByMe = {};
      if (!attendeesRes.error && attendeesRes.data) {
        attendeesRes.data.forEach(function (a) {
          if (a.status === 'joined') {
            joinedCount[a.meetup_id] = (joinedCount[a.meetup_id] || 0) + 1;
            if (uid && a.member_id === uid) joinedByMe[a.meetup_id] = true;
          }
        });
      }

      // 3. Build the data array
      const data = meetupRows.map(function (row) {
        const host = hostMap[row.host_member_id] || {};
        const meta = metaMap[row.host_member_id] || {};
        const sm = sportMeta(row.sport);
        const capacity = row.max_people || 0;
        const joined = joinedCount[row.id] || 0;
        const hostName = host.full_name ||
                         ((host.given_names || '') + ' ' + (host.surname || '')).trim() ||
                         'Member';
        const hostInitial = (hostName || '?').charAt(0).toUpperCase();
        const hostTrust = meta.reliability_score !== undefined && meta.reliability_score !== null
          ? parseFloat(meta.reliability_score)
          : 10.0;

        return {
          id:          row.id,
          activity:    row.title || '',
          cat:         sm.cat,
          icon:        sm.icon,
          host:        hostName,
          hostInitial: hostInitial,
          hostTrust:   hostTrust,
          when:        formatWhen(row.meets_at),
          whenSlot:    whenSlot(row.meets_at),
          venue:       row.venue || '',
          area:        row.city || '',
          capacity:    capacity,
          joined:      joined,
          level:       row.fitness_level || '',
          gender:      mapGroupFilter(row.group_filter),
          cost:        '',
          joinedByMe:  joinedByMe[row.id] === true,
          about:       row.description || '',
          img:         sm.img,
          full:        capacity > 0 && joined >= capacity
        };
      });

      // 4. Set hosting Set (meetups where current user is the host)
      const hostingIds = new Set();
      meetupRows.forEach(function (m) {
        if (uid && m.host_member_id === uid) hostingIds.add(m.id);
      });

      MeetMove.data = data;
      MeetMove.hostingIds = hostingIds;

      const panel = document.getElementById('panel-meet');
      if (panel && panel.classList.contains('active') && typeof MeetMove.render === 'function') {
        MeetMove.render();
        if (typeof MeetMove.renderMatchStrip === 'function') MeetMove.renderMatchStrip();
      }

      console.log('[FFP Meet & Move Loader] Loaded ' + meetupRows.length + ' meetups from Supabase ✓');
      console.log('[FFP Meet & Move Loader] Note: member matching strip still shows sample matches — algorithm not yet wired.');

    } catch (err) {
      console.error('[FFP Meet & Move Loader] Unexpected error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(loadMeetMoveFromSupabase, 500);
    });
  } else {
    setTimeout(loadMeetMoveFromSupabase, 500);
  }

  window.ffpReloadMeetMove = loadMeetMoveFromSupabase;
})();

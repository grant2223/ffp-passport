/* FFP Challenges Loader — v2
   Wires Challenges module in ffp-member-dashboard.html to Supabase.
   Reads:  challenges (provider + member types), providers (host lookup for provider type),
           members (host lookup for member type), challenge_entries (leaderboards + joined set)
   v2 adds: member-hosted challenge support (requires host_member_id column on challenges).

   Run this SQL once before this loader works for member challenges:
     ALTER TABLE challenges ADD COLUMN host_member_id uuid REFERENCES auth.users(id);
*/
(function () {
  'use strict';
  var retries = 0;
  var MAX_RETRIES = 30;
  var currentUserId = null;

  function injectStyles() {
    if (document.getElementById('ffp-challenges-loader-styles')) return;
    var s = document.createElement('style');
    s.id = 'ffp-challenges-loader-styles';
    s.textContent =
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}' +
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}';
    document.head.appendChild(s);
  }

  // Category → sport label + Material icon
  var CAT_META = {
    running:    { sport: 'Running',   icon: 'directions_run' },
    fitness:    { sport: 'Fitness',   icon: 'fitness_center' },
    racquet:    { sport: 'Padel',     icon: 'sports_tennis' },
    'mind-body':{ sport: 'Yoga',      icon: 'self_improvement' },
    cycling:    { sport: 'Cycling',   icon: 'directions_bike' },
    swimming:   { sport: 'Swimming',  icon: 'pool' },
    combat:     { sport: 'Combat',    icon: 'sports_mma' },
    team:       { sport: 'Team',      icon: 'groups' },
    wellness:   { sport: 'Wellness',  icon: 'spa' },
    outdoor:    { sport: 'Outdoor',   icon: 'hiking' }
  };
  function metaForCat(cat) { return CAT_META[cat] || { sport: cat || 'Sport', icon: 'sports' }; }

  var MONTHS_UPPER = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var MONTHS_TITLE = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function buildDateBadge(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    return { top: MONTHS_UPPER[d.getMonth()], mid: String(d.getDate()), bot: String(d.getFullYear()) };
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getDate() + ' ' + MONTHS_TITLE[d.getMonth()] + ' ' + d.getFullYear();
  }
  function fmtDateShort(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getDate() + ' ' + MONTHS_TITLE[d.getMonth()];
  }
  function computeDaysLeft(iso) {
    if (!iso) return 0;
    var end = new Date(iso); end.setHours(0, 0, 0, 0);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((end - today) / 86400000));
  }

  // db status → dashboard status
  function mapStatus(s) {
    if (s === 'live') return 'active';
    if (s === 'closed' || s === 'past') return 'past';
    return s || 'active';
  }

  // metric text heuristic: time-based goes ascending (lowest wins), counts go descending
  function sortDirForMetric(metric) {
    if (!metric) return 'desc';
    var m = metric.toLowerCase();
    if (m.indexOf('time') !== -1 || m.indexOf('fastest') !== -1 || m.indexOf('quickest') !== -1) return 'asc';
    return 'desc';
  }

  // Format a numeric score for display when there's no score_text
  function formatScore(num, metric) {
    if (num == null) return '';
    if (sortDirForMetric(metric) === 'asc') {
      // time in seconds → mm:ss or h:mm:ss
      var sec = Math.round(num);
      var h = Math.floor(sec / 3600);
      var m = Math.floor((sec % 3600) / 60);
      var s = sec % 60;
      if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      return m + ':' + String(s).padStart(2, '0');
    }
    return String(num);
  }

  function memberDisplayName(m) {
    if (!m) return 'Member';
    if (m.given_names) {
      var initial = m.surname ? ' ' + m.surname.charAt(0).toUpperCase() + '.' : '';
      return m.given_names + initial;
    }
    if (m.full_name) return m.full_name;
    return 'Member';
  }
  function memberLetter(m) {
    if (!m) return 'M';
    var src = m.given_names || m.full_name || 'M';
    return src.charAt(0).toUpperCase();
  }

  async function loadFromSupabase() {
    if (!window.supabase || typeof Challenges === 'undefined') {
      if (retries < MAX_RETRIES) { retries++; setTimeout(loadFromSupabase, 200); }
      return;
    }
    injectStyles();

    try {
      var userRes = await window.supabase.auth.getUser();
      if (userRes.error || !userRes.data || !userRes.data.user) {
        console.log('[FFP Challenges] No user — keeping sample');
        return;
      }
      currentUserId = userRes.data.user.id;

      // 1. Load all live challenges (both kinds)
      var chRes = await window.supabase
        .from('challenges')
        .select('*')
        .in('status', ['live', 'closed', 'past']);

      if (chRes.error) {
        console.error('[FFP Challenges] challenges read:', chRes.error);
        return;
      }
      var challenges = chRes.data || [];
      if (challenges.length === 0) {
        console.log('[FFP Challenges] No challenges — keeping sample');
        return;
      }

      // 2. Lookup providers for provider-hosted
      var providerIds = challenges
        .filter(function (c) { return c.challenge_type === 'provider' && c.provider_id; })
        .map(function (c) { return c.provider_id; });
      providerIds = Array.from(new Set(providerIds));
      var providerMap = {};
      if (providerIds.length > 0) {
        var provRes = await window.supabase
          .from('providers')
          .select('id, business_name, letter_mark, logo_url, status')
          .in('id', providerIds);
        if (provRes.error) console.error('[FFP Challenges] providers read:', provRes.error);
        (provRes.data || []).forEach(function (p) { providerMap[p.id] = p; });
      }

      // 3. Lookup host members for member-hosted
      var hostIds = challenges
        .filter(function (c) { return c.challenge_type === 'member' && c.host_member_id; })
        .map(function (c) { return c.host_member_id; });
      hostIds = Array.from(new Set(hostIds));
      var hostMap = {};
      if (hostIds.length > 0) {
        var hostRes = await window.supabase
          .from('members')
          .select('id, full_name, given_names, surname')
          .in('id', hostIds);
        if (hostRes.error) console.error('[FFP Challenges] hosts read:', hostRes.error);
        (hostRes.data || []).forEach(function (m) { hostMap[m.id] = m; });
      }

      // 4. Load all entries for these challenges
      var challengeIds = challenges.map(function (c) { return c.id; });
      var entriesByChallenge = {};
      challengeIds.forEach(function (id) { entriesByChallenge[id] = []; });

      var entRes = await window.supabase
        .from('challenge_entries')
        .select('id, challenge_id, member_id, score, score_text, verified, submitted_at')
        .in('challenge_id', challengeIds);
      if (entRes.error) console.error('[FFP Challenges] entries read:', entRes.error);
      var allEntries = entRes.data || [];

      // 5. Lookup all member names for the entries
      var entryMemberIds = Array.from(new Set(allEntries.map(function (e) { return e.member_id; })));
      var entryMemberMap = {};
      if (entryMemberIds.length > 0) {
        var memRes = await window.supabase
          .from('members')
          .select('id, full_name, given_names, surname')
          .in('id', entryMemberIds);
        if (memRes.error) console.error('[FFP Challenges] entry members read:', memRes.error);
        (memRes.data || []).forEach(function (m) { entryMemberMap[m.id] = m; });
      }

      // 6. Bucket entries by challenge
      allEntries.forEach(function (e) {
        if (!entriesByChallenge[e.challenge_id]) entriesByChallenge[e.challenge_id] = [];
        entriesByChallenge[e.challenge_id].push(e);
      });

      // 7. Build the dashboard data array + joined set
      var joined = new Set();
      var data = challenges.map(function (c) {
        var isProvider = c.challenge_type === 'provider';
        var meta = metaForCat(c.category);

        var organizer, organizerLetter, organizerVerified, organizerType;
        if (isProvider) {
          var p = providerMap[c.provider_id] || {};
          organizer = p.business_name || 'Provider';
          organizerLetter = (p.letter_mark || (p.business_name ? p.business_name.charAt(0) : 'P')).toUpperCase();
          organizerVerified = p.status === 'approved';
          organizerType = 'provider';
        } else {
          var h = hostMap[c.host_member_id] || null;
          organizer = memberDisplayName(h);
          organizerLetter = memberLetter(h);
          organizerVerified = false;
          organizerType = 'member';
        }

        // Sort entries → leaderboard
        var entries = (entriesByChallenge[c.id] || []).slice();
        var dir = sortDirForMetric(c.metric);
        entries.sort(function (a, b) {
          var av = Number(a.score) || 0;
          var bv = Number(b.score) || 0;
          return dir === 'asc' ? av - bv : bv - av;
        });

        var leaderboard = entries.map(function (e, i) {
          var m = entryMemberMap[e.member_id];
          var scoreDisplay = e.score_text || formatScore(e.score, c.metric);
          if (e.member_id === currentUserId) joined.add(c.id);
          return {
            rank: i + 1,
            name: memberDisplayName(m),
            letter: memberLetter(m),
            score: scoreDisplay,
            verified: !!e.verified,
            submitted: fmtDateShort(e.submitted_at),
            isMe: e.member_id === currentUserId
          };
        });

        return {
          id: c.id,
          kind: isProvider ? 'provider' : 'member',
          img: c.hero_image_url || '',
          title: c.title || '',
          desc: c.description || '',
          rules: c.description || '',  // no separate rules column in schema; reuse description
          organizer: organizer,
          organizerLetter: organizerLetter,
          organizerVerified: organizerVerified,
          organizerType: organizerType,
          cat: c.category || '',
          sport: meta.sport,
          icon: meta.icon,
          metric: c.metric || '',
          venue: c.venue || '',
          city: c.city || '',
          startDate: fmtDate(c.starts_at),
          endDate: fmtDate(c.ends_at),
          dateBadge: buildDateBadge(c.ends_at) || { top: '', mid: '', bot: '' },
          daysLeft: computeDaysLeft(c.ends_at),
          status: mapStatus(c.status),
          prize: c.prize_description || '',
          participants: leaderboard.length,
          leaderboard: leaderboard
        };
      });

      Challenges.data = data;
      Challenges.joined = joined;

      // 8. Re-render if Challenges panel is visible
      var panel = document.getElementById('panel-challenges');
      if (panel && panel.classList.contains('active') && typeof Challenges.render === 'function') {
        Challenges.render();
      }

      var provCount = data.filter(function (c) { return c.kind === 'provider'; }).length;
      var memCount  = data.filter(function (c) { return c.kind === 'member'; }).length;
      console.log('[FFP Challenges] Loaded ' + data.length + ' challenges (' + provCount + ' provider, ' + memCount + ' member) ✓');
    } catch (err) {
      console.error('[FFP Challenges] Unexpected error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(loadFromSupabase, 400); });
  } else {
    setTimeout(loadFromSupabase, 400);
  }
  window.ffpReloadChallenges = loadFromSupabase;
})();

/* FFP Fitness Stats Loader — v4
   v4 adds: REAL community percentile rankings against the full member base.
   - Loads ranking pool via get_ranking_pool() RPC (privacy-safe view)
   - Computes "Top X%" per PR for the selected comparison group
   - Recomputes whenever the comparison dropdown changes
   - Expanded comparison options: gender / age / country / city / nationality / combos

   Prerequisites:
     ALTER TABLE challenges    ADD COLUMN IF NOT EXISTS host_member_id uuid REFERENCES auth.users(id);
     ALTER TABLE profile_meta  ADD COLUMN IF NOT EXISTS pr_dates jsonb DEFAULT '{}'::jsonb;
     CREATE OR REPLACE FUNCTION public.get_ranking_pool() ... (see message)
*/
(function () {
  'use strict';
  var retries = 0;
  var MAX_RETRIES = 30;
  var currentUserId = null;
  var wrapped = false;
  var activityCache = [];
  var rankingPool = [];    // all rows from get_ranking_pool()
  var myDemo = null;       // current user's demographic snapshot

  function injectStyles() {
    if (document.getElementById('ffp-fitness-stats-loader-styles')) return;
    var s = document.createElement('style');
    s.id = 'ffp-fitness-stats-loader-styles';
    s.textContent =
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}' +
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}';
    document.head.appendChild(s);
  }

  // Dashboard PR key → profile_meta column + sort direction (higher = better, or lower = better)
  var PR_MAP = {
    bench1RM:    { col: 'pr_bench_kg',     cast: 'float', dir: 'higher' },
    squat1RM:    { col: 'pr_squat_kg',     cast: 'float', dir: 'higher' },
    deadlift1RM: { col: 'pr_deadlift_kg',  cast: 'float', dir: 'higher' },
    run5K:       { col: 'pr_5k_seconds',   cast: 'int',   dir: 'lower'  },
    run10K:      { col: 'pr_10k_seconds',  cast: 'int',   dir: 'lower'  },
    run21K:      { col: 'pr_21k_seconds',  cast: 'int',   dir: 'lower'  },
    runMara:     { col: 'pr_marathon_sec', cast: 'int',   dir: 'lower'  },
    swim1K:      { col: 'pr_swim1k_sec',   cast: 'int',   dir: 'lower'  },
    vo2max:      { col: 'vo2_max',         cast: 'float', dir: 'higher' },
    bodyFat:     { col: 'body_fat_pct',    cast: 'float', dir: 'lower'  },
    visceralFat: { col: 'visceral_fat',    cast: 'float', dir: 'lower'  }
  };

  function computeAgeFromDob(dobStr) {
    if (!dobStr) return null;
    var dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return null;
    var now = new Date();
    var age = now.getFullYear() - dob.getFullYear();
    var m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  }
  function ageBucketRange(age) {
    if (age == null) return null;
    if (age < 20) return [0, 19];
    if (age < 30) return [20, 29];
    if (age < 40) return [30, 39];
    if (age < 50) return [40, 49];
    if (age < 60) return [50, 59];
    if (age < 70) return [60, 69];
    return [70, 200];
  }
  function ageBucketLabel(age) {
    var r = ageBucketRange(age);
    if (!r) return '?';
    if (r[1] >= 200) return r[0] + '+';
    return r[0] + '\u2013' + r[1];
  }

  function localDateStr(date) {
    var y = date.getFullYear();
    var mo = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + d;
  }
  function todayStr() { return localDateStr(new Date()); }
  function dateStrFromDaysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return localDateStr(d); }
  function daysAgoFromDateStr(s) {
    var d = new Date(s + 'T00:00:00');
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((t - d) / 86400000);
  }
  function daysAgoFromIso(iso) {
    if (!iso) return 0;
    var d = new Date(iso); d.setHours(0, 0, 0, 0);
    var t = new Date();   t.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((t - d) / 86400000));
  }
  function sleepFromDb(dbObj) {
    var out = {};
    if (!dbObj || typeof dbObj !== 'object') return out;
    Object.keys(dbObj).forEach(function (k) {
      var hrs = Number(dbObj[k]);
      if (isNaN(hrs)) return;
      var d = daysAgoFromDateStr(k);
      if (d >= 1 && d <= 30) out[d] = hrs;
    });
    return out;
  }
  function sleepToDb(dashObj) {
    var out = {};
    if (!dashObj || typeof dashObj !== 'object') return out;
    Object.keys(dashObj).forEach(function (k) {
      var n = Number(k), hrs = Number(dashObj[k]);
      if (isNaN(n) || isNaN(hrs)) return;
      out[dateStrFromDaysAgo(n)] = hrs;
    });
    return out;
  }

  // ─────────── COMPARISON GROUP FILTERING ───────────

  function filterPoolForGroup(group) {
    if (!myDemo) return [];
    var myAgeR = ageBucketRange(myDemo.age);
    return rankingPool.filter(function (r) {
      if (r.member_id === currentUserId) return false;  // exclude self
      switch (group) {
        case 'all':
          return true;
        case 'gender':
          return r.gender && r.gender === myDemo.gender;
        case 'age':
          if (!myAgeR || r.age == null) return false;
          return r.age >= myAgeR[0] && r.age <= myAgeR[1];
        case 'age_gender':
          if (!myAgeR || r.age == null || !r.gender) return false;
          return r.age >= myAgeR[0] && r.age <= myAgeR[1] && r.gender === myDemo.gender;
        case 'country':
          return r.country && r.country === myDemo.country;
        case 'city':
          return r.city && r.city === myDemo.city;
        case 'nationality':
          return r.nationality && r.nationality === myDemo.nationality;
        case 'age_gender_city':
          if (!myAgeR || r.age == null || !r.gender || !r.city) return false;
          return r.age >= myAgeR[0] && r.age <= myAgeR[1] &&
                 r.gender === myDemo.gender && r.city === myDemo.city;
        case 'age_gender_country':
          if (!myAgeR || r.age == null || !r.gender || !r.country) return false;
          return r.age >= myAgeR[0] && r.age <= myAgeR[1] &&
                 r.gender === myDemo.gender && r.country === myDemo.country;
        case 'age_gender_nationality':
          if (!myAgeR || r.age == null || !r.gender || !r.nationality) return false;
          return r.age >= myAgeR[0] && r.age <= myAgeR[1] &&
                 r.gender === myDemo.gender && r.nationality === myDemo.nationality;
        default:
          return true;
      }
    });
  }

  function computeTopPercent(myValue, direction, others, col) {
    if (myValue == null) return null;
    var rows = others.filter(function (r) { return r[col] != null; });
    if (rows.length === 0) return null;
    var beat = 0;
    rows.forEach(function (r) {
      if (direction === 'higher' && myValue > r[col]) beat++;
      else if (direction === 'lower' && myValue < r[col]) beat++;
    });
    var total = rows.length + 1;       // include myself
    var rank  = total - beat;          // 1 = best
    return Math.max(1, Math.min(100, Math.round((rank / total) * 100)));
  }

  function refreshRanks() {
    if (!myDemo || rankingPool.length === 0) {
      FitnessStats.ranks = {};
      return;
    }
    var group = FitnessStats.compareGroup || 'age_gender';
    var others = filterPoolForGroup(group);
    var ranks = {};
    Object.keys(PR_MAP).forEach(function (key) {
      var rec = FitnessStats.records ? FitnessStats.records[key] : null;
      if (!rec) { ranks[key] = null; return; }
      var map = PR_MAP[key];
      // Need at least 4 others to show a meaningful percentile
      if (others.filter(function (r) { return r[map.col] != null; }).length < 4) {
        ranks[key] = null;
        return;
      }
      ranks[key] = computeTopPercent(rec.value, map.dir, others, map.col);
    });
    FitnessStats.ranks = ranks;
  }

  function buildCompareOptions() {
    var sel = document.getElementById('fs-compare-select');
    if (!sel || !myDemo) return;

    var ageLabel = myDemo.age != null ? ageBucketLabel(myDemo.age) : null;
    var opts = [
      { v: 'all',                     label: 'All FFP members' },
      { v: 'gender',                  label: 'Same gender' },
      { v: 'age',                     label: ageLabel ? 'Your age group (' + ageLabel + ')' : 'Your age group' },
      { v: 'age_gender',              label: 'Same age & gender' },
      { v: 'country',                 label: myDemo.country ? 'Same country (' + myDemo.country + ')' : 'Same country' },
      { v: 'city',                    label: myDemo.city ? 'Same city (' + myDemo.city + ')' : 'Same city' },
      { v: 'nationality',             label: myDemo.nationality ? 'Same nationality (' + myDemo.nationality + ')' : 'Same nationality' },
      { v: 'age_gender_city',         label: 'Same age, gender & city' },
      { v: 'age_gender_country',      label: 'Same age, gender & country' },
      { v: 'age_gender_nationality',  label: 'Same age, gender & nationality' }
    ];

    var current = FitnessStats.compareGroup || 'age_gender';
    sel.innerHTML = opts.map(function (o) {
      var selAttr = o.v === current ? ' selected' : '';
      return '<option value="' + o.v + '"' + selAttr + '>' + o.label + '</option>';
    }).join('');
  }

  // ─────────── ACTIVITY OVERRIDES (from v3) ───────────

  function overrideComputeStreak() {
    FitnessStats.computeStreak = function () {
      var daysWithActivity = new Set(activityCache.map(function (l) { return l.daysAgo; }));
      var current = 0;
      for (var d = 0; d < 365; d++) {
        if (daysWithActivity.has(d)) current++;
        else break;
      }
      var sorted = Array.from(daysWithActivity).sort(function (a, b) { return a - b; });
      var best = 0, run = 0;
      for (var i = 0; i < sorted.length; i++) {
        if (i === 0 || sorted[i] === sorted[i - 1] + 1) run++;
        else run = 1;
        if (run > best) best = run;
      }
      return { current: current, best: best, daysWithActivity: daysWithActivity };
    };
  }

  function overrideRenderActivity() {
    FitnessStats.renderActivity = function () {
      var streak = this.computeStreak();
      var curEl  = document.getElementById('streak-current');
      var bestEl = document.getElementById('streak-best');
      if (curEl)  curEl.textContent  = streak.current;
      if (bestEl) bestEl.textContent = streak.best;
      var dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var today = new Date();
      var flamesHtml = '';
      for (var d = 6; d >= 0; d--) {
        var active  = streak.daysWithActivity.has(d);
        var isToday = d === 0;
        var dDate   = new Date(today.getTime() - d * 86400000);
        var label   = isToday ? 'Today' : dayShort[dDate.getDay()];
        var cls = 'streak-day';
        if (active)  cls += ' active';
        if (isToday) cls += ' today';
        flamesHtml += '<div class="' + cls + '">' +
          '<span class="streak-day-flame"></span>' +
          '<span class="streak-day-label">' + label + '</span>' +
        '</div>';
      }
      var dotsEl = document.getElementById('streak-dots');
      if (dotsEl) dotsEl.innerHTML = flamesHtml;
      var todayActive = streak.daysWithActivity.has(0);
      var metaEl = document.getElementById('streak-meta');
      if (metaEl) {
        metaEl.classList.remove('warn','celebrate');
        var metaText;
        if (streak.current === 0)             metaText = 'Log an activity today to start your streak';
        else if (!todayActive)                { metaText = 'Log today to keep your ' + streak.current + '-day streak alive'; metaEl.classList.add('warn'); }
        else if (streak.current >= streak.best && streak.best > 1) { metaText = "You're at your all-time best \u2014 don't stop now"; metaEl.classList.add('celebrate'); }
        else if (streak.best > streak.current) { var diff = streak.best - streak.current; metaText = diff + ' more day' + (diff === 1 ? '' : 's') + ' to match your best'; }
        else                                  metaText = 'Keep the chain alive';
        metaEl.textContent = metaText;
      }
      var last30 = activityCache.filter(function (l) { return l.daysAgo <= 30; });
      var totalCount  = last30.length;
      var totalMin    = last30.reduce(function (s, l) { return s + (l.duration_min || 0); }, 0);
      var totalHours  = Math.round(totalMin / 60);
      var activeDays  = new Set(last30.map(function (l) { return l.daysAgo; })).size;
      var sportsCount = new Set(last30.map(function (l) { return l.activity; })).size;
      var tiles = [
        { icon: 'fitness_center', value: totalCount,       label: 'Activities' },
        { icon: 'schedule',       value: totalHours + 'h', label: 'Hours' },
        { icon: 'calendar_today', value: activeDays,       label: 'Active days' },
        { icon: 'sports',         value: sportsCount,      label: 'Sports' }
      ];
      var tilesEl = document.getElementById('stats-tiles');
      if (tilesEl) {
        tilesEl.innerHTML = tiles.map(function (t) {
          return '<div class="stats-tile">' +
            '<div class="stats-tile-icon"><span class="material-icons">' + t.icon + '</span></div>' +
            '<div class="stats-tile-value">' + t.value + '</div>' +
            '<div class="stats-tile-label">' + t.label + '</div>' +
          '</div>';
        }).join('');
      }
    };
  }

  function overrideRenderMilestones() {
    FitnessStats.renderMilestones = function () {
      var logs = activityCache;
      var r = this.records;
      var p = this.profile;
      var dlRatio = (r.deadlift1RM && p.weight) ? r.deadlift1RM.value / p.weight : 0;
      var sportCount = new Set(logs.map(function (l) { return l.activity; })).size;
      var bfHealthyMax = p.gender === 'male' ? 18 : 25;
      var sleepRec = this.getRecord('sleepAvgHrs');
      var sleepGood = sleepRec && sleepRec.value >= 7 && sleepRec.value <= 9 ? 1 : 0;
      var currentStreak = this.computeStreak().current;
      var milestones = [
        { name: '10 Activities',   desc: 'Log 10 activities',           icon: 'flag',           current: logs.length, target: 10 },
        { name: '5 Sport Types',   desc: 'Try 5 different sports',      icon: 'sports',         current: sportCount,  target: 5  },
        { name: 'On a Roll',       desc: '14-day activity streak',      icon: 'local_fire_department', current: currentStreak, target: 14 },
        { name: 'Strong as an Ox', desc: 'Deadlift 2\u00d7 bodyweight', icon: 'fitness_center', current: dlRatio,     target: 2, decimals: 2, unit: '\u00d7' },
        { name: 'Half Marathoner', desc: 'Log a 21K PR',                icon: 'directions_run', current: r.run21K  ? 1 : 0, target: 1, binary: true },
        { name: 'Marathon Club',   desc: 'Log a Marathon PR',           icon: 'emoji_events',   current: r.runMara ? 1 : 0, target: 1, binary: true },
        { name: 'VO\u2082 Elite',  desc: 'VO\u2082 max above 50',       icon: 'favorite',       current: r.vo2max ? r.vo2max.value : 0, target: 50, decimals: 1 },
        { name: 'Healthy Heart',   desc: 'Body fat under ' + bfHealthyMax + '%', icon: 'monitor_weight', current: r.bodyFat && r.bodyFat.value <= bfHealthyMax ? 1 : 0, target: 1, binary: true },
        { name: 'Well-Rested',     desc: 'Sleep avg 7\u20139 hrs',      icon: 'bedtime',        current: sleepGood,   target: 1, binary: true }
      ];
      var gridEl = document.getElementById('achievements-grid');
      if (gridEl) {
        gridEl.innerHTML = milestones.map(function (m) {
          var unlocked = m.current >= m.target;
          var pct = Math.min(100, Math.max(0, (m.current / m.target) * 100));
          var progressText;
          if (m.binary)        progressText = unlocked ? 'Unlocked' : 'Not yet';
          else if (m.decimals) progressText = (+m.current).toFixed(m.decimals) + (m.unit || '') + ' / ' + m.target + (m.unit || '');
          else                 progressText = m.current + ' / ' + m.target;
          var esc = (typeof escHtml === 'function') ? escHtml : function (x) { return x; };
          return '<div class="achievement ' + (unlocked ? 'unlocked' : 'locked') + '">' +
            '<div class="achievement-icon"><span class="material-icons">' + m.icon + '</span></div>' +
            '<div class="achievement-name">' + esc(m.name) + '</div>' +
            '<div class="achievement-desc">' + esc(m.desc) + '</div>' +
            '<div class="achievement-count">' + progressText + '</div>' +
            '<div class="achievement-progress"><div class="achievement-progress-fill" style="width:' + pct + '%;"></div></div>' +
          '</div>';
        }).join('');
      }
      var unlockedCount = milestones.filter(function (m) { return m.current >= m.target; }).length;
      var countEl = document.getElementById('ms-unlocked-count');
      if (countEl) countEl.textContent = unlockedCount + ' of ' + milestones.length + ' unlocked';
    };
  }

  // Wrap render so ranks are recomputed before every paint (catches compareGroup changes)
  function overrideRender() {
    var origRender = FitnessStats.render.bind(FitnessStats);
    FitnessStats.render = function () {
      refreshRanks();
      origRender();
    };
  }

  // ─────────── LOAD ───────────

  async function loadFromSupabase() {
    if (!window.supabase || typeof FitnessStats === 'undefined') {
      if (retries < MAX_RETRIES) { retries++; setTimeout(loadFromSupabase, 200); }
      return;
    }
    injectStyles();

    try {
      var userRes = await window.supabase.auth.getUser();
      if (userRes.error || !userRes.data || !userRes.data.user) {
        console.log('[FFP Fitness Stats] No user — keeping sample');
        return;
      }
      currentUserId = userRes.data.user.id;

      var memRes = await window.supabase
        .from('members')
        .select('date_of_birth, gender, city, country, nationality')
        .eq('id', currentUserId)
        .maybeSingle();

      if (!memRes.error && memRes.data) {
        var ageFromDob = computeAgeFromDob(memRes.data.date_of_birth);
        if (ageFromDob != null) FitnessStats.profile.chronAge = ageFromDob;
        if (memRes.data.gender) FitnessStats.profile.gender = memRes.data.gender;
        if (memRes.data.city)   FitnessStats.profile.city   = memRes.data.city;
        myDemo = {
          gender: memRes.data.gender || null,
          age: ageFromDob,
          city: memRes.data.city || null,
          country: memRes.data.country || null,
          nationality: memRes.data.nationality || null
        };
      }

      var pm = await window.supabase
        .from('profile_meta')
        .select('chrono_age, current_weight_kg, sleep_logs, pr_dates, ' +
                'pr_bench_kg, pr_squat_kg, pr_deadlift_kg, ' +
                'pr_5k_seconds, pr_10k_seconds, pr_21k_seconds, pr_marathon_sec, pr_swim1k_sec, ' +
                'vo2_max, body_fat_pct, visceral_fat')
        .eq('member_id', currentUserId)
        .maybeSingle();

      if (pm.error) {
        console.error('[FFP Fitness Stats] profile_meta read:', pm.error);
      } else if (pm.data) {
        var p = pm.data;
        if (p.chrono_age != null) FitnessStats.profile.chronAge = Number(p.chrono_age);
        if (p.current_weight_kg != null) FitnessStats.profile.weight = Number(p.current_weight_kg);
        var prDates = (p.pr_dates && typeof p.pr_dates === 'object') ? p.pr_dates : {};
        var rec = {};
        Object.keys(PR_MAP).forEach(function (key) {
          var col = PR_MAP[key].col;
          if (p[col] == null) { rec[key] = null; return; }
          rec[key] = { value: Number(p[col]), date: prDates[key] || null };
        });
        FitnessStats.records = rec;
        FitnessStats.sleepLogs = sleepFromDb(p.sleep_logs);
      }

      // Activity cache for streak/tiles/milestones
      var sinceIso = new Date(Date.now() - 90 * 86400000).toISOString();
      var actRes = await window.supabase
        .from('activity_logs')
        .select('activity, duration_min, logged_at')
        .eq('member_id', currentUserId)
        .gte('logged_at', sinceIso);
      if (actRes.error) {
        console.error('[FFP Fitness Stats] activity_logs read:', actRes.error);
        activityCache = [];
      } else {
        activityCache = (actRes.data || []).map(function (r) {
          return {
            activity: r.activity || '',
            duration_min: r.duration_min || 0,
            daysAgo: daysAgoFromIso(r.logged_at)
          };
        });
      }

      // RANKING POOL — privacy-safe RPC
      var poolRes = await window.supabase.rpc('get_ranking_pool');
      if (poolRes.error) {
        console.error('[FFP Fitness Stats] ranking_pool RPC:', poolRes.error);
        rankingPool = [];
      } else {
        rankingPool = poolRes.data || [];
      }

      overrideComputeStreak();
      overrideRenderActivity();
      overrideRenderMilestones();
      overrideRender();
      buildCompareOptions();
      wrapWrites();

      var panel = document.getElementById('panel-fitness-stats');
      if (panel && panel.classList.contains('active') && typeof FitnessStats.render === 'function') {
        FitnessStats.render();
      }

      console.log('[FFP Fitness Stats] Loaded from Supabase ✓ (' + activityCache.length + ' activities, ' + rankingPool.length + ' members in ranking pool)');
    } catch (err) {
      console.error('[FFP Fitness Stats] Unexpected error:', err);
    }
  }

  function wrapWrites() {
    if (wrapped) return;
    wrapped = true;

    var origSavePr = FitnessStats.savePr.bind(FitnessStats);
    FitnessStats.savePr = async function () {
      var key = this._editKey;
      origSavePr();
      if (!key || !currentUserId) return;
      var map = PR_MAP[key];
      if (!map) return;
      var rec = this.records[key];
      if (!rec) return;
      var val = map.cast === 'int' ? Math.round(rec.value) : Number(rec.value);
      try {
        var readRes = await window.supabase
          .from('profile_meta').select('pr_dates')
          .eq('member_id', currentUserId).maybeSingle();
        var prDates = (readRes.data && readRes.data.pr_dates && typeof readRes.data.pr_dates === 'object')
          ? readRes.data.pr_dates : {};
        prDates[key] = rec.date || todayStr();
        var payload = { member_id: currentUserId, pr_dates: prDates, updated_at: new Date().toISOString() };
        payload[map.col] = val;
        var res = await window.supabase.from('profile_meta').upsert(payload, { onConflict: 'member_id' });
        if (res.error) console.error('[FFP FS] pr save:', res.error);
        // Refresh ranking pool snapshot of self so the rank reflects new value
        for (var i = 0; i < rankingPool.length; i++) {
          if (rankingPool[i].member_id === currentUserId) { rankingPool[i][map.col] = val; break; }
        }
      } catch (e) { console.error('[FFP FS] pr save:', e); }
    };

    var origClearPr = FitnessStats.clearPr.bind(FitnessStats);
    FitnessStats.clearPr = async function () {
      var key = this._editKey;
      origClearPr();
      if (!key || !currentUserId) return;
      if (this.records[key] != null) return;
      var map = PR_MAP[key];
      if (!map) return;
      try {
        var readRes = await window.supabase
          .from('profile_meta').select('pr_dates')
          .eq('member_id', currentUserId).maybeSingle();
        var prDates = (readRes.data && readRes.data.pr_dates && typeof readRes.data.pr_dates === 'object')
          ? readRes.data.pr_dates : {};
        delete prDates[key];
        var payload = { member_id: currentUserId, pr_dates: prDates, updated_at: new Date().toISOString() };
        payload[map.col] = null;
        var res = await window.supabase.from('profile_meta').upsert(payload, { onConflict: 'member_id' });
        if (res.error) console.error('[FFP FS] pr clear:', res.error);
        for (var i = 0; i < rankingPool.length; i++) {
          if (rankingPool[i].member_id === currentUserId) { rankingPool[i][map.col] = null; break; }
        }
      } catch (e) { console.error('[FFP FS] pr clear:', e); }
    };

    var origSaveSleepLog = FitnessStats.saveSleepLog.bind(FitnessStats);
    FitnessStats.saveSleepLog = async function () {
      origSaveSleepLog();
      if (!currentUserId) return;
      var dbShape = sleepToDb(this.sleepLogs);
      try {
        var res = await window.supabase.from('profile_meta').upsert({
          member_id: currentUserId,
          sleep_logs: dbShape,
          updated_at: new Date().toISOString()
        }, { onConflict: 'member_id' });
        if (res.error) console.error('[FFP FS] sleep save:', res.error);
      } catch (e) { console.error('[FFP FS] sleep save:', e); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(loadFromSupabase, 400); });
  } else {
    setTimeout(loadFromSupabase, 400);
  }
  window.ffpReloadFitnessStats = loadFromSupabase;
})();

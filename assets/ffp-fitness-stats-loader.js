/* FFP Fitness Stats Loader — v2
   Wires FitnessStats module in ffp-member-dashboard.html to Supabase.
   Reads:  profile_meta (PRs, vo2_max, body_fat_pct, visceral_fat, sleep_logs, chrono_age, weight)
           members (date_of_birth, gender, city)
           activity_logs (last 90 days — for real streak, tiles, milestones)
   Writes: savePr, clearPr, saveSleepLog
   v2 changes:
   - Activity tab streak now from real activity_logs (not sample LOGS)
   - 30-day tiles use real activity counts + real summed duration_min hours
   - Milestones activity-based counters use real data
   - Multi-City milestone dropped (no city data in activity_logs) → replaced with "On a Roll" 14-day streak
   - Fake "Top X%" community rank pills hidden (no real ranking yet)
   Known v2 limitations:
   - PR dates still not persisted (needs schema: pr_dates jsonb on profile_meta)
   - No real community percentile ranks yet (needs aggregate stats view)
*/
(function () {
  'use strict';
  var retries = 0;
  var MAX_RETRIES = 30;
  var currentUserId = null;
  var wrapped = false;
  var activityCache = [];  // last 90 days of activity_logs, mapped

  function injectStyles() {
    if (document.getElementById('ffp-fitness-stats-loader-styles')) return;
    var s = document.createElement('style');
    s.id = 'ffp-fitness-stats-loader-styles';
    s.textContent =
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}' +
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}';
    document.head.appendChild(s);
  }

  // Dashboard PR key → profile_meta column + numeric type
  var PR_MAP = {
    bench1RM:    { col: 'pr_bench_kg',    cast: 'float' },
    squat1RM:    { col: 'pr_squat_kg',    cast: 'float' },
    deadlift1RM: { col: 'pr_deadlift_kg', cast: 'float' },
    run5K:       { col: 'pr_5k_seconds',  cast: 'int' },
    run10K:      { col: 'pr_10k_seconds', cast: 'int' },
    run21K:      { col: 'pr_21k_seconds', cast: 'int' },
    runMara:     { col: 'pr_marathon_sec', cast: 'int' },
    swim1K:      { col: 'pr_swim1k_sec',  cast: 'int' },
    vo2max:      { col: 'vo2_max',        cast: 'float' },
    bodyFat:     { col: 'body_fat_pct',   cast: 'float' },
    visceralFat: { col: 'visceral_fat',   cast: 'float' }
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

  function localDateStr(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  function todayStr() { return localDateStr(new Date()); }
  function dateStrFromDaysAgo(n) {
    var d = new Date(); d.setDate(d.getDate() - n);
    return localDateStr(d);
  }
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

  // sleep_logs jsonb: { "YYYY-MM-DD": hours, ... } ↔ dashboard sleepLogs: { daysAgo: hours, ... }
  function sleepFromDb(dbObj) {
    var out = {};
    if (!dbObj || typeof dbObj !== 'object') return out;
    Object.keys(dbObj).forEach(function (dateKey) {
      var hrs = Number(dbObj[dateKey]);
      if (isNaN(hrs)) return;
      var d = daysAgoFromDateStr(dateKey);
      if (d >= 1 && d <= 30) out[d] = hrs;
    });
    return out;
  }
  function sleepToDb(dashObj) {
    var out = {};
    if (!dashObj || typeof dashObj !== 'object') return out;
    Object.keys(dashObj).forEach(function (k) {
      var n = Number(k);
      var hrs = Number(dashObj[k]);
      if (isNaN(n) || isNaN(hrs)) return;
      out[dateStrFromDaysAgo(n)] = hrs;
    });
    return out;
  }

  // ─────────── REAL ACTIVITY OVERRIDES ───────────

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
      // Streak card
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

      // Meta line
      var todayActive = streak.daysWithActivity.has(0);
      var metaEl = document.getElementById('streak-meta');
      if (metaEl) {
        metaEl.classList.remove('warn','celebrate');
        var metaText;
        if (streak.current === 0) {
          metaText = 'Log an activity today to start your streak';
        } else if (!todayActive) {
          metaText = 'Log today to keep your ' + streak.current + '-day streak alive';
          metaEl.classList.add('warn');
        } else if (streak.current >= streak.best && streak.best > 1) {
          metaText = "You're at your all-time best \u2014 don't stop now";
          metaEl.classList.add('celebrate');
        } else if (streak.best > streak.current) {
          var diff = streak.best - streak.current;
          metaText = diff + ' more day' + (diff === 1 ? '' : 's') + ' to match your best';
        } else {
          metaText = 'Keep the chain alive';
        }
        metaEl.textContent = metaText;
      }

      // 30-day tiles — REAL counts from activity_logs
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
        // Activity-based — real activity_logs
        { name: '10 Activities',   desc: 'Log 10 activities',           icon: 'flag',           current: logs.length,      target: 10, source: 'Counts from your activity logs' },
        { name: '5 Sport Types',   desc: 'Try 5 different sports',      icon: 'sports',         current: sportCount,       target: 5,  source: 'Unique activity names in your logs' },
        { name: 'On a Roll',       desc: '14-day activity streak',      icon: 'local_fire_department', current: currentStreak, target: 14, source: 'Your current daily activity streak' },
        // PR-based
        { name: 'Strong as an Ox', desc: 'Deadlift 2\u00d7 bodyweight', icon: 'fitness_center', current: dlRatio,          target: 2,  source: 'From your deadlift PR \u00f7 weight', decimals: 2, unit: '\u00d7' },
        { name: 'Half Marathoner', desc: 'Log a 21K PR',                icon: 'directions_run', current: r.run21K  ? 1 : 0, target: 1,  source: 'Manual entry on the Records tab', binary: true },
        { name: 'Marathon Club',   desc: 'Log a Marathon PR',           icon: 'emoji_events',   current: r.runMara ? 1 : 0, target: 1,  source: 'Manual entry on the Records tab', binary: true },
        { name: 'VO\u2082 Elite',  desc: 'VO\u2082 max above 50',       icon: 'favorite',       current: r.vo2max ? r.vo2max.value : 0, target: 50, source: 'From your VO\u2082 record', decimals: 1 },
        { name: 'Healthy Heart',   desc: 'Body fat under ' + bfHealthyMax + '%', icon: 'monitor_weight', current: r.bodyFat && r.bodyFat.value <= bfHealthyMax ? 1 : 0, target: 1, source: 'From your body fat record', binary: true },
        { name: 'Well-Rested',     desc: 'Sleep avg 7\u20139 hrs',      icon: 'bedtime',        current: sleepGood,        target: 1, source: 'From your nightly sleep logs', binary: true }
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
          return '<div class="achievement ' + (unlocked ? 'unlocked' : 'locked') + '" title="' + esc(m.source) + '">' +
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

      // 1. members → DOB, gender, city
      var memRes = await window.supabase
        .from('members')
        .select('date_of_birth, gender, city')
        .eq('id', currentUserId)
        .maybeSingle();

      if (!memRes.error && memRes.data) {
        var ageFromDob = computeAgeFromDob(memRes.data.date_of_birth);
        if (ageFromDob != null) FitnessStats.profile.chronAge = ageFromDob;
        if (memRes.data.gender) FitnessStats.profile.gender = memRes.data.gender;
        if (memRes.data.city)   FitnessStats.profile.city   = memRes.data.city;
      } else if (memRes.error) {
        console.error('[FFP Fitness Stats] members read:', memRes.error);
      }

      // 2. profile_meta → PRs, sleep, weight, chrono_age
      var pm = await window.supabase
        .from('profile_meta')
        .select('chrono_age, current_weight_kg, sleep_logs, ' +
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

        var rec = {};
        Object.keys(PR_MAP).forEach(function (key) {
          var col = PR_MAP[key].col;
          if (p[col] == null) { rec[key] = null; return; }
          rec[key] = { value: Number(p[col]), date: null };
        });
        FitnessStats.records = rec;

        FitnessStats.sleepLogs = sleepFromDb(p.sleep_logs);
      }

      // 3. activity_logs (last 90 days) for streak + tiles + milestones
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

      // 4. Hide fake community ranks (no real ranking endpoint yet)
      FitnessStats.ranks = {};

      // 5. Install overrides
      overrideComputeStreak();
      overrideRenderActivity();
      overrideRenderMilestones();

      // 6. Wrap writes
      wrapWrites();

      // 7. Re-render if Fitness Stats panel is visible
      var panel = document.getElementById('panel-fitness-stats');
      if (panel && panel.classList.contains('active') && typeof FitnessStats.render === 'function') {
        FitnessStats.render();
      }

      console.log('[FFP Fitness Stats] Loaded from Supabase ✓ (' + activityCache.length + ' activities cached)');
    } catch (err) {
      console.error('[FFP Fitness Stats] Unexpected error:', err);
    }
  }

  function wrapWrites() {
    if (wrapped) return;
    wrapped = true;

    // savePr
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
      var payload = { member_id: currentUserId, updated_at: new Date().toISOString() };
      payload[map.col] = val;
      try {
        var res = await window.supabase.from('profile_meta').upsert(payload, { onConflict: 'member_id' });
        if (res.error) console.error('[FFP FS] pr save:', res.error);
      } catch (e) { console.error('[FFP FS] pr save:', e); }
    };

    // clearPr
    var origClearPr = FitnessStats.clearPr.bind(FitnessStats);
    FitnessStats.clearPr = async function () {
      var key = this._editKey;
      origClearPr();
      if (!key || !currentUserId) return;
      var afterCleared = this.records[key] == null;
      if (!afterCleared) return;
      var map = PR_MAP[key];
      if (!map) return;
      var payload = { member_id: currentUserId, updated_at: new Date().toISOString() };
      payload[map.col] = null;
      try {
        var res = await window.supabase.from('profile_meta').upsert(payload, { onConflict: 'member_id' });
        if (res.error) console.error('[FFP FS] pr clear:', res.error);
      } catch (e) { console.error('[FFP FS] pr clear:', e); }
    };

    // saveSleepLog
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

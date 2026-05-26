/* FFP Fitness Stats Loader — v1
   Wires FitnessStats module in ffp-member-dashboard.html to Supabase.
   Reads:  profile_meta (PRs, vo2_max, body_fat_pct, visceral_fat, sleep_logs, chrono_age)
           members (date_of_birth, gender, city)
   Writes: savePr, clearPr, saveSleepLog
   v1 scope: Bio Age + Records tabs fully wired. Activity tab streak keeps sample
   (will swap to real activity_logs data in v2 once My Activity panel is wired).
   Known v1 limitation: PR date field is not persisted (no schema column yet).
   After save → refresh, value stays but "PR set [date]" line disappears.
*/
(function () {
  'use strict';
  var retries = 0;
  var MAX_RETRIES = 30;
  var currentUserId = null;
  var wrapped = false;

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
    var d = new Date();
    d.setDate(d.getDate() - n);
    return localDateStr(d);
  }

  function daysAgoFromDateStr(s) {
    var d = new Date(s + 'T00:00:00');
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((t - d) / 86400000);
  }

  // sleep_logs jsonb shape: { "YYYY-MM-DD": hours, ... }
  // Dashboard sleepLogs shape: { daysAgo: hours, ... }
  function sleepFromDb(dbObj) {
    var out = {};
    if (!dbObj || typeof dbObj !== 'object') return out;
    Object.keys(dbObj).forEach(function (dateKey) {
      var hrs = Number(dbObj[dateKey]);
      if (isNaN(hrs)) return;
      var d = daysAgoFromDateStr(dateKey);
      // Only keep last 30 nights window
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

      // 1. members → DOB, gender, city, current weight via profile_meta
      var memRes = await window.supabase
        .from('members')
        .select('date_of_birth, gender, city')
        .eq('id', currentUserId)
        .maybeSingle();

      if (!memRes.error && memRes.data) {
        var ageFromDob = computeAgeFromDob(memRes.data.date_of_birth);
        if (ageFromDob != null) FitnessStats.profile.chronAge = ageFromDob;
        if (memRes.data.gender) FitnessStats.profile.gender = memRes.data.gender;
        if (memRes.data.city) FitnessStats.profile.city = memRes.data.city;
      } else if (memRes.error) {
        console.error('[FFP Fitness Stats] members read:', memRes.error);
      }

      // 2. profile_meta → PRs, sleep_logs, chrono_age, weight
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
        // chrono_age from profile_meta takes precedence over DOB-derived (only if set)
        if (p.chrono_age != null) FitnessStats.profile.chronAge = Number(p.chrono_age);
        if (p.current_weight_kg != null) FitnessStats.profile.weight = Number(p.current_weight_kg);

        // Records: build fresh map. Unset cols → null record.
        var rec = {};
        Object.keys(PR_MAP).forEach(function (key) {
          var col = PR_MAP[key].col;
          if (p[col] == null) { rec[key] = null; return; }
          rec[key] = { value: Number(p[col]), date: null };
        });
        FitnessStats.records = rec;

        // Sleep logs
        FitnessStats.sleepLogs = sleepFromDb(p.sleep_logs);
      }

      // 3. Wrap writes (once)
      wrapWrites();

      // 4. Re-render if Fitness Stats panel is visible
      var panel = document.getElementById('panel-fitness-stats');
      if (panel && panel.classList.contains('active') && typeof FitnessStats.render === 'function') {
        FitnessStats.render();
      }

      console.log('[FFP Fitness Stats] Loaded from Supabase ✓');
    } catch (err) {
      console.error('[FFP Fitness Stats] Unexpected error:', err);
    }
  }

  function wrapWrites() {
    if (wrapped) return;
    wrapped = true;

    // ─── savePr: write one column to profile_meta ───
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

    // ─── clearPr: null the column ───
    var origClearPr = FitnessStats.clearPr.bind(FitnessStats);
    FitnessStats.clearPr = async function () {
      var key = this._editKey;
      // Capture confirm result by calling original — but origClearPr opens a confirm dialog.
      // To stay non-disruptive, we just trust the original's outcome by checking records after.
      var before = key ? this.records[key] : null;
      origClearPr();
      if (!key || !currentUserId) return;
      var afterCleared = this.records[key] == null;
      if (!afterCleared) return;  // user cancelled the confirm
      var map = PR_MAP[key];
      if (!map) return;
      var payload = { member_id: currentUserId, updated_at: new Date().toISOString() };
      payload[map.col] = null;
      try {
        var res = await window.supabase.from('profile_meta').upsert(payload, { onConflict: 'member_id' });
        if (res.error) console.error('[FFP FS] pr clear:', res.error);
      } catch (e) { console.error('[FFP FS] pr clear:', e); }
    };

    // ─── saveSleepLog: sync entire sleepLogs jsonb ───
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

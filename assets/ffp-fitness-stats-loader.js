/* FFP Fitness Stats Loader — v7
   v7 changes:
   - Removed "You log these values yourself" banner (self-explanatory)
   - Country + City filters now use the master CITIES_DB taxonomy (58 countries, 541 cities)
   - City picker filters to selected country (or all cities when "Any country")
   - Country-only filtering supported (e.g. all UAE members, any city)
   - Replaced native browser <select> with custom dark-themed picker (modal sheet with search)
   - UAE sorts first in country list (FFP home market rule)
   v6 leaderboard naming preserved: "S. Khan" format.
   - Metric switcher (12 metrics: 3 strength, 5 cardio, 3 health, 1 sleep)
   - Independent filters: gender, age (preset buckets or custom range), city, country, nationality
   - All filters combinable — pick any combination
   - Live "Showing N members" sample size pill
   - Ranked leaderboard with name + value + position (your row highlighted)
   - Filters persist in localStorage across refreshes
   - Privacy: only given_names + last initial shown (e.g. "Sarah K.")
   - Members can opt out via members.show_on_leaderboard = false

   Prerequisites (SQL):
     ALTER TABLE challenges    ADD COLUMN IF NOT EXISTS host_member_id uuid REFERENCES auth.users(id);
     ALTER TABLE profile_meta  ADD COLUMN IF NOT EXISTS pr_dates jsonb DEFAULT '{}'::jsonb;
     ALTER TABLE members       ADD COLUMN IF NOT EXISTS show_on_leaderboard boolean DEFAULT true;
     CREATE OR REPLACE FUNCTION public.get_ranking_pool() ... (see message — adds given_names, surname_initial, sleep_avg_hours)
*/
(function () {
  'use strict';
  var retries = 0;
  var MAX_RETRIES = 30;
  var currentUserId = null;
  var wrapped = false;
  var activityCache = [];
  var rankingPool = [];
  var myDemo = null;
  var recordsBuilt = false;

  var FILTER_STORAGE_KEY = 'ffp_records_filters';
  var filters = loadFilters();

  function loadFilters() {
    try {
      var raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return Object.assign(defaultFilters(), parsed);
      }
    } catch (e) {}
    return defaultFilters();
  }
  function defaultFilters() {
    return {
      gender: 'any',
      ageMode: 'any',
      ageMin: null,
      ageMax: null,
      city: 'any',
      country: 'any',
      nationality: 'any',
      metric: 'bench1RM'
    };
  }
  function saveFilters() {
    try { localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters)); } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById('ffp-fitness-stats-loader-styles')) return;
    var s = document.createElement('style');
    s.id = 'ffp-fitness-stats-loader-styles';
    s.textContent = [
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',

      // Metric switcher
      '.ffp-metric-strip{display:flex;gap:8px;overflow-x:auto;padding:8px 0 12px;margin:0 -4px;}',
      '.ffp-metric-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.05);border:1px solid var(--border-mid);color:var(--muted);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;}',
      '.ffp-metric-chip:hover{background:rgba(255,255,255,0.08);}',
      '.ffp-metric-chip.active{background:var(--yellow);color:#082335;border-color:var(--yellow);}',
      '.ffp-metric-chip .material-icons{font-size:16px;}',

      // My PR hero card
      '.ffp-my-pr-card{background:linear-gradient(135deg, rgba(43,168,224,0.15), rgba(43,168,224,0.05));border:1px solid var(--blue);border-radius:14px;padding:16px;margin-bottom:14px;}',
      '.ffp-my-pr-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}',
      '.ffp-my-pr-title{font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;}',
      '.ffp-my-pr-edit{background:rgba(43,168,224,0.2);border:none;color:var(--blue);padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:4px;}',
      '.ffp-my-pr-edit .material-icons{font-size:14px;}',
      '.ffp-my-pr-value{font-size:32px;font-weight:900;color:var(--text);line-height:1;font-variant-numeric:tabular-nums;}',
      '.ffp-my-pr-value-unit{font-size:14px;color:var(--muted);margin-left:6px;font-weight:600;}',
      '.ffp-my-pr-empty{font-size:16px;font-weight:600;color:var(--muted);font-style:italic;}',
      '.ffp-my-pr-meta{margin-top:8px;font-size:12px;color:var(--muted);display:flex;gap:14px;flex-wrap:wrap;}',
      '.ffp-my-pr-pos{color:var(--yellow);font-weight:800;}',

      // Filters
      '.ffp-filters{background:rgba(255,255,255,0.03);border:1px solid var(--border-mid);border-radius:12px;padding:12px;margin-bottom:14px;}',
      '.ffp-filters-head{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;}',
      '.ffp-filters-title{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;display:flex;align-items:center;gap:6px;}',
      '.ffp-filters-count{font-size:11px;color:var(--yellow);font-weight:700;background:rgba(255,200,0,0.1);padding:3px 8px;border-radius:999px;}',
      '.ffp-filters-toggle{background:none;border:none;color:var(--muted);cursor:pointer;padding:4px;display:inline-flex;align-items:center;font-family:inherit;}',
      '.ffp-filters-body{margin-top:12px;display:flex;flex-direction:column;gap:10px;}',
      '.ffp-filters-body.collapsed{display:none;}',
      '.ffp-filter-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.ffp-filter-label{font-size:11px;font-weight:700;color:var(--muted);min-width:64px;text-transform:uppercase;letter-spacing:0.4px;}',
      '.ffp-filter-chips{display:flex;gap:6px;flex-wrap:wrap;flex:1;}',
      '.ffp-filter-chip{padding:6px 12px;border-radius:999px;background:transparent;border:1px solid var(--border-mid);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}',
      '.ffp-filter-chip:hover{background:rgba(255,255,255,0.05);}',
      '.ffp-filter-chip.active{background:var(--blue);border-color:var(--blue);color:#fff;}',
      '.ffp-filter-select{flex:1;min-width:120px;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:8px;color:var(--text);padding:8px 10px;font-size:12px;font-weight:600;font-family:inherit;}',
      '.ffp-filter-select:focus{outline:none;border-color:var(--blue);}',

      // Custom picker field (replaces native select for country/city/nationality)
      '.ffp-picker-field{flex:1;min-width:120px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:8px;color:var(--text);padding:8px 12px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;text-align:left;}',
      '.ffp-picker-field:hover{border-color:var(--blue);}',
      '.ffp-picker-field .material-icons{font-size:18px;color:var(--muted);}',
      '.ffp-picker-field.has-value{color:var(--text);}',
      '.ffp-picker-field .ffp-picker-field-val{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.ffp-picker-field.disabled{opacity:0.5;cursor:not-allowed;}',

      // Picker modal (bottom sheet)
      '.ffp-picker-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:none;align-items:flex-end;justify-content:center;}',
      '.ffp-picker-backdrop.open{display:flex;}',
      '.ffp-picker-sheet{background:var(--bg-2);border-top-left-radius:18px;border-top-right-radius:18px;width:100%;max-width:560px;max-height:80vh;display:flex;flex-direction:column;animation:ffpPickerSlideUp 0.18s ease-out;}',
      '@keyframes ffpPickerSlideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}',
      '.ffp-picker-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px 8px;border-bottom:1px solid var(--border-mid);}',
      '.ffp-picker-title{font-size:14px;font-weight:800;color:var(--text);}',
      '.ffp-picker-close{background:transparent;border:none;color:var(--muted);cursor:pointer;padding:4px;font-family:inherit;display:inline-flex;align-items:center;}',
      '.ffp-picker-close .material-icons{font-size:22px;}',
      '.ffp-picker-search{padding:10px 16px;border-bottom:1px solid var(--border-mid);}',
      '.ffp-picker-search input{width:100%;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:8px;color:var(--text);padding:9px 12px;font-size:13px;font-family:inherit;}',
      '.ffp-picker-search input:focus{outline:none;border-color:var(--blue);}',
      '.ffp-picker-list{overflow-y:auto;flex:1;padding:6px;}',
      '.ffp-picker-item{padding:11px 12px;border-radius:8px;font-size:13px;color:var(--text);cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:space-between;}',
      '.ffp-picker-item:hover{background:rgba(43,168,224,0.08);}',
      '.ffp-picker-item.active{background:rgba(43,168,224,0.15);color:var(--blue);}',
      '.ffp-picker-item .material-icons{font-size:18px;color:var(--blue);}',
      '.ffp-picker-section{padding:10px 12px 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.7px;color:var(--muted);font-weight:800;}',
      '.ffp-picker-empty{padding:24px;text-align:center;color:var(--muted);font-size:13px;}',
      '.ffp-age-custom{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:64px;font-size:12px;color:var(--muted);}',
      '.ffp-age-custom.hidden{display:none;}',
      '.ffp-age-input{width:54px;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:6px;color:var(--text);padding:5px 8px;font-size:12px;font-weight:700;text-align:center;font-family:inherit;}',
      '.ffp-age-input:focus{outline:none;border-color:var(--blue);}',
      '.ffp-filters-foot{margin-top:10px;padding-top:10px;border-top:1px solid var(--border-mid);display:flex;align-items:center;justify-content:space-between;gap:10px;}',
      '.ffp-filters-sample{font-size:12px;color:var(--muted);}',
      '.ffp-filters-sample b{color:var(--text);}',
      '.ffp-filters-reset{background:transparent;border:1px solid var(--border-mid);color:var(--muted);padding:5px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.ffp-filters-reset:hover{border-color:var(--text);color:var(--text);}',

      // Leaderboard
      '.ffp-lb-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}',
      '.ffp-lb-title{font-size:13px;font-weight:800;color:var(--text);text-transform:uppercase;letter-spacing:0.6px;}',
      '.ffp-lb-empty{padding:24px 16px;text-align:center;color:var(--muted);font-size:13px;background:rgba(255,255,255,0.02);border:1px dashed var(--border-mid);border-radius:12px;}',
      '.ffp-lb-list{display:flex;flex-direction:column;gap:6px;}',
      '.ffp-lb-row{display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--border-mid);border-radius:10px;}',
      '.ffp-lb-row.me{background:linear-gradient(90deg, rgba(255,200,0,0.15), rgba(255,200,0,0.05));border-color:var(--yellow);}',
      '.ffp-lb-row.top1{border-color:var(--yellow);}',
      '.ffp-lb-rank{font-size:14px;font-weight:900;color:var(--muted);text-align:center;font-variant-numeric:tabular-nums;}',
      '.ffp-lb-row.top1 .ffp-lb-rank,.ffp-lb-row.top2 .ffp-lb-rank,.ffp-lb-row.top3 .ffp-lb-rank{color:var(--yellow);}',
      '.ffp-lb-row.me .ffp-lb-rank{color:var(--text);}',
      '.ffp-lb-name-bar{display:flex;flex-direction:column;gap:5px;min-width:0;}',
      '.ffp-lb-name{font-size:13px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.ffp-lb-bar-wrap{height:5px;background:rgba(255,255,255,0.05);border-radius:999px;overflow:hidden;}',
      '.ffp-lb-bar{height:100%;background:var(--blue);border-radius:999px;}',
      '.ffp-lb-row.me .ffp-lb-bar{background:var(--yellow);}',
      '.ffp-lb-value{font-size:14px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;text-align:right;}',
      '.ffp-lb-row.me{cursor:pointer;}',
      '.ffp-lb-show-more{margin-top:10px;background:transparent;border:1px solid var(--border-mid);color:var(--muted);padding:8px;width:100%;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.ffp-lb-show-more:hover{border-color:var(--text);color:var(--text);}'
    ].join('');
    document.head.appendChild(s);
  }

  // ─────────── METRIC + AGE TAXONOMY ───────────

  var METRICS = [
    { key: 'bench1RM',    label: 'Bench',     icon: 'fitness_center',     col: 'pr_bench_kg',     unit: 'kg',        dir: 'higher', kind: 'num',  group: 'Strength' },
    { key: 'squat1RM',    label: 'Squat',     icon: 'fitness_center',     col: 'pr_squat_kg',     unit: 'kg',        dir: 'higher', kind: 'num',  group: 'Strength' },
    { key: 'deadlift1RM', label: 'Deadlift',  icon: 'fitness_center',     col: 'pr_deadlift_kg',  unit: 'kg',        dir: 'higher', kind: 'num',  group: 'Strength' },
    { key: 'run5K',       label: '5K',        icon: 'directions_run',     col: 'pr_5k_seconds',   unit: 'time',      dir: 'lower',  kind: 'time', group: 'Cardio' },
    { key: 'run10K',      label: '10K',       icon: 'directions_run',     col: 'pr_10k_seconds',  unit: 'time',      dir: 'lower',  kind: 'time', group: 'Cardio' },
    { key: 'run21K',      label: 'Half',      icon: 'directions_run',     col: 'pr_21k_seconds',  unit: 'time',      dir: 'lower',  kind: 'time', group: 'Cardio' },
    { key: 'runMara',     label: 'Marathon',  icon: 'emoji_events',       col: 'pr_marathon_sec', unit: 'time',      dir: 'lower',  kind: 'time', group: 'Cardio' },
    { key: 'swim1K',      label: 'Swim 1km',  icon: 'pool',               col: 'pr_swim1k_sec',   unit: 'time',      dir: 'lower',  kind: 'time', group: 'Cardio' },
    { key: 'vo2max',      label: 'VO\u2082',  icon: 'favorite',           col: 'vo2_max',         unit: 'ml/kg/min', dir: 'higher', kind: 'num',  group: 'Health' },
    { key: 'bodyFat',     label: 'Body Fat',  icon: 'monitor_weight',     col: 'body_fat_pct',    unit: '%',         dir: 'lower',  kind: 'num',  group: 'Health' },
    { key: 'visceralFat', label: 'Visceral',  icon: 'medical_information',col: 'visceral_fat',    unit: 'rating',    dir: 'lower',  kind: 'num',  group: 'Health' },
    { key: 'sleepAvgHrs', label: 'Sleep',     icon: 'bedtime',            col: 'sleep_avg_hours', unit: 'hrs',       dir: 'higher', kind: 'num',  group: 'Health' }
  ];
  var AGE_BUCKETS = [
    { key: 'any',     label: 'Any',      range: null },
    { key: 'u20',     label: 'Under 20', range: [0, 19] },
    { key: '20s',     label: '20s',      range: [20, 29] },
    { key: '30s',     label: '30s',      range: [30, 39] },
    { key: '40s',     label: '40s',      range: [40, 49] },
    { key: '50s',     label: '50s',      range: [50, 59] },
    { key: '60plus',  label: '60+',      range: [60, 200] },
    { key: 'custom',  label: 'Custom',   range: null }
  ];

  function metricByKey(k) { return METRICS.find(function (m) { return m.key === k; }); }

  function formatMetricValue(value, metric) {
    if (value == null) return '\u2014';
    if (metric.kind === 'time') {
      var sec = Math.round(value);
      var h = Math.floor(sec / 3600);
      var m = Math.floor((sec % 3600) / 60);
      var s = sec % 60;
      if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      return m + ':' + String(s).padStart(2, '0');
    }
    var v = Number(value);
    if (isNaN(v)) return '\u2014';
    return v % 1 === 0 ? String(v) : v.toFixed(1);
  }

  // ─────────── PR_MAP ───────────

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
  function localDateStr(date) { var y = date.getFullYear(); var mo = String(date.getMonth() + 1).padStart(2, '0'); var d = String(date.getDate()).padStart(2, '0'); return y + '-' + mo + '-' + d; }
  function todayStr() { return localDateStr(new Date()); }
  function dateStrFromDaysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return localDateStr(d); }
  function daysAgoFromDateStr(s) { var d = new Date(s + 'T00:00:00'); var t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((t - d) / 86400000); }
  function daysAgoFromIso(iso) { if (!iso) return 0; var d = new Date(iso); d.setHours(0, 0, 0, 0); var t = new Date(); t.setHours(0, 0, 0, 0); return Math.max(0, Math.round((t - d) / 86400000)); }
  function sleepFromDb(dbObj) { var out = {}; if (!dbObj || typeof dbObj !== 'object') return out; Object.keys(dbObj).forEach(function (k) { var hrs = Number(dbObj[k]); if (isNaN(hrs)) return; var d = daysAgoFromDateStr(k); if (d >= 1 && d <= 30) out[d] = hrs; }); return out; }
  function sleepToDb(dashObj) { var out = {}; if (!dashObj || typeof dashObj !== 'object') return out; Object.keys(dashObj).forEach(function (k) { var n = Number(k), hrs = Number(dashObj[k]); if (isNaN(n) || isNaN(hrs)) return; out[dateStrFromDaysAgo(n)] = hrs; }); return out; }

  function escAttr(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escText(s) { return (typeof escHtml === 'function') ? escHtml(s) : escAttr(s); }

  // ─────────── FILTERING ───────────

  function filterPool(pool, f) {
    return pool.filter(function (r) {
      if (f.gender !== 'any' && r.gender !== f.gender) return false;
      if (f.ageMode !== 'any') {
        if (r.age == null) return false;
        var range;
        if (f.ageMode === 'custom') {
          range = [f.ageMin != null ? f.ageMin : 0, f.ageMax != null ? f.ageMax : 200];
        } else {
          var bucket = AGE_BUCKETS.find(function (b) { return b.key === f.ageMode; });
          range = bucket ? bucket.range : null;
        }
        if (range && (r.age < range[0] || r.age > range[1])) return false;
      }
      if (f.city !== 'any' && r.city !== f.city) return false;
      if (f.country !== 'any' && r.country !== f.country) return false;
      if (f.nationality !== 'any' && r.nationality !== f.nationality) return false;
      return true;
    });
  }

  // ─────────── RECORDS TAB UI BUILD ───────────

  function distinctValues(field) {
    var seen = {};
    rankingPool.forEach(function (r) { if (r[field]) seen[r[field]] = true; });
    return Object.keys(seen).sort();
  }

  function buildRecordsTabUI() {
    var view = document.getElementById('fs-records-view');
    if (!view) return;
    if (recordsBuilt) return;

    var metricChips = METRICS.map(function (m) {
      var active = filters.metric === m.key ? ' active' : '';
      return '<button class="ffp-metric-chip' + active + '" data-metric="' + m.key + '">' +
        '<span class="material-icons">' + m.icon + '</span>' + m.label +
      '</button>';
    }).join('');

    var ageChips = AGE_BUCKETS.map(function (b) {
      var active = filters.ageMode === b.key ? ' active' : '';
      return '<button class="ffp-filter-chip' + active + '" data-age="' + b.key + '">' + b.label + '</button>';
    }).join('');

    var genderChips = ['any', 'male', 'female'].map(function (g) {
      var active = filters.gender === g ? ' active' : '';
      var label = g === 'any' ? 'Any' : (g === 'male' ? 'Male' : 'Female');
      return '<button class="ffp-filter-chip' + active + '" data-gender="' + g + '">' + label + '</button>';
    }).join('');

    function pickerFieldHtml(id, value, placeholder) {
      var display = (value && value !== 'any') ? value : placeholder;
      var hasVal = value && value !== 'any' ? ' has-value' : '';
      return '<button class="ffp-picker-field' + hasVal + '" id="' + id + '" type="button">' +
        '<span class="ffp-picker-field-val">' + escText(display) + '</span>' +
        '<span class="material-icons">expand_more</span>' +
      '</button>';
    }

    var customHidden = filters.ageMode === 'custom' ? '' : ' hidden';

    view.innerHTML =
      // Metric switcher
      '<div class="ffp-metric-strip" id="ffp-metric-strip">' + metricChips + '</div>' +

      // My PR card
      '<div class="ffp-my-pr-card" id="ffp-my-pr-card"></div>' +

      // Filters (collapsible)
      '<div class="ffp-filters">' +
        '<div class="ffp-filters-head" id="ffp-filters-head">' +
          '<div class="ffp-filters-title">' +
            '<span class="material-icons" style="font-size:14px;">tune</span> Filters' +
            '<span class="ffp-filters-count" id="ffp-filters-count">All members</span>' +
          '</div>' +
          '<button class="ffp-filters-toggle"><span class="material-icons" id="ffp-filters-caret">expand_less</span></button>' +
        '</div>' +
        '<div class="ffp-filters-body" id="ffp-filters-body">' +

          '<div class="ffp-filter-row">' +
            '<div class="ffp-filter-label">Gender</div>' +
            '<div class="ffp-filter-chips" id="ffp-gender-chips">' + genderChips + '</div>' +
          '</div>' +

          '<div class="ffp-filter-row">' +
            '<div class="ffp-filter-label">Age</div>' +
            '<div class="ffp-filter-chips" id="ffp-age-chips">' + ageChips + '</div>' +
          '</div>' +
          '<div class="ffp-age-custom' + customHidden + '" id="ffp-age-custom">' +
            'From <input type="number" min="10" max="100" class="ffp-age-input" id="ffp-age-min" value="' + (filters.ageMin != null ? filters.ageMin : 30) + '">' +
            ' to <input type="number" min="10" max="100" class="ffp-age-input" id="ffp-age-max" value="' + (filters.ageMax != null ? filters.ageMax : 39) + '">' +
            ' years' +
          '</div>' +

          '<div class="ffp-filter-row">' +
            '<div class="ffp-filter-label">Country</div>' +
            pickerFieldHtml('ffp-country-field', filters.country, 'Any country') +
          '</div>' +

          '<div class="ffp-filter-row">' +
            '<div class="ffp-filter-label">City</div>' +
            pickerFieldHtml('ffp-city-field', filters.city, 'Any city') +
          '</div>' +

          '<div class="ffp-filter-row">' +
            '<div class="ffp-filter-label">Nation</div>' +
            pickerFieldHtml('ffp-nationality-field', filters.nationality, 'Any nationality') +
          '</div>' +

          '<div class="ffp-filters-foot">' +
            '<div class="ffp-filters-sample" id="ffp-sample-text">Showing <b>0</b> members</div>' +
            '<button class="ffp-filters-reset" id="ffp-filters-reset">Reset</button>' +
          '</div>' +

        '</div>' +
      '</div>' +

      // Leaderboard
      '<div class="ffp-lb-head">' +
        '<div class="ffp-lb-title" id="ffp-lb-title">Leaderboard</div>' +
      '</div>' +
      '<div id="ffp-lb-container"></div>';

    ensurePickerModal();
    bindRecordsHandlers();
    recordsBuilt = true;
  }

  // ─────────── PICKER MODAL (custom dark-themed dropdown) ───────────

  function ensurePickerModal() {
    if (document.getElementById('ffp-picker-backdrop')) return;
    var html =
      '<div class="ffp-picker-backdrop" id="ffp-picker-backdrop">' +
        '<div class="ffp-picker-sheet" onclick="event.stopPropagation();">' +
          '<div class="ffp-picker-head">' +
            '<div class="ffp-picker-title" id="ffp-picker-title">Select</div>' +
            '<button class="ffp-picker-close" id="ffp-picker-close" type="button">' +
              '<span class="material-icons">close</span>' +
            '</button>' +
          '</div>' +
          '<div class="ffp-picker-search">' +
            '<input type="text" id="ffp-picker-search-input" placeholder="Search…">' +
          '</div>' +
          '<div class="ffp-picker-list" id="ffp-picker-list"></div>' +
        '</div>' +
      '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    var backdrop = document.getElementById('ffp-picker-backdrop');
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closePicker();
    });
    document.getElementById('ffp-picker-close').addEventListener('click', closePicker);
    document.getElementById('ffp-picker-search-input').addEventListener('input', function () {
      renderPickerList();
    });
  }

  var pickerState = { items: [], current: null, onSelect: null, searchable: true, grouped: false };

  function openPicker(title, items, current, onSelect, opts) {
    opts = opts || {};
    pickerState.items = items;
    pickerState.current = current;
    pickerState.onSelect = onSelect;
    pickerState.grouped = !!opts.grouped;
    document.getElementById('ffp-picker-title').textContent = title;
    document.getElementById('ffp-picker-search-input').value = '';
    renderPickerList();
    document.getElementById('ffp-picker-backdrop').classList.add('open');
    setTimeout(function () {
      var input = document.getElementById('ffp-picker-search-input');
      if (input) input.focus();
    }, 50);
  }
  function closePicker() {
    document.getElementById('ffp-picker-backdrop').classList.remove('open');
    pickerState.onSelect = null;
  }
  function renderPickerList() {
    var listEl = document.getElementById('ffp-picker-list');
    if (!listEl) return;
    var search = (document.getElementById('ffp-picker-search-input').value || '').toLowerCase().trim();
    var items = pickerState.items;
    var html = '';

    if (pickerState.grouped) {
      // items: [{ section: 'Middle East', items: ['UAE', 'Saudi Arabia', ...] }, ...]
      items.forEach(function (group) {
        var matchedItems = group.items.filter(function (it) {
          return !search || it.label.toLowerCase().indexOf(search) !== -1;
        });
        if (matchedItems.length === 0) return;
        html += '<div class="ffp-picker-section">' + escText(group.section) + '</div>';
        matchedItems.forEach(function (it) {
          var active = it.value === pickerState.current ? ' active' : '';
          html += '<div class="ffp-picker-item' + active + '" data-value="' + escAttr(it.value) + '">' +
            '<span>' + escText(it.label) + '</span>' +
            (active ? '<span class="material-icons">check</span>' : '') +
          '</div>';
        });
      });
    } else {
      var matched = items.filter(function (it) {
        return !search || it.label.toLowerCase().indexOf(search) !== -1;
      });
      if (matched.length === 0) {
        html = '<div class="ffp-picker-empty">No matches.</div>';
      } else {
        matched.forEach(function (it) {
          var active = it.value === pickerState.current ? ' active' : '';
          html += '<div class="ffp-picker-item' + active + '" data-value="' + escAttr(it.value) + '">' +
            '<span>' + escText(it.label) + '</span>' +
            (active ? '<span class="material-icons">check</span>' : '') +
          '</div>';
        });
      }
    }
    listEl.innerHTML = html;
    listEl.querySelectorAll('.ffp-picker-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var val = el.dataset.value;
        if (pickerState.onSelect) pickerState.onSelect(val);
        closePicker();
      });
    });
  }

  // ─────────── COUNTRY / CITY / NATIONALITY DATA SOURCES ───────────

  function getCitiesDb() {
    return (typeof CITIES_DB !== 'undefined' && CITIES_DB && typeof CITIES_DB === 'object') ? CITIES_DB : {};
  }

  // UAE-first country list, then alphabetical
  function countryItemsList() {
    var db = getCitiesDb();
    var keys = Object.keys(db);
    var UAE = 'United Arab Emirates';
    var rest = keys.filter(function (k) { return k !== UAE; }).sort();
    var ordered = (keys.indexOf(UAE) !== -1) ? [UAE].concat(rest) : rest;
    var items = [{ value: 'any', label: 'Any country' }];
    ordered.forEach(function (c) {
      items.push({ value: c, label: c });
    });
    return items;
  }

  // Cities for the currently selected country, OR all cities flat if "any"
  function cityItemsList(selectedCountry) {
    var db = getCitiesDb();
    var items = [{ value: 'any', label: 'Any city' }];
    if (selectedCountry && selectedCountry !== 'any' && db[selectedCountry]) {
      db[selectedCountry].slice().sort().forEach(function (city) {
        items.push({ value: city, label: city });
      });
      return items;
    }
    // All cities flat, alphabetical, no duplicates
    var seen = {};
    Object.keys(db).forEach(function (country) {
      (db[country] || []).forEach(function (city) {
        if (!seen[city]) { seen[city] = true; items.push({ value: city, label: city + ' \u00b7 ' + country }); }
      });
    });
    return items;
  }

  // Nationality — use country names as the option list (members type these themselves)
  // Plus include any nationalities that exist in the current ranking pool
  function nationalityItemsList() {
    var seen = {};
    var items = [{ value: 'any', label: 'Any nationality' }];
    // Real nationalities from pool first
    rankingPool.forEach(function (r) {
      if (r.nationality && !seen[r.nationality]) {
        seen[r.nationality] = true;
        items.push({ value: r.nationality, label: r.nationality });
      }
    });
    // Then country list as common nationality options
    var db = getCitiesDb();
    Object.keys(db).forEach(function (c) {
      if (!seen[c]) { seen[c] = true; items.push({ value: c, label: c }); }
    });
    return items;
  }

  function bindRecordsHandlers() {
    // Metric chips
    document.querySelectorAll('#ffp-metric-strip .ffp-metric-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        filters.metric = btn.dataset.metric;
        saveFilters();
        updateMetricChips();
        renderRecordsContent();
      });
    });
    // Gender chips
    document.querySelectorAll('#ffp-gender-chips .ffp-filter-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        filters.gender = btn.dataset.gender;
        saveFilters();
        updateGenderChips();
        renderRecordsContent();
      });
    });
    // Age chips
    document.querySelectorAll('#ffp-age-chips .ffp-filter-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        filters.ageMode = btn.dataset.age;
        saveFilters();
        updateAgeChips();
        var custom = document.getElementById('ffp-age-custom');
        if (custom) custom.classList.toggle('hidden', filters.ageMode !== 'custom');
        renderRecordsContent();
      });
    });
    // Age custom inputs
    ['ffp-age-min', 'ffp-age-max'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        var v = parseInt(el.value, 10);
        if (isNaN(v)) v = null;
        if (id === 'ffp-age-min') filters.ageMin = v; else filters.ageMax = v;
        saveFilters();
        renderRecordsContent();
      });
    });
    // Country / City / Nationality — open picker modal
    function updatePickerFieldDisplay(id, value, placeholder) {
      var el = document.getElementById(id);
      if (!el) return;
      var valEl = el.querySelector('.ffp-picker-field-val');
      if (valEl) {
        valEl.textContent = (value && value !== 'any') ? value : placeholder;
      }
      el.classList.toggle('has-value', value && value !== 'any');
    }
    var countryBtn = document.getElementById('ffp-country-field');
    if (countryBtn) countryBtn.addEventListener('click', function () {
      openPicker('Select country', countryItemsList(), filters.country, function (val) {
        filters.country = val;
        // If user changes country, reset city (unless city belongs to the new country)
        if (filters.city !== 'any' && val !== 'any') {
          var db = getCitiesDb();
          if (db[val] && db[val].indexOf(filters.city) === -1) filters.city = 'any';
        }
        saveFilters();
        updatePickerFieldDisplay('ffp-country-field', filters.country, 'Any country');
        updatePickerFieldDisplay('ffp-city-field', filters.city, 'Any city');
        renderRecordsContent();
      });
    });
    var cityBtn = document.getElementById('ffp-city-field');
    if (cityBtn) cityBtn.addEventListener('click', function () {
      openPicker(
        filters.country !== 'any' ? 'Select city in ' + filters.country : 'Select any city',
        cityItemsList(filters.country),
        filters.city,
        function (val) {
          filters.city = val;
          saveFilters();
          updatePickerFieldDisplay('ffp-city-field', filters.city, 'Any city');
          renderRecordsContent();
        }
      );
    });
    var natBtn = document.getElementById('ffp-nationality-field');
    if (natBtn) natBtn.addEventListener('click', function () {
      openPicker('Select nationality', nationalityItemsList(), filters.nationality, function (val) {
        filters.nationality = val;
        saveFilters();
        updatePickerFieldDisplay('ffp-nationality-field', filters.nationality, 'Any nationality');
        renderRecordsContent();
      });
    });
    // Collapse toggle
    var head = document.getElementById('ffp-filters-head');
    var body = document.getElementById('ffp-filters-body');
    var caret = document.getElementById('ffp-filters-caret');
    if (head && body && caret) {
      head.addEventListener('click', function () {
        body.classList.toggle('collapsed');
        caret.textContent = body.classList.contains('collapsed') ? 'expand_more' : 'expand_less';
      });
    }
    // Reset
    var reset = document.getElementById('ffp-filters-reset');
    if (reset) reset.addEventListener('click', function (e) {
      e.stopPropagation();
      filters = defaultFilters();
      saveFilters();
      recordsBuilt = false;
      buildRecordsTabUI();
      renderRecordsContent();
    });
  }

  function updateMetricChips() {
    document.querySelectorAll('#ffp-metric-strip .ffp-metric-chip').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.metric === filters.metric);
    });
  }
  function updateGenderChips() {
    document.querySelectorAll('#ffp-gender-chips .ffp-filter-chip').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.gender === filters.gender);
    });
  }
  function updateAgeChips() {
    document.querySelectorAll('#ffp-age-chips .ffp-filter-chip').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.age === filters.ageMode);
    });
  }

  function renderRecordsContent() {
    if (!recordsBuilt) return;
    var metric = metricByKey(filters.metric);
    if (!metric) return;
    var lbTitle = document.getElementById('ffp-lb-title');
    if (lbTitle) lbTitle.textContent = 'Leaderboard — ' + metric.label + (metric.unit !== 'time' ? ' (' + metric.unit + ')' : '');

    // Filter pool + sort by selected metric
    var filtered = filterPool(rankingPool, filters);
    var withValue = filtered.filter(function (r) { return r[metric.col] != null; });
    withValue.sort(function (a, b) {
      var av = Number(a[metric.col]);
      var bv = Number(b[metric.col]);
      return metric.dir === 'higher' ? bv - av : av - bv;
    });

    // Sample size pill
    var pill = document.getElementById('ffp-filters-count');
    var foot = document.getElementById('ffp-sample-text');
    var n = filtered.length;
    var pillText = n === 0 ? 'No members' : (n === 1 ? '1 member' : n + ' members');
    if (pill) pill.textContent = pillText;
    if (foot) foot.innerHTML = 'Showing <b>' + n + '</b> member' + (n === 1 ? '' : 's') + ' \u00b7 <b>' + withValue.length + '</b> with a ' + metric.label + ' value';

    // My PR card
    renderMyPrCard(metric, withValue);

    // Leaderboard rows
    var container = document.getElementById('ffp-lb-container');
    if (!container) return;
    if (withValue.length === 0) {
      container.innerHTML = '<div class="ffp-lb-empty">No members have logged a ' + metric.label + ' value in this group yet.</div>';
      return;
    }
    var values = withValue.map(function (r) { return Number(r[metric.col]); });
    var maxV = Math.max.apply(null, values);
    var minV = Math.min.apply(null, values);
    function barPctFor(v) {
      if (maxV === minV) return 1;
      if (metric.dir === 'higher') return 0.1 + ((v - minV) / (maxV - minV)) * 0.9;
      return 0.1 + ((maxV - v) / (maxV - minV)) * 0.9;
    }

    // Render: show top 20 + always include me if I'm outside
    var TOP_N = 20;
    var myIdx = -1;
    for (var i = 0; i < withValue.length; i++) {
      if (withValue[i].member_id === currentUserId) { myIdx = i; break; }
    }
    var rowsToShow = withValue.slice(0, TOP_N);
    var showingMe = myIdx >= 0 && myIdx < TOP_N;
    var meAppended = false;
    if (myIdx >= TOP_N) {
      meAppended = true;
    }

    var html = rowsToShow.map(function (r, i) {
      return renderLbRow(r, i + 1, metric, barPctFor(Number(r[metric.col])));
    }).join('');

    if (meAppended) {
      html += '<div style="text-align:center;color:var(--muted);font-size:11px;padding:6px 0;">\u00b7\u00b7\u00b7</div>';
      html += renderLbRow(withValue[myIdx], myIdx + 1, metric, barPctFor(Number(withValue[myIdx][metric.col])));
    }

    if (!meAppended && myIdx < 0 && currentUserId) {
      // I don't have a value for this metric — invite to log
      html += '<div class="ffp-lb-empty" style="margin-top:10px;">You haven\'t logged a ' + metric.label + ' value yet. Tap the card above to add one.</div>';
    }

    container.innerHTML = html;

    // Wire "me" row click → open PR edit / sleep modal
    container.querySelectorAll('.ffp-lb-row.me').forEach(function (row) {
      row.addEventListener('click', function () {
        if (filters.metric === 'sleepAvgHrs' && typeof FitnessStats.openSleepLog === 'function') {
          FitnessStats.openSleepLog();
        } else if (typeof FitnessStats.openPrEdit === 'function' && PR_MAP[filters.metric]) {
          FitnessStats.openPrEdit(filters.metric);
        }
      });
    });
  }

  function renderLbRow(r, rank, metric, barPct) {
    var isMe = r.member_id === currentUserId;
    var initial = r.given_names_initial ? r.given_names_initial + '. ' : '';
    var surname = r.surname || 'Member';
    var name = isMe ? 'You' : escText((initial + surname).trim());
    var rankCls = 'ffp-lb-row';
    if (isMe)        rankCls += ' me';
    else if (rank === 1) rankCls += ' top1';
    else if (rank === 2) rankCls += ' top2';
    else if (rank === 3) rankCls += ' top3';
    var value = formatMetricValue(r[metric.col], metric);
    var valueLine = metric.unit === 'time' ? value : (value + ' <span style="color:var(--muted);font-size:11px;font-weight:600;">' + metric.unit + '</span>');
    return '<div class="' + rankCls + '">' +
      '<div class="ffp-lb-rank">#' + rank + '</div>' +
      '<div class="ffp-lb-name-bar">' +
        '<div class="ffp-lb-name">' + name + '</div>' +
        '<div class="ffp-lb-bar-wrap"><div class="ffp-lb-bar" style="width:' + (barPct * 100) + '%;"></div></div>' +
      '</div>' +
      '<div class="ffp-lb-value">' + valueLine + '</div>' +
    '</div>';
  }

  function renderMyPrCard(metric, sortedFiltered) {
    var card = document.getElementById('ffp-my-pr-card');
    if (!card) return;
    var rec = FitnessStats.records ? FitnessStats.records[metric.key] : null;
    // Sleep is computed, not stored as a single record
    var sleepRec = (metric.key === 'sleepAvgHrs' && typeof FitnessStats.getRecord === 'function')
      ? FitnessStats.getRecord('sleepAvgHrs') : null;
    var rec2 = rec || sleepRec;

    var posLine = '';
    var myIdx = -1;
    for (var i = 0; i < sortedFiltered.length; i++) {
      if (sortedFiltered[i].member_id === currentUserId) { myIdx = i; break; }
    }
    if (myIdx >= 0) {
      posLine = '<span class="ffp-my-pr-pos">#' + (myIdx + 1) + ' of ' + sortedFiltered.length + '</span> in current group';
    } else if (rec2) {
      posLine = 'Not in current filtered group';
    } else {
      posLine = 'No value logged yet';
    }

    var valueHtml = rec2
      ? '<div class="ffp-my-pr-value">' + formatMetricValue(rec2.value, metric) + (metric.unit !== 'time' ? '<span class="ffp-my-pr-value-unit">' + metric.unit + '</span>' : '') + '</div>'
      : '<div class="ffp-my-pr-empty">No record yet — tap edit to add</div>';

    card.innerHTML =
      '<div class="ffp-my-pr-head">' +
        '<div class="ffp-my-pr-title">Your ' + metric.label + (metric.group ? ' \u00b7 ' + metric.group : '') + '</div>' +
        '<button class="ffp-my-pr-edit" id="ffp-my-pr-edit-btn"><span class="material-icons">edit</span>' + (rec2 ? 'Edit' : 'Add') + '</button>' +
      '</div>' +
      valueHtml +
      '<div class="ffp-my-pr-meta">' +
        '<div>' + posLine + '</div>' +
        (rec2 && rec2.date ? '<div>PR set ' + escText(rec2.date) + '</div>' : '') +
      '</div>';

    var btn = document.getElementById('ffp-my-pr-edit-btn');
    if (btn) btn.addEventListener('click', function () {
      if (metric.key === 'sleepAvgHrs' && typeof FitnessStats.openSleepLog === 'function') {
        FitnessStats.openSleepLog();
      } else if (typeof FitnessStats.openPrEdit === 'function') {
        FitnessStats.openPrEdit(metric.key);
      }
    });
  }

  // ─────────── ACTIVITY / MILESTONES OVERRIDES (carried from v4) ───────────

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
        flamesHtml += '<div class="' + cls + '"><span class="streak-day-flame"></span><span class="streak-day-label">' + label + '</span></div>';
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
          return '<div class="stats-tile"><div class="stats-tile-icon"><span class="material-icons">' + t.icon + '</span></div><div class="stats-tile-value">' + t.value + '</div><div class="stats-tile-label">' + t.label + '</div></div>';
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
          return '<div class="achievement ' + (unlocked ? 'unlocked' : 'locked') + '"><div class="achievement-icon"><span class="material-icons">' + m.icon + '</span></div><div class="achievement-name">' + escText(m.name) + '</div><div class="achievement-desc">' + escText(m.desc) + '</div><div class="achievement-count">' + progressText + '</div><div class="achievement-progress"><div class="achievement-progress-fill" style="width:' + pct + '%;"></div></div></div>';
        }).join('');
      }
      var unlockedCount = milestones.filter(function (m) { return m.current >= m.target; }).length;
      var countEl = document.getElementById('ms-unlocked-count');
      if (countEl) countEl.textContent = unlockedCount + ' of ' + milestones.length + ' unlocked';
    };
  }

  // Wrap FitnessStats.render — when Records tab active, rebuild + repaint
  function overrideRender() {
    var origRender = FitnessStats.render.bind(FitnessStats);
    FitnessStats.render = function () {
      // Always run the dashboard's own renders (Bio Age etc.)
      origRender();
      // If we're on Records, swap in our UI
      if (this.tab === 'records') {
        buildRecordsTabUI();
        renderRecordsContent();
      }
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
        .from('members').select('date_of_birth, gender, city, country, nationality')
        .eq('id', currentUserId).maybeSingle();
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
        .eq('member_id', currentUserId).maybeSingle();
      if (pm.error) console.error('[FFP Fitness Stats] profile_meta read:', pm.error);
      else if (pm.data) {
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

      var sinceIso = new Date(Date.now() - 90 * 86400000).toISOString();
      var actRes = await window.supabase
        .from('activity_logs').select('activity, duration_min, logged_at')
        .eq('member_id', currentUserId).gte('logged_at', sinceIso);
      if (actRes.error) { console.error('[FFP Fitness Stats] activity_logs read:', actRes.error); activityCache = []; }
      else activityCache = (actRes.data || []).map(function (r) {
        return { activity: r.activity || '', duration_min: r.duration_min || 0, daysAgo: daysAgoFromIso(r.logged_at) };
      });

      var poolRes = await window.supabase.rpc('get_ranking_pool');
      if (poolRes.error) { console.error('[FFP Fitness Stats] ranking_pool RPC:', poolRes.error); rankingPool = []; }
      else rankingPool = poolRes.data || [];

      // Old percentile pills no longer used (leaderboard replaces them)
      FitnessStats.ranks = {};

      overrideComputeStreak();
      overrideRenderActivity();
      overrideRenderMilestones();
      overrideRender();
      wrapWrites();

      var panel = document.getElementById('panel-fitness-stats');
      if (panel && panel.classList.contains('active') && typeof FitnessStats.render === 'function') {
        FitnessStats.render();
      }

      console.log('[FFP Fitness Stats] Loaded \u2713 (' + activityCache.length + ' activities, ' + rankingPool.length + ' members in pool)');
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
        var readRes = await window.supabase.from('profile_meta').select('pr_dates').eq('member_id', currentUserId).maybeSingle();
        var prDates = (readRes.data && readRes.data.pr_dates && typeof readRes.data.pr_dates === 'object') ? readRes.data.pr_dates : {};
        prDates[key] = rec.date || todayStr();
        var payload = { member_id: currentUserId, pr_dates: prDates, updated_at: new Date().toISOString() };
        payload[map.col] = val;
        var res = await window.supabase.from('profile_meta').upsert(payload, { onConflict: 'member_id' });
        if (res.error) console.error('[FFP FS] pr save:', res.error);
        for (var i = 0; i < rankingPool.length; i++) {
          if (rankingPool[i].member_id === currentUserId) { rankingPool[i][map.col] = val; break; }
        }
        if (this.tab === 'records') renderRecordsContent();
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
        var readRes = await window.supabase.from('profile_meta').select('pr_dates').eq('member_id', currentUserId).maybeSingle();
        var prDates = (readRes.data && readRes.data.pr_dates && typeof readRes.data.pr_dates === 'object') ? readRes.data.pr_dates : {};
        delete prDates[key];
        var payload = { member_id: currentUserId, pr_dates: prDates, updated_at: new Date().toISOString() };
        payload[map.col] = null;
        var res = await window.supabase.from('profile_meta').upsert(payload, { onConflict: 'member_id' });
        if (res.error) console.error('[FFP FS] pr clear:', res.error);
        for (var i = 0; i < rankingPool.length; i++) {
          if (rankingPool[i].member_id === currentUserId) { rankingPool[i][map.col] = null; break; }
        }
        if (this.tab === 'records') renderRecordsContent();
      } catch (e) { console.error('[FFP FS] pr clear:', e); }
    };

    var origSaveSleepLog = FitnessStats.saveSleepLog.bind(FitnessStats);
    FitnessStats.saveSleepLog = async function () {
      origSaveSleepLog();
      if (!currentUserId) return;
      var dbShape = sleepToDb(this.sleepLogs);
      try {
        var res = await window.supabase.from('profile_meta').upsert({
          member_id: currentUserId, sleep_logs: dbShape, updated_at: new Date().toISOString()
        }, { onConflict: 'member_id' });
        if (res.error) console.error('[FFP FS] sleep save:', res.error);
        // Recompute sleep avg locally on the pool snapshot of self
        var hrs = [];
        Object.keys(dbShape).forEach(function (k) { var v = Number(dbShape[k]); if (!isNaN(v)) hrs.push(v); });
        var avg = hrs.length > 0 ? hrs.reduce(function (a, b) { return a + b; }, 0) / hrs.length : null;
        for (var i = 0; i < rankingPool.length; i++) {
          if (rankingPool[i].member_id === currentUserId) { rankingPool[i].sleep_avg_hours = avg; break; }
        }
        if (this.tab === 'records') renderRecordsContent();
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

/* ============================================================================
   FFP FITNESS STATS — CORE  (split out of ffp-member-dashboard.html · 2026-06-05 · v1)
   ----------------------------------------------------------------------------
   The STABLE engine: biological-age computation (with medical reference bands),
   personal-records data + edit modal, sleep log, activity streak, base render.
   Loaded SYNCHRONOUSLY by the dashboard BEFORE FitnessStats.init() runs at boot.
   The VOLATILE parts — live Supabase data, milestones, the records leaderboard —
   stay in the lazy assets/ffp-fitness-stats-loader.js, which overrides these
   methods by name once the Fitness Stats panel is opened.
   Exposes window.FitnessStats. Uses dashboard globals at call-time only:
   LOGS, escHtml, fmtTime, fmtPrDate, showToast, FFPAuth, supabase.
   ============================================================================ */
var FitnessStats = {
  tab: 'activity',  // 'activity' | 'bio' | 'records' | 'milestones' — Activity opens first
  compareGroup: 'age_gender',  // 'all' | 'age' | 'age_gender' | 'age_gender_city'

  // Member fitness profile — chronAge/gender/city would flow from passport in production
  profile: {
    chronAge: 0,
    weight: 0,        // kg — used for strength-to-bodyweight calc
    height: 0,       // cm
    gender: '',    // 'male' / 'female'
    city: ''
  },

  // Personal records. Each record: { value, date } or null if not logged.
  // Strength values in kg. Cardio values in SECONDS. VO2 in ml/kg/min.
  // Body fat in %. Visceral fat rating 1-20. Sleep avg in hours.
  records: {
    bench1RM:    null,
    squat1RM:    null,
    deadlift1RM: null,
    run5K:       null,
    run10K:      null,
    run21K:      null,
    runMara:     null,
    swim1K:      null,
    vo2max:      null,
    bodyFat:     null,
    visceralFat: null,
    restingHR:   null,
    hrv:         null,
    grip:        null,
    muscleMass:  null,
    waist:       null,
    weight:      null
    // sleepAvgHrs is COMPUTED from sleepLogs below (v82)
  },

  // v82 — Daily sleep entries. Members log hours slept each night; system computes the average.
  // Key = daysAgo (0 = last night), value = hours slept (or null if not logged).
  // Production: GET /api/members/me/sleep-logs?days=30
  sleepLogs: {
    1:  null,
    2:  null,
    3:  null,
    4:  null,
    5:  null,
    6:  null,
    7:  null,
    8:  null,
    9:  null,
    10: null,
    11: null,
    12: null,
    13: null,
    14: null
  },

  // Computed: rolling 7-day sleep average. Returns null if no recent logs.
  getSleepAvg() {
    const hours = [];
    for (let d = 1; d <= 7; d++) {
      if (typeof this.sleepLogs[d] === 'number') hours.push(this.sleepLogs[d]);
    }
    if (hours.length === 0) return null;
    return Math.round((hours.reduce((a,b)=>a+b,0) / hours.length) * 10) / 10;
  },

  // Most recent date a sleep entry was logged (used for the "PR set" date display)
  getSleepLastLogged() {
    const sorted = Object.keys(this.sleepLogs).map(Number).filter(d => typeof this.sleepLogs[d] === 'number').sort((a,b) => a - b);
    if (sorted.length === 0) return null;
    const daysAgo = sorted[0];  // smallest = most recent
    const date = new Date(Date.now() - daysAgo * 86400000);
    return date.toISOString().slice(0,10);
  },

  // v82 — Unified record lookup. Sleep is computed from sleepLogs; others are stored directly.
  getRecord(key) {
    if (key === 'sleepAvgHrs') {
      const avg = this.getSleepAvg();
      if (avg == null) return null;
      return { value: avg, date: this.getSleepLastLogged() };
    }
    return this.records[key];
  },

  // Community percentile ranks (Top X%). Production: GET /api/community/rankings?stat=X&group=Y
  // Lower X = better. These are samples for the default 'age_gender' group.
  ranks: {
    bench1RM: null, squat1RM: null, deadlift1RM: null,
    run5K: null, run10K: null, run21K: null, runMara: null, swim1K: null,
    vo2max: null, bodyFat: null, visceralFat: null, sleepAvgHrs: null
  },

  // PR field definitions used by render + edit modal
  prDefs: {
    bench1RM:    { name: 'Bench Press', icon: 'fitness_center', type: 'kg',      unit: 'kg',     step: 2.5, max: 400, group: 'strength' },
    squat1RM:    { name: 'Squat',       icon: 'fitness_center', type: 'kg',      unit: 'kg',     step: 2.5, max: 400, group: 'strength' },
    deadlift1RM: { name: 'Deadlift',    icon: 'fitness_center', type: 'kg',      unit: 'kg',     step: 2.5, max: 500, group: 'strength' },
    run5K:       { name: '5K Run',      icon: 'directions_run', type: 'time',    unit: 'mm:ss',  group: 'cardio' },
    run10K:      { name: '10K Run',     icon: 'directions_run', type: 'time',    unit: 'mm:ss',  group: 'cardio' },
    run21K:      { name: 'Half Marathon', icon: 'directions_run', type: 'time',  unit: 'h:mm:ss', group: 'cardio' },
    runMara:     { name: 'Marathon',    icon: 'directions_run', type: 'time',    unit: 'h:mm:ss', group: 'cardio' },
    swim1K:      { name: 'Swim 1km',    icon: 'pool',           type: 'time',    unit: 'mm:ss',  group: 'cardio' },
    bronco:      { name: 'Bronco',      icon: 'directions_run', type: 'time',    unit: 'mm:ss',  group: 'cardio' },
    beepTest:    { name: 'Beep Test',   icon: 'graphic_eq',     type: 'decimal', unit: 'level',  step: 0.5, max: 23, group: 'cardio' },
    vo2max:      { name: 'VO₂ Max',     icon: 'favorite',      type: 'decimal', unit: 'ml/kg/min', step: 0.5, max: 90,  group: 'health' },
    bodyFat:     { name: 'Body Fat',    icon: 'monitor_weight', type: 'decimal', unit: '%',      step: 0.5, max: 60,  group: 'health' },
    visceralFat: { name: 'Visceral Fat',icon: 'medical_information', type: 'kg', unit: 'rating', step: 1,   max: 30,  group: 'health' },
    restingHR:   { name: 'Resting HR',  icon: 'monitor_heart', type: 'kg',      unit: 'bpm', step: 1,   max: 220, group: 'health' },
    maxHR:       { name: 'Max HR',      icon: 'cardiology',    type: 'kg',      unit: 'bpm', step: 1,   max: 230, group: 'health' },
    hrv:         { name: 'HRV (RMSSD)', icon: 'vital_signs',   type: 'kg',      unit: 'ms',  step: 1,   max: 250, group: 'health' },
    grip:        { name: 'Grip Strength',icon: 'pan_tool',     type: 'decimal', unit: 'kg',  step: 1,   max: 120, group: 'health' },
    muscleMass:  { name: 'Muscle Mass', icon: 'fitness_center', type: 'decimal', unit: 'kg',  step: 0.5, max: 80,  group: 'health' },
    waist:       { name: 'Waist',       icon: 'straighten',    type: 'decimal', unit: 'cm',  step: 0.5, max: 200, group: 'health' },
    weight:      { name: 'Body Weight', icon: 'monitor_weight', type: 'decimal', unit: 'kg',  step: 0.5, max: 300, group: 'health' }
    // v84 — Sleep removed from PR cards. Logged via daily input on Bio Age tab (sleep-mini-card).
  },

  // PR edit state
  _editKey: null,
  _editValue: 0,
  _editH: 0, _editM: 0, _editS: 0,

  // ─────────── INIT ───────────
  init() {
    // Tab switching (v84 — 4 tabs)
    document.querySelectorAll('#fs-tabs .tabs-underline-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#fs-tabs .tabs-underline-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tab = btn.dataset.fsTab;
        document.getElementById('fs-bio-view').style.display        = this.tab === 'bio'        ? '' : 'none';
        document.getElementById('fs-activity-view').style.display   = this.tab === 'activity'   ? '' : 'none';
        document.getElementById('fs-records-view').style.display    = this.tab === 'records'    ? '' : 'none';
        document.getElementById('fs-milestones-view').style.display = this.tab === 'milestones' ? '' : 'none';
        this.render();
      });
    });
    // Compare group select
    const _csEl = document.getElementById('fs-compare-select');
    if (_csEl) _csEl.addEventListener('change', e => {
      this.compareGroup = e.target.value;
      this.render();
    });
    this.render();
  },

  // ─────────── BIOLOGICAL AGE ───────────
  // Composite formula. Each factor pushes bio age up or down vs chronological.
  // Returns the calculated bio age + the list of contributing drivers.
  computeBioAge() {
    const p = this.profile;
    const r = this.records;
    let bio = p.chronAge;
    const drivers = [];

    // VO2 max — strongest indicator. Each unit above age-norm = -0.4 yrs.
    // VO₂ max — strongest CRF signal, but bounded by age/sex category (v86).
    if (r.vo2max) {
      const band = this.vo2Band(r.vo2max.value, p.gender, p.chronAge);
      const VO2_YEARS = { Superior: -3, Excellent: -2, Good: -1, Fair: 0, Poor: 2 };
      const delta = VO2_YEARS[band.label] || 0;
      bio += delta;
      drivers.push({
        key: 'vo2',
        name: 'VO₂ Max',
        icon: 'favorite',
        detail: `${r.vo2max.value} ml/kg/min — for your age & sex`,
        band: band,
        deltaYears: delta
      });
    }

    // Body fat — bounded by age/sex category (v86).
    if (r.bodyFat) {
      const band = this.bodyFatBand(r.bodyFat.value, p.gender, p.chronAge);
      const BF_YEARS = { Lean: -0.5, Healthy: 0, Overweight: 1.5, Obese: 3 };
      const delta = BF_YEARS[band.label] || 0;
      bio += delta;
      drivers.push({
        key: 'bf',
        name: 'Body Fat',
        icon: 'monitor_weight',
        detail: `${r.bodyFat.value}% — for your age & sex`,
        band: band,
        deltaYears: delta
      });
    }

    // Visceral fat — bounded (v86).
    if (r.visceralFat) {
      let delta = 0;
      const v = r.visceralFat.value;
      if (v > 12)       delta = 1.5;
      else if (v >= 10) delta = 0.5;
      else if (v <= 5)  delta = -0.5;
      bio += delta;
      drivers.push({
        key: 'vf',
        name: 'Visceral Fat',
        icon: 'medical_information',
        detail: `Rating ${r.visceralFat.value} (healthy <12)`,
        deltaYears: delta
      });
    }

    // Sleep — 7-9 hrs is the sweet spot.
    const sleepRec = this.getRecord('sleepAvgHrs');
    if (sleepRec) {
      let delta = 0;
      const h = sleepRec.value;
      if (h >= 7 && h <= 9)     delta = -1;
      else if (h < 6)           delta = 2;
      else if (h < 7 || h > 9)  delta = 0.5;
      bio += delta;
      drivers.push({
        key: 'sleep',
        name: 'Sleep',
        icon: 'bedtime',
        detail: `${h} hrs avg (optimal 7–9)`,
        deltaYears: delta
      });
    }

    // Strength-to-bodyweight (deadlift). 2x bodyweight = elite for 35yo.
    if (r.deadlift1RM && p.weight) {
      const ratio = r.deadlift1RM.value / p.weight;
      let delta = 0;
      if (ratio >= 2.0)      delta = -2;
      else if (ratio >= 1.5) delta = -1;
      else if (ratio < 1.0)  delta = 1;
      bio += delta;
      drivers.push({
        key: 'dl',
        name: 'Strength (deadlift)',
        icon: 'fitness_center',
        detail: `${ratio.toFixed(2)}× bodyweight`,
        deltaYears: delta
      });
    }

    // Resting HR (v86)
    if (r.restingHR) {
      const band = this.restingHrBand(r.restingHR.value, p.gender);
      bio += band.years;
      drivers.push({ key: 'rhr', name: 'Resting HR', icon: 'monitor_heart', detail: `${r.restingHR.value} bpm — for your sex`, band: band, deltaYears: band.years });
    }
    // HRV (v86)
    if (r.hrv) {
      const band = this.hrvBand(r.hrv.value, p.chronAge);
      bio += band.years;
      drivers.push({ key: 'hrv', name: 'HRV', icon: 'vital_signs', detail: `${r.hrv.value} ms — for your age`, band: band, deltaYears: band.years });
    }
    // Grip strength (v86)
    if (r.grip) {
      const band = this.gripBand(r.grip.value, p.gender, p.chronAge);
      bio += band.years;
      drivers.push({ key: 'grip', name: 'Grip Strength', icon: 'pan_tool', detail: `${r.grip.value} kg — for your age & sex`, band: band, deltaYears: band.years });
    }
    // Waist via waist-to-height ratio (v86) — needs height
    if (r.waist && p.height) {
      const whtr = r.waist.value / p.height;
      const band = this.waistBand(whtr);
      bio += band.years;
      drivers.push({ key: 'waist', name: 'Waist', icon: 'straighten', detail: `Waist-to-height ${whtr.toFixed(2)} (${r.waist.value}cm)`, band: band, deltaYears: band.years });
    }

    // Muscle mass → rating via Skeletal Muscle Index (SMI = mass ÷ height²). Rating only — no bio-age delta.
    if (r.muscleMass && r.muscleMass.value != null && p.height) {
      const _hm = p.height / 100;
      const smi = _hm > 0 ? (r.muscleMass.value / (_hm * _hm)) : null;
      if (smi != null && isFinite(smi)) {
        const band = this.muscleMassBand(smi, p.gender);
        bio += band.years;
        drivers.push({ key: 'mm', name: 'Muscle Mass', icon: 'fitness_center', detail: `${r.muscleMass.value} kg · ${smi.toFixed(1)} kg/m²`, band: band, deltaYears: band.years, smi: Math.round(smi * 10) / 10 });
      }
    }

    return { bioAge: Math.max(18, Math.round(bio)), drivers, chronAge: p.chronAge };
  },

  // Skeletal Muscle Index rating (kg/m²), sex-banded. Total-body muscle mass ÷ height².
  muscleMassBand(smi, gender) {
    const f = (gender || '').toLowerCase().charAt(0) === 'f';
    const ath = f ? 9.5 : 11.5, ok = f ? 7.5 : 9.5;
    if (smi >= ath) return { label: 'Athletic', color: '#38bdf8', bg: 'rgba(56,189,248,0.14)', years: -1 };
    if (smi >= ok)  return { label: 'Healthy',  color: '#4ade80', bg: 'rgba(74,222,128,0.14)', years: 0 };
    return            { label: 'Low',       color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', years: 1.5 };
  },

  vo2Norm(age, gender) {
    if (gender === 'male') {
      if (age < 30) return 47; if (age < 40) return 42; if (age < 50) return 38; return 33;
    } else {
      if (age < 30) return 41; if (age < 40) return 36; if (age < 50) return 32; return 28;
    }
  },

  // v85 — Body-fat % classification by sex + age band.
  // Source: University of Pennsylvania PennShape body-composition reference
  // (6-tier, age/sex-banded), collapsed to 4 tiers and shifted −2 pts (Grant, 2026-05-30).
  // Each row = [leanMax, healthyMax, overweightMax]; above overweightMax = Obese.
  BF_BANDS: {
    male:   { 20:[8.5,16.6,21.1], 30:[12.5,19.3,22.9], 40:[15.4,21.4,24.6], 50:[17.1,22.6,25.8], 60:[17.7,23.2,26.4] },
    female: { 20:[14.5,20.7,25.1], 30:[15.4,22.6,27.1], 40:[17.8,25.6,29.9], 50:[20.5,28.4,32.5], 60:[21.2,29.3,33.4] }
  },
  bodyFatBand(pct, gender, age) {
    const sex = (gender || '').toLowerCase().charAt(0) === 'f' ? 'female' : 'male';
    const a = age >= 60 ? 60 : age >= 50 ? 50 : age >= 40 ? 40 : age >= 30 ? 30 : 20;
    const row = this.BF_BANDS[sex][a];
    if (pct <= row[0]) return { label: 'Lean',       color: '#38bdf8', bg: 'rgba(56,189,248,0.14)' };
    if (pct <= row[1]) return { label: 'Healthy',    color: '#4ade80', bg: 'rgba(74,222,128,0.14)' };
    if (pct <= row[2]) return { label: 'Overweight', color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' };
    return                     { label: 'Obese',      color: '#ef4444', bg: 'rgba(239,68,68,0.14)' };
  },

  // v85 — VO₂ max classification by sex + age band.
  // Source: Cooper Institute / Garmin standardized ratings (ml/kg/min).
  // Each row = [fairMin, goodMin, excellentMin, superiorMin]; below fairMin = Poor.
  VO2_BANDS: {
    male:   { 20:[41.7,45.4,51.1,55.4], 30:[40.5,44.0,48.3,54.0], 40:[38.5,42.4,46.4,52.5], 50:[35.6,39.2,43.4,48.9], 60:[32.3,35.5,39.5,45.7], 70:[29.4,32.3,36.7,42.1] },
    female: { 20:[36.1,39.5,43.9,49.6], 30:[34.4,37.8,42.4,47.4], 40:[33.0,36.3,39.7,45.3], 50:[30.1,33.0,36.7,41.1], 60:[27.5,30.0,33.0,37.8], 70:[25.9,28.1,30.9,36.7] }
  },
  vo2Band(vo2, gender, age) {
    const sex = (gender || '').toLowerCase().charAt(0) === 'f' ? 'female' : 'male';
    const a = age >= 70 ? 70 : age >= 60 ? 60 : age >= 50 ? 50 : age >= 40 ? 40 : age >= 30 ? 30 : 20;
    const row = this.VO2_BANDS[sex][a];
    if (vo2 >= row[3]) return { label: 'Superior',  color: '#38bdf8', bg: 'rgba(56,189,248,0.14)' };
    if (vo2 >= row[2]) return { label: 'Excellent', color: '#4ade80', bg: 'rgba(74,222,128,0.14)' };
    if (vo2 >= row[1]) return { label: 'Good',      color: '#4ade80', bg: 'rgba(74,222,128,0.14)' };
    if (vo2 >= row[0]) return { label: 'Fair',      color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' };
    return                     { label: 'Poor',      color: '#ef4444', bg: 'rgba(239,68,68,0.14)' };
  },

  // v86 — Resting HR band (lower better; women run ~3 bpm higher → offset).
  restingHrBand(bpm, gender) {
    const v = bpm - ((gender || '').toLowerCase().charAt(0) === 'f' ? 3 : 0);
    if (v <= 49) return { label: 'Athlete',   color: '#38bdf8', bg: 'rgba(56,189,248,0.14)', years: -1.5 };
    if (v <= 59) return { label: 'Excellent', color: '#4ade80', bg: 'rgba(74,222,128,0.14)', years: -1 };
    if (v <= 69) return { label: 'Good',      color: '#4ade80', bg: 'rgba(74,222,128,0.14)', years: -0.5 };
    if (v <= 84) return { label: 'Average',   color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', years: 0 };
    return         { label: 'High',      color: '#ef4444', bg: 'rgba(239,68,68,0.14)', years: 1.5 };
  },
  // v86 — HRV (RMSSD) vs age norm (declines with age). Higher better; noisy → modest impact.
  hrvNorm(age) { return age < 30 ? 70 : age < 40 ? 58 : age < 50 ? 46 : age < 60 ? 36 : 28; },
  hrvBand(ms, age) {
    const n = this.hrvNorm(age);
    if (ms >= n * 1.25) return { label: 'Excellent', color: '#38bdf8', bg: 'rgba(56,189,248,0.14)', years: -1.5 };
    if (ms >= n)        return { label: 'Good',      color: '#4ade80', bg: 'rgba(74,222,128,0.14)', years: -0.5 };
    if (ms >= n * 0.7)  return { label: 'Fair',      color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', years: 0.5 };
    return                 { label: 'Low',       color: '#ef4444', bg: 'rgba(239,68,68,0.14)', years: 1.5 };
  },
  // v86 — Grip strength vs age/sex norm (kg). Clinical at-risk: men <27, women <16.
  GRIP_NORM: {
    male:   { 20:50, 30:49, 40:47, 50:43, 60:39, 70:32 },
    female: { 20:31, 30:31, 40:29, 50:26, 60:23, 70:19 }
  },
  gripBand(kg, gender, age) {
    const sex = (gender || '').toLowerCase().charAt(0) === 'f' ? 'female' : 'male';
    const a = age >= 70 ? 70 : age >= 60 ? 60 : age >= 50 ? 50 : age >= 40 ? 40 : age >= 30 ? 30 : 20;
    const n = this.GRIP_NORM[sex][a];
    const atRisk = sex === 'female' ? 16 : 27;
    if (kg < atRisk)    return { label: 'Low',    color: '#ef4444', bg: 'rgba(239,68,68,0.14)', years: 2 };
    if (kg >= n * 1.1)  return { label: 'Strong', color: '#38bdf8', bg: 'rgba(56,189,248,0.14)', years: -1.5 };
    if (kg >= n * 0.85) return { label: 'Good',   color: '#4ade80', bg: 'rgba(74,222,128,0.14)', years: -0.5 };
    return                 { label: 'Fair',   color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', years: 0 };
  },
  // v86 — Waist via waist-to-height ratio (NICE thresholds). Needs height.
  waistBand(whtr) {
    if (whtr < 0.4) return { label: 'Low',         color: '#38bdf8', bg: 'rgba(56,189,248,0.14)', years: -0.5 };
    if (whtr < 0.5) return { label: 'Healthy',     color: '#4ade80', bg: 'rgba(74,222,128,0.14)', years: 0 };
    if (whtr < 0.6) return { label: 'Take Care',   color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', years: 1.5 };
    return             { label: 'Take Action', color: '#ef4444', bg: 'rgba(239,68,68,0.14)', years: 3 };
  },

  // v81 — Streak calculation from LOGS. Current = consecutive days back from today.
  // Best = longest consecutive run anywhere in the log history.
  computeStreak() {
    const logs = (typeof LOGS !== 'undefined' ? LOGS : []);
    const daysWithActivity = new Set(logs.map(l => l.daysAgo));
    // Current streak: walk back from today (day 0)
    let current = 0;
    for (let d = 0; d < 365; d++) {
      if (daysWithActivity.has(d)) current++;
      else break;
    }
    // Best streak: longest consecutive run in the activity history
    const sorted = [...daysWithActivity].sort((a, b) => a - b);
    let best = 0, run = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 || sorted[i] === sorted[i - 1] + 1) run++;
      else run = 1;
      if (run > best) best = run;
    }
    return { current, best, daysWithActivity };
  },

  // ─────────── RENDER ───────────
  render() {
    if (this.tab === 'bio')             this.renderBio();
    else if (this.tab === 'activity')   this.renderActivity();
    else if (this.tab === 'records')    this.renderRecords();
    else if (this.tab === 'milestones') this.renderMilestones();
  },

  renderBio() {
    const calc = this.computeBioAge();
    document.getElementById('bio-value').textContent  = calc.bioAge;
    document.getElementById('bio-chrono').textContent = calc.chronAge;

    // Gap pill
    const gap = calc.chronAge - calc.bioAge;
    const gapEl    = document.getElementById('bio-gap');
    const gapTxt   = document.getElementById('bio-gap-text');
    const gapIcon  = document.getElementById('bio-gap-icon');
    gapEl.classList.remove('over','equal');
    if (gap > 0) {
      gapTxt.textContent = `${gap} year${gap === 1 ? '' : 's'} younger`;
      gapIcon.textContent = 'arrow_downward';
    } else if (gap < 0) {
      gapEl.classList.add('over');
      gapTxt.textContent = `${Math.abs(gap)} year${Math.abs(gap) === 1 ? '' : 's'} older`;
      gapIcon.textContent = 'arrow_upward';
    } else {
      gapEl.classList.add('equal');
      gapTxt.textContent = 'on par with your age';
      gapIcon.textContent = 'horizontal_rule';
    }

    // Health markers — tap-to-add cards (entry + leaderboard live here now; Records = strength+cardio). v87
    const driverByKey = {};
    calc.drivers.forEach(d => { driverByKey[d.key] = d; });
    const HEALTH = [
      { key: 'vo2max',      drv: 'vo2',   name: 'VO₂ Max',       icon: 'favorite' },
      { key: 'bodyFat',     drv: 'bf',    name: 'Body Fat',      icon: 'monitor_weight' },
      { key: 'visceralFat', drv: 'vf',    name: 'Visceral Fat',  icon: 'medical_information' },
      { key: 'restingHR',   drv: 'rhr',   name: 'Resting HR',    icon: 'monitor_heart' },
      { key: 'maxHR',       drv: null,    name: 'Max HR',        icon: 'cardiology' },
      { key: 'hrv',         drv: 'hrv',   name: 'HRV',           icon: 'graphic_eq' },
      { key: 'grip',        drv: 'grip',  name: 'Grip Strength', icon: 'pan_tool' },
      { key: 'muscleMass',  drv: 'mm',    name: 'Muscle Mass',   icon: 'fitness_center' },
      { key: 'waist',       drv: 'waist', name: 'Waist',         icon: 'straighten' }
    ];
    document.getElementById('bio-drivers').innerHTML = HEALTH.map(h => {
      const rec = this.records[h.key];
      const hasVal = rec && rec.value != null;
      const drv = h.drv ? driverByKey[h.drv] : null;
      const def = this.prDefs[h.key] || {};
      const delta = drv ? drv.deltaYears : 0;
      const cls = delta < -0.1 ? 'positive' : delta > 0.1 ? 'negative' : '';
      const deltaTxt = (drv && Math.abs(delta) >= 0.1) ? `${delta < 0 ? '−' : '+'}${Math.abs(delta).toFixed(1)} yrs` : '';
      const bandChip = (drv && drv.band)
        ? `<span class="bf-band" style="background:${drv.band.bg}; color:${drv.band.color};">${escHtml(drv.band.label)}</span>`
        : '';
      let valueText = hasVal ? `${rec.value} ${escHtml(def.unit || '')}` : 'Tap to add';
      if (h.key === 'muscleMass' && hasVal && drv && drv.smi != null) valueText = `${rec.value} kg · ${drv.smi} kg/m²`;
      // Max HR: never "Tap to add" — it defaults to 220 − age (editable). Flag the estimate until the member sets their own.
      if (h.key === 'maxHR' && hasVal && rec.estimated) valueText = `${rec.value} bpm · est. (220 − age)`;
      return `
        <div class="bio-driver ${cls}${hasVal ? '' : ' empty'}" onclick="FitnessStats.openPrEdit('${h.key}')">
          <div class="bio-driver-icon"><span class="material-icons">${h.icon}</span></div>
          <div class="bio-driver-info">
            <div class="bio-driver-name">${escHtml(h.name)}${bandChip}</div>
            <div class="bio-driver-detail">${valueText}</div>
          </div>
          ${deltaTxt ? `<div class="bio-driver-delta ${cls}">${deltaTxt}</div>` : ''}
          ${h.key === 'maxHR' ? '' : `<button class="bio-driver-lb" onclick="event.stopPropagation(); if(window.ffpShowLeaderboard) window.ffpShowLeaderboard('${h.key}');" aria-label="Leaderboard"><span class="material-icons">leaderboard</span></button>`}
        </div>
      `;
    }).join('');

    // v83 — Sleep mini-card (Bio Age tab quick-log)
    const sleepAvg = this.getSleepAvg();
    const sleepMiniEl = document.getElementById('sleep-mini-avg');
    if (sleepMiniEl) sleepMiniEl.textContent = sleepAvg != null ? sleepAvg.toFixed(1) : '—';
    const wMiniEl = document.getElementById('weight-mini-val');
    if (wMiniEl) { const wr = this.records.weight; wMiniEl.textContent = (wr && wr.value != null) ? wr.value : '—'; }
  },

  // v84 — Activity tab: streak (consistency) + 30-day activity tiles
  renderActivity() {
    // Activity Streak card: flames + day-of-week labels (last 7 days)
    const streak = this.computeStreak();
    document.getElementById('streak-current').textContent = streak.current;
    document.getElementById('streak-best').textContent    = streak.best;
    const dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const today    = new Date();
    let flamesHtml = '';
    for (let d = 6; d >= 0; d--) {
      const active   = streak.daysWithActivity.has(d);
      const isToday  = d === 0;
      const dDate    = new Date(today.getTime() - d * 86400000);
      const label    = isToday ? 'Today' : dayShort[dDate.getDay()];
      let cls = 'streak-day';
      if (active)  cls += ' active';
      if (isToday) cls += ' today';
      flamesHtml += `
        <div class="${cls}">
          <span class="streak-day-flame"></span>
          <span class="streak-day-label">${label}</span>
        </div>
      `;
    }
    document.getElementById('streak-dots').innerHTML = flamesHtml;
    // Meta line — different copy/colours by state
    const todayActive = streak.daysWithActivity.has(0);
    const metaEl = document.getElementById('streak-meta');
    metaEl.classList.remove('warn','celebrate');
    let metaText;
    if (streak.current === 0) {
      metaText = 'Log an activity today to start your streak';
    } else if (!todayActive) {
      metaText = `Log today to keep your ${streak.current}-day streak alive`;
      metaEl.classList.add('warn');
    } else if (streak.current >= streak.best && streak.best > 1) {
      metaText = "You're at your all-time best — don't stop now";
      metaEl.classList.add('celebrate');
    } else if (streak.best > streak.current) {
      metaText = `${streak.best - streak.current} more day${streak.best - streak.current === 1 ? '' : 's'} to match your best`;
    } else {
      metaText = "Keep the chain alive";
    }
    metaEl.textContent = metaText;

    // Activity totals (last 30 days) — uses LOGS
    const logs = (typeof LOGS !== 'undefined' ? LOGS : []).filter(l => l.daysAgo <= 30);
    const totalCount = logs.length;
    const totalHours = Math.round(totalCount * 0.85);
    const activeDays = new Set(logs.map(l => l.daysAgo)).size;
    const sportsCount = new Set(logs.map(l => l.activity)).size;
    const tiles = [
      { icon: 'fitness_center', value: totalCount,  label: 'Activities' },
      { icon: 'schedule',       value: totalHours + 'h', label: 'Hours' },
      { icon: 'calendar_today', value: activeDays,   label: 'Active days' },
      { icon: 'sports',         value: sportsCount,  label: 'Sports' }
    ];
    // v307 (fix): the Activity tab no longer has a #stats-tiles element (it uses streak-card +
    // fs-breakdown + fs-recent, rendered by the loader). This base fallback now runs at boot because
    // Activity is the default tab, so guard the missing node — an unguarded null.innerHTML here threw
    // and blanked the whole Fitness Stats panel. The loader's renderActivity override is the real one.
    var _stTiles = document.getElementById('stats-tiles');
    if (_stTiles) _stTiles.innerHTML = tiles.map(t => `
      <div class="stats-tile">
        <div class="stats-tile-icon"><span class="material-icons">${t.icon}</span></div>
        <div class="stats-tile-value">${t.value}</div>
        <div class="stats-tile-label">${t.label}</div>
      </div>
    `).join('');
  },

  renderRecords() {
    // Records is owned by the fitness-stats loader (metric switcher + leaderboard); when the loader
    // is present it overrides this method. This fallback only runs if the loader didn't load —
    // show a hint, never the old strength/cardio/health grid.
    const el = document.getElementById('fs-records-fallback');
    if (el) el.innerHTML = 'Records couldn\'t load. Please refresh — if it keeps happening, let us know.';
  },

  renderPrCard(key) {
    const def = this.prDefs[key];
    const rec = this.getRecord(key);
    const rank = this.ranks[key];

    let valueHtml;
    if (!rec) {
      valueHtml = `<div class="pr-card-value empty">Tap to log</div>`;
    } else if (def.type === 'time') {
      valueHtml = `<div class="pr-card-value">${fmtTime(rec.value)}</div>`;
    } else {
      const formatted = def.type === 'decimal' ? rec.value.toFixed(1).replace(/\.0$/,'') : rec.value;
      valueHtml = `<div class="pr-card-value">${formatted}<span class="pr-card-unit">${def.unit}</span></div>`;
    }

    const dateHtml = rec && rec.date ? `<div class="pr-card-date">PR set ${fmtPrDate(rec.date)}</div>` : '';

    let rankHtml = '';
    if (rec && rank != null) {
      const elite = rank <= 10;
      rankHtml = `<div class="pr-card-rank ${elite ? 'elite' : ''}"><span class="material-icons">${elite ? 'workspace_premium' : 'leaderboard'}</span>Top ${rank}%</div>`;
    } else if (!rec) {
      rankHtml = `<div class="pr-card-rank empty">Not logged</div>`;
    }

    return `
      <div class="pr-card" onclick="FitnessStats.openPrEdit('${key}')">
        <div class="pr-card-head">
          <div class="pr-card-icon"><span class="material-icons">${def.icon}</span></div>
          <div class="pr-card-name">${def.name}</div>
          <button class="pr-card-edit" onclick="event.stopPropagation(); FitnessStats.openPrEdit('${key}')" aria-label="Edit"><span class="material-icons">edit</span></button>
        </div>
        ${valueHtml}
        ${dateHtml}
        ${rankHtml}
      </div>
    `;
  },

  renderMilestones() {
    // v81 — Each milestone carries current/target progress for transparency.
    // Streak Builder is its own featured card on the Bio Age tab (not in this grid).
    const logs = (typeof LOGS !== 'undefined' ? LOGS : []);
    const r = this.records;
    const p = this.profile;
    const dlRatio = (r.deadlift1RM && p.weight) ? r.deadlift1RM.value / p.weight : 0;
    const sportCount = new Set(logs.map(l => l.activity)).size;
    const cityCount  = new Set(logs.map(l => l.city)).size;
    const bfHealthyMax = p.gender === 'male' ? 18 : 25;
    // v82 — Sleep is computed from sleepLogs
    const sleepRec = this.getRecord('sleepAvgHrs');
    const sleepGood = sleepRec && sleepRec.value >= 7 && sleepRec.value <= 9 ? 1 : 0;

    const milestones = [
      // Activity-based — sourced from your activity logs
      { name: '10 Activities',  desc: 'Log 10 activities',          icon: 'flag',           current: logs.length,  target: 10, source: 'Counts from your activity logs' },
      { name: '5 Sport Types',  desc: 'Try 5 different sports',     icon: 'sports',         current: sportCount,   target: 5,  source: 'Unique activity names in your logs' },
      { name: 'Multi-City',     desc: 'Train in 3+ cities',         icon: 'public',         current: cityCount,    target: 3,  source: 'Unique cities in your activity logs' },
      // PR-based — sourced from the Records tab values
      { name: 'Strong as an Ox',desc: 'Deadlift 2× bodyweight',     icon: 'fitness_center', current: dlRatio,      target: 2,  source: 'From your deadlift PR ÷ weight', decimals: 2, unit: '×' },
      { name: 'Half Marathoner',desc: 'Log a 21K PR',               icon: 'directions_run', current: r.run21K  ? 1 : 0, target: 1,  source: 'Manual entry on the Records tab', binary: true },
      { name: 'Marathon Club',  desc: 'Log a Marathon PR',          icon: 'emoji_events',   current: r.runMara ? 1 : 0, target: 1,  source: 'Manual entry on the Records tab', binary: true },
      { name: 'VO₂ Elite',      desc: 'VO₂ max above 50',           icon: 'favorite',       current: r.vo2max ? r.vo2max.value : 0, target: 50, source: 'From your VO₂ record', decimals: 1 },
      { name: 'Healthy Heart',  desc: `Body fat under ${bfHealthyMax}%`, icon: 'monitor_weight', current: r.bodyFat && r.bodyFat.value <= bfHealthyMax ? 1 : 0, target: 1, source: 'From your body fat record', binary: true },
      { name: 'Well-Rested',    desc: 'Sleep avg 7–9 hrs',         icon: 'bedtime',        current: sleepGood, target: 1, source: 'From your nightly sleep logs', binary: true }
    ];

    document.getElementById('achievements-grid').innerHTML = milestones.map(m => {
      const unlocked = m.current >= m.target;
      const pct = Math.min(100, Math.max(0, (m.current / m.target) * 100));
      let progressText;
      if (m.binary) progressText = unlocked ? 'Unlocked' : 'Not yet';
      else if (m.decimals) progressText = `${(+m.current).toFixed(m.decimals)}${m.unit || ''} / ${m.target}${m.unit || ''}`;
      else progressText = `${m.current} / ${m.target}`;
      return `
        <div class="achievement ${unlocked ? 'unlocked' : 'locked'}" title="${escHtml(m.source)}">
          <div class="achievement-icon"><span class="material-icons">${m.icon}</span></div>
          <div class="achievement-name">${escHtml(m.name)}</div>
          <div class="achievement-desc">${escHtml(m.desc)}</div>
          <div class="achievement-count">${progressText}</div>
          <div class="achievement-progress"><div class="achievement-progress-fill" style="width:${pct}%;"></div></div>
        </div>
      `;
    }).join('');
    const unlockedCount = milestones.filter(m => m.current >= m.target).length;
    document.getElementById('ms-unlocked-count').textContent = `${unlockedCount} of ${milestones.length} unlocked`;
  },

  // ─────────── PR EDIT MODAL ───────────
  openPrEdit(key) {
    // v82 — Sleep has its own dedicated modal (daily input, computed average)
    if (key === 'sleepAvgHrs') {
      this.openSleepLog();
      return;
    }
    const def = this.prDefs[key];
    const rec = this.records[key];
    this._editKey = key;
    document.getElementById('pe-icon').textContent = def.icon;
    document.getElementById('pe-name').textContent = def.name;
    document.getElementById('pe-sub').textContent  = rec ? `Current: ${this.formatRecValue(key)} · PR set ${fmtPrDate(rec.date)}` : 'No record logged yet';

    if (def.type === 'time') {
      // v319: single-tap H/M/S SCROLL WHEEL (platform-standard, shared FFPDurationPicker) — no box grid.
      var curT = rec ? rec.value : (key === 'runMara' ? 14400 : key === 'run21K' ? 7200 : key === 'bronco' ? 300 : 1800);
      var selfPE = this;
      if (window.FFPDurationPicker && typeof window.FFPDurationPicker.open === 'function') {
        window.FFPDurationPicker.open(curT, function (r) {
          var total = (r && r.total) || 0;
          if (total <= 0) return;
          selfPE._editKey = key;
          selfPE._editH = Math.floor(total / 3600);
          selfPE._editM = Math.floor((total % 3600) / 60);
          selfPE._editS = total % 60;
          selfPE.savePr();
        });
        return; // wheel handles input + save; the box-grid modal never opens
      }
      // fallback (picker not loaded): legacy box grid
      document.getElementById('pe-time-row').style.display = '';
      document.getElementById('pe-number-row').style.display = 'none';
      const total = rec ? rec.value : (key === 'run21K' || key === 'runMara' ? 3600 : 1800);
      this._editH = Math.floor(total / 3600);
      this._editM = Math.floor((total % 3600) / 60);
      this._editS = total % 60;
      document.getElementById('pe-time-h').value = this._editH;
      document.getElementById('pe-time-m').value = this._editM;
      document.getElementById('pe-time-s').value = this._editS;
    } else {
      // Show number row, hide time
      document.getElementById('pe-time-row').style.display = 'none';
      document.getElementById('pe-number-row').style.display = '';
      document.getElementById('pe-number-label').textContent = def.name;
      document.getElementById('pe-number-unit').textContent  = def.unit;
      this._editValue = rec ? rec.value : (def.step || 1);
      document.getElementById('pe-number-input').value = this._editValue;
      document.getElementById('pe-number-typed').value = '';
    }
    document.getElementById('pe-clear').style.display = rec ? '' : 'none';
    document.getElementById('pr-edit-backdrop').classList.add('open');
  },

  formatRecValue(key) {
    const def = this.prDefs[key];
    const rec = this.records[key];
    if (!rec) return '—';
    if (def.type === 'time') return fmtTime(rec.value);
    if (def.type === 'decimal') return `${rec.value.toFixed(1).replace(/\.0$/,'')} ${def.unit}`;
    return `${rec.value} ${def.unit}`;
  },

  closePrEdit() {
    document.getElementById('pr-edit-backdrop').classList.remove('open');
  },

  adjPr(deltaSign) {
    const def = this.prDefs[this._editKey];
    if (!def) return;
    const step = def.step || 1;
    this._editValue = Math.max(0, Math.min(def.max || 999, this._editValue + (step * deltaSign)));
    // Trim float artifacts
    this._editValue = Math.round(this._editValue * 10) / 10;
    document.getElementById('pe-number-input').value = this._editValue;
    document.getElementById('pe-number-typed').value = '';
  },

  setPrFromInput(value) {
    const def = this.prDefs[this._editKey];
    if (!def) return;
    const n = parseFloat(value);
    if (isNaN(n)) return;
    this._editValue = Math.max(0, Math.min(def.max || 999, n));
    document.getElementById('pe-number-input').value = this._editValue;
  },

  adjTime(field, delta) {
    if (field === 'h') this._editH = Math.max(0, Math.min(23, this._editH + delta));
    if (field === 'm') this._editM = Math.max(0, Math.min(59, this._editM + delta));
    if (field === 's') this._editS = Math.max(0, Math.min(59, this._editS + delta));
    document.getElementById('pe-time-h').value = this._editH;
    document.getElementById('pe-time-m').value = this._editM;
    document.getElementById('pe-time-s').value = this._editS;
  },

  // v229 — records / health / weight / sleep now save STRAIGHT from the core (like activity logs),
  // via the member_profile_meta_save RPC. No reliance on the lazy fitness-stats loader.
  _prCol: {
    bench1RM:'pr_bench_kg', squat1RM:'pr_squat_kg', deadlift1RM:'pr_deadlift_kg',
    run5K:'pr_5k_seconds', run10K:'pr_10k_seconds', run21K:'pr_21k_seconds', runMara:'pr_marathon_sec', swim1K:'pr_swim1k_sec',
    bronco:'pr_bronco_sec', beepTest:'beep_test_level',
    vo2max:'vo2_max', bodyFat:'body_fat_pct', visceralFat:'visceral_fat', restingHR:'resting_hr', maxHR:'max_hr', hrv:'hrv_ms',
    grip:'grip_strength_kg', muscleMass:'muscle_mass_kg', waist:'waist_cm', weight:'current_weight_kg'
  },
  _prInt: { run5K:1, run10K:1, run21K:1, runMara:1, swim1K:1, bronco:1, restingHR:1, maxHR:1, hrv:1, visceralFat:1 },
  // Member Max HR: their SET value if any, else the 220 − age estimate. Single source for all HR-zone maths.
  getMaxHR() {
    var r = this.records && this.records.maxHR;
    if (r && r.value != null && Number(r.value) > 0 && !r.estimated) return Number(r.value);
    if (r && r.value != null && Number(r.value) > 0) return Number(r.value);   // estimate stored as a record
    var age = (this.profile && this.profile.chronAge) || 0;
    return age > 0 ? (220 - age) : 190;
  },
  _saveMeta(patch, prKey, prDate) {
    try {
      var m = (window.FFPAuth && FFPAuth.getMember && FFPAuth.getMember()) || null;
      if (!m || !m.id || !window.supabase) { console.warn('[FFP FS] not signed in — save skipped'); return; }
      window.supabase.rpc('member_profile_meta_save', {
        p_me: m.id, p_patch: patch || {},
        p_pr_date_key: prKey || null, p_pr_date_val: (prDate !== undefined ? prDate : null)
      }).then(function (res) { if (res && res.error) console.error('[FFP FS] save error:', res.error.message); })
        .catch(function (e) { console.error('[FFP FS] save threw:', e); });
    } catch (e) { console.error('[FFP FS] save threw:', e); }
  },

  clearPr() {
    if (!this._editKey) return;
    if (!confirm('Clear this record?')) return;
    var key = this._editKey;
    this.records[key] = null;
    this.closePrEdit();
    this.render();
    showToast('Record cleared');
    var col = this._prCol[key];
    if (col) { var p = {}; p[col] = null; this._saveMeta(p, key, null); }
  },

  savePr() {
    if (!this._editKey) return;
    const def = this.prDefs[this._editKey];
    const today = new Date().toISOString().slice(0,10);
    const key = this._editKey;
    let value;
    if (def.type === 'time') {
      value = this._editH * 3600 + this._editM * 60 + this._editS;
      if (value <= 0) { showToast('Enter a valid time'); return; }
    } else {
      value = this._editValue;
      if (value <= 0) { showToast('Enter a valid value'); return; }
    }
    this.records[key] = { value, date: today };
    this.closePrEdit();
    this.render();
    showToast(`${def.name} record saved`);
    var col = this._prCol[key];
    if (col) { var v = this._prInt[key] ? Math.round(value) : value; var p = {}; p[col] = v; this._saveMeta(p, key, today); }
  },

  // ─────────── SLEEP LOG MODAL ───────────
  // v82 — Members log hours per night; the system computes the rolling 7-night average.
  _sleepEditDaysAgo: 1,
  _sleepEditHours:   0,

  openSleepLog() {
    this._sleepEditDaysAgo = 1;
    this._sleepEditHours = typeof this.sleepLogs[1] === 'number' ? this.sleepLogs[1] : 7.5;
    this.renderSleepModal();
    document.getElementById('sleep-log-backdrop').classList.add('open');
  },

  closeSleepLog() {
    document.getElementById('sleep-log-backdrop').classList.remove('open');
  },

  renderSleepModal() {
    const avg = this.getSleepAvg();
    document.getElementById('sl-avg').textContent = avg != null ? avg.toFixed(1) : '—';

    // Focused-night label
    const d = this._sleepEditDaysAgo;
    const label = d === 1 ? 'Last night' : `${d} nights ago`;
    document.getElementById('sl-edit-label').textContent = label;
    document.getElementById('sl-hours').value = this._sleepEditHours.toFixed(1);

    // Recent nights list (14 days)
    const dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let html = '';
    for (let n = 1; n <= 14; n++) {
      const hrs = this.sleepLogs[n];
      const dDate = new Date(Date.now() - n * 86400000);
      const dayName = dayShort[dDate.getDay()];
      const date = dDate.getDate();
      const cls = n === this._sleepEditDaysAgo ? 'sleep-row active' : 'sleep-row';
      const subLabel = n === 1 ? 'Last night' : `${n} nights ago`;
      const hoursDisplay = typeof hrs === 'number'
        ? `<span class="sleep-row-hours">${hrs.toFixed(1)} hrs</span>`
        : `<span class="sleep-row-hours empty">Not logged</span>`;
      html += `
        <div class="${cls}" onclick="FitnessStats.focusSleepNight(${n})">
          <span class="sleep-row-day">${dayName} ${date}<span class="sub">${subLabel}</span></span>
          ${hoursDisplay}
        </div>
      `;
    }
    document.getElementById('sl-list').innerHTML = html;
  },

  adjSleep(delta) {
    this._sleepEditHours = Math.max(0, Math.min(14, this._sleepEditHours + delta));
    this._sleepEditHours = Math.round(this._sleepEditHours * 10) / 10;
    document.getElementById('sl-hours').value = this._sleepEditHours.toFixed(1);
  },

  // Tap a different night in the list — save current edit, then switch focus
  focusSleepNight(daysAgo) {
    // Persist the in-progress edit to the previous night before switching
    this.sleepLogs[this._sleepEditDaysAgo] = this._sleepEditHours;
    this._sleepEditDaysAgo = daysAgo;
    this._sleepEditHours = typeof this.sleepLogs[daysAgo] === 'number' ? this.sleepLogs[daysAgo] : 7.5;
    this.renderSleepModal();
  },

  saveSleepLog() {
    // Save the currently focused night
    this.sleepLogs[this._sleepEditDaysAgo] = this._sleepEditHours;
    const newAvg = this.getSleepAvg();
    this.closeSleepLog();
    this.render();
    showToast(`Sleep saved — ${newAvg.toFixed(1)} hr avg`);
    // persist via RPC (daysAgo → date map) — like activity logs, straight from the core
    var dbShape = {}, self = this;
    Object.keys(this.sleepLogs).forEach(function (k) {
      var n = Number(k), hrs = Number(self.sleepLogs[k]);
      if (isNaN(n) || isNaN(hrs)) return;
      var d = new Date(); d.setDate(d.getDate() - n);
      var ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      dbShape[ds] = hrs;
    });
    this._saveMeta({ sleep_logs: dbShape }, null, null);
  }
};
window.FitnessStats = FitnessStats;

// ── Global HR-zone helpers ─────────────────────────────────────────────────────────────────────
// Used by the activity card + share card (which live in the dashboard, outside this module) so zone
// bpm ranges are computed ONE way everywhere. Model = % of Max HR (Garmin's default 5-zone scheme).
// Max HR = the member's SET value (Fitness Stats › Bio Age) if any, else 220 − age from their DOB.
window.ffpMemberMaxHR = function () {
  try {
    var fs = window.FitnessStats;
    if (fs && fs.records && fs.records.maxHR && Number(fs.records.maxHR.value) > 0 && !fs.records.maxHR.estimated) return Number(fs.records.maxHR.value);
    var m = (window.FFPAuth && FFPAuth.getMember && FFPAuth.getMember()) || null;
    var age = 0;
    if (m && m.date_of_birth) { var d = new Date(m.date_of_birth); if (!isNaN(d)) { var t = new Date(); age = t.getFullYear() - d.getFullYear(); var mo = t.getMonth() - d.getMonth(); if (mo < 0 || (mo === 0 && t.getDate() < d.getDate())) age--; } }
    if (!age && fs && fs.profile && fs.profile.chronAge) age = fs.profile.chronAge;
    return age > 0 ? (220 - age) : 190;
  } catch (e) { return 190; }
};
window.ffpHrZones = function (maxHR) {
  var mx = Number(maxHR != null ? maxHR : (window.ffpMemberMaxHR ? window.ffpMemberMaxHR() : 0));
  if (!mx || mx <= 0) return null;
  function b(p) { return Math.round(mx * p); }
  return [
    { z: 1, name: 'Warm Up',   lo: b(0.50), hi: b(0.60), color: '#3aa0e6' },
    { z: 2, name: 'Easy',      lo: b(0.60), hi: b(0.70), color: '#16a34a' },
    { z: 3, name: 'Aerobic',   lo: b(0.70), hi: b(0.80), color: '#eab308' },
    { z: 4, name: 'Threshold', lo: b(0.80), hi: b(0.90), color: '#f59e0b' },
    { z: 5, name: 'Maximum',   lo: b(0.90), hi: mx,      color: '#dc2626' }
  ];
};

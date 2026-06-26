/* FFP Calorie Tracker CORE — v1 (2026-06-06)
   Extracted verbatim from ffp-member-dashboard.html (the CalorieTracker object). Loaded DEFERRED so it
   never blocks boot; runs before DOMContentLoaded, and the boot init is DOMContentLoaded-gated + guarded
   (if (window.CalorieTracker) ...). Helper globals it uses (FOOD_DB, FOOD_CATS, ACTIVITY_CAT_META,
   KCAL_PER_KG_FAT, showToast, escHtml) stay inline in the dashboard and are defined before this runs.
   The lazy assets/ffp-calorie-tracker-loader.js still overrides its methods by name. */
const CalorieTracker = {
  // v78 — Goal: currentWeight → targetWeight over targetWeeks. activity tunes maintenance.
  currentWeight: 0,   // kg — where you are now
  targetWeight: 0,    // kg — where you want to be
  targetWeeks: 0,     // weeks to get there (derived from targetDate; still drives the kcal math)
  targetDate: null,   // 'yyyy-mm-dd' — the date to hit the goal by (source of truth for the UI)
  activity: 'mod',     // 'low' / 'mod' / 'high' — for maintenance calc
  
  tab: 'today',        // 'today' | 'week'
  
  // Today's meals — sample
  meals: {
    breakfast: [],
    lunch:     [],
    dinner:    [],
    snacks:    []
  },
  
  // Today's activities. Each entry stores the picked activity name + category-derived icon.
  activities: [],
  _nextActId: 1,
  
  // Past 6 days sample data (week is Mon-Sun, today is Sun in this sample)
  weekHistory: [],
  
  // v79 — Last 30 days sample data. Last 6 days line up with weekHistory above.
  // 29 days ago → 1 day ago. Today is appended dynamically.
  monthHistory: [],
  
  // Food picker / food add state
  _pickerSearch: '',
  _pickerCat: 'All',
  _pickerTab: 'foods',   // 'foods' | 'mymeals'
  _addingFood: null,
  _addingAmount: 100,
  _addingMeal: 'breakfast',  // v78 — meal selected inside food-add modal
  _pickerMeal: 'breakfast',  // v9 — the bucket the inline segmented control points at (governs quick-add + recents)

  // v9 — Recents (unique foods from the last 30 days of food_logs). Populated by the loader; [] in sample mode.
  recents: [],

  // v10 (P2) — date browsing + edit + quick-add state
  viewDate: null,        // the day being viewed/logged on the Today tab (local midnight Date). null → today.
  _editRemove: null,     // { mealKey, idx } of an item being edited (we re-add the new version, then remove old)
  _quickMeal: 'breakfast', // meal the quick-add modal logs into
  
  // Activity add state
  _activityAdding: null,
  
  init() {
    document.getElementById('cal-today-date') && (document.getElementById('cal-today-date').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'short' }));
    document.getElementById('fp-search').addEventListener('input', e => {
      this._pickerSearch = e.target.value.toLowerCase();
      this.renderFoodList();
    });
    // Category chips for food picker (rebuilds from the live FOOD_CATS, grouped)
    this._renderFoodCats();
    // v78 — Meal type chips inside food-add modal
    document.querySelectorAll('#fa-meal-chips .meal-type-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#fa-meal-chips .meal-type-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._addingMeal = btn.dataset.meal;
        var cb = document.getElementById('fa-confirm-btn');
        if (cb && !this._editRemove) cb.innerHTML = 'Add to <span id="fa-meal-name">' + btn.dataset.meal + '</span>';
      });
    });
    // Today/Week/Month tab switching
    document.querySelectorAll('#ct-tabs .tabs-underline-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#ct-tabs .tabs-underline-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tab = btn.dataset.ctTab;
        document.getElementById('ct-today-view').style.display = this.tab === 'today' ? '' : 'none';
        document.getElementById('ct-week-view').style.display  = this.tab === 'week'  ? '' : 'none';
        document.getElementById('ct-month-view').style.display = this.tab === 'month' ? '' : 'none';
        var _pv = document.getElementById('ct-planner-view'); if (_pv) _pv.style.display = this.tab === 'planner' ? '' : 'none';
        this.render();
      });
    });
    // v79 — Activity picker search input
    document.getElementById('ap-search').addEventListener('input', e => {
      this._activityPickerSearch = e.target.value.toLowerCase();
      this.renderActivityList();
    });
    // Goal config: activity pills
    document.querySelectorAll('#goal-config-backdrop [data-act]').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#goal-config-backdrop [data-act]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.activity = b.dataset.act;
        this.renderGoalConfigResult();
      });
    });
    this.viewDate = this._todayMidnight();   // v10 — Today tab starts on today
    this._renderDateBar();
    this.render();
  },

  // ─────────── DATE BROWSING (Today tab) — v10 ───────────
  _todayMidnight() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; },
  _ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  _isViewingToday() { return !this.viewDate || this._ymd(this.viewDate) === this._ymd(this._todayMidnight()); },
  // ISO timestamp a new log should carry: the viewed day, stamped at the current time-of-day (so today === now)
  _logIso() {
    var v = this.viewDate || new Date();
    var n = new Date();
    return new Date(v.getFullYear(), v.getMonth(), v.getDate(), n.getHours(), n.getMinutes(), n.getSeconds()).toISOString();
  },
  _dateBarLabel() {
    if (this._isViewingToday()) return 'Today';
    var y = this._todayMidnight(); y.setDate(y.getDate() - 1);
    if (this._ymd(this.viewDate) === this._ymd(y)) return 'Yesterday';
    return this.viewDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  },
  _renderDateBar() {
    var lbl = document.getElementById('ct-date-label');
    if (lbl) lbl.textContent = this._dateBarLabel();
    var next = document.getElementById('ct-date-next');
    if (next) {
      var atToday = this._isViewingToday();
      next.style.opacity = atToday ? '0.3' : '1';
      next.style.pointerEvents = atToday ? 'none' : 'auto';
    }
  },
  shiftDay(delta) {
    var d = new Date((this.viewDate || this._todayMidnight()).getTime());
    d.setDate(d.getDate() + delta);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() > this._todayMidnight().getTime()) return;   // never go past today
    this.viewDate = d;
    this._renderDateBar();
    this._loadView();
  },
  goToday() {
    this.viewDate = this._todayMidnight();
    this._renderDateBar();
    this._loadView();
  },
  // Pull the viewed day's meals/activities (loader provides loadDayData; sample mode just re-renders).
  _loadView() {
    if (this.loadDayData) this.loadDayData(this.viewDate);
    else this.render();
  },
  // Copy a previous day's food into the viewed day. Real implementation lives in the loader (needs Supabase);
  // this stub keeps the button safe before the loader has attached.
  openCopyDay() { if (window.showToast) showToast('Connect online to copy a day'); },
  
  // ─────────── ACTIVITY ───────────
  activitiesTotal() { return this.activities.reduce((sum, a) => sum + a.kcal, 0); },
  
  // ─────────── TARGETS ───────────
  // Math:
  //   maintenance = currentWeight × (30 + activityBump)
  //   weight_diff_kg = currentWeight - targetWeight (positive = lose, negative = gain)
  //   daily_change_kcal = (weight_diff_kg × 7700) / (targetWeeks × 7)
  //   daily_target = maintenance - daily_change_kcal  (subtract because positive diff = deficit)
  computeTargets() {
    const actBump = this.activity === 'low' ? 0 : this.activity === 'high' ? 7 : 4;
    const maintenance = Math.round(this.currentWeight * (30 + actBump));
    const weightDiff = this.currentWeight - this.targetWeight;   // +ve = lose
    const dailyChange = this.targetWeeks > 0 ? Math.round((weightDiff * KCAL_PER_KG_FAT) / (this.targetWeeks * 7)) : 0;
    const kcal = Math.max(1200, maintenance - dailyChange);      // floor at 1200 for safety
    // Macros: protein 2.2g/kg of target weight, fat 1.0g/kg, carbs fill the rest
    const p = Math.round(this.targetWeight * 2.2);
    const f = Math.round(this.targetWeight * 1.0);
    const c = Math.max(0, Math.round((kcal - p*4 - f*9) / 4));
    return { kcal, p, c, f, maintenance, dailyChange, weightDiff };
  },
  
  totals() {
    let kcal=0, p=0, c=0, f=0;
    Object.values(this.meals).forEach(arr => arr.forEach(item => {
      if (item && item.free) { kcal += item.kcal||0; p += item.p||0; c += item.c||0; f += item.f||0; return; } // free-form (My Meals / custom)
      const food = FOOD_DB.find(x => x.id === item.foodId);
      if (!food) return;
      const ratio = item.amount / food.serving;
      kcal += food.kcal * ratio;
      p += food.p * ratio;
      c += food.c * ratio;
      f += food.f * ratio;
    }));
    return { kcal:Math.round(kcal), p:Math.round(p), c:Math.round(c), f:Math.round(f) };
  },
  
  mealTotal(mealKey) {
    let k = 0;
    (this.meals[mealKey] || []).forEach(item => {
      if (item && item.free) { k += item.kcal||0; return; } // free-form (My Meals / custom)
      const food = FOOD_DB.find(x => x.id === item.foodId);
      if (food) k += food.kcal * (item.amount / food.serving);
    });
    return Math.round(k);
  },
  
  todayDayStat() {
    return { day: 'Sun', date: 28, intake: this.totals().kcal, burned: this.activitiesTotal(), isToday: true };
  },
  
  weekStats() {
    const target = this.computeTargets().kcal;
    const past = this.weekHistory.map(d => ({...d, isToday:false}));
    const today = this.todayDayStat();
    const allDays = [...past, today];
    let totalNet = 0, totalDeficit = 0, daysLogged = 0;
    allDays.forEach(d => {
      if (d.intake === null || d.intake === undefined) return;
      const net = d.intake - d.burned;
      const deficit = target - net;
      totalNet     += net;
      totalDeficit += deficit;
      daysLogged++;
    });
    const fatGrams = Math.round((totalDeficit / KCAL_PER_KG_FAT) * 1000);
    return { allDays, target, totalNet, totalDeficit, daysLogged, fatGrams };
  },
  
  // ─────────── RENDER ───────────
  render() {
    const t = this.computeTargets();
    if (this.tab === 'today')      this.renderToday(t);
    else if (this.tab === 'week')  this.renderWeek(t);
    else if (this.tab === 'month') this.renderMonth(t);
  },
  
  renderToday(t) {
    const consumed = this.totals();
    const burned   = this.activitiesTotal();
    const net      = consumed.kcal - burned;
    
    // Goal pill text
    const wd = t.weightDiff;
    const verb = wd > 0 ? 'lose' : wd < 0 ? 'gain' : 'maintain';
    const pillText = wd === 0
      ? `Maintain ${this.currentWeight} kg`
      : `${this.currentWeight} kg → ${this.targetWeight} kg by ${this._dateLabel(this._goalIso())}`;
    document.getElementById('ct-goal-pill-text').textContent = pillText;
    
    // Macro target labels
    document.getElementById('cal-protein-goal').textContent = t.p;
    document.getElementById('cal-carbs-goal').textContent = t.c;
    document.getElementById('cal-fat-goal').textContent = t.f;
    document.getElementById('cal-goal-text').textContent = `of ${t.kcal.toLocaleString()} goal`;
    
    // Ring (driven by NET)
    const pct = Math.min(1, Math.max(0, net) / t.kcal);
    const circumference = 2 * Math.PI * 68;
    document.getElementById('cal-ring-fill').style.strokeDashoffset = String(circumference * (1 - pct));
    document.getElementById('cal-net').textContent = net.toLocaleString();
    
    // Breakdown line
    document.getElementById('cal-eaten').textContent  = consumed.kcal.toLocaleString();
    document.getElementById('cal-burned').textContent = burned.toLocaleString();
    const left = t.kcal - net;
    const leftEl = document.getElementById('cal-remaining-text');
    leftEl.textContent = left >= 0 ? `${left.toLocaleString()} left` : `${Math.abs(left).toLocaleString()} over`;
    leftEl.classList.toggle('over', left < 0);
    
    // Macro bars
    document.getElementById('cal-protein').textContent = consumed.p;
    document.getElementById('cal-carbs').textContent   = consumed.c;
    document.getElementById('cal-fat').textContent     = consumed.f;
    document.getElementById('cal-protein-bar').style.width = Math.min(100, (consumed.p / t.p) * 100) + '%';
    document.getElementById('cal-carbs-bar').style.width   = Math.min(100, (consumed.c / t.c) * 100) + '%';
    document.getElementById('cal-fat-bar').style.width     = Math.min(100, (consumed.f / t.f) * 100) + '%';
    
    // Activity section removed (Calorie Tracker is food-only). `burned` is still
    // computed above from Passport activities and used in the net calc below.
    var _ctTot = document.getElementById('ct-activity-total');
    if (_ctTot) _ctTot.textContent = `${burned.toLocaleString()} kcal burned`;
    var _ctItems = document.getElementById('ct-activity-items');
    if (_ctItems) _ctItems.innerHTML = '';
    
    // Food total + meal sections
    document.getElementById('ct-food-total').textContent = `${consumed.kcal.toLocaleString()} kcal eaten`;
    ['breakfast','lunch','dinner','snacks'].forEach(mk => {
      document.getElementById('meal-total-' + mk).textContent = this.mealTotal(mk) + ' kcal';
      const mountEl = document.getElementById('meal-items-' + mk);
      mountEl.innerHTML = (this.meals[mk] || []).length === 0
        ? '<div class="cal-meal-empty">No items</div>'
        : (this.meals[mk] || []).map((item, idx) => {
            if (item && item.free) {
              return `
              <div class="meal-item" style="cursor:pointer;" onclick="CalorieTracker.editItem('${mk}', ${idx})">
                <div class="meal-item-left">
                  <div class="meal-item-name">${escHtml(item.name || 'Meal')}</div>
                  <div class="meal-item-info">${Math.round(item.p||0)}p / ${Math.round(item.c||0)}c / ${Math.round(item.f||0)}f</div>
                </div>
                <div class="meal-item-kcal">${Math.round(item.kcal||0)}</div>
                <button class="meal-item-x" onclick="event.stopPropagation(); CalorieTracker.removeItem('${mk}', ${idx})"><span class="material-icons">close</span></button>
              </div>`;
            }
            const food = FOOD_DB.find(x => x.id === item.foodId);
            if (!food) return '';
            const ratio = item.amount / food.serving;
            return `
              <div class="meal-item" style="cursor:pointer;" onclick="CalorieTracker.editItem('${mk}', ${idx})">
                <div class="meal-item-left">
                  <div class="meal-item-name">${escHtml(food.name)}</div>
                  <div class="meal-item-info">${item.amount} ${food.unit} &middot; ${Math.round(food.p * ratio)}p / ${Math.round(food.c * ratio)}c / ${Math.round(food.f * ratio)}f</div>
                </div>
                <div class="meal-item-kcal">${Math.round(food.kcal * ratio)}</div>
                <button class="meal-item-x" onclick="event.stopPropagation(); CalorieTracker.removeItem('${mk}', ${idx})"><span class="material-icons">close</span></button>
              </div>
            `;
          }).join('');
    });
  },
  
  renderWeek(t) {
    const stats = this.weekStats();
    const summaryEl = document.getElementById('ct-week-summary');
    const deficit = stats.totalDeficit;
    const fatG = stats.fatGrams;
    summaryEl.classList.toggle('over', deficit < 0);
    document.getElementById('ct-week-deficit').textContent = (deficit >= 0 ? '-' : '+') + Math.abs(deficit).toLocaleString() + ' kcal';
    document.querySelector('#ct-week-summary .ct-week-label').textContent = deficit >= 0 ? 'net deficit' : 'net surplus';
    document.getElementById('ct-week-fat-num').textContent = `\u2248 ${Math.abs(fatG).toLocaleString()} g`;
    document.getElementById('ct-week-fat-label').textContent = fatG >= 0 ? 'estimated fat loss' : 'estimated fat gain';
    document.getElementById('ct-week-fat-icon').textContent = fatG >= 0 ? 'trending_down' : 'trending_up';
    document.getElementById('ct-week-meta').textContent = `${stats.daysLogged} of 7 days logged this week`;
    
    // 7-day chart (chronological Mon-Sun)
    const barsEl = document.getElementById('ct-chart-bars');
    const labelsEl = document.getElementById('ct-chart-labels');
    const peak = Math.max(...stats.allDays.map(d => (d.intake || 0)), t.kcal) * 1.1;
    barsEl.innerHTML = stats.allDays.map(d => {
      const intake = d.intake || 0;
      const net = intake - (d.burned || 0);
      const hPct = (net / peak) * 100;
      let cls = 'empty';
      if (intake > 0) {
        if (net < t.kcal * 0.95)      cls = 'under';
        else if (net > t.kcal * 1.05) cls = 'over';
        else                          cls = 'on';
      }
      if (d.isToday) cls += ' today';
      return `
        <div class="ct-chart-bar-wrap">
          <div class="ct-chart-bar ${cls}" style="height: ${intake > 0 ? hPct : 2}%;" title="${d.day}: ${net.toLocaleString()} net kcal"></div>
        </div>
      `;
    }).join('');
    const targetPct = (t.kcal / peak) * 100;
    barsEl.insertAdjacentHTML('beforeend', `
      <div class="ct-chart-target-line" style="bottom: ${targetPct}%;"></div>
      <div class="ct-chart-target-label" style="bottom: calc(${targetPct}% + 2px);">target ${t.kcal.toLocaleString()}</div>
    `);
    labelsEl.innerHTML = stats.allDays.map(d => `
      <div class="ct-chart-label ${d.isToday ? 'today' : ''}">
        <span class="day">${d.day}</span>
        <span class="date">${d.date}</span>
      </div>
    `).join('');
    
    // Daily breakdown — TODAY FIRST, then prior days descending
    const todayIdx = stats.allDays.findIndex(d => d.isToday);
    const today = stats.allDays[todayIdx];
    const past  = stats.allDays.filter((d, i) => i < todayIdx);  // before today this week
    const future = stats.allDays.filter((d, i) => i > todayIdx); // after today (likely empty until Monday next week)
    const ordered = [today, ...past.slice().reverse(), ...future];
    
    document.getElementById('ct-week-list').innerHTML = ordered.map(d => {
      const intake = d.intake || 0;
      const burned = d.burned || 0;
      const net = intake - burned;
      const dailyDeficit = t.kcal - net;
      let status, statusCls;
      if (intake === 0) { status = 'No log'; statusCls = 'empty'; }
      else if (dailyDeficit > 50)  { status = `${dailyDeficit.toLocaleString()} under`; statusCls = 'under'; }
      else if (dailyDeficit < -50) { status = `${Math.abs(dailyDeficit).toLocaleString()} over`; statusCls = 'over'; }
      else { status = 'On target'; statusCls = 'on'; }
      const dayLabel = d.isToday ? 'Today' : d.day;
      return `
        <div class="ct-week-day-row ${d.isToday ? 'is-today' : ''}">
          <div class="ct-week-day-label">${dayLabel}<span class="date">${d.day} ${d.date} Mar</span></div>
          <div class="ct-week-day-info">
            ${intake === 0 ? '—' : `<span class="b">${intake.toLocaleString()}</span> eaten &middot; <span class="b">${burned.toLocaleString()}</span> burned`}
          </div>
          <div class="ct-week-day-status ${statusCls}">${status}</div>
        </div>
      `;
    }).join('');
  },
  
  // v79 — 30-day stats: 29 historical days + today
  monthStats() {
    const target = this.computeTargets().kcal;
    const past = this.monthHistory.map(d => ({...d, isToday:false}));
    const today = { idx:0, intake: this.totals().kcal, burned: this.activitiesTotal(), isToday:true };
    const allDays = [...past, today];
    let totalDeficit = 0, daysLogged = 0;
    allDays.forEach(d => {
      if (!d.intake) return;
      const net = d.intake - d.burned;
      totalDeficit += (target - net);
      daysLogged++;
    });
    const fatGrams = Math.round((totalDeficit / KCAL_PER_KG_FAT) * 1000);
    return { allDays, target, totalDeficit, daysLogged, fatGrams };
  },
  
  renderMonth(t) {
    const stats = this.monthStats();
    const deficit = stats.totalDeficit;
    const fatG = stats.fatGrams;
    const summaryEl = document.getElementById('ct-month-summary');
    summaryEl.classList.toggle('over', deficit < 0);
    document.getElementById('ct-month-deficit').textContent = (deficit >= 0 ? '-' : '+') + Math.abs(deficit).toLocaleString() + ' kcal';
    document.querySelector('#ct-month-summary .ct-week-label').textContent = deficit >= 0 ? 'net deficit' : 'net surplus';
    // Show kg if > 500g, else just grams
    const fatAbs = Math.abs(fatG);
    const fatDisplay = fatAbs >= 500 ? `\u2248 ${(fatAbs / 1000).toFixed(1)} kg` : `\u2248 ${fatAbs.toLocaleString()} g`;
    document.getElementById('ct-month-fat-num').textContent = fatDisplay;
    document.getElementById('ct-month-fat-label').textContent = fatG >= 0 ? 'estimated fat loss' : 'estimated fat gain';
    document.getElementById('ct-month-fat-icon').textContent = fatG >= 0 ? 'trending_down' : 'trending_up';
    document.getElementById('ct-month-meta').textContent = `${stats.daysLogged} of 30 days logged`;
    
    // 30 thin bars
    const barsEl = document.getElementById('ct-month-bars');
    const peak = Math.max(...stats.allDays.map(d => (d.intake || 0)), t.kcal) * 1.1;
    barsEl.innerHTML = stats.allDays.map(d => {
      const intake = d.intake || 0;
      const net = intake - (d.burned || 0);
      const hPct = (net / peak) * 100;
      let cls = 'empty';
      if (intake > 0) {
        if (net < t.kcal * 0.95)      cls = 'under';
        else if (net > t.kcal * 1.05) cls = 'over';
        else                          cls = 'on';
      }
      if (d.isToday) cls += ' today';
      return `<div class="ct-chart-bar-wrap"><div class="ct-chart-bar ${cls}" style="height: ${intake > 0 ? hPct : 2}%;" title="${intake > 0 ? net.toLocaleString() + ' net kcal' : 'no log'}"></div></div>`;
    }).join('');
    const targetPct = (t.kcal / peak) * 100;
    barsEl.insertAdjacentHTML('beforeend', `
      <div class="ct-chart-target-line" style="bottom: ${targetPct}%;"></div>
      <div class="ct-chart-target-label" style="bottom: calc(${targetPct}% + 2px);">target ${t.kcal.toLocaleString()}</div>
    `);
    
    // 4 weekly stat boxes (each = 7-day chunk; week 4 = current week-to-date)
    const weeks = [];
    for (let w = 0; w < 4; w++) {
      // Week 0 = oldest (days -29 to -23), Week 3 = current (days -6 to today)
      const start = -29 + (w * 7);
      const end   = start + 6;
      const slice = stats.allDays.filter(d => d.idx >= start && d.idx <= end);
      let weekDeficit = 0, logged = 0;
      slice.forEach(d => {
        if (!d.intake) return;
        weekDeficit += (t.kcal - (d.intake - d.burned));
        logged++;
      });
      const wFatG = Math.round((weekDeficit / KCAL_PER_KG_FAT) * 1000);
      weeks.push({ label:`Week ${w+1}`, fatG: wFatG, logged, isCurrent: w === 3 });
    }
    document.getElementById('ct-month-weeks').innerHTML = weeks.map(w => {
      const cls = w.logged === 0 ? 'empty' : (w.fatG >= 0 ? '' : 'over');
      const valTxt = w.logged === 0 ? '—' : (w.fatG >= 0 ? '-' + w.fatG : '+' + Math.abs(w.fatG)) + ' g';
      return `
        <div class="ct-month-week-box ${w.isCurrent ? 'is-current' : ''}">
          <div class="ct-month-week-box-label">${w.label}</div>
          <div class="ct-month-week-box-value ${cls}">${valTxt}</div>
          <div class="ct-month-week-box-sub">${w.logged}/7 days</div>
        </div>
      `;
    }).join('');
  },
  
  // ─────────── ACTIVITY LOGGING ───────────
  // v79 — Two-step flow matching food logger: picker → duration/kcal modal.
  
  // State for the picker
  _activityPickerSearch: '',
  _activityPickerCat: 'All',
  
  // Open the picker (called from "+ Log activity" button)
  openActivityLog() {
    this._activityPickerSearch = '';
    this._activityPickerCat = 'All';
    document.getElementById('ap-search').value = '';
    // Render category chips
    const cats = ['All', ...Object.keys(ACTIVITY_CAT_META)];
    document.getElementById('ap-cats').innerHTML = cats.map((c,i) =>
      `<button class="food-picker-cat ${i===0?'active':''}" data-acat="${escHtml(c)}">${escHtml(c)}</button>`
    ).join('');
    document.querySelectorAll('#ap-cats .food-picker-cat').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#ap-cats .food-picker-cat').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._activityPickerCat = btn.dataset.acat;
        this.renderActivityList();
      };
    });
    this.renderActivityList();
    document.getElementById('activity-picker-backdrop').classList.add('open');
  },
  
  closeActivityPicker() {
    document.getElementById('activity-picker-backdrop').classList.remove('open');
  },
  
  renderActivityList() {
    let items = ACTIVITIES_DB.slice();
    if (this._activityPickerCat !== 'All') items = items.filter(a => a.c === this._activityPickerCat);
    if (this._activityPickerSearch) {
      const q = this._activityPickerSearch;
      items = items.filter(a => a.n.toLowerCase().includes(q) || a.c.toLowerCase().includes(q));
    }
    if (items.length === 0) {
      document.getElementById('ap-list').innerHTML = '<div class="feed-empty">No activities match.</div>';
      return;
    }
    document.getElementById('ap-list').innerHTML = items.map((a, idx) => {
      const meta = ACTIVITY_CAT_META[a.c] || { icon:'fitness_center' };
      const rate = kcalPerMinForActivity(a);
      return `
        <div class="activity-row" onclick="CalorieTracker.pickActivity(${idx})" data-cat="${escHtml(a.c)}" data-name="${escHtml(a.n)}">
          <div class="activity-row-icon"><span class="material-icons">${meta.icon}</span></div>
          <div class="activity-row-info">
            <div class="activity-row-name">${escHtml(a.n)}</div>
            <div class="activity-row-cat">${escHtml(a.c)}</div>
          </div>
          <div class="activity-row-kcal">${rate} kcal/min</div>
        </div>
      `;
    }).join('');
  },
  
  // Picker → activity-add modal
  pickActivity(idx) {
    let items = ACTIVITIES_DB.slice();
    if (this._activityPickerCat !== 'All') items = items.filter(a => a.c === this._activityPickerCat);
    if (this._activityPickerSearch) {
      const q = this._activityPickerSearch;
      items = items.filter(a => a.n.toLowerCase().includes(q) || a.c.toLowerCase().includes(q));
    }
    const activity = items[idx];
    if (!activity) return;
    const meta = ACTIVITY_CAT_META[activity.c] || { icon:'fitness_center' };
    const rate = kcalPerMinForActivity(activity);
    const defaultDur = 30;
    this._activityAdding = {
      name: activity.n,
      category: activity.c,
      icon: meta.icon,
      kcalPerMin: rate,
      duration: defaultDur,
      kcal: rate * defaultDur
    };
    // Populate the activity-add modal
    document.getElementById('aa2-icon').textContent = meta.icon;
    document.getElementById('aa2-name').textContent = activity.n;
    document.getElementById('aa2-sub').textContent = `${activity.c} · ~${rate} kcal/min`;
    document.getElementById('aa2-duration').value = defaultDur;
    document.getElementById('aa2-kcal').value = rate * defaultDur;
    this.closeActivityPicker();
    document.getElementById('activity-add-backdrop').classList.add('open');
  },
  
  closeActivityAdd() {
    document.getElementById('activity-add-backdrop').classList.remove('open');
  },
  
  adjActivityField(field, delta) {
    if (!this._activityAdding) return;
    if (field === 'duration') {
      this._activityAdding.duration = Math.max(5, Math.min(240, this._activityAdding.duration + delta));
      this._activityAdding.kcal = Math.round(this._activityAdding.kcalPerMin * this._activityAdding.duration);
      document.getElementById('aa2-duration').value = this._activityAdding.duration;
      document.getElementById('aa2-kcal').value = this._activityAdding.kcal;
    } else if (field === 'kcal') {
      this._activityAdding.kcal = Math.max(0, Math.min(3000, this._activityAdding.kcal + delta));
      document.getElementById('aa2-kcal').value = this._activityAdding.kcal;
    }
  },
  
  confirmAddActivity() {
    if (!this._activityAdding) return;
    const a = this._activityAdding;
    this.activities.push({
      id: this._nextActId++,
      name: a.name,
      category: a.category,
      icon: a.icon,
      duration: a.duration,
      kcal: a.kcal
    });
    this._activityAdding = null;
    this.closeActivityAdd();
    showToast(`Logged ${a.name} (${a.duration} min)`);
    this.render();
    // PRODUCTION: POST /api/members/me/activities
  },
  
  removeActivity(id) {
    this.activities = this.activities.filter(a => a.id !== id);
    this.render();
  },
  
  removeItem(mealKey, idx) {
    this.meals[mealKey].splice(idx, 1);
    this.render();
  },
  
  // ─────────── FOOD PICKER ───────────
  // v78 — Single "Log food" button → picker → pick → set amount + select meal type → confirm
  _renderFoodCats() {
    var host = document.getElementById('fp-cats'); if (!host) return;
    var self = this;
    host.innerHTML = FOOD_CATS.map(function (c) {
      return '<button class="food-picker-cat ' + (c === self._pickerCat ? 'active' : '') + '" data-fc="' + c + '">' + c + '</button>';
    }).join('');
    host.querySelectorAll('.food-picker-cat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        host.querySelectorAll('.food-picker-cat').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        self._pickerCat = btn.dataset.fc;
        self.renderFoodList();
      });
    });
  },

  // Auto meal slot from the time of day (member can still move it in the adjust modal)
  autoBucket() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return 'breakfast';
    if (h >= 11 && h < 16) return 'lunch';
    if (h >= 16 && h < 22) return 'dinner';
    return 'snacks';
  },

  setPickerTab(tab) {
    this._pickerTab = tab;
    document.querySelectorAll('#fp-tabs .fp-tab').forEach(b => b.classList.toggle('active', b.dataset.fptab === tab));
    var foods = document.getElementById('fp-foods-pane');
    var mm = document.getElementById('fp-mymeals-pane');
    if (foods) foods.style.display = tab === 'foods' ? '' : 'none';
    if (mm) mm.style.display = tab === 'mymeals' ? '' : 'none';
    if (tab === 'mymeals' && window.FFPMyMeals && FFPMyMeals.refresh) FFPMyMeals.refresh();
  },

  // v9 — inline meal segmented control inside the picker (the bucket new logs land in; visible + changeable)
  setPickerMeal(m) {
    this._pickerMeal = m;
    this._reflectPickerMeal();
  },
  _reflectPickerMeal() {
    var self = this;
    document.querySelectorAll('#fp-meal-seg [data-pmeal]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.pmeal === self._pickerMeal);
    });
    var mn = document.getElementById('fp-meal-name'); if (mn) mn.textContent = this._pickerMeal;
  },

  openFoodPicker() {
    this._editRemove = null;
    this._pickerSearch = '';
    this._pickerCat = 'All';
    document.getElementById('fp-search').value = '';
    var _dbr = document.getElementById('fp-db-results'); if (_dbr) _dbr.innerHTML = '';   // clear stale food-database results
    this._renderFoodCats();   // rebuild chips from the live (DB-hydrated) FOOD_CATS
    this.renderFoodList();
    this.setPickerTab('foods');
    this._pickerMeal = this.autoBucket();   // default the inline selector to time-of-day
    this._reflectPickerMeal();
    if (this.renderRecents) this.renderRecents();   // loader-provided; fast "log it again" list up top
    if (window.FFPMyMeals && FFPMyMeals.refresh) FFPMyMeals.refresh();
    document.getElementById('food-picker-backdrop').classList.add('open');
  },

  closeFoodPicker() {
    document.getElementById('food-picker-backdrop').classList.remove('open');
  },

  renderFoodList() {
    let items = FOOD_DB.slice();
    if (this._pickerCat !== 'All') items = items.filter(f => f.cat === this._pickerCat);
    if (this._pickerSearch) items = items.filter(f => f.name.toLowerCase().includes(this._pickerSearch));
    if (items.length === 0) {
      // While searching, the OpenFoodFacts "Food database" section below handles the messaging — don't
      // show a redundant "No foods match." above it. Only show it for an empty category browse.
      document.getElementById('fp-list').innerHTML = this._pickerSearch ? '' : '<div class="feed-empty">No foods match.</div>';
      return;
    }
    document.getElementById('fp-list').innerHTML = items.map(f => `
      <div class="food-row">
        <div class="food-row-left" onclick="CalorieTracker.pickFood('${f.id}')">
          <div class="food-row-name">${escHtml(f.name)}</div>
          <div class="food-row-serving">${f.serving} ${f.unit} &middot; ${f.kcal} kcal &middot; tap to set amount</div>
        </div>
        <button class="food-row-add" id="fp-add-${f.id}" aria-label="Add ${escHtml(f.name)}" onclick="event.stopPropagation(); CalorieTracker.quickAdd('${f.id}')"><span class="material-icons">add</span></button>
      </div>
    `).join('');
  },

  // One-tap add: default serving → auto (time-of-day) meal. confirmAdd is overridden by the loader to persist.
  quickAdd(foodId) {
    const food = FOOD_DB.find(f => f.id === foodId);
    if (!food) return;
    this._addingFood = food;
    this._addingAmount = food.serving;
    this._addingMeal = this._pickerMeal || this.autoBucket();
    this.confirmAdd();
    const btn = document.getElementById('fp-add-' + foodId);
    if (btn) {
      btn.classList.add('added');
      btn.innerHTML = '<span class="material-icons">check</span>';
      setTimeout(() => { if (btn) { btn.classList.remove('added'); btn.innerHTML = '<span class="material-icons">add</span>'; } }, 1100);
    }
  },

  pickFood(foodId) {
    const food = FOOD_DB.find(f => f.id === foodId);
    if (!food) return;
    this._editRemove = null;   // normal add (not an edit)
    this._populateFoodAdd(food, food.serving, this._pickerMeal || this.autoBucket(), false);
    this.closeFoodPicker();
    document.getElementById('food-add-backdrop').classList.add('open');
  },

  // v10 — single source for filling the food-add modal (used by pickFood AND editItem)
  _populateFoodAdd(food, amount, meal, isEdit) {
    this._addingFood = food;
    this._addingAmount = amount;
    this._addingMeal = meal;
    document.getElementById('fa-name').textContent = food.name;
    document.getElementById('fa-default').textContent = isEdit ? 'Editing — adjust and save' : `Default serving: ${food.serving} ${food.unit}`;
    document.getElementById('fa-unit-label').textContent = `Amount (${food.unit})`;
    document.getElementById('fa-amount').textContent = amount;
    document.getElementById('fa-amount-input').value = amount;
    document.querySelectorAll('#fa-meal-chips .meal-type-chip').forEach(b => b.classList.toggle('active', b.dataset.meal === meal));
    var btn = document.getElementById('fa-confirm-btn');
    if (btn) { if (isEdit) btn.textContent = 'Save changes'; else btn.innerHTML = 'Add to <span id="fa-meal-name">' + meal + '</span>'; }
    this.renderFoodAddMacros();
  },
  
  closeFoodAdd() {
    document.getElementById('food-add-backdrop').classList.remove('open');
  },
  
  adjAmount(delta) {
    this._addingAmount = Math.max(1, Math.min(2000, this._addingAmount + delta));
    document.getElementById('fa-amount').textContent = this._addingAmount;
    document.getElementById('fa-amount-input').value = this._addingAmount;
    this.renderFoodAddMacros();
  },
  
  setAmountFromInput(value) {
    const n = parseInt(value, 10);
    if (isNaN(n)) return;
    this._addingAmount = Math.max(1, Math.min(2000, n));
    document.getElementById('fa-amount').textContent = this._addingAmount;
    this.renderFoodAddMacros();
  },
  
  renderFoodAddMacros() {
    const food = this._addingFood;
    if (!food) return;
    const ratio = this._addingAmount / food.serving;
    document.getElementById('fa-kcal').textContent = Math.round(food.kcal * ratio);
    document.getElementById('fa-p').textContent = Math.round(food.p * ratio);
    document.getElementById('fa-c').textContent = Math.round(food.c * ratio);
    document.getElementById('fa-f').textContent = Math.round(food.f * ratio);
  },
  
  confirmAdd() {
    if (!this._addingFood) return;
    const food = this._addingFood;
    const mealKey = this._addingMeal;
    if (food._off) {
      // v11 — OpenFoodFacts result (not in the local catalog): log as a free item with scaled macros.
      const scale = food.serving > 0 ? this._addingAmount / food.serving : 1;
      this.meals[mealKey].push({ free: true, name: food.name, kcal: Math.round(food.kcal * scale),
        p: +(food.p * scale).toFixed(1), c: +(food.c * scale).toFixed(1), f: +(food.f * scale).toFixed(1) });
    } else {
      this.meals[mealKey].push({ foodId: food.id, amount: this._addingAmount });
    }
    this.closeFoodAdd();
    this.render();
    showToast(`Added ${food.name} to ${mealKey}`);
    this._finishEditRemoval();   // v10 — if this was an edit, drop the old version (the loader deletes its row)
    // PRODUCTION: POST /api/members/me/meals/{mealKey}
  },

  // ─────────── EDIT A LOGGED ITEM (v10) ───────────
  // Tap a logged item → reopen the matching modal prefilled. On save we add the new version, then remove the
  // old one (reuses the existing add + delete persistence — no special update path).
  editItem(mealKey, idx) {
    var item = this.meals[mealKey] && this.meals[mealKey][idx];
    if (!item) return;
    this._editRemove = { mealKey: mealKey, idx: idx };
    if (item.free) {
      this.openQuickAdd(true);
      document.getElementById('qa-name').value = item.name || '';
      document.getElementById('qa-kcal').value = Math.round(item.kcal || 0);
      document.getElementById('qa-p').value = item.p ? Math.round(item.p) : '';
      document.getElementById('qa-c').value = item.c ? Math.round(item.c) : '';
      document.getElementById('qa-f').value = item.f ? Math.round(item.f) : '';
      this._quickMeal = mealKey;
      this._reflectQuickMeal();
    } else {
      var food = FOOD_DB.find(f => f.id === item.foodId);
      if (!food) { this._editRemove = null; return; }
      this._populateFoodAdd(food, item.amount, mealKey, true);
      document.getElementById('food-add-backdrop').classList.add('open');
    }
  },
  _finishEditRemoval() {
    var er = this._editRemove;
    if (!er) return;
    this._editRemove = null;
    if (this.meals[er.mealKey] && this.meals[er.mealKey][er.idx]) this.removeItem(er.mealKey, er.idx);
  },

  // ─────────── QUICK ADD CALORIES (v10) — log something not in the catalog ───────────
  openQuickAdd(isEdit) {
    if (!isEdit) {
      this._editRemove = null;
      document.getElementById('qa-name').value = '';
      document.getElementById('qa-kcal').value = '';
      document.getElementById('qa-p').value = '';
      document.getElementById('qa-c').value = '';
      document.getElementById('qa-f').value = '';
      this._quickMeal = this.autoBucket();   // opened from the Today screen → default to time of day
      this._reflectQuickMeal();
    }
    var btn = document.getElementById('qa-confirm-btn');
    if (btn) btn.textContent = isEdit ? 'Save changes' : 'Add';
    this.closeFoodPicker();
    document.getElementById('quick-add-backdrop').classList.add('open');
  },
  closeQuickAdd() {
    document.getElementById('quick-add-backdrop').classList.remove('open');
  },
  setQuickMeal(m) {
    this._quickMeal = m;
    this._reflectQuickMeal();
  },
  _reflectQuickMeal() {
    var self = this;
    document.querySelectorAll('#qa-meal-chips .meal-type-chip').forEach(function (b) {
      b.classList.toggle('active', b.dataset.meal === self._quickMeal);
    });
  },
  confirmQuickAdd() {
    var kcal = parseInt(document.getElementById('qa-kcal').value, 10);
    if (!kcal || kcal <= 0) { showToast('Enter calories', 'error'); return; }
    var name = (document.getElementById('qa-name').value || '').trim() || 'Quick add';
    var p = parseFloat(document.getElementById('qa-p').value) || 0;
    var c = parseFloat(document.getElementById('qa-c').value) || 0;
    var f = parseFloat(document.getElementById('qa-f').value) || 0;
    var meal = this._quickMeal || this.autoBucket();
    var item = { free: true, name: name, kcal: Math.round(kcal), p: +p.toFixed(1), c: +c.toFixed(1), f: +f.toFixed(1) };
    if (!this.meals[meal]) this.meals[meal] = [];
    this.meals[meal].push(item);
    this._pendingQuick = { item: item, meal: meal };   // loader inserts the food_logs row
    this.closeQuickAdd();
    this.render();
    showToast('Added ' + name + ' to ' + meal);
    this._finishEditRemoval();
  },
  
  // ─────────── GOAL CONFIG ───────────
  // v156 — current weight is owned by Fitness Stats (Bio Age body-weight tile).
  // Pull the freshest shared value; the goal modal only reads it, never edits it.
  syncWeightFromFitness() {
    try {
      var fs = window.FitnessStats;
      var w = null;
      if (fs) {
        if (fs.records && fs.records.weight && fs.records.weight.value != null) w = Number(fs.records.weight.value);
        else if (fs.profile && fs.profile.weight != null) w = Number(fs.profile.weight);
      }
      if (w && w > 0) this.currentWeight = w;
    } catch (e) {}
  },

  // ── Goal date helpers (targetDate is the source of truth; targetWeeks is derived for the kcal math) ──
  _isoToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; },
  _weeksUntil(iso) {
    if (!iso) return this.targetWeeks || 1;
    var d = new Date(iso + 'T00:00:00');
    return Math.max(1, Math.round((d - this._isoToday()) / (7 * 86400000)));
  },
  _isoFromWeeks(w) {
    var d = this._isoToday(); d.setDate(d.getDate() + (w || 1) * 7);
    return d.toISOString().slice(0, 10);
  },
  _goalIso() { return this.targetDate || this._isoFromWeeks(this.targetWeeks); },
  _dateLabel(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  setTargetDate(iso) {
    if (!iso) return;
    this.targetDate = iso;
    this.targetWeeks = this._weeksUntil(iso);
    this.renderGoalConfigResult();
  },

  openGoalConfig() {
    this.syncWeightFromFitness();
    document.getElementById('gc-current').textContent = (this.currentWeight && this.currentWeight > 0) ? this.currentWeight : '—';
    document.getElementById('gc-target').textContent  = this.targetWeight;
    var iso = this._goalIso();
    this.targetDate = iso;
    var gd = document.getElementById('gc-date');
    if (gd) {
      var tmw = this._isoToday(); tmw.setDate(tmw.getDate() + 1);
      gd.min = tmw.toISOString().slice(0, 10);
      gd.value = iso;
    }
    document.querySelectorAll('#goal-config-backdrop [data-act]').forEach(b =>
      b.classList.toggle('active', b.dataset.act === this.activity));
    this.renderGoalConfigResult();
    document.getElementById('goal-config-backdrop').classList.add('open');
  },

  closeGoalConfig() {
    document.getElementById('goal-config-backdrop').classList.remove('open');
  },

  adjGoal(field, delta) {
    // Only target weight steps here (timeframe is now a date; current weight owned by Fitness Stats)
    const limits = { targetWeight: { min: 30, max: 200 } };
    const lim = limits[field];
    if (!lim) return;
    this[field] = Math.max(lim.min, Math.min(lim.max, this[field] + delta));
    document.getElementById('gc-target').textContent = this.targetWeight;
    this.renderGoalConfigResult();
  },

  renderGoalConfigResult() {
    const t = this.computeTargets();
    const wd = t.weightDiff;
    const dateLbl = this._dateLabel(this._goalIso());
    let planText;
    if (wd > 0)      planText = `Lose ${wd} kg by ${dateLbl}`;
    else if (wd < 0) planText = `Gain ${Math.abs(wd)} kg by ${dateLbl}`;
    else             planText = `Maintain ${this.currentWeight} kg`;
    document.getElementById('gc-r-plan').textContent = planText;
    document.getElementById('gc-r-kcal').textContent = t.kcal.toLocaleString() + ' kcal';
    const deficitLabel = t.dailyChange > 0 ? `${t.dailyChange} kcal deficit/day`
                       : t.dailyChange < 0 ? `${Math.abs(t.dailyChange)} kcal surplus/day`
                       : `Maintain ${t.maintenance.toLocaleString()} kcal/day`;
    document.getElementById('gc-r-deficit').textContent = deficitLabel;
    document.getElementById('gc-r-p').textContent = t.p + ' g';
    document.getElementById('gc-r-c').textContent = t.c + ' g';
    document.getElementById('gc-r-f').textContent = t.f + ' g';
  },
  
  saveGoalConfig() {
    this.closeGoalConfig();
    this.render();
    const t = this.computeTargets();
    showToast(`Goal saved — ${t.kcal.toLocaleString()} kcal/day`);
    // PRODUCTION: PATCH /api/members/me/nutrition-goal
  }
};
window.CalorieTracker = CalorieTracker;

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
  targetWeeks: 0,     // weeks to get there
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
  _addingFood: null,
  _addingAmount: 100,
  _addingMeal: 'breakfast',  // v78 — meal selected inside food-add modal
  
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
        document.getElementById('fa-meal-name').textContent = btn.dataset.meal;
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
    this.render();
  },
  
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
      : `${this.currentWeight} kg → ${this.targetWeight} kg in ${this.targetWeeks} weeks`;
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
              <div class="meal-item">
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
              <div class="meal-item">
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

  openFoodPicker() {
    this._pickerSearch = '';
    this._pickerCat = 'All';
    document.getElementById('fp-search').value = '';
    this._renderFoodCats();   // rebuild chips from the live (DB-hydrated) FOOD_CATS
    this.renderFoodList();
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
      document.getElementById('fp-list').innerHTML = '<div class="feed-empty">No foods match.</div>';
      return;
    }
    document.getElementById('fp-list').innerHTML = items.map(f => `
      <div class="food-row" onclick="CalorieTracker.pickFood('${f.id}')">
        <div class="food-row-left">
          <div class="food-row-name">${escHtml(f.name)}</div>
          <div class="food-row-serving">${f.serving} ${f.unit} default &middot; ${f.cat}</div>
        </div>
        <div class="food-row-macros">
          <span class="kcal">${f.kcal}</span>
          ${f.p}p / ${f.c}c / ${f.f}f
        </div>
      </div>
    `).join('');
  },
  
  pickFood(foodId) {
    const food = FOOD_DB.find(f => f.id === foodId);
    if (!food) return;
    this._addingFood = food;
    this._addingAmount = food.serving;
    this._addingMeal = 'breakfast';  // default; user can change in modal
    document.getElementById('fa-name').textContent = food.name;
    document.getElementById('fa-default').textContent = `Default serving: ${food.serving} ${food.unit}`;
    document.getElementById('fa-unit-label').textContent = `Amount (${food.unit})`;
    document.getElementById('fa-amount').textContent = food.serving;
    document.getElementById('fa-amount-input').value = food.serving;
    document.getElementById('fa-meal-name').textContent = 'breakfast';
    // Default selected chip
    document.querySelectorAll('#fa-meal-chips .meal-type-chip').forEach(b => b.classList.toggle('active', b.dataset.meal === 'breakfast'));
    this.renderFoodAddMacros();
    this.closeFoodPicker();
    document.getElementById('food-add-backdrop').classList.add('open');
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
    const mealKey = this._addingMeal;
    this.meals[mealKey].push({ foodId: this._addingFood.id, amount: this._addingAmount });
    this.closeFoodAdd();
    this.render();
    showToast(`Added ${this._addingFood.name} to ${mealKey}`);
    // PRODUCTION: POST /api/members/me/meals/{mealKey}
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

  openGoalConfig() {
    this.syncWeightFromFitness();
    // Populate the steppers from current state
    document.getElementById('gc-current').textContent = (this.currentWeight && this.currentWeight > 0) ? this.currentWeight : '—';
    document.getElementById('gc-target').textContent  = this.targetWeight;
    document.getElementById('gc-weeks').textContent   = this.targetWeeks;
    document.querySelectorAll('#goal-config-backdrop [data-act]').forEach(b =>
      b.classList.toggle('active', b.dataset.act === this.activity));
    this.renderGoalConfigResult();
    document.getElementById('goal-config-backdrop').classList.add('open');
  },
  
  closeGoalConfig() {
    document.getElementById('goal-config-backdrop').classList.remove('open');
  },
  
  adjGoal(field, delta) {
    // v156 — currentWeight removed (owned by Fitness Stats); only target + timeframe adjust here
    const limits = {
      targetWeight:  { min: 30,  max: 200 },
      targetWeeks:   { min: 1,   max: 104 }
    };
    const lim = limits[field];
    if (!lim) return;
    this[field] = Math.max(lim.min, Math.min(lim.max, this[field] + delta));
    document.getElementById('gc-target').textContent  = this.targetWeight;
    document.getElementById('gc-weeks').textContent   = this.targetWeeks;
    this.renderGoalConfigResult();
  },
  
  renderGoalConfigResult() {
    const t = this.computeTargets();
    const wd = t.weightDiff;
    let planText;
    if (wd > 0)      planText = `Lose ${wd} kg in ${this.targetWeeks} weeks`;
    else if (wd < 0) planText = `Gain ${Math.abs(wd)} kg in ${this.targetWeeks} weeks`;
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

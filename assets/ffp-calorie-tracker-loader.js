/* FFP Calorie Tracker Loader — v6
   v6: MY MEALS — "New meal" is now a BUILD-FROM-CATALOG flow (name it, then add foods from the list → macros
       auto-sum; edit amounts; remove), since most people don't know raw macros. Manual totals kept as a
       secondary toggle. New-meal + Save buttons are standard YELLOW; modal is solid + larger. mmOpenBuilder
       replaces mmOpenCustom; "Save as meal" on a section opens the builder prefilled with its items.
   v5: MY MEALS catalog-build — a "Save as meal" button on each logged meal-section bundles its items
       (catalog foods + free-form) into a saved meal via member_meal_save (with an items composition),
       reusing the custom modal prefilled. Completes the "manual + catalog" creation paths.
   v4: MY MEALS — saved meals for one-tap re-logging (member_meals + RPCs). Adds a "My Meals" strip on the
       Today tab (#ct-mymeals): bucket selector (defaults to time-of-day), cards tap → member_meal_log into
       the selected bucket → instantly shown + counted, "New" → custom-meal modal (member_meal_save), card ×
       → member_meal_delete. Also makes FREE-FORM food_logs first-class via mapFoodRow (carry own macros) —
       fixes non-catalog logs being silently dropped. (Earlier header below.)
   --- FFP Calorie Tracker Loader — v3
   v3 (2026-05-29) clean-build refactor: uses FFPAuth.getMember()
   instead of window.supabase.auth.getUser(). FFP custom-auth
   members have no auth.users row — getUser would fail. JWT still
   carries auth.uid() for RLS via the Bearer header.
   
   Wires CalorieTracker module in ffp-member-dashboard.html to Supabase.
   Reads:  profile_meta (goal), activity_logs (today + 29 days back), food_logs (today + 29 days back)
   Writes: confirmAddActivity, removeActivity, confirmAdd, removeItem, saveGoalConfig
   v2 adds Week tab + 30-day tab aggregation (rolling, real data).
*/
(function () {
  'use strict';
  var retries = 0;
  var MAX_RETRIES = 30;
  var currentUserId = null;
  var wrapped = false;

  var DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function injectStyles() {
    if (document.getElementById('ffp-calorie-tracker-loader-styles')) return;
    var s = document.createElement('style');
    s.id = 'ffp-calorie-tracker-loader-styles';
    s.textContent =
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}' +
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}';
    document.head.appendChild(s);
  }

  function startOfTodayIso() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  function startOf30DaysAgoIso() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 29);
    return d.toISOString();
  }
  function localDateKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function localDateKeyFromIso(iso) {
    return localDateKey(new Date(iso));
  }

  // activity_factor numeric ↔ 'low'/'mod'/'high' label
  function factorToActivity(f) {
    if (f < 1.45) return 'low';
    if (f < 1.65) return 'mod';
    return 'high';
  }
  function activityToFactor(a) {
    return a === 'low' ? 1.375 : a === 'high' ? 1.725 : 1.55;
  }

  // Supabase activity_logs row → dashboard activities entry
  function mapActivityRow(row, localId) {
    var meta = (typeof ACTIVITY_CAT_META !== 'undefined' && ACTIVITY_CAT_META[row.category]) || null;
    return {
      id: localId,
      _supabaseId: row.id,
      name: row.activity || 'Activity',
      category: row.category || 'Strength & fitness',
      icon: meta ? meta.icon : 'fitness_center',
      duration: row.duration_min || 0,
      kcal: row.calories || 0
    };
  }

  // Supabase food_logs row → dashboard meal item { foodId, amount, _supabaseId }
  function mapFoodRow(row) {
    if (typeof FOOD_DB !== 'undefined') {
      for (var i = 0; i < FOOD_DB.length; i++) {
        if (FOOD_DB[i].name === row.food_name) {
          var food = FOOD_DB[i];
          var amount = food.kcal > 0 ? Math.round((row.calories / food.kcal) * food.serving) : food.serving;
          return { foodId: food.id, amount: amount, _supabaseId: row.id };
        }
      }
    }
    // free-form row (My Meals / any custom log not in the catalog): carry its own macros so it shows + counts
    return { free: true, name: row.food_name || 'Meal', kcal: row.calories || 0,
             p: +(row.protein_g || 0), c: +(row.carbs_g || 0), f: +(row.fat_g || 0), _supabaseId: row.id };
  }

  function dbMealToKey(m) { return m === 'snack'  ? 'snacks' : m; }
  function keyToDbMeal(k) { return k === 'snacks' ? 'snack'  : k; }

  // Build rolling history arrays from raw rows (last 29 days before today)
  function buildHistory(foodRows, activityRows) {
    var intakeByDay = {};
    var burnedByDay = {};
    (foodRows || []).forEach(function (r) {
      var k = localDateKeyFromIso(r.logged_at);
      intakeByDay[k] = (intakeByDay[k] || 0) + (r.calories || 0);
    });
    (activityRows || []).forEach(function (r) {
      var k = localDateKeyFromIso(r.logged_at);
      burnedByDay[k] = (burnedByDay[k] || 0) + (r.calories || 0);
    });

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var monthHistory = [];
    var weekHistory = [];

    for (var i = 29; i >= 1; i--) {
      var d = new Date(today);
      d.setDate(today.getDate() - i);
      var key = localDateKey(d);
      var dayLabel = DAY_NAMES[d.getDay()];
      var dateNum = d.getDate();
      var intake = intakeByDay[key] || 0;
      var burned = burnedByDay[key] || 0;
      monthHistory.push({ idx: -i, intake: intake, burned: burned });
      if (i <= 6) weekHistory.push({ day: dayLabel, date: dateNum, intake: intake, burned: burned });
    }

    return { weekHistory: weekHistory, monthHistory: monthHistory };
  }

  async function loadFromSupabase() {
    if (!window.supabase || typeof CalorieTracker === 'undefined') {
      if (retries < MAX_RETRIES) { retries++; setTimeout(loadFromSupabase, 200); }
      return;
    }
    injectStyles();

    try {
      // Read current member from FFP custom auth (FFPAuth.getMember).
      // We don't use supabase.auth.getUser() — FFP members live in the
      // `members` table only and have no auth.users row. RLS still
      // sees auth.uid() correctly because the JWT is set as a Bearer
      // header on the Supabase client by ffp-api-integration v8.
      var member = window.FFPAuth && window.FFPAuth.getMember();
      if (!member || !member.id) {
        console.log('[FFP Calorie Tracker] No FFP member — keeping sample');
        return;
      }
      currentUserId = member.id;

      // 1. Goal from profile_meta
      var pm = await window.supabase
        .from('profile_meta')
        .select('current_weight_kg, target_weight_kg, target_weeks, activity_factor')
        .eq('member_id', currentUserId)
        .maybeSingle();

      if (!pm.error && pm.data) {
        if (pm.data.current_weight_kg != null) CalorieTracker.currentWeight = Number(pm.data.current_weight_kg);
        if (pm.data.target_weight_kg  != null) CalorieTracker.targetWeight  = Number(pm.data.target_weight_kg);
        if (pm.data.target_weeks      != null) CalorieTracker.targetWeeks   = Number(pm.data.target_weeks);
        if (pm.data.activity_factor   != null) CalorieTracker.activity      = factorToActivity(Number(pm.data.activity_factor));
      } else if (pm.error) {
        console.error('[FFP Calorie Tracker] profile_meta read:', pm.error);
      }

      var today = startOfTodayIso();
      var thirtyDays = startOf30DaysAgoIso();

      // 2. Today's activity_logs (full detail for live list)
      var aTodayRes = await window.supabase
        .from('activity_logs')
        .select('id, activity, category, duration_min, calories, logged_at')
        .eq('member_id', currentUserId)
        .gte('logged_at', today)
        .order('logged_at', { ascending: true });

      if (aTodayRes.error) {
        console.error('[FFP Calorie Tracker] activity_logs (today) read:', aTodayRes.error);
      } else {
        var arows = aTodayRes.data || [];
        CalorieTracker.activities = arows.map(function (r, i) { return mapActivityRow(r, i + 1); });
        CalorieTracker._nextActId = CalorieTracker.activities.length + 1;
      }

      // 3. Today's food_logs (full detail for live meals)
      var fTodayRes = await window.supabase
        .from('food_logs')
        .select('id, meal, food_name, calories, protein_g, carbs_g, fat_g, logged_at')
        .eq('member_id', currentUserId)
        .gte('logged_at', today)
        .order('logged_at', { ascending: true });

      if (fTodayRes.error) {
        console.error('[FFP Calorie Tracker] food_logs (today) read:', fTodayRes.error);
      } else {
        var meals = { breakfast: [], lunch: [], dinner: [], snacks: [] };
        (fTodayRes.data || []).forEach(function (r) {
          var item = mapFoodRow(r);
          if (!item) return;
          var key = dbMealToKey(r.meal);
          if (meals[key]) meals[key].push(item);
        });
        CalorieTracker.meals = meals;
      }

      // 4. 30-day aggregation — just calories + logged_at, last 29 days BEFORE today
      var aHistRes = await window.supabase
        .from('activity_logs')
        .select('calories, logged_at')
        .eq('member_id', currentUserId)
        .gte('logged_at', thirtyDays)
        .lt('logged_at', today);

      var fHistRes = await window.supabase
        .from('food_logs')
        .select('calories, logged_at')
        .eq('member_id', currentUserId)
        .gte('logged_at', thirtyDays)
        .lt('logged_at', today);

      if (aHistRes.error) console.error('[FFP Calorie Tracker] activity_logs (history) read:', aHistRes.error);
      if (fHistRes.error) console.error('[FFP Calorie Tracker] food_logs (history) read:', fHistRes.error);

      var history = buildHistory(fHistRes.data || [], aHistRes.data || []);
      CalorieTracker.weekHistory  = history.weekHistory;
      CalorieTracker.monthHistory = history.monthHistory;

      // 5. Override todayDayStat() so day/date reflect actual today (was hardcoded Sun 28)
      var now = new Date();
      var todayDayName = DAY_NAMES[now.getDay()];
      var todayDateNum = now.getDate();
      CalorieTracker.todayDayStat = function () {
        return {
          day: todayDayName,
          date: todayDateNum,
          intake: this.totals().kcal,
          burned: this.activitiesTotal(),
          isToday: true
        };
      };

      // 6. Wrap writes (once)
      wrapWrites();

      // 7. Re-render if Calorie Tracker panel is visible
      var panel = document.getElementById('panel-calorie-tracker');
      if (panel && panel.classList.contains('active') && typeof CalorieTracker.render === 'function') {
        CalorieTracker.render();
      }
      loadMyMeals();  // My Meals strip (saved meals)

      console.log('[FFP Calorie Tracker] Loaded from Supabase ✓');
    } catch (err) {
      console.error('[FFP Calorie Tracker] Unexpected error:', err);
    }
  }

  function wrapWrites() {
    if (wrapped) return;
    wrapped = true;

    // ─── activity_logs: confirmAddActivity ───
    var origConfirmAddActivity = CalorieTracker.confirmAddActivity.bind(CalorieTracker);
    CalorieTracker.confirmAddActivity = async function () {
      var adding = this._activityAdding;
      origConfirmAddActivity();
      if (!adding || !currentUserId) return;
      try {
        var res = await window.supabase.from('activity_logs').insert({
          member_id: currentUserId,
          activity: adding.name,
          category: adding.category,
          duration_min: adding.duration,
          calories: adding.kcal,
          logged_at: new Date().toISOString()
        }).select('id').single();
        if (res.error) { console.error('[FFP CT] activity insert:', res.error); return; }
        var last = this.activities[this.activities.length - 1];
        if (last) last._supabaseId = res.data.id;
      } catch (e) { console.error('[FFP CT] activity insert:', e); }
    };

    // ─── activity_logs: removeActivity ───
    var origRemoveActivity = CalorieTracker.removeActivity.bind(CalorieTracker);
    CalorieTracker.removeActivity = async function (id) {
      var entry = this.activities.find(function (a) { return a.id === id; });
      origRemoveActivity(id);
      if (!entry || !entry._supabaseId || !currentUserId) return;
      try {
        var res = await window.supabase.from('activity_logs').delete().eq('id', entry._supabaseId);
        if (res.error) console.error('[FFP CT] activity delete:', res.error);
      } catch (e) { console.error('[FFP CT] activity delete:', e); }
    };

    // ─── food_logs: confirmAdd ───
    var origConfirmAdd = CalorieTracker.confirmAdd.bind(CalorieTracker);
    CalorieTracker.confirmAdd = async function () {
      var food = this._addingFood;
      var amount = this._addingAmount;
      var mealKey = this._addingMeal;
      origConfirmAdd();
      if (!food || !currentUserId) return;
      var scale = food.serving > 0 ? amount / food.serving : 1;
      var payload = {
        member_id: currentUserId,
        meal: keyToDbMeal(mealKey),
        food_name: food.name,
        calories: Math.round(food.kcal * scale),
        protein_g: +(food.p * scale).toFixed(1),
        carbs_g:   +(food.c * scale).toFixed(1),
        fat_g:     +(food.f * scale).toFixed(1),
        logged_at: new Date().toISOString()
      };
      try {
        var res = await window.supabase.from('food_logs').insert(payload).select('id').single();
        if (res.error) { console.error('[FFP CT] food insert:', res.error); return; }
        var list = this.meals[mealKey];
        if (list && list.length > 0) list[list.length - 1]._supabaseId = res.data.id;
      } catch (e) { console.error('[FFP CT] food insert:', e); }
    };

    // ─── food_logs: removeItem ───
    var origRemoveItem = CalorieTracker.removeItem.bind(CalorieTracker);
    CalorieTracker.removeItem = async function (mealKey, idx) {
      var item = this.meals[mealKey] && this.meals[mealKey][idx];
      var supabaseId = item && item._supabaseId;
      origRemoveItem(mealKey, idx);
      if (!supabaseId || !currentUserId) return;
      try {
        var res = await window.supabase.from('food_logs').delete().eq('id', supabaseId);
        if (res.error) console.error('[FFP CT] food delete:', res.error);
      } catch (e) { console.error('[FFP CT] food delete:', e); }
    };

    // ─── profile_meta: saveGoalConfig ───
    var origSaveGoal = CalorieTracker.saveGoalConfig.bind(CalorieTracker);
    CalorieTracker.saveGoalConfig = async function () {
      var snapshot = {
        currentWeight: this.currentWeight,
        targetWeight:  this.targetWeight,
        targetWeeks:   this.targetWeeks,
        activity:      this.activity
      };
      origSaveGoal();
      if (!currentUserId) return;
      try {
        var res = await window.supabase.from('profile_meta').upsert({
          member_id: currentUserId,
          // v4 — current_weight_kg is owned by Fitness Stats (Bio Age body-weight tile).
          // The Calorie Tracker only READS it (above); it must NOT overwrite the shared value here.
          target_weight_kg:  snapshot.targetWeight,
          target_weeks:      snapshot.targetWeeks,
          activity_factor:   activityToFactor(snapshot.activity),
          updated_at: new Date().toISOString()
        }, { onConflict: 'member_id' });
        if (res.error) console.error('[FFP CT] goal save:', res.error);
      } catch (e) { console.error('[FFP CT] goal save:', e); }
    };

    // ─── My Meals strip rides along with every tracker render ───
    var origRenderMM = CalorieTracker.render.bind(CalorieTracker);
    CalorieTracker.render = function () { origRenderMM(); renderMyMeals(); mmDecorateSections(); };
  }

  // ============ MY MEALS — saved meals, one-tap re-log (member_meals + RPCs) ============
  var _myMeals = [];
  function mmDefaultBucket() { var h = new Date().getHours(); if (h >= 5 && h < 11) return 'breakfast'; if (h >= 11 && h < 16) return 'lunch'; if (h >= 16 && h < 22) return 'dinner'; return 'snacks'; }
  var _mmBucket = mmDefaultBucket();
  var MM_BUCKETS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snacks', 'Snacks']];
  function mmEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]; }); }

  function mmInjectStyles() {
    if (document.getElementById('ffp-mymeals-styles')) return;
    var s = document.createElement('style'); s.id = 'ffp-mymeals-styles'; s.textContent =
      '.mm-wrap{margin:0 0 12px;}' +
      '.mm-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}' +
      '.mm-title{font-size:13px;font-weight:800;color:var(--text);}' +
      '.mm-bkt{display:flex;gap:4px;}' +
      '.mm-bkt button{font-size:10px;font-weight:800;padding:4px 8px;border-radius:7px;border:1px solid var(--border-mid);background:transparent;color:var(--muted);cursor:pointer;}' +
      '.mm-bkt button.on{background:var(--blue);border-color:var(--blue);color:#fff;}' +
      '.mm-strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;}' +
      '.mm-strip::-webkit-scrollbar{display:none;}' +
      '.mm-card{flex:0 0 auto;min-width:96px;max-width:150px;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:12px;padding:10px;cursor:pointer;position:relative;transition:border-color .15s;}' +
      '.mm-card:hover{border-color:var(--blue);}' +
      '.mm-card-name{font-size:12px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.mm-card-kcal{font-size:11px;font-weight:700;color:var(--blue);margin-top:3px;}' +
      '.mm-card-x{position:absolute;top:4px;right:4px;width:18px;height:18px;border:none;background:rgba(0,0,0,.3);color:#fff;border-radius:50%;font-size:12px;line-height:16px;cursor:pointer;padding:0;}' +
      '.mm-new{flex:0 0 auto;min-width:108px;border:none;border-radius:12px;background:var(--yellow,#FFCC00);color:#0a1722;font-size:12.5px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;}' +
      '.mm-empty{font-size:11.5px;color:var(--muted);padding:6px 2px 8px;}' +
      '.mm-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:100040;}' +
      '.mm-modal{background:#0e1b2a;border:1px solid var(--border-mid);border-radius:18px 18px 0 0;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;padding:22px 18px 26px;box-shadow:0 -8px 30px rgba(0,0,0,.5);}' +
      '.mm-modal h3{font-size:15px;font-weight:800;color:var(--text);margin:0 0 12px;}' +
      '.mm-field{margin-bottom:10px;}' +
      '.mm-field label{display:block;font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px;}' +
      '.mm-field input{width:100%;padding:9px 11px;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:9px;color:var(--text);font-size:14px;font-weight:600;font-family:inherit;box-sizing:border-box;}' +
      '.mm-macros{display:flex;gap:8px;}.mm-macros .mm-field{flex:1;}' +
      '.mm-actions{display:flex;gap:8px;margin-top:14px;}' +
      '.mm-actions button{flex:1;padding:11px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;border:none;}' +
      '.mm-cancel{background:rgba(255,255,255,0.08);color:var(--text);}.mm-save{background:var(--yellow,#FFCC00);color:#0a1722;}' +
      '.mm-savebtn{font-size:10px;font-weight:800;color:var(--yellow,#FFCC00);background:rgba(255,204,0,0.12);border:1px solid var(--border-mid);border-radius:7px;padding:3px 8px;cursor:pointer;margin-left:8px;}' +
      '.mmb-name{width:100%;padding:11px 12px;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:10px;color:var(--text);font-size:15px;font-weight:700;font-family:inherit;box-sizing:border-box;margin-bottom:10px;}' +
      '.mmb-totalbar{font-size:13px;font-weight:800;color:var(--yellow,#FFCC00);margin-bottom:8px;}' +
      '.mmb-items{display:flex;flex-direction:column;gap:6px;margin-bottom:10px;}' +
      '.mmb-item{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.04);border-radius:9px;padding:7px 10px;}' +
      '.mmb-item-name{flex:1;font-size:13px;font-weight:700;color:var(--text);}' +
      '.mmb-amt{width:54px;padding:5px 6px;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:7px;color:var(--text);font-size:12px;font-weight:700;text-align:center;font-family:inherit;}' +
      '.mmb-unit{font-size:11px;color:var(--muted);}' +
      '.mmb-item-kcal{font-size:12px;font-weight:800;color:var(--blue);min-width:44px;text-align:right;}' +
      '.mmb-rm{border:none;background:rgba(0,0,0,.3);color:#fff;border-radius:50%;width:20px;height:20px;font-size:13px;line-height:18px;cursor:pointer;padding:0;}' +
      '.mmb-addhead{font-size:12px;font-weight:800;color:var(--muted);margin:6px 0;}' +
      '.mmb-q{width:100%;padding:10px 12px;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:10px;color:var(--text);font-size:14px;font-family:inherit;box-sizing:border-box;margin-bottom:8px;}' +
      '.mmb-results{display:flex;flex-direction:column;gap:5px;max-height:210px;overflow-y:auto;}' +
      '.mmb-result{display:flex;justify-content:space-between;align-items:center;gap:8px;text-align:left;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:9px;padding:9px 11px;color:var(--text);font-size:13px;font-weight:700;cursor:pointer;}' +
      '.mmb-result span{font-size:11px;color:var(--muted);font-weight:600;}' +
      '.mmb-result:hover{border-color:var(--blue);}' +
      '.mmb-hint{font-size:11.5px;color:var(--muted);padding:4px 2px;}' +
      '.mmb-manuallink{display:block;width:100%;text-align:center;background:none;border:none;color:var(--blue);font-size:12px;font-weight:700;cursor:pointer;margin:12px 0 4px;}' +
      '.mmb-manualbox{margin-top:6px;}';
    document.head.appendChild(s);
  }

  function loadMyMeals() {
    if (!window.supabase || !currentUserId) return;
    window.supabase.rpc('member_meals_list', { p_me: currentUserId }).then(function (res) {
      _myMeals = (res && res.data) || [];
      renderMyMeals();
    }).catch(function (e) { console.error('[FFP CT] my_meals list:', e); });
  }

  function renderMyMeals() {
    var host = document.getElementById('ct-mymeals'); if (!host) return;
    mmInjectStyles();
    var bkt = MM_BUCKETS.map(function (b) { return '<button class="' + (b[0] === _mmBucket ? 'on' : '') + '" onclick="FFPMyMeals.setBucket(\'' + b[0] + '\')">' + b[1] + '</button>'; }).join('');
    var newBtn = '<button class="mm-new" onclick="FFPMyMeals.openBuilder()"><span class="material-icons" style="font-size:16px;">add</span>New meal</button>';
    var cards = _myMeals.map(function (m) {
      return '<div class="mm-card" onclick="FFPMyMeals.log(\'' + m.id + '\')">' +
        '<button class="mm-card-x" onclick="event.stopPropagation();FFPMyMeals.del(\'' + m.id + '\')">&times;</button>' +
        '<div class="mm-card-name">' + mmEsc(m.name) + '</div>' +
        '<div class="mm-card-kcal">' + (m.calories || 0) + ' kcal</div></div>';
    }).join('');
    var body = _myMeals.length
      ? '<div class="mm-strip">' + cards + newBtn + '</div>'
      : '<div class="mm-empty">Save meals you eat often for one-tap logging.</div><div class="mm-strip">' + newBtn + '</div>';
    host.innerHTML = '<div class="mm-wrap"><div class="mm-head"><span class="mm-title">My Meals</span><span class="mm-bkt">' + bkt + '</span></div>' + body + '</div>';
  }

  function mmLog(id) {
    var m = null; for (var i = 0; i < _myMeals.length; i++) { if (_myMeals[i].id === id) { m = _myMeals[i]; break; } }
    if (!m || !currentUserId) return;
    var bucketKey = _mmBucket;
    window.supabase.rpc('member_meal_log', { p_me: currentUserId, p_id: id, p_bucket: keyToDbMeal(bucketKey) }).then(function (res) {
      var r = res && res.data;
      if (!r || r.ok === false) { if (window.showToast) showToast('Could not log meal', 'error'); return; }
      if (!CalorieTracker.meals[bucketKey]) CalorieTracker.meals[bucketKey] = [];
      CalorieTracker.meals[bucketKey].push({ free: true, name: m.name, kcal: m.calories || 0, p: +(m.protein_g || 0), c: +(m.carbs_g || 0), f: +(m.fat_g || 0), _supabaseId: r.food_log_id });
      if (typeof CalorieTracker.render === 'function') CalorieTracker.render();
      m.use_count = (m.use_count || 0) + 1;
      _myMeals = [m].concat(_myMeals.filter(function (x) { return x.id !== id; }));
      renderMyMeals();
      var label = (MM_BUCKETS.filter(function (b) { return b[0] === bucketKey; })[0] || ['', 'Snacks'])[1];
      if (window.showToast) showToast('Added ' + m.name + ' to ' + label);
    }).catch(function (e) { console.error('[FFP CT] meal log:', e); });
  }

  function mmDel(id) {
    if (!currentUserId) return;
    window.supabase.rpc('member_meal_delete', { p_me: currentUserId, p_id: id }).then(function () {
      _myMeals = _myMeals.filter(function (x) { return x.id !== id; });
      renderMyMeals();
    }).catch(function (e) { console.error('[FFP CT] meal delete:', e); });
  }

  // ── My Meals BUILDER: build a meal from the food catalog (primary), or enter totals manually (toggle) ──
  var mmB = null;
  function mmFoodById(id) { if (typeof FOOD_DB === 'undefined') return null; for (var i = 0; i < FOOD_DB.length; i++) { if (FOOD_DB[i].id === id) return FOOD_DB[i]; } return null; }
  function mmBTotals() { var k = 0, p = 0, c = 0, f = 0; (mmB.items || []).forEach(function (it) { var m = mmItemMacros(it); k += m.kcal; p += m.p; c += m.c; f += m.f; }); return { k: Math.round(k), p: Math.round(p), c: Math.round(c), f: Math.round(f) }; }
  function mmBRenderTotal() { var t = mmBTotals(); var el = document.getElementById('mmb-total'); if (el) el.textContent = t.k + ' kcal · ' + t.p + 'p ' + t.c + 'c ' + t.f + 'f'; }
  function mmBRenderItems() {
    var host = document.getElementById('mmb-items'); if (!host) return;
    if (!mmB.items.length) { host.innerHTML = '<div class="mmb-hint">No foods yet — search below and tap to add.</div>'; mmBRenderTotal(); return; }
    host.innerHTML = mmB.items.map(function (it, i) {
      var m = mmItemMacros(it), unit = it.free ? '' : ((mmFoodById(it.foodId) || {}).unit || '');
      var amt = it.free ? '' : '<input class="mmb-amt" type="number" inputmode="numeric" value="' + it.amount + '" data-i="' + i + '"><span class="mmb-unit">' + mmEsc(unit) + '</span>';
      return '<div class="mmb-item"><div class="mmb-item-name">' + mmEsc(m.name) + '</div>' + amt + '<span class="mmb-item-kcal">' + Math.round(m.kcal) + '</span><button class="mmb-rm" type="button" data-i="' + i + '">&times;</button></div>';
    }).join('');
    host.querySelectorAll('.mmb-amt').forEach(function (inp) { inp.addEventListener('input', function () { mmB.items[+inp.dataset.i].amount = parseFloat(inp.value) || 0; mmBRenderTotal(); }); });
    host.querySelectorAll('.mmb-rm').forEach(function (b) { b.addEventListener('click', function () { mmB.items.splice(+b.dataset.i, 1); mmBRenderItems(); }); });
    mmBRenderTotal();
  }
  function mmBSearch(q) {
    var host = document.getElementById('mmb-results'); if (!host) return;
    q = (q || '').trim().toLowerCase();
    if (typeof FOOD_DB === 'undefined') { host.innerHTML = '<div class="mmb-hint">Food list unavailable.</div>'; return; }
    var list = q ? FOOD_DB.filter(function (f) { return (f.name || '').toLowerCase().indexOf(q) > -1; }).slice(0, 14) : FOOD_DB.slice(0, 8);
    host.innerHTML = list.length ? list.map(function (f) { return '<button class="mmb-result" type="button" data-id="' + f.id + '">' + mmEsc(f.name) + '<span>' + f.kcal + ' kcal / ' + f.serving + mmEsc(f.unit || '') + '</span></button>'; }).join('') : '<div class="mmb-hint">No matches.</div>';
    host.querySelectorAll('.mmb-result').forEach(function (b) { b.addEventListener('click', function () { var f = mmFoodById(b.dataset.id); if (!f) return; mmB.items.push({ foodId: f.id, amount: f.serving }); mmBRenderItems(); }); });
  }
  function mmOpenBuilder(prefill) {
    mmInjectStyles();
    prefill = prefill || {};
    mmB = { name: prefill.name || '', items: (prefill.items ? prefill.items.slice() : []), manual: false };
    var bg = document.createElement('div'); bg.className = 'mm-modal-bg';
    bg.onclick = function (e) { if (e.target === bg) document.body.removeChild(bg); };
    bg.innerHTML = '<div class="mm-modal mm-builder">' +
      '<h3>Build a meal</h3>' +
      '<input id="mmb-name" class="mmb-name" type="text" placeholder="Meal name — e.g. Chicken wrap">' +
      '<div class="mmb-totalbar">Total: <span id="mmb-total">0 kcal</span></div>' +
      '<div id="mmb-items" class="mmb-items"></div>' +
      '<div class="mmb-addhead">Add foods</div>' +
      '<input id="mmb-q" class="mmb-q" type="text" placeholder="Search foods…">' +
      '<div id="mmb-results" class="mmb-results"></div>' +
      '<button id="mmb-manual" class="mmb-manuallink" type="button">Know your macros? Enter totals manually</button>' +
      '<div id="mmb-manualbox" class="mmb-manualbox" style="display:none;"><div class="mm-macros">' +
        '<div class="mm-field"><label>Calories</label><input id="mm-i-kcal" type="number" inputmode="numeric"></div>' +
        '<div class="mm-field"><label>Protein</label><input id="mm-i-p" type="number" inputmode="numeric"></div>' +
        '<div class="mm-field"><label>Carbs</label><input id="mm-i-c" type="number" inputmode="numeric"></div>' +
        '<div class="mm-field"><label>Fat</label><input id="mm-i-f" type="number" inputmode="numeric"></div></div></div>' +
      '<div class="mm-actions"><button class="mm-cancel" type="button">Cancel</button><button class="mm-save" type="button">Save meal</button></div>' +
      '</div>';
    document.body.appendChild(bg);
    document.getElementById('mmb-name').value = mmB.name;
    mmBRenderItems(); mmBSearch('');
    document.getElementById('mmb-q').addEventListener('input', function () { mmBSearch(this.value); });
    document.getElementById('mmb-name').addEventListener('input', function () { mmB.name = this.value; });
    var mbtn = document.getElementById('mmb-manual'), mbox = document.getElementById('mmb-manualbox');
    mbtn.addEventListener('click', function () { mmB.manual = !mmB.manual; mbox.style.display = mmB.manual ? 'block' : 'none'; mbtn.textContent = mmB.manual ? 'Hide manual entry' : 'Know your macros? Enter totals manually'; });
    bg.querySelector('.mm-cancel').onclick = function () { document.body.removeChild(bg); };
    bg.querySelector('.mm-save').onclick = function () {
      var name = (document.getElementById('mmb-name').value || '').trim();
      if (!name) { if (window.showToast) showToast('Name your meal', 'error'); return; }
      var payload = { name: name };
      if (mmB.manual) {
        payload.calories = parseInt(document.getElementById('mm-i-kcal').value, 10) || 0;
        payload.protein_g = parseFloat(document.getElementById('mm-i-p').value) || 0;
        payload.carbs_g = parseFloat(document.getElementById('mm-i-c').value) || 0;
        payload.fat_g = parseFloat(document.getElementById('mm-i-f').value) || 0;
      } else {
        if (!mmB.items.length) { if (window.showToast) showToast('Add foods, or use manual entry', 'error'); return; }
        var t = mmBTotals(); payload.calories = t.k; payload.protein_g = t.p; payload.carbs_g = t.c; payload.fat_g = t.f;
        payload.items = mmB.items.map(function (it) { var m = mmItemMacros(it); return { name: m.name, kcal: Math.round(m.kcal), p: Math.round(m.p), c: Math.round(m.c), f: Math.round(m.f) }; });
      }
      window.supabase.rpc('member_meal_save', { p_me: currentUserId, p: payload }).then(function () {
        if (document.body.contains(bg)) document.body.removeChild(bg);
        if (window.showToast) showToast('Saved ' + name);
        loadMyMeals();
      }).catch(function (e) { console.error('[FFP CT] meal save:', e); });
    };
  }

  // Catalog-build: bundle a logged meal-section (catalog foods + free items) into a saved meal.
  function mmItemMacros(item) {
    if (item && item.free) return { kcal: item.kcal || 0, p: +(item.p || 0), c: +(item.c || 0), f: +(item.f || 0), name: item.name || 'Item' };
    var food = (typeof FOOD_DB !== 'undefined') ? FOOD_DB.filter(function (x) { return x.id === item.foodId; })[0] : null;
    if (!food) return { kcal: 0, p: 0, c: 0, f: 0, name: 'Item' };
    var r = food.serving > 0 ? item.amount / food.serving : 1;
    return { kcal: food.kcal * r, p: food.p * r, c: food.c * r, f: food.f * r, name: food.name };
  }
  function mmSaveSection(bucketKey) {
    var items = (CalorieTracker.meals && CalorieTracker.meals[bucketKey]) || [];
    var label = (MM_BUCKETS.filter(function (b) { return b[0] === bucketKey; })[0] || ['', 'Meal'])[1];
    if (!items.length) { if (window.showToast) showToast('Nothing in ' + label + ' to save'); return; }
    var suggested = items.length === 1 ? mmItemMacros(items[0]).name : (label + ' (' + items.length + ' items)');
    mmOpenBuilder({ name: suggested, items: items.slice() });
  }
  function mmDecorateSections() {
    ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(function (k) {
      var head = document.querySelector('.meal-section[data-meal="' + k + '"] .meal-section-head'); if (!head) return;
      var has = ((CalorieTracker.meals && CalorieTracker.meals[k]) || []).length > 0;
      var btn = head.querySelector('.mm-savebtn');
      if (has && !btn) {
        btn = document.createElement('button'); btn.className = 'mm-savebtn'; btn.type = 'button'; btn.textContent = 'Save as meal';
        btn.onclick = function () { FFPMyMeals.saveSection(k); };
        head.appendChild(btn);
      } else if (!has && btn) { btn.parentNode.removeChild(btn); }
    });
  }

  window.FFPMyMeals = { setBucket: function (k) { _mmBucket = k; renderMyMeals(); }, log: mmLog, del: mmDel, openBuilder: mmOpenBuilder, saveSection: mmSaveSection, reload: loadMyMeals };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(loadFromSupabase, 400); });
  } else {
    setTimeout(loadFromSupabase, 400);
  }
  window.ffpReloadCalorieTracker = loadFromSupabase;
})();

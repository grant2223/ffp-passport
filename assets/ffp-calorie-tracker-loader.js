/* FFP Calorie Tracker Loader — v3
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
    if (typeof FOOD_DB === 'undefined') return null;
    var food = null;
    for (var i = 0; i < FOOD_DB.length; i++) {
      if (FOOD_DB[i].name === row.food_name) { food = FOOD_DB[i]; break; }
    }
    if (!food) return null;
    var amount = food.kcal > 0
      ? Math.round((row.calories / food.kcal) * food.serving)
      : food.serving;
    return {
      foodId: food.id,
      amount: amount,
      _supabaseId: row.id
    };
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
          current_weight_kg: snapshot.currentWeight,
          target_weight_kg:  snapshot.targetWeight,
          target_weeks:      snapshot.targetWeeks,
          activity_factor:   activityToFactor(snapshot.activity),
          updated_at: new Date().toISOString()
        }, { onConflict: 'member_id' });
        if (res.error) console.error('[FFP CT] goal save:', res.error);
      } catch (e) { console.error('[FFP CT] goal save:', e); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(loadFromSupabase, 400); });
  } else {
    setTimeout(loadFromSupabase, 400);
  }
  window.ffpReloadCalorieTracker = loadFromSupabase;
})();

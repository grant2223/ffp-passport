/* FFP Admin Analytics Loader — v7 (2026-06-10)
   v7: NEW "How Members Are Signing Up" section — breakdown by signup METHOD (referral / paid-Stripe /
       access code / direct), MEMBERSHIP plan (annual / monthly / free), and WHERE (top countries +
       cities). Period- and geo-scoped like the rest of the panel; falls back to all-time when the
       selected period has no signups. Members fetch now also pulls referred_by/plan/access_code/
       stripe ids/country. Renders into #signup-method/#signup-plan/#signup-countries/#signup-cities.
   --- prior ---
   v6 (2026-06-03)
   v6: Community Health REMOVED from this panel — it's now its own tab (panel-community-health,
   ffp-admin-health-loader.js) because health/fitness stats are a different class of data from
   member/provider/revenue/engagement. This loader is business analytics only; its Country/City
   filter scopes those business stats.
   --- prior ---
   v5: location filter is now matched to the STANDARDIZED taxonomy. _ensure awaits
   window.FFP_TAX_READY (DB hydration of taxonomy_items → 58 countries / 541 cities) before
   building the city→country map, clears the cache so it keys off the live admin taxonomy
   (not the ffp-taxonomy.js fallback), and re-renders on the 'ffp-tax-ready' event. Country
   grouping for every city therefore comes straight from the locked taxonomy.
   --- prior ---
   v4: COUNTRY / CITY location filter. Two dropdowns in the panel header scope the WHOLE
   panel — KPIs, growth, tiers, demographics, categories, engagement, top providers, and
   Community Health. City is the source of truth on each member; Country is derived from the
   shared taxonomy (window.FFP_TAX.cities). Engagement/category/provider tables are scoped by
   the matching member-id set (member_id now fetched for activity_logs/claims/rsvps/meetups,
   referrer_id for referrals). Community Health is scoped server-side via the new
   community_health_stats(p_cities text[]) arg. Revenue stays platform-wide (transactions
   carry no location). Selection persists across period/compare changes.
   --- prior ---
   v3: Community Health section — community-wide fitness KPIs (body fat, VO2, resting HR,
   weight, etc.), VO2 fit-level + body-composition distributions, and per-city/emirate
   averages. Sourced from the community_health_stats() SECURITY DEFINER RPC (aggregates
   profile_meta joined to members; no PII, anon-callable). Renders into #ch-kpis,
   #ch-fitlevels, #ch-bodyfat, #ch-city-tbody, #ch-meta.
   --- prior ---
   v2 (2026-05-31)
   v2: LAZY — fetches only when the Analytics panel is first opened (was eager on page load).
   Owns window.Analytics with REAL data (replaces the inline demo object, which is
   removed from the dashboard). Per-panel-loader pattern; no patches, no demo.

   Fetches the raw rows once, caches them, and recomputes everything client-side when
   the period/compare changes (instant, no refetch). Renders into the existing hooks:
     #analytics-kpis, #chart-growth, #chart-tiers, #chart-mrr, #chart-engagement,
     #demo-cities/-nationalities/-ages/-gender/-categories, #top-providers-tbody.

   Real sources: members (growth, tiers, demographics), transactions (revenue),
   activity_logs/claims/rsvps/applications/meetup_attendees/challenge_entries/referrals
   (engagement), claims+deals+providers (top providers).

   CURRENCY: revenue shown USD (transactions.amount_aed stores USD for member-facing
   amounts per the confirmed decision). Admin reads all via is_admin RLS.

   window.Analytics is defined SYNCHRONOUSLY so the dashboard's Analytics.init() /
   Analytics.renderCharts() call sites resolve; data loads async on init().
*/
(function () {
  'use strict';

  var BLUE = '#2ba8e0', YELLOW = '#FFCC00', MUTE = '#8a99a8';

  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  async function waitFor(check, ms) {
    var t = 0, lim = Math.ceil((ms || 20000) / 100);
    while (!check() && t < lim) { await new Promise(function (r) { setTimeout(r, 100); }); t++; }
    return check();
  }
  async function sel(table, cols, fn) {
    try { var q = window.supabase.from(table).select(cols); if (fn) q = fn(q); var r = await q; if (r.error) { console.warn('[FFP Analytics] ' + table + ':', r.error.message); return []; } return r.data || []; }
    catch (e) { console.warn('[FFP Analytics] ' + table, e); return []; }
  }
  function dnum(n) { return (n || 0).toLocaleString(); }

  // ── period → date range + comparison range + bucketing ──
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

  function periodRange(key) {
    var now = new Date();
    var t0 = startOfDay(now);
    var s, e = now, label, cmp = null;
    switch (key) {
      case 'today': s = t0; label = 'today'; cmp = 'yesterday'; break;
      case 'yesterday': s = addDays(t0, -1); e = t0; label = 'yesterday'; break;
      case 'thisWeek': s = addDays(t0, -(((now.getDay() + 6) % 7))); label = 'this week'; cmp = 'last week'; break;
      case 'lastWeek': e = addDays(t0, -(((now.getDay() + 6) % 7))); s = addDays(e, -7); label = 'last week'; break;
      case 'thisMonth': s = new Date(now.getFullYear(), now.getMonth(), 1); label = 'this month'; cmp = 'last month'; break;
      case 'lastMonth': e = new Date(now.getFullYear(), now.getMonth(), 1); s = addMonths(e, -1); label = 'last month'; break;
      case 'last90': s = addDays(t0, -90); label = 'last 90 days'; cmp = 'previous 90 days'; break;
      case 'thisQuarter': var q = Math.floor(now.getMonth() / 3); s = new Date(now.getFullYear(), q * 3, 1); label = 'this quarter'; cmp = 'last quarter'; break;
      case 'lastQuarter': var q2 = Math.floor(now.getMonth() / 3); e = new Date(now.getFullYear(), q2 * 3, 1); s = addMonths(e, -3); label = 'last quarter'; break;
      case 'last6m': s = addMonths(t0, -6); label = 'last 6 months'; cmp = 'previous 6 months'; break;
      case 'thisYear': s = new Date(now.getFullYear(), 0, 1); label = 'this year'; cmp = 'last year'; break;
      case 'lastYear': e = new Date(now.getFullYear(), 0, 1); s = new Date(now.getFullYear() - 1, 0, 1); label = 'last year'; break;
      case 'allTime': default: s = new Date(2024, 0, 1); label = 'all time'; key = 'allTime'; break;
    }
    var span = (e - s) / 86400000;
    var prevE = s, prevS = new Date(s.getTime() - (e - s));
    return { key: key, start: s, end: e, prevStart: prevS, prevEnd: prevE, label: label, compareLabel: cmp, span: span };
  }

  // buckets for the time-series charts
  function buckets(s, e, span) {
    var out = [];
    if (span <= 31) {
      var d = startOfDay(s);
      while (d < e) { var n = addDays(d, 1); out.push({ label: d.getDate() + '/' + (d.getMonth() + 1), start: new Date(d), end: n }); d = n; }
    } else if (span <= 186) {
      var d2 = startOfDay(s);
      while (d2 < e) { var n2 = addDays(d2, 7); out.push({ label: d2.getDate() + '/' + (d2.getMonth() + 1), start: new Date(d2), end: n2 }); d2 = n2; }
    } else {
      var d3 = new Date(s.getFullYear(), s.getMonth(), 1);
      var mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      while (d3 < e) { var n3 = addMonths(d3, 1); out.push({ label: mn[d3.getMonth()] + " '" + String(d3.getFullYear()).slice(2), start: new Date(d3), end: n3 }); d3 = n3; }
    }
    if (out.length > 24) { // cap label density
      var step = Math.ceil(out.length / 24);
      out = out.filter(function (_, i) { return i % step === 0; });
    }
    return out;
  }

  function inRange(ts, s, e) { if (!ts) return false; var t = new Date(ts); return t >= s && t < e; }
  function countIn(rows, field, s, e) { var c = 0; for (var i = 0; i < rows.length; i++) if (inRange(rows[i][field], s, e)) c++; return c; }

  // ── raw data cache ──
  var RAW = null;
  async function fetchAll() {
    var since = new Date(2024, 0, 1).toISOString();
    var res = await Promise.all([
      sel('members', 'id, tier, paid, city, country, nationality, date_of_birth, gender, created_at, role, referred_by, plan, access_code, stripe_subscription_id, stripe_session_id', function (q) { return q.eq('role', 'member'); }), // exclude provider/admin accounts
      sel('transactions', 'amount_aed, type, status, created_at', function (q) { return q.gte('created_at', since); }),
      sel('activity_logs', 'member_id, category, logged_at', function (q) { return q.gte('logged_at', since); }),
      sel('claims', 'member_id, deal_id, created_at'),
      sel('rsvps', 'member_id, created_at'),
      sel('applications', 'created_at'),
      sel('meetup_attendees', 'member_id, created_at'),
      sel('challenge_entries', 'created_at'),
      sel('referrals', 'referrer_id, created_at, status'),
      sel('deals', 'id, provider_id'),
      sel('providers', 'id, business_name')
    ]);
    var dealProv = {}; res[9].forEach(function (d) { dealProv[d.id] = d.provider_id; });
    var provName = {}; res[10].forEach(function (p) { provName[p.id] = p.business_name; });
    RAW = {
      members: res[0], tx: res[1], acts: res[2], claims: res[3], rsvps: res[4],
      apps: res[5], meetA: res[6], chalE: res[7], refs: res[8], dealProv: dealProv, provName: provName
    };
  }

  // ── GEO filter (Country / City) ──────────────────────────────
  // '' = all. City is the source of truth on each member; Country is derived from
  // the shared taxonomy (window.FFP_TAX.cities, country → [cities]). A member with a
  // city not in the taxonomy is bucketed under "Other".
  var GEO = { country: '', city: '' };
  var CITY2COUNTRY = null;
  // Built from window.FFP_TAX.cities — the STANDARDIZED taxonomy, hydrated from the DB
  // (taxonomy_items: 58 countries / 541 cities, admin-editable) via FFP_TAX_READY, with the
  // ffp-taxonomy.js map as fallback only until that resolves. _ensure awaits FFP_TAX_READY
  // and clears this cache so we always key off the live DB taxonomy, not the fallback.
  function city2country() {
    if (CITY2COUNTRY) return CITY2COUNTRY;
    var map = {};
    try {
      var c = (window.FFP_TAX && window.FFP_TAX.cities) || {};
      Object.keys(c).forEach(function (country) { (c[country] || []).forEach(function (city) { map[city] = country; }); });
    } catch (e) {}
    CITY2COUNTRY = map;
    return CITY2COUNTRY;
  }
  function countryOf(city) { if (!city) return null; return city2country()[city] || 'Other'; }
  // cities included by the current selection; null = all
  function selectedCities() {
    if (GEO.city) return [GEO.city];
    if (GEO.country) {
      var out = {};
      (RAW && RAW.members || []).forEach(function (m) { if (m.city && countryOf(m.city) === GEO.country) out[m.city] = 1; });
      return Object.keys(out);
    }
    return null;
  }
  function geoActive() { return !!(GEO.country || GEO.city); }
  function cityAllowed(city) { var sel = selectedCities(); return !sel || sel.indexOf(city) !== -1; }
  function geoMembers() { return geoActive() ? RAW.members.filter(function (m) { return cityAllowed(m.city); }) : RAW.members; }
  // map of member_id → true for the current selection; null = no filter
  function geoIdSet() {
    if (!geoActive()) return null;
    var s = {}; geoMembers().forEach(function (m) { if (m.id) s[m.id] = true; }); return s;
  }

  function revenueIn(s, e) { var sum = 0; RAW.tx.forEach(function (t) { if (inRange(t.created_at, s, e)) sum += Number(t.amount_aed || 0); }); return Math.round(sum); }
  function engagementCounts(s, e) {
    var set = geoIdSet();
    function cnt(rows, idField, dateField) {
      var c = 0; for (var i = 0; i < rows.length; i++) { var r = rows[i]; if (set && !set[r[idField]]) continue; if (inRange(r[dateField], s, e)) c++; } return c;
    }
    return {
      Logs: cnt(RAW.acts, 'member_id', 'logged_at'),
      Claims: cnt(RAW.claims, 'member_id', 'created_at'),
      RSVPs: cnt(RAW.rsvps, 'member_id', 'created_at'),
      Meet: cnt(RAW.meetA, 'member_id', 'created_at'),
      Chal: countIn(RAW.chalE, 'created_at', s, e),
      Refs: cnt(RAW.refs, 'referrer_id', 'created_at')
    };
  }
  function cumulativeMembersAt(d) { var c = 0; geoMembers().forEach(function (m) { if (m.created_at && new Date(m.created_at) < d) c++; }); return c; }

  // ── render helpers ──
  function demoRows(el, items, color, maxPctScale) {
    var node = document.getElementById(el); if (!node) return;
    var total = items.reduce(function (a, i) { return a + i.n; }, 0) || 1;
    if (!items.length || total === 0) { node.innerHTML = '<div class="demo-row" style="color:var(--muted);font-size:12px;">Builds as your data grows</div>'; return; }
    node.innerHTML = items.map(function (it) {
      var pct = Math.round(it.n / total * 100);
      var w = maxPctScale ? Math.min(100, pct * 2) : pct;
      return '<div class="demo-row"><div class="demo-row-label">' + esc(it.label) + '</div>' +
        '<div class="demo-row-bar"><div class="demo-row-bar-fill" style="width:' + w + '%;' + (color ? 'background:' + color + ';' : '') + '"></div></div>' +
        '<div class="demo-row-value">' + pct + '%</div></div>';
    }).join('');
  }
  function tally(rows, keyFn, labelMap) {
    var m = {}; rows.forEach(function (r) { var k = keyFn(r); if (k == null || k === '') return; m[k] = (m[k] || 0) + 1; });
    var arr = Object.keys(m).map(function (k) { return { label: labelMap ? (labelMap(k)) : k, n: m[k] }; });
    arr.sort(function (a, b) { return b.n - a.n; });
    return arr;
  }
  function ageBucket(dob) {
    if (!dob) return null; var a = (Date.now() - new Date(dob).getTime()) / (365.25 * 86400000);
    if (a < 18) return null; if (a < 25) return '18-24'; if (a < 35) return '25-34'; if (a < 45) return '35-44'; if (a < 55) return '45-54'; return '55+';
  }

  // ── the controller (synchronously assigned to window.Analytics) ──
  var A = {
    period: 'last90', compare: false, charts: {}, _loaded: false, _loading: false,

    init: function () { /* lazy: data loads when the Analytics panel is first opened */ },

    _ensure: async function () {
      if (this._loaded) return true;
      if (this._loading) return false;
      this._loading = true;
      var ok = await waitFor(function () { return window.supabase && typeof Chart !== 'undefined'; }, 20000);
      if (ok) await waitFor(function () { return window.FFP_ADMIN || (window.FFPAuth && window.FFPAuth.getMember && window.FFPAuth.getMember()); }, 20000);
      // Make sure the STANDARDIZED taxonomy (DB → FFP_TAX.cities) is hydrated before we map
      // cities → countries, so the location filter keys off the live admin taxonomy, not the
      // ffp-taxonomy.js fallback. Then clear the cache so it rebuilds from the hydrated lists.
      if (ok) { try { if (window.FFP_TAX_READY) await window.FFP_TAX_READY; } catch (e) {} CITY2COUNTRY = null; }
      if (ok) { try { await fetchAll(); this._loaded = true; } catch (e) { console.error('[FFP Analytics] load:', e); } }
      this._loading = false;
      return this._loaded;
    },

    renderAll: function () {
      this.renderGeoFilters();
      this.updateSummary(); this.renderKPIs(); this._drawCharts();
      this.renderDemographics(); this.renderTopProviders(); this.renderCategories(); this.renderSignups();
    },
    // re-render everything except rebuilding the geo dropdowns (used on geo change)
    _refresh: function () {
      this.updateSummary(); this.renderKPIs(); this._drawCharts();
      this.renderDemographics(); this.renderTopProviders(); this.renderCategories(); this.renderSignups();
    },

    // ── Country / City location filter ──
    renderGeoFilters: function () {
      if (!this._loaded) return;
      var cSel = document.getElementById('analytics-country');
      var citySel = document.getElementById('analytics-city');
      if (!cSel || !citySel) return;
      var countryCounts = {};
      RAW.members.forEach(function (m) { if (!m.city) return; var co = countryOf(m.city); countryCounts[co] = (countryCounts[co] || 0) + 1; });
      var countries = Object.keys(countryCounts).sort();
      cSel.innerHTML = '<option value="">All countries</option>' + countries.map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === GEO.country ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('');
      var cityCounts = {};
      RAW.members.forEach(function (m) {
        if (!m.city) return;
        if (GEO.country && countryOf(m.city) !== GEO.country) return;
        cityCounts[m.city] = (cityCounts[m.city] || 0) + 1;
      });
      var cities = Object.keys(cityCounts).sort();
      citySel.innerHTML = '<option value="">All cities</option>' + cities.map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === GEO.city ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('');
    },
    setCountry: function (v) {
      GEO.country = v || ''; GEO.city = '';
      if (!this._loaded) return;
      this.renderGeoFilters(); this._refresh();
    },
    setCity: function (v) {
      GEO.city = v || '';
      if (GEO.city) { var co = countryOf(GEO.city); if (co) GEO.country = co; }
      if (!this._loaded) return;
      this.renderGeoFilters(); this._refresh();
    },

    // (Community Health moved to its own panel + ffp-admin-health-loader.js — these are
    //  business/platform analytics only.)

    // dashboard calls Analytics.renderCharts() on panel open -> lazy-load, then render
    renderCharts: function () {
      var self = this;
      if (!this._loaded) { this._ensure().then(function (ok) { if (ok) self.renderAll(); }); return; }
      this._drawCharts();
    },

    setPeriod: function (period, btn) {
      this.period = period;
      document.querySelectorAll('.time-chip').forEach(function (c) { c.classList.remove('active'); });
      if (btn) btn.classList.add('active');
      this.updateSummary(); this.renderKPIs(); this.renderCharts(); this.renderCategories(); this.renderSignups();
    },
    toggleCompare: function () {
      this.compare = !this.compare;
      var tg = document.getElementById('compare-toggle'); if (tg) tg.classList.toggle('on', this.compare);
      this.updateSummary(); this.renderKPIs(); this.renderCharts();
    },
    updateSummary: function () {
      var r = periodRange(this.period);
      var sum = document.getElementById('time-period-summary');
      if (sum) sum.innerHTML = (this.compare && r.compareLabel)
        ? 'Showing data for <span class="range">' + r.label + '</span> compared with <span class="compare-range">' + r.compareLabel + '</span>'
        : 'Showing data for <span class="range">' + r.label + '</span>';
      var gm = document.getElementById('chart-growth-meta'); if (gm) gm.textContent = r.label;
      var em = document.getElementById('chart-engagement-meta'); if (em) em.textContent = 'Actions · ' + r.label;
    },

    renderKPIs: function () {
      if (!this._loaded) return;
      var r = periodRange(this.period);
      var mem = geoMembers();
      var cur = {
        members: countIn(mem, 'created_at', r.start, r.end),
        rev: revenueIn(r.start, r.end),
        eng: (function () { var e = engagementCounts(r.start, r.end); return e.Logs + e.Claims + e.RSVPs + e.Meet + e.Chal + e.Refs; })(),
        paid: mem.filter(function (m) { return m.paid; }).length
      };
      var prev = {
        members: countIn(mem, 'created_at', r.prevStart, r.prevEnd),
        rev: revenueIn(r.prevStart, r.prevEnd),
        eng: (function () { var e = engagementCounts(r.prevStart, r.prevEnd); return e.Logs + e.Claims + e.RSVPs + e.Meet + e.Chal + e.Refs; })()
      };
      var showCmp = this.compare && this.period !== 'allTime';
      var tiles = [
        { label: 'New Members', v: cur.members, p: prev.members, fmt: function (x) { return dnum(x); } },
        { label: 'Revenue', v: cur.rev, p: prev.rev, fmt: function (x) { return '<span style="font-size:12px;color:var(--muted);">$</span> ' + dnum(x); } },
        { label: 'Engagement actions', v: cur.eng, p: prev.eng, fmt: function (x) { return dnum(x); } },
        { label: 'Paid Members', v: cur.paid, p: null, fmt: function (x) { return dnum(x); } }
      ];
      function delta(c, p) { if (p == null || p === 0) return null; var pct = (c - p) / p * 100; return { pct: Math.abs(pct).toFixed(0), dir: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' }; }
      var el = document.getElementById('analytics-kpis'); if (!el) return;
      el.innerHTML = tiles.map(function (t) {
        var cmp = '';
        if (showCmp && t.p != null) {
          var d = delta(t.v, t.p);
          if (d) { var icon = d.dir === 'up' ? 'arrow_upward' : d.dir === 'down' ? 'arrow_downward' : 'remove';
            cmp = '<div class="kpi-compare"><span class="kpi-compare-prev">vs ' + t.fmt(t.p) + '</span>' +
              '<span class="kpi-compare-delta ' + d.dir + '"><span class="material-icons">' + icon + '</span>' + d.pct + '%</span></div>'; }
        }
        return '<div class="kpi-tile with-compare"><div class="kpi-label">' + t.label + '</div>' +
          '<div class="kpi-value f-tabular">' + t.fmt(t.v) + '</div>' + cmp + '</div>';
      }).join('');
    },

    _drawCharts: function () {
      if (!this._loaded || typeof Chart === 'undefined') return;
      var self = this, r = periodRange(this.period), bk = buckets(r.start, r.end, r.span);

      // Growth (cumulative members at each bucket end)
      this._chart('growth', 'chart-growth', 'line', {
        labels: bk.map(function (b) { return b.label; }),
        datasets: [{ label: 'Members', data: bk.map(function (b) { return cumulativeMembersAt(b.end); }), borderColor: YELLOW, backgroundColor: 'rgba(255,204,0,0.10)', tension: 0.35, fill: true, pointRadius: 2, pointBackgroundColor: YELLOW }]
      }, {});

      // Tiers (current snapshot, geo-scoped)
      var memG = geoMembers();
      var tiers = { member: 0, supporter: 0, ambassador: 0 };
      memG.forEach(function (m) { var t = (m.tier || 'member'); if (tiers[t] == null) tiers[t] = 0; tiers[t]++; });
      var tmeta = document.getElementById('chart-tiers-meta'); if (tmeta) tmeta.textContent = memG.length + ' members';
      this._chart('tiers', 'chart-tiers', 'doughnut', {
        labels: ['Member', 'Supporter', 'Ambassador'],
        datasets: [{ data: [tiers.member || 0, tiers.supporter || 0, tiers.ambassador || 0], backgroundColor: [MUTE, BLUE, YELLOW], borderWidth: 0, hoverOffset: 8 }]
      }, { legend: true });

      // Revenue (USD) by bucket
      this._chart('mrr', 'chart-mrr', 'bar', {
        labels: bk.map(function (b) { return b.label; }),
        datasets: [{ label: '$', data: bk.map(function (b) { return revenueIn(b.start, b.end); }), backgroundColor: BLUE, borderRadius: 6 }]
      }, {});

      // Engagement mix in range
      var eng = engagementCounts(r.start, r.end);
      this._chart('engagement', 'chart-engagement', 'bar', {
        labels: ['Logs', 'Claims', 'RSVPs', 'Meet', 'Chal', 'Refs'],
        datasets: [{ label: r.label, data: [eng.Logs, eng.Claims, eng.RSVPs, eng.Meet, eng.Chal, eng.Refs], backgroundColor: YELLOW, borderRadius: 4 }]
      }, { indexAxis: 'y' });
    },

    _chart: function (key, canvasId, type, data, opts) {
      if (this.charts[key]) this.charts[key].destroy();
      var ctx = document.getElementById(canvasId); if (!ctx) return;
      this.charts[key] = new Chart(ctx, { type: type, data: data, options: this._opts(opts || {}) });
    },
    _opts: function (o) {
      return {
        responsive: true, maintainAspectRatio: false, indexAxis: o.indexAxis || 'x',
        plugins: { legend: o.legend ? { display: true, position: 'bottom', labels: { color: MUTE, font: { family: 'Montserrat', size: 11, weight: '700' }, padding: 12, boxWidth: 12, boxHeight: 12 } } : { display: false } },
        scales: {
          x: { ticks: { color: MUTE, font: { size: 10 } }, grid: { color: 'rgba(138,153,168,0.08)' } },
          y: { ticks: { color: MUTE, font: { size: 10 } }, grid: { color: 'rgba(138,153,168,0.08)' }, beginAtZero: true }
        }
      };
    },

    renderDemographics: function () {
      if (!this._loaded) return;
      var m = geoMembers();
      demoRows('demo-cities', tally(m, function (x) { return x.city; }).slice(0, 6), BLUE, false);
      demoRows('demo-nationalities', tally(m, function (x) { return x.nationality; }).slice(0, 7), YELLOW, false);
      demoRows('demo-ages', tally(m, function (x) { return ageBucket(x.date_of_birth); }), BLUE, false);
      demoRows('demo-gender', tally(m, function (x) { return x.gender ? (x.gender[0].toUpperCase() + x.gender.slice(1)) : null; }), YELLOW, false);
    },
    renderCategories: function () {
      if (!this._loaded) return;
      var r = periodRange(this.period);
      var set = geoIdSet();
      var inP = RAW.acts.filter(function (a) { return (!set || set[a.member_id]) && inRange(a.logged_at, r.start, r.end); });
      demoRows('demo-categories', tally(inP, function (x) { return x.category; }).slice(0, 6), null, true);
    },
    // ── How members are signing up: method (how) · plan (membership) · country/city (where) ──
    // Scoped by the current period + geo filter, like the rest of the panel. Falls back to
    // all-time if the selected period has no signups, so the section is never blank.
    renderSignups: function () {
      if (!this._loaded) return;
      var r = periodRange(this.period);
      var inP = geoMembers().filter(function (m) { return inRange(m.created_at, r.start, r.end); });
      var usingAll = !inP.length;
      var scoped = usingAll ? geoMembers() : inP;
      var meta = document.getElementById('signup-meta');
      if (meta) meta.textContent = scoped.length + ' member' + (scoped.length === 1 ? '' : 's') + ' · ' + (usingAll ? 'all time' : r.label);

      function method(m) {
        if (m.referred_by) return 'Referral';
        if (m.stripe_subscription_id || m.stripe_session_id) return 'Paid (Stripe)';
        if (m.access_code) return 'Access code';
        return 'Direct (email)';
      }
      function planLabel(m) {
        if (!m.plan) return 'Free / none';
        return String(m.plan).charAt(0).toUpperCase() + String(m.plan).slice(1);
      }
      demoRows('signup-method', tally(scoped, method), BLUE, false);
      demoRows('signup-plan', tally(scoped, planLabel), YELLOW, false);
      demoRows('signup-countries', tally(scoped, function (m) { return m.country || countryOf(m.city); }).slice(0, 6), BLUE, false);
      demoRows('signup-cities', tally(scoped, function (m) { return m.city; }).slice(0, 6), YELLOW, false);
    },
    renderTopProviders: function () {
      if (!this._loaded) return;
      var cutoff = addDays(new Date(), -30);
      var set = geoIdSet();
      var counts = {};
      RAW.claims.forEach(function (c) {
        if (!c.created_at || new Date(c.created_at) < cutoff) return;
        if (set && !set[c.member_id]) return;
        var pid = RAW.dealProv[c.deal_id]; if (!pid) return;
        counts[pid] = (counts[pid] || 0) + 1;
      });
      var arr = Object.keys(counts).map(function (pid) { return { name: RAW.provName[pid] || 'Provider', claims: counts[pid] }; });
      arr.sort(function (a, b) { return b.claims - a.claims; });
      var tbody = document.getElementById('top-providers-tbody'); if (!tbody) return;
      tbody.innerHTML = arr.length ? arr.slice(0, 7).map(function (t, i) {
        return '<tr><td style="font-weight:800; color:var(--yellow);">' + (i + 1) + '</td><td>' + esc(t.name) + '</td>' +
          '<td class="f-tabular"><strong>' + t.claims + '</strong></td><td class="text-muted">—</td></tr>';
      }).join('') : '<tr><td colspan="4" class="text-muted" style="text-align:center;padding:20px;">No claims in the last 30 days yet</td></tr>';
    }
  };


  // If the DB taxonomy hydrates (or an admin edits it) after the panel is already open,
  // re-key the city→country map and re-render so the filter stays matched to the taxonomy.
  try {
    document.addEventListener('ffp-tax-ready', function () {
      CITY2COUNTRY = null;
      if (A._loaded) { A.renderGeoFilters(); A._refresh(); }
    });
  } catch (e) {}

  window.Analytics = A;
})();

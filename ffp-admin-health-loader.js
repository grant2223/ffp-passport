/* FFP Admin — Community Health Loader — v1 (2026-06-03)
   Owns the Community Health panel (#panel-community-health), a SEPARATE tab from business
   Analytics. These are health/fitness statistics (body composition, cardio fitness, vitals)
   — nothing to do with member/provider/revenue/engagement counts, so they live on their own.

   Source: community_health_stats(p_cities text[]) SECURITY DEFINER RPC (aggregates
   profile_meta joined to members; no PII; anon-callable). Renders:
     #ch-kpis        community-wide metric tiles (body fat, VO2, resting HR, weight, HRV,
                     visceral, waist, bio age) — a tile only appears once ≥1 member logged it
     #ch-fitlevels   VO2-max fit-level distribution
     #ch-bodyfat     body-composition distribution
     #ch-city-tbody  per-emirate/city averages
     #ch-meta        "N members with fitness stats"

   Own Country / City location filter (#ch-country / #ch-city), keyed to the STANDARDIZED
   taxonomy (window.FFP_TAX.cities ← DB taxonomy_items via FFP_TAX_READY; ffp-taxonomy.js map
   is fallback only). Dropdowns list the countries/cities that actually have health data
   (from the RPC's by_city), grouped by the taxonomy. Lazy-loaded on first open of the panel.
*/
(function () {
  'use strict';
  var BLUE = '#2ba8e0', YELLOW = '#FFCC00';

  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  async function waitFor(check, ms) {
    var t = 0, lim = Math.ceil((ms || 20000) / 100);
    while (!check() && t < lim) { await new Promise(function (r) { setTimeout(r, 100); }); t++; }
    return check();
  }

  // ── standardized taxonomy: city → country (DB-hydrated FFP_TAX.cities) ──
  var C2C = null;
  function city2country() {
    if (C2C) return C2C;
    var m = {};
    try {
      var c = (window.FFP_TAX && window.FFP_TAX.cities) || {};
      Object.keys(c).forEach(function (co) { (c[co] || []).forEach(function (ci) { m[ci] = co; }); });
    } catch (e) {}
    C2C = m; return C2C;
  }
  function countryOf(city) { if (!city) return null; return city2country()[city] || 'Other'; }

  var GEO = { country: '', city: '' };
  var ALL = null;   // unfiltered RPC result — used to build the dropdowns (cities with data)

  var H = {
    _busy: false,

    render: async function () {
      var ok = await waitFor(function () { return window.supabase && window.supabase.rpc; }, 20000);
      if (!ok) return;
      try { if (window.FFP_TAX_READY) await window.FFP_TAX_READY; } catch (e) {}
      C2C = null; // rebuild from the live (DB-hydrated) taxonomy
      if (!ALL) { ALL = await this._fetch(null); }
      this.renderFilters();
      var cities = this._selectedCities();
      var data = cities ? await this._fetch(cities) : ALL;
      if (data) this._draw(data);
    },

    _fetch: async function (cities) {
      try {
        var res = await window.supabase.rpc('community_health_stats', cities ? { p_cities: cities } : {});
        if (res.error) { console.warn('[FFP Health] community_health_stats:', res.error.message); return null; }
        return res.data;
      } catch (e) { console.warn('[FFP Health] community_health_stats', e); return null; }
    },

    _selectedCities: function () {
      if (GEO.city) return [GEO.city];
      if (GEO.country) {
        var out = {};
        ((ALL && ALL.by_city) || []).forEach(function (r) { if (countryOf(r.city) === GEO.country) out[r.city] = 1; });
        return Object.keys(out);
      }
      return null;
    },

    setCountry: function (v) { GEO.country = v || ''; GEO.city = ''; this.render(); },
    setCity: function (v) { GEO.city = v || ''; if (GEO.city) { var co = countryOf(GEO.city); if (co) GEO.country = co; } this.render(); },

    renderFilters: function () {
      var cSel = document.getElementById('ch-country'), citySel = document.getElementById('ch-city');
      if (!cSel || !citySel) return;
      var rows = (ALL && ALL.by_city) || [];
      var countries = {}; rows.forEach(function (r) { if (r.city) countries[countryOf(r.city)] = 1; });
      var cl = Object.keys(countries).sort();
      cSel.innerHTML = '<option value="">All countries</option>' + cl.map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === GEO.country ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('');
      var cities = rows.map(function (r) { return r.city; })
        .filter(function (ci) { return ci && (!GEO.country || countryOf(ci) === GEO.country); }).sort();
      citySel.innerHTML = '<option value="">All cities</option>' + cities.map(function (ci) {
        return '<option value="' + esc(ci) + '"' + (ci === GEO.city ? ' selected' : '') + '>' + esc(ci) + '</option>';
      }).join('');
    },

    _draw: function (data) {
      var c = data.community || {};

      // metric tiles (only metrics with ≥1 reading get a number)
      function metric(m) { return (m && m.n > 0 && m.avg != null) ? m : null; }
      var tiles = [
        { label: 'Avg Body Fat',  m: c.body_fat,   fmt: function (v) { return v + '<span style="font-size:13px;color:var(--muted);">%</span>'; } },
        { label: 'Avg VO₂ max',   m: c.vo2,        fmt: function (v) { return String(v); } },
        { label: 'Avg Resting HR',m: c.resting_hr, fmt: function (v) { return v + '<span style="font-size:13px;color:var(--muted);"> bpm</span>'; } },
        { label: 'Avg Weight',    m: c.weight,     fmt: function (v) { return v + '<span style="font-size:13px;color:var(--muted);"> kg</span>'; } },
        { label: 'Avg HRV',       m: c.hrv,        fmt: function (v) { return v + '<span style="font-size:13px;color:var(--muted);"> ms</span>'; } },
        { label: 'Avg Visceral',  m: c.visceral,   fmt: function (v) { return String(v); } },
        { label: 'Avg Waist',     m: c.waist,      fmt: function (v) { return v + '<span style="font-size:13px;color:var(--muted);"> cm</span>'; } },
        { label: 'Avg Bio Age',   m: c.bio_age,    fmt: function (v) { return v + '<span style="font-size:13px;color:var(--muted);"> yrs</span>'; } }
      ];
      var kp = document.getElementById('ch-kpis');
      if (kp) {
        var live = tiles.filter(function (t) { return metric(t.m); });
        kp.innerHTML = live.length ? live.map(function (t) {
          return '<div class="kpi-tile"><div class="kpi-label">' + t.label + '</div>' +
            '<div class="kpi-value f-tabular">' + t.fmt(t.m.avg) + '</div>' +
            '<div class="kpi-compare"><span class="kpi-compare-prev">' + t.m.n + ' member' + (t.m.n === 1 ? '' : 's') + ' logged</span></div></div>';
        }).join('') : '<div class="kpi-tile"><div class="kpi-label">Community Health</div><div class="kpi-value" style="font-size:14px;color:var(--muted);">Builds as members log their stats</div></div>';
      }
      var meta = document.getElementById('ch-meta');
      if (meta) meta.textContent = (c.members || 0) + ' member' + (c.members === 1 ? '' : 's') + ' with fitness stats';

      // distribution bars (demoRows shape: [{label, n}])
      function bands(elId, fl, defs, color) {
        var node = document.getElementById(elId); if (!node) return;
        if (!fl || !fl.n) { node.innerHTML = '<div class="demo-row" style="color:var(--muted);font-size:12px;">Builds as your data grows</div>'; return; }
        var items = defs.map(function (d) { return { label: d.label, n: fl[d.key] || 0 }; });
        var total = fl.n || 1;
        node.innerHTML = items.map(function (it) {
          var pct = Math.round(it.n / total * 100);
          return '<div class="demo-row"><div class="demo-row-label">' + esc(it.label) + '</div>' +
            '<div class="demo-row-bar"><div class="demo-row-bar-fill" style="width:' + pct + '%;background:' + color + ';"></div></div>' +
            '<div class="demo-row-value">' + it.n + '</div></div>';
        }).join('');
      }
      bands('ch-fitlevels', data.fit_levels, [
        { key: 'elite', label: 'Elite (50+)' }, { key: 'excellent', label: 'Excellent (43–49)' },
        { key: 'good', label: 'Good (36–42)' }, { key: 'fair', label: 'Fair (30–35)' },
        { key: 'low', label: 'Building (<30)' }
      ], YELLOW);
      bands('ch-bodyfat', data.body_fat_bands, [
        { key: 'lean', label: 'Lean (<15%)' }, { key: 'fit', label: 'Fit (15–21%)' },
        { key: 'average', label: 'Average (22–29%)' }, { key: 'high', label: 'High (30%+)' }
      ], BLUE);

      // per-emirate / city table
      var tb = document.getElementById('ch-city-tbody');
      if (tb) {
        var rows = (data.by_city || []);
        function cell(v, n, suffix) { return (n > 0 && v != null) ? (v + (suffix || '')) : '<span class="text-muted">—</span>'; }
        tb.innerHTML = rows.length ? rows.map(function (r) {
          return '<tr><td><strong>' + esc(r.city) + '</strong></td>' +
            '<td class="f-tabular">' + (r.members || 0) + '</td>' +
            '<td class="f-tabular">' + cell(r.body_fat, r.body_fat_n, '%') + '</td>' +
            '<td class="f-tabular">' + cell(r.vo2, r.vo2_n, '') + '</td>' +
            '<td class="f-tabular">' + cell(r.resting_hr, r.resting_hr_n, ' bpm') + '</td>' +
            '<td class="f-tabular">' + cell(r.weight, r.weight_n, ' kg') + '</td></tr>';
        }).join('') : '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:20px;">Builds as members log their stats</td></tr>';
      }
    }
  };

  // re-key + re-render if the DB taxonomy hydrates / an admin edits it after first paint
  try {
    document.addEventListener('ffp-tax-ready', function () { C2C = null; if (ALL) H.render(); });
  } catch (e) {}

  window.CommunityHealth = H;
})();

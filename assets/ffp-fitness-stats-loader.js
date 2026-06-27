/* FFP Fitness Stats Loader — v35 (2026-06-08)
   v35: ACTIVITY browse-by-month now shows a TOTALS strip above the list — count, total time, total
        distance, total calories (metrics with data only). Pairs with member dashboard FFP_BUILD 335.
   v34 (2026-06-08): ACTIVITY list redesign — each entry is now a 2-line block (name + date, then a wrapping chip row:
        duration / km / kcal / bpm / city) so logged metrics are legible, not crammed. Recent list capped
        at 10. New calendar icon (in the dashboard header) toggles a browse-by-month view with ◀/▶ month
        nav (renderRecentList + window.ffpActivityToggleCal / ffpActivityMonthStep). activityCache carries
        logged_at for month filtering.
   v33 (2026-06-08): ACTIVITY — activityCache carries distance_km + avg_heart_rate; recent list shows
        distance · kcal · bpm. Pairs with Log Activity modal's new Distance + Avg HR fields.
   v32 (2026-06-07): MILESTONES — feeds the 2 new event-resume journeys. fetchMsSocial now also calls
        member_event_results and caches comps + runRaces; renderMilestones passes values.comps /
        values.runRaces to FFPMSBadges v6 (Competitions + Running Races journeys).
   v31 (2026-06-06)
   v31: RECORDS — added two standard field/conditioning tests: BRONCO (1.2km shuttle, time mm:ss, lower better,
        col pr_bronco_sec) and BEEP TEST (multi-stage fitness / bleep test level, higher better, col
        beep_test_level). Both added to METRICS + PR_MAP (Cardio group); profile_meta columns added via MCP.
        Records UI + save/load pick them up automatically (time editor for Bronco, number for Beep Test).
   v30: QUESTS wall now live — fetchMsSocial also calls member_quests_completed (new SECURITY DEFINER RPC:
        count of quest_progress rows with status='completed') and passes values.quests, so the Quests journey
        fills from real data alongside Meetups + Connections.
   v29: GRANULAR milestone values. Now passes a number per JOURNEY to FFPMSBadges (v4): deadlift/squat/bench
        ×bodyweight, sports variety (unique activities), 5K/10K/Half/Marathon PR seconds (no PR → 1e9 so the
        journey shows but stays locked), VO₂ max, cities, body-fat %. (Single 'strength'/'endurance' values
        removed — split into their own journeys.) Meetups/Connections still via the RPCs.
   v28: ENDURANCE value is now a DROPPING-TIME / distance tier (NOT total minutes): computed from the run
        PRs — Finish 5K/10K/Half/Marathon, then Marathon time bands sub-5:00 … sub-2:50 (ultra tiers wait
        on ultra-distance tracking). Handed to FFPMSBadges like the other numbers. (Ladders themselves and
        the FREQUENT-WINS generator live in assets/ffp-milestone-badges.js v3.)
   v27: MILESTONES now MULTI-METRIC. renderMilestones delegates to window.FFPMSBadges
        (assets/ffp-milestone-badges.js) — 8 object-badge designs (plate, skyline, stopwatch,
        scales, map, wreath+people, laurel medallion), each its own ladder, recolouring across the
        8 levels. Loader gathers the numbers (activities, deadlift x bodyweight, cities, total
        active minutes, body-fat %, + Meetups/Connections via member_meets / member_connections_count
        RPCs) and hands them to the module. Quests wall is ready in the module but waits on a
        completed-count RPC (passed once available). The old single-metric wall helpers (msWall*,
        msMedallion, FFP_MS_LEVELS) are now dead and can be removed in a later cleanup.
   v26: MILESTONES redesigned to the ACTIVITIES MEDALLION WALL (Grant's minted laurel-wreath badge).
        The tab is now a full-page wall of 80 medallions for Activities Logged: 8 colour LEVELS
        (Bronze, Silver, Gold, Emerald, Sapphire, Amethyst, Ruby, Legend) x 10 STAGES each, on a
        front-loaded ladder (frequent early wins, max gap 20, tops out at 730 ~ 5+ years). Earned
        medallions mint into the full wreath badge; the immediate target shows NEXT (+ how many to go);
        the rest are ghost slots showing the goal number. Replaces the v20 rows + v23 recurring-cycle
        ring cards (both removed from the tab; MS_LADDERS/ffpMilestoneDetail left dormant for now).
   v25: Version bump only — re-stamps the v24 perf work (parallel reads + deferred ranking pool) as ONE clear
        version, because the deferred-pool speed-up was added under v24 without a bump. v25 = "has both
        speed-ups", unambiguous. Loaded at ?v=FFP_BUILD (now 305).
   v24: PERF — faster Fitness Stats panel open, no member-facing change to data or actions. (a) The three reads
        (profile meta, activity logs, ranking pool) now fire in PARALLEL (Promise.all) instead of one-after-another.
        (b) The panel paints as soon as profile+logs are in; the heavier all-members ranking pool loads in the
        background and the Records leaderboard fills the instant it lands. Cache-busted by the dashboard FFP_BUILD.
   v23: Milestones reworked to RECURRING CYCLES for cumulative metrics (Grant's model). A milestone is not a
        finish line — it REPEATS every N and accumulates a count (×N), forever. Each metric runs a few cycles
        (a short frequent one = the constant reminder, plus bigger ones), each ticking at its own fixed pace:
          • Activities Logged — every 10 / 25 / 50 / 100 / 250 / 500 / 1,000
          • Activity Streak  — Daily / Weekly / Monthly / Quarterly / Half-Year / Yearly
          • Sport Variety    — new / every 5 / every 10
          • Cities Active    — new / every 5 / 10 / 25
        Detail view = a card per cycle: an emblem with ×count, a progress RING to the next, and "X to next".
        Tab shows total badges earned (×). Engine: msBuildState gets an L.cycles branch (count=floor(val/n),
        prog, toNext, totalEarned). Performance metrics (lifts / runs / body-fat) stay one-time bests — you
        don't "repeat" a 2× deadlift. (Replaces the finite badge-ladder model for the cumulative metrics.)
        Cache-busted by the member dashboard FFP_BUILD.
   v21: Milestone detail BADGE LADDER restyled — was wide horizontal rows (too much vertical gap, didn't read
        as badges). Now a compact GRID of circular badge/stamp emblems: gold filled = earned, dashed blue =
        next, grey = locked. (Cache-busted by the member dashboard FFP_BUILD.)
   v20: MILESTONES tab redesigned — each metric is now a tappable row → its own detail page with a top
        strap (now / up-next + bar) and the FULL ladder of badges (earned lit, next flagged, locked shown).
        92 badges across 12 metrics: Activities Logged→10k, Activity Streak→5yr, Sport Variety, Cities→100,
        Deadlift/Squat/Bench (×bw), 5K/10K/Half/Marathon (finish→near-WR times), Body Fat→Shredded. The tier
        LOGIC was unit-tested in isolation before integrating. (overrideMilestonesV20 + window.ffpMilestoneDetail;
        reuses the dashboard's openDetailModal full-bleed.) NOTE: Sport Variety caps at 50 (the activity
        taxonomy is dynamic/larger than "80", so no literal "all 80" badge); other Health metrics (VO2/grip/
        sleep/etc.) still use the old rows — they need age/sex-banded ladders, a clean follow-up.
   v19: Activity-tab STREAK now uses TODAY-GRACE (matches the passport panel) — a live streak no longer
        reads 0 just because today isn't logged yet, then jumps when you log. (Pairs with the DB fix to
        get_ranking_pool: role filter was '= member', which wrongly excluded admins who are real members,
        so an admin's logged PRs never appeared on the leaderboard — now excludes only providers.)
   v18 (2026-06-02): READ-BACK FIX — records were SAVING fine (confirmed in DB) but the Records tab
       read them from a backend /profile-meta endpoint that DOESN'T EXIST (404) → FitnessStats.records
       stayed empty → "No record yet". Now reads via the member_profile_meta_get SECURITY DEFINER RPC
       (same proven path as the save), so saved records/health/weight/sleep reload correctly. Also: the
       whole "My PR" card is tappable now (opens the full-screen editor), not just the small button.
   v17 (2026-06-02): Records "My PR" card now shows a COMMUNITY BENCHMARK line — "Group avg X ·
       you’re top Y%" — computed from the current filtered ranking pool (≥3 people), alongside the
       existing rank + leaderboard.
   v16 (2026-06-02): SAVE moved OUT of this lazy loader into the always-loaded CORE FitnessStats
        (dashboard v229) — records/health/weight/sleep now persist via member_profile_meta_save
        straight from the core, exactly like activity logs, so it no longer depends on this loader
        installing in time. This loader's write-wraps now ONLY refresh the local leaderboard +
        records view (no DB write — no double-save). Reads/leaderboard/activity tabs unchanged.
   v15.1: HARDEN the save fix — the render overrides + write wrappers (wrapWrites) now run
        IMMEDIATELY after the member id is known, BEFORE any network call. Previously they ran
        after `await get_ranking_pool`; if that threw, the outer try/catch swallowed it and
        savePr/clearPr/saveSleepLog were never wrapped → saves silently no-op'd. The pool fetch
        is now isolated in its own try/catch so it can't abort wrapping. Runtime log says v15.1.
   v15: SAVE FIX — records (PR/health), body weight, and sleep now PERSIST. Writes went via
        window.supabase.from('profile_meta').upsert() directly, which silently affected 0 rows
        for member sessions (custom JWT → auth.uid() trap), so nothing saved (and BioAge, derived
        from the health records, stayed empty). savePr/clearPr/saveSleepLog now call the
        member_profile_meta_save SECURITY DEFINER RPC (whitelisted columns + pr_dates merge,
        GRANT anon/authenticated). Verified to persist. (Modal full-screen fix is in the dashboard.)
   v14: Activity breakdown has a period filter (Week/Month/3M/6M/Year/All).
   v13: Activity tab = per-activity breakdown (x times + hours) + recent activity list
        (recent moved here from the Passport). Removed the "last 30 days" tiles.
   v12: Records filters collapsed by default (tap Filters to expand).
   v11: member reads (demographics, profile_meta, activity_logs) go via the BACKEND
        (service-role) like the Passport journey — browser reads return nothing for
        member sessions. Ranking pool stays on the get_ranking_pool RPC.
   v10: member id comes from FFPAuth.getMember() (custom auth), NOT supabase.auth.getUser()
        (members are not Supabase-Auth users, so getUser() was null -> all reads empty).
   v8 fix: Override renderRecords() directly (not wrap render). v7 wrapped render() which
   meant the dashboard's original renderRecords still ran and tried to populate pr-strength
   / pr-cardio / pr-health divs that the new layout removed → null innerHTML crash on tab
   switch. v8 replaces renderRecords with the new build/render.
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
  var activityPeriod = 'all';
  window.ffpSetActivityPeriod = function (p) { activityPeriod = p; if (typeof FitnessStats !== 'undefined' && FitnessStats.renderActivity) FitnessStats.renderActivity(); };
  // v16 — open a metric's leaderboard from the Bio Age health cards (Health metrics no longer in the Records chip strip).
  window.ffpShowLeaderboard = function (key) {
    filters.metric = key;
    if (typeof saveFilters === 'function') saveFilters();
    var rb = document.querySelector('#fs-tabs [data-fs-tab="records"]');
    if (rb) rb.click();
    if (typeof updateMetricChips === 'function') updateMetricChips();
    if (typeof renderRecordsContent === 'function') renderRecordsContent();
  };
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
      '.ffp-filters-reset{background:var(--yellow);border:none;color:#08111a;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;}',
      '.ffp-filters-reset:hover{filter:brightness(1.08);}',

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
    { key: 'bronco',      label: 'Bronco',    icon: 'directions_run',     col: 'pr_bronco_sec',   unit: 'time',      dir: 'lower',  kind: 'time', group: 'Cardio' },
    { key: 'beepTest',    label: 'Beep Test', icon: 'graphic_eq',         col: 'beep_test_level', unit: 'lvl',       dir: 'higher', kind: 'num',  group: 'Cardio' },
    { key: 'vo2max',      label: 'VO\u2082',  icon: 'favorite',           col: 'vo2_max',         unit: 'ml/kg/min', dir: 'higher', kind: 'num',  group: 'Health' },
    { key: 'bodyFat',     label: 'Body Fat',  icon: 'monitor_weight',     col: 'body_fat_pct',    unit: '%',         dir: 'lower',  kind: 'num',  group: 'Health' },
    { key: 'visceralFat', label: 'Visceral',  icon: 'medical_information',col: 'visceral_fat',    unit: 'rating',    dir: 'lower',  kind: 'num',  group: 'Health' },
    { key: 'sleepAvgHrs', label: 'Sleep',     icon: 'bedtime',            col: 'sleep_avg_hours', unit: 'hrs',       dir: 'higher', kind: 'num',  group: 'Health' },
    { key: 'restingHR',   label: 'Resting HR',icon: 'monitor_heart',      col: 'resting_hr',      unit: 'bpm',       dir: 'lower',  kind: 'num',  group: 'Health' },
    { key: 'hrv',         label: 'HRV',       icon: 'vital_signs',        col: 'hrv_ms',          unit: 'ms',        dir: 'higher', kind: 'num',  group: 'Health' },
    { key: 'grip',        label: 'Grip',      icon: 'pan_tool',           col: 'grip_strength_kg',unit: 'kg',        dir: 'higher', kind: 'num',  group: 'Health' },
    { key: 'muscleMass',  label: 'Muscle',    icon: 'exercise',           col: 'muscle_mass_kg',  unit: 'kg',        dir: 'higher', kind: 'num',  group: 'Health',
      derive: function (r) { var h = r.height_cm; if (r.muscle_mass_kg == null || !h) return null; return r.muscle_mass_kg / Math.pow(h / 100, 2); }, lbUnit: 'kg/m\u00b2', lbDecimals: 1 },
    { key: 'waist',       label: 'Waist',     icon: 'straighten',         col: 'waist_cm',        unit: 'cm',        dir: 'lower',  kind: 'num',  group: 'Health',
      derive: function (r) { var h = r.height_cm; if (r.waist_cm == null || !h) return null; return r.waist_cm / h; }, lbUnit: 'WHtR', lbDecimals: 2 }
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

  // v15 — value accessor: derived metrics (waist->WHtR, muscle->index) rank by computed
  // value using height_cm; all others use their raw column.
  function metricVal(r, metric) {
    if (!r) return null;
    if (metric.derive) { var d = metric.derive(r); return (d == null || isNaN(d)) ? null : d; }
    return r[metric.col] != null ? Number(r[metric.col]) : null;
  }
  function formatLbValue(r, metric) {
    if (metric.derive) { var d = metricVal(r, metric); return d == null ? '\u2014' : d.toFixed(metric.lbDecimals != null ? metric.lbDecimals : 1); }
    return formatMetricValue(r[metric.col], metric);
  }

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
    bronco:      { col: 'pr_bronco_sec',   cast: 'int',   dir: 'lower'  },
    beepTest:    { col: 'beep_test_level', cast: 'float', dir: 'higher' },
    vo2max:      { col: 'vo2_max',         cast: 'float', dir: 'higher' },
    bodyFat:     { col: 'body_fat_pct',    cast: 'float', dir: 'lower'  },
    visceralFat: { col: 'visceral_fat',    cast: 'float', dir: 'lower'  },
    restingHR:   { col: 'resting_hr',      cast: 'int',   dir: 'lower'  },
    hrv:         { col: 'hrv_ms',          cast: 'int',   dir: 'higher' },
    grip:        { col: 'grip_strength_kg',cast: 'float', dir: 'higher' },
    muscleMass:  { col: 'muscle_mass_kg',  cast: 'float', dir: 'higher' },
    waist:       { col: 'waist_cm',        cast: 'float', dir: 'lower'  },
    weight:      { col: 'current_weight_kg', cast: 'float', dir: 'lower'  }
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

    var metricChips = METRICS.filter(function (m) { return m.group !== 'Health'; }).map(function (m) {
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
          '</div>' +
          '<button class="ffp-filters-toggle"><span class="material-icons" id="ffp-filters-caret">expand_more</span></button>' +
        '</div>' +
        '<div class="ffp-filters-body collapsed" id="ffp-filters-body">' +

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
    var withValue = filtered.filter(function (r) { return metricVal(r, metric) != null; });
    withValue.sort(function (a, b) {
      var av = metricVal(a, metric);
      var bv = metricVal(b, metric);
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
    var values = withValue.map(function (r) { return metricVal(r, metric); });
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
      return renderLbRow(r, i + 1, metric, barPctFor(metricVal(r, metric)));
    }).join('');

    if (meAppended) {
      html += '<div style="text-align:center;color:var(--muted);font-size:11px;padding:6px 0;">\u00b7\u00b7\u00b7</div>';
      html += renderLbRow(withValue[myIdx], myIdx + 1, metric, barPctFor(metricVal(withValue[myIdx], metric)));
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
    var value = formatLbValue(r, metric);
    var lbU = metric.derive ? (metric.lbUnit || '') : metric.unit;
    var valueLine = metric.unit === 'time' ? value : (value + (lbU ? ' <span style="color:var(--muted);font-size:11px;font-weight:600;">' + lbU + '</span>' : ''));
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

    var myDerived = null;
    if (metric.derive && rec2) {
      var _hCm = FitnessStats.profile ? FitnessStats.profile.height : null;
      var _synth = { height_cm: _hCm }; _synth[metric.col] = rec2.value;
      myDerived = metricVal(_synth, metric);
    }
    var valueHtml = rec2
      ? (metric.derive
          ? '<div class="ffp-my-pr-value">' + (myDerived == null
                ? formatMetricValue(rec2.value, metric) + '<span class="ffp-my-pr-value-unit">' + metric.unit + '</span>'
                : myDerived.toFixed(metric.lbDecimals != null ? metric.lbDecimals : 1) + '<span class="ffp-my-pr-value-unit">' + (metric.lbUnit || '') + '</span>') + '</div>'
          : '<div class="ffp-my-pr-value">' + formatMetricValue(rec2.value, metric) + (metric.unit !== 'time' ? '<span class="ffp-my-pr-value-unit">' + metric.unit + '</span>' : '') + '</div>')
      : '<div class="ffp-my-pr-empty">No record yet — tap edit to add</div>';

    // Community benchmark: group average for the current filter + your percentile (needs >=3 people).
    var benchLine = '';
    if (sortedFiltered.length >= 3) {
      var bvals = sortedFiltered.map(function (r) { return metricVal(r, metric); }).filter(function (v) { return v != null && !isNaN(v); });
      if (bvals.length) {
        var bavg = bvals.reduce(function (a, b) { return a + b; }, 0) / bvals.length;
        var bavgStr = metric.derive ? bavg.toFixed(metric.lbDecimals != null ? metric.lbDecimals : 1) : formatMetricValue(bavg, metric);
        var bavgU = metric.unit === 'time' ? '' : (metric.derive ? (metric.lbUnit || '') : metric.unit);
        benchLine = 'Group avg ' + bavgStr + (bavgU ? (' ' + bavgU) : '');
        if (myIdx >= 0) { var bpct = Math.max(1, Math.round(((myIdx + 1) / sortedFiltered.length) * 100)); benchLine += ' \u00b7 you\u2019re top ' + bpct + '%'; }
      }
    }

    card.innerHTML =
      '<div class="ffp-my-pr-head">' +
        '<div class="ffp-my-pr-title">Your ' + metric.label + (metric.group ? ' \u00b7 ' + metric.group : '') + '</div>' +
        '<button class="ffp-my-pr-edit" id="ffp-my-pr-edit-btn"><span class="material-icons">edit</span>' + (rec2 ? 'Edit' : 'Add') + '</button>' +
      '</div>' +
      valueHtml +
      '<div class="ffp-my-pr-meta">' +
        '<div>' + posLine + '</div>' +
        (benchLine ? '<div class="ffp-my-pr-pos" style="color:var(--blue);">' + benchLine + '</div>' : '') +
        (rec2 && rec2.date ? '<div>PR set ' + escText(rec2.date) + '</div>' : '') +
      '</div>';

    // whole card is tappable (not just the small button) → opens the full-screen editor
    var _openEd = function () {
      if (metric.key === 'sleepAvgHrs' && typeof FitnessStats.openSleepLog === 'function') FitnessStats.openSleepLog();
      else if (typeof FitnessStats.openPrEdit === 'function') FitnessStats.openPrEdit(metric.key);
    };
    card.style.cursor = 'pointer';
    card.onclick = _openEd;
  }

  // ─────────── ACTIVITY / MILESTONES OVERRIDES (carried from v4) ───────────

  function overrideComputeStreak() {
    FitnessStats.computeStreak = function () {
      var daysWithActivity = new Set(activityCache.map(function (l) { return l.daysAgo; }));
      // Today-grace (matches the passport-panel streak): a streak shouldn't read 0 just because TODAY isn't
      // logged YET — you still have all of today to log. Start at today if logged, else yesterday, then walk
      // back while consecutive. Fixes the jarring "0, then jumps to 3 the moment you log today".
      var current = 0;
      var _sd = daysWithActivity.has(0) ? 0 : (daysWithActivity.has(1) ? 1 : -1);
      if (_sd >= 0) { while (daysWithActivity.has(_sd)) { current++; _sd++; } }
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
      function fmtDur(min) { var h = Math.floor(min / 60), m = Math.round(min % 60); return (h ? h + 'h ' : '') + m + 'm'; }
      var rowCss = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-top:1px solid rgba(255,255,255,0.06);';
      var nameCss = 'font-size:13px;font-weight:800;color:var(--text,#e8eef4);';
      var metaCss = 'font-size:12px;font-weight:700;color:var(--muted,#8a99a8);white-space:nowrap;';
      var emptyCss = 'font-size:12px;color:var(--muted,#8a99a8);padding:10px 0;';

      // Per-activity breakdown (x times + total hours) over the selected period
      var PERIODS = [['week','Week',7],['month','Month',30],['3m','3M',90],['6m','6M',180],['year','Year',365],['all','All',1000000]];
      var _cutoff = (PERIODS.filter(function(x){return x[0]===activityPeriod;})[0] || PERIODS[5])[2];
      var _inP = activityCache.filter(function (l) { return l.daysAgo <= _cutoff; });
      var chips = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">' + PERIODS.map(function (x) {
        var on = x[0] === activityPeriod;
        return '<button onclick="ffpSetActivityPeriod(\'' + x[0] + '\')" style="border:1px solid ' + (on ? 'var(--blue,#2ba8e0)' : 'var(--border-mid,rgba(43,168,224,0.2))') + ';background:' + (on ? 'var(--blue,#2ba8e0)' : 'transparent') + ';color:' + (on ? '#fff' : 'var(--muted,#8a99a8)') + ';font-size:11px;font-weight:800;padding:6px 11px;border-radius:20px;cursor:pointer;font-family:inherit;">' + x[1] + '</button>';
      }).join('') + '</div>';
      var byAct = {};
      _inP.forEach(function (l) {
        var k = l.activity || 'Activity';
        if (!byAct[k]) byAct[k] = { count: 0, min: 0 };
        byAct[k].count++; byAct[k].min += (l.duration_min || 0);
      });
      var bd = Object.keys(byAct).map(function (k) { return { name: k, count: byAct[k].count, min: byAct[k].min }; })
        .sort(function (a, b) { return b.count - a.count || b.min - a.min; });
      var bdEl = document.getElementById('fs-breakdown');
      if (bdEl) {
        var headCss = 'display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.12);font-size:9px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;color:var(--muted,#8a99a8);';
        var header = '<div style="' + headCss + '"><div style="flex:1;min-width:0;">Activity</div><div style="width:56px;text-align:right;">Count</div><div style="width:74px;text-align:right;">Time</div></div>';
        var listHtml = bd.length ? (header + bd.map(function (a) {
          return '<div style="' + rowCss + '">' +
            '<div style="flex:1;min-width:0;' + nameCss + '">' + escText(a.name) + '</div>' +
            '<div style="width:56px;text-align:right;font-size:12px;font-weight:800;color:var(--blue,#2ba8e0);font-variant-numeric:tabular-nums;">\u00d7' + a.count + '</div>' +
            '<div style="width:74px;text-align:right;font-size:12px;font-weight:700;color:var(--muted,#8a99a8);font-variant-numeric:tabular-nums;">' + fmtDur(a.min) + '</div>' +
          '</div>';
        }).join('')) : '<div style="' + emptyCss + '">No activities in this period.</div>';
        bdEl.innerHTML = chips + listHtml;
      }

      // Recent activity \u2014 last 10, with a calendar control to browse older months. Rich chip-row layout
      // + browse-by-month logic live in renderRecentList (module scope) so the calendar button + month
      // nav can re-render the list on their own without re-running the whole Activity tab.
      renderRecentList();
    };
  }

  // \u2500\u2500 Recent activity list: last 10 + browse-by-month (calendar icon) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Each entry is a 2-line block: name + date on top, a wrapping chip row (duration / km / kcal / bpm /
  // city) below \u2014 so every metric the member logged is legible instead of crammed onto one line.
  var _actViewMode = 'recent';   // 'recent' | 'browse'
  var _actBrowseMonth = null;    // Date = 1st of the month being browsed
  function _fmtDurMin(min) { min = Math.max(0, Math.round(min || 0)); var h = Math.floor(min / 60), m = min % 60; return (h ? h + 'h ' : '') + m + 'm'; }
  function _monthLabel(d) { return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
  function _dayLabel(d, daysAgo) {
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  // Compact row: square photo · activity · location · time. Tap opens the full detail card.
  function _activityRow(l) {
    var d = l.logged_at ? new Date(l.logged_at) : null;
    var dateLbl = d ? _dayLabel(d, l.daysAgo) : (l.daysAgo + 'd ago');
    var loc = [l.venue, l.city].filter(Boolean).join(' · ') || 'No location set';
    var _icon = (window.ffpActivityIcon ? window.ffpActivityIcon(l.activity) : 'fitness_center');
    var _np = (l.photos && l.photos.length) ? l.photos.length : (l.photo_url ? 1 : 0);
    var _badge = _np > 1 ? '<span style="position:absolute;right:2px;bottom:2px;background:rgba(8,20,32,0.78);color:#fff;font-size:8.5px;font-weight:800;padding:1px 4px;border-radius:5px;display:flex;align-items:center;gap:2px;line-height:1;"><span class="material-icons" style="font-size:9px;">photo_library</span>' + _np + '</span>' : '';
    var photo = l.photo_url
      ? '<div style="position:relative;width:46px;height:46px;border-radius:10px;flex:0 0 auto;background:#13324a center/cover no-repeat;background-image:url(\'' + l.photo_url + '\');">' + _badge + '</div>'
      : '<div style="width:46px;height:46px;border-radius:10px;flex:0 0 auto;background:rgba(43,168,224,0.12);display:flex;align-items:center;justify-content:center;color:#2ba8e0;"><span class="material-icons" style="font-size:22px;">' + _icon + '</span></div>';
    var shareIcon = l.shared ? '<span class="material-icons" title="Shared with your connections" style="font-size:13px;color:#2ba8e0;vertical-align:-2px;">group</span> ' : '';
    var editBtn = l.id ? ('<button type="button" onclick="event.stopPropagation();window.ffpEditActivity&&window.ffpEditActivity(\'' + l.id + '\')" title="Edit activity" aria-label="Edit activity" style="background:none;border:none;color:var(--muted,#8a99a8);cursor:pointer;padding:2px;display:inline-flex;align-items:center;line-height:1;"><span class="material-icons" style="font-size:17px;">edit</span></button>') : '';
    return '<div onclick="window.ffpOpenActivityCard&&window.ffpOpenActivityCard(\'' + (l.id || '') + '\')" style="display:flex;align-items:center;gap:11px;padding:11px 0;border-top:1px solid rgba(255,255,255,0.06);cursor:pointer;">' +
        photo +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:800;color:var(--text,#e8eef4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escText(l.activity || 'Activity') + '</div>' +
          '<div style="font-size:11.5px;font-weight:700;color:var(--muted,#8a99a8);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + shareIcon + escText(loc) + '</div>' +
        '</div>' +
        '<div style="flex:0 0 auto;display:flex;align-items:center;gap:5px;">' +
          '<span style="font-size:11px;font-weight:700;color:var(--muted,#8a99a8);white-space:nowrap;">' + dateLbl + '</span>' + editBtn +
        '</div>' +
      '</div>';
  }
  // Tap a row → open the full detail card (rendered by the dashboard so the deep-link view reuses it).
  window.ffpOpenActivityCard = async function (id) {
    var row = null;
    for (var i = 0; i < activityCache.length; i++) { if (String(activityCache[i].id) === String(id)) { row = activityCache[i]; break; } }
    if (!row) return;
    // Pull from the DB (source of truth) so the card shows the full photo set AND the tagged Training
    // Partners (the cached list row carries neither). Always fetch when signed in; fall back to the row.
    try {
      var me = (window.FFPAuth && FFPAuth.getMember && FFPAuth.getMember()) || {};
      if (me.id && window.supabase) {
        var r = await window.supabase.rpc('member_activity_view', { p_viewer: me.id, p_id: id });
        var d = r && r.data;
        if (d && !d.error) {
          row = Object.assign({}, row, {
            partners: d.partners || row.partners || [],
            photos: (d.photos && d.photos.length) ? d.photos : row.photos,
            photo_url: d.photo_url || row.photo_url
          });
        }
      }
    } catch (e) {}
    if (typeof window.ffpRenderActivityCard === 'function') window.ffpRenderActivityCard(row, true);
  };
  function renderRecentList() {
    var rcEl = document.getElementById('fs-recent');
    if (!rcEl) return;
    var emptyCss = 'font-size:12px;color:var(--muted,#8a99a8);padding:12px 0;';
    if (_actViewMode === 'browse') {
      if (!_actBrowseMonth) { var n0 = new Date(); _actBrowseMonth = new Date(n0.getFullYear(), n0.getMonth(), 1); }
      var mStart = _actBrowseMonth, mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 1);
      var list = activityCache.filter(function (l) {
        if (!l.logged_at) return false; var t = new Date(l.logged_at); return t >= mStart && t < mEnd;
      }).sort(function (a, b) { return new Date(b.logged_at) - new Date(a.logged_at); });
      var now = new Date(), atCurrent = (mStart.getFullYear() === now.getFullYear() && mStart.getMonth() === now.getMonth());
      var navBtn = 'border:1px solid var(--border-mid,rgba(43,168,224,0.2));background:transparent;color:var(--text,#e8eef4);width:30px;height:30px;border-radius:8px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;';
      var nav = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 0 8px;">' +
          '<button type="button" onclick="window.ffpActivityMonthStep&&window.ffpActivityMonthStep(-1)" style="' + navBtn + '"><span class="material-icons" style="font-size:18px;">chevron_left</span></button>' +
          '<div style="font-size:13px;font-weight:800;color:var(--text,#e8eef4);">' + _monthLabel(mStart) + '</div>' +
          '<button type="button" ' + (atCurrent ? 'disabled' : '') + ' onclick="window.ffpActivityMonthStep&&window.ffpActivityMonthStep(1)" style="' + navBtn + (atCurrent ? 'opacity:0.35;cursor:default;' : '') + '"><span class="material-icons" style="font-size:18px;">chevron_right</span></button>' +
        '</div>';
      // Month totals strip — count, total time, total distance, total calories (metrics with data only)
      var tMin = 0, tKm = 0, tKcal = 0;
      list.forEach(function (l) {
        tMin += (l.duration_min || 0);
        if (l.distance_km != null && !isNaN(l.distance_km) && l.distance_km > 0) tKm += l.distance_km;
        tKcal += (l.calories || 0);
      });
      var sumParts = [list.length + (list.length === 1 ? ' activity' : ' activities'), _fmtDurMin(tMin)];
      if (tKm > 0) sumParts.push((Math.round(tKm * 10) / 10) + ' km');
      if (tKcal > 0) sumParts.push(tKcal + ' kcal');
      var totalsStrip = list.length ? ('<div style="display:flex;flex-wrap:wrap;gap:6px 14px;padding:10px 12px;margin-bottom:6px;background:rgba(43,168,224,0.07);border:1px solid rgba(43,168,224,0.18);border-radius:10px;font-size:12px;font-weight:800;color:var(--text,#e8eef4);">' +
          sumParts.map(function (p) { return '<span>' + p + '</span>'; }).join('') + '</div>') : '';
      rcEl.innerHTML = nav + totalsStrip + (list.length ? list.map(_activityRow).join('') : '<div style="' + emptyCss + '">No activities in ' + _monthLabel(mStart) + '.</div>');
    } else {
      var recent = activityCache.slice().sort(function (a, b) { return a.daysAgo - b.daysAgo; }).slice(0, 10);
      rcEl.innerHTML = recent.length ? recent.map(_activityRow).join('') : '<div style="' + emptyCss + '">No recent activity.</div>';
    }
    var calBtn = document.getElementById('fs-recent-cal');
    if (calBtn) calBtn.style.color = (_actViewMode === 'browse') ? 'var(--blue,#2ba8e0)' : 'var(--muted,#8a99a8)';
  }
  window.ffpActivityToggleCal = function () {
    _actViewMode = (_actViewMode === 'browse') ? 'recent' : 'browse';
    if (_actViewMode === 'browse' && !_actBrowseMonth) { var n = new Date(); _actBrowseMonth = new Date(n.getFullYear(), n.getMonth(), 1); }
    renderRecentList();
  };
  window.ffpActivityMonthStep = function (dir) {
    if (!_actBrowseMonth) { var n = new Date(); _actBrowseMonth = new Date(n.getFullYear(), n.getMonth(), 1); }
    var nx = new Date(_actBrowseMonth.getFullYear(), _actBrowseMonth.getMonth() + dir, 1);
    var now = new Date(), cur = new Date(now.getFullYear(), now.getMonth(), 1);
    if (nx > cur) return;   // never page into the future
    _actBrowseMonth = nx; renderRecentList();
  };
  // Edit a logged activity — find the cached row by id and hand it to the dashboard's edit-mode modal.
  window.ffpEditActivity = function (id) {
    var row = null;
    for (var i = 0; i < activityCache.length; i++) { if (String(activityCache[i].id) === String(id)) { row = activityCache[i]; break; } }
    if (!row) return;
    if (typeof window.openLogModalForEdit === 'function') window.openLogModalForEdit(row);
  };
  // Re-pull activity_logs into the cache and re-render the Activity tab (streak + breakdown + recent).
  // Called by the modal after a successful edit so the change shows immediately.
  window.ffpActivityReload = async function () {
    if (!currentUserId) return;
    try {
      var alRes = await fetch('https://ffp-passport-backend.vercel.app/api/members/' + currentUserId + '/activity-logs');
      var alJson = await alRes.json();
      var rows = (alJson && alJson.logs) || [];
      activityCache = rows.map(function (r) {
        return { id: r.id, activity: r.activity || '', duration_min: r.duration_min || 0, duration_sec: r.duration_sec || 0, calories: r.calories || 0,
          distance_km: (r.distance_km != null ? Number(r.distance_km) : null),
          avg_heart_rate: (r.avg_heart_rate != null ? Number(r.avg_heart_rate) : null),
          notes: r.notes || '',
          city: r.city || '', country: r.country || '', venue: r.venue || '', checkin_lat: (r.checkin_lat != null ? Number(r.checkin_lat) : null), checkin_lng: (r.checkin_lng != null ? Number(r.checkin_lng) : null), photo_url: r.photo_url || '', photos: (Array.isArray(r.photos) && r.photos.length) ? r.photos : (r.photo_url ? [r.photo_url] : []), shared: !!r.shared, logged_at: r.logged_at || null, daysAgo: daysAgoFromIso(r.logged_at) };
      });
      if (window.FitnessStats && typeof FitnessStats.renderActivity === 'function') FitnessStats.renderActivity();
      else renderRecentList();
    } catch (e) { console.error('[FFP Fitness Stats] reload:', e); }
  };

  function overrideRenderMilestones() {
    FitnessStats.renderMilestones = function () {
      var logs = activityCache || [];
      var r = this.records || {};
      var p = this.profile || {};
      var self = this;
      var age = p.chronAge || 30;
      var sex = (p.gender || '').toLowerCase().charAt(0) === 'f' ? 'female' : 'male';
      var streak = (typeof this.computeStreak === 'function') ? this.computeStreak().current : 0;
      var sportCount = new Set(logs.map(function (l) { return l.activity; }).filter(Boolean)).size;
      var cityCount = new Set(logs.map(function (l) { return l.city; }).filter(Boolean)).size;
      var sleepRec = (typeof this.getRecord === 'function') ? this.getRecord('sleepAvgHrs') : null;
      function fmtSecs(x) { var m = Math.floor(x / 60), ss = x % 60; return m + ':' + (ss < 10 ? '0' : '') + ss; }
      function pctOf(c, t) { return Math.min(100, Math.max(0, (c / t) * 100)); }
      function ab(a, h70) { return (h70 && a >= 70) ? 70 : a >= 60 ? 60 : a >= 50 ? 50 : a >= 40 ? 40 : a >= 30 ? 30 : 20; }
      function upTier(cur, tiers, noun) {
        var t = tiers[tiers.length - 1], maxed = true;
        for (var i = 0; i < tiers.length; i++) { if (cur < tiers[i]) { t = tiers[i]; maxed = false; break; } }
        return maxed ? { unlocked: true, pct: 100, now: Math.floor(cur) + ' ' + noun, next: 'Maxed ✓' }
                     : { unlocked: false, pct: pctOf(cur, t), now: Math.floor(cur) + ' ' + noun, next: t + ' ' + noun };
      }
      function binM(done, target) { return done ? { unlocked: true, pct: 100, now: 'Completed', next: 'Done ✓' } : { unlocked: false, pct: 0, now: 'Not logged', next: target }; }
      function ratioM(rec, tiers) {
        if (!rec) return { unlocked: false, pct: 0, now: 'Not logged', next: tiers[0] + '× bw' };
        if (!p.weight) return { unlocked: false, pct: 6, now: 'Add body weight', next: tiers[0] + '× bw' };
        var ratio = rec.value / p.weight, t = tiers[tiers.length - 1], maxed = true;
        for (var i = 0; i < tiers.length; i++) { if (ratio < tiers[i]) { t = tiers[i]; maxed = false; break; } }
        return maxed ? { unlocked: true, pct: 100, now: ratio.toFixed(1) + '× bw', next: 'Maxed ✓' }
                     : { unlocked: false, pct: pctOf(ratio, t), now: ratio.toFixed(1) + '× bw', next: t + '× bw' };
      }
      function fastM(rec, secs, labels) {
        if (!rec) return { unlocked: false, pct: 0, now: 'Not logged', next: labels[0] };
        var v = rec.value;
        for (var i = 0; i < secs.length; i++) { if (v > secs[i]) return { unlocked: false, pct: pctOf(secs[i], v), now: fmtSecs(v), next: labels[i] }; }
        return { unlocked: true, pct: 100, now: fmtSecs(v), next: 'Maxed ✓' };
      }
      function bodyFatM() {
        if (!r.bodyFat) return { unlocked: false, pct: 0, now: 'Not logged', next: 'Healthy' };
        var v = r.bodyFat.value, row = self.BF_BANDS[sex][ab(age, false)], band = self.bodyFatBand(v, p.gender, age).label;
        if (band === 'Lean') return { unlocked: true, pct: 100, now: v + '% · Lean', next: 'Maxed ✓' };
        if (band === 'Healthy') return { unlocked: true, pct: 100, now: v + '% · Healthy', next: 'Lean ≤' + row[0] + '%' };
        return { unlocked: false, pct: pctOf(row[1], v), now: v + '% · ' + band, next: 'Healthy ≤' + row[1] + '%' };
      }
      function vo2M() {
        if (!r.vo2max) return { unlocked: false, pct: 0, now: 'Not logged', next: 'Good' };
        var v = r.vo2max.value, row = self.VO2_BANDS[sex][ab(age, true)], band = self.vo2Band(v, p.gender, age).label, nx = null, nl = null;
        if (v < row[1]) { nx = row[1]; nl = 'Good'; } else if (v < row[2]) { nx = row[2]; nl = 'Excellent'; } else if (v < row[3]) { nx = row[3]; nl = 'Superior'; }
        var unlocked = (band === 'Good' || band === 'Excellent' || band === 'Superior');
        return (nx == null) ? { unlocked: true, pct: 100, now: v + ' · Superior', next: 'Maxed ✓' }
                            : { unlocked: unlocked, pct: unlocked ? 100 : pctOf(v, nx), now: v + ' · ' + band, next: nl + ' ' + nx };
      }
      function rhrM() {
        if (!r.restingHR) return { unlocked: false, pct: 0, now: 'Not logged', next: 'Good' };
        var off = sex === 'female' ? 3 : 0, bpm = r.restingHR.value, v = bpm - off;
        var band = v <= 49 ? 'Athlete' : v <= 59 ? 'Excellent' : v <= 69 ? 'Good' : 'Above ideal', nx = null, nl = null;
        if (v > 69) { nx = 69; nl = 'Good'; } else if (v > 59) { nx = 59; nl = 'Excellent'; } else if (v > 49) { nx = 49; nl = 'Athlete'; }
        var unlocked = v <= 69;
        return (nx == null) ? { unlocked: true, pct: 100, now: bpm + ' bpm · Athlete', next: 'Maxed ✓' }
                            : { unlocked: unlocked, pct: unlocked ? 100 : pctOf(69, v), now: bpm + ' bpm · ' + band, next: nl + ' ≤' + (nx + off) };
      }
      function gripM() {
        if (!r.grip) return { unlocked: false, pct: 0, now: 'Not logged', next: 'Good' };
        var v = r.grip.value, norm = self.GRIP_NORM[sex][ab(age, true)], band = self.gripBand(v, p.gender, age).label, goodT = norm * 0.85, strongT = norm * 1.1;
        if (band === 'Strong') return { unlocked: true, pct: 100, now: v + 'kg · Strong', next: 'Maxed ✓' };
        if (band === 'Good') return { unlocked: true, pct: 100, now: v + 'kg · Good', next: 'Strong ' + Math.round(strongT) + 'kg' };
        return { unlocked: false, pct: pctOf(v, goodT), now: v + 'kg · ' + band, next: 'Good ' + Math.round(goodT) + 'kg' };
      }
      function waistM() {
        if (!(r.waist && p.height)) return { unlocked: false, pct: 0, now: 'Not logged', next: '<0.50' };
        var whtr = r.waist.value / p.height;
        return (whtr < 0.5) ? { unlocked: true, pct: 100, now: whtr.toFixed(2) + ' ratio', next: 'Maxed ✓' }
                            : { unlocked: false, pct: pctOf(0.5, whtr), now: whtr.toFixed(2) + ' ratio', next: '<0.50' };
      }
      function sleepM() {
        if (!sleepRec) return { unlocked: false, pct: 0, now: 'Not logged', next: '7–9 hrs' };
        var h = sleepRec.value;
        return (h >= 7 && h <= 9) ? { unlocked: true, pct: 100, now: h + ' hr avg', next: 'In zone ✓' }
                                  : { unlocked: false, pct: 60, now: h + ' hr avg', next: '7–9 hrs' };
      }
      var GROUPS = [
        { cat: 'Consistency', items: [
          { name: 'Activities Logged', icon: 'flag', m: upTier(logs.length, [10, 25, 50, 100, 250], 'logged') },
          { name: 'Activity Streak', icon: 'local_fire_department', m: upTier(streak, [7, 14, 30, 60, 100], 'days') },
          { name: 'Sport Variety', icon: 'sports', m: upTier(sportCount, [3, 5, 8, 12], 'sports') },
          { name: 'Cities Active', icon: 'public', m: upTier(cityCount, [1, 3, 5, 10], 'cities') }
        ] },
        { cat: 'Max Lifts', items: [
          { name: 'Deadlift', icon: 'fitness_center', m: ratioM(r.deadlift1RM, [1, 1.5, 2, 2.5]) },
          { name: 'Squat', icon: 'fitness_center', m: ratioM(r.squat1RM, [1, 1.5, 2]) },
          { name: 'Bench Press', icon: 'fitness_center', m: ratioM(r.bench1RM, [0.75, 1, 1.25, 1.5]) }
        ] },
        { cat: 'Endurance', items: [
          { name: '5K Speed', icon: 'directions_run', m: fastM(r.run5K, [1800, 1500, 1320], ['sub-30', 'sub-25', 'sub-22']) },
          { name: '10K', icon: 'directions_run', m: binM(!!r.run10K, 'Finish a 10K') },
          { name: 'Half Marathon', icon: 'directions_run', m: binM(!!r.run21K, 'Finish a half') },
          { name: 'Marathon', icon: 'emoji_events', m: binM(!!r.runMara, 'Finish a marathon') }
        ] },
        { cat: 'Health', items: [
          { name: 'Body Fat', icon: 'monitor_weight', m: bodyFatM() },
          { name: 'VO₂ Max', icon: 'favorite', m: vo2M() },
          { name: 'Resting HR', icon: 'monitor_heart', m: rhrM() },
          { name: 'Restful Sleep', icon: 'bedtime', m: sleepM() },
          { name: 'Healthy Waist', icon: 'straighten', m: waistM() },
          { name: 'Strong Grip', icon: 'pan_tool', m: gripM() }
        ] }
      ];
      var total = 0, unlockedN = 0;
      var html = GROUPS.map(function (g) {
        var rows = g.items.map(function (it) {
          total++; if (it.m.unlocked) unlockedN++;
          var state = it.m.unlocked ? 'unlocked' : (it.m.pct > 0 ? 'progress' : 'inactive');
          return '<div class="achievement ' + state + '">' +
            '<div class="achievement-icon"><span class="material-icons">' + it.icon + '</span></div>' +
            '<div class="achievement-body">' +
              '<div class="achievement-name">' + escText(it.name) + '</div>' +
              '<div class="achievement-nownext">' +
                '<span class="achievement-now"><span class="achievement-lbl">Now</span><span class="achievement-val">' + escText(it.m.now) + '</span></span>' +
                '<span class="achievement-next"><span class="achievement-lbl">Next</span><span class="achievement-val">' + escText(it.m.next) + '</span></span>' +
              '</div>' +
              '<div class="achievement-progress"><div class="achievement-progress-fill" style="width:' + Math.round(it.m.pct) + '%;"></div></div>' +
            '</div></div>';
        }).join('');
        return '<div class="achievement-cat">' + escText(g.cat) + '</div>' + rows;
      }).join('');
      var gridEl = document.getElementById('achievements-grid');
      if (gridEl) gridEl.innerHTML = html;
      var countEl = document.getElementById('ms-unlocked-count');
      if (countEl) countEl.textContent = unlockedN + ' of ' + total + ' unlocked';
    };
  }

  // ============ MILESTONES v20 — tap a metric → its FULL badge ladder (continuous milestones) ============
  // Each metric is a tappable row → detail page: top strap (now / up-next + bar) + the full ladder of badges,
  // earned ones lit, next flagged, locked shown with their target. Logic unit-tested in isolation.
  function msFmtTime(sec){ sec=Math.round(sec); var h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60; return h>0 ? (h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')) : (m+':'+String(s).padStart(2,'0')); }
  // Milestones for cumulative metrics are RECURRING cycles — each fires every N and accumulates a count (×N),
  // forever (no finish line). Performance metrics (lifts / runs / body-fat) stay one-time bests below.
  var MS_LADDERS = [
    { group:'Consistency', key:'activitiesLogged', name:'Activities Logged', icon:'flag', read:function(c){ var v=c.logs.length; return {val:v, disp:v+' logged'}; }, cycles:[{n:10,name:'Every 10',icon:'flag'},{n:25,name:'Every 25',icon:'flag'},{n:50,name:'Every 50',icon:'military_tech'},{n:100,name:'Century',icon:'military_tech'},{n:250,name:'Every 250',icon:'military_tech'},{n:500,name:'Every 500',icon:'workspace_premium'},{n:1000,name:'Every 1,000',icon:'workspace_premium'}] },
    { group:'Consistency', key:'activityStreak', name:'Activity Streak', icon:'local_fire_department', read:function(c){ var v=c.streak; return {val:v, disp:v+'-day streak'}; }, cycles:[{n:1,name:'Daily',icon:'wb_sunny'},{n:7,name:'Weekly',icon:'date_range'},{n:30,name:'Monthly',icon:'calendar_month'},{n:90,name:'Quarterly',icon:'event'},{n:182,name:'Half-Year',icon:'event_available'},{n:365,name:'Yearly',icon:'emoji_events'}] },
    { group:'Consistency', key:'sportVariety', name:'Sport Variety', icon:'sports', read:function(c){ var v=new Set(c.logs.map(function(l){return l.activity;}).filter(Boolean)).size; return {val:v, disp:v+' sports'}; }, cycles:[{n:1,name:'New Sport',icon:'add'},{n:5,name:'Every 5',icon:'sports'},{n:10,name:'Every 10',icon:'sports'}] },
    { group:'Consistency', key:'citiesActive', name:'Cities Active', icon:'public', read:function(c){ var v=new Set(c.logs.map(function(l){return l.city;}).filter(Boolean)).size; return {val:v, disp:v+' cities'}; }, cycles:[{n:1,name:'New City',icon:'add_location'},{n:5,name:'Every 5',icon:'public'},{n:10,name:'Every 10',icon:'public'},{n:25,name:'Every 25',icon:'travel_explore'}] },
    { group:'Max Lifts', key:'deadlift1RM', name:'Deadlift', icon:'fitness_center', dir:'higher', ratio:true, tiers:[{t:1,name:'1× bodyweight'},{t:1.5,name:'1.5×'},{t:2,name:'2×'},{t:2.5,name:'2.5×'},{t:3,name:'3×'},{t:3.5,name:'3.5× (elite)'}] },
    { group:'Max Lifts', key:'squat1RM', name:'Squat', icon:'fitness_center', dir:'higher', ratio:true, tiers:[{t:0.75,name:'0.75×'},{t:1,name:'1× bodyweight'},{t:1.5,name:'1.5×'},{t:2,name:'2×'},{t:2.5,name:'2.5×'},{t:3,name:'3× (elite)'}] },
    { group:'Max Lifts', key:'bench1RM', name:'Bench Press', icon:'fitness_center', dir:'higher', ratio:true, tiers:[{t:0.5,name:'0.5×'},{t:0.75,name:'0.75×'},{t:1,name:'1× bodyweight'},{t:1.25,name:'1.25×'},{t:1.5,name:'1.5×'},{t:2,name:'2× (elite)'}] },
    { group:'Endurance', key:'run5K', name:'5K', icon:'directions_run', dir:'lower', time:true, tiers:[{finish:true,name:'Finish a 5K'},{t:1800,name:'sub-30:00'},{t:1500,name:'sub-25:00'},{t:1320,name:'sub-22:00'},{t:1200,name:'sub-20:00'},{t:1080,name:'sub-18:00'},{t:960,name:'sub-16:00'},{t:840,name:'sub-14:00'}] },
    { group:'Endurance', key:'run10K', name:'10K', icon:'directions_run', dir:'lower', time:true, tiers:[{finish:true,name:'Finish a 10K'},{t:3600,name:'sub-60:00'},{t:3000,name:'sub-50:00'},{t:2700,name:'sub-45:00'},{t:2400,name:'sub-40:00'},{t:2100,name:'sub-35:00'},{t:1800,name:'sub-30:00'}] },
    { group:'Endurance', key:'run21K', name:'Half Marathon', icon:'directions_run', dir:'lower', time:true, tiers:[{finish:true,name:'Finish a half'},{t:9000,name:'sub-2:30'},{t:7200,name:'sub-2:00'},{t:6300,name:'sub-1:45'},{t:5400,name:'sub-1:30'},{t:4800,name:'sub-1:20'},{t:4200,name:'sub-1:10'}] },
    { group:'Endurance', key:'runMara', name:'Marathon', icon:'emoji_events', dir:'lower', time:true, tiers:[{finish:true,name:'Finish a marathon'},{t:18000,name:'sub-5:00'},{t:14400,name:'sub-4:00'},{t:12600,name:'sub-3:30'},{t:10800,name:'sub-3:00'},{t:9900,name:'sub-2:45'},{t:8400,name:'sub-2:20'},{t:7200,name:'sub-2:00 (WR pace)'}] },
    { group:'Health', key:'bodyFat', name:'Body Fat', icon:'monitor_weight', dir:'lower', read:function(c){ var rec=c.records.bodyFat; if(!rec) return {val:null,disp:'Not logged'}; return {val:rec.value, disp:rec.value+'%'}; }, tiers:function(c){ var male=(c.profile.gender||'').toLowerCase().charAt(0)!=='f'; return male ? [{t:24,name:'Healthy ≤24%'},{t:18,name:'Fit ≤18%'},{t:14,name:'Lean ≤14%'},{t:10,name:'Athletic ≤10%'},{t:8,name:'Super Lean ≤8%'},{t:6,name:'Shredded ≤6%'}] : [{t:31,name:'Healthy ≤31%'},{t:25,name:'Fit ≤25%'},{t:22,name:'Lean ≤22%'},{t:18,name:'Athletic ≤18%'},{t:14,name:'Super Lean ≤14%'},{t:12,name:'Shredded ≤12%'}]; } }
  ];
  function msBuildState(L, ctx){
    var r;
    if (L.read) r = L.read(ctx);
    else if (L.ratio){ var rec=ctx.records[L.key], w=ctx.profile.weight; if(!rec) r={val:null,disp:'Not logged'}; else if(!w) r={val:null,disp:'Add body weight to rank'}; else r={val: rec.value/w, disp: rec.value+'kg · '+(rec.value/w).toFixed(2)+'× bw'}; }
    else if (L.time){ var rt=ctx.records[L.key]; r = rt ? {val:rt.value, disp:msFmtTime(rt.value)} : {val:null,disp:'Not logged'}; }
    else r={val:null,disp:'—'};
    if (L.cycles){
      var cv=(r.val==null?0:r.val);
      var cyc=L.cycles.map(function(c){ var count=Math.floor(cv/c.n); var into=cv-count*c.n; return { n:c.n, name:c.name, icon:c.icon, count:count, into:into, toNext:c.n-into, prog:Math.round((into/c.n)*100) }; });
      var tot=cyc.reduce(function(a,c){return a+c.count;},0);
      return { r:r, recurring:true, cycles:cyc, totalEarned:tot };
    }
    var tiers = (typeof L.tiers==='function') ? L.tiers(ctx) : L.tiers;
    var earned = tiers.map(function(tr){ if(tr.finish) return r.val != null; if(r.val == null) return false; return L.dir==='higher' ? r.val >= tr.t : r.val <= tr.t; });
    var earnedCount = earned.filter(Boolean).length; var nextIdx = earned.indexOf(false);
    return { r:r, tiers:tiers, earned:earned, earnedCount:earnedCount, total:tiers.length, nextIdx:nextIdx };
  }
  function msCtx(){ var fs=FitnessStats; return { logs: activityCache||[], streak:(typeof fs.computeStreak==='function')?fs.computeStreak().current:0, records: fs.records||{}, profile: fs.profile||{} }; }
  function msPctToNext(L, st){ if(st.nextIdx<0) return 100; var tr=st.tiers[st.nextIdx], val=st.r.val; if(tr.finish||val==null) return 0; if(L.dir==='higher') return Math.max(0,Math.min(100,(val/tr.t)*100)); return Math.max(0,Math.min(100,(tr.t/val)*100)); }
  function msInjectCss(){
    if(document.getElementById('ffp-ms-v20-css')) return;
    var s=document.createElement('style'); s.id='ffp-ms-v20-css'; s.textContent=[
      '.ms-cat{font-size:11px;font-weight:800;letter-spacing:0.7px;text-transform:uppercase;color:var(--muted,#8a99a8);margin:16px 0 8px;}',
      '.ms-row{display:flex;align-items:center;gap:12px;padding:12px;background:rgba(15,30,46,0.6);border:1px solid var(--border-mid,rgba(43,168,224,0.2));border-radius:12px;margin-bottom:8px;cursor:pointer;transition:border-color .15s;}',
      '.ms-row:hover{border-color:var(--blue,#2ba8e0);}',
      '.ms-row-ic{width:40px;height:40px;border-radius:10px;background:rgba(43,168,224,0.1);display:flex;align-items:center;justify-content:center;color:var(--blue,#2ba8e0);flex-shrink:0;}',
      '.ms-row-body{flex:1;min-width:0;}',
      '.ms-row-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}',
      '.ms-row-name{font-size:14px;font-weight:700;color:var(--text,#e8eef4);}',
      '.ms-row-badges{font-size:12px;font-weight:800;color:var(--yellow,#FFCC00);flex-shrink:0;}',
      '.ms-row-now{font-size:11px;color:var(--muted,#8a99a8);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.ms-row-next{color:var(--blue,#2ba8e0);font-weight:600;}',
      '.ms-row-bar{height:5px;background:rgba(255,255,255,0.07);border-radius:3px;margin-top:7px;overflow:hidden;}',
      '.ms-row-bar-fill{height:100%;background:var(--yellow,#FFCC00);border-radius:3px;}',
      '.ms-row-chev{color:var(--muted,#8a99a8);flex-shrink:0;}',
      '.msd-wrap{padding:4px 2px 20px;}',
      '.msd-strap{display:flex;gap:14px;align-items:center;padding:16px;background:rgba(43,168,224,0.07);border:1px solid var(--border-mid,rgba(43,168,224,0.25));border-radius:14px;margin-bottom:18px;}',
      '.msd-strap-ic{width:52px;height:52px;border-radius:13px;background:rgba(43,168,224,0.14);display:flex;align-items:center;justify-content:center;color:var(--blue,#2ba8e0);flex-shrink:0;}',
      '.msd-strap-ic .material-icons{font-size:28px;}',
      '.msd-strap-body{flex:1;min-width:0;}',
      '.msd-strap-name{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted,#8a99a8);}',
      '.msd-strap-now{font-size:22px;font-weight:900;color:var(--text,#e8eef4);margin:2px 0 6px;}',
      '.msd-strap-next{font-size:12px;font-weight:700;color:var(--blue,#2ba8e0);}',
      '.msd-strap-next.done{color:var(--yellow,#FFCC00);}',
      '.msd-strap-bar{height:6px;background:rgba(255,255,255,0.08);border-radius:3px;margin-top:7px;overflow:hidden;}',
      '.msd-strap-bar-fill{height:100%;background:var(--blue,#2ba8e0);border-radius:3px;}',
      '.msd-ladder-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;color:var(--muted,#8a99a8);margin-bottom:10px;}',
      '.msc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:18px 10px;margin-top:6px;}',
      '.msc{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;}',
      '.msc-ring{width:74px;height:74px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:conic-gradient(var(--blue,#2ba8e0) var(--p,0%), rgba(255,255,255,0.09) 0);}',
      '.msc-emblem{width:60px;height:60px;border-radius:50%;background:#0b1f2e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;}',
      '.msc-emblem .material-icons{font-size:17px;color:var(--blue,#2ba8e0);line-height:1;}',
      '.msc-x{font-size:18px;font-weight:900;color:var(--text,#e8eef4);line-height:1;}',
      '.msc-x.zero{color:#5a6b7a;}',
      '.msc-name{font-size:12px;font-weight:800;color:var(--text,#e8eef4);}',
      '.msc-next{font-size:10.5px;color:var(--muted,#8a99a8);line-height:1.3;}',
      '.msd-ladder{display:flex;flex-wrap:wrap;gap:14px 9px;align-items:flex-start;margin-top:6px;}',
      '.msd-badge{display:flex;flex-direction:column;align-items:center;text-align:center;gap:7px;width:60px;}',
      '.msd-badge.minor{width:34px;}',
      '.msd-badge.minor .msd-badge-emblem{width:32px;height:32px;border-width:2px;font-size:14px;}',
      '.msd-badge.minor.earned .msd-badge-emblem{background:rgba(43,168,224,0.16);border-color:var(--blue,#2ba8e0);color:var(--blue,#2ba8e0);box-shadow:none;}',
      '.msd-badge.minor.earned .msd-badge-emblem::after{display:none;}',
      '.msd-badge.minor.next .msd-badge-emblem{background:rgba(43,168,224,0.08);border:2px dashed var(--blue,#2ba8e0);}',
      '.msd-badge.minor.locked .msd-badge-emblem{background:rgba(255,255,255,0.04);border:2px solid rgba(255,255,255,0.10);}',
      '.msd-badge-emblem{position:relative;width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;border:3px solid;box-sizing:border-box;}',
      '.msd-badge-emblem::after{content:"";position:absolute;top:7px;left:12px;width:20px;height:10px;border-radius:50%;background:rgba(255,255,255,0.5);filter:blur(1px);pointer-events:none;}',
      '.msd-badge-star{font-size:26px!important;line-height:1;}',
      '.msd-badge.earned.bronze .msd-badge-emblem{background:radial-gradient(circle at 50% 32%,#ffd9a8,#cd7f32 62%,#8f5018 100%);border-color:#ffcf9c;color:#5a2f0c;box-shadow:0 3px 11px rgba(205,127,50,0.30),inset 0 -3px 6px rgba(120,70,20,0.45),inset 0 2px 4px rgba(255,235,200,0.6);}',
      '.msd-badge.earned.silver .msd-badge-emblem{background:radial-gradient(circle at 50% 32%,#ffffff,#cdd6e0 62%,#8d99a8 100%);border-color:#eef3f8;color:#36424f;box-shadow:0 3px 11px rgba(180,200,220,0.28),inset 0 -3px 6px rgba(110,130,150,0.45),inset 0 2px 4px rgba(255,255,255,0.85);}',
      '.msd-badge.earned.gold .msd-badge-emblem{background:radial-gradient(circle at 50% 32%,#fff3c0,#FFCC00 60%,#d49a00 100%);border-color:#fff0b0;color:#6b4e00;box-shadow:0 3px 13px rgba(255,204,0,0.38),inset 0 -3px 6px rgba(170,120,0,0.45),inset 0 2px 4px rgba(255,255,255,0.75);}',
      '.msd-badge.next .msd-badge-emblem{background:rgba(43,168,224,0.10);border:2px dashed var(--blue,#2ba8e0);color:var(--blue,#2ba8e0);}',
      '.msd-badge.next .msd-badge-emblem::after,.msd-badge.locked .msd-badge-emblem::after{display:none;}',
      '.msd-badge.locked .msd-badge-emblem{background:rgba(255,255,255,0.03);border:2px solid rgba(255,255,255,0.10);color:#56697a;}',
      '.msd-badge.locked{opacity:0.65;}',
      '.msd-badge-name{font-size:10px;font-weight:700;line-height:1.25;color:var(--text,#e8eef4);}',
      '.msd-badge.next .msd-badge-name{color:var(--blue,#2ba8e0);}',
      '.msd-badge.locked .msd-badge-name{color:var(--muted,#8a99a8);}'
    ].join(''); document.head.appendChild(s);
  }
  // ============ MILESTONES v26 — ACTIVITIES MEDALLION WALL (Grant's minted-wreath design) ============
  // The Milestones tab is now a full-page WALL of medallions for Activities Logged:
  // 8 colour levels x 10 stages = 80 milestones. Ladder is front-loaded (frequent early wins,
  // max gap 20, tops out at 730 ~ 5+ years of activity). Earned milestones mint into the full
  // wreath medallion; the immediate target shows as NEXT; the rest are ghost slots showing the goal.
  var FFP_MS_LEVELS = [
    { name:'BRONZE',   lite:'#f0c191', mid:'#bd7b34', dark:'#5f3413', leafL:'#e2a564', leafD:'#7a481c', vals:[1,2,3,4,5,6,7,8,9,10] },
    { name:'SILVER',   lite:'#f3f7fb', mid:'#9aa7b6', dark:'#4d5866', leafL:'#cfd8e2', leafD:'#5d6775', vals:[12,14,16,18,20,22,24,26,28,30] },
    { name:'GOLD',     lite:'#ffe9a3', mid:'#e0a400', dark:'#7c5800', leafL:'#ffd451', leafD:'#9a6e00', vals:[34,38,42,46,50,54,58,62,66,70] },
    { name:'EMERALD',  lite:'#bdf5d2', mid:'#1fae6b', dark:'#0a5e38', leafL:'#62d59a', leafD:'#11774a', vals:[77,84,91,98,105,112,119,126,133,140] },
    { name:'SAPPHIRE', lite:'#cbeeff', mid:'#2ba8e0', dark:'#0c5070', leafL:'#67c8f0', leafD:'#13658c', vals:[150,160,170,180,190,200,210,220,230,240] },
    { name:'AMETHYST', lite:'#e6cdff', mid:'#9a52e0', dark:'#532b80', leafL:'#bd8cf0', leafD:'#6a3a9a', vals:[253,266,279,292,305,318,331,344,357,370] },
    { name:'RUBY',     lite:'#ffccd4', mid:'#e0354f', dark:'#7c1424', leafL:'#f06c80', leafD:'#9a1e30', vals:[386,402,418,434,450,466,482,498,514,530] },
    { name:'LEGEND',   lite:'#dfe7f2', mid:'#7f8da6', dark:'#2b3550', leafL:'#aab6cf', leafD:'#3d4a6a', vals:[550,570,590,610,630,650,670,690,710,730] }
  ];
  function msWallDefs(){
    if (document.getElementById('ffp-ms-wall-defs')) return;
    var grads='';
    FFP_MS_LEVELS.forEach(function(t,i){
      grads += '<linearGradient id="fmsr'+i+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+t.lite+'"/><stop offset=".45" stop-color="'+t.mid+'"/><stop offset="1" stop-color="'+t.dark+'"/></linearGradient>';
      grads += '<linearGradient id="fmsl'+i+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+t.leafL+'"/><stop offset="1" stop-color="'+t.leafD+'"/></linearGradient>';
    });
    grads += '<radialGradient id="fmsdisc" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#11283a"/><stop offset="1" stop-color="#05101a"/></radialGradient>';
    grads += '<filter id="fmsglow"><feGaussianBlur stdDeviation="2.2"/></filter>';
    var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('id','ffp-ms-wall-defs'); svg.setAttribute('width','0'); svg.setAttribute('height','0');
    svg.style.position='absolute'; svg.innerHTML='<defs>'+grads+'</defs>';
    document.body.appendChild(svg);
  }
  function msWreath(i){
    var t=FFP_MS_LEVELS[i], out='', N=28, R=108, cx=120, cy=120;
    for (var k=0;k<N;k++){
      var a=(k/N)*Math.PI*2-Math.PI/2, lx=cx+R*Math.cos(a), ly=cy+R*Math.sin(a), rot=(a*180/Math.PI)+90+32;
      out+='<g transform="translate('+lx.toFixed(1)+','+ly.toFixed(1)+') rotate('+rot.toFixed(1)+')"><path d="M0,-9 C5,-4 5,4 0,9 C-5,4 -5,-4 0,-9 Z" fill="url(#fmsl'+i+')" stroke="'+t.dark+'" stroke-width=".6"/></g>';
    }
    return out;
  }
  function msMedallion(value, lvl, state){
    var t=FFP_MS_LEVELS[lvl], num=String(value);
    var fs = num.length>=3?44:50;
    var inner='';
    if (state==='earned'){
      inner = msWreath(lvl)
        + '<circle cx="120" cy="120" r="96" fill="none" stroke="url(#fmsr'+lvl+')" stroke-width="17"/>'
        + '<circle cx="120" cy="120" r="104.5" fill="none" stroke="'+t.dark+'" stroke-width="1.5" opacity=".7"/>'
        + '<circle cx="120" cy="120" r="87" fill="none" stroke="'+t.dark+'" stroke-width="1.5" opacity=".7"/>'
        + '<path d="M52,86 A96,96 0 0 1 150,42" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".5" filter="url(#fmsglow)"/>'
        + '<circle cx="120" cy="120" r="79" fill="url(#fmsdisc)"/>'
        + '<circle cx="120" cy="120" r="79" fill="none" stroke="'+t.mid+'" stroke-width="1" opacity=".4"/>'
        + '<text x="120" y="98" font-size="20" font-weight="800" letter-spacing="2" fill="'+t.lite+'" text-anchor="middle" font-family="Montserrat,sans-serif">FFP</text>'
        + '<text x="120" y="140" font-size="'+fs+'" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="Montserrat,sans-serif">'+num+'</text>';
    } else {
      var nextS = (state==='next');
      var ringCol = nextS ? t.mid : 'rgba(255,255,255,0.12)';
      var rw = nextS ? 6 : 4;
      var numCol = nextS ? t.lite : '#43596b';
      var ffpCol = nextS ? t.mid : '#364a5a';
      var dash = nextS ? '' : ' stroke-dasharray="3 5"';
      inner = '<circle cx="120" cy="120" r="92" fill="none" stroke="'+ringCol+'" stroke-width="'+rw+'"'+dash+'/>'
        + '<circle cx="120" cy="120" r="79" fill="url(#fmsdisc)" opacity="'+(nextS?'1':'0.5')+'"/>'
        + '<text x="120" y="98" font-size="20" font-weight="800" letter-spacing="2" fill="'+ffpCol+'" text-anchor="middle" font-family="Montserrat,sans-serif">FFP</text>'
        + '<text x="120" y="140" font-size="'+fs+'" font-weight="900" fill="'+numCol+'" text-anchor="middle" font-family="Montserrat,sans-serif">'+num+'</text>';
    }
    return '<svg viewBox="0 0 240 240" class="fms-svg" xmlns="http://www.w3.org/2000/svg">'+inner+'</svg>';
  }
  function msWallCss(){
    if (document.getElementById('ffp-ms-wall-css')) return;
    var s=document.createElement('style'); s.id='ffp-ms-wall-css'; s.textContent=[
      '.fms-sub{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:2px 2px 6px;}',
      '.fms-sub-title{font-size:14px;font-weight:900;color:var(--text,#e8eef4);}',
      '.fms-sub-count{font-size:12px;font-weight:800;color:var(--yellow,#FFCC00);}',
      '.fms-level{margin:20px 2px 8px;display:flex;align-items:center;gap:8px;}',
      '.fms-level-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}',
      '.fms-level-name{font-size:11px;font-weight:800;letter-spacing:1px;}',
      '.fms-level-meta{font-size:10.5px;font-weight:700;color:var(--muted,#8a99a8);margin-left:auto;}',
      '.fms-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:14px 8px;}',
      '.fms-cell{display:flex;flex-direction:column;align-items:center;gap:5px;}',
      '.fms-svg{width:100%;max-width:104px;height:auto;display:block;}',
      '.fms-tag{font-size:9px;font-weight:800;letter-spacing:.4px;color:var(--blue,#2ba8e0);text-transform:uppercase;text-align:center;line-height:1.2;}',
      '.fms-tag.earned{color:var(--muted,#8a99a8);}',
      '.fms-tag.hidden{visibility:hidden;}'
    ].join(''); document.head.appendChild(s);
  }
  // v27 — MULTI-METRIC MEDALLION WALLS. renderMilestones now delegates to window.FFPMSBadges
  // (assets/ffp-milestone-badges.js) which owns the 8 object-badge designs + per-metric ladders.
  // The loader's job here is just to gather the member's NUMBERS and hand them over. Social counts
  // (Meetups, Connections) come from RPCs, fetched once and cached, then a re-render fills them in.
  var _msSocial = null, _msSocialLoading = false;
  function fetchMsSocial(){
    if (_msSocial || _msSocialLoading || !window.supabase) return;
    var ffpM = (window.FFPAuth && FFPAuth.getMember && FFPAuth.getMember()) || null;
    if (!ffpM || !ffpM.id) return;
    _msSocialLoading = true; var mid = ffpM.id;
    function num(r){ var d = r && r.data; if (d == null) return 0; if (typeof d === 'number') return d; if (Array.isArray(d)) return d.length; if (d.count != null) return d.count; return 0; }
    Promise.all([
      window.supabase.rpc('member_meets', { p_me: mid }).then(num).catch(function(){ return 0; }),
      window.supabase.rpc('member_connections_count', { p_me: mid }).then(num).catch(function(){ return 0; }),
      window.supabase.rpc('member_quests_completed', { p_me: mid }).then(num).catch(function(){ return 0; }),
      window.supabase.rpc('member_event_results', { p_me: mid }).then(function(r){ var ms=(r&&r.data&&r.data.milestones)||{}; return { comps: ms.competitions||0, runRaces: ms.running_races||0 }; }).catch(function(){ return { comps:0, runRaces:0 }; })
    ]).then(function (res) {
      _msSocial = { meets: res[0], connections: res[1], quests: res[2], comps: res[3].comps, runRaces: res[3].runRaces };
      _msSocialLoading = false;
      if (FitnessStats.tab === 'milestones' && typeof FitnessStats.renderMilestones === 'function') FitnessStats.renderMilestones();
    });
  }
  function overrideMilestonesV20(){
    FitnessStats.renderMilestones = function(){
      var gridEl = document.getElementById('achievements-grid');
      if (!gridEl) return;
      if (!window.FFPMSBadges) { gridEl.innerHTML = '<div style="color:var(--muted,#8a99a8);padding:24px;text-align:center;">Loading badges…</div>'; return; }
      var logs = activityCache || [], r = this.records || {}, p = this.profile || {};
      var w = p.weight || 0;
      function rat(k) { return (r[k] && r[k].value && w) ? (r[k].value / w) : 0; }      // lift ×bodyweight
      function tm(k) { return (r[k] && r[k].value) ? r[k].value : 1e9; }                 // run PR seconds; no PR → huge so all locked
      var values = {
        activities: logs.length,
        deadlift: rat('deadlift1RM'), squat: rat('squat1RM'), bench: rat('bench1RM'),
        variety: new Set(logs.map(function (l) { return l.activity; }).filter(Boolean)).size,
        run5k: tm('run5K'), run10k: tm('run10K'), run21k: tm('run21K'), marathon: tm('runMara'),
        vo2: (r.vo2max && r.vo2max.value) ? r.vo2max.value : 0,
        cities: new Set(logs.map(function (l) { return l.city; }).filter(Boolean)).size,
        bodyfat: (r.bodyFat && r.bodyFat.value != null) ? r.bodyFat.value : 999
      };
      if (_msSocial) { values.meets = _msSocial.meets; values.connections = _msSocial.connections; values.quests = _msSocial.quests; values.comps = _msSocial.comps; values.runRaces = _msSocial.runRaces; }
      window.FFPMSBadges.render(values, gridEl);
      var countEl = document.getElementById('ms-unlocked-count'); if (countEl) countEl.textContent = '';
      fetchMsSocial();
    };
  }
  window.ffpMilestoneDetail = function(key){
    var L=MS_LADDERS.find(function(x){return x.key===key;}); if(!L) return;
    var st=msBuildState(L, msCtx());
    if(st.recurring){
      var strapR='<div class="msd-strap"><div class="msd-strap-ic"><span class="material-icons">'+L.icon+'</span></div><div class="msd-strap-body"><div class="msd-strap-name">'+escText(L.name)+'</div><div class="msd-strap-now">'+escText(st.r.disp)+'</div><div class="msd-strap-next">'+st.totalEarned+' milestone'+(st.totalEarned===1?'':'s')+' earned · they keep coming</div></div></div>';
      var cardsR=st.cycles.map(function(c){ var zero=c.count===0; return '<div class="msc"><div class="msc-ring" style="--p:'+c.prog+'%"><div class="msc-emblem"><span class="material-icons">'+c.icon+'</span><span class="msc-x'+(zero?' zero':'')+'">×'+c.count+'</span></div></div><div class="msc-name">'+escText(c.name)+'</div><div class="msc-next">'+c.toNext+' to next</div></div>'; }).join('');
      if(typeof openDetailModal==='function') openDetailModal('<div class="msd-wrap">'+strapR+'<div class="msd-ladder-title">Recurring milestones — each repeats forever</div><div class="msc-grid">'+cardsR+'</div></div>', true);
      return;
    }
    var pct=msPctToNext(L,st); var nextName=st.nextIdx<0?null:st.tiers[st.nextIdx].name;
    var strap='<div class="msd-strap"><div class="msd-strap-ic"><span class="material-icons">'+L.icon+'</span></div><div class="msd-strap-body"><div class="msd-strap-name">'+escText(L.name)+'</div><div class="msd-strap-now">'+escText(st.r.disp)+'</div>'+(nextName?'<div class="msd-strap-next">Up next · '+escText(nextName)+'</div><div class="msd-strap-bar"><div class="msd-strap-bar-fill" style="width:'+Math.round(pct)+'%;"></div></div>':'<div class="msd-strap-next done">All '+st.total+' badges earned 🎉</div>')+'</div></div>';
    var ladder=st.tiers.map(function(tr,i){
      var state=st.earned[i]?'earned':(i===st.nextIdx?'next':'locked');
      if(!tr.major){ var tick=st.earned[i]?'✓':''; return '<div class="msd-badge minor '+state+'" title="'+escText(String(tr.t))+'"><div class="msd-badge-emblem">'+tick+'</div></div>'; }
      var metal=i<st.total/3?'bronze':(i<st.total*2/3?'silver':'gold');
      var inner=(i===st.total-1)?'<span class="material-icons msd-badge-star">star</span>':(tr.t>=1000?(tr.t/1000)+'K':String(tr.t));
      return '<div class="msd-badge major '+state+' '+metal+'"><div class="msd-badge-emblem">'+inner+'</div><div class="msd-badge-name">'+escText(tr.name)+'</div></div>';
    }).join('');
    var html='<div class="msd-wrap">'+strap+'<div class="msd-ladder-title">Badge ladder · '+st.earnedCount+'/'+st.total+'</div><div class="msd-ladder">'+ladder+'</div></div>';
    if(typeof openDetailModal==='function') openDetailModal(html, true);
  };

  // Override the dashboard's renderRecords directly — replaces all the old PR card population
  function overrideRenderRecords() {
    FitnessStats.renderRecords = function () {
      buildRecordsTabUI();
      renderRecordsContent();
    };
  }

  // ─────────── LOAD ───────────

  async function loadFromSupabase() {
    if (!window.supabase || typeof FitnessStats === 'undefined' || !(window.FFPAuth && window.FFPAuth.getMember && window.FFPAuth.getMember() && window.FFPAuth.getMember().id)) {
      if (retries < MAX_RETRIES) { retries++; setTimeout(loadFromSupabase, 200); }
      return;
    }
    injectStyles();

    try {
      var ffpM = (window.FFPAuth && window.FFPAuth.getMember && window.FFPAuth.getMember()) || null;
      if (!ffpM || !ffpM.id) {
        console.log('[FFP Fitness Stats] No FFP member — keeping sample');
        return;
      }
      currentUserId = ffpM.id;

      // v15.1: install the render overrides + WRITE WRAPPERS IMMEDIATELY, before any
      // network call. Previously these ran AFTER `await get_ranking_pool`; if that call
      // threw, the outer catch swallowed it and savePr/saveSleepLog were never wrapped →
      // saves silently no-op'd. Wrapping first guarantees writes persist regardless.
      overrideComputeStreak();
      overrideRenderActivity();
      overrideRenderMilestones();
      overrideMilestonesV20();   // v20 — replaces the milestones render with the tap-in BADGE LADDERS (wins, runs last)
      overrideRenderRecords();
      wrapWrites();

      var API = 'https://ffp-passport-backend.vercel.app';
      // Demographics from the cached member (set at sign-in) — no browser read needed.
      var ageFromDob = computeAgeFromDob(ffpM.date_of_birth);
      if (ageFromDob != null) FitnessStats.profile.chronAge = ageFromDob;
      if (ffpM.gender) FitnessStats.profile.gender = ffpM.gender;
      if (ffpM.city)   FitnessStats.profile.city   = ffpM.city;
      myDemo = {
        gender: ffpM.gender || null, age: ageFromDob,
        city: ffpM.city || null, country: ffpM.country || null, nationality: ffpM.nationality || null
      };

      // profile_meta READ via SECURITY DEFINER RPC (the backend had NO /profile-meta endpoint →
      // the old fetch 404'd, so saved records never loaded back into the Records tab). Same proven
      // RPC path as the SAVE, no backend dependency.
      // PARALLEL reads (v24) — profile, activity logs and ranking pool now fire CONCURRENTLY instead of
      // one-after-another. Each keeps its own try/catch (a failure in one can't abort the others) and writes
      // the same state as before — identical data + behaviour, just a faster panel open.
      var _poolP = (async function () {
        try {
          var poolRes = await window.supabase.rpc('get_ranking_pool');
          if (poolRes.error) { console.error('[FFP Fitness Stats] ranking_pool RPC:', poolRes.error); rankingPool = []; }
          else rankingPool = poolRes.data || [];
        } catch (e) { console.error('[FFP Fitness Stats] ranking_pool threw:', e); rankingPool = []; }
      })();
      var _profP = (async function () {
        try {
          var pmRes = await window.supabase.rpc('member_profile_meta_get', { p_me: currentUserId });
          var p = pmRes && pmRes.data;
          if (p) {
            if (ageFromDob == null && p.chrono_age != null) FitnessStats.profile.chronAge = Number(p.chrono_age);
            if (p.current_weight_kg != null) FitnessStats.profile.weight = Number(p.current_weight_kg);
            if (p.height_cm != null) FitnessStats.profile.height = Number(p.height_cm);
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
        } catch (e) { console.error('[FFP Fitness Stats] profile_meta read:', e); }
      })();
      var _logsP = (async function () {
        try {
          var alRes = await fetch(API + '/api/members/' + currentUserId + '/activity-logs');
          var alJson = await alRes.json();
          var rows = (alJson && alJson.logs) || [];
          activityCache = rows.map(function (r) {
            return { id: r.id, activity: r.activity || '', duration_min: r.duration_min || 0, duration_sec: r.duration_sec || 0, calories: r.calories || 0,
              distance_km: (r.distance_km != null ? Number(r.distance_km) : null),
              avg_heart_rate: (r.avg_heart_rate != null ? Number(r.avg_heart_rate) : null),
              notes: r.notes || '',
              city: r.city || '', country: r.country || '', venue: r.venue || '', checkin_lat: (r.checkin_lat != null ? Number(r.checkin_lat) : null), checkin_lng: (r.checkin_lng != null ? Number(r.checkin_lng) : null), photo_url: r.photo_url || '', photos: (Array.isArray(r.photos) && r.photos.length) ? r.photos : (r.photo_url ? [r.photo_url] : []), shared: !!r.shared, logged_at: r.logged_at || null, daysAgo: daysAgoFromIso(r.logged_at) };
          });
        } catch (e) { console.error('[FFP Fitness Stats] activity_logs read:', e); activityCache = []; }
      })();

      // ranking pool \u2014 isolated so a failure here can NEVER abort the loader (the write
      // wrappers are already installed above).
      // PERF (v24): paint the panel as soon as profile + logs are in — don't block on the heavier, all-members
      // ranking pool. The Records leaderboard fills the moment the pool lands (a second render). The default Bio
      // tab doesn't use the pool, so the common case shows no difference — just a faster open.
      var _dailyP = (async function () {
        try {
          var _rf = null; try { _rf = localStorage.getItem('ffp_refresh'); } catch (e) {}
          if (!_rf) { FitnessStats.wearableDaily = []; return; }
          var dr = await fetch(API + '/api/wearables/daily', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: _rf }) });
          var dj = await dr.json();
          FitnessStats.wearableDaily = (dj && dj.days) || [];
        } catch (e) { FitnessStats.wearableDaily = []; }
      })();
      await Promise.all([_profP, _logsP, _dailyP]);

      // WHOOP: auto-fill the Sleep Tracker with synced nights (manual logs win) + render the recovery/strain card.
      try {
        var _wd = FitnessStats.wearableDaily || [];
        FitnessStats.sleepLogs = FitnessStats.sleepLogs || {};
        _wd.forEach(function (d) { if (d.sleep_hours == null) return; var da = daysAgoFromDateStr(d.day); if (da >= 1 && da <= 30 && FitnessStats.sleepLogs[da] == null) FitnessStats.sleepLogs[da] = Number(d.sleep_hours); });
        var _lt = function (k) { for (var i = 0; i < _wd.length; i++) { if (_wd[i][k] != null) return _wd[i][k]; } return null; };
        var _rec = _lt('recovery_pct'), _str = _lt('strain'), _rhr = _lt('resting_hr'), _hrv = _lt('hrv_ms'), _sleepLatest = _lt('sleep_hours');
        // Auto-fill the Bio-Age HRV + Resting HR markers from WHOOP latest (manual entries win).
        FitnessStats.records = FitnessStats.records || {};
        if (_hrv != null && !(FitnessStats.records.hrv && FitnessStats.records.hrv.value != null)) FitnessStats.records.hrv = { value: _hrv, date: null };
        if (_rhr != null && !(FitnessStats.records.restingHR && FitnessStats.records.restingHR.value != null)) FitnessStats.records.restingHR = { value: _rhr, date: null };
        var _wh = document.getElementById('fs-whoop-daily');
        if (_wh && (_rec != null || _str != null || _sleepLatest != null || _rhr != null || _hrv != null)) {
          var _recCol = _rec == null ? '#8a99a8' : (_rec >= 67 ? '#16a34a' : (_rec >= 34 ? '#d9a300' : '#dc2626'));
          var C = 326.7, _off = _rec == null ? C : (C * (1 - Math.max(0, Math.min(100, _rec)) / 100));
          var _strain = _str == null ? 0 : Math.max(0, Math.min(21, _str)), _strW = Math.round(_strain / 21 * 100);
          var foot = [];
          if (_sleepLatest != null) foot.push(['Sleep', _sleepLatest + 'h']);
          if (_rhr != null) foot.push(['Resting HR', String(_rhr)]);
          if (_hrv != null) foot.push(['HRV', _hrv + 'ms']);
          _wh.innerHTML =
            '<div class="bio-section-title">Recovery &amp; strain <span style="font-size:10px;font-weight:700;color:var(--muted,#8a99a8);">· WHOOP</span></div>' +
            '<div style="background:rgba(43,168,224,0.06);border-radius:16px;padding:18px;">' +
              '<div style="display:flex;align-items:center;gap:18px;">' +
                '<div style="position:relative;flex:0 0 auto;width:116px;height:116px;">' +
                  '<svg width="116" height="116" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(138,153,168,0.18)" stroke-width="11"/>' +
                  (_rec != null ? '<circle cx="60" cy="60" r="52" fill="none" stroke="' + _recCol + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + _off + '" transform="rotate(-90 60 60)"/>' : '') + '</svg>' +
                  '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
                    '<div style="font-size:30px;font-weight:900;line-height:1;color:' + _recCol + ';">' + (_rec != null ? _rec + '%' : '—') + '</div>' +
                    '<div style="font-size:9px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--muted,#8a99a8);margin-top:3px;">Recovery</div>' +
                  '</div>' +
                '</div>' +
                '<div style="flex:1;min-width:0;">' +
                  '<div style="font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:var(--muted,#8a99a8);margin-bottom:4px;">Day strain</div>' +
                  '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:9px;"><span style="font-size:30px;font-weight:900;line-height:1;color:var(--blue,#2ba8e0);">' + (_str != null ? _strain : '—') + '</span><span style="font-size:12px;font-weight:700;color:var(--muted,#8a99a8);">/ 21</span></div>' +
                  '<div style="height:9px;border-radius:5px;background:rgba(138,153,168,0.18);overflow:hidden;"><div style="height:100%;width:' + _strW + '%;background:linear-gradient(90deg,#2ba8e0,#1d7fb0);border-radius:5px;"></div></div>' +
                '</div>' +
              '</div>' +
              (foot.length ? ('<div style="display:flex;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border,rgba(43,168,224,0.18));">' + foot.map(function (f) { return '<div style="flex:1;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--text,#e8eef4);">' + f[1] + '</div><div style="font-size:9px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:var(--muted,#8a99a8);margin-top:3px;">' + f[0] + '</div></div>'; }).join('') + '</div>') : '') +
            '</div>';
        } else if (_wh) { _wh.innerHTML = ''; }
      } catch (e) { console.error('[FFP Fitness Stats] wearable merge:', e); }

      // Old percentile pills no longer used (leaderboard replaces them)
      FitnessStats.ranks = {};

      var panel = document.getElementById('panel-fitness-stats');
      function _fsRender() { if (panel && panel.classList.contains('active') && typeof FitnessStats.render === 'function') FitnessStats.render(); }
      _fsRender();
      _poolP.then(_fsRender);   // ranking pool arrived → refresh so the Records leaderboard populates

      console.log('[FFP Fitness Stats v15.1] Loaded \u2713 (writes wrapped: ' + wrapped + ', ' + activityCache.length + ' activities, ' + rankingPool.length + ' members in pool)');
    } catch (err) {
      console.error('[FFP Fitness Stats] Unexpected error:', err);
    }
  }

  function wrapWrites() {
    if (wrapped) return;
    wrapped = true;
    // v16: PERSISTENCE moved to the CORE FitnessStats (savePr/clearPr/saveSleepLog →
    // member_profile_meta_save), so it works exactly like activity logs and never depends on this
    // lazy loader. Here we ONLY refresh the local leaderboard snapshot + records view after a save.
    var origSavePr = FitnessStats.savePr.bind(FitnessStats);
    FitnessStats.savePr = function () {
      var key = this._editKey; origSavePr();
      var map = PR_MAP[key], rec = key && this.records[key];
      if (map && rec) {
        var val = map.cast === 'int' ? Math.round(rec.value) : Number(rec.value);
        for (var i = 0; i < rankingPool.length; i++) { if (rankingPool[i].member_id === currentUserId) { rankingPool[i][map.col] = val; break; } }
      }
      if (this.tab === 'records') renderRecordsContent();
    };
    var origClearPr = FitnessStats.clearPr.bind(FitnessStats);
    FitnessStats.clearPr = function () {
      var key = this._editKey; origClearPr();
      var map = PR_MAP[key];
      if (map && key && this.records[key] == null) {
        for (var i = 0; i < rankingPool.length; i++) { if (rankingPool[i].member_id === currentUserId) { rankingPool[i][map.col] = null; break; } }
      }
      if (this.tab === 'records') renderRecordsContent();
    };
    var origSaveSleepLog = FitnessStats.saveSleepLog.bind(FitnessStats);
    FitnessStats.saveSleepLog = function () {
      origSaveSleepLog();
      try {
        var dbShape = sleepToDb(this.sleepLogs), hrs = [];
        Object.keys(dbShape).forEach(function (k) { var v = Number(dbShape[k]); if (!isNaN(v)) hrs.push(v); });
        var avg = hrs.length ? hrs.reduce(function (a, b) { return a + b; }, 0) / hrs.length : null;
        for (var i = 0; i < rankingPool.length; i++) { if (rankingPool[i].member_id === currentUserId) { rankingPool[i].sleep_avg_hours = avg; break; } }
      } catch (e) {}
      if (this.tab === 'records') renderRecordsContent();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(loadFromSupabase, 400); });
  } else {
    setTimeout(loadFromSupabase, 400);
  }
  window.ffpReloadFitnessStats = loadFromSupabase;
})();

/* FFP Admin — Platform activity. Day-to-day actions across the app areas (Find / Track / Reward / Connect /
   Profile): which functions are used most/least, and the demographic split (gender · age · membership · city)
   + who behind each action. Filter worldwide / country / city. Reads admin_activity_usage / admin_activity_breakdown.
   Renders into #activity-body. Distinct from Analytics (membership/provider totals). */
(function () {
  var sb = function () { return window.supabase; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function fmt(n) { n = Number(n) || 0; return n.toLocaleString('en-US'); }
  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] || ''; }).join('').toUpperCase() || '?'; }
  function ago(iso) { try { var s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; } catch (e) { return ''; } }

  var AREAS = [['find', 'Find', 'search'], ['track', 'Track', 'monitoring'], ['reward', 'Reward', 'redeem'], ['connect', 'Connect', 'diversity_3'], ['profile', 'Profile', 'person']];
  var META = {
    checkin: ['Check-ins', 'qr_code_scanner'], booking: ['Bookings', 'event_available'],
    activity: ['Activities logged', 'directions_run'], calories: ['Calories / meals logged', 'restaurant'],
    giveaway_entry: ['Giveaway entries', 'card_giftcard'], offer_claimed: ['Offers claimed', 'local_offer'], loyalty: ['Loyalty earns', 'card_membership'], tour_vote: ['Tour (WGA) votes', 'public'], quest_join: ['Quests joined', 'flag'],
    message: ['Messages sent', 'chat_bubble'], high_five: ['High fives', 'front_hand'], connection: ['Connections made', 'handshake'], meetup: ['Meetups hosted', 'groups'], comment: ['Comments', 'forum'],
    signup: ['Signups', 'person_add'], cancellation: ['Cancellations', 'cancel'],
    // tile/screen OPENS (Phase 2 — from tile_events; distinct from the actions above)
    explore_open: ['Explore opened', 'explore'], explore_browse: ['Category browsed', 'grid_view'], bookings_open: ['Bookings screen', 'event'], checkin_open: ['Check-in screen', 'qr_code_scanner'],
    provider_view: ['Partner profiles viewed', 'storefront'], brand_view: ['Brand profiles viewed', 'shopping_bag'], pro_view: ['Pro profiles viewed', 'badge'], listing_view: ['Listings viewed', 'local_activity'],
    passport_view: ['Passport card viewed', 'badge'], stats_view: ['Stats / Bio-age viewed', 'bar_chart'], benchmarks_view: ['Benchmarks viewed', 'speed'], milestones_view: ['Milestones viewed', 'military_tech'],
    workout_open: ['Workout opened', 'fitness_center'], programs_open: ['Programs opened', 'list_alt'], calories_open: ['Calories opened', 'restaurant'], mealplan_open: ['Meal planner opened', 'restaurant_menu'], timer_open: ['Timer opened', 'timer'], log_open: ['Log activity opened', 'add_circle'], history_open: ['History opened', 'history'],
    quests_open: ['Quests opened', 'flag'], giveaways_open: ['Giveaways opened', 'card_giftcard'], offers_open: ['Offers opened', 'local_offer'], earnings_open: ['Earnings opened', 'payments'], loyalty_open: ['Loyalty opened', 'card_membership'], tour_open: ['Tour (WGA) opened', 'public'], rewards_open: ['Rewards opened', 'redeem'],
    connections_open: ['Connections opened', 'handshake'], matches_open: ['Matches opened', 'favorite'], meetups_open: ['Meetups opened', 'groups'], messages_open: ['Messages opened', 'chat_bubble'], teams_open: ['Teams opened', 'shield'], compete_open: ['Compete opened', 'emoji_events'], leagues_open: ['Leagues opened', 'sports_soccer'], tournaments_open: ['Tournaments opened', 'account_tree'], community_open: ['Community opened', 'diversity_3'], coach_open: ['Coach opened', 'psychology'],
    profile_open: ['Profile opened', 'person'], membership_open: ['Membership opened', 'credit_card'], profile_edit_open: ['Profile edited', 'edit']
  };
  function label(k) { return (META[k] && META[k][0]) || k; }
  function icon(k) { return (META[k] && META[k][1]) || 'bolt'; }

  var S = { area: 'find', scope: 'worldwide', scopeVal: '', period: '30', usage: [], action: null, bd: null };

  function css() {
    if (document.getElementById('ffp-act-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-act-css';
    s.textContent =
      '#activity-body{color:#eaf1f6}' +
      '.act-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}' +
      '.act-sel{display:flex;align-items:center;gap:8px;background:#0f1d28;border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:9px 12px;font-size:13px;font-weight:700;color:#eaf1f6}' +
      '.act-sel select,.act-sel input{background:none;border:none;color:#eaf1f6;font-family:inherit;font-weight:700;font-size:13px;outline:none}' +
      '.act-sel .material-icons{font-size:18px;color:#8aa0ad}' +
      '.act-tabs{display:flex;gap:2px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:18px;overflow-x:auto}' +
      '.act-tabs button{background:none;border:none;color:#8aa0ad;font-family:inherit;font-weight:800;font-size:14px;padding:11px 15px;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}' +
      '.act-tabs button.on{color:#eaf1f6;border-bottom-color:#f2a900}' +
      '.act-tabs button .material-icons{font-size:16px;margin-right:6px;vertical-align:middle}' +
      '.act-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}' +
      '@media(max-width:900px){.act-grid{grid-template-columns:1fr}}' +
      '.act-card{background:#0f1d28;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:8px 16px 12px}' +
      '.act-h{font-size:11px;font-weight:900;letter-spacing:1.1px;text-transform:uppercase;color:#8aa0ad;padding:12px 2px 6px}' +
      '.act-h b{color:#eaf1f6}' +
      '.act-row{padding:10px 2px;border-bottom:1px solid rgba(255,255,255,.07);cursor:pointer}' +
      '.act-row:last-child{border:none}.act-row.sel{background:rgba(43,168,224,.08);border-radius:8px;padding-left:8px;padding-right:8px}' +
      '.act-row .t{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;margin-bottom:6px}' +
      '.act-row .t .nm .material-icons{color:#2b9fd0;font-size:16px;margin-right:8px;vertical-align:middle}' +
      '.act-row .t .r{font-weight:900}.act-row .t .r .u{font-size:11px;color:#8aa0ad;font-weight:800;margin-left:7px}' +
      '.act-track{height:8px;border-radius:6px;background:#0a1620;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.5)}' +
      '.act-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#1e6f96,#4dd4e6)}' +
      '.act-low{color:#e0a94a;font-size:9px;font-weight:900;text-transform:uppercase;background:#3a2f10;padding:2px 6px;border-radius:100px;margin-right:7px}' +
      '.act-big{font-size:24px;font-weight:900;margin:6px 2px 2px}.act-big .u{font-size:12px;color:#8aa0ad;font-weight:700}' +
      '.act-dg{margin:14px 2px 0}.act-dg h4{font-size:10px;font-weight:900;letter-spacing:.9px;text-transform:uppercase;color:#8aa0ad;margin-bottom:8px}' +
      '.act-dr{margin:7px 0}.act-dr .t{display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;margin-bottom:4px}.act-dr .t .v{font-weight:900}.act-dr .t .pc{color:#8aa0ad;font-weight:800;font-size:11px;margin-left:6px}' +
      '.act-fill.gd{background:linear-gradient(90deg,#b8860b,#f2a900)}.act-fill.pk{background:linear-gradient(90deg,#8e3a74,#e08bc0)}' +
      '.act-ur{display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid rgba(255,255,255,.07)}.act-ur:last-child{border:none}' +
      '.act-av{width:30px;height:30px;border-radius:50%;flex:none;background:#12313f center/cover;color:#4dd4e6;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center}' +
      '.act-ur .b{flex:1;min-width:0}.act-ur .nm{font-size:13px;font-weight:800}.act-ur .cy{font-size:11px;color:#8aa0ad;font-weight:600}.act-ur .cv{font-size:13px;font-weight:900}.act-ur .tm{font-size:11px;color:#5f7482;font-weight:700}' +
      '.act-empty{padding:26px 6px;color:#8aa0ad;font-size:13px;font-weight:600;text-align:center}';
    document.head.appendChild(s);
  }

  function range() {
    var to = new Date(); var from = new Date();
    if (S.period === 'today') from.setHours(0, 0, 0, 0);
    else from.setDate(from.getDate() - parseInt(S.period, 10));
    return { from: from.toISOString(), to: to.toISOString() };
  }
  function scopeArgs() {
    return { p_city: S.scope === 'city' && S.scopeVal ? S.scopeVal : null, p_country: S.scope === 'country' && S.scopeVal ? S.scopeVal : null };
  }

  function shell() {
    css();
    var el = document.getElementById('activity-body'); if (!el) return null;
    var sc = scopeArgs();
    var scopeSel = '<div class="act-sel"><span class="material-icons">public</span>' +
      '<select onchange="AdminActivity.setScope(this.value)">' +
      '<option value="worldwide"' + (S.scope === 'worldwide' ? ' selected' : '') + '>Worldwide</option>' +
      '<option value="city"' + (S.scope === 'city' ? ' selected' : '') + '>By city</option>' +
      '<option value="country"' + (S.scope === 'country' ? ' selected' : '') + '>By country</option></select>' +
      (S.scope !== 'worldwide' ? '<input placeholder="' + (S.scope === 'city' ? 'City name' : 'Country') + '" value="' + esc(S.scopeVal) + '" onchange="AdminActivity.setScopeVal(this.value)" style="width:120px">' : '') + '</div>';
    var perSel = '<div class="act-sel"><span class="material-icons">calendar_today</span><select onchange="AdminActivity.setPeriod(this.value)">' +
      ['today:Today', '7:Last 7 days', '30:Last 30 days', '90:Last 90 days'].map(function (o) { var kv = o.split(':'); return '<option value="' + kv[0] + '"' + (S.period === kv[0] ? ' selected' : '') + '>' + kv[1] + '</option>'; }).join('') + '</select></div>';
    var tabs = '<div class="act-tabs">' + AREAS.map(function (a) { return '<button class="' + (S.area === a[0] ? 'on' : '') + '" onclick="AdminActivity.tab(\'' + a[0] + '\')"><span class="material-icons">' + a[2] + '</span>' + a[1] + '</button>'; }).join('') + '</div>';
    el.innerHTML = '<div class="act-top">' + scopeSel + perSel + '</div>' + tabs + '<div class="act-grid"><div id="act-usage"></div><div id="act-bd"></div></div>';
    return el;
  }

  async function loadUsage() {
    var host = document.getElementById('act-usage'); if (!host) return;
    host.innerHTML = '<div class="act-card"><div class="act-empty">Loading…</div></div>';
    var r = range(), sc = scopeArgs();
    var res; try { res = await sb().rpc('admin_activity_usage', { p_from: r.from, p_to: r.to, p_area: S.area, p_city: sc.p_city, p_country: sc.p_country }); } catch (e) { res = { error: e }; }
    S.usage = (res && !res.error && Array.isArray(res.data)) ? res.data : [];
    var max = S.usage.reduce(function (m, x) { return Math.max(m, x.count || 0); }, 0) || 1;
    var rows = S.usage.length ? S.usage.map(function (x, i) {
      var low = (i === S.usage.length - 1 && S.usage.length > 2 && x.count < max * 0.1) ? '<span class="act-low">Low use</span>' : '';
      return '<div class="act-row' + (S.action === x.action_key ? ' sel' : '') + '" onclick="AdminActivity.pick(\'' + x.action_key + '\')">' +
        '<div class="t"><span class="nm">' + low + '<span class="material-icons">' + icon(x.action_key) + '</span>' + esc(label(x.action_key)) + '</span>' +
        '<span class="r">' + fmt(x.count) + '<span class="u">' + fmt(x.users) + ' users</span></span></div>' +
        '<div class="act-track"><i class="act-fill" style="width:' + Math.max(3, Math.round((x.count / max) * 100)) + '%"></i></div></div>';
    }).join('') : '<div class="act-empty">No activity in this area for the selected filters.</div>';
    host.innerHTML = '<div class="act-card"><div class="act-h">Feature usage <b>· ' + AREAS.filter(function (a) { return a[0] === S.area; })[0][1] + '</b> · most &amp; least used</div>' + rows + '</div>';
    // auto-select the top action
    if (S.usage.length && (!S.action || !S.usage.some(function (x) { return x.action_key === S.action; }))) { S.action = S.usage[0].action_key; }
    if (S.action) loadBreakdown(); else { var b = document.getElementById('act-bd'); if (b) b.innerHTML = ''; }
  }

  function bars(arr, cls) {
    arr = arr || []; var max = arr.reduce(function (m, x) { return Math.max(m, x.v || 0); }, 0) || 1;
    var tot = arr.reduce(function (s, x) { return s + (x.v || 0); }, 0) || 1;
    return arr.map(function (x) {
      return '<div class="act-dr"><div class="t"><span>' + esc(x.k) + '</span><span><span class="v">' + fmt(x.v) + '</span><span class="pc">' + Math.round((x.v / tot) * 100) + '%</span></span></div>' +
        '<div class="act-track"><i class="act-fill ' + (cls || '') + '" style="width:' + Math.max(3, Math.round((x.v / max) * 100)) + '%"></i></div></div>';
    }).join('');
  }

  async function loadBreakdown() {
    var host = document.getElementById('act-bd'); if (!host || !S.action) return;
    host.innerHTML = '<div class="act-card"><div class="act-empty">Loading…</div></div>';
    var r = range(), sc = scopeArgs();
    var res; try { res = await sb().rpc('admin_activity_breakdown', { p_action: S.action, p_from: r.from, p_to: r.to, p_city: sc.p_city, p_country: sc.p_country }); } catch (e) { res = { error: e }; }
    var d = (res && !res.error && res.data) ? res.data : null;
    if (!d) { host.innerHTML = '<div class="act-card"><div class="act-empty">Could not load breakdown.</div></div>'; return; }
    var users = (d.top_users || []).map(function (u) {
      return '<div class="act-ur"><span class="act-av"' + (u.photo ? ' style="background-image:url(\'' + esc(u.photo) + '\')"' : '') + '>' + (u.photo ? '' : initials(u.name)) + '</span>' +
        '<div class="b"><div class="nm">' + esc(u.name || 'Member') + '</div><div class="cy">' + esc(u.city || '—') + '</div></div><div class="cv">' + fmt(u.n) + '</div></div>';
    }).join('') || '<div class="act-empty">No users.</div>';
    var feed = (d.feed || []).map(function (f) {
      return '<div class="act-ur"><span class="act-av"' + (f.photo ? ' style="background-image:url(\'' + esc(f.photo) + '\')"' : '') + '>' + (f.photo ? '' : initials(f.name)) + '</span>' +
        '<div class="b"><div class="nm">' + esc(f.name || 'Member') + '</div><div class="cy">' + esc(f.city || '—') + '</div></div><div class="tm">' + ago(f.ts) + '</div></div>';
    }).join('') || '<div class="act-empty">No recent events.</div>';
    host.innerHTML =
      '<div class="act-card"><div class="act-h">Breakdown <b>· ' + esc(label(S.action)) + '</b></div>' +
        '<div class="act-big">' + fmt(d.total) + ' <span class="u">' + esc(label(S.action)).toLowerCase() + '</span></div>' +
        '<div class="act-dg"><h4>By gender</h4>' + bars(d.gender, 'pk') + '</div>' +
        '<div class="act-dg"><h4>By age group</h4>' + bars(d.age) + '</div>' +
        '<div class="act-dg"><h4>By membership</h4>' + bars(d.membership, 'gd') + '</div>' +
        '<div class="act-dg"><h4>By city</h4>' + bars(d.cities) + '</div>' +
      '</div>' +
      '<div class="act-card" style="margin-top:16px"><div class="act-h">Top users</div>' + users + '</div>' +
      '<div class="act-card" style="margin-top:16px"><div class="act-h">Recent</div>' + feed + '</div>';
  }

  window.AdminActivity = {
    refresh: function () { if (shell()) loadUsage(); },
    tab: function (a) { S.area = a; S.action = null; shell(); loadUsage(); },
    setScope: function (v) { S.scope = v; S.scopeVal = ''; shell(); if (v === 'worldwide') loadUsage(); },
    setScopeVal: function (v) { S.scopeVal = v.trim(); loadUsage(); },
    setPeriod: function (v) { S.period = v; loadUsage(); },
    pick: function (k) { S.action = k; document.querySelectorAll('#act-usage .act-row').forEach(function (r) { r.classList.remove('sel'); }); loadUsage(); }
  };

  function boot() { if (window.supabase && (window.FFP_ADMIN || (window.FFPAuth && FFPAuth.getJwt && FFPAuth.getJwt()))) window.AdminActivity.refresh(); }
  document.addEventListener('ffp-admin-ready', boot);
  boot();
})();

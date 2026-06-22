/* FFP Connections Feed Loader — v3 (2026-06-07)
   v3: PR feed items — "X set a new <metric> PR — <value>" rows (type 'pr') tap to CONGRATULATE
       (member_congratulate RPC → notification on their bell). Powered by the pr_history table + trigger.
   v2: renders EAGERLY on load (was only on first tab-open) with a retry cap, so the panel can never be
       stuck on the "Loading your people…" skeleton. Falls back to an empty state if deps never arrive.
   v1 (2026-06-07):
   Renders the upgraded Connections panel into #conn-panel-root (member dashboard #panel-meet):
     1) Discovery strap  -> window.MeetMove.openMatchesGrid()  ("people you might click with")
     2) My connections   -> most-active-first circles (green dot = active) -> CollectionView.openPerson(id);
                            "See all" -> CollectionView.open()
     3) From your people  -> uniform tap-through feed (notifications to me + connections' meetup / challenge /
                            activity / birthday events) from the member_connections_panel(p_me) RPC.
   Lazy: renders on first open of the Connections tab (and on demand via window.FFPConnFeed.reload()).
   Depends on window.MeetMove + window.CollectionView (ffp-connections-core.js), window.Challenges,
   window.supabase, window.FFPAuth. No inline dashboard logic. */
(function () {
  'use strict';

  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function attr(s) { return String(s == null ? '' : s).replace(/'/g, '\\u0027').replace(/"/g, '&quot;'); }
  function memberId() {
    try { if (window.FFPAuth && FFPAuth.getMember) { var m = FFPAuth.getMember(); if (m && m.id) return m.id; } } catch (e) {}
    try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}')).id || ''; } catch (e) { return ''; }
  }

  function injectStyles() {
    if (document.getElementById('ffp-connfeed-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-connfeed-css';
    s.textContent = [
      '.cf-skeleton{padding:24px 4px;color:var(--muted,#8a99a8);font-size:13px;}',
      '.cf-strap{display:flex;align-items:center;gap:11px;margin:2px 0 4px;padding:12px 13px;background:rgba(43,168,224,0.08);border:1px solid rgba(43,168,224,0.25);border-radius:14px;cursor:pointer;}',
      '.cf-strap .material-icons{color:var(--blue,#2ba8e0);}',
      '.cf-strap-txt{flex:1;min-width:0;}',
      '.cf-strap-t{font-size:14px;font-weight:800;color:var(--text,#e8eef4);}',
      '.cf-strap-s{font-size:11px;color:var(--muted,#8a99a8);margin-top:1px;}',
      '.cf-badge{background:var(--yellow,#FFCC00);color:#081420;font-size:11px;font-weight:800;padding:1px 7px;border-radius:10px;flex-shrink:0;}',
      '.cf-chev{color:#5f7185;flex-shrink:0;}',
      '.cf-sec-head{display:flex;align-items:center;justify-content:space-between;margin:18px 0 3px;}',
      '.cf-sec-t{font-size:14px;font-weight:800;color:var(--text,#e8eef4);}',
      '.cf-sec-link{font-size:12px;font-weight:700;color:var(--yellow,#FFCC00);cursor:pointer;}',
      '.cf-cap{font-size:11px;color:var(--muted,#8a99a8);margin-bottom:11px;}',
      '.cf-circles{display:flex;gap:13px;overflow-x:auto;padding-bottom:2px;}',
      '.cf-cell{text-align:center;width:50px;flex-shrink:0;cursor:pointer;}',
      '.cf-cwrap{position:relative;width:46px;height:46px;margin:0 auto;}',
      '.cf-av{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#cfe6f5;background:#214b6b;background-size:cover;background-position:center;}',
      '.cf-dot{position:absolute;bottom:1px;right:1px;width:11px;height:11px;border-radius:50%;border:2px solid var(--bg,#0a1825);}',
      '.cf-dot.on{background:#36c97f;} .cf-dot.off{background:#566; display:none;}',
      '.cf-cname{font-size:11px;color:var(--muted,#8a99a8);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.cf-empty{font-size:12px;color:var(--muted,#8a99a8);padding:8px 0;line-height:1.5;}',
      '.cf-row{display:flex;gap:11px;align-items:center;padding:11px 2px;border-top:1px solid rgba(255,255,255,0.06);cursor:pointer;}',
      '.cf-rav{position:relative;width:40px;height:40px;flex-shrink:0;}',
      '.cf-ravc{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#cfe6f5;background:#214b6b;background-size:cover;background-position:center;}',
      '.cf-rav .material-icons{position:absolute;bottom:-2px;right:-2px;font-size:13px;color:var(--blue,#2ba8e0);background:var(--bg,#0a1825);border-radius:50%;padding:2px;}',
      '.cf-iconc{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#16263a;}',
      '.cf-iconc .material-icons{font-size:20px;color:var(--blue,#2ba8e0);}',
      '.cf-rtxt{flex:1;min-width:0;}',
      '.cf-rt{font-size:13px;line-height:1.35;color:var(--text,#e8eef4);}',
      '.cf-rt b{font-weight:800;}',
      '.cf-rs{font-size:11px;color:#7c8b9a;margin-top:1px;}',
      '.cf-search{width:100%;box-sizing:border-box;padding:11px 14px;border-radius:12px;border:1px solid rgba(43,168,224,0.25);background:rgba(43,168,224,0.05);color:var(--text,#e8eef4);font-size:14px;font-family:inherit;margin:2px 0 6px;}',
      '.cf-cbtn{flex:0 0 auto;background:var(--yellow,#FFCC00);color:#081420;border:none;border-radius:9px;padding:7px 13px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;}',
      '.cf-cbtn.done{background:transparent;color:var(--muted,#8a99a8);border:1px solid rgba(255,255,255,0.14);cursor:default;}',
      '.cf-cell.sel .cf-av{box-shadow:0 0 0 2px var(--yellow,#FFCC00);}',
      '.cf-acts{display:flex;gap:10px;overflow-x:auto;padding:2px 0 6px;-webkit-overflow-scrolling:touch;}',
      '.cf-acard{flex:0 0 auto;width:138px;background:#11283c;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;cursor:pointer;}',
      '.cf-acard-img{height:84px;background:#1f5b86 center/cover no-repeat;display:flex;align-items:center;justify-content:center;}',
      '.cf-acard-img .material-icons{font-size:30px;color:#9fc4e0;}',
      '.cf-acard-b{padding:8px 10px;}',
      '.cf-acard-t{font-size:12.5px;font-weight:800;color:var(--text,#e8eef4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.cf-acard-s{font-size:11px;color:var(--muted,#8a99a8);margin-top:2px;}',
      '.cf-stats{margin:2px 0 14px;}',
      '.cf-jstreak{display:inline-flex;align-items:center;gap:6px;margin:0 0 12px;}',
      '.cf-jstreak .material-icons{color:var(--yellow,#FFCC00);font-size:20px;}',
      '.cf-jstreak b{font-size:20px;font-weight:800;color:var(--yellow,#FFCC00);font-variant-numeric:tabular-nums;line-height:1;}',
      '.cf-jstreak span{font-size:11px;color:var(--muted,#8a99a8);font-weight:800;text-transform:uppercase;letter-spacing:.5px;}',
      '.cf-jlabel{font-size:13px;font-weight:700;color:var(--text,#e8eef4);margin:0 0 8px;}',
      '.cf-jgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden;}',
      '.cf-jcell{background:var(--bg,#0a1825);padding:12px 4px;text-align:center;}',
      '.cf-jn{font-size:19px;font-weight:800;color:var(--text,#e8eef4);font-variant-numeric:tabular-nums;line-height:1.05;}',
      '.cf-jl{font-size:8.5px;font-weight:700;letter-spacing:.4px;color:var(--muted,#8a99a8);text-transform:uppercase;margin-top:3px;}',
      '.cf-actlbl{font-size:13px;font-weight:800;color:var(--text,#e8eef4);margin:16px 0 8px;}'
    ].join('');
    document.head.appendChild(s);
  }

  // Count only genuinely NEW people — not ones you've already connected with or already sent a request to.
  // connection: 'none' (can add) / 'incoming' (they asked you) are NEW; 'connected' / 'requested' are not.
  function matchesCount() {
    try {
      if (window.MeetMove && Array.isArray(MeetMove.matches)) {
        return MeetMove.matches.filter(function (m) {
          var c = m && m.connection;
          return c == null || c === 'none' || c === 'incoming';
        }).length;
      }
    } catch (e) {}
    return 0;
  }
  function iconFor(it) {
    if (it.type === 'meetup') return 'groups';
    if (it.type === 'challenge') return 'emoji_events';
    if (it.type === 'activity') return 'directions_run';
    if (it.type === 'birthday') return 'cake';
    return it.icon || 'notifications';
  }
  function avHtml(name, photo, cls) {
    if (photo) return '<div class="' + cls + '" style="background-image:url(\'' + esc(photo) + '\');"></div>';
    return '<div class="' + cls + '">' + esc((name || 'M').charAt(0).toUpperCase()) + '</div>';
  }

  function render(data) {
    var root = document.getElementById('conn-panel-root');
    if (!root) return;
    data = data || {};
    var conns = data.connections || [];
    var feed = data.feed || [];
    var n = matchesCount();

    var html = '';

    // 0) Discovery strap
    html += '<div class="cf-strap" onclick="FFPConnFeed.discover()">' +
      '<span class="material-icons">auto_awesome</span>' +
      '<div class="cf-strap-txt"><div class="cf-strap-t">People you might click with</div>' +
      '<div class="cf-strap-s">' + (n > 0 ? 'Discover athletes who match you' : 'No new connections to view') + '</div></div>' +
      (n > 0 ? '<span class="cf-badge">' + n + ' new</span>' : '') +
      '<span class="material-icons cf-chev">chevron_right</span></div>';

    // 1) Search strap → opens a modal to find members to connect with (sits under discovery)
    html += '<div class="cf-strap" onclick="FFPConnFeed.openSearch()">' +
      '<span class="material-icons">search</span>' +
      '<div class="cf-strap-txt"><div class="cf-strap-t">Find a connection</div>' +
      '<div class="cf-strap-s">Search Find Fit People members by name</div></div>' +
      '<span class="material-icons cf-chev">chevron_right</span></div>';

    // 2) My connections (most active first)
    html += '<div class="cf-sec-head"><div class="cf-sec-t">My connections</div>' +
      '<div class="cf-sec-link" onclick="FFPConnFeed.seeAll()">See all</div></div>';
    if (conns.length) {
      html += '<div class="cf-cap">Most active right now — see what they’re up to</div><div class="cf-circles">';
      html += conns.slice(0, 12).map(function (c) {
        var first = (c.name || 'Member').split(' ')[0];
        return '<div class="cf-cell" id="cf-cell-' + attr(c.id) + '" onclick="FFPConnFeed.selectPerson(\'' + attr(c.id) + '\',\'' + attr(c.name) + '\')">' +
          '<div class="cf-cwrap">' +
            (c.photo ? '<div class="cf-av" style="background-image:url(\'' + esc(c.photo) + '\');"></div>'
                     : '<div class="cf-av">' + esc((c.name || 'M').charAt(0).toUpperCase()) + '</div>') +
            '<span class="cf-dot ' + (c.active ? 'on' : 'off') + '"></span>' +
          '</div><div class="cf-cname">' + esc(first) + '</div></div>';
      }).join('');
      html += '</div>';
    } else {
      html += '<div class="cf-empty">No connections yet — open <b>People you might click with</b>, tap someone and add their passport.</div>';
    }

    // 3) Selected connection's activities — a horizontal slider, populated by selectPerson()
    html += '<div id="cf-person-activities" style="margin-top:6px;"></div>';

    root.innerHTML = html;
    // auto-select the most-active connection so the activities slider isn't empty
    if (conns.length) { try { var c0 = conns[0]; window.FFPConnFeed.selectPerson(c0.id, c0.name); } catch (e) {} }
  }

  var loading = false, tries = 0;
  async function load() {
    var root = document.getElementById('conn-panel-root');
    if (!root) return;
    if ((!window.supabase || !memberId()) && tries < 40) { tries++; setTimeout(load, 300); return; }
    var me = memberId();
    if (!window.supabase || !me) { render({}); return; }   // deps never arrived → show empty rather than spin
    if (loading) return; loading = true;
    try {
      var r = await window.supabase.rpc('member_connections_panel', { p_me: me });
      if (r.error) { console.warn('[FFP ConnFeed]', r.error.message); render({}); return; }
      render(r.data || {});
    } catch (e) { console.warn('[FFP ConnFeed] threw', e); render({}); }
    finally { loading = false; }
  }

  function goPanel(pid) { var b = document.querySelector('.nav-item[data-panel="' + pid + '"]'); if (b) b.click(); }

  // ── Passport member search ──
  function searchRow(u) {
    var btn;
    if (u.connection === 'connected') btn = '<button class="cf-cbtn done" disabled>✓ Connected</button>';
    else if (u.connection === 'requested') btn = '<button class="cf-cbtn done" disabled>Requested</button>';
    else if (u.connection === 'incoming') btn = '<button class="cf-cbtn" onclick="event.stopPropagation();FFPConnFeed.connect(\'' + attr(u.id) + '\',\'incoming\',\'' + attr(u.name) + '\',this)">Accept</button>';
    else btn = '<button class="cf-cbtn" onclick="event.stopPropagation();FFPConnFeed.connect(\'' + attr(u.id) + '\',\'none\',\'' + attr(u.name) + '\',this)">Add</button>';
    var av = u.photo
      ? '<div style="width:40px;height:40px;border-radius:50%;flex-shrink:0;background:#214b6b center/cover no-repeat;background-image:url(\'' + esc(u.photo) + '\');"></div>'
      : '<div style="width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#214b6b;color:#cfe6f5;font-weight:800;">' + esc((u.name || 'M').charAt(0).toUpperCase()) + '</div>';
    return '<div class="cf-row" onclick="FFPConnFeed.openCard(\'' + attr(u.id) + '\')">' + av +
      '<div class="cf-rtxt"><div class="cf-rt"><b>' + esc(u.name || 'Member') + '</b></div>' +
      (u.city ? '<div class="cf-rs">' + esc(u.city) + '</div>' : '') + '</div>' + btn + '</div>';
  }
  var _searchT = null;
  async function doSearch(q) {
    var box = document.getElementById('cf-search-results'); if (!box) return;
    q = (q || '').trim();
    if (q.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var me = memberId(); if (!me || !window.supabase) { box.style.display = 'none'; return; }
    box.style.display = 'block'; box.innerHTML = '<div class="cf-empty">Searching…</div>';
    try {
      var r = await window.supabase.rpc('member_search_passport', { p_me: me, p_q: q });
      var list = (r && r.data) || [];
      box.innerHTML = list.length ? list.map(searchRow).join('') : '<div class="cf-empty">No one found for “' + esc(q) + '”.</div>';
    } catch (e) { box.innerHTML = '<div class="cf-empty">Couldn’t search right now.</div>'; }
  }

  // ── Selected connection's recent activities (horizontal slider) ──
  function actIcon(name) { try { return (window.ffpActivityIcon ? window.ffpActivityIcon(name) : 'fitness_center'); } catch (e) { return 'fitness_center'; } }
  function actCard(a) {
    var bg = a.photo_url ? "background-image:url('" + esc(a.photo_url) + "');" : '';
    var stat = (a.distance_km && a.distance_km > 0) ? (Math.round(a.distance_km * 10) / 10) + ' km' : ((a.duration_min || 0) ? (a.duration_min + ' min') : '');
    var d = a.logged_at ? new Date(a.logged_at).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '';
    return '<div class="cf-acard" onclick="FFPConnFeed.openActivity(\'' + attr(a.id) + '\')">' +
      '<div class="cf-acard-img" style="' + bg + '">' + (a.photo_url ? '' : '<span class="material-icons">' + esc(actIcon(a.activity)) + '</span>') + '</div>' +
      '<div class="cf-acard-b"><div class="cf-acard-t">' + esc(a.activity || 'Activity') + '</div>' +
      '<div class="cf-acard-s">' + esc([stat, d].filter(Boolean).join(' · ')) + '</div></div></div>';
  }
  // Stats strip — the connection's streak, journey totals and top disciplines.
  function connStatsHtml(d, first) {
    var tile = function (n, l) { return '<div class="cf-jcell"><div class="cf-jn">' + (n != null ? n : 0) + '</div><div class="cf-jl">' + l + '</div></div>'; };
    var html = '<div class="cf-stats">';
    if (d.streak && d.streak > 0) {
      html += '<div class="cf-jstreak"><span class="material-icons">local_fire_department</span>' +
        '<b>' + d.streak + '</b><span>day streak</span></div>';
    }
    html += '<div class="cf-jlabel">' + first + '’s journey this week</div>';
    html += '<div class="cf-jgrid">' +
      tile(d.countries, 'Countries') + tile(d.cities, 'Cities') + tile(d.days, 'Days') + tile(d.hours, 'Hours') +
      tile(d.connections, 'Connections') + tile(d.activities, 'Activities') + tile(d.meets, 'Meets') + tile(d.providers, 'Providers') +
    '</div></div>';
    return html;
  }
  async function loadConnStats(id, name) {
    var host = document.getElementById('cf-conn-stats'); if (!host) return;
    var me = memberId(); if (!me || !window.supabase) { host.innerHTML = ''; return; }
    var first = esc(String(name || 'Member').split(' ')[0]);
    try {
      var r = await window.supabase.rpc('member_connection_profile', { p_me: me, p_other: id });
      var d = (r && r.data) || {};
      host.innerHTML = (d && d.connected !== false) ? connStatsHtml(d, first) : '';
    } catch (e) { host.innerHTML = ''; }
  }
  async function renderActivities(id, name) {
    var host = document.getElementById('cf-person-activities'); if (!host) return;
    var first = esc(String(name || 'Member').split(' ')[0]);
    var head = '<div class="cf-sec-head" style="margin-bottom:8px;"><div class="cf-sec-t">' + first + '’s Passport</div>' +
      '<div class="cf-sec-link" onclick="FFPConnFeed.openCard(\'' + attr(id) + '\')">View passport</div></div>';
    var actlbl = '<div class="cf-actlbl">Latest activities</div>';
    host.innerHTML = head + '<div id="cf-conn-stats"></div>' + actlbl + '<div class="cf-empty">Loading…</div>';
    var me = memberId(); if (!me || !window.supabase) { host.innerHTML = ''; return; }
    try {
      var r = await window.supabase.rpc('member_connection_activities', { p_me: me, p_other: id, p_limit: 12 });
      var list = (r && r.data) || [];
      host.innerHTML = head + '<div id="cf-conn-stats"></div>' + actlbl +
        (list.length ? '<div class="cf-acts">' + list.map(actCard).join('') + '</div>' : '<div class="cf-empty">No shared activities yet.</div>');
    } catch (e) { host.innerHTML = head + '<div id="cf-conn-stats"></div>' + actlbl + '<div class="cf-empty">Couldn’t load activities.</div>'; }
    loadConnStats(id, name);
  }

  window.FFPConnFeed = {
    search: function (v) { clearTimeout(_searchT); _searchT = setTimeout(function () { doSearch(v); }, 280); },
    connect: async function (id, status, name, btn) {
      var me = memberId(); if (!me || !window.supabase || !id) return;
      try {
        if (status === 'incoming') {
          var up = await window.supabase.from('member_connections').update({ status: 'accepted' }).eq('requester_id', id).eq('addressee_id', me);
          if (up.error) throw up.error;
          if (btn) { btn.textContent = '✓ Connected'; btn.disabled = true; btn.className = 'cf-cbtn done'; }
          if (window.showToast) showToast('You’re connected with ' + String(name || 'them').split(' ')[0], 'success');
        } else {
          var ins = await window.supabase.from('member_connections').insert({ requester_id: me, addressee_id: id, status: 'pending' });
          if (ins.error) throw ins.error;
          if (btn) { btn.textContent = 'Requested'; btn.disabled = true; btn.className = 'cf-cbtn done'; }
          if (window.showToast) showToast('Request sent to ' + String(name || 'them').split(' ')[0], 'success');
        }
      } catch (e) { if (window.showToast) showToast('Could not send — try again', 'error'); }
    },
    openSearch: function () {
      var body = '<div class="cv-wrap"><h3 class="q-title">Find a connection</h3>' +
        '<input id="cf-search" class="cf-search" placeholder="Search Find Fit People members…" autocomplete="off" oninput="FFPConnFeed.search(this.value)">' +
        '<div id="cf-search-results" style="min-height:60px;"></div></div>';
      if (typeof openDetailModal === 'function') openDetailModal(body);
      setTimeout(function () { var i = document.getElementById('cf-search'); if (i) { try { i.focus(); } catch (e) {} } }, 60);
    },
    selectPerson: function (id, name) {
      try { var cells = document.querySelectorAll('.cf-cell'); for (var i = 0; i < cells.length; i++) cells[i].classList.remove('sel'); var sel = document.getElementById('cf-cell-' + id); if (sel) sel.classList.add('sel'); } catch (e) {}
      renderActivities(id, name);
    },
    openActivity: function (id) { try { if (window.ffpViewSharedActivity) window.ffpViewSharedActivity(id); else this.openCard(id); } catch (e) {} },
    render: load,
    reload: load,
    discover: function () { try { if (window.MeetMove && MeetMove.openMatchesGrid) MeetMove.openMatchesGrid(); } catch (e) {} },
    seeAll: function () { try { if (window.CollectionView && CollectionView.open) CollectionView.open(); } catch (e) {} },
    openCard: function (id) { try { if (window.CollectionView && CollectionView.openPerson) CollectionView.openPerson(id); } catch (e) {} },
    congratulate: async function (toId, metric, rowEl) {
      var me = memberId(); if (!me || !window.supabase || !toId) return;
      try {
        var r = await window.supabase.rpc('member_congratulate', { p_me: me, p_to: toId, p_metric: metric || '' });
        if (r.error) throw r.error;
        if (rowEl) rowEl.style.opacity = '0.55';
        if (window.showToast) showToast('Congratulations sent', 'success');
      } catch (e) { console.warn('[FFP ConnFeed] congrats', e); if (window.showToast) showToast('Could not send — try again', 'error'); }
    },
    tap: function (type, link, rowEl) {
      try {
        var id = (link && link.indexOf(':') >= 0) ? link.split(':')[1] : '';
        if (type === 'pr') { var parts = (link || '').split(':'); this.congratulate(parts[1], parts.slice(2).join(':'), rowEl); return; }
        if (type === 'meetup') { goPanel('panel-meetups'); setTimeout(function () { try { if (window.MeetMove && MeetMove.openMeetupDetail) MeetMove.openMeetupDetail(id); } catch (e) {} }, 250); return; }
        if (type === 'challenge') { goPanel('panel-challenges'); setTimeout(function () { try { if (window.Challenges && Challenges.openDetail) Challenges.openDetail(id); } catch (e) {} }, 250); return; }
        if (type === 'activity') { if (window.ffpViewSharedActivity) window.ffpViewSharedActivity(id); else this.openCard(id); return; }
        if (type === 'birthday') { this.openCard(id); return; }
        if (type === 'connection') { this.openCard(id); return; }   // → their passport in Connections
        if (type === 'notif') {
          if (!link) return;
          // Reuse the bell's router so a notification opens its REAL target (activity card, meetup, panel, URL).
          if (window.ffpHandleNotifClick) { window.ffpHandleNotifClick(link); return; }
          if (/^https?:/i.test(link)) { window.open(link, '_blank'); return; }
          var l = link.toLowerCase();
          if (l.indexOf('challenge') >= 0) goPanel('panel-challenges');
          else if (l.indexOf('quest') >= 0) goPanel('panel-quests');
          else if (l.indexOf('meet') >= 0) goPanel('panel-meetups');
        }
      } catch (e) {}
    }
  };
  window.ffpReloadConnFeed = load;

  function init() {
    injectStyles();
    var btn = document.querySelector('.nav-item[data-panel="panel-meet"]');
    if (btn && !btn._cfHooked) { btn._cfHooked = true; btn.addEventListener('click', function () { tries = 0; setTimeout(load, 60); }); }
    load();   // eager: render now (content sits in the hidden panel until opened) so it's never stuck on the skeleton
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

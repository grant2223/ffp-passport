/* FFP Club Competition — member Passport experience (window.FFPClubQuest) — v1 (2026-07-08)
   A quest flagged is_club_competition ranks CLUBS (= pro_teams) by their members' quest points.
   Full-bleed overlay (NO modal box), Apple/WHOOP standard: hairlines + big numerals, NO pills, NO scrollbars.
   Flow: feature card (Quest panel) → open(questId,opts) → leaderboard (standing-led) → openClub(teamId) → club home.
   Data: club_leaderboard(p_quest,p_metric,p_min_members) + club_detail(p_quest,p_team,p_min) + member_my_teams (to mark "you").
   API: FFPClubQuest.open(questId, { title, metric:'avg'|'total'|'division', minMembers:10 }). */
(function () {
  'use strict';
  var W = window;
  function sb() { return W.supabase; }
  function memberId() { try { if (W.FFPAuth && FFPAuth.getMember) { var m = FFPAuth.getMember(); if (m && m.id) return m.id; } } catch (e) {} try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}')).id || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function initials(n) { n = String(n || '').trim(); if (!n) return 'M'; var p = n.split(/\s+/); return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  var S = (W._ffpCQ = W._ffpCQ || {});

  function injectStyles() {
    if (document.getElementById('ffp-cq-css')) return;
    var st = document.createElement('style'); st.id = 'ffp-cq-css';
    st.textContent =
      '#ffp-cq-ov{position:fixed;inset:0;z-index:6000;background:#0a1825;display:none;flex-direction:column;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;}' +
      '#ffp-cq-ov.on{display:flex;}' +
      '#ffp-cq-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}' +
      '#ffp-cq-body::-webkit-scrollbar{display:none;width:0;height:0;}' +
      '.cq-scroll{overflow-x:auto;scrollbar-width:none;}.cq-scroll::-webkit-scrollbar{display:none;height:0;}' +
      '.cq-wrap{max-width:620px;margin:0 auto;width:100%;box-sizing:border-box;}' +
      '.cq-row{display:flex;align-items:center;gap:16px;padding:15px 0;border-bottom:1px solid rgba(255,255,255,.07);cursor:pointer;}' +
      '.cq-tap{color:#5f7688;font-size:11.5px;}';
    document.head.appendChild(st);
  }
  function ensureOverlay() {
    var ov = document.getElementById('ffp-cq-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'ffp-cq-ov';
      ov.innerHTML = '<div id="ffp-cq-body"></div>';
      document.body.appendChild(ov);
    }
    return ov;
  }
  function paint(html) { var b = document.getElementById('ffp-cq-body'); if (b) { b.innerHTML = '<div class="cq-wrap">' + html + '</div>'; b.scrollTop = 0; } }
  function metricLine(m) { return m === 'total' ? 'Ranked by total points' : (m === 'division' ? 'Ranked within size divisions' : 'Average points per active member — members count once they’ve logged'); }
  function scoreOf(row, m) { return m === 'total' ? Number(row.total_points || 0) : Number(row.avg_per_member || 0); }
  function scoreLabel(m) { return m === 'total' ? 'points' : 'avg / member'; }

  // ── World-class place badges (SVG): gold TROPHY for 1st, silver/bronze MEDAL for 2nd/3rd ──
  function medalDefs() {
    return '<svg width="0" height="0" style="position:absolute;" aria-hidden="true"><defs>' +
      '<radialGradient id="cqmg-gold" cx="38%" cy="30%" r="80%"><stop offset="0%" stop-color="#FFF1B8"/><stop offset="45%" stop-color="#F6C63C"/><stop offset="100%" stop-color="#B77E09"/></radialGradient>' +
      '<radialGradient id="cqmg-silver" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="45%" stop-color="#D6DCE2"/><stop offset="100%" stop-color="#8B96A1"/></radialGradient>' +
      '<radialGradient id="cqmg-bronze" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#F6D0A6"/><stop offset="45%" stop-color="#D28A4C"/><stop offset="100%" stop-color="#8E5220"/></radialGradient>' +
      '<linearGradient id="cqrim-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE58A"/><stop offset="100%" stop-color="#9A6800"/></linearGradient>' +
      '<linearGradient id="cqrim-silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F2F5F8"/><stop offset="100%" stop-color="#79838E"/></linearGradient>' +
      '<linearGradient id="cqrim-bronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#EEBB86"/><stop offset="100%" stop-color="#7C4718"/></linearGradient>' +
      '</defs></svg>';
  }
  function medalSvg(rank, size) {
    var s = 'width="' + (size || 30) + '" height="' + (size || 30) + '" viewBox="0 0 64 64"';
    if (rank === 1) {
      return '<svg ' + s + ' style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));" aria-hidden="true">' +
        '<path d="M14 15 C6 15 6 29 19 31" fill="none" stroke="url(#cqrim-gold)" stroke-width="3.6"/>' +
        '<path d="M50 15 C58 15 58 29 45 31" fill="none" stroke="url(#cqrim-gold)" stroke-width="3.6"/>' +
        '<path d="M17 12 H47 V21 C47 32 40.5 39 32 39 C23.5 39 17 32 17 21 Z" fill="url(#cqmg-gold)" stroke="url(#cqrim-gold)" stroke-width="1.4"/>' +
        '<rect x="29.3" y="39" width="5.4" height="8" fill="url(#cqrim-gold)"/>' +
        '<rect x="22" y="47" width="20" height="4" rx="1.5" fill="url(#cqmg-gold)"/>' +
        '<rect x="18.5" y="51.5" width="27" height="5.5" rx="2.4" fill="url(#cqrim-gold)"/>' +
        '<path d="M23 16 C22 24 24.5 32 30 35.5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-linecap="round"/></svg>';
    }
    var mg = rank === 2 ? 'silver' : 'bronze', num = rank === 2 ? '#5A646E' : '#5E3413';
    return '<svg ' + s + ' aria-hidden="true">' +
      '<circle cx="32" cy="32" r="26" fill="#0a1825"/>' +
      '<circle cx="32" cy="32" r="26" fill="url(#cqrim-' + mg + ')"/>' +
      '<circle cx="32" cy="32" r="21.5" fill="url(#cqmg-' + mg + ')"/>' +
      '<path d="M32 12.5 A19.5 19.5 0 0 1 51.5 32" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2" stroke-linecap="round"/>' +
      '<text x="32" y="41" text-anchor="middle" font-size="26" font-weight="800" fill="' + num + '" font-family="system-ui">' + rank + '</text></svg>';
  }
  // Podium for the top 3 (2nd | 1st | 3rd), each tappable → its club. Only when 3+ qualified clubs (non-division metric).
  function podiumHtml(rows) {
    var top = rows.filter(function (x) { return x.qualified !== false; }).slice(0, 3);
    if (top.length < 3) return '';
    var order = [top[1], top[0], top[2]], H = [46, 66, 34], SZ = [52, 60, 52], BZ = [30, 40, 30], RK = [2, 1, 3];
    var cells = order.map(function (x, i) {
      var lg = x.logo
        ? '<div style="width:' + SZ[i] + 'px;height:' + SZ[i] + 'px;border-radius:' + (i === 1 ? 17 : 15) + 'px;background:#12314a center/cover no-repeat;background-image:url(\'' + esc(x.logo) + '\');margin:0 auto;"></div>'
        : '<div style="width:' + SZ[i] + 'px;height:' + SZ[i] + 'px;border-radius:' + (i === 1 ? 17 : 15) + 'px;background:#12314a;display:flex;align-items:center;justify-content:center;color:#2ba8e0;font-weight:700;margin:0 auto;">' + esc(initials(x.name)) + '</div>';
      var val = Math.round(scoreOf(x, S.metric) * 10) / 10;
      return '<div style="flex:1;text-align:center;cursor:pointer;min-width:0;" onclick="FFPClubQuest.openClub(\'' + x.team_id + '\')">' +
        '<div style="position:relative;width:' + SZ[i] + 'px;margin:0 auto;">' + lg +
          '<div style="position:absolute;bottom:-' + (BZ[i] / 2 - 4) + 'px;left:50%;transform:translateX(-50%);">' + medalSvg(RK[i], BZ[i]) + '</div></div>' +
        '<div style="font-size:' + (i === 1 ? 13 : 12.5) + 'px;font-weight:600;color:#f2f7fb;margin-top:' + (i === 1 ? 22 : 16) + 'px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(x.name) + '</div>' +
        '<div style="font-size:' + (i === 1 ? 17 : 15) + 'px;font-weight:' + (i === 1 ? 800 : 700) + ';color:' + (i === 1 ? '#FFCC00' : '#fff') + ';">' + val + '</div>' +
        '<div style="height:' + H[i] + 'px;margin-top:8px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,' + (i === 1 ? '#2f3d2a' : '#26333f') + ',#151d26);"></div>' +
      '</div>';
    }).join('');
    return medalDefs() + '<div style="padding:16px 20px 0;"><div style="display:flex;align-items:flex-end;justify-content:center;gap:14px;">' + cells + '</div></div>';
  }

  // ── LEADERBOARD (standing-led) ──
  W.FFPClubQuest = W.FFPClubQuest || {};
  W.FFPClubQuest.open = function (questId, opts) {
    injectStyles(); var ov = ensureOverlay(); ov.classList.add('on');
    opts = opts || {};
    S.q = questId; S.metric = opts.metric || 'avg'; S.min = opts.minMembers || 10; S.title = opts.title || 'Most active club';
    paint('<div style="padding:40px 20px;color:#7fa0b8;font-weight:600;">Loading the leaderboard…</div>');
    renderLeaderboard();
  };
  W.FFPClubQuest.close = function () { var ov = document.getElementById('ffp-cq-ov'); if (ov) ov.classList.remove('on'); };

  async function renderLeaderboard() {
    var me = memberId(); if (!me || !sb()) { paint(bar('') + '<div style="padding:24px 20px;color:#9fc0d4;">Sign in to see the club competition.</div>'); return; }
    var rows = [], mine = {};
    try {
      var r = await sb().rpc('club_leaderboard', { p_quest: S.q, p_metric: S.metric, p_min_members: S.min });
      rows = (r && r.data) || [];
    } catch (e) { console.error('[FFP ClubQuest] leaderboard', e); }
    try { var rt = await sb().rpc('member_my_teams', { p_member: me }); ((rt && rt.data) || []).forEach(function (t) { mine[t.id] = 1; }); } catch (e) {}
    S.rows = rows; S.mineMap = mine; S.shown = 50; S.filter = '';
    paintBoard();
  }
  // Search + Load-More are client-side updates that touch ONLY the list container, so the search box keeps focus.
  W.FFPClubQuest.filter = function (v) { S.filter = String(v || ''); S.shown = 50; var el = document.getElementById('cq-list-wrap'); if (el) el.innerHTML = listHtml(); };
  W.FFPClubQuest.more = function () { S.shown = (S.shown || 50) + 50; var el = document.getElementById('cq-list-wrap'); if (el) el.innerHTML = listHtml(); };

  function listHtml() {
    var rows = S.rows || [], mine = S.mineMap || {};
    // Podium owns the top 3 (when not searching); the list below is everyone else and is fully searchable.
    var searching = !!(S.filter && S.filter.trim());
    var pod = (S.metric !== 'division' && !searching) ? podiumHtml(rows) : '';
    var base = pod ? rows.filter(function (x) { return x.qualified === false || x.rank > 3; }) : rows;
    var f = (S.filter || '').trim().toLowerCase();
    var filtered = f ? base.filter(function (x) { return String(x.name || '').toLowerCase().indexOf(f) >= 0; }) : base;
    var total = filtered.length, shown = Math.min(S.shown || 50, total);
    var page = filtered.slice(0, shown);
    var list = page.map(function (x) {
      var you = !!mine[x.team_id];
      var val = Math.round(scoreOf(x, S.metric) * 10) / 10;
      var q = (x.qualified === false);
      var _lg = x.logo
        ? '<div style="width:40px;height:40px;border-radius:12px;flex:0 0 auto;background:#12314a center/cover no-repeat;background-image:url(\'' + esc(x.logo) + '\');"></div>'
        : '<div style="width:40px;height:40px;border-radius:12px;flex:0 0 auto;background:#12314a;display:flex;align-items:center;justify-content:center;color:#2ba8e0;font-weight:700;font-size:14px;">' + esc(String(x.name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()) + '</div>';
      return '<div class="cq-row" onclick="FFPClubQuest.openClub(\'' + x.team_id + '\')"' + (you ? ' style="border-left:2px solid #FFCC00;margin-left:-16px;padding-left:14px;"' : '') + '>' +
        '<div style="width:22px;text-align:center;font-size:18px;font-weight:' + (you ? '600' : '400') + ';color:' + (you ? '#FFCC00' : (q ? '#54697a' : '#8aa0b2')) + ';">' + (q ? '—' : x.rank) + '</div>' +
        _lg +
        '<div style="flex:1;min-width:0;"><div style="font-size:15.5px;font-weight:600;color:' + (you ? '#FFCC00' : '#f2f7fb') + ';">' + esc(x.name) + '</div>' +
        '<div style="font-size:12px;color:' + (you ? '#b79a4a' : '#6f8ba1') + ';margin-top:1px;">' + (you ? 'your club · ' : '') + (x.active_members || 0) + ' of ' + x.roster + ' active' + (q ? ' · needs ' + S.min + ' to qualify' : '') + '</div></div>' +
        '<div style="font-size:21px;font-weight:600;color:' + (you ? '#FFCC00' : (q ? '#54697a' : '#f2f7fb')) + ';">' + (q ? '—' : val) + '</div></div>';
    }).join('') || '<div style="padding:24px 20px;color:#9fc0d4;">' + (f ? 'No clubs match “' + esc(S.filter) + '”.' : 'No clubs yet. The first team to add members takes the lead.') + '</div>';
    var more = total > shown
      ? '<div onclick="FFPClubQuest.more()" style="margin:6px 0 2px;padding:13px;text-align:center;color:#2ba8e0;font-weight:600;font-size:14px;cursor:pointer;border-top:1px solid rgba(255,255,255,.07);">Show more (' + (total - shown) + ')</div>'
      : '';
    return '<div style="padding:14px 20px 2px;font-size:11.5px;color:#6f8ba1;">' + metricLine(S.metric) + (total > 50 ? ' · ' + total + ' clubs' : '') + '</div>' +
      '<div style="padding:0 20px 8px;">' + list + more + '</div>' +
      '<div style="padding:2px 20px 24px;" class="cq-tap">Tap a club to see who\'s driving it →</div>';
  }

  function paintBoard() {
    var rows = S.rows || [], mine = S.mineMap || {};
    var myRow = rows.filter(function (x) { return mine[x.team_id]; })[0] || null;
    var hero;
    if (myRow) {
      var beh = null; if (myRow.rank > 1) { var above = rows.filter(function (x) { return x.rank === myRow.rank - 1; })[0]; if (above) beh = Math.round((scoreOf(above, S.metric) - scoreOf(myRow, S.metric)) * 10) / 10; }
      hero = '<div style="position:relative;padding:18px 20px 20px;background:linear-gradient(160deg,#123a52 0%,#0b2233 60%,#0a1825 100%);">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#7fbfe0;font-weight:600;">' + esc(S.title) + '</div>' +
        '<span onclick="FFPClubQuest.close()" style="cursor:pointer;color:#9fc0d4;font-size:22px;line-height:1;">&times;</span></div>' +
        '<div style="display:flex;align-items:flex-end;gap:12px;margin-top:16px;">' +
        '<div style="font-size:52px;font-weight:600;color:#FFCC00;line-height:.9;letter-spacing:-2px;">' + (myRow.rank || '–') + '<span style="font-size:20px;">' + ord(myRow.rank) + '</span></div>' +
        '<div style="padding-bottom:5px;"><div style="font-size:16px;font-weight:600;color:#f2f7fb;">' + esc(myRow.name) + '</div>' +
        '<div style="font-size:12.5px;color:#9fc0d4;margin-top:2px;">of ' + rows.length + ' clubs</div></div></div>' +
        (beh != null && beh > 0 ? '<div style="font-size:13px;color:#dbe8f0;margin-top:14px;">' + beh + ' behind ' + (myRow.rank - 1) + (myRow.rank - 1 === 1 ? 'st' : (myRow.rank - 1 === 2 ? 'nd' : (myRow.rank - 1 === 3 ? 'rd' : 'th'))) + ' — one active day closes it.</div>' : (myRow.rank === 1 ? '<div style="font-size:13px;color:#37E0C6;margin-top:14px;">Leading the pack. Keep it up.</div>' : '')) +
        '</div>';
    } else {
      hero = '<div style="position:relative;padding:18px 20px 20px;background:linear-gradient(160deg,#123a52,#0a1825);">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;"><div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#7fbfe0;font-weight:600;">' + esc(S.title) + '</div><span onclick="FFPClubQuest.close()" style="cursor:pointer;color:#9fc0d4;font-size:22px;">&times;</span></div>' +
        '<div style="font-size:22px;font-weight:600;color:#f2f7fb;margin-top:14px;">Join a team to get involved</div>' +
        '<div style="font-size:13px;color:#9fc0d4;margin-top:6px;">Join a team, or create one in the FFP Pro app — then your activity counts for the club.</div></div>';
    }
    // Search box lives OUTSIDE #cq-list-wrap so it survives filter re-renders (keeps focus).
    var search = (rows.length > 8)
      ? '<div style="padding:12px 20px 2px;"><input id="cq-search" type="search" autocomplete="off" oninput="FFPClubQuest.filter(this.value)" value="' + esc(S.filter || '') + '" placeholder="Search clubs" style="width:100%;box-sizing:border-box;background:#0f2536;border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:11px 14px;color:#eaf2f8;font-size:14px;outline:none;"></div>'
      : '';
    paint(hero + search + '<div id="cq-list-wrap">' + listHtml() + '</div>');
  }
  function ord(n) { return n === 1 ? 'st' : (n === 2 ? 'nd' : (n === 3 ? 'rd' : 'th')); }
  function bar(t) { return '<div style="padding:16px 20px;"><span onclick="FFPClubQuest.close()" style="cursor:pointer;color:#9fc0d4;font-size:22px;">&times;</span> ' + esc(t) + '</div>'; }

  // ── CLUB HOME (tap a club) ──
  W.FFPClubQuest.openClub = async function (teamId) {
    paint('<div style="padding:40px 20px;color:#7fa0b8;font-weight:600;">Loading the club…</div>');
    var d = {};
    try { var r = await sb().rpc('club_detail', { p_quest: S.q, p_team: teamId, p_min_members: S.min }); d = (r && r.data) || {}; }
    catch (e) { console.error('[FFP ClubQuest] detail', e); }
    S.detail = d; S.statMode = 'week';
    renderClubHome();
  };
  W.FFPClubQuest.statMode = function (m) { S.statMode = m; var el = document.getElementById('cq-stats'); if (el) el.innerHTML = statsHtml(); var t = document.getElementById('cq-stat-tabs'); if (t) t.innerHTML = statTabs(); };

  function statTabs() {
    var m = S.statMode || 'week';
    return '<span onclick="FFPClubQuest.statMode(\'today\')" style="font-size:13px;font-weight:600;color:' + (m === 'today' ? '#f2f7fb' : '#6f8ba1') + ';padding-bottom:6px;' + (m === 'today' ? 'border-bottom:2px solid #FFCC00;' : '') + '">Today</span>' +
      '<span onclick="FFPClubQuest.statMode(\'week\')" style="font-size:13px;font-weight:' + (m === 'week' ? '600' : '400') + ';color:' + (m === 'week' ? '#f2f7fb' : '#6f8ba1') + ';padding-bottom:6px;' + (m === 'week' ? 'border-bottom:2px solid #FFCC00;' : '') + ';margin-left:20px;">This week</span>';
  }
  function statCell(n, l, first, accent) {
    return '<div style="flex:1;' + (first ? '' : 'padding-left:16px;border-left:1px solid rgba(255,255,255,.08);') + '"><div style="font-size:23px;font-weight:600;color:' + (accent || '#f2f7fb') + ';">' + n + '</div><div style="font-size:11px;color:#6f8ba1;margin-top:2px;">' + l + '</div></div>';
  }
  function statsHtml() {
    var d = S.detail || {}, m = S.statMode || 'week';
    if (m === 'today') {
      var t = d.today || {};
      return '<div style="display:flex;">' + statCell((t.active || 0) + '<span style="font-size:14px;color:#6f8ba1;">/' + (d.roster || 0) + '</span>', 'active today', true) + statCell(t.activities || 0, 'activities', false) + statCell('<span style="color:#37E0C6;">live</span>', 'right now', false) + '</div>';
    }
    var w = d.week || {};
    return '<div style="display:flex;">' + statCell((w.active || 0) + '<span style="font-size:14px;color:#6f8ba1;">/' + (d.roster || 0) + '</span>', 'active', true) + statCell(w.activities || 0, 'activities', false) + statCell((w.hours || 0) + '<span style="font-size:13px;color:#6f8ba1;">h</span>', 'moving', false) + '</div>' +
      '<div style="display:flex;margin-top:12px;">' + statCell((w.distance_km || 0) + '<span style="font-size:13px;color:#6f8ba1;">km</span>', 'distance', true) + statCell(Math.round((w.calories || 0) / 1000) + '<span style="font-size:13px;color:#6f8ba1;">k</span>', 'calories', false) + statCell(d.rank || '–', 'club rank', false, '#FFCC00') + '</div>';
  }
  function momentumSvg(series) {
    series = series || []; if (series.length < 2) return '<div style="padding:0 4px;font-size:12px;color:#6f8ba1;">Not enough history yet.</div>';
    var max = Math.max.apply(null, series.map(function (p) { return Number(p.cum || 0); }).concat([1]));
    var n = series.length, x0 = 34, x1 = 294, y0 = 120, y1 = 14;
    var pts = series.map(function (p, i) { var x = x0 + (x1 - x0) * (n === 1 ? 0 : i / (n - 1)); var y = y0 - (y0 - y1) * (Number(p.cum || 0) / max); return x.toFixed(1) + ',' + y.toFixed(1); }).join(' ');
    var last = series[n - 1], lx = x1, ly = y0 - (y0 - y1) * (Number(last.cum || 0) / max);
    function lbl(v) { return v >= 1000 ? (Math.round(v / 100) / 10) + 'k' : Math.round(v); }
    var d0 = series[0].d, dl = series[n - 1].d;
    return '<svg viewBox="0 0 300 150" style="width:100%;height:auto;display:block;" xmlns="http://www.w3.org/2000/svg">' +
      '<line x1="34" y1="14" x2="34" y2="120" stroke="rgba(255,255,255,.12)" stroke-width="1"/>' +
      '<line x1="34" y1="120" x2="294" y2="120" stroke="rgba(255,255,255,.12)" stroke-width="1"/>' +
      '<line x1="34" y1="67" x2="294" y2="67" stroke="rgba(255,255,255,.06)" stroke-width="1"/>' +
      '<text x="28" y="123" text-anchor="end" font-size="9" fill="#5f7688" font-family="system-ui">0</text>' +
      '<text x="28" y="70" text-anchor="end" font-size="9" fill="#5f7688" font-family="system-ui">' + lbl(max / 2) + '</text>' +
      '<text x="28" y="18" text-anchor="end" font-size="9" fill="#5f7688" font-family="system-ui">' + lbl(max) + '</text>' +
      '<polyline points="' + pts + '" fill="none" stroke="#37E0C6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="3.5" fill="#37E0C6"/>' +
      '<text x="34" y="134" text-anchor="middle" font-size="9" fill="#5f7688" font-family="system-ui">' + esc(fmtD(d0)) + '</text>' +
      '<text x="294" y="134" text-anchor="end" font-size="9" fill="#5f7688" font-family="system-ui">today</text></svg>';
  }
  function fmtD(s) { try { var d = new Date(s); return d.toLocaleDateString([], { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function sectionHead(t, right) { return '<div style="padding:18px 20px 6px;display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#6f8ba1;font-weight:600;">' + t + '</span>' + (right ? '<span style="font-size:12px;color:#37E0C6;">' + right + '</span>' : '') + '</div>'; }

  function sourceBars(src) {
    src = (src || []).filter(function (s) { return s.source !== 'Other'; });
    if (!src.length) return '';
    var max = Math.max.apply(null, src.map(function (s) { return Number(s.points || 0); }).concat([1]));
    return sectionHead('Where the points come from') + '<div style="padding:2px 20px 4px;">' + src.slice(0, 6).map(function (s) {
      var w = Math.max(4, Math.round(Number(s.points || 0) * 100 / max));
      return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:11px;"><span style="width:76px;font-size:12.5px;color:#cfe2ee;">' + esc(s.source) + '</span>' +
        '<div style="flex:1;height:20px;border-radius:5px;background:rgba(255,255,255,.06);overflow:hidden;"><div style="width:' + w + '%;height:100%;background:linear-gradient(90deg,#2ba8e0,#1d6a8f);"></div></div>' +
        '<span style="width:38px;text-align:right;font-size:13px;font-weight:600;color:#f2f7fb;">' + Math.round(s.points) + '</span></div>';
    }).join('') + '<div style="font-size:11px;color:#5f7688;margin-top:4px;">Meet-ups and referrals are worth the most per action.</div></div>';
  }
  function contributors(members) {
    var top = (members || []).slice(0, 3);
    if (!top.length) return '';
    return sectionHead('Carrying the club') + '<div style="padding:0 20px 2px;">' + top.map(function (p, i) {
      return '<div style="display:flex;align-items:center;gap:13px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.07);">' +
        '<span style="font-size:13px;color:#8aa0b2;width:12px;">' + (i + 1) + '</span>' + avatar(p, 34) +
        '<div style="flex:1;font-size:14px;font-weight:500;color:#f2f7fb;">' + esc(p.name || 'Member') + '</div>' +
        '<div style="font-size:15px;font-weight:600;color:#f2f7fb;">' + Math.round(p.points || 0) + '</div></div>';
    }).join('') + '</div>';
  }
  function avatar(p, sz) {
    var st = 'width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;font-size:' + Math.round(sz * 0.38) + 'px;font-weight:600;background:#214b6b;color:#cfe6f5;overflow:hidden;background-size:cover;background-position:center;';
    if (p && p.photo) return '<span style="' + st + 'background-image:url(\'' + esc(p.photo) + '\');"></span>';
    return '<span style="' + st + '">' + esc(initials(p && p.name)) + '</span>';
  }
  function memberBars(members, avg) {
    var ms = (members || []).slice().sort(function (a, b) { return (b.points || 0) - (a.points || 0); });
    if (!ms.length) return '';
    var me = memberId();
    var max = Math.max.apply(null, ms.map(function (m) { return Number(m.points || 0); }).concat([1]));
    var baseY = 125, topY = 15, span = baseY - topY;
    var avgY = baseY - span * (Math.min(avg || 0, max) / max);
    var bw = 10, gap = 5.5, startX = 8;
    var width = Math.max(300, startX + ms.length * (bw + gap));
    var bars = ms.map(function (m, i) {
      var h = Math.max(3, Math.round(span * (Number(m.points || 0) / max)));
      var x = startX + i * (bw + gap), y = baseY - h;
      var you = m.member_id === me;
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw + '" height="' + h + '" rx="2" fill="' + (you ? '#FFCC00' : (y < avgY ? '#2ba8e0' : '#3f7ea0')) + '"/>' +
        (you ? '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#FFCC00" font-family="system-ui">You</text>' : '');
    }).join('');
    return sectionHead('Every member · points') + '<div style="padding:0 16px 4px;"><div class="cq-scroll"><svg viewBox="0 0 ' + width + ' 150" style="width:100%;min-width:' + (ms.length > 20 ? width : 0) + 'px;height:auto;display:block;" xmlns="http://www.w3.org/2000/svg">' +
      '<line x1="4" y1="' + avgY.toFixed(1) + '" x2="' + (width - 8) + '" y2="' + avgY.toFixed(1) + '" stroke="#37E0C6" stroke-width="1.2" stroke-dasharray="4 3" opacity=".8"/>' +
      '<text x="' + (width - 6) + '" y="' + (avgY - 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="#37E0C6" font-family="system-ui">avg ' + (Math.round((avg || 0) * 10) / 10) + '</text>' +
      bars + '<line x1="4" y1="125" x2="' + (width - 8) + '" y2="125" stroke="rgba(255,255,255,.12)" stroke-width="1"/></svg></div>' +
      '<div style="font-size:11px;color:#5f7688;margin-top:8px;padding:0 4px;">Bars above the line beat the club average.</div></div>';
  }

  function renderClubHome() {
    var d = S.detail || {};
    // Header banner = the team's cover photo (if set) under a dark scrim, else the brand gradient.
    var _coverBg = d.cover
      ? "linear-gradient(180deg,rgba(8,20,32,0.28),rgba(10,24,37,0.88)),url('" + esc(d.cover) + "')"
      : "linear-gradient(160deg,#123a52 0%,#0b2233 62%,#0a1825 100%)";
    var hero = '<div style="position:relative;padding:16px 20px 18px;background:' + _coverBg + ';background-size:cover;background-position:center;">' +
      '<div style="position:relative;"><div style="display:flex;align-items:center;gap:6px;color:#9fc0d4;font-size:13px;margin-bottom:14px;"><span onclick="renderCQBack()" style="cursor:pointer;font-size:18px;">&lsaquo;</span> <span onclick="renderCQBack()" style="cursor:pointer;">Leaderboard</span></div>' +
      '<div style="display:flex;align-items:center;gap:14px;">' + avatarSquare(d) +
      '<div style="flex:1;min-width:0;"><div style="font-size:19px;font-weight:600;color:#f2f7fb;">' + esc(d.name || 'Club') + '</div>' +
      '<div style="font-size:12.5px;color:#9fc0d4;margin-top:2px;">' + esc(d.sport || 'Club') + ' · ' + (d.active_members || 0) + ' of ' + (d.roster || 0) + ' active</div></div></div>' +
      '<div style="display:flex;align-items:flex-end;gap:11px;margin-top:16px;">' +
      '<div style="font-size:40px;font-weight:600;color:#FFCC00;line-height:.9;letter-spacing:-1px;">' + (d.rank || '–') + '<span style="font-size:16px;">' + ord(d.rank) + '</span></div>' +
      '<div style="padding-bottom:4px;font-size:12.5px;color:#cfe2ee;">' + (d.avg_per_member != null ? d.avg_per_member + ' avg / active member' : '') + (d.behind_next != null && d.behind_next > 0 ? '<br>' + d.behind_next + ' behind the club above' : '') + '</div></div>' +
      '</div></div>';

    paint(hero +
      '<div style="padding:16px 20px 0;"><div id="cq-stat-tabs" style="display:flex;margin-bottom:16px;">' + statTabs() + '</div><div id="cq-stats">' + statsHtml() + '</div></div>' +
      '<div style="height:1px;background:rgba(255,255,255,.08);margin:16px 20px 0;"></div>' +
      sectionHead('Momentum') + '<div style="padding:0 16px;">' + momentumSvg(d.momentum) + '</div>' +
      '<div style="height:1px;background:rgba(255,255,255,.08);margin:14px 20px 0;"></div>' +
      sourceBars(d.source) +
      '<div style="height:1px;background:rgba(255,255,255,.08);margin:8px 20px 0;"></div>' +
      contributors(d.members) +
      memberBars(d.members, d.avg_per_member) +
      '<div style="height:24px;"></div>');
  }
  W.renderCQBack = function () { renderLeaderboard(); };
  function avatarSquare(d) {
    var st = 'width:52px;height:52px;border-radius:15px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:16px;background:#12314a;color:#2ba8e0;overflow:hidden;background-size:cover;background-position:center;';
    if (d && d.logo) return '<div style="' + st + 'background-image:url(\'' + esc(d.logo) + '\');"></div>';
    return '<div style="' + st + '">' + esc(initials(d && d.name)) + '</div>';
  }
})();

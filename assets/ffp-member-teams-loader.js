/* FFP Member Teams Loader — v1 (2026-07-06)
   The Passport (member) side of Teams. Renders the "Your teams" carousel into the
   Community panel (#cf-teams, injected by ffp-connections-feed-loader.js) and a
   FULL-SCREEN detail overlay (member-app convention: fixed inset:0, solid bg) with
   the member's own standing + squad leaderboard.
   Data: member_my_teams(p_member) / member_team_detail(p_member,p_team,p_bench)
   (SECURITY DEFINER; member reads only their own standing). Additive: renders
   nothing when the member is on no team. window.FFPMemberTeams. */
(function () {
  'use strict';
  var W = window;
  function esc(s) { return (typeof W.escHtml === 'function') ? W.escHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function memberId() { try { if (W.FFPAuth && FFPAuth.getMember) { var m = FFPAuth.getMember(); if (m && m.id) return m.id; } } catch (e) {} try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}')).id || ''; } catch (e) { return ''; } }
  function sb() { return W.supabase; }
  function initials(n) { var p = (n || '').trim().split(/\s+/); return (((p[0] || '')[0] || '') + ((p[1] || '')[0] || '')).toUpperCase(); }
  function lowerBetter(d) { return /^(lower|down|less|desc|faster)$/i.test(d || ''); }
  var SPECTRUM = ['#e24b4a', '#f0932b', '#37b06a', '#2ba8e0', '#8b5cf6'];
  function fmtVal(v, u) { if (v == null || v === '') return '—'; v = Number(v); if (u && /^s/i.test(u)) { var s = Math.round(v), m = Math.floor(s / 60), ss = s % 60; return m + ':' + (ss < 10 ? '0' : '') + ss; } return (Math.round(v * 10) / 10) + (u ? ' ' + esc(u) : ''); }
  function fmtGap(a, b, u) { var d = Math.abs(Number(a) - Number(b)); if (u && /^s/i.test(u)) return Math.round(d) + 's'; return (Math.round(d * 10) / 10) + (u ? ' ' + esc(u) : ''); }

  function injectStyles() {
    if (document.getElementById('ffp-mt-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-mt-css';
    s.textContent = [
      '.mt-head{display:flex;align-items:center;justify-content:space-between;margin:2px 0 11px;}',
      '.mt-h{font-size:16px;font-weight:800;color:var(--text,#e8eef4);}',
      '.mt-link{font-size:13px;font-weight:800;color:var(--yellow,#FFCC00);cursor:pointer;}',
      '.mt-car{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;padding-bottom:4px;margin:0 -2px 6px;}.mt-car::-webkit-scrollbar{display:none;}',
      '.mt-card{flex:0 0 auto;width:270px;border-radius:16px;overflow:hidden;background:#11283c;border:1px solid rgba(255,255,255,.07);cursor:pointer;}',
      '.mt-cover{height:92px;position:relative;display:flex;align-items:flex-end;padding:12px;}',
      '.mt-cover:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,18,26,0) 30%,rgba(6,18,26,.72) 100%);}',
      '.mt-cov-in{position:relative;z-index:2;display:flex;align-items:center;gap:10px;}',
      '.mt-crest{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px;flex:0 0 auto;border:1.5px solid rgba(255,255,255,.35);background-size:cover;background-position:center;}',
      '.mt-tn{font-size:15px;font-weight:800;color:#fff;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px;}',
      '.mt-ts{font-size:10.5px;color:rgba(255,255,255,.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px;}',
      '.mt-mv{position:absolute;top:10px;right:10px;background:rgba(0,0,0,.35);font-size:11px;font-weight:800;padding:3px 9px;border-radius:100px;z-index:2;}',
      '.mt-foot{display:flex;align-items:center;gap:8px;padding:10px 13px;}',
      '.mt-av{width:25px;height:25px;border-radius:50%;background:#214b6b;color:#cfe6f5;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;border:2px solid #11283c;background-size:cover;background-position:center;flex:0 0 auto;}',
      '.mt-active{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--muted,#8a99a8);white-space:nowrap;}',
      '.mt-dot{width:7px;height:7px;border-radius:50%;background:#36c97f;}',
      // overlay
      '#ffp-mt-ov{position:fixed;inset:0;z-index:100050;background:#0a1825;display:none;flex-direction:column;font-family:inherit;}',
      '#ffp-mt-ov.on{display:flex;}',
      '.mt-ovhead{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.07);flex:0 0 auto;}',
      '.mt-ovhead .x{color:var(--muted,#8a99a8);font-size:24px;cursor:pointer;}',
      '.mt-ovbody{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px;max-width:620px;width:100%;margin:0 auto;box-sizing:border-box;}',
      '.mt-dcard{background:#11283c;border:1px solid rgba(255,255,255,.06);border-radius:14px;}',
      '.mt-pill{border-radius:16px;padding:5px 13px;font-size:11px;font-weight:700;background:rgba(255,255,255,.08);color:var(--muted,#8a99a8);flex:0 0 auto;cursor:pointer;border:none;font-family:inherit;}',
      '.mt-pill.on{background:var(--yellow,#FFCC00);color:#0a1a24;font-weight:800;}',
      '.mt-seg{display:flex;gap:3px;}.mt-seg div{flex:1;height:9px;border-radius:3px;}',
      '.mt-tile{flex:1;background:#11283c;border-radius:12px;padding:12px 6px;text-align:center;}',
      '.mt-tv{font-size:20px;font-weight:900;color:var(--text,#e8eef4);line-height:1;}',
      '.mt-tl{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;color:var(--muted,#8a99a8);margin-top:4px;}',
      '.mt-lb{display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:10px;}',
      '.mt-lbav{width:32px;height:32px;border-radius:50%;background:#214b6b;color:#cfe6f5;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:0 0 auto;background-size:cover;background-position:center;}',
      '.mt-rk{width:20px;text-align:center;font-size:12px;font-weight:800;color:var(--muted,#8a99a8);flex:0 0 auto;}'
    ].join('');
    document.head.appendChild(s);
  }

  function faceStyle(a, size) {
    var st = a && a.photo ? ('background-image:url(\'' + esc(a.photo) + '\');') : '';
    return st;
  }

  // ── carousel ──
  async function renderCarousel(host) {
    if (!host) return;
    injectStyles();
    var mid = memberId();
    var teams = [];
    if (mid && sb()) {
      try { var r = await sb().rpc('member_my_teams', { p_member: mid }); teams = (r && r.data) || []; }
      catch (e) { console.error('[FFP MyTeams] list', e); teams = []; }  // fall through to the "Join your team" card, never blank
    }
    // NEVER blank — with no member/session or no teams we still show the "Join your team" card so the section is always visible.
    W._ffpMyTeams = teams;
    if (!teams.length) {
      host.innerHTML = '<div class="mt-head"><div class="mt-h">Your teams</div></div>' +
        '<div class="mt-car">' +
          '<div onclick="FFPMemberTeams.openFind()" style="flex:0 0 auto;width:150px;box-sizing:border-box;background:#11283c;border:1.5px dashed rgba(255,255,255,.2);border-radius:13px;padding:16px 12px 15px;text-align:center;cursor:pointer;">' +
            '<div style="position:relative;width:52px;height:52px;margin:0 auto 11px;display:flex;align-items:center;justify-content:center;">' +
              '<span class="material-icons" style="position:absolute;font-size:44px;color:rgba(43,168,224,.13);">shield</span>' +
              '<div style="position:relative;width:44px;height:44px;border-radius:50%;border:2px dashed rgba(255,255,255,.32);display:flex;align-items:center;justify-content:center;">' +
                '<span class="material-icons" style="color:var(--yellow,#FFCC00);font-size:26px;">add</span></div>' +
            '</div>' +
            '<div style="font-size:12.5px;font-weight:800;color:var(--text,#e8eef4);">Join your team</div>' +
            '<div style="font-size:10.5px;color:var(--muted,#8a99a8);margin-top:3px;line-height:1.3;">Tap to find your team</div>' +
          '</div>' +
        '</div>';
      return;
    }
    host.innerHTML = '<div class="mt-head"><div class="mt-h">Your teams</div><div class="mt-link" onclick="FFPMemberTeams.openFind()">Find a team</div></div>' +
      '<div class="mt-car">' + teams.map(card).join('') + '</div>';
  }

  function card(t) {
    var mk = t.mark || {}, traj = mk.trajectory || 'flat';
    var mvCol = traj === 'up' ? '#36c97f' : (traj === 'down' ? '#e24b4a' : '#FFCC00');
    var mvTxt = mk.rank ? ((traj === 'up' ? '↑ improving' : (traj === 'down' ? '↓ slipping' : '— holding'))) : '';
    var avs = (t.avatars || []).slice(0, 3);
    var faces = avs.map(function (a, i) { return '<div class="mt-av" style="margin-left:' + (i ? -8 : 0) + 'px;' + faceStyle(a) + '">' + (a && a.photo ? '' : esc(initials(a && a.name))) + '</div>'; }).join('');
    var more = (t.member_count > avs.length) ? '<div class="mt-av" style="margin-left:-8px;background:#16324a;color:#8a99a8;">+' + (t.member_count - avs.length) + '</div>' : '';
    var coach = t.coach ? ('Coach ' + String(t.coach).split(' ')[0]) : '';
    var grad = 'linear-gradient(135deg,#1d6a8f,#0a3e44)';
    // COVER = the team's HEADER photo (cover_url); fall back to the logo, then a gradient. The crest shows the logo.
    var coverImg = t.cover_url || t.logo_url;
    var cover = coverImg ? ('background:#0a3e44 center/cover no-repeat;background-image:url(\'' + esc(coverImg) + '\');') : ('background:' + grad + ';');
    var crestBg = t.logo_url ? ('background-size:cover;background-position:center;background-image:url(\'' + esc(t.logo_url) + '\');') : '';
    return '<div class="mt-card" onclick="FFPMemberTeams.openTeam(\'' + t.team_id + '\')">' +
      '<div class="mt-cover" style="' + cover + '">' + (mvTxt ? '<div class="mt-mv" style="color:' + mvCol + ';">' + mvTxt + '</div>' : '') +
      '<div class="mt-cov-in"><div class="mt-crest" style="' + crestBg + '">' + (t.logo_url ? '' : esc(initials(t.name))) + '</div><div><div class="mt-tn">' + esc(t.name) + '</div><div class="mt-ts">' + esc([t.sport, coach].filter(Boolean).join(' · ')) + '</div></div></div></div>' +
      '<div class="mt-foot"><div style="display:flex;">' + faces + more + '</div><div style="flex:1;"></div>' +
      (t.active_today > 0 ? '<div class="mt-active"><span class="mt-dot"></span>' + t.active_today + ' active</div>' : '<div class="mt-active" style="color:#5f7185;">' + t.member_count + ' players</div>') + '</div></div>';
  }

  function seeAll() { var t = (W._ffpMyTeams || [])[0]; if (t) openTeam(t.team_id); }

  // ── detail overlay ──
  function ensureOverlay() {
    var ov = document.getElementById('ffp-mt-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'ffp-mt-ov'; ov.innerHTML = '<div class="mt-ovhead"><span class="x" onclick="FFPMemberTeams.close()">&#8249;</span><div id="mt-ovtitle" style="flex:1;"></div></div><div class="mt-ovbody" id="mt-ovbody"></div>'; document.body.appendChild(ov); }
    return ov;
  }
  function close() { var ov = document.getElementById('ffp-mt-ov'); if (ov) ov.classList.remove('on'); }

  async function openTeam(teamId, benchId) {
    injectStyles();
    var mid = memberId(); if (!mid) return;
    var ov = ensureOverlay(); ov.classList.add('on');
    document.getElementById('mt-ovbody').innerHTML = '<div style="color:var(--muted,#8a99a8);font-weight:700;padding:16px 0;">Loading your standing…</div>';
    W._ffpMtTeam = teamId;
    var d = {};
    try { var r = await sb().rpc('member_team_detail', { p_member: mid, p_team: teamId, p_bench: benchId || null }); d = (r && r.data) || {}; }
    catch (e) { console.error('[FFP MyTeams] detail', e); document.getElementById('mt-ovbody').innerHTML = '<div style="color:var(--muted,#8a99a8);padding:16px 0;">Couldn\'t load this team.</div>'; return; }
    W._ffpMtDetail = d;
    renderDetail(d);
  }

  function renderDetail(d) {
    var team = d.team || {}, marks = d.marks || [], active = d.active_mark;
    document.getElementById('mt-ovtitle').innerHTML = '<div style="font-size:15px;font-weight:800;color:var(--text,#e8eef4);">' + esc(team.name || 'Team') + '</div>' + (team.sport ? '<div style="font-size:11px;color:var(--muted,#8a99a8);">' + esc(team.sport) + '</div>' : '');
    var html = '';
    var m = marks.filter(function (x) { return x.id === active; })[0] || marks[0];

    if (m) {
      var dl = (m.current != null && m.previous != null) ? '<div style="font-size:13px;font-weight:800;color:#36c97f;">▼ ' + fmtGap(m.current, m.previous, m.unit) + '</div>' : '<div style="font-size:12px;color:var(--muted,#8a99a8);">first result</div>';
      var away = (m.target != null && m.current != null) ? ('target ' + fmtVal(m.target, m.unit) + '<br><b style="color:var(--text,#e8eef4);">' + fmtGap(m.current, m.target, m.unit) + ' away</b>') : (m.target != null ? 'target ' + fmtVal(m.target, m.unit) : '');
      html += '<div class="mt-dcard" style="padding:15px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;"><div><div style="font-size:9px;font-weight:800;letter-spacing:1.4px;color:#5f8aa3;">YOUR ' + esc((m.name || '').toUpperCase()) + '</div><div style="display:flex;align-items:baseline;gap:9px;margin-top:4px;"><div style="font-size:34px;font-weight:900;color:var(--text,#e8eef4);line-height:1;">' + fmtVal(m.current, m.unit) + '</div>' + dl + '</div></div>' +
        '<div style="font-size:10.5px;color:var(--muted,#8a99a8);text-align:right;line-height:1.4;">' + away + '</div></div>' +
        dotSVG(m) +
        (marks.length > 1 ? '<div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;">' + marks.map(function (x) { return '<button class="mt-pill' + (x.id === m.id ? ' on' : '') + '" onclick="FFPMemberTeams.openTeam(\'' + team.id + '\',\'' + x.id + '\')">' + esc(x.name) + '</button>'; }).join('') + '</div>' : '') +
        '</div>';
    }

    // skills
    var sk = d.skills || [];
    if (sk.length) {
      html += '<div style="font-size:14px;font-weight:800;color:var(--text,#e8eef4);margin-bottom:11px;">Your skills</div>';
      html += sk.map(function (s) {
        var maxL = s.max_level || 5, lvl = s.level_no || 0, col = lvl ? SPECTRUM[Math.min(lvl, SPECTRUM.length) - 1] : '#b6c1c3', segs = '';
        for (var i = 1; i <= maxL; i++) segs += '<div style="background:' + (i <= lvl ? SPECTRUM[Math.min(i, SPECTRUM.length) - 1] : 'rgba(255,255,255,.08)') + ';"></div>';
        return '<div style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:13px;font-weight:800;color:var(--text,#e8eef4);">' + esc(s.name) + '</span><span style="font-size:11.5px;font-weight:800;color:' + col + ';">' + esc(s.level_name || (lvl ? 'Level ' + lvl : 'Not assessed')) + '</span></div><div class="mt-seg">' + segs + '</div></div>';
      }).join('');
    }

    // leaderboard
    var lb = d.leaderboard || {}, rows = lb.rows || [];
    if (rows.length) {
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 4px;"><div style="font-size:14px;font-weight:800;color:var(--text,#e8eef4);">Squad leaderboard</div><span style="font-size:11px;font-weight:800;color:var(--yellow,#FFCC00);">' + esc(lb.mark_name || '') + '</span></div>';
      if (lb.your_rank) html += '<div style="font-size:11px;color:var(--muted,#8a99a8);margin-bottom:11px;">You\'re <b style="color:var(--yellow,#FFCC00);">' + ordinal(lb.your_rank) + '</b> of ' + lb.of + '</div>';
      html += '<div class="mt-dcard" style="padding:6px 8px;">' + rows.map(function (row) {
        var you = row.is_you;
        var av = '<div class="mt-lbav" style="' + faceStyle(row) + (you ? 'background:var(--yellow,#FFCC00);color:#0a1a24;' : '') + '">' + (row.photo ? '' : (you ? 'YOU' : esc(initials(row.name)))) + '</div>';
        return '<div class="mt-lb"' + (you ? ' style="background:rgba(255,204,0,.10);border:1px solid rgba(255,204,0,.35);"' : '') + '>' +
          '<div class="mt-rk"' + (you ? ' style="color:var(--yellow,#FFCC00);"' : '') + '>' + row.rank + '</div>' + av +
          '<div style="flex:1;font-size:13px;font-weight:' + (you ? '800' : '700') + ';color:' + (you ? 'var(--yellow,#FFCC00)' : 'var(--text,#e8eef4)') + ';">' + (you ? 'You' : esc(row.name)) + '</div>' +
          '<div style="font-size:13px;font-weight:800;color:var(--text,#e8eef4);">' + fmtVal(row.value, lb.unit) + '</div></div>';
      }).join('') + '</div>';
    }

    if (!m && !sk.length && !rows.length) html += '<div style="color:var(--muted,#8a99a8);padding:16px 0;">Your coach hasn\'t set any marks or skills for this team yet.</div>';
    document.getElementById('mt-ovbody').innerHTML = html;
    document.getElementById('mt-ovbody').scrollTop = 0;
  }

  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  function dotSVG(m) {
    var hist = (m.history || []).filter(function (h) { return h.value != null; });
    if (!hist.length) return '<div style="color:var(--muted,#8a99a8);font-size:12px;margin:6px 0 12px;">No history yet.</div>';
    var vals = hist.map(function (h) { return Number(h.value); }), all = vals.concat(m.target != null ? [Number(m.target)] : []);
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all), span = (mx - mn) || 1, lb = lowerBetter(m.direction);
    function y(v) { var f = (Number(v) - mn) / span; return lb ? (8 + 44 * f) : (52 - 44 * f); }
    var n = hist.length; function x(i) { return n === 1 ? 150 : (16 + i * 268 / (n - 1)); }
    var line = hist.map(function (h, i) { return x(i).toFixed(0) + ',' + y(h.value).toFixed(0); }).join(' ');
    var dots = hist.map(function (h, i) { var last = i === n - 1; return '<circle cx="' + x(i).toFixed(0) + '" cy="' + y(h.value).toFixed(0) + '" r="' + (last ? 5.5 : 4) + '" fill="' + (last ? '#37E0C6' : '#2ba8e0') + '"' + (last ? ' stroke="#11283c" stroke-width="2"' : '') + '/>'; }).join('');
    var tgt = (m.target != null) ? '<line x1="6" y1="' + y(m.target).toFixed(0) + '" x2="294" y2="' + y(m.target).toFixed(0) + '" stroke="rgba(43,168,224,.45)" stroke-width="1.2" stroke-dasharray="4 3"/>' : '';
    return '<svg viewBox="0 0 300 58" style="width:100%;height:auto;display:block;margin:8px 0 12px;" xmlns="http://www.w3.org/2000/svg">' + tgt + '<polyline points="' + line + '" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>' + dots + '</svg>';
  }

  // ── Find a team + request to join ──
  function _ensureFindOv() {
    var ov = document.getElementById('ffp-mtf-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'ffp-mtf-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:100051;background:#0a1825;display:none;flex-direction:column;font-family:inherit;';
      ov.innerHTML = '<div class="mt-ovhead"><span class="x" onclick="FFPMemberTeams.closeFind()">&#8249;</span><div style="flex:1;font-size:15px;font-weight:800;color:var(--text,#e8eef4);">Find a team</div></div>' +
        '<div style="padding:14px 16px 8px;"><div style="display:flex;align-items:center;gap:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:11px 13px;"><span class="material-icons" style="color:var(--muted,#8a99a8);font-size:20px;">search</span><input id="mtf-input" oninput="FFPMemberTeams.findInput(this.value)" placeholder="Search team name…" style="border:none;outline:none;background:transparent;flex:1;font-size:16px;color:var(--text,#e8eef4);font-family:inherit;"></div><div style="font-size:11px;color:var(--muted,#8a99a8);margin-top:8px;">Ask your coach for the team name. They approve your request.</div></div>' +
        '<div class="mt-ovbody" id="mtf-body"></div>';
      document.body.appendChild(ov);
    }
    return ov;
  }
  async function openFind() {
    injectStyles(); if (document.getElementById('ffp-mt-ov')) document.getElementById('ffp-mt-ov').classList.remove('on');
    var ov = _ensureFindOv(); ov.style.display = 'flex';  // inline display:none in cssText means the .on class rule can't win — set display directly
    document.getElementById('mtf-body').innerHTML = '<div style="color:var(--muted,#8a99a8);padding:12px 0;">Type a team name to search.</div>';
    try { var r = await sb().rpc('member_my_join_requests', { p_member: memberId() }); W._mtReqs = {}; ((r && r.data) || []).forEach(function (x) { W._mtReqs[x.team_id] = 1; }); } catch (e) { W._mtReqs = {}; }
    var inp = document.getElementById('mtf-input'); if (inp) { inp.value = ''; try { inp.focus(); } catch (e) {} }
  }
  function closeFind() { var ov = document.getElementById('ffp-mtf-ov'); if (ov) ov.style.display = 'none'; }
  var _findT = null;
  function findInput(v) { clearTimeout(_findT); _findT = setTimeout(function () { _doFind(v); }, 300); }
  async function _doFind(q) {
    var host = document.getElementById('mtf-body'); if (!host) return;
    q = (q || '').trim();
    if (q.length < 2) { host.innerHTML = '<div style="color:var(--muted,#8a99a8);padding:12px 0;">Type a team name to search.</div>'; return; }
    host.innerHTML = '<div style="color:var(--muted,#8a99a8);padding:12px 0;">Searching…</div>';
    var teams = []; try { var r = await sb().rpc('member_find_teams', { p_q: q }); teams = (r && r.data) || []; } catch (e) {}
    if (!teams.length) { host.innerHTML = '<div style="color:var(--muted,#8a99a8);padding:12px 0;">No teams match “' + esc(q) + '”.</div>'; return; }
    host.innerHTML = teams.map(function (t) {
      var req = W._mtReqs && W._mtReqs[t.team_id];
      var logo = t.logo_url ? ('background-size:cover;background-position:center;background-image:url(\'' + esc(t.logo_url) + '\');') : '';
      return '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid rgba(255,255,255,.06);">' +
        '<div style="width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#2ba8e0,#0a3e44);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;' + logo + '">' + (t.logo_url ? '' : esc(initials(t.name))) + '</div>' +
        '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:800;color:var(--text,#e8eef4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(t.name) + '</div><div style="font-size:11px;color:var(--muted,#8a99a8);">' + esc([t.sport, (t.coach ? 'Coach ' + String(t.coach).split(' ')[0] : '')].filter(Boolean).join(' · ')) + '</div></div>' +
        '<button id="mtf-b-' + t.team_id + '" ' + (req ? 'disabled' : '') + ' onclick="FFPMemberTeams.request(\'' + t.team_id + '\')" style="border:none;border-radius:9px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;' + (req ? 'background:rgba(255,255,255,.08);color:var(--muted,#8a99a8);' : 'background:var(--yellow,#FFCC00);color:#0a1a24;') + '">' + (req ? 'Requested' : 'Request') + '</button></div>';
    }).join('');
  }
  async function requestJoin(teamId) {
    var btn = document.getElementById('mtf-b-' + teamId);
    try {
      var r = await sb().rpc('member_request_join', { p_member: memberId(), p_team: teamId });
      if ((r && r.data) === 'already_member') { if (btn) { btn.textContent = 'On team'; btn.disabled = true; } return; }
      if (!W._mtReqs) W._mtReqs = {}; W._mtReqs[teamId] = 1;
      if (btn) { btn.textContent = 'Requested'; btn.disabled = true; btn.style.background = 'rgba(255,255,255,.08)'; btn.style.color = 'var(--muted,#8a99a8)'; }
    } catch (e) { console.error('[FFP MyTeams] request', e); }
  }

  W.FFPMemberTeams = { renderCarousel: renderCarousel, openTeam: openTeam, close: close, seeAll: seeAll, openFind: openFind, closeFind: closeFind, findInput: findInput, request: requestJoin };
})();

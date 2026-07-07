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
      '.mt-ovbody{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 96px;max-width:620px;width:100%;margin:0 auto;box-sizing:border-box;}',
      '#ffp-mt-ov .mt-ovhead{display:none;}',
      '.mt-dcard{background:#11283c;border:1px solid rgba(255,255,255,.06);border-radius:14px;}',
      '.mt-pill{border-radius:16px;padding:5px 13px;font-size:11px;font-weight:700;background:rgba(255,255,255,.08);color:var(--muted,#8a99a8);flex:0 0 auto;cursor:pointer;border:none;font-family:inherit;}',
      '.mt-pill.on{background:var(--yellow,#FFCC00);color:#0a1a24;font-weight:800;}',
      '.mt-seg{display:flex;gap:3px;}.mt-seg div{flex:1;height:9px;border-radius:3px;}',
      '.mt-tile{flex:1;background:#11283c;border-radius:12px;padding:12px 6px;text-align:center;}',
      '.mt-tv{font-size:20px;font-weight:900;color:var(--text,#e8eef4);line-height:1;}',
      '.mt-tl{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;color:var(--muted,#8a99a8);margin-top:4px;}',
      '.mt-lb{display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:10px;}',
      '.mt-lbav{width:32px;height:32px;border-radius:50%;background:#214b6b;color:#cfe6f5;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:0 0 auto;background-size:cover;background-position:center;}',
      '.mt-rk{width:20px;text-align:center;font-size:12px;font-weight:800;color:var(--muted,#8a99a8);flex:0 0 auto;}',
      // streak AURA RING — slim brand gradient ring + glow + flame-number pill; colour by streak length
      '@keyframes ffpSpin{to{transform:rotate(360deg)}}',
      '.ffp-stwrap{position:relative;width:54px;height:54px;flex:0 0 auto;}',
      '.ffp-aura{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from -90deg,var(--cl),var(--c),var(--cl));-webkit-mask:radial-gradient(farthest-side,#0000 80%,#000 82%);mask:radial-gradient(farthest-side,#0000 80%,#000 82%);animation:ffpSpin 9s linear infinite;filter:drop-shadow(0 0 5px var(--g));}',
      '.ffp-stav{position:absolute;inset:7px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;z-index:2;background:#14293b;background-size:cover;background-position:center;color:#cfe0ee;}',
      '.ffp-stpill{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);z-index:3;background:var(--c);color:#06121c;border-radius:20px;padding:2px 7px 2px 5px;font-size:10px;font-weight:800;display:flex;align-items:center;gap:1px;border:2px solid #0d2032;}'
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

  async function openTeam(teamId) {
    injectStyles();
    var mid = memberId(); if (!mid) return;
    var ov = ensureOverlay(); ov.classList.add('on');
    document.getElementById('mt-ovbody').innerHTML = '<div style="color:var(--muted,#8a99a8);font-weight:700;padding:16px 0;">Loading team…</div>';
    W._ffpMtTeam = teamId; W._mtOvMark = 0; W._mtOvSkill = 0;
    var d = {};
    try { var r = await sb().rpc('member_team_overview', { p_member: mid, p_team: teamId }); d = (r && r.data) || {}; }
    catch (e) { console.error('[FFP MyTeams] overview', e); document.getElementById('mt-ovbody').innerHTML = '<div style="color:var(--muted,#8a99a8);padding:16px 0;">Couldn\'t load this team.</div>'; return; }
    W._mtOv = d; renderOverview();
  }
  function _face(p, size, ring) {
    size = size || 44;
    var st = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:' + Math.round(size * 0.32) + 'px;background:#214b6b;color:#cfe6f5;overflow:hidden;background-size:cover;background-position:center;flex:0 0 auto;';
    if (ring) st += 'box-shadow:0 0 0 2.5px ' + ring + ';';
    if (p && p.photo) return '<span style="' + st + 'background-image:url(\'' + esc(p.photo) + '\');"></span>';
    return '<span style="' + st + '">' + esc(initials(p && p.name)) + '</span>';
  }
  function _ovBar(f) {
    var bars = f.bars || [];
    var vals = bars.map(function (b) { return b.value; }).filter(function (v) { return v != null; });
    var lb = lowerBetter(f.direction);
    if (!vals.length) {
      var n0 = bars.length || 5, slot0 = 284 / n0, bw0 = Math.min(16, slot0 - 4), base0 = 96, deco = [46, 64, 38, 72, 54, 60, 42, 58];
      var r0 = '', l0 = '';
      for (var j = 0; j < n0; j++) { var h0 = deco[j % deco.length] * 0.7, x0 = 8 + j * slot0 + (slot0 - bw0) / 2; r0 += '<rect x="' + x0.toFixed(1) + '" y="' + (base0 - h0).toFixed(0) + '" width="' + bw0.toFixed(1) + '" height="' + h0.toFixed(0) + '" rx="2" fill="rgba(255,255,255,.08)"/>'; if (bars.length) l0 += '<text x="' + (8 + j * slot0 + slot0 / 2).toFixed(1) + '" y="' + (base0 + 10) + '" text-anchor="middle" font-size="7" font-weight="700" fill="rgba(255,255,255,.35)" font-family="Montserrat">' + esc(initials(bars[j].name)) + '</text>'; }
      return '<svg viewBox="0 0 300 ' + (base0 + 16) + '" style="width:100%;height:auto;display:block;margin-bottom:8px;" xmlns="http://www.w3.org/2000/svg"><line x1="6" y1="' + (base0 - 52) + '" x2="272" y2="' + (base0 - 52) + '" stroke="rgba(255,255,255,.25)" stroke-width="1.2" stroke-dasharray="4 3"/>' + r0 + l0 + '</svg><div style="text-align:center;color:var(--muted,#8a99a8);font-size:11px;margin-bottom:10px;">No results logged yet.</div>';
    }
    function sc(v) { return lb ? -Number(v) : Number(v); }
    var scr = vals.map(sc), mn = Math.min.apply(null, scr), mx = Math.max.apply(null, scr), span = (mx - mn) || 1;
    var n = bars.length, slot = 284 / n, bw = Math.min(16, slot - 4), base = 84, top = 12;
    function hg(v) { return v == null ? 0 : Math.round(14 + (base - top - 14) * (sc(v) - mn) / span); }
    var avgH = (f.avg != null) ? hg(f.avg) : null;
    var rects = bars.map(function (b, i) {
      var x = 8 + i * slot + (slot - bw) / 2, hh = hg(b.value), y = base - hh;
      var better = (b.value == null) ? null : (lb ? Number(b.value) < Number(f.avg) : Number(b.value) > Number(f.avg));
      var col = b.value == null ? '#40525a' : (better ? '#37E0C6' : '#FF7A66');
      return '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + bw.toFixed(1) + '" height="' + Math.max(hh, 3) + '" rx="2" fill="' + col + '"/>';
    }).join('');
    var labs = bars.map(function (b, i) { var x = 8 + i * slot + slot / 2; return '<text x="' + x.toFixed(1) + '" y="94" text-anchor="middle" font-size="7" font-weight="700" fill="rgba(255,255,255,.5)" font-family="Montserrat">' + esc(initials(b.name)) + '</text>'; }).join('');
    var avg = (avgH != null) ? '<line x1="6" y1="' + (base - avgH) + '" x2="272" y2="' + (base - avgH) + '" stroke="rgba(255,255,255,.45)" stroke-width="1.3" stroke-dasharray="4 3"/><text x="297" y="' + (base - avgH + 3) + '" text-anchor="end" font-size="8" font-weight="800" fill="rgba(255,255,255,.6)" font-family="Montserrat">avg</text>' : '';
    return '<svg viewBox="0 0 300 100" style="width:100%;height:auto;display:block;margin-bottom:10px;" xmlns="http://www.w3.org/2000/svg">' + avg + rects + labs + '</svg>';
  }
  function _ovSkillCols(sk) {
    var levels = (sk.levels || []).slice().sort(function (a, b) { return a.level_no - b.level_no; });
    if (!levels.length) return '<div style="font-size:12px;color:var(--muted,#8a99a8);margin-bottom:8px;">No levels defined.</div>';
    var players = sk.players || [], byL = {}; levels.forEach(function (l) { byL[l.level_no] = []; });
    players.forEach(function (p) { if (p.level_no != null && byL[p.level_no]) byL[p.level_no].push(p); });
    return '<div style="display:grid;grid-template-columns:repeat(' + levels.length + ',1fr);gap:6px;text-align:center;margin-bottom:4px;">' + levels.map(function (l) {
      var isT = sk.target_level === l.level_no;
      var faces = byL[l.level_no].map(function (p, i) { return '<span style="margin-left:' + (i ? -8 : 0) + 'px;">' + _face(p, 28) + '</span>'; }).join('') || '<span style="font-size:11px;color:#3a4a57;">—</span>';
      return '<div><div style="font-size:8.5px;font-weight:800;text-transform:uppercase;color:' + (isT ? 'var(--yellow,#FFCC00)' : 'var(--muted,#8a99a8)') + ';margin-bottom:8px;">' + esc((l.name || '').slice(0, 7)) + (isT ? '★' : '') + '</div><div style="display:flex;justify-content:center;">' + faces + '</div></div>';
    }).join('') + '</div>';
  }
  var _catGrads = ['linear-gradient(160deg,#1d5d8a,#0a2e44)', 'linear-gradient(160deg,#0e5a63,#0a1a24)', 'linear-gradient(160deg,#243b1f,#0a1a24)', 'linear-gradient(160deg,#3a2352,#12112a)', 'linear-gradient(160deg,#5a2d2d,#1a0f0f)'];
  function _catGrad(k) { var s = String(k || ''), h = 0, i; for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return _catGrads[h % _catGrads.length]; }

  // Team progress: draw a trend line when ≥2 team-avg points exist, else fall back to the per-athlete bars.
  function _trendSVG(f, trend) {
    var vals = trend.map(function (p) { return Number(p.avg); }), all = vals.concat(f.target != null ? [Number(f.target)] : []);
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all), span = (mx - mn) || 1, n = vals.length;
    function Y(v) { return 12 + 34 * (1 - (Number(v) - mn) / span); }
    function X(i) { return 8 + i * (198 / (n - 1)); }
    var pts = vals.map(function (v, i) { return X(i).toFixed(0) + ',' + Y(v).toFixed(0); }).join(' ');
    var area = 'M' + X(0).toFixed(0) + ',' + Y(vals[0]).toFixed(0) + ' ' + vals.map(function (v, i) { return 'L' + X(i).toFixed(0) + ',' + Y(v).toFixed(0); }).join(' ') + ' L' + X(n - 1).toFixed(0) + ',58 L' + X(0).toFixed(0) + ',58 Z';
    var gid = 'ta' + String(f.id || Math.random()).replace(/[^a-z0-9]/gi, '');
    var tgt = (f.target != null) ? '<line x1="6" y1="' + Y(f.target).toFixed(0) + '" x2="200" y2="' + Y(f.target).toFixed(0) + '" stroke="rgba(255,255,255,.35)" stroke-width="1" stroke-dasharray="4 3"/><text x="211" y="' + (Y(f.target) + 3).toFixed(0) + '" text-anchor="end" font-size="7.5" fill="rgba(255,255,255,.5)" font-family="Montserrat">tgt</text>' : '';
    return '<svg viewBox="0 0 214 62" style="width:100%;height:auto;display:block;margin-top:6px;" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#37E0C6" stop-opacity=".33"/><stop offset="1" stop-color="#37E0C6" stop-opacity="0"/></linearGradient></defs>' + tgt + '<path d="' + area + '" fill="url(#' + gid + ')"/><polyline points="' + pts + '" fill="none" stroke="#37E0C6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="' + X(n - 1).toFixed(0) + '" cy="' + Y(vals[n - 1]).toFixed(0) + '" r="4" fill="#37E0C6" stroke="#081420" stroke-width="2"/></svg>';
  }
  function _progCard(f) {
    var trend = (f.trend || []).filter(function (p) { return p.avg != null; }), hasTrend = trend.length >= 2;
    // per-benchmark view mode: tap the card to flip team-avg trend ↔ individual athlete bars
    var mode = (W._mtProgMode && W._mtProgMode[f.id]) || (hasTrend ? 'trend' : 'bars');
    var showBars = (mode === 'bars') || !hasTrend, c = (W._mtOv || {}).member_count || 0, right = '';
    if (!showBars && hasTrend) {
      var vals = trend.map(function (p) { return Number(p.avg); }), first = vals[0], last = vals[vals.length - 1], lb = lowerBetter(f.direction), improved = lb ? last < first : last > first;
      var col = improved ? '#37E0C6' : '#FF7A66', arrow = (last < first) ? '▼' : (last > first ? '▲' : '—');
      right = '<span style="font-size:11px;font-weight:800;color:' + col + ';background:' + (improved ? 'rgba(55,224,198,.14)' : 'rgba(255,122,102,.14)') + ';border-radius:7px;padding:2px 7px;">' + arrow + ' ' + fmtGap(last, first, f.unit) + '</span>';
    } else if (f.hit != null) {
      right = '<span style="font-size:11px;font-weight:800;color:#36c97f;background:rgba(54,201,127,.14);border-radius:7px;padding:2px 7px;">' + f.hit + ' of ' + c + ' hit</span>';
    } else if (f.target != null) {
      right = '<span style="font-size:11px;font-weight:800;color:#36c97f;background:rgba(54,201,127,.14);border-radius:7px;padding:2px 7px;">target ' + fmtVal(f.target, f.unit) + '</span>';
    }
    var body = showBars ? _ovBar(f) : _trendSVG(f, trend);
    var foot = hasTrend ? ('<div style="display:flex;align-items:center;justify-content:center;gap:5px;margin-top:8px;color:#5f8aa3;font-size:9.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;"><span class="material-icons" style="font-size:13px;">swap_horiz</span>' + (showBars ? 'Tap · team trend' : 'Tap · individuals') + '</div>') : '';
    var tap = hasTrend ? (' onclick="FFPMemberTeams.progToggle(\'' + f.id + '\')"') : '';
    return '<div' + tap + ' style="flex:0 0 auto;width:244px;background:radial-gradient(120% 90% at 50% 0,#0f3b4a,#081420);border-radius:16px;padding:15px;box-sizing:border-box;' + (hasTrend ? 'cursor:pointer;' : '') + '">' +
      '<div style="font-size:9.5px;font-weight:800;letter-spacing:1px;color:#5f8aa3;margin-bottom:3px;">' + esc((f.name || '').toUpperCase()) + ' · ' + (showBars ? 'INDIVIDUALS' : 'TEAM AVG') + '</div>' +
      '<div style="display:flex;align-items:baseline;gap:9px;margin-bottom:4px;"><div style="font-size:26px;font-weight:900;color:var(--text,#e8eef4);line-height:1;">' + fmtVal(f.avg, f.unit) + '</div>' + right + '</div>' +
      body + foot + '</div>';
  }
  function _paintProg() { var el = document.getElementById('mt-progrow'); if (el) el.innerHTML = ((W._mtOv || {}).fitness || []).map(_progCard).join(''); }

  function _fmtMin(m) { m = Math.round(m || 0); if (m < 60) return m + 'm'; var h = Math.floor(m / 60), r = m % 60; return h + 'h' + (r ? (' ' + r + 'm') : ''); }
  // Team pulse — a horizontal scroll of today's team stats (24h basis)
  function _pulseCards(p) {
    if (!p) return '';
    var am = p.active_min || 0, ap = p.active_min_prev || 0, cals = p.cals || 0, sess = p.sessions || 0, su = p.showed_up || 0, mem = p.members || 0, c7 = p.cals7 || [];
    var vs, vsCol, vsArr;
    if (ap > 0) { var dd = Math.round((am - ap) / ap * 100); vs = (dd > 0 ? '+' : '') + dd + '%'; vsCol = dd >= 0 ? '#36c97f' : '#FF7A66'; vsArr = dd >= 0 ? '▲' : '▼'; }
    else if (am > 0) { vs = 'new'; vsCol = '#36c97f'; vsArr = '▲'; }
    else { vs = '—'; vsCol = '#7c8b9a'; vsArr = ''; }
    var mx = Math.max.apply(null, c7.concat([1]));
    var bars = c7.map(function (val, i) { var h = Math.max(8, Math.round((val / mx) * 100)), last = i === c7.length - 1; return '<div style="flex:1;background:' + (last ? '#FF7A66' : 'rgba(255,122,102,.28)') + ';border-radius:2px;height:' + h + '%;"></div>'; }).join('');
    function card(inner) { return '<div style="flex:0 0 auto;width:138px;background:#0e2033;border-radius:16px;padding:13px 14px;box-sizing:border-box;">' + inner + '</div>'; }
    return '<div class="mt-car" style="margin:0 -2px 28px;">' +
      card('<div style="font-size:10.5px;color:#7c8b9a;margin-bottom:9px;">Active time · 24h</div><div style="font-size:22px;font-weight:900;color:#37E0C6;line-height:1;">' + _fmtMin(am) + '</div><div style="font-size:10px;color:#7c8b9a;margin-top:8px;">' + sess + ' session' + (sess === 1 ? '' : 's') + '</div>') +
      card('<div style="font-size:10.5px;color:#7c8b9a;margin-bottom:9px;">Calories · 7d</div><div style="display:flex;align-items:flex-end;gap:3px;height:30px;">' + bars + '</div><div style="font-size:18px;font-weight:900;color:var(--text,#e8eef4);margin-top:7px;">' + cals + '</div>') +
      card('<div style="font-size:10.5px;color:#7c8b9a;margin-bottom:9px;">Vs yesterday</div><div style="font-size:22px;font-weight:900;color:' + vsCol + ';line-height:1;">' + vsArr + ' ' + vs + '</div><div style="font-size:10px;color:#7c8b9a;margin-top:8px;">active time</div>') +
      card('<div style="font-size:10.5px;color:#7c8b9a;margin-bottom:9px;">Showed up</div><div style="display:flex;align-items:baseline;gap:3px;"><span style="font-size:26px;font-weight:900;color:var(--yellow,#FFCC00);line-height:1;">' + su + '</span><span style="font-size:13px;color:#7c8b9a;">/' + mem + '</span></div><div style="font-size:10px;color:#7c8b9a;margin-top:8px;">active today</div>') +
      '</div>';
  }

  // 24h/recent activity — "people being active" photo strip
  function _actStrip(acts) {
    if (!acts.length) return '<div style="color:var(--muted,#8a99a8);font-size:12px;margin-bottom:4px;">No recent activity yet.</div>';
    return '<div class="mt-car" style="margin:0 0 4px;">' + acts.map(function (a) {
      var bg = a.img ? ('background:#0a2e44 center/cover no-repeat;background-image:url(\'' + esc(a.img) + '\');') : ('background:' + _catGrad(a.category || a.activity) + ';');
      var sub = a.km ? (a.km + 'km') : (a.mins ? (a.mins + 'm') : '');
      return '<div style="flex:0 0 auto;width:98px;height:116px;border-radius:12px;position:relative;overflow:hidden;' + bg + '"><div style="position:absolute;left:0;right:0;bottom:0;padding:16px 9px 8px;background:linear-gradient(transparent,rgba(0,0,0,.74));"><div style="font-size:11.5px;font-weight:800;color:#fff;">' + esc((a.name || '').split(' ')[0]) + '</div><div style="font-size:9.5px;color:#cfe0ee;">' + esc([a.activity, sub].filter(Boolean).join(' ')) + '</div></div></div>';
    }).join('') + '</div>';
  }
  function _standoutCard(s) {
    if (!s) return '';
    var bg = s.photo ? ('background:#0a2233 center/cover no-repeat;background-image:url(\'' + esc(s.photo) + '\');') : 'background:linear-gradient(120deg,#0e4a44,#0a2233);';
    var lbl = (s.window === 'today') ? 'Standout today' : 'Standout · 7 days';
    var chips = [(s.mins ? s.mins + 'm active' : ''), (s.cals ? s.cals + ' cal' : ''), (s.sessions ? s.sessions + ' session' + (s.sessions === 1 ? '' : 's') : '')].filter(Boolean);
    return '<div style="position:relative;height:126px;border-radius:14px;overflow:hidden;margin-bottom:20px;' + bg + '">' +
      '<div style="position:absolute;inset:0;background:linear-gradient(120deg,rgba(10,34,51,.4),rgba(10,34,51,.12));"></div>' +
      '<div style="position:absolute;top:11px;left:12px;display:flex;align-items:center;gap:5px;background:rgba(0,0,0,.42);padding:4px 9px;border-radius:20px;"><span class="material-icons" style="font-size:13px;color:var(--yellow,#FFCC00);">emoji_events</span><span style="font-size:10px;color:var(--yellow,#FFCC00);letter-spacing:.4px;text-transform:uppercase;font-weight:800;">' + lbl + '</span></div>' +
      '<div style="position:absolute;left:0;right:0;bottom:0;padding:20px 13px 12px;background:linear-gradient(transparent,rgba(0,0,0,.8));"><div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:7px;">' + esc(s.name) + '</div><div style="display:flex;gap:7px;flex-wrap:wrap;">' + chips.map(function (c) { return '<span style="background:rgba(255,255,255,.16);border-radius:8px;padding:4px 8px;font-size:11px;font-weight:700;color:#fff;">' + esc(c) + '</span>'; }).join('') + '</div></div></div>';
  }
  // Performance of Day — effort = minutes × HR zone (Z1×1 … Z5×5). Winner card, tap → effort leaderboard.
  var _ZC = ['#2ba8e0', '#37E0C6', '#36c97f', '#FFCC00', '#FF7A66']; // Z1..Z5
  function _zoneBar(z, h) {
    z = z || {}; var zt = (z.z1 || 0) + (z.z2 || 0) + (z.z3 || 0) + (z.z4 || 0) + (z.z5 || 0);
    var seg = function (v, c) { var w = zt > 0 ? (v / zt * 100) : 0; return w > 0 ? '<div style="width:' + w.toFixed(1) + '%;background:' + c + ';"></div>' : ''; };
    return '<div style="display:flex;height:' + (h || 14) + 'px;border-radius:4px;overflow:hidden;gap:1.5px;">' + seg(z.z1, _ZC[0]) + seg(z.z2, _ZC[1]) + seg(z.z3, _ZC[2]) + seg(z.z4, _ZC[3]) + seg(z.z5, _ZC[4]) + '</div>';
  }
  function _perfCard(p) {
    if (!p) return '';
    var z = p.zones || {}, av = p.photo ? ('background:#0a2233 center/cover no-repeat;background-image:url(\'' + esc(p.photo) + '\');') : 'background:#37E0C6;color:#08210f;';
    var leg = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(function (l, i) { return '<span style="font-size:10px;color:#8a99a8;display:inline-flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:2px;background:' + _ZC[i] + ';display:inline-block;"></span>' + l + ' ' + (z['z' + (i + 1)] || 0) + 'm</span>'; }).join('');
    return '<div onclick="FFPMemberTeams.openPerfBoard()" style="cursor:pointer;background:radial-gradient(130% 100% at 0% 0,#123f43,#0a2233);border-radius:16px;padding:15px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;"><div style="display:flex;align-items:center;gap:6px;"><span class="material-icons" style="font-size:15px;color:#37E0C6;">bolt</span><span style="font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;color:#37E0C6;font-weight:800;">Performance of day</span></div><span class="material-icons" style="font-size:18px;color:#5f8aa3;">chevron_right</span></div>' +
      '<div style="display:flex;align-items:center;gap:14px;">' +
        '<div style="width:56px;height:56px;border-radius:14px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;' + av + '">' + (p.photo ? '' : esc(initials(p.name))) + '</div>' +
        '<div style="flex:1;min-width:0;"><div style="font-size:16px;font-weight:800;">' + esc((p.name || '').split(' ')[0]) + '</div><div style="font-size:11px;color:#9fb2c2;">' + (p.trained || 0) + ' min trained' + (p.max_hr ? ' · max ' + p.max_hr + ' bpm' : '') + '</div></div>' +
        '<div style="text-align:right;flex:0 0 auto;"><div style="font-size:28px;font-weight:900;color:#37E0C6;line-height:1;">' + (p.effort || 0) + '</div><div style="font-size:9px;color:#8a99a8;text-transform:uppercase;letter-spacing:.4px;">effort</div></div>' +
      '</div>' +
      '<div style="margin:12px 0 8px;">' + _zoneBar(z, 14) + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:9px;">' + leg + '</div></div>';
  }
  function openPerfBoard() {
    var d = W._mtOv || {}, board = d.performance_board || [], host = document.getElementById('mt-ovbody'); if (!host) return;
    var me = memberId();
    var html = _backChip() + '<div style="font-size:18px;font-weight:800;margin-bottom:3px;">Performance of day</div><div style="font-size:12px;color:var(--muted,#8a99a8);margin-bottom:16px;">Effort = minutes × heart-rate zone (Z1×1 … Z5×5)</div>';
    if (!board.length) html += '<div style="color:var(--muted,#8a99a8);font-size:13px;">No heart-rate sessions logged today yet.</div>';
    else html += board.map(function (r, i) {
      var you = r.member_id === me, av = r.photo ? ('background:#0a2233 center/cover no-repeat;background-image:url(\'' + esc(r.photo) + '\');') : 'background:#214b6b;color:#cfe6f5;';
      return '<div style="display:flex;align-items:center;gap:11px;padding:9px 8px;border-radius:12px;margin-bottom:8px;' + (you ? 'background:rgba(255,204,0,.10);border:1px solid rgba(255,204,0,.35);' : '') + '">' +
        '<span style="width:16px;text-align:center;font-size:13px;font-weight:800;color:' + (i === 0 || you ? '#FFCC00' : '#7c8b9a') + ';">' + (i + 1) + '</span>' +
        '<div style="width:34px;height:34px;border-radius:10px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;' + av + '">' + (r.photo ? '' : esc(initials(r.name))) + '</div>' +
        '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:' + (you ? '800' : '700') + ';color:' + (you ? '#FFCC00' : 'var(--text,#e8eef4)') + ';margin-bottom:4px;">' + (you ? 'You' : esc((r.name || '').split(' ')[0])) + '</div>' + _zoneBar(r.zones, 7) + '</div>' +
        '<div style="text-align:right;flex:0 0 auto;"><div style="font-size:16px;font-weight:900;color:#37E0C6;line-height:1;">' + (r.effort || 0) + '</div><div style="font-size:8.5px;color:#8a99a8;">' + (r.trained || 0) + 'm</div></div></div>';
    }).join('');
    host.innerHTML = html; host.scrollTop = 0;
  }

  // Streak AURA RING — brand gradient ring; tier colour by streak length: blue → aqua → yellow → coral (best).
  function _flame(s) {
    var days = s.days || 0;
    var t = days >= 30 ? { c: '#FF7A66', cl: '#ffb3a6', g: 'rgba(255,122,102,.6)' }
      : days >= 14 ? { c: '#FFCC00', cl: '#ffe680', g: 'rgba(255,204,0,.5)' }
        : days >= 7 ? { c: '#37E0C6', cl: '#a3f2e8', g: 'rgba(55,224,198,.5)' }
          : { c: '#2ba8e0', cl: '#8fd6f2', g: 'rgba(43,168,224,.55)' };
    var av = s.photo ? ('background-image:url(\'' + esc(s.photo) + '\');') : '';
    return '<div style="text-align:center;flex:0 0 auto;">' +
      '<div class="ffp-stwrap" style="--c:' + t.c + ';--cl:' + t.cl + ';--g:' + t.g + ';">' +
      '<div class="ffp-aura"></div>' +
      '<div class="ffp-stav" style="' + av + '">' + (s.photo ? '' : esc(initials(s.name))) + '</div>' +
      '<div class="ffp-stpill"><span class="material-icons" style="font-size:11px;">local_fire_department</span>' + days + '</div>' +
      '</div><div style="font-size:11px;font-weight:700;color:var(--muted,#8a99a8);margin-top:9px;">' + esc((s.name || '').split(' ')[0]) + '</div></div>';
  }

  function renderOverview() {
    var d = W._mtOv || {}, team = d.team || {}, host = document.getElementById('mt-ovbody'); if (!host) return;
    var c = d.member_count || 0, so = d.standout;
    document.getElementById('mt-ovtitle').innerHTML = '<div style="font-size:15px;font-weight:800;color:var(--text,#e8eef4);">' + esc(team.name || 'Team') + '</div>';
    var html = '';
    // header cover
    var cov = team.cover_url || team.logo_url;
    var covBg = cov ? ('background:#0e2033 center/cover no-repeat;background-image:url(\'' + esc(cov) + '\');') : 'background:linear-gradient(120deg,#123a52,#0a2233);';
    var crest = team.logo_url ? ('background-size:cover;background-position:center;background-image:url(\'' + esc(team.logo_url) + '\');') : '';
    html += '<div style="position:relative;height:210px;overflow:hidden;border-radius:0 0 20px 20px;margin:calc(-1 * (env(safe-area-inset-top,0px) + 14px)) -16px 22px;' + covBg + '">' +
      '<div style="position:absolute;inset:0;background:linear-gradient(transparent 42%,rgba(10,24,37,.96));"></div>' +
      '<div onclick="FFPMemberTeams.close()" style="position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);left:12px;width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:3;"><span class="material-icons" style="color:#fff;font-size:26px;">chevron_left</span></div>' +
      '<div style="position:absolute;left:16px;right:16px;bottom:15px;display:flex;align-items:center;gap:12px;"><div style="width:52px;height:52px;border-radius:14px;background:#0a1825;box-shadow:0 0 0 2px var(--yellow,#FFCC00);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:var(--yellow,#FFCC00);flex:0 0 auto;' + crest + '">' + (team.logo_url ? '' : esc(initials(team.name))) + '</div><div style="min-width:0;"><div style="font-size:20px;font-weight:800;color:#fff;line-height:1.1;">' + esc(team.name || 'Team') + '</div><div style="font-size:11.5px;color:#bfd0dd;margin-top:2px;">' + c + ' athlete' + (c === 1 ? '' : 's') + (so && so.window === 'today' ? ' · active today' : '') + '</div></div></div></div>';
    // team pulse (24h) — active time / calories / vs yesterday / showed up
    if (d.pulse) html += _pulseCards(d.pulse);
    // team progress
    var fits = d.fitness || [];
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><div style="font-size:15px;font-weight:800;color:var(--text,#e8eef4);">Team progress</div>' + (fits.length ? '<span class="mt-link" onclick="FFPMemberTeams.openLeaderboard()">Benchmarks &rsaquo;</span>' : '') + '</div>';
    if (fits.length) html += '<div class="mt-car" id="mt-progrow" style="margin:0 -2px 30px;">' + fits.map(_progCard).join('') + '</div>';
    else html += '<div style="color:var(--muted,#8a99a8);font-size:12px;margin-bottom:24px;">No benchmarks set yet.</div>';
    // training focus
    var tr = d.training || [];
    if (tr.length) {
      var mxt = Math.max.apply(null, tr.map(function (x) { return x.sessions; }).concat([1]));
      html += '<div style="font-size:15px;font-weight:800;color:var(--text,#e8eef4);margin-bottom:12px;">Training focus</div><div style="margin-bottom:30px;">' + tr.slice(0, 6).map(function (x) {
        var wpct = Math.max(16, Math.round(x.sessions * 100 / mxt));
        return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;"><span style="width:78px;font-size:12px;font-weight:700;color:var(--muted,#8a99a8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(x.category) + '</span><div style="flex:1;height:22px;border-radius:6px;background:rgba(255,255,255,.06);overflow:hidden;position:relative;"><div style="width:' + wpct + '%;height:100%;background:linear-gradient(90deg,#2ba8e0,#1d6a8f);"></div><span style="position:absolute;left:9px;top:0;bottom:0;display:flex;align-items:center;font-size:10.5px;font-weight:800;color:#fff;">' + x.sessions + ' session' + (x.sessions === 1 ? '' : 's') + '</span></div><span style="width:30px;text-align:right;font-size:11px;font-weight:800;color:var(--text,#e8eef4);">' + x.pct + '%</span></div>';
      }).join('') + '</div>';
    }
    // the squad — activity, standout, streaks grouped
    html += '<div style="background:#0d2032;border-radius:18px;padding:16px 15px 18px;margin-bottom:26px;">';
    html += '<div style="font-size:12px;letter-spacing:.6px;color:#6f8496;text-transform:uppercase;font-weight:800;margin-bottom:13px;">The squad</div>';
    html += _actStrip(d.activity || []);
    if (d.performance) html += '<div style="height:14px;"></div>' + _perfCard(d.performance);
    else if (so) html += '<div style="height:14px;"></div>' + _standoutCard(so);
    var st = d.streaks || [];
    if (st.length) {
      html += '<div style="display:flex;align-items:baseline;justify-content:space-between;margin:16px 0 14px;"><div style="font-size:11px;color:var(--muted,#8a99a8);">On a streak</div><div style="font-size:9.5px;color:#5f7285;">longer streak · warmer colour</div></div>';
      html += '<div style="display:flex;gap:20px;align-items:flex-end;padding-left:4px;overflow-x:auto;scrollbar-width:none;">' + st.map(_flame).join('') + '</div>';
    }
    html += '</div>';
    // explore
    var sk = d.skills || []; W._mtSkills = sk;
    html += '<div style="font-size:12px;letter-spacing:.6px;color:#6f8496;text-transform:uppercase;font-weight:800;margin-bottom:13px;">Explore</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">' +
      '<div onclick="FFPMemberTeams.openSkillsView()" style="background:#11283c;border-radius:14px;padding:14px;cursor:pointer;"><span class="material-icons" style="font-size:20px;color:#2ba8e0;">insights</span><div style="font-size:13.5px;font-weight:800;color:var(--text,#e8eef4);margin-top:8px;">Skills analysis</div><div style="font-size:10.5px;color:var(--muted,#8a99a8);">' + (sk.length ? sk.length + ' tracked' : 'team spread') + '</div></div>' +
      '<div onclick="FFPMemberTeams.openLeaderboard()" style="background:#11283c;border-radius:14px;padding:14px;cursor:pointer;"><span class="material-icons" style="font-size:20px;color:var(--yellow,#FFCC00);">leaderboard</span><div style="font-size:13.5px;font-weight:800;color:var(--text,#e8eef4);margin-top:8px;">Leaderboard</div><div style="font-size:10.5px;color:var(--muted,#8a99a8);">all benchmarks</div></div>' +
      '</div>';
    host.innerHTML = html; host.scrollTop = 0;
  }

  function _backChip() { return '<div onclick="FFPMemberTeams.backOverview()" style="display:inline-flex;align-items:center;gap:4px;color:var(--muted,#8a99a8);font-size:13px;font-weight:800;cursor:pointer;margin-bottom:14px;"><span class="material-icons" style="font-size:18px;">chevron_left</span>Overview</div>'; }
  function openSkillsView() {
    var d = W._mtOv || {}, sk = d.skills || [], host = document.getElementById('mt-ovbody'); if (!host) return; W._mtSkills = sk;
    var html = _backChip() + '<div style="font-size:17px;font-weight:800;color:var(--text,#e8eef4);margin-bottom:6px;">Skills analysis</div><div style="font-size:11.5px;color:var(--muted,#8a99a8);margin-bottom:16px;">Where the squad sits on each skill.</div>';
    if (!sk.length) html += '<div style="color:var(--muted,#8a99a8);font-size:13px;">No skills tracked yet.</div>';
    else html += sk.map(function (s, i) {
      return '<div style="' + (i ? 'margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06);' : '') + '"><div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;"><span style="font-size:14px;font-weight:800;color:var(--text,#e8eef4);">' + esc(s.name) + '</span><span onclick="FFPMemberTeams.skillInfo(' + i + ')" style="cursor:pointer;color:var(--muted,#8a99a8);display:inline-flex;align-items:center;" title="Level guide"><span class="material-icons" style="font-size:17px;">info_outline</span></span></div>' + _ovSkillCols(s) + '</div>';
    }).join('');
    host.innerHTML = html; host.scrollTop = 0;
  }
  function openLeaderboard(bIdx) {
    var d = W._mtOv || {}, fits = d.fitness || [], host = document.getElementById('mt-ovbody'); if (!host) return;
    if (!fits.length) { host.innerHTML = _backChip() + '<div style="color:var(--muted,#8a99a8);font-size:13px;">No benchmarks set yet.</div>'; return; }
    bIdx = bIdx || 0; if (bIdx >= fits.length) bIdx = 0;
    var f = fits[bIdx], lb = lowerBetter(f.direction), me = memberId();
    var rows = (f.bars || []).filter(function (b) { return b.value != null; }).slice().sort(function (a, b) { return lb ? (a.value - b.value) : (b.value - a.value); });
    var html = _backChip() + '<div style="font-size:17px;font-weight:800;color:var(--text,#e8eef4);margin-bottom:12px;">Leaderboard</div>';
    if (fits.length > 1) html += '<div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:14px;">' + fits.map(function (x, i) { return '<button class="mt-pill' + (i === bIdx ? ' on' : '') + '" onclick="FFPMemberTeams.openLeaderboard(' + i + ')">' + esc(x.name) + '</button>'; }).join('') + '</div>';
    if (!rows.length) html += '<div style="color:var(--muted,#8a99a8);font-size:13px;">No results logged for ' + esc(f.name) + ' yet.</div>';
    else html += '<div class="mt-dcard" style="padding:6px 8px;">' + rows.map(function (row, i) {
      var you = row.member_id === me;
      return '<div class="mt-lb"' + (you ? ' style="background:rgba(255,204,0,.10);border:1px solid rgba(255,204,0,.35);"' : '') + '><div class="mt-rk"' + (you ? ' style="color:var(--yellow,#FFCC00);"' : '') + '>' + (i + 1) + '</div>' + _face(row, 32, you ? '#FFCC00' : null) + '<div style="flex:1;font-size:13px;font-weight:' + (you ? '800' : '700') + ';color:' + (you ? 'var(--yellow,#FFCC00)' : 'var(--text,#e8eef4)') + ';">' + (you ? 'You' : esc(row.name)) + '</div><div style="font-size:13px;font-weight:800;color:var(--text,#e8eef4);">' + fmtVal(row.value, f.unit) + '</div></div>';
    }).join('') + '</div>';
    host.innerHTML = html; host.scrollTop = 0;
  }
  function backOverview() { renderOverview(); }

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

  W.FFPMemberTeams = { renderCarousel: renderCarousel, openTeam: openTeam, close: close, seeAll: seeAll, openFind: openFind, closeFind: closeFind, findInput: findInput, request: requestJoin,
    openSkillsView: openSkillsView, openLeaderboard: openLeaderboard, backOverview: backOverview, openPerfBoard: openPerfBoard,
    progToggle: function (id) {
      if (!W._mtProgMode) W._mtProgMode = {};
      var fits = (W._mtOv || {}).fitness || [], f = null;
      for (var i = 0; i < fits.length; i++) if (String(fits[i].id) === String(id)) f = fits[i];
      if (!f || (f.trend || []).filter(function (p) { return p.avg != null; }).length < 2) return;
      W._mtProgMode[id] = ((W._mtProgMode[id] || 'trend') === 'bars') ? 'trend' : 'bars';
      _paintProg();
    },
    ovMark: function (i) { W._mtOvMark = i; renderOverview(); },
    ovSkill: function () { var n = ((W._mtOv || {}).skills || []).length; if (n) { W._mtOvSkill = ((W._mtOvSkill || 0) + 1) % n; renderOverview(); } },
    skillInfo: function (i) {
      // full-bleed sub-view (an openDetailModal popup renders BEHIND the z-100050 team overlay → invisible)
      var s = (W._mtSkills || [])[i], host = document.getElementById('mt-ovbody'); if (!s || !host) return;
      var levels = (s.levels || []).slice().sort(function (a, b) { return a.level_no - b.level_no; });
      var anyDesc = levels.some(function (l) { return l.description && String(l.description).trim(); });
      var html = '<div onclick="FFPMemberTeams.openSkillsView()" style="display:inline-flex;align-items:center;gap:4px;color:var(--muted,#8a99a8);font-size:13px;font-weight:800;cursor:pointer;margin-bottom:14px;"><span class="material-icons" style="font-size:18px;">chevron_left</span>Skills</div>' +
        '<div style="font-size:18px;font-weight:800;color:var(--text,#e8eef4);margin-bottom:4px;">' + esc(s.name) + '</div>' +
        '<div style="font-size:12px;color:var(--muted,#8a99a8);margin-bottom:18px;">Level guide' + (anyDesc ? '' : ' — your coach hasn’t described these levels yet') + '</div>' +
        (levels.length ? levels.map(function (l) {
          var col = SPECTRUM[Math.min(l.level_no, SPECTRUM.length) - 1] || '#8a99a8', isT = s.target_level === l.level_no;
          var desc = (l.description && String(l.description).trim()) ? esc(l.description) : '<span style="color:var(--muted,#8a99a8);">Not described yet.</span>';
          return '<div style="display:flex;gap:11px;margin-bottom:16px;"><div style="width:11px;height:11px;border-radius:50%;background:' + col + ';margin-top:5px;flex:0 0 auto;"></div>' +
            '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:800;color:' + col + ';">' + esc(l.name) + (isT ? ' <span style="color:var(--yellow,#FFCC00);">★ target</span>' : '') + '</div>' +
            '<div style="font-size:12.5px;color:var(--text,#e8eef4);line-height:1.5;margin-top:2px;">' + desc + '</div></div></div>';
        }).join('') : '<div style="color:var(--muted,#8a99a8);">No levels defined.</div>');
      host.innerHTML = html; host.scrollTop = 0;
    } };
})();

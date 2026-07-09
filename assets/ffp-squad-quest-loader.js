/* FFP Squad Quest — member Passport experience (window.FFPSquadQuest) — v2 (2026-07-09)
   A quest flagged is_squad_quest lets members form their own small crews (2-4) and rank crew-vs-crew.
   Joining = REQUEST → the captain (creator) approves. Members can be invited (accept/decline), can LEAVE,
   and the captain can REMOVE members or DISBAND. Full-bleed overlay (NO modal box), Apple/WHOOP: hairlines, NO scrollbars.
   RPCs: squad_leaderboard · member_squad_for_quest · squad_detail · squad_create · squad_request · squad_respond_invite
         · squad_approve · squad_decline · squad_leave · squad_remove · squad_disband · member_search_people. */
(function () {
  'use strict';
  var W = window;
  function sb() { return W.supabase; }
  function memberId() { try { if (W.FFPAuth && FFPAuth.getMember) { var m = FFPAuth.getMember(); if (m && m.id) return m.id; } } catch (e) {} try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}')).id || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function initials(n) { n = String(n || '').trim(); if (!n) return 'S'; var p = n.split(/\s+/); return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function toast(m, t) { try { if (W.showToast) showToast(m, t || 'success'); } catch (e) {} }
  var S = (W._ffpSQ = W._ffpSQ || {});

  function injectStyles() {
    if (document.getElementById('ffp-sq-css')) return;
    var st = document.createElement('style'); st.id = 'ffp-sq-css';
    st.textContent =
      '#ffp-sq-ov{position:fixed;inset:0;z-index:6050;background:#0a1825;display:none;flex-direction:column;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;}' +
      '#ffp-sq-ov.on{display:flex;}' +
      '#ffp-sq-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}' +
      '#ffp-sq-body::-webkit-scrollbar{display:none;width:0;height:0;}' +
      '.sq-wrap{max-width:620px;margin:0 auto;width:100%;box-sizing:border-box;}' +
      '.sq-row{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.07);cursor:pointer;}' +
      '.sq-btn{border:none;border-radius:10px;padding:9px 18px;font-size:13.5px;font-weight:600;font-family:inherit;cursor:pointer;}' +
      '.sq-sm{padding:7px 13px;font-size:12.5px;border-radius:9px;font-weight:600;font-family:inherit;cursor:pointer;border:none;}' +
      '.sq-pri{background:#FFCC00;color:#3a2e00;}.sq-ghost{background:transparent;border:1px solid #35576f;color:#cfe0ee;}' +
      '.sq-danger{background:transparent;border:1px solid #5a2f2f;color:#e79b9b;}' +
      '.sq-inp{width:100%;box-sizing:border-box;background:#0f2334;border:1px solid #1c3c58;border-radius:11px;color:#eaf2f8;font-size:15px;padding:11px 14px;font-family:inherit;}' +
      '.sq-pick{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer;}';
    document.head.appendChild(st);
  }
  function ensureOverlay() {
    var ov = document.getElementById('ffp-sq-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'ffp-sq-ov'; ov.innerHTML = '<div id="ffp-sq-body"></div>'; document.body.appendChild(ov); }
    return ov;
  }
  function paint(html) { var b = document.getElementById('ffp-sq-body'); if (b) { b.innerHTML = '<div class="sq-wrap">' + html + '</div>'; b.scrollTop = 0; } }
  function ord(n) { return n === 1 ? 'st' : (n === 2 ? 'nd' : (n === 3 ? 'rd' : 'th')); }
  function avatar(p, sz) {
    if (p && p.photo) return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:#214b6b center/cover no-repeat;background-image:url(\'' + esc(p.photo) + '\');flex:0 0 auto;"></div>';
    return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:#214b6b;color:#cfe6f5;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + Math.round(sz * 0.36) + 'px;flex:0 0 auto;">' + esc(initials(p && p.name)) + '</div>';
  }

  // ── Place badges: gold TROPHY (1st), silver/bronze MEDAL (2nd/3rd) ──
  function medalDefs() {
    return '<svg width="0" height="0" style="position:absolute;" aria-hidden="true"><defs>' +
      '<radialGradient id="sqmg-gold" cx="38%" cy="30%" r="80%"><stop offset="0%" stop-color="#FFF1B8"/><stop offset="45%" stop-color="#F6C63C"/><stop offset="100%" stop-color="#B77E09"/></radialGradient>' +
      '<radialGradient id="sqmg-silver" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="45%" stop-color="#D6DCE2"/><stop offset="100%" stop-color="#8B96A1"/></radialGradient>' +
      '<radialGradient id="sqmg-bronze" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#F6D0A6"/><stop offset="45%" stop-color="#D28A4C"/><stop offset="100%" stop-color="#8E5220"/></radialGradient>' +
      '<linearGradient id="sqrim-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE58A"/><stop offset="100%" stop-color="#9A6800"/></linearGradient>' +
      '<linearGradient id="sqrim-silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F2F5F8"/><stop offset="100%" stop-color="#79838E"/></linearGradient>' +
      '<linearGradient id="sqrim-bronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#EEBB86"/><stop offset="100%" stop-color="#7C4718"/></linearGradient>' +
      '</defs></svg>';
  }
  function medalSvg(rank, size) {
    var s = 'width="' + (size || 26) + '" height="' + (size || 26) + '" viewBox="0 0 64 64"';
    if (rank === 1) {
      return '<svg ' + s + ' aria-hidden="true">' +
        '<path d="M14 15 C6 15 6 29 19 31" fill="none" stroke="url(#sqrim-gold)" stroke-width="3.6"/>' +
        '<path d="M50 15 C58 15 58 29 45 31" fill="none" stroke="url(#sqrim-gold)" stroke-width="3.6"/>' +
        '<path d="M17 12 H47 V21 C47 32 40.5 39 32 39 C23.5 39 17 32 17 21 Z" fill="url(#sqmg-gold)" stroke="url(#sqrim-gold)" stroke-width="1.4"/>' +
        '<rect x="29.3" y="39" width="5.4" height="8" fill="url(#sqrim-gold)"/>' +
        '<rect x="22" y="47" width="20" height="4" rx="1.5" fill="url(#sqmg-gold)"/>' +
        '<rect x="18.5" y="51.5" width="27" height="5.5" rx="2.4" fill="url(#sqrim-gold)"/></svg>';
    }
    var mg = rank === 2 ? 'silver' : 'bronze', num = rank === 2 ? '#5A646E' : '#5E3413';
    return '<svg ' + s + ' aria-hidden="true">' +
      '<circle cx="32" cy="32" r="26" fill="url(#sqrim-' + mg + ')"/>' +
      '<circle cx="32" cy="32" r="21.5" fill="url(#sqmg-' + mg + ')"/>' +
      '<text x="32" y="41" text-anchor="middle" font-size="26" font-weight="800" fill="' + num + '" font-family="system-ui">' + rank + '</text></svg>';
  }
  function mono(name, sz) {
    return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:' + Math.round(sz * 0.28) + 'px;background:#12314a;color:#2ba8e0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + Math.round(sz * 0.36) + 'px;flex:0 0 auto;">' + esc(initials(name)) + '</div>';
  }

  W.FFPSquadQuest = W.FFPSquadQuest || {};
  W.FFPSquadQuest.open = function (questId, opts) {
    injectStyles(); ensureOverlay().classList.add('on');
    opts = opts || {};
    S.q = questId; S.title = opts.title || 'Squad Quest'; S.max = opts.squadMax || 4;
    paint('<div style="padding:40px 20px;color:#7fa0b8;font-weight:600;">Loading squads…</div>');
    load();
  };
  W.FFPSquadQuest.close = function () { var ov = document.getElementById('ffp-sq-ov'); if (ov) ov.classList.remove('on'); };

  async function load() {
    var me = memberId(); if (!me || !sb()) { paint('<div style="padding:24px 20px;color:#9fc0d4;"><span onclick="FFPSquadQuest.close()" style="cursor:pointer;color:#9fc0d4;font-size:22px;">&times;</span><div style="margin-top:16px;">Sign in to join a squad.</div></div>'); return; }
    S.rows = []; S.mine = null;
    try { var r = await sb().rpc('squad_leaderboard', { p_quest: S.q }); S.rows = (r && r.data) || []; } catch (e) { console.error('[FFP Squad] leaderboard', e); }
    try { var rm = await sb().rpc('member_squad_for_quest', { p_quest: S.q, p_member: me }); S.mine = (rm && rm.data) || null; } catch (e) {}
    renderStandings();
  }

  function renderStandings() {
    var rows = S.rows || [], mine = S.mine, myId = mine && mine.squad_id;
    var head = '<div style="position:relative;padding:16px 20px 18px;background:linear-gradient(160deg,#123a52,#0a1825);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;gap:8px;color:#9fc0d4;font-size:13px;"><span onclick="FFPSquadQuest.close()" style="cursor:pointer;font-size:20px;">&lsaquo;</span> Squad Quest</div>' +
      '<span onclick="FFPSquadQuest.close()" style="cursor:pointer;color:#9fc0d4;font-size:22px;line-height:1;">&times;</span></div>' +
      '<div style="font-size:21px;font-weight:600;color:#f2f7fb;margin-top:12px;">' + esc(S.title) + '</div>';
    if (mine && mine.status === 'invited') {
      head += '<div style="font-size:13px;color:#cfe2ee;margin-top:6px;">You’re invited to <b style="color:#FFCC00;">' + esc(mine.name) + '</b>.</div>' +
        '<div style="display:flex;gap:10px;margin-top:12px;">' +
        '<button class="sq-btn sq-pri" onclick="FFPSquadQuest.respondInvite(\'' + myId + '\',true)">Accept</button>' +
        '<button class="sq-btn sq-ghost" onclick="FFPSquadQuest.respondInvite(\'' + myId + '\',false)">Decline</button></div>';
    } else if (mine && mine.status === 'requested') {
      head += '<div style="font-size:13px;color:#9fc0d4;margin-top:6px;">Request sent to <b style="color:#FFCC00;">' + esc(mine.name) + '</b> — waiting for the captain to approve.</div>';
    } else if (mine) {
      head += '<div style="font-size:12.5px;color:#9fc0d4;margin-top:4px;">Your squad · <b style="color:#FFCC00;cursor:pointer;" onclick="FFPSquadQuest.openSquad(\'' + myId + '\')">' + esc(mine.name) + '</b>' + (mine.owner ? ' · you’re the captain' : '') + '</div>';
    } else {
      head += '<div style="font-size:12.5px;color:#9fc0d4;margin-top:4px;">2–' + S.max + ' of you, one quest. Start yours or ask to join a mate’s.</div>' +
        '<div style="display:flex;gap:10px;margin-top:14px;">' +
        '<button class="sq-btn sq-pri" onclick="FFPSquadQuest.create()">Create</button>' +
        '<button class="sq-btn sq-ghost" onclick="FFPSquadQuest.joinList()">Join</button></div>';
    }
    head += '</div>';

    var pod = '';
    if (rows.length >= 3) {
      var order = [rows[1], rows[0], rows[2]], H = [40, 58, 30], SZ = [50, 58, 50], BZ = [28, 36, 28], RK = [2, 1, 3];
      var cells = order.map(function (x, i) {
        var you = (x.squad_id === myId);
        return '<div style="flex:1;text-align:center;cursor:pointer;min-width:0;" onclick="FFPSquadQuest.openSquad(\'' + x.squad_id + '\')">' +
          '<div style="position:relative;width:' + SZ[i] + 'px;margin:0 auto;">' + '<div style="margin:0 auto;">' + mono(x.name, SZ[i]) + '</div>' +
            '<div style="position:absolute;bottom:-' + (BZ[i] / 2 - 4) + 'px;left:50%;transform:translateX(-50%);">' + medalSvg(RK[i], BZ[i]) + '</div></div>' +
          '<div style="font-size:' + (i === 1 ? 13 : 12) + 'px;font-weight:600;color:' + (you ? '#FFCC00' : '#f2f7fb') + ';margin-top:' + (i === 1 ? 20 : 15) + 'px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(x.name) + '</div>' +
          '<div style="font-size:' + (i === 1 ? 16 : 14) + 'px;font-weight:700;color:' + (i === 1 ? '#FFCC00' : '#fff') + ';">' + Math.round(x.total_points) + '</div>' +
          '<div style="height:' + H[i] + 'px;margin-top:8px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,' + (i === 1 ? '#2f3d2a' : '#26333f') + ',#151d26);"></div></div>';
      }).join('');
      pod = medalDefs() + '<div style="padding:16px 20px 0;"><div style="display:flex;align-items:flex-end;justify-content:center;gap:14px;">' + cells + '</div></div>';
    }
    var listRows = pod ? rows.filter(function (x) { return x.rank > 3; }) : rows;
    var list = listRows.map(function (x) {
      var you = (x.squad_id === myId);
      return '<div class="sq-row" onclick="FFPSquadQuest.openSquad(\'' + x.squad_id + '\')"' + (you ? ' style="border-left:2px solid #FFCC00;margin-left:-16px;padding-left:14px;"' : '') + '>' +
        '<div style="width:18px;text-align:center;font-size:17px;color:' + (you ? '#FFCC00' : '#8aa0b2') + ';">' + x.rank + '</div>' + mono(x.name, 38) +
        '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;color:' + (you ? '#FFCC00' : '#f2f7fb') + ';">' + esc(x.name) + (you ? ' · your squad' : '') + '</div>' +
        '<div style="font-size:12px;color:#6f8ba1;margin-top:1px;">' + x.members + ' member' + (x.members === 1 ? '' : 's') + '</div></div>' +
        '<div style="font-size:19px;font-weight:600;color:' + (you ? '#FFCC00' : '#f2f7fb') + ';">' + Math.round(x.total_points) + '</div></div>';
    }).join('') || '<div style="padding:24px 20px;color:#9fc0d4;">No squads yet — be the first to create one.</div>';

    paint(head + pod +
      '<div style="padding:14px 20px 2px;font-size:11px;font-weight:800;letter-spacing:.8px;color:#8a99a8;text-transform:uppercase;">Squad standings</div>' +
      '<div style="padding:0 20px 8px;">' + list + '</div>' +
      '<div style="padding:2px 20px 28px;color:#5f7688;font-size:11.5px;">Tap a squad to see its crew →</div>');
  }

  // ── CREATE ──
  W.FFPSquadQuest.create = function () { S.pick = {}; S.name = ''; renderCreate(); };
  W.FFPSquadQuest.back = function () { load(); };
  function renderCreate() {
    var picked = Object.keys(S.pick || {}).length;
    var results = (S.searchRows || []).map(function (u) {
      var on = !!(S.pick && S.pick[u.id]);
      return '<div class="sq-pick" onclick="FFPSquadQuest.pick(\'' + u.id + '\',\'' + esc(String(u.name || '').replace(/'/g, '')) + '\')">' + avatar({ photo: u.photo, name: u.name }, 36) +
        '<span style="flex:1;font-size:14.5px;color:#eaf2f8;">' + esc(u.name || 'Member') + '</span>' +
        (on ? '<span style="width:22px;height:22px;border-radius:50%;background:#FFCC00;color:#3a2e00;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;">✓</span>' : '<span style="width:22px;height:22px;border-radius:50%;border:2px solid #3a5064;"></span>') + '</div>';
    }).join('');
    paint('<div style="padding:16px 20px 28px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#7fa0b8;font-weight:600;">New squad · ' + esc(S.title) + '</span><span onclick="FFPSquadQuest.back()" style="cursor:pointer;color:#9fc0d4;font-size:22px;">&times;</span></div>' +
      '<div style="font-size:20px;font-weight:600;color:#f2f7fb;">Name your squad</div>' +
      '<input id="sq-name" class="sq-inp" style="margin-top:12px;" placeholder="e.g. Dawn Patrol" value="' + esc(S.name || '') + '">' +
      '<div style="font-size:10px;font-weight:800;letter-spacing:.8px;color:#8a99a8;text-transform:uppercase;margin:18px 0 8px;">Invite your people · you + ' + picked + ' of ' + (S.max - 1) + ' <span style="font-weight:600;color:#6f8ba1;text-transform:none;letter-spacing:0;">(they’ll get an invite to accept)</span></div>' +
      '<input class="sq-inp" placeholder="Search your connections…" oninput="FFPSquadQuest.search(this.value)" style="margin-bottom:6px;">' +
      '<div>' + (results || '<div style="padding:14px 2px;color:#6f8ba1;font-size:13px;">Search a name to invite.</div>') + '</div>' +
      '<div style="margin-top:18px;"><button class="sq-btn sq-pri" onclick="FFPSquadQuest.submitCreate()">Create squad</button></div>' +
      '</div>');
  }
  W.FFPSquadQuest.search = async function (q) {
    var nm = document.getElementById('sq-name'); if (nm) S.name = nm.value;
    q = String(q || '').trim();
    if (q.length < 2) { S.searchRows = []; renderCreate(); return; }
    try { var r = await sb().rpc('member_search_people', { p_me: memberId(), p_q: q, p_sport: null, p_level: null }); S.searchRows = (r && r.data) || []; } catch (e) { S.searchRows = []; }
    renderCreate();
  };
  W.FFPSquadQuest.pick = function (id, name) {
    S.pick = S.pick || {};
    if (S.pick[id]) { delete S.pick[id]; }
    else { if (Object.keys(S.pick).length >= (S.max - 1)) { toast('Squad is full at ' + S.max, 'error'); return; } S.pick[id] = name || 1; }
    var nm = document.getElementById('sq-name'); if (nm) S.name = nm.value;
    renderCreate();
  };
  W.FFPSquadQuest.submitCreate = async function () {
    var nm = document.getElementById('sq-name'); var name = (nm && nm.value || '').trim();
    if (!name) { toast('Name your squad first', 'error'); return; }
    try {
      await sb().rpc('squad_create', { p_quest: S.q, p_owner: memberId(), p_name: name, p_invite: Object.keys(S.pick || {}) });
      toast('Squad created 🎉'); S.pick = {}; S.name = ''; load();
    } catch (e) { toast((e && e.message) || 'Could not create the squad', 'error'); }
  };

  // ── JOIN (request → captain approves) ──
  W.FFPSquadQuest.joinList = function () {
    var joinable = (S.rows || []).filter(function (x) { return x.members < S.max; });
    var list = joinable.map(function (x) {
      return '<div class="sq-row" style="cursor:default;">' + mono(x.name, 40) +
        '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;color:#f2f7fb;">' + esc(x.name) + '</div>' +
        '<div style="font-size:12px;color:#6f8ba1;margin-top:1px;">' + x.members + ' of ' + S.max + ' · room to join</div></div>' +
        '<button class="sq-sm sq-ghost" onclick="FFPSquadQuest.request(\'' + x.squad_id + '\',\'' + esc(String(x.name || '').replace(/'/g, '')) + '\')">Request</button></div>';
    }).join('') || '<div style="padding:24px 20px;color:#9fc0d4;">No squads with room right now — create your own.</div>';
    paint('<div style="padding:16px 20px 0;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#7fa0b8;font-weight:600;">Ask to join a squad</span><span onclick="FFPSquadQuest.back()" style="cursor:pointer;color:#9fc0d4;font-size:22px;">&times;</span></div>' +
      '<div style="font-size:12.5px;color:#6f8ba1;margin-bottom:8px;">The captain approves your request before you’re in.</div>' + list + '</div>');
  };
  W.FFPSquadQuest.request = async function (squadId, name) {
    try { await sb().rpc('squad_request', { p_squad: squadId, p_member: memberId() }); toast('Request sent to ' + (name || 'the squad')); load(); }
    catch (e) { toast((e && e.message) || 'Could not send the request', 'error'); }
  };
  W.FFPSquadQuest.respondInvite = async function (squadId, accept) {
    try { await sb().rpc('squad_respond_invite', { p_squad: squadId, p_member: memberId(), p_accept: !!accept }); toast(accept ? 'You’re in 🎉' : 'Invite declined'); load(); }
    catch (e) { toast((e && e.message) || 'Could not respond', 'error'); }
  };

  // ── SQUAD DETAIL (+ captain management) ──
  W.FFPSquadQuest.openSquad = async function (squadId) {
    paint('<div style="padding:40px 20px;color:#7fa0b8;font-weight:600;">Loading the squad…</div>');
    var d = {};
    try { var r = await sb().rpc('squad_detail', { p_quest: S.q, p_squad: squadId }); d = (r && r.data) || {}; } catch (e) {}
    S.viewSquad = squadId;
    var me = memberId(), members = (d.members || []), pending = (d.pending || []);
    var amOwner = (d.owner_member_id === me);
    var amMember = amOwner || members.some(function (m) { return m.member_id === me; });
    var mx = Math.max.apply(null, members.map(function (m) { return Number(m.points || 0); }).concat([1]));
    var rows = members.map(function (m) {
      var w = Math.max(4, Math.round(Number(m.points || 0) * 100 / mx));
      var canRemove = amOwner && m.member_id !== me;
      return '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.06);">' + avatar(m, 34) +
        '<div style="flex:1;min-width:0;"><div style="font-size:14.5px;font-weight:500;color:#f2f7fb;">' + esc(m.name || 'Member') + (m.owner ? ' <span style="font-size:10px;color:#9fc0d4;">· captain</span>' : '') + '</div>' +
        '<div style="height:6px;border-radius:4px;background:rgba(255,255,255,.06);margin-top:5px;overflow:hidden;"><div style="width:' + w + '%;height:100%;background:linear-gradient(90deg,#2ba8e0,#1d6a8f);"></div></div></div>' +
        (canRemove ? '<button class="sq-sm sq-danger" onclick="FFPSquadQuest.remove(\'' + squadId + '\',\'' + m.member_id + '\')">Remove</button>' : '<div style="font-size:15px;font-weight:600;color:#f2f7fb;">' + Math.round(m.points || 0) + '</div>') + '</div>';
    }).join('');

    var pendHtml = '';
    if (amOwner && pending.length) {
      pendHtml = '<div style="padding:14px 20px 2px;font-size:11px;font-weight:800;letter-spacing:.8px;color:#8a99a8;text-transform:uppercase;">Requests &amp; invites</div><div style="padding:0 20px;">' +
        pending.map(function (p) {
          var isReq = (p.status === 'requested');
          return '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.06);">' + avatar(p, 34) +
            '<div style="flex:1;min-width:0;font-size:14.5px;color:#eaf2f8;">' + esc(p.name || 'Member') + ' <span style="font-size:11px;color:#8a99a8;">· ' + (isReq ? 'wants to join' : 'invited') + '</span></div>' +
            (isReq ? '<button class="sq-sm sq-pri" onclick="FFPSquadQuest.approve(\'' + squadId + '\',\'' + p.member_id + '\')">Approve</button>' : '') +
            '<button class="sq-sm sq-ghost" style="margin-left:8px;" onclick="FFPSquadQuest.declineReq(\'' + squadId + '\',\'' + p.member_id + '\')">' + (isReq ? 'Decline' : 'Cancel') + '</button></div>';
        }).join('') + '</div>';
    }

    var footer = '';
    if (amOwner) footer = '<div style="padding:20px;"><button class="sq-btn sq-danger" style="width:100%;" onclick="FFPSquadQuest.disband(\'' + squadId + '\')">Disband squad</button></div>';
    else if (amMember) footer = '<div style="padding:20px;"><button class="sq-btn sq-danger" style="width:100%;" onclick="FFPSquadQuest.leave(\'' + squadId + '\')">Leave squad</button></div>';

    paint('<div style="padding:16px 20px 18px;background:linear-gradient(160deg,#123a52,#0a1825);">' +
      '<div style="display:flex;align-items:center;gap:8px;color:#9fc0d4;font-size:13px;margin-bottom:12px;"><span onclick="FFPSquadQuest.back()" style="cursor:pointer;font-size:18px;">&lsaquo;</span> <span onclick="FFPSquadQuest.back()" style="cursor:pointer;">Standings</span></div>' +
      '<div style="display:flex;align-items:center;gap:13px;">' + mono(d.name, 52) +
      '<div style="flex:1;min-width:0;"><div style="font-size:19px;font-weight:600;color:#f2f7fb;">' + esc(d.name || 'Squad') + '</div>' +
      '<div style="font-size:12.5px;color:#9fc0d4;margin-top:2px;">' + members.length + ' in the crew</div></div></div>' +
      '<div style="display:flex;align-items:flex-end;gap:11px;margin-top:14px;"><div style="font-size:38px;font-weight:600;color:#FFCC00;line-height:.9;">' + (d.rank || '–') + '<span style="font-size:15px;">' + ord(d.rank) + '</span></div>' +
      '<div style="padding-bottom:4px;font-size:12.5px;color:#cfe2ee;">' + Math.round(d.total_points || 0) + ' pts together</div></div></div>' +
      '<div style="padding:14px 20px 2px;font-size:11px;font-weight:800;letter-spacing:.8px;color:#8a99a8;text-transform:uppercase;">The crew</div>' +
      '<div style="padding:0 20px;">' + rows + '</div>' + pendHtml + footer);
  };

  function reopen() { if (S.viewSquad) W.FFPSquadQuest.openSquad(S.viewSquad); else load(); }
  W.FFPSquadQuest.approve = async function (sq, m) { try { await sb().rpc('squad_approve', { p_squad: sq, p_member: m, p_owner: memberId() }); toast('Approved'); reopen(); } catch (e) { toast((e && e.message) || 'Could not approve', 'error'); } };
  W.FFPSquadQuest.declineReq = async function (sq, m) { try { await sb().rpc('squad_decline', { p_squad: sq, p_member: m, p_owner: memberId() }); toast('Declined'); reopen(); } catch (e) { toast((e && e.message) || 'Could not decline', 'error'); } };
  W.FFPSquadQuest.remove = async function (sq, m) {
    if (W.ffpConfirm) { var ok = await W.ffpConfirm({ title: 'Remove from squad?', message: 'They’ll be taken out of the squad.', confirmText: 'Remove', danger: true }); if (!ok) return; }
    try { await sb().rpc('squad_remove', { p_squad: sq, p_member: m, p_owner: memberId() }); toast('Removed'); reopen(); } catch (e) { toast((e && e.message) || 'Could not remove', 'error'); }
  };
  W.FFPSquadQuest.leave = async function (sq) {
    if (W.ffpConfirm) { var ok = await W.ffpConfirm({ title: 'Leave this squad?', message: 'You can ask to join again later.', confirmText: 'Leave', danger: true }); if (!ok) return; }
    try { await sb().rpc('squad_leave', { p_squad: sq, p_member: memberId() }); toast('You left the squad'); S.viewSquad = null; load(); } catch (e) { toast((e && e.message) || 'Could not leave', 'error'); }
  };
  W.FFPSquadQuest.disband = async function (sq) {
    if (W.ffpConfirm) { var ok = await W.ffpConfirm({ title: 'Disband squad?', message: 'This removes the squad for everyone. It can’t be undone.', confirmText: 'Disband', danger: true }); if (!ok) return; }
    try { await sb().rpc('squad_disband', { p_squad: sq, p_owner: memberId() }); toast('Squad disbanded'); S.viewSquad = null; load(); } catch (e) { toast((e && e.message) || 'Could not disband', 'error'); }
  };
})();

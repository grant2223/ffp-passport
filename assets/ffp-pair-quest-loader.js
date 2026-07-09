/* FFP Pair Quest — member Passport experience (window.FFPPairQuest) — v1 (2026-07-09)
   The middle tier: Solo → PAIR (2) → Team. A quest flagged is_squad_quest with squad_max<=2 is a PAIR quest:
   invite ONE mate → they accept → you're a pair (auto-named "A & B"). Either can end it. No captain/approvals.
   If a quest sets squad_max>2 the same UI falls back to a small-group flow (create+invite, request→approve, remove, disband).
   Full-bleed overlay, Apple/WHOOP: hairlines, NO scrollbars.
   RPCs: squad_leaderboard · member_squad_for_quest · squad_detail · squad_create · squad_request · squad_respond_invite
         · squad_approve · squad_decline · squad_leave · squad_remove · squad_disband · member_search_people. */
(function () {
  'use strict';
  var W = window;
  function sb() { return W.supabase; }
  function memberId() { try { if (W.FFPAuth && FFPAuth.getMember) { var m = FFPAuth.getMember(); if (m && m.id) return m.id; } } catch (e) {} try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}')).id || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function initials(n) { n = String(n || '').trim(); if (!n) return 'P'; var p = n.split(/\s+/); return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function toast(m, t) { try { if (W.showToast) showToast(m, t || 'success'); } catch (e) {} }
  var S = (W._ffpPair = W._ffpPair || {});
  function NOUN() { return S.pair ? 'pair' : 'squad'; }
  function NOUNC() { return S.pair ? 'Pair' : 'Squad'; }

  function injectStyles() {
    if (document.getElementById('ffp-pr-css')) return;
    var st = document.createElement('style'); st.id = 'ffp-pr-css';
    st.textContent =
      '#ffp-pr-ov{position:fixed;inset:0;z-index:6050;background:#0a1825;display:none;flex-direction:column;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;}' +
      '#ffp-pr-ov.on{display:flex;}' +
      '#ffp-pr-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}' +
      '#ffp-pr-body::-webkit-scrollbar{display:none;width:0;height:0;}' +
      '.pr-wrap{max-width:620px;margin:0 auto;width:100%;box-sizing:border-box;}' +
      '.pr-row{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.07);cursor:pointer;}' +
      '.pr-btn{border:none;border-radius:10px;padding:9px 18px;font-size:13.5px;font-weight:600;font-family:inherit;cursor:pointer;}' +
      '.pr-sm{padding:7px 13px;font-size:12.5px;border-radius:9px;font-weight:600;font-family:inherit;cursor:pointer;border:none;}' +
      '.pr-pri{background:#FFCC00;color:#3a2e00;}.pr-ghost{background:transparent;border:1px solid #35576f;color:#cfe0ee;}' +
      '.pr-danger{background:transparent;border:1px solid #5a2f2f;color:#e79b9b;}' +
      '.pr-inp{width:100%;box-sizing:border-box;background:#0f2334;border:1px solid #1c3c58;border-radius:11px;color:#eaf2f8;font-size:15px;padding:11px 14px;font-family:inherit;}' +
      '.pr-pick{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer;}';
    document.head.appendChild(st);
  }
  function ensureOverlay() {
    var ov = document.getElementById('ffp-pr-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'ffp-pr-ov'; ov.innerHTML = '<div id="ffp-pr-body"></div>'; document.body.appendChild(ov); }
    return ov;
  }
  function paint(html) { var b = document.getElementById('ffp-pr-body'); if (b) { b.innerHTML = '<div class="pr-wrap">' + html + '</div>'; b.scrollTop = 0; } }
  function ord(n) { return n === 1 ? 'st' : (n === 2 ? 'nd' : (n === 3 ? 'rd' : 'th')); }
  function avatar(p, sz) {
    if (p && p.photo) return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:#214b6b center/cover no-repeat;background-image:url(\'' + esc(p.photo) + '\');flex:0 0 auto;"></div>';
    return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:#214b6b;color:#cfe6f5;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + Math.round(sz * 0.36) + 'px;flex:0 0 auto;">' + esc(initials(p && p.name)) + '</div>';
  }
  function mono(name, sz) {
    return '<div style="width:' + sz + 'px;height:' + sz + 'px;border-radius:' + Math.round(sz * 0.28) + 'px;background:#12314a;color:#2ba8e0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + Math.round(sz * 0.32) + 'px;flex:0 0 auto;text-align:center;line-height:1.05;padding:2px;box-sizing:border-box;">' + esc(initials(name)) + '</div>';
  }

  function medalDefs() {
    return '<svg width="0" height="0" style="position:absolute;" aria-hidden="true"><defs>' +
      '<radialGradient id="prmg-gold" cx="38%" cy="30%" r="80%"><stop offset="0%" stop-color="#FFF1B8"/><stop offset="45%" stop-color="#F6C63C"/><stop offset="100%" stop-color="#B77E09"/></radialGradient>' +
      '<radialGradient id="prmg-silver" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="45%" stop-color="#D6DCE2"/><stop offset="100%" stop-color="#8B96A1"/></radialGradient>' +
      '<radialGradient id="prmg-bronze" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#F6D0A6"/><stop offset="45%" stop-color="#D28A4C"/><stop offset="100%" stop-color="#8E5220"/></radialGradient>' +
      '<linearGradient id="prrim-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE58A"/><stop offset="100%" stop-color="#9A6800"/></linearGradient>' +
      '<linearGradient id="prrim-silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F2F5F8"/><stop offset="100%" stop-color="#79838E"/></linearGradient>' +
      '<linearGradient id="prrim-bronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#EEBB86"/><stop offset="100%" stop-color="#7C4718"/></linearGradient>' +
      '</defs></svg>';
  }
  function medalSvg(rank, size) {
    var s = 'width="' + (size || 26) + '" height="' + (size || 26) + '" viewBox="0 0 64 64"';
    if (rank === 1) {
      return '<svg ' + s + ' aria-hidden="true">' +
        '<path d="M14 15 C6 15 6 29 19 31" fill="none" stroke="url(#prrim-gold)" stroke-width="3.6"/>' +
        '<path d="M50 15 C58 15 58 29 45 31" fill="none" stroke="url(#prrim-gold)" stroke-width="3.6"/>' +
        '<path d="M17 12 H47 V21 C47 32 40.5 39 32 39 C23.5 39 17 32 17 21 Z" fill="url(#prmg-gold)" stroke="url(#prrim-gold)" stroke-width="1.4"/>' +
        '<rect x="29.3" y="39" width="5.4" height="8" fill="url(#prrim-gold)"/>' +
        '<rect x="22" y="47" width="20" height="4" rx="1.5" fill="url(#prmg-gold)"/>' +
        '<rect x="18.5" y="51.5" width="27" height="5.5" rx="2.4" fill="url(#prrim-gold)"/></svg>';
    }
    var mg = rank === 2 ? 'silver' : 'bronze', num = rank === 2 ? '#5A646E' : '#5E3413';
    return '<svg ' + s + ' aria-hidden="true">' +
      '<circle cx="32" cy="32" r="26" fill="url(#prrim-' + mg + ')"/>' +
      '<circle cx="32" cy="32" r="21.5" fill="url(#prmg-' + mg + ')"/>' +
      '<text x="32" y="41" text-anchor="middle" font-size="26" font-weight="800" fill="' + num + '" font-family="system-ui">' + rank + '</text></svg>';
  }

  W.FFPPairQuest = W.FFPPairQuest || {};
  W.FFPPairQuest.open = function (questId, opts) {
    injectStyles(); ensureOverlay().classList.add('on');
    opts = opts || {};
    S.q = questId; S.title = opts.title || 'Pair Quest'; S.max = opts.max || opts.squadMax || 2; S.pair = (S.max <= 2);
    paint('<div style="padding:40px 20px;color:#7fa0b8;font-weight:600;">Loading…</div>');
    load();
  };
  W.FFPPairQuest.close = function () { var ov = document.getElementById('ffp-pr-ov'); if (ov) ov.classList.remove('on'); };

  async function load() {
    var me = memberId(); if (!me || !sb()) { paint('<div style="padding:24px 20px;color:#9fc0d4;"><span onclick="FFPPairQuest.close()" style="cursor:pointer;color:#9fc0d4;font-size:22px;">&times;</span><div style="margin-top:16px;">Sign in to pair up.</div></div>'); return; }
    S.rows = []; S.mine = null;
    try { var r = await sb().rpc('squad_leaderboard', { p_quest: S.q }); S.rows = (r && r.data) || []; } catch (e) { console.error('[FFP Pair] leaderboard', e); }
    try { var rm = await sb().rpc('member_squad_for_quest', { p_quest: S.q, p_member: me }); S.mine = (rm && rm.data) || null; } catch (e) {}
    renderStandings();
  }

  function renderStandings() {
    var rows = S.rows || [], mine = S.mine, myId = mine && mine.squad_id, np = S.pair;
    var head = '<div style="position:relative;padding:16px 20px 18px;background:linear-gradient(160deg,#123a52,#0a1825);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;gap:8px;color:#9fc0d4;font-size:13px;"><span onclick="FFPPairQuest.close()" style="cursor:pointer;font-size:20px;">&lsaquo;</span> ' + NOUNC() + ' Quest</div>' +
      '<span onclick="FFPPairQuest.close()" style="cursor:pointer;color:#9fc0d4;font-size:22px;line-height:1;">&times;</span></div>' +
      '<div style="font-size:21px;font-weight:600;color:#f2f7fb;margin-top:12px;">' + esc(S.title) + '</div>';
    if (mine && mine.status === 'invited') {
      head += '<div style="font-size:13px;color:#cfe2ee;margin-top:6px;">You’re invited to ' + (np ? 'pair with' : 'join') + ' <b style="color:#FFCC00;">' + esc(mine.name) + '</b>.</div>' +
        '<div style="display:flex;gap:10px;margin-top:12px;">' +
        '<button class="pr-btn pr-pri" onclick="FFPPairQuest.respondInvite(\'' + myId + '\',true)">Accept</button>' +
        '<button class="pr-btn pr-ghost" onclick="FFPPairQuest.respondInvite(\'' + myId + '\',false)">Decline</button></div>';
    } else if (mine && mine.status === 'requested') {
      head += '<div style="font-size:13px;color:#9fc0d4;margin-top:6px;">Request sent to <b style="color:#FFCC00;">' + esc(mine.name) + '</b> — waiting to be approved.</div>';
    } else if (mine) {
      head += '<div style="font-size:12.5px;color:#9fc0d4;margin-top:4px;">Your ' + NOUN() + ' · <b style="color:#FFCC00;cursor:pointer;" onclick="FFPPairQuest.openSquad(\'' + myId + '\')">' + esc(mine.name) + '</b></div>';
    } else {
      head += '<div style="font-size:12.5px;color:#9fc0d4;margin-top:4px;">' + (np ? 'Team up with one mate and take it on together.' : ('2–' + S.max + ' of you, one quest. Start yours or ask to join.')) + '</div>' +
        '<div style="display:flex;gap:10px;margin-top:14px;">' +
        '<button class="pr-btn pr-pri" onclick="FFPPairQuest.create()">' + (np ? 'Pair up' : 'Create') + '</button>' +
        (np ? '' : '<button class="pr-btn pr-ghost" onclick="FFPPairQuest.joinList()">Join</button>') + '</div>';
    }
    head += '</div>';

    var pod = '';
    if (rows.length >= 3) {
      var order = [rows[1], rows[0], rows[2]], H = [40, 58, 30], SZ = [50, 58, 50], BZ = [28, 36, 28], RK = [2, 1, 3];
      var cells = order.map(function (x, i) {
        var you = (x.squad_id === myId);
        return '<div style="flex:1;text-align:center;cursor:pointer;min-width:0;" onclick="FFPPairQuest.openSquad(\'' + x.squad_id + '\')">' +
          '<div style="position:relative;width:' + SZ[i] + 'px;margin:0 auto;">' + '<div style="margin:0 auto;">' + mono(x.name, SZ[i]) + '</div>' +
            '<div style="position:absolute;bottom:-' + (BZ[i] / 2 - 4) + 'px;left:50%;transform:translateX(-50%);">' + medalSvg(RK[i], BZ[i]) + '</div></div>' +
          '<div style="font-size:' + (i === 1 ? 12.5 : 11.5) + 'px;font-weight:600;color:' + (you ? '#FFCC00' : '#f2f7fb') + ';margin-top:' + (i === 1 ? 20 : 15) + 'px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(x.name) + '</div>' +
          '<div style="font-size:' + (i === 1 ? 16 : 14) + 'px;font-weight:700;color:' + (i === 1 ? '#FFCC00' : '#fff') + ';">' + Math.round(x.total_points) + '</div>' +
          '<div style="height:' + H[i] + 'px;margin-top:8px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,' + (i === 1 ? '#2f3d2a' : '#26333f') + ',#151d26);"></div></div>';
      }).join('');
      pod = medalDefs() + '<div style="padding:16px 20px 0;"><div style="display:flex;align-items:flex-end;justify-content:center;gap:14px;">' + cells + '</div></div>';
    }
    var listRows = pod ? rows.filter(function (x) { return x.rank > 3; }) : rows;
    var list = listRows.map(function (x) {
      var you = (x.squad_id === myId);
      return '<div class="pr-row" onclick="FFPPairQuest.openSquad(\'' + x.squad_id + '\')"' + (you ? ' style="border-left:2px solid #FFCC00;margin-left:-16px;padding-left:14px;"' : '') + '>' +
        '<div style="width:18px;text-align:center;font-size:17px;color:' + (you ? '#FFCC00' : '#8aa0b2') + ';">' + x.rank + '</div>' + mono(x.name, 38) +
        '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;color:' + (you ? '#FFCC00' : '#f2f7fb') + ';">' + esc(x.name) + (you ? ' · yours' : '') + '</div>' +
        '<div style="font-size:12px;color:#6f8ba1;margin-top:1px;">' + x.members + (np ? '' : (' member' + (x.members === 1 ? '' : 's'))) + (np ? ' paired' : '') + '</div></div>' +
        '<div style="font-size:19px;font-weight:600;color:' + (you ? '#FFCC00' : '#f2f7fb') + ';">' + Math.round(x.total_points) + '</div></div>';
    }).join('') || '<div style="padding:24px 20px;color:#9fc0d4;">No ' + NOUN() + 's yet — be the first.</div>';

    paint(head + pod +
      '<div style="padding:14px 20px 2px;font-size:11px;font-weight:800;letter-spacing:.8px;color:#8a99a8;text-transform:uppercase;">' + NOUNC() + ' standings</div>' +
      '<div style="padding:0 20px 8px;">' + list + '</div>' +
      '<div style="padding:2px 20px 28px;color:#5f7688;font-size:11.5px;">Tap to see the ' + NOUN() + ' →</div>');
  }

  // ── CREATE / PAIR UP ──
  W.FFPPairQuest.create = function () { S.pick = {}; S.name = ''; renderCreate(); };
  W.FFPPairQuest.back = function () { load(); };
  function renderCreate() {
    var np = S.pair, picked = Object.keys(S.pick || {}).length, cap = S.max - 1;
    var results = (S.searchRows || []).map(function (u) {
      var on = !!(S.pick && S.pick[u.id]);
      return '<div class="pr-pick" onclick="FFPPairQuest.pick(\'' + u.id + '\',\'' + esc(String(u.name || '').replace(/'/g, '')) + '\')">' + avatar({ photo: u.photo, name: u.name }, 36) +
        '<span style="flex:1;font-size:14.5px;color:#eaf2f8;">' + esc(u.name || 'Member') + '</span>' +
        (on ? '<span style="width:22px;height:22px;border-radius:50%;background:#FFCC00;color:#3a2e00;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;">✓</span>' : '<span style="width:22px;height:22px;border-radius:50%;border:2px solid #3a5064;"></span>') + '</div>';
    }).join('');
    paint('<div style="padding:16px 20px 28px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#7fa0b8;font-weight:600;">New ' + NOUN() + ' · ' + esc(S.title) + '</span><span onclick="FFPPairQuest.back()" style="cursor:pointer;color:#9fc0d4;font-size:22px;">&times;</span></div>' +
      (np ? '<div style="font-size:20px;font-weight:600;color:#f2f7fb;">Pick your partner</div><div style="font-size:13px;color:#9fb4c4;margin-top:6px;">Choose one mate — they’ll get an invite to accept.</div>'
          : ('<div style="font-size:20px;font-weight:600;color:#f2f7fb;">Name your squad</div><input id="pr-name" class="pr-inp" style="margin-top:12px;" placeholder="e.g. Dawn Patrol" value="' + esc(S.name || '') + '">' +
             '<div style="font-size:10px;font-weight:800;letter-spacing:.8px;color:#8a99a8;text-transform:uppercase;margin:18px 0 4px;">Invite your people · you + ' + picked + ' of ' + cap + '</div>')) +
      (np ? '<div style="height:14px;"></div>' : '') +
      '<input class="pr-inp" placeholder="Search your connections…" oninput="FFPPairQuest.search(this.value)" style="margin-bottom:6px;">' +
      '<div>' + (results || '<div style="padding:14px 2px;color:#6f8ba1;font-size:13px;">Search a name to invite.</div>') + '</div>' +
      '<div style="margin-top:18px;"><button class="pr-btn pr-pri" onclick="FFPPairQuest.submitCreate()">' + (np ? 'Send invite' : 'Create squad') + '</button></div>' +
      '</div>');
  }
  W.FFPPairQuest.search = async function (q) {
    var nm = document.getElementById('pr-name'); if (nm) S.name = nm.value;
    q = String(q || '').trim();
    if (q.length < 2) { S.searchRows = []; renderCreate(); return; }
    try { var r = await sb().rpc('member_search_people', { p_me: memberId(), p_q: q, p_sport: null, p_level: null }); S.searchRows = (r && r.data) || []; } catch (e) { S.searchRows = []; }
    renderCreate();
  };
  W.FFPPairQuest.pick = function (id, name) {
    S.pick = S.pick || {};
    if (S.pick[id]) { delete S.pick[id]; }
    else {
      if (S.pair) { S.pick = {}; }
      else if (Object.keys(S.pick).length >= (S.max - 1)) { toast('Full at ' + S.max, 'error'); return; }
      S.pick[id] = name || 1;
    }
    var nm = document.getElementById('pr-name'); if (nm) S.name = nm.value;
    renderCreate();
  };
  W.FFPPairQuest.submitCreate = async function () {
    var ids = Object.keys(S.pick || {});
    if (S.pair && !ids.length) { toast('Pick your partner first', 'error'); return; }
    var name = null;
    if (!S.pair) { var nm = document.getElementById('pr-name'); name = (nm && nm.value || '').trim(); if (!name) { toast('Name your squad first', 'error'); return; } }
    try {
      await sb().rpc('squad_create', { p_quest: S.q, p_owner: memberId(), p_name: name, p_invite: ids });
      toast(S.pair ? 'Invite sent 🎉' : 'Squad created 🎉'); S.pick = {}; S.name = ''; load();
    } catch (e) { toast((e && e.message) || 'Could not create', 'error'); }
  };

  // ── JOIN (group only: request → approve) ──
  W.FFPPairQuest.joinList = function () {
    var joinable = (S.rows || []).filter(function (x) { return x.members < S.max; });
    var list = joinable.map(function (x) {
      return '<div class="pr-row" style="cursor:default;">' + mono(x.name, 40) +
        '<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;color:#f2f7fb;">' + esc(x.name) + '</div>' +
        '<div style="font-size:12px;color:#6f8ba1;margin-top:1px;">' + x.members + ' of ' + S.max + ' · room to join</div></div>' +
        '<button class="pr-sm pr-ghost" onclick="FFPPairQuest.request(\'' + x.squad_id + '\',\'' + esc(String(x.name || '').replace(/'/g, '')) + '\')">Request</button></div>';
    }).join('') || '<div style="padding:24px 20px;color:#9fc0d4;">No squads with room — create your own.</div>';
    paint('<div style="padding:16px 20px 0;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#7fa0b8;font-weight:600;">Ask to join</span><span onclick="FFPPairQuest.back()" style="cursor:pointer;color:#9fc0d4;font-size:22px;">&times;</span></div>' +
      '<div style="font-size:12.5px;color:#6f8ba1;margin-bottom:8px;">The captain approves before you’re in.</div>' + list + '</div>');
  };
  W.FFPPairQuest.request = async function (id, name) {
    try { await sb().rpc('squad_request', { p_squad: id, p_member: memberId() }); toast('Request sent to ' + (name || 'the squad')); load(); }
    catch (e) { toast((e && e.message) || 'Could not send the request', 'error'); }
  };
  W.FFPPairQuest.respondInvite = async function (id, accept) {
    try { await sb().rpc('squad_respond_invite', { p_squad: id, p_member: memberId(), p_accept: !!accept }); toast(accept ? 'You’re in 🎉' : 'Invite declined'); load(); }
    catch (e) { toast((e && e.message) || 'Could not respond', 'error'); }
  };

  // ── DETAIL (+ management) ──
  W.FFPPairQuest.openSquad = async function (squadId) {
    paint('<div style="padding:40px 20px;color:#7fa0b8;font-weight:600;">Loading…</div>');
    var d = {};
    try { var r = await sb().rpc('squad_detail', { p_quest: S.q, p_squad: squadId }); d = (r && r.data) || {}; } catch (e) {}
    S.viewSquad = squadId;
    var me = memberId(), members = (d.members || []), pending = (d.pending || []), np = S.pair;
    var amOwner = (d.owner_member_id === me);
    var amMember = amOwner || members.some(function (m) { return m.member_id === me; });
    var mx = Math.max.apply(null, members.map(function (m) { return Number(m.points || 0); }).concat([1]));
    var rows = members.map(function (m) {
      var w = Math.max(4, Math.round(Number(m.points || 0) * 100 / mx));
      var canRemove = !np && amOwner && m.member_id !== me;
      return '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.06);">' + avatar(m, 34) +
        '<div style="flex:1;min-width:0;"><div style="font-size:14.5px;font-weight:500;color:#f2f7fb;">' + esc(m.name || 'Member') + (m.owner && !np ? ' <span style="font-size:10px;color:#9fc0d4;">· captain</span>' : '') + '</div>' +
        '<div style="height:6px;border-radius:4px;background:rgba(255,255,255,.06);margin-top:5px;overflow:hidden;"><div style="width:' + w + '%;height:100%;background:linear-gradient(90deg,#2ba8e0,#1d6a8f);"></div></div></div>' +
        (canRemove ? '<button class="pr-sm pr-danger" onclick="FFPPairQuest.remove(\'' + squadId + '\',\'' + m.member_id + '\')">Remove</button>' : '<div style="font-size:15px;font-weight:600;color:#f2f7fb;">' + Math.round(m.points || 0) + '</div>') + '</div>';
    }).join('');

    var pendHtml = '';
    if (amOwner && pending.length) {
      pendHtml = '<div style="padding:14px 20px 2px;font-size:11px;font-weight:800;letter-spacing:.8px;color:#8a99a8;text-transform:uppercase;">' + (np ? 'Invite' : 'Requests &amp; invites') + '</div><div style="padding:0 20px;">' +
        pending.map(function (p) {
          var isReq = (p.status === 'requested');
          return '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.06);">' + avatar(p, 34) +
            '<div style="flex:1;min-width:0;font-size:14.5px;color:#eaf2f8;">' + esc(p.name || 'Member') + ' <span style="font-size:11px;color:#8a99a8;">· ' + (isReq ? 'wants to join' : 'invited · waiting') + '</span></div>' +
            (isReq ? '<button class="pr-sm pr-pri" onclick="FFPPairQuest.approve(\'' + squadId + '\',\'' + p.member_id + '\')">Approve</button>' : '') +
            '<button class="pr-sm pr-ghost" style="margin-left:8px;" onclick="FFPPairQuest.declineReq(\'' + squadId + '\',\'' + p.member_id + '\')">' + (isReq ? 'Decline' : 'Cancel') + '</button></div>';
        }).join('') + '</div>';
    }

    var footer = '';
    if (amOwner) footer = '<div style="padding:20px;"><button class="pr-btn pr-danger" style="width:100%;" onclick="FFPPairQuest.disband(\'' + squadId + '\')">' + (np ? 'End pair' : 'Disband squad') + '</button></div>';
    else if (amMember) footer = '<div style="padding:20px;"><button class="pr-btn pr-danger" style="width:100%;" onclick="FFPPairQuest.leave(\'' + squadId + '\')">Leave ' + NOUN() + '</button></div>';

    paint('<div style="padding:16px 20px 18px;background:linear-gradient(160deg,#123a52,#0a1825);">' +
      '<div style="display:flex;align-items:center;gap:8px;color:#9fc0d4;font-size:13px;margin-bottom:12px;"><span onclick="FFPPairQuest.back()" style="cursor:pointer;font-size:18px;">&lsaquo;</span> <span onclick="FFPPairQuest.back()" style="cursor:pointer;">Standings</span></div>' +
      '<div style="display:flex;align-items:center;gap:13px;">' + mono(d.name, 52) +
      '<div style="flex:1;min-width:0;"><div style="font-size:19px;font-weight:600;color:#f2f7fb;">' + esc(d.name || NOUNC()) + '</div>' +
      '<div style="font-size:12.5px;color:#9fc0d4;margin-top:2px;">' + members.length + (np ? ' paired' : ' in the crew') + '</div></div></div>' +
      '<div style="display:flex;align-items:flex-end;gap:11px;margin-top:14px;"><div style="font-size:38px;font-weight:600;color:#FFCC00;line-height:.9;">' + (d.rank || '–') + '<span style="font-size:15px;">' + ord(d.rank) + '</span></div>' +
      '<div style="padding-bottom:4px;font-size:12.5px;color:#cfe2ee;">' + Math.round(d.total_points || 0) + ' pts together</div></div></div>' +
      '<div style="padding:14px 20px 2px;font-size:11px;font-weight:800;letter-spacing:.8px;color:#8a99a8;text-transform:uppercase;">' + (np ? 'The pair' : 'The crew') + '</div>' +
      '<div style="padding:0 20px;">' + rows + '</div>' + pendHtml + footer);
  };

  function reopen() { if (S.viewSquad) W.FFPPairQuest.openSquad(S.viewSquad); else load(); }
  W.FFPPairQuest.approve = async function (sq, m) { try { await sb().rpc('squad_approve', { p_squad: sq, p_member: m, p_owner: memberId() }); toast('Approved'); reopen(); } catch (e) { toast((e && e.message) || 'Could not approve', 'error'); } };
  W.FFPPairQuest.declineReq = async function (sq, m) { try { await sb().rpc('squad_decline', { p_squad: sq, p_member: m, p_owner: memberId() }); toast('Done'); reopen(); } catch (e) { toast((e && e.message) || 'Could not update', 'error'); } };
  W.FFPPairQuest.remove = async function (sq, m) {
    if (W.ffpConfirm) { var ok = await W.ffpConfirm({ title: 'Remove from squad?', message: 'They’ll be taken out.', confirmText: 'Remove', danger: true }); if (!ok) return; }
    try { await sb().rpc('squad_remove', { p_squad: sq, p_member: m, p_owner: memberId() }); toast('Removed'); reopen(); } catch (e) { toast((e && e.message) || 'Could not remove', 'error'); }
  };
  W.FFPPairQuest.leave = async function (sq) {
    if (W.ffpConfirm) { var ok = await W.ffpConfirm({ title: 'Leave this ' + NOUN() + '?', message: 'You can pair up again later.', confirmText: 'Leave', danger: true }); if (!ok) return; }
    try { await sb().rpc('squad_leave', { p_squad: sq, p_member: memberId() }); toast('You left'); S.viewSquad = null; load(); } catch (e) { toast((e && e.message) || 'Could not leave', 'error'); }
  };
  W.FFPPairQuest.disband = async function (sq) {
    var np = S.pair;
    if (W.ffpConfirm) { var ok = await W.ffpConfirm({ title: np ? 'End this pair?' : 'Disband squad?', message: np ? 'This ends the pair for both of you.' : 'This removes the squad for everyone.', confirmText: np ? 'End pair' : 'Disband', danger: true }); if (!ok) return; }
    try { await sb().rpc('squad_disband', { p_squad: sq, p_owner: memberId() }); toast(np ? 'Pair ended' : 'Squad disbanded'); S.viewSquad = null; load(); } catch (e) { toast((e && e.message) || 'Could not end', 'error'); }
  };
})();

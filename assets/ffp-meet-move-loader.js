/* FFP Meet & Move Loader — v6
   v6 (2026-05-29): re-inject Your circle after every panel render so it can't be wiped.
   v5 (2026-05-29):
   - YOUR CIRCLE: shows members you've connected with (accepted) + incoming
     connect requests (Accept / Ignore). From a connection: "Invite to a meet-up".
     Data from /api/connections/:id. Injected below the match strip.
   v4: real matching strip (/api/members/:id/matches) + empty states; no fake meetups.
   v3: FFPAuth.getMember() instead of supabase.auth.getUser().
*/
(function () {
  'use strict';
  var API = 'https://ffp-passport-backend.vercel.app';
  var retries = 0;
  var MAX_RETRIES = 30;
  var currentUserId = null;
  var wrapped = false;
  var circleData = { friends: [], incoming: [] };
  var renderWrapped = false;

  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function injectStyles() {
    if (document.getElementById('ffp-meet-move-loader-styles')) return;
    var s = document.createElement('style');
    s.id = 'ffp-meet-move-loader-styles';
    s.textContent = [
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}',
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}',
      '.dm-cover.ffp-img-cover{background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;}',
      '#ffp-circle{margin:16px 0 22px;}',
      '#ffp-circle .cir-card{background:rgba(15,30,46,0.6);border:1px solid var(--border-mid,rgba(43,168,224,0.2));border-radius:14px;padding:16px;}',
      '#ffp-circle .cir-head{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:var(--text,#e8eef4);margin-bottom:4px;}',
      '#ffp-circle .cir-head .material-icons{color:var(--yellow,#FFCC00);font-size:18px;}',
      '#ffp-circle .cir-pill{font-size:11px;font-weight:800;background:rgba(43,168,224,0.2);color:var(--blue,#2ba8e0);border-radius:20px;padding:2px 8px;}',
      '#ffp-circle .cir-sub{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--muted,#8a99a8);margin:14px 0 8px;}',
      '#ffp-circle .cir-row{display:flex;align-items:center;gap:11px;padding:8px 0;border-top:1px solid rgba(255,255,255,0.05);}',
      '#ffp-circle .cir-av{width:38px;height:38px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--blue-dk,#1980AD),var(--blue,#2ba8e0));color:#fff;font-weight:800;font-size:15px;}',
      '#ffp-circle .cir-name{flex:1;min-width:0;font-size:13px;font-weight:800;color:var(--text,#e8eef4);}',
      '#ffp-circle .cir-city{font-size:11px;font-weight:600;color:var(--muted,#8a99a8);margin-top:1px;}',
      '#ffp-circle .cir-acts{display:flex;gap:6px;flex-shrink:0;}',
      '#ffp-circle .cir-btn{border:none;border-radius:8px;padding:7px 11px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;}',
      '#ffp-circle .cir-btn.yellow{background:var(--yellow,#FFCC00);color:#000;}',
      '#ffp-circle .cir-btn.blue{background:var(--blue,#2ba8e0);color:#fff;}',
      '#ffp-circle .cir-btn.ghost{background:rgba(255,255,255,0.08);color:var(--text,#e8eef4);}',
      '#ffp-circle .cir-empty{font-size:12px;color:var(--muted,#8a99a8);padding:6px 0;line-height:1.5;}'
    ].join('');
    document.head.appendChild(s);
  }

  var SPORT_META = {
    Padel:{cat:'racquet',icon:'sports_tennis',img:'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&q=70'},
    Tennis:{cat:'racquet',icon:'sports_tennis',img:'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&q=70'},
    Running:{cat:'running',icon:'directions_run',img:'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=400&q=70'},
    Yoga:{cat:'mind-body',icon:'self_improvement',img:'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&q=70'},
    Pilates:{cat:'mind-body',icon:'self_improvement',img:'https://images.unsplash.com/photo-1591291621164-2c6367723315?w=400&q=70'},
    Fitness:{cat:'fitness',icon:'fitness_center',img:'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=400&q=70'},
    HIIT:{cat:'fitness',icon:'fitness_center',img:'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=400&q=70'},
    Swimming:{cat:'swimming',icon:'pool',img:'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&q=70'},
    Hiking:{cat:'adventure',icon:'hiking',img:'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=70'},
    Boxing:{cat:'combat',icon:'sports_mma',img:'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&q=70'}
  };
  function metaForSport(sport) { return SPORT_META[sport] || { cat: 'fitness', icon: 'fitness_center', img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=400&q=70' }; }
  function genderMap(dbVal) { if (dbVal === 'women_only') return 'women'; if (dbVal === 'men_only') return 'men'; return 'any'; }
  function fmtWhen(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var dn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var hr = d.getHours(), min = d.getMinutes(), ap = hr >= 12 ? 'PM' : 'AM'; hr = hr % 12; if (hr === 0) hr = 12;
    return dn[d.getDay()] + ' · ' + d.getDate() + ' ' + mn[d.getMonth()] + ' · ' + hr + ':' + String(min).padStart(2, '0') + ' ' + ap;
  }
  function memberDisplayName(m) { if (!m) return 'Member'; if (m.given_names) return m.given_names + (m.surname ? ' ' + m.surname.charAt(0).toUpperCase() + '.' : ''); return m.full_name || 'Member'; }
  function memberLetter(m) { if (!m) return 'M'; var src = m.given_names || m.full_name || 'M'; return src.charAt(0).toUpperCase(); }

  // ── MATCHING ──
  async function loadMatches() {
    if (typeof MeetMove === 'undefined' || !currentUserId) return;
    try {
      var res = await fetch(API + '/api/members/' + currentUserId + '/matches');
      var json = await res.json();
      var matches = (json && json.matches) ? json.matches : [];
      matches.forEach(function (mm) { (mm.matchSports || []).forEach(function (ms) { ms.icon = metaForSport(ms.sport).icon; }); });
      MeetMove.matches = matches;
    } catch (e) { MeetMove.matches = []; console.error('[FFP Meet & Move] matches:', e); }
    if (typeof MeetMove.renderMatchStrip === 'function') { try { MeetMove.renderMatchStrip(); } catch (e) {} }
    var scroll = document.getElementById('meet-match-scroll');
    if (scroll && (!MeetMove.matches || MeetMove.matches.length === 0)) {
      scroll.innerHTML = '<div style="padding:14px 4px;color:var(--muted);font-size:12px;line-height:1.5;">More members are joining — people who match your sports and interests will show up here as the community grows.</div>';
    }
  }

  // ── YOUR CIRCLE (connections) ──
  function avatarHtml(p) {
    return p.photo
      ? '<div class="cir-av" style="background:#0a1825 url(\'' + esc(p.photo) + '\') center/cover;"></div>'
      : '<div class="cir-av">' + esc((p.name || 'M').charAt(0).toUpperCase()) + '</div>';
  }
  function renderCircle() {
    var panel = document.getElementById('panel-meet-move');
    if (!panel) return;
    var host = document.getElementById('ffp-circle');
    if (!host) {
      host = document.createElement('div'); host.id = 'ffp-circle';
      var ms = document.getElementById('meet-match-scroll');
      var sec = ms && (ms.closest ? ms.closest('.match-section') : null);
      sec = sec || (ms && ms.parentNode);
      if (sec && sec.parentNode) sec.parentNode.insertBefore(host, sec.nextSibling);
      else panel.insertBefore(host, panel.firstChild);
    }
    var inc = circleData.incoming || [], fr = circleData.friends || [];
    var incHtml = inc.length ? '<div class="cir-sub">Requests to connect</div>' + inc.map(function (p) {
      return '<div class="cir-row">' + avatarHtml(p) + '<div class="cir-name">' + esc(p.name) + '</div>' +
        '<div class="cir-acts"><button class="cir-btn ghost" onclick="FFPCircle.decline(\'' + p.id + '\')">Ignore</button>' +
        '<button class="cir-btn yellow" onclick="FFPCircle.accept(\'' + p.id + '\')">Accept</button></div></div>';
    }).join('') : '';
    var frHtml = fr.length ? fr.map(function (p) {
      return '<div class="cir-row">' + avatarHtml(p) +
        '<div class="cir-name">' + esc(p.name) + (p.city ? '<div class="cir-city">' + esc(p.city) + '</div>' : '') + '</div>' +
        '<div class="cir-acts"><button class="cir-btn blue" onclick="FFPCircle.invite(\'' + p.id + '\')">Invite to a meet-up</button></div></div>';
    }).join('') : '<div class="cir-empty">No connections yet — tap a match above and Request to connect to build your circle.</div>';
    host.innerHTML = '<div class="cir-card"><div class="cir-head"><span class="material-icons">group</span> Your circle' +
      (fr.length ? ' <span class="cir-pill">' + fr.length + '</span>' : '') + '</div>' +
      incHtml + '<div class="cir-sub">Connected</div>' + frHtml + '</div>';
  }
  async function loadConnections() {
    if (!currentUserId) return;
    try {
      var res = await fetch(API + '/api/connections/' + currentUserId);
      var json = await res.json();
      circleData = { friends: (json && json.friends) || [], incoming: (json && json.incoming) || [] };
    } catch (e) { circleData = { friends: [], incoming: [] }; }
    renderCircle();
  }
  async function respond(requesterId, accept) {
    if (!currentUserId) return;
    try {
      await fetch(API + '/api/connections/respond', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: currentUserId, requester_id: requesterId, accept: accept })
      });
    } catch (e) {}
    await loadConnections();
  }
  window.FFPCircle = {
    accept: function (id) { if (typeof showToast === 'function') showToast('Connected'); respond(id, true); },
    decline: function (id) { respond(id, false); },
    invite: function (id) { if (window.MeetMove && typeof MeetMove.openPostForm === 'function') MeetMove.openPostForm(); },
    reload: loadConnections
  };

  function wrapRender() {
    if (renderWrapped || typeof MeetMove === 'undefined' || typeof MeetMove.render !== 'function') return;
    renderWrapped = true;
    var origRender = MeetMove.render.bind(MeetMove);
    MeetMove.render = function () { origRender(); try { renderCircle(); } catch (e) {} };
  }

  async function loadFromSupabase() {
    if (!window.supabase || typeof MeetMove === 'undefined') {
      if (retries < MAX_RETRIES) { retries++; setTimeout(loadFromSupabase, 200); }
      return;
    }
    injectStyles();
    try {
      var member = window.FFPAuth && window.FFPAuth.getMember();
      if (!member || !member.id) { console.log('[FFP Meet & Move] No FFP member'); return; }
      currentUserId = member.id;
      wrapRender();

      await loadMatches();
      await loadConnections();

      var mRes = await window.supabase.from('meetups').select('*').in('status', ['open', 'full']);
      if (mRes.error) { console.error('[FFP Meet & Move] meetups read:', mRes.error); return; }
      var meetups = mRes.data || [];
      if (meetups.length === 0) {
        MeetMove.data = [];
        var p0 = document.getElementById('panel-meet-move');
        if (p0 && typeof MeetMove.render === 'function') { try { MeetMove.render(); } catch (e) {} }
        console.log('[FFP Meet & Move] No meetups — empty state');
        return;
      }

      var hostIds = Array.from(new Set(meetups.map(function (m) { return m.host_member_id; }).filter(Boolean)));
      var hostMap = {};
      if (hostIds.length) {
        var hRes = await window.supabase.from('members').select('id, full_name, given_names, surname').in('id', hostIds);
        (hRes.data || []).forEach(function (m) { hostMap[m.id] = m; });
      }
      var trustMap = {};
      if (hostIds.length) {
        var tRes = await window.supabase.from('profile_meta').select('member_id, reliability_score').in('member_id', hostIds);
        if (!tRes.error) (tRes.data || []).forEach(function (p) { if (p.reliability_score != null) trustMap[p.member_id] = Number(p.reliability_score); });
      }
      var myAttRes = await window.supabase.from('meetup_attendees').select('meetup_id, status').eq('member_id', currentUserId).in('status', ['joined', 'attended']);
      var joinedSet = new Set((myAttRes.data || []).map(function (r) { return r.meetup_id; }));
      var meetupIds = meetups.map(function (m) { return m.id; });
      var countMap = {};
      if (meetupIds.length) {
        var aRes = await window.supabase.from('meetup_attendees').select('meetup_id').in('meetup_id', meetupIds).in('status', ['joined', 'attended']);
        (aRes.data || []).forEach(function (r) { countMap[r.meetup_id] = (countMap[r.meetup_id] || 0) + 1; });
      }
      MeetMove.data = meetups.map(function (m) {
        var host = hostMap[m.host_member_id] || null;
        var meta = metaForSport(m.sport);
        var isHostedByMe = m.host_member_id === currentUserId;
        return {
          id: m.id, activity: m.title || m.sport || 'Meetup', cat: meta.cat, icon: meta.icon,
          host: memberDisplayName(host), hostInitial: memberLetter(host),
          hostTrust: trustMap[m.host_member_id] != null ? trustMap[m.host_member_id] : 9.0,
          when: fmtWhen(m.meets_at), whenSlot: 'this-week', venue: m.venue || '', area: m.city || '',
          capacity: m.max_people || 8, joined: 1 + (countMap[m.id] || 0), level: m.fitness_level || 'All',
          gender: genderMap(m.group_filter), cost: 'Free',
          joinedByMe: joinedSet.has(m.id) || isHostedByMe, isHostedByMe: isHostedByMe,
          host_member_id: m.host_member_id, full: m.status === 'full',
          about: m.description || 'Member-hosted meetup.', img: meta.img
        };
      });
      installOverrides();
      wrapWrites();
      var panel = document.getElementById('panel-meet-move');
      if (panel && panel.classList.contains('active') && typeof MeetMove.render === 'function') MeetMove.render();
      console.log('[FFP Meet & Move] Loaded ' + MeetMove.data.length + ' meetups ✓');
    } catch (err) { console.error('[FFP Meet & Move] Unexpected error:', err); }
  }

  function installOverrides() {
    var orig = MeetMove.openMeetupDetail.bind(MeetMove);
    MeetMove.openMeetupDetail = function (id) {
      orig(id);
      var m = this.data.find(function (x) { return x.id === id; });
      if (!m) return;
      setTimeout(function () {
        var cover = document.querySelector('.dm-cover');
        if (cover && m.img) { cover.classList.add('ffp-img-cover'); cover.style.backgroundImage = "url('" + m.img + "')"; }
        if (m.isHostedByMe) {
          var btn = document.querySelector('.dm-footer .btn-primary-yellow');
          if (btn) { btn.textContent = "You're hosting this"; btn.disabled = true; btn.onclick = function (e) { e.preventDefault(); }; btn.style.opacity = '0.7'; btn.style.cursor = 'default'; }
          var note = document.querySelector('.dm-footer-note');
          if (note) note.textContent = 'Members request to join. Approve them in your hosted list.';
        }
      }, 0);
    };
  }

  function wrapWrites() {
    if (wrapped) return;
    wrapped = true;
    var origRequestJoin = MeetMove.requestJoin.bind(MeetMove);
    MeetMove.requestJoin = async function (id) {
      var m = this.data.find(function (x) { return x.id === id; });
      if (!m) return;
      if (m.isHostedByMe) { if (typeof showToast === 'function') showToast("You're hosting this meetup"); return; }
      if (m.joinedByMe) return origRequestJoin(id);
      origRequestJoin(id);
      if (!currentUserId) return;
      try {
        var res = await window.supabase.from('meetup_attendees').insert({ meetup_id: id, member_id: currentUserId, status: 'joined', created_at: new Date().toISOString() });
        if (res.error) console.error('[FFP Meet & Move] RSVP insert:', res.error);
      } catch (e) { console.error('[FFP Meet & Move] RSVP insert:', e); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(loadFromSupabase, 400); });
  } else {
    setTimeout(loadFromSupabase, 400);
  }
  window.ffpReloadMeetMove = loadFromSupabase;
})();

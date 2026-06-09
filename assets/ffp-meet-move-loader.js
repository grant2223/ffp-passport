/* FFP Meet & Move Loader — v24
   v24 (2026-06-04): REQUEST → HOST APPROVAL flow. Joining a meet-up no longer auto-confirms. requestJoin
       now sets the member PENDING (join_meetup returns 'pending') + emails the HOST ({kind:'request'}) —
       NOT the old auto-confirm email. New MeetMove.approveRequest(host_approve_attendee RPC) confirms a
       pending member + emails THEM ({kind:'confirm'}). Loader now also fetches the member's pending rows
       (pendingByMe) and each host meetup's pending queue (pendingRequests); host detail modal shows a
       "Requests to join (N)" section with Approve buttons. Pending never counts toward 'who's going'.
   v23 (2026-06-04): republished to overwrite a STALE/broken deployed copy (was throwing "Unexpected
       identifier 'the' at line 2" → MeetMove.data never populated → Discover empty). Deploy with the
       dashboard FFP_BUILD bump so the browser fetches the corrected loader, not the cache.
   v22 (2026-06-04): FIX — Who's-going host/attendee passports were invisible to non-admin members.
       The host + attendee profile fetches used a direct from('members').select, but members RLS is
       self/admin-only — so a regular member couldn't read others' rows (host saw no attendees; you only
       saw people when viewing as admin). Now fetch via the SECURITY DEFINER members_cards(p_ids[]) RPC
       (public passport fields, like get_match_pool). Pair with member dashboard v267 (FFPCard merge).
   v21 (2026-06-04): FIX — member-hosted meetups never showed on the Discover tab. The mapped meetup
       object set `area: m.city` but NOT `city`, while MeetMove.filtered() filters by m.city; with the
       location filter defaulting to country=UAE, `cc.indexOf(undefined)` excluded EVERY meetup on Discover
       (you only saw your own via Hosting/Joined). Now also map `city` (+ `country`) so the filter works.
   v20 (2026-06-03): fires Meet & Move lifecycle emails (non-blocking) — after join_meetup → POST
       /api/meetups/notify {kind:'confirm'} (confirmation to the joiner); after cancel_meetup → POST
       {kind:'cancel'} (cancellation to all attendees). Backend v62 sends; reminders via daily cron.
   v19 (2026-06-02): meetups now sorted CHRONOLOGICALLY (soonest first) via _ts; each item carries
       _raw (the full meetup row) so the host Edit form can prefill. (Edit/update + time-fix live in
       the dashboard.)
   v18 (2026-06-02): carry meetups.maps_url into MeetMove.data so the meetup detail's location is a
       tappable link (opens the picked spot in the member's maps app). Set via the new location picker.
   v17 (2026-06-02): (1) HOST CAN CANCEL — host detail modal's footer button is now "Cancel this
        meet-up" (red) → MeetMove.cancelMeetup() → cancel_meetup RPC (host-only; sets the meetup +
        attendee RSVPs to 'cancelled' and inserts a notification for every joined attendee) → reload.
        (2) Who's-going passports now resolve to FULL data — each fetched attendee/host is
        registered into window.FFPCard (#62), so cards show photo/sports/passport # not a bare
        fallback. (Hosting count fix is in the dashboard.)
   v16: Who's going count = people.length (host + accepted attendees) so the host is included.
   v15
   v15 (2026-06-01): join a meetup via join_meetup() RPC (direct meetup_attendees insert failed
     on auth.uid() for members).
   v14
   v14 (2026-06-01): scale attendee passport cards after they're injected (official .pass-shell
     is 540x540-design, needs ffpScaleCards to fit).
   v13
   v13 (2026-06-01): "Who's going" now renders each attendee as the reusable FFPPassportCard
     (tap to flip to activities + record). Attendee fetch widened to include gender, country,
     tier, skills, created_at so the passport back has real data.
   v12
   v12 (2026-06-01): STOP overriding the matches UI. The member dashboard (v188) now owns
     matching via the get_match_pool() Supabase RPC + the "Matches" modal
     (tabs: Matching with / Connected with). This loader previously replaced that with an
     old REST endpoint (/api/members/:id/matches) and a "Meet & Move people" modal, which
     hid the real matches. Now the loader ONLY loads real meetups (+ Who's going) and leaves
     matches entirely to the inline dashboard code.
     - Removed calls: installMatchesGridOverride(), loader loadMatches(). (defs left dormant)
   v11: maps is_professional -> isProfessional (Professionals meet-up option).
   v10 (2026-05-29): detail popup now shows "Who's going" (tappable attendees +
     host), cost box de-emphasised, details font bumped.
   v9 (2026-05-29): top strip collapsed to ONE compact bar (avatars + count) —
     all match cards live in the popup; popup fixed-height across both tabs.
   v8 (2026-05-29): Your circle moved INTO the View-all popup as a 2nd tab
     ("Might click with" / "Your circle"); removed the on-page circle block.
   v7 (2026-05-29): FIX — panel id is 'panel-meet' not 'panel-meet-move'; renderCircle
     was returning early so Your circle never injected. Now renders.
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
  var gridOverridden = false;
  var peopleById = {};

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
      '.dm-cost-box{margin:12px 22px !important;padding:9px 14px !important;}',
      '.dm-cost-amount{font-size:15px !important;}',
      '.dm-info-cell{font-size:13px !important;}',
      '.dm-info-cell .v{font-size:13px !important;line-height:1.4;}',
      '.ffp-wg-list{margin-top:4px;}',
      '.ffp-wg-row{display:flex;align-items:center;gap:11px;padding:9px 0;border-top:1px solid rgba(255,255,255,0.05);cursor:pointer;}',
      '.ffp-wg-av{width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--blue-dk,#1980AD),var(--blue,#2ba8e0));color:#fff;font-weight:800;font-size:14px;}',
      '.ffp-wg-name{flex:1;min-width:0;font-size:13px;font-weight:800;color:var(--text,#e8eef4);}',
      '.ffp-wg-host{font-size:9px;font-weight:800;color:var(--yellow,#FFCC00);border:1px solid var(--yellow,#FFCC00);border-radius:20px;padding:1px 6px;margin-left:4px;}',
      '.ffp-wg-city{font-size:11px;font-weight:600;color:var(--muted,#8a99a8);margin-top:1px;}',
      '.ffp-wg-arrow{color:var(--blue,#2ba8e0);flex-shrink:0;}',
      '.ffp-wg-empty{font-size:12px;color:var(--muted,#8a99a8);padding:8px 0;}',
      '.ffp-mbar{display:flex;align-items:center;gap:12px;cursor:pointer;padding:6px 2px;}',
      '.ffp-mbar-avs{display:flex;align-items:center;flex-shrink:0;}',
      '.ffp-mbar-av{width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--blue-dk,#1980AD),var(--blue,#2ba8e0));color:#fff;font-weight:800;font-size:14px;border:2px solid var(--bg,#0a1825);}',
      '.ffp-mbar-txt{flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--muted,#8a99a8);}',
      '.ffp-mbar-txt b{color:var(--text,#e8eef4);font-weight:800;}',
      '.ffp-mbar-arrow{color:var(--blue,#2ba8e0);flex-shrink:0;}',
      '.ffp-mtab-wrap{min-height:56vh;}',
      '.ffp-mtabs{display:flex;gap:6px;margin:4px 0 16px;border-bottom:1px solid var(--border-mid,rgba(43,168,224,0.18));}',
      '.ffp-mtab{flex:1;background:none;border:none;border-bottom:2px solid transparent;color:var(--muted,#8a99a8);font-size:12px;font-weight:800;letter-spacing:0.4px;padding:9px 4px;cursor:pointer;font-family:inherit;}',
      '.ffp-mtab.active{color:var(--text,#e8eef4);border-bottom-color:var(--blue,#2ba8e0);}',
      '.ffp-circle-scope .cir-sub{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--muted,#8a99a8);margin:14px 0 8px;}',
      '.ffp-circle-scope .cir-row{display:flex;align-items:center;gap:11px;padding:10px 0;border-top:1px solid rgba(255,255,255,0.05);}',
      '.ffp-circle-scope .cir-av{width:38px;height:38px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--blue-dk,#1980AD),var(--blue,#2ba8e0));color:#fff;font-weight:800;font-size:15px;}',
      '.ffp-circle-scope .cir-name{flex:1;min-width:0;font-size:13px;font-weight:800;color:var(--text,#e8eef4);}',
      '.ffp-circle-scope .cir-city{font-size:11px;font-weight:600;color:var(--muted,#8a99a8);margin-top:1px;}',
      '.ffp-circle-scope .cir-acts{display:flex;gap:6px;flex-shrink:0;}',
      '.ffp-circle-scope .cir-btn{border:none;border-radius:8px;padding:7px 11px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;}',
      '.ffp-circle-scope .cir-btn.yellow{background:var(--yellow,#FFCC00);color:#000;}',
      '.ffp-circle-scope .cir-btn.blue{background:var(--blue,#2ba8e0);color:#fff;}',
      '.ffp-circle-scope .cir-btn.ghost{background:rgba(255,255,255,0.08);color:var(--text,#e8eef4);}',
      '.ffp-circle-scope .cir-empty{font-size:12px;color:var(--muted,#8a99a8);padding:10px 0;line-height:1.5;}'
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
  // Builds the "Your circle" list (used inside the View-all modal's second tab).
  function circleListHtml() {
    var inc = circleData.incoming || [], fr = circleData.friends || [];
    var incHtml = inc.length ? '<div class="cir-sub">Requests to connect</div>' + inc.map(function (p) {
      return '<div class="cir-row">' + avatarHtml(p) + '<div class="cir-name">' + esc(p.name) + '</div>' +
        '<div class="cir-acts"><button class="cir-btn ghost" onclick="FFPCircle.decline(\'' + p.id + '\')">Ignore</button>' +
        '<button class="cir-btn yellow" onclick="FFPCircle.accept(\'' + p.id + '\')">Accept</button></div></div>';
    }).join('') : '';
    var frHtml = fr.length ? '<div class="cir-sub">Connected (' + fr.length + ')</div>' + fr.map(function (p) {
      return '<div class="cir-row">' + avatarHtml(p) +
        '<div class="cir-name">' + esc(p.name) + (p.city ? '<div class="cir-city">' + esc(p.city) + '</div>' : '') + '</div>' +
        '<div class="cir-acts"><button class="cir-btn blue" onclick="FFPCircle.invite(\'' + p.id + '\')">Invite to a meet-up</button></div></div>';
    }).join('') : '<div class="cir-empty">No connections yet — open “Might click with”, tap someone and Request to connect.</div>';
    return '<div class="ffp-circle-scope">' + incHtml + frHtml + '</div>';
  }
  // If the View-all modal is open on the circle tab, refresh it in place.
  function renderCircle() {
    var host = document.getElementById('ffp-mtab-body-circle');
    if (host) host.innerHTML = circleListHtml();
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

  function matchCardHtml(m) {
    return '<div class="match-card" style="flex:auto;" onclick="closeDetailModal(); setTimeout(function(){MeetMove.openMemberDetail(\'' + m.id + '\')},100);">' +
      '<div class="match-card-avatar"' + (m.photo ? ' style="background:#0a1825 url(\'' + m.photo + '\') center/cover;"' : '') + '>' + (m.photo ? '' : esc(m.letter)) + '</div>' +
      '<div class="match-card-name">' + esc(m.name) + '</div>' +
      '<div class="match-card-meta">' + esc(m.age) + ' &middot; ' + esc(m.city) + '</div>' +
      '<div class="match-card-pct">' + m.match + '% MATCH</div>' +
    '</div>';
  }

  // ── Who's going (attendees) ─────────────────────────────────────────
  function personShape(mp, isHost) {
    if (!mp) return null;
    return {
      id: mp.id,
      name: (mp.full_name || mp.given_names || 'Member'),
      givenNames: mp.given_names || '',
      surname: mp.surname || '',
      photo: mp.photo_url || null,
      city: mp.city || '',
      country: mp.country || '',
      gender: mp.gender || '',
      memberType: mp.tier || 'member',
      memberSince: (mp.created_at ? new Date(mp.created_at).getFullYear() : null),
      sports: Array.isArray(mp.skills) ? mp.skills : [],
      isHost: !!isHost
    };
  }
  function buildAttendees(m, ids, peopleMap) {
    var out = [], seen = {};
    var hp = peopleMap[m.host_member_id];
    if (hp) { var hs = personShape(hp, true); if (hs) { out.push(hs); seen[hp.id] = 1; } }
    (ids || []).forEach(function (idv) {
      if (!idv || seen[idv]) return; seen[idv] = 1;
      var ps = personShape(peopleMap[idv], false); if (ps) out.push(ps);
    });
    return out;
  }
  function whosGoingHtml(m) {
    var people = m.attendees || [];
    var header = '<div class="dm-section-label">Who\'s going (' + people.length + '/' + m.capacity + ')</div>';
    if (!people.length) return header + '<div class="ffp-wg-empty">Be the first to join.</div>';
    // v13: reuse the FFPPassportCard component (tap to flip). Fall back to compact rows if missing.
    if (window.FFPPassportCard && typeof window.FFPPassportCard.render === 'function') {
      var cards = people.map(function (p) {
        var member = { id: p.id, name: p.name, givenNames: p.givenNames, surname: p.surname,
          photo: p.photo, city: p.city, country: p.country, gender: p.gender,
          memberType: p.memberType, memberSince: p.memberSince, sports: p.sports };
        return '<div style="margin-bottom:12px;">' +
          window.FFPPassportCard.render(member, { context: 'attendee', role: (p.isHost ? 'HOST' : 'GOING'), flippable: true }) +
        '</div>';
      }).join('');
      return header + '<div style="font-size:11px;color:var(--muted);margin:-4px 0 10px;">Tap a passport to flip it</div>' + cards;
    }
    var rows = '<div class="ffp-wg-list">' + people.map(function (p) {
      var av = p.photo
        ? '<span class="ffp-wg-av" style="background:#0a1825 url(\'' + esc(p.photo) + '\') center/cover;"></span>'
        : '<span class="ffp-wg-av">' + esc((p.name || 'M').charAt(0).toUpperCase()) + '</span>';
      return '<div class="ffp-wg-row" onclick="FFPMeet.openAttendee(\'' + p.id + '\')">' + av +
        '<div class="ffp-wg-name">' + esc(p.name) + (p.isHost ? ' <span class="ffp-wg-host">HOST</span>' : '') +
        (p.city ? '<div class="ffp-wg-city">' + esc(p.city) + '</div>' : '') + '</div>' +
        '<span class="material-icons ffp-wg-arrow">chevron_right</span></div>';
    }).join('') + '</div>';
    return header + rows;
  }
  function openAttendeeModal(p) {
    var body =
      '<div class="pm-head">' +
        '<div class="pm-avatar"' + (p.photo ? ' style="background:#0a1825 url(\'' + esc(p.photo) + '\') center/cover;"' : '') + '>' + (p.photo ? '' : esc((p.name || 'M').charAt(0).toUpperCase())) + '</div>' +
        '<div class="pm-name">' + esc(p.name) + '</div>' +
        '<div class="pm-meta">' + esc(p.city || '') + '</div>' +
      '</div>' +
      '<div class="dm-section"><p style="font-size:12px;color:var(--muted);line-height:1.5;">FFP member' + (p.city ? ' in ' + esc(p.city) : '') + '. Connect to add them to your circle.</p></div>' +
      '<div class="dm-footer"><button class="btn-primary-blue" onclick="FFPMeet.connect(\'' + p.id + '\')">Request to connect</button>' +
        '<div class="dm-footer-note">Connecting adds them to your circle.</div></div>';
    openDetailModal(body);
  }
  window.FFPMeet = {
    openAttendee: function (id) {
      if (window.MeetMove && (MeetMove.matches || []).some(function (x) { return x.id === id; })) {
        return MeetMove.openMemberDetail(id);
      }
      var p = peopleById[id];
      if (p) openAttendeeModal(p);
    },
    connect: async function (id) {
      if (!currentUserId) { closeDetailModal(); return; }
      try {
        var res = await fetch(API + '/api/connections/request', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: currentUserId, target_id: id })
        });
        var j = await res.json();
        if (typeof showToast === 'function') showToast(j && j.status === 'connected' ? 'Connected' : 'Request sent');
      } catch (e) { if (typeof showToast === 'function') showToast('Could not send request'); }
      closeDetailModal();
      if (typeof loadConnections === 'function') { try { loadConnections(); } catch (e) {} }
    }
  };
  // Reload the open-meet-ups Discover list on demand (re-pull open/full meet-ups + re-render). Wired to
  // real-time (meetups / meetup_attendees changes) and called after hosting/cancelling, so the joinable list
  // updates live — critical for members urgently looking for someone to meet right now.
  window.ffpReloadMeetMove = function () { try { loadFromSupabase(); } catch (e) {} };

  // Compact bar shown on the main page in place of the 5 tall cards:
  // overlapping avatars + count, taps through to the modal.
  function barAvatars(matches) {
    return matches.slice(0, 5).map(function (m, i) {
      var style = 'margin-left:' + (i === 0 ? '0' : '-12px') + ';z-index:' + (10 - i) + ';';
      return m.photo
        ? '<span class="ffp-mbar-av" style="' + style + 'background:#0a1825 url(\'' + m.photo + '\') center/cover;"></span>'
        : '<span class="ffp-mbar-av" style="' + style + '">' + esc((m.name || 'M').charAt(0).toUpperCase()) + '</span>';
    }).join('');
  }
  // Replace the tall match strip with one compact bar.
  function installMatchStripOverride() {
    if (typeof MeetMove === 'undefined') return;
    MeetMove.renderMatchStrip = function () {
      var scroll = document.getElementById('meet-match-scroll');
      if (!scroll) return;
      var matches = this.matches || [];
      if (!matches.length) {
        scroll.innerHTML = '<div style="padding:10px 4px;color:var(--muted);font-size:12px;line-height:1.5;">More members are joining — matches show up here as the community grows.</div>';
        return;
      }
      var n = matches.length;
      scroll.innerHTML =
        '<div class="ffp-mbar" onclick="MeetMove.openMatchesGrid()">' +
          '<div class="ffp-mbar-avs">' + barAvatars(matches) + '</div>' +
          '<div class="ffp-mbar-txt"><b>' + n + ' ' + (n === 1 ? 'member' : 'members') + '</b> you\'d click with</div>' +
          '<span class="material-icons ffp-mbar-arrow">chevron_right</span>' +
        '</div>';
    };
  }

  // Replace the dashboard's "View all" grid with a 2-tab, fixed-height modal:
  //   "Might click with" (matches) + "Your circle" (connections).
  function installMatchesGridOverride() {
    if (typeof MeetMove === 'undefined' || gridOverridden) return;
    gridOverridden = true;
    installMatchStripOverride();
    MeetMove.openMatchesGrid = function () {
      var matches = this.matches || [];
      var grid = matches.length
        ? '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">' + matches.map(matchCardHtml).join('') + '</div>'
        : '<div class="cir-empty" style="color:var(--muted);font-size:13px;padding:10px 0;">No matches yet — more appear as members join.</div>';
      var body =
        '<div class="dm-body">' +
          '<div class="dm-title">Meet &amp; Move people</div>' +
          '<div class="ffp-mtabs">' +
            '<button class="ffp-mtab active" id="ffp-mtab-click" onclick="FFPMatchTabs.show(\'click\')">Might click with</button>' +
            '<button class="ffp-mtab" id="ffp-mtab-circle" onclick="FFPMatchTabs.show(\'circle\')">Your circle</button>' +
          '</div>' +
          '<div class="ffp-mtab-wrap">' +
            '<div id="ffp-mtab-body-click">' + grid + '</div>' +
            '<div id="ffp-mtab-body-circle" style="display:none;">' + circleListHtml() + '</div>' +
          '</div>' +
        '</div>';
      openDetailModal(body);
    };
  }

  window.FFPMatchTabs = {
    show: function (t) {
      var c = document.getElementById('ffp-mtab-body-click'), r = document.getElementById('ffp-mtab-body-circle');
      var bc = document.getElementById('ffp-mtab-click'), br = document.getElementById('ffp-mtab-circle');
      if (!c || !r) return;
      var circle = (t === 'circle');
      c.style.display = circle ? 'none' : 'block';
      r.style.display = circle ? 'block' : 'none';
      if (bc) bc.classList.toggle('active', !circle);
      if (br) br.classList.toggle('active', circle);
    }
  };

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
      // v12: matches are handled by the inline dashboard (get_match_pool RPC + "Matches" modal).
      // Do NOT install the old grid/strip overrides or fetch the old REST matches here.
      await loadConnections();

      var mRes = await window.supabase.from('meetups').select('*').in('status', ['open', 'full']);
      if (mRes.error) { console.error('[FFP Meet & Move] meetups read:', mRes.error); return; }
      var meetups = mRes.data || [];
      if (meetups.length === 0) {
        MeetMove.data = [];
        var p0 = document.getElementById('panel-meet');
        if (p0 && typeof MeetMove.render === 'function') { try { MeetMove.render(); } catch (e) {} }
        console.log('[FFP Meet & Move] No meetups — empty state');
        return;
      }

      var hostIds = Array.from(new Set(meetups.map(function (m) { return m.host_member_id; }).filter(Boolean)));
      var hostMap = {};
      if (hostIds.length) {
        // members RLS is self/admin-only — fetch host cards via the SECURITY DEFINER RPC so non-admins see them.
        var hRes = await window.supabase.rpc('members_cards', { p_ids: hostIds });
        (hRes.data || []).forEach(function (m) { hostMap[m.id] = m; });
      }
      var trustMap = {};
      if (hostIds.length) {
        var tRes = await window.supabase.from('profile_meta').select('member_id, reliability_score').in('member_id', hostIds);
        if (!tRes.error) (tRes.data || []).forEach(function (p) { if (p.reliability_score != null) trustMap[p.member_id] = Number(p.reliability_score); });
      }
      // v23: also pull this member's PENDING requests (awaiting host approval), not just joined/attended.
      var myAttRes = await window.supabase.from('meetup_attendees').select('meetup_id, status').eq('member_id', currentUserId).in('status', ['joined', 'attended', 'pending']);
      var joinedSet = new Set(), pendingSet = new Set();
      (myAttRes.data || []).forEach(function (r) {
        if (r.status === 'pending') pendingSet.add(r.meetup_id); else joinedSet.add(r.meetup_id);
      });
      var meetupIds = meetups.map(function (m) { return m.id; });
      var countMap = {}, attMap = {}, pendingAttMap = {};
      if (meetupIds.length) {
        var aRes = await window.supabase.from('meetup_attendees').select('meetup_id, member_id').in('meetup_id', meetupIds).in('status', ['joined', 'attended']);
        (aRes.data || []).forEach(function (r) {
          countMap[r.meetup_id] = (countMap[r.meetup_id] || 0) + 1;
          (attMap[r.meetup_id] = attMap[r.meetup_id] || []).push(r.member_id);
        });
        // v23: pending requests — RLS returns these only for the requester (self) or the meetup's host,
        // so a host sees everyone awaiting approval on THEIR meetups; others just see their own.
        var pendRes = await window.supabase.from('meetup_attendees').select('meetup_id, member_id').in('meetup_id', meetupIds).eq('status', 'pending');
        (pendRes.data || []).forEach(function (r) {
          (pendingAttMap[r.meetup_id] = pendingAttMap[r.meetup_id] || []).push(r.member_id);
        });
      }
      // fetch member info for attendees + hosts (powers "Who's going")
      var attIdSet = {};
      Object.keys(attMap).forEach(function (k) { attMap[k].forEach(function (idv) { if (idv) attIdSet[idv] = 1; }); });
      Object.keys(pendingAttMap).forEach(function (k) { pendingAttMap[k].forEach(function (idv) { if (idv) attIdSet[idv] = 1; }); });  // v23: load pending requesters' cards too
      meetups.forEach(function (mm) { if (mm.host_member_id) attIdSet[mm.host_member_id] = 1; });
      var attPeopleIds = Object.keys(attIdSet);
      var peopleMap = {};
      if (attPeopleIds.length) {
        // members RLS is self/admin-only — fetch attendee/host cards via the SECURITY DEFINER RPC
        // so any member (not just admins) can see Who's-going passports.
        var pRes = await window.supabase.rpc('members_cards', { p_ids: attPeopleIds });
        (pRes.data || []).forEach(function (mp) {
          peopleMap[mp.id] = mp; var ps = personShape(mp); if (ps) peopleById[mp.id] = ps;
          // feed the ONE canonical card cache so Who's-going passports resolve to full data
          // (photo, sports, passport #) instead of a bare fallback. (#62)
          if (window.FFPCard && window.FFPCard.register) { try { window.FFPCard.register(mp); } catch (e) {} }
        });
      }
      MeetMove.data = meetups.map(function (m) {
        var host = hostMap[m.host_member_id] || null;
        var meta = metaForSport(m.sport);
        var isHostedByMe = m.host_member_id === currentUserId;
        return {
          id: m.id, activity: m.title || m.sport || 'Meetup', cat: meta.cat, icon: meta.icon,
          host: memberDisplayName(host), hostInitial: memberLetter(host),
          hostTrust: trustMap[m.host_member_id] != null ? trustMap[m.host_member_id] : 9.0,
          when: fmtWhen(m.meets_at), whenSlot: 'this-week', venue: m.venue || '', area: m.city || '', city: m.city || '', country: m.country || '',
          capacity: m.max_people || 8, joined: 1 + (countMap[m.id] || 0), level: m.fitness_level || 'All',
          gender: genderMap(m.group_filter), cost: 'Free',
          joinedByMe: joinedSet.has(m.id) || isHostedByMe, isHostedByMe: isHostedByMe,
          pendingByMe: pendingSet.has(m.id) && !isHostedByMe && !joinedSet.has(m.id),   // v23: requested, awaiting host
          pendingRequests: isHostedByMe ? (pendingAttMap[m.id] || []).map(function (pid) {
            var p = peopleMap[pid]; return { id: pid, name: (p && (p.full_name || p.given_names)) || 'Member', photo: (p && p.photo_url) || '' };
          }) : [],                                                                       // v23: host-only approval queue
          isProfessional: !!m.is_professional,
          host_member_id: m.host_member_id, full: m.status === 'full',
          maps_url: m.maps_url || '',
          _ts: m.meets_at ? (+new Date(m.meets_at)) : 0,   // sort key (soonest first)
          _raw: m,                                          // raw row, for the host edit form
          about: m.description || 'Member-hosted meetup.', img: m.cover_url || meta.img,   // v24: host's own photo if set
          attendees: buildAttendees(m, attMap[m.id] || [], peopleMap)
        };
      }).sort(function (a, b) { return a._ts - b._ts; });   // chronological: soonest → latest
      installOverrides();
      wrapWrites();
      var panel = document.getElementById('panel-meet');
      if (panel && panel.classList.contains('active') && typeof MeetMove.render === 'function') MeetMove.render();
      console.log('[FFP Meet & Move] Loaded ' + MeetMove.data.length + ' meetups ✓ (v15 — join via RPC; scaled passport-card attendees)');
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
        try {
          var footer = document.querySelector('.dm-footer');
          if (footer && footer.parentNode && !document.getElementById('ffp-whos-going')) {
            var sec = document.createElement('div');
            sec.id = 'ffp-whos-going'; sec.className = 'dm-section';
            sec.innerHTML = whosGoingHtml(m);
            footer.parentNode.insertBefore(sec, footer);
            if (window.ffpScaleCards) { setTimeout(function () { try { window.ffpScaleCards(sec); } catch (e) {} }, 0); }
          }
          // v23: HOST-only "Requests to join" — pending members the host can Approve.
          if (m.isHostedByMe && m.pendingRequests && m.pendingRequests.length && !document.getElementById('ffp-requests')) {
            var rq = document.createElement('div');
            rq.id = 'ffp-requests'; rq.className = 'dm-section';
            var rows = m.pendingRequests.map(function (p) {
              var av = p.photo
                ? '<span style="width:34px;height:34px;border-radius:50%;flex-shrink:0;background:#0a1825 url(\'' + p.photo + '\') center/cover;"></span>'
                : '<span style="width:34px;height:34px;border-radius:50%;flex-shrink:0;background:#13324a;color:#cfe0ee;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;">' + esc((p.name || 'M').charAt(0).toUpperCase()) + '</span>';
              return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);">' + av +
                '<div style="flex:1;min-width:0;font-size:14px;font-weight:600;color:#e8eef4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(p.name) + '</div>' +
                '<button onclick="MeetMove.approveRequest(\'' + m.id + '\',\'' + p.id + '\',this)" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:8px 15px;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;">Approve</button></div>';
            }).join('');
            rq.innerHTML = '<div class="dm-section-label">Requests to join (' + m.pendingRequests.length + ')</div>' + rows;
            footer.parentNode.insertBefore(rq, footer);
          }
        } catch (e) {}
        // (Host "Cancel this meet-up" footer is now built canonically in the dashboard's
        // openMeetupDetail — no DOM surgery needed here.)
      }, 0);
    };

    // Host-only: cancel a meet-up → cancel_meetup RPC (notifies joined attendees) → reload.
    MeetMove.cancelMeetup = async function (id) {
      if (!currentUserId) return;
      var m = (this.data || []).find(function (x) { return x.id === id; });
      var name = m ? m.activity : 'this meet-up';
      if (!window.confirm('Cancel “' + name + '”?\n\nAnyone who joined will be notified. This can’t be undone.')) return;
      try {
        var res = await window.supabase.rpc('cancel_meetup', { p_me: currentUserId, p_meetup: id });
        if (res.error || !res.data || res.data.ok === false) {
          if (typeof showToast === 'function') showToast((res.data && res.data.error) || 'Couldn’t cancel — please try again', 'error');
          return;
        }
        var n = res.data.notified || 0;
        // v18: email all attendees that the meet-up was cancelled (non-blocking)
        try { fetch('https://ffp-passport-backend.vercel.app/api/meetups/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'cancel', meetup_id: id }) }); } catch (e) {}
        if (typeof showToast === 'function') showToast('Meet-up cancelled' + (n ? ' · ' + n + ' member' + (n === 1 ? '' : 's') + ' notified' : ''), 'success');
        if (typeof closeDetailModal === 'function') closeDetailModal();
        if (typeof window.ffpReloadMeetMove === 'function') window.ffpReloadMeetMove();
      } catch (e) { if (typeof showToast === 'function') showToast('Couldn’t cancel — please try again', 'error'); }
    };
  }

  function wrapWrites() {
    if (wrapped) return;
    wrapped = true;
    // v23: REQUEST-TO-JOIN (host must approve). No more auto-confirm. Member goes PENDING; the host is
    // emailed/notified to approve; only on approval is the member confirmed + emailed.
    MeetMove.requestJoin = async function (id) {
      var m = this.data.find(function (x) { return x.id === id; });
      if (!m) return;
      if (m.isHostedByMe) { if (typeof showToast === 'function') showToast("You're hosting this meetup"); return; }
      if (m.joinedByMe)  { if (typeof showToast === 'function') showToast("You're already going"); return; }
      if (m.pendingByMe) { if (typeof showToast === 'function') showToast('Request already sent — the host will confirm you'); return; }
      if (!currentUserId) return;
      m.pendingByMe = true;                                   // optimistic: request sent
      if (typeof this.render === 'function') this.render();
      if (typeof closeDetailModal === 'function') closeDetailModal();
      try {
        var res = await window.supabase.rpc('join_meetup', { p_me: currentUserId, p_meetup: id });
        var st = res && res.data;
        if (res.error || (st !== 'pending' && st !== 'joined')) {
          m.pendingByMe = false; if (typeof this.render === 'function') this.render();
          if (typeof showToast === 'function') showToast("Couldn't send your request — please try again", 'error');
          return;
        }
        if (st === 'joined') { m.pendingByMe = false; m.joinedByMe = true; if (typeof this.render === 'function') this.render(); }
        // email the HOST that someone wants to join (they approve in-app). NOT a confirmation to the member.
        try { fetch('https://ffp-passport-backend.vercel.app/api/meetups/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'request', meetup_id: id, member_id: currentUserId }) }); } catch (e) {}
        if (typeof showToast === 'function') showToast(st === 'joined' ? "You're going!" : 'Request sent — the host will confirm you', 'success');
      } catch (e) {
        m.pendingByMe = false; if (typeof this.render === 'function') this.render();
        if (typeof showToast === 'function') showToast("Couldn't send your request — please try again", 'error');
      }
    };

    // v23: HOST approves a pending request → member becomes 'joined', gets a notification + the confirm email.
    MeetMove.approveRequest = async function (meetupId, memberId, btn) {
      if (!currentUserId || !meetupId || !memberId) return;
      if (btn) { try { btn.disabled = true; btn.textContent = 'Approving…'; } catch (e) {} }
      try {
        var res = await window.supabase.rpc('host_approve_attendee', { p_host: currentUserId, p_meetup: meetupId, p_member: memberId });
        var st = res && res.data;
        if (res.error || st === 'forbidden' || st === 'invalid' || st === 'not_found' || st === 'not_pending') {
          if (btn) { btn.disabled = false; btn.textContent = 'Approve'; }
          if (typeof showToast === 'function') showToast("Couldn't approve — please try again", 'error'); return;
        }
        if (st === 'full') { if (btn) { btn.disabled = false; btn.textContent = 'Approve'; } if (typeof showToast === 'function') showToast('This meet-up is full', 'error'); return; }
        // email the member that they're confirmed (non-blocking)
        try { fetch('https://ffp-passport-backend.vercel.app/api/meetups/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'confirm', meetup_id: meetupId, member_id: memberId }) }); } catch (e) {}
        if (typeof showToast === 'function') showToast(st === 'already' ? 'Already approved' : 'Approved — they’re confirmed', 'success');
        if (typeof window.ffpReloadMeetMove === 'function') window.ffpReloadMeetMove();
      } catch (e) { if (btn) { btn.disabled = false; btn.textContent = 'Approve'; } if (typeof showToast === 'function') showToast("Couldn't approve — please try again", 'error'); }
    };

    // v24: attendee cancels their spot/request (anytime before start) → frees a spot for someone else.
    MeetMove.leaveMeetup = async function (id) {
      var m = this.data.find(function (x) { return x.id === id; });
      if (!m || !currentUserId) return;
      var wasPending = m.pendingByMe;
      if (!window.confirm((wasPending ? 'Cancel your request to join "' : 'Cancel your spot for "') + (m.activity || 'this meet-up') + '"?')) return;
      try {
        var res = await window.supabase.rpc('leave_meetup', { p_me: currentUserId, p_meetup: id });
        var st = res && res.data;
        if (res.error || st === 'invalid' || st === 'not_in') { if (typeof showToast === 'function') showToast("Couldn't cancel — please try again", 'error'); return; }
        if (st === 'started') { if (typeof showToast === 'function') showToast('This meet-up has already started', 'error'); return; }
        m.joinedByMe = false; m.pendingByMe = false;
        if (typeof closeDetailModal === 'function') closeDetailModal();
        if (typeof showToast === 'function') showToast(wasPending ? 'Request cancelled' : 'Your spot was cancelled', 'success');
        if (typeof window.ffpReloadMeetMove === 'function') window.ffpReloadMeetMove();
      } catch (e) { if (typeof showToast === 'function') showToast("Couldn't cancel — please try again", 'error'); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(loadFromSupabase, 400); });
  } else {
    setTimeout(loadFromSupabase, 400);
  }
  window.ffpReloadMeetMove = loadFromSupabase;
})();

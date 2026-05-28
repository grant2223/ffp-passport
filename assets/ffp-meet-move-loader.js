/* FFP Meet & Move Loader — v3
   v3 (2026-05-29) clean-build refactor: uses FFPAuth.getMember()
   instead of window.supabase.auth.getUser(). RLS still works via
   JWT Bearer header (set by ffp-api-integration v8).
   
   v2 fixes:
   - Block "Request to Join" when current user is the host
   - Inject hero image (m.img) into the detail modal cover (was a CSS class cover only)
   Reads:  meetups (host_member_id, sport, etc.), members (host name lookup),
           profile_meta (reliability_score on each host), meetup_attendees (joinedByMe)
   Writes: wrapped requestJoin → INSERT meetup_attendees with status='joined'
*/
(function () {
  'use strict';
  var retries = 0;
  var MAX_RETRIES = 30;
  var currentUserId = null;
  var wrapped = false;

  function injectStyles() {
    if (document.getElementById('ffp-meet-move-loader-styles')) return;
    var s = document.createElement('style');
    s.id = 'ffp-meet-move-loader-styles';
    s.textContent =
      '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}' +
      '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}' +
      /* v2 — detail modal cover image */
      '.dm-cover.ffp-img-cover{background-size:cover !important;background-position:center !important;background-repeat:no-repeat !important;}';
    document.head.appendChild(s);
  }

  var SPORT_META = {
    Padel:    { cat: 'racquet',   icon: 'sports_tennis',   img: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&q=70' },
    Tennis:   { cat: 'racquet',   icon: 'sports_tennis',   img: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&q=70' },
    Running:  { cat: 'running',   icon: 'directions_run',  img: 'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=400&q=70' },
    Yoga:     { cat: 'mind-body', icon: 'self_improvement',img: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&q=70' },
    Pilates:  { cat: 'mind-body', icon: 'self_improvement',img: 'https://images.unsplash.com/photo-1591291621164-2c6367723315?w=400&q=70' },
    Fitness:  { cat: 'fitness',   icon: 'fitness_center',  img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=400&q=70' },
    HIIT:     { cat: 'fitness',   icon: 'fitness_center',  img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=400&q=70' },
    Swimming: { cat: 'swimming',  icon: 'pool',            img: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&q=70' },
    Hiking:   { cat: 'adventure', icon: 'hiking',          img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=70' },
    Boxing:   { cat: 'combat',    icon: 'sports_mma',      img: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&q=70' }
  };
  function metaForSport(sport) {
    return SPORT_META[sport] || { cat: 'fitness', icon: 'fitness_center', img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=400&q=70' };
  }
  function genderMap(dbVal) {
    if (dbVal === 'women_only') return 'women';
    if (dbVal === 'men_only')   return 'men';
    return 'any';
  }
  function fmtWhen(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var hr = d.getHours();
    var min = d.getMinutes();
    var ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12; if (hr === 0) hr = 12;
    var minStr = String(min).padStart(2, '0');
    return dayNames[d.getDay()] + ' · ' + d.getDate() + ' ' + monthNames[d.getMonth()] + ' · ' + hr + ':' + minStr + ' ' + ampm;
  }
  function memberDisplayName(m) {
    if (!m) return 'Member';
    if (m.given_names) {
      var initial = m.surname ? ' ' + m.surname.charAt(0).toUpperCase() + '.' : '';
      return m.given_names + initial;
    }
    if (m.full_name) return m.full_name;
    return 'Member';
  }
  function memberLetter(m) {
    if (!m) return 'M';
    var src = m.given_names || m.full_name || 'M';
    return src.charAt(0).toUpperCase();
  }

  async function loadFromSupabase() {
    if (!window.supabase || typeof MeetMove === 'undefined') {
      if (retries < MAX_RETRIES) { retries++; setTimeout(loadFromSupabase, 200); }
      return;
    }
    injectStyles();

    try {
      // Read current member from FFP custom auth (FFPAuth.getMember).
      // We don't use supabase.auth.getUser() — FFP members live in the
      // `members` table only and have no auth.users row. RLS still
      // sees auth.uid() correctly because the JWT is set as a Bearer
      // header on the Supabase client by ffp-api-integration v8.
      var member = window.FFPAuth && window.FFPAuth.getMember();
      if (!member || !member.id) {
        console.log('[FFP Meet & Move] No FFP member — keeping sample');
        return;
      }
      currentUserId = member.id;

      // 1. Load live meetups
      var mRes = await window.supabase
        .from('meetups')
        .select('*')
        .in('status', ['open', 'full']);
      if (mRes.error) { console.error('[FFP Meet & Move] meetups read:', mRes.error); return; }
      var meetups = mRes.data || [];
      if (meetups.length === 0) { console.log('[FFP Meet & Move] No meetups — keeping sample'); return; }

      // 2. Host lookup (host_member_id references auth.users — get member rows by id)
      var hostIds = Array.from(new Set(meetups.map(function (m) { return m.host_member_id; }).filter(Boolean)));
      var hostMap = {};
      if (hostIds.length > 0) {
        var hRes = await window.supabase
          .from('members')
          .select('id, full_name, given_names, surname')
          .in('id', hostIds);
        if (hRes.error) console.error('[FFP Meet & Move] hosts read:', hRes.error);
        (hRes.data || []).forEach(function (m) { hostMap[m.id] = m; });
      }

      // 3. Host trust (reliability_score) from profile_meta
      var trustMap = {};
      if (hostIds.length > 0) {
        var tRes = await window.supabase
          .from('profile_meta')
          .select('member_id, reliability_score')
          .in('member_id', hostIds);
        if (!tRes.error) (tRes.data || []).forEach(function (p) {
          if (p.reliability_score != null) trustMap[p.member_id] = Number(p.reliability_score);
        });
      }

      // 4. My RSVPs
      var myAttRes = await window.supabase
        .from('meetup_attendees')
        .select('meetup_id, status')
        .eq('member_id', currentUserId)
        .in('status', ['joined', 'attended']);
      var joinedSet = new Set((myAttRes.data || []).map(function (r) { return r.meetup_id; }));

      // 5. Attendee counts per meetup
      var meetupIds = meetups.map(function (m) { return m.id; });
      var countMap = {};
      if (meetupIds.length > 0) {
        var aRes = await window.supabase
          .from('meetup_attendees')
          .select('meetup_id')
          .in('meetup_id', meetupIds)
          .in('status', ['joined', 'attended']);
        (aRes.data || []).forEach(function (r) {
          countMap[r.meetup_id] = (countMap[r.meetup_id] || 0) + 1;
        });
      }

      // 6. Map rows → dashboard shape
      MeetMove.data = meetups.map(function (m) {
        var host = hostMap[m.host_member_id] || null;
        var meta = metaForSport(m.sport);
        var startIso = m.meets_at;
        var attendeeCount = countMap[m.id] || 0;
        var isHostedByMe = m.host_member_id === currentUserId;

        return {
          id: m.id,
          activity: m.title || m.sport || 'Meetup',
          cat: meta.cat,
          icon: meta.icon,
          host: memberDisplayName(host),
          hostInitial: memberLetter(host),
          hostTrust: trustMap[m.host_member_id] != null ? trustMap[m.host_member_id] : 9.0,
          when: fmtWhen(startIso),
          whenSlot: 'this-week',
          venue: m.venue || '',
          area: m.city || '',
          capacity: m.max_people || 8,
          joined: 1 + attendeeCount,  // host counts toward total
          level: m.fitness_level || 'All',
          gender: genderMap(m.group_filter),
          cost: 'Free',
          joinedByMe: joinedSet.has(m.id) || isHostedByMe,
          isHostedByMe: isHostedByMe,
          host_member_id: m.host_member_id,
          full: m.status === 'full',
          about: m.description || 'Member-hosted meetup.',
          img: meta.img
        };
      });

      installOverrides();
      wrapWrites();

      var panel = document.getElementById('panel-meet-move');
      if (panel && panel.classList.contains('active') && typeof MeetMove.render === 'function') {
        MeetMove.render();
      }
      console.log('[FFP Meet & Move] Loaded ' + MeetMove.data.length + ' meetups ✓');
    } catch (err) {
      console.error('[FFP Meet & Move] Unexpected error:', err);
    }
  }

  function installOverrides() {
    // Override openMeetupDetail to (a) include hero image, (b) handle own-meetup state
    var orig = MeetMove.openMeetupDetail.bind(MeetMove);
    MeetMove.openMeetupDetail = function (id) {
      orig(id);
      var m = this.data.find(function (x) { return x.id === id; });
      if (!m) return;
      // After the original renders, patch the DOM:
      setTimeout(function () {
        // (a) Cover → use real image
        var cover = document.querySelector('.dm-cover');
        if (cover && m.img) {
          cover.classList.add('ffp-img-cover');
          cover.style.backgroundImage = "url('" + m.img + "')";
        }
        // (b) If hosted by me, swap the join button to a "You're hosting" pill
        if (m.isHostedByMe) {
          var btn = document.querySelector('.dm-footer .btn-primary-yellow');
          if (btn) {
            btn.textContent = "You're hosting this";
            btn.disabled = true;
            btn.onclick = function (e) { e.preventDefault(); };
            btn.style.opacity = '0.7';
            btn.style.cursor  = 'default';
          }
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
      // Block self-RSVP
      if (m.isHostedByMe) {
        if (typeof showToast === 'function') showToast("You're hosting this meetup");
        return;
      }
      if (m.joinedByMe) return origRequestJoin(id);

      origRequestJoin(id);
      if (!currentUserId) return;
      try {
        var res = await window.supabase.from('meetup_attendees').insert({
          meetup_id: id,
          member_id: currentUserId,
          status: 'joined',
          created_at: new Date().toISOString()
        });
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

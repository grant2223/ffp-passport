/* FFP Connections Feed Loader — v2 (2026-06-07)
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
      '.cf-rs{font-size:11px;color:#7c8b9a;margin-top:1px;}'
    ].join('');
    document.head.appendChild(s);
  }

  function matchesCount() {
    try { if (window.MeetMove && Array.isArray(MeetMove.matches)) return MeetMove.matches.length; } catch (e) {}
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

    // 1) Discovery strap
    html += '<div class="cf-strap" onclick="FFPConnFeed.discover()">' +
      '<span class="material-icons">auto_awesome</span>' +
      '<div class="cf-strap-txt"><div class="cf-strap-t">People you might click with</div>' +
      '<div class="cf-strap-s">Discover athletes who match you</div></div>' +
      (n > 0 ? '<span class="cf-badge">' + n + ' new</span>' : '') +
      '<span class="material-icons cf-chev">chevron_right</span></div>';

    // 2) My connections (most active first)
    html += '<div class="cf-sec-head"><div class="cf-sec-t">My connections</div>' +
      '<div class="cf-sec-link" onclick="FFPConnFeed.seeAll()">See all</div></div>';
    if (conns.length) {
      html += '<div class="cf-cap">Most active right now — see what they’re up to</div><div class="cf-circles">';
      html += conns.slice(0, 12).map(function (c) {
        var first = (c.name || 'Member').split(' ')[0];
        return '<div class="cf-cell" onclick="FFPConnFeed.openCard(\'' + attr(c.id) + '\')">' +
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

    // 3) From your people
    html += '<div class="cf-sec-head" style="margin-bottom:2px;"><div class="cf-sec-t">From your people</div></div>';
    if (feed.length) {
      html += feed.map(function (it) {
        var av;
        if (it.actor_id) {
          av = '<div class="cf-rav">' +
            (it.photo ? '<div class="cf-ravc" style="background-image:url(\'' + esc(it.photo) + '\');"></div>'
                      : '<div class="cf-ravc">' + esc((it.name || 'M').charAt(0).toUpperCase()) + '</div>') +
            '<span class="material-icons">' + esc(iconFor(it)) + '</span></div>';
        } else {
          av = '<div class="cf-iconc"><span class="material-icons">' + esc(iconFor(it)) + '</span></div>';
        }
        return '<div class="cf-row" onclick="FFPConnFeed.tap(\'' + attr(it.type) + '\',\'' + attr(it.link) + '\')">' +
          av +
          '<div class="cf-rtxt"><div class="cf-rt">' + esc(it.title) + '</div>' +
          (it.sub ? '<div class="cf-rs">' + esc(it.sub) + '</div>' : '') + '</div>' +
          '<span class="material-icons cf-chev">chevron_right</span></div>';
      }).join('');
    } else {
      html += '<div class="cf-empty">Nothing yet. When your connections log activities, join meet-ups or challenges, it shows up here.</div>';
    }

    root.innerHTML = html;
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

  window.FFPConnFeed = {
    render: load,
    reload: load,
    discover: function () { try { if (window.MeetMove && MeetMove.openMatchesGrid) MeetMove.openMatchesGrid(); } catch (e) {} },
    seeAll: function () { try { if (window.CollectionView && CollectionView.open) CollectionView.open(); } catch (e) {} },
    openCard: function (id) { try { if (window.CollectionView && CollectionView.openPerson) CollectionView.openPerson(id); } catch (e) {} },
    tap: function (type, link) {
      try {
        var id = (link && link.indexOf(':') >= 0) ? link.split(':')[1] : '';
        if (type === 'meetup') { goPanel('panel-meetups'); setTimeout(function () { try { if (window.MeetMove && MeetMove.openMeetupDetail) MeetMove.openMeetupDetail(id); } catch (e) {} }, 250); return; }
        if (type === 'challenge') { goPanel('panel-challenges'); setTimeout(function () { try { if (window.Challenges && Challenges.openDetail) Challenges.openDetail(id); } catch (e) {} }, 250); return; }
        if (type === 'activity' || type === 'birthday') { this.openCard(id); return; }
        if (type === 'notif') {
          if (!link) return;
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

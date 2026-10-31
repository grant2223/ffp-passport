/* Admin > Reports. Member reports of activities, comments, meetups, messages and profiles.
   Approved mock "Report and Block Mock", board 7. Reads admin_reports_list + admin_report_stats,
   writes admin_report_resolve (dismiss | remove | suspend). Remove and Suspend confirm in a full-bleed
   sheet first. Styles are the shared .ax-* set; nothing here is global. */
(function () {
  var status = 'open';
  var rows = [];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function age(iso) {
    var h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
    if (h < 1) return 'Under 1 hour';
    if (h < 24) return h + (h === 1 ? ' hour' : ' hours');
    var d = Math.floor(h / 24);
    return d + (d === 1 ? ' day' : ' days');
  }
  if (!document.getElementById('rp-css')) {
    var st = document.createElement('style'); st.id = 'rp-css';
    st.textContent = '.rp-row{grid-template-columns:minmax(220px,1fr) 150px 130px 90px 296px;font-size:14px;font-weight:500;color:#eaf1f6;}'
      + '.rp-row>div{min-width:0;overflow-wrap:anywhere;}.rp-hd{font-size:10px;font-weight:800;color:#5f7482;}'
      + '.rp-acts{display:flex;gap:8px;flex-wrap:wrap;}.rp-acts .ax-btn{padding:10px 13px;}'
      + '@media(max-width:1240px){.rp-hd{display:none;}.rp-row{grid-template-columns:repeat(3,minmax(0,1fr));}.rp-row>div:first-child,.rp-row>div:last-child{grid-column:1/-1;}}';
    document.head.appendChild(st);
  }
  var KIND = { activity: 'Activity', comment: 'Comment', meetup: 'Meetup', message: 'Message', member: 'Member' };

  function when(test, tries) {
    return new Promise(function (res) {
      var n = 0;
      (function tick() { if (test()) return res(true); if (++n > (tries || 80)) return res(false); setTimeout(tick, 100); })();
    });
  }

  async function load() {
    var ok = await when(function () { return window.supabase && document.getElementById('reports-body'); });
    if (!ok) return;
    var host = document.getElementById('reports-body');
    host.innerHTML = '<div style="padding:24px;color:#9fb4c2;">Loading</div>';
    var r = await Promise.all([
      window.supabase.rpc('admin_report_stats'),
      window.supabase.rpc('admin_reports_list', { p_status: status })
    ]);
    if (r[0].error || r[1].error || (r[0].data && r[0].data.error)) {
      host.innerHTML = '<div style="padding:24px;color:#eaf1f6;">Reports could not be read. Reload the page.</div>';
      return;
    }
    rows = Array.isArray(r[1].data) ? r[1].data : [];
    paint(r[0].data || {});
  }

  function paint(st) {
    var badge = document.getElementById('badge-reports');
    if (badge) { badge.textContent = st.open || ''; badge.style.display = st.open ? '' : 'none'; }
    var html = ''
      + '<div class="ax-stats">'
      + '<div class="hero"><div class="n">' + (st.open || 0) + '</div><div class="k">Open</div></div><div class="sep"></div>'
      + '<div class="s"><div class="n">' + (st.overdue || 0) + '</div><div class="k">Over 24 hours</div></div>'
      + '<div class="s"><div class="n">' + (st.actioned_30 || 0) + '</div><div class="k">Actioned, 30 days</div></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end;margin-bottom:14px;"><label style="font-size:12px;font-weight:700;color:#9fb4c2;">Status '
      + '<select class="ax-in" style="width:auto;margin-left:8px;" onchange="AdminReports.setStatus(this.value)">'
      + ['open', 'actioned', 'dismissed'].map(function (s) { return '<option value="' + s + '"' + (s === status ? ' selected' : '') + '>' + s[0].toUpperCase() + s.slice(1) + '</option>'; }).join('')
      + '</select></label></div>';
    if (!rows.length) {
      html += '<div style="padding:24px 6px;color:#9fb4c2;">No ' + status + ' reports.</div>';
    } else {
      html += '<div class="ax-lhead rp-row rp-hd"><div>Content</div><div>Reason</div><div>Reported by</div><div>Age</div><div>' + (status === 'open' ? 'Action' : 'Outcome') + '</div></div>';
      rows.forEach(function (r, i) {
        var type = r.target_type || 'member';
        var acts = status === 'open'
          ? '<div class="rp-acts">'
            + '<button class="ax-btn" style="background:#e8f3fa;color:#1172a3;" onclick="AdminReports.act(' + i + ',\'dismiss\')">Dismiss</button>'
            + (type === 'member' ? '' : '<button class="ax-btn" style="background:#d6353b;color:#fff;" onclick="AdminReports.ask(' + i + ',\'remove\')">Remove</button>')
            + '<button class="ax-btn" style="background:#d6353b;color:#fff;" onclick="AdminReports.ask(' + i + ',\'suspend\')">Suspend</button></div>'
          : '<div>' + esc(r.action === 'remove' ? 'Removed' : r.action === 'suspend' ? 'Member suspended' : 'Dismissed') + '</div>';
        html += '<div class="ax-grow rp-row">'
          + '<div><div style="font-size:12px;font-weight:700;color:#9fd0e6;">' + esc(KIND[type] || 'Member') + ', ' + esc(r.reported && r.reported.name) + '</div>'
          + '<div style="margin-top:3px;line-height:1.35;overflow-wrap:anywhere;">' + esc(r.snapshot || 'Profile reported') + '</div>'
          + (r.details ? '<div style="margin-top:3px;line-height:1.35;color:#9fb4c2;overflow-wrap:anywhere;">' + esc(r.details) + '</div>' : '')
          + '</div>'
          + '<div>' + esc(r.reason) + '</div><div>' + esc(r.reporter && r.reporter.name) + '</div><div>' + esc(age(r.created_at)) + '</div>' + acts + '</div>';
      });
    }
    document.getElementById('reports-body').innerHTML = html;
  }

  async function act(i, action) {
    var r = rows[i]; if (!r) return;
    var res = await window.supabase.rpc('admin_report_resolve', { p_id: r.id, p_action: action });
    if (window.closeSheet) { try { closeSheet(); } catch (e) {} }
    if (res.error || (res.data && res.data.error)) { window.alert('The action was not saved. Try again.'); return; }
    load();
  }

  function ask(i, action) {
    var r = rows[i]; if (!r) return;
    var name = esc(r.reported && r.reported.name);
    var title = action === 'remove' ? 'Remove this content' : 'Suspend ' + name;
    var body = '<div style="padding:8px 0;font-size:15px;line-height:1.5;color:#eaf1f6;">'
      + (action === 'remove'
        ? ({ comment: 'The comment is deleted.', message: 'The message is deleted.', activity: 'The activity leaves the feed and stays in the member\'s own journey.', meetup: 'The meetup is cancelled.' }[r.target_type] || '')
        : name + ' cannot use the platform until the status is changed in Members.')
      + '</div>';
    var foot = '<button class="ax-btn ghost" onclick="closeSheet()">Cancel</button>'
      + '<button class="ax-btn" style="background:#d6353b;color:#fff;" onclick="AdminReports.act(' + i + ',\'' + action + '\')">' + (action === 'remove' ? 'Remove' : 'Suspend') + '</button>';
    if (window.openSheet) openSheet(title, body, foot);
  }

  window.AdminReports = {
    refresh: load, act: act, ask: ask,
    setStatus: function (s) { status = s; load(); }
  };
  load();
})();

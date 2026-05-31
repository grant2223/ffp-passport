/* FFP Admin Feedback Loader - v1 (2026-05-31)
   Wires the admin Feedback panel to public.feedback (admin reads all via is_admin RLS).
   Lazy-loaded on first open of the Feedback panel. Renders newest-first, supports search,
   and lets admin mark items read / resolved. Real-time: new feedback appears instantly and
   the sidebar badge (#badge-feedback) updates. USD/locale-agnostic; text only.
*/
(function () {
  'use strict';

  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  async function waitFor(check, ms) {
    var t = 0, lim = Math.ceil((ms || 15000) / 100);
    while (!check() && t < lim) { await new Promise(function (r) { setTimeout(r, 100); }); t++; }
    return check();
  }
  function rel(ts) {
    if (!ts) return '';
    var d = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + ' min ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  }
  var CAT = { bug: 'Bug', idea: 'Idea', complaint: 'Complaint', praise: 'Praise', other: 'Other' };

  function setBadge(n) {
    var b = document.getElementById('badge-feedback');
    if (!b) return;
    b.textContent = n > 99 ? '99+' : String(n);
    b.style.display = n > 0 ? '' : 'none';
  }

  var AF = {
    data: [],
    search: '',
    onSearch: function (v) { this.search = (v || '').toLowerCase(); this.render(); },

    statusPill: function (st) {
      var map = { 'new': ['#FFCC00', '#000', 'New'], 'read': ['rgba(43,168,224,.18)', '#2ba8e0', 'Read'], 'resolved': ['rgba(74,222,128,.18)', '#4ade80', 'Resolved'] };
      var m = map[st] || map['new'];
      return '<span style="display:inline-block;padding:3px 9px;border-radius:100px;font-size:10px;font-weight:800;letter-spacing:.5px;background:' + m[0] + ';color:' + m[1] + ';">' + m[2] + '</span>';
    },

    render: function () {
      var tb = document.getElementById('feedback-tbody');
      if (!tb) return;
      var q = this.search;
      var rows = this.data.filter(function (f) {
        if (!q) return true;
        return ((f.message || '') + ' ' + (f.submitter_name || '') + ' ' + (f.submitter_email || '')).toLowerCase().indexOf(q) !== -1;
      });
      var meta = document.getElementById('AdminFeedback-meta');
      var newCount = this.data.filter(function (f) { return f.status === 'new'; }).length;
      if (meta) meta.textContent = this.data.length + ' total · ' + newCount + ' new';
      setBadge(newCount);

      if (!rows.length) {
        tb.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:28px;">' +
          (this.data.length ? 'No matches' : 'No feedback yet') + '</td></tr>';
        return;
      }
      var self = this;
      tb.innerHTML = rows.map(function (f) {
        var src = f.source === 'provider' ? 'Provider' : 'Member';
        var srcColor = f.source === 'provider' ? '#FFCC00' : '#2ba8e0';
        var name = esc(f.submitter_name || 'Someone');
        var email = f.submitter_email ? '<div class="text-muted" style="font-size:11px;">' + esc(f.submitter_email) + '</div>' : '';
        var actions = '';
        if (f.status !== 'read' && f.status !== 'resolved') actions += '<button class="btn btn-sm btn-ghost" onclick="AdminFeedback.setStatus(\'' + f.id + '\',\'read\')">Mark read</button> ';
        if (f.status !== 'resolved') actions += '<button class="btn btn-sm btn-blue" onclick="AdminFeedback.setStatus(\'' + f.id + '\',\'resolved\')">Resolve</button>';
        else actions += '<button class="btn btn-sm btn-ghost" onclick="AdminFeedback.setStatus(\'' + f.id + '\',\'new\')">Reopen</button>';
        return '<tr' + (f.status === 'new' ? ' style="background:rgba(255,204,0,.05);"' : '') + '>' +
          '<td class="text-muted nowrap">' + esc(rel(f.created_at)) + '</td>' +
          '<td><strong>' + name + '</strong> <span style="font-size:10px;font-weight:800;color:' + srcColor + ';">' + src + '</span>' + email + '</td>' +
          '<td>' + esc(CAT[f.category] || f.category || 'Other') + '</td>' +
          '<td style="max-width:420px;white-space:normal;">' + esc(f.message || '') + '</td>' +
          '<td>' + self.statusPill(f.status) + '</td>' +
          '<td class="nowrap" style="text-align:right;">' + actions + '</td>' +
          '</tr>';
      }).join('');
    },

    setStatus: async function (id, status) {
      try {
        var res = await window.supabase.from('feedback').update({ status: status }).eq('id', id);
        if (res.error) { console.error('[FFP Admin Feedback] update:', res.error); if (window.showToast) showToast('Could not update', 'error'); return; }
        var row = this.data.find(function (x) { return x.id === id; });
        if (row) row.status = status;
        this.render();
      } catch (e) { console.error('[FFP Admin Feedback]', e); }
    },

    refresh: async function () {
      try {
        var res = await window.supabase.from('feedback')
          .select('id, source, submitter_name, submitter_email, category, message, status, created_at')
          .order('created_at', { ascending: false });
        if (res.error) { console.error('[FFP Admin Feedback] fetch:', res.error); return; }
        this.data = res.data || [];
        this.render();
      } catch (e) { console.error('[FFP Admin Feedback]', e); }
    }
  };

  async function init() {
    var ok = await waitFor(function () { return window.supabase && document.getElementById('feedback-tbody'); }, 15000);
    if (!ok) { console.error('[FFP Admin Feedback] deps never loaded'); return; }
    window.AdminFeedback = AF;
    // v2: event-driven — load on confirmed admin session, never unauthenticated.
    document.addEventListener('ffp-admin-ready', function () { AF.refresh(); });
    if (window.FFP_ADMIN) { try { await AF.refresh(); } catch (e) { console.error(e); } }
    if (window.FFPRealtime) {
      window.FFPRealtime.subscribe('admin-feedback', 'feedback', null, function () { AF.refresh(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

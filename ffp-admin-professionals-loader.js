/* FFP Admin Professionals Loader — v3 (2026-08-09) — WORLD-CLASS, scales to 100k+.
   Server-side search + status filter + pagination via admin_professionals_search(p_q,p_status,p_limit,p_offset)
   (is_admin-gated; returns {total, counts:{all,live,pending,unlisted}, rows:[page]}). Dense, scannable table:
   photo/name/email · type · location · experience · payments · status · per-row actions
   (Approve & publish / Unlist / Reject / View). Full public-profile preview modal retained.
   Renders into #pro-verify-root inside #panel-professionals. */
(function () {
  'use strict';
  function sb() { return window.supabase; }
  function toast(m, t) { if (window.showToast) return window.showToast(m, t); if (window.toast) return window.toast(m, t); console.log('[Pros]', m); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function initials(nm) { return (String(nm || '').split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2) || 'P').toUpperCase(); }

  var PAGE = 25;
  var state = { q: '', status: 'all', page: 0, total: 0, counts: { all: 0, live: 0, pending: 0, unlisted: 0 }, rows: [], loading: false };
  var _rows = [];   // current page (for preview lookup)
  var _debounce = null;

  function injectCss() {
    if (document.getElementById('ffp-pros-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-pros-css';
    s.textContent = [
      '#pro-verify-root{--pw-line:rgba(43,168,224,.14);}',
      '#pro-verify-root .pw-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;}',
      '#pro-verify-root .pw-search{position:relative;flex:1;min-width:220px;}',
      '#pro-verify-root .pw-search .material-icons{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:18px;color:#6f8698;pointer-events:none;}',
      '#pro-verify-root .pw-search input{width:100%;box-sizing:border-box;background:#0f1e2e;border:1px solid var(--pw-line);border-radius:10px;padding:11px 12px 11px 38px;color:#e8f1f8;font-size:14px;font-family:inherit;outline:none;}',
      '#pro-verify-root .pw-search input:focus{border-color:#2ba8e0;}',
      '#pro-verify-root .pw-tabs{display:flex;gap:6px;flex-wrap:wrap;}',
      '#pro-verify-root .pw-tab{font-size:12.5px;font-weight:800;color:#9db4c7;background:#0f1e2e;border:1px solid var(--pw-line);border-radius:20px;padding:8px 13px;cursor:pointer;}',
      '#pro-verify-root .pw-tab .n{opacity:.65;margin-left:5px;font-variant-numeric:tabular-nums;}',
      '#pro-verify-root .pw-tab.on{background:#FFCC00;color:#0a0a0a;border-color:#FFCC00;}',
      '#pro-verify-root .pw-tab.on .n{opacity:.75;}',
      '#pro-verify-root .pw-wrap{border:1px solid var(--pw-line);border-radius:14px;overflow:hidden;overflow-x:auto;background:#0c1926;-webkit-overflow-scrolling:touch;}',
      '#pro-verify-root table.pw-tbl{width:100%;border-collapse:collapse;min-width:780px;}',
      '#pro-verify-root .pw-tbl th{text-align:left;font-size:10.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#7c93a6;padding:11px 14px;background:#0f1e2e;border-bottom:1px solid var(--pw-line);white-space:nowrap;}',
      '#pro-verify-root .pw-tbl th.r,#pro-verify-root .pw-tbl td.r{text-align:right;}',
      '#pro-verify-root .pw-tbl td{padding:11px 14px;border-bottom:1px solid rgba(43,168,224,.08);vertical-align:middle;font-size:13px;color:#cddae6;white-space:nowrap;}',
      '#pro-verify-root .pw-tbl tr:last-child td{border-bottom:none;}',
      '#pro-verify-root .pw-tbl tbody tr{cursor:pointer;transition:background .12s;}',
      '#pro-verify-root .pw-tbl tbody tr:hover{background:rgba(43,168,224,.06);}',
      '#pro-verify-root .pw-who{display:flex;align-items:center;gap:11px;min-width:0;}',
      '#pro-verify-root .pw-ph{width:38px;height:38px;border-radius:50%;flex:none;background:#13283b center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-weight:800;color:#7fa7c4;font-size:13px;overflow:hidden;}',
      '#pro-verify-root .pw-nm{font-weight:800;color:#fff;font-size:13.5px;}',
      '#pro-verify-root .pw-sub{font-size:11.5px;color:#7f97a9;margin-top:1px;}',
      '#pro-verify-root .pw-badge{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;border-radius:20px;padding:3px 9px;}',
      '#pro-verify-root .pw-pay{font-size:12px;font-weight:700;}',
      '#pro-verify-root .pw-actions{display:flex;gap:6px;justify-content:flex-end;}',
      '#pro-verify-root .pw-btn{border:none;border-radius:8px;padding:7px 12px;font-weight:800;font-size:11.5px;cursor:pointer;font-family:inherit;white-space:nowrap;}',
      '#pro-verify-root .pw-approve{background:#22c55e;color:#06210f;}',
      '#pro-verify-root .pw-reject{background:rgba(239,68,68,.14);color:#f07171;border:1px solid rgba(239,68,68,.4);}',
      '#pro-verify-root .pw-unlist{background:#16324a;color:#cfe0ee;border:1px solid rgba(43,168,224,.3);}',
      '#pro-verify-root .pw-view{background:#13283b;color:#a9c3d6;border:1px solid rgba(43,168,224,.22);}',
      '#pro-verify-root .pw-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;flex-wrap:wrap;}',
      '#pro-verify-root .pw-pager .info{font-size:12.5px;color:#8fa6b8;font-weight:600;font-variant-numeric:tabular-nums;}',
      '#pro-verify-root .pw-pg{display:flex;gap:8px;}',
      '#pro-verify-root .pw-pg button{background:#0f1e2e;border:1px solid var(--pw-line);color:#cddae6;border-radius:9px;padding:8px 14px;font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit;}',
      '#pro-verify-root .pw-pg button:disabled{opacity:.4;cursor:not-allowed;}',
      '#pro-verify-root .pw-empty{padding:36px;text-align:center;color:#8a99a8;font-size:13px;}',
      '#pro-verify-root a.pv-link{color:#2ba8e0;font-size:12px;font-weight:700;text-decoration:none;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function statusOf(p) { return String(p.verification_status || 'unlisted').toLowerCase(); }
  function badge(p) {
    var vs = statusOf(p);
    var map = {
      pending: ['Pending', '#3a2e0a', '#f5c451'],
      approved: [(p.is_published === false ? 'Approved' : 'Live'), '#06210f', '#7fd0a3'],
      unlisted: ['Unlisted', '#1c2a35', '#9db4c7'],
      rejected: ['Rejected', '#3a0f0f', '#f07171']
    };
    var m = map[vs] || map.unlisted;
    return '<span class="pw-badge" style="background:' + m[1] + ';color:' + m[2] + ';">' + esc(m[0]) + '</span>';
  }
  function payCell(p) {
    var connected = !!(p.stripe_account_id || p.charges_enabled);
    if (!connected) return '<span class="pw-pay" style="color:#7c93a6;">Not set up</span>';
    var ok = p.charges_enabled && p.payouts_enabled;
    return '<span class="pw-pay" style="color:' + (ok ? '#7fd0a3' : '#e0b83a') + ';">' + (ok ? 'Connected' : 'Partial') + '</span>';
  }
  function typeCell(p) {
    var t = p.professional_types || [];
    if (!t.length) return '<span style="color:#6f8698;">—</span>';
    return esc(t[0]) + (t.length > 1 ? ' <span style="color:#6f8698;">+' + (t.length - 1) + '</span>' : '');
  }
  function nameOf(p) { return p.display_name || ((p.given_names || '') + ' ' + (p.surname || '')).trim() || 'Professional'; }

  function rowHtml(p) {
    var name = esc(nameOf(p));
    var ph = p.profile_photo_url
      ? '<div class="pw-ph" style="background-image:url(\'' + esc(p.profile_photo_url) + '\');"></div>'
      : '<div class="pw-ph">' + initials(nameOf(p)) + '</div>';
    var loc = [p.city, p.country].filter(Boolean).map(esc).join(', ') || '—';
    var vs = statusOf(p);
    var view = '<button class="pw-btn pw-view" data-act="preview">View</button>';
    var approve = '<button class="pw-btn pw-approve" data-act="approve">Approve</button>';
    var reject = '<button class="pw-btn pw-reject" data-act="reject">Reject</button>';
    var unlist = '<button class="pw-btn pw-unlist" data-act="unlist">Unlist</button>';
    var acts = view + (vs === 'pending' ? (approve + reject) : vs === 'approved' ? unlist : approve);
    return '<tr data-id="' + p.id + '">' +
      '<td><div class="pw-who">' + ph + '<div style="min-width:0;"><div class="pw-nm">' + name + '</div><div class="pw-sub">' + esc(p.work_email || '—') + '</div></div></div></td>' +
      '<td>' + typeCell(p) + '</td>' +
      '<td>' + loc + '</td>' +
      '<td class="r">' + (p.years_experience ? esc(String(p.years_experience)) + ' yrs' : '—') + '</td>' +
      '<td>' + payCell(p) + '</td>' +
      '<td>' + badge(p) + '</td>' +
      '<td class="r"><div class="pw-actions">' + acts + '</div></td>' +
      '</tr>';
  }

  // ── shell (built once so the search box never loses focus) ──
  function mount() {
    var host = document.getElementById('pro-verify-root'); if (!host || host._mounted) return;
    host._mounted = true;
    host.innerHTML =
      '<div class="pw-toolbar">' +
        '<div class="pw-search"><span class="material-icons">search</span>' +
        '<input id="pw-q" type="text" autocomplete="off" placeholder="Search name, email, city or type…"></div>' +
        '<div class="pw-tabs" id="pw-tabs"></div>' +
      '</div>' +
      '<div id="pw-body"></div>' +
      '<div id="pw-pager" class="pw-pager" style="display:none;"></div>';

    host.addEventListener('click', function (e) {
      var tab = e.target.closest && e.target.closest('.pw-tab');
      if (tab) { state.status = tab.dataset.status; state.page = 0; fetchPage(); return; }
      var pg = e.target.closest && e.target.closest('.pw-pg button');
      if (pg && !pg.disabled) { state.page += (pg.dataset.dir === 'next' ? 1 : -1); if (state.page < 0) state.page = 0; fetchPage(); return; }
      var btn = e.target.closest && e.target.closest('.pw-btn');
      if (btn && btn.dataset.act) {
        e.stopPropagation();
        var tr = btn.closest('tr'); if (!tr) return; var id = tr.dataset.id;
        if (btn.dataset.act === 'preview') return preview(id);
        if (btn.dataset.act === 'approve') return setStatus(id, 'approved');
        if (btn.dataset.act === 'unlist') return setStatus(id, 'unlisted');
        if (btn.dataset.act === 'reject') { var note = prompt('Reason for the professional (optional):', ''); if (note === null) return; return setStatus(id, 'rejected', note); }
        return;
      }
      var row = e.target.closest && e.target.closest('tr[data-id]');
      if (row) preview(row.dataset.id);
    });

    var q = document.getElementById('pw-q');
    if (q) q.addEventListener('input', function () {
      state.q = q.value; state.page = 0;
      if (_debounce) clearTimeout(_debounce);
      _debounce = setTimeout(fetchPage, 280);
    });
  }

  function paintTabs() {
    var el = document.getElementById('pw-tabs'); if (!el) return;
    var c = state.counts || {};
    var defs = [['all', 'All', c.all], ['live', 'Live', c.live], ['pending', 'Pending', c.pending], ['unlisted', 'Unlisted', c.unlisted]];
    el.innerHTML = defs.map(function (d) {
      return '<button class="pw-tab' + (state.status === d[0] ? ' on' : '') + '" data-status="' + d[0] + '">' + d[1] + '<span class="n">' + (d[2] || 0) + '</span></button>';
    }).join('');
  }
  function paintBody() {
    var el = document.getElementById('pw-body'); if (!el) return;
    if (state.loading) { el.innerHTML = '<div class="pw-empty">Loading…</div>'; return; }
    if (!state.rows.length) { el.innerHTML = '<div class="pw-empty">' + (state.q ? 'No professionals match “' + esc(state.q) + '”.' : 'No professionals in this view.') + '</div>'; return; }
    el.innerHTML = '<div class="pw-wrap"><table class="pw-tbl">' +
      '<thead><tr><th>Professional</th><th>Type</th><th>Location</th><th class="r">Exp</th><th>Payments</th><th>Status</th><th class="r">Actions</th></tr></thead>' +
      '<tbody>' + state.rows.map(rowHtml).join('') + '</tbody></table></div>';
  }
  function paintPager() {
    var el = document.getElementById('pw-pager'); if (!el) return;
    if (!state.total) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    var from = state.total ? state.page * PAGE + 1 : 0;
    var to = Math.min(state.total, (state.page + 1) * PAGE);
    var last = to >= state.total;
    el.innerHTML = '<div class="info">' + from + '–' + to + ' of ' + state.total + '</div>' +
      '<div class="pw-pg"><button data-dir="prev"' + (state.page === 0 ? ' disabled' : '') + '>Previous</button>' +
      '<button data-dir="next"' + (last ? ' disabled' : '') + '>Next</button></div>';
  }
  function paint() { paintTabs(); paintBody(); paintPager(); }

  async function fetchPage() {
    mount();
    state.loading = true; paint();
    var res;
    try { res = await sb().rpc('admin_professionals_search', { p_q: state.q, p_status: state.status, p_limit: PAGE, p_offset: state.page * PAGE }); }
    catch (e) { state.loading = false; var b = document.getElementById('pw-body'); if (b) b.innerHTML = '<div class="pw-empty">Could not load.</div>'; return; }
    var d = res && res.data;
    if (d && d.error) { state.loading = false; var b2 = document.getElementById('pw-body'); if (b2) b2.innerHTML = '<div class="pw-empty">' + esc(d.error === 'forbidden' ? 'Admin sign-in required.' : d.error) + '</div>'; return; }
    state.total = (d && d.total) || 0;
    state.counts = (d && d.counts) || state.counts;
    state.rows = (d && d.rows) || [];
    _rows = state.rows;
    state.loading = false; paint();
  }

  async function setStatus(id, status, note) {
    try {
      var r = await sb().rpc('professional_set_verification', { p_pro: id, p_status: status, p_note: note || null });
      if (r && r.data && r.data.error) { toast(r.data.error === 'forbidden' ? 'Admin sign-in required' : r.data.error, 'error'); return; }
      toast(status === 'approved' ? 'Approved — now live' : status === 'unlisted' ? 'Unlisted' : 'Rejected', 'success');
      fetchPage();
    } catch (e) { toast('Action failed', 'error'); }
  }

  // Full in-admin preview — mirrors the public Find Fit People profile (services + intro videos live).
  async function preview(id) {
    var p = _rows.find(function (x) { return x.id === id; }); if (!p) return;
    var name = esc(nameOf(p));
    var loc = [p.city, p.country].filter(Boolean).map(esc).join(', ');
    var types = (p.professional_types || []).map(function (t) { return '<span style="font-size:12px;font-weight:700;color:#0e5a73;background:#e3f0f7;border-radius:20px;padding:4px 11px;">' + esc(t) + '</span>'; }).join('');
    var langs = (p.languages || []).map(esc).join(', ');
    var services = [], videos = [];
    try { var rs = await sb().rpc('pro_list_services', { p_pro: id }); services = (rs && rs.data) || []; } catch (e) {}
    try { var rv = await sb().rpc('pro_videos_list', { p_pro: id }); videos = (rv && rv.data) || []; } catch (e) {}
    var cover = p.cover_photo_url
      ? '<div style="height:140px;background:#cdd7dd url(\'' + esc(p.cover_photo_url) + '\') center/cover;"></div>'
      : '<div style="height:96px;background:linear-gradient(135deg,#1980AD,#0e3e4a);"></div>';
    var photo = p.profile_photo_url
      ? '<div style="width:92px;height:92px;border-radius:50%;border:4px solid #fff;flex:0 0 auto;background:#cdd7dd url(\'' + esc(p.profile_photo_url) + '\') center/cover;margin-top:-50px;"></div>'
      : '<div style="width:92px;height:92px;border-radius:50%;border:4px solid #fff;flex:0 0 auto;background:#1980AD;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:30px;margin-top:-50px;">' + esc(name.charAt(0).toUpperCase()) + '</div>';
    var metaBits = [];
    if (p.category) metaBits.push(esc(p.category));
    if (loc) metaBits.push(loc);
    if (p.years_experience) metaBits.push(esc(String(p.years_experience)) + ' yrs experience');
    var svcHtml = services.length ? ('<div style="font-size:13px;font-weight:800;color:#0e2531;margin:18px 0 6px;">Services</div>' + services.map(function (s) {
      var price = (s.price_aed != null && s.price_aed !== '') ? ((p.currency || 'AED') + ' ' + s.price_aed) : '';
      return '<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #eef1f3;font-size:13px;color:#0e2531;"><span>' + esc(s.name || 'Service') + (s.duration_min ? ' · ' + s.duration_min + ' min' : '') + '</span><b>' + esc(price) + '</b></div>';
    }).join('')) : '';
    var vidHtml = videos.length ? ('<div style="font-size:13px;font-weight:800;color:#0e2531;margin:18px 0 6px;">Intro video' + (videos.length > 1 ? 's' : '') + '</div>' + videos.map(function (v) {
      return '<div style="font-size:13px;padding:6px 0;"><a href="' + esc(v.url || v.video_url || '#') + '" target="_blank" rel="noopener" style="color:#1980AD;font-weight:700;">▶ ' + esc(v.title || 'Watch intro video') + '</a></div>';
    }).join('')) : '';
    var inner = cover +
      '<div style="padding:0 22px 22px;">' +
        '<div style="display:flex;align-items:flex-end;gap:14px;">' + photo +
          '<div style="padding-bottom:6px;min-width:0;"><div style="font-size:20px;font-weight:900;color:#0e2531;">' + name + '</div>' +
          (p.headline ? '<div style="font-size:13px;color:#566069;font-weight:600;margin-top:2px;">' + esc(p.headline) + '</div>' : '') + '</div></div>' +
        (metaBits.length ? '<div style="font-size:12px;color:#8a96a1;font-weight:600;margin-top:10px;">' + metaBits.join(' · ') + '</div>' : '') +
        (types ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">' + types + '</div>' : '') +
        (p.bio ? '<div style="font-size:13px;color:#3a4a52;line-height:1.6;margin-top:14px;white-space:pre-wrap;">' + esc(p.bio) + '</div>' : '') +
        (p.certifications ? '<div style="font-size:12px;color:#566069;margin-top:12px;"><b>Certifications:</b> ' + esc(Array.isArray(p.certifications) ? p.certifications.join(', ') : p.certifications) + '</div>' : '') +
        (langs ? '<div style="font-size:12px;color:#566069;margin-top:6px;"><b>Languages:</b> ' + langs + '</div>' : '') +
        svcHtml + vidHtml +
        '<div style="font-size:12px;color:#8a96a1;margin-top:16px;border-top:1px solid #eef1f3;padding-top:12px;">Contact (admin only): ' + esc(p.work_email || '—') + (p.phone ? ' · ' + esc(p.phone) : '') + '</div>' +
      '</div>';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(8,16,24,.62);z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto;';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5);font-family:-apple-system,system-ui,sans-serif;position:relative;">' +
      '<button title="Close" style="position:absolute;top:12px;right:12px;z-index:3;background:rgba(0,0,0,.45);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:15px;line-height:1;" onclick="var o=this.closest(\'div\').parentElement; if(o) o.remove();">✕</button>' +
      '<div style="background:#eaf0f2;padding:8px 16px;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#566069;text-align:center;">Preview — exactly what publishes on Find Fit People</div>' +
      inner + '</div>';
    document.body.appendChild(ov);
  }

  function init() { if (!sb()) { setTimeout(init, 150); return; } injectCss(); mount(); fetchPage(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

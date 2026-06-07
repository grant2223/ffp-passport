/* FFP Admin Taxonomies Loader — v5 (2026-06-07)
   v5: added 'Events' list (list_key='event') — the race-resume event catalog members pick from when
       logging an event result (Fitness Stats → Results). Full add/rename/reorder/hide/delete via the
       existing CRUD. The member results loader reads taxonomy_items where list_key='event' & active.
   v4 (2026-06-03)
   v4: added two lists used by Provider Rankings classification — 'Provider Types' (provider_type:
       Gym/Studio/Yoga studio/Sports club-team/Adventure service/…) + 'Gym Size Bands' (gym_size).
       Admin can add/rename/reorder/hide these; the Rankings tab dropdowns + per-row classification
       selects read them live.
   v3: Provider Categories now have a PASSPORT selector per row (Pick A Passport map lens) —
       assigning it writes the category row's `parent` = passport id; the member map reads
       FFP_TAX.categoryPassport live. Passport options come from list_key='passport'.
   Real CRUD editor for platform-wide taxonomy lists, backed by public.taxonomy_items.
   v2: added Countries + Cities (cascade: pick a country, edit its cities) + Experience Types.
   Admin (real Supabase Auth, is_admin) reads ALL rows + writes via RLS taxonomy_admin_write.
   Edits hydrate window.FFP_TAX on every page (assets/ffp-taxonomy.js) → propagate platform-wide.
   Renders into #tax-editor inside #panel-taxonomies. */
(function () {
  'use strict';

  var LISTS = [
    { key: 'activity',        name: 'Activities' },
    { key: 'event',           name: 'Events' },
    { key: 'category',        name: 'Provider Categories' },
    { key: 'experience_type', name: 'Experience Types' },
    { key: 'fitness_level',   name: 'Fitness Levels' },
    { key: 'country',         name: 'Countries' },
    { key: 'city',            name: 'Cities', nested: true },
    { key: 'nationality',     name: 'Nationalities' },
    { key: 'gender',          name: 'Genders' },
    { key: 'age_group',       name: 'Age Groups' },
    { key: 'provider_type',   name: 'Provider Types' },
    { key: 'gym_size',        name: 'Gym Size Bands' }
  ];

  var state = { current: 'activity', cityCountry: 'United Arab Emirates', data: {} };

  function sb() { return window.supabase; }
  function toast(msg, type) {
    if (typeof window.showToast === 'function') return window.showToast(msg, type);
    if (typeof window.toast === 'function') return window.toast(msg, type);
    console.log('[Taxonomies]', msg);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function isNested() { return state.current === 'city'; }

  function injectCss() {
    if (document.getElementById('ffp-tax-css')) return;
    var s = document.createElement('style');
    s.id = 'ffp-tax-css';
    s.textContent = [
      '#tax-editor .tx-wrap{display:grid;grid-template-columns:220px 1fr;gap:18px;align-items:start;}',
      '@media(max-width:760px){#tax-editor .tx-wrap{grid-template-columns:1fr;}}',
      '#tax-editor .tx-lists{display:flex;flex-direction:column;gap:6px;}',
      '#tax-editor .tx-listbtn{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:11px 14px;border-radius:10px;border:1px solid rgba(43,168,224,.2);background:rgba(43,168,224,.05);color:#cfe0ec;font-weight:700;font-size:13px;cursor:pointer;text-align:left;}',
      '#tax-editor .tx-listbtn .c{font-size:11px;font-weight:800;color:#8a99a8;background:rgba(255,255,255,.06);border-radius:20px;padding:1px 8px;}',
      '#tax-editor .tx-listbtn.active{background:#2ba8e0;color:#082335;border-color:#2ba8e0;}',
      '#tax-editor .tx-listbtn.active .c{color:#082335;background:rgba(8,35,53,.18);}',
      '#tax-editor .tx-panel{border:1px solid rgba(43,168,224,.2);border-radius:14px;overflow:hidden;background:#0f1e2e;}',
      '#tax-editor .tx-bar{display:flex;gap:8px;padding:14px;border-bottom:1px solid rgba(43,168,224,.12);flex-wrap:wrap;align-items:center;}',
      '#tax-editor .tx-bar input,#tax-editor .tx-bar select{background:#081420;border:1px solid rgba(43,168,224,.25);border-radius:9px;color:#e8eef4;padding:10px 12px;font-size:13px;font-family:inherit;}',
      '#tax-editor .tx-bar input{flex:1;min-width:160px;}',
      '#tax-editor .tx-bar .tx-country{flex:0 0 200px;}',
      '#tax-editor .tx-bar button{background:#FFCC00;color:#082335;border:none;border-radius:9px;padding:10px 18px;font-weight:800;font-size:13px;cursor:pointer;}',
      '#tax-editor .tx-bar label{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8a99a8;font-weight:800;}',
      '#tax-editor table{width:100%;border-collapse:collapse;}',
      '#tax-editor th{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8a99a8;text-align:left;padding:10px 14px;border-bottom:1px solid rgba(43,168,224,.12);}',
      '#tax-editor td{padding:9px 14px;border-bottom:1px solid rgba(43,168,224,.07);font-size:13px;color:#dce8f2;}',
      '#tax-editor tr.inactive td{opacity:.45;}',
      '#tax-editor .tx-name{background:transparent;border:1px solid transparent;border-radius:7px;color:#fff;font-size:13px;font-weight:600;padding:5px 8px;font-family:inherit;width:100%;max-width:340px;}',
      '#tax-editor .tx-name:hover{border-color:rgba(43,168,224,.25);}',
      '#tax-editor .tx-name:focus{border-color:#2ba8e0;background:#081420;outline:none;}',
      '#tax-editor .tx-act{display:flex;gap:4px;justify-content:flex-end;}',
      '#tax-editor .tx-ic{background:rgba(43,168,224,.08);border:1px solid rgba(43,168,224,.18);border-radius:7px;color:#9dbdd0;cursor:pointer;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;}',
      '#tax-editor .tx-ic:hover{color:#fff;border-color:#2ba8e0;}',
      '#tax-editor .tx-ic.danger:hover{color:#ef4444;border-color:#ef4444;}',
      '#tax-editor .tx-ic .material-icons{font-size:16px;}',
      '#tax-editor .tx-pill{font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;}',
      '#tax-editor .tx-pill.on{background:rgba(34,197,94,.14);color:#22c55e;}',
      '#tax-editor .tx-pill.off{background:rgba(138,153,168,.14);color:#8a99a8;}',
      '#tax-editor .tx-pass{background:#081420;border:1px solid rgba(43,168,224,.25);border-radius:8px;color:#e8eef4;padding:6px 8px;font-size:12px;font-family:inherit;font-weight:700;cursor:pointer;width:100%;max-width:150px;}',
      '#tax-editor .tx-pass:focus{outline:none;border-color:#2ba8e0;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  async function fetchAll() {
    var res = await sb().from('taxonomy_items')
      .select('id, list_key, value, label, sort_order, active, parent')
      .order('list_key', { ascending: true })
      .order('sort_order', { ascending: true });
    if (res.error) { console.error('[Taxonomies] fetch', res.error); toast('Could not load taxonomy', 'error'); return; }
    var by = {};
    LISTS.forEach(function (l) { by[l.key] = []; });
    (res.data || []).forEach(function (r) { (by[r.list_key] = by[r.list_key] || []).push(r); });
    state.data = by;
  }

  // rows for the currently selected list (cities filtered to the chosen country)
  function curRows() {
    var rows = state.data[state.current] || [];
    if (isNested()) rows = rows.filter(function (r) { return r.parent === state.cityCountry; });
    return rows.slice().sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
  }
  function findRow(id) { return (state.data[state.current] || []).filter(function (r) { return r.id === id; })[0]; }

  function render() {
    var host = document.getElementById('tax-editor');
    if (!host) return;
    var listsHtml = LISTS.map(function (l) {
      var n = (state.data[l.key] || []).length;
      return '<button class="tx-listbtn' + (l.key === state.current ? ' active' : '') + '" data-list="' + l.key + '">' +
             '<span>' + esc(l.name) + '</span><span class="c">' + n + '</span></button>';
    }).join('');

    var cur = LISTS.filter(function (l) { return l.key === state.current; })[0] || {};
    var rows = curRows();

    var bar;
    if (isNested()) {
      var countries = (state.data.country || []).slice().sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
      var opts = countries.map(function (c) {
        var v = c.value;
        return '<option value="' + esc(v) + '"' + (v === state.cityCountry ? ' selected' : '') + '>' + esc(c.label || v) + '</option>';
      }).join('');
      bar = '<div class="tx-bar">' +
              '<label>Country</label><select id="tx-country" class="tx-country">' + opts + '</select>' +
              '<input id="tx-new" type="text" placeholder="Add a city to ' + esc(state.cityCountry) + '…">' +
              '<button id="tx-add-btn" type="button">Add City</button>' +
            '</div>';
    } else {
      bar = '<div class="tx-bar">' +
              '<input id="tx-new" type="text" placeholder="Add to ' + esc(cur.name || '') + '… e.g. ' + esc((rows[0] && (rows[0].label || rows[0].value)) || 'New item') + '">' +
              '<button id="tx-add-btn" type="button">Add</button>' +
            '</div>';
    }

    var isCat = state.current === 'category';
    var passOpts = '';
    if (isCat) {
      var plist = (state.data.passport || []).slice().sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
      passOpts = plist.map(function (p) { return '<option value="' + esc(p.value) + '">' + esc(p.label || p.value) + '</option>'; }).join('');
    }
    var rowsHtml = rows.length ? rows.map(function (r, i) {
      var passCell = '';
      if (isCat) {
        var sel = '<option value=""' + (!r.parent ? ' selected' : '') + '>— none —</option>' +
          (state.data.passport || []).slice().sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
            .map(function (p) { return '<option value="' + esc(p.value) + '"' + (r.parent === p.value ? ' selected' : '') + '>' + esc(p.label || p.value) + '</option>'; }).join('');
        passCell = '<td style="width:160px;"><select class="tx-pass" data-id="' + r.id + '">' + sel + '</select></td>';
      }
      return '<tr class="' + (r.active ? '' : 'inactive') + '" data-id="' + r.id + '">' +
        '<td style="width:34px;color:#6a90a8;">' + (i + 1) + '</td>' +
        '<td><input class="tx-name" value="' + esc(r.label || r.value) + '" data-id="' + r.id + '"></td>' +
        passCell +
        '<td style="width:90px;"><span class="tx-pill ' + (r.active ? 'on' : 'off') + '">' + (r.active ? 'Live' : 'Hidden') + '</span></td>' +
        '<td style="width:150px;"><div class="tx-act">' +
          '<button class="tx-ic" data-act="up" title="Move up"><span class="material-icons">arrow_upward</span></button>' +
          '<button class="tx-ic" data-act="down" title="Move down"><span class="material-icons">arrow_downward</span></button>' +
          '<button class="tx-ic" data-act="toggle" title="' + (r.active ? 'Hide' : 'Show') + '"><span class="material-icons">' + (r.active ? 'visibility_off' : 'visibility') + '</span></button>' +
          '<button class="tx-ic danger" data-act="del" title="Delete"><span class="material-icons">delete</span></button>' +
        '</div></td></tr>';
    }).join('') : '<tr><td colspan="4" class="text-muted" style="text-align:center;padding:26px;">No items yet — add one above.</td></tr>';

    host.innerHTML =
      '<div class="tx-wrap">' +
        '<div class="tx-lists">' + listsHtml + '</div>' +
        '<div class="tx-panel">' + bar +
          '<table><thead><tr><th>#</th><th>Name</th>' + (isCat ? '<th>Passport</th>' : '') + '<th>Status</th><th style="text-align:right;">Actions</th></tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody></table>' +
        '</div>' +
      '</div>';

    wire(host);
  }

  function wire(host) {
    // Event DELEGATION on the container — survives re-renders and avoids any per-button
    // binding timing issues. One click handler routes every button.
    host.onclick = function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var lb = t.closest('.tx-listbtn');
      if (lb) { state.current = lb.dataset.list; render(); return; }
      if (t.closest('#tx-add-btn')) {
        var inp = host.querySelector('#tx-new');
        console.log('[Tax] Add clicked. value=', JSON.stringify(inp ? inp.value : null), 'list=', state.current);
        addItem(inp ? inp.value : '');
        return;
      }
      var ic = t.closest('.tx-ic');
      if (ic) {
        var tr = ic.closest('tr'); if (!tr) return;
        var id = tr.dataset.id, act = ic.dataset.act;
        if (act === 'toggle') toggleItem(id);
        else if (act === 'del') delItem(id);
        else if (act === 'up') moveItem(id, -1);
        else if (act === 'down') moveItem(id, 1);
        return;
      }
    };
    var ctrySel = host.querySelector('#tx-country');
    if (ctrySel) ctrySel.onchange = function () { state.cityCountry = ctrySel.value; render(); };
    var addInp = host.querySelector('#tx-new');
    if (addInp) addInp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); addItem(addInp.value); } };

    host.querySelectorAll('.tx-name').forEach(function (inp) {
      inp.onblur = function () { renameItem(inp.dataset.id, inp.value); };
      inp.onkeydown = function (e) { if (e.key === 'Enter') inp.blur(); };
    });
    host.querySelectorAll('.tx-pass').forEach(function (sel) {
      sel.onchange = function () { setCatPassport(sel.dataset.id, sel.value); };
    });
  }

  // Assign a provider category to a passport (Pick A Passport map lens) — stored in `parent`.
  async function setCatPassport(id, passport) {
    var r = findRow(id); if (!r) return;
    var res = await sb().from('taxonomy_items').update({ parent: passport || null }).eq('id', id);
    if (res.error) { toast('Could not set passport', 'error'); return; }
    r.parent = passport || null;
    toast('Passport updated', 'success');
  }

  async function addItem(val) {
    val = (val || '').trim();
    if (!val) {
      var inp0 = document.querySelector('#tax-editor #tx-new');
      if (inp0) { inp0.style.borderColor = '#ef4444'; inp0.focus(); }
      toast('Type a name in the box first, then tap Add', 'error');
      return;
    }
    var rows = curRows();
    if (rows.some(function (r) { return (r.value || '').toLowerCase() === val.toLowerCase(); })) {
      toast('Already in the list', 'error'); return;
    }
    var maxSort = rows.reduce(function (m, r) { return Math.max(m, r.sort_order || 0); }, -1);
    var payload = { list_key: state.current, value: val, label: val, sort_order: maxSort + 1, active: true };
    if (isNested()) payload.parent = state.cityCountry;
    console.log('[Tax] inserting', payload);
    var res = await sb().from('taxonomy_items').insert(payload).select().single();
    console.log('[Tax] insert result error=', res.error, 'data=', res.data);
    if (res.error) { console.error('[Tax] add failed:', res.error); toast(res.error.message || 'Add failed', 'error'); return; }
    (state.data[state.current] = state.data[state.current] || []).push(res.data);
    toast('Added "' + val + '"', 'success');
    render();
  }

  async function renameItem(id, label) {
    var r = findRow(id); if (!r) return;
    label = (label || '').trim();
    if (!label || label === r.label) { render(); return; }
    var res = await sb().from('taxonomy_items').update({ label: label }).eq('id', id);
    if (res.error) { toast('Rename failed', 'error'); return; }
    r.label = label;
    toast('Renamed', 'success');
  }

  async function toggleItem(id) {
    var r = findRow(id); if (!r) return;
    var res = await sb().from('taxonomy_items').update({ active: !r.active }).eq('id', id);
    if (res.error) { toast('Update failed', 'error'); return; }
    r.active = !r.active;
    render();
  }

  async function delItem(id) {
    var r = findRow(id); if (!r) return;
    if (!confirm('Delete "' + (r.label || r.value) + '"? This removes it everywhere.')) return;
    var res = await sb().from('taxonomy_items').delete().eq('id', id);
    if (res.error) { toast('Delete failed', 'error'); return; }
    state.data[state.current] = (state.data[state.current] || []).filter(function (x) { return x.id !== id; });
    toast('Deleted', 'success');
    render();
  }

  async function moveItem(id, dir) {
    var rows = curRows();
    var idx = rows.findIndex(function (r) { return r.id === id; });
    var j = idx + dir;
    if (idx < 0 || j < 0 || j >= rows.length) return;
    var a = rows[idx], b = rows[j];
    var sa = a.sort_order, sbo = b.sort_order;
    var r1 = await sb().from('taxonomy_items').update({ sort_order: sbo }).eq('id', a.id);
    var r2 = await sb().from('taxonomy_items').update({ sort_order: sa }).eq('id', b.id);
    if ((r1 && r1.error) || (r2 && r2.error)) { toast('Reorder failed', 'error'); return; }
    a.sort_order = sbo; b.sort_order = sa;
    render();
  }

  async function init() {
    if (!sb()) { setTimeout(init, 150); return; }
    injectCss();
    // Edits require a live admin Supabase session (RLS). If it's missing/expired the
    // lists still READ (public), but Add/rename/delete would silently fail — so say so.
    var hasSession = true;
    try {
      var sres = await sb().auth.getSession();
      hasSession = !!(sres && sres.data && sres.data.session);
    } catch (e) { hasSession = false; }
    if (!hasSession) {
      var h0 = document.getElementById('tax-editor');
      if (h0) h0.innerHTML = '<div style="padding:24px;color:#FFCC00;font-weight:700;line-height:1.6;">' +
        'Your admin session isn’t active, so edits can’t be saved.<br>' +
        'Please <b>Sign out</b> (top-right) and sign back in, then reopen Taxonomies.</div>';
      return;
    }
    await fetchAll();
    render();
    console.log('[FFP Admin Taxonomies] loaded v2.2 ✓ (empty-input feedback)');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

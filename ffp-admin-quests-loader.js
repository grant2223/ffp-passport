/* ═══════════════════════════════════════════════════════════════
   FFP ADMIN QUESTS LOADER · v1
   File path: ffp-admin-quests-loader-v1.js (repo root)
   On-load log: [FFP Admin Quests v1] Loaded ✓

   Builds the admin "Quests" panel: list quests, create/edit a quest, pick or
   create the stamp it awards, pick or create a sponsor (for prize quests),
   stake the venues that count toward it, and publish / pause / end.

   Writes directly to Supabase (admin is_admin() RLS already permits this).
   Self-contained: only needs an empty <section id="panel-quests"> + a sidebar
   link in the dashboard. Mirrors the ffp-admin-deals-loader pattern.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CATS = ['fitness', 'sports', 'wellness', 'recovery', 'adventure', 'food'];

  function toast(m, k) {
    if (typeof window.showToast === 'function') { try { window.showToast(m, k || 'info'); return; } catch (e) {} }
    console.log('[FFP Admin Quests]', m);
  }
  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function cap(s) { s = s || ''; return s.charAt(0).toUpperCase() + s.slice(1); }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function checked(id) { var e = document.getElementById(id); return !!(e && e.checked); }
  function waitFor(check, ms) {
    return new Promise(function (resolve) {
      var t = 0, lim = Math.ceil((ms || 30000) / 150);
      var iv = setInterval(function () { if (check() || t++ >= lim) { clearInterval(iv); resolve(check()); } }, 150);
    });
  }

  var S = { quests: [], stamps: [], sponsors: [], providers: [], tab: 'live', editing: null };

  function injectStyles() {
    if (document.getElementById('ffp-admin-quests-css')) return;
    var css = document.createElement('style');
    css.id = 'ffp-admin-quests-css';
    css.textContent = [
      '#panel-quests .aq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:18px;}',
      '#panel-quests .aq-card{background:#0f1e2e;border:1px solid #1a2f44;border-radius:14px;padding:16px;}',
      '#panel-quests .aq-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}',
      '#panel-quests .aq-title{font-size:15px;font-weight:800;color:#e8eef4;}',
      '#panel-quests .aq-meta{font-size:11px;color:#8a99a8;margin-top:3px;text-transform:capitalize;}',
      '#panel-quests .aq-pill{font-size:9px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:4px 9px;border-radius:5px;flex-shrink:0;}',
      '#panel-quests .aq-pill.live{background:#4ade80;color:#04210f;}',
      '#panel-quests .aq-pill.draft{background:rgba(255,204,0,.18);color:#FFCC00;}',
      '#panel-quests .aq-pill.ended{background:rgba(138,153,168,.18);color:#8a99a8;}',
      '#panel-quests .aq-reward{font-size:12px;color:#cfd6dc;margin:12px 0;display:flex;align-items:center;gap:6px;}',
      '#panel-quests .aq-reward .material-icons{font-size:16px;color:#b8965a;}',
      '#panel-quests .aq-foot{display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid #1a2f44;padding-top:12px;}',
      '.qf-row{margin-bottom:14px;}',
      '.qf-row label{display:block;font-size:11px;font-weight:700;color:#8a99a8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;}',
      '.qf-input,.qf-sel,.qf-area{width:100%;background:#08131f;border:1px solid #1a2f44;border-radius:9px;padding:11px 12px;color:#e8eef4;font-size:14px;font-family:inherit;}',
      '.qf-area{min-height:70px;resize:vertical;}',
      '.qf-two{display:flex;gap:12px;}.qf-two>div{flex:1;}',
      '.qf-check{display:flex;align-items:center;gap:8px;font-size:13px;color:#cfd6dc;}',
      '.qf-venues{max-height:160px;overflow-y:auto;border:1px solid #1a2f44;border-radius:9px;padding:10px;}',
      '.qf-venue{display:flex;align-items:center;gap:8px;font-size:13px;color:#cfd6dc;padding:5px 0;}'
    ].join('');
    document.head.appendChild(css);
  }

  function buildScaffold() {
    var panel = document.getElementById('panel-quests');
    if (!panel || panel.getAttribute('data-built')) return;
    panel.setAttribute('data-built', '1');
    panel.innerHTML =
      '<div class="panel-head"><h1>Quests</h1><div class="panel-head-actions">' +
        '<button class="btn btn-primary" onclick="AdminQuests.openForm()"><span class="material-icons">add</span>New quest</button>' +
      '</div></div>' +
      '<div class="section"><div class="tabs" id="aq-tabs"></div>' +
      '<div class="aq-grid" id="aq-list"></div></div>';
  }

  async function fetchAll() {
    var q = await window.supabase.from('quests')
      .select('*, sponsors(name, logo), quest_venues(provider_id)')
      .order('created_at', { ascending: false });
    if (q.error) { console.error('[Admin Quests] quests:', q.error); toast('Could not load quests', 'error'); }
    S.quests = q.data || [];
    var st = await window.supabase.from('stamps').select('id, name, icon').order('name');
    S.stamps = st.data || [];
    var sp = await window.supabase.from('sponsors').select('id, name, logo').order('name');
    S.sponsors = sp.data || [];
    var pr = await window.supabase.from('providers').select('id, business_name, status').order('business_name');
    S.providers = (pr.data || []).filter(function (p) { return p.status !== 'archived'; });
  }

  function renderTabs() {
    var el = document.getElementById('aq-tabs'); if (!el) return;
    var c = { live: 0, draft: 0, ended: 0 };
    S.quests.forEach(function (q) { if (c[q.status] != null) c[q.status]++; });
    ['live', 'draft', 'ended'].forEach(function () {});
    el.innerHTML = ['live', 'draft', 'ended'].map(function (t) {
      return '<button class="tab-btn' + (S.tab === t ? ' active' : '') + '" onclick="AdminQuests.setTab(\'' + t + '\')">' +
        cap(t) + ' <span class="count">' + c[t] + '</span></button>';
    }).join('');
  }

  function renderList() {
    renderTabs();
    var el = document.getElementById('aq-list'); if (!el) return;
    var rows = S.quests.filter(function (q) { return q.status === S.tab; });
    if (!rows.length) { el.innerHTML = '<div style="color:#8a99a8;padding:24px;">No ' + S.tab + ' quests.</div>'; return; }
    el.innerHTML = rows.map(function (q) {
      var venues = (q.quest_venues || []).length;
      var reward = q.reward_type === 'prize'
        ? '<span class="material-icons">redeem</span> Prize · ' + (q.prize_remaining != null ? q.prize_remaining : '?') + ' of ' + (q.prize_total != null ? q.prize_total : '?') + ' left' + (q.sponsors ? ' · ' + esc(q.sponsors.name) : '')
        : '<span class="material-icons">approval</span> Stamp';
      var foot = '<button class="btn btn-sm btn-ghost" onclick="AdminQuests.openForm(\'' + q.id + '\')"><span class="material-icons">edit</span>Edit</button>';
      if (q.status === 'draft') foot += '<button class="btn btn-sm btn-blue" onclick="AdminQuests.setStatus(\'' + q.id + '\',\'live\')"><span class="material-icons">publish</span>Publish</button>';
      if (q.status === 'live')  foot += '<button class="btn btn-sm btn-ghost" onclick="AdminQuests.setStatus(\'' + q.id + '\',\'draft\')"><span class="material-icons">pause</span>Unpublish</button>';
      if (q.status !== 'ended') foot += '<button class="btn btn-sm btn-ghost" onclick="AdminQuests.setStatus(\'' + q.id + '\',\'ended\')"><span class="material-icons">flag</span>End</button>';
      return '<div class="aq-card"><div class="aq-top"><div>' +
          '<div class="aq-title">' + esc(q.title) + '</div>' +
          '<div class="aq-meta">' + esc(q.scope) + ' · ' + esc(q.category) + ' · ' + q.target_count + ' stamps · ' + venues + ' venue' + (venues === 1 ? '' : 's') + '</div>' +
        '</div><span class="aq-pill ' + q.status + '">' + q.status + '</span></div>' +
        '<div class="aq-reward">' + reward + '</div>' +
        '<div class="aq-foot">' + foot + '</div></div>';
    }).join('');
  }

  function openForm(id) {
    var q = id ? S.quests.find(function (x) { return x.id === id; }) : null;
    S.editing = q || null;
    var stakedIds = q ? (q.quest_venues || []).map(function (v) { return v.provider_id; }) : [];

    var stampOpts = '<option value="__new">+ New stamp…</option>' + S.stamps.map(function (s) {
      return '<option value="' + s.id + '"' + (q && q.stamp_id === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    }).join('');
    var sponsorOpts = '<option value="">— none —</option><option value="__new">+ New sponsor…</option>' + S.sponsors.map(function (s) {
      return '<option value="' + s.id + '"' + (q && q.sponsor_id === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    }).join('');
    var catOpts = CATS.map(function (c) { return '<option value="' + c + '"' + (q && q.category === c ? ' selected' : '') + '>' + cap(c) + '</option>'; }).join('');
    var scopeOpts = ['city', 'country', 'global'].map(function (c) { return '<option value="' + c + '"' + (q && q.scope === c ? ' selected' : '') + '>' + cap(c) + '</option>'; }).join('');
    var venueRows = S.providers.map(function (p) {
      return '<label class="qf-venue"><input type="checkbox" id="qv-' + p.id + '"' + (stakedIds.indexOf(p.id) >= 0 ? ' checked' : '') + '> ' + esc(p.business_name) + '</label>';
    }).join('') || '<div style="color:#8a99a8;font-size:13px;">No providers yet.</div>';

    var body =
      '<div class="qf-row"><label>Title</label><input class="qf-input" id="q-title" value="' + esc(q ? q.title : '') + '" placeholder="e.g. Sport Sampler"></div>' +
      '<div class="qf-row"><label>Description</label><textarea class="qf-area" id="q-desc" placeholder="What the member does">' + esc(q ? (q.description || '') : '') + '</textarea></div>' +
      '<div class="qf-row qf-two"><div><label>Category</label><select class="qf-sel" id="q-category">' + catOpts + '</select></div>' +
        '<div><label>Scope</label><select class="qf-sel" id="q-scope">' + scopeOpts + '</select></div></div>' +
      '<div class="qf-row"><label>City / Country (leave blank for Global)</label><input class="qf-input" id="q-location" value="' + esc(q ? (q.city || q.country || '') : '') + '" placeholder="e.g. Dubai"></div>' +
      '<div class="qf-row qf-two"><div><label>Stamps to complete</label><input class="qf-input" id="q-target" type="number" min="1" value="' + (q ? q.target_count : 5) + '"></div>' +
        '<div><label style="visibility:hidden;">x</label><label class="qf-check"><input type="checkbox" id="q-distinct"' + (q && q.require_distinct_venues ? ' checked' : '') + '> Different venues only</label></div></div>' +
      '<div class="qf-row"><label>Reward stamp</label><select class="qf-sel" id="q-stamp" onchange="AdminQuests.toggleStamp()">' + stampOpts + '</select>' +
        '<div id="q-stamp-new" style="display:none;margin-top:10px;" class="qf-two"><div><input class="qf-input" id="q-stamp-name" placeholder="Stamp name"></div><div><input class="qf-input" id="q-stamp-icon" placeholder="icon (e.g. approval)"></div></div></div>' +
      '<div class="qf-row"><label>Reward type</label><select class="qf-sel" id="q-reward" onchange="AdminQuests.toggleReward()">' +
        '<option value="stamp"' + (q && q.reward_type === 'stamp' ? ' selected' : '') + '>Stamp only</option>' +
        '<option value="prize"' + (q && q.reward_type === 'prize' ? ' selected' : '') + '>Sponsored prize (first N win)</option></select></div>' +
      '<div id="q-prize-box" style="display:none;">' +
        '<div class="qf-row"><label>Sponsor</label><select class="qf-sel" id="q-sponsor" onchange="AdminQuests.toggleSponsor()">' + sponsorOpts + '</select>' +
          '<div id="q-sponsor-new" style="display:none;margin-top:10px;" class="qf-two"><div><input class="qf-input" id="q-sponsor-name" placeholder="Sponsor name"></div><div><input class="qf-input" id="q-sponsor-logo" placeholder="Logo text (e.g. GS)"></div></div></div>' +
        '<div class="qf-row"><label>Number of prizes (first N to finish win)</label><input class="qf-input" id="q-prize-total" type="number" min="1" value="' + (q && q.prize_total != null ? q.prize_total : 5) + '"></div>' +
      '</div>' +
      '<div class="qf-row"><label>Hero image URL (optional)</label><input class="qf-input" id="q-hero" value="' + esc(q ? (q.hero_image_url || '') : '') + '" placeholder="https://…"></div>' +
      '<div class="qf-row"><label>Venues that count toward this quest</label><div class="qf-venues">' + venueRows + '</div></div>';

    var foot = '<button class="btn btn-ghost" onclick="closeQuestModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="AdminQuests.save()"><span class="material-icons">save</span>' + (q ? 'Save changes' : 'Save as draft') + '</button>';

    openModal(q ? 'Edit quest' : 'New quest', body, foot);
    toggleReward(); toggleStamp(); toggleSponsor();
  }

  function toggleReward() { var b = document.getElementById('q-prize-box'); if (b) b.style.display = (val('q-reward') === 'prize') ? 'block' : 'none'; }
  function toggleStamp() { var n = document.getElementById('q-stamp-new'); if (n) n.style.display = (val('q-stamp') === '__new') ? 'flex' : 'none'; }
  function toggleSponsor() { var n = document.getElementById('q-sponsor-new'); if (n) n.style.display = (val('q-sponsor') === '__new') ? 'flex' : 'none'; }

  async function save() {
    try {
      var title = val('q-title');
      if (!title) { toast('Title is required', 'error'); return; }
      var target = parseInt(val('q-target'), 10);
      if (!target || target < 1) { toast('Stamps to complete must be at least 1', 'error'); return; }

      // resolve stamp
      var stampId = val('q-stamp');
      if (stampId === '__new') {
        var sn = val('q-stamp-name'); var si = val('q-stamp-icon') || 'approval';
        if (!sn) { toast('New stamp needs a name', 'error'); return; }
        var ins = await window.supabase.from('stamps').insert({ name: sn, icon: si, color: '#b8965a' }).select('id').single();
        if (ins.error) throw ins.error;
        stampId = ins.data.id;
      }
      if (!stampId) { toast('Pick or create a stamp', 'error'); return; }

      var reward = val('q-reward');
      var sponsorId = null, prizeTotal = null, prizeRemaining = null;
      if (reward === 'prize') {
        sponsorId = val('q-sponsor');
        if (sponsorId === '__new') {
          var spn = val('q-sponsor-name'); var spl = val('q-sponsor-logo');
          if (!spn) { toast('New sponsor needs a name', 'error'); return; }
          var si2 = await window.supabase.from('sponsors').insert({ name: spn, logo: spl }).select('id').single();
          if (si2.error) throw si2.error;
          sponsorId = si2.data.id;
        }
        if (!sponsorId) { toast('Prize quests need a sponsor', 'error'); return; }
        prizeTotal = parseInt(val('q-prize-total'), 10) || 1;
        prizeRemaining = S.editing && S.editing.prize_remaining != null && S.editing.reward_type === 'prize'
          ? Math.min(S.editing.prize_remaining, prizeTotal) : prizeTotal;
      }

      var scope = val('q-scope');
      var loc = val('q-location');
      var payload = {
        title: title,
        description: val('q-desc') || null,
        category: val('q-category'),
        scope: scope,
        city: scope === 'city' ? (loc || null) : null,
        country: scope === 'country' ? (loc || null) : null,
        target_count: target,
        require_distinct_venues: checked('q-distinct'),
        stamp_id: stampId,
        reward_type: reward,
        sponsor_id: sponsorId,
        prize_total: prizeTotal,
        prize_remaining: prizeRemaining,
        hero_image_url: val('q-hero') || null,
        updated_at: new Date().toISOString()
      };

      var questId;
      if (S.editing) {
        var up = await window.supabase.from('quests').update(payload).eq('id', S.editing.id);
        if (up.error) throw up.error;
        questId = S.editing.id;
      } else {
        payload.status = 'draft';
        payload.active_from = new Date().toISOString();
        var cr = await window.supabase.from('quests').insert(payload).select('id').single();
        if (cr.error) throw cr.error;
        questId = cr.data.id;
      }

      // venues: replace set
      var selected = S.providers.filter(function (p) { return checked('qv-' + p.id); }).map(function (p) { return p.id; });
      await window.supabase.from('quest_venues').delete().eq('quest_id', questId);
      if (selected.length) {
        var rows = selected.map(function (pid) { return { quest_id: questId, provider_id: pid }; });
        var iv = await window.supabase.from('quest_venues').insert(rows);
        if (iv.error) throw iv.error;
      }

      closeQuestModal();
      toast(S.editing ? 'Quest saved' : 'Quest created (draft)', 'success');
      await refresh();
    } catch (e) {
      console.error('[Admin Quests] save:', e);
      toast(e.message || 'Save failed', 'error');
    }
  }

  async function setStatus(id, status) {
    try {
      var patch = { status: status, updated_at: new Date().toISOString() };
      if (status === 'live') patch.active_from = new Date().toISOString();
      var res = await window.supabase.from('quests').update(patch).eq('id', id);
      if (res.error) throw res.error;
      toast(status === 'live' ? 'Quest is now live' : status === 'draft' ? 'Quest unpublished' : 'Quest ended', 'success');
      await refresh();
    } catch (e) { console.error('[Admin Quests] setStatus:', e); toast(e.message || 'Update failed', 'error'); }
  }

  async function refresh() { await fetchAll(); renderList(); }

  // ── modal ──
  function openModal(title, content, footer) {
    closeQuestModal();
    var ov = document.createElement('div');
    ov.id = 'ffp-quest-modal-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,8,20,0.75);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;';
    ov.innerHTML =
      '<div style="background:#0f1e2e;border:1px solid #1a2f44;border-radius:16px;width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #1a2f44;">' +
          '<div style="color:#e8eef4;font-size:16px;font-weight:700;">' + esc(title) + '</div>' +
          '<button onclick="closeQuestModal()" style="background:transparent;border:none;color:#8a99a8;cursor:pointer;font-size:24px;line-height:1;">&times;</button>' +
        '</div>' +
        '<div style="padding:20px;overflow-y:auto;flex:1;">' + content + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #1a2f44;">' + footer + '</div>' +
      '</div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) closeQuestModal(); });
    document.body.appendChild(ov);
  }
  window.closeQuestModal = function () { var o = document.getElementById('ffp-quest-modal-overlay'); if (o) o.remove(); };

  window.AdminQuests = {
    openForm: openForm, save: save, setStatus: setStatus, refresh: refresh,
    setTab: function (t) { S.tab = t; renderList(); },
    toggleReward: toggleReward, toggleStamp: toggleStamp, toggleSponsor: toggleSponsor
  };

  async function init() {
    var ok = await waitFor(function () { return window.supabase && document.getElementById('panel-quests'); }, 30000);
    if (!ok) { console.warn('[FFP Admin Quests] supabase or panel not ready'); return; }
    await waitFor(function () { return !!window.FFP_ADMIN; }, 30000);
    if (window.App && window.App.panelNames) window.App.panelNames['panel-quests'] = 'Quests';
    injectStyles();
    buildScaffold();
    try { await refresh(); console.log('[FFP Admin Quests v1] Loaded ✓'); }
    catch (e) { console.error('[FFP Admin Quests] initial load:', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

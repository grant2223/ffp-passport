/* FFP Quests — core module — v1 (2026-06-08)
   Extracted verbatim from ffp-member-dashboard.html (was the inline `const Quests = {…}`), so future quest
   work stops touching the 12k-line dashboard. Loaded as a CLASSIC <script> in the dashboard <head> (defines
   window.Quests before the boot runs Quests.init()). Depends on globals the dashboard already defines:
   showToast, openDetailModal, closeDetailModal, escHtml, window.supabase, FFP_TAX, MemberProfile, FFPUpload.
   The dashboard boot still calls window.Quests.init() when the Quests panel first shows. */
window.Quests = {
  base: 'https://ffp-passport-backend.vercel.app',
  cat: 'all',
  scope: 'all',
  tab: 'browse',
  data: [],

  memberId() {
    try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}')).id || ''; }
    catch (e) { return ''; }
  },

  CAT: {
    fitness:   { cover: 'cov-fitness' },
    sports:    { cover: 'cov-sports' },
    wellness:  { cover: 'cov-wellness' },
    recovery:  { cover: 'cov-recovery' },
    adventure: { cover: 'cov-adventure' },
    food:      { cover: 'cov-food' }
  },

  async init() {
    document.querySelectorAll('#quest-cat-row .cat-item').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#quest-cat-row .cat-item').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.cat = b.dataset.cat;
        this.render();
      });
    });
    document.querySelectorAll('#quest-scope-seg .scope-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#quest-scope-seg .scope-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.scope = b.dataset.scope;
        this.render();
      });
    });
    document.querySelectorAll('#quest-tabs .tabs-underline-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#quest-tabs .tabs-underline-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.tab = b.dataset.questTab;
        this.render();
      });
    });
    await this.load();
  },

  async load() {
    const grid = document.getElementById('quest-grid');
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--q-muted);padding:30px;">Loading quests…</div>';
    try {
      const mid = this.memberId();
      const res = await fetch(this.base + '/api/quests' + (mid ? ('?member_id=' + encodeURIComponent(mid)) : ''));
      const json = await res.json();
      this.data = (json && json.quests) ? json.quests : [];
    } catch (e) {
      this.data = [];
      if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--q-muted);padding:30px;">Couldn\'t load quests right now.</div>';
    }
    this.renderHero();
    this.render();
  },

  _pc(q)     { return (q.progress && q.progress.completed_count) || 0; },
  _isDone(q) { return q.progress && q.progress.status === 'completed'; },
  _isActive(q) { return !this._isDone(q) && this._pc(q) > 0; },

  filtered() {
    let items = this.data.slice();
    if (this.cat !== 'all')   items = items.filter(q => q.category === this.cat);
    if (this.scope !== 'all') items = items.filter(q => q.scope === this.scope);
    if (this.tab === 'active')    items = items.filter(q => this._isActive(q));
    else if (this.tab === 'completed') items = items.filter(q => this._isDone(q));
    else if (this.tab === 'browse')    items = items.filter(q => !this._isDone(q));
    return items;
  },

  renderHero() {
    const el = document.getElementById('quest-hero');
    if (!el) return;
    const all = this.data;
    const inProg = all.filter(q => this._isActive(q)).length;
    const done   = all.filter(q => this._isDone(q)).length;
    const explore = all.filter(q => !this._isDone(q) && this._pc(q) === 0).length;
    const tierName = done >= 12 ? 'Navigator' : done >= 6 ? 'Adventurer' : 'Explorer';
    const tierIcon = done >= 12 ? 'travel_explore' : done >= 6 ? 'hiking' : 'explore';
    const nextLbl = done >= 12
      ? 'Top tier reached'
      : ((done >= 6 ? (12 - done) : (6 - done)) + ' more quests to ' + (done >= 6 ? 'Navigator' : 'Adventurer'));
    let pct;
    if (done >= 12) pct = 100;
    else if (done >= 6) pct = Math.round(((done - 6) / 6) * 100);
    else pct = Math.round((done / 6) * 100);
    pct = Math.max(0, Math.min(100, pct));
    el.innerHTML =
      '<div class="hero-top">' +
        '<div class="hero-tier-badge"><span class="material-icons">' + tierIcon + '</span></div>' +
        '<div class="hero-tier-info" style="min-width:0;">' +
          '<div class="tier-name">' + tierName + '</div>' +
          '<div class="tier-meta"><b>' + done + '</b> quests completed</div>' +
        '</div>' +
        '<div class="quest-tier-prog" style="flex:1; min-width:110px;">' +
          '<div class="chal-progress-bar"><div class="chal-progress-bar-fill" style="width:' + pct + '%;"></div></div>' +
          '<div style="font-size:10px; color:var(--muted); margin-top:6px; text-align:right; font-weight:700;">' + nextLbl + '</div>' +
        '</div>' +
      '</div>';
  },

  dots(done, target) {
    let h = '';
    const t = target || 0;
    const complete = t > 0 && done >= t;
    for (let i = 0; i < t; i++) {
      h += i < done
        ? '<span class="qc-dot emblem' + (complete ? ' lit' : '') + '"></span>'
        : '<span class="qc-dot todo"></span>';
    }
    return h;
  },

  render() {
    const setC = (id, n) => { const e = document.getElementById(id); if (e) e.textContent = n; };
    setC('q-active-count', this.data.filter(q => this._isActive(q)).length);
    setC('q-browse-count', this.data.filter(q => !this._isDone(q)).length);
    setC('q-done-count',   this.data.filter(q => this._isDone(q)).length);

    const grid = document.getElementById('quest-grid');
    if (!grid) return;
    const items = this.filtered();
    if (!items.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--q-muted);padding:30px;">No quests here yet.</div>';
      return;
    }
    grid.innerHTML = items.map(q => {
      const c = this.CAT[q.category] || { cover: '' };
      const cover = q.hero_image_url
        ? '<div class="qc-cover image" style="background-image:url(\'' + q.hero_image_url + '\');">'
        : '<div class="qc-cover ' + c.cover + '">';
      const spon = q.sponsors
        ? '<div class="qc-spon-strip"><span class="ss-logo">' + escHtml(q.sponsors.logo || '') + '</span><span class="ss-txt">Brought to you by <b>' + escHtml(q.sponsors.name || '') + '</b></span></div>'
        : '';
      const scopeCap = (q.scope || '').charAt(0).toUpperCase() + (q.scope || '').slice(1);
      const rewardPill = q.reward_type === 'prize'
        ? '<span class="qc-reward"><span class="material-icons">redeem</span> Prize</span>'
        : '<span class="qc-reward"><span class="material-icons">approval</span> Stamp</span>';
      const footVal = (q.reward_type === 'prize' && q.prize_total != null)
        ? '<span class="qc-foot-val">' + q.prize_remaining + ' of ' + q.prize_total + ' left</span>'
        : '';
      const _isMine = q.owner_type === 'member';
      const _joinedN = (q.joined_count != null ? q.joined_count : (q.progress ? 1 : 0));
      const _iJoined = !!q.progress;
      const joinRow = _isMine
        ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;">' +
            '<span style="font-size:12px;color:#9fb4c4;font-weight:700;display:inline-flex;align-items:center;gap:4px;"><span class="material-icons" style="font-size:15px;">group</span>' + _joinedN + ' joined</span>' +
            (_iJoined ? '<span style="font-size:12px;color:#4ade80;font-weight:800;">Joined ✓</span>'
                      : '<button onclick="event.stopPropagation();Quests.join(\'' + q.id + '\')" style="font-size:12px;font-weight:800;color:#082335;background:#2ba8e0;border:none;border-radius:8px;padding:6px 13px;cursor:pointer;font-family:inherit;">Join</button>') +
          '</div>'
        : '';
      return '<div class="quest-card" onclick="Quests.openDetail(\'' + q.id + '\')">' +
          cover + '<span class="qc-scope-pill">' + scopeCap + '</span>' + spon + '</div>' +
          '<div class="qc-pad">' +
            '<div class="qc-title">' + escHtml(q.title) + '</div>' +
            '<div class="qc-stamps">' + this.dots(this._pc(q), q.target_count) + '</div>' +
            '<div class="qc-foot">' + rewardPill + footVal + '</div>' + joinRow +
          '</div>' +
        '</div>';
    }).join('');
  },

  async openDetail(id) {
    const mid = this.memberId();
    let detail = null;
    try {
      const res = await fetch(this.base + '/api/quests/' + id + (mid ? ('?member_id=' + encodeURIComponent(mid)) : ''));
      detail = await res.json();
    } catch (e) {}
    const q = (detail && detail.quest) ? detail.quest : this.data.find(x => x.id === id);
    if (!q) return;
    const venues = (detail && detail.venues) ? detail.venues : [];
    const pc = (detail && detail.progress) ? (detail.progress.completed_count || 0) : this._pc(q);
    const scopeCap = (q.scope || '').charAt(0).toUpperCase() + (q.scope || '').slice(1);
    const isPrize = q.reward_type === 'prize';
    const catCover = (this.CAT[q.category] && this.CAT[q.category].cover) || '';
    const coverPill = '<span class="q-cover-pill">' + scopeCap + ' · ' + escHtml(q.category || '') + '</span>';
    const coverSpon = q.sponsors
      ? '<div class="q-cover-spon"><span class="ss-logo">' + escHtml(q.sponsors.logo || '') + '</span><span class="ss-txt">Brought to you by ' + escHtml(q.sponsors.name || '') + '</span></div>'
      : '';
    const coverDiv = q.hero_image_url
      ? '<div class="q-cover" style="background-image:linear-gradient(180deg,rgba(8,20,32,0.20),rgba(8,20,32,0.55)),url(\'' + q.hero_image_url + '\');">' + coverPill + coverSpon + '</div>'
      : '<div class="q-cover ' + catCover + '">' + coverPill + coverSpon + '</div>';
    const venuesHtml = venues.length
      ? venues.map(v => '<div class="q-venue"><span class="material-icons">place</span><div><div class="q-venue-name">' + escHtml((v.providers && v.providers.business_name) || 'Venue') + '</div>' + (v.task ? '<div class="q-venue-task">' + escHtml(v.task) + '</div>' : '') + '</div></div>').join('')
      : '<div class="q-venue muted">Venues announced soon.</div>';
    const rewardLine = isPrize
      ? 'Win 1 of ' + (q.prize_total || '?') + ' prizes from <b>' + escHtml((q.sponsors && q.sponsors.name) || 'our partner') + '</b> — the first ' + (q.prize_total || '') + ' to finish. Everyone who completes still earns the stamp.'
      : 'Complete all ' + q.target_count + ' to earn your stamp — it counts toward your next tier.';
    const html =
      '<div class="q-detail">' +
        coverDiv +
        '<div class="q-detail-body">' +
          '<h3 class="q-title">' + escHtml(q.title) + '</h3>' +
          '<p class="q-desc">' + escHtml(q.description || '') + '</p>' +
          '<div class="q-reward-box ' + (isPrize ? 'prize' : 'stamp') + '">' +
            '<span class="material-icons">' + (isPrize ? 'redeem' : 'approval') + '</span>' +
            '<div>' + rewardLine + '</div>' +
          '</div>' +
          (q.prize_text ? '<div class="q-reward-box prize"><span class="material-icons">redeem</span><div>Prize from the venue: <b>' + escHtml(q.prize_text) + '</b> — provided by them.</div></div>' : '') +
          (q.owner_type === 'member'
            ? '<div class="q-join-box"><div class="q-join-count"><span class="material-icons">group</span>' + (((detail && detail.joined_count) || 1)) + ' on this quest</div>' +
                ((detail && detail.progress) ? '<div class="q-join-state">You’re on this quest ✓</div>' : '<button class="btn-primary-blue" onclick="Quests.join(\'' + q.id + '\')">Join this quest</button>') +
              '</div>'
            : '') +
          (q.owner_type === 'member' && q.created_by && q.created_by === mid
            ? '<button style="width:100%;margin:0 0 14px;padding:11px;border-radius:11px;border:1px solid rgba(43,168,224,0.35);background:rgba(43,168,224,0.06);color:#2ba8e0;font-weight:700;cursor:pointer;font-family:inherit;" onclick="Quests.openEdit(\'' + q.id + '\')"><span class="material-icons" style="font-size:16px;vertical-align:middle;">edit</span> Edit quest</button>'
            : '') +
          '<div class="q-joiners" id="q-detail-joiners"></div>' +
          '<div class="q-progress">' + pc + ' of ' + q.target_count + ' stamped</div>' +
          '<div class="qc-stamps big">' + this.dots(pc, q.target_count) + '</div>' +
          '<div class="q-venues-title">Where to go</div><div id="q-detail-venues">' + venuesHtml + '</div>' +
        '</div>' +
      '</div>';
    openDetailModal(html);
    // Who's joined — avatar thumbs (member-created quests)
    if (q.owner_type === 'member' && window.supabase) {
      window.supabase.rpc('member_quest_participants', { p_quest: q.id }).then(function (res) {
        var arr = (res && res.data) || []; var host = document.getElementById('q-detail-joiners'); if (!host) return;
        if (!arr.length) { host.innerHTML = ''; return; }
        var av = arr.map(function (p) {
          var img = p.photo_url
            ? '<img src="' + p.photo_url + '" alt="" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #0f1e2e;">'
            : '<div style="width:34px;height:34px;border-radius:50%;background:#13324a;color:#cfe0ee;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #0f1e2e;">' + escHtml((p.name || 'M').charAt(0).toUpperCase()) + '</div>';
          return '<div title="' + escHtml(p.name || '') + '" style="margin-left:-8px;">' + img + '</div>';
        }).join('');
        host.innerHTML = '<div style="font-size:12px;color:#9fb4c4;margin:2px 0 8px;font-weight:700;">Who’s joined (' + arr.length + ')</div>' +
          '<div style="display:flex;align-items:center;padding-left:8px;flex-wrap:wrap;">' + av + '</div>';
      }).catch(function () {});
    }
    // Member quests: render the live FFP venue cards (the fixed picked set, or the dynamic pool).
    if (q.owner_type === 'member' && window.supabase) {
      this.qcInjectCss();
      window.supabase.rpc('member_quest_venues', { p_quest: q.id }).then(function (res) {
        var d = (res && res.data) || null;
        var host = document.getElementById('q-detail-venues'); if (!host || !d) return;
        if (!d.venues || !d.venues.length) { host.innerHTML = '<div class="q-venue muted">No FFP venues yet — check back soon.</div>'; return; }
        var lead = d.fixed
          ? 'The member picked these venues — only these count:'
          : 'Any of these FFP venues count toward the goal:';
        window._ffpQdv = d.venues;
        host.style.display = 'block';
        host.innerHTML = '<div style="font-size:12px;color:#9fb4c4;margin-bottom:8px;">' + lead + '</div>' +
          (d.venues.length > 6 ? '<input id="q-detail-venue-search" placeholder="Search places…" oninput="Quests.qdvFilter(this.value)" style="width:100%;box-sizing:border-box;padding:10px 13px;border-radius:10px;border:1px solid rgba(43,168,224,0.25);background:rgba(43,168,224,0.05);color:#e8eef4;font-size:13px;font-family:inherit;margin-bottom:10px;">' : '') +
          '<div id="q-detail-venue-list" style="display:flex;flex-direction:column;gap:8px;">' + Quests.qdvCardsHtml(d.venues) + '</div>';
      }).catch(function () {});
    }
  },

  // ── P2b: member-created exploration quests ──
  qcInjectCss() {
    if (document.getElementById('qc-venue-css')) return;
    var s = document.createElement('style'); s.id = 'qc-venue-css';
    s.textContent =
      '.qc-mode-btn{flex:1;padding:9px 8px;border-radius:10px;border:1px solid rgba(43,168,224,0.3);background:rgba(43,168,224,0.06);color:#9fb4c4;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;}' +
      '.qc-mode-btn.active{background:#2ba8e0;color:#082335;border-color:#2ba8e0;}' +
      '.qc-venue-card{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);}' +
      '.qc-venue-card.pickable{cursor:pointer;}' +
      '.qc-venue-card.picked{background:rgba(43,168,224,0.12);border-color:#2ba8e0;}' +
      '.qc-venue-av{width:40px;height:40px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;background:#13324a;color:#cfe0ee;}' +
      '.qc-venue-meta{flex:1;min-width:0;}' +
      '.qc-venue-nm{font-size:14px;font-weight:600;color:#e8eef4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.qc-venue-area{font-size:11px;color:#8a99a8;}' +
      '.qc-venue-check{flex-shrink:0;font-size:22px;color:#2ba8e0;}' +
      '.qc-choose-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:11px;border:1px dashed rgba(43,168,224,0.5);background:rgba(43,168,224,0.06);color:#2ba8e0;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '.qc-choose-btn .material-icons{font-size:19px;}' +
      '.qc-pick-summary{font-size:12px;color:#cfe0ee;margin-top:9px;line-height:1.5;}';
    document.head.appendChild(s);
  },

  qcSetMode(m) {
    var st = window._ffpQc || {}; st.mode = m; window._ffpQc = st;
    var bo = document.getElementById('qc-mode-open'), bp = document.getElementById('qc-mode-pick');
    if (bo) bo.classList.toggle('active', m === 'open');
    if (bp) bp.classList.toggle('active', m === 'pick');
    this.qcRenderVenues();
  },

  qcTogglePick(id) {
    var st = window._ffpQc || {}; if (!st.picked) st.picked = {};
    st.picked[id] = !st.picked[id]; window._ffpQc = st;
    this.qcRenderVenues();
  },

  qcRenderVenues() {
    var st = window._ffpQc || {}; var box = document.getElementById('qc-venues'); if (!box) return;
    var pick = st.mode === 'pick';
    var note = document.getElementById('qc-pool-note'), tgtWrap = document.getElementById('qc-target-wrap');
    if (pick) {
      var picked = (st.venues || []).filter(function (v) { return st.picked && st.picked[v.id]; });
      var names = picked.map(function (v) { return v.name; });
      box.innerHTML =
        '<button type="button" class="qc-choose-btn" onclick="Quests.qcOpenVenuePicker()"><span class="material-icons">storefront</span> Choose venues</button>' +
        (picked.length
          ? '<div class="qc-pick-summary"><strong style="color:#2ba8e0;">' + picked.length + ' selected:</strong> ' + escHtml(names.slice(0, 5).join(', ')) + (names.length > 5 ? ' +' + (names.length - 5) + ' more' : '') + '</div>'
          : '<div class="qc-pick-summary" style="color:#8a99a8;">None picked yet — tap “Choose venues” to select the places this quest counts.</div>');
      if (note) note.innerHTML = 'Pick the specific places this quest counts — <strong>' + (st.count || 0) + '</strong> available in this area.';
      if (tgtWrap) tgtWrap.style.display = 'none';
    } else {
      box.innerHTML = '';
      if (note) note.innerHTML = '<strong style="color:#2ba8e0;">' + (st.count || 0) + ' FFP venue' + ((st.count || 0) === 1 ? '' : 's') + '</strong> count toward this quest — visit any of them, and new FFP partners join automatically. Anyone who joins can browse + search the full list on the quest.';
      if (tgtWrap) tgtWrap.style.display = '';
    }
  },

  // Pick-specific: a full-screen searchable venue MENU (info per venue) that stacks over the create form.
  qcOpenVenuePicker() {
    if (document.getElementById('qcvp-overlay')) return;
    var ov = document.createElement('div');
    ov.id = 'qcvp-overlay';
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:100001;background:#0b1c28;display:flex;flex-direction:column;font-family:inherit;');
    ov.innerHTML =
      '<div style="padding:16px 18px;border-bottom:1px solid rgba(43,168,224,0.2);display:flex;align-items:center;gap:10px;flex-shrink:0;">' +
        '<button onclick="Quests.qcvpDone()" style="background:none;border:none;color:#cfe0ee;cursor:pointer;display:flex;padding:0;"><span class="material-icons">arrow_back</span></button>' +
        '<div style="font-size:16px;font-weight:800;color:#e8eef4;">Choose venues</div>' +
      '</div>' +
      '<div style="padding:14px 18px 0;flex-shrink:0;"><input id="qcvp-search" placeholder="Search venues…" oninput="Quests.qcvpFilter(this.value)" style="width:100%;box-sizing:border-box;padding:11px 14px;border-radius:10px;border:1px solid rgba(43,168,224,0.25);background:rgba(43,168,224,0.05);color:#e8eef4;font-size:14px;font-family:inherit;"></div>' +
      '<div id="qcvp-list" style="flex:1;overflow:auto;padding:12px 18px;display:flex;flex-direction:column;gap:8px;">' + this.qcvpListHtml('') + '</div>' +
      '<div style="padding:14px 18px;border-top:1px solid rgba(43,168,224,0.2);flex-shrink:0;"><button class="btn-primary-blue" style="width:100%;" onclick="Quests.qcvpDone()">Done</button></div>';
    document.body.appendChild(ov);
  },
  qcvpListHtml(q) {
    var st = window._ffpQc || {}; var venues = st.venues || [];
    q = (q || '').trim().toLowerCase();
    if (q) venues = venues.filter(function (v) { return ((v.name || '') + ' ' + (v.area || '') + ' ' + (v.city || '')).toLowerCase().indexOf(q) !== -1; });
    if (!venues.length) return '<div class="cv-empty">No venues match.</div>';
    return venues.map(function (v) {
      var picked = !!(st.picked && st.picked[v.id]);
      var av = escHtml(String(v.letter_mark || (v.name || '?').charAt(0) || '?').toUpperCase());
      var area = [v.area, v.city].filter(Boolean).join(' · ');
      return '<div class="qc-venue-card pickable' + (picked ? ' picked' : '') + '" onclick="Quests.qcvpToggle(\'' + v.id + '\')">' +
        '<div class="qc-venue-av">' + av + '</div>' +
        '<div class="qc-venue-meta"><div class="qc-venue-nm">' + escHtml(v.name || 'Venue') + '</div>' +
          (area ? '<div class="qc-venue-area">' + escHtml(area) + '</div>' : '') + '</div>' +
        '<span class="material-icons qc-venue-check">' + (picked ? 'check_circle' : 'radio_button_unchecked') + '</span></div>';
    }).join('');
  },
  qcvpFilter(q) { var h = document.getElementById('qcvp-list'); if (h) h.innerHTML = this.qcvpListHtml(q || ''); },
  qcvpToggle(id) {
    var st = window._ffpQc || {}; if (!st.picked) st.picked = {};
    st.picked[id] = !st.picked[id]; window._ffpQc = st;
    var s = document.getElementById('qcvp-search'); this.qcvpFilter(s ? s.value : '');
  },
  qcvpDone() {
    var ov = document.getElementById('qcvp-overlay'); if (ov) ov.remove();
    this.qcRenderVenues();
  },

  // Quest-detail venue list (read-only) — searchable so joiners can find a place.
  qdvCardsHtml(venues) {
    var html = (venues || []).map(function (v) {
      var av = escHtml(String(v.letter_mark || (v.name || '?').charAt(0) || '?').toUpperCase());
      var area = [v.area, v.city].filter(Boolean).join(' · ');
      return '<div class="qc-venue-card"><div class="qc-venue-av">' + av + '</div>' +
        '<div class="qc-venue-meta"><div class="qc-venue-nm">' + escHtml(v.name || 'Venue') + '</div>' +
        (area ? '<div class="qc-venue-area">' + escHtml(area) + '</div>' : '') + '</div></div>';
    }).join('');
    return html || '<div class="cv-empty">No places match.</div>';
  },
  qdvFilter(q) {
    var venues = window._ffpQdv || []; q = (q || '').trim().toLowerCase();
    if (q) venues = venues.filter(function (v) { return ((v.name || '') + ' ' + (v.area || '') + ' ' + (v.city || '')).toLowerCase().indexOf(q) !== -1; });
    var list = document.getElementById('q-detail-venue-list'); if (list) list.innerHTML = this.qdvCardsHtml(venues);
  },

  openCreate() {
    this.qcInjectCss();
    this._createHero = ''; this._editId = null;
    var prof = {};
    try { prof = (typeof MemberProfile !== 'undefined' && MemberProfile.data) || {}; } catch (e) {}
    var TAX = window.FFP_TAX || {};
    var countries = (TAX.cities ? Object.keys(TAX.cities).sort() : ['United Arab Emirates']);
    var defCountry = prof.country || 'United Arab Emirates';
    if (countries.indexOf(defCountry) === -1) defCountry = countries[0] || 'United Arab Emirates';
    var defCity = prof.city || '';
    var actObjs = (TAX.activities || []).filter(function (a) { return a && a.n; }).map(function (a) { return { n: a.n, c: (a.c || '') }; });
    var cats = ['fitness', 'sports', 'wellness', 'recovery', 'adventure', 'food'];
    // v288: the chosen CATEGORY now filters the Activity list (a.c comes from the DB taxonomy = the 6
    // standard), so you can't pick a mismatched activity. "Any activity" = a city-wide explorer quest.
    function qcActOptions(cat) {
      var inCat = actObjs.filter(function (a) { return a.c === cat; }).map(function (a) { return a.n; }).sort();
      return '<option value="">Any activity</option>' + inCat.map(function (n) { return '<option value="' + escHtml(n) + '">' + escHtml(n) + '</option>'; }).join('');
    }
    var html =
      '<div class="qcreate">' +
        '<h3 class="q-title" id="qc-modal-title">Create your own quest</h3>' +
        '<p class="q-desc">Set a goal — like visiting a few different venues — and others can join you. Finish it to earn an explorer badge.</p>' +
        '<div id="qc-photo" onclick="Quests.pickHero()" style="width:100%;max-width:220px;aspect-ratio:1/1;margin:0 auto 16px;border-radius:16px;border:2px dashed rgba(43,168,224,0.35);background:rgba(8,20,32,0.4) center/cover no-repeat;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#8a99a8;"><span class="material-icons" style="font-size:34px;">add_a_photo</span></div>' +
        '<div class="qc-field"><label>Title</label><input id="qc-title" class="ffp-select" placeholder="e.g. Try 5 new gyms in Dubai" maxlength="80"></div>' +
        '<div class="qc-field"><label>Category</label><select id="qc-cat" class="ffp-select">' + cats.map(function (c) { return '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>'; }).join('') + '</select></div>' +
        '<div class="qc-field"><label>Activity — filtered by category</label><select id="qc-act" class="ffp-select">' + qcActOptions(cats[0]) + '</select></div>' +
        '<div class="qc-row">' +
          '<div class="qc-field"><label>Country</label><select id="qc-country" class="ffp-select">' + countries.map(function (c) { return '<option' + (c === defCountry ? ' selected' : '') + '>' + escHtml(c) + '</option>'; }).join('') + '</select></div>' +
          '<div class="qc-field"><label>City</label><select id="qc-city" class="ffp-select"></select></div>' +
        '</div>' +
        '<div class="qc-field" id="qc-pool-wrap" style="display:none;">' +
          '<label>FFP venues for this quest</label>' +
          '<div id="qc-pool-note" style="font-size:12px;color:#9fb4c4;margin-bottom:9px;line-height:1.5;"></div>' +
          '<div id="qc-mode" style="display:none;gap:8px;margin-bottom:11px;">' +
            '<button type="button" id="qc-mode-open" class="qc-mode-btn active" onclick="Quests.qcSetMode(\'open\')">Any of them</button>' +
            '<button type="button" id="qc-mode-pick" class="qc-mode-btn" onclick="Quests.qcSetMode(\'pick\')">Pick specific</button>' +
          '</div>' +
          '<div id="qc-venues" style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow:auto;"></div>' +
        '</div>' +
        '<div class="qc-field" id="qc-target-wrap"><label>How many different venues to visit</label><input id="qc-target" type="number" min="2" max="50" value="5" class="ffp-select"><div style="margin-top:5px;color:#8a99a8;font-size:11px;">You set the goal — e.g. visit 8 of the venues that count.</div></div>' +
        '<button class="btn-primary-yellow" id="qc-save-btn" onclick="Quests.saveCreate()">Create quest</button>' +
      '</div>';
    openDetailModal(html);
    setTimeout(function () {
      var cny = document.getElementById('qc-country'), cty = document.getElementById('qc-city');
      function fill(country, keep) {
        var list = (TAX.cities && TAX.cities[country]) || [];
        cty.innerHTML = '<option value="">Select city…</option>' + list.map(function (x) { return '<option' + (x === keep ? ' selected' : '') + '>' + escHtml(x) + '</option>'; }).join('');
      }
      if (cny && cty) { fill(cny.value, defCity); cny.addEventListener('change', function () { fill(cny.value, ''); }); }
      // v288: category change re-filters the Activity list (so it stays valid for the category).
      var catSel = document.getElementById('qc-cat'), actSel = document.getElementById('qc-act');
      // v289: live FFP-VENUE POOL — show how many partner venues count toward this quest, cap the target,
      // and stop dead quests (no FFP venue = nothing to check in at). Uses member_quest_venue_pool.
      async function qcUpdatePool() {
        var gv = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
        var city = gv('qc-city'), country = gv('qc-country'), act = gv('qc-act');
        var wrap = document.getElementById('qc-pool-wrap'), note = document.getElementById('qc-pool-note');
        var modeRow = document.getElementById('qc-mode'), box = document.getElementById('qc-venues'), tgtWrap = document.getElementById('qc-target-wrap');
        if (!city) { if (wrap) wrap.style.display = 'none'; window._ffpQcPool = null; window._ffpQc = null; return; }
        if (wrap) wrap.style.display = '';
        if (note) note.textContent = 'Checking FFP venues…';
        if (box) box.innerHTML = ''; if (modeRow) modeRow.style.display = 'none';
        try {
          var res = await window.supabase.rpc('member_quest_venue_pool', { p_city: city, p_country: country || null, p_activity: act || null });
          var d = (res && res.data) || { count: 0, venues: [] }; var n = d.count || 0; window._ffpQcPool = n;
          // keep the chosen mode across re-filters, but the picked set is venue-specific → reset it
          var prevMode = (window._ffpQc && window._ffpQc.mode) || 'open';
          window._ffpQc = { venues: d.venues || [], mode: prevMode, picked: {}, count: n };
          if (n === 0) {
            if (note) note.innerHTML = '<strong style="color:#f3b14e;">No FFP venues for ' + escHtml(act || 'this') + ' in ' + escHtml(city) + ' yet.</strong> A quest needs FFP partners to check in at — pick another activity or city, or invite a venue.';
            if (tgtWrap) tgtWrap.style.display = 'none';
            return;
          }
          if (modeRow) modeRow.style.display = 'flex';
          var tgt = document.getElementById('qc-target'); if (tgt) { tgt.max = n; if (parseInt(tgt.value, 10) > n) tgt.value = n; }
          Quests.qcSetMode(prevMode);
        } catch (e) { if (note) note.textContent = 'Couldn’t check venues — you can still create.'; window._ffpQcPool = null; window._ffpQc = null; }
      }
      if (catSel && actSel) catSel.addEventListener('change', function () { actSel.innerHTML = qcActOptions(catSel.value); qcUpdatePool(); });
      if (actSel) actSel.addEventListener('change', qcUpdatePool);
      if (cty) cty.addEventListener('change', qcUpdatePool);
      if (cny) cny.addEventListener('change', function () { setTimeout(qcUpdatePool, 0); });
      qcUpdatePool();
    }, 30);
  },

  pickHero() {
    var self = this;
    if (!window.FFPUpload || !window.FFPUpload.pick) { showToast('Photo upload unavailable', 'error'); return; }
    window.FFPUpload.pick({
      bucket: 'quest-images', key: 'quest-hero/' + (this.memberId() || 'm') + '-' + Date.now() + '.jpg',
      aspect: 1, outW: 900, outH: 900, title: 'Quest photo',
      onDone: function (url) { self._createHero = url || ''; var el = document.getElementById('qc-photo'); if (el && url) { el.style.backgroundImage = "url('" + url + "')"; el.innerHTML = ''; } },
      onError: function (e) { showToast('Photo upload failed', 'error'); console.warn('[quest hero]', e); }
    });
  },

  // Edit your own quest — reuses the create form, prefilled. Updates title, photo & goal count
  // (the venue set stays as created — recreate for a different venue config).
  openEdit(id) {
    var q = (this.data || []).find(function (x) { return x.id === id; });
    if (!q) { showToast('Quest not found', 'error'); return; }
    this.openCreate();
    this._editId = id;
    this._createHero = q.hero_image_url || '';
    setTimeout(function () {
      var t = document.getElementById('qc-title'); if (t) t.value = q.title || '';
      var tg = document.getElementById('qc-target'); if (tg && q.target_count) tg.value = q.target_count;
      var ph = document.getElementById('qc-photo'); if (ph && q.hero_image_url) { ph.style.backgroundImage = "url('" + q.hero_image_url + "')"; ph.innerHTML = ''; }
      var h = document.getElementById('qc-modal-title'); if (h) h.textContent = 'Edit your quest';
      var b = document.getElementById('qc-save-btn'); if (b) b.textContent = 'Save changes';
    }, 80);
  },

  async saveCreate() {
    var g = function (id) { var e = document.getElementById(id); return e ? (e.value || '').trim() : ''; };
    var title = g('qc-title'); if (!title) { showToast('Give your quest a title', 'error'); return; }
    // EDIT MODE — update title, photo & goal count only; the venue setup stays as created.
    if (this._editId) {
      var meE = this.memberId(); if (!meE || !window.supabase) { showToast('Please sign in again', 'error'); return; }
      var pe = { title: title, hero_image_url: this._createHero || '' };
      var teE = parseInt(g('qc-target'), 10); if (teE >= 2) pe.target_count = String(teE);
      try {
        var reE = await window.supabase.rpc('member_save_quest', { p_me: meE, p_id: this._editId, p: pe });
        if (reE.error) throw reE.error;
        if (typeof closeDetailModal === 'function') closeDetailModal();
        showToast('Quest updated', 'success');
        await this.load();
      } catch (e) { console.error('[Quests] edit:', e); showToast(e.message || 'Could not update quest', 'error'); }
      return;
    }
    var city = g('qc-city'); if (!city) { showToast('Pick a city', 'error'); return; }
    if (window._ffpQcPool === 0) { showToast('No FFP venues for that activity/city yet — adjust before creating', 'error'); return; }
    var mid = this.memberId(); if (!mid || !window.supabase) { showToast('Please sign in again', 'error'); return; }
    var st = window._ffpQc || {}; var mode = st.mode || 'open';
    var payload = { title: title, category: g('qc-cat') || 'fitness', rule_activity: g('qc-act') || null, city: city, country: g('qc-country') || null, hero_image_url: this._createHero || '' };
    if (mode === 'pick') {
      // member chose specific venues — only these count (locked set); target = how many they picked
      var pids = Object.keys(st.picked || {}).filter(function (k) { return st.picked[k]; });
      if (pids.length < 2) { showToast('Tap at least 2 venues — or switch to “Any of them”', 'error'); return; }
      payload.target_provider_ids = pids;
    } else {
      // open / dynamic — any matching venue counts toward the target number
      var pool = window._ffpQcPool || 0;
      var target = parseInt(g('qc-target'), 10) || 0;
      if (target < 2) { showToast('Choose at least 2 venues', 'error'); return; }
      if (pool && target > pool) target = pool;
      payload.target_count = String(target);
    }
    try {
      var res = await window.supabase.rpc('member_save_quest', { p_me: mid, p_id: null, p: payload });
      if (res.error) throw res.error;
      if (!res.data) throw new Error('Could not create quest');
      if (typeof closeDetailModal === 'function') closeDetailModal();
      showToast('Quest created — invite friends to join you!', 'success');
      await this.load();
    } catch (e) { console.error('[Quests] create:', e); showToast(e.message || 'Could not create quest', 'error'); }
  },

  async join(id) {
    var mid = this.memberId(); if (!mid || !window.supabase) { showToast('Please sign in again', 'error'); return; }
    try {
      var res = await window.supabase.rpc('member_quest_join', { p_me: mid, p_quest: id });
      if (res.error) throw res.error;
      var d = res.data || {};
      if (!d.ok) { showToast('Couldn’t join — try again', 'error'); return; }
      showToast('You’re on this quest! ' + (d.joined || 1) + ' explorers in.', 'success');
      await this.load();
      this.openDetail(id);
    } catch (e) { console.error('[Quests] join:', e); showToast(e.message || 'Could not join', 'error'); }
  }
};

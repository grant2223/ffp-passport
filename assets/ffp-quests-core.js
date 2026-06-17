/* FFP Quests — core module — v3 (2026-06-17) — REBUILD
   New model: quests are POINT-scored MISSION CHECKLISTS with PROOF, on city/country/global leaderboards.
   - Explore = public FFP quests (the global focus). My quests = joined. Leaderboard = city/country/global ambassadors.
   - Quest detail = task checklist; each task completed with proof: QR code, photo, GPS (within radius), or
     partner/admin confirmation. RPCs: member_quests_feed, member_quest_detail, member_quest_join,
     member_quest_unlock, member_quest_complete_task, quest_leaderboard, ffp_global_leaderboard.
   - Partner quests are members-only, reached via a QR/link code (promptUnlock) — never shown in Explore.
   - Member-created exploration quests (owner_type='member') are PRESERVED: create/edit/invite + the old
     venue-detail rendering still work (openMemberDetail), and they appear under My quests once joined.
   Depends on globals the dashboard defines: showToast, openDetailModal, closeDetailModal, escHtml,
   window.supabase, FFP_TAX, MemberProfile, FFPUpload. Boot calls window.Quests.init() when the panel shows. */
window.Quests = {
  base: 'https://ffp-passport-backend.vercel.app',
  major: null,
  minor: [],
  partner: [],
  boardScope: 'global',
  boardSearch: '',
  _openQuest: null,

  memberId() {
    try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}')).id || ''; }
    catch (e) { return ''; }
  },
  meProfile() {
    try { if (typeof MemberProfile !== 'undefined' && MemberProfile.data) return MemberProfile.data; } catch (e) {}
    try { return JSON.parse(localStorage.getItem('ffp_member') || '{}'); } catch (e) { return {}; }
  },

  CAT: {
    fitness:   { cover: 'cov-fitness' }, sports: { cover: 'cov-sports' }, wellness: { cover: 'cov-wellness' },
    recovery:  { cover: 'cov-recovery' }, adventure: { cover: 'cov-adventure' }, food: { cover: 'cov-food' }
  },
  PROOF: {
    auto:      { icon: 'bolt', label: 'Tracked automatically' },
    qr:        { icon: 'qr_code_scanner', label: 'Scan the QR' },
    photo:     { icon: 'photo_camera', label: 'Add a photo' },
    gps:       { icon: 'my_location', label: 'Check in here' },
    photo_gps: { icon: 'add_a_photo', label: 'Photo + check in' },
    partner:   { icon: 'verified_user', label: 'Confirmed by venue' },
    referral:  { icon: 'group_add', label: 'Bring a friend' }
  },

  async init() {
    await this.load();
    try {
      var qp = new URLSearchParams(window.location.search).get('quest');
      if (qp && !this._deepLinked) { this._deepLinked = true; this.open(qp, 'ffp'); }
    } catch (e) {}
  },

  async load() {
    var host = document.getElementById('quest-sections');
    if (host) host.innerHTML = '<div style="text-align:center;color:var(--q-muted);padding:30px;">Loading quests…</div>';
    var mid = this.memberId();
    try {
      var r = await window.supabase.rpc('member_quests_feed', { p_me: mid });
      var d = (r && r.data) ? r.data : {};
      this.major = d.major || d.headline || null;
      this.minor = d.minor || d.explore || [];
      this.partner = d.partner || [];
    } catch (e) { this.major = null; this.minor = []; this.partner = []; }
    this.renderAll();
  },

  _ensureCss() {
    if (document.getElementById('ffp-quests-v7-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-quests-v7-css';
    s.textContent = [
      // major
      '#panel-quests .q-major{position:relative;border-radius:16px;overflow:hidden;border:1px solid var(--q-border-mid);padding:16px;min-height:138px;display:flex;flex-direction:column;justify-content:flex-end;cursor:pointer;}',
      '#panel-quests .q-major-pill{position:absolute;top:12px;left:12px;display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#082335;background:var(--q-yellow);border-radius:20px;padding:4px 9px;}',
      '#panel-quests .q-major-pill .material-icons{font-size:12px;}',
      '#panel-quests .q-major-title{font-size:19px;font-weight:900;color:#fff;line-height:1.15;}',
      '#panel-quests .q-major-desc{font-size:12.5px;color:#cfe0ee;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '#panel-quests .q-major-foot{display:flex;align-items:center;gap:10px;margin-top:13px;}',
      '#panel-quests .q-major-meta{font-size:11.5px;font-weight:700;color:#fff;flex:1;min-width:0;}',
      '#panel-quests .q-major-btn{font-size:12.5px;font-weight:800;border-radius:9px;padding:8px 15px;white-space:nowrap;}',
      '#panel-quests .q-major-btn.join{color:#082335;background:var(--q-yellow);}',
      '#panel-quests .q-major-btn.cont{color:#082335;background:#fff;}',
      // sections + rows
      '#panel-quests .q-sec-h{font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:var(--q-muted);margin:20px 0 10px;}',
      '#panel-quests .q-sec-h-sub{font-weight:700;text-transform:none;letter-spacing:0;color:#7d8b99;font-size:11px;margin-left:4px;}',
      '#panel-quests .q-sec-empty{font-size:13px;color:var(--q-muted);padding:6px 2px 2px;}',
      '#panel-quests .q-list{display:flex;flex-direction:column;gap:8px;}',
      '#panel-quests .q-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:13px;background:var(--q-card);border:1px solid var(--q-border);cursor:pointer;transition:border-color .15s;}',
      '#panel-quests .q-row:hover{border-color:var(--q-border-mid);}',
      '#panel-quests .q-row-thumb{width:46px;height:46px;border-radius:11px;flex-shrink:0;background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;color:#fff;}',
      '#panel-quests .q-row-thumb .material-icons{font-size:20px;opacity:.85;}',
      '#panel-quests .q-row-body{flex:1;min-width:0;}',
      '#panel-quests .q-row-title{font-size:14.5px;font-weight:800;color:var(--q-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#panel-quests .q-row-meta{font-size:11.5px;color:var(--q-muted);font-weight:700;margin-top:2px;}',
      '#panel-quests .q-row-join{font-size:12px;font-weight:800;color:#082335;background:#2ba8e0;border:none;border-radius:8px;padding:7px 14px;cursor:pointer;font-family:inherit;flex-shrink:0;}',
      '#panel-quests .q-row-state{font-size:12.5px;font-weight:800;color:#9fb4c4;flex-shrink:0;}',
      // detail modal
      '.q-detail2{display:flex;flex-direction:column;}',
      '.q-d2-cover{position:relative;height:120px;background-size:cover;background-position:center;background-color:#155e85;display:flex;align-items:flex-end;padding:14px;border-radius:14px 14px 0 0;}',
      '.q-d2-cover.cov-fitness{background-image:linear-gradient(135deg,#ff6b4a,#b23a1c);}.q-d2-cover.cov-sports{background-image:linear-gradient(135deg,#2ba8e0,#155e85);}.q-d2-cover.cov-wellness{background-image:linear-gradient(135deg,#36c5b0,#0d6b5f);}.q-d2-cover.cov-recovery{background-image:linear-gradient(135deg,#8b7cf0,#4c2c9c);}.q-d2-cover.cov-adventure{background-image:linear-gradient(135deg,#f5a623,#a85e08);}.q-d2-cover.cov-food{background-image:linear-gradient(135deg,#4ade80,#15803d);}',
      '.q-d2-pill{position:absolute;top:12px;left:12px;font-size:9.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#fff;background:rgba(0,0,0,.45);border-radius:20px;padding:3px 9px;}',
      '.q-d2-title{font-size:20px;font-weight:900;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.5);}',
      '.q-d2-body{padding:14px 4px 4px;}',
      '.q-d2-desc{font-size:13px;color:#9fb4c4;margin:0 0 12px;line-height:1.5;}',
      '.q-statbar{display:flex;gap:18px;padding:10px 14px;background:rgba(8,20,32,.5);border:1px solid rgba(255,255,255,.07);border-radius:11px;margin-bottom:12px;}',
      '.q-statbar span{font-size:12px;color:#8a99a8;font-weight:700;}.q-statbar b{font-size:16px;color:#e8eef4;font-weight:900;}.q-statbar b.gold{color:#f4d77a;}.q-statbar b.blue{color:#2ba8e0;}',
      '.q-seg{display:flex;gap:6px;background:rgba(8,20,32,.5);border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:4px;margin-bottom:14px;}',
      '.q-seg button{flex:1;font-size:13px;font-weight:800;color:#8a99a8;background:transparent;border:none;border-radius:8px;padding:9px 6px;cursor:pointer;font-family:inherit;}',
      '.q-seg button.active{background:#2ba8e0;color:#fff;}',
      '.q-tasklist{display:flex;flex-direction:column;gap:8px;max-height:54vh;overflow:auto;-webkit-overflow-scrolling:touch;}',
      '.q-trow{display:flex;align-items:center;gap:10px;padding:10px 11px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);}',
      '.q-trow.done{border-color:rgba(74,222,128,.4);}',
      '.q-trow-ic{font-size:19px;color:#2ba8e0;flex-shrink:0;}.q-trow-ic.done{color:#4ade80;}',
      '.q-trow-body{flex:1;min-width:0;}',
      '.q-trow-title{font-size:13.5px;font-weight:700;color:#e8eef4;}',
      '.q-trow-sub{font-size:11.5px;color:#8a99a8;margin-top:1px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.q-trow-pts{font-size:12px;font-weight:800;color:#9fb4c4;flex-shrink:0;}',
      '.q-trow-btn{font-size:12px;font-weight:800;color:#082335;background:#2ba8e0;border:none;border-radius:8px;padding:7px 12px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;}',
      '.q-trow-done{color:#4ade80;flex-shrink:0;display:flex;}.q-trow-done .material-icons{font-size:18px;}',
      '.q-trow-pend{font-size:11px;font-weight:800;color:#f3b14e;flex-shrink:0;white-space:nowrap;}',
      '.q-trow-auto{font-size:11px;font-weight:700;color:#7d8b99;flex-shrink:0;}',
      // major progress / cta
      '#panel-quests .q-major-prog{display:flex;align-items:center;gap:12px;margin-top:13px;}',
      '#panel-quests .q-major-bar{flex:1;height:8px;border-radius:6px;background:rgba(255,255,255,.25);overflow:hidden;}',
      '#panel-quests .q-major-bar i{display:block;height:100%;border-radius:6px;background:var(--q-yellow);transition:width .6s cubic-bezier(.2,.8,.2,1);}',
      '#panel-quests .q-major-go{font-size:13px;font-weight:800;color:#fff;white-space:nowrap;display:inline-flex;align-items:center;gap:3px;}',
      '#panel-quests .q-major-go .material-icons{font-size:16px;}',
      '#panel-quests .q-major-cta{display:inline-flex;align-self:flex-start;align-items:center;gap:6px;margin-top:13px;font-size:13.5px;font-weight:800;color:#082335;background:var(--q-yellow);border-radius:10px;padding:9px 16px;}',
      '#panel-quests .q-major-cta .material-icons{font-size:17px;}',
      '#panel-quests .q-major-cta.done{background:#4ade80;}',
      // row progress
      '#panel-quests .q-row-prog{margin-top:7px;}',
      '#panel-quests .q-row-bar{height:6px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden;}',
      '#panel-quests .q-row-bar i{display:block;height:100%;border-radius:5px;background:#2ba8e0;transition:width .5s ease;}',
      '#panel-quests .q-row-go{color:#5b6b7a;font-size:24px;flex-shrink:0;}',
      '#panel-quests .q-row-state.done{color:#4ade80;}#panel-quests .q-row-state.done .material-icons{font-size:22px;}',
      // detail progress hero
      '.q-prog{background:rgba(8,20,32,.55);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px;margin-bottom:14px;}',
      '.q-prog.complete{border-color:rgba(74,222,128,.5);background:linear-gradient(135deg,rgba(74,222,128,.12),rgba(8,20,32,.55));}',
      '.q-prog-win{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:900;color:#4ade80;margin-bottom:10px;}.q-prog-win .material-icons{font-size:20px;}',
      '.q-prog-row{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:9px;gap:10px;}',
      '.q-prog-count{font-size:13px;color:#9fb4c4;font-weight:700;}.q-prog-count b{font-size:24px;color:#fff;font-weight:900;}',
      '.q-prog-stats{font-size:12.5px;color:#8a99a8;font-weight:700;white-space:nowrap;}.q-prog-stats b{font-size:15px;}.q-prog-stats b.gold{color:#f4d77a;}.q-prog-stats b.blue{color:#2ba8e0;}',
      '.q-prog-bar{height:10px;border-radius:7px;background:rgba(255,255,255,.08);overflow:hidden;}',
      '.q-prog-bar i{display:block;height:100%;border-radius:7px;background:linear-gradient(90deg,#2ba8e0,#4ade80);transition:width .7s cubic-bezier(.2,.8,.2,1);}',
      // accordion task
      '.q-task{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.03);overflow:hidden;transition:border-color .15s;}',
      '.q-task.done{border-color:rgba(74,222,128,.35);background:rgba(74,222,128,.06);}',
      '.q-task-head{display:flex;align-items:center;gap:11px;padding:12px;cursor:pointer;}',
      '.q-task-ck{font-size:22px;color:#3f5161;flex-shrink:0;}.q-task-ck.done{color:#4ade80;}.q-task-ck.pend{color:#f3b14e;}',
      '.q-task-ti{flex:1;min-width:0;font-size:14px;font-weight:700;color:#e8eef4;}',
      '.q-task.done .q-task-ti{color:#9fb4c4;}',
      '.q-task-tag{font-size:11.5px;font-weight:800;color:#f4d77a;background:rgba(244,215,122,.12);border-radius:7px;padding:3px 8px;flex-shrink:0;}',
      '.q-task-tag.done{color:#4ade80;background:rgba(74,222,128,.14);}.q-task-tag.pend{color:#f3b14e;background:rgba(243,177,78,.14);}',
      '.q-task-chev{font-size:22px;color:#5b6b7a;flex-shrink:0;transition:transform .2s;}',
      '.q-task.open .q-task-chev{transform:rotate(180deg);}',
      '.q-task-d{max-height:0;overflow:hidden;transition:max-height .28s ease;}',
      '.q-task.open .q-task-d{max-height:360px;}',
      '.q-task-how{padding:0 14px 2px 47px;}',
      '.q-task-how-h{font-size:10.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#7d8b99;}',
      '.q-task-how-t{font-size:13px;color:#cfd6dc;margin-top:3px;line-height:1.5;}',
      '.q-task-btn{display:flex;align-items:center;justify-content:center;gap:7px;width:auto;margin:11px 14px 14px;padding:12px;border:none;border-radius:11px;background:#2ba8e0;color:#082335;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer;}.q-task-btn .material-icons{font-size:18px;}',
      '.q-task-status{display:flex;align-items:center;gap:7px;margin:9px 14px 14px;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:700;}.q-task-status .material-icons{font-size:18px;}',
      '.q-task-status.ok{color:#4ade80;background:rgba(74,222,128,.1);}.q-task-status.wait{color:#f3b14e;background:rgba(243,177,78,.1);}.q-task-status.auto{color:#9fb4c4;background:rgba(255,255,255,.04);}',
      // leaderboard
      '.q-board-filters{display:flex;flex-direction:column;gap:9px;margin-bottom:12px;}',
      '.q-board-chips{display:flex;gap:6px;}',
      '.q-chip{flex:1;font-size:12px;font-weight:700;color:#8a99a8;background:rgba(8,20,32,.5);border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:8px 6px;cursor:pointer;font-family:inherit;}',
      '.q-chip.active{background:#2ba8e0;color:#fff;border-color:#2ba8e0;}',
      '#q-board-search{width:100%;box-sizing:border-box;padding:10px 13px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(8,20,32,.4);color:#e8eef4;font-size:13px;font-family:inherit;}',
      '.q-board-list{max-height:50vh;overflow:auto;-webkit-overflow-scrolling:touch;}',
      '.q-board-loading,.q-board-empty{font-size:12.5px;color:#8a99a8;padding:14px 4px;text-align:center;}',
      '.q-lb-row{display:flex;align-items:center;gap:11px;padding:8px 10px;border-radius:10px;margin-bottom:6px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);}',
      '.q-lb-row.me{background:rgba(43,168,224,.12);border-color:#2ba8e0;}',
      '.q-lb-rank{width:22px;text-align:center;font-weight:900;font-size:13px;flex-shrink:0;}',
      '.q-lb-av{width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;}',
      '.q-lb-ph{background:#13324a;color:#cfe0ee;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;}',
      '.q-lb-meta{flex:1;min-width:0;}',
      '.q-lb-name{font-weight:700;color:#e8eef4;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.q-lb-loc{font-size:11px;color:#8a99a8;}',
      '.q-lb-pts{font-weight:900;color:#e8eef4;font-size:14px;flex-shrink:0;}.q-lb-pts span{font-size:10px;color:#8a99a8;font-weight:700;margin-left:2px;}'
    ].join('');
    document.head.appendChild(s);
  },

  renderAll() {
    this._ensureCss();
    this.renderMajor();
    var host = document.getElementById('quest-sections'); if (!host) return;
    var html = '';
    // Minor — more FFP quests
    html += '<div class="q-sec-h">More quests</div>';
    html += this.minor.length
      ? '<div class="q-list">' + this.minor.map(this.rowMinor.bind(this)).join('') + '</div>'
      : '<div class="q-sec-empty">New quests are on the way — check back soon.</div>';
    // Partner (only if any unlocked)
    if (this.partner.length) {
      html += '<div class="q-sec-h" style="margin-top:22px;">Partner quests <span class="q-sec-h-sub">unlocked for you</span></div>';
      html += '<div class="q-list">' + this.partner.map(this.rowPartner.bind(this)).join('') + '</div>';
    }
    host.innerHTML = html;
  },

  renderMajor() {
    var el = document.getElementById('quest-hero'); if (!el) return;
    var h = this.major;
    if (!h) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = '';
    var done = h.my_completed || 0, total = h.task_count || 0;
    var pct = total ? Math.round(done / total * 100) : 0;
    var complete = total > 0 && done >= total;
    var bg = h.hero_image_url
      ? "linear-gradient(180deg,rgba(8,20,32,0.10),rgba(8,20,32,0.88)),url('" + h.hero_image_url + "')"
      : 'linear-gradient(135deg,rgba(43,168,224,0.5),rgba(8,30,46,0.92))';
    var foot;
    if (complete) {
      foot = '<div class="q-major-cta done"><span class="material-icons">emoji_events</span> Quest complete</div>';
    } else if (h.joined) {
      foot = '<div class="q-major-prog">' +
          '<div class="q-major-bar"><i style="width:' + pct + '%;"></i></div>' +
          '<span class="q-major-go">Continue <span class="material-icons">arrow_forward</span></span>' +
        '</div>';
    } else {
      foot = '<div class="q-major-cta"><span class="material-icons">bolt</span> Start the quest</div>';
    }
    el.innerHTML =
      '<div class="q-major" onclick="Quests.open(\'' + h.id + '\',\'ffp\')" style="background:' + bg + ';background-size:cover;background-position:center;">' +
        '<span class="q-major-pill"><span class="material-icons">stars</span> Featured quest</span>' +
        '<div class="q-major-title">' + escHtml(h.title) + '</div>' +
        (h.description ? '<div class="q-major-desc">' + escHtml(h.description) + '</div>' : '') +
        foot +
      '</div>';
  },

  _empty(t, s) {
    return '<div style="text-align:center;color:var(--q-muted);padding:34px 16px;">' +
      '<div style="font-weight:800;color:var(--q-text);">' + t + '</div><div style="margin-top:6px;font-size:13px;">' + s + '</div></div>';
  },
  _thumb(q) {
    var c = (this.CAT[q.category] || {}).cover || 'cov-fitness';
    return q.hero_image_url
      ? '<div class="q-row-thumb" style="background-image:url(\'' + q.hero_image_url + '\');"></div>'
      : '<div class="q-row-thumb ' + c + '"><span class="material-icons">flag</span></div>';
  },
  // Compact full-width list rows (scale to any count — no giant squares)
  _rowProgress(done, total) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<div class="q-row-prog"><div class="q-row-bar"><i style="width:' + pct + '%;"></i></div></div>';
  },
  rowMinor(q) {
    var joined = !!q.joined, done = q.my_completed || 0, total = q.task_count || 0;
    var complete = total > 0 && done >= total;
    var body, right;
    if (joined) {
      body = '<div class="q-row-title">' + escHtml(q.title) + '</div>' + this._rowProgress(done, total);
      right = complete
        ? '<span class="q-row-state done"><span class="material-icons">emoji_events</span></span>'
        : '<span class="material-icons q-row-go">chevron_right</span>';
    } else {
      var social = (q.joined_count || 0) > 0 ? (q.joined_count + ' playing') : 'Be the first to join';
      body = '<div class="q-row-title">' + escHtml(q.title) + '</div><div class="q-row-meta">' + social + '</div>';
      right = '<button class="q-row-join" onclick="event.stopPropagation();Quests.join(\'' + q.id + '\')">Join</button>';
    }
    return '<div class="q-row" onclick="Quests.open(\'' + q.id + '\',\'ffp\')">' +
      this._thumb(q) + '<div class="q-row-body">' + body + '</div>' + right + '</div>';
  },
  rowPartner(q) {
    var done = q.my_completed || 0, total = q.task_count || 0;
    var complete = total > 0 && done >= total;
    var right = complete
      ? '<span class="q-row-state done"><span class="material-icons">emoji_events</span></span>'
      : '<span class="material-icons q-row-go">chevron_right</span>';
    return '<div class="q-row" onclick="Quests.open(\'' + q.id + '\',\'partner\')">' +
      this._thumb(q) +
      '<div class="q-row-body"><div class="q-row-title">' + escHtml(q.title) + '</div>' +
        '<div class="q-row-meta"><span class="material-icons" style="font-size:12px;vertical-align:-2px;">lock</span> ' + escHtml(q.provider_name || 'Partner') + '</div>' +
        this._rowProgress(done, total) + '</div>' +
      right + '</div>';
  },

  open(id, kind) {
    if (kind === 'member') return this.openMemberDetail(id);
    return this.openTaskDetail(id);
  },

  // ── FFP / partner quest detail = compact task checklist + filterable leaderboard ──
  async openTaskDetail(id) {
    var mid = this.memberId();
    this._ensureCss();
    this._openQuest = id; this._boardLoaded = false; this.boardScope = 'global'; this.boardSearch = '';
    var d = null;
    try { var r = await window.supabase.rpc('member_quest_detail', { p_me: mid, p_quest: id }); d = (r && r.data) ? r.data : null; } catch (e) {}
    if (!d) { showToast('Could not open quest', 'error'); return; }
    this._openData = d;
    var hasBoard = (d.leaderboard && d.leaderboard !== 'none');
    var catCover = (this.CAT[d.category] && this.CAT[d.category].cover) || 'cov-fitness';
    var coverBg = d.hero_image_url
      ? "linear-gradient(180deg,rgba(8,20,32,0.12),rgba(8,20,32,0.80)),url('" + d.hero_image_url + "')" : '';
    var tasks = d.tasks || [];
    var total = tasks.length;
    var done = tasks.filter(function (t) { return (t.my_state || '') === 'verified'; }).length;
    var pct = total ? Math.round(done / total * 100) : 0;
    var complete = total > 0 && done >= total;
    var pill = (d.kind === 'ffp') ? 'Open to all' : ('Members · ' + escHtml(d.provider_name || 'Partner'));
    var tasksHtml = tasks.map(this.taskAccordion.bind(this)).join('') || '<div class="q-board-empty">Tasks announced soon.</div>';
    // Gamified progress hero — the dopamine loop: a big bar that fills, points climbing, rank to chase.
    var prog = '<div class="q-prog' + (complete ? ' complete' : '') + '">' +
        (complete ? '<div class="q-prog-win"><span class="material-icons">emoji_events</span> Quest complete!</div>' : '') +
        '<div class="q-prog-row">' +
          '<span class="q-prog-count"><b>' + done + '</b> <span>/ ' + total + ' done</span></span>' +
          '<span class="q-prog-stats"><b class="gold">' + (d.my_points || 0) + '</b> pts' +
            (hasBoard ? ' &nbsp;·&nbsp; <b class="blue">' + (d.my_rank ? '#' + d.my_rank : '—') + '</b> rank' : '') + '</span>' +
        '</div>' +
        '<div class="q-prog-bar"><i style="width:' + pct + '%;"></i></div>' +
      '</div>';
    var toggle = hasBoard
      ? '<div class="q-seg"><button id="q-seg-tasks" class="active" onclick="Quests.questPane(\'tasks\')">Tasks</button>' +
        '<button id="q-seg-board" onclick="Quests.questPane(\'board\')">Leaderboard</button></div>' : '';
    var boardPane = hasBoard
      ? '<div id="q-pane-board" style="display:none;">' +
          '<div class="q-board-filters">' +
            '<div class="q-board-chips">' +
              '<button class="q-chip active" data-scope="global" onclick="Quests.boardFilter(\'global\')">Global</button>' +
              '<button class="q-chip" data-scope="country" onclick="Quests.boardFilter(\'country\')">My country</button>' +
              '<button class="q-chip" data-scope="city" onclick="Quests.boardFilter(\'city\')">My city</button>' +
            '</div>' +
            '<input id="q-board-search" placeholder="Search name…" oninput="Quests.boardSearchInput(this.value)">' +
          '</div>' +
          '<div id="q-board-list" class="q-board-list"><div class="q-board-loading">Loading…</div></div>' +
        '</div>' : '';
    var html =
      '<div class="q-detail2">' +
        '<div class="q-d2-cover ' + (coverBg ? '' : catCover) + '"' + (coverBg ? ' style="background-image:' + coverBg + ';"' : '') + '>' +
          '<span class="q-d2-pill">' + pill + '</span>' +
          '<div class="q-d2-title">' + escHtml(d.title) + '</div>' +
        '</div>' +
        '<div class="q-d2-body">' +
          (d.description ? '<p class="q-d2-desc">' + escHtml(d.description) + '</p>' : '') +
          prog + toggle +
          '<div id="q-pane-tasks"><div class="q-tasklist">' + tasksHtml + '</div></div>' +
          boardPane +
        '</div>' +
      '</div>';
    openDetailModal(html);
    var bar = document.querySelector('.q-prog-bar i'); if (bar) { bar.style.width = '0%'; setTimeout(function () { bar.style.width = pct + '%'; }, 60); }
  },

  toggleTask(id) {
    var row = document.getElementById('q-task-' + id); if (!row) return;
    var open = row.classList.contains('open');
    var all = document.querySelectorAll('#q-pane-tasks .q-task.open');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('open');
    if (!open) row.classList.add('open');
  },

  questPane(which) {
    var t = document.getElementById('q-pane-tasks'), b = document.getElementById('q-pane-board');
    var st = document.getElementById('q-seg-tasks'), sb = document.getElementById('q-seg-board');
    if (which === 'board') {
      if (t) t.style.display = 'none'; if (b) b.style.display = '';
      if (st) st.classList.remove('active'); if (sb) sb.classList.add('active');
      if (!this._boardLoaded) { this._boardLoaded = true; this.loadQuestBoard(); }
    } else {
      if (b) b.style.display = 'none'; if (t) t.style.display = '';
      if (sb) sb.classList.remove('active'); if (st) st.classList.add('active');
    }
  },
  boardFilter(scope) {
    this.boardScope = scope;
    var chips = document.querySelectorAll('.q-board-chips .q-chip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('active', chips[i].getAttribute('data-scope') === scope);
    this.loadQuestBoard();
  },
  boardSearchInput(v) {
    this.boardSearch = v || '';
    var self = this; clearTimeout(this._boardT);
    this._boardT = setTimeout(function () { self.loadQuestBoard(); }, 250);
  },

  async loadQuestBoard() {
    var host = document.getElementById('q-board-list'); if (!host || !this._openQuest) return;
    host.innerHTML = '<div class="q-board-loading">Loading…</div>';
    var p = this.meProfile();
    var args = { p_quest: this._openQuest, p_limit: 50, p_search: this.boardSearch || null };
    if (this.boardScope === 'city') args.p_city = p.city || null;
    if (this.boardScope === 'country') args.p_country = p.country || null;
    var rows = [];
    try { var r = await window.supabase.rpc('quest_leaderboard', args); rows = (r && r.data) ? r.data : []; } catch (e) {}
    if (!rows.length) {
      host.innerHTML = '<div class="q-board-empty">' + (this.boardSearch ? 'No one matches “' + escHtml(this.boardSearch) + '”.' : 'No one here yet — be the first to climb.') + '</div>';
      return;
    }
    var mid = this.memberId();
    host.innerHTML = rows.map(function (b, i) {
      var me = b.member_id === mid;
      var medal = i === 0 ? '#f4d77a' : i === 1 ? '#c8d2dc' : i === 2 ? '#d8a06a' : '#7d8b99';
      var av = b.photo ? '<img src="' + b.photo + '" alt="" class="q-lb-av">' : '<div class="q-lb-av q-lb-ph">' + escHtml((b.name || 'M').charAt(0).toUpperCase()) + '</div>';
      var loc = [b.city, b.country].filter(Boolean).join(' · ');
      return '<div class="q-lb-row' + (me ? ' me' : '') + '">' +
        '<div class="q-lb-rank" style="color:' + medal + ';">' + (i + 1) + '</div>' + av +
        '<div class="q-lb-meta"><div class="q-lb-name">' + escHtml(b.name || 'Member') + (me ? ' • you' : '') + '</div>' +
        (loc ? '<div class="q-lb-loc">' + escHtml(loc) + '</div>' : '') + '</div>' +
        '<div class="q-lb-pts">' + b.points + '<span>pts</span></div>' +
      '</div>';
    }).join('');
  },

  // Accordion task: tap the head → expands to show how-to + the action. Completion = filled green check + row tint.
  taskAccordion(t) {
    var pm = this.PROOF[t.proof_type] || this.PROOF.photo;
    var st = t.my_state || 'open';
    var done = st === 'verified', pending = st === 'pending';
    // head: status circle, title, points (hidden once done), chevron
    var ck = done ? 'check_circle' : (pending ? 'hourglass_top' : 'radio_button_unchecked');
    var head = '<div class="q-task-head" onclick="Quests.toggleTask(\'' + t.id + '\')">' +
        '<span class="material-icons q-task-ck' + (done ? ' done' : (pending ? ' pend' : '')) + '">' + ck + '</span>' +
        '<div class="q-task-ti">' + escHtml(t.title) + '</div>' +
        (done ? '<span class="q-task-tag done">+' + (t.points || 0) + '</span>'
              : pending ? '<span class="q-task-tag pend">Pending</span>'
              : '<span class="q-task-tag">+' + (t.points || 0) + '</span>') +
        '<span class="material-icons q-task-chev">expand_more</span>' +
      '</div>';
    // expanded body: how to complete + action
    var act;
    if (done) act = '<div class="q-task-status ok"><span class="material-icons">check_circle</span> Completed</div>';
    else if (pending) act = '<div class="q-task-status wait"><span class="material-icons">hourglass_top</span> Awaiting confirmation</div>';
    else if (t.proof_type === 'auto') act = '<div class="q-task-status auto"><span class="material-icons">bolt</span> Tracked automatically — just do it</div>';
    else act = '<button class="q-task-btn" onclick="Quests.doTask(\'' + t.id + '\',\'' + t.proof_type + '\',' + (t.has_geo ? 'true' : 'false') + ')"><span class="material-icons">' + pm.icon + '</span> ' + pm.label + '</button>';
    var how = '<div class="q-task-how"><span class="q-task-how-h">How to complete</span>' +
        (t.instruction ? '<div class="q-task-how-t">' + escHtml(t.instruction) + '</div>' : '<div class="q-task-how-t">' + escHtml(pm.label) + (t.provider_name ? ' at ' + escHtml(t.provider_name) : '') + '.</div>') +
      '</div>';
    return '<div class="q-task' + (done ? ' done' : '') + '" id="q-task-' + t.id + '">' + head +
      '<div class="q-task-d">' + how + act + '</div></div>';
  },

  getGeo() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) return reject(new Error('no_geo'));
      navigator.geolocation.getCurrentPosition(
        function (p) { resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
        function () { reject(new Error('denied')); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
  },

  async doTask(taskId, proofType, hasGeo) {
    var self = this;
    if (proofType === 'qr') {
      var code = window.prompt('Enter the code shown at this spot (or scan the QR):');
      if (!code) return;
      return this._complete(taskId, { scanned_code: code.trim() });
    }
    if (proofType === 'gps') {
      showToast('Getting your location…', 'info');
      try { var g = await this.getGeo(); return this._complete(taskId, g); }
      catch (e) { showToast('Turn on location to check in here', 'error'); return; }
    }
    if (proofType === 'photo' || proofType === 'photo_gps') {
      if (!window.FFPUpload || !window.FFPUpload.pick) { showToast('Photo upload unavailable', 'error'); return; }
      window.FFPUpload.pick({
        bucket: 'quest-images', key: 'quest-proof/' + (this.memberId() || 'm') + '-' + taskId + '-' + Date.now() + '.jpg',
        aspect: 1, outW: 1000, outH: 1000, title: 'Proof photo',
        onDone: async function (url) {
          if (!url) return;
          var payload = { photo_url: url };
          if (proofType === 'photo_gps' || hasGeo) {
            try { var g = await self.getGeo(); payload.lat = g.lat; payload.lng = g.lng; }
            catch (e) { if (proofType === 'photo_gps') { showToast('Turn on location for this task', 'error'); return; } }
          }
          self._complete(taskId, payload);
        },
        onError: function () { showToast('Photo upload failed', 'error'); }
      });
      return;
    }
    // partner / referral — submit for confirmation
    return this._complete(taskId, {});
  },

  async _complete(taskId, payload) {
    var mid = this.memberId(); if (!mid) { showToast('Please sign in again', 'error'); return; }
    try {
      var r = await window.supabase.rpc('member_quest_complete_task', { p_me: mid, p_task: taskId, p: payload });
      var d = (r && r.data) ? r.data : null;
      if (r && r.error) throw r.error;
      if (!d || !d.ok) {
        var em = { bad_code: 'That code isn’t right', too_far: 'You’re too far from this spot' + (d && d.distance_m ? ' (' + d.distance_m + 'm)' : ''),
                   need_location: 'Turn on location for this task', need_photo: 'Add a photo first', needs_unlock: 'Unlock this quest first',
                   no_sessions_left: 'No sessions left', already_booked: 'Already done' };
        showToast((d && em[d.error]) || 'Could not complete that', 'error'); return;
      }
      if (d.status === 'verified') showToast('Nice! +' + (d.points_awarded || 0) + ' pts' + (d.completed >= d.total ? ' — quest complete!' : ''), 'success');
      else showToast('Submitted — awaiting confirmation', 'success');
      await this.load();
      if (this._openQuest) this.openTaskDetail(this._openQuest);
    } catch (e) { showToast('Something went wrong', 'error'); }
  },

  async join(id) {
    var mid = this.memberId(); if (!mid || !window.supabase) { showToast('Please sign in again', 'error'); return; }
    try {
      var r = await window.supabase.rpc('member_quest_join', { p_me: mid, p_quest: id });
      var d = (r && r.data) || {};
      if (r && r.error) throw r.error;
      if (!d.ok) { showToast(d.error === 'needs_unlock' ? 'This quest needs a partner code' : 'Couldn’t join', 'error'); return; }
      showToast('You’re on this quest!', 'success');
      await this.load();
      this.openTaskDetail(id);
    } catch (e) { showToast('Could not join', 'error'); }
  },

  async promptUnlock() {
    var code = window.prompt('Enter your partner quest code (or scan their QR):');
    if (!code) return;
    var mid = this.memberId(); if (!mid) { showToast('Please sign in again', 'error'); return; }
    try {
      var r = await window.supabase.rpc('member_quest_unlock', { p_me: mid, p_code: code.trim() });
      var d = (r && r.data) || {};
      if (!d.ok) { showToast('That code didn’t match a quest', 'error'); return; }
      showToast('Unlocked: ' + (d.title || 'partner quest'), 'success');
      await this.load();
      this.openTaskDetail(d.quest_id);
    } catch (e) { showToast('Could not unlock', 'error'); }
  },

  dots(done, target) {
    var h = '', t = target || 0, complete = t > 0 && done >= t;
    for (var i = 0; i < t; i++) h += i < done ? '<span class="qc-dot emblem' + (complete ? ' lit' : '') + '"></span>' : '<span class="qc-dot todo"></span>';
    return h;
  },

  // ════════════════════════════════════════════════════════════════════
  // PRESERVED: member-created exploration quests (detail + create + invite)
  // ════════════════════════════════════════════════════════════════════
  async openMemberDetail(id) {
    var mid = this.memberId();
    var detail = null;
    try { var res = await fetch(this.base + '/api/quests/' + id + (mid ? ('?member_id=' + encodeURIComponent(mid)) : '')); detail = await res.json(); } catch (e) {}
    var q = (detail && detail.quest) ? detail.quest : null;
    if (!q) { showToast('Could not open quest', 'error'); return; }
    var pc = (detail && detail.progress) ? (detail.progress.completed_count || 0) : 0;
    var catCover = (this.CAT[q.category] && this.CAT[q.category].cover) || '';
    var coverPill = '<span class="q-cover-pill">' + ((q.scope || '').charAt(0).toUpperCase() + (q.scope || '').slice(1)) + ' · ' + escHtml(q.category || '') + '</span>';
    var coverDiv = q.hero_image_url
      ? '<div class="q-cover" style="background-image:linear-gradient(180deg,rgba(8,20,32,0.20),rgba(8,20,32,0.55)),url(\'' + q.hero_image_url + '\');">' + coverPill + '</div>'
      : '<div class="q-cover ' + catCover + '">' + coverPill + '</div>';
    var html =
      '<div class="q-detail">' + coverDiv +
        '<div class="q-detail-body">' +
          '<h3 class="q-title">' + escHtml(q.title) + '</h3>' +
          '<p class="q-desc">' + escHtml(q.description || '') + '</p>' +
          '<div class="q-join-box"><div class="q-join-count"><span class="material-icons">group</span>' + (((detail && detail.joined_count) || 1)) + ' on this quest</div>' +
            ((detail && detail.progress) ? '<div class="q-join-state">You’re on this quest ✓</div>' : '<button class="btn-primary-blue" onclick="Quests.join(\'' + q.id + '\')">Join this quest</button>') +
          '</div>' +
          (q.created_by && q.created_by === mid ? '<button style="width:100%;margin:0 0 10px;padding:11px;border-radius:11px;border:1px solid rgba(43,168,224,0.35);background:rgba(43,168,224,0.06);color:#2ba8e0;font-weight:700;cursor:pointer;font-family:inherit;" onclick="Quests.openEdit(\'' + q.id + '\')"><span class="material-icons" style="font-size:16px;vertical-align:middle;">edit</span> Edit quest</button>' : '') +
          '<button style="width:100%;margin:0 0 14px;padding:11px;border-radius:11px;border:none;background:#2ba8e0;color:#082335;font-weight:800;cursor:pointer;font-family:inherit;" onclick="Quests.openInvite(\'' + q.id + '\')"><span class="material-icons" style="font-size:16px;vertical-align:middle;">person_add</span> Invite friends to join me</button>' +
          '<div class="q-joiners" id="q-detail-joiners"></div>' +
          '<div class="q-progress">' + pc + ' of ' + q.target_count + ' stamped</div>' +
          '<div class="qc-stamps big">' + this.dots(pc, q.target_count) + '</div>' +
          '<div class="q-venues-title">Where to go</div><div id="q-detail-venues"><div class="q-venue muted">Loading venues…</div></div>' +
        '</div>' +
      '</div>';
    openDetailModal(html);
    if (window.supabase) {
      window.supabase.rpc('member_quest_participants', { p_quest: q.id }).then(function (res) {
        var arr = (res && res.data) || []; var host = document.getElementById('q-detail-joiners'); if (!host || !arr.length) return;
        var av = arr.map(function (p) {
          var img = p.photo_url ? '<img src="' + p.photo_url + '" alt="" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #0f1e2e;">'
            : '<div style="width:34px;height:34px;border-radius:50%;background:#13324a;color:#cfe0ee;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #0f1e2e;">' + escHtml((p.name || 'M').charAt(0).toUpperCase()) + '</div>';
          return '<div title="' + escHtml(p.name || '') + '" style="margin-left:-8px;">' + img + '</div>';
        }).join('');
        host.innerHTML = '<div style="font-size:12px;color:#9fb4c4;margin:2px 0 8px;font-weight:700;">Who’s joined (' + arr.length + ')</div><div style="display:flex;align-items:center;padding-left:8px;flex-wrap:wrap;">' + av + '</div>';
      }).catch(function () {});
      this.qcInjectCss();
      window.supabase.rpc('member_quest_venues', { p_quest: q.id }).then(function (res) {
        var d = (res && res.data) || null; var host = document.getElementById('q-detail-venues'); if (!host || !d) return;
        if (!d.venues || !d.venues.length) { host.innerHTML = '<div class="q-venue muted">No FFP venues yet — check back soon.</div>'; return; }
        window._ffpQdv = d.venues;
        host.innerHTML = '<div style="font-size:12px;color:#9fb4c4;margin-bottom:8px;">' + (d.fixed ? 'The member picked these venues — only these count:' : 'Any of these FFP venues count toward the goal:') + '</div>' +
          (d.venues.length > 6 ? '<input id="q-detail-venue-search" placeholder="Search places…" oninput="Quests.qdvFilter(this.value)" style="width:100%;box-sizing:border-box;padding:10px 13px;border-radius:10px;border:1px solid rgba(43,168,224,0.25);background:rgba(43,168,224,0.05);color:#e8eef4;font-size:13px;font-family:inherit;margin-bottom:10px;">' : '') +
          '<div id="q-detail-venue-list" style="display:flex;flex-direction:column;gap:8px;">' + Quests.qdvCardsHtml(d.venues) + '</div>';
      }).catch(function () {});
    }
  },

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
    if (bo) bo.classList.toggle('active', m === 'open'); if (bp) bp.classList.toggle('active', m === 'pick');
    this.qcRenderVenues();
  },
  qcTogglePick(id) { var st = window._ffpQc || {}; if (!st.picked) st.picked = {}; st.picked[id] = !st.picked[id]; window._ffpQc = st; this.qcRenderVenues(); },
  qcRenderVenues() {
    var st = window._ffpQc || {}; var box = document.getElementById('qc-venues'); if (!box) return;
    var pick = st.mode === 'pick';
    var note = document.getElementById('qc-pool-note'), tgtWrap = document.getElementById('qc-target-wrap');
    if (pick) {
      var picked = (st.venues || []).filter(function (v) { return st.picked && st.picked[v.id]; });
      var names = picked.map(function (v) { return v.name; });
      box.innerHTML = '<button type="button" class="qc-choose-btn" onclick="Quests.qcOpenVenuePicker()"><span class="material-icons">storefront</span> Choose venues</button>' +
        (picked.length ? '<div class="qc-pick-summary"><strong style="color:#2ba8e0;">' + picked.length + ' selected:</strong> ' + escHtml(names.slice(0, 5).join(', ')) + (names.length > 5 ? ' +' + (names.length - 5) + ' more' : '') + '</div>'
          : '<div class="qc-pick-summary" style="color:#8a99a8;">None picked yet — tap “Choose venues” to select the places this quest counts.</div>');
      if (note) note.innerHTML = 'Pick the specific places this quest counts — <strong>' + (st.count || 0) + '</strong> available in this area.';
      if (tgtWrap) tgtWrap.style.display = 'none';
    } else {
      box.innerHTML = '';
      if (note) note.innerHTML = '<strong style="color:#2ba8e0;">' + (st.count || 0) + ' FFP venue' + ((st.count || 0) === 1 ? '' : 's') + '</strong> count toward this quest — visit any of them, and new FFP partners join automatically.';
      if (tgtWrap) tgtWrap.style.display = '';
    }
  },
  qcOpenVenuePicker() {
    if (document.getElementById('qcvp-overlay')) return;
    var ov = document.createElement('div'); ov.id = 'qcvp-overlay';
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:100001;background:#0b1c28;display:flex;flex-direction:column;font-family:inherit;');
    ov.innerHTML =
      '<div style="padding:16px 18px;border-bottom:1px solid rgba(43,168,224,0.2);display:flex;align-items:center;gap:10px;flex-shrink:0;">' +
        '<button onclick="Quests.qcvpDone()" style="background:none;border:none;color:#cfe0ee;cursor:pointer;display:flex;padding:0;"><span class="material-icons">arrow_back</span></button>' +
        '<div style="font-size:16px;font-weight:800;color:#e8eef4;">Choose venues</div></div>' +
      '<div style="padding:14px 18px 0;flex-shrink:0;"><input id="qcvp-search" placeholder="Search venues…" oninput="Quests.qcvpFilter(this.value)" style="width:100%;box-sizing:border-box;padding:11px 14px;border-radius:10px;border:1px solid rgba(43,168,224,0.25);background:rgba(43,168,224,0.05);color:#e8eef4;font-size:14px;font-family:inherit;"></div>' +
      '<div id="qcvp-list" style="flex:1;overflow:auto;padding:12px 18px;display:flex;flex-direction:column;gap:8px;">' + this.qcvpListHtml('') + '</div>' +
      '<div style="padding:14px 18px;border-top:1px solid rgba(43,168,224,0.2);flex-shrink:0;"><button class="btn-primary-blue" style="width:100%;" onclick="Quests.qcvpDone()">Done</button></div>';
    document.body.appendChild(ov);
  },
  qcvpListHtml(q) {
    var st = window._ffpQc || {}; var venues = st.venues || []; q = (q || '').trim().toLowerCase();
    if (q) venues = venues.filter(function (v) { return ((v.name || '') + ' ' + (v.area || '') + ' ' + (v.city || '')).toLowerCase().indexOf(q) !== -1; });
    if (!venues.length) return '<div class="cv-empty">No venues match.</div>';
    return venues.map(function (v) {
      var picked = !!(st.picked && st.picked[v.id]);
      var av = escHtml(String(v.letter_mark || (v.name || '?').charAt(0) || '?').toUpperCase());
      var area = [v.area, v.city].filter(Boolean).join(' · ');
      return '<div class="qc-venue-card pickable' + (picked ? ' picked' : '') + '" onclick="Quests.qcvpToggle(\'' + v.id + '\')">' +
        '<div class="qc-venue-av">' + av + '</div><div class="qc-venue-meta"><div class="qc-venue-nm">' + escHtml(v.name || 'Venue') + '</div>' +
        (area ? '<div class="qc-venue-area">' + escHtml(area) + '</div>' : '') + '</div>' +
        '<span class="material-icons qc-venue-check">' + (picked ? 'check_circle' : 'radio_button_unchecked') + '</span></div>';
    }).join('');
  },
  qcvpFilter(q) { var h = document.getElementById('qcvp-list'); if (h) h.innerHTML = this.qcvpListHtml(q || ''); },
  qcvpToggle(id) { var st = window._ffpQc || {}; if (!st.picked) st.picked = {}; st.picked[id] = !st.picked[id]; window._ffpQc = st; var s = document.getElementById('qcvp-search'); this.qcvpFilter(s ? s.value : ''); },
  qcvpDone() { var ov = document.getElementById('qcvp-overlay'); if (ov) ov.remove(); this.qcRenderVenues(); },
  qdvCardsHtml(venues) {
    var html = (venues || []).map(function (v) {
      var av = escHtml(String(v.letter_mark || (v.name || '?').charAt(0) || '?').toUpperCase());
      var area = [v.area, v.city].filter(Boolean).join(' · ');
      return '<div class="qc-venue-card"><div class="qc-venue-av">' + av + '</div><div class="qc-venue-meta"><div class="qc-venue-nm">' + escHtml(v.name || 'Venue') + '</div>' +
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
    var prof = {}; try { prof = (typeof MemberProfile !== 'undefined' && MemberProfile.data) || {}; } catch (e) {}
    var TAX = window.FFP_TAX || {};
    var countries = (TAX.cities ? Object.keys(TAX.cities).sort() : ['United Arab Emirates']);
    var defCountry = prof.country || 'United Arab Emirates';
    if (countries.indexOf(defCountry) === -1) defCountry = countries[0] || 'United Arab Emirates';
    var defCity = prof.city || '';
    var actObjs = (TAX.activities || []).filter(function (a) { return a && a.n; }).map(function (a) { return { n: a.n, c: (a.c || '') }; });
    var cats = ['fitness', 'sports', 'wellness', 'recovery', 'adventure', 'food'];
    function qcActOptions(cat) {
      var inCat = actObjs.filter(function (a) { return a.c === cat; }).map(function (a) { return a.n; }).sort();
      return '<option value="">Any activity</option>' + inCat.map(function (n) { return '<option value="' + escHtml(n) + '">' + escHtml(n) + '</option>'; }).join('');
    }
    var html =
      '<div class="qcreate">' +
        '<h3 class="q-title" id="qc-modal-title">Create your own quest</h3>' +
        '<p class="q-desc">Set a goal — like visiting a few different venues — and others can join you.</p>' +
        '<div id="qc-photo" onclick="Quests.pickHero()" style="width:100%;max-width:220px;aspect-ratio:1/1;margin:0 auto 16px;border-radius:16px;border:2px dashed rgba(43,168,224,0.35);background:rgba(8,20,32,0.4) center/cover no-repeat;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#8a99a8;"><span class="material-icons" style="font-size:34px;">add_a_photo</span></div>' +
        '<div class="qc-field"><label>Title</label><input id="qc-title" class="ffp-select" placeholder="e.g. Try 5 new gyms in Dubai" maxlength="80"></div>' +
        '<div class="qc-field"><label>Category</label><select id="qc-cat" class="ffp-select">' + cats.map(function (c) { return '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>'; }).join('') + '</select></div>' +
        '<div class="qc-field"><label>Activity — filtered by category</label><select id="qc-act" class="ffp-select">' + qcActOptions(cats[0]) + '</select></div>' +
        '<div class="qc-row">' +
          '<div class="qc-field"><label>Country</label><select id="qc-country" class="ffp-select">' + countries.map(function (c) { return '<option' + (c === defCountry ? ' selected' : '') + '>' + escHtml(c) + '</option>'; }).join('') + '</select></div>' +
          '<div class="qc-field"><label>City</label><select id="qc-city" class="ffp-select"></select></div>' +
        '</div>' +
        '<div class="qc-field" id="qc-pool-wrap" style="display:none;"><label>FFP venues for this quest</label>' +
          '<div id="qc-pool-note" style="font-size:12px;color:#9fb4c4;margin-bottom:9px;line-height:1.5;"></div>' +
          '<div id="qc-mode" style="display:none;gap:8px;margin-bottom:11px;">' +
            '<button type="button" id="qc-mode-open" class="qc-mode-btn active" onclick="Quests.qcSetMode(\'open\')">Any of them</button>' +
            '<button type="button" id="qc-mode-pick" class="qc-mode-btn" onclick="Quests.qcSetMode(\'pick\')">Pick specific</button>' +
          '</div>' +
          '<div id="qc-venues" style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow:auto;"></div>' +
        '</div>' +
        '<div class="qc-field" id="qc-target-wrap"><label>How many different venues to visit</label><input id="qc-target" type="number" min="2" max="50" value="5" class="ffp-select"></div>' +
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
      var catSel = document.getElementById('qc-cat'), actSel = document.getElementById('qc-act');
      async function qcUpdatePool() {
        var gv = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
        var city = gv('qc-city'), country = gv('qc-country'), act = gv('qc-act');
        var wrap = document.getElementById('qc-pool-wrap'), note = document.getElementById('qc-pool-note');
        var modeRow = document.getElementById('qc-mode'), box = document.getElementById('qc-venues'), tgtWrap = document.getElementById('qc-target-wrap');
        if (!city) { if (wrap) wrap.style.display = 'none'; window._ffpQcPool = null; window._ffpQc = null; return; }
        if (wrap) wrap.style.display = ''; if (note) note.textContent = 'Checking FFP venues…';
        if (box) box.innerHTML = ''; if (modeRow) modeRow.style.display = 'none';
        try {
          var res = await window.supabase.rpc('member_quest_venue_pool', { p_city: city, p_country: country || null, p_activity: act || null });
          var d = (res && res.data) || { count: 0, venues: [] }; var n = d.count || 0; window._ffpQcPool = n;
          var prevMode = (window._ffpQc && window._ffpQc.mode) || 'open';
          window._ffpQc = { venues: d.venues || [], mode: prevMode, picked: {}, count: n };
          if (n === 0) { if (note) note.innerHTML = '<strong style="color:#f3b14e;">No FFP venues for ' + escHtml(act || 'this') + ' in ' + escHtml(city) + ' yet.</strong>'; if (tgtWrap) tgtWrap.style.display = 'none'; return; }
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
      onError: function (e) { showToast('Photo upload failed', 'error'); }
    });
  },
  openEdit(id) {
    var q = (this.mine || []).find(function (x) { return x.id === id; });
    if (!q) { showToast('Quest not found', 'error'); return; }
    this.openCreate(); this._editId = id; this._createHero = q.hero_image_url || '';
    setTimeout(function () {
      var t = document.getElementById('qc-title'); if (t) t.value = q.title || '';
      var ph = document.getElementById('qc-photo'); if (ph && q.hero_image_url) { ph.style.backgroundImage = "url('" + q.hero_image_url + "')"; ph.innerHTML = ''; }
      var h = document.getElementById('qc-modal-title'); if (h) h.textContent = 'Edit your quest';
      var b = document.getElementById('qc-save-btn'); if (b) b.textContent = 'Save changes';
    }, 80);
  },
  async saveCreate() {
    var g = function (id) { var e = document.getElementById(id); return e ? (e.value || '').trim() : ''; };
    var title = g('qc-title'); if (!title) { showToast('Give your quest a title', 'error'); return; }
    var mid = this.memberId(); if (!mid || !window.supabase) { showToast('Please sign in again', 'error'); return; }
    if (this._editId) {
      var pe = { title: title, hero_image_url: this._createHero || '' };
      var teE = parseInt(g('qc-target'), 10); if (teE >= 2) pe.target_count = String(teE);
      try {
        var reE = await window.supabase.rpc('member_save_quest', { p_me: mid, p_id: this._editId, p: pe });
        if (reE.error) throw reE.error;
        if (typeof closeDetailModal === 'function') closeDetailModal();
        showToast('Quest updated', 'success'); await this.load();
      } catch (e) { showToast(e.message || 'Could not update quest', 'error'); }
      return;
    }
    var city = g('qc-city'); if (!city) { showToast('Pick a city', 'error'); return; }
    if (window._ffpQcPool === 0) { showToast('No FFP venues for that activity/city yet', 'error'); return; }
    var st = window._ffpQc || {}; var mode = st.mode || 'open';
    var payload = { title: title, category: g('qc-cat') || 'fitness', rule_activity: g('qc-act') || null, city: city, country: g('qc-country') || null, hero_image_url: this._createHero || '' };
    if (mode === 'pick') {
      var pids = Object.keys(st.picked || {}).filter(function (k) { return st.picked[k]; });
      if (pids.length < 2) { showToast('Tap at least 2 venues — or switch to “Any of them”', 'error'); return; }
      payload.target_provider_ids = pids;
    } else {
      var pool = window._ffpQcPool || 0; var target = parseInt(g('qc-target'), 10) || 0;
      if (target < 2) { showToast('Choose at least 2 venues', 'error'); return; }
      if (pool && target > pool) target = pool; payload.target_count = String(target);
    }
    try {
      var res = await window.supabase.rpc('member_save_quest', { p_me: mid, p_id: null, p: payload });
      if (res.error) throw res.error; if (!res.data) throw new Error('Could not create quest');
      if (typeof closeDetailModal === 'function') closeDetailModal();
      showToast('Quest created — invite friends to join you!', 'success'); await this.load();
    } catch (e) { showToast(e.message || 'Could not create quest', 'error'); }
  },

  async openInvite(questId) {
    if (document.getElementById('qinv-overlay')) return;
    var mid = this.memberId(); if (!mid || !window.supabase) { showToast('Please sign in again', 'error'); return; }
    this.qcInjectCss(); window._ffpInv = { quest: questId, picked: {}, people: [] };
    var ov = document.createElement('div'); ov.id = 'qinv-overlay';
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:100002;background:#0b1c28;display:flex;flex-direction:column;font-family:inherit;');
    ov.innerHTML =
      '<div style="padding:16px 18px;border-bottom:1px solid rgba(43,168,224,0.2);display:flex;align-items:center;gap:10px;flex-shrink:0;">' +
        '<button onclick="Quests.closeInvite()" style="background:none;border:none;color:#cfe0ee;cursor:pointer;display:flex;padding:0;"><span class="material-icons">arrow_back</span></button>' +
        '<div style="font-size:16px;font-weight:800;color:#e8eef4;">Invite friends to join</div></div>' +
      '<div style="padding:14px 18px 0;flex-shrink:0;"><input id="qinv-search" placeholder="Search your connections…" oninput="Quests.inviteFilter(this.value)" style="width:100%;box-sizing:border-box;padding:11px 14px;border-radius:10px;border:1px solid rgba(43,168,224,0.25);background:rgba(43,168,224,0.05);color:#e8eef4;font-size:14px;font-family:inherit;"></div>' +
      '<div id="qinv-list" style="flex:1;overflow:auto;padding:12px 18px;display:flex;flex-direction:column;gap:8px;"><div style="text-align:center;color:#8a99a8;padding:30px;">Loading connections…</div></div>' +
      '<div style="padding:14px 18px;border-top:1px solid rgba(43,168,224,0.2);flex-shrink:0;"><button class="btn-primary-blue" style="width:100%;" id="qinv-send" onclick="Quests.sendInvites()">Send invites</button></div>';
    document.body.appendChild(ov);
    try {
      var res = await window.supabase.rpc('member_connections_list', { p_me: mid });
      var arr = ((res && res.data) || []).filter(function (p) { return p && p.mutual; });
      window._ffpInv.people = arr; this.renderInviteList('');
    } catch (e) { var h = document.getElementById('qinv-list'); if (h) h.innerHTML = '<div style="text-align:center;color:#8a99a8;padding:30px;">Couldn’t load your connections.</div>'; }
  },
  renderInviteList(q) {
    var st = window._ffpInv || {}; var people = st.people || []; q = (q || '').trim().toLowerCase();
    if (q) people = people.filter(function (p) { return ((p.name || '') + ' ' + (p.city || '') + ' ' + (p.country || '')).toLowerCase().indexOf(q) !== -1; });
    var host = document.getElementById('qinv-list'); if (!host) return;
    if (!people.length) { host.innerHTML = '<div style="text-align:center;color:#8a99a8;padding:30px;line-height:1.6;">' + ((st.people && st.people.length) ? 'No connections match.' : 'You have no connections yet.') + '</div>'; return; }
    var nPicked = Object.keys(st.picked || {}).filter(function (k) { return st.picked[k]; }).length;
    host.innerHTML = people.map(function (p) {
      var picked = !!(st.picked && st.picked[p.id]);
      var av = p.photo ? '<img src="' + p.photo + '" alt="" style="width:42px;height:42px;border-radius:50%;object-fit:cover;flex-shrink:0;">' : '<div class="qc-venue-av" style="border-radius:50%;">' + escHtml((p.name || 'M').charAt(0).toUpperCase()) + '</div>';
      var area = [p.city, p.country].filter(Boolean).join(' · ');
      return '<div class="qc-venue-card pickable' + (picked ? ' picked' : '') + '" onclick="Quests.toggleInvite(\'' + p.id + '\')">' + av +
        '<div class="qc-venue-meta"><div class="qc-venue-nm">' + escHtml(p.name || 'Member') + '</div>' + (area ? '<div class="qc-venue-area">' + escHtml(area) + '</div>' : '') + '</div>' +
        '<span class="material-icons qc-venue-check">' + (picked ? 'check_circle' : 'radio_button_unchecked') + '</span></div>';
    }).join('');
    var btn = document.getElementById('qinv-send'); if (btn) btn.textContent = nPicked ? ('Send ' + nPicked + ' invite' + (nPicked === 1 ? '' : 's')) : 'Send invites';
  },
  inviteFilter(q) { this.renderInviteList(q || ''); },
  toggleInvite(id) { var st = window._ffpInv || {}; if (!st.picked) st.picked = {}; st.picked[id] = !st.picked[id]; window._ffpInv = st; var s = document.getElementById('qinv-search'); this.renderInviteList(s ? s.value : ''); },
  closeInvite() { var ov = document.getElementById('qinv-overlay'); if (ov) ov.remove(); },
  async sendInvites() {
    var st = window._ffpInv || {}; var mid = this.memberId();
    var ids = Object.keys(st.picked || {}).filter(function (k) { return st.picked[k]; });
    if (!ids.length) { showToast('Pick at least one friend', 'error'); return; }
    if (!mid) { showToast('Please sign in again', 'error'); return; }
    var btn = document.getElementById('qinv-send'); if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      var res = await fetch(this.base + '/api/quests/' + st.quest + '/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from_member_id: mid, to_member_ids: ids }) });
      var json = await res.json(); if (!res.ok || !json.success) throw new Error(json.error || 'Invite failed');
      var n = (json.sent != null ? json.sent : ids.length); this.closeInvite();
      showToast(n + ' invite' + (n === 1 ? '' : 's') + ' sent 🎉', 'success');
    } catch (e) { showToast(e.message || 'Could not send invites', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Send invites'; } }
  }
};

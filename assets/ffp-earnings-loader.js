/* ==============================================================
   FFP EARNINGS CORE  ->  window.Earnings
   Balance, tiers, progression categories, ways-to-earn, payout, refer modal.
   EXTRACTED from ffp-member-dashboard.html on 2026-06-20 to de-fragile the
   dashboard (mirrors the ffp-quests-core.js pattern). Loaded in <head> AFTER
   ffp-constants.js (object reads window.FFP_CONST at definition time).
   The lazy ffp-earnings-loader.js still enhances this object at runtime.
   ============================================================== */
window.Earnings = {
  // v87 — Real AED, tier system (Member/Supporter/Ambassador), 7 categories, 5 live ways to earn.
  
  balance: 0,
  pendingPayouts: 0,
  tier: 'member',  // computed
  
  referralCode: '',
  
  tiers: {
    member: {
      name: 'Member',
      icon: 'person',
      tierClass: 'tier-member',
      reqLine: 'Default tier when you sign up.',
      reqHighlight: '',
      perks: [
        '5% per referral',
        '— per accepted content piece',
        'Access to all member perks'
      ]
    },
    supporter: {
      name: 'Supporter',
      icon: 'verified',
      tierClass: 'tier-supporter',
      reqLine: 'Reach Supporter level (2+) in 4 of 7 categories.',
      reqHighlight: 'Supporter level (2+) in 4 of 7 categories',
      perks: [
        '10% per referral',
        '— per accepted content piece',
        '— per member you bring to a provider',
        'Priority on event hosting applications'
      ]
    },
    ambassador: {
      name: 'Ambassador',
      icon: 'workspace_premium',
      tierClass: 'tier-ambassador',
      reqLine: 'Reach Ambassador level (8+) in 4 of 7 categories.',
      reqHighlight: 'Ambassador level (8+) in 4 of 7 categories',
      perks: [
        '20% per referral',
        '— per accepted content piece',
        '— per member you bring to a provider',
        '— for hosting an event',
        'Top of provider partnership applications'
      ]
    }
  },
  
  // v175: the 8 tracked sections, each with its OWN Supporter/Ambassador target
  // (mirrors assets/ffp-tiers.js). Counts come from the member_tier_progress() RPC.
  categories: [
    { key: 'members_referred',     label: 'Members referred',     icon: 'group_add',      current: 0, supporter: 2, ambassador: 8,  unit: 'referrals',  blurb: 'Refer friends who join and pay — they sign up through your personal link.' },
    { key: 'connections_made',     label: 'Connections made',     icon: 'handshake',      current: 0, supporter: 2, ambassador: 8,  unit: 'connections', blurb: 'Connect with other members you meet on the platform.' },
    { key: 'meetups_hosted',       label: 'Meet-ups hosted',      icon: 'groups',         current: 0, supporter: 1, ambassador: 4,  unit: 'meet-ups',   blurb: 'Host meet-ups that other members come along to.' },
    { key: 'provider_checkins',    label: 'Providers visited',    icon: 'storefront',     current: 0, supporter: 2, ambassador: 8,  unit: 'providers',  blurb: 'Check in at partner venues — each different provider counts once.' },
    { key: 'quests_completed',     label: 'Tasks completed',      icon: 'flag',           current: 0, supporter: 4, ambassador: 10, unit: 'tasks',      blurb: 'Complete tasks across the platform.' },
    { key: 'events_attended',      label: 'Events attended',      icon: 'event',          current: 0, supporter: 1, ambassador: 4,  unit: 'events',     blurb: 'Attend events you RSVP to.' },
    { key: 'activities_logged',    label: 'Activities logged',    icon: 'fitness_center', current: 0, supporter: 8, ambassador: 24, unit: 'activities', blurb: 'Log what you do — gym, sport, a walk, stretch or recovery.' },
    { key: 'social_shares',        label: 'Social media shares',  icon: 'share',          current: 0, supporter: 10, ambassador: 30, unit: 'shares',     blurb: 'Share your activity and the app on social media.' }
  ],
  
  SUPPORTER_THRESHOLD: 2,          // need 2+ in a category to count toward Supporter
  SUPPORTER_CATEGORIES: 4,         // need 4 of 8 sections at Supporter level
  AMBASSADOR_THRESHOLD: 8,         // need 8+ in a category to count toward Ambassador
  AMBASSADOR_CATEGORIES: 4,        // need 4 of 8 sections at Ambassador level
  
  referralStats: { total: 0, earned: 0, pending: 0 },
  
  // v90 — 5 ways to earn. Only "refer" is active in Phase 1; the rest are coming soon.
  ways: [
    {
      key: 'refer', name: 'Refer a friend', icon: 'group_add',
      status: 'active',
      how: 'Share your code or link. You earn your tier’s % of every payment your referrals make — recurring, for as long as they stay a member.',
      rates: { member: '5%', supporter: '10%', ambassador: '20%' },
      unit: 'recurring',
      actionLabel: 'Refer now', action: 'openReferModal'
    },
    {
      key: 'provider', name: 'Promote a provider', icon: 'storefront',
      status: 'soon',
      how: 'Bring other FFP members to a partner provider. You earn a percentage of what they spend at the venue.',
      rates: { member: '—', supporter: '—', ambassador: '—' },
      unit: 'of member spend',
      ratesNote: 'Requires provider approval. Available providers will be listed once partners join the program.',
      actionLabel: 'Coming soon', action: null
    },
    {
      key: 'host', name: 'Host an event', icon: 'event',
      status: 'soon',
      how: 'Apply to host. Once approved by FFP, the event runs on the platform and you earn per event hosted.',
      rates: { member: '—', supporter: '—', ambassador: '—' },
      unit: 'per event hosted',
      actionLabel: 'Coming soon', action: null
    },
    {
      key: 'content', name: 'Create content', icon: 'edit_note',
      status: 'soon',
      how: 'Write reviews, post photos or videos for FFP. Every piece needs FFP team approval before payment is released.',
      rates: { member: '—', supporter: '—', ambassador: '—' },
      unit: 'per accepted piece',
      ratesNote: 'Requires FFP approval.',
      actionLabel: 'Coming soon', action: null
    },
    {
      key: 'challenge', name: 'Win a challenge', icon: 'emoji_events',
      status: 'soon',
      how: 'Challenges are set by FFP. Top of the leaderboard wins prize money.',
      rates: { member: '—', supporter: '—', ambassador: '—' },
      unit: 'set per challenge',
      ratesNote: 'Prize amounts vary per challenge.',
      actionLabel: 'Coming soon', action: null
    }
  ],
  
  transactions: [],
  
  _payoutAmount: 0,
  _openWay: null,
  _tierCardsOpen: false,    // v88 — Show/hide "How tiers work" cards

  // ─────────── v155: USD EARNINGS ───────────
  MEMBERSHIP_USD: (window.FFP_CONST && window.FFP_CONST.membershipUsd) || 99,   // source: ffp-constants.js
  REFERRAL_PCT: (window.FFP_CONST && window.FFP_CONST.referralPct) || { member: 5, supporter: 10, ambassador: 20 },
  MIN_PAYOUT_USD: (window.FFP_CONST && window.FFP_CONST.minPayoutUsd) || 250,   // source: ffp-constants.js
  AED_PER_USD: 3.6725,                                      // fixed AED↔USD peg
  // The real balance/referral numbers are injected by the external ffp-earnings-loader.js.
  // If that loader feeds AED (live balance reads ~3.67× too high), flip BALANCE_IS_AED to true
  // and it is converted to USD once on first render. Default: treat the injected value as USD.
  BALANCE_IS_AED: false,
  _normalized: false,
  referralUsd(tier) { return (this.REFERRAL_PCT[tier] || 5) / 100 * this.MEMBERSHIP_USD; },
  fmtUsd(v) { return (Math.round(v * 100) % 100 === 0) ? String(Math.round(v)) : Number(v).toFixed(2); },
  aedToUsd(aed) { return Math.round((Number(aed)||0) / this.AED_PER_USD * 100) / 100; },   // v247: cents-precise (was whole-dollar → $40 instead of $39.60)
  usdToAed(usd) { return Math.round((Number(usd)||0) * this.AED_PER_USD * 100) / 100; },   // convert USD→AED only when writing the stored amount_aed
  isUaeMember() {
    var m = (window.FFPAuth && window.FFPAuth.getMember && window.FFPAuth.getMember()) || {};
    var c = (m.country || '').trim().toLowerCase();
    return c === 'united arab emirates' || c === 'uae' || c === 'u.a.e.' || c === 'united arab emirates (uae)';
  },
  // Convert injected AED figures to USD exactly once (only if BALANCE_IS_AED).
  normalizeToUsd() {
    if (!this.BALANCE_IS_AED || this._normalized) return;
    this.balance = this.balance / this.AED_PER_USD;
    if (this.referralStats && typeof this.referralStats.earned === 'number') this.referralStats.earned = this.referralStats.earned / this.AED_PER_USD;
    if (Array.isArray(this.transactions)) this.transactions.forEach(t => { if (typeof t.amount === 'number') t.amount = Math.round(t.amount / this.AED_PER_USD * 100) / 100; });
    this._normalized = true;
  },

  init() {
    this.render();
    this.loadTierStats();
  },

  // v243 — Wire tier progression to the member_tier_progress() RPC.
  // The RPC returns an object whose keys EXACTLY match our category keys
  // (members_referred, connections_made, meetups_hosted, provider_checkins,
  //  quests_completed, events_attended, activities_logged, challenges_completed),
  // so we map straight across. (Old /api/members/:id/stats used mismatched keys
  // — referrals/stamps/providers/logs — which left every count at 0.)
  async loadTierStats() {
    var member = (window.FFPAuth && window.FFPAuth.getMember && window.FFPAuth.getMember()) || null;
    if (!member || !member.id) return;
    try {
      var res = await window.supabase.rpc('member_tier_progress', { p_me: member.id });
      if (res.error) { console.error('[FFP Tier] rpc:', res.error); return; }
      var d = res.data || {};
      this.categories.forEach(function (c) { if (typeof d[c.key] === 'number') c.current = d[c.key]; });
      this.tier = this.computedTier();
      this.render();
    } catch (e) { console.error('[FFP Tier] stats:', e); }
  },
  
  // ─────────── COMPUTED ───────────
  computedTier() {
    // v169: tier is ADMIN-CONTROLLED for now (manual grant + Founding Ambassador promo),
    // so the source of truth is the member's stored tier — NOT a local activity calc.
    // (The activity-based auto-evaluation is parked in assets/ffp-tiers.js for later.)
    try {
      var t = (typeof MemberProfile !== 'undefined' && MemberProfile.data && MemberProfile.data.tier)
              || (JSON.parse(localStorage.getItem('ffp_member') || '{}').tier) || 'member';
      return String(t).toLowerCase();
    } catch (e) { return 'member'; }
  },
  
  rateForWay(way) { return way.rates[this.tier]; },

  // v177 — explain a progression discipline + its Supporter/Ambassador targets
  openSectionInfo(key) {
    var c = (this.categories || []).find(function (x) { return x.key === key; });
    if (!c) return;
    document.getElementById('si-icon').textContent = c.icon;
    document.getElementById('si-title').textContent = c.label;
    document.getElementById('si-blurb').textContent = c.blurb || '';
    var pl = function (n, u) { return (n === 1 && u && u.slice(-1) === 's') ? u.slice(0, -1) : u; };
    document.getElementById('si-sup').textContent = c.supporter;
    document.getElementById('si-amb').textContent = c.ambassador;
    document.getElementById('si-sup-unit').textContent = pl(c.supporter, c.unit || '');
    document.getElementById('si-amb-unit').textContent = pl(c.ambassador, c.unit || '');
    document.getElementById('section-info-modal').style.display = 'flex';
  },
  closeSectionInfo() {
    var m = document.getElementById('section-info-modal'); if (m) m.style.display = 'none';
  },
  
  // ─────────── RENDER ───────────
  render() {
    this.normalizeToUsd();           // v155 — convert injected AED → USD once, if needed
    this.tier = this.computedTier();
    const t = this.tiers[this.tier];

    // Hero balance (USD). v247: balance is canonically USD; show cents when present (e.g. $39.60).
    document.getElementById('earn-balance').textContent = this.fmtUsd(this.balance);
    const payoutBtn = document.getElementById('earn-payout-btn');
    const metaEl = document.getElementById('earn-balance-meta');
    const MIN = this.MIN_PAYOUT_USD;
    // v155 — payout is UAE-only for now; everyone still sees their balance.
    if (!this.isUaeMember()) {
      payoutBtn.disabled = true;
      metaEl.textContent = 'Payouts available in the UAE only for now';
    } else if (this.balance < MIN) {
      payoutBtn.disabled = true;
      metaEl.textContent = `Need $${this.fmtUsd(MIN - this.balance)} more before you can withdraw`;
    } else {
      payoutBtn.disabled = false;
      metaEl.textContent = `Ready to withdraw · minimum $${MIN}`;
    }
    
    // Tier badge
    const card = document.getElementById('tier-badge-card');
    card.classList.remove('member','supporter','ambassador');
    card.classList.add(this.tier);
    document.getElementById('tier-name').textContent = t.name;
    const referWay = this.ways.find(w => w.key === 'refer');
    const referRate = referWay.rates[this.tier];
    document.getElementById('tier-rate').textContent = referRate;
    document.getElementById('tier-icon-mount').innerHTML = `<span class="material-icons">${t.icon}</span>`;
    
    // Refer CTA — recurring tier % (reward = tier% of EVERY payment, credited per Stripe invoice, recurring)
    document.getElementById('earn-refer-rate').textContent = referRate;
    
    // HOW TIERS WORK
    document.getElementById('tier-cards').innerHTML = ['member','supporter','ambassador'].map(k => {
      const td = this.tiers[k];
      const isCurrent = k === this.tier;
      let cls = 'tier-card ' + td.tierClass;
      if (isCurrent) cls += ' current';
      const statusPill = isCurrent
        ? '<div class="tier-card-status you">You</div>'
        : (k === 'ambassador' && this.tier !== 'ambassador') ? '<div class="tier-card-status locked">Locked</div>'
        : '';
      const refRate = this.ways.find(w => w.key === 'refer').rates[k];
      const reqHtml = td.reqHighlight
        ? td.reqLine.replace(td.reqHighlight, `<span class="highlight">${td.reqHighlight}</span>`)
        : td.reqLine;
      return `
        <div class="${cls}">
          <div class="tier-card-head">
            <div class="tier-card-icon"><span class="material-icons">${td.icon}</span></div>
            <div class="tier-card-title">
              <div class="tier-card-name">${escHtml(td.name)}</div>
              <div class="tier-card-rate"><span class="num">${refRate}</span> per referral</div>
            </div>
            ${statusPill}
          </div>
          <div class="tier-card-req">${reqHtml}</div>
          <ul class="tier-card-perks">
            ${td.perks.map(p => `<li><span class="material-icons">check_circle</span>${escHtml(p)}</li>`).join('')}
          </ul>
        </div>
      `;
    }).join('');
    
    // YOUR PROGRESSION — v176: clean triangular gradient straps, threshold numbers only
    document.getElementById('progression-list').innerHTML = this.categories.map(c => {
      const atAmb = c.current >= c.ambassador;
      const atSup = c.current >= c.supporter;
      const max = c.ambassador || 1;
      const fillPct = c.current <= 0 ? 0 : Math.max(7, Math.min(100, (c.current / max) * 100));
      const supPct  = Math.min(100, (c.supporter / max) * 100);
      return `
        <div class="prog-strap ${atAmb ? 'at-amb' : (atSup ? 'at-sup' : '')}">
          <button class="prog-strap-icon" onclick="Earnings.openSectionInfo('${c.key}')" aria-label="${escHtml(c.label)} — how to progress"><span class="material-icons">${c.icon}</span></button>
          <span class="prog-wedge">
            <span class="prog-wedge-bg"></span>
            <span class="prog-wedge-clip"><span class="prog-wedge-fill" style="width:${fillPct}%;"></span></span>
          </span>
        </div>
      `;
    }).join('');
    
    // WAYS TO EARN
    document.getElementById('earn-ways').innerHTML = this.ways.map(w => {
      const myRate = w.rates[this.tier];
      const isOpen = this._openWay === w.key;
      const isSoon = w.status === 'soon';
      const rateDisplay = (typeof myRate === 'number') ? `<span class="num">$${this.aedToUsd(myRate)}</span>` : `<span class="num">${myRate}</span>`;
      const soonPill = isSoon ? '<div class="way-soon-pill">Coming Soon</div>' : '';
      const actionBtn = isSoon
        ? `<button class="way-card-action soon" disabled><span class="material-icons">schedule</span>${escHtml(w.actionLabel)}</button>`
        : `<button class="way-card-action" onclick="Earnings.${w.action}()"><span class="material-icons">arrow_forward</span>${escHtml(w.actionLabel)}</button>`;
      return `
        <div class="way-card ${isOpen ? 'open' : ''} ${isSoon ? 'soon' : ''}" data-way="${w.key}">
          <div class="way-card-head" onclick="Earnings.toggleWay('${w.key}')">
            <div class="way-card-icon"><span class="material-icons">${w.icon}</span></div>
            <div class="way-card-info">
              <div class="way-card-name">${escHtml(w.name)}</div>
              <div class="way-card-rate">${rateDisplay} ${escHtml(w.unit)}</div>
            </div>
            ${soonPill}
            <div class="way-card-chevron"><span class="material-icons">expand_more</span></div>
          </div>
          <div class="way-card-body">
            <div class="way-card-section-label">How it works</div>
            <div class="way-card-how">${escHtml(w.how)}</div>
            <div class="way-card-section-label">Rates by tier</div>
            <div class="way-card-rate-table">
              ${['member','supporter','ambassador'].map(tk => {
                const isMine = tk === this.tier;
                const r = w.rates[tk];
                const disp = (typeof r === 'number') ? `$${this.aedToUsd(r)}` : r;
                return `
                  <div class="way-rate-cell ${isMine ? 'current' : ''}">
                    <div class="way-rate-cell-tier">${this.tiers[tk].name}${isMine ? ' · You' : ''}</div>
                    <div class="way-rate-cell-value">${disp}</div>
                    <div class="way-rate-cell-unit">${escHtml(w.unit)}</div>
                  </div>
                `;
              }).join('')}
            </div>
            ${w.ratesNote ? `<div style="font-size:10px; color:var(--muted); margin-top:8px; font-style:italic;">${escHtml(w.ratesNote)}</div>` : ''}
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
    
    // Maintain section
    document.getElementById('ambassador-maintain-section').style.display = this.tier === 'ambassador' ? '' : 'none';
    
    // Transactions
    const fmtDays = (d) => d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
    document.getElementById('earn-tx-list').innerHTML = this.transactions.map(t => `
      <div class="earn-tx-row">
        <div class="earn-tx-icon ${t.type}">
          <span class="material-icons">${t.type === 'in' ? 'add' : 'remove'}</span>
        </div>
        <div>
          <div class="earn-tx-name">${escHtml(t.source)}</div>
          <div class="earn-tx-meta">${escHtml(t.category)} · ${fmtDays(t.daysAgo)}${t.status ? ' · ' + t.status : ''}</div>
        </div>
        <div class="earn-tx-amount ${t.type} aed">${t.type === 'in' ? '+' : '−'}${t.amount}</div>
      </div>
    `).join('');
  },
  
  toggleWay(key) {
    this._openWay = (this._openWay === key) ? null : key;
    this.render();
  },
  
  // v88 — Show/hide the three "How tiers work" cards
  toggleTierCards() {
    this._tierCardsOpen = !this._tierCardsOpen;
    const cards   = document.getElementById('tier-cards');
    const btn     = document.getElementById('tier-toggle-btn');
    const txt     = document.getElementById('tier-toggle-text');
    cards.style.display = this._tierCardsOpen ? '' : 'none';
    btn.classList.toggle('open', this._tierCardsOpen);
    txt.textContent = this._tierCardsOpen ? 'Show less' : 'Show more';
  },
  
  // ─────────── ACTION HANDLERS ───────────
  // v90 — Only refer is active. Others are "Coming Soon" with disabled buttons.
  // Provider/host/content/challenge handlers removed; will be reinstated when those flows ship.
  
  // ─────────── REFER MODAL ───────────
  openReferModal() {
    document.getElementById('rm-rate').textContent = (this.REFERRAL_PCT[this.tier] || 5) + '%';
    document.getElementById('rm-code').textContent = this.referralCode;
    document.getElementById('rm-link').value = `https://ffppassport.com/join?ref=${this.referralCode}`;
    document.getElementById('rm-total').textContent   = this.referralStats.total;
    document.getElementById('rm-earned').textContent  = this.fmtUsd(this.referralStats.earned);
    document.getElementById('rm-pending').textContent = this.referralStats.pending;
    document.getElementById('refer-modal-backdrop').classList.add('open');
  },
  closeReferModal() { document.getElementById('refer-modal-backdrop').classList.remove('open'); },
  copyReferCode() {
    try { navigator.clipboard.writeText(this.referralCode); showToast('Referral code copied'); }
    catch(e) { showToast('Code: ' + this.referralCode); }
  },
  copyReferLink() {
    const link = `https://ffppassport.com/join?ref=${this.referralCode}`;
    try { navigator.clipboard.writeText(link); showToast('Referral link copied'); }
    catch(e) { showToast('Link copied'); }
  },
  shareVia(channel) {
    const link = `https://ffppassport.com/join?ref=${this.referralCode}`;
    const msg = "Join me on FFP Passport — UAE active lifestyle membership. Use my link: " + link;
    if (channel === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    else if (channel === 'sms') window.open(`sms:?body=${encodeURIComponent(msg)}`, '_blank');
    else if (channel === 'email') window.open(`mailto:?subject=Join%20FFP%20Passport&body=${encodeURIComponent(msg)}`, '_blank');
  },
  
  // ─────────── PAYOUT MODAL ───────────
  openPayout() {
    if (!this.isUaeMember()) { showToast('Payouts are available in the UAE only for now'); return; }
    if (this.balance < this.MIN_PAYOUT_USD) { showToast('Minimum payout is $' + this.MIN_PAYOUT_USD); return; }
    this._payoutAmount = 0;
    document.getElementById('po-available').textContent = this.fmtUsd(this.balance);
    document.getElementById('po-amount').textContent = '0';
    document.getElementById('po-amount-input').value = '';
    document.querySelectorAll('.po-quick').forEach(b => b.classList.remove('active'));
    document.getElementById('payout-modal-backdrop').classList.add('open');
  },
  closePayout() { document.getElementById('payout-modal-backdrop').classList.remove('open'); },
  setPayoutAmount(amt) {
    if (amt > this.balance) amt = this.balance;
    this._payoutAmount = amt;
    document.getElementById('po-amount').textContent = this.fmtUsd(amt);
    document.getElementById('po-amount-input').value = amt;
    document.querySelectorAll('.po-quick').forEach(b => {
      b.classList.toggle('active', parseInt(b.textContent, 10) === amt);
    });
  },
  setPayoutAmountAll() {
    this.setPayoutAmount(this.balance);
    document.querySelectorAll('.po-quick').forEach(b => b.classList.remove('active'));
    document.getElementById('po-all-btn').classList.add('active');
  },
  setPayoutFromInput(value) {
    const n = parseInt(value, 10);
    if (isNaN(n)) { this._payoutAmount = 0; document.getElementById('po-amount').textContent = '0'; return; }
    const amt = Math.min(this.balance, Math.max(0, n));
    this._payoutAmount = amt;
    document.getElementById('po-amount').textContent = this.fmtUsd(amt);
    document.querySelectorAll('.po-quick').forEach(b => b.classList.remove('active'));
  },
  submitPayout() {
    if (!this.isUaeMember()) { showToast('Payouts are available in the UAE only for now'); return; }
    if (this._payoutAmount < this.MIN_PAYOUT_USD) { showToast('Minimum payout is $' + this.MIN_PAYOUT_USD); return; }
    if (this._payoutAmount > this.balance) { showToast('Amount exceeds balance'); return; }
    const method = document.querySelector('input[name="po-method"]:checked').value;
    this.balance -= this._payoutAmount;
    this.transactions.unshift({
      type: 'out',
      amount: this._payoutAmount,
      source: `Payout request — ${method === 'bank' ? 'bank transfer' : 'other'}`,
      daysAgo: 0,
      category: 'Payout',
      status: 'pending review'
    });
    this.closePayout();
    this.render();
    showToast(`Payout request submitted — $${this._payoutAmount.toLocaleString()}`);
    // PRODUCTION: POST /api/members/me/payouts { amount, method }
  }
};

function closeReferModalIfBackdrop(e) { if (e.target.id === 'refer-modal-backdrop') Earnings.closeReferModal(); }
function closePayoutModalIfBackdrop(e) { if (e.target.id === 'payout-modal-backdrop') Earnings.closePayout(); }

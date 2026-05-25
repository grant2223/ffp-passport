/**
 * FFP Passport — My Earnings
 * User menu section: Referral rewards, Ambassador earnings, payouts
 */

const MyEarnings = {
  state: {
    totalEarned: 2847.50,
    available: 892.30,
    pending: 450.00,
    referrals: {
      count: 12,
      active: 8,
      commissionPerReferral: 75
    },
    recentTransactions: [
      { type: 'referral', amount: 75, date: '2026-05-20', status: 'completed', note: 'Referral: Ali M.' },
      { type: 'ambassador', amount: 200, date: '2026-05-18', status: 'completed', note: 'Monthly bonus' },
      { type: 'referral', amount: 75, date: '2026-05-15', status: 'pending', note: 'Referral: Sarah K.' },
      { type: 'challenge', amount: 100, date: '2026-05-10', status: 'completed', note: 'Challenge reward' }
    ]
  },

  init() {
    this.render();
    this.attachEvents();
  },

  render() {
    const container = document.getElementById('menu-content');
    if (!container) return;

    const html = `
      <div class="earnings-menu">
        <div class="earnings-header">
          <h3>My Earnings</h3>
          <p class="earnings-sub">Referrals & rewards</p>
        </div>

        <div class="earnings-cards">
          <div class="earn-card">
            <div class="ec-label">Available</div>
            <div class="ec-amount">AED ${this.state.available.toFixed(2)}</div>
            <button class="btn btn-sm btn-amber" style="width: 100%; margin-top: 10px;" onclick="MyEarnings.requestPayout()">
              Request Payout
            </button>
          </div>

          <div class="earn-card">
            <div class="ec-label">Pending</div>
            <div class="ec-amount">AED ${this.state.pending.toFixed(2)}</div>
            <div class="ec-sub">Pending (7-14 days)</div>
          </div>

          <div class="earn-card">
            <div class="ec-label">Total Earned</div>
            <div class="ec-amount">AED ${this.state.totalEarned.toFixed(2)}</div>
            <div class="ec-sub">All time</div>
          </div>
        </div>

        <div class="referral-stats">
          <div class="rs-item">
            <span class="rs-label">Referrals</span>
            <div>
              <span class="rs-big">${this.state.referrals.count}</span>
              <span class="rs-small">${this.state.referrals.active} active</span>
            </div>
          </div>
          <div class="rs-item">
            <span class="rs-label">Earning</span>
            <div>
              <span class="rs-big">AED ${this.state.referrals.commissionPerReferral}</span>
              <span class="rs-small">per signup</span>
            </div>
          </div>
        </div>

        <h4 style="font-size: 11px; font-weight: 800; margin: 14px 0 10px; color: var(--muted-lt);">Recent Activity</h4>
        <div class="earnings-activity">
          ${this.state.recentTransactions.map(t => `
            <div class="activity-item">
              <div class="ai-icon">${this.getIcon(t.type)}</div>
              <div class="ai-info">
                <div class="ai-title">${t.note}</div>
                <div class="ai-date">${t.date}</div>
              </div>
              <div class="ai-amount">
                <div>+AED ${t.amount}</div>
                <div class="ai-status ${t.status}">${t.status === 'completed' ? '✓' : '⏳'}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <button class="btn btn-blue" style="width: 100%; margin-top: 12px;" onclick="MyEarnings.shareReferral()">
          Share Referral Link
        </button>
      </div>
    `;

    container.innerHTML = html;
  },

  getIcon(type) {
    const icons = {
      referral: '👤',
      ambassador: '⭐',
      challenge: '🏆',
      bonus: '🎁'
    };
    return icons[type] || '💰';
  },

  requestPayout() {
    alert('Payout request - coming soon');
  },

  shareReferral() {
    const link = `https://ffppassport.com/ref/user123`;
    alert(`Share this link: ${link}`);
  },

  attachEvents() {
    // Event delegation
  }
};

const earningsStyles = `
.earnings-menu {
  padding: 16px;
}

.earnings-header {
  margin-bottom: 16px;
}

.earnings-header h3 {
  font-size: 15px;
  font-weight: 900;
  margin-bottom: 4px;
}

.earnings-sub {
  font-size: 10px;
  color: var(--muted);
}

.earnings-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

.earn-card {
  background: linear-gradient(135deg, rgba(25, 128, 173, 0.15), rgba(25, 128, 173, 0.08));
  border: 1px solid rgba(25, 128, 173, 0.2);
  border-radius: 10px;
  padding: 12px;
}

.ec-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.ec-amount {
  font-size: 18px;
  font-weight: 900;
  color: var(--blue-lt);
  margin-bottom: 4px;
}

.ec-sub {
  font-size: 9px;
  color: var(--muted);
  font-weight: 600;
}

.referral-stats {
  background: rgba(25, 128, 173, 0.08);
  border: 1px solid rgba(25, 128, 173, 0.15);
  border-radius: 10px;
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.rs-item {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.rs-label {
  font-size: 8px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.rs-big {
  display: block;
  font-size: 16px;
  font-weight: 900;
  color: var(--blue-lt);
}

.rs-small {
  display: block;
  font-size: 9px;
  color: var(--muted);
  margin-top: 2px;
}

.earnings-activity {
  margin-bottom: 12px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(25, 128, 173, 0.08);
}

.activity-item:last-child {
  border-bottom: none;
}

.ai-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.ai-info {
  flex: 1;
}

.ai-title {
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 2px;
}

.ai-date {
  font-size: 9px;
  color: var(--muted);
}

.ai-amount {
  text-align: right;
  flex-shrink: 0;
}

.ai-amount div:first-child {
  font-size: 12px;
  font-weight: 800;
  color: var(--green);
  margin-bottom: 3px;
}

.ai-status {
  font-size: 10px;
  font-weight: 700;
  color: var(--muted);
}

.ai-status.completed {
  color: var(--green);
}
`;

if (!document.querySelector('style[data-earnings]')) {
  const style = document.createElement('style');
  style.setAttribute('data-earnings', 'true');
  style.textContent = earningsStyles;
  document.head.appendChild(style);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MyEarnings.init());
} else {
  MyEarnings.init();
}

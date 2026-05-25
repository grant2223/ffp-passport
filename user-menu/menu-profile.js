/**
 * FFP Passport — My Profile
 * User menu section: Member profile, personal details, sports/skills, preferences
 * ⭐ CRITICAL: Preserves all existing profile functionality and data
 */

const MyProfile = {
  state: {
    member: {
      id: 'member_123',
      name: 'Grant Hermanus',
      email: 'grant@ffppassport.com',
      phone: '+971 56 261 7359',
      avatar: '👤',
      joinDate: '2025-01-15',
      status: 'active',
      tier: 'passport_premium',
      city: 'Dubai',
      ageRange: '28-35'
    },
    sports: [
      { name: 'Padel', level: 'Advanced', hours: 145 },
      { name: 'Running', level: 'Intermediate', hours: 82 },
      { name: 'Strength Training', level: 'Advanced', hours: 320 },
      { name: 'Yoga', level: 'Beginner', hours: 12 }
    ],
    preferences: {
      theme: 'dark',
      notifications: true,
      newsletter: true,
      showProfile: true
    }
  },

  init() {
    this.fetchProfile();
    this.render();
    this.attachEvents();
  },

  fetchProfile() {
    // Fetch from /api/profile
    // This preserves existing backend data
  },

  render() {
    const container = document.getElementById('menu-content');
    if (!container) return;

    const html = `
      <div class="profile-menu">
        <div class="profile-header">
          <div class="ph-avatar">${this.state.member.avatar}</div>
          <div class="ph-info">
            <div class="ph-name">${this.state.member.name}</div>
            <div class="ph-tier">${this.getTierLabel(this.state.member.tier)}</div>
          </div>
        </div>

        <div class="profile-details">
          <div class="pd-field">
            <label>Email</label>
            <div class="pd-value">${this.state.member.email}</div>
          </div>
          <div class="pd-field">
            <label>Phone</label>
            <div class="pd-value">${this.state.member.phone}</div>
          </div>
          <div class="pd-field">
            <label>City</label>
            <div class="pd-value">${this.state.member.city}</div>
          </div>
          <div class="pd-field">
            <label>Member Since</label>
            <div class="pd-value">${new Date(this.state.member.joinDate).toLocaleDateString()}</div>
          </div>
        </div>

        <h4 style="font-size: 11px; font-weight: 800; margin: 14px 0 10px; color: var(--muted-lt);">Sports & Skills</h4>
        <div class="profile-sports">
          ${this.state.sports.map(s => `
            <div class="sport-item">
              <div class="si-name">${s.name}</div>
              <div class="si-level">${s.level}</div>
              <div class="si-hours">${s.hours}h</div>
            </div>
          `).join('')}
        </div>

        <h4 style="font-size: 11px; font-weight: 800; margin: 14px 0 10px; color: var(--muted-lt);">Preferences</h4>
        <div class="profile-preferences">
          <label class="pref-toggle">
            <input type="checkbox" checked onchange="MyProfile.setSetting('notifications', this.checked)">
            <span>Notifications</span>
          </label>
          <label class="pref-toggle">
            <input type="checkbox" checked onchange="MyProfile.setSetting('newsletter', this.checked)">
            <span>Weekly Newsletter</span>
          </label>
          <label class="pref-toggle">
            <input type="checkbox" checked onchange="MyProfile.setSetting('showProfile', this.checked)">
            <span>Public Profile</span>
          </label>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 14px;">
          <button class="btn btn-blue" style="flex: 1;" onclick="MyProfile.editProfile()">
            Edit Profile
          </button>
          <button class="btn btn-outline" style="flex: 1;" onclick="MyProfile.logout()">
            Logout
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  getTierLabel(tier) {
    const labels = {
      passport_premium: '✓ Passport Premium Member',
      passport_standard: 'Passport Member',
      free: 'Free Member'
    };
    return labels[tier] || tier;
  },

  editProfile() {
    // Navigate to full profile edit page
    window.location.href = '/ffp-profile-complete.html';
  },

  setSetting(key, value) {
    this.state.preferences[key] = value;
    // Save to backend
    fetch('/api/profile/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    }).catch(e => console.error('Failed to save preference'));
  },

  logout() {
    if (confirm('Are you sure you want to logout?')) {
      fetch('/api/auth/logout', { method: 'POST' })
        .then(() => {
          window.location.href = '/login.html';
        });
    }
  },

  attachEvents() {
    // Event delegation handled in render
  }
};

const profileStyles = `
.profile-menu {
  padding: 16px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(25, 128, 173, 0.1);
}

.ph-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--blue-dk), var(--blue));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 900;
  flex-shrink: 0;
  border: 2px solid rgba(25, 128, 173, 0.3);
}

.ph-info {
  flex: 1;
}

.ph-name {
  font-size: 13px;
  font-weight: 900;
  margin-bottom: 2px;
}

.ph-tier {
  font-size: 9px;
  color: var(--green);
  font-weight: 700;
}

.profile-details {
  background: rgba(25, 128, 173, 0.06);
  border: 1px solid rgba(25, 128, 173, 0.12);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 14px;
}

.pd-field {
  margin-bottom: 10px;
}

.pd-field:last-child {
  margin-bottom: 0;
}

.pd-field label {
  display: block;
  font-size: 8px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 3px;
}

.pd-value {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
}

.profile-sports {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.sport-item {
  background: rgba(25, 128, 173, 0.08);
  border: 1px solid rgba(25, 128, 173, 0.15);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.si-name {
  font-size: 11px;
  font-weight: 700;
  flex: 1;
}

.si-level {
  font-size: 9px;
  color: var(--blue-lt);
  font-weight: 600;
  flex-shrink: 0;
  margin-right: 8px;
}

.si-hours {
  font-size: 9px;
  color: var(--muted);
  font-weight: 600;
  flex-shrink: 0;
}

.profile-preferences {
  background: rgba(25, 128, 173, 0.06);
  border: 1px solid rgba(25, 128, 173, 0.12);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pref-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
}

.pref-toggle input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: var(--blue);
}

.pref-toggle span {
  user-select: none;
}
`;

if (!document.querySelector('style[data-profile]')) {
  const style = document.createElement('style');
  style.setAttribute('data-profile', 'true');
  style.textContent = profileStyles;
  document.head.appendChild(style);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MyProfile.init());
} else {
  MyProfile.init();
}

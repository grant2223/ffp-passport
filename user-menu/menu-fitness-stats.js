/**
 * FFP Passport — Fitness Stats ⭐ IMPORTANT
 * User menu section: Detailed fitness & health metrics
 * Tracks: BMI, VO2 Max, Resting HR, Body Fat %, Muscle Mass, etc.
 */

const FitnessStats = {
  state: {
    stats: {
      age: 28,
      weight: 75,
      height: 180,
      bmi: 23.1,
      vo2max: 48,
      restingHR: 62,
      bodyFat: 16.5,
      muscleMass: 68,
      waterPercentage: 58
    },
    goals: {
      weight: 72,
      vo2max: 52,
      bodyFat: 14
    }
  },

  init() {
    this.calculateStats();
    this.render();
    this.attachEvents();
  },

  calculateStats() {
    // Calculate BMI
    const heightM = this.state.stats.height / 100;
    this.state.stats.bmi = (this.state.stats.weight / (heightM * heightM)).toFixed(1);
  },

  render() {
    const container = document.getElementById('menu-content');
    if (!container) return;

    const html = `
      <div class="fitness-stats-menu">
        <div class="fs-header">
          <h3>Fitness Stats</h3>
          <p class="fs-sub">Your health metrics</p>
        </div>

        <div class="fs-grid">
          ${this.renderStat('Weight', `${this.state.stats.weight} kg`, this.state.goals.weight ? `Goal: ${this.state.goals.weight} kg` : '')}
          ${this.renderStat('BMI', this.state.stats.bmi, this.getBMIStatus(this.state.stats.bmi))}
          ${this.renderStat('VO₂ Max', `${this.state.stats.vo2max} ml/kg/min`, `Goal: ${this.state.goals.vo2max}`)}
          ${this.renderStat('Resting HR', `${this.state.stats.restingHR} bpm', 'Heart rate at rest')}
          ${this.renderStat('Body Fat', `${this.state.stats.bodyFat}%`, `Goal: ${this.state.goals.bodyFat}%`)}
          ${this.renderStat('Muscle Mass', `${this.state.stats.muscleMass} kg`, 'Lean muscle')}
        </div>

        <div class="fs-water">
          <div class="fs-water-label">Water Level</div>
          <div class="fs-water-bar">
            <div class="fs-water-fill" style="width: ${this.state.stats.waterPercentage}%"></div>
          </div>
          <div class="fs-water-pct">${this.state.stats.waterPercentage}%</div>
        </div>

        <button class="btn btn-blue" style="width: 100%; margin-top: 14px;" onclick="FitnessStats.editStats()">
          Update Measurements
        </button>
      </div>
    `;

    container.innerHTML = html;
  },

  renderStat(label, value, subtitle) {
    return `
      <div class="fs-stat-card">
        <div class="fsc-label">${label}</div>
        <div class="fsc-value">${value}</div>
        ${subtitle ? `<div class="fsc-sub">${subtitle}</div>` : ''}
      </div>
    `;
  },

  getBMIStatus(bmi) {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Healthy';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  },

  editStats() {
    alert('Edit stats modal - coming soon');
  },

  attachEvents() {
    // Event delegation
  }
};

const fitnessStatsStyles = `
.fitness-stats-menu {
  padding: 16px;
}

.fs-header {
  margin-bottom: 16px;
}

.fs-header h3 {
  font-size: 15px;
  font-weight: 900;
  margin-bottom: 4px;
}

.fs-sub {
  font-size: 10px;
  color: var(--muted);
}

.fs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

.fs-stat-card {
  background: rgba(25, 128, 173, 0.08);
  border: 1px solid rgba(25, 128, 173, 0.15);
  border-radius: 10px;
  padding: 12px;
}

.fsc-label {
  font-size: 8px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.fsc-value {
  font-size: 16px;
  font-weight: 900;
  color: var(--blue-lt);
  margin-bottom: 3px;
}

.fsc-sub {
  font-size: 9px;
  color: var(--muted-lt);
  font-weight: 600;
}

.fs-water {
  background: rgba(25, 128, 173, 0.08);
  border: 1px solid rgba(25, 128, 173, 0.15);
  border-radius: 10px;
  padding: 12px;
}

.fs-water-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.fs-water-bar {
  height: 6px;
  background: rgba(25, 128, 173, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.fs-water-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--blue), var(--blue-lt));
  border-radius: 3px;
}

.fs-water-pct {
  font-size: 11px;
  font-weight: 800;
  color: var(--blue-lt);
  text-align: right;
}
`;

if (!document.querySelector('style[data-fitness]')) {
  const style = document.createElement('style');
  style.setAttribute('data-fitness', 'true');
  style.textContent = fitnessStatsStyles;
  document.head.appendChild(style);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => FitnessStats.init());
} else {
  FitnessStats.init();
}

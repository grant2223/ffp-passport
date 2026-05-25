/**
 * FFP Passport — Calorie Tracker
 * User menu section: Log meals and track daily calories
 */

const CalorieTracker = {
  state: {
    dailyGoal: 2000,
    consumed: 0,
    meals: [],
    date: new Date().toISOString().split('T')[0]
  },

  init() {
    this.fetchTodaysMeals();
    this.render();
    this.attachEvents();
  },

  fetchTodaysMeals() {
    // Placeholder - fetch from backend
    this.state.consumed = 1450;
    this.state.meals = [
      { name: 'Breakfast Oatmeal', calories: 380, time: '08:00' },
      { name: 'Protein Shake', calories: 250, time: '11:30' },
      { name: 'Chicken & Rice', calories: 520, time: '13:00' },
      { name: 'Apple Snack', calories: 300, time: '16:00' }
    ];
  },

  render() {
    const container = document.getElementById('menu-content');
    if (!container) return;

    const remaining = Math.max(0, this.state.dailyGoal - this.state.consumed);
    const percent = Math.min(100, (this.state.consumed / this.state.dailyGoal) * 100);

    const html = `
      <div class="calorie-menu">
        <div class="calorie-header">
          <h3>Calorie Tracker</h3>
          <p class="calorie-sub">Today's intake</p>
        </div>

        <div class="calorie-circle">
          <svg viewBox="0 0 120 120" style="width: 120px; height: 120px;">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(25, 128, 173, 0.1)" stroke-width="8"/>
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--blue-lt)" stroke-width="8" 
                    stroke-dasharray="${percent * 3.39} 339" stroke-linecap="round" 
                    style="transform: rotate(-90deg); transform-origin: 60px 60px;"/>
            <text x="60" y="55" text-anchor="middle" font-size="24" font-weight="900" fill="#fff">${this.state.consumed}</text>
            <text x="60" y="72" text-anchor="middle" font-size="10" fill="var(--muted)">/ ${this.state.dailyGoal}</text>
          </svg>
        </div>

        <div class="calorie-stats">
          <div class="cs-item">
            <span class="cs-label">Consumed</span>
            <span class="cs-val">${this.state.consumed} kcal</span>
          </div>
          <div class="cs-item">
            <span class="cs-label">Remaining</span>
            <span class="cs-val">${remaining} kcal</span>
          </div>
        </div>

        <div class="calorie-meals">
          <h4 style="font-size: 11px; font-weight: 800; margin-bottom: 10px;">Today's Meals</h4>
          ${this.state.meals.map(m => `
            <div class="meal-item">
              <div class="meal-info">
                <div class="meal-name">${m.name}</div>
                <div class="meal-time">${m.time}</div>
              </div>
              <div class="meal-cals">${m.calories} cal</div>
            </div>
          `).join('')}
        </div>

        <button class="btn btn-blue" style="width: 100%; margin-top: 12px;" onclick="CalorieTracker.showAddMeal()">
          + Add Meal
        </button>
      </div>
    `;

    container.innerHTML = html;
  },

  showAddMeal() {
    // Show modal or inline form
    alert('Add meal feature - coming soon');
  },

  attachEvents() {
    // Event delegation handled in render
  }
};

const calorieStyles = `
.calorie-menu {
  padding: 16px;
}

.calorie-header {
  margin-bottom: 16px;
}

.calorie-header h3 {
  font-size: 15px;
  font-weight: 900;
  margin-bottom: 4px;
}

.calorie-sub {
  font-size: 10px;
  color: var(--muted);
}

.calorie-circle {
  display: flex;
  justify-content: center;
  margin: 16px 0;
}

.calorie-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

.cs-item {
  background: rgba(25, 128, 173, 0.08);
  border: 1px solid rgba(25, 128, 173, 0.15);
  border-radius: 10px;
  padding: 12px;
  text-align: center;
}

.cs-label {
  display: block;
  font-size: 9px;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.cs-val {
  display: block;
  font-size: 14px;
  font-weight: 900;
  color: var(--blue-lt);
}

.calorie-meals {
  margin-bottom: 12px;
}

.meal-item {
  background: rgba(25, 128, 173, 0.06);
  border: 1px solid rgba(25, 128, 173, 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.meal-info {
  flex: 1;
}

.meal-name {
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 2px;
}

.meal-time {
  font-size: 9px;
  color: var(--muted);
}

.meal-cals {
  font-size: 12px;
  font-weight: 800;
  color: var(--blue-lt);
  text-align: right;
  flex-shrink: 0;
}
`;

if (!document.querySelector('style[data-calorie]')) {
  const style = document.createElement('style');
  style.setAttribute('data-calorie', 'true');
  style.textContent = calorieStyles;
  document.head.appendChild(style);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CalorieTracker.init());
} else {
  CalorieTracker.init();
}

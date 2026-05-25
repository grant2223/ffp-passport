/**
 * FFP Passport — Workout Timer
 * User menu section: Quick workout timer + tracking
 * Loaded dynamically from avatar dropdown
 */

const WorkoutTimer = {
  state: {
    isRunning: false,
    seconds: 0,
    totalSeconds: 0,
    workoutType: 'cardio',
    workoutName: ''
  },

  init() {
    this.render();
    this.attachEvents();
  },

  render() {
    const container = document.getElementById('menu-content');
    if (!container) return;

    const timerDisplay = this.formatTime(this.state.seconds);
    const html = `
      <div class="timer-menu">
        <div class="timer-header">
          <h3>Workout Timer</h3>
          <p class="timer-sub">Quick session tracking</p>
        </div>

        <div class="timer-display">
          <div class="time-big">${timerDisplay}</div>
        </div>

        <div class="timer-controls">
          <button class="btn btn-blue timer-btn-start" onclick="WorkoutTimer.start()">
            Start
          </button>
          <button class="btn btn-outline timer-btn-pause" onclick="WorkoutTimer.pause()" style="display:none;">
            Pause
          </button>
          <button class="btn btn-outline timer-btn-stop" onclick="WorkoutTimer.reset()">
            Reset
          </button>
        </div>

        <div class="timer-type">
          <label>Workout Type</label>
          <select class="cm-select" onchange="WorkoutTimer.setType(this.value)">
            <option value="cardio">Cardio</option>
            <option value="strength">Strength</option>
            <option value="yoga">Yoga</option>
            <option value="hiit">HIIT</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="timer-name">
          <label>Session Name (optional)</label>
          <input type="text" class="cm-input" placeholder="e.g., Morning Run" onchange="WorkoutTimer.setName(this.value)">
        </div>

        <button class="btn btn-amber" style="width:100%; margin-top:12px;" onclick="WorkoutTimer.logWorkout()">
          Log Workout
        </button>
      </div>
    `;

    container.innerHTML = html;
  },

  start() {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    
    document.querySelector('.timer-btn-start').style.display = 'none';
    document.querySelector('.timer-btn-pause').style.display = 'inline-flex';

    this.interval = setInterval(() => {
      this.state.seconds++;
      this.state.totalSeconds++;
      this.updateDisplay();
    }, 1000);
  },

  pause() {
    this.state.isRunning = false;
    clearInterval(this.interval);
    
    document.querySelector('.timer-btn-start').style.display = 'inline-flex';
    document.querySelector('.timer-btn-pause').style.display = 'none';
  },

  reset() {
    this.pause();
    this.state.seconds = 0;
    this.state.totalSeconds = 0;
    this.updateDisplay();
  },

  updateDisplay() {
    const display = document.querySelector('.time-big');
    if (display) {
      display.textContent = this.formatTime(this.state.seconds);
    }
  },

  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  setType(type) {
    this.state.workoutType = type;
  },

  setName(name) {
    this.state.workoutName = name;
  },

  logWorkout() {
    if (this.state.totalSeconds === 0) {
      alert('Start the timer before logging');
      return;
    }

    const data = {
      type: this.state.workoutType,
      name: this.state.workoutName || this.state.workoutType,
      duration: this.state.totalSeconds,
      date: new Date().toISOString()
    };

    // Send to backend
    fetch('/api/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(r => r.json())
    .then(res => {
      showToast('✓ Workout logged');
      this.reset();
    })
    .catch(e => showToast('Error logging workout'));
  }
};

// CSS
const timerStyles = `
.timer-menu {
  padding: 16px;
}

.timer-header {
  margin-bottom: 16px;
}

.timer-header h3 {
  font-size: 15px;
  font-weight: 900;
  margin-bottom: 4px;
}

.timer-sub {
  font-size: 10px;
  color: var(--muted);
}

.timer-display {
  background: rgba(25, 128, 173, 0.1);
  border: 1px solid rgba(25, 128, 173, 0.2);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  margin-bottom: 16px;
}

.time-big {
  font-size: 42px;
  font-weight: 900;
  color: var(--blue-lt);
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
}

.timer-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.timer-btn-start,
.timer-btn-pause,
.timer-btn-stop {
  flex: 1;
}

.timer-type,
.timer-name {
  margin-bottom: 12px;
}

.timer-type label,
.timer-name label {
  display: block;
  font-size: 9px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.cm-select,
.cm-input {
  width: 100%;
  background: rgba(25, 128, 173, 0.06);
  border: 1px solid rgba(25, 128, 173, 0.18);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  font-family: 'Montserrat', sans-serif;
}

.cm-select:focus,
.cm-input:focus {
  outline: none;
  border-color: var(--blue);
}
`;

// Inject styles
if (!document.querySelector('style[data-timer]')) {
  const style = document.createElement('style');
  style.setAttribute('data-timer', 'true');
  style.textContent = timerStyles;
  document.head.appendChild(style);
}

// Initialize when loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => WorkoutTimer.init());
} else {
  WorkoutTimer.init();
}

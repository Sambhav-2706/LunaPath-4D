
import "./style.css";

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="dashboard">

    <!-- SIDEBAR -->
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">◉</div>
        <div>
          <h1>LUNAPATH<span>-4D</span></h1>
          <p>ROVER AUTONOMY SYSTEM</p>
        </div>
      </div>

      <div class="nav-label">MISSION CONTROL</div>

      <nav>
        <a class="nav-item active" href="#">
          <span>◫</span> Overview
        </a>
        <a class="nav-item" href="#">
          <span>⌖</span> Navigation
        </a>
        <a class="nav-item" href="#">
          <span>◈</span> Terrain Analysis
        </a>
        <a class="nav-item" href="#">
          <span>◷</span> Mission Timeline
        </a>
      </nav>

      <div class="sidebar-bottom">
        <div class="connection">
          <span class="pulse-dot"></span>
          SIMULATION SYSTEM ONLINE
        </div>
        <p class="version">LUNAPATH BUILD 0.1.0</p>
      </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="main-content">

      <header class="topbar">
        <div>
          <p class="eyebrow">LUNAR SURFACE OPERATIONS / SOUTH POLE</p>
          <h2>Mission Control</h2>
        </div>

        <div class="mission-badge">
          <span class="pulse-dot"></span>
          SIMULATION MODE
        </div>
      </header>

      <!-- MISSION INFORMATION -->
      <section class="mission-strip">
        <div class="mission-info">
          <span class="info-label">MISSION</span>
          <strong>LUNAR EXPLORATION - LP04</strong>
        </div>

        <div class="mission-info">
          <span class="info-label">LANDING SITE</span>
          <strong>LUNAR SOUTH POLE</strong>
        </div>

        <div class="mission-info">
          <span class="info-label">MISSION SOL</span>
          <strong>001</strong>
        </div>

        <div class="mission-info">
          <span class="info-label">ROVER ID</span>
          <strong>LP-R01</strong>
        </div>
      </section>

      <!-- TELEMETRY -->
      <section class="telemetry-grid">

        <article class="metric-card">
          <div class="metric-top">
            <span>BATTERY</span>
            <span class="metric-icon green">ϟ</span>
          </div>
          <div class="metric-value" id="battery-value">
            98<span>%</span>
          </div>
          <div class="metric-bar">
            <div class="bar-fill green-fill" style="width:98%"></div>
          </div>
          <p class="metric-footer">POWER SYSTEM NOMINAL</p>
        </article>

        <article class="metric-card">
          <div class="metric-top">
            <span>ROVER HEALTH</span>
            <span class="metric-icon blue">✚</span>
          </div>
          <div class="metric-value" id="health-value">
            100<span>%</span>
          </div>
          <div class="metric-bar">
            <div class="bar-fill blue-fill" style="width:100%"></div>
          </div>
          <p class="metric-footer">STRUCTURAL INTEGRITY</p>
        </article>

        <article class="metric-card">
          <div class="metric-top">
            <span>DISTANCE TRAVELLED</span>
            <span class="metric-icon purple">⌖</span>
          </div>
          <div class="metric-value" id="distance-value">
            0.00<span> km</span>
          </div>
          <div class="metric-extra">MISSION DISTANCE</div>
          <p class="metric-footer">TOTAL ROVER MOVEMENT</p>
        </article>

        <article class="metric-card">
          <div class="metric-top">
            <span>ROVER STATUS</span>
            <span class="metric-icon orange">◈</span>
          </div>
          <div class="metric-value status-value" id="rover-status">
            READY
          </div>
          <div class="status-indicator">
            <span class="pulse-dot"></span>
            Awaiting deployment
          </div>
          <p class="metric-footer">AUTONOMY SYSTEM</p>
        </article>

      </section>

      <!-- SIMULATION AREA -->
      <section class="simulation-section">

        <div class="section-heading">
          <div>
            <p class="eyebrow">SURFACE OPERATIONS</p>
            <h3>Terrain Visualization</h3>
          </div>

          <div class="view-badge">2D PREVIEW</div>
        </div>

        <div class="terrain-preview">
          <div class="terrain-grid"></div>

          <div class="terrain-content">
            <div class="moon-symbol">◕</div>
            <h3>LUNAR SURFACE</h3>
            <p>Terrain simulation awaiting initialization</p>

            <div class="coordinates">
              <span>LAT <strong>89.00° S</strong></span>
              <span>LON <strong>0.00° E</strong></span>
            </div>
          </div>

          <div class="terrain-corner top-left">LP / TERRAIN SYS</div>
          <div class="terrain-corner top-right">GRID 256 × 256</div>
          <div class="terrain-corner bottom-left">ELEVATION DATA: PENDING</div>
          <div class="terrain-corner bottom-right">SIMULATION: OFF</div>
        </div>

        <div class="simulation-controls">
          <button id="deploy-btn" class="deploy-button">
            <span>▶</span> DEPLOY ROVER
          </button>

          <button id="reset-btn" class="reset-button">
            ↻ RESET
          </button>
        </div>

      </section>

      <!-- COMMAND CENTER -->
      <section class="lower-grid">

        <article class="panel">
          <div class="panel-heading">
            <h3>Mission Command</h3>
            <span class="panel-tag">COMMAND INPUT</span>
          </div>

          <div class="command-box">
            <span class="command-prefix">&gt;</span>
            <input
              type="text"
              id="command-input"
              placeholder="Enter rover command..."
              disabled
            />
          </div>

          <p class="command-hint">
            Command interface will be activated in a later module.
          </p>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <h3>System Log</h3>
            <span class="panel-tag">LIVE FEED</span>
          </div>

          <div class="log-container" id="system-log">
            <div class="log-entry">
              <span class="log-time">18:00:00</span>
              <span class="log-message">Mission control initialized.</span>
            </div>
            <div class="log-entry">
              <span class="log-time">18:00:01</span>
              <span class="log-message">Telemetry systems ready.</span>
            </div>
            <div class="log-entry">
              <span class="log-time">18:00:02</span>
              <span class="log-message success-text">All systems nominal.</span>
            </div>
          </div>
        </article>

      </section>

      <footer class="footer">
        <span>LUNAPATH-4D AUTONOMOUS ROVER SIMULATOR</span>
        <span>DEVELOPMENT BUILD · 2026</span>
      </footer>

    </main>
  </div>
`;

// -------------------------------------
// MISSION CONTROL INTERACTION
// -------------------------------------

const deployButton = document.querySelector("#deploy-btn");
const resetButton = document.querySelector("#reset-btn");
const roverStatus = document.querySelector("#rover-status");
const commandInput = document.querySelector("#command-input");
const systemLog = document.querySelector("#system-log");

let isDeployed = false;

function getMissionTime() {
  return new Date().toLocaleTimeString("en-GB", {
    hour12: false
  });
}

function addLog(message, type = "") {
  const entry = document.createElement("div");
  entry.className = "log-entry";

  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = getMissionTime();

  const text = document.createElement("span");
  text.className = `log-message ${type}`;
  text.textContent = message;

  entry.append(time, text);
  systemLog.prepend(entry);
}

deployButton.addEventListener("click", () => {
  if (isDeployed) return;

  isDeployed = true;

  roverStatus.textContent = "DEPLOYED";
  roverStatus.classList.add("deployed");

  deployButton.innerHTML = "<span>✓</span> ROVER DEPLOYED";
  deployButton.classList.add("button-disabled");

  commandInput.disabled = false;
  commandInput.placeholder = "Rover deployed — command system coming soon";

  addLog("Deployment sequence initiated.", "success-text");
  addLog("Rover LP-R01 is now active.", "success-text");
});

resetButton.addEventListener("click", () => {
  isDeployed = false;

  roverStatus.textContent = "READY";
  roverStatus.classList.remove("deployed");

  deployButton.innerHTML = "<span>▶</span> DEPLOY ROVER";
  deployButton.classList.remove("button-disabled");

  commandInput.disabled = true;
  commandInput.value = "";
  commandInput.placeholder = "Enter rover command...";

  addLog("Rover reset to standby.", "warning-text");
});

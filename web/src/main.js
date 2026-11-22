/**
 * LunaPath-4D
 * main.js
 *
 * Integrated Full-Stack Entry Point
 * Wires Member 1 Terrain Engine, Member 2 3D Three.js Simulation,
 * Member 3 Autonomous Navigation, and Member 4 Mission Control Dashboard.
 */

import "./style.css";
import { SimulationEngine } from "./SimulationEngine.js";
import { TelemetryPanel } from "./TelemetryPanel.js";
import { MissionControls } from "./MissionControls.js";
import { Minimap } from "./Minimap.js";

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
        <a class="nav-item active" href="#overview">
          <span>◫</span> Overview
        </a>
        <a class="nav-item" href="#viewport">
          <span>⌖</span> 3D Simulation
        </a>
        <a class="nav-item" href="#planner">
          <span>◈</span> Route Planner
        </a>
        <a class="nav-item" href="#diagnostics">
          <span>✚</span> Diagnostics
        </a>
        <a class="nav-item" href="#logs">
          <span>◷</span> Mission Feed
        </a>
      </nav>

      <div class="sidebar-bottom">
        <div class="connection">
          <span class="pulse-dot"></span>
          SIMULATION SYSTEM ONLINE
        </div>
        <p class="version">LUNAPATH BUILD 0.2.0 · INTEGRATED</p>
      </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="main-content">

      <!-- TOPBAR -->
      <header class="topbar">
        <div>
          <p class="eyebrow">LUNAR SURFACE OPERATIONS / SOUTH POLE (-89.0° S, 0.0° E)</p>
          <h2>Mission Control Center</h2>
        </div>

        <div class="topbar-actions">
          <div class="mission-badge">
            <span class="pulse-dot"></span>
            AUTONOMOUS SIMULATION ACTIVE
          </div>
          <button id="export-report-btn" class="export-button" title="Export full mission telemetry report">
            ⬇ EXPORT REPORT
          </button>
        </div>
      </header>

      <!-- MISSION STRIP -->
      <section class="mission-strip">
        <div class="mission-info">
          <span class="info-label">MISSION</span>
          <strong>LP04 POLAR EXPEDITION</strong>
        </div>

        <div class="mission-info">
          <span class="info-label">LANDING SITE</span>
          <strong>LUNAR SOUTH POLE</strong>
        </div>

        <div class="mission-info">
          <span class="info-label">MISSION SOL</span>
          <strong>001 · DAYTIME OPS</strong>
        </div>

        <div class="mission-info benchmark-info">
          <span class="info-label">DUAL-ROVER BENCHMARK</span>
          <div class="benchmark-chip-row">
            <span class="rover-chip chip-main" title="Autonomous Terrain-Aware Rover">LP-R01 4D: 0 HITS</span>
            <span class="vs-label">VS</span>
            <span class="rover-chip chip-ghost" id="ghost-status-chip" title="Naive Slope-Only Baseline Rover">LP-G00 GHOST: <span id="ghost-hazards-count">0</span> HITS</span>
          </div>
        </div>
      </section>

      <!-- METRIC TELEMETRY CARDS -->
      <section class="telemetry-grid">

        <!-- BATTERY CARD -->
        <article class="metric-card">
          <div class="metric-top">
            <span>BATTERY CHARGE</span>
            <span class="metric-icon green">ϟ</span>
          </div>
          <div class="metric-value" id="battery-value">
            100<span>%</span>
          </div>
          <div class="metric-bar">
            <div id="battery-fill" class="bar-fill green-fill" style="width:100%"></div>
          </div>
          <p class="metric-footer" id="battery-footer">POWER SYSTEM NOMINAL</p>
        </article>

        <!-- HEALTH CARD -->
        <article class="metric-card">
          <div class="metric-top">
            <span>ROVER HEALTH</span>
            <span class="metric-icon blue">✚</span>
          </div>
          <div class="metric-value" id="health-value">
            100<span>%</span>
          </div>
          <div class="metric-bar">
            <div id="health-fill" class="bar-fill blue-fill" style="width:100%"></div>
          </div>
          <p class="metric-footer" id="health-footer">AVIONICS STATUS: NOMINAL</p>
        </article>

        <!-- DISTANCE TRAVELLED CARD -->
        <article class="metric-card">
          <div class="metric-top">
            <span>DISTANCE TRAVELLED</span>
            <span class="metric-icon purple">⌖</span>
          </div>
          <div class="metric-value" id="distance-value">
            0.00<span> km</span>
          </div>
          <div class="metric-extra" id="remaining-value">REM: 0.00 km</div>
          <p class="metric-footer">TRAJECTORY ODOMETRY</p>
        </article>

        <!-- ROVER STATUS CARD -->
        <article class="metric-card">
          <div class="metric-top">
            <span>ROVER STATUS</span>
            <span class="metric-icon orange">◈</span>
          </div>
          <div class="metric-value status-value status-ready" id="rover-status">
            READY
          </div>
          <div class="status-indicator">
            <span class="pulse-dot"></span>
            <span id="status-indicator-text">Awaiting route calculation</span>
          </div>
          <p class="metric-footer">AUTONOMY SUBSYSTEM</p>
        </article>

      </section>

      <!-- 3D SIMULATION VIEWPORT -->
      <section class="simulation-section" id="viewport">

        <div class="section-heading">
          <div>
            <p class="eyebrow">MEMBER 2 · 3D THREE.JS SIMULATION</p>
            <h3>Interactive Lunar Environment & Surface Trajectory</h3>
          </div>

          <!-- Camera & Speed Controls -->
          <div class="viewport-controls-toolbar">
            <button id="toggle-ghost-btn" class="ghost-toggle-btn active" title="Toggle Ghost Baseline Rover (Naive A* Benchmark)">
              👻 GHOST CAR: ON
            </button>

            <button id="expand-viewport-btn" class="expand-btn" title="Toggle Fullscreen / Expanded Map View">
              ⛶ EXPAND MAP
            </button>

            <div class="speed-group" title="Simulation Time Acceleration">
              <span class="speed-label">SPEED:</span>
              <button class="speed-pill active" data-speed="1">1x</button>
              <button class="speed-pill" data-speed="2">2x</button>
              <button class="speed-pill" data-speed="5">5x</button>
              <button class="speed-pill" data-speed="10">10x</button>
            </div>

            <div class="cam-group" title="Camera Perspectives">
              <button class="cam-mode-btn active" data-cam="follow">FOLLOW ROVER</button>
              <button class="cam-mode-btn" data-cam="follow-ghost">FOLLOW GHOST</button>
              <button class="cam-mode-btn" data-cam="orbit">ORBIT</button>
              <button class="cam-mode-btn" data-cam="focus">🎯 FOCUS</button>
              <button class="cam-mode-btn" data-cam="topdown">TOP-DOWN</button>
              <button class="cam-mode-btn" data-cam="perspective">HORIZON</button>
              <button class="cam-mode-btn reset-cam" data-cam="reset" title="Reset Camera">↺</button>
            </div>
          </div>
        </div>

        <!-- 3D WebGL Canvas Viewport -->
        <div class="viewport-wrapper">
          <div id="simulation-viewport" class="simulation-viewport"></div>

          <!-- Top-Left HUD: Coordinates -->
          <div class="viewport-hud hud-top-left">
            <div class="hud-item">
              <span class="hud-label">GRID POS</span>
              <strong id="telemetry-grid-coord">[20.0, 20.0]</strong>
            </div>
            <div class="hud-item">
              <span class="hud-label">WORLD XZ</span>
              <span id="telemetry-world-coord">X:-1075m Z:-1075m</span>
            </div>
          </div>

          <!-- Top-Right HUD: Surface Metrics -->
          <div class="viewport-hud hud-top-right">
            <div class="hud-item">
              <span class="hud-label">ELEVATION</span>
              <strong id="telemetry-elevation">120.0 m</strong>
            </div>
            <div class="hud-item">
              <span class="hud-label">SLOPE</span>
              <span id="telemetry-slope">0.0°</span>
            </div>
            <div class="hud-item">
              <span class="hud-label">ROUGHNESS</span>
              <span id="telemetry-roughness">0.00 m</span>
            </div>
          </div>

          <!-- Bottom-Left HUD: Rover Dynamics -->
          <div class="viewport-hud hud-bottom-left">
            <div class="hud-item">
              <span class="hud-label">SPEED</span>
              <strong id="telemetry-speed">0.0 m/s</strong>
            </div>
            <div class="hud-item">
              <span class="hud-label">HEADING</span>
              <span id="telemetry-heading">0.0°</span>
            </div>
          </div>

          <!-- Hazard Toggle HUD -->
          <div class="viewport-hud hud-bottom-right">
            <label class="hazard-checkbox-label">
              <input type="checkbox" id="hazard-toggle-checkbox" checked />
              <span class="hazard-marker-dot"></span>
              <span>HAZARD ZONES</span>
            </label>
          </div>

          <!-- 2D Tactical Minimap HUD Inset -->
          <div class="minimap-container" title="2.56km x 2.56km Tactical Polar Radar Map">
            <div class="minimap-header">
              <span>RADAR MAP (2.56 km)</span>
              <span class="minimap-badge">LIVE</span>
            </div>
            <canvas id="minimap-canvas" width="210" height="210"></canvas>
            <div class="minimap-footer">
              <span>SOUTH POLE [-89° S]</span>
              <span>GRID 256x256</span>
            </div>
          </div>
        </div>

        <!-- Terrain Visualization Mode Pills -->
        <div class="terrain-modes-toolbar">
          <span class="toolbar-title">TERRAIN VIEW:</span>
          <div class="terrain-pills-group">
            <button class="terrain-pill active" data-terrain-mode="normal">
              NORMAL REGOLITH
            </button>
            <button class="terrain-pill" data-terrain-mode="elevation">
              ELEVATION HYPSOMETRIC
            </button>
            <button class="terrain-pill" data-terrain-mode="slope">
              SLOPE HEATMAP (&lt;15°)
            </button>
            <button class="terrain-pill" data-terrain-mode="roughness">
              ROUGHNESS RMS
            </button>
            <button class="terrain-pill" data-terrain-mode="traversability">
              TRAVERSABILITY COST
            </button>
          </div>
        </div>

      </section>

      <!-- MISSION CONFIGURATION & CONTROLS -->
      <section class="mission-controls-panel" id="planner">

        <div class="panel-heading">
          <h3>Mission Planner & Execution Controls</h3>
          <span class="panel-tag">MEMBER 3 & 4 INTEGRATION</span>
        </div>

        <div class="planner-grid">

          <!-- Start Coordinates -->
          <div class="input-group">
            <label>START COORDINATES [X, Y]</label>
            <div class="coord-inputs">
              <input type="number" id="start-x" min="0" max="255" value="20" placeholder="X" />
              <input type="number" id="start-y" min="0" max="255" value="20" placeholder="Y" />
            </div>
          </div>

          <!-- Destination Coordinates -->
          <div class="input-group">
            <label>DESTINATION COORDINATES [X, Y]</label>
            <div class="coord-inputs">
              <input type="number" id="dest-x" min="0" max="255" value="210" placeholder="X" />
              <input type="number" id="dest-y" min="0" max="255" value="210" placeholder="Y" />
            </div>
          </div>

          <!-- Navigation Mode -->
          <div class="input-group">
            <label>AUTONOMOUS NAVIGATION MODE</label>
            <select id="nav-mode-select" class="nav-select">
              <option value="BALANCED" selected>BALANCED (Optimal trade-off)</option>
              <option value="SAFEST">SAFEST (Max hazard avoidance)</option>
              <option value="FASTEST">FASTEST (Shortest direct path)</option>
              <option value="ENERGY_EFFICIENT">ENERGY EFFICIENT (Minimum work)</option>
            </select>
          </div>

        </div>

        <!-- Mission Action Buttons -->
        <div class="controls-actions-row">
          <button id="plan-route-btn" class="ctrl-btn btn-plan">
            <span>⌖</span> CALCULATE ROUTE
          </button>
          <button id="deploy-btn" class="ctrl-btn btn-deploy">
            <span>▶</span> DEPLOY ROVER
          </button>
          <button id="start-btn" class="ctrl-btn btn-start">
            <span>⚡</span> START SIMULATION
          </button>
          <button id="pause-btn" class="ctrl-btn btn-pause">
            <span>⏸</span> PAUSE
          </button>
          <button id="resume-btn" class="ctrl-btn btn-resume">
            <span>▶</span> RESUME
          </button>
          <button id="stop-btn" class="ctrl-btn btn-stop">
            <span>⏹</span> STOP
          </button>
          <button id="reset-btn" class="ctrl-btn btn-reset">
            <span>↺</span> RESET
          </button>
        </div>

        <!-- Trajectory Progress Bar -->
        <div class="trajectory-progress-container">
          <div class="progress-labels">
            <span>ROUTE TRAVERSAL PROGRESS</span>
            <span id="mission-progress-text">0.0% (Standby)</span>
          </div>
          <div class="progress-track">
            <div id="mission-progress-fill" class="progress-fill" style="width: 0%"></div>
          </div>
        </div>

      </section>

      <!-- LOWER GRID: DIAGNOSTICS & SYSTEM FEED -->
      <section class="lower-grid" id="diagnostics">

        <!-- SUBSYSTEM DIAGNOSTICS -->
        <article class="panel">
          <div class="panel-heading">
            <h3>Subsystem Health Diagnostics</h3>
            <span class="panel-tag">HARDWARE HEALTH</span>
          </div>

          <div class="diagnostics-list">
            <div class="diag-item">
              <div class="diag-header">
                <span>MOBILITY & ROCKER-BOGIE</span>
                <span class="diag-val">NOMINAL</span>
              </div>
              <div class="diag-bar"><div id="diag-mobility-health" class="diag-fill green-fill" style="width: 100%"></div></div>
            </div>

            <div class="diag-item">
              <div class="diag-header">
                <span>NAVCAM & STEREO VISION</span>
                <span class="diag-val">NOMINAL</span>
              </div>
              <div class="diag-bar"><div id="diag-nav-health" class="diag-fill blue-fill" style="width: 100%"></div></div>
            </div>

            <div class="diag-item">
              <div class="diag-header">
                <span>POWER DISTRIBUTION & SOLAR DECK</span>
                <span class="diag-val">NOMINAL</span>
              </div>
              <div class="diag-bar"><div id="diag-power-health" class="diag-fill green-fill" style="width: 100%"></div></div>
            </div>

            <div class="diag-item">
              <div class="diag-header">
                <span>EARTH S-BAND TELECOMMUNICATION</span>
                <span class="diag-val">NOMINAL (-82 dBm)</span>
              </div>
              <div class="diag-bar"><div id="diag-comms-health" class="diag-fill purple-fill" style="width: 100%"></div></div>
            </div>
          </div>

          <!-- COMMAND CONSOLE INPUT -->
          <div class="command-box">
            <span class="command-prefix">&gt;</span>
            <input
              type="text"
              id="command-input"
              placeholder="Enter operator command (e.g. 'help', 'plan 20 20 210 210', 'start', 'speed 5')..."
            />
          </div>
        </article>

        <!-- SYSTEM LOG -->
        <article class="panel" id="logs">
          <div class="panel-heading">
            <h3>Mission Operations Feed</h3>
            <span class="panel-tag">LIVE FEED</span>
          </div>

          <div class="log-container" id="system-log"></div>
        </article>

      </section>

      <!-- FOOTER -->
      <footer class="footer">
        <span>LUNAPATH-4D AUTONOMOUS ROVER SIMULATOR · INTEGRATED 4-TIER ARCHITECTURE</span>
        <span>VIT BHOPAL UNIVERSITY · 2026</span>
      </footer>

    </main>
  </div>
`;

// -------------------------------------------------------------
// INITIALIZE APPLICATION
// -------------------------------------------------------------

const viewportContainer = document.getElementById("simulation-viewport");
const engine = new SimulationEngine(viewportContainer);

// Connect Telemetry & Logger
const telemetry = new TelemetryPanel();
engine.onTelemetry((snapshot) => telemetry.update(snapshot));

engine.logger.setContainer(document.getElementById("system-log"));

// Connect Controls Dispatcher
new MissionControls(engine);

// Connect Viewport Map Expand / Fullscreen Toggle
const expandBtn = document.getElementById("expand-viewport-btn");
const viewportWrapper = document.querySelector(".viewport-wrapper");
if (expandBtn && viewportWrapper) {
  expandBtn.addEventListener("click", () => {
    viewportWrapper.classList.toggle("viewport-expanded");
    const isExpanded = viewportWrapper.classList.contains("viewport-expanded");
    expandBtn.textContent = isExpanded ? "✕ COLLAPSE MAP" : "⛶ EXPAND MAP";
    expandBtn.classList.toggle("active", isExpanded);

    // Recompute Three.js camera aspect ratio and renderer viewport
    setTimeout(() => {
      engine.onWindowResize();
    }, 150);
  });
}

// Tactical Radar Minimap
const minimapCanvas = document.getElementById("minimap-canvas");
let minimap = null;

// Start Engine
engine.initialize()
  .then(() => {
    if (minimapCanvas && engine.terrain?.terrainData) {
      minimap = new Minimap(minimapCanvas, engine.terrain.terrainData);
      engine.onTelemetry((snapshot) => {
        minimap.render(snapshot);
      });
      // Initial render with current state
      minimap.render({
        startCoord: engine.startCoord,
        destCoord: engine.destCoord,
        currentPosition: engine.currentPosition,
        headingDeg: (engine.headingAngle * 180) / Math.PI,
        pathNodes: engine.pathNodes,
        currentNodeIndex: engine.currentNodeIndex,
        ghost: {
          visible: engine.ghostVisible,
          position: engine.ghostPosition,
          headingDeg: (engine.ghostHeadingAngle * 180) / Math.PI,
          pathNodes: engine.ghostPathNodes,
          currentNodeIndex: engine.ghostNodeIndex
        }
      });
    }
  })
  .catch((err) => {
    console.error("Simulation initialization failed:", err);
    engine.logger.log(`FATAL ERROR: ${err.message}`, "hazard");
  });

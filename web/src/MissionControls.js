/**
 * LunaPath-4D
 * MissionControls.js
 *
 * Member 4 - Interactive Mission Execution & UI Dispatcher
 * Connects all buttons, input forms, camera selectors, and CLI console commands.
 */

import { MissionReport } from "./MissionReport.js";

export class MissionControls {
  constructor(engine) {
    this.engine = engine;
    this.bindEvents();
  }

  bindEvents() {
    const e = this.engine;

    // --- EXECUTION BUTTONS ---
    const btnPlan = document.getElementById("plan-route-btn");
    const btnDeploy = document.getElementById("deploy-btn");
    const btnStart = document.getElementById("start-btn");
    const btnPause = document.getElementById("pause-btn");
    const btnResume = document.getElementById("resume-btn");
    const btnStop = document.getElementById("stop-btn");
    const btnReset = document.getElementById("reset-btn");
    const btnSpawnHazard = document.getElementById("spawn-hazard-btn");
    const btnExport = document.getElementById("export-report-btn");

    if (btnPlan) {
      btnPlan.addEventListener("click", () => {
        const startX = parseInt(document.getElementById("start-x").value, 10) || 20;
        const startY = parseInt(document.getElementById("start-y").value, 10) || 20;
        const destX = parseInt(document.getElementById("dest-x").value, 10) || 210;
        const destY = parseInt(document.getElementById("dest-y").value, 10) || 210;
        const mode = document.getElementById("nav-mode-select").value || "BALANCED";

        e.calculateRoute({ x: startX, y: startY }, { x: destX, y: destY }, mode);
      });
    }

    if (btnDeploy) {
      btnDeploy.addEventListener("click", () => e.deployRover());
    }

    if (btnStart) {
      btnStart.addEventListener("click", () => e.startSimulation());
    }

    if (btnPause) {
      btnPause.addEventListener("click", () => e.pauseSimulation());
    }

    if (btnResume) {
      btnResume.addEventListener("click", () => e.resumeSimulation());
    }

    if (btnStop) {
      btnStop.addEventListener("click", () => e.stopSimulation());
    }

    if (btnReset) {
      btnReset.addEventListener("click", () => e.resetMission());
    }

    if (btnSpawnHazard) {
      btnSpawnHazard.addEventListener("click", () => {
        e.spawnHazardAhead(160, 2);
      });
    }

    if (btnExport) {
      btnExport.addEventListener("click", () => {
        const snap = {
          missionStatus: e.state,
          startCoord: e.startCoord,
          destCoord: e.destCoord,
          navigationMode: e.navigationMode,
          speedMultiplier: e.speedMultiplier,
          totalPlannedDistance: e.totalPlannedDistance,
          distanceTravelled: e.distanceTravelled,
          progress: e.totalPlannedDistance > 0 ? (e.distanceTravelled / e.totalPlannedDistance) * 100 : 0,
          currentNodeIndex: e.currentNodeIndex,
          pathNodes: e.pathNodes,
          battery: e.battery.getSnapshot(),
          health: e.health.getSnapshot(),
          currentElevation: e.terrain.getElevationAt(e.currentPosition.x, e.currentPosition.y),
          currentSlope: e.terrain.getSlopeAt(e.currentPosition.x, e.currentPosition.y),
          currentRoughness: e.terrain.getRoughnessAt(e.currentPosition.x, e.currentPosition.y)
        };
        const report = MissionReport.generate(snap, e.logger.getEntries());
        MissionReport.downloadJSON(report);
        e.logger.log("Mission Telemetry Report exported to JSON.", "success");
      });
    }

    // --- GHOST ROVER TOGGLE ---
    const ghostToggleBtn = document.getElementById("toggle-ghost-btn");
    if (ghostToggleBtn) {
      ghostToggleBtn.addEventListener("click", () => {
        const nextState = !e.ghostVisible;
        e.setGhostVisible(nextState);
        ghostToggleBtn.classList.toggle("active", nextState);
        ghostToggleBtn.textContent = nextState ? "👻 GHOST CAR: ON" : "👻 GHOST CAR: OFF";
      });
    }

    // --- TIME ACCELERATION SPEED BUTTONS ---
    const speedButtons = document.querySelectorAll(".speed-pill");
    speedButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        speedButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const mult = parseFloat(btn.dataset.speed) || 1.0;
        e.setSpeedMultiplier(mult);
      });
    });

    // --- CAMERA VIEW BUTTONS ---
    const camButtons = document.querySelectorAll(".cam-mode-btn");
    camButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        camButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const mode = btn.dataset.cam;
        if (mode === "reset") {
          e.resetCamera();
        } else {
          e.setCameraMode(mode);
        }
      });
    });

    // --- TERRAIN VISUALIZATION MODE PILLS ---
    const terrainPills = document.querySelectorAll(".terrain-pill");
    terrainPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        terrainPills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        const mode = pill.dataset.terrainMode;
        e.setTerrainMode(mode);
      });
    });

    // --- HAZARD OVERLAY TOGGLE ---
    const hazardToggle = document.getElementById("hazard-toggle-checkbox");
    if (hazardToggle) {
      hazardToggle.addEventListener("change", (evt) => {
        e.setHazardsVisible(evt.target.checked);
      });
    }

    // --- MISSION COMMAND INPUT CLI ---
    const cmdInput = document.getElementById("command-input");
    if (cmdInput) {
      cmdInput.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          const raw = cmdInput.value.trim();
          if (!raw) return;
          this.executeCommand(raw);
          cmdInput.value = "";
        }
      });
    }
  }

  executeCommand(cmd) {
    const parts = cmd.split(/\s+/);
    const action = parts[0].toLowerCase();
    const e = this.engine;

    e.logger.log(`OPERATOR COMMAND: > ${cmd}`, "info");

    switch (action) {
      case "help":
        e.logger.log("COMMANDS: plan [x1 y1 x2 y2], deploy, start, pause, resume, stop, reset, hazard [x y [r]], speed [1|2|5|10], mode [FASTEST|SAFEST|BALANCED|ENERGY_EFFICIENT], export", "info");
        break;

      case "plan":
        if (parts.length >= 5) {
          const x1 = parseInt(parts[1], 10);
          const y1 = parseInt(parts[2], 10);
          const x2 = parseInt(parts[3], 10);
          const y2 = parseInt(parts[4], 10);
          e.calculateRoute({ x: x1, y: y1 }, { x: x2, y: y2 });
        } else {
          e.calculateRoute();
        }
        break;

      case "deploy":
        e.deployRover();
        break;

      case "start":
        e.startSimulation();
        break;

      case "pause":
        e.pauseSimulation();
        break;

      case "resume":
        e.resumeSimulation();
        break;

      case "stop":
        e.stopSimulation();
        break;

      case "reset":
        e.resetMission();
        break;

      case "hazard":
      case "obstacle":
      case "replan":
        if (parts.length >= 3) {
          const hx = parseInt(parts[1], 10);
          const hy = parseInt(parts[2], 10);
          const r = parts[3] ? parseInt(parts[3], 10) : 2;
          e.addHazardAt(hx, hy, r);
        } else {
          e.spawnHazardAhead(160, 2);
        }
        break;

      case "speed":
        if (parts[1]) {
          const mult = parseFloat(parts[1]);
          e.setSpeedMultiplier(mult);
        }
        break;

      case "mode":
        if (parts[1]) {
          const mode = parts[1].toUpperCase();
          e.navigationMode = mode;
          e.logger.log(`Nav mode switched to ${mode}`, "info");
        }
        break;

      case "export":
      case "report":
        const btnExport = document.getElementById("export-report-btn");
        if (btnExport) btnExport.click();
        break;

      default:
        e.logger.log(`Unknown command: "${cmd}". Type "help" for a list of commands.`, "warning");
        break;
    }
  }
}

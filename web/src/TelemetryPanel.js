/**
 * LunaPath-4D
 * TelemetryPanel.js
 *
 * Member 4 - Real-Time Dashboard Telemetry Binding
 * Synchronizes simulation metrics to the Mission Control DOM.
 */

export class TelemetryPanel {
  constructor() {
    this.elements = {
      batteryValue: document.getElementById("battery-value"),
      batteryFill: document.getElementById("battery-fill"),
      batteryFooter: document.getElementById("battery-footer"),

      healthValue: document.getElementById("health-value"),
      healthFill: document.getElementById("health-fill"),
      healthFooter: document.getElementById("health-footer"),

      distanceValue: document.getElementById("distance-value"),
      remainingValue: document.getElementById("remaining-value"),

      roverStatus: document.getElementById("rover-status"),
      statusDot: document.getElementById("status-indicator-text"),

      gridCoord: document.getElementById("telemetry-grid-coord"),
      worldCoord: document.getElementById("telemetry-world-coord"),
      elevation: document.getElementById("telemetry-elevation"),
      slope: document.getElementById("telemetry-slope"),
      roughness: document.getElementById("telemetry-roughness"),
      speed: document.getElementById("telemetry-speed"),
      heading: document.getElementById("telemetry-heading"),
      progressFill: document.getElementById("mission-progress-fill"),
      progressText: document.getElementById("mission-progress-text"),

      // Subsystem health bars
      mobilityHealth: document.getElementById("diag-mobility-health"),
      navHealth: document.getElementById("diag-nav-health"),
      powerHealth: document.getElementById("diag-power-health"),
      commsHealth: document.getElementById("diag-comms-health"),

      // Dual-Rover Ghost Baseline Comparison
      ghostHazardsCount: document.getElementById("ghost-hazards-count"),
      ghostStatusChip: document.getElementById("ghost-status-chip")
    };
  }

  update(snap) {
    if (!snap) return;

    // 1. Battery
    if (this.elements.batteryValue) {
      this.elements.batteryValue.innerHTML = `${Math.round(snap.battery.percentage)}<span>%</span>`;
    }
    if (this.elements.batteryFill) {
      this.elements.batteryFill.style.width = `${Math.max(0, snap.battery.percentage)}%`;
      if (snap.battery.percentage < 20) {
        this.elements.batteryFill.className = "bar-fill red-fill";
      } else if (snap.battery.percentage < 45) {
        this.elements.batteryFill.className = "bar-fill orange-fill";
      } else {
        this.elements.batteryFill.className = "bar-fill green-fill";
      }
    }
    if (this.elements.batteryFooter) {
      this.elements.batteryFooter.textContent = `DRAIN: ${snap.battery.energyConsumedWh.toFixed(1)} Wh · ${snap.battery.status}`;
    }

    // 2. Health
    if (this.elements.healthValue) {
      this.elements.healthValue.innerHTML = `${Math.round(snap.health.overallHealth)}<span>%</span>`;
    }
    if (this.elements.healthFill) {
      this.elements.healthFill.style.width = `${Math.max(0, snap.health.overallHealth)}%`;
    }
    if (this.elements.healthFooter) {
      this.elements.healthFooter.textContent = `AVIONICS STATUS: ${snap.health.status}`;
    }

    // 3. Distance
    if (this.elements.distanceValue) {
      const km = snap.distanceTravelled / 1000.0;
      this.elements.distanceValue.innerHTML = `${km.toFixed(2)}<span> km</span>`;
    }
    if (this.elements.remainingValue) {
      this.elements.remainingValue.textContent = `REM: ${(snap.remainingDistance / 1000.0).toFixed(2)} km`;
    }

    // 4. Status Badge
    if (this.elements.roverStatus) {
      this.elements.roverStatus.textContent = snap.missionStatus;
      this.elements.roverStatus.className = `metric-value status-value status-${snap.missionStatus.toLowerCase()}`;
    }
    if (this.elements.statusDot) {
      if (snap.missionStatus === "RUNNING") {
        this.elements.statusDot.textContent = "Autonomous traversing";
      } else if (snap.missionStatus === "COMPLETED") {
        this.elements.statusDot.textContent = "Destination reached";
      } else if (snap.missionStatus === "DEPLOYED") {
        this.elements.statusDot.textContent = "Rover deployed on surface";
      } else if (snap.missionStatus === "PAUSED") {
        this.elements.statusDot.textContent = "Simulation paused";
      } else {
        this.elements.statusDot.textContent = "Standby ready";
      }
    }

    // 5. Telemetry details
    if (this.elements.gridCoord) {
      this.elements.gridCoord.textContent = `[${snap.currentPosition.x.toFixed(1)}, ${snap.currentPosition.y.toFixed(1)}]`;
    }
    if (this.elements.worldCoord) {
      this.elements.worldCoord.textContent = `X:${snap.currentWorldPos.x.toFixed(0)}m Z:${snap.currentWorldPos.z.toFixed(0)}m`;
    }
    if (this.elements.elevation) {
      this.elements.elevation.textContent = `${snap.currentElevation.toFixed(1)} m`;
    }
    if (this.elements.slope) {
      this.elements.slope.textContent = `${snap.currentSlope.toFixed(1)}°`;
    }
    if (this.elements.roughness) {
      this.elements.roughness.textContent = `${snap.currentRoughness.toFixed(2)} m`;
    }
    if (this.elements.speed) {
      this.elements.speed.textContent = `${snap.speedMps.toFixed(1)} m/s`;
    }
    if (this.elements.heading) {
      this.elements.heading.textContent = `${snap.headingDeg}°`;
    }

    // 6. Mission Progress
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = `${snap.progress.toFixed(1)}%`;
    }
    if (this.elements.progressText) {
      this.elements.progressText.textContent = `${snap.progress.toFixed(1)}% (Node ${snap.currentNodeIndex}/${snap.totalNodes})`;
    }

    // 7. Subsystems diagnostics
    if (snap.health.subsystems) {
      if (this.elements.mobilityHealth) {
        this.elements.mobilityHealth.style.width = `${snap.health.subsystems.mobility.health}%`;
      }
      if (this.elements.navHealth) {
        this.elements.navHealth.style.width = `${snap.health.subsystems.navigation.health}%`;
      }
      if (this.elements.powerHealth) {
        this.elements.powerHealth.style.width = `${snap.health.subsystems.power.health}%`;
      }
      if (this.elements.commsHealth) {
        this.elements.commsHealth.style.width = `${snap.health.subsystems.comms.health}%`;
      }
    }

    // 8. Dual-Rover Benchmark Telemetry
    if (snap.ghost && this.elements.ghostHazardsCount) {
      const totalHits = (snap.ghost.hazardsHit || 0) + (snap.ghost.severeSlopesHit || 0);
      this.elements.ghostHazardsCount.textContent = totalHits;
      if (this.elements.ghostStatusChip) {
        this.elements.ghostStatusChip.innerHTML = `LP-G00 SCOUT (+50m LEAD): <span id="ghost-hazards-count">${totalHits}</span> HITS`;
        if (totalHits > 0) {
          this.elements.ghostStatusChip.className = "rover-chip chip-ghost hazard-hit";
        } else {
          this.elements.ghostStatusChip.className = "rover-chip chip-ghost";
        }
      }
    }
  }
}

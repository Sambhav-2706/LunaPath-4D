/**
 * LunaPath-4D
 * MissionReport.js
 *
 * Member 4 - Mission Report Generator & Exporter
 * Summarizes mission telemetry, route metrics, and system diagnostics into
 * a formatted report and provides one-click JSON download.
 */

export class MissionReport {
  /**
   * Compile a full structured mission report.
   * @param {Object} state SimulationEngine snapshot
   * @param {Array} logEntries Event log entries
   */
  static generate(state, logEntries = []) {
    const report = {
      project: "LunaPath-4D",
      report_generated_utc: new Date().toISOString(),
      mission_summary: {
        mission_id: "LP04-POLAR-EXPLORATION",
        sol: "001",
        landing_site: "Lunar South Pole (-89.0° S, 0.0° E)",
        rover_id: "LP-R01 Pragyan-Class",
        mission_status: state.missionStatus || "UNKNOWN",
        navigation_mode: state.navigationMode || "BALANCED",
        simulation_speed_multiplier: state.speedMultiplier || 1.0
      },
      trajectory_metrics: {
        start_grid: state.startCoord || { x: 0, y: 0 },
        destination_grid: state.destCoord || { x: 0, y: 0 },
        total_planned_distance_m: Number((state.totalPlannedDistance || 0).toFixed(2)),
        actual_distance_travelled_m: Number((state.distanceTravelled || 0).toFixed(2)),
        progress_percentage: Number((state.progress || 0).toFixed(1)),
        planned_nodes: state.pathNodes ? state.pathNodes.length : 0,
        nodes_traversed: state.currentNodeIndex || 0
      },
      energy_and_power: {
        battery_remaining_percentage: state.battery?.percentage ?? 100,
        energy_consumed_wh: state.battery?.energyConsumedWh ?? 0,
        battery_status: state.battery?.status ?? "NOMINAL"
      },
      subsystem_diagnostics: {
        overall_health_percentage: state.health?.overallHealth ?? 100,
        mobility_subsystem: state.health?.subsystems?.mobility ?? {},
        navigation_subsystem: state.health?.subsystems?.navigation ?? {},
        power_subsystem: state.health?.subsystems?.power ?? {},
        comms_subsystem: state.health?.subsystems?.comms ?? {}
      },
      terrain_telemetry: {
        current_elevation_m: Number((state.currentElevation || 0).toFixed(2)),
        current_slope_deg: Number((state.currentSlope || 0).toFixed(2)),
        current_roughness_m: Number((state.currentRoughness || 0).toFixed(2))
      },
      event_log: logEntries
    };

    return report;
  }

  /**
   * Trigger a client-side JSON download of the mission report.
   */
  static downloadJSON(report, filename = "lunapath-4d-mission-report.json") {
    const jsonString = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

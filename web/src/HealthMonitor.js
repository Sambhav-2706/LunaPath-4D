/**
 * LunaPath-4D
 * HealthMonitor.js
 *
 * Member 4 - Rover Subsystem Health Monitoring
 * Simulates real-time telemetry diagnostics for:
 * - Mobility System (6-wheel drive motors, rocker-bogie wear)
 * - Navigation System (NavCam stereo vision, IMU, LiDAR)
 * - Power Distribution System (solar array efficiency, internal bus voltage)
 * - Telecommunications Subsystem (S-band link, RSSI, ping latency)
 */

export class HealthMonitor {
  constructor() {
    this.reset();
  }

  reset() {
    this.overallHealth = 100.0;
    this.subsystems = {
      mobility: {
        name: "Mobility & Rocker-Bogie",
        status: "NOMINAL",
        health: 100.0,
        tempCelsius: -15.0,
        motorCurrentAmps: 1.8,
        wearPercentage: 0.0
      },
      navigation: {
        name: "NavCam & Sensor Suite",
        status: "NOMINAL",
        health: 100.0,
        imuDriftRate: 0.002, // deg/s
        lidarStatus: "ACTIVE"
      },
      power: {
        name: "PDU & Solar Array",
        status: "NOMINAL",
        health: 100.0,
        busVoltageVolts: 28.2,
        solarInputWatts: 45.0
      },
      comms: {
        name: "Direct-to-Earth S-Band",
        status: "NOMINAL",
        health: 100.0,
        signalDbm: -82.0,
        latencyMs: 1280.0 // Earth-Moon one-way light delay ~1.3s
      }
    };
    this.alerts = [];
  }

  /**
   * Update subsystem health based on terrain and rover state.
   * @param {number} distanceMeters
   * @param {number} currentSlopeDeg
   * @param {number} currentRoughnessM
   * @param {number} batteryPercentage
   */
  update(distanceMeters, currentSlopeDeg, currentRoughnessM, batteryPercentage) {
    this.alerts = [];

    // 1. Mobility Wear (increases with distance and roughness)
    const roughnessWearRate = 0.0008 * Math.max(1, currentRoughnessM);
    const wear = Math.min(25, distanceMeters * roughnessWearRate);
    this.subsystems.mobility.wearPercentage = Number(wear.toFixed(2));
    this.subsystems.mobility.health = Math.max(65, 100.0 - wear);

    if (currentRoughnessM > 4.0 || currentSlopeDeg > 18.0) {
      this.subsystems.mobility.status = "CAUTION";
      this.subsystems.mobility.motorCurrentAmps = 3.6;
      this.alerts.push("MOBILITY: High motor load on steep/rough terrain.");
    } else {
      this.subsystems.mobility.status = "NOMINAL";
      this.subsystems.mobility.motorCurrentAmps = 1.8;
    }

    // 2. Navigation
    if (currentSlopeDeg > 20.0) {
      this.subsystems.navigation.status = "CAUTION";
      this.subsystems.navigation.health = 92.0;
      this.alerts.push("NAVIGATION: NavCam horizon tilt exceeds nominal envelope.");
    } else {
      this.subsystems.navigation.status = "NOMINAL";
      this.subsystems.navigation.health = 99.5;
    }

    // 3. Power System
    if (batteryPercentage < 20.0) {
      this.subsystems.power.status = "WARNING";
      this.subsystems.power.health = 75.0;
      this.alerts.push("POWER: Critical battery reserve (< 20%).");
    } else if (batteryPercentage < 40.0) {
      this.subsystems.power.status = "CAUTION";
      this.subsystems.power.health = 88.0;
    } else {
      this.subsystems.power.status = "NOMINAL";
      this.subsystems.power.health = 100.0;
    }

    // 4. Comms System (slight realistic jitter in signal)
    const signalNoise = (Math.random() - 0.5) * 1.5;
    this.subsystems.comms.signalDbm = Number((-82.0 + signalNoise).toFixed(1));
    this.subsystems.comms.latencyMs = Number((1280.0 + (Math.random() - 0.5) * 20).toFixed(0));

    // Overall aggregate health
    const totalHealth =
      this.subsystems.mobility.health * 0.35 +
      this.subsystems.navigation.health * 0.25 +
      this.subsystems.power.health * 0.25 +
      this.subsystems.comms.health * 0.15;

    this.overallHealth = Number(totalHealth.toFixed(1));

    return this.getSnapshot();
  }

  getSnapshot() {
    return {
      overallHealth: this.overallHealth,
      status: this.overallHealth > 90 ? "NOMINAL" : this.overallHealth > 75 ? "CAUTION" : "WARNING",
      subsystems: structuredClone(this.subsystems),
      activeAlerts: [...this.alerts]
    };
  }
}

/**
 * LunaPath-4D
 * BatterySimulation.js
 *
 * Member 4 - Physics-Informed Battery & Energy Simulation
 * Computes energy expenditure as a function of:
 * - Constant baseline avionics power (communications, computer, heating)
 * - Wheel drive power (rolling resistance, rover mass, lunar gravity 1.62 m/s²)
 * - Gravitational potential work on inclines: P_climb = mass * g_lunar * v * sin(slope)
 * - Terrain roughness rolling drag penalty
 * - Simulated solar generation
 *
 * Note: These values are simulated computational estimates for mission planning.
 */

export class BatterySimulation {
  constructor(options = {}) {
    this.initialCapacityWh = options.capacityWh || 1200; // Watt-hours
    this.capacityWh = this.initialCapacityWh;
    this.energyConsumedWh = 0;
    this.batteryPercentage = 100.0;

    // Physical rover parameters
    this.massKg = options.massKg || 60.0;
    this.lunarGravity = 1.62; // m/s²
    this.baseAvionicsPowerW = 35.0; // Watts (constant idle drain)
    this.rollingResistanceCoeff = 0.08; // Lunar regolith rolling resistance

    this.isLowBattery = false;
    this.lowBatteryThreshold = 20.0; // %
  }

  reset() {
    this.capacityWh = this.initialCapacityWh;
    this.energyConsumedWh = 0;
    this.batteryPercentage = 100.0;
    this.isLowBattery = false;
  }

  /**
   * Update battery model based on elapsed time and terrain conditions.
   * @param {number} deltaSeconds
   * @param {number} speed m/s
   * @param {number} slopeDeg Incline angle in degrees
   * @param {number} roughnessM Terrain roughness in meters
   * @param {boolean} isMoving
   */
  update(deltaSeconds, speed, slopeDeg = 0, roughnessM = 1.0, isMoving = false) {
    if (deltaSeconds <= 0) return this.getSnapshot();

    // 1. Base avionics drain (W)
    let powerDrawWatts = this.baseAvionicsPowerW;

    if (isMoving && speed > 0) {
      // 2. Rolling resistance power: P_roll = c_r * m * g * v
      const rollingPower = this.rollingResistanceCoeff * this.massKg * this.lunarGravity * speed;

      // 3. Incline climbing power: P_slope = m * g * v * sin(slope)
      const slopeRad = (slopeDeg * Math.PI) / 180.0;
      const slopePower = Math.max(-10, this.massKg * this.lunarGravity * speed * Math.sin(slopeRad));

      // 4. Roughness friction penalty: rough ground increases mechanical work
      const roughnessMultiplier = 1.0 + 0.3 * Math.min(3, Math.max(0, roughnessM - 1.0));

      const mechanicalPower = (rollingPower + slopePower) * roughnessMultiplier;
      powerDrawWatts += Math.max(5.0, mechanicalPower);
    }

    // Energy drained in Watt-hours = Watts * (seconds / 3600)
    const energyDeltaWh = powerDrawWatts * (deltaSeconds / 3600.0);

    this.energyConsumedWh += energyDeltaWh;
    this.capacityWh = Math.max(0, this.initialCapacityWh - this.energyConsumedWh);
    this.batteryPercentage = Math.max(0, Math.min(100, (this.capacityWh / this.initialCapacityWh) * 100));

    this.isLowBattery = this.batteryPercentage <= this.lowBatteryThreshold;

    return this.getSnapshot();
  }

  /**
   * Estimate remaining range based on average power consumption.
   * @param {number} currentSpeed
   * @returns {number} Estimated remaining meters
   */
  estimateRemainingRangeMeters(currentSpeed = 1.0) {
    const avgPowerWatts = 55.0; // Nominal traversal power
    const remainingHours = this.capacityWh / avgPowerWatts;
    return remainingHours * currentSpeed * 3600;
  }

  getSnapshot() {
    return {
      percentage: Number(this.batteryPercentage.toFixed(1)),
      energyConsumedWh: Number(this.energyConsumedWh.toFixed(2)),
      remainingWh: Number(this.capacityWh.toFixed(2)),
      totalCapacityWh: this.initialCapacityWh,
      isLowBattery: this.isLowBattery,
      status: this.isLowBattery ? "CRITICAL_LOW" : this.batteryPercentage < 40 ? "CAUTION" : "NOMINAL"
    };
  }
}

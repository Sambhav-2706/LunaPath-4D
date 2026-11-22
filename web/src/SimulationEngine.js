/**
 * LunaPath-4D
 * SimulationEngine.js
 *
 * Central Master Orchestrator linking:
 * - Member 1: Terrain Data Engine (DEM, slope, roughness, traversability)
 * - Member 2: 3D Three.js Simulation (Terrain, Rover, Lighting, Camera, Route)
 * - Member 3: Autonomous Navigation (A* Path Planner, Cost Function, Collision Check)
 * - Member 4: Mission Control & Rover Systems (Controls, Battery, Health, Telemetry, Logs)
 */

import * as THREE from "three";
import { TerrainRenderer } from "./TerrainRenderer.js";
import { RoverModel } from "./RoverModel.js";
import { RouteVisualizer } from "./RouteVisualizer.js";
import { LunarEnvironment } from "./LunarEnvironment.js";
import { CameraController } from "./CameraController.js";
import { BatterySimulation } from "./BatterySimulation.js";
import { HealthMonitor } from "./HealthMonitor.js";
import { MissionLogger } from "./MissionLogger.js";
import { planRoute } from "../navigation/PathPlanner.js";
import { findPath } from "../navigation/AStar.js";

export class SimulationEngine {
  constructor(canvasContainer) {
    this.container = canvasContainer;

    // Three.js Core
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      48,
      this.container.clientWidth / this.container.clientHeight,
      1.0,
      8000
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);

    // Systems
    this.logger = new MissionLogger();
    this.battery = new BatterySimulation();
    this.health = new HealthMonitor();
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);
    this.environment = new LunarEnvironment(this.scene);
    this.terrain = new TerrainRenderer();

    // Primary Autonomous Rover (LP-R01)
    this.rover = new RoverModel({ scale: 7.5 });

    // Ghost Baseline Rover (LP-G00 - Naive Slope-Only A* Benchmark)
    this.ghostRover = new RoverModel({ scale: 7.5, isGhost: true });
    this.ghostVisible = true;

    this.visualizer = null; // initialized after terrain loads

    // Mission State
    this.state = "UNINITIALIZED"; // UNINITIALIZED | READY | PLANNED | DEPLOYED | RUNNING | PAUSED | COMPLETED | STOPPED
    this.startCoord = { x: 20, y: 20 };
    this.destCoord = { x: 210, y: 210 };
    this.navigationMode = "BALANCED";
    this.speedMultiplier = 1.0;
    this.nominalSpeedMps = 12.0; // Rover traversal speed in m/s

    // Path & Movement - Main Rover
    this.plannedRoute = null;
    this.pathNodes = [];
    this.currentNodeIndex = 1;
    this.currentPosition = { x: 20, y: 20 };
    this.currentWorldPos = new THREE.Vector3();
    this.distanceTravelled = 0;
    this.totalPlannedDistance = 0;
    this.headingAngle = 0;

    // Path & Movement - Ghost Baseline Rover
    this.ghostPathNodes = [];
    this.ghostNodeIndex = 1;
    this.ghostPosition = { x: 20, y: 20 };
    this.ghostWorldPos = new THREE.Vector3();
    this.ghostDistanceTravelled = 0;
    this.ghostTotalDistance = 0;
    this.ghostHeadingAngle = 0;
    this.ghostHazardsHit = 0;
    this.ghostSevereSlopesHit = 0;

    // Callbacks
    this.telemetryListeners = [];

    // Animation Loop
    this.lastTime = performance.now();
    this.animationId = null;

    // Resize handling
    window.addEventListener("resize", () => this.onWindowResize());
  }

  /**
   * Initialize entire simulation pipeline.
   */
  async initialize() {
    this.logger.log("Initiating LunaPath-4D terrain loading sequence...", "info");

    // 1. Load terrain data and build Three.js mesh
    await this.terrain.load();
    this.scene.add(this.terrain.mesh);
    this.scene.add(this.terrain.hazardGroup);

    // 2. Add visualizer and rovers
    this.visualizer = new RouteVisualizer(this.terrain);
    this.scene.add(this.visualizer.group);
    this.scene.add(this.rover.group);
    this.scene.add(this.ghostRover.group);

    this.cameraController.setFollowTarget(this.rover);

    // 3. Prepare normalized terrain for Member 3 path planner
    this.buildNavigationTerrain();

    // 4. Automatically plan initial mission route
    this.calculateRoute(this.startCoord, this.destCoord, this.navigationMode);

    // 5. Automatically deploy rover on surface at start pad
    this.deployRover();

    // 6. Focus camera directly on rover
    this.cameraController.focusOnRover(this.rover);

    this.state = "READY";
    this.logger.log("Lunar South Pole DEM (256x256) loaded successfully.", "success");
    this.logger.log("Rover LP-R01 positioned at launch waypoint. Click START SIMULATION to begin.", "success");

    // Start render loop
    this.animate();

    this.broadcastTelemetry();
    return this;
  }

  /**
   * Construct Member 3 navigation terrain object from Member 1 precomputed arrays.
   */
  buildNavigationTerrain() {
    const { width, height, slope, roughness, traversability } = this.terrain.terrainData;
    const total = width * height;

    const normSlope = new Float32Array(total);
    const normRough = new Float32Array(total);
    const navTrav = new Uint8Array(total);

    for (let i = 0; i < total; i++) {
      // Horn's slope normalized to [0, 1] relative to critical 45°
      normSlope[i] = Math.min(1.0, Math.max(0.0, slope[i] / 45.0));
      // RMS roughness normalized to [0, 1] relative to critical 3.0m
      normRough[i] = Math.min(1.0, Math.max(0.0, roughness[i] / 3.0));
      // Continuous traversability cost > 0.85 treated as obstacle (0 = blocked)
      navTrav[i] = traversability[i] > 0.85 ? 0 : 1;
    }

    this.navTerrain = {
      width,
      height,
      cellSize: this.terrain.terrainData.cellSizeMeters,
      slope: normSlope,
      roughness: normRough,
      traversability: navTrav
    };
  }

  /**
   * Calculate a terrain-aware collision-free route.
   */
  calculateRoute(start = this.startCoord, dest = this.destCoord, mode = this.navigationMode) {
    this.startCoord = { ...start };
    this.destCoord = { ...dest };
    this.navigationMode = mode;

    this.logger.log(`Planning route from (${start.x}, ${start.y}) to (${dest.x}, ${dest.y}) [Mode: ${mode}]...`, "info");

    try {
      const result = planRoute(this.navTerrain, start, dest, mode);

      if (!result.success || !result.path || result.path.length < 2) {
        this.logger.log(`Path planning failed: ${result.message || "Target cell is unreachable or hazardous."}`, "hazard");
        return { success: false, message: result.message };
      }

      this.plannedRoute = result;
      this.pathNodes = result.path;
      this.totalPlannedDistance = result.totalDistanceMeters;
      this.distanceTravelled = 0;
      this.currentNodeIndex = 1;

      // Render 3D path ribbons and beacon pins
      this.visualizer.setRoute(this.pathNodes);

      // Also compute Naive Ghost Baseline route for side-by-side benchmark
      this.calculateGhostRoute(this.startCoord, this.destCoord);

      this.state = "PLANNED";
      this.logger.log(`Route computed: ${result.pathNodes} waypoints, ${result.totalDistanceMeters.toFixed(1)}m.`, "success");
      this.logger.log(`Ghost Baseline (Naive A*) computed: ${this.ghostPathNodes.length} waypoints.`, "info");

      this.broadcastTelemetry();
      return { success: true, result };
    } catch (err) {
      this.logger.log(`Planning error: ${err.message}`, "hazard");
      return { success: false, message: err.message };
    }
  }

  /**
   * Plan a naive slope-only baseline path for the Ghost Rover.
   * Ignores crater hazard buffers, roughness, and traversability cost,
   * demonstrating why autonomous obstacle avoidance is critical.
   */
  calculateGhostRoute(start = this.startCoord, dest = this.destCoord) {
    if (!this.terrain?.terrainData) return [];
    const { width, height, slope } = this.terrain.terrainData;
    const cellSize = this.terrain.terrainData.cellSizeMeters;

    // Slope-only naive walkability: ignores craters, roughness, obstacle masks, and traversability!
    const isWalkable = (x, y) => {
      const idx = y * width + x;
      return slope[idx] <= 32.0; // Naively traverses crater rims and rough regions
    };

    const getTerrainCost = (x, y) => {
      const idx = y * width + x;
      return 1.0 + (slope[idx] / 45.0) * 0.2; // Naive slope penalty only
    };

    try {
      const path = findPath(start, dest, width, height, isWalkable, getTerrainCost);
      if (path && path.length >= 2) {
        this.ghostPathNodes = path;
        let total = 0;
        for (let i = 1; i < path.length; i++) {
          total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y) * cellSize;
        }
        this.ghostTotalDistance = total;
        if (this.visualizer) {
          this.visualizer.setGhostRoute(this.ghostPathNodes);
        }
        return path;
      }
    } catch (err) {
      console.warn("Ghost baseline path planning error, falling back:", err);
    }

    // Direct interpolation fallback
    const fallback = [];
    const steps = Math.max(Math.abs(dest.x - start.x), Math.abs(dest.y - start.y));
    for (let s = 0; s <= steps; s++) {
      const f = steps === 0 ? 0 : s / steps;
      fallback.push({
        x: Math.round(start.x + (dest.x - start.x) * f),
        y: Math.round(start.y + (dest.y - start.y) * f)
      });
    }
    this.ghostPathNodes = fallback;
    this.ghostTotalDistance = steps * cellSize;
    if (this.visualizer) {
      this.visualizer.setGhostRoute(this.ghostPathNodes);
    }
    return fallback;
  }

  /**
   * Deploy the rover at the starting node.
   */
  deployRover() {
    if (this.state === "UNINITIALIZED") {
      this.logger.log("Cannot deploy: Terrain simulation uninitialized.", "warning");
      return;
    }

    if (!this.pathNodes || this.pathNodes.length < 2) {
      // Auto-plan default route if none planned
      this.calculateRoute();
    }

    if (this.pathNodes && this.pathNodes.length >= 2) {
      this.placeRoverAt(this.pathNodes[0].x, this.pathNodes[0].y);
      this.visualizer.setRoute(this.pathNodes);
    } else {
      this.placeRoverAt(this.startCoord.x, this.startCoord.y);
    }

    // Also deploy Ghost Baseline Rover at start pad
    if (this.ghostPathNodes && this.ghostPathNodes.length >= 2) {
      this.placeGhostRoverAt(this.ghostPathNodes[0].x, this.ghostPathNodes[0].y);
      this.visualizer.setGhostRoute(this.ghostPathNodes);
    } else {
      this.placeGhostRoverAt(this.startCoord.x, this.startCoord.y);
    }

    this.currentNodeIndex = 1;
    this.distanceTravelled = 0;
    this.ghostNodeIndex = 1;
    this.ghostDistanceTravelled = 0;
    this.ghostHazardsHit = 0;
    this.ghostSevereSlopesHit = 0;
    this.battery.reset();
    this.health.reset();

    // Frame the rover in 3D camera
    this.cameraController.focusOnRover(this.rover);

    this.state = "DEPLOYED";
    this.logger.log("Rover LP-R01 and Ghost Baseline LP-G00 deployed at start waypoint.", "success");
    this.broadcastTelemetry();
  }

  placeGhostRoverAt(col, row) {
    this.ghostPosition = { x: col, y: row };
    const worldPos = this.terrain.gridToWorld(col, row);
    const worldY = this.terrain.getWorldY(col, row);
    const normal = this.terrain.getNormalAt(col, row);

    this.ghostWorldPos.set(worldPos.x, worldY, worldPos.z);
    this.ghostRover.update(worldPos.x, worldY, worldPos.z, this.ghostHeadingAngle, normal, 0);
  }

  /**
   * Start or resume simulation movement.
   */
  startSimulation() {
    // If completed or stopped, reset first so it can restart cleanly
    if (this.state === "COMPLETED" || this.state === "STOPPED") {
      this.resetMission();
    }

    // Auto-calculate route if not yet calculated
    if (!this.pathNodes || this.pathNodes.length < 2) {
      const planRes = this.calculateRoute();
      if (!planRes.success) {
        this.logger.log("Cannot start: No valid safe route.", "hazard");
        return;
      }
    }

    // Auto-deploy if not deployed
    if (this.state === "READY" || this.state === "PLANNED") {
      this.deployRover();
    }

    this.state = "RUNNING";
    this.logger.log("Simulation RUNNING: Autonomous trajectory execution initiated.", "success");
    this.broadcastTelemetry();
  }

  pauseSimulation() {
    if (this.state === "RUNNING") {
      this.state = "PAUSED";
      this.logger.log("Simulation PAUSED: Rover stationary.", "warning");
      this.broadcastTelemetry();
    }
  }

  resumeSimulation() {
    if (this.state === "PAUSED") {
      this.state = "RUNNING";
      this.logger.log("Simulation RESUMED: Traversing to next waypoint.", "success");
      this.broadcastTelemetry();
    }
  }

  stopSimulation() {
    this.state = "STOPPED";
    this.logger.log("Simulation STOPPED by operator command.", "warning");
    this.broadcastTelemetry();
  }

  resetMission() {
    this.state = "READY";
    this.distanceTravelled = 0;
    this.currentNodeIndex = 1;
    this.ghostDistanceTravelled = 0;
    this.ghostNodeIndex = 1;
    this.ghostHazardsHit = 0;
    this.ghostSevereSlopesHit = 0;
    this.battery.reset();
    this.health.reset();

    if (this.pathNodes.length > 0) {
      this.placeRoverAt(this.pathNodes[0].x, this.pathNodes[0].y);
      this.visualizer.setRoute(this.pathNodes);
    }
    if (this.ghostPathNodes.length > 0) {
      this.placeGhostRoverAt(this.ghostPathNodes[0].x, this.ghostPathNodes[0].y);
      this.visualizer.setGhostRoute(this.ghostPathNodes);
    }

    this.logger.log("Mission reset to initial standby coordinates.", "info");
    this.broadcastTelemetry();
  }

  setSpeedMultiplier(mult) {
    this.speedMultiplier = mult;
    this.logger.log(`Simulation time acceleration set to ${mult}x.`, "info");
  }

  setTerrainMode(mode) {
    this.terrain.setVisualizationMode(mode);
    this.logger.log(`Terrain visualization switched to ${mode.toUpperCase()} view.`, "info");
  }

  setHazardsVisible(visible) {
    this.terrain.setHazardsVisible(visible);
    this.logger.log(`Hazard indicators ${visible ? "ENABLED" : "DISABLED"}.`, "info");
  }

  setGhostVisible(visible) {
    this.ghostVisible = visible;
    this.ghostRover.setVisible(visible);
    if (this.visualizer) {
      this.visualizer.setGhostVisible(visible);
    }
    this.logger.log(`Ghost Baseline Rover (Naive A*) ${visible ? "ENABLED" : "DISABLED"}.`, "info");
    this.broadcastTelemetry();
  }

  setCameraMode(mode) {
    if (mode === "follow-ghost") {
      this.cameraController.setFollowTarget(this.ghostRover);
      this.cameraController.setMode("follow");
    } else if (mode === "follow") {
      this.cameraController.setFollowTarget(this.rover);
      this.cameraController.setMode("follow");
    } else {
      this.cameraController.setMode(mode);
    }
  }

  resetCamera() {
    this.cameraController.resetCamera();
  }

  placeRoverAt(col, row) {
    this.currentPosition = { x: col, y: row };
    const worldPos = this.terrain.gridToWorld(col, row);
    const worldY = this.terrain.getWorldY(col, row);
    const normal = this.terrain.getNormalAt(col, row);

    this.currentWorldPos.set(worldPos.x, worldY, worldPos.z);
    this.rover.update(worldPos.x, worldY, worldPos.z, this.headingAngle, normal, 0);
  }

  /**
   * Main Simulation Loop
   */
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000.0);
    this.lastTime = now;

    const effectiveDt = dt * this.speedMultiplier;

    // Advance rover physics along route when RUNNING
    if (this.state === "RUNNING" && this.pathNodes.length >= 2) {
      this.advanceRover(effectiveDt);
    }

    // Advance ghost baseline rover physics simultaneously
    if (this.state === "RUNNING" && this.ghostPathNodes.length >= 2 && this.ghostNodeIndex < this.ghostPathNodes.length) {
      this.advanceGhostRover(effectiveDt);
    }

    // Update camera controls
    this.cameraController.update(dt);

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Move rover along planned path nodes with smooth interpolation.
   */
  advanceRover(deltaSeconds) {
    const effectiveSpeed = this.nominalSpeedMps; // meters per second
    let movementRemaining = effectiveSpeed * deltaSeconds;

    const cellSize = this.terrain.terrainData.cellSizeMeters;

    while (movementRemaining > 0 && this.currentNodeIndex < this.pathNodes.length) {
      const targetNode = this.pathNodes[this.currentNodeIndex];

      const dx = targetNode.x - this.currentPosition.x;
      const dy = targetNode.y - this.currentPosition.y;

      const gridDist = Math.hypot(dx, dy);
      const segmentDistMeters = gridDist * cellSize;

      if (segmentDistMeters < 1e-4) {
        this.currentPosition.x = targetNode.x;
        this.currentPosition.y = targetNode.y;
        this.currentNodeIndex++;
        continue;
      }

      // Calculate heading angle
      const worldTarget = this.terrain.gridToWorld(targetNode.x, targetNode.y);
      const targetHeading = Math.atan2(
        worldTarget.x - this.currentWorldPos.x,
        worldTarget.z - this.currentWorldPos.z
      );
      this.headingAngle = targetHeading;

      if (movementRemaining >= segmentDistMeters) {
        // Reached this waypoint
        this.currentPosition.x = targetNode.x;
        this.currentPosition.y = targetNode.y;
        this.distanceTravelled += segmentDistMeters;
        movementRemaining -= segmentDistMeters;
        this.currentNodeIndex++;
      } else {
        // Partial move along segment
        const fraction = movementRemaining / segmentDistMeters;
        this.currentPosition.x += dx * fraction;
        this.currentPosition.y += dy * fraction;
        this.distanceTravelled += movementRemaining;
        movementRemaining = 0;
      }
    }

    // Update 3D World Position & Orientation
    const worldPos = this.terrain.gridToWorld(this.currentPosition.x, this.currentPosition.y);
    const worldY = this.terrain.getWorldY(this.currentPosition.x, this.currentPosition.y);
    const normal = this.terrain.getNormalAt(this.currentPosition.x, this.currentPosition.y);

    const stepDistance = effectiveSpeed * deltaSeconds;
    this.currentWorldPos.set(worldPos.x, worldY, worldPos.z);
    this.rover.update(worldPos.x, worldY, worldPos.z, this.headingAngle, normal, stepDistance);

    // Update route visualizer progress
    if (this.visualizer) {
      this.visualizer.updateProgress(this.currentNodeIndex, this.currentWorldPos);
    }

    // Sample terrain values for battery & health models
    const currentSlope = this.terrain.getSlopeAt(this.currentPosition.x, this.currentPosition.y);
    const currentRoughness = this.terrain.getRoughnessAt(this.currentPosition.x, this.currentPosition.y);

    // Update battery simulation
    this.battery.update(deltaSeconds, effectiveSpeed, currentSlope, currentRoughness, true);

    // Update health diagnostics
    this.health.update(this.distanceTravelled, currentSlope, currentRoughness, this.battery.batteryPercentage);

    // Check mission completion
    if (this.currentNodeIndex >= this.pathNodes.length) {
      this.state = "COMPLETED";
      this.logger.log("TARGET REACHED: Mission successfully completed!", "success");
      this.logger.log(`Total distance travelled: ${this.distanceTravelled.toFixed(1)}m.`, "info");
    }

    this.broadcastTelemetry();
  }

  /**
   * Move Ghost Baseline Rover along its naive path nodes.
   */
  advanceGhostRover(deltaSeconds) {
    const effectiveSpeed = this.nominalSpeedMps; // meters per second
    let movementRemaining = effectiveSpeed * deltaSeconds;
    const cellSize = this.terrain.terrainData.cellSizeMeters;

    while (movementRemaining > 0 && this.ghostNodeIndex < this.ghostPathNodes.length) {
      const targetNode = this.ghostPathNodes[this.ghostNodeIndex];
      const dx = targetNode.x - this.ghostPosition.x;
      const dy = targetNode.y - this.ghostPosition.y;

      const gridDist = Math.hypot(dx, dy);
      const segmentDistMeters = gridDist * cellSize;

      if (segmentDistMeters < 1e-4) {
        this.ghostPosition.x = targetNode.x;
        this.ghostPosition.y = targetNode.y;
        this.ghostNodeIndex++;
        continue;
      }

      const worldTarget = this.terrain.gridToWorld(targetNode.x, targetNode.y);
      const targetHeading = Math.atan2(
        worldTarget.x - this.ghostWorldPos.x,
        worldTarget.z - this.ghostWorldPos.z
      );
      this.ghostHeadingAngle = targetHeading;

      if (movementRemaining >= segmentDistMeters) {
        this.ghostPosition.x = targetNode.x;
        this.ghostPosition.y = targetNode.y;
        this.ghostDistanceTravelled += segmentDistMeters;
        movementRemaining -= segmentDistMeters;
        this.ghostNodeIndex++;
      } else {
        const fraction = movementRemaining / segmentDistMeters;
        this.ghostPosition.x += dx * fraction;
        this.ghostPosition.y += dy * fraction;
        this.ghostDistanceTravelled += movementRemaining;
        movementRemaining = 0;
      }
    }

    // Update Ghost Rover 3D Pose
    const worldPos = this.terrain.gridToWorld(this.ghostPosition.x, this.ghostPosition.y);
    const worldY = this.terrain.getWorldY(this.ghostPosition.x, this.ghostPosition.y);
    const normal = this.terrain.getNormalAt(this.ghostPosition.x, this.ghostPosition.y);

    const stepDistance = effectiveSpeed * deltaSeconds;
    this.ghostWorldPos.set(worldPos.x, worldY, worldPos.z);
    this.ghostRover.update(worldPos.x, worldY, worldPos.z, this.ghostHeadingAngle, normal, stepDistance);

    if (this.visualizer) {
      this.visualizer.updateGhostProgress(this.ghostNodeIndex, this.ghostWorldPos);
    }

    // Monitor naive hazard penetration
    const currentSlope = this.terrain.getSlopeAt(this.ghostPosition.x, this.ghostPosition.y);
    const currentRough = this.terrain.getRoughnessAt(this.ghostPosition.x, this.ghostPosition.y);
    if (currentSlope > 15.0) {
      this.ghostSevereSlopesHit++;
    }
    if (currentRough > 1.6) {
      this.ghostHazardsHit++;
    }
  }

  /**
   * Broadcast current simulation snapshot to telemetry listeners.
   */
  broadcastTelemetry() {
    const currentElevation = this.terrain.isLoaded
      ? this.terrain.getElevationAt(this.currentPosition.x, this.currentPosition.y)
      : 120.0;
    const currentSlope = this.terrain.isLoaded
      ? this.terrain.getSlopeAt(this.currentPosition.x, this.currentPosition.y)
      : 0;
    const currentRoughness = this.terrain.isLoaded
      ? this.terrain.getRoughnessAt(this.currentPosition.x, this.currentPosition.y)
      : 0;

    const progress = this.totalPlannedDistance > 0
      ? Math.min(100, (this.distanceTravelled / this.totalPlannedDistance) * 100)
      : 0;

    const snapshot = {
      missionStatus: this.state,
      startCoord: this.startCoord,
      destCoord: this.destCoord,
      navigationMode: this.navigationMode,
      speedMultiplier: this.speedMultiplier,
      currentPosition: this.currentPosition,
      currentWorldPos: this.currentWorldPos,
      currentElevation,
      currentSlope,
      currentRoughness,
      headingDeg: Number(((this.headingAngle * 180) / Math.PI + 360) % 360).toFixed(1),
      speedMps: this.state === "RUNNING" ? this.nominalSpeedMps * this.speedMultiplier : 0,
      distanceTravelled: this.distanceTravelled,
      totalPlannedDistance: this.totalPlannedDistance,
      remainingDistance: Math.max(0, this.totalPlannedDistance - this.distanceTravelled),
      progress,
      currentNodeIndex: this.currentNodeIndex,
      totalNodes: this.pathNodes.length,
      pathNodes: this.pathNodes,
      battery: this.battery.getSnapshot(),
      health: this.health.getSnapshot(),
      ghost: {
        visible: this.ghostVisible,
        position: { ...this.ghostPosition },
        worldPos: this.ghostWorldPos,
        distanceTravelled: this.ghostDistanceTravelled,
        totalDistance: this.ghostTotalDistance,
        hazardsHit: this.ghostHazardsHit,
        severeSlopesHit: this.ghostSevereSlopesHit,
        headingDeg: Number(((this.ghostHeadingAngle * 180) / Math.PI + 360) % 360).toFixed(1),
        currentNodeIndex: this.ghostNodeIndex,
        totalNodes: this.ghostPathNodes.length,
        pathNodes: this.ghostPathNodes
      }
    };

    for (const listener of this.telemetryListeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error("Telemetry listener error:", err);
      }
    }
  }

  onTelemetry(callback) {
    this.telemetryListeners.push(callback);
  }

  onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}

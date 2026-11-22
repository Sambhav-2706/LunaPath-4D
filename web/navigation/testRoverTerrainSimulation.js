
import assert from "node:assert/strict";

import { createNavigationTerrain } from "./TerrainAdapter.js";
import { detectHazards } from "./HazardDetection.js";
import { planRoute } from "./PathPlanner.js";
import { RoverSimulator } from "./RoverSimulator.js";

console.log("===== LUNAPATH TERRAIN-TO-ROVER INTEGRATION =====\n");

// --------------------------------------------------
// 1. LOAD TERRAIN
// --------------------------------------------------

console.log("===== LOADING TERRAIN =====");

const terrain = createNavigationTerrain();

console.log("Terrain:", terrain.metadata?.name ?? "Loaded DEM");
console.log("Dimensions:", `${terrain.width} x ${terrain.height}`);
console.log("Cell size:", terrain.cellSize, "meters");

// --------------------------------------------------
// 2. DETECT HAZARDS
// --------------------------------------------------

console.log("\n===== HAZARD DETECTION =====");

const hazards = detectHazards(terrain);

console.log("Hazards detected:", hazards.length);

// Block hazardous cells from route planning.
for (const hazard of hazards) {
    terrain.traversability[hazard.index] = 0;
}

console.log("Hazard cells blocked:", hazards.length);

// --------------------------------------------------
// 3. DEFINE MISSION
// --------------------------------------------------

const start = { x: 5, y: 5 };
const goal = { x: 250, y: 250 };
const navigationMode = "BALANCED";

console.log("\n===== MISSION CONFIGURATION =====");
console.log("Start:", start);
console.log("Goal:", goal);
console.log("Navigation mode:", navigationMode);

// --------------------------------------------------
// 4. PLAN ROUTE
// --------------------------------------------------

console.log("\n===== PATH PLANNING =====");

const route = planRoute(
    terrain,
    start,
    goal,
    navigationMode
);

assert.equal(route.success, true, "Route planning failed.");
assert.ok(Array.isArray(route.path), "Route path is invalid.");
assert.ok(route.path.length > 1, "Route has insufficient nodes.");

console.log("Route success:", route.success);
console.log("Route nodes:", route.path.length);
console.log("Route distance:", route.totalDistance, "meters");
console.log("Route cost:", route.totalCost);

// --------------------------------------------------
// 5. CREATE ROVER
// --------------------------------------------------

console.log("\n===== INITIALIZING ROVER =====");

const roverSpeed = 5;

const rover = new RoverSimulator(route.path, {
    cellSize: terrain.cellSize,
    speed: roverSpeed
});

const initialState = rover.getSnapshot();

console.log("Initial state:", initialState);

assert.equal(initialState.status, "READY");
assert.deepEqual(initialState.position, start);

// --------------------------------------------------
// 6. START MISSION
// --------------------------------------------------

console.log("\n===== STARTING MISSION =====");

rover.start();

assert.equal(rover.getSnapshot().status, "RUNNING");

console.log("Rover status:", rover.getSnapshot().status);

// --------------------------------------------------
// 7. SIMULATE MOVEMENT
// --------------------------------------------------

console.log("\n===== SIMULATING ROVER MOVEMENT =====");

const totalDistance = initialState.totalDistance;
const simulationTime = totalDistance / roverSpeed;

// Simulate the entire journey with a small extra time margin.
rover.update(simulationTime + 1);

const finalState = rover.getSnapshot();

console.log("Simulation time:", simulationTime.toFixed(2), "seconds");
console.log("Final position:", finalState.position);
console.log("Distance travelled:", finalState.distanceTravelled.toFixed(2), "meters");
console.log("Remaining distance:", finalState.remainingDistance.toFixed(2), "meters");
console.log("Progress:", finalState.progress.toFixed(2), "%");
console.log("Final status:", finalState.status);

// --------------------------------------------------
// 8. VALIDATE MISSION COMPLETION
// --------------------------------------------------

console.log("\n===== MISSION VALIDATION =====");

assert.equal(finalState.status, "COMPLETED");
assert.deepEqual(finalState.position, goal);
assert.equal(finalState.remainingDistance, 0);
assert.equal(finalState.progress, 100);

console.log("Rover started correctly:", initialState.status === "READY");
console.log("Rover reached destination:", finalState.status === "COMPLETED");
console.log("Destination verified:", finalState.position);
console.log("Mission progress:", finalState.progress + "%");

// --------------------------------------------------
// 9. FINAL RESULT
// --------------------------------------------------

console.log("\n========================================");
console.log(" TERRAIN-TO-ROVER INTEGRATION PASSED");
console.log("========================================");

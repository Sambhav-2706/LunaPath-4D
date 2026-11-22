
import assert from "node:assert/strict";

import { createNavigationTerrain } from "./TerrainAdapter.js";
import { detectHazards } from "./HazardDetection.js";
import { planRoute } from "./PathPlanner.js";
import { replanRoute } from "./DynamicReplanner.js";
import { RoverSimulator } from "./RoverSimulator.js";

console.log("===== LUNAPATH DYNAMIC REPLANNING MISSION =====\n");

// --------------------------------------------------
// 1. LOAD TERRAIN
// --------------------------------------------------

console.log("===== TERRAIN INITIALIZATION =====");

const terrain = createNavigationTerrain();

console.log("Terrain:", terrain.metadata?.name ?? "DEM");
console.log("Grid:", `${terrain.width} x ${terrain.height}`);
console.log("Cell size:", terrain.cellSize, "m");

// --------------------------------------------------
// 2. INITIAL HAZARD CLASSIFICATION
// --------------------------------------------------

console.log("\n===== INITIAL HAZARD DETECTION =====");

const detectedHazards = detectHazards(terrain);

for (const hazard of detectedHazards) {
    terrain.traversability[hazard.index] = 0;
}

console.log("Initial hazards:", detectedHazards.length);

// --------------------------------------------------
// 3. DEFINE MISSION
// --------------------------------------------------

const start = { x: 5, y: 5 };
const goal = { x: 250, y: 250 };
const mode = "BALANCED";
const speed = 5;

console.log("\n===== MISSION =====");
console.log("Start:", start);
console.log("Goal:", goal);
console.log("Mode:", mode);
console.log("Rover speed:", speed, "m/s");

// --------------------------------------------------
// 4. PLAN INITIAL ROUTE
// --------------------------------------------------

console.log("\n===== INITIAL PATH PLANNING =====");

const initialRoute = planRoute(
    terrain,
    start,
    goal,
    mode
);

assert.equal(initialRoute.success, true);
assert.ok(initialRoute.path.length > 2);

const originalPath = initialRoute.path;

console.log("Initial route generated:", initialRoute.success);
console.log("Initial route nodes:", originalPath.length);

// --------------------------------------------------
// 5. START ROVER
// --------------------------------------------------

console.log("\n===== ROVER INITIALIZATION =====");

const rover = new RoverSimulator(originalPath, {
    cellSize: terrain.cellSize,
    speed
});

rover.start();

console.log("Rover status:", rover.getSnapshot().status);

// --------------------------------------------------
// 6. MOVE ROVER TO A WAYPOINT
// --------------------------------------------------

console.log("\n===== ROVER MOVEMENT BEFORE HAZARD =====");

// Move through the first two path segments to an exact waypoint.
const waypointIndex = 2;

const waypoint1 = originalPath[1];
const waypoint2 = originalPath[2];

const segment1 = Math.hypot(
    waypoint1.x - originalPath[0].x,
    waypoint1.y - originalPath[0].y
) * terrain.cellSize;

const segment2 = Math.hypot(
    waypoint2.x - waypoint1.x,
    waypoint2.y - waypoint1.y
) * terrain.cellSize;

const movementDistance = segment1 + segment2;
const movementTime = movementDistance / speed;

rover.update(movementTime);

const roverState = rover.getSnapshot();

console.log("Rover position:", roverState.position);
console.log("Distance travelled:", roverState.distanceTravelled);
console.log("Progress:", roverState.progress.toFixed(2), "%");

assert.deepEqual(
    roverState.position,
    originalPath[waypointIndex],
    "Rover did not reach the expected waypoint."
);

const currentPosition = { ...roverState.position };

console.log("Replanning position:", currentPosition);

// --------------------------------------------------
// 7. INTRODUCE NEW HAZARD AHEAD
// --------------------------------------------------

console.log("\n===== NEW HAZARD DETECTED =====");

// Select a waypoint ahead of the rover on the original route.
const hazardIndex = 20;
const hazardPosition = { ...originalPath[hazardIndex] };

assert.ok(hazardIndex > waypointIndex);
assert.ok(hazardIndex < originalPath.length - 1);

console.log("New hazard coordinates:", hazardPosition);

// --------------------------------------------------
// 8. TRIGGER DYNAMIC REPLANNING
// --------------------------------------------------

console.log("\n===== DYNAMIC REPLANNING =====");

const replanningResult = replanRoute({
    terrain,
    currentPath: originalPath,
    currentPosition,
    goal,
    newHazards: [hazardPosition],
    mode
});

console.log("Replanning status:", replanningResult.status);
console.log("Replanning successful:", replanningResult.success);
console.log("Route updated:", replanningResult.replanned);
console.log("Message:", replanningResult.message);

assert.equal(replanningResult.success, true);
assert.equal(replanningResult.replanned, true);
assert.equal(replanningResult.status, "ROUTE_UPDATED");

const newPath = replanningResult.path;

assert.ok(Array.isArray(newPath));
assert.ok(newPath.length > 1);

// --------------------------------------------------
// 9. VALIDATE NEW ROUTE
// --------------------------------------------------

console.log("\n===== NEW ROUTE VALIDATION =====");

assert.deepEqual(
    newPath[0],
    currentPosition,
    "New route must start from the rover's current position."
);

assert.deepEqual(
    newPath[newPath.length - 1],
    goal,
    "New route must reach the original goal."
);

const hazardAvoided = !newPath.some(
    (node) =>
        node.x === hazardPosition.x &&
        node.y === hazardPosition.y
);

assert.equal(
    hazardAvoided,
    true,
    "New route still crosses the introduced hazard."
);

console.log("New route nodes:", newPath.length);
console.log("New route starts at:", newPath[0]);
console.log("New route ends at:", newPath[newPath.length - 1]);
console.log("Introduced hazard avoided:", hazardAvoided);

// --------------------------------------------------
// 10. SIMULATE THE REPLANNED ROUTE
// --------------------------------------------------

console.log("\n===== ROVER CONTINUES ON REPLANNED ROUTE =====");

// This simulator represents the new route leg starting from
// the exact replanning waypoint.
const secondLegRover = new RoverSimulator(newPath, {
    cellSize: terrain.cellSize,
    speed
});

secondLegRover.start();

const secondLegInitialState = secondLegRover.getSnapshot();
const secondLegDistance = secondLegInitialState.totalDistance;
const secondLegTime = secondLegDistance / speed;

secondLegRover.update(secondLegTime + 1);

const finalState = secondLegRover.getSnapshot();

console.log("Second leg distance:", secondLegDistance.toFixed(2), "m");
console.log("Second leg simulation time:", secondLegTime.toFixed(2), "s");
console.log("Final position:", finalState.position);
console.log("Distance travelled on second leg:", finalState.distanceTravelled.toFixed(2), "m");
console.log("Remaining distance:", finalState.remainingDistance.toFixed(2), "m");
console.log("Progress:", finalState.progress.toFixed(2), "%");
console.log("Rover status:", finalState.status);

// --------------------------------------------------
// 11. MISSION VALIDATION
// --------------------------------------------------

console.log("\n===== FINAL MISSION VALIDATION =====");

assert.equal(finalState.status, "COMPLETED");
assert.deepEqual(finalState.position, goal);
assert.equal(finalState.remainingDistance, 0);
assert.equal(finalState.progress, 100);

console.log("Initial route generated: PASS");
console.log("Rover moved before hazard: PASS");
console.log("Hazard introduced ahead: PASS");
console.log("Dynamic replanning triggered: PASS");
console.log("New route starts at current position: PASS");
console.log("New route avoids hazard: PASS");
console.log("Original destination preserved: PASS");
console.log("Replanned route simulation completed: PASS");

// --------------------------------------------------
// 12. FINAL RESULT
// --------------------------------------------------

console.log("\n============================================");
console.log(" DYNAMIC REPLANNING MISSION TEST PASSED");
console.log("============================================");

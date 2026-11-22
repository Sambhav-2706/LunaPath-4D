
import assert from "node:assert/strict";

import { createNavigationTerrain } from "./TerrainAdapter.js";
import { detectHazards } from "./HazardDetection.js";
import { planRoute } from "./PathPlanner.js";
import { replanRoute } from "./DynamicReplanner.js";
import { MissionController } from "./MissionController.js";

console.log("===== LUNAPATH CONTINUOUS MISSION CONTROLLER =====\n");

// 1. LOAD TERRAIN

const terrain = createNavigationTerrain();

console.log("Terrain loaded:", terrain.metadata?.name);
console.log("Dimensions:", terrain.width, "x", terrain.height);
console.log("Cell size:", terrain.cellSize, "m");

// 2. INITIAL HAZARDS

const hazards = detectHazards(terrain);

for (const hazard of hazards) {
    terrain.traversability[hazard.index] = 0;
}

console.log("Initial hazards:", hazards.length);

// 3. MISSION CONFIGURATION

const start = { x: 5, y: 5 };
const goal = { x: 250, y: 250 };
const speed = 5;
const mode = "BALANCED";

console.log("\n===== MISSION SETUP =====");
console.log("Start:", start);
console.log("Goal:", goal);
console.log("Speed:", speed, "m/s");
console.log("Mode:", mode);

// 4. PLAN INITIAL ROUTE

const initialRoute = planRoute(terrain, start, goal, mode);

assert.equal(initialRoute.success, true);

const initialPath = initialRoute.path;

console.log("\nInitial route nodes:", initialPath.length);

// 5. CREATE CONTROLLER

const mission = new MissionController(initialPath, {
    cellSize: terrain.cellSize,
    speed
});

console.log("\nInitial mission state:");
console.log(mission.getSnapshot());

// 6. START MISSION

mission.start();

console.log("\nMission started:", mission.getSnapshot().status);

// 7. MOVE TO A WAYPOINT

const waypointIndex = 2;

const waypoint1 = initialPath[1];
const waypoint2 = initialPath[waypointIndex];

const firstSegment = Math.hypot(
    waypoint1.x - initialPath[0].x,
    waypoint1.y - initialPath[0].y
) * terrain.cellSize;

const secondSegment = Math.hypot(
    waypoint2.x - waypoint1.x,
    waypoint2.y - waypoint1.y
) * terrain.cellSize;

const firstLegDistance = firstSegment + secondSegment;
const firstLegTime = firstLegDistance / speed;

mission.update(firstLegTime);

const beforeReplan = mission.getSnapshot();

console.log("\n===== BEFORE REPLANNING =====");
console.log("Position:", beforeReplan.position);
console.log("Distance travelled:", beforeReplan.distanceTravelled);
console.log("Progress:", beforeReplan.progress.toFixed(2), "%");
console.log("Status:", beforeReplan.status);

assert.deepEqual(beforeReplan.position, initialPath[waypointIndex]);
assert.ok(beforeReplan.distanceTravelled > 0);

// 8. INTRODUCE A HAZARD

const hazardIndex = 20;
const hazard = { ...initialPath[hazardIndex] };

console.log("\n===== NEW HAZARD =====");
console.log("Hazard location:", hazard);

// 9. REPLAN

const replanning = replanRoute({
    terrain,
    currentPath: initialPath,
    currentPosition: beforeReplan.position,
    goal,
    newHazards: [hazard],
    mode
});

console.log("\n===== REPLANNING RESULT =====");
console.log("Status:", replanning.status);
console.log("Successful:", replanning.success);
console.log("Route updated:", replanning.replanned);

assert.equal(replanning.success, true);
assert.equal(replanning.replanned, true);

// 10. SWITCH THE EXISTING MISSION ROUTE

const afterSwitch = mission.switchRoute(
    replanning.path,
    hazard
);

console.log("\n===== CONTINUOUS ROUTE SWITCH =====");
console.log("Position preserved:", afterSwitch.position);
console.log("Distance preserved:", afterSwitch.distanceTravelled);
console.log("Remaining distance:", afterSwitch.remainingDistance);
console.log("Mission progress:", afterSwitch.progress.toFixed(2), "%");
console.log("Mission status:", afterSwitch.status);
console.log("Hazard history:", afterSwitch.hazards);

// 11. VALIDATE STATE PRESERVATION

assert.deepEqual(afterSwitch.position, beforeReplan.position);

assert.equal(
    afterSwitch.distanceTravelled,
    beforeReplan.distanceTravelled,
    "Previous travel distance was not preserved."
);

assert.equal(afterSwitch.status, "RUNNING");
assert.equal(afterSwitch.hazardCount, 1);

// 12. CONTINUE THE SAME MISSION

console.log("\n===== CONTINUE MISSION =====");

const remaining = mission.getRemainingDistance();
mission.update((remaining / speed) + 1);

const finalState = mission.getSnapshot();

console.log("Final position:", finalState.position);
console.log("Total mission distance:", finalState.distanceTravelled);
console.log("Remaining distance:", finalState.remainingDistance);
console.log("Progress:", finalState.progress.toFixed(2), "%");
console.log("Status:", finalState.status);

// 13. FINAL VALIDATION

assert.equal(finalState.status, "COMPLETED");
assert.deepEqual(finalState.position, goal);
assert.equal(finalState.remainingDistance, 0);
assert.equal(finalState.progress, 100);

console.log("\n===== MISSION EVENT HISTORY =====");

for (const event of mission.getEventHistory()) {
    console.log(
        event.type,
        "| Position:",
        event.position,
        "| Distance:",
        event.timestamp
    );
}

// 14. SUCCESS

console.log("\n============================================");
console.log(" CONTINUOUS MISSION CONTROLLER TEST PASSED");
console.log("============================================");

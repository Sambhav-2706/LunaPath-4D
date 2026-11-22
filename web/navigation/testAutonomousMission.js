
import { planRoute } from "./PathPlanner.js";
import { MissionController } from "./MissionController.js";
import { AutonomousMission } from "./AutonomousMission.js";

function assert(condition, message) {
    if (!condition) {
        throw new Error(`TEST FAILED: ${message}`);
    }
}

function calculateDistance(a, b, cellSize) {
    return Math.hypot(b.x - a.x, b.y - a.y) * cellSize;
}

function calculatePathDistance(path, cellSize) {
    let distance = 0;

    for (let i = 1; i < path.length; i++) {
        distance += calculateDistance(path[i - 1], path[i], cellSize);
    }

    return distance;
}

console.log("===== AUTONOMOUS MISSION TEST =====");

// --------------------------------------------------
// 1. CREATE TEST TERRAIN
// --------------------------------------------------

const width = 30;
const height = 30;
const cellSize = 10;

const terrain = {
    width,
    height,
    cellSize,
    elevation: new Float32Array(width * height),
    slope: new Float32Array(width * height),
    roughness: new Float32Array(width * height),
    traversability: new Uint8Array(width * height)
};

terrain.traversability.fill(1);

console.log("\n===== TERRAIN CREATED =====");
console.log("Dimensions:", width, "x", height);
console.log("Cell size:", cellSize, "m");

// --------------------------------------------------
// 2. PLAN INITIAL ROUTE
// --------------------------------------------------

const start = { x: 5, y: 5 };
const goal = { x: 25, y: 25 };

const routeResult = planRoute(
    terrain,
    start,
    goal,
    "BALANCED"
);

assert(routeResult.success, "Initial route planning failed.");
assert(Array.isArray(routeResult.path), "Initial route path is missing.");
assert(routeResult.path.length > 2, "Initial route is too short.");

console.log("\n===== INITIAL ROUTE =====");
console.log("Route nodes:", routeResult.path.length);
console.log("Route distance:", calculatePathDistance(routeResult.path, cellSize), "m");

// --------------------------------------------------
// 3. CREATE MISSION
// --------------------------------------------------

const mission = new MissionController(routeResult.path, {
    cellSize,
    speed: 5
});

const autonomousMission = new AutonomousMission(
    terrain,
    mission,
    "BALANCED"
);

console.log("\n===== MISSION CREATED =====");
console.log("Mission status:", mission.getSnapshot().status);

// --------------------------------------------------
// 4. START ROVER
// --------------------------------------------------

mission.start();

assert(mission.getSnapshot().status === "RUNNING", "Mission did not start.");

console.log("\n===== ROVER STARTED =====");

// --------------------------------------------------
// 5. MOVE ROVER TO A KNOWN POSITION
// --------------------------------------------------

const waypointIndex = 2;
const waypoint = mission.currentPath[waypointIndex];

let distanceToWaypoint = 0;

for (let i = 1; i <= waypointIndex; i++) {
    distanceToWaypoint += calculateDistance(
        mission.currentPath[i - 1],
        mission.currentPath[i],
        cellSize
    );
}

const movementTime = distanceToWaypoint / mission.speed;

mission.update(movementTime);

const positionBeforeHazard = mission.getPosition();
const snapshotBeforeHazard = mission.getSnapshot();

assert(
    positionBeforeHazard.x === waypoint.x &&
    positionBeforeHazard.y === waypoint.y,
    "Rover did not reach the expected waypoint."
);

console.log("\n===== BEFORE HAZARD =====");
console.log("Position:", positionBeforeHazard);
console.log("Distance travelled:", snapshotBeforeHazard.distanceTravelled);
console.log("Progress:", snapshotBeforeHazard.progress.toFixed(2), "%");

// --------------------------------------------------
// 6. INJECT A HAZARD AHEAD ON THE CURRENT ROUTE
// --------------------------------------------------

const hazardIndex = Math.min(10, mission.currentPath.length - 2);

const hazard = {
    x: mission.currentPath[hazardIndex].x,
    y: mission.currentPath[hazardIndex].y,
    type: "NEW_OBSTACLE",
    severity: "HIGH"
};

console.log("\n===== NEW HAZARD DETECTED =====");
console.log("Hazard:", hazard);

// --------------------------------------------------
// 7. AUTONOMOUS HAZARD RESPONSE
// --------------------------------------------------

const autonomousResult = autonomousMission.handleHazard(hazard);

console.log("\n===== AUTONOMOUS RESPONSE =====");
console.log("Status:", autonomousResult.status);
console.log("Success:", autonomousResult.success);
console.log("Message:", autonomousResult.message);

assert(
    autonomousResult.success,
    "Autonomous hazard handling failed."
);

assert(
    autonomousResult.status === "AUTONOMOUS_REPLAN_COMPLETED",
    "Expected autonomous route replanning."
);

// --------------------------------------------------
// 8. VERIFY ROUTE SWITCH
// --------------------------------------------------

const positionAfterReplan = mission.getPosition();
const snapshotAfterReplan = mission.getSnapshot();

assert(
    positionAfterReplan.x === positionBeforeHazard.x &&
    positionAfterReplan.y === positionBeforeHazard.y,
    "Rover position changed during route switching."
);

assert(
    snapshotAfterReplan.distanceTravelled >= snapshotBeforeHazard.distanceTravelled,
    "Mission distance was lost during route switching."
);

assert(
    mission.currentPath.some(
        node => node.x === goal.x && node.y === goal.y
    ),
    "New route does not reach the original goal."
);

assert(
    !mission.currentPath.some(
        node => node.x === hazard.x && node.y === hazard.y
    ),
    "Replanned route still contains the hazard."
);

console.log("\n===== ROUTE SWITCH VERIFIED =====");
console.log("Position preserved:", positionAfterReplan);
console.log("New route nodes:", mission.currentPath.length);
console.log("Original goal preserved:", mission.goal);
console.log("Hazard avoided:", true);
console.log("Distance preserved:", snapshotAfterReplan.distanceTravelled);

// --------------------------------------------------
// 9. CONTINUE AUTONOMOUS MISSION
// --------------------------------------------------

console.log("\n===== CONTINUING MISSION =====");

let safetyCounter = 0;

while (
    mission.getSnapshot().status === "RUNNING" &&
    safetyCounter < 10000
) {
    mission.update(10);
    safetyCounter++;
}

const finalSnapshot = mission.getSnapshot();

assert(
    finalSnapshot.status === "COMPLETED",
    "Mission failed to complete."
);

assert(
    finalSnapshot.position.x === goal.x &&
    finalSnapshot.position.y === goal.y,
    "Rover did not reach the final destination."
);

assert(
    finalSnapshot.remainingDistance === 0,
    "Remaining distance is not zero."
);

// --------------------------------------------------
// 10. VERIFY AUTONOMOUS MISSION STATISTICS
// --------------------------------------------------

const autonomousSnapshot = autonomousMission.getSnapshot();
const eventHistory = mission.getEventHistory();

assert(
    autonomousSnapshot.replanningCount === 1,
    "Expected exactly one successful autonomous replan."
);

assert(
    autonomousSnapshot.hazardsHandled === 1,
    "Hazard tracking failed."
);

assert(
    eventHistory.some(event => event.type === "ROUTE_SWITCHED"),
    "Route switch event is missing."
);

assert(
    eventHistory.some(event => event.type === "MISSION_COMPLETED"),
    "Mission completion event is missing."
);

// --------------------------------------------------
// 11. FINAL REPORT
// --------------------------------------------------

console.log("\n===== FINAL MISSION REPORT =====");

console.log("Mission status:", finalSnapshot.status);
console.log("Final position:", finalSnapshot.position);
console.log("Goal:", finalSnapshot.goal);
console.log("Total distance:", finalSnapshot.distanceTravelled.toFixed(2), "m");
console.log("Remaining distance:", finalSnapshot.remainingDistance.toFixed(2), "m");
console.log("Progress:", finalSnapshot.progress.toFixed(2), "%");
console.log("Autonomous replans:", autonomousSnapshot.replanningCount);
console.log("Hazards handled:", autonomousSnapshot.hazardsHandled);
console.log("Mission events:", eventHistory.length);
console.log("Simulation update cycles:", safetyCounter);

console.log("\n===== AUTONOMOUS MISSION TEST PASSED =====");

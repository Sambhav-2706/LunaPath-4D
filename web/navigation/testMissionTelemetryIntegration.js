
import { writeFileSync } from "node:fs";
import { planRoute } from "./PathPlanner.js";
import { MissionController } from "./MissionController.js";
import { AutonomousMission } from "./AutonomousMission.js";
import { MissionTelemetry } from "./MissionTelemetry.js";

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

function assert(condition, message) {
    if (!condition) {
        throw new Error(`TEST FAILED: ${message}`);
    }
}

console.log("===== REAL MISSION TELEMETRY INTEGRATION TEST =====");

// 1. CREATE TERRAIN
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

console.log("\n===== TERRAIN =====");
console.log("Dimensions:", width, "x", height);
console.log("Cell size:", cellSize, "m");

// 2. PLAN ROUTE
const start = { x: 5, y: 5 };
const goal = { x: 25, y: 25 };

const routeResult = planRoute(terrain, start, goal, "BALANCED");

assert(routeResult.success, "Initial route planning failed.");
assert(Array.isArray(routeResult.path), "Route path is missing.");

console.log("\n===== INITIAL ROUTE =====");
console.log("Nodes:", routeResult.path.length);
console.log(
    "Distance:",
    calculatePathDistance(routeResult.path, cellSize).toFixed(2),
    "m"
);

// 3. CREATE MISSION COMPONENTS
const mission = new MissionController(routeResult.path, {
    cellSize,
    speed: 5
});

const autonomousMission = new AutonomousMission(
    terrain,
    mission,
    "BALANCED"
);

const telemetry = new MissionTelemetry(
    mission,
    autonomousMission
);

telemetry.record("MISSION_CREATED");

console.log("\n===== TELEMETRY INITIALIZED =====");
console.log("Snapshots:", telemetry.getReport().totalSnapshots);

// 4. START MISSION
mission.start();

assert(
    mission.getSnapshot().status === "RUNNING",
    "Mission failed to start."
);

telemetry.record("MISSION_STARTED");

console.log("\n===== MISSION STARTED =====");
console.log("Status:", mission.getSnapshot().status);

// 5. MOVE ROVER TO WAYPOINT
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

mission.update(distanceToWaypoint / mission.speed);

const beforeHazard = mission.getSnapshot();

assert(
    beforeHazard.position.x === waypoint.x &&
    beforeHazard.position.y === waypoint.y,
    "Rover did not reach expected waypoint."
);

telemetry.record("ROVER_MOVED");

console.log("\n===== ROVER MOVEMENT RECORDED =====");
console.log("Position:", beforeHazard.position);
console.log("Distance:", beforeHazard.distanceTravelled.toFixed(2), "m");
console.log("Progress:", beforeHazard.progress.toFixed(2), "%");

// 6. INTRODUCE HAZARD
const hazardIndex = Math.min(10, mission.currentPath.length - 2);

const hazard = {
    x: mission.currentPath[hazardIndex].x,
    y: mission.currentPath[hazardIndex].y,
    type: "NEW_OBSTACLE",
    severity: "HIGH"
};

console.log("\n===== HAZARD DETECTED =====");
console.log("Hazard:", hazard);

// 7. AUTONOMOUS REPLANNING
const autonomousResult = autonomousMission.handleHazard(hazard);

assert(autonomousResult.success, "Autonomous replanning failed.");

assert(
    autonomousResult.status === "AUTONOMOUS_REPLAN_COMPLETED",
    "Unexpected autonomous replan result."
);

telemetry.record("HAZARD_AVOIDED");

const afterReplan = mission.getSnapshot();

assert(
    afterReplan.position.x === beforeHazard.position.x &&
    afterReplan.position.y === beforeHazard.position.y,
    "Rover position changed during route switching."
);

assert(
    !mission.currentPath.some(
        node => node.x === hazard.x && node.y === hazard.y
    ),
    "Replanned route still crosses the hazard."
);

assert(
    mission.currentPath.some(
        node => node.x === goal.x && node.y === goal.y
    ),
    "Replanned route lost the original goal."
);

console.log("\n===== REPLANNING RECORDED =====");
console.log("Status:", autonomousResult.status);
console.log("Route nodes:", mission.currentPath.length);
console.log("Position preserved:", afterReplan.position);
console.log("Hazard avoided: true");

// 8. CONTINUE MISSION
console.log("\n===== CONTINUING MISSION =====");

let cycles = 0;

while (
    mission.getSnapshot().status === "RUNNING" &&
    cycles < 10000
) {
    mission.update(10);
    cycles++;
}

const finalSnapshot = mission.getSnapshot();

assert(finalSnapshot.status === "COMPLETED", "Mission failed to complete.");

assert(
    finalSnapshot.position.x === goal.x &&
    finalSnapshot.position.y === goal.y,
    "Rover did not reach goal."
);

telemetry.record("MISSION_COMPLETED");

// 9. VERIFY TELEMETRY
const report = telemetry.getReport();

assert(report.totalSnapshots === 5, "Expected five telemetry snapshots.");
assert(report.missionStatus === "COMPLETED", "Mission status incorrect.");
assert(report.autonomousReplans === 1, "Replan count incorrect.");
assert(report.hazardsHandled === 1, "Hazard count incorrect.");
assert(report.totalEvents > 0, "Event log is empty.");

// 10. EXPORT JSON
const jsonReport = telemetry.exportJSON();

const outputPath = "./navigation/mission-telemetry-report.json";

writeFileSync(outputPath, jsonReport, "utf8");

const exportedReport = JSON.parse(jsonReport);

assert(
    exportedReport.missionStatus === "COMPLETED",
    "Exported mission status incorrect."
);

assert(
    exportedReport.snapshots.length === 5,
    "Exported snapshot count incorrect."
);

// 11. FINAL REPORT
console.log("\n===== FINAL TELEMETRY REPORT =====");
console.log("Mission status:", report.missionStatus);
console.log("Total snapshots:", report.totalSnapshots);
console.log("Total logged events:", report.totalEvents);
console.log("Autonomous replans:", report.autonomousReplans);
console.log("Hazards handled:", report.hazardsHandled);
console.log("Final position:", finalSnapshot.position);
console.log("Goal:", finalSnapshot.goal);
console.log("Total distance:", finalSnapshot.distanceTravelled.toFixed(2), "m");
console.log("Progress:", finalSnapshot.progress.toFixed(2), "%");
console.log("Update cycles:", cycles);
console.log("JSON export:", outputPath);
console.log("JSON size:", jsonReport.length, "characters");

console.log("\n===== REAL MISSION TELEMETRY INTEGRATION PASSED =====");

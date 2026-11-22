
import { planRoute } from "./PathPlanner.js";
import { MissionController } from "./MissionController.js";
import { AutonomousMission } from "./AutonomousMission.js";
import { MissionTelemetry } from "./MissionTelemetry.js";

console.log("===== MULTIPLE HAZARD MISSION TEST =====");

// 1. Create controlled terrain
const width = 30;
const height = 30;
const cellCount = width * height;

const terrain = {
    width,
    height,
    cellSize: 10,
    slope: new Float32Array(cellCount).fill(0),
    roughness: new Float32Array(cellCount).fill(0),
    traversability: new Uint8Array(cellCount).fill(1)
};

// 2. Plan initial route
const planningResult = planRoute(
    terrain,
    { x: 5, y: 5 },
    { x: 25, y: 25 },
    "BALANCED"
);

if (!planningResult.success) {
    throw new Error("Initial route planning failed.");
}

console.log("\n===== INITIAL ROUTE =====");
console.log("Path nodes:", planningResult.pathNodes);
console.log("Distance:", planningResult.totalDistanceMeters);

// 3. Create mission controller
const mission = new MissionController(
    planningResult.path,
    {
        cellSize: terrain.cellSize,
        speed: 5
    }
);

// 4. Create autonomous mission
const autonomousMission = new AutonomousMission(
    terrain,
    mission,
    "BALANCED"
);

// 5. Initialize telemetry with both controllers
const telemetry = new MissionTelemetry(
    mission,
    autonomousMission
);

telemetry.record("MISSION_INITIALIZED");

console.log("\n===== TELEMETRY INITIALIZED =====");

// 6. Start mission
mission.start();
telemetry.record("MISSION_STARTED");

console.log("\n===== MISSION STARTED =====");
console.log("Status:", mission.getSnapshot().status);

// Move rover forward
for (let i = 0; i < 3; i++) {
    mission.update(1);
}

telemetry.record("ROVER_MOVED");

let currentPosition = mission.getPosition();

console.log("\n===== ROVER MOVEMENT =====");
console.log("Position:", currentPosition);
console.log("Distance:", mission.getSnapshot().distanceTravelled);

// ==================================================
// HAZARD 1
// ==================================================

const firstHazardIndex = 10;

if (mission.currentPath.length <= firstHazardIndex) {
    throw new Error("Initial route is too short for hazard test.");
}

const firstHazard = {
    x: mission.currentPath[firstHazardIndex].x,
    y: mission.currentPath[firstHazardIndex].y,
    type: "NEW_OBSTACLE",
    severity: "HIGH"
};

console.log("\n===== FIRST HAZARD =====");
console.log("Hazard:", firstHazard);

const firstDecision = autonomousMission.handleHazard(firstHazard);

console.log("Status:", firstDecision.status);

if (!firstDecision.success) {
    throw new Error(
        `First hazard replanning failed: ${firstDecision.message}`
    );
}

telemetry.record("FIRST_REPLAN");

// Verify first hazard is avoided
const firstUpdatedPath = mission.currentPath;

const firstHazardAvoided = !firstUpdatedPath.some(
    node =>
        node.x === firstHazard.x &&
        node.y === firstHazard.y
);

if (!firstHazardAvoided) {
    throw new Error("Updated route still contains first hazard.");
}

console.log("First hazard avoided successfully.");

// ==================================================
// HAZARD 2
// ==================================================

const secondHazardIndex = 15;

if (mission.currentPath.length <= secondHazardIndex) {
    throw new Error("Replanned route is too short for second hazard.");
}

const secondHazard = {
    x: mission.currentPath[secondHazardIndex].x,
    y: mission.currentPath[secondHazardIndex].y,
    type: "NEW_OBSTACLE",
    severity: "HIGH"
};

if (
    firstHazard.x === secondHazard.x &&
    firstHazard.y === secondHazard.y
) {
    throw new Error("Second hazard overlaps the first hazard.");
}

console.log("\n===== SECOND HAZARD =====");
console.log("Hazard:", secondHazard);

const secondDecision = autonomousMission.handleHazard(secondHazard);

console.log("Status:", secondDecision.status);

if (!secondDecision.success) {
    throw new Error(
        `Second hazard replanning failed: ${secondDecision.message}`
    );
}

telemetry.record("SECOND_REPLAN");

// Verify both hazards remain avoided
const secondUpdatedPath = mission.currentPath;

const bothHazardsAvoided = [firstHazard, secondHazard].every(
    hazard =>
        !secondUpdatedPath.some(
            node =>
                node.x === hazard.x &&
                node.y === hazard.y
        )
);

if (!bothHazardsAvoided) {
    throw new Error("Updated route crossed a previously detected hazard.");
}

console.log("Both hazards avoided successfully.");

// ==================================================
// MISSION CONTINUITY
// ==================================================

currentPosition = mission.getPosition();

console.log("\n===== MISSION CONTINUITY =====");
console.log("Current position:", currentPosition);
console.log("Mission status:", mission.getSnapshot().status);
console.log("Original goal:", mission.goal);

if (mission.getSnapshot().status !== "RUNNING") {
    throw new Error("Mission stopped after hazard replanning.");
}

// 7. Continue mission until completion
let cycles = 0;
const maxCycles = 1000;

while (mission.getSnapshot().status === "RUNNING") {
    mission.update(1);
    cycles++;

    if (cycles > maxCycles) {
        throw new Error("Mission exceeded maximum simulation cycles.");
}

}

telemetry.record("MISSION_COMPLETED");

// 8. Collect final results
const finalMission = mission.getSnapshot();
const finalAutonomous = autonomousMission.getSnapshot();
const finalTelemetry = telemetry.getReport();

console.log("\n===== FINAL MISSION RESULTS =====");
console.log("Status:", finalMission.status);
console.log("Final position:", finalMission.position);
console.log("Distance travelled:", finalMission.distanceTravelled);
console.log("Replanning count:", finalAutonomous.replanningCount);
console.log("Hazards handled:", finalAutonomous.hazardsHandled);
console.log("Mission cycles:", cycles);
console.log("Snapshots recorded:", finalTelemetry.totalSnapshots);
console.log("Events recorded:", finalTelemetry.totalEvents);

// 9. Validate mission completion
if (finalMission.status !== "COMPLETED") {
    throw new Error("Mission did not complete successfully.");
}

if (finalAutonomous.replanningCount !== 2) {
    throw new Error("Expected exactly 2 replanning operations.");
}

if (finalAutonomous.hazardsHandled !== 2) {
    throw new Error("Expected exactly 2 handled hazards.");
}

if (finalTelemetry.totalSnapshots !== 6) {
    throw new Error(
        `Expected 6 telemetry snapshots, got ${finalTelemetry.totalSnapshots}`
    );
}

// Verify both hazards are stored in history
if (finalAutonomous.hazardHistory.length !== 2) {
    throw new Error("Hazard history should contain exactly 2 hazards.");
}

// 10. Export telemetry report
const report = telemetry.exportJSON();

console.log("\n===== TELEMETRY EXPORT =====");
console.log("JSON report length:", report.length);
console.log("Report generated successfully.");

console.log("\n===== MULTIPLE HAZARD MISSION TEST PASSED =====");

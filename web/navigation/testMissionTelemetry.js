
import assert from "node:assert/strict";
import { MissionTelemetry } from "./MissionTelemetry.js";

console.log("===== LUNAPATH MISSION TELEMETRY TEST =====\n");

const mockMission = {
    status: "READY",
    position: { x: 5, y: 5 },
    distanceTravelled: 0,
    remainingDistance: 282.84,
    progress: 0,
    events: [],

    getSnapshot() {
        return {
            status: this.status,
            position: { ...this.position },
            distanceTravelled: this.distanceTravelled,
            remainingDistance: this.remainingDistance,
            progress: this.progress
        };
    },

    getEventHistory() {
        return this.events;
    }
};

const mockAutonomous = {
    replanningCount: 0,
    hazardsHandled: 0,
    lastDecision: null,

    getSnapshot() {
        return {
            replanningCount: this.replanningCount,
            hazardsHandled: this.hazardsHandled,
            lastDecision: this.lastDecision
        };
    }
};

const telemetry = new MissionTelemetry(
    mockMission,
    mockAutonomous
);

// 1. Mission created
console.log("===== STAGE 1: MISSION CREATED =====");

telemetry.record("MISSION_CREATED");

assert.equal(telemetry.getLatestSnapshot().mission.status, "READY");

console.log("Snapshot recorded.");
console.log("Status:", telemetry.getLatestSnapshot().mission.status);

// 2. Mission starts
console.log("\n===== STAGE 2: MISSION STARTED =====");

mockMission.status = "RUNNING";

mockMission.events.push({
    type: "MISSION_STARTED",
    position: { x: 5, y: 5 },
    distance: 0
});

telemetry.record("MISSION_STARTED");

assert.equal(telemetry.getLatestSnapshot().mission.status, "RUNNING");

console.log("Snapshot recorded.");
console.log("Status:", telemetry.getLatestSnapshot().mission.status);

// 3. Rover moves
console.log("\n===== STAGE 3: ROVER MOVEMENT =====");

mockMission.position = { x: 7, y: 7 };
mockMission.distanceTravelled = 28.284;
mockMission.remainingDistance = 254.556;
mockMission.progress = 10;

mockMission.events.push({
    type: "ROVER_MOVED",
    position: { x: 7, y: 7 },
    distance: 28.284
});

telemetry.record("ROVER_MOVED");

assert.equal(
    telemetry.getLatestSnapshot().mission.position.x,
    7
);

console.log("Position:", mockMission.position);
console.log("Distance travelled:", mockMission.distanceTravelled);

// 4. Autonomous hazard response
console.log("\n===== STAGE 4: HAZARD RESPONSE =====");

mockAutonomous.replanningCount = 1;
mockAutonomous.hazardsHandled = 1;
mockAutonomous.lastDecision = {
    success: true,
    status: "AUTONOMOUS_REPLAN_COMPLETED",
    hazard: { x: 15, y: 15 }
};

mockMission.events.push({
    type: "REPLANNING_STARTED",
    position: { x: 7, y: 7 },
    distance: 28.284
});

mockMission.events.push({
    type: "ROUTE_SWITCHED",
    position: { x: 7, y: 7 },
    distance: 28.284
});

telemetry.record("HAZARD_AVOIDED");

assert.equal(
    telemetry.getLatestSnapshot().autonomous.replanningCount,
    1
);

console.log("Replans:", mockAutonomous.replanningCount);
console.log("Hazards handled:", mockAutonomous.hazardsHandled);

// 5. Mission completed
console.log("\n===== STAGE 5: MISSION COMPLETED =====");

mockMission.status = "COMPLETED";
mockMission.position = { x: 25, y: 25 };
mockMission.distanceTravelled = 294.56;
mockMission.remainingDistance = 0;
mockMission.progress = 100;

mockMission.events.push({
    type: "MISSION_COMPLETED",
    position: { x: 25, y: 25 },
    distance: 294.56
});

telemetry.record("MISSION_COMPLETED");

assert.equal(telemetry.getLatestSnapshot().mission.status, "COMPLETED");
assert.equal(telemetry.getLatestSnapshot().mission.progress, 100);

// 6. Verify report
console.log("\n===== TELEMETRY REPORT =====");

const report = telemetry.getReport();

console.log("Total snapshots:", report.totalSnapshots);
console.log("Total events:", report.totalEvents);
console.log("Mission status:", report.missionStatus);
console.log("Autonomous replans:", report.autonomousReplans);
console.log("Hazards handled:", report.hazardsHandled);

assert.equal(report.totalSnapshots, 5);
assert.equal(report.missionStatus, "COMPLETED");
assert.equal(report.autonomousReplans, 1);
assert.equal(report.hazardsHandled, 1);

// 7. Verify JSON export
console.log("\n===== JSON EXPORT TEST =====");

const exportedJSON = telemetry.exportJSON();
const parsedJSON = JSON.parse(exportedJSON);

assert.equal(parsedJSON.totalSnapshots, 5);
assert.equal(parsedJSON.missionStatus, "COMPLETED");

console.log("JSON export valid.");
console.log("Export size:", exportedJSON.length, "characters");

// 8. Verify clear function
console.log("\n===== CLEAR TEST =====");

telemetry.clear();

assert.equal(telemetry.getReport().totalSnapshots, 0);
assert.equal(telemetry.getReport().totalEvents, 0);
assert.equal(telemetry.getLatestSnapshot(), null);

console.log("Telemetry successfully cleared.");

console.log("\n===== ALL TELEMETRY TESTS PASSED =====");

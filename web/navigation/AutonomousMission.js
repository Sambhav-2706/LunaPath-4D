
import { replanRoute } from "./DynamicReplanner.js";

export class AutonomousMission {
    constructor(terrain, mission, mode = "BALANCED") {
        if (!terrain) {
            throw new Error("Terrain is required.");
        }

        if (!mission) {
            throw new Error("MissionController instance is required.");
        }

        this.terrain = terrain;
        this.mission = mission;
        this.mode = mode;

        this.hazardHistory = [];
        this.replanningCount = 0;
        this.lastDecision = null;
    }

    handleHazard(hazard) {
        if (
            !hazard ||
            typeof hazard.x !== "number" ||
            typeof hazard.y !== "number"
        ) {
            return {
                success: false,
                status: "INVALID_HAZARD",
                message: "Invalid hazard coordinates."
            };
        }

        const missionSnapshot = this.mission.getSnapshot();

        if (missionSnapshot.status !== "RUNNING") {
            return {
                success: false,
                status: "MISSION_NOT_RUNNING",
                message: "Hazard handling requires an active mission.",
                missionStatus: missionSnapshot.status
            };
        }

        const currentPosition = this.mission.getPosition();

        // Include all previously detected hazards in every replanning attempt.
        const allKnownHazards = [
            ...this.hazardHistory,
            hazard
        ];

        const replanningResult = replanRoute({
            terrain: this.terrain,
            currentPath: this.mission.currentPath,
            currentPosition,
            goal: this.mission.goal,
            newHazards: allKnownHazards,
            mode: this.mode
        });

        if (!replanningResult.success) {
            this.lastDecision = {
                success: false,
                status: "REPLANNING_FAILED",
                hazard,
                position: currentPosition,
                message: replanningResult.message
            };

            return this.lastDecision;
        }

        if (!replanningResult.replanned) {
            this.lastDecision = {
                success: true,
                status: "ROUTE_UNCHANGED",
                hazard,
                position: currentPosition,
                message: "Hazard detected. Current route does not require modification."
            };

            return this.lastDecision;
        }

        const routeSwitchResult = this.mission.switchRoute(
            replanningResult.path,
            hazard
        );

        // MissionController.switchRoute() returns a mission snapshot,
        // not an object containing a success boolean.
        if (routeSwitchResult.status !== "RUNNING") {
            this.lastDecision = {
                success: false,
                status: "ROUTE_SWITCH_FAILED",
                hazard,
                position: currentPosition,
                replanningResult,
                routeSwitchResult
            };

            return this.lastDecision;
        }

        this.hazardHistory.push({
            ...hazard,
            detectedAt: { ...currentPosition }
        });

        this.replanningCount++;

        this.lastDecision = {
            success: true,
            status: "AUTONOMOUS_REPLAN_COMPLETED",
            hazard,
            previousPosition: currentPosition,
            newPath: replanningResult.path,
            replanningResult,
            routeSwitchResult,
            replanningCount: this.replanningCount,
            message: "Hazards avoided. Mission continues on the updated route."
        };

        return this.lastDecision;
    }

    getSnapshot() {
        return {
            mode: this.mode,
            replanningCount: this.replanningCount,
            hazardsHandled: this.hazardHistory.length,
            hazardHistory: this.hazardHistory.map(hazard => ({
                ...hazard,
                detectedAt: { ...hazard.detectedAt }
            })),
            lastDecision: this.lastDecision,
            mission: this.mission.getSnapshot()
        };
    }
}

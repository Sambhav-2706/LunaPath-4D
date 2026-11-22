
import { RoverSimulator } from "./RoverSimulator.js";

export class MissionController {
    constructor(initialPath, options = {}) {
        if (!Array.isArray(initialPath) || initialPath.length < 2) {
            throw new Error("Mission requires a valid path.");
        }

        this.cellSize = options.cellSize ?? 10;
        this.speed = options.speed ?? 5;

        this.originalStart = { ...initialPath[0] };
        this.goal = { ...initialPath[initialPath.length - 1] };

        this.currentPath = initialPath.map(node => ({ ...node }));

        this.distanceTravelled = 0;
        this.lastRecordedRoverDistance = 0;

        this.hazardHistory = [];
        this.events = [];

        this.status = "READY";

        this.rover = new RoverSimulator(this.currentPath, {
            cellSize: this.cellSize,
            speed: this.speed
        });

        this.recordEvent("MISSION_CREATED");
    }

    calculatePathDistance(path) {
        let distance = 0;

        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i - 1].x;
            const dy = path[i].y - path[i - 1].y;

            distance += Math.hypot(dx, dy) * this.cellSize;
        }

        return distance;
    }

    recordEvent(type, details = {}) {
        this.events.push({
            type,
            timestamp: this.distanceTravelled,
            position: this.getPosition(),
            details
        });
    }

    getPosition() {
        return { ...this.rover.getSnapshot().position };
    }

    start() {
        if (this.status !== "READY") {
            throw new Error("Mission can only start from READY.");
        }

        this.rover.start();
        this.status = "RUNNING";

        this.recordEvent("MISSION_STARTED");

        return this.getSnapshot();
    }

    update(deltaSeconds) {
        if (this.status !== "RUNNING") {
            return this.getSnapshot();
        }

        this.rover.update(deltaSeconds);

        const roverState = this.rover.getSnapshot();

        const distanceDelta =
            roverState.distanceTravelled - this.lastRecordedRoverDistance;

        this.distanceTravelled += distanceDelta;
        this.lastRecordedRoverDistance = roverState.distanceTravelled;

        if (roverState.status === "COMPLETED") {
            this.status = "COMPLETED";
            this.recordEvent("MISSION_COMPLETED");
        }

        return this.getSnapshot();
    }

    switchRoute(newPath, hazard = null) {
        if (this.status !== "RUNNING") {
            throw new Error("Route switching requires a running mission.");
        }

        if (!Array.isArray(newPath) || newPath.length < 2) {
            throw new Error("Replacement route is invalid.");
        }

        const currentPosition = this.getPosition();

        if (
            newPath[0].x !== currentPosition.x ||
            newPath[0].y !== currentPosition.y
        ) {
            throw new Error(
                "Replacement route must start at the rover's current position."
            );
        }

        const newGoal = newPath[newPath.length - 1];

        if (
            newGoal.x !== this.goal.x ||
            newGoal.y !== this.goal.y
        ) {
            throw new Error("Replacement route must preserve the original goal.");
        }

        this.status = "REPLANNING";
        this.recordEvent("REPLANNING_STARTED", { hazard });

        // Preserve movement completed on the current rover leg.
        const currentRoverState = this.rover.getSnapshot();

        const distanceDelta =
            currentRoverState.distanceTravelled -
            this.lastRecordedRoverDistance;

        this.distanceTravelled += distanceDelta;

        // Install the replacement route at the current position.
        this.currentPath = newPath.map(node => ({ ...node }));

        this.rover = new RoverSimulator(this.currentPath, {
            cellSize: this.cellSize,
            speed: this.speed
        });

        this.lastRecordedRoverDistance = 0;

        this.rover.start();

        if (hazard) {
            this.hazardHistory.push({ ...hazard });
        }

        this.status = "RUNNING";

        this.recordEvent("ROUTE_SWITCHED", {
            hazard,
            newPathLength: newPath.length
        });

        return this.getSnapshot();
    }

    getRemainingDistance() {
        return this.rover.getSnapshot().remainingDistance;
    }

    getSnapshot() {
        const roverState = this.rover.getSnapshot();
        const remainingDistance = roverState.remainingDistance;

        const estimatedMissionDistance =
            this.distanceTravelled + remainingDistance;

        const progress = estimatedMissionDistance > 0
            ? (this.distanceTravelled / estimatedMissionDistance) * 100
            : 100;

        return {
            status: this.status,
            position: roverState.position,
            goal: { ...this.goal },
            speed: this.speed,
            distanceTravelled: this.distanceTravelled,
            remainingDistance,
            estimatedMissionDistance,
            progress: Math.min(100, progress),
            currentRouteNodes: this.currentPath.length,
            hazardCount: this.hazardHistory.length,
            hazards: this.hazardHistory.map(hazard => ({ ...hazard }))
        };
    }

    getEventHistory() {
        return this.events.map(event => ({
            ...event,
            position: { ...event.position },
            details: { ...event.details }
        }));
    }
}

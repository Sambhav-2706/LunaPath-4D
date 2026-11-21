
/**
 * LunaPath-4D
 * Dynamic Route Replanning System
 *
 * Features:
 * - Checks only the rover's remaining route.
 * - Ignores hazards behind the rover.
 * - Replans when a future route hazard is detected.
 * - Replans when the rover has deviated from its route.
 * - Supports continuous/fractional rover positions.
 * - Converts continuous positions into grid coordinates for A*.
 * - Preserves the rover's exact position as the first new route node.
 * - Uses a terrain copy so the original terrain is preserved.
 * - Validates the newly calculated path.
 */

import { planRoute } from "./PathPlanner.js";
import { checkPathForHazards } from "./HazardDetection.js";

export function replanRoute({
    terrain,
    currentPath,
    currentPosition,
    goal,
    newHazards,
    mode = "BALANCED"
}) {
    // -----------------------------------------
    // 1. Validate inputs
    // -----------------------------------------

    if (!terrain) {
        throw new Error("Terrain is required.");
    }

    if (!Array.isArray(currentPath)) {
        throw new Error("Current path must be an array.");
    }

    if (!Array.isArray(newHazards)) {
        throw new Error("New hazards must be an array.");
    }

    if (!currentPosition || !goal) {
        throw new Error(
            "Current position and goal are required."
        );
    }

    const { width, height } = terrain;

    if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0
    ) {
        throw new Error("Invalid terrain dimensions.");
    }

    // Continuous positions are valid for rover movement.
    function isInsideTerrain(point) {
        return (
            Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            point.x >= 0 &&
            point.y >= 0 &&
            point.x < width &&
            point.y < height
        );
    }

    // Grid coordinates must be integers.
    function isValidGridPoint(point) {
        return (
            Number.isInteger(point.x) &&
            Number.isInteger(point.y) &&
            point.x >= 0 &&
            point.y >= 0 &&
            point.x < width &&
            point.y < height
        );
    }

    if (!isInsideTerrain(currentPosition)) {
        throw new Error(
            "Current position is outside the terrain."
        );
    }

    if (!isValidGridPoint(goal)) {
        throw new Error(
            "Goal is outside the terrain."
        );
    }

    for (const hazard of newHazards) {
        if (!hazard || !isValidGridPoint(hazard)) {
            throw new Error(
                "Invalid hazard coordinate."
            );
        }
    }

    // -----------------------------------------
    // 2. Find rover position in current route
    // -----------------------------------------

    const roverPathIndex = currentPath.findIndex(
        node =>
            node.x === currentPosition.x &&
            node.y === currentPosition.y
    );

    const roverOnCurrentPath = roverPathIndex !== -1;

    // Only validate the route the rover has yet to travel.
    const remainingPath = roverOnCurrentPath
        ? currentPath.slice(roverPathIndex)
        : [];

    // -----------------------------------------
    // 3. Check future route for hazards
    // -----------------------------------------

    const safetyCheck = checkPathForHazards(
        remainingPath,
        newHazards
    );

    // -----------------------------------------
    // 4. Determine whether replanning is needed
    // -----------------------------------------

    const routeDeviation = !roverOnCurrentPath;
    const futureHazard = !safetyCheck.isSafe;

    if (!routeDeviation && !futureHazard) {
        return {
            success: true,
            replanned: false,
            status: "ROUTE_UNCHANGED",
            message:
                "Remaining route is safe. No replanning required.",
            path: remainingPath,
            hazards: [],
            route: null
        };
    }

    // -----------------------------------------
    // 5. Copy terrain
    // -----------------------------------------

    const updatedTraversability = terrain.traversability
        ? new Uint8Array(terrain.traversability)
        : new Uint8Array(width * height).fill(1);

    const updatedTerrain = {
        ...terrain,
        traversability: updatedTraversability
    };

    // -----------------------------------------
    // 6. Block all reported hazards
    // -----------------------------------------

    const blockedCells = new Set();

    for (const hazard of newHazards) {
        const index = hazard.y * width + hazard.x;

        updatedTraversability[index] = 0;

        blockedCells.add(`${hazard.x},${hazard.y}`);
    }

    // -----------------------------------------
    // 7. Convert rover position to grid position
    // -----------------------------------------

    const gridStart = {
        x: Math.round(currentPosition.x),
        y: Math.round(currentPosition.y)
    };

    if (!isValidGridPoint(gridStart)) {
        return {
            success: false,
            replanned: true,
            status: "INVALID_GRID_START",
            message:
                "Rover position could not be converted into a valid grid coordinate.",
            path: [],
            hazards: safetyCheck.intersections,
            route: null,
            blockedCells: Array.from(blockedCells)
        };
    }

    // -----------------------------------------
    // 8. Replan using grid coordinates
    // -----------------------------------------

    const newRoute = planRoute(
        updatedTerrain,
        gridStart,
        goal,
        mode
    );

    // -----------------------------------------
    // 9. Handle planning failure
    // -----------------------------------------

    if (!newRoute.success) {
        return {
            success: false,
            replanned: true,
            status: "REPLANNING_FAILED",
            message:
                "Route invalidated. No safe route could be found.",
            path: [],
            hazards: safetyCheck.intersections,
            route: newRoute,
            blockedCells: Array.from(blockedCells)
        };
    }

    // -----------------------------------------
    // 10. Preserve exact rover position
    // -----------------------------------------

    const replannedPath = newRoute.path.map(
        node => ({ ...node })
    );

    const roverAtGridStart =
        currentPosition.x === gridStart.x &&
        currentPosition.y === gridStart.y;

    if (!roverAtGridStart) {
        replannedPath.unshift({
            x: currentPosition.x,
            y: currentPosition.y
        });
    }

    // -----------------------------------------
    // 11. Verify new route against hazards
    // -----------------------------------------

    const newPathSafety = checkPathForHazards(
        replannedPath,
        newHazards
    );

    if (!newPathSafety.isSafe) {
        return {
            success: false,
            replanned: true,
            status: "VERIFICATION_FAILED",
            message:
                "The calculated route intersects a reported hazard.",
            path: [],
            hazards: newPathSafety.intersections,
            route: newRoute,
            blockedCells: Array.from(blockedCells)
        };
    }

    // -----------------------------------------
    // 12. Return updated route
    // -----------------------------------------

    return {
        success: true,
        replanned: true,
        status: routeDeviation
            ? "ROUTE_RECOVERED"
            : "ROUTE_UPDATED",
        message: routeDeviation
            ? "Rover deviated from its route. A new route was calculated."
            : "Hazard detected. A new safe route was calculated.",
        path: replannedPath,
        hazards: safetyCheck.intersections,
        route: newRoute,
        blockedCells: Array.from(blockedCells)
    };
}

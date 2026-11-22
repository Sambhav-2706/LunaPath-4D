
/**
 * LunaPath-4D
 * Dynamic Route Replanning System
 *
 * Features:
 * - Checks only the rover's remaining route.
 * - Ignores hazards behind the rover.
 * - Replans when a future route hazard is detected.
 * - Replans when the rover genuinely deviates from its route.
 * - Supports continuous/fractional rover positions.
 * - Matches rover position against path segments using distance.
 * - Converts continuous positions into grid coordinates for A*.
 * - Preserves the rover's exact position as the first new route node.
 * - Uses a terrain copy so the original terrain is preserved.
 * - Validates the newly calculated path.
 */

import { planRoute } from "./PathPlanner.js";
import { checkPathForHazards } from "./HazardDetection.js";


/**
 * Calculate the shortest distance from a point to a line segment.
 *
 * Returns:
 * - distance: perpendicular/minimum distance
 * - t: projection factor along the segment (0 to 1)
 * - closestPoint: nearest point on the segment
 */
function distanceToSegment(point, start, end) {

    const dx = end.x - start.x;
    const dy = end.y - start.y;

    const segmentLengthSquared =
        dx * dx + dy * dy;

    // Handle a segment with identical start and end points.
    if (segmentLengthSquared === 0) {

        const distance = Math.hypot(
            point.x - start.x,
            point.y - start.y
        );

        return {
            distance,
            t: 0,
            closestPoint: { ...start }
        };
    }

    // Projection of point onto the segment.
    let t = (
        (point.x - start.x) * dx +
        (point.y - start.y) * dy
    ) / segmentLengthSquared;

    // Clamp projection to the segment boundaries.
    t = Math.max(0, Math.min(1, t));

    const closestPoint = {
        x: start.x + t * dx,
        y: start.y + t * dy
    };

    const distance = Math.hypot(
        point.x - closestPoint.x,
        point.y - closestPoint.y
    );

    return {
        distance,
        t,
        closestPoint
    };
}


/**
 * Find the nearest remaining route segment to the rover.
 *
 * A rover is considered on-route when its distance to the
 * nearest path segment is within the allowed tolerance.
 */
function findRoverOnPath(
    currentPath,
    currentPosition,
    tolerance
) {

    if (currentPath.length === 0) {
        return {
            onPath: false,
            segmentIndex: -1,
            distance: Infinity,
            t: 0,
            closestPoint: null
        };
    }

    // Handle a path containing only one point.
    if (currentPath.length === 1) {

        const node = currentPath[0];

        const distance = Math.hypot(
            currentPosition.x - node.x,
            currentPosition.y - node.y
        );

        return {
            onPath: distance <= tolerance,
            segmentIndex: 0,
            distance,
            t: 0,
            closestPoint: { ...node }
        };
    }

    let nearest = {
        distance: Infinity,
        segmentIndex: -1,
        t: 0,
        closestPoint: null
    };

    // Check every path segment.
    for (let i = 0; i < currentPath.length - 1; i++) {

        const start = currentPath[i];
        const end = currentPath[i + 1];

        const result = distanceToSegment(
            currentPosition,
            start,
            end
        );

        if (result.distance < nearest.distance) {

            nearest = {
                distance: result.distance,
                segmentIndex: i,
                t: result.t,
                closestPoint: result.closestPoint
            };
        }
    }

    return {
        onPath: nearest.distance <= tolerance,
        segmentIndex: nearest.segmentIndex,
        distance: nearest.distance,
        t: nearest.t,
        closestPoint: nearest.closestPoint
    };
}


export function replanRoute({
    terrain,
    currentPath,
    currentPosition,
    goal,
    newHazards,
    mode = "BALANCED",
    deviationTolerance = 0.75
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

    if (
        !Number.isFinite(deviationTolerance) ||
        deviationTolerance < 0
    ) {
        throw new Error(
            "Deviation tolerance must be a non-negative number."
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

    for (const node of currentPath) {

        if (
            !node ||
            !Number.isFinite(node.x) ||
            !Number.isFinite(node.y)
        ) {
            throw new Error(
                "Current path contains an invalid node."
            );
        }
    }

    for (const hazard of newHazards) {

        if (!hazard || !isValidGridPoint(hazard)) {
            throw new Error(
                "Invalid hazard coordinate."
            );
        }
    }

    // -----------------------------------------
    // 2. Match rover against remaining path
    // -----------------------------------------

    const pathMatch = findRoverOnPath(
        currentPath,
        currentPosition,
        deviationTolerance
    );

    const roverOnCurrentPath = pathMatch.onPath;

    // If the rover is on a segment, retain only the
    // remaining portion of that segment and future nodes.
    //
    // The rover's exact continuous position becomes the
    // beginning of the remaining route.

    const remainingPath = roverOnCurrentPath
        ? [
            { ...currentPosition },
            ...currentPath.slice(
                pathMatch.segmentIndex + 1
            )
        ]
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
            route: null,
            roverPathMatch: {
                segmentIndex: pathMatch.segmentIndex,
                distance: pathMatch.distance,
                tolerance: deviationTolerance,
                closestPoint: pathMatch.closestPoint
            }
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

        blockedCells.add(
            `${hazard.x},${hazard.y}`
        );
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
        blockedCells: Array.from(blockedCells),
        roverPathMatch: {
            segmentIndex: pathMatch.segmentIndex,
            distance: pathMatch.distance,
            tolerance: deviationTolerance,
            closestPoint: pathMatch.closestPoint
        }
    };
}


/*
 * LunaPath-4D
 * Autonomous Navigation Module
 * Member 3 - Terrain-Aware Path Planner
 */

import { findPath } from "./AStar.js";

import {
    calculateMovementCost,
    isTerrainSafe
} from "./CostFunction.js";

import { getNavigationMode } from "./NavigationModes.js";

/*
 * Plan a route across lunar terrain.
 *
 * terrain:
 * {
 *   width: number,
 *   height: number,
 *   cellSize: number,
 *   slope: Array | TypedArray,
 *   roughness: Array | TypedArray,
 *   traversability: Array | TypedArray (optional)
 * }
 *
 * start: { x, y }
 * goal:  { x, y }
 * mode: FASTEST | SAFEST | BALANCED | ENERGY_EFFICIENT
 */

export function planRoute(
    terrain,
    start,
    goal,
    mode = "BALANCED"
) {

    // Validate selected navigation mode
    const profile = getNavigationMode(mode);

    const {
        width,
        height,
        cellSize,
        slope,
        roughness,
        traversability
    } = terrain;

    // Validate terrain dimensions
    if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0
    ) {
        throw new Error("Invalid terrain dimensions.");
    }

    if (!slope || !roughness) {
        throw new Error("Slope and roughness data are required.");
    }

    if (
        slope.length !== width * height ||
        roughness.length !== width * height
    ) {
        throw new Error("Terrain data dimensions do not match the grid.");
    }

    if (
        traversability &&
        traversability.length !== width * height
    ) {
        throw new Error("Traversability dimensions do not match the grid.");
    }

    if (!Number.isFinite(cellSize) || cellSize <= 0) {
        throw new Error("cellSize must be a positive number.");
    }

    // Convert 2D coordinates into 1D array index
    function getIndex(x, y) {
        return y * width + x;
    }

    // Check if a cell is safe and traversable
    function isWalkable(x, y) {

        const index = getIndex(x, y);

        const cellSlope = slope[index];
        const cellRoughness = roughness[index];

        if (
            !Number.isFinite(cellSlope) ||
            !Number.isFinite(cellRoughness)
        ) {
            return false;
        }

        // If traversability data exists, respect it
        if (
            traversability &&
            traversability[index] === 0
        ) {
            return false;
        }

        return isTerrainSafe(
            cellSlope,
            cellRoughness,
            mode
        );
    }

    // Get terrain multiplier for a cell
    function getTerrainCost(x, y) {

        const index = getIndex(x, y);

        const cellSlope = slope[index];
        const cellRoughness = roughness[index];

        return (
            1 +
            profile.slopeWeight * cellSlope +
            profile.roughnessWeight * cellRoughness
        );
    }

    // Run A*
    const path = findPath(
        start,
        goal,
        width,
        height,
        isWalkable,
        getTerrainCost
    );

    // No route found
    if (!path) {
        return {
            success: false,
            mode,
            message: "No safe route found.",
            path: [],
            totalDistanceMeters: 0,
            totalCost: 0
        };
    }

    // Calculate actual route distance and cost
    let totalDistanceMeters = 0;
    let totalCost = 0;

    for (let i = 1; i < path.length; i++) {

        const previous = path[i - 1];
        const current = path[i];

        const dx = current.x - previous.x;
        const dy = current.y - previous.y;

        // Straight or diagonal movement
        const gridDistance = Math.sqrt(dx * dx + dy * dy);

        const distanceMeters = gridDistance * cellSize;

        const index = getIndex(current.x, current.y);

        const movementCost = calculateMovementCost(
            gridDistance,
            slope[index],
            roughness[index],
            mode
        );

        totalDistanceMeters += distanceMeters;
        totalCost += movementCost;
    }

    return {
        success: true,
        mode,
        modeName: profile.name,
        path,
        totalDistanceMeters,
        totalCost,
        pathNodes: path.length,
        message: "Route successfully planned."
    };
}

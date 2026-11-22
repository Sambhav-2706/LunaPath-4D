
/*
 * LunaPath-4D
 * Autonomous Navigation Module
 * Member 3 - Terrain Cost Function
 */

import { getNavigationMode } from "./NavigationModes.js";

// Clamp values between 0 and 1
function normalize(value) {
    return Math.max(0, Math.min(1, value));
}

// Calculate terrain difficulty
export function calculateTerrainCost(
    slope,
    roughness,
    mode = "BALANCED"
) {

    slope = normalize(slope);
    roughness = normalize(roughness);

    const profile = getNavigationMode(mode);

    return (
        1 +
        profile.slopeWeight * slope +
        profile.roughnessWeight * roughness
    );
}

// Calculate movement cost between cells
export function calculateMovementCost(
    distance,
    slope,
    roughness,
    mode = "BALANCED"
) {

    return distance * calculateTerrainCost(
        slope,
        roughness,
        mode
    );
}

// Determine whether terrain is traversable
export function isTerrainSafe(
    slope,
    roughness,
    mode = "BALANCED"
) {

    slope = normalize(slope);
    roughness = normalize(roughness);

    const profile = getNavigationMode(mode);

    // Initial simulation safety thresholds
    const maxSlope = mode === "SAFEST" ? 0.65 : 0.85;
    const maxRoughness = mode === "SAFEST" ? 0.75 : 0.90;

    return (
        slope <= maxSlope &&
        roughness <= maxRoughness
    );
}


/*
 * LunaPath-4D
 * Autonomous Navigation Module
 * Member 3 - Navigation Mode Testing
 */

import {
    NAVIGATION_MODES,
    getNavigationMode,
    getAvailableModes
} from "./NavigationModes.js";

import {
    calculateTerrainCost,
    calculateMovementCost,
    isTerrainSafe
} from "./CostFunction.js";

console.log("===== LUNAPATH NAVIGATION MODES =====\n");

// Display available modes
console.log("Available modes:");

for (const mode of getAvailableModes()) {
    console.log("-", mode);
}

console.log("\n===== TERRAIN COMPARISON =====");

// Sample terrain
const flatTerrain = {
    slope: 0.1,
    roughness: 0.1
};

const roughTerrain = {
    slope: 0.7,
    roughness: 0.8
};

// Test each navigation mode
for (const mode of Object.keys(NAVIGATION_MODES)) {

    console.log(`\nMODE: ${mode}`);

    const flatCost = calculateTerrainCost(
        flatTerrain.slope,
        flatTerrain.roughness,
        mode
    );

    const roughCost = calculateTerrainCost(
        roughTerrain.slope,
        roughTerrain.roughness,
        mode
    );

    const movementCost = calculateMovementCost(
        10,
        roughTerrain.slope,
        roughTerrain.roughness,
        mode
    );

    const safe = isTerrainSafe(
        roughTerrain.slope,
        roughTerrain.roughness,
        mode
    );

    console.log("Flat terrain cost:", flatCost.toFixed(2));
    console.log("Rough terrain cost:", roughCost.toFixed(2));
    console.log("10-unit rough movement cost:", movementCost.toFixed(2));
    console.log("Rough terrain safe:", safe);
}

// Test invalid mode
console.log("\n===== INVALID MODE TEST =====");

try {
    getNavigationMode("SUPER_FAST");
} catch (error) {
    console.log("Correctly rejected:", error.message);
}

console.log("\nAll navigation mode tests completed.");


/*
 * LunaPath-4D
 * Autonomous Navigation Module
 * Member 3 - Navigation Modes
 */

// Different navigation strategies for the lunar rover
export const NAVIGATION_MODES = {

    FASTEST: {
        name: "Fastest",
        slopeWeight: 1.0,
        roughnessWeight: 0.5,
        description: "Prioritizes shorter routes with minimal terrain penalties."
    },

    SAFEST: {
        name: "Safest",
        slopeWeight: 5.0,
        roughnessWeight: 5.0,
        description: "Strongly avoids steep and rough terrain."
    },

    BALANCED: {
        name: "Balanced",
        slopeWeight: 3.0,
        roughnessWeight: 2.0,
        description: "Balances route distance and terrain difficulty."
    },

    ENERGY_EFFICIENT: {
        name: "Energy Efficient",
        slopeWeight: 4.0,
        roughnessWeight: 3.0,
        description: "Prefers smooth terrain to reduce simulated traversal effort."
    }
};

// Get the configuration for a selected mode
export function getNavigationMode(mode) {

    const selectedMode = NAVIGATION_MODES[mode];

    if (!selectedMode) {
        throw new Error(`Invalid navigation mode: ${mode}`);
    }

    return selectedMode;
}

// Get all available modes
export function getAvailableModes() {
    return Object.keys(NAVIGATION_MODES);
}


/**
 * LunaPath-4D
 * Hazard Detection System
 *
 * Detects hazardous terrain cells using:
 * - Slope
 * - Roughness
 * - Traversability
 *
 * This is a prototype hazard classification system.
 */

export const HAZARD_TYPES = {
    BLOCKED: "BLOCKED",
    STEEP_SLOPE: "STEEP_SLOPE",
    ROUGH_TERRAIN: "ROUGH_TERRAIN",
    STEEP_AND_ROUGH: "STEEP_AND_ROUGH"
};

/**
 * Classifies a single terrain cell.
 */
export function classifyHazard(
    slope,
    roughness,
    traversability = 1,
    thresholds = {}
) {
    const maxSlope = thresholds.maxSlope ?? 0.65;
    const maxRoughness = thresholds.maxRoughness ?? 0.75;

    // Invalid terrain information is considered unsafe.
    if (
        !Number.isFinite(slope) ||
        !Number.isFinite(roughness)
    ) {
        return HAZARD_TYPES.BLOCKED;
    }

    // Explicitly blocked cell.
    if (traversability === 0) {
        return HAZARD_TYPES.BLOCKED;
    }

    const steep = slope >= maxSlope;
    const rough = roughness >= maxRoughness;

    if (steep && rough) {
        return HAZARD_TYPES.STEEP_AND_ROUGH;
    }

    if (steep) {
        return HAZARD_TYPES.STEEP_SLOPE;
    }

    if (rough) {
        return HAZARD_TYPES.ROUGH_TERRAIN;
    }

    return null;
}

/**
 * Scans the terrain and detects all hazardous cells.
 *
 * Terrain format:
 * {
 *   width,
 *   height,
 *   slope,
 *   roughness,
 *   traversability
 * }
 *
 * traversability is optional.
 */
export function detectHazards(terrain, thresholds = {}) {
    if (!terrain) {
        throw new Error("Terrain data is required.");
    }

    const {
        width,
        height,
        slope,
        roughness,
        traversability
    } = terrain;

    if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0
    ) {
        throw new Error("Invalid terrain dimensions.");
    }

    const size = width * height;

    if (!slope || !roughness) {
        throw new Error(
            "Slope and roughness data are required."
        );
    }

    if (
        slope.length !== size ||
        roughness.length !== size
    ) {
        throw new Error(
            "Terrain data dimensions do not match."
        );
    }

    if (
        traversability &&
        traversability.length !== size
    ) {
        throw new Error(
            "Traversability dimensions do not match."
        );
    }

    const hazards = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;

            const slopeValue = slope[index];
            const roughnessValue = roughness[index];

            const traversable = traversability
                ? traversability[index]
                : 1;

            const type = classifyHazard(
                slopeValue,
                roughnessValue,
                traversable,
                thresholds
            );

            if (type !== null) {
                hazards.push({
                    x,
                    y,
                    index,
                    type,
                    slope: slopeValue,
                    roughness: roughnessValue
                });
            }
        }
    }

    return hazards;
}

/**
 * Checks whether a planned route intersects detected hazards.
 */
export function checkPathForHazards(path, hazards) {
    if (!Array.isArray(path)) {
        throw new Error("Path must be an array.");
    }

    if (!Array.isArray(hazards)) {
        throw new Error("Hazards must be an array.");
    }

    const hazardMap = new Map();

    for (const hazard of hazards) {
        hazardMap.set(
            `${hazard.x},${hazard.y}`,
            hazard
        );
    }

    const intersections = [];

    for (const node of path) {
        const key = `${node.x},${node.y}`;
        const hazard = hazardMap.get(key);

        if (hazard) {
            intersections.push({
                ...node,
                hazardType: hazard.type
            });
        }
    }

    return {
        isSafe: intersections.length === 0,
        intersectsHazards: intersections.length > 0,
        intersections,
        message: intersections.length === 0
            ? "Path is clear of detected hazards."
            : "Warning: path intersects detected hazards."
    };
}

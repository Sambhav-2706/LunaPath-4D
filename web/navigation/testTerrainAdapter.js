
import { createNavigationTerrain } from "./TerrainAdapter.js";
import { detectHazards } from "./HazardDetection.js";
import { planRoute } from "./PathPlanner.js";
import { isTerrainSafe } from "./CostFunction.js";

function findSafePoint(terrain, targetX, targetY, mode) {
    let bestPoint = null;
    let bestDistance = Infinity;

    for (let y = 0; y < terrain.height; y++) {
        for (let x = 0; x < terrain.width; x++) {
            const index = y * terrain.width + x;

            if (
                terrain.traversability[index] === 0 ||
                !isTerrainSafe(
                    terrain.slope[index],
                    terrain.roughness[index],
                    mode
                )
            ) {
                continue;
            }

            const distance = Math.sqrt(
                (x - targetX) ** 2 +
                (y - targetY) ** 2
            );

            if (distance < bestDistance) {
                bestDistance = distance;
                bestPoint = { x, y };
            }
        }
    }

    return bestPoint;
}

function printStats(name, values) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
        min = Math.min(min, values[i]);
        max = Math.max(max, values[i]);
        sum += values[i];
    }

    console.log(name + " minimum:", min.toFixed(4));
    console.log(name + " maximum:", max.toFixed(4));
    console.log(name + " average:", (sum / values.length).toFixed(4));
}

console.log("===== LUNAPATH REAL TERRAIN INTEGRATION =====");

const terrain = createNavigationTerrain();

console.log("\n===== TERRAIN LOADED =====");
console.log("Name:", terrain.metadata.name);
console.log("Dimensions:", terrain.width, "x", terrain.height);
console.log("Cell size:", terrain.cellSize, "meters");
console.log("Total cells:", terrain.width * terrain.height);

console.log(
    "Elevation range:",
    terrain.metadata.minimum_elevation_meters,
    "to",
    terrain.metadata.maximum_elevation_meters,
    "meters"
);

console.log("\n===== TERRAIN ATTRIBUTE CHECK =====");
console.log("Elevation array:", terrain.elevation.length);
console.log("Slope array:", terrain.slope.length);
console.log("Roughness array:", terrain.roughness.length);
console.log("Traversability array:", terrain.traversability.length);

printStats("Normalized slope", terrain.slope);
printStats("Normalized roughness", terrain.roughness);

console.log("\n===== HAZARD DETECTION =====");

const hazards = detectHazards(terrain);

console.log("Hazards detected:", hazards.length);

for (const hazard of hazards) {
    terrain.traversability[hazard.index] = 0;
}

console.log(
    "Blocked cells after hazard classification:",
    hazards.length
);

console.log("\n===== ROUTE PLANNING =====");

const mode = "BALANCED";

const start = findSafePoint(terrain, 5, 5, mode);

const goal = findSafePoint(
    terrain,
    terrain.width - 6,
    terrain.height - 6,
    mode
);

console.log("Start:", start);
console.log("Goal:", goal);
console.log("Mode:", mode);

if (!start || !goal) {
    console.log("No safe start or goal point found.");
    process.exit(1);
}

const result = planRoute(
    terrain,
    start,
    goal,
    mode
);

console.log("\n===== ROUTE RESULT =====");
console.log("Success:", result.success);
console.log("Message:", result.message);

if (result.success) {
    console.log(
        "Distance:",
        result.totalDistanceMeters.toFixed(2),
        "meters"
    );

    console.log("Total cost:", result.totalCost);
    console.log("Path nodes:", result.pathNodes);

    console.log("First 5 path nodes:");
    console.log(result.path.slice(0, 5));

    console.log("Last 5 path nodes:");
    console.log(result.path.slice(-5));

    console.log("\n===== VALIDATION =====");

    const startsCorrectly =
        result.path[0].x === start.x &&
        result.path[0].y === start.y;

    const reachesGoal =
        result.path[result.path.length - 1].x === goal.x &&
        result.path[result.path.length - 1].y === goal.y;

    const avoidsHazards = result.path.every(node => {
        const index = node.y * terrain.width + node.x;
        return terrain.traversability[index] !== 0;
    });

    console.log("Starts at start:", startsCorrectly);
    console.log("Reaches goal:", reachesGoal);
    console.log("Avoids classified hazards:", avoidsHazards);

    console.log("\n===== TEST COMPLETE =====");
} else {
    console.log("Route could not be calculated.");
}

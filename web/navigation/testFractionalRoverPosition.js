import { planRoute } from "./PathPlanner.js";
import { replanRoute } from "./DynamicReplanner.js";

console.log("===== FRACTIONAL ROVER POSITION REGRESSION =====");

const width = 12;
const height = 12;
const size = width * height;

const terrain = {
    width,
    height,
    cellSize: 10,
    slope: new Float32Array(size).fill(0.1),
    roughness: new Float32Array(size).fill(0.1),
    traversability: new Uint8Array(size).fill(1)
};

const start = { x: 1, y: 5 };
const goal = { x: 10, y: 5 };
const mode = "BALANCED";

const initialRoute = planRoute(
    terrain,
    start,
    goal,
    mode
);

function assert(condition, message) {
    if (!condition) {
        throw new Error(`FAILED: ${message}`);
    }

    console.log(`PASSED: ${message}`);
}

if (!initialRoute.success) {
    throw new Error("Initial route generation failed.");
}

// -----------------------------------------
// TEST 1: Fractional rover on path segment
// -----------------------------------------

console.log("\n===== TEST 1: FRACTIONAL POSITION ON ROUTE =====");

const fractionalPosition = {
    x: 4.5,
    y: 5
};

const fractionalResult = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: fractionalPosition,
    goal,
    newHazards: [],
    mode
});

console.log("Success:", fractionalResult.success);
console.log("Replanned:", fractionalResult.replanned);
console.log("Status:", fractionalResult.status);
console.log("Path match:", fractionalResult.roverPathMatch);

assert(
    fractionalResult.success,
    "Fractional rover position succeeds"
);

assert(
    fractionalResult.replanned === false,
    "Rover between waypoints is not incorrectly classified as deviated"
);

assert(
    fractionalResult.status === "ROUTE_UNCHANGED",
    "Fractional rover on route keeps existing route"
);

// -----------------------------------------
// TEST 2: Slight deviation within tolerance
// -----------------------------------------

console.log("\n===== TEST 2: POSITION WITHIN TOLERANCE =====");

const slightlyOffPosition = {
    x: 4.5,
    y: 5.3
};

const toleranceResult = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: slightlyOffPosition,
    goal,
    newHazards: [],
    mode,
    deviationTolerance: 0.75
});

console.log("Success:", toleranceResult.success);
console.log("Replanned:", toleranceResult.replanned);
console.log("Status:", toleranceResult.status);
console.log("Path match:", toleranceResult.roverPathMatch);

assert(
    toleranceResult.success,
    "Position within tolerance succeeds"
);

assert(
    toleranceResult.replanned === false,
    "Position within tolerance does not trigger replanning"
);

// -----------------------------------------
// TEST 3: Genuine deviation beyond tolerance
// -----------------------------------------

console.log("\n===== TEST 3: GENUINE ROUTE DEVIATION =====");

const offRoutePosition = {
    x: 4.5,
    y: 6.2
};

const deviationResult = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: offRoutePosition,
    goal,
    newHazards: [],
    mode,
    deviationTolerance: 0.75
});

console.log("Success:", deviationResult.success);
console.log("Replanned:", deviationResult.replanned);
console.log("Status:", deviationResult.status);
console.log("Path match:", deviationResult.roverPathMatch);

assert(
    deviationResult.success,
    "Replanning succeeds after genuine deviation"
);

assert(
    deviationResult.replanned,
    "Genuine deviation triggers replanning"
);

assert(
    deviationResult.status === "ROUTE_RECOVERED",
    "Genuine deviation is classified as route recovery"
);

assert(
    deviationResult.path.length > 0 &&
    deviationResult.path[0].x === offRoutePosition.x &&
    deviationResult.path[0].y === offRoutePosition.y,
    "Recovered route preserves exact fractional rover position"
);

// -----------------------------------------
// TEST 4: Hazard discovered ahead at fractional position
// -----------------------------------------

console.log("\n===== TEST 4: FRACTIONAL POSITION WITH HAZARD =====");

const hazard = {
    x: 7,
    y: 5
};

const hazardResult = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: fractionalPosition,
    goal,
    newHazards: [hazard],
    mode
});

console.log("Success:", hazardResult.success);
console.log("Replanned:", hazardResult.replanned);
console.log("Status:", hazardResult.status);
console.log("Updated path:", hazardResult.path);

const startsAtExactPosition =
    hazardResult.path.length > 0 &&
    hazardResult.path[0].x === fractionalPosition.x &&
    hazardResult.path[0].y === fractionalPosition.y;

const avoidsHazard = !hazardResult.path.some(
    node => node.x === hazard.x && node.y === hazard.y
);

console.log("Starts at exact rover position:", startsAtExactPosition);
console.log("Avoids hazard:", avoidsHazard);

assert(
    hazardResult.success,
    "Hazard replanning from fractional rover position succeeds"
);

assert(
    hazardResult.replanned,
    "Hazard triggers replanning"
);

assert(
    startsAtExactPosition,
    "New route starts at exact fractional rover position"
);

assert(
    avoidsHazard,
    "New route avoids hazard cell"
);

// -----------------------------------------
// SUMMARY
// -----------------------------------------

console.log("\n===== FRACTIONAL POSITION TEST SUMMARY =====");
console.log("All fractional rover regression tests passed.");
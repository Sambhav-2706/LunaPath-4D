
import { planRoute } from "./PathPlanner.js";
import { replanRoute } from "./DynamicReplanner.js";

console.log("===== LUNAPATH REPLANNER EDGE CASES =====\n");

const width = 12;
const height = 12;
const size = width * height;

const slope = new Float32Array(size).fill(0.10);
const roughness = new Float32Array(size).fill(0.10);
const traversability = new Uint8Array(size).fill(1);

const terrain = {
    width,
    height,
    cellSize: 10,
    slope,
    roughness,
    traversability
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

// ------------------------------------------
// TEST 1: Hazard behind rover
// ------------------------------------------

console.log("===== TEST 1: HAZARD BEHIND ROVER =====");

const rover = { x: 4, y: 5 };

const behindResult = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: rover,
    goal,
    newHazards: [{ x: 2, y: 5 }],
    mode
});

console.log("Success:", behindResult.success);
console.log("Replanned:", behindResult.replanned);
console.log("Status:", behindResult.status);
console.log("Expected: ROUTE_UNCHANGED");

// ------------------------------------------
// TEST 2: Hazard outside remaining route
// ------------------------------------------

console.log("\n===== TEST 2: HAZARD OFF ROUTE =====");

const offRouteResult = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: rover,
    goal,
    newHazards: [{ x: 7, y: 8 }],
    mode
});

console.log("Success:", offRouteResult.success);
console.log("Replanned:", offRouteResult.replanned);
console.log("Status:", offRouteResult.status);
console.log("Expected: ROUTE_UNCHANGED");

// ------------------------------------------
// TEST 3: Hazard ahead on route
// ------------------------------------------

console.log("\n===== TEST 3: HAZARD AHEAD =====");

const aheadResult = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: rover,
    goal,
    newHazards: [{ x: 5, y: 5 }],
    mode
});

console.log("Success:", aheadResult.success);
console.log("Replanned:", aheadResult.replanned);
console.log("Status:", aheadResult.status);

const avoidsHazard = !aheadResult.path.some(
    node => node.x === 5 && node.y === 5
);

console.log("Hazard avoided:", avoidsHazard);

// ------------------------------------------
// TEST 4: Rover deviated from route
// ------------------------------------------

console.log("\n===== TEST 4: ROUTE DEVIATION =====");

const deviatedPosition = { x: 4, y: 6 };

const deviationResult = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: deviatedPosition,
    goal,
    newHazards: [],
    mode
});

console.log("Success:", deviationResult.success);
console.log("Replanned:", deviationResult.replanned);
console.log("Status:", deviationResult.status);

const startsAtActualPosition =
    deviationResult.path.length > 0 &&
    deviationResult.path[0].x === deviatedPosition.x &&
    deviationResult.path[0].y === deviatedPosition.y;

console.log(
    "Starts at actual rover position:",
    startsAtActualPosition
);

// ------------------------------------------
// TEST 5: Destination blocked
// ------------------------------------------

console.log("\n===== TEST 5: GOAL BLOCKED =====");

const blockedGoalResult = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: rover,
    goal,
    newHazards: [{ x: goal.x, y: goal.y }],
    mode
});

console.log("Success:", blockedGoalResult.success);
console.log("Replanned:", blockedGoalResult.replanned);
console.log("Status:", blockedGoalResult.status);
console.log("Expected: REPLANNING_FAILED");

// ------------------------------------------
// SUMMARY
// ------------------------------------------

console.log("\n===== EDGE CASE TESTS COMPLETED =====");


import { planRoute } from "./PathPlanner.js";
import { replanRoute } from "./DynamicReplanner.js";

console.log("===== LUNAPATH DYNAMIC REPLANNER TEST =====\n");

// ------------------------------------------
// 1. Create test terrain
// ------------------------------------------

const width = 12;
const height = 12;
const cellSize = 10;
const size = width * height;

const slope = new Float32Array(size);
const roughness = new Float32Array(size);
const traversability = new Uint8Array(size);

for (let i = 0; i < size; i++) {
    slope[i] = 0.10;
    roughness[i] = 0.10;
    traversability[i] = 1;
}

const terrain = {
    width,
    height,
    cellSize,
    slope,
    roughness,
    traversability
};

const start = { x: 1, y: 5 };
const goal = { x: 10, y: 5 };
const mode = "BALANCED";

// ------------------------------------------
// 2. Plan the initial route
// ------------------------------------------

console.log("===== INITIAL ROUTE =====");

const initialRoute = planRoute(
    terrain,
    start,
    goal,
    mode
);

console.log("Success:", initialRoute.success);
console.log("Distance:", initialRoute.totalDistanceMeters);
console.log("Path nodes:", initialRoute.pathNodes);
console.log("Path:", initialRoute.path);

// ------------------------------------------
// 3. Introduce a new hazard
// ------------------------------------------

console.log("\n===== NEW HAZARD DETECTED =====");

const newHazards = [
    { x: 5, y: 5 }
];

console.log("Hazards:", newHazards);

// ------------------------------------------
// 4. Trigger dynamic replanning
// ------------------------------------------

console.log("\n===== DYNAMIC REPLANNING =====");

const result = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: start,
    goal,
    newHazards,
    mode
});

console.log("Success:", result.success);
console.log("Replanned:", result.replanned);
console.log("Status:", result.status);
console.log("Message:", result.message);

if (result.route) {
    console.log(
        "New distance:",
        result.route.totalDistanceMeters
    );

    console.log(
        "New path nodes:",
        result.route.pathNodes
    );
}

console.log("Updated path:", result.path);

// ------------------------------------------
// 5. Verify hazard avoidance
// ------------------------------------------

console.log("\n===== HAZARD AVOIDANCE CHECK =====");

const hazardKey = "5,5";

const crossedHazard = result.path.some(
    node => `${node.x},${node.y}` === hazardKey
);

console.log("Route crosses hazard:", crossedHazard);
console.log("Hazard avoided:", !crossedHazard);

// Verify original terrain was not changed.
const hazardIndex = 5 * width + 5;

console.log(
    "Original terrain unchanged:",
    terrain.traversability[hazardIndex] === 1
);

// ------------------------------------------
// 6. Visualize the updated route
// ------------------------------------------

console.log("\n===== UPDATED ROUTE MAP =====");

for (let y = 0; y < height; y++) {
    let row = "";

    for (let x = 0; x < width; x++) {
        const onPath = result.path.some(
            node => node.x === x && node.y === y
        );

        const isStart = x === start.x && y === start.y;
        const isGoal = x === goal.x && y === goal.y;
        const isHazard = x === 5 && y === 5;

        if (isStart) {
            row += "S ";
        } else if (isGoal) {
            row += "G ";
        } else if (isHazard) {
            row += "H ";
        } else if (onPath) {
            row += "* ";
        } else {
            row += ". ";
        }
    }

    console.log(row);
}

// ------------------------------------------
// 7. Test unaffected route
// ------------------------------------------

console.log("\n===== UNCHANGED ROUTE TEST =====");

const harmlessHazard = [
    { x: 5, y: 2 }
];

const unchangedResult = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: start,
    goal,
    newHazards: harmlessHazard,
    mode
});

console.log("Success:", unchangedResult.success);
console.log("Replanned:", unchangedResult.replanned);
console.log("Status:", unchangedResult.status);
console.log("Message:", unchangedResult.message);

// ------------------------------------------
// 8. Summary
// ------------------------------------------

console.log("\n===== TEST COMPLETED =====");

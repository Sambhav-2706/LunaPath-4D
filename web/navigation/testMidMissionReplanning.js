
import { planRoute } from "./PathPlanner.js";
import { replanRoute } from "./DynamicReplanner.js";

console.log("===== LUNAPATH MID-MISSION REPLANNING =====\n");

// ------------------------------------------
// 1. Create terrain
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

// ------------------------------------------
// 2. Define mission
// ------------------------------------------

const start = { x: 1, y: 5 };
const goal = { x: 10, y: 5 };
const roverPosition = { x: 4, y: 5 };

const mode = "BALANCED";

// ------------------------------------------
// 3. Plan original route
// ------------------------------------------

console.log("===== ORIGINAL MISSION =====");

const initialRoute = planRoute(
    terrain,
    start,
    goal,
    mode
);

console.log("Initial route successful:", initialRoute.success);
console.log("Initial route:", initialRoute.path);

// ------------------------------------------
// 4. Simulate rover movement
// ------------------------------------------

console.log("\n===== ROVER MOVEMENT =====");

console.log("Mission start:", start);
console.log("Rover current position:", roverPosition);
console.log("Destination:", goal);

// ------------------------------------------
// 5. Discover hazard ahead
// ------------------------------------------

console.log("\n===== HAZARD DISCOVERY =====");

const newHazards = [
    { x: 5, y: 5 }
];

console.log("New hazard:", newHazards[0]);

// ------------------------------------------
// 6. Replan from current position
// ------------------------------------------

console.log("\n===== REPLANNING FROM CURRENT POSITION =====");

const result = replanRoute({
    terrain,
    currentPath: initialRoute.path,
    currentPosition: roverPosition,
    goal,
    newHazards,
    mode
});

console.log("Success:", result.success);
console.log("Replanned:", result.replanned);
console.log("Status:", result.status);
console.log("Message:", result.message);
console.log("Updated path:", result.path);

// ------------------------------------------
// 7. Verify rover position
// ------------------------------------------

console.log("\n===== CURRENT POSITION CHECK =====");

const startsAtRover = result.path.length > 0 &&
    result.path[0].x === roverPosition.x &&
    result.path[0].y === roverPosition.y;

console.log("Route starts at rover:", startsAtRover);

// ------------------------------------------
// 8. Verify destination
// ------------------------------------------

const reachesGoal = result.path.length > 0 &&
    result.path[result.path.length - 1].x === goal.x &&
    result.path[result.path.length - 1].y === goal.y;

console.log("Route reaches goal:", reachesGoal);

// ------------------------------------------
// 9. Verify hazard avoidance
// ------------------------------------------

const hazardAvoided = !result.path.some(
    node => node.x === 5 && node.y === 5
);

console.log("Hazard avoided:", hazardAvoided);

// ------------------------------------------
// 10. Verify original terrain unchanged
// ------------------------------------------

const hazardIndex = 5 * width + 5;

console.log(
    "Original terrain preserved:",
    terrain.traversability[hazardIndex] === 1
);

// ------------------------------------------
// 11. Display route map
// ------------------------------------------

console.log("\n===== MID-MISSION ROUTE MAP =====");

for (let y = 0; y < height; y++) {
    let row = "";

    for (let x = 0; x < width; x++) {
        const isRover = x === roverPosition.x &&
            y === roverPosition.y;

        const isGoal = x === goal.x &&
            y === goal.y;

        const isHazard = x === 5 &&
            y === 5;

        const isPath = result.path.some(
            node => node.x === x && node.y === y
        );

        if (isRover) {
            row += "R ";
        } else if (isGoal) {
            row += "G ";
        } else if (isHazard) {
            row += "H ";
        } else if (isPath) {
            row += "* ";
        } else {
            row += ". ";
        }
    }

    console.log(row);
}

// ------------------------------------------
// 12. Final test summary
// ------------------------------------------

console.log("\n===== TEST SUMMARY =====");

console.log(
    "Replanning successful:",
    result.success && result.replanned
);

console.log(
    "Starts at rover:",
    startsAtRover
);

console.log(
    "Reaches destination:",
    reachesGoal
);

console.log(
    "Avoids hazard:",
    hazardAvoided
);

console.log(
    "Terrain unchanged:",
    terrain.traversability[hazardIndex] === 1
);

console.log("\n===== TEST COMPLETED =====");

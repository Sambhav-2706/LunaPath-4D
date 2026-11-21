
import { findPath } from "./AStar.js";

// Grid dimensions
const width = 10;
const height = 10;

// Blocked cells
const obstacles = new Set();

// Create a wall at x = 4
// Leave one opening at y = 7
for (let y = 0; y < 9; y++) {
    if (y !== 7) {
        obstacles.add(`4,${y}`);
    }
}

// Check whether a cell is traversable
function isWalkable(x, y) {
    return !obstacles.has(`${x},${y}`);
}

// Start and destination
const start = { x: 1, y: 1 };
const goal = { x: 8, y: 1 };

// Run A*
const path = findPath(
    start,
    goal,
    width,
    height,
    isWalkable
);

// Print results
if (path === null) {
    console.log("No path found.");
} else {
    console.log("Path found!");
    console.log("Path length:", path.length);
    console.log("Path coordinates:");

    for (const node of path) {
        console.log(`(${node.x}, ${node.y})`);
    }
}

// Print the grid
console.log("\nGrid visualization:");

for (let y = 0; y < height; y++) {

    let row = "";

    for (let x = 0; x < width; x++) {

        if (x === start.x && y === start.y) {
            row += "S ";
        }
        else if (x === goal.x && y === goal.y) {
            row += "G ";
        }
        else if (obstacles.has(`${x},${y}`)) {
            row += "# ";
        }
        else if (
            path &&
            path.some(node => node.x === x && node.y === y)
        ) {
            row += "* ";
        }
        else {
            row += ". ";
        }
    }

    console.log(row);
}

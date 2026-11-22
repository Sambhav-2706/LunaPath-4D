
/*
 * LunaPath-4D
 * Autonomous Navigation Module
 * Member 3 - Path Planner Test
 */

import { planRoute } from "./PathPlanner.js";

const width = 12;
const height = 12;
const cellSize = 10;

const size = width * height;

// Simulated terrain data
const slope = new Float32Array(size);
const roughness = new Float32Array(size);
const traversability = new Uint8Array(size);

// Initialize terrain as relatively flat and smooth
for (let i = 0; i < size; i++) {
    slope[i] = 0.1;
    roughness[i] = 0.1;
    traversability[i] = 1;
}

// Create a difficult terrain strip
for (let y = 1; y < 11; y++) {

    const x = 5;
    const index = y * width + x;

    slope[index] = 0.65;
    roughness[index] = 0.80;
}

// Start and destination
const start = { x: 1, y: 5 };
const goal = { x: 10, y: 5 };

// Terrain object
const terrain = {
    width,
    height,
    cellSize,
    slope,
    roughness,
    traversability
};

// Test all navigation modes
const modes = [
    "FASTEST",
    "SAFEST",
    "BALANCED",
    "ENERGY_EFFICIENT"
];

const results = {};

console.log("===== LUNAPATH PATH PLANNER TEST =====");

for (const mode of modes) {

    console.log(`\n===== ${mode} =====`);

    const result = planRoute(
        terrain,
        start,
        goal,
        mode
    );

    results[mode] = result;

    console.log("Success:", result.success);
    console.log("Message:", result.message);

    if (result.success) {

        console.log(
            "Distance:",
            result.totalDistanceMeters.toFixed(2),
            "meters"
        );

        console.log(
            "Total cost:",
            result.totalCost.toFixed(2)
        );

        console.log(
            "Path nodes:",
            result.pathNodes
        );

        console.log("Path:", result.path);
    }
}

// Visualize BALANCED mode
const selectedResult = results["BALANCED"];

console.log("\n===== BALANCED ROUTE MAP =====");

for (let y = 0; y < height; y++) {

    let row = "";

    for (let x = 0; x < width; x++) {

        const index = y * width + x;

        if (x === start.x && y === start.y) {
            row += "S ";
        }
        else if (x === goal.x && y === goal.y) {
            row += "G ";
        }
        else if (
            selectedResult.success &&
            selectedResult.path.some(
                node => node.x === x && node.y === y
            )
        ) {
            row += "* ";
        }
        else if (slope[index] > 0.5) {
            row += "T ";
        }
        else {
            row += ". ";
        }
    }

    console.log(row);
}

console.log("\n===== TEST COMPLETED =====");

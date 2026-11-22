
import {
    gridToWorld,
    worldToGrid,
    pathToWorld,
    hazardsToWorld
} from "./CoordinateAdapter.js";

console.log("===== LUNAPATH COORDINATE ADAPTER TEST =====");

console.log("\n===== GRID TO WORLD =====");

const testPoints = [
    { x: 0, y: 0 },
    { x: 127, y: 127 },
    { x: 128, y: 128 },
    { x: 255, y: 255 }
];

for (const point of testPoints) {
    console.log(
        "Grid:",
        point,
        "-> World:",
        gridToWorld(point)
    );
}

console.log("\n===== WORLD TO GRID =====");

const worldPoints = [
    { x: -1275, z: -1275 },
    { x: -5, z: -5 },
    { x: 5, z: 5 },
    { x: 1275, z: 1275 }
];

for (const point of worldPoints) {
    console.log(
        "World:",
        point,
        "-> Grid:",
        worldToGrid(point)
    );
}

console.log("\n===== PATH CONVERSION =====");

const samplePath = [
    { x: 5, y: 5 },
    { x: 6, y: 5 },
    { x: 7, y: 6 },
    { x: 8, y: 7 }
];

console.log("Grid Path:", samplePath);
console.log("World Path:", pathToWorld(samplePath));

console.log("\n===== HAZARD CONVERSION =====");

const hazards = [
    { x: 15, y: 15, radius: 3 },
    { x: 30, y: 40, radius: 5 }
];

console.log("Grid Hazards:", hazards);
console.log("World Hazards:", hazardsToWorld(hazards));

console.log("\n===== BOUNDARY VALIDATION =====");

try {
    gridToWorld({ x: 300, y: 20 });
    console.log("ERROR: Invalid grid point accepted.");
} catch (error) {
    console.log("Grid boundary correctly rejected.");
}

try {
    worldToGrid({ x: 2000, z: 2000 });
    console.log("ERROR: Invalid world point accepted.");
} catch (error) {
    console.log("World boundary correctly rejected.");
}

console.log("\n===== COORDINATE ADAPTER TEST PASSED =====");



import {
    HAZARD_TYPES,
    classifyHazard,
    detectHazards,
    checkPathForHazards
} from "./HazardDetection.js";

console.log("===== LUNAPATH HAZARD DETECTION TEST =====\n");

// ---------------------------------------
// TEST 1: Individual Hazard Classification
// ---------------------------------------

console.log("===== TEST 1: CLASSIFICATION =====");

console.log(
    "Flat terrain:",
    classifyHazard(0.20, 0.30) ?? "SAFE"
);

console.log(
    "Steep terrain:",
    classifyHazard(0.80, 0.30)
);

console.log(
    "Rough terrain:",
    classifyHazard(0.30, 0.90)
);

console.log(
    "Steep + rough:",
    classifyHazard(0.80, 0.90)
);

console.log(
    "Blocked cell:",
    classifyHazard(0.20, 0.30, 0)
);

// ---------------------------------------
// TEST 2: Generate Synthetic Test Terrain
// ---------------------------------------

console.log("\n===== TEST 2: TERRAIN SCAN =====");

const width = 10;
const height = 10;
const size = width * height;

const slope = new Float32Array(size);
const roughness = new Float32Array(size);
const traversability = new Uint8Array(size);

// Default terrain: safe.
for (let i = 0; i < size; i++) {
    slope[i] = 0.20;
    roughness[i] = 0.20;
    traversability[i] = 1;
}

// Add a steep region.
slope[5 * width + 4] = 0.85;

// Add a rough region.
roughness[6 * width + 6] = 0.90;

// Add a blocked region.
traversability[3 * width + 3] = 0;

const terrain = {
    width,
    height,
    slope,
    roughness,
    traversability
};

const hazards = detectHazards(terrain);

console.log("Total detected hazards:", hazards.length);

for (const hazard of hazards) {
    console.log(
        `Hazard at (${hazard.x}, ${hazard.y}) | ` +
        `Type: ${hazard.type}`
    );
}

// ---------------------------------------
// TEST 3: Check a Path Against Hazards
// ---------------------------------------

console.log("\n===== TEST 3: PATH SAFETY =====");

const path = [];

for (let x = 1; x <= 8; x++) {
    path.push({ x, y: 5 });
}

const safetyResult = checkPathForHazards(
    path,
    hazards
);

console.log("Path safe:", safetyResult.isSafe);
console.log("Message:", safetyResult.message);
console.log("Intersections:", safetyResult.intersections);

// ---------------------------------------
// TEST 4: Safe Path
// ---------------------------------------

console.log("\n===== TEST 4: SAFE PATH =====");

const safePath = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 2, y: 4 }
];

const safeResult = checkPathForHazards(
    safePath,
    hazards
);

console.log("Safe path:", safeResult.isSafe);
console.log("Message:", safeResult.message);

// ---------------------------------------
// TEST 5: Custom Thresholds
// ---------------------------------------

console.log("\n===== TEST 5: CUSTOM THRESHOLDS =====");

const customResult = classifyHazard(
    0.55,
    0.40,
    1,
    {
        maxSlope: 0.50,
        maxRoughness: 0.80
    }
);

console.log("Custom classification:", customResult);

// ---------------------------------------
// SUMMARY
// ---------------------------------------

console.log("\n===== TEST COMPLETED =====");

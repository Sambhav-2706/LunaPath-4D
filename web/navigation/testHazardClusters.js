
import assert from "node:assert/strict";
import { planRoute } from "./PathPlanner.js";

function createTerrain(width, height, hazards = []) {

    const traversability = new Uint8Array(width * height).fill(1);

    for (const hazard of hazards) {
        traversability[hazard.y * width + hazard.x] = 0;
    }

    return {
        width,
        height,
        cellSize: 10,
        slope: new Float32Array(width * height).fill(0),
        roughness: new Float32Array(width * height).fill(0),
        traversability
    };
}

let passed = 0;
let failed = 0;

function runTest(name, testFunction) {

    try {
        testFunction();
        passed++;
        console.log(`PASS: ${name}`);
    } catch (error) {
        failed++;
        console.error(`FAIL: ${name}`);
        console.error(error.message);
    }
}

function pathAvoidsHazards(path, hazards) {

    const hazardSet = new Set(
        hazards.map(h => `${h.x},${h.y}`)
    );

    return path.every(
        node => !hazardSet.has(`${node.x},${node.y}`)
    );
}

// ==========================================
// TEST 1: Central hazard cluster
// ==========================================

runTest("Route avoids central hazard cluster", () => {

    const hazards = [
        { x: 9, y: 9 },
        { x: 10, y: 9 },
        { x: 11, y: 9 },
        { x: 9, y: 10 },
        { x: 10, y: 10 },
        { x: 11, y: 10 },
        { x: 9, y: 11 },
        { x: 10, y: 11 },
        { x: 11, y: 11 }
    ];

    const terrain = createTerrain(20, 20, hazards);

    const result = planRoute(
        terrain,
        { x: 1, y: 1 },
        { x: 18, y: 18 },
        "BALANCED"
    );

    assert.equal(result.success, true, result.message);
    assert.ok(result.path.length > 0);
    assert.ok(pathAvoidsHazards(result.path, hazards));
});

// ==========================================
// TEST 2: Hazards near start
// ==========================================

runTest("Route escapes hazards near starting position", () => {

    const hazards = [
        { x: 1, y: 0 },
        { x: 1, y: 1 }
    ];

    const terrain = createTerrain(10, 10, hazards);

    const result = planRoute(
        terrain,
        { x: 0, y: 0 },
        { x: 9, y: 9 },
        "BALANCED"
    );

    assert.equal(result.success, true, result.message);
    assert.ok(result.path.length > 0);
    assert.deepEqual(result.path[0], { x: 0, y: 0 });
    assert.ok(pathAvoidsHazards(result.path, hazards));
});

// ==========================================
// TEST 3: Hazards near goal
// ==========================================

runTest("Route reaches goal near hazard cluster", () => {

    const hazards = [
        { x: 8, y: 9 },
        { x: 8, y: 8 }
    ];

    const terrain = createTerrain(10, 10, hazards);

    const result = planRoute(
        terrain,
        { x: 0, y: 0 },
        { x: 9, y: 9 },
        "BALANCED"
    );

    assert.equal(result.success, true, result.message);

    assert.deepEqual(
        result.path[result.path.length - 1],
        { x: 9, y: 9 }
    );

    assert.ok(pathAvoidsHazards(result.path, hazards));
});

// ==========================================
// TEST 4: Narrow corridor
// ==========================================

runTest("Route navigates through narrow corridor", () => {

    const width = 15;
    const height = 15;

    const traversability = new Uint8Array(width * height).fill(0);

    // Horizontal corridor
    for (let x = 0; x < width; x++) {
        traversability[7 * width + x] = 1;
    }

    // Vertical corridor leading to the goal
    for (let y = 7; y < height; y++) {
        traversability[y * width + 13] = 1;
    }

    const terrain = {
        width,
        height,
        cellSize: 10,
        slope: new Float32Array(width * height).fill(0),
        roughness: new Float32Array(width * height).fill(0),
        traversability
    };

    const result = planRoute(
        terrain,
        { x: 0, y: 7 },
        { x: 13, y: 14 },
        "FASTEST"
    );

    assert.equal(result.success, true, result.message);

    assert.deepEqual(result.path[0], { x: 0, y: 7 });

    assert.deepEqual(
        result.path[result.path.length - 1],
        { x: 13, y: 14 }
    );

    for (const node of result.path) {

        assert.equal(
            traversability[node.y * width + node.x],
            1,
            `Path entered blocked cell ${node.x},${node.y}`
        );
    }
});

// ==========================================
// TEST SUMMARY
// ==========================================

console.log("\n===== HAZARD CLUSTER TEST SUMMARY =====");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
    process.exitCode = 1;
} else {
    console.log("ALL TESTS PASSED");
}

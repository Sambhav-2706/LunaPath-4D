
import assert from "node:assert/strict";
import { planRoute } from "./PathPlanner.js";

function createTerrain(width, height) {

    return {
        width,
        height,
        cellSize: 10,
        slope: new Float64Array(width * height).fill(0),
        roughness: new Float64Array(width * height).fill(0),
        traversability: new Uint8Array(width * height).fill(1)
    };
}

function setCell(terrain, x, y, slope, roughness) {

    const index = y * terrain.width + x;

    terrain.slope[index] = slope;
    terrain.roughness[index] = roughness;
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

// ==========================================
// TEST 1: Avoid unsafe slope
// ==========================================

runTest("Planner avoids excessive slope", () => {

    const terrain = createTerrain(5, 5);

    setCell(terrain, 2, 2, 0.86, 0);

    const result = planRoute(
        terrain,
        { x: 0, y: 2 },
        { x: 4, y: 2 },
        "BALANCED"
    );

    assert.equal(result.success, true);

    assert.ok(
        !result.path.some(node => node.x === 2 && node.y === 2),
        "Route entered excessively steep terrain"
    );
});

// ==========================================
// TEST 2: Avoid unsafe roughness
// ==========================================

runTest("Planner avoids excessive roughness", () => {

    const terrain = createTerrain(5, 5);

    setCell(terrain, 2, 2, 0, 0.91);

    const result = planRoute(
        terrain,
        { x: 0, y: 2 },
        { x: 4, y: 2 },
        "BALANCED"
    );

    assert.equal(result.success, true);

    assert.ok(
        !result.path.some(node => node.x === 2 && node.y === 2),
        "Route entered excessively rough terrain"
    );
});

// ==========================================
// TEST 3: SAFEST slope threshold
// ==========================================

runTest("SAFEST accepts slope at threshold 0.65", () => {

    const terrain = createTerrain(3, 3);

    setCell(terrain, 2, 2, 0.65, 0);

    const result = planRoute(
        terrain,
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        "SAFEST"
    );

    assert.equal(result.success, true);
});

// ==========================================
// TEST 4: SAFEST rejects slope above threshold
// ==========================================

runTest("SAFEST rejects slope above 0.65", () => {

    const terrain = createTerrain(3, 3);

    setCell(terrain, 2, 2, 0.6501, 0);

    const result = planRoute(
        terrain,
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        "SAFEST"
    );

    assert.equal(result.success, false);
});

// ==========================================
// TEST 5: SAFEST roughness threshold
// ==========================================

runTest("SAFEST accepts roughness at threshold 0.75", () => {

    const terrain = createTerrain(3, 3);

    setCell(terrain, 2, 2, 0, 0.75);

    const result = planRoute(
        terrain,
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        "SAFEST"
    );

    assert.equal(result.success, true);
});

// ==========================================
// TEST 6: SAFEST rejects roughness above threshold
// ==========================================

runTest("SAFEST rejects roughness above 0.75", () => {

    const terrain = createTerrain(3, 3);

    setCell(terrain, 2, 2, 0, 0.7501);

    const result = planRoute(
        terrain,
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        "SAFEST"
    );

    assert.equal(result.success, false);
});

// ==========================================
// TEST 7: BALANCED slope threshold
// ==========================================

runTest("BALANCED accepts slope at threshold 0.85", () => {

    const terrain = createTerrain(3, 3);

    setCell(terrain, 2, 2, 0.85, 0);

    const result = planRoute(
        terrain,
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        "BALANCED"
    );

    assert.equal(result.success, true);
});

// ==========================================
// TEST 8: BALANCED rejects slope above threshold
// ==========================================

runTest("BALANCED rejects slope above 0.85", () => {

    const terrain = createTerrain(3, 3);

    setCell(terrain, 2, 2, 0.8501, 0);

    const result = planRoute(
        terrain,
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        "BALANCED"
    );

    assert.equal(result.success, false);
});

// ==========================================
// TEST 9: BALANCED roughness threshold
// ==========================================

runTest("BALANCED accepts roughness at threshold 0.90", () => {

    const terrain = createTerrain(3, 3);

    setCell(terrain, 2, 2, 0, 0.90);

    const result = planRoute(
        terrain,
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        "BALANCED"
    );

    assert.equal(result.success, true);
});

// ==========================================
// TEST 10: BALANCED rejects roughness above threshold
// ==========================================

runTest("BALANCED rejects roughness above 0.90", () => {

    const terrain = createTerrain(3, 3);

    setCell(terrain, 2, 2, 0, 0.9001);

    const result = planRoute(
        terrain,
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        "BALANCED"
    );

    assert.equal(result.success, false);
});

// ==========================================
// SUMMARY
// ==========================================

console.log("\n===== TERRAIN SAFETY TEST SUMMARY =====");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
    process.exitCode = 1;
} else {
    console.log("ALL TESTS PASSED");
}


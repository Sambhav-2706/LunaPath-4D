
import assert from "node:assert/strict";
import { planRoute } from "./PathPlanner.js";

function createOpenTerrain(width, height) {

    return {
        width,
        height,
        cellSize: 10,
        slope: new Float64Array(width * height).fill(0),
        roughness: new Float64Array(width * height).fill(0),
        traversability: new Uint8Array(width * height).fill(1)
    };
}

function countTurns(path) {

    if (path.length < 3) {
        return 0;
    }

    let turns = 0;

    let previousDirection = {
        x: path[1].x - path[0].x,
        y: path[1].y - path[0].y
    };

    for (let i = 2; i < path.length; i++) {

        const currentDirection = {
            x: path[i].x - path[i - 1].x,
            y: path[i].y - path[i -1].y
        };

        if (
            currentDirection.x !== previousDirection.x ||
            currentDirection.y !== previousDirection.y
        ) {
            turns++;
        }

        previousDirection = currentDirection;
    }

    return turns;
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
// TEST 1: Horizontal straight route
// ==========================================

runTest("Open horizontal route has no unnecessary turns", () => {

    const terrain = createOpenTerrain(10, 10);

    const result = planRoute(
        terrain,
        { x: 0, y: 5 },
        { x: 8, y: 5 },
        "FASTEST"
    );

    assert.equal(result.success, true);
    assert.equal(result.pathNodes, 9);
    assert.equal(countTurns(result.path), 0);
    assert.equal(result.totalDistanceMeters, 80);
});

// ==========================================
// TEST 2: Perfect diagonal route
// ==========================================

runTest("Open diagonal route follows direct diagonal", () => {

    const terrain = createOpenTerrain(10, 10);

    const result = planRoute(
        terrain,
        { x: 1, y: 1 },
        { x: 9, y: 9 },
        "FASTEST"
    );

    assert.equal(result.success, true);
    assert.equal(result.pathNodes, 9);
    assert.equal(countTurns(result.path), 0);

    const expectedDistance = 8 * Math.sqrt(2) * 10;

    assert.ok(
        Math.abs(result.totalDistanceMeters - expectedDistance) < 1e-9,
        `Expected ${expectedDistance}, got ${result.totalDistanceMeters}`
    );
});

// ==========================================
// TEST 3: Route endpoints and adjacency
// ==========================================

runTest("Open terrain path has valid adjacent steps", () => {

    const terrain = createOpenTerrain(20, 20);

    const start = { x: 2, y: 3 };
    const goal = { x: 15, y: 12 };

    const result = planRoute(
        terrain,
        start,
        goal,
        "BALANCED"
    );

    assert.equal(result.success, true);
    assert.deepEqual(result.path[0], start);
    assert.deepEqual(result.path[result.path.length - 1], goal);

    for (let i = 1; i < result.path.length; i++) {

        const dx = Math.abs(
            result.path[i].x - result.path[i - 1].x
        );

        const dy = Math.abs(
            result.path[i].y - result.path[i - 1].y
        );

        assert.ok(dx <= 1 && dy <= 1);
        assert.ok(dx + dy > 0);
    }
});

// ==========================================
// SUMMARY
// ==========================================

console.log("\n===== PATH QUALITY TEST SUMMARY =====");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
    process.exitCode = 1;
} else {
    console.log("ALL TESTS PASSED");
}

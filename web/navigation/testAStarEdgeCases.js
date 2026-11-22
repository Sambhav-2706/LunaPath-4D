
import assert from "node:assert/strict";
import { findPath } from "./AStar.js";

function createGrid(width, height, blocked = []) {

    const blockedSet = new Set(
        blocked.map(p => `${p.x},${p.y}`)
    );

    return {
        width,
        height,

        isWalkable(x, y) {
            return (
                x >= 0 &&
                x < width &&
                y >= 0 &&
                y < height &&
                !blockedSet.has(`${x},${y}`)
            );
        }
    };
}

function runTest(name, testFunction) {

    try {
        testFunction();
        console.log(`PASS: ${name}`);
    } catch (error) {
        console.error(`FAIL: ${name}`);
        console.error(error.message);
    }
}

// ==========================================
// TEST 1: Diagonal corner cutting prevention
// ==========================================

runTest("Blocked diagonal corner must not be crossed", () => {

    const grid = createGrid(2, 2, [
        { x: 1, y: 0 },
        { x: 0, y: 1 }
    ]);

    const path = findPath(
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        grid.width,
        grid.height,
        grid.isWalkable
    );

    assert.equal(path, null);
});

// ==========================================
// TEST 2: Valid diagonal movement
// ==========================================

runTest("Open diagonal movement should work", () => {

    const grid = createGrid(2, 2);

    const path = findPath(
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        grid.width,
        grid.height,
        grid.isWalkable
    );

    assert.ok(path);
    assert.equal(path.length, 2);
});

// ==========================================
// TEST 3: Unreachable destination
// ==========================================

runTest("Unreachable destination should return null", () => {

    const grid = createGrid(3, 3, [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 2 }
    ]);

    const path = findPath(
        { x: 0, y: 1 },
        { x: 2, y: 1 },
        grid.width,
        grid.height,
        grid.isWalkable
    );

    assert.equal(path, null);
});

// ==========================================
// TEST 4: Grid boundary
// ==========================================

runTest("Path along grid boundary should work", () => {

    const grid = createGrid(5, 5);

    const path = findPath(
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        grid.width,
        grid.height,
        grid.isWalkable
    );

    assert.ok(path);
    assert.equal(path[0].x, 0);
    assert.equal(path[0].y, 0);
    assert.equal(path[path.length - 1].x, 4);
    assert.equal(path[path.length - 1].y, 0);
});

// ==========================================
// TEST 5: Blocked start
// ==========================================

runTest("Blocked start should return null", () => {

    const grid = createGrid(5, 5, [
        { x: 0, y: 0 }
    ]);

    const path = findPath(
        { x: 0, y: 0 },
        { x: 4, y: 4 },
        grid.width,
        grid.height,
        grid.isWalkable
    );

    assert.equal(path, null);
});

// ==========================================
// TEST 6: Blocked goal
// ==========================================

runTest("Blocked goal should return null", () => {

    const grid = createGrid(5, 5, [
        { x: 4, y: 4 }
    ]);

    const path = findPath(
        { x: 0, y: 0 },
        { x: 4, y: 4 },
        grid.width,
        grid.height,
        grid.isWalkable
    );

    assert.equal(path, null);
});

// ==========================================
// TEST 7: Start equals goal
// ==========================================

runTest("Start equals goal should return one node", () => {

    const grid = createGrid(5, 5);

    const path = findPath(
        { x: 2, y: 2 },
        { x: 2, y: 2 },
        grid.width,
        grid.height,
        grid.isWalkable
    );

    assert.ok(path);
    assert.equal(path.length, 1);
    assert.deepEqual(path[0], { x: 2, y: 2 });
});

// ==========================================
// TEST 8: Invalid boundary coordinates
// ==========================================

runTest("Out-of-bounds start should return null", () => {

    const grid = createGrid(5, 5);

    const path = findPath(
        { x: -1, y: 0 },
        { x: 4, y: 4 },
        grid.width,
        grid.height,
        grid.isWalkable
    );

    assert.equal(path, null);
});

console.log("\n===== A* EDGE CASE TESTING COMPLETE =====");

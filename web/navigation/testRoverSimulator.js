
import assert from "node:assert/strict";
import { RoverSimulator } from "./RoverSimulator.js";

console.log("===== LUNAPATH ROVER SIMULATOR TEST =====");

// Test route: 30 meters total
const path = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1 }
];

const rover = new RoverSimulator(path, {
  cellSize: 10,
  speed: 5
});

// 1. Initial state
console.log("\n===== INITIAL STATE =====");

let state = rover.getSnapshot();

console.log(state);

assert.equal(state.status, "READY");
assert.equal(state.totalDistance, 30);
assert.equal(state.distanceTravelled, 0);
assert.equal(state.remainingDistance, 30);

// 2. Start
console.log("\n===== START ROVER =====");

state = rover.start();

assert.equal(state.status, "RUNNING");
console.log("Status:", state.status);

// 3. Move for 1 second
console.log("\n===== MOVEMENT TEST =====");

state = rover.update(1);

console.log("Position:", state.position);
console.log("Distance travelled:", state.distanceTravelled);
console.log("Remaining distance:", state.remainingDistance);
console.log("Progress:", state.progress.toFixed(2) + "%");

assert.equal(state.status, "RUNNING");
assert.equal(state.position.x, 0.5);
assert.equal(state.position.y, 0);
assert.equal(state.distanceTravelled, 5);
assert.equal(state.remainingDistance, 25);

// 4. Pause
console.log("\n===== PAUSE TEST =====");

state = rover.pause();

assert.equal(state.status, "PAUSED");

const pausedPosition = { ...state.position };

state = rover.update(5);

assert.deepEqual(state.position, pausedPosition);
assert.equal(state.distanceTravelled, 5);

console.log("Rover remained stationary while paused.");

// 5. Resume
console.log("\n===== RESUME TEST =====");

state = rover.resume();

assert.equal(state.status, "RUNNING");

// Move 1 second to waypoint (1,0)
state = rover.update(1);

console.log("Position:", state.position);
console.log("Distance travelled:", state.distanceTravelled);

assert.equal(state.position.x, 1);
assert.equal(state.position.y, 0);
assert.equal(state.distanceTravelled, 10);

// 6. Progress toward destination
console.log("\n===== DESTINATION TEST =====");

state = rover.update(2);

console.log("Position:", state.position);
console.log("Status:", state.status);
console.log("Distance travelled:", state.distanceTravelled);
console.log("Remaining distance:", state.remainingDistance);
console.log("Progress:", state.progress.toFixed(2) + "%");

assert.equal(state.status, "RUNNING");
assert.equal(state.position.x, 2);
assert.equal(state.position.y, 0);
assert.equal(state.distanceTravelled, 20);
assert.equal(state.remainingDistance, 10);

// 7. Final arrival
console.log("\n===== FINAL ARRIVAL TEST =====");

state = rover.update(2);

console.log("Position:", state.position);
console.log("Status:", state.status);
console.log("Distance travelled:", state.distanceTravelled);
console.log("Remaining distance:", state.remainingDistance);
console.log("Progress:", state.progress.toFixed(2) + "%");

assert.equal(state.status, "COMPLETED");
assert.equal(state.position.x, 2);
assert.equal(state.position.y, 1);
assert.equal(state.distanceTravelled, 30);
assert.equal(state.remainingDistance, 0);
assert.equal(state.progress, 100);

// 8. Invalid input
console.log("\n===== INVALID INPUT TEST =====");

assert.throws(() => rover.update(-1), {
  message: "Elapsed time must be non-negative."
});

console.log("Negative elapsed time correctly rejected.");

// 9. Final result
console.log("\n===== ALL ROVER TESTS PASSED =====");

// RoverSimulator.js

export class RoverSimulator {
  constructor(path, options = {}) {
    const {
      cellSize = 10,
      speed = 1
    } = options;

    if (!Array.isArray(path) || path.length === 0) {
      throw new Error("A valid navigation path is required.");
    }

    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new Error("Cell size must be a positive number.");
    }

    if (!Number.isFinite(speed) || speed <= 0) {
      throw new Error("Rover speed must be a positive number.");
    }

    for (const node of path) {
      if (
        !node ||
        !Number.isFinite(node.x) ||
        !Number.isFinite(node.y)
      ) {
        throw new Error("Path contains an invalid node.");
      }
    }

    // Store our own copy of the route.
    this.path = path.map(node => ({
      x: node.x,
      y: node.y
    }));

    this.cellSize = cellSize;
    this.speed = speed;

    // Rover initially stands at the first node.
    this.position = {
      x: this.path[0].x,
      y: this.path[0].y
    };

    // Index of the next node the rover must reach.
    this.segmentIndex = 1;

    this.status = "READY";
    this.distanceTravelled = 0;

    this.totalDistance = this.calculateTotalDistance();

    if (this.path.length === 1) {
      this.status = "COMPLETED";
    }
  }

  // Calculate total path length in meters.
  calculateTotalDistance() {
    let distance = 0;

    for (let i = 1; i < this.path.length; i++) {
      const dx = this.path[i].x - this.path[i - 1].x;
      const dy = this.path[i].y - this.path[i - 1].y;

      distance += Math.sqrt(dx * dx + dy * dy) * this.cellSize;
    }

    return distance;
  }

  // Start rover movement.
  start() {
    if (this.status !== "READY") {
      throw new Error("Rover can only start from READY state.");
    }

    this.status = "RUNNING";

    return this.getSnapshot();
  }

  // Pause rover movement.
  pause() {
    if (this.status !== "RUNNING") {
      return this.getSnapshot();
    }

    this.status = "PAUSED";

    return this.getSnapshot();
  }

  // Resume movement after pausing.
  resume() {
    if (this.status !== "PAUSED") {
      throw new Error("Rover can only resume from PAUSED state.");
    }

    this.status = "RUNNING";

    return this.getSnapshot();
  }

  // Stop the simulation.
  stop() {
    if (
      this.status === "RUNNING" ||
      this.status === "PAUSED" ||
      this.status === "READY"
    ) {
      this.status = "STOPPED";
    }

    return this.getSnapshot();
  }

  // Advance the rover according to elapsed simulation time.
  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new Error("Elapsed time must be non-negative.");
    }

    if (this.status !== "RUNNING") {
      return this.getSnapshot();
    }

    let movementRemaining = this.speed * deltaSeconds;

    while (
      movementRemaining > 0 &&
      this.segmentIndex < this.path.length
    ) {
      const target = this.path[this.segmentIndex];

      const dx = target.x - this.position.x;
      const dy = target.y - this.position.y;

      const gridDistance = Math.sqrt(dx * dx + dy * dy);
      const segmentDistanceMeters = gridDistance * this.cellSize;

      // Already at this waypoint.
      if (segmentDistanceMeters < 1e-9) {
        this.position = {
          x: target.x,
          y: target.y
        };

        this.segmentIndex++;
        continue;
      }

      // Rover can reach this waypoint in the current update.
      if (movementRemaining >= segmentDistanceMeters) {
        this.position = {
          x: target.x,
          y: target.y
        };

        this.distanceTravelled += segmentDistanceMeters;
        movementRemaining -= segmentDistanceMeters;

        this.segmentIndex++;
      } else {
        // Move partially along the current segment.
        const fraction =
          movementRemaining / segmentDistanceMeters;

        this.position = {
          x: this.position.x + dx * fraction,
          y: this.position.y + dy * fraction
        };

        this.distanceTravelled += movementRemaining;
        movementRemaining = 0;
      }
    }

    // Destination reached.
    if (this.segmentIndex >= this.path.length) {
      this.position = {
        ...this.path[this.path.length - 1]
      };

      this.distanceTravelled = this.totalDistance;
      this.status = "COMPLETED";
    }

    return this.getSnapshot();
  }

  // Calculate distance remaining to destination.
  calculateRemainingDistance() {
    if (this.status === "COMPLETED") {
      return 0;
    }

    let remaining = 0;

    if (this.segmentIndex < this.path.length) {
      const target = this.path[this.segmentIndex];

      const dx = target.x - this.position.x;
      const dy = target.y - this.position.y;

      remaining += Math.sqrt(dx * dx + dy * dy) * this.cellSize;
    }

    for (let i = this.segmentIndex + 1; i < this.path.length; i++) {
      const previous = this.path[i - 1];
      const current = this.path[i];

      const dx = current.x - previous.x;
      const dy = current.y - previous.y;

      remaining += Math.sqrt(dx * dx + dy * dy) * this.cellSize;
    }

    return remaining;
  }

  // Return the current simulation state.
  getSnapshot() {
    return {
      status: this.status,

      position: {
        x: this.position.x,
        y: this.position.y
      },

      target:
        this.segmentIndex < this.path.length
          ? { ...this.path[this.segmentIndex] }
          : null,

      speed: this.speed,

      distanceTravelled: this.distanceTravelled,

      totalDistance: this.totalDistance,

      remainingDistance: this.calculateRemainingDistance(),

      progress:
        this.totalDistance === 0
          ? 100
          : (this.distanceTravelled / this.totalDistance) * 100,

      currentNodeIndex: Math.min(
        this.segmentIndex,
        this.path.length - 1
      ),

      totalNodes: this.path.length
    };
  }
}
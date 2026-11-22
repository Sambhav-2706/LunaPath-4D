
/*
 * LunaPath-4D
 * Autonomous Navigation Module
 * Member 3 - A* Pathfinding
 */

// Calculate estimated distance between two cells
function heuristic(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);

    // Octile distance for diagonal movement
    return (
        Math.max(dx, dy) +
        (Math.sqrt(2) - 1) * Math.min(dx, dy)
    );
}

// Get neighboring cells
function getNeighbors(node, width, height, isWalkable) {

    const directions = [
        { x: 0, y: -1, cost: 1 },
        { x: 0, y: 1, cost: 1 },
        { x: -1, y: 0, cost: 1 },
        { x: 1, y: 0, cost: 1 },

        { x: -1, y: -1, cost: Math.sqrt(2) },
        { x: 1, y: -1, cost: Math.sqrt(2) },
        { x: -1, y: 1, cost: Math.sqrt(2) },
        { x: 1, y: 1, cost: Math.sqrt(2) }
    ];

    const neighbors = [];

    for (const direction of directions) {

        const x = node.x + direction.x;
        const y = node.y + direction.y;

        // Check grid boundaries
        if (
            x < 0 ||
            x >= width ||
            y < 0 ||
            y >= height
        ) {
            continue;
        }

        // Skip blocked destination cells
        if (!isWalkable(x, y)) {
            continue;
        }

        // Prevent diagonal movement through blocked corners
        if (direction.x !== 0 && direction.y !== 0) {

            const horizontalBlocked = !isWalkable(
                node.x + direction.x,
                node.y
            );

            const verticalBlocked = !isWalkable(
                node.x,
                node.y + direction.y
            );

            if (horizontalBlocked || verticalBlocked) {
                continue;
            }
        }

        neighbors.push({
            x: x,
            y: y,
            movementCost: direction.cost
        });
    }

    return neighbors;
}

// A* Pathfinding Algorithm
export function findPath(
    start,
    goal,
    width,
    height,
    isWalkable,
    getTerrainCost = () => 1
) {

    // Validate start and goal
    if (
        start.x < 0 || start.x >= width ||
        start.y < 0 || start.y >= height ||
        goal.x < 0 || goal.x >= width ||
        goal.y < 0 || goal.y >= height
    ) {
        return null;
    }

    if (!isWalkable(start.x, start.y)) {
        return null;
    }

    if (!isWalkable(goal.x, goal.y)) {
        return null;
    }

    const openSet = [
        { x: start.x, y: start.y }
    ];

    const closedSet = new Set();

    const cameFrom = new Map();

    const gScore = new Map();
    const fScore = new Map();

    function key(node) {
        return `${node.x},${node.y}`;
    }

    // Starting node
    gScore.set(key(start), 0);

    fScore.set(
        key(start),
        heuristic(start, goal)
    );

    while (openSet.length > 0) {

        // Find node with lowest fScore
        let currentIndex = 0;

        for (let i = 1; i < openSet.length; i++) {

            if (
                fScore.get(key(openSet[i])) <
                fScore.get(key(openSet[currentIndex]))
            ) {
                currentIndex = i;
            }
        }

        // Remove best node from openSet
        const current = openSet.splice(currentIndex, 1)[0];

        // Destination reached
        if (
            current.x === goal.x &&
            current.y === goal.y
        ) {
            return reconstructPath(cameFrom, current);
        }

        closedSet.add(key(current));

        const neighbors = getNeighbors(
            current,
            width,
            height,
            isWalkable
        );

        for (const neighbor of neighbors) {

            // Ignore already evaluated nodes
            if (closedSet.has(key(neighbor))) {
                continue;
            }

            // Get terrain multiplier
            const terrainMultiplier = Math.max(
                1,
                getTerrainCost(neighbor.x, neighbor.y)
            );

            // Calculate tentative movement cost
            const tentativeGScore =
                gScore.get(key(current)) +
                (neighbor.movementCost * terrainMultiplier);

            // Ignore paths that are not better
            if (
                tentativeGScore >=
                (gScore.get(key(neighbor)) ?? Infinity)
            ) {
                continue;
            }

            // Record best path to this neighbor
            cameFrom.set(key(neighbor), current);

            gScore.set(
                key(neighbor),
                tentativeGScore
            );

            fScore.set(
                key(neighbor),
                tentativeGScore + heuristic(neighbor, goal)
            );

            // Add node to openSet if not already present
            if (!openSet.some(n => key(n) === key(neighbor))) {
                openSet.push({
                    x: neighbor.x,
                    y: neighbor.y
                });
            }
        }
    }

    // No valid path exists
    return null;
}

// Reconstruct the final path
function reconstructPath(cameFrom, current) {

    const path = [
        { x: current.x, y: current.y }
    ];

    function key(node) {
        return `${node.x},${node.y}`;
    }

    while (cameFrom.has(key(current))) {

        current = cameFrom.get(key(current));

        path.unshift({
            x: current.x,
            y: current.y
        });
    }

    return path;
}

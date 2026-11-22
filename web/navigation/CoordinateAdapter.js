
const TERRAIN_CENTER_OFFSET = 127.5;
const CELL_SIZE = 10;
const GRID_SIZE = 256;

function validateCoordinate(value, name) {
    if (!Number.isFinite(value)) {
        throw new Error(`${name} must be a finite number.`);
    }
}

export function gridToWorld(gridPoint, cellSize = CELL_SIZE) {
    if (!gridPoint || typeof gridPoint !== "object") {
        throw new Error("Grid point is required.");
    }

    validateCoordinate(gridPoint.x, "gridPoint.x");
    validateCoordinate(gridPoint.y, "gridPoint.y");

    if (gridPoint.x < 0 || gridPoint.x >= GRID_SIZE ||
        gridPoint.y < 0 || gridPoint.y >= GRID_SIZE) {
        throw new Error("Grid point is outside terrain bounds.");
    }

    return {
        x: (gridPoint.x - TERRAIN_CENTER_OFFSET) * cellSize,
        z: (gridPoint.y - TERRAIN_CENTER_OFFSET) * cellSize
    };
}

export function worldToGrid(worldPoint, cellSize = CELL_SIZE) {
    if (!worldPoint || typeof worldPoint !== "object") {
        throw new Error("World point is required.");
    }

    validateCoordinate(worldPoint.x, "worldPoint.x");
    validateCoordinate(worldPoint.z, "worldPoint.z");

    const gridPoint = {
        x: worldPoint.x / cellSize + TERRAIN_CENTER_OFFSET,
        y: worldPoint.z / cellSize + TERRAIN_CENTER_OFFSET
    };

    if (
        gridPoint.x < 0 ||
        gridPoint.x >= GRID_SIZE ||
        gridPoint.y < 0 ||
        gridPoint.y >= GRID_SIZE
    ) {
        throw new Error("World point is outside terrain bounds.");
    }

    return {
        x: Math.round(gridPoint.x),
        y: Math.round(gridPoint.y)
    };
}

export function pathToWorld(path, cellSize = CELL_SIZE) {
    if (!Array.isArray(path)) {
        throw new Error("Path must be an array.");
    }

    return path.map(point => gridToWorld(point, cellSize));
}

export function hazardsToWorld(hazards, cellSize = CELL_SIZE) {
    if (!Array.isArray(hazards)) {
        throw new Error("Hazards must be an array.");
    }

    return hazards.map(hazard => {
        const position = gridToWorld(hazard, cellSize);

        return {
            ...hazard,
            worldX: position.x,
            worldZ: position.z
        };
    });
}

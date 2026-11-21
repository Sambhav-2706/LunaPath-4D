
/**
 * LunaPath-4D
 * Browser Navigation Integration Example
 *
 * Connects browser terrain loading, route planning,
 * and grid-to-Three.js world coordinate conversion.
 */

import {
    createBrowserNavigationTerrain
} from "./BrowserTerrainAdapter.js";

import {
    planRoute
} from "./PathPlanner.js";

import {
    gridToWorld,
    pathToWorld,
    hazardsToWorld
} from "./CoordinateAdapter.js";


export async function createNavigationPayload() {
    // 1. Load terrain in the browser
    const terrain = await createBrowserNavigationTerrain();

    // 2. Define mission coordinates in GRID space
    const start = { x: 5, y: 5 };
    const destination = { x: 250, y: 250 };

    // 3. Define hazards in GRID space
    const hazards = [];

    // 4. Plan route using the existing path planner
    const result = planRoute(
        terrain,
        start,
        destination,
        "BALANCED"
    );

    if (!result.success) {
        throw new Error(
            `Navigation failed: ${result.message}`
        );
    }

    // 5. Convert grid coordinates into Three.js world coordinates
    const worldStart = gridToWorld(
        start,
        terrain.cellSize
    );

    const worldDestination = gridToWorld(
        destination,
        terrain.cellSize
    );

    const worldPath = pathToWorld(
        result.path,
        terrain.cellSize
    );

    const worldHazards = hazardsToWorld(
        hazards,
        terrain.cellSize
    );

    // 6. Create simulation integration payload
    const navigationPayload = {
        coordinateSystem: {
            grid: "XY",
            world: "XZ",
            gridXToWorldX: "+X",
            gridYToWorldZ: "+Z",
            cellSize: terrain.cellSize,
            terrainWidth: terrain.width,
            terrainHeight: terrain.height
        },

        start: {
            grid: { ...start },
            world: worldStart
        },

        destination: {
            grid: { ...destination },
            world: worldDestination
        },

        path: {
            grid: result.path.map(node => ({
                x: node.x,
                y: node.y
            })),
            world: worldPath
        },

        hazards: {
            grid: hazards.map(hazard => ({
                ...hazard
            })),
            world: worldHazards
        },

        mode: result.mode,
        totalDistanceMeters: result.totalDistanceMeters,
        totalCost: result.totalCost,
        pathNodes: result.pathNodes
    };

    console.log("Navigation payload:", navigationPayload);

    return navigationPayload;
}


// Example invocation from a browser application
export async function runNavigationExample() {
    try {
        const payload = await createNavigationPayload();

        console.log("Grid route:", payload.path.grid);
        console.log("World route:", payload.path.world);

        console.log("Grid destination:", payload.destination.grid);
        console.log("World destination:", payload.destination.world);

        console.log("Grid hazards:", payload.hazards.grid);
        console.log("World hazards:", payload.hazards.world);

        return payload;
    } catch (error) {
        console.error("Navigation integration error:", error);
        throw error;
    }
}

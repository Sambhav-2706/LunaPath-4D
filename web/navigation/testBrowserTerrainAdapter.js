/**
 * LunaPath-4D
 * Browser Terrain Adapter Test
 *
 * Tests browser terrain loading through HTTP fetch().
 * Compares browser-generated terrain with the Node terrain adapter.
 */

import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import {
    createNavigationTerrain
} from "./TerrainAdapter.js";

import {
    createBrowserNavigationTerrain
} from "./BrowserTerrainAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(
    __dirname,
    "..",
    "public",
    "data"
);

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function compareArrays(a, b, label) {
    assert(a.length === b.length, `${label} length mismatch`);

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            throw new Error(
                `${label} mismatch at index ${i}: ${a[i]} !== ${b[i]}`
            );
        }
    }
}

async function runTest() {
    console.log("===== BROWSER TERRAIN ADAPTER TEST =====");

    const server = createServer(async (req, res) => {
        try {
            const requestPath = new URL(
                req.url,
                "http://localhost"
            ).pathname;

            const fileName = path.basename(requestPath);

            if (
                fileName !== "terrain_meta.json" &&
                fileName !== "dem.bin"
            ) {
                res.writeHead(404);
                res.end("Not found");
                return;
            }

            const filePath = path.join(DATA_DIR, fileName);
            const data = await readFile(filePath);

            if (fileName === "terrain_meta.json") {
                res.writeHead(200, {
                    "Content-Type": "application/json"
                });
            } else {
                res.writeHead(200, {
                    "Content-Type": "application/octet-stream"
                });
            }

            res.end(data);
        } catch (error) {
            res.writeHead(500);
            res.end(error.message);
        }
    });

    await new Promise(resolve => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    globalThis.window = {
        location: {
            href: `${baseUrl}/test`
        }
    };

    try {
        // -----------------------------------------
        // 1. Load terrain using Node adapter
        // -----------------------------------------

        console.log("\n===== NODE TERRAIN =====");

        const nodeTerrain = createNavigationTerrain(DATA_DIR);

        console.log("Width:", nodeTerrain.width);
        console.log("Height:", nodeTerrain.height);
        console.log("Cell size:", nodeTerrain.cellSize);
        console.log("Elevation cells:", nodeTerrain.elevation.length);

        // -----------------------------------------
        // 2. Load terrain using browser adapter
        // -----------------------------------------

        console.log("\n===== BROWSER TERRAIN =====");

        const browserTerrain =
            await createBrowserNavigationTerrain(
                `${baseUrl}/data/terrain_meta.json`
            );

        console.log("Width:", browserTerrain.width);
        console.log("Height:", browserTerrain.height);
        console.log("Cell size:", browserTerrain.cellSize);
        console.log("Elevation cells:", browserTerrain.elevation.length);

        // -----------------------------------------
        // 3. Compare dimensions
        // -----------------------------------------

        assert(
            nodeTerrain.width === browserTerrain.width,
            "Width mismatch"
        );

        assert(
            nodeTerrain.height === browserTerrain.height,
            "Height mismatch"
        );

        assert(
            nodeTerrain.cellSize === browserTerrain.cellSize,
            "Cell size mismatch"
        );

        // -----------------------------------------
        // 4. Compare calculated data
        // -----------------------------------------

        console.log("\n===== COMPARING TERRAIN DATA =====");

        compareArrays(
            nodeTerrain.elevation,
            browserTerrain.elevation,
            "Elevation"
        );

        compareArrays(
            nodeTerrain.slope,
            browserTerrain.slope,
            "Slope"
        );

        compareArrays(
            nodeTerrain.roughness,
            browserTerrain.roughness,
            "Roughness"
        );

        compareArrays(
            nodeTerrain.traversability,
            browserTerrain.traversability,
            "Traversability"
        );

        // -----------------------------------------
        // 5. Final result
        // -----------------------------------------

        console.log("\n===== RESULTS =====");

        console.log("Elevation: MATCH");
        console.log("Slope: MATCH");
        console.log("Roughness: MATCH");
        console.log("Traversability: MATCH");

        console.log("\nBROWSER TERRAIN ADAPTER TEST PASSED");
    } finally {
        await new Promise(resolve => server.close(resolve));
        delete globalThis.window;
    }
}

runTest().catch(error => {
    console.error("\nBROWSER TERRAIN ADAPTER TEST FAILED");
    console.error(error);
    process.exitCode = 1;
});
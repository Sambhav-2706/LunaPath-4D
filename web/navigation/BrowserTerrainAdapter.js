
/**
 * LunaPath-4D
 * Browser Terrain Adapter
 *
 * Browser-compatible DEM loader for Vite and Three.js.
 * Uses fetch() instead of Node.js filesystem modules.
 *
 * Returns the same terrain structure as TerrainAdapter.js.
 */

const SLOPE_NORMALIZATION_DEGREES = 45;
const ROUGHNESS_NORMALIZATION_METERS = 3;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export async function loadBrowserElevationData(
    dataUrl = "/data/terrain_meta.json"
) {
    // -----------------------------------------
    // 1. Load terrain metadata
    // -----------------------------------------

    const metadataUrl = new URL(
        dataUrl,
        window.location.href
    );

    const metadataResponse = await fetch(metadataUrl);

    if (!metadataResponse.ok) {
        throw new Error(
            `Failed to load terrain metadata: ${metadataResponse.status}`
        );
    }

    const metadata = await metadataResponse.json();

    // -----------------------------------------
    // 2. Load DEM binary
    // -----------------------------------------

    const binaryFileName = metadata.binary_file || metadata.files?.dem_binary || "dem.bin";
    const binaryUrl = new URL(
        binaryFileName,
        metadataUrl
    );

    const binaryResponse = await fetch(binaryUrl);

    if (!binaryResponse.ok) {
        throw new Error(
            `Failed to load DEM binary: ${binaryResponse.status}`
        );
    }

    const buffer = await binaryResponse.arrayBuffer();

    // -----------------------------------------
    // 3. Validate DEM size
    // -----------------------------------------

    const expectedCells = metadata.width * metadata.height;
    const expectedBytes = expectedCells * 4;

    if (buffer.byteLength !== expectedBytes) {
        throw new Error(
            `DEM size mismatch. Expected ${expectedBytes} bytes, ` +
            `received ${buffer.byteLength} bytes.`
        );
    }

    // -----------------------------------------
    // 4. Decode little-endian Float32 DEM
    // -----------------------------------------

    const elevation = new Float32Array(expectedCells);
    const dataView = new DataView(buffer);

    for (let i = 0; i < expectedCells; i++) {
        elevation[i] = dataView.getFloat32(
            i * 4,
            true
        );
    }

    return {
        metadata,
        elevation
    };
}

// ---------------------------------------------
// 5. Calculate normalized terrain slope
// ---------------------------------------------

export function calculateBrowserSlope(
    elevation,
    width,
    height,
    cellSize
) {
    const slope = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const leftX = Math.max(0, x - 1);
            const rightX = Math.min(width - 1, x + 1);

            const downY = Math.max(0, y - 1);
            const upY = Math.min(height - 1, y + 1);

            const left = elevation[y * width + leftX];
            const right = elevation[y * width + rightX];

            const down = elevation[downY * width + x];
            const up = elevation[upY * width + x];

            const dxDistance =
                (rightX - leftX) * cellSize;

            const dyDistance =
                (upY - downY) * cellSize;

            const gx = dxDistance > 0
                ? (right - left) / dxDistance
                : 0;

            const gy = dyDistance > 0
                ? (up - down) / dyDistance
                : 0;

            const gradient = Math.sqrt(
                gx * gx + gy * gy
            );

            const slopeDegrees =
                Math.atan(gradient) * (180 / Math.PI);

            slope[y * width + x] = clamp(
                slopeDegrees / SLOPE_NORMALIZATION_DEGREES,
                0,
                1
            );
        }
    }

    return slope;
}

// ---------------------------------------------
// 6. Calculate normalized terrain roughness
// ---------------------------------------------

export function calculateBrowserRoughness(
    elevation,
    width,
    height
) {
    const roughness = new Float32Array(width * height);
    const radius = 1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            let sumSquares = 0;
            let count = 0;

            for (
                let ny = Math.max(0, y - radius);
                ny <= Math.min(height - 1, y + radius);
                ny++
            ) {
                for (
                    let nx = Math.max(0, x - radius);
                    nx <= Math.min(width - 1, x + radius);
                    nx++
                ) {
                    const value =
                        elevation[ny * width + nx];

                    sum += value;
                    sumSquares += value * value;
                    count++;
                }
            }

            const mean = sum / count;

            const variance = Math.max(
                0,
                sumSquares / count - mean * mean
            );

            const localStdDev = Math.sqrt(variance);

            roughness[y * width + x] = clamp(
                localStdDev / ROUGHNESS_NORMALIZATION_METERS,
                0,
                1
            );
        }
    }

    return roughness;
}

// ---------------------------------------------
// 7. Create browser navigation terrain
// ---------------------------------------------

export async function createBrowserNavigationTerrain(
    dataUrl = "/data/terrain_meta.json"
) {
    const { metadata, elevation } =
        await loadBrowserElevationData(dataUrl);

    const width = metadata.width;
    const height = metadata.height;
    const cellSize = metadata.cell_size_meters;

    if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0 ||
        !Number.isFinite(cellSize) ||
        cellSize <= 0
    ) {
        throw new Error(
            "Invalid terrain dimensions or cell size."
        );
    }

    // Validate elevation data
    for (let i = 0; i < elevation.length; i++) {
        if (!Number.isFinite(elevation[i])) {
            throw new Error(
                `Invalid elevation value at index ${i}.`
            );
        }
    }

    // Calculate terrain features
    const slope = calculateBrowserSlope(
        elevation,
        width,
        height,
        cellSize
    );

    const roughness = calculateBrowserRoughness(
        elevation,
        width,
        height
    );

    // Initialize traversability
    const traversability =
        new Uint8Array(width * height);

    traversability.fill(1);

    // Return navigation-compatible terrain object
    return {
        width,
        height,
        cellSize,
        elevation,
        slope,
        roughness,
        traversability,
        metadata
    };
}

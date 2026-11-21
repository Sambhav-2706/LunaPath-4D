
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "public", "data");

// Prototype normalization assumptions.
// These are tunable, not validated lunar rover thresholds.
const SLOPE_NORMALIZATION_DEGREES = 45;
const ROUGHNESS_NORMALIZATION_METERS = 3;

function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
}

export function loadElevationData(dataDir = DATA_DIR) {
    const metadataPath = path.join(dataDir, "terrain_meta.json");

    if (!fs.existsSync(metadataPath)) {
        throw new Error(`Terrain metadata not found: ${metadataPath}`);
    }

    const metadata = JSON.parse(
        fs.readFileSync(metadataPath, "utf8")
    );

    const binaryPath = path.join(
        dataDir,
        metadata.binary_file
    );

    if (!fs.existsSync(binaryPath)) {
        throw new Error(`DEM binary not found: ${binaryPath}`);
    }

    const buffer = fs.readFileSync(binaryPath);

    const expectedCells = metadata.width * metadata.height;
    const expectedBytes = expectedCells * 4;

    if (buffer.length !== expectedBytes) {
        throw new Error(
            `DEM size mismatch. Expected ${expectedBytes} bytes, ` +
            `received ${buffer.length} bytes.`
        );
    }

    // DEM stores little-endian float32 elevations.
    const elevation = new Float32Array(expectedCells);

    for (let i = 0; i < expectedCells; i++) {
        elevation[i] = buffer.readFloatLE(i * 4);
    }

    return {
        metadata,
        elevation
    };
}

export function calculateSlope(
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

            const dxDistance = (rightX - leftX) * cellSize;
            const dyDistance = (upY - downY) * cellSize;

            const gx = dxDistance > 0
                ? (right - left) / dxDistance
                : 0;

            const gy = dyDistance > 0
                ? (up - down) / dyDistance
                : 0;

            const gradient = Math.sqrt(gx * gx + gy * gy);

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

export function calculateRoughness(
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
                    const value = elevation[ny * width + nx];

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

export function createNavigationTerrain(dataDir = DATA_DIR) {
    const { metadata, elevation } = loadElevationData(dataDir);

    const width = metadata.width;
    const height = metadata.height;
    const cellSize = metadata.cell_size_meters;

    if (
        width <= 0 ||
        height <= 0 ||
        cellSize <= 0
    ) {
        throw new Error("Invalid terrain dimensions or cell size.");
    }

    for (let i = 0; i < elevation.length; i++) {
        if (!Number.isFinite(elevation[i])) {
            throw new Error(
                `Invalid elevation value at index ${i}.`
            );
        }
    }

    const slope = calculateSlope(
        elevation,
        width,
        height,
        cellSize
    );

    const roughness = calculateRoughness(
        elevation,
        width,
        height
    );

    const traversability = new Uint8Array(width * height);

    // Initially, all valid cells are traversable.
    traversability.fill(1);

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

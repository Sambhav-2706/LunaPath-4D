/**
 * LunaPath-4D Terrain Loader & Data Integration Helper
 * Role: Member 1 (Terrain & Data Engineering) integration bridge for Member 4 (Three.js 3D View)
 *
 * Provides ready-to-use asynchronous loader functions to load:
 * - DEM elevation buffer (Float32Array)
 * - Slope buffer (Float32Array)
 * - Roughness buffer (Float32Array)
 * - Traversability cost buffer (Float32Array)
 * - Terrain & hazard metadata (JSON)
 *
 * Also provides Three.js geometry & vertex-coloring utility helpers.
 */

import * as THREE from "three";

/**
 * Fetch and load all terrain binary buffers and metadata from public/data
 * @param {string} basePath Base path to terrain data directory
 * @returns {Promise<Object>} Terrain dataset object
 */
export async function loadTerrainData(basePath = "/data") {
  // 1. Fetch metadata first to know grid dimensions
  const metaResponse = await fetch(`${basePath}/terrain_meta.json`);
  if (!metaResponse.ok) {
    throw new Error(`Failed to load terrain metadata from ${basePath}/terrain_meta.json`);
  }
  const metadata = await metaResponse.json();

  const width = metadata.width || 256;
  const height = metadata.height || 256;
  const totalCells = width * height;

  // 2. Load all binary buffers in parallel
  const [demBuffer, slopeBuffer, roughBuffer, travBuffer, hazardsResponse] = await Promise.all([
    fetch(`${basePath}/dem.bin`).then((r) => r.arrayBuffer()),
    fetch(`${basePath}/slope.bin`).then((r) => r.arrayBuffer()),
    fetch(`${basePath}/rough.bin`).then((r) => r.arrayBuffer()),
    fetch(`${basePath}/traversability.bin`).then((r) => r.arrayBuffer()),
    fetch(`${basePath}/hazards.json`).then((r) => (r.ok ? r.json() : []))
  ]);

  const dem = new Float32Array(demBuffer);
  const slope = new Float32Array(slopeBuffer);
  const roughness = new Float32Array(roughBuffer);
  const traversability = new Float32Array(travBuffer);

  return {
    metadata,
    width,
    height,
    totalCells,
    cellSizeMeters: metadata.cell_size_meters || 10.0,
    gridWidthMeters: metadata.grid_width_meters || width * 10.0,
    gridHeightMeters: metadata.grid_height_meters || height * 10.0,
    dem,
    slope,
    roughness,
    traversability,
    hazards: hazardsResponse
  };
}

/**
 * Construct a Three.js PlaneGeometry with heights populated from dem.bin
 * @param {Object} terrainData Output from loadTerrainData()
 * @param {number} verticalExaggeration Scaling factor for vertical elevation
 * @returns {THREE.PlaneGeometry} Configured Three.js geometry with terrain vertices
 */
export function createTerrainGeometry(terrainData, verticalExaggeration = 1.0) {
  const { width, height, gridWidthMeters, gridHeightMeters, dem, metadata } = terrainData;

  const baseElevation = metadata.elevation_analysis?.min_elevation_m || 0;

  // Geometry dimensions in 3D world units (X and Z)
  const geometry = new THREE.PlaneGeometry(
    gridWidthMeters,
    gridHeightMeters,
    width - 1,
    height - 1
  );

  // Rotate to lie horizontally on XZ plane
  geometry.rotateX(-Math.PI / 2);

  const positionAttribute = geometry.attributes.position;

  for (let i = 0; i < positionAttribute.count; i++) {
    // Map geometry vertex index to grid coordinate
    // PlaneGeometry vertices are ordered row by row
    const elevation = dem[i];
    // Set Y coordinate (height in Three.js) relative to base
    positionAttribute.setY(i, (elevation - baseElevation) * verticalExaggeration);
  }

  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Generate per-vertex color attributes based on slope or traversability heatmap
 * @param {Object} terrainData
 * @param {"slope"|"traversability"|"elevation"} mode
 * @returns {THREE.Float32BufferAttribute}
 */
export function generateTerrainVertexColors(terrainData, mode = "slope") {
  const { totalCells, slope, traversability, dem, metadata } = terrainData;
  const colors = new Float32Array(totalCells * 3);

  const color = new THREE.Color();

  for (let i = 0; i < totalCells; i++) {
    if (mode === "slope") {
      const s = slope[i];
      if (s < 5.0) {
        // Safe green (0.2, 0.7, 0.3)
        color.setRGB(0.25, 0.65, 0.3);
      } else if (s < 10.0) {
        // Moderate yellow-green
        color.setRGB(0.65, 0.75, 0.2);
      } else if (s <= 15.0) {
        // Caution orange
        color.setRGB(0.9, 0.55, 0.1);
      } else {
        // Critical slope red
        color.setRGB(0.85, 0.15, 0.15);
      }
    } else if (mode === "traversability") {
      const cost = traversability[i];
      // Lerp from green (0.0) to yellow (0.5) to red (1.0)
      if (cost < 0.5) {
        const t = cost / 0.5;
        color.setRGB(0.2 + 0.6 * t, 0.7, 0.2 * (1 - t));
      } else {
        const t = (cost - 0.5) / 0.5;
        color.setRGB(0.85, 0.7 * (1 - t), 0.15 * (1 - t));
      }
    } else {
      // Monochromatic lunar regolith shaded by relative elevation
      const minEl = metadata.elevation_analysis?.min_elevation_m || 90;
      const maxEl = metadata.elevation_analysis?.max_elevation_m || 150;
      const t = Math.max(0, Math.min(1, (dem[i] - minEl) / (maxEl - minEl)));
      const gray = 0.25 + 0.55 * t;
      color.setRGB(gray, gray, gray * 1.05);
    }

    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  return new THREE.Float32BufferAttribute(colors, 3);
}

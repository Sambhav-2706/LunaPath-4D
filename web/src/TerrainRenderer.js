/**
 * LunaPath-4D
 * TerrainRenderer.js
 *
 * Member 2 - 3D Lunar Terrain Rendering Engine
 * Loads Member 1 binary DEM, slope, roughness, traversability, and hazards.
 * Renders high-fidelity Three.js terrain mesh with 5 visualization modes
 * and provides smooth elevation & normal vector interpolation for rover physics.
 */

import * as THREE from "three";

export class TerrainRenderer {
  constructor(options = {}) {
    this.basePath = options.basePath || "/data";
    this.verticalExaggeration = options.verticalExaggeration ?? 1.0;
    this.terrainData = null;
    this.mesh = null;
    this.geometry = null;
    this.material = null;
    this.hazardGroup = new THREE.Group();
    this.hazardGroup.name = "HazardsLayer";
    this.dynamicHazardGroup = new THREE.Group();
    this.dynamicHazardGroup.name = "DynamicHazardsLayer";
    this.dynamicBeacons = [];
    this.colorAttributes = {};
    this.currentMode = "normal";
    this.isLoaded = false;
  }

  /**
   * Load binary terrain data exported by Member 1 pipeline.
   */
  async load() {
    // 1. Fetch metadata
    const metaResponse = await fetch(`${this.basePath}/terrain_meta.json`);
    if (!metaResponse.ok) {
      throw new Error(`Failed to load terrain metadata from ${this.basePath}/terrain_meta.json`);
    }
    const metadata = await metaResponse.json();

    const width = metadata.width || 256;
    const height = metadata.height || 256;
    const totalCells = width * height;

    // 2. Fetch binary buffers in parallel
    const [demBuffer, slopeBuffer, roughBuffer, travBuffer, hazardsResponse] = await Promise.all([
      fetch(`${this.basePath}/dem.bin`).then((r) => r.arrayBuffer()),
      fetch(`${this.basePath}/slope.bin`).then((r) => r.arrayBuffer()),
      fetch(`${this.basePath}/rough.bin`).then((r) => r.arrayBuffer()),
      fetch(`${this.basePath}/traversability.bin`).then((r) => r.arrayBuffer()),
      fetch(`${this.basePath}/hazards.json`).then((r) => (r.ok ? r.json() : [])).catch(() => [])
    ]);

    this.terrainData = {
      metadata,
      width,
      height,
      totalCells,
      cellSizeMeters: metadata.cell_size_meters || 10.0,
      gridWidthMeters: metadata.grid_width_meters || width * 10.0,
      gridHeightMeters: metadata.grid_height_meters || height * 10.0,
      baseElevation: metadata.elevation_analysis?.min_elevation_m || 37.5,
      minElevation: metadata.elevation_analysis?.min_elevation_m || 37.5,
      maxElevation: metadata.elevation_analysis?.max_elevation_m || 165.3,
      dem: new Float32Array(demBuffer),
      slope: new Float32Array(slopeBuffer),
      roughness: new Float32Array(roughBuffer),
      traversability: new Float32Array(travBuffer),
      hazards: Array.isArray(hazardsResponse) ? hazardsResponse : (hazardsResponse.hazards || [])
    };

    // 3. Construct 3D Geometry
    this.buildGeometry();

    // 4. Precompute color attributes for all 5 modes
    this.buildColorAttributes();

    // 5. Construct Three.js Mesh
    this.buildMesh();

    // 6. Build 3D Hazard Markers
    this.buildHazardMarkers();

    this.isLoaded = true;
    return this;
  }

  /**
   * Construct Three.js PlaneGeometry with displaced DEM heights.
   */
  buildGeometry() {
    const { width, height, gridWidthMeters, gridHeightMeters, dem, minElevation } = this.terrainData;

    this.geometry = new THREE.PlaneGeometry(
      gridWidthMeters,
      gridHeightMeters,
      width - 1,
      height - 1
    );

    // Rotate plane so X is Easting, Z is Northing, Y is Up
    this.geometry.rotateX(-Math.PI / 2);

    const positionAttribute = this.geometry.attributes.position;

    for (let i = 0; i < positionAttribute.count; i++) {
      const elevation = dem[i];
      const yHeight = (elevation - minElevation) * this.verticalExaggeration;
      positionAttribute.setY(i, yHeight);
    }

    this.geometry.computeVertexNormals();
  }

  /**
   * Pre-generate Float32 vertex color arrays for each visualization mode.
   */
  buildColorAttributes() {
    const { totalCells, dem, slope, roughness, traversability, minElevation, maxElevation } = this.terrainData;
    const elevRange = Math.max(1, maxElevation - minElevation);

    // 1. Normal Mode (Lunar regolith with realistic photometric variation & slope shading)
    const normalColors = new Float32Array(totalCells * 3);
    // 2. Elevation Mode (Hypsometric color ramp)
    const elevationColors = new Float32Array(totalCells * 3);
    // 3. Slope Mode (Safe green -> Caution yellow -> Danger red)
    const slopeColors = new Float32Array(totalCells * 3);
    // 4. Roughness Mode (Smooth cyan -> Moderate amber -> Severe magenta)
    const roughnessColors = new Float32Array(totalCells * 3);
    // 5. Traversability Mode (Safe green -> Critical red)
    const traversabilityColors = new Float32Array(totalCells * 3);

    const c = new THREE.Color();

    for (let i = 0; i < totalCells; i++) {
      const el = dem[i];
      const sl = slope[i];
      const ro = roughness[i];
      const tr = traversability[i];

      const normElev = Math.max(0, Math.min(1, (el - minElevation) / elevRange));

      // --- Mode 1: Normal Lunar Regolith ---
      // Base lunar albedo is ~0.12 (dark grey-silver).
      // We vary brightness slightly with elevation and roughness
      const regolithLum = 0.45 + 0.35 * normElev - 0.1 * Math.min(1, ro / 5);
      c.setRGB(regolithLum * 0.95, regolithLum * 0.96, regolithLum * 1.0);
      normalColors[i * 3 + 0] = c.r;
      normalColors[i * 3 + 1] = c.g;
      normalColors[i * 3 + 2] = c.b;

      // --- Mode 2: Hypsometric Elevation ---
      // Purple (low) -> Blue -> Teal -> Green -> Yellow -> Orange -> White (peaks)
      if (normElev < 0.2) {
        c.setRGB(0.2 + normElev * 0.5, 0.1, 0.4 + normElev * 2.0);
      } else if (normElev < 0.4) {
        const t = (normElev - 0.2) / 0.2;
        c.setRGB(0.1, 0.2 + 0.6 * t, 0.8 - 0.2 * t);
      } else if (normElev < 0.6) {
        const t = (normElev - 0.4) / 0.2;
        c.setRGB(0.1 + 0.7 * t, 0.8, 0.2);
      } else if (normElev < 0.8) {
        const t = (normElev - 0.6) / 0.2;
        c.setRGB(0.9, 0.7 - 0.4 * t, 0.1);
      } else {
        const t = (normElev - 0.8) / 0.2;
        c.setRGB(0.9 + 0.1 * t, 0.5 + 0.5 * t, 0.5 + 0.5 * t);
      }
      elevationColors[i * 3 + 0] = c.r;
      elevationColors[i * 3 + 1] = c.g;
      elevationColors[i * 3 + 2] = c.b;

      // --- Mode 3: Slope View (degrees) ---
      // Flat < 5°: Emerald Green
      // Moderate 5-10°: Yellow-Green
      // Caution 10-15°: Orange
      // Hazard > 15°: Deep Red
      if (sl < 5.0) {
        c.setRGB(0.18, 0.75, 0.35);
      } else if (sl < 10.0) {
        c.setRGB(0.72, 0.82, 0.18);
      } else if (sl <= 15.0) {
        c.setRGB(0.95, 0.55, 0.12);
      } else {
        const excess = Math.min(1, (sl - 15.0) / 20.0);
        c.setRGB(0.85 + 0.15 * excess, 0.12, 0.15);
      }
      slopeColors[i * 3 + 0] = c.r;
      slopeColors[i * 3 + 1] = c.g;
      slopeColors[i * 3 + 2] = c.b;

      // --- Mode 4: Roughness View (meters) ---
      // Smooth < 1m: Cyan
      // Moderate 1-3m: Amber
      // Severe > 3m: Magenta / Purple
      if (ro < 1.0) {
        const t = ro / 1.0;
        c.setRGB(0.1, 0.6 + 0.3 * t, 0.9);
      } else if (ro < 3.0) {
        const t = (ro - 1.0) / 2.0;
        c.setRGB(0.9, 0.6 - 0.2 * t, 0.1);
      } else {
        const t = Math.min(1, (ro - 3.0) / 5.0);
        c.setRGB(0.85 + 0.15 * t, 0.1, 0.85 + 0.15 * t);
      }
      roughnessColors[i * 3 + 0] = c.r;
      roughnessColors[i * 3 + 1] = c.g;
      roughnessColors[i * 3 + 2] = c.b;

      // --- Mode 5: Traversability View ---
      // Cost: 0.0 (fully passable green) to 1.0 (impassable obstacle crimson red)
      const cost = Math.max(0, Math.min(1, tr));
      if (cost < 0.4) {
        const t = cost / 0.4;
        c.setRGB(0.15 + 0.6 * t, 0.8, 0.25 * (1 - t));
      } else if (cost < 0.8) {
        const t = (cost - 0.4) / 0.4;
        c.setRGB(0.85 + 0.1 * t, 0.75 - 0.45 * t, 0.1);
      } else {
        const t = (cost - 0.8) / 0.2;
        c.setRGB(0.95, 0.15 * (1 - t), 0.18 * (1 - t));
      }
      traversabilityColors[i * 3 + 0] = c.r;
      traversabilityColors[i * 3 + 1] = c.g;
      traversabilityColors[i * 3 + 2] = c.b;
    }

    this.colorAttributes = {
      normal: new THREE.Float32BufferAttribute(normalColors, 3),
      elevation: new THREE.Float32BufferAttribute(elevationColors, 3),
      slope: new THREE.Float32BufferAttribute(slopeColors, 3),
      roughness: new THREE.Float32BufferAttribute(roughnessColors, 3),
      traversability: new THREE.Float32BufferAttribute(traversabilityColors, 3)
    };
  }

  /**
   * Build Three.js terrain mesh using MeshStandardMaterial for realistic lunar lighting.
   */
  buildMesh() {
    this.geometry.setAttribute("color", this.colorAttributes[this.currentMode]);

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.08,
      flatShading: false,
      side: THREE.FrontSide
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.mesh.name = "LunarTerrainMesh";
  }

  /**
   * Build 3D visual markers for cataloged hazards & craters.
   * Generates terrain-conforming perimeter ribbons draped along the 3D crater rim,
   * completely eliminating half-submerged clipping through crater walls.
   */
  buildHazardMarkers() {
    this.hazardGroup.clear();

    const { hazards, cellSizeMeters } = this.terrainData;
    if (!hazards || hazards.length === 0) return;

    for (const h of hazards) {
      const gx = h.x_cell ?? h.x;
      const gy = h.y_cell ?? h.y;
      if (gx === undefined || gy === undefined) continue;

      const radiusMeters = h.radius_meters || (h.radius ? h.radius * cellSizeMeters : 15);
      const radiusCells = radiusMeters / cellSizeMeters;
      const segments = 36;

      // Sample perimeter in 3D: each vertex is placed at the exact local terrain elevation
      const vertices = [];
      const indices = [];

      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        // Ribbon band around crater perimeter (inner & outer contour)
        const rInCells = Math.max(0.3, radiusCells - 0.35);
        const rOutCells = radiusCells + 0.35;

        const colIn = gx + rInCells * cosT;
        const rowIn = gy + rInCells * sinT;
        const posIn = this.gridToWorld(colIn, rowIn);
        const yIn = this.getWorldY(colIn, rowIn) + 0.55;

        const colOut = gx + rOutCells * cosT;
        const rowOut = gy + rOutCells * sinT;
        const posOut = this.gridToWorld(colOut, rowOut);
        const yOut = this.getWorldY(colOut, rowOut) + 0.55;

        vertices.push(posIn.x, yIn, posIn.z);
        vertices.push(posOut.x, yOut, posOut.z);

        if (s < segments) {
          const base = s * 2;
          indices.push(base, base + 1, base + 2);
          indices.push(base + 1, base + 3, base + 2);
        }
      }

      const ribbonGeo = new THREE.BufferGeometry();
      ribbonGeo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      ribbonGeo.setIndex(indices);
      ribbonGeo.computeVertexNormals();

      const craterRimMat = new THREE.MeshBasicMaterial({
        color: 0xff3838,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      });

      const rimMesh = new THREE.Mesh(ribbonGeo, craterRimMat);
      this.hazardGroup.add(rimMesh);
    }
  }

  /**
   * Switch the active visualization mode.
   * @param {"normal"|"elevation"|"slope"|"roughness"|"traversability"} mode
   */
  setVisualizationMode(mode) {
    if (!this.colorAttributes[mode]) {
      console.warn(`Unknown terrain visualization mode: ${mode}`);
      return;
    }
    this.currentMode = mode;
    this.geometry.setAttribute("color", this.colorAttributes[mode]);
    this.geometry.attributes.color.needsUpdate = true;
  }

  /**
   * Toggle visibility of detected hazard markers.
   * @param {boolean} visible
   */
  setHazardsVisible(visible) {
    this.hazardGroup.visible = visible;
  }

  /**
   * Convert grid coordinates (col, row) to Three.js world coordinates (x, z).
   * Aligned with Member 3 CoordinateAdapter:
   * x = (col - 127.5) * cellSize
   * z = (row - 127.5) * cellSize
   */
  gridToWorld(col, row) {
    const cellSize = this.terrainData.cellSizeMeters;
    return {
      x: (col - 127.5) * cellSize,
      z: (row - 127.5) * cellSize
    };
  }

  /**
   * Convert Three.js world coordinates (x, z) to grid coordinates (col, row).
   */
  worldToGrid(x, z) {
    const cellSize = this.terrainData.cellSizeMeters;
    return {
      col: x / cellSize + 127.5,
      row: z / cellSize + 127.5
    };
  }

  /**
   * Sample DEM elevation at continuous grid coordinates with bilinear interpolation.
   * @param {number} col Grid column [0, 255]
   * @param {number} row Grid row [0, 255]
   * @returns {number} Elevation in meters
   */
  getElevationAt(col, row) {
    const { width, height, dem } = this.terrainData;

    const cClamped = Math.max(0, Math.min(width - 1.0001, col));
    const rClamped = Math.max(0, Math.min(height - 1.0001, row));

    const c0 = Math.floor(cClamped);
    const c1 = Math.min(width - 1, c0 + 1);
    const r0 = Math.floor(rClamped);
    const r1 = Math.min(height - 1, r0 + 1);

    const fc = cClamped - c0;
    const fr = rClamped - r0;

    const e00 = dem[r0 * width + c0];
    const e10 = dem[r0 * width + c1];
    const e01 = dem[r1 * width + c0];
    const e11 = dem[r1 * width + c1];

    const top = e00 * (1 - fc) + e10 * fc;
    const bot = e01 * (1 - fc) + e11 * fc;

    return top * (1 - fr) + bot * fr;
  }

  /**
   * Sample slope (degrees) at continuous grid coordinates.
   */
  getSlopeAt(col, row) {
    const { width, height, slope } = this.terrainData;
    const c = Math.round(Math.max(0, Math.min(width - 1, col)));
    const r = Math.round(Math.max(0, Math.min(height - 1, row)));
    return slope[r * width + c];
  }

  /**
   * Sample roughness (meters) at continuous grid coordinates.
   */
  getRoughnessAt(col, row) {
    const { width, height, roughness } = this.terrainData;
    const c = Math.round(Math.max(0, Math.min(width - 1, col)));
    const r = Math.round(Math.max(0, Math.min(height - 1, row)));
    return roughness[r * width + c];
  }

  /**
   * Compute normalized surface normal vector at continuous grid coordinates.
   * Enables realistic pitch and roll rover orientation on slopes.
   * @param {number} col
   * @param {number} row
   * @returns {THREE.Vector3}
   */
  getNormalAt(col, row) {
    const delta = 0.5;
    const eLeft = this.getElevationAt(col - delta, row);
    const eRight = this.getElevationAt(col + delta, row);
    const eDown = this.getElevationAt(col, row - delta);
    const eUp = this.getElevationAt(col, row + delta);

    const cellSize = this.terrainData.cellSizeMeters;
    const dx = (eRight - eLeft) / (2 * delta * cellSize);
    const dz = (eUp - eDown) / (2 * delta * cellSize);

    // Normal vector = (-dx, 1, -dz) normalized
    const normal = new THREE.Vector3(-dx, 1.0, -dz).normalize();
    return normal;
  }

  /**
   * Returns Three.js world Y height for a given grid coordinate.
   */
  getWorldY(col, row) {
    const elevation = this.getElevationAt(col, row);
    return (elevation - this.terrainData.minElevation) * this.verticalExaggeration;
  }

  /**
   * Spawn a 3D visual cluster of aggressive, unmistakable glowing RED SPIKES.
   * Features:
   * - 18 sharp 3D cone spikes (6.5m to 12.0m high) firmly anchored to local terrain elevation
   * - Glowing terrain-conforming crimson ground warning pad
   * - Floating holographic danger diamond beacon hovering 14m above the cluster
   * - High-intensity red danger point light
   * @param {number} gx Grid X
   * @param {number} gy Grid Y
   * @param {number} radiusCells Obstacle radius in grid cells
   */
  addDynamicHazardMarker(gx, gy, radiusCells = 2) {
    if (!this.terrainData) return null;
    const cellSizeMeters = this.terrainData.cellSizeMeters || 10.0;
    const worldPos = this.gridToWorld(gx, gy);
    const elevation = this.getElevationAt(gx, gy);
    const worldY = (elevation - this.terrainData.minElevation) * this.verticalExaggeration;
    const radiusMeters = Math.max(14, radiusCells * cellSizeMeters);

    const group = new THREE.Group();
    group.position.set(worldPos.x, worldY, worldPos.z);

    // 1. High-intensity glowing crimson ground warning pad draped on local terrain
    const padSegments = 32;
    const padVertices = [0, 0.45, 0]; // center point
    const padIndices = [];
    for (let s = 0; s <= padSegments; s++) {
      const angle = (s / padSegments) * Math.PI * 2;
      const rx = Math.cos(angle) * radiusMeters;
      const rz = Math.sin(angle) * radiusMeters;
      const localCol = gx + rx / cellSizeMeters;
      const localRow = gy + rz / cellSizeMeters;
      const localWorldY = (this.getElevationAt(localCol, localRow) - this.terrainData.minElevation) * this.verticalExaggeration;
      padVertices.push(rx, (localWorldY - worldY) + 0.45, rz);
      if (s > 0) {
        padIndices.push(0, s, s + 1);
      }
    }
    const padGeo = new THREE.BufferGeometry();
    padGeo.setAttribute("position", new THREE.Float32BufferAttribute(padVertices, 3));
    padGeo.setIndex(padIndices);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff0025,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3
    });
    const ringMesh = new THREE.Mesh(padGeo, ringMat);
    group.add(ringMesh);

    // 2. Bright red point light casting danger illumination on the lunar surface
    const spikeLight = new THREE.PointLight(0xff0025, 8.0, radiusMeters * 3.5);
    spikeLight.position.set(0, 5.0, 0);
    group.add(spikeLight);

    // 3. Cluster of menacing sharp 3D RED SPIKES (Tall sharp cones pointing straight UP)
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0xff0020,
      emissive: 0xff0025,
      emissiveIntensity: 1.6,
      roughness: 0.15,
      metalness: 0.85,
      flatShading: true
    });

    const spikeCount = 18;
    const spikeMeshes = [];

    for (let i = 0; i < spikeCount; i++) {
      // 6.5m to 12.0m tall sharp spikes!
      const height = 6.5 + Math.random() * 5.5;
      const baseRadius = 0.7 + Math.random() * 0.7;
      // 5-sided sharp cone pointing straight up
      const spikeGeo = new THREE.ConeGeometry(baseRadius, height, 5);
      spikeGeo.translate(0, height / 2, 0); // Ground at y=0, tip points upwards

      const spike = new THREE.Mesh(spikeGeo, spikeMat);

      // Jagged cluster distribution across the hazard zone
      const angle = (i / spikeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const dist = (0.15 + 0.75 * Math.random()) * (radiusMeters * 0.85);
      const rx = Math.cos(angle) * dist;
      const rz = Math.sin(angle) * dist;

      // Sample local terrain elevation so spike base firmly sits on the terrain
      const localCol = gx + rx / cellSizeMeters;
      const localRow = gy + rz / cellSizeMeters;
      const localWorldY = (this.getElevationAt(localCol, localRow) - this.terrainData.minElevation) * this.verticalExaggeration;
      const relY = (localWorldY - worldY) + 0.1;

      spike.position.set(rx, relY, rz);

      // Organic tilt for sharp jagged aesthetic
      spike.rotation.x = (Math.random() - 0.5) * 0.3;
      spike.rotation.z = (Math.random() - 0.5) * 0.3;
      spike.rotation.y = Math.random() * Math.PI * 2;

      spike.castShadow = true;
      group.add(spike);
      spikeMeshes.push(spike);
    }

    // 4. Floating holographic danger diamond beacon hovering 14m above the cluster
    const beaconGeo = new THREE.OctahedronGeometry(2.2, 0);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff1133,
      emissive: 0xff0020,
      emissiveIntensity: 2.2,
      roughness: 0.1,
      metalness: 0.9,
      wireframe: false
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(0, 14.0, 0);
    group.add(beaconMesh);

    this.dynamicHazardGroup.add(group);
    this.dynamicBeacons.push({
      group,
      ringMat,
      spikeMat,
      spikeLight,
      spikeMeshes,
      beaconMesh,
      baseOpacity: 0.85,
      createdAt: performance.now()
    });

    return group;
  }

  /**
   * Clear all dynamic runtime hazard markers.
   */
  clearDynamicHazards() {
    this.dynamicHazardGroup.clear();
    this.dynamicBeacons = [];
  }

  /**
   * Animate dynamic hazard beacon pulses and floating rotation.
   */
  updateDynamicHazards(timeSeconds) {
    if (!this.dynamicBeacons || this.dynamicBeacons.length === 0) return;
    for (let i = 0; i < this.dynamicBeacons.length; i++) {
      const b = this.dynamicBeacons[i];
      const pulse = 0.5 + 0.5 * Math.sin(timeSeconds * 5.0 + i);
      b.ringMat.opacity = 0.5 + 0.45 * pulse;
      if (b.spikeMat) {
        b.spikeMat.emissiveIntensity = 1.0 + 0.8 * pulse;
      }
      if (b.spikeLight) {
        b.spikeLight.intensity = 5.0 + 4.0 * pulse;
      }
      if (b.beaconMesh) {
        b.beaconMesh.rotation.y = timeSeconds * 2.0;
        b.beaconMesh.position.y = 14.0 + 1.2 * Math.sin(timeSeconds * 3.0 + i);
      }
    }
  }
}

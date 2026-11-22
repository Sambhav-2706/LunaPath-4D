/**
 * LunaPath-4D
 * RouteVisualizer.js
 *
 * Member 2 - Autonomous Route 3D Visualizer
 * Renders:
 * - Start location beacon & destination target pin
 * - Planned 3D route trajectory elevated slightly above terrain surface
 * - Color-coded completed vs remaining route segments
 * - Waypoint nodes with hover/pulse effect
 */

import * as THREE from "three";

export class RouteVisualizer {
  constructor(terrainRenderer) {
    this.terrain = terrainRenderer;
    this.group = new THREE.Group();
    this.group.name = "RouteVisualizerLayer";

    this.startMarker = null;
    this.destMarker = null;
    this.completedLine = null;
    this.remainingLine = null;
    this.waypointPoints = null;

    // Ghost Baseline Route (Naive A* comparison)
    this.ghostLine = null;
    this.ghostWorldPoints = [];
    this.ghostVisible = true;

    this.worldPathPoints = [];
    this.currentPathNodes = [];

    this.initMarkers();
  }

  initMarkers() {
    // 1. Start Marker (Green beacon cylinder + base ring)
    this.startMarker = new THREE.Group();
    const startCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 0.2, 18, 16),
      new THREE.MeshStandardMaterial({
        color: 0x51dfa0,
        emissive: 0x24754f,
        roughness: 0.2
      })
    );
    startCyl.position.y = 9;

    const startRing = new THREE.Mesh(
      new THREE.RingGeometry(2, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0x51dfa0, side: THREE.DoubleSide })
    );
    startRing.rotateX(-Math.PI / 2);
    startRing.position.y = 0.5;

    this.startMarker.add(startCyl, startRing);
    this.startMarker.visible = false;
    this.group.add(this.startMarker);

    // 2. Destination Marker (Gold beacon cylinder + beacon beam)
    this.destMarker = new THREE.Group();
    const destCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 1.8, 22, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffb66e,
        emissive: 0x99551a,
        roughness: 0.2
      })
    );
    destCyl.position.y = 11;

    const destRing = new THREE.Mesh(
      new THREE.RingGeometry(3, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb66e, side: THREE.DoubleSide })
    );
    destRing.rotateX(-Math.PI / 2);
    destRing.position.y = 0.5;

    this.destMarker.add(destCyl, destRing);
    this.destMarker.visible = false;
    this.group.add(this.destMarker);
  }

  /**
   * Set and render a newly planned route.
   * @param {Array<{x: number, y: number}>} pathNodes Array of grid coordinates
   */
  setRoute(pathNodes) {
    this.clearRoute();

    if (!Array.isArray(pathNodes) || pathNodes.length < 2) {
      return;
    }

    this.currentPathNodes = pathNodes;
    this.worldPathPoints = [];

    // Convert each grid node to world coordinate with terrain Y + elevation offset
    for (const node of pathNodes) {
      const worldPos = this.terrain.gridToWorld(node.x, node.y);
      const worldY = this.terrain.getWorldY(node.x, node.y) + 1.2; // 1.2m above terrain
      this.worldPathPoints.push(new THREE.Vector3(worldPos.x, worldY, worldPos.z));
    }

    // Position Start & Destination Markers
    const startPt = this.worldPathPoints[0];
    const destPt = this.worldPathPoints[this.worldPathPoints.length - 1];

    this.startMarker.position.set(startPt.x, startPt.y, startPt.z);
    this.startMarker.visible = true;

    this.destMarker.position.set(destPt.x, destPt.y, destPt.z);
    this.destMarker.visible = true;

    // Remaining Route Line (Gold/Orange)
    const remainingGeo = new THREE.BufferGeometry().setFromPoints(this.worldPathPoints);
    const remainingMat = new THREE.LineBasicMaterial({
      color: 0xffb66e,
      linewidth: 3
    });
    this.remainingLine = new THREE.Line(remainingGeo, remainingMat);
    this.remainingLine.name = "RemainingRouteLine";
    this.group.add(this.remainingLine);

    // Completed Route Line (Green/Cyan) - initially empty
    const completedGeo = new THREE.BufferGeometry().setFromPoints([startPt, startPt]);
    const completedMat = new THREE.LineBasicMaterial({
      color: 0x51dfa0,
      linewidth: 4
    });
    this.completedLine = new THREE.Line(completedGeo, completedMat);
    this.completedLine.name = "CompletedRouteLine";
    this.group.add(this.completedLine);

    // Waypoint dots
    const waypointGeo = new THREE.BufferGeometry().setFromPoints(this.worldPathPoints);
    const waypointMat = new THREE.PointsMaterial({
      color: 0xffe484,
      size: 4,
      sizeAttenuation: false
    });
    this.waypointPoints = new THREE.Points(waypointGeo, waypointMat);
    this.group.add(this.waypointPoints);
  }

  /**
   * Update visual route split (completed vs remaining) as rover moves.
   * @param {number} currentNodeIndex Index of waypoint reached
   * @param {THREE.Vector3} currentWorldPos Realtime rover world position
   */
  updateProgress(currentNodeIndex, currentWorldPos) {
    if (!this.worldPathPoints || this.worldPathPoints.length < 2) return;

    const idx = Math.min(currentNodeIndex, this.worldPathPoints.length - 1);

    // Completed points: path nodes 0..idx-1, then current rover position
    const completedPoints = [];
    for (let i = 0; i < idx; i++) {
      completedPoints.push(this.worldPathPoints[i]);
    }
    if (currentWorldPos) {
      completedPoints.push(new THREE.Vector3(currentWorldPos.x, currentWorldPos.y + 1.2, currentWorldPos.z));
    }

    if (this.completedLine && completedPoints.length >= 2) {
      this.completedLine.geometry.dispose();
      this.completedLine.geometry = new THREE.BufferGeometry().setFromPoints(completedPoints);
    }

    // Remaining points: current rover position, then idx..end
    const remainingPoints = [];
    if (currentWorldPos) {
      remainingPoints.push(new THREE.Vector3(currentWorldPos.x, currentWorldPos.y + 1.2, currentWorldPos.z));
    }
    for (let i = idx; i < this.worldPathPoints.length; i++) {
      remainingPoints.push(this.worldPathPoints[i]);
    }

    if (this.remainingLine && remainingPoints.length >= 2) {
      this.remainingLine.geometry.dispose();
      this.remainingLine.geometry = new THREE.BufferGeometry().setFromPoints(remainingPoints);
    }
  }

  /**
   * Clear active route visualization.
   */
  clearRoute() {
    if (this.startMarker) this.startMarker.visible = false;
    if (this.destMarker) this.destMarker.visible = false;

    if (this.completedLine) {
      this.group.remove(this.completedLine);
      this.completedLine.geometry.dispose();
      this.completedLine = null;
    }
    if (this.remainingLine) {
      this.group.remove(this.remainingLine);
      this.remainingLine.geometry.dispose();
      this.remainingLine = null;
    }
    if (this.waypointPoints) {
      this.group.remove(this.waypointPoints);
      this.waypointPoints.geometry.dispose();
      this.waypointPoints = null;
    }

    this.worldPathPoints = [];
    this.currentPathNodes = [];
  }

  /**
   * Set and render the naive ghost baseline route in dashed cyan.
   */
  setGhostRoute(ghostNodes) {
    this.clearGhostRoute();
    if (!Array.isArray(ghostNodes) || ghostNodes.length < 2) return;

    this.ghostWorldPoints = [];
    for (const node of ghostNodes) {
      const worldPos = this.terrain.gridToWorld(node.x, node.y);
      const worldY = this.terrain.getWorldY(node.x, node.y) + 1.6; // Slightly above terrain
      this.ghostWorldPoints.push(new THREE.Vector3(worldPos.x, worldY, worldPos.z));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(this.ghostWorldPoints);
    const mat = new THREE.LineDashedMaterial({
      color: 0x00e5ff,
      linewidth: 2,
      scale: 1,
      dashSize: 10,
      gapSize: 5,
      transparent: true,
      opacity: 0.75
    });

    this.ghostLine = new THREE.Line(geo, mat);
    this.ghostLine.computeLineDistances();
    this.ghostLine.name = "GhostBaselineRouteLine";
    this.ghostLine.visible = this.ghostVisible;
    this.group.add(this.ghostLine);
  }

  /**
   * Update ghost route line as ghost rover advances.
   */
  updateGhostProgress(currentNodeIndex, currentWorldPos) {
    if (!this.ghostWorldPoints || this.ghostWorldPoints.length < 2 || !this.ghostLine) return;
    const idx = Math.min(currentNodeIndex, this.ghostWorldPoints.length - 1);

    const remaining = [];
    if (currentWorldPos) {
      remaining.push(new THREE.Vector3(currentWorldPos.x, currentWorldPos.y + 1.6, currentWorldPos.z));
    }
    for (let i = idx; i < this.ghostWorldPoints.length; i++) {
      remaining.push(this.ghostWorldPoints[i]);
    }

    if (remaining.length >= 2) {
      this.ghostLine.geometry.dispose();
      this.ghostLine.geometry = new THREE.BufferGeometry().setFromPoints(remaining);
      this.ghostLine.computeLineDistances();
    }
  }

  setGhostVisible(visible) {
    this.ghostVisible = visible;
    if (this.ghostLine) {
      this.ghostLine.visible = visible;
    }
  }

  clearGhostRoute() {
    if (this.ghostLine) {
      this.group.remove(this.ghostLine);
      this.ghostLine.geometry.dispose();
      this.ghostLine = null;
    }
    this.ghostWorldPoints = [];
  }
}

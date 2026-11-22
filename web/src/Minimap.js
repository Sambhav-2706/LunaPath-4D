/**
 * LunaPath-4D
 * Minimap.js
 *
 * Member 2 & 4 - 2D Tactical Lunar Radar Minimap
 * Renders real-time 2D top-down map of the entire 2.56km x 2.56km terrain:
 * - Pre-rendered hypsometric lunar topography
 * - Cataloged crater & hazard locations
 * - Full A* planned route & completed progress
 * - Real-time rover position blip with directional heading arrow
 * - Start & destination target pins
 */

export class Minimap {
  constructor(canvasElement, terrainData = null) {
    this.canvas = canvasElement;
    this.ctx = this.canvas?.getContext("2d");
    this.terrainData = terrainData;

    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = 256;
    this.offscreenCanvas.height = 256;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");

    if (this.terrainData) {
      this.precomputeBackground();
    }
  }

  setTerrain(terrainData) {
    this.terrainData = terrainData;
    this.precomputeBackground();
  }

  /**
   * Pre-render 256x256 terrain elevation & craters to offscreen canvas for high performance.
   */
  precomputeBackground() {
    if (!this.terrainData || !this.offscreenCtx) return;
    const { width, height, dem, minElevation, maxElevation, slope, traversability } = this.terrainData;
    if (!dem) return;
    const imgData = this.offscreenCtx.createImageData(width, height);
    const data = imgData.data;

    const elevSpan = Math.max(1, maxElevation - minElevation);

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        // In 2D canvas, top is row=0 or invert for Cartesian
        // In Cartesian, row=0 is South, row=255 is North
        // We render row=0 at the bottom (height - 1 - r) so North is Up
        const srcIdx = r * width + c;
        const destY = height - 1 - r;
        const destIdx = (destY * width + c) * 4;

        const el = dem[srcIdx];
        const sl = slope[srcIdx];
        const tr = traversability ? traversability[srcIdx] : 0;

        const normEl = (el - minElevation) / elevSpan;

        // Dark lunar regolith background with relief shading
        let gray = 28 + Math.round(normEl * 55);

        // Darken steep crater slopes
        if (sl > 15) {
          gray = Math.max(15, gray - 20);
        }

        if (tr > 0.85) {
          // Obstacle/Hazard tint (subtle crimson)
          data[destIdx + 0] = Math.min(255, gray + 45);
          data[destIdx + 1] = Math.max(0, gray - 15);
          data[destIdx + 2] = Math.max(0, gray - 15);
        } else {
          data[destIdx + 0] = gray;
          data[destIdx + 1] = Math.round(gray * 1.02);
          data[destIdx + 2] = Math.round(gray * 1.05);
        }
        data[destIdx + 3] = 255;
      }
    }

    this.offscreenCtx.putImageData(imgData, 0, 0);
  }

  /**
   * Render real-time tactical overlay on each telemetry update.
   */
  render(snap) {
    if (!this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Clear & Draw Pre-rendered Terrain
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(this.offscreenCanvas, 0, 0, w, h);

    // Subtle radar scan lines overlay
    this.ctx.fillStyle = "rgba(10, 20, 30, 0.25)";
    this.ctx.fillRect(0, 0, w, h);

    // Coordinate conversion helper: Grid [0, 255] -> Canvas [0, w]
    // Invert Y so Northing (higher Y) is at top of canvas
    const toCanvasX = (gx) => (gx / 255.0) * w;
    const toCanvasY = (gy) => ((255.0 - gy) / 255.0) * h;

    // 2. Draw Cataloged Hazards (Red boundary circles)
    if (this.terrainData?.hazards && this.terrainData.hazards.length > 0) {
      this.ctx.strokeStyle = "rgba(255, 75, 75, 0.55)";
      this.ctx.lineWidth = 1;
      for (const hz of this.terrainData.hazards) {
        const gx = hz.x_cell ?? hz.x;
        const gy = hz.y_cell ?? hz.y;
        if (gx === undefined || gy === undefined) continue;
        const cx = toCanvasX(gx);
        const cy = toCanvasY(gy);
        const rPix = Math.max(3, ((hz.radius ?? 6) / 255.0) * w);

        this.ctx.beginPath();
        this.ctx.arc(cx, cy, rPix, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }

    // 3. Draw Planned Route Line (Gold/Amber)
    if (snap.pathNodes && snap.pathNodes.length >= 2) {
      this.ctx.strokeStyle = "rgba(255, 182, 110, 0.75)";
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      for (let i = 0; i < snap.pathNodes.length; i++) {
        const pt = snap.pathNodes[i];
        const px = toCanvasX(pt.x);
        const py = toCanvasY(pt.y);
        if (i === 0) this.ctx.moveTo(px, py);
        else this.ctx.lineTo(px, py);
      }
      this.ctx.stroke();

      // Draw Completed Path Segment (Vibrant Emerald)
      const currentIdx = Math.min(snap.currentNodeIndex || 1, snap.pathNodes.length - 1);
      if (currentIdx > 0) {
        this.ctx.strokeStyle = "#51dfa0";
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        for (let i = 0; i <= currentIdx; i++) {
          const pt = snap.pathNodes[i];
          const px = toCanvasX(pt.x);
          const py = toCanvasY(pt.y);
          if (i === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
        }
        // Connect to exact current rover continuous position
        if (snap.currentPosition) {
          this.ctx.lineTo(toCanvasX(snap.currentPosition.x), toCanvasY(snap.currentPosition.y));
        }
        this.ctx.stroke();
      }
    }

    // 3B. Draw Ghost Baseline Route (Dashed Cyan)
    if (snap.ghost?.visible && snap.ghost.pathNodes && snap.ghost.pathNodes.length >= 2) {
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(0, 229, 255, 0.65)";
      this.ctx.lineWidth = 1.8;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      for (let i = 0; i < snap.ghost.pathNodes.length; i++) {
        const pt = snap.ghost.pathNodes[i];
        const px = toCanvasX(pt.x);
        const py = toCanvasY(pt.y);
        if (i === 0) this.ctx.moveTo(px, py);
        else this.ctx.lineTo(px, py);
      }
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 4. Draw Start Beacon (Green pin)
    if (snap.startCoord) {
      const sx = toCanvasX(snap.startCoord.x);
      const sy = toCanvasY(snap.startCoord.y);
      this.ctx.fillStyle = "#51dfa0";
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    // 5. Draw Destination Pin (Gold diamond)
    if (snap.destCoord) {
      const dx = toCanvasX(snap.destCoord.x);
      const dy = toCanvasY(snap.destCoord.y);
      this.ctx.fillStyle = "#ffb66e";
      this.ctx.beginPath();
      this.ctx.moveTo(dx, dy - 5);
      this.ctx.lineTo(dx + 5, dy);
      this.ctx.lineTo(dx, dy + 5);
      this.ctx.lineTo(dx - 5, dy);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    // 6. Draw Current Rover Blip & Direction Pointer
    if (snap.currentPosition) {
      const rx = toCanvasX(snap.currentPosition.x);
      const ry = toCanvasY(snap.currentPosition.y);

      // Outer pulsing ring
      this.ctx.strokeStyle = "#51dfa0";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(rx, ry, 7, 0, Math.PI * 2);
      this.ctx.stroke();

      // Solid center dot
      this.ctx.fillStyle = "#ffffff";
      this.ctx.beginPath();
      this.ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
      this.ctx.fill();

      // Heading indicator arrow
      if (Number.isFinite(Number(snap.headingDeg))) {
        // headingDeg: 0° is +Z (South), 90° is +X (East), etc.
        // On canvas where North is Up (-Y):
        const rad = ((snap.headingDeg - 90) * Math.PI) / 180.0;
        const arrowLen = 14;
        this.ctx.strokeStyle = "#51dfa0";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(rx, ry);
        this.ctx.lineTo(rx + Math.cos(rad) * arrowLen, ry + Math.sin(rad) * arrowLen);
        this.ctx.stroke();
      }
    }

    // 6B. Draw Ghost Baseline Rover Blip (Cyan)
    if (snap.ghost?.visible && snap.ghost.position) {
      const gx = toCanvasX(snap.ghost.position.x);
      const gy = toCanvasY(snap.ghost.position.y);

      // Ghost cyan halo
      this.ctx.strokeStyle = "rgba(0, 229, 255, 0.85)";
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(gx, gy, 6, 0, Math.PI * 2);
      this.ctx.stroke();

      // Ghost center point
      this.ctx.fillStyle = "#00e5ff";
      this.ctx.beginPath();
      this.ctx.arc(gx, gy, 2.8, 0, Math.PI * 2);
      this.ctx.fill();

      // Ghost heading arrow
      if (Number.isFinite(Number(snap.ghost.headingDeg))) {
        const rad = ((snap.ghost.headingDeg - 90) * Math.PI) / 180.0;
        const arrowLen = 11;
        this.ctx.strokeStyle = "#00e5ff";
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(gx, gy);
        this.ctx.lineTo(gx + Math.cos(rad) * arrowLen, gy + Math.sin(rad) * arrowLen);
        this.ctx.stroke();
      }
    }

    // 7. Grid Border & Compass
    this.ctx.strokeStyle = "rgba(70, 95, 120, 0.6)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, w, h);

    // North Indicator at top
    this.ctx.fillStyle = "#55b9ff";
    this.ctx.font = "bold 9px 'DM Mono', monospace";
    this.ctx.fillText("N (+Y)", w / 2 - 14, 12);
  }
}

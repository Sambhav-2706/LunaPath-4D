/**
 * LunaPath-4D
 * CameraController.js
 *
 * Member 2 - Dynamic Multi-Mode Camera Controller
 * Defaults to continuous third-person FOLLOW mode behind the rover.
 * Supports:
 * - Follow Mode: Smooth third-person chase camera aligned with rover heading
 * - Orbit Mode: Free 360° orbital inspection centered on the moving rover
 * - Top-Down Mode: Tactical overhead camera tracking above the rover
 * - Perspective Mode: Low-angle dramatic exploration view
 * - Camera Reset & Auto-Framing
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 5000;
    this.controls.minDistance = 15;
    this.controls.maxPolarAngle = Math.PI * 0.48; // Don't clip below horizontal ground

    this.mode = "follow"; // Default is FOLLOW mode
    this.targetRover = null;

    // Follow camera distances
    this.followDistance = 65;
    this.followHeight = 32;

    // Default home camera state
    this.defaultPosition = new THREE.Vector3(0, 1200, 1600);
    this.defaultTarget = new THREE.Vector3(0, 50, 0);

    // Allow user to zoom in/out with mouse wheel in follow mode
    if (this.domElement) {
      this.domElement.addEventListener("wheel", (evt) => {
        if (this.mode === "follow") {
          evt.preventDefault();
          this.followDistance = Math.min(260, Math.max(25, this.followDistance + evt.deltaY * 0.06));
          this.followHeight = this.followDistance * 0.49;
        }
      }, { passive: false });
    }
  }

  setMode(mode) {
    this.mode = mode;

    if (mode === "follow") {
      this.controls.enabled = false; // Camera controlled procedurally in update()
      if (this.targetRover) {
        this.snapFollow();
      }
    } else if (mode === "orbit") {
      this.controls.enabled = true;
      this.controls.maxPolarAngle = Math.PI * 0.48;
      if (this.targetRover) {
        const rPos = this.targetRover.group.position;
        this.controls.target.set(rPos.x, rPos.y + 10, rPos.z);
      }
    } else if (mode === "topdown") {
      this.controls.enabled = true;
      this.controls.maxPolarAngle = Math.PI * 0.05; // Lock nearly vertical
      if (this.targetRover) {
        const rPos = this.targetRover.group.position;
        this.camera.position.set(rPos.x, rPos.y + 550, rPos.z + 0.1);
        this.controls.target.set(rPos.x, rPos.y + 10, rPos.z);
      } else {
        this.camera.position.set(0, 2600, 0.1);
        this.controls.target.set(0, 60, 0);
      }
    } else if (mode === "perspective") {
      this.controls.enabled = true;
      this.controls.maxPolarAngle = Math.PI * 0.48;
      if (this.targetRover) {
        const rPos = this.targetRover.group.position;
        this.camera.position.set(rPos.x - 120, rPos.y + 40, rPos.z + 140);
        this.controls.target.set(rPos.x, rPos.y + 10, rPos.z);
      } else {
        this.camera.position.set(-600, 450, 750);
        this.controls.target.set(0, 80, 0);
      }
    } else if (mode === "reset") {
      this.resetCamera();
    }

    this.controls.update();
  }

  setFollowTarget(roverModel) {
    this.targetRover = roverModel;
    if (this.mode === "follow") {
      this.snapFollow();
    }
  }

  snapFollow() {
    if (!this.targetRover) return;
    const rPos = this.targetRover.group.position;
    const heading = this.targetRover.headingAngle || 0;
    const distanceBehind = this.followDistance;
    const heightAbove = this.followHeight;

    this.camera.position.set(
      rPos.x - Math.sin(heading) * distanceBehind,
      rPos.y + heightAbove,
      rPos.z - Math.cos(heading) * distanceBehind
    );
    this.camera.lookAt(
      rPos.x + Math.sin(heading) * 30,
      rPos.y + 10,
      rPos.z + Math.cos(heading) * 30
    );
  }

  focusOnRover(roverModel = this.targetRover) {
    if (!roverModel) return;
    this.targetRover = roverModel;
    this.setMode("follow");
  }

  resetCamera() {
    this.mode = "orbit";
    this.controls.enabled = true;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.camera.position.copy(this.defaultPosition);
    this.controls.target.copy(this.defaultTarget);
    this.controls.update();
  }

  update(dt = 0.016) {
    if (this.mode === "follow" && this.targetRover) {
      const roverPos = this.targetRover.group.position;
      const heading = this.targetRover.headingAngle || 0;

      // Position camera behind rover and above for immersive third-person chase
      const distanceBehind = this.followDistance;
      const heightAbove = this.followHeight;

      const targetX = roverPos.x - Math.sin(heading) * distanceBehind;
      const targetY = roverPos.y + heightAbove;
      const targetZ = roverPos.z - Math.cos(heading) * distanceBehind;

      // Smooth camera interpolation
      this.camera.position.x += (targetX - this.camera.position.x) * 0.12;
      this.camera.position.y += (targetY - this.camera.position.y) * 0.12;
      this.camera.position.z += (targetZ - this.camera.position.z) * 0.12;

      // Look ahead along rover's forward path
      const lookTarget = new THREE.Vector3(
        roverPos.x + Math.sin(heading) * 30,
        roverPos.y + 10,
        roverPos.z + Math.cos(heading) * 30
      );

      this.camera.lookAt(lookTarget);
    } else if (this.targetRover && (this.mode === "orbit" || this.mode === "focus" || this.mode === "topdown" || this.mode === "perspective")) {
      // In orbit, focus, topdown, or perspective mode: continuously track the moving rover!
      const rPos = this.targetRover.group.position;
      const deltaX = rPos.x - this.controls.target.x;
      const deltaY = (rPos.y + 10) - this.controls.target.y;
      const deltaZ = rPos.z - this.controls.target.z;

      this.camera.position.x += deltaX;
      this.camera.position.y += deltaY;
      this.camera.position.z += deltaZ;

      this.controls.target.set(rPos.x, rPos.y + 10, rPos.z);
      this.controls.update();
    } else {
      this.controls.update();
    }
  }
}

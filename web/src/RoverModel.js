/**
 * LunaPath-4D
 * RoverModel.js
 *
 * Member 2 - Procedural 3D Lunar Rover Model
 * Pragyan / Chandrayaan-3 / Artemis scale inspired:
 * - Insulated chassis body
 * - Tilted solar panel deck
 * - Navigation camera mast & high-gain dish antenna
 * - 6 articulated rocker-bogie wheels with continuous rotation
 * - Overhead holographic locator beacon & ground projection ring
 * - Terrain normal tracking (pitch, roll, yaw) with strict SO(3) orthonormal basis
 */

import * as THREE from "three";

export class RoverModel {
  constructor(options = {}) {
    this.scale = options.scale ?? 7.0; // Scaled for clear visibility across 2.5km terrain
    this.isGhost = !!options.isGhost;
    this.group = new THREE.Group();
    this.group.name = this.isGhost ? "GhostBaselineRover" : "LunarRover";

    this.wheels = [];
    this.wheelRadius = 1.0 * this.scale;
    this.headingAngle = 0; // Radians, 0 = facing +Z
    this.targetHeading = 0;
    this.beaconMesh = null;

    this.buildRoverMesh();
  }

  buildRoverMesh() {
    const s = this.scale;
    const isGhost = this.isGhost;

    // Materials - Normal Metallic vs Holographic Ghost
    const chassisMat = isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0x00f0ff,
          roughness: 0.2,
          metalness: 0.8,
          transparent: true,
          opacity: 0.48,
          emissive: 0x007799,
          emissiveIntensity: 0.5
        })
      : new THREE.MeshStandardMaterial({
          color: 0xeeeeee,
          roughness: 0.3,
          metalness: 0.7
        });

    const goldFoilMat = isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          roughness: 0.2,
          metalness: 0.9,
          transparent: true,
          opacity: 0.48,
          emissive: 0x0284c7,
          emissiveIntensity: 0.4
        })
      : new THREE.MeshStandardMaterial({
          color: 0xf5c33b,
          roughness: 0.2,
          metalness: 0.9,
          emissive: 0x3d2800,
          emissiveIntensity: 0.2
        });

    const solarPanelMat = isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          roughness: 0.1,
          metalness: 0.9,
          transparent: true,
          opacity: 0.52,
          emissive: 0x0369a1,
          emissiveIntensity: 0.3
        })
      : new THREE.MeshStandardMaterial({
          color: 0x16345c,
          roughness: 0.1,
          metalness: 0.92
        });

    const darkMetalMat = isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0x075985,
          roughness: 0.4,
          metalness: 0.7,
          transparent: true,
          opacity: 0.5
        })
      : new THREE.MeshStandardMaterial({
          color: 0x1e2228,
          roughness: 0.6,
          metalness: 0.7
        });

    const wheelMat = isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          roughness: 0.4,
          metalness: 0.6,
          transparent: true,
          opacity: 0.48
        })
      : new THREE.MeshStandardMaterial({
          color: 0x5a6068,
          roughness: 0.6,
          metalness: 0.4
        });

    const sensorGlowMat = new THREE.MeshBasicMaterial({
      color: isGhost ? 0x00f0ff : 0x51dfa0
    });

    // 1. Chassis Main Body (Elevated above wheels)
    const bodyGeo = new THREE.BoxGeometry(2.4 * s, 1.2 * s, 3.6 * s);
    const body = new THREE.Mesh(bodyGeo, chassisMat);
    body.position.y = 1.6 * s;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // Multi-layer insulation gold foil underbody
    const foilGeo = new THREE.BoxGeometry(2.3 * s, 0.4 * s, 3.5 * s);
    const foil = new THREE.Mesh(foilGeo, goldFoilMat);
    foil.position.y = 1.0 * s;
    foil.castShadow = true;
    this.group.add(foil);

    // 2. Solar Panel Deck (Tilted towards low polar sun)
    const panelGeo = new THREE.BoxGeometry(2.8 * s, 0.1 * s, 3.4 * s);
    const solarPanel = new THREE.Mesh(panelGeo, solarPanelMat);
    solarPanel.position.set(0, 2.3 * s, -0.2 * s);
    solarPanel.rotation.x = -Math.PI * 0.08;
    solarPanel.castShadow = true;
    this.group.add(solarPanel);

    // Solar panel frame border
    const frameGeo = new THREE.BoxGeometry(2.9 * s, 0.05 * s, 3.5 * s);
    const frame = new THREE.Mesh(frameGeo, darkMetalMat);
    frame.position.copy(solarPanel.position);
    frame.rotation.copy(solarPanel.rotation);
    this.group.add(frame);

    // 3. Navigation Camera Mast
    const mastGeo = new THREE.CylinderGeometry(0.1 * s, 0.12 * s, 1.8 * s, 12);
    const mast = new THREE.Mesh(mastGeo, darkMetalMat);
    mast.position.set(0.7 * s, 3.1 * s, 1.2 * s);
    mast.castShadow = true;
    this.group.add(mast);

    // Stereo NavCam Head Bar
    const navCamHeadGeo = new THREE.BoxGeometry(0.9 * s, 0.3 * s, 0.35 * s);
    const navCamHead = new THREE.Mesh(navCamHeadGeo, darkMetalMat);
    navCamHead.position.set(0.7 * s, 4.0 * s, 1.2 * s);
    this.group.add(navCamHead);

    // Dual Stereo Lenses
    const lensGeo = new THREE.CylinderGeometry(0.09 * s, 0.09 * s, 0.12 * s, 12);
    lensGeo.rotateX(Math.PI / 2);

    const leftLens = new THREE.Mesh(lensGeo, sensorGlowMat);
    leftLens.position.set(0.45 * s, 4.0 * s, 1.38 * s);
    this.group.add(leftLens);

    const rightLens = new THREE.Mesh(lensGeo, sensorGlowMat);
    rightLens.position.set(0.95 * s, 4.0 * s, 1.38 * s);
    this.group.add(rightLens);

    // 4. High-Gain Parabolic Dish Antenna
    const dishGeo = new THREE.SphereGeometry(0.6 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const dish = new THREE.Mesh(dishGeo, goldFoilMat);
    dish.position.set(-0.7 * s, 2.7 * s, -1.1 * s);
    dish.rotation.x = -Math.PI * 0.32;
    dish.rotation.z = Math.PI * 0.15;
    this.group.add(dish);

    // 5. Rocker-Bogie Suspension Arms & 6 Articulated Wheels
    const wheelPositions = [
      { x:  1.6 * s, z:  1.4 * s, name: "FL" },
      { x:  1.7 * s, z:  0.0 * s, name: "ML" },
      { x:  1.6 * s, z: -1.4 * s, name: "RL" },
      { x: -1.6 * s, z:  1.4 * s, name: "FR" },
      { x: -1.7 * s, z:  0.0 * s, name: "MR" },
      { x: -1.6 * s, z: -1.4 * s, name: "RR" }
    ];

    const wheelCylGeo = new THREE.CylinderGeometry(0.65 * s, 0.65 * s, 0.5 * s, 18);
    wheelCylGeo.rotateZ(Math.PI / 2);

    const rimGeo = new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.52 * s, 12);
    rimGeo.rotateZ(Math.PI / 2);

    for (const wp of wheelPositions) {
      const wheelAssembly = new THREE.Group();
      wheelAssembly.position.set(wp.x, 0.65 * s, wp.z);

      const wheelMesh = new THREE.Mesh(wheelCylGeo, wheelMat);
      wheelMesh.castShadow = true;
      wheelAssembly.add(wheelMesh);

      const hubMesh = new THREE.Mesh(rimGeo, goldFoilMat);
      wheelAssembly.add(hubMesh);

      const armGeo = new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 1.3 * s, 8);
      const arm = new THREE.Mesh(armGeo, darkMetalMat);
      arm.position.set(wp.x > 0 ? -0.2 * s : 0.2 * s, 0.4 * s, 0);
      arm.rotation.z = wp.x > 0 ? -Math.PI * 0.18 : Math.PI * 0.18;
      this.group.add(arm);

      this.group.add(wheelAssembly);
      this.wheels.push(wheelMesh);
    }

    // 6. Forward Exploration Spotlight
    const headlight = new THREE.PointLight(
      isGhost ? 0x00f0ff : 0xddeeff,
      isGhost ? 1.8 : 2.5,
      45 * s
    );
    headlight.position.set(0, 2.0 * s, 2.2 * s);
    this.group.add(headlight);

    // 7. Overhead Holographic Beacon (ensures instant visibility from any camera distance)
    const beaconGeo = new THREE.OctahedronGeometry(0.8 * s, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: isGhost ? 0x00f0ff : 0x51dfa0,
      wireframe: true,
      transparent: true,
      opacity: isGhost ? 0.95 : 0.85
    });
    this.beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    this.beaconMesh.position.set(0, 5.8 * s, 0);
    this.group.add(this.beaconMesh);

    // Glowing ground projection disc
    const discGeo = new THREE.RingGeometry(2.5 * s, 3.2 * s, 24);
    discGeo.rotateX(-Math.PI / 2);
    const discMat = new THREE.MeshBasicMaterial({
      color: isGhost ? 0x00f0ff : 0x51dfa0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: isGhost ? 0.6 : 0.4
    });
    const groundDisc = new THREE.Mesh(discGeo, discMat);
    groundDisc.position.y = 0.1 * s;
    this.group.add(groundDisc);
  }

  /**
   * Update rover position, terrain-following orientation, and wheel rotation.
   * @param {number} worldX
   * @param {number} worldY Surface height in Three.js
   * @param {number} worldZ
   * @param {number} targetHeading Yaw angle (radians)
   * @param {THREE.Vector3} surfaceNormal Terrain normal vector
   * @param {number} distanceDelta Meters travelled since last frame
   */
  update(worldX, worldY, worldZ, targetHeading, surfaceNormal, distanceDelta = 0) {
    // 1. Update position with small safety clearance above terrain
    this.group.position.set(worldX, worldY + 0.3, worldZ);

    // 2. Smoothly interpolate heading (yaw)
    if (Number.isFinite(targetHeading)) {
      let diff = targetHeading - this.headingAngle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.headingAngle += diff * 0.15;
    }

    // 3. Align orientation with terrain normal and forward heading
    const forward = new THREE.Vector3(
      Math.sin(this.headingAngle),
      0,
      Math.cos(this.headingAngle)
    );

    const up = surfaceNormal && surfaceNormal.lengthSq() > 0.1
      ? surfaceNormal.clone().normalize()
      : new THREE.Vector3(0, 1, 0);

    // Proper right-handed orthonormal basis:
    // right = up x forward
    let right = new THREE.Vector3().crossVectors(up, forward);
    if (right.lengthSq() < 1e-4) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }

    // adjustedForward = right x up
    const adjustedForward = new THREE.Vector3().crossVectors(right, up).normalize();

    // Construct SO(3) matrix: [right, up, adjustedForward]
    const rotMatrix = new THREE.Matrix4().makeBasis(right, up, adjustedForward);
    if (!Number.isNaN(rotMatrix.elements[0]) && !Number.isNaN(rotMatrix.elements[5])) {
      this.group.quaternion.setFromRotationMatrix(rotMatrix);
    }

    // 4. Rotate wheels proportional to distance travelled
    if (distanceDelta > 0) {
      const angularDistance = distanceDelta / (0.65 * this.scale);
      for (const wheel of this.wheels) {
        wheel.rotation.x += angularDistance;
      }
    }

    // 5. Spin overhead beacon slowly for visual feedback
    if (this.beaconMesh) {
      this.beaconMesh.rotation.y += 0.04;
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}

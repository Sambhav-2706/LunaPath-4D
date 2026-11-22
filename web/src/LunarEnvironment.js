/**
 * LunaPath-4D
 * LunarEnvironment.js
 *
 * Member 2 - Lunar Space Environment & Lighting
 * - Airless pitch-black sky with procedurally generated starfield
 * - Low-elevation directional solar illumination (representing Lunar South Pole solar angle)
 * - Calibrated earthshine/diffuse regolith ambient light for crisp shadow contrast
 */

import * as THREE from "three";

export class LunarEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.dirLight = null;
    this.ambientLight = null;
    this.starfield = null;

    this.setupLighting();
    this.setupStarfield();
  }

  setupLighting() {
    // 1. Ambient Light (Subtle cold blue-gray earthshine)
    // On the airless Moon, shadows are dark, but secondary bounce from surrounding
    // regolith provides ~10% illumination.
    this.ambientLight = new THREE.AmbientLight(0x28323e, 0.45);
    this.scene.add(this.ambientLight);

    // 2. Directional Sun Light (Sharp, high-intensity sunlight)
    // At the lunar south pole, the sun hovers low on the horizon (~12° to 20° elevation).
    this.dirLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    this.dirLight.position.set(-800, 450, -1200);
    this.dirLight.castShadow = true;

    // Shadow map configuration covering the 2.5km terrain
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 100;
    this.dirLight.shadow.camera.far = 3000;

    const shadowExtent = 1500;
    this.dirLight.shadow.camera.left = -shadowExtent;
    this.dirLight.shadow.camera.right = shadowExtent;
    this.dirLight.shadow.camera.top = shadowExtent;
    this.dirLight.shadow.camera.bottom = -shadowExtent;
    this.dirLight.shadow.bias = -0.0005;

    this.scene.add(this.dirLight);

    // Subtle blue fill light from opposing hemisphere
    const hemiLight = new THREE.HemisphereLight(0x1a222d, 0x080c12, 0.25);
    this.scene.add(hemiLight);
  }

  setupStarfield() {
    // 3. Airless Lunar Sky Starfield
    const starCount = 3500;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const color = new THREE.Color();
    const radius = 3200;

    for (let i = 0; i < starCount; i++) {
      // Uniform spherical distribution above the lunar horizon
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      // Only distribute in the upper hemisphere (y >= 0) plus slightly below horizon
      const y = Math.abs(Math.cos(phi)) * radius;
      const x = Math.sin(phi) * Math.cos(theta) * radius;
      const z = Math.sin(phi) * Math.sin(theta) * radius;

      starPositions[i * 3 + 0] = x;
      starPositions[i * 3 + 1] = y + 50;
      starPositions[i * 3 + 2] = z;

      // Slight stellar temperature variation (white, pale blue, pale gold)
      const starTemp = Math.random();
      if (starTemp < 0.7) {
        color.setRGB(0.9, 0.95, 1.0); // Pure white / A-type
      } else if (starTemp < 0.9) {
        color.setRGB(0.7, 0.85, 1.0); // Blue star / B-type
      } else {
        color.setRGB(1.0, 0.85, 0.65); // Warm gold / K-type
      }

      const brightness = 0.5 + Math.random() * 0.5;
      starColors[i * 3 + 0] = color.r * brightness;
      starColors[i * 3 + 1] = color.g * brightness;
      starColors[i * 3 + 2] = color.b * brightness;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.9
    });

    this.starfield = new THREE.Points(starGeo, starMat);
    this.starfield.name = "LunarStarfield";
    this.scene.add(this.starfield);

    // Set scene background to deep space black
    this.scene.background = new THREE.Color(0x04070c);
  }
}

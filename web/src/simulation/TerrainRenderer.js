
import * as THREE from "three";

export async function loadTerrain(scene) {
    const metadataResponse = await fetch("/data/terrain_meta.json");

    if (!metadataResponse.ok) {
        throw new Error("Failed to load terrain metadata");
    }

    const metadata = await metadataResponse.json();

    const {
        width,
        height,
        cell_size_meters,
        minimum_elevation_meters,
        maximum_elevation_meters
    } = metadata;

    const demResponse = await fetch("/data/dem.bin");

    if (!demResponse.ok) {
        throw new Error("Failed to load DEM binary");
    }

    const buffer = await demResponse.arrayBuffer();

    const expectedSize = width * height * 4;

    if (buffer.byteLength !== expectedSize) {
        throw new Error(
            `Invalid DEM size. Expected ${expectedSize}, received ${buffer.byteLength}`
        );
    }

    const view = new DataView(buffer);
    const elevations = new Float32Array(width * height);

    for (let i = 0; i < elevations.length; i++) {
        elevations[i] = view.getFloat32(i * 4, true);
    }

    const geometry = new THREE.PlaneGeometry(
        (width - 1) * cell_size_meters,
        (height - 1) * cell_size_meters,
        width - 1,
        height - 1
    );

    const positions = geometry.attributes.position;
    const colors = [];

    const verticalScale = 3;
    const elevationRange =
        maximum_elevation_meters - minimum_elevation_meters;

    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const index = row * width + col;
            const elevation = elevations[index];

            // PlaneGeometry vertices are ordered row by row.
            positions.setZ(
                index,
                (elevation - minimum_elevation_meters) * verticalScale
            );

            const normalized = elevationRange > 0
                ? (elevation - minimum_elevation_meters) / elevationRange
                : 0;

            const color = new THREE.Color();

            color.setHSL(
                0.09 - normalized * 0.06,
                0.25,
                0.25 + normalized * 0.25
            );

            colors.push(color.r, color.g, color.b);
        }
    }

    geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3)
    );

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide
    });

    const terrain = new THREE.Mesh(geometry, material);

    terrain.rotation.x = -Math.PI / 2;
    terrain.name = "LunarTerrain";
    terrain.receiveShadow = true;

    scene.add(terrain);

    return {
        terrain,
        metadata,
        elevations,

        dispose() {
            scene.remove(terrain);
            geometry.dispose();
            material.dispose();
        }
    };
}

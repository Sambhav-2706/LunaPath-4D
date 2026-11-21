
import * as THREE from "three";

export function createSurfaceDetails(scene, terrainData) {
    const { metadata, elevations } = terrainData;
    const { width, height, cell_size_meters } = metadata;

    const objects = [];
    const geometries = [];
    const materials = [];

    function seededRandom(seed) {
        let value = seed >>> 0;

        return function () {
            value = (value * 1664525 + 1013904223) >>> 0;
            return value / 4294967296;
        };
    }

    const random = seededRandom(42);

    function terrainHeight(gridX, gridY) {
        const x = THREE.MathUtils.clamp(gridX, 0, width - 1);
        const y = THREE.MathUtils.clamp(gridY, 0, height - 1);

        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = Math.min(x0 + 1, width - 1);
        const y1 = Math.min(y0 + 1, height - 1);

        const tx = x - x0;
        const ty = y - y0;

        const h00 = elevations[y0 * width + x0];
        const h10 = elevations[y0 * width + x1];
        const h01 = elevations[y1 * width + x0];
        const h11 = elevations[y1 * width + x1];

        const top = THREE.MathUtils.lerp(h00, h10, tx);
        const bottom = THREE.MathUtils.lerp(h01, h11, tx);

        const elevation = THREE.MathUtils.lerp(top, bottom, ty);

        return (
            elevation - metadata.minimum_elevation_meters
        ) * 3;
    }

    function gridToWorld(gridX, gridY) {
        return {
            x: (gridX - (width - 1) / 2) * cell_size_meters,
            z: (gridY - (height - 1) / 2) * cell_size_meters
        };
    }

    function addObject(object) {
        scene.add(object);
        objects.push(object);
    }

    // Shared lunar rock material.
    const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x77736d,
        roughness: 1,
        flatShading: true
    });

    materials.push(rockMaterial);

    // Scatter rocks across the terrain.
    const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
    geometries.push(rockGeometry);

    const ROCK_COUNT = 180;

    for (let i = 0; i < ROCK_COUNT; i++) {
        const gridX = 4 + random() * (width - 8);
        const gridY = 4 + random() * (height - 8);

        const world = gridToWorld(gridX, gridY);

        const size = 0.8 + random() * 2.8;
        const heightScale = size * (0.45 + random() * 0.5);

        const rock = new THREE.Mesh(
            rockGeometry,
            rockMaterial
        );

        rock.position.set(
            world.x,
            terrainHeight(gridX, gridY) + heightScale * 0.65,
            world.z
        );

        rock.scale.set(
            size,
            heightScale,
            size * (0.6 + random() * 0.7)
        );

        rock.rotation.set(
            random() * Math.PI,
            random() * Math.PI,
            random() * Math.PI
        );

        rock.castShadow = true;
        rock.receiveShadow = true;
        rock.name = "LunarRock";

        addObject(rock);
    }

    // Highlight crater rims using Member 1's metadata.
    const craterMaterial = new THREE.MeshStandardMaterial({
        color: 0x625c53,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide
    });

    materials.push(craterMaterial);

    const craterGeometry = new THREE.TorusGeometry(
        1,
        0.025,
        8,
        64
    );

    geometries.push(craterGeometry);

    const craters = metadata.craters || [];

    for (const crater of craters) {
        const radius = crater.radius_meters;

        if (!radius || radius <= 0) continue;

        const center = gridToWorld(crater.x, crater.y);

        // Find a representative height around the crater rim.
        let rimHeight = -Infinity;

        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;

            const offsetX =
                Math.cos(angle) * crater.radius_cells;

            const offsetY =
                Math.sin(angle) * crater.radius_cells;

            rimHeight = Math.max(
                rimHeight,
                terrainHeight(
                    crater.x + offsetX,
                    crater.y + offsetY
                )
            );
        }

        const rim = new THREE.Mesh(
            craterGeometry,
            craterMaterial
        );

        rim.position.set(
            center.x,
            rimHeight + 0.4,
            center.z
        );

        rim.rotation.x = Math.PI / 2;
        rim.scale.set(radius, radius, radius);

        rim.name = "CraterRim";
        rim.receiveShadow = true;

        addObject(rim);
    }

    console.log(
        `Lunar surface details initialized: ${ROCK_COUNT} rocks, ${craters.length} crater rims.`
    );

    function dispose() {
        for (const object of objects) {
            scene.remove(object);
        }

        for (const geometry of geometries) {
            geometry.dispose();
        }

        for (const material of materials) {
            material.dispose();
        }

        objects.length = 0;
    }

    return {
        objects,
        dispose
    };
}

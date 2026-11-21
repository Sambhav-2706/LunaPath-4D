
import * as THREE from "three";

export function createRoverRenderer(scene, terrainData) {
    const { metadata, elevations } = terrainData;

    const {
        width,
        height,
        cell_size_meters
    } = metadata;

    const VERTICAL_SCALE = 3;
    const DRIVE_SPEED = 12;
    const TURN_SPEED = 1.2;
    const WHEEL_RADIUS = 2.5;
    const HEIGHT_SMOOTHING = 8;

    const rover = new THREE.Group();
    rover.name = "LunarRover";
    rover.rotation.order = "YXZ";

    const wheels = [];
    const geometries = [];
    const materials = [];

    function createMaterial(color, metalness = 0.1) {
        const material = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.8,
            metalness
        });

        materials.push(material);
        return material;
    }

    function createBox(name, size, position, material) {
        const geometry = new THREE.BoxGeometry(
            size[0],
            size[1],
            size[2]
        );

        geometries.push(geometry);

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;
        mesh.position.set(...position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        rover.add(mesh);
        return mesh;
    }

    const chassisMaterial = createMaterial(0xc5b99d, 0.25);
    const frameMaterial = createMaterial(0x555b60, 0.55);
    const wheelMaterial = createMaterial(0x25282b, 0.15);
    const hubMaterial = createMaterial(0xb4a27e, 0.65);
    const panelMaterial = createMaterial(0x183d68, 0.65);
    const whiteMaterial = createMaterial(0xd9d9d9, 0.2);
    const blackMaterial = createMaterial(0x111820, 0.3);

    // Main rover chassis.
    createBox(
        "RoverChassis",
        [7, 1.6, 10.5],
        [0, 5.2, 0],
        chassisMaterial
    );

    createBox(
        "LowerFrame",
        [5.5, 0.7, 8],
        [0, 4.1, 0],
        frameMaterial
    );

    // Six wheels.
    const wheelPositions = [
        [-5, 2.5, -5],
        [5, 2.5, -5],
        [-5, 2.5, 0],
        [5, 2.5, 0],
        [-5, 2.5, 5],
        [5, 2.5, 5]
    ];

    for (const [x, y, z] of wheelPositions) {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(x, y, z);

        const tireGeometry = new THREE.CylinderGeometry(
            WHEEL_RADIUS,
            WHEEL_RADIUS,
            1.5,
            20
        );

        geometries.push(tireGeometry);

        const tire = new THREE.Mesh(
            tireGeometry,
            wheelMaterial
        );

        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        wheelGroup.add(tire);

        const hubGeometry = new THREE.CylinderGeometry(
            1.15,
            1.15,
            1.58,
            16
        );

        geometries.push(hubGeometry);

        const hub = new THREE.Mesh(
            hubGeometry,
            hubMaterial
        );

        hub.rotation.z = Math.PI / 2;
        wheelGroup.add(hub);

        rover.add(wheelGroup);
        wheels.push(wheelGroup);

        // Suspension arm.
        const armGeometry = new THREE.BoxGeometry(
            0.8,
            0.8,
            5.2
        );

        geometries.push(armGeometry);

        const arm = new THREE.Mesh(
            armGeometry,
            frameMaterial
        );

        arm.position.set(
            x * 0.55,
            3.1,
            z * 0.75
        );

        arm.castShadow = true;
        rover.add(arm);
    }

    // Solar panels.
    for (const side of [-1, 1]) {
        createBox(
            "SolarPanel",
            [5, 0.15, 7],
            [side * 7, 5.3, 0],
            panelMaterial
        );

        createBox(
            "PanelSupport",
            [0.25, 1.2, 0.25],
            [side * 5, 4.7, 0],
            frameMaterial
        );
    }

    // Camera mast.
    createBox(
        "CameraMast",
        [0.35, 5, 0.35],
        [0, 8.2, -3.5],
        whiteMaterial
    );

    createBox(
        "CameraHead",
        [2.2, 1.2, 1.5],
        [0, 10.7, -3.5],
        chassisMaterial
    );

    createBox(
        "CameraLens",
        [0.8, 0.8, 0.25],
        [0, 10.7, -4.35],
        blackMaterial
    );

    // Antenna.
    const antennaGeometry = new THREE.CylinderGeometry(
        0.06,
        0.06,
        4,
        8
    );

    geometries.push(antennaGeometry);

    const antenna = new THREE.Mesh(
        antennaGeometry,
        whiteMaterial
    );

    antenna.position.set(2.5, 7.5, 3.5);
    rover.add(antenna);

    scene.add(rover);

    // Bilinear DEM height sampling.
    function getTerrainHeight(gridX, gridY) {
        const x = THREE.MathUtils.clamp(
            gridX,
            0,
            width - 1
        );

        const y = THREE.MathUtils.clamp(
            gridY,
            0,
            height - 1
        );

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

        const elevation = THREE.MathUtils.lerp(
            top,
            bottom,
            ty
        );

        return (elevation - metadata.minimum_elevation_meters)
            * VERTICAL_SCALE;
    }

    function worldToGrid(x, z) {
        return {
            gridX: x / cell_size_meters + (width - 1) / 2,
            gridY: z / cell_size_meters + (height - 1) / 2
        };
    }

    function gridToWorld(gridX, gridY) {
        return {
            x: (gridX - (width - 1) / 2) * cell_size_meters,
            z: (gridY - (height - 1) / 2) * cell_size_meters
        };
    }

    let targetHeight = 0;

    function getTerrainSlope(gridX, gridY) {
        const left = getTerrainHeight(gridX - 1, gridY);
        const right = getTerrainHeight(gridX + 1, gridY);
        const up = getTerrainHeight(gridX, gridY - 1);
        const down = getTerrainHeight(gridX, gridY + 1);

        const gradientX =
            (right - left) / (2 * cell_size_meters);

        const gradientZ =
            (down - up) / (2 * cell_size_meters);

        return {
            pitch: Math.atan(gradientZ),
            roll: -Math.atan(gradientX)
        };
    }

    function setGridPosition(gridX, gridY) {
        const clampedX = THREE.MathUtils.clamp(
            gridX,
            0,
            width - 1
        );

        const clampedY = THREE.MathUtils.clamp(
            gridY,
            0,
            height - 1
        );

        const world = gridToWorld(clampedX, clampedY);

        rover.position.x = world.x;
        rover.position.z = world.z;

        targetHeight = getTerrainHeight(
            clampedX,
            clampedY
        );

        rover.position.y = targetHeight;

        const slope = getTerrainSlope(
            clampedX,
            clampedY
        );

        rover.rotation.x = slope.pitch;
        rover.rotation.z = slope.roll;
    }

    function setWorldPosition(x, z) {
        const grid = worldToGrid(x, z);

        const clampedX = THREE.MathUtils.clamp(
            grid.gridX,
            0,
            width - 1
        );

        const clampedY = THREE.MathUtils.clamp(
            grid.gridY,
            0,
            height - 1
        );

        const world = gridToWorld(clampedX, clampedY);

        rover.position.x = world.x;
        rover.position.z = world.z;

        targetHeight = getTerrainHeight(
            clampedX,
            clampedY
        );

        const slope = getTerrainSlope(
            clampedX,
            clampedY
        );

        rover.rotation.x = slope.pitch;
        rover.rotation.z = slope.roll;
    }

    function update(forwardInput, turnInput, deltaTime) {
        if (deltaTime <= 0) return;

        if (turnInput !== 0) {
            rover.rotation.y +=
                turnInput * TURN_SPEED * deltaTime;
        }

        const distance =
            forwardInput * DRIVE_SPEED * deltaTime;

        if (distance !== 0) {
            const yaw = rover.rotation.y;

            const nextX =
                rover.position.x - Math.sin(yaw) * distance;

            const nextZ =
                rover.position.z - Math.cos(yaw) * distance;

            setWorldPosition(nextX, nextZ);

            const wheelRotation = distance / WHEEL_RADIUS;

            for (const wheel of wheels) {
                wheel.rotation.x += wheelRotation;
            }
        }

        // Smooth vertical movement over terrain.
        const smoothing = 1 - Math.exp(
            -HEIGHT_SMOOTHING * deltaTime
        );

        rover.position.y = THREE.MathUtils.lerp(
            rover.position.y,
            targetHeight,
            smoothing
        );
    }

    // Spawn at the center of the terrain.
    setGridPosition(
        (width - 1) / 2,
        (height - 1) / 2
    );

    function dispose() {
        scene.remove(rover);

        for (const geometry of geometries) {
            geometry.dispose();
        }

        for (const material of materials) {
            material.dispose();
        }
    }

    return {
        rover,
        wheels,
        setGridPosition,
        setWorldPosition,
        update,
        dispose
    };
}

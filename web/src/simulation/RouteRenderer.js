
import * as THREE from "three";

export function createRouteRenderer(scene, terrainData) {
    const { metadata, elevations } = terrainData;

    const {
        width,
        height,
        cell_size_meters,
        minimum_elevation_meters
    } = metadata;

    const VERTICAL_SCALE = 3;
    const ROUTE_HEIGHT_OFFSET = 1.5;

    const routeMaterial = new THREE.LineBasicMaterial({
        color: 0x35e6a1,
        linewidth: 2,
        depthTest: true
    });

    const hazardMaterial = new THREE.MeshStandardMaterial({
        color: 0xff5733,
        emissive: 0x641500,
        roughness: 0.7
    });

    const destinationMaterial = new THREE.MeshStandardMaterial({
        color: 0x39e75f,
        emissive: 0x125c20,
        roughness: 0.5
    });

    const hazardGeometry = new THREE.OctahedronGeometry(2.5, 0);
    const destinationGeometry = new THREE.ConeGeometry(2.5, 7, 12);

    let routeObject = null;
    let destinationObject = null;
    let hazardObjects = [];

    function clampGridPoint(point) {
        return {
            x: THREE.MathUtils.clamp(point.x, 0, width - 1),
            y: THREE.MathUtils.clamp(point.y, 0, height - 1)
        };
    }

    function getTerrainHeight(gridX, gridY) {
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
            elevation - minimum_elevation_meters
        ) * VERTICAL_SCALE;
    }

    function gridToWorld(point, heightOffset = ROUTE_HEIGHT_OFFSET) {
        const grid = clampGridPoint(point);

        return new THREE.Vector3(
            (grid.x - (width - 1) / 2) * cell_size_meters,
            getTerrainHeight(grid.x, grid.y) + heightOffset,
            (grid.y - (height - 1) / 2) * cell_size_meters
        );
    }

    function clearRoute() {
        if (!routeObject) return;

        scene.remove(routeObject);
        routeObject.geometry.dispose();
        routeObject = null;
    }

    function setRoute(gridPoints) {
        clearRoute();

        if (!Array.isArray(gridPoints) || gridPoints.length < 2) {
            return;
        }

        const points = gridPoints.map(point => gridToWorld(point));

        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        routeObject = new THREE.Line(geometry, routeMaterial);
        routeObject.name = "PlannedRoverRoute";

        scene.add(routeObject);
    }

    function clearDestination() {
        if (!destinationObject) return;

        scene.remove(destinationObject);
        destinationObject = null;
    }

    function setDestination(gridPoint) {
        clearDestination();

        if (!gridPoint) return;

        destinationObject = new THREE.Mesh(
            destinationGeometry,
            destinationMaterial
        );

        destinationObject.position.copy(
            gridToWorld(gridPoint, 4)
        );

        destinationObject.position.y += 3.5;
        destinationObject.name = "RouteDestination";

        scene.add(destinationObject);
    }

    function clearHazards() {
        for (const hazard of hazardObjects) {
            scene.remove(hazard);
        }

        hazardObjects = [];
    }

    function setHazards(gridPoints) {
        clearHazards();

        if (!Array.isArray(gridPoints)) return;

        for (const point of gridPoints) {
            if (
                typeof point?.x !== "number" ||
                typeof point?.y !== "number"
            ) {
                continue;
            }

            const hazard = new THREE.Mesh(
                hazardGeometry,
                hazardMaterial
            );

            hazard.position.copy(
                gridToWorld(point, 3)
            );

            hazard.position.y += 2.5;
            hazard.name = "NavigationHazard";

            scene.add(hazard);
            hazardObjects.push(hazard);
        }
    }

    function dispose() {
        clearRoute();
        clearDestination();
        clearHazards();

        routeMaterial.dispose();
        hazardMaterial.dispose();
        destinationMaterial.dispose();

        hazardGeometry.dispose();
        destinationGeometry.dispose();
    }

    return {
        setRoute,
        clearRoute,
        setDestination,
        clearDestination,
        setHazards,
        clearHazards,
        dispose
    };
}

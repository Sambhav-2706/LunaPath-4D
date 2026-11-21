
import { createSceneManager } from "./SceneManager.js";
import { loadTerrain } from "./TerrainRenderer.js";
import { createCameraController } from "./CameraController.js";
import { createRoverRenderer } from "./RoverRenderer.js";
import { createSurfaceDetails } from "./SurfaceDetails.js";
import { createRouteRenderer } from "./RouteRenderer.js";

export async function createSimulation(container) {
    if (!container) {
        throw new Error("Simulation container is required");
    }

    const manager = createSceneManager(container);

    let terrainData = null;
    let surfaceDetails = null;
    let cameraController = null;
    let roverData = null;
    let routeRenderer = null;
    let disposed = false;

    let manualControlEnabled = true;

    const pressedKeys = new Set();

    const movementKeys = new Set([
        "KeyW", "KeyA", "KeyS", "KeyD",
        "ArrowUp", "ArrowDown",
        "ArrowLeft", "ArrowRight"
    ]);

    function handleKeyDown(event) {
        if (!movementKeys.has(event.code)) return;
        if (!manualControlEnabled) return;

        event.preventDefault();
        pressedKeys.add(event.code);
    }

    function handleKeyUp(event) {
        pressedKeys.delete(event.code);
    }

    function clearPressedKeys() {
        pressedKeys.clear();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearPressedKeys);

    let previousTime = performance.now();

    try {
        terrainData = await loadTerrain(manager.scene);

        surfaceDetails = createSurfaceDetails(
            manager.scene,
            terrainData
        );

        roverData = createRoverRenderer(
            manager.scene,
            terrainData
        );

        routeRenderer = createRouteRenderer(
            manager.scene,
            terrainData
        );

        cameraController = createCameraController(
            manager.camera,
            manager.renderer
        );

        cameraController.setFollowTarget(roverData.rover);

        manager.setUpdateCallback(() => {
            const currentTime = performance.now();

            const deltaTime = Math.min(
                (currentTime - previousTime) / 1000,
                0.05
            );

            previousTime = currentTime;

            let forward = 0;
            let turn = 0;

            if (manualControlEnabled) {
                if (
                    pressedKeys.has("KeyW") ||
                    pressedKeys.has("ArrowUp")
                ) forward += 1;

                if (
                    pressedKeys.has("KeyS") ||
                    pressedKeys.has("ArrowDown")
                ) forward -= 1;

                if (
                    pressedKeys.has("KeyA") ||
                    pressedKeys.has("ArrowLeft")
                ) turn += 1;

                if (
                    pressedKeys.has("KeyD") ||
                    pressedKeys.has("ArrowRight")
                ) turn -= 1;

                roverData.update(forward, turn, deltaTime);
            }

            cameraController.update();
        });

        console.log("Lunar terrain loaded.");
        console.log("Lunar surface details initialized.");
        console.log("Lunar rover initialized.");
        console.log("Route visualization initialized.");
        console.log("WASD controls enabled.");
        console.log("Camera follow mode enabled.");

        return {
            scene: manager.scene,
            camera: manager.camera,
            renderer: manager.renderer,
            rover: roverData.rover,

            getTerrainMetadata() {
                return terrainData.metadata;
            },

            setManualControlEnabled(enabled) {
                manualControlEnabled = Boolean(enabled);

                if (!manualControlEnabled) {
                    pressedKeys.clear();
                }
            },

            setRoverGridPosition(x, y) {
                roverData.setGridPosition(x, y);
            },

            setRoverWorldPosition(x, z) {
                roverData.setWorldPosition(x, z);
            },

            setRoute(gridPoints) {
                routeRenderer.setRoute(gridPoints);
            },

            clearRoute() {
                routeRenderer.clearRoute();
            },

            setDestination(gridPoint) {
                routeRenderer.setDestination(gridPoint);
            },

            clearDestination() {
                routeRenderer.clearDestination();
            },

            setHazards(gridPoints) {
                routeRenderer.setHazards(gridPoints);
            },

            clearHazards() {
                routeRenderer.clearHazards();
            },

            dispose() {
                if (disposed) return;
                disposed = true;

                window.removeEventListener("keydown", handleKeyDown);
                window.removeEventListener("keyup", handleKeyUp);
                window.removeEventListener("blur", clearPressedKeys);

                routeRenderer?.dispose();
                roverData?.dispose();
                surfaceDetails?.dispose();
                terrainData?.dispose();
                cameraController?.dispose();
                manager.dispose();
            }
        };
    } catch (error) {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        window.removeEventListener("blur", clearPressedKeys);

        routeRenderer?.dispose();
        roverData?.dispose();
        surfaceDetails?.dispose();
        terrainData?.dispose();
        cameraController?.dispose();
        manager.dispose();

        throw error;
    }
}

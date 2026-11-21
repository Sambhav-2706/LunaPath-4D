
import { createNavigationPayload } from "../../navigation/browserNavigationExample.js";
import { createBrowserNavigationTerrain } from "../../navigation/BrowserTerrainAdapter.js";
import { MissionController } from "../../navigation/MissionController.js";
import { AutonomousMission } from "../../navigation/AutonomousMission.js";

export async function integrateNavigation(simulation) {
    if (!simulation) {
        throw new Error("Simulation instance is required.");
    }

    console.log("Initializing autonomous navigation...");

    const payload = await createNavigationPayload();

    if (
        !payload.start?.grid ||
        !payload.destination?.grid ||
        !Array.isArray(payload.path?.grid) ||
        payload.path.grid.length < 2 ||
        !Array.isArray(payload.hazards?.grid)
    ) {
        throw new Error("Invalid navigation payload.");
    }

    simulation.setRoverGridPosition(
        payload.start.grid.x,
        payload.start.grid.y
    );

    simulation.setRoute(payload.path.grid);
    simulation.setDestination(payload.destination.grid);
    simulation.setHazards(payload.hazards.grid);

    window.navigationPayload = payload;

    console.log("Navigation visualization initialized.");
    console.log("Navigation mode:", payload.mode);
    console.log("Route nodes:", payload.pathNodes);
    console.log("Route distance:", payload.totalDistanceMeters);
    console.log("Hazards:", payload.hazards.grid.length);

    return payload;
}

export async function createAutonomousController(simulation, payload) {
    if (!simulation || !payload) {
        throw new Error("Simulation and navigation payload are required.");
    }

    // Load the terrain data required by dynamic replanning.
    const terrain = await createBrowserNavigationTerrain();

    // Preserve all hazards from the initial navigation plan.
    // This is important: replanning must never treat them as safe.
    for (const hazard of payload.hazards.grid) {
        const index = hazard.y * terrain.width + hazard.x;

        if (
            hazard.x < 0 ||
            hazard.y < 0 ||
            hazard.x >= terrain.width ||
            hazard.y >= terrain.height
        ) {
            throw new Error("Initial hazard is outside terrain bounds.");
        }

        terrain.traversability[index] = 0;
    }

    const mission = new MissionController(
        payload.path.grid,
        {
            cellSize: terrain.cellSize,
            speed: 5
        }
    );

    const autonomousMission = new AutonomousMission(
        terrain,
        mission,
        payload.mode
    );

    let controllerState = "READY";
    let previousTime = null;
    let animationFrame = null;
    let disposed = false;
    let fastForwardEnabled = false;

    const startButton = document.getElementById("start-btn");
    const pauseButton = document.getElementById("pause-btn");
    const resumeButton = document.getElementById("resume-btn");
    const stopButton = document.getElementById("stop-btn");

    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    function formatMeters(value) {
        return `${Math.max(0, value).toFixed(1)} m`;
    }

    function getMissionStatus() {
        if (controllerState === "PAUSED") return "PAUSED";

        if (
            mission.status === "COMPLETED" ||
            mission.status === "STOPPED"
        ) {
            return mission.status;
        }

        return controllerState;
    }

    function updateControls() {
        const status = getMissionStatus();

        if (startButton) {
            startButton.disabled = status !== "READY";
        }

        if (pauseButton) {
            pauseButton.disabled = status !== "RUNNING";
        }

        if (resumeButton) {
            resumeButton.disabled = status !== "PAUSED";
        }

        if (stopButton) {
            stopButton.disabled = !["RUNNING", "PAUSED", "READY"].includes(status);
        }

        const hazardButton = document.getElementById("hazard-btn");

        if (hazardButton) {
            hazardButton.disabled = status !== "RUNNING";
        }
    }

    function updateTelemetry() {
        const snapshot = mission.getSnapshot();
        const status = getMissionStatus();

        const progress = Math.min(
            100,
            Math.max(0, snapshot.progress)
        );

        setText("mission-status", status);
        setText("progress-text", `${progress.toFixed(1)}%`);
        setText(
            "distance-travelled",
            formatMeters(snapshot.distanceTravelled)
        );
        setText(
            "distance-remaining",
            formatMeters(snapshot.remainingDistance)
        );
        const effectiveSpeed = snapshot.speed * (fastForwardEnabled ? 4 : 1);
        setText("rover-speed", `${effectiveSpeed.toFixed(1)} m/s${fastForwardEnabled ? " (4x)" : ""}`);
        setText("navigation-mode", payload.mode);
        setText("route-nodes", String(snapshot.currentRouteNodes));
        setText(
            "hazard-count",
            String(payload.hazards.grid.length + autonomousMission.hazardHistory.length)
        );
        setText(
            "replanning-count",
            String(autonomousMission.replanningCount)
        );

        const progressFill = document.getElementById("progress-fill");

        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }

        updateControls();
    }

    function updateRoverVisuals() {
        const position = mission.getPosition();

        simulation.setRoverGridPosition(
            position.x,
            position.y
        );

        // Point the rover towards its next waypoint.
        const roverState = mission.rover.getSnapshot();
        const target = roverState.target;

        if (target) {
            const dx = target.x - position.x;
            const dz = target.y - position.y;

            if (Math.hypot(dx, dz) > 0.0001) {
                simulation.rover.rotation.y = Math.atan2(
                    -dx,
                    -dz
                );
            }
        }
    }

    function animationLoop(timestamp) {
        if (disposed) return;

        if (controllerState === "RUNNING") {
            const deltaTime = previousTime === null
                ? 0
                : Math.min((timestamp - previousTime) / 1000, 0.1);

            previousTime = timestamp;

            mission.update(deltaTime * (fastForwardEnabled ? 4 : 1));

            if (mission.status === "COMPLETED") {
                controllerState = "COMPLETED";
                simulation.setManualControlEnabled(true);
                console.log("AUTONOMOUS MISSION COMPLETED.");
            }

            updateRoverVisuals();
        }

        updateTelemetry();

        animationFrame = requestAnimationFrame(animationLoop);
    }

    function start() {
        if (controllerState !== "READY") return;

        mission.start();
        controllerState = "RUNNING";
        previousTime = null;

        simulation.setManualControlEnabled(false);

        console.log("Autonomous mission started.");
        updateTelemetry();
    }

    function pause() {
        if (controllerState !== "RUNNING") return;

        mission.rover.pause();
        controllerState = "PAUSED";

        console.log("Autonomous mission paused.");
        updateTelemetry();
    }

    function resume() {
        if (controllerState !== "PAUSED") return;

        mission.rover.resume();
        controllerState = "RUNNING";
        previousTime = null;

        console.log("Autonomous mission resumed.");
        updateTelemetry();
    }

    function stop() {
        if (!["RUNNING", "PAUSED", "READY"].includes(controllerState)) {
            return;
        }

        mission.rover.stop();
        mission.status = "STOPPED";
        controllerState = "STOPPED";

        simulation.setManualControlEnabled(true);

        console.log("Autonomous mission stopped.");
        updateTelemetry();
    }

    function injectTestHazard() {
        if (controllerState !== "RUNNING") {
            return;
        }

        const path = mission.currentPath;
        const nextIndex = mission.rover.segmentIndex;

        // Pick a future waypoint, not the rover's current cell.
        let selectedHazard = null;

        for (
            let i = nextIndex + 3;
            i < path.length - 1;
            i++
        ) {
            const candidate = path[i];

            const alreadyKnown = [
                ...payload.hazards.grid,
                ...autonomousMission.hazardHistory
            ].some(
                hazard =>
                    hazard.x === candidate.x &&
                    hazard.y === candidate.y
            );

            if (!alreadyKnown) {
                selectedHazard = {
                    x: candidate.x,
                    y: candidate.y
                };

                break;
            }
        }

        if (!selectedHazard) {
            console.warn("No suitable future waypoint for hazard testing.");
            return;
        }

        console.log("Injecting test hazard:", selectedHazard);

        try {
            const decision = autonomousMission.handleHazard(
                selectedHazard
            );

            console.log("Hazard response:", decision);

            if (
                decision.success &&
                decision.status === "AUTONOMOUS_REPLAN_COMPLETED"
            ) {
                simulation.setRoute(decision.newPath);

                const allHazards = [
                    ...payload.hazards.grid,
                    ...autonomousMission.hazardHistory
                ];

                simulation.setHazards(allHazards);

                console.log(
                    "New route rendered. Replanning count:",
                    autonomousMission.replanningCount
                );
            } else if (!decision.success) {
                console.error("Hazard replanning failed:", decision);
            }

        } catch (error) {
            console.error("Hazard injection failed:", error);
        }

        updateTelemetry();
    }

    function toggleFastForward() {
        fastForwardEnabled = !fastForwardEnabled;

        const button = document.getElementById("fast-forward-btn");

        if (button) {
            button.textContent = fastForwardEnabled
                ? "FAST FORWARD: ON (4x)"
                : "FAST FORWARD: OFF";
        }

        console.log("Simulation speed:", fastForwardEnabled ? "4x" : "1x");

        updateTelemetry();
    }

    const fastForwardButton = document.createElement("button");
    fastForwardButton.id = "fast-forward-btn";
    fastForwardButton.textContent = "FAST FORWARD: OFF";
    fastForwardButton.style.gridColumn = "1 / -1";
    fastForwardButton.style.background = "#24547a";
    fastForwardButton.style.borderColor = "#3982b8";
    fastForwardButton.addEventListener("click", toggleFastForward);

    const buttonGrid = document.querySelector(".button-grid");
    buttonGrid?.appendChild(fastForwardButton);
    // Add a hazard-testing button without changing test.html again.

    if (buttonGrid && !document.getElementById("hazard-btn")) {
        const hazardButton = document.createElement("button");

        hazardButton.id = "hazard-btn";
        hazardButton.textContent = "TEST HAZARD";
        hazardButton.style.gridColumn = "1 / -1";
        hazardButton.style.background = "#80552c";
        hazardButton.style.borderColor = "#b47b3e";
        hazardButton.disabled = true;
        hazardButton.addEventListener("click", injectTestHazard);

        buttonGrid.appendChild(hazardButton);
    }

    startButton?.addEventListener("click", start);
    pauseButton?.addEventListener("click", pause);
    resumeButton?.addEventListener("click", resume);
    stopButton?.addEventListener("click", stop);

    updateTelemetry();

    animationFrame = requestAnimationFrame(animationLoop);

    return {
        mission,
        autonomousMission,

        start,
        pause,
        resume,
        stop,

        injectTestHazard,

        getSnapshot() {
            return {
                mission: mission.getSnapshot(),
                autonomous: autonomousMission.getSnapshot(),
                controllerState
            };
        },

        dispose() {
            if (disposed) return;

            disposed = true;

            if (animationFrame !== null) {
                cancelAnimationFrame(animationFrame);
            }

            fastForwardButton.removeEventListener("click", toggleFastForward);
            fastForwardButton.remove();
            startButton?.removeEventListener("click", start);
            pauseButton?.removeEventListener("click", pause);
            resumeButton?.removeEventListener("click", resume);
            stopButton?.removeEventListener("click", stop);

            document
                .getElementById("hazard-btn")
                ?.removeEventListener("click", injectTestHazard);

            simulation.setManualControlEnabled(true);
        }
    };
}

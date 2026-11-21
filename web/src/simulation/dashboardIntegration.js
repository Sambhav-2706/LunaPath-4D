
import { createSimulation } from "./index.js";
import {
    integrateNavigation,
    createAutonomousController
} from "./navigationIntegration.js";

export async function initializeDashboardSimulation() {
    const viewport = document.querySelector(".terrain-preview");
    const deployButton = document.querySelector("#deploy-btn");
    const resetButton = document.querySelector("#reset-btn");
    const roverStatus = document.querySelector("#rover-status");
    const distanceValue = document.querySelector("#distance-value");
    const systemLog = document.querySelector("#system-log");
    const viewBadge = document.querySelector(".view-badge");

    if (!viewport || !deployButton || !resetButton) {
        throw new Error("Dashboard simulation elements were not found.");
    }

    viewport.innerHTML = `
        <div id="dashboard-rover-viewport"></div>
        <div class="dashboard-sim-overlay top-left">LP / TERRAIN SYS</div>
        <div class="dashboard-sim-overlay top-right">GRID 256 × 256</div>
        <div class="dashboard-sim-overlay bottom-left">ELEVATION DATA: LOADED</div>
        <div class="dashboard-sim-overlay bottom-right" id="sim-state">INITIALIZING</div>
    `;

    const simulationContainer = viewport.querySelector(
        "#dashboard-rover-viewport"
    );

    // Remove the old dashboard prototype event listeners.
    const freshDeployButton = deployButton.cloneNode(true);
    const freshResetButton = resetButton.cloneNode(true);

    deployButton.replaceWith(freshDeployButton);
    resetButton.replaceWith(freshResetButton);

    let simulation = null;
    let controller = null;
    let controlPanel = null;

    let initialized = false;
    let initializing = false;
    let disposed = false;
    let animationFrame = null;

    // Styling for the visible mission controls.
    if (!document.querySelector("#dashboard-control-styles")) {
        const style = document.createElement("style");
        style.id = "dashboard-control-styles";
        style.textContent = `
            #dashboard-mission-controls {
                display: block;
                width: 100%;
                margin: 14px 0;
                padding: 14px;
                box-sizing: border-box;
                background: rgba(12, 20, 30, 0.95);
                border: 1px solid rgba(130, 160, 190, 0.25);
                border-radius: 8px;
            }

            #dashboard-mission-controls .button-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 9px;
            }

            #dashboard-mission-controls button {
                padding: 9px 14px;
                color: #dce8f2;
                background: #182838;
                border: 1px solid #40566b;
                border-radius: 5px;
                font-family: inherit;
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.5px;
                cursor: pointer;
            }

            #dashboard-mission-controls button:hover:not(:disabled) {
                background: #29435a;
                border-color: #7ca6c9;
            }

            #dashboard-mission-controls button:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }

            #dashboard-rover-viewport {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }

            #dashboard-rover-viewport canvas {
                display: block;
                width: 100%;
                height: 100%;
            }
        `;
        document.head.appendChild(style);
    }

    function log(message, type = "") {
        if (!systemLog) return;

        const entry = document.createElement("div");
        entry.className = "log-entry";

        const time = document.createElement("span");
        time.className = "log-time";
        time.textContent = new Date().toLocaleTimeString("en-GB", {
            hour12: false
        });

        const text = document.createElement("span");
        text.className = `log-message ${type}`;
        text.textContent = message;

        entry.append(time, text);
        systemLog.prepend(entry);
    }

    function setStatus(status) {
        if (roverStatus) {
            roverStatus.textContent = status;
            roverStatus.classList.toggle(
                "deployed",
                status === "RUNNING" || status === "PAUSED"
            );
        }

        const indicator = document.querySelector(".status-indicator");

        if (indicator) {
            const descriptions = {
                INITIALIZING: "Initializing simulation",
                READY: "Awaiting deployment",
                RUNNING: "Autonomous navigation active",
                PAUSED: "Mission paused",
                COMPLETED: "Mission completed",
                STOPPED: "Mission stopped",
                ERROR: "Simulation initialization failed"
            };

            indicator.textContent =
                descriptions[status] || "Simulation active";
        }

        const simState = document.querySelector("#sim-state");

        if (simState) {
            simState.textContent = status;
        }
    }

    function setButtonsReady(ready) {
        freshDeployButton.disabled = !ready;
        freshResetButton.disabled = initializing;

        freshDeployButton.classList.toggle(
            "button-disabled",
            !ready
        );
    }

    function createControlPanel() {
        // Remove any previous controller panel before creating a new one.
        controlPanel?.remove();

        controlPanel = document.createElement("div");
        controlPanel.id = "dashboard-mission-controls";

        controlPanel.innerHTML = `
            <div class="button-grid">
                <button id="start-btn" disabled>START</button>
                <button id="pause-btn" disabled>PAUSE</button>
                <button id="resume-btn" disabled>RESUME</button>
                <button id="stop-btn" disabled>STOP</button>
            </div>
        `;

        // Place controls directly below the 3D viewport.
        viewport.insertAdjacentElement("afterend", controlPanel);
    }

    function disposeCurrentSimulation() {
        controller?.dispose();
        controller = null;

        simulation?.dispose();
        simulation = null;

        controlPanel?.remove();
        controlPanel = null;

        window.autonomousController = null;
        window.simulation = null;

        initialized = false;
    }

    async function bootSimulation() {
        if (initializing || disposed) return;

        initializing = true;
        initialized = false;

        setButtonsReady(false);
        setStatus("INITIALIZING");

        try {
            createControlPanel();

            simulation = await createSimulation(simulationContainer);
            window.simulation = simulation;

            const payload = await integrateNavigation(simulation);

            controller = await createAutonomousController(
                simulation,
                payload
            );

            window.autonomousController = controller;

            initialized = true;

            freshDeployButton.innerHTML = "<span>▶</span> DEPLOY ROVER";
            freshDeployButton.classList.remove("button-disabled");

            setButtonsReady(true);
            setStatus("READY");

            if (viewBadge) {
                viewBadge.textContent = "3D LIVE";
            }

            log("3D lunar terrain initialized.", "success-text");
            log("Navigation route loaded.", "success-text");
            log("Autonomous rover ready for deployment.", "success-text");

            console.log("Dashboard simulation integration ready.");

        } catch (error) {
            console.error(
                "Dashboard simulation initialization failed:",
                error
            );

            setStatus("ERROR");
            log(
                `Simulation initialization failed: ${error.message}`,
                "warning-text"
            );

            disposeCurrentSimulation();
            setButtonsReady(false);

        } finally {
            initializing = false;
            freshResetButton.disabled = false;
        }
    }

    function deployRover() {
        if (!initialized || !controller || initializing || disposed) {
            return;
        }

        const snapshot = controller.getSnapshot();

        if (snapshot.controllerState !== "READY") {
            return;
        }

        controller.start();

        freshDeployButton.innerHTML = "<span>✓</span> ROVER DEPLOYED";
        freshDeployButton.classList.add("button-disabled");

        setStatus("RUNNING");

        log("Autonomous deployment initiated.", "success-text");
        log("Rover LP-R01 is now navigating.", "success-text");
    }

    async function resetRover() {
        if (initializing || disposed) return;

        initializing = true;
        setButtonsReady(false);

        log(
            "Resetting rover and reinitializing mission.",
            "warning-text"
        );

        // Dispose the old mission and its controls.
        disposeCurrentSimulation();

        freshDeployButton.innerHTML = "<span>▶</span> DEPLOY ROVER";
        freshDeployButton.classList.remove("button-disabled");

        if (distanceValue) {
            distanceValue.innerHTML = '0.00<span> km</span>';
        }

        setStatus("INITIALIZING");

        // IMPORTANT: Release the flag before calling bootSimulation().
        // bootSimulation sets it to true again when it starts.
        initializing = false;

        await bootSimulation();
    }

    function updateDashboard() {
        if (disposed) return;

        if (controller) {
            const snapshot = controller.getSnapshot();
            const mission = snapshot.mission;
            const status = snapshot.controllerState;

            setStatus(status);

            if (distanceValue && mission) {
                const distanceKm =
                    (mission.distanceTravelled || 0) / 1000;

                distanceValue.innerHTML =
                    `${distanceKm.toFixed(2)}<span> km</span>`;
            }

            if (status === "COMPLETED") {
                freshDeployButton.innerHTML = "MISSION COMPLETED";
                freshDeployButton.classList.add("button-disabled");
            }
        }

        animationFrame = requestAnimationFrame(updateDashboard);
    }

    function cleanup() {
        if (disposed) return;

        disposed = true;

        if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
        }

        disposeCurrentSimulation();

        window.removeEventListener("beforeunload", cleanup);
    }

    freshDeployButton.addEventListener("click", deployRover);
    freshResetButton.addEventListener("click", resetRover);

    window.addEventListener("beforeunload", cleanup);

    await bootSimulation();

    animationFrame = requestAnimationFrame(updateDashboard);

    return {
        deploy: deployRover,
        reset: resetRover,
        dispose: cleanup
    };
}

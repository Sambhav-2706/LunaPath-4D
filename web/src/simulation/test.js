
import { createSimulation } from "./index.js";

import {
    integrateNavigation,
    createAutonomousController
} from "./NavigationIntegration.js";

const container = document.querySelector("#simulation");

if (!container) {
    throw new Error("Simulation container #simulation was not found.");
}

async function start() {
    let simulation = null;
    let autonomousController = null;

    try {
        // Initialize the 3D environment.
        simulation = await createSimulation(container);

        window.simulation = simulation;

        console.log("LunaPath 3D simulation initialized.");

        // Generate and visualize the A* navigation route.
        const payload = await integrateNavigation(simulation);

        // Initialize mission execution and dynamic replanning.
        autonomousController = await createAutonomousController(
            simulation,
            payload
        );

        window.autonomousController = autonomousController;

        console.log("----------------------------------");
        console.log("LUNAPATH AUTONOMOUS SYSTEM READY");
        console.log("----------------------------------");
        console.log("Navigation mode:", payload.mode);
        console.log("Route nodes:", payload.pathNodes);
        console.log("Mission distance:", payload.totalDistanceMeters);
        console.log("Initial hazards:", payload.hazards.grid.length);
        console.log("Use the mission panel to control the rover.");
        console.log("Console access: window.autonomousController");

    } catch (error) {
        console.error("LunaPath initialization failed:", error);

        autonomousController?.dispose();
        simulation?.dispose();
    }
}

start();

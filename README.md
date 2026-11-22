# 🌕 LunaPath-4D — Autonomous Lunar Rover Simulation System

[![Live Demo on Vercel](https://img.shields.io/badge/Vercel-Live%20Simulation-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://lunapath-4d-iota.vercel.app)
[![Simulation Status](https://img.shields.io/badge/Simulation-Operational-51dfa0?style=for-the-badge)](https://lunapath-4d-iota.vercel.app)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL%203D-black?style=for-the-badge&logo=three.js)](https://lunapath-4d-iota.vercel.app)
[![VIT Bhopal](https://img.shields.io/badge/VIT%20Bhopal-Hackathon%202026-orange?style=for-the-badge)](https://lunapath-4d-iota.vercel.app)

> 🚀 **Live Production Deployment:** **[https://lunapath-4d-iota.vercel.app](https://lunapath-4d-iota.vercel.app)**  
> 📡 **Vercel Inspection Dashboard:** [https://vercel.com/ys9091729-8074/lunapath-4d](https://vercel.com/ys9091729-8074/lunapath-4d)

---

## Overview

**LunaPath-4D** is an autonomous lunar rover simulation and intelligent terrain navigation system built for lunar polar exploration (Lunar South Pole, -89.0° S, 0.0° E).

The platform fuses scientific planetary digital elevation modeling (DEM), multi-mode 4D path planning, dynamic obstacle avoidance, a photorealistic Three.js 3D environment, and a Mission Control dashboard featuring real-time telemetry, battery physics, and an instant side-by-side **Ghost Baseline Rover** benchmark.

---

## Architecture & Team Division

```
LunaPath-4D/
├── pipeline/                     # MEMBER 1: Terrain & Data Engineering
│   ├── terrain_generation.py     # Multi-scale Hermite gradient noise synthesis
│   ├── crater_generator.py       # Procedural impact crater morphometry & ejecta
│   ├── dem_manager.py            # Digital Elevation Model (DEM) & GeoTIFF I/O
│   ├── elevation_analysis.py     # Hypsometric elevation profiling & percentiles
│   ├── slope_analysis.py         # 2D Horn's gradient slope calculations (degrees)
│   ├── roughness_analysis.py     # Moving-window RMS height deviation (Rq)
│   ├── traversability_analysis.py# 4-tier safety classification & continuous A* cost
│   ├── terrain_exporter.py       # Zero-copy binary export & contract schemas
│   └── pipeline_orchestrator.py  # Master 8-stage pipeline orchestrator
├── web/
│   ├── navigation/               # MEMBER 3: Autonomous Navigation
│   │   ├── AStar.js              # 8-direction Octile distance A* pathfinder
│   │   ├── PathPlanner.js        # Terrain-aware route planning
│   │   ├── DynamicReplanner.js   # Real-time obstacle avoidance & mid-mission replanning
│   │   ├── CostFunction.js       # Slope & roughness navigation cost profiles
│   │   ├── NavigationModes.js    # BALANCED, SAFEST, FASTEST, ENERGY_EFFICIENT
│   │   ├── HazardDetection.js    # Collision detection & path verification
│   │   ├── RoverSimulator.js     # Continuous fractional rover physics
│   │   └── CoordinateAdapter.js  # Grid [0, 255] ↔ Three.js world [X, Z] translation
│   ├── src/                      # MEMBER 2 & 4: 3D Simulation & Mission Control
│   │   ├── TerrainRenderer.js    # 3D lunar terrain mesh with 5 scientific visualization modes
│   │   ├── RoverModel.js         # Procedural 6-wheel rocker-bogie rover + Ghost Rover
│   │   ├── LunarEnvironment.js   # Low-angle solar illumination & deep space starfield
│   │   ├── RouteVisualizer.js    # 3D route trajectory lines, pins & waypoint ribbons
│   │   ├── CameraController.js   # Follow-Rover, Orbit, Top-Down & Perspective views
│   │   ├── SimulationEngine.js   # Master state machine & real-time dual-rover orchestrator
│   │   ├── BatterySimulation.js  # Distance/slope/roughness physics energy model
│   │   ├── HealthMonitor.js      # Subsystem health diagnostics (Mobility, Nav, Power, Comms)
│   │   ├── TelemetryPanel.js     # Live telemetry data binding & benchmark counters
│   │   ├── MissionControls.js    # Interactive mission controls & operator CLI
│   │   ├── Minimap.js            # 2D Tactical radar minimap HUD with crater overlays
│   │   ├── MissionReport.js      # JSON export & mission report generator
│   │   └── main.js               # Application dashboard entry point
│   └── public/data/              # Binary datasets (dem.bin, slope.bin, rough.bin, traversability.bin)
└── vercel.json                   # Production deployment configuration & binary caching
```

---

## Key System Capabilities

### 1. Lunar Terrain & Data Engineering 
- **High-Resolution DEM**: 256 × 256 grid, 10 m/cell, 2.56 km × 2.56 km extent at Lunar South Pole (-89° S, 0° E).
- **Procedural Cratering**: Power-law Pareto distribution with parabolic depth profiles, rim uplifts, and Hermite ejecta blankets.
- **Surface Metrics**: Horn's slope gradient (0°–47°), RMS moving-window roughness (0.13 m–12.5 m), and 4-tier traversability classification.
- **Binary Array Serialization**: Zero-copy little-endian IEEE 754 float32 buffers for instant browser rendering.

### 2. 3D Simulation & Visualization 
- **Three.js Lunar Environment**: Photorealistic airless lunar sky, deep space starfield, and low-elevation directional polar sun casting realistic shadows.
- **Pragyan-Scale 3D Rover**: Chassis with gold insulation foil, tilted solar deck, stereo NavCam mast, dish antenna, and 6 individually articulated wheels rotating proportionally to odometry.
- **Dual-Rover Benchmark ("Ghost Car")**:
  - **LP-R01 Autonomous Rover**: Drives the intelligent, terrain-aware route detouring around hazards.
  - **LP-G00 Ghost Baseline Rover**: Translucent holographic rover running a naive slope-only path simultaneously, providing instant visual proof of obstacle avoidance.
- **5 Visualization Modes**:
  1. *Normal Regolith*: Photorealistic gray regolith with slope and micro-topography shading.
  2. *Elevation Hypsometric*: Spectral elevation color ramp from 37.6 m to 165.3 m.
  3. *Slope Heatmap*: Critical angle classification (Green <5°, Yellow 5–10°, Orange 10–15°, Red >15°).
  4. *Roughness RMS*: Surface variance (Cyan <1 m, Amber 1–3 m, Magenta >3 m).
  5. *Traversability Cost*: Navigational cost map from safe (green) to impassable obstacles (red).
- **Dynamic Camera Modes**:
  - `FOLLOW ROVER`: Smooth chase camera tracking behind the rover with mouse-wheel zoom.
  - `FOLLOW GHOST`: Chase camera locked onto the naive baseline rover.
  - `ORBIT`, `TARGET FOCUS`, `TOP-DOWN`, and `HORIZON`.
- **2D Tactical Radar Minimap HUD**: Live 210×210 px HUD showing topography, crater boundaries, real-time vehicle heading arrows, and route progression.

### 3. Autonomous Navigation 
- **Terrain-Aware A\* Pathfinding**: 8-neighbor Octile distance heuristic with multi-criteria cost weighting.
- **4 Navigation Modes**:
  - `BALANCED`: Optimal trade-off between traversal distance and mechanical effort.
  - `SAFEST`: Maximum slope and roughness avoidance for rover protection.
  - `FASTEST`: Shortest distance across passable terrain.
  - `ENERGY_EFFICIENT`: Prefers flat, smooth terrain to minimize watt-hour consumption.
- **Dynamic Replanning**: Autonomous hazard detection ahead of rover position triggering mid-mission route recalculation without restarting.

### 4. Mission Control Dashboard 
- **Real-Time Telemetry**: Live grid/world coordinates, elevation, slope, roughness, speed, heading, distance travelled, and progress.
- **Physics Energy Model**: Watt-hour consumption accounting for base avionics, rolling friction, gravitational climbing potential ($m \cdot g \cdot v \cdot \sin\theta$), and roughness penalties.
- **Subsystem Diagnostics**: Health monitoring for Mobility (rocker-bogie wear), Sensors (NavCam tilt), Power (battery/solar), and Communications (S-band RSSI).
- **Dual-Rover Benchmark Strip**: Live counters comparing autonomous route safety vs. naive baseline crater/slope hits.
- **Operator Console CLI**: Command input supporting `plan`, `deploy`, `start`, `pause`, `speed`, `mode`, `report`, and `help`.
- **Mission Reporting**: Complete JSON telemetry and event log export.

---

## Live Deployment & Quick Start

### 🌐 Access Live Simulation
The platform is deployed live on Vercel:
👉 **[https://lunapath-4d-iota.vercel.app](https://lunapath-4d-iota.vercel.app)**

### 💻 Local Development

#### Using One-Click Launchers
- **Windows**: Double-click `run.bat` or run `.\run.ps1`
- **Cross-Platform**: Run `python run.py dev`

#### Manual Setup
```bash
# 1. Clone repository
git clone https://github.com/Sambhav-2706/LunaPath-4D.git
cd LunaPath-4D

# 2. Install dependencies & run frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Verification & Testing

| Test Suite | Coverage | Status |
|------------|----------|--------|
| **Python Pipeline Suite** | 69 Unit & Integration Tests (DEM, craters, slope, roughness, traversability, schema contracts) | ✅ 69/69 PASSED (100%) |
| **Navigation Test Suite** | A\* Edge Cases, Path Planner, Hazard Detection, Dynamic Replanner, Continuous Mission Controller | ✅ ALL PASSED |
| **Frontend Production Build** | Vite production compilation & asset bundling | ✅ ZERO ERRORS (300ms) |
| **Vercel Deployment** | Production build, static binary datasets, SPA routing | ✅ LIVE ON VERCEL |

---



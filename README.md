
# LunaPath-4D

A lunar rover simulator focused on terrain analysis, autonomous navigation,
hazard detection, path planning, and rover mission simulation.

## Project Overview

LunaPath-4D aims to simulate an autonomous rover navigating a synthetic
lunar terrain using terrain elevation analysis and intelligent route planning.

## Current Features

- Mission Control dashboard
- Rover deployment and reset interface
- Synthetic lunar Digital Elevation Model (DEM)
- Procedural crater generation
- Terrain data export
- Elevation metadata

## Technology Stack

### Frontend
- JavaScript
- Vite
- Three.js

### Terrain Processing
- Python
- NumPy
- Matplotlib

## Project Structure

LunaPath-4D/
├── pipeline/
├── web/
└── README.md

## Current Terrain

- Grid: 256 × 256
- Cell size: 10 metres
- Terrain source: Synthetic
- Craters: 18
- Random seed: 42

## Setup

### Python

Create a virtual environment:

    python -m venv .venv

Activate on Windows:

    .\.venv\Scripts\Activate.ps1

Install dependencies:

    python -m pip install numpy matplotlib

Generate terrain:

    python pipeline/synthetic_terrain.py

### Web Application

Navigate to web:

    cd web

Install dependencies:

    npm install

Start development server:

    npm run dev

## Team Collaboration

- Create a feature branch before working.
- Commit meaningful changes.
- Push your branch to GitHub.
- Submit a Pull Request for review.
- Avoid committing directly to main.

## Disclaimer

The current lunar terrain is synthetically generated.
It does not represent real lunar elevation data.


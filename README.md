
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
- Procedural crater generation (power-law distribution & realistic morphometry)
- Hypsometric elevation analysis & vertical relief profiling
- 2D slope analysis (Horn's gradient method with critical angle classification)
- Terrain surface roughness analysis (moving-window RMS height deviation)
- Terrain traversability cost mapping with rover clearance safety dilation
- Structured hazard cataloging (`hazards.json`)
- High-performance binary array exports for Three.js frontend (`dem.bin`, `slope.bin`, `rough.bin`, `traversability.bin`)

## Technology Stack

### Frontend
- JavaScript
- Vite
- Three.js

### Terrain & Data Engineering Pipeline
- Python (3.10+)
- NumPy (Vectorized array mathematics)
- SciPy (`scipy.ndimage` spatial filtering)
- Matplotlib (Scientific plotting & 3D visualization)
- Rasterio (GDAL geospatial raster I/O)
- Pytest (Automated test suite)

## Project Structure

```
LunaPath-4D/
├── docs/
│   └── TERRAIN_ENGINEERING_GUIDE.md  # Complete technical documentation for Member 1
├── pipeline/                         # Member 1: Terrain & Data Engineering Module
│   ├── config.py                     # Central configuration, physical limits & seeds
│   ├── terrain_generation.py         # Multi-scale Hermite gradient noise & base synthesis
│   ├── crater_generator.py           # Procedural crater morphometry, Pareto & ejecta decay
│   ├── dem_manager.py                # DigitalElevationModel object, validation & GeoTIFF I/O
│   ├── elevation_analysis.py         # Hypsometric elevation distribution & vertical relief
│   ├── slope_analysis.py             # 2D Horn's gradient slope calculations in degrees
│   ├── roughness_analysis.py         # Moving-window RMS height deviation (Rq) with mean-shifting
│   ├── traversability_analysis.py    # 4-tier safety classification & continuous A* cost mapping
│   ├── terrain_visualizer.py         # Scientific 2D heatmaps & 3D surface mesh visualization
│   ├── terrain_exporter.py           # Zero-copy binary export & versioned contract serialization
│   ├── pipeline_orchestrator.py      # Master unified execution pipeline (Stages 1 through 8)
│   ├── benchmark_performance.py      # Multi-resolution execution profiling (256, 512, 1024)
│   ├── test_comprehensive_suite.py   # Comprehensive automated test suite (20 tests)
│   └── test_*.py                     # Modular pytest test suites (69 tests total)
├── web/
│   ├── public/data/
│   │   ├── dem.bin                   # Raw binary float32 elevation array
│   │   ├── slope.bin                 # Raw binary float32 slope array (degrees)
│   │   ├── rough.bin                 # Raw binary float32 roughness array (meters)
│   │   ├── traversability.bin        # Raw binary uint8 classified array (0=Safe..3=Unsafe)
│   │   ├── dem.tif                   # Geospatial GeoTIFF elevation raster
│   │   ├── dem.npy                   # NumPy serialized elevation array
│   │   ├── meta.json                 # Comprehensive versioned (v2.0.0) contract schema
│   │   ├── terrain_meta.json         # Backward-compatible metadata contract
│   │   ├── hazards.json              # Catalog of discrete obstacles & crater coordinates
│   │   ├── terrain_preview.png       # 2D preview heatmap
│   │   └── terrain_analysis.png      # Multi-layer terrain analysis overview
│   └── src/
│       ├── terrainLoader.js
│       └── main.js
├── requirements.txt                  # Python dependencies
└── README.md
```

## Current Terrain

- Grid: 256 × 256 (65,536 cells)
- Cell size: 10 metres (2.56 km × 2.56 km terrain extent)
- Terrain source: Synthetic lunar polar terrain (multi-octave fBm synthesis)
- Base elevation: 120.0 m (Elevation span: ~68 m to 158 m, Relief: ~90 m)
- Impact craters: 26 cataloged craters (power-law distribution)
- Cataloged hazards: 30 (impact craters + steep cliffs/ridges)
- Rover slope limit: 15° (Pragyan / Chandrayaan-3 standard)
- Passable terrain: ~91% navigable surface
- Random seed: 42

## Setup

### Python

Create a virtual environment:

    python -m venv .venv

Activate on Windows:

    .\.venv\Scripts\Activate.ps1

Install dependencies:

    pip install -r requirements.txt

Generate terrain & run unified 8-stage pipeline:

    python pipeline/pipeline_orchestrator.py

Run full automated test suite (69 tests):

    pytest -v pipeline/

Run performance benchmarks (256x256, 512x512, 1024x1024):

    python pipeline/benchmark_performance.py

> For complete mathematical documentation, equations, coordinate contracts, and loading guides for Members 2 and 3, refer to [TERRAIN_ENGINEERING_GUIDE.md](docs/TERRAIN_ENGINEERING_GUIDE.md).

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


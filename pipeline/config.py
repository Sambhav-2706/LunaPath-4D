"""
LunaPath-4D: Central Configuration & Parameters
Defines spatial parameters, rover constraints, crater classification, and filesystem paths.
"""

from pathlib import Path

# Reproducibility
SEED = 42

# Spatial Grid Dimensions
WIDTH = 256
HEIGHT = 256
GRID_SHAPE = (HEIGHT, WIDTH)
TOTAL_CELLS = WIDTH * HEIGHT

# Metric Scaling & Units
CELL_SIZE_METERS = 10.0           # 10m per cell -> 2560m x 2560m region
GRID_WIDTH_METERS = WIDTH * CELL_SIZE_METERS
GRID_HEIGHT_METERS = HEIGHT * CELL_SIZE_METERS
BASE_ELEVATION = 120.0            # Baseline reference elevation in meters
ELEVATION_UNITS = "meters"

# Coordinate System & Conventions
COORDINATE_SYSTEM = "Lunar Topocentric Cartesian (South Pole Stereographic Anchor)"
ORIGIN_LATITUDE_DEG = -89.0
ORIGIN_LONGITUDE_DEG = 0.0
LUNAR_REGION = "Lunar South Pole"
ROW_AXIS_CONVENTION = "Row index i: South to North (+Y, Northing, range 0 to HEIGHT-1)"
COL_AXIS_CONVENTION = "Column index j: West to East (+X, Easting, range 0 to WIDTH-1)"

# Crater Size Tiers (in grid cells)
# At 10m/cell:
# - Small:  3.0 to 7.0 cells  (30m to 70m diameter)
# - Medium: 7.0 to 14.0 cells (70m to 140m diameter)
# - Large: 14.0 to 22.0 cells (140m to 220m diameter)
CRATER_SMALL_RADIUS_RANGE = (3.2, 7.0)
CRATER_MEDIUM_RADIUS_RANGE = (7.0, 14.0)
CRATER_LARGE_RADIUS_RANGE = (14.0, 22.0)

DEFAULT_LARGE_CRATERS = 3
DEFAULT_MEDIUM_CRATERS = 7
DEFAULT_SMALL_CRATERS = 18
DEFAULT_TOTAL_CRATERS = DEFAULT_LARGE_CRATERS + DEFAULT_MEDIUM_CRATERS + DEFAULT_SMALL_CRATERS  # 28

# Crater Geometric Ratios (Empirical Lunar Morphometry)
DEFAULT_DEPTH_TO_DIAMETER = 0.18    # Bowl depth ~ 18% of rim diameter
DEFAULT_RIM_TO_DIAMETER = 0.045     # Rim uplift ~ 4.5% of rim diameter
CRATER_ASYMMETRY_FACTOR = 0.12      # Non-circular harmonic distortion magnitude

# Rover Operational Constraints (Pragyan / Chandrayaan-3 & LUPEX baseline)
ROVER_CLASS = "Pragyan / Chandrayaan-3 Scale"
ROVER_MASS_KG = 26.0
ROVER_WHEEL_COUNT = 6
MAX_SAFE_SLOPE_DEG = 15.0         # Critical slope limit for rover climbing
CRITICAL_ROUGHNESS_M = 3.0        # Extreme roughness threshold
ROVER_SAFETY_MARGIN_CELLS = 1     # Safety inflation margin around obstacles
ROVER_NOMINAL_SPEED_MPS = 0.02    # Design speed ~2 cm/s (accelerated for simulation)

# Directory Paths
PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
DATA_DIR = PROJECT_ROOT / "web" / "public" / "data"

# Ensure data directory exists
DATA_DIR.mkdir(parents=True, exist_ok=True)

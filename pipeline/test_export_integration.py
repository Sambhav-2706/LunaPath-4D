"""
Integration & Data Contract Test Suite for LunaPath-4D (Member 1)
Tests & Verifies:
1. Complete metadata contract schema (version 1.0.0, required fields, definitions).
2. Binary array integrity, byte sizes, and consistent dimensions across all exported layers.
3. Perfect bitwise round-trip preservation without dimensional alteration or precision loss.
4. Member 2 Coordinate System & Three.js 3D world transformations (forward & inverse).
5. Member 3 Navigation Planner data access & cost lookup integration.
"""

import sys
import json
from pathlib import Path
import numpy as np

PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.config import (
    DATA_DIR,
    WIDTH,
    HEIGHT,
    CELL_SIZE_METERS,
    MAX_SAFE_SLOPE_DEG,
    CRITICAL_ROUGHNESS_M
)


def test_metadata_schema_contract():
    """Verify that metadata JSON includes all required fields, units, and versioning."""
    meta_path = DATA_DIR / "terrain_meta.json"
    alias_path = DATA_DIR / "meta.json"

    assert meta_path.exists(), f"Missing {meta_path}"
    assert alias_path.exists(), f"Missing {alias_path}"

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    # 1. Versioning
    assert "schema_version" in meta, "Missing schema_version in metadata"
    assert meta["schema_version"] == "1.0.0"

    # 2. Required Grid & Spacing Properties
    required_grid_keys = [
        "grid_width",
        "grid_height",
        "horizontal_cell_spacing",
        "elevation_units",
        "slope_units",
        "roughness_definition",
        "roughness_units",
        "coordinate_convention",
        "array_orientation",
        "data_types",
        "nodata_representation",
        "export_format"
    ]
    for key in required_grid_keys:
        assert key in meta, f"Required metadata property '{key}' is missing from metadata contract!"

    assert meta["grid_width"] == WIDTH
    assert meta["grid_height"] == HEIGHT
    assert meta["horizontal_cell_spacing"] == CELL_SIZE_METERS
    assert meta["elevation_units"] == "meters"
    assert meta["slope_units"] == "degrees"
    assert meta["roughness_units"] == "meters"

    # 3. Cross-module integration sections
    assert "three_js_coordinate_transform" in meta, "Missing three_js_coordinate_transform contract for Member 2"
    assert "navigation_planner_contract" in meta, "Missing navigation_planner_contract for Member 3"

    print("PASS: test_metadata_schema_contract (All 12 required fields and version 1.0.0 confirmed)")


def test_binary_arrays_integrity_and_dimensions():
    """Verify all binary array files exist, match exact dimensions, and maintain float32 precision."""
    expected_cells = WIDTH * HEIGHT
    expected_bytes = expected_cells * 4  # 4 bytes per float32

    binary_files = {
        "dem.bin": (30.0, 180.0),            # Elevation in meters
        "slope.bin": (0.0, 90.0),             # Slope in degrees
        "rough.bin": (0.0, 25.0),             # RMS roughness in meters
        "traversability.bin": (0.0, 1.0),     # Continuous normalized cost
        "traversability_classified.bin": (0.0, 3.0)  # Discrete safety tiers 0 to 3
    }

    for filename, (val_min, val_max) in binary_files.items():
        filepath = DATA_DIR / filename
        assert filepath.exists(), f"File {filepath} does not exist!"

        file_size = filepath.stat().st_size
        assert file_size == expected_bytes, (
            f"{filename} file size mismatch: expected {expected_bytes} bytes ({WIDTH}x{HEIGHT}x4), "
            f"got {file_size} bytes."
        )

        # Load as float32 little-endian
        data = np.fromfile(filepath, dtype="<f4")
        assert len(data) == expected_cells, f"Expected {expected_cells} elements, got {len(data)}"

        # Reshape to 2D
        grid = data.reshape((HEIGHT, WIDTH))
        assert grid.shape == (HEIGHT, WIDTH), f"Grid shape mismatch for {filename}: {grid.shape}"

        # Numerical bounds check
        actual_min = float(np.min(grid))
        actual_max = float(np.max(grid))
        assert not np.any(np.isnan(grid)), f"{filename} contains unhandled NaN values!"
        assert not np.any(np.isinf(grid)), f"{filename} contains Infinite values!"
        assert actual_min >= val_min - 1.0, f"{filename} minimum {actual_min} below expected {val_min}"
        assert actual_max <= val_max + 1.0, f"{filename} maximum {actual_max} exceeds expected {val_max}"

        print(f"      ✓ {filename:<30}: {file_size} bytes, shape {grid.shape}, range [{actual_min:.2f}, {actual_max:.2f}]")

    print("PASS: test_binary_arrays_integrity_and_dimensions (All 5 binary buffers validated)")


def test_roundtrip_precision_preservation():
    """Verify that reading from exported binary buffers reproduces exact original values."""
    # Compare dem.bin against dem.npy (reference copy)
    npy_path = DATA_DIR / "dem.npy"
    bin_path = DATA_DIR / "dem.bin"

    assert npy_path.exists() and bin_path.exists()

    dem_reference = np.load(npy_path)
    dem_from_bin = np.fromfile(bin_path, dtype="<f4").reshape((HEIGHT, WIDTH))

    assert dem_reference.shape == dem_from_bin.shape
    # Check bitwise floating point equality
    assert np.array_equal(dem_reference, dem_from_bin), "Binary DEM does not match reference NumPy array!"
    max_delta = np.max(np.abs(dem_reference - dem_from_bin))
    assert max_delta == 0.0, f"Round-trip precision delta is non-zero: {max_delta}"

    print(f"PASS: test_roundtrip_precision_preservation (Zero loss round-trip, max delta = {max_delta})")


def test_member2_threejs_coordinate_transforms():
    """Verify coordinate transformation equations for Member 2's Three.js rendering."""
    # Load metadata
    with open(DATA_DIR / "terrain_meta.json", "r") as f:
        meta = json.load(f)

    cell_size = meta["cell_size_meters"]
    width = meta["width"]
    height = meta["height"]
    base_elevation = meta.get("base_elevation_meters", 120.0)

    # Coordinate transformation formulas:
    # Three.js uses Right-Handed coordinates:
    # +X: East, +Y: Up (Elevation), +Z: South (towards viewer)
    def grid_to_threejs(row, col, elev, vert_exag=1.0):
        world_x = col * cell_size - (width - 1) * cell_size / 2.0
        world_y = (elev - base_elevation) * vert_exag
        world_z = -(row * cell_size - (height - 1) * cell_size / 2.0)
        return world_x, world_y, world_z

    def threejs_to_grid(world_x, world_z):
        col = (world_x + (width - 1) * cell_size / 2.0) / cell_size
        row = (-world_z + (height - 1) * cell_size / 2.0) / cell_size
        return int(round(row)), int(round(col))

    # Test center point
    c_row, c_col = 127.5, 127.5
    wx, wy, wz = grid_to_threejs(c_row, c_col, 120.0)
    assert abs(wx) < 1e-4 and abs(wz) < 1e-4, f"Center of terrain must map to world origin (0, 0), got ({wx}, {wz})"

    # Test roundtrip for corners
    test_corners = [(0, 0), (0, 255), (255, 0), (255, 255), (64, 128)]
    for r, c in test_corners:
        wx, wy, wz = grid_to_threejs(r, c, 135.0)
        r_rec, c_rec = threejs_to_grid(wx, wz)
        assert r == r_rec and c == c_rec, f"Coordinate mismatch for corner ({r}, {c}) -> ({r_rec}, {c_rec})"

    print("PASS: test_member2_threejs_coordinate_transforms (Three.js world transforms validated)")


def test_member3_navigation_planner_access():
    """Verify that Member 3 can cleanly index and query traversability costs for A* pathfinding."""
    trav_grid = np.fromfile(DATA_DIR / "traversability.bin", dtype="<f4").reshape((HEIGHT, WIDTH))
    class_grid = np.fromfile(DATA_DIR / "traversability_classified.bin", dtype="<f4").reshape((HEIGHT, WIDTH))

    # Flat index formula: index = row * width + col
    # Query cell (100, 100)
    row, col = 100, 100
    flat_idx = row * WIDTH + col
    cost_direct = trav_grid[row, col]
    cost_flat = trav_grid.flat[flat_idx]
    assert cost_direct == cost_flat, "Flat indexing mismatch!"

    # Neighbor expansion simulation (8-connectivity)
    neighbors = [
        (row - 1, col), (row + 1, col),
        (row, col - 1), (row, col + 1),
        (row - 1, col - 1), (row - 1, col + 1),
        (row + 1, col - 1), (row + 1, col + 1)
    ]
    for nr, nc in neighbors:
        assert 0 <= nr < HEIGHT and 0 <= nc < WIDTH
        cost = trav_grid[nr, nc]
        tier = class_grid[nr, nc]
        assert 0.0 <= cost <= 1.0, f"Cost {cost} out of bounds at neighbor ({nr}, {nc})"
        assert tier in [0, 1, 2, 3], f"Invalid tier {tier} at neighbor ({nr}, {nc})"

    print("PASS: test_member3_navigation_planner_access (8-connected neighbor cost queries validated)")


if __name__ == "__main__":
    print("=" * 65)
    print("RUNNING EXPORT & CROSS-MODULE INTEGRATION TEST SUITE")
    print("=" * 65)
    test_metadata_schema_contract()
    test_binary_arrays_integrity_and_dimensions()
    test_roundtrip_precision_preservation()
    test_member2_threejs_coordinate_transforms()
    test_member3_navigation_planner_access()
    print("=" * 65)
    print("ALL INTEGRATION AND DATA CONTRACT TESTS PASSED!")
    print("=" * 65)

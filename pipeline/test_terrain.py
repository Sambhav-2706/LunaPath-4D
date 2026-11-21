"""
Unit & Integration Tests for Member 1: Terrain & Data Engineering
Validates data contracts, binary array integrity, numerical bounds, and file generation.
"""

import json
from pathlib import Path
import numpy as np

DATA_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "data"

EXPECTED_WIDTH = 256
EXPECTED_HEIGHT = 256
EXPECTED_BYTES = EXPECTED_WIDTH * EXPECTED_HEIGHT * 4  # 262,144 bytes for float32


def test_file_existence():
    expected_files = [
        "dem.bin",
        "slope.bin",
        "rough.bin",
        "traversability.bin",
        "dem.npy",
        "terrain_meta.json",
        "meta.json",
        "hazards.json",
        "terrain_preview.png",
        "terrain_analysis.png"
    ]
    for filename in expected_files:
        path = DATA_DIR / filename
        assert path.exists(), f"Missing required file: {filename}"
        assert path.stat().st_size > 0, f"File is empty: {filename}"
    print("PASS: All required contract files exist and are non-empty.")


def test_binary_shapes_and_types():
    bin_files = {
        "dem.bin": (25.0, 200.0),       # Elevation in meters (craters depress down to ~37m)
        "slope.bin": (0.0, 90.0),       # Slope in degrees
        "rough.bin": (0.0, 50.0),       # Roughness in meters
        "traversability.bin": (0.0, 1.0) # Traversability index [0, 1]
    }

    for filename, (min_val, max_val) in bin_files.items():
        path = DATA_DIR / filename
        size = path.stat().st_size
        assert size == EXPECTED_BYTES, (
            f"{filename} size mismatch: got {size} bytes, expected {EXPECTED_BYTES}"
        )

        arr = np.fromfile(path, dtype="<f4").reshape((EXPECTED_HEIGHT, EXPECTED_WIDTH))
        assert not np.isnan(arr).any(), f"{filename} contains NaN values"
        assert not np.isinf(arr).any(), f"{filename} contains Infinite values"
        assert np.min(arr) >= min_val - 1e-4, f"{filename} min below bound: {np.min(arr)} < {min_val}"
        assert np.max(arr) <= max_val + 1e-4, f"{filename} max above bound: {np.max(arr)} > {max_val}"

    print("PASS: Binary grids have exact 256x256 shape, float32 type, and valid bounds.")


def test_metadata_contract():
    meta_path = DATA_DIR / "terrain_meta.json"
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    assert meta["width"] == EXPECTED_WIDTH
    assert meta["height"] == EXPECTED_HEIGHT
    assert meta["cell_size_meters"] == 10.0
    assert "elevation_analysis" in meta
    assert "slope_analysis" in meta
    assert "roughness_analysis" in meta
    assert "traversability_summary" in meta
    assert "rover_parameters" in meta
    assert meta["crater_count"] > 0
    assert len(meta["craters"]) == meta["crater_count"]

    print("PASS: Metadata JSON satisfies all schema requirements.")


def test_hazard_catalog():
    hazards_path = DATA_DIR / "hazards.json"
    with open(hazards_path, "r", encoding="utf-8") as f:
        hazards = json.load(f)

    assert isinstance(hazards, list)
    assert len(hazards) > 0

    for h in hazards:
        assert "id" in h
        assert "type" in h
        assert "x" in h or "x_cell" in h
        assert "y" in h or "y_cell" in h
        assert "radius_meters" in h
        assert "known_from_orbit" in h
        assert isinstance(h["known_from_orbit"], bool)

    print("PASS: Hazard catalog is fully populated with validated fields.")


if __name__ == "__main__":
    print("\nRunning Member 1 Test Suite...")
    test_file_existence()
    test_binary_shapes_and_types()
    test_metadata_contract()
    test_hazard_catalog()
    print("ALL TESTS PASSED SUCCESSFULLY!\n")

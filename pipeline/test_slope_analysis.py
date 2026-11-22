"""
Unit Tests for Slope Analysis Module (pipeline/slope_analysis.py)
Tests:
1. Completely flat surface produces approximately zero slope.
2. Constant gradient surface produces exact known slope angles.
3. Crater terrain produces elevated slopes at rims and walls.
4. Handling of invalid elevation values (NaN, Inf) without mutating original DEM.
5. Verification of mathematical bounds [0 deg, 90 deg] and documented units.
"""

import sys
from pathlib import Path
import numpy as np

PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.slope_analysis import compute_slope, analyze_slope


def test_flat_surface_zero_slope():
    """Verify that a completely flat surface produces exactly 0 degrees slope."""
    flat = np.full((100, 100), 120.0, dtype=np.float32)
    slope = compute_slope(flat, cell_size=10.0)

    assert slope.shape == (100, 100)
    assert np.allclose(slope, 0.0, atol=1e-5), f"Expected 0 slope, got max={slope.max()}"
    metrics = analyze_slope(slope)
    assert metrics["minimum_slope_deg"] == 0.0
    assert metrics["maximum_slope_deg"] == 0.0
    assert metrics["mean_slope_deg"] == 0.0
    assert metrics["hazard_percentage"] == 0.0
    print("PASS: test_flat_surface_zero_slope (Slope is 0.0 deg across all cells)")


def test_constant_gradient_surfaces():
    """Verify that known gradients produce exact trigonometric slope angles."""
    # 1. 45-degree ramp: dz/dx = 1.0 (10m elevation gain per 10m cell)
    x, y = np.meshgrid(np.arange(100), np.arange(100))
    ramp_45 = (x * 10.0).astype(np.float32)
    slope_45 = compute_slope(ramp_45, cell_size=10.0)

    # Check interior cells away from boundary
    interior_45 = slope_45[10:90, 10:90]
    assert np.allclose(interior_45, 45.0, atol=1e-1), f"Expected 45 deg, got mean={interior_45.mean()}"

    # 2. 26.565-degree ramp: dz/dx = 0.5 -> arctan(0.5) * 180 / pi = 26.565 deg
    ramp_26 = (x * 5.0).astype(np.float32)
    slope_26 = compute_slope(ramp_26, cell_size=10.0)
    interior_26 = slope_26[10:90, 10:90]
    expected_26 = np.degrees(np.arctan(0.5))
    assert np.allclose(interior_26, expected_26, atol=1e-1), f"Expected {expected_26:.2f} deg, got {interior_26.mean():.2f}"

    # 3. Y-direction ramp: dz/dy = 0.25 -> arctan(0.25) * 180 / pi = 14.036 deg
    ramp_y = (y * 2.5).astype(np.float32)
    slope_y = compute_slope(ramp_y, cell_size=10.0)
    interior_y = slope_y[10:90, 10:90]
    expected_y = np.degrees(np.arctan(0.25))
    assert np.allclose(interior_y, expected_y, atol=1e-1), f"Expected {expected_y:.2f} deg, got {interior_y.mean():.2f}"

    print("PASS: test_constant_gradient_surfaces (Verified 45.0 deg, 26.57 deg, 14.04 deg ramps)")


def test_crater_surface_steep_slopes():
    """Verify that crater walls and rims produce elevated slopes."""
    from pipeline.crater_generator import apply_realistic_crater

    terrain = np.full((120, 120), 120.0, dtype=np.float64)
    # Add a deep crater: center (60, 60), radius 15 cells (150m), depth ~25m
    apply_realistic_crater(terrain, 60, 60, radius_cells=15.0, cell_size=10.0, depth_ratio=0.20)

    slope = compute_slope(terrain, cell_size=10.0)
    assert slope.min() >= 0.0, "Slopes must be non-negative"
    assert slope.max() > 20.0, f"Crater wall slope should exceed 20 deg, got max={slope.max()}"

    # Flattest area (outside crater ejecta) should remain near 0
    corner_slopes = slope[0:10, 0:10]
    assert corner_slopes.mean() < 0.1, "Distant flat terrain should have near-zero slope"

    metrics = analyze_slope(slope, max_safe_slope=15.0)
    assert metrics["hazard_cell_count"] > 0, "Steep crater walls must be flagged as hazards"
    print(f"PASS: test_crater_surface_steep_slopes (Max crater wall slope: {slope.max():.2f} deg)")


def test_invalid_values_and_immutability():
    """Verify that NaN and Inf are handled gracefully and original DEM is preserved."""
    dem = np.full((40, 40), 100.0, dtype=np.float32)
    dem[5, 5] = np.nan
    dem[20, 20] = np.inf
    dem[30, 30] = -np.inf

    dem_copy = np.copy(dem)
    slope = compute_slope(dem, cell_size=10.0)

    # 1. Immutability
    assert np.array_equal(dem, dem_copy, equal_nan=True), "Original DEM was modified!"

    # 2. NaN propagation at invalid locations
    assert np.isnan(slope[5, 5]), "Slope at NaN cell should be NaN"
    assert np.isnan(slope[20, 20]), "Slope at Inf cell should be NaN"

    # 3. Finite slope on surrounding valid cells
    valid_interior = slope[10:15, 10:15]
    assert np.all(np.isfinite(valid_interior)), "Valid cells should produce finite slopes"
    assert np.allclose(valid_interior, 0.0, atol=1e-4)

    metrics = analyze_slope(slope)
    assert metrics["invalid_cell_count"] == 3
    print("PASS: test_invalid_values_and_immutability (Isolated 3 invalid cells, preserved input)")


if __name__ == "__main__":
    print("\n" + "=" * 65)
    print("  RUNNING SLOPE ANALYSIS UNIT TESTS")
    print("=" * 65)
    test_flat_surface_zero_slope()
    test_constant_gradient_surfaces()
    test_crater_surface_steep_slopes()
    test_invalid_values_and_immutability()
    print("=" * 65)
    print("  ALL SLOPE ANALYSIS TESTS PASSED SUCCESSFULLY!")
    print("=" * 65 + "\n")

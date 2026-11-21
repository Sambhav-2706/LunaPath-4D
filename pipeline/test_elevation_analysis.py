"""
Unit Tests for Elevation Analysis Module (Known Sample Arrays & Integrity)
Tests:
1. Minimum elevation calculation on known arrays.
2. Maximum elevation calculation on known arrays.
3. Mean elevation calculation on known arrays.
4. Median elevation calculation on known arrays.
5. Standard deviation calculation on known arrays.
6. Elevation range (relief) calculation on known arrays.
7. Elevation distribution and percentiles on known arrays.
8. Handling of invalid DEM values (NaN, Inf) without mutating original array.
9. Immutability verification.
10. Correct reporting of physical units.
"""

import sys
from pathlib import Path
import numpy as np

PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.elevation_analysis import (
    calculate_elevation_metrics,
    calculate_elevation_distribution,
    calculate_hypsometry,
    extract_valid_elevations
)


def test_constant_elevation_array():
    """Test on a constant elevation grid: mean=val, std=0, range=0."""
    known_val = 150.0
    arr = np.full((50, 50), known_val, dtype=np.float32)

    metrics = calculate_elevation_metrics(arr)
    assert metrics["minimum_elevation_m"] == known_val
    assert metrics["maximum_elevation_m"] == known_val
    assert metrics["mean_elevation_m"] == known_val
    assert metrics["median_elevation_m"] == known_val
    assert metrics["standard_deviation_m"] == 0.0
    assert metrics["elevation_range_m"] == 0.0
    assert metrics["units"] == "meters"
    print("PASS: test_constant_elevation_array")


def test_linear_ramp_array():
    """Test on a known linear sequence: [1.0, 2.0, ..., 100.0]."""
    known_seq = np.linspace(1.0, 100.0, 100, dtype=np.float64).reshape((10, 10))

    metrics = calculate_elevation_metrics(known_seq)
    assert metrics["minimum_elevation_m"] == 1.0
    assert metrics["maximum_elevation_m"] == 100.0
    assert abs(metrics["mean_elevation_m"] - 50.5) < 1e-9
    assert abs(metrics["median_elevation_m"] - 50.5) < 1e-9
    assert metrics["elevation_range_m"] == 99.0

    # Theoretical population standard deviation of uniform grid [1, 100]
    expected_std = np.std(np.linspace(1.0, 100.0, 100))
    assert abs(metrics["standard_deviation_m"] - expected_std) < 1e-9
    print("PASS: test_linear_ramp_array")


def test_elevation_distribution_and_percentiles():
    """Test histogram binning, CDF, and percentile monotonicity on known distribution."""
    arr = np.linspace(50.0, 150.0, 1000)
    dist = calculate_elevation_distribution(arr, num_bins=20)

    assert dist["num_bins"] == 20
    assert len(dist["bin_edges_m"]) == 21
    assert len(dist["histogram_counts"]) == 20
    assert sum(dist["histogram_counts"]) == 1000
    assert abs(dist["cumulative_density"][-1] - 1.0) < 1e-6

    p = dist["percentiles_m"]
    # Monotonically increasing percentiles
    assert p["p01"] <= p["p05"] <= p["p10"] <= p["p25"] <= p["p50"] <= p["p75"] <= p["p90"] <= p["p95"] <= p["p99"]
    assert abs(p["p50"] - 100.0) < 0.5
    print("PASS: test_elevation_distribution_and_percentiles")


def test_hypsometry_calculation():
    """Test hypsometric curve properties."""
    arr = np.linspace(100.0, 200.0, 500)
    hyps = calculate_hypsometry(arr, steps=50)

    assert len(hyps["relative_elevation"]) == 50
    assert len(hyps["fractional_area_above"]) == 50
    # At min elevation, 100% of area is above
    assert abs(hyps["fractional_area_above"][0] - 1.0) < 1e-6
    # Hypsometric curve must be monotonically non-increasing
    for i in range(len(hyps["fractional_area_above"]) - 1):
        assert hyps["fractional_area_above"][i] >= hyps["fractional_area_above"][i + 1] - 1e-6
    print("PASS: test_hypsometry_calculation")


def test_invalid_values_handling():
    """Verify that NaN and Inf values are cleanly ignored and reported without crashing."""
    arr = np.array([
        [100.0, 120.0, np.nan],
        [np.inf, 140.0, -np.inf],
        [160.0, 180.0, 200.0]
    ], dtype=np.float32)

    # 6 finite values: 100, 120, 140, 160, 180, 200
    metrics = calculate_elevation_metrics(arr)
    assert metrics["minimum_elevation_m"] == 100.0
    assert metrics["maximum_elevation_m"] == 200.0
    assert metrics["mean_elevation_m"] == 150.0
    assert metrics["median_elevation_m"] == 150.0
    assert metrics["elevation_range_m"] == 100.0
    assert metrics["invalid_cell_count"] == 3
    assert metrics["total_valid_cells"] == 6
    print("PASS: test_invalid_values_handling (Filtered 3 invalid cells accurately)")


def test_immutability_preservation():
    """Verify that original DEM is never mutated in place."""
    original_data = np.array([
        [100.0, 120.0, np.nan],
        [np.inf, 140.0, 160.0]
    ], dtype=np.float32)

    clone_data = np.copy(original_data)
    _ = calculate_elevation_metrics(original_data)
    _ = calculate_elevation_distribution(original_data)

    # Compare bitwise including NaN positions
    assert np.array_equal(original_data, clone_data, equal_nan=True), "Original DEM was mutated!"
    print("PASS: test_immutability_preservation (Original DEM strictly preserved)")


def test_all_invalid_array_raises_error():
    """Verify that an array with zero finite values raises ValueError."""
    all_nan = np.full((10, 10), np.nan)
    try:
        calculate_elevation_metrics(all_nan)
        assert False, "Expected ValueError was not raised for all-NaN array"
    except ValueError:
        pass
    print("PASS: test_all_invalid_array_raises_error")


if __name__ == "__main__":
    print("\n" + "=" * 65)
    print("  RUNNING ELEVATION ANALYSIS UNIT TESTS")
    print("=" * 65)
    test_constant_elevation_array()
    test_linear_ramp_array()
    test_elevation_distribution_and_percentiles()
    test_hypsometry_calculation()
    test_invalid_values_handling()
    test_immutability_preservation()
    test_all_invalid_array_raises_error()
    print("=" * 65)
    print("  ALL ELEVATION ANALYSIS TESTS PASSED SUCCESSFULLY!")
    print("=" * 65 + "\n")

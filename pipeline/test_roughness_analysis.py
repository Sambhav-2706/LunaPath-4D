"""
Unit Tests for Terrain Surface Roughness Module (pipeline/roughness_analysis.py)
Tests:
1. Flat terrain produces approximately zero roughness.
2. Slightly uneven terrain produces low roughness matching noise standard deviation.
3. Highly uneven terrain produces proportionally high roughness.
4. Crater terrain produces elevated roughness along crater rims and wall scarps.
5. Configurable neighborhood sizes (W=3, 5, 7).
6. Handling of invalid elevation values (NaN, Inf) without mutating input array.
7. Verification of documented units (meters).
"""

import sys
from pathlib import Path
import numpy as np

PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.roughness_analysis import compute_roughness, analyze_roughness


def test_flat_terrain_zero_roughness():
    """Verify that a flat surface has 0.0m roughness across all cells."""
    flat = np.full((60, 60), 120.0, dtype=np.float32)
    rough = compute_roughness(flat, window_size=5)

    assert rough.shape == (60, 60)
    assert np.allclose(rough, 0.0, atol=1e-5), f"Expected 0 roughness, got max={rough.max()}"
    metrics = analyze_roughness(rough)
    assert metrics["minimum_roughness_m"] == 0.0
    assert metrics["maximum_roughness_m"] == 0.0
    assert metrics["mean_roughness_m"] == 0.0
    assert metrics["rough_cell_count"] == 0
    assert metrics["units"] == "meters"
    print("PASS: test_flat_terrain_zero_roughness (Roughness is 0.0m everywhere)")


def test_uneven_terrain_scales():
    """Test slightly uneven and highly uneven surfaces against known noise standard deviations."""
    rng = np.random.default_rng(42)

    # 1. Slightly uneven terrain: Gaussian noise with sigma = 0.25m (smooth regolith)
    slight_noise = rng.normal(120.0, 0.25, (80, 80)).astype(np.float32)
    rough_slight = compute_roughness(slight_noise, window_size=5)
    mean_slight = float(rough_slight[10:70, 10:70].mean())
    # Expected local sample standard deviation of Gaussian white noise in a 5x5 window
    assert abs(mean_slight - 0.25) < 0.06, f"Expected ~0.25m, got {mean_slight:.3f}m"

    # 2. Highly uneven terrain: Gaussian noise with sigma = 3.5m (boulder field / rugged terrain)
    high_noise = rng.normal(120.0, 3.5, (80, 80)).astype(np.float32)
    rough_high = compute_roughness(high_noise, window_size=5)
    mean_high = float(rough_high[10:70, 10:70].mean())
    assert abs(mean_high - 3.5) < 0.6, f"Expected ~3.5m, got {mean_high:.3f}m"

    # High roughness must be significantly greater than slight roughness
    assert mean_high > mean_slight * 8.0, "High roughness must scale proportionally"
    print(f"PASS: test_uneven_terrain_scales (Slight: {mean_slight:.2f}m, High: {mean_high:.2f}m)")


def test_crater_terrain_roughness():
    """Verify that crater walls and rims produce elevated roughness compared to flat background."""
    from pipeline.crater_generator import apply_realistic_crater

    terrain = np.full((100, 100), 120.0, dtype=np.float64)
    apply_realistic_crater(terrain, 50, 50, radius_cells=12.0, cell_size=10.0, depth_ratio=0.20)

    rough = compute_roughness(terrain, window_size=5)

    # Center and distant corners should be smooth
    distant_rough = rough[0:10, 0:10].mean()
    assert distant_rough < 0.05, "Distant flat terrain must be smooth"

    # Crater rim / wall region should exhibit high roughness
    rim_region = rough[40:60, 40:60]
    assert rim_region.max() > 2.0, f"Crater rim should produce high roughness, got max={rim_region.max():.2f}m"
    print(f"PASS: test_crater_terrain_roughness (Crater peak roughness: {rim_region.max():.2f}m)")


def test_configurable_window_sizes():
    """Verify that window_size can be set to 3, 5, 7, and validates odd sizing >= 3."""
    rng = np.random.default_rng(77)
    terrain = rng.normal(100.0, 1.0, (50, 50)).astype(np.float32)

    for w in [3, 5, 7]:
        rough = compute_roughness(terrain, window_size=w)
        assert rough.shape == (50, 50)
        assert np.all(rough >= 0.0)

    # Even window size must raise ValueError
    try:
        compute_roughness(terrain, window_size=4)
        assert False, "Even window_size should raise ValueError"
    except ValueError:
        pass

    # Window size < 3 must raise ValueError
    try:
        compute_roughness(terrain, window_size=1)
        assert False, "Window size < 3 should raise ValueError"
    except ValueError:
        pass

    print("PASS: test_configurable_window_sizes (Tested W=3, 5, 7 and validation)")


def test_invalid_values_and_immutability():
    """Verify handling of NaNs/Infs and array immutability."""
    dem = np.full((30, 30), 100.0, dtype=np.float32)
    dem[5, 5] = np.nan
    dem[15, 15] = np.inf

    clone = np.copy(dem)
    rough = compute_roughness(dem, window_size=5)

    # 1. Immutability
    assert np.array_equal(dem, clone, equal_nan=True), "Original DEM was mutated!"

    # 2. NaN mask propagation
    assert np.isnan(rough[5, 5])
    assert np.isnan(rough[15, 15])

    # 3. Finite metrics on remaining
    metrics = analyze_roughness(rough)
    assert metrics["invalid_cell_count"] == 2
    print("PASS: test_invalid_values_and_immutability (Preserved original array, isolated NaNs)")


if __name__ == "__main__":
    print("\n" + "=" * 65)
    print("  RUNNING TERRAIN ROUGHNESS UNIT TESTS")
    print("=" * 65)
    test_flat_terrain_zero_roughness()
    test_uneven_terrain_scales()
    test_crater_terrain_roughness()
    test_configurable_window_sizes()
    test_invalid_values_and_immutability()
    print("=" * 65)
    print("  ALL ROUGHNESS ANALYSIS TESTS PASSED SUCCESSFULLY!")
    print("=" * 65 + "\n")

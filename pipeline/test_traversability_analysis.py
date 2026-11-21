"""
Unit Tests for Traversability Analysis Module (pipeline/traversability_analysis.py)

Tests:
1. Flat terrain classification produces 100% Class 0 (SAFE).
2. Steep terrain produces expected classification tiers based on slope (SAFE, MODERATE, DIFFICULT, UNSAFE).
3. Rough terrain produces expected classification tiers based on roughness (SAFE, MODERATE, DIFFICULT, UNSAFE).
4. Invalid terrain cells (NaN, +Inf, -Inf in DEM, slope, or roughness) are strictly classified as Class 3 (UNSAFE).
5. Input array immutability (DEM, slope, roughness are not modified).
6. Multi-factor combination logic (max severity of slope and roughness).
7. Custom configurable threshold overrides.
8. Traversability metrics calculation and crater terrain evaluation.
"""

import sys
from pathlib import Path
import numpy as np

PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.traversability_analysis import (
    classify_traversability,
    calculate_traversability_metrics,
    DEFAULT_TRAVERSABILITY_THRESHOLDS,
    CLASS_LABELS
)


def test_flat_terrain_safe():
    """Verify that flat, smooth terrain produces 100% Class 0 (SAFE)."""
    dem = np.full((50, 50), 100.0, dtype=np.float32)
    slope = np.zeros((50, 50), dtype=np.float32)
    roughness = np.zeros((50, 50), dtype=np.float32)

    classified = classify_traversability(dem, slope, roughness)

    assert classified.shape == (50, 50), f"Expected shape (50, 50), got {classified.shape}"
    assert classified.dtype == np.uint8, f"Expected uint8 dtype, got {classified.dtype}"
    assert np.all(classified == 0), f"All cells in flat smooth terrain must be Class 0 (SAFE), got non-zero: {np.unique(classified)}"

    metrics = calculate_traversability_metrics(classified)
    assert metrics["safe"]["count"] == 2500
    assert metrics["safe"]["percentage"] == 100.0
    assert metrics["unsafe"]["count"] == 0
    assert metrics["passable_surface_pct"] == 100.0
    assert metrics["blocked_surface_pct"] == 0.0

    print("PASS: test_flat_terrain_safe (100% Class 0 SAFE on flat smooth surface)")


def test_steep_terrain_classification():
    """Verify that slope tiers alone correctly assign classes 0, 1, 2, and 3."""
    dem = np.full((40, 40), 100.0, dtype=np.float32)
    roughness = np.full((40, 40), 0.2, dtype=np.float32)  # Low roughness (safe)
    slope = np.zeros((40, 40), dtype=np.float32)

    # Sub-regions with specific slope angles:
    # 0 to 10 rows: slope = 3.0 deg -> SAFE (< 5 deg)
    # 10 to 20 rows: slope = 7.5 deg -> MODERATE (5 - 10 deg)
    # 20 to 30 rows: slope = 13.0 deg -> DIFFICULT (10 - 15 deg)
    # 30 to 40 rows: slope = 22.0 deg -> UNSAFE (> 15 deg)
    slope[0:10, :] = 3.0
    slope[10:20, :] = 7.5
    slope[20:30, :] = 13.0
    slope[30:40, :] = 22.0

    classified = classify_traversability(dem, slope, roughness)

    assert np.all(classified[0:10, :] == 0), "Slope < 5 deg must be Class 0 (SAFE)"
    assert np.all(classified[10:20, :] == 1), "Slope 5-10 deg must be Class 1 (MODERATE)"
    assert np.all(classified[20:30, :] == 2), "Slope 10-15 deg must be Class 2 (DIFFICULT)"
    assert np.all(classified[30:40, :] == 3), "Slope > 15 deg must be Class 3 (UNSAFE)"

    metrics = calculate_traversability_metrics(classified)
    assert metrics["safe"]["percentage"] == 25.0
    assert metrics["moderate"]["percentage"] == 25.0
    assert metrics["difficult"]["percentage"] == 25.0
    assert metrics["unsafe"]["percentage"] == 25.0

    print("PASS: test_steep_terrain_classification (Verified all 4 slope-driven safety tiers)")


def test_rough_terrain_classification():
    """Verify that surface roughness tiers alone correctly assign classes 0, 1, 2, and 3."""
    dem = np.full((40, 40), 100.0, dtype=np.float32)
    slope = np.full((40, 40), 1.0, dtype=np.float32)  # Low slope (safe)
    roughness = np.zeros((40, 40), dtype=np.float32)

    # Sub-regions with specific roughness values:
    # 0 to 10 cols: roughness = 0.4 m -> SAFE (< 0.8 m)
    # 10 to 20 cols: roughness = 1.2 m -> MODERATE (0.8 - 1.8 m)
    # 20 to 30 cols: roughness = 2.4 m -> DIFFICULT (1.8 - 3.0 m)
    # 30 to 40 cols: roughness = 4.0 m -> UNSAFE (> 3.0 m)
    roughness[:, 0:10] = 0.4
    roughness[:, 10:20] = 1.2
    roughness[:, 20:30] = 2.4
    roughness[:, 30:40] = 4.0

    classified = classify_traversability(dem, slope, roughness)

    assert np.all(classified[:, 0:10] == 0), "Roughness < 0.8m must be Class 0 (SAFE)"
    assert np.all(classified[:, 10:20] == 1), "Roughness 0.8-1.8m must be Class 1 (MODERATE)"
    assert np.all(classified[:, 20:30] == 2), "Roughness 1.8-3.0m must be Class 2 (DIFFICULT)"
    assert np.all(classified[:, 30:40] == 3), "Roughness > 3.0m must be Class 3 (UNSAFE)"

    print("PASS: test_rough_terrain_classification (Verified all 4 roughness-driven safety tiers)")


def test_invalid_cells_handling_and_immutability():
    """Verify that invalid cells (NaN, Inf) are strictly assigned Class 3 (UNSAFE) and arrays are immutable."""
    dem = np.full((20, 20), 100.0, dtype=np.float32)
    slope = np.full((20, 20), 2.0, dtype=np.float32)  # Safe slope
    roughness = np.full((20, 20), 0.3, dtype=np.float32)  # Safe roughness

    # Inject invalid anomalies
    dem[2, 2] = np.nan
    dem[3, 3] = np.inf
    slope[6, 6] = np.nan
    slope[7, 7] = np.inf
    roughness[10, 10] = np.nan
    roughness[11, 11] = -np.inf

    dem_orig = np.copy(dem)
    slope_orig = np.copy(slope)
    roughness_orig = np.copy(roughness)

    classified = classify_traversability(dem, slope, roughness)

    # 1. Immutability check
    assert np.array_equal(dem, dem_orig, equal_nan=True), "DEM was mutated!"
    assert np.array_equal(slope, slope_orig, equal_nan=True), "Slope was mutated!"
    assert np.array_equal(roughness, roughness_orig, equal_nan=True), "Roughness was mutated!"

    # 2. Strict Class 3 UNSAFE assignment at invalid locations
    invalid_coords = [(2, 2), (3, 3), (6, 6), (7, 7), (10, 10), (11, 11)]
    for r, c in invalid_coords:
        assert classified[r, c] == 3, f"Invalid cell at ({r}, {c}) must be Class 3 UNSAFE, got {classified[r, c]}"

    # 3. Valid neighbors remain SAFE (Class 0)
    assert classified[0, 0] == 0, "Nominal neighbor should remain Class 0 (SAFE)"

    print("PASS: test_invalid_cells_handling_and_immutability (Strict Class 3 on NaN/Inf; inputs immutable)")


def test_mixed_terrain_and_threshold_configuration():
    """Verify multi-factor combination rule and custom threshold overrides."""
    dem = np.full((10, 10), 100.0, dtype=np.float32)
    slope = np.full((10, 10), 7.0, dtype=np.float32)      # Class 1 MODERATE
    roughness = np.full((10, 10), 2.2, dtype=np.float32)  # Class 2 DIFFICULT

    # Multi-factor rule: combined = max(1, 2) = 2 (DIFFICULT)
    classified = classify_traversability(dem, slope, roughness)
    assert np.all(classified == 2), f"Expected max(1, 2) = Class 2, got {np.unique(classified)}"

    # If roughness is critical (3.5m -> Class 3), combined must be Class 3
    roughness[0:5, :] = 3.5
    classified2 = classify_traversability(dem, slope, roughness)
    assert np.all(classified2[0:5, :] == 3), "Roughness Class 3 must dominate to make cell UNSAFE"
    assert np.all(classified2[5:10, :] == 2), "Lower half must remain Class 2"

    # Test custom configurable threshold overrides
    custom_thresholds = {
        "slope_deg": {
            "safe_max": 2.0,       # Stricter slope limit
            "moderate_max": 6.0,
            "difficult_max": 10.0
        },
        "roughness_m": {
            "safe_max": 0.5,
            "moderate_max": 1.0,
            "difficult_max": 2.0
        }
    }
    # With custom thresholds, slope=7.0 is now DIFFICULT (6-10 deg)
    classified_custom = classify_traversability(
        dem,
        np.full((10, 10), 7.0, dtype=np.float32),
        np.full((10, 10), 0.3, dtype=np.float32),  # safe roughness
        thresholds=custom_thresholds
    )
    assert np.all(classified_custom == 2), f"Under custom threshold, slope 7.0 deg should be DIFFICULT (2), got {np.unique(classified_custom)}"

    print("PASS: test_mixed_terrain_and_threshold_configuration (max combination & custom overrides verified)")


def test_crater_terrain_traversability():
    """Verify traversability classification on realistic synthetic crater terrain."""
    from pipeline.terrain_generation import generate_synthetic_terrain
    from pipeline.slope_analysis import compute_slope
    from pipeline.roughness_analysis import compute_roughness

    dem, craters = generate_synthetic_terrain(width=128, height=128, seed=42)
    slope = compute_slope(dem, cell_size=10.0)
    roughness = compute_roughness(dem, window_size=5)

    classified = classify_traversability(dem, slope, roughness)
    assert classified.shape == (128, 128)

    classes_present = np.unique(classified)
    assert 0 in classes_present, "Crater terrain must have SAFE plains"
    assert 3 in classes_present, "Crater rims/walls must produce UNSAFE hazards"

    metrics = calculate_traversability_metrics(classified)
    assert metrics["total_cells"] == 128 * 128
    pct_sum = (
        metrics["safe"]["percentage"]
        + metrics["moderate"]["percentage"]
        + metrics["difficult"]["percentage"]
        + metrics["unsafe"]["percentage"]
    )
    assert abs(pct_sum - 100.0) < 0.2, f"Percentages must sum to ~100%, got {pct_sum}"
    assert metrics["passable_surface_pct"] > 50.0, f"Expected >50% passable, got {metrics['passable_surface_pct']}%"
    assert metrics["blocked_surface_pct"] > 0.0, "Steep crater walls must be blocked"

    print(f"PASS: test_crater_terrain_traversability (Safe: {metrics['safe']['percentage']}%, Unsafe: {metrics['unsafe']['percentage']}%)")


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING TRAVERSABILITY ANALYSIS TEST SUITE")
    print("=" * 60)
    test_flat_terrain_safe()
    test_steep_terrain_classification()
    test_rough_terrain_classification()
    test_invalid_cells_handling_and_immutability()
    test_mixed_terrain_and_threshold_configuration()
    test_crater_terrain_traversability()
    print("=" * 60)
    print("ALL 6 TRAVERSABILITY TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

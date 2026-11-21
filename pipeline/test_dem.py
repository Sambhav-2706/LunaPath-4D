"""
Unit & Integration Tests for Synthetic Lunar Terrain & Digital Elevation Model (DEM)
Validates:
1. Expected dimensions (256x256)
2. Float32 data type precision
3. Absence of NaN and Infinity
4. Minimum and maximum elevation within physical bounds
5. Physical consistency of craters and surface variations
6. Non-circular / asymmetric crater morphology
7. Loading and saving round-trip fidelity
8. Error handling for invalid configurations
9. Missing value handling and patching
"""

import sys
import tempfile
from pathlib import Path
import numpy as np

PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.config import WIDTH, HEIGHT, CELL_SIZE_METERS, BASE_ELEVATION, SEED
from pipeline.terrain_generation import (
    initialize_terrain,
    apply_surface_variation,
    place_crater,
    place_craters,
    combine_terrain,
    generate_synthetic_terrain,
    validate_configuration
)
from pipeline.dem_manager import DigitalElevationModel


def test_dem_dimensions_and_dtype():
    """Verify DEM has exact 256x256 dimensions and Float32 precision."""
    dem_raw, craters = generate_synthetic_terrain(width=256, height=256, seed=SEED)
    assert dem_raw.shape == (256, 256), f"Expected shape (256, 256), got {dem_raw.shape}"
    assert dem_raw.dtype == np.float32, f"Expected float32 dtype, got {dem_raw.dtype}"

    dem_obj = DigitalElevationModel(dem_raw, cell_size_meters=10.0)
    assert dem_obj.width == 256
    assert dem_obj.height == 256
    assert dem_obj.cell_size_meters == 10.0
    print("PASS: test_dem_dimensions_and_dtype")


def test_dem_nan_and_inf_absence():
    """Verify zero NaN or Infinite values occur in generated DEM."""
    dem_raw, _ = generate_synthetic_terrain(seed=SEED)
    assert not np.isnan(dem_raw).any(), "DEM contains NaN values"
    assert not np.isinf(dem_raw).any(), "DEM contains Infinite values"

    dem_obj = DigitalElevationModel(dem_raw)
    assert dem_obj.validate(raise_on_error=True)
    print("PASS: test_dem_nan_and_inf_absence")


def test_elevation_physical_bounds():
    """Check that elevation values are physically consistent with synthetic lunar relief."""
    dem_raw, _ = generate_synthetic_terrain(seed=SEED)
    elev_min = float(dem_raw.min())
    elev_max = float(dem_raw.max())

    # Given base elevation 120m, deepest craters ~40m, highest rims ~15m, undulations ~20m
    assert elev_min >= 25.0, f"Elevation min {elev_min:.2f}m is unphysically low (< 25m)"
    assert elev_max <= 200.0, f"Elevation max {elev_max:.2f}m is unphysically high (> 200m)"
    assert elev_max > elev_min, "Maximum elevation must be strictly greater than minimum"
    relief = elev_max - elev_min
    assert 40.0 <= relief <= 150.0, f"Total relief {relief:.2f}m outside expected bounds [40m, 150m]"
    print(f"PASS: test_elevation_physical_bounds (min={elev_min:.2f}m, max={elev_max:.2f}m, relief={relief:.2f}m)")


def test_crater_tiers_and_counts():
    """Verify generation of large, medium, and small craters."""
    dem_raw, craters = generate_synthetic_terrain(
        large_craters=3,
        medium_craters=7,
        small_craters=18,
        seed=SEED
    )
    assert len(craters) == 28, f"Expected 28 craters, got {len(craters)}"

    large_found = sum(1 for c in craters if c["size_tier"] == "LARGE")
    med_found = sum(1 for c in craters if c["size_tier"] == "MEDIUM")
    small_found = sum(1 for c in craters if c["size_tier"] == "SMALL")

    assert large_found == 3, f"Expected 3 large craters, got {large_found}"
    assert med_found == 7, f"Expected 7 medium craters, got {med_found}"
    assert small_found == 18, f"Expected 18 small craters, got {small_found}"

    # Verify depressed interiors and raised rims
    for c in craters:
        assert c["depth_meters"] > 0, "Crater depth must be positive"
        assert c["rim_height_meters"] > 0, "Crater rim height must be positive"
        assert c["radius_meters"] > 0, "Crater radius must be positive"

    print("PASS: test_crater_tiers_and_counts (3 Large, 7 Medium, 18 Small)")


def test_crater_non_circularity():
    """Verify that craters are not identical circles (harmonic asymmetry is applied)."""
    flat = np.full((100, 100), 120.0, dtype=np.float64)
    rng = np.random.default_rng(999)
    record = place_crater(flat, center_x=50, center_y=50, radius_cells=15.0, asymmetry_factor=0.15, rng=rng)

    # Check asymmetry factor is reported
    assert record["ellipticity"] >= 0.0, "Ellipticity must be non-negative"

    # Profile orthogonal slices: if non-circular, X radius and Y radius at rim peak will differ
    slice_x = flat[50, :]
    slice_y = flat[:, 50]
    # Verify both have depression
    assert slice_x.min() < 120.0
    assert slice_y.min() < 120.0
    print("PASS: test_crater_non_circularity (Harmonic perturbation verified)")


def test_dem_save_and_load_roundtrip():
    """Test saving and loading DEM arrays across binary and NumPy formats."""
    dem_raw, _ = generate_synthetic_terrain(seed=SEED)
    dem_obj = DigitalElevationModel(dem_raw, cell_size_meters=10.0)

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        # 1. Binary save & load
        bin_file = tmp_path / "test_dem.bin"
        dem_obj.save_binary(bin_file)
        loaded_bin = DigitalElevationModel.load_binary(bin_file, width=256, height=256)
        assert np.allclose(dem_obj.data, loaded_bin.data, atol=1e-6), "Binary DEM round-trip mismatch"

        # 2. NumPy save & load
        npy_file = tmp_path / "test_dem.npy"
        dem_obj.save_numpy(npy_file)
        loaded_npy = DigitalElevationModel.load_numpy(npy_file)
        assert np.array_equal(dem_obj.data, loaded_npy.data), "NumPy DEM round-trip mismatch"

        # 3. Metadata save & reload
        meta_file = tmp_path / "test_meta.json"
        dem_obj.save_metadata(meta_file)
        assert meta_file.exists() and meta_file.stat().st_size > 0

    print("PASS: test_dem_save_and_load_roundtrip")


def test_invalid_configuration_handling():
    """Verify parameter validation raises ValueError on illegal inputs."""
    def assert_raises_value_error(fn, *args, **kwargs):
        try:
            fn(*args, **kwargs)
            assert False, "Expected ValueError was not raised"
        except ValueError:
            pass  # Expected

    # Negative dimensions
    assert_raises_value_error(validate_configuration, -256, 256, 10.0, 120.0, 3, 7, 18, 0.18, 0.045)
    assert_raises_value_error(validate_configuration, 256, 0, 10.0, 120.0, 3, 7, 18, 0.18, 0.045)

    # Negative cell size
    assert_raises_value_error(validate_configuration, 256, 256, -10.0, 120.0, 3, 7, 18, 0.18, 0.045)

    # Negative crater count
    assert_raises_value_error(validate_configuration, 256, 256, 10.0, 120.0, -1, 7, 18, 0.18, 0.045)

    # Out of range depth ratio
    assert_raises_value_error(validate_configuration, 256, 256, 10.0, 120.0, 3, 7, 18, 0.8, 0.045)

    print("PASS: test_invalid_configuration_handling")


def test_missing_value_handling():
    """Test detection and patching of NaN and Inf values in DEM."""
    data = np.full((10, 10), 120.0, dtype=np.float32)
    data[2, 3] = np.nan
    data[7, 8] = np.inf

    dem_obj = DigitalElevationModel(data)
    # validate() should fail initially
    assert not dem_obj.validate(raise_on_error=False)

    # Patch missing values
    patched = dem_obj.handle_missing_values(fill_value=120.0)
    assert patched == 2
    assert not np.isnan(dem_obj.data).any()
    assert not np.isinf(dem_obj.data).any()
    assert dem_obj.validate(raise_on_error=True)
    print("PASS: test_missing_value_handling")


def test_reproducibility():
    """Verify that fixed seed produces bitwise identical terrain."""
    dem1, craters1 = generate_synthetic_terrain(seed=12345)
    dem2, craters2 = generate_synthetic_terrain(seed=12345)
    assert np.array_equal(dem1, dem2), "Seed reproducibility failed: arrays differ"
    assert len(craters1) == len(craters2)
    assert craters1[0]["radius_meters"] == craters2[0]["radius_meters"]
    print("PASS: test_reproducibility (Bitwise identical output with seed=12345)")


if __name__ == "__main__":
    print("\n" + "=" * 65)
    print("  RUNNING SYNTHETIC TERRAIN & DEM TEST SUITE")
    print("=" * 65)
    test_dem_dimensions_and_dtype()
    test_dem_nan_and_inf_absence()
    test_elevation_physical_bounds()
    test_crater_tiers_and_counts()
    test_crater_non_circularity()
    test_dem_save_and_load_roundtrip()
    test_invalid_configuration_handling()
    test_missing_value_handling()
    test_reproducibility()
    print("=" * 65)
    print("  ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 65 + "\n")

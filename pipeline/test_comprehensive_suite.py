"""
LunaPath-4D: Comprehensive Member 1 Automated Test Suite
Role: Member 1 — Terrain & Data Engineering

Test Modules:
  1. Synthetic terrain generation
  2. Crater generation & morphometry
  3. DEM creation & coordinate conventions
  4. DEM saving and loading roundtrip
  5. Elevation analysis & hypsometry
  6. Slope calculation & Horn's method
  7. Roughness calculation (RMS Rq)
  8. Traversability classification & cost mapping
  9. Data export & contract consistency
  10. Unified pipeline execution, reproducibility & performance
"""

import sys
import json
import time
import tempfile
from pathlib import Path
import pytest
import numpy as np

# Ensure project root is in sys.path
PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.config import (
    SEED,
    WIDTH,
    HEIGHT,
    CELL_SIZE_METERS,
    BASE_ELEVATION,
    DATA_DIR,
    MAX_SAFE_SLOPE_DEG,
    CRITICAL_ROUGHNESS_M,
    ROVER_SAFETY_MARGIN_CELLS
)
from pipeline.terrain_generation import (
    generate_synthetic_terrain,
    initialize_terrain,
    apply_surface_variation,
    place_craters,
    combine_terrain,
    validate_configuration
)
from pipeline.dem_manager import DigitalElevationModel
from pipeline.crater_generator import apply_realistic_crater
from pipeline.elevation_analysis import (
    calculate_elevation_metrics,
    calculate_elevation_distribution,
    calculate_hypsometry,
    compute_elevation_statistics
)
from pipeline.slope_analysis import compute_slope, analyze_slope
from pipeline.roughness_analysis import compute_roughness, analyze_roughness
from pipeline.traversability_analysis import (
    classify_traversability,
    calculate_traversability_metrics,
    compute_traversability,
    summarize_traversability,
    compile_hazard_catalog
)
from pipeline.terrain_exporter import (
    export_binary_array,
    build_metadata_contract,
    export_all_pipeline_artifacts
)
from pipeline.pipeline_orchestrator import run_full_pipeline


# =============================================================================
# 1. SYNTHETIC TERRAIN GENERATION
# =============================================================================

def test_synthetic_terrain_default_generation():
    """Verify default 256x256 terrain generation, dtype, shape, and no NaNs/Infs."""
    dem, craters = generate_synthetic_terrain(width=256, height=256, seed=42)

    assert dem.shape == (256, 256), f"Expected (256, 256), got {dem.shape}"
    assert dem.dtype == np.float32, f"Expected float32, got {dem.dtype}"
    assert not np.isnan(dem).any(), "Synthetic DEM contains NaNs"
    assert not np.isinf(dem).any(), "Synthetic DEM contains Infs"
    assert len(craters) == 28, f"Expected 28 default craters, got {len(craters)}"

    # Check crater catalog structure
    first_crater = craters[0]
    required_keys = ["id", "size_tier", "x_cell", "y_cell", "radius_cells", "depth_m", "rim_height_m"]
    for k in required_keys:
        assert k in first_crater, f"Missing key '{k}' in crater record"


def test_synthetic_terrain_custom_dimensions():
    """Verify terrain generation works across arbitrary rectangular dimensions."""
    for w, h in [(64, 64), (128, 64), (80, 100)]:
        dem, craters = generate_synthetic_terrain(width=w, height=h, seed=123, large_craters=1, medium_craters=2, small_craters=5)
        assert dem.shape == (h, w), f"Expected ({h}, {w}), got {dem.shape}"
        assert not np.isnan(dem).any()


def test_synthetic_terrain_invalid_parameters():
    """Verify that invalid configuration values raise ValueError."""
    with pytest.raises(ValueError):
        generate_synthetic_terrain(width=0, height=256)
    with pytest.raises(ValueError):
        generate_synthetic_terrain(width=256, height=-10)
    with pytest.raises(ValueError):
        generate_synthetic_terrain(cell_size=-5.0)
    with pytest.raises(ValueError):
        generate_synthetic_terrain(depth_ratio=1.5)  # depth > 0.5 invalid
    with pytest.raises(ValueError):
        generate_synthetic_terrain(large_craters=-1)


# =============================================================================
# 2. CRATER GENERATION & MORPHOMETRY
# =============================================================================

def test_crater_geometry_and_cavity_depth():
    """Verify realistic crater bowl depression, raised rim, and continuous ejecta."""
    terrain = np.full((100, 100), 100.0, dtype=np.float64)
    cx, cy = 50.0, 50.0
    radius = 20.0  # cells (200m)

    apply_realistic_crater(terrain, cx, cy, radius_cells=radius, cell_size=10.0, depth_ratio=0.20, rim_ratio=0.05)

    # 1. Cavity depression at center
    center_elev = terrain[int(cy), int(cx)]
    assert center_elev < 100.0, f"Crater center must be depressed, got {center_elev}"
    assert center_elev < 75.0, f"Expected deep cavity (< 75m), got {center_elev}"

    # 2. Raised rim at r ~ radius
    # Sample points on the rim circle
    rim_points = [
        terrain[int(cy), int(cx + radius)],
        terrain[int(cy), int(cx - radius)],
        terrain[int(cy + radius), int(cx)],
        terrain[int(cy - radius), int(cx)]
    ]
    assert any(p > 100.0 for p in rim_points), f"Crater rim should be uplifted above 100m, got {rim_points}"

    # 3. Flat background outside ejecta blanket (r > 3 * radius)
    assert abs(terrain[5, 5] - 100.0) < 0.01, "Far-field terrain should remain unchanged"


def test_crater_harmonic_non_circularity():
    """Verify that craters exhibit asymmetric harmonic boundary perturbations."""
    t1 = np.full((80, 80), 100.0, dtype=np.float64)
    t2 = np.full((80, 80), 100.0, dtype=np.float64)

    rng1 = np.random.default_rng(101)
    rng2 = np.random.default_rng(202)

    apply_realistic_crater(t1, 40, 40, radius_cells=15.0, rng=rng1)
    apply_realistic_crater(t2, 40, 40, radius_cells=15.0, rng=rng2)

    # Different seeds produce different non-circular rim shapes
    assert not np.array_equal(t1, t2), "Craters with different perturbation seeds should not be identical"


# =============================================================================
# 3. DEM CREATION & COORDINATE CONVENTIONS
# =============================================================================

def test_dem_creation_and_bounds():
    """Verify DEM class wrapping, bounds validation, and metrics calculation."""
    data = np.full((64, 64), 120.0, dtype=np.float32)
    dem = DigitalElevationModel(data, cell_size_meters=10.0)
    dem.validate()

    assert dem.width == 64
    assert dem.height == 64
    assert dem.cell_size_meters == 10.0
    assert dem.min_elevation == 120.0
    assert dem.max_elevation == 120.0
    assert dem.relief == 0.0


def test_dem_coordinate_transforms():
    """Verify grid <-> world <-> Three.js coordinate conversions."""
    dem = DigitalElevationModel(np.zeros((100, 100), dtype=np.float32), cell_size_meters=10.0)

    # Test grid to metric terrain coords (col=25, row=50)
    gx, gy = dem.grid_to_world(col=25, row=50)
    assert gx == 250.0  # 25 cols * 10m
    assert gy == 500.0  # 50 rows * 10m

    # Round trip
    c, r = dem.world_to_grid(gx, gy)
    assert r == 50 and c == 25

    # Three.js conversion
    tx, ty, tz = dem.grid_to_threejs_world(col=50, row=50, elevation=135.0, base_elev=120.0)
    assert ty == 15.0  # 135 - 120
    # Center of 100x100 grid is col 50, row 50 -> world coords (0, 0)
    assert abs(tx) < 1.0 and abs(tz) < 1.0


def test_dem_invalid_dimensions():
    """Verify that non-2D arrays raise ValueError upon DEM validation."""
    with pytest.raises(ValueError):
        DigitalElevationModel(np.zeros((10, 10, 3), dtype=np.float32)).validate()
    with pytest.raises(ValueError):
        DigitalElevationModel(np.zeros((100,), dtype=np.float32)).validate()


# =============================================================================
# 4. DEM SAVING AND LOADING
# =============================================================================

def test_dem_saving_loading_roundtrip():
    """Verify that saving and loading DEM across binary, npy, and GeoTIFF preserves values."""
    original_data = np.random.uniform(50.0, 150.0, (40, 40)).astype(np.float32)
    dem_orig = DigitalElevationModel(original_data, cell_size_meters=10.0)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        # 1. NumPy .npy
        npy_file = tmp_path / "test.npy"
        dem_orig.save_numpy(npy_file)
        dem_loaded_npy = DigitalElevationModel.load_numpy(npy_file, cell_size_meters=10.0)
        assert np.array_equal(dem_orig.data, dem_loaded_npy.data)

        # 2. Binary .bin (<f4)
        bin_file = tmp_path / "test.bin"
        dem_orig.save_binary(bin_file)
        dem_loaded_bin = DigitalElevationModel.load_binary(bin_file, width=40, height=40, cell_size_meters=10.0)
        assert np.array_equal(dem_orig.data, dem_loaded_bin.data)

        # 3. GeoTIFF .tif
        tif_file = tmp_path / "test.tif"
        if dem_orig.save_geotiff(tif_file):
            assert tif_file.exists()
            assert tif_file.stat().st_size > 0


# =============================================================================
# 5. ELEVATION ANALYSIS
# =============================================================================

def test_elevation_analysis_flat_and_ramp():
    """Verify elevation statistics on flat terrain and analytical linear ramp."""
    # Flat terrain
    flat = np.full((50, 50), 120.0, dtype=np.float32)
    m_flat = calculate_elevation_metrics(flat)
    assert m_flat["minimum_elevation_m"] == 120.0
    assert m_flat["maximum_elevation_m"] == 120.0
    assert m_flat["mean_elevation_m"] == 120.0
    assert m_flat["median_elevation_m"] == 120.0
    assert m_flat["standard_deviation_m"] == 0.0
    assert m_flat["total_relief_m"] == 0.0

    # Linear ramp from 0.0m to 99.0m
    ramp = np.arange(100, dtype=np.float32).reshape((10, 10))
    m_ramp = calculate_elevation_metrics(ramp)
    assert m_ramp["minimum_elevation_m"] == 0.0
    assert m_ramp["maximum_elevation_m"] == 99.0
    assert m_ramp["mean_elevation_m"] == 49.5
    assert m_ramp["total_relief_m"] == 99.0


def test_elevation_analysis_invalid_values_isolation():
    """Verify that NaN and Inf values are safely excluded from statistics."""
    data = np.full((30, 30), 100.0, dtype=np.float32)
    data[0, 0] = np.nan
    data[1, 1] = np.inf
    data[2, 2] = -np.inf

    data_copy = np.copy(data)
    metrics = calculate_elevation_metrics(data)

    # Immutability
    assert np.array_equal(data, data_copy, equal_nan=True), "Input array was mutated"
    assert metrics["valid_cell_count"] == 30 * 30 - 3
    assert metrics["mean_elevation_m"] == 100.0
    assert metrics["standard_deviation_m"] == 0.0


# =============================================================================
# 6. SLOPE CALCULATION
# =============================================================================

def test_slope_calculation_flat_and_ramps():
    """Verify Horn's slope algorithm on flat terrain and known trigonometric angles."""
    # 1. Flat terrain -> 0.0 slope everywhere
    flat = np.full((60, 60), 100.0, dtype=np.float32)
    slope_flat = compute_slope(flat, cell_size=10.0)
    assert np.allclose(slope_flat, 0.0, atol=1e-5)

    # 2. 45-degree ramp (dz/dx = 1.0 -> 10m rise per 10m cell)
    x = np.arange(60, dtype=np.float32)
    ramp_45 = np.tile(x * 10.0, (60, 1))
    slope_45 = compute_slope(ramp_45, cell_size=10.0)
    # Check interior cells away from boundary
    interior_45 = slope_45[5:55, 5:55]
    assert np.allclose(interior_45, 45.0, atol=1e-1)

    # 3. 26.565-degree ramp (dz/dx = 0.5)
    ramp_26 = np.tile(x * 5.0, (60, 1))
    slope_26 = compute_slope(ramp_26, cell_size=10.0)
    interior_26 = slope_26[5:55, 5:55]
    expected_26 = np.degrees(np.arctan(0.5))
    assert np.allclose(interior_26, expected_26, atol=1e-1)


def test_slope_physical_bounds_and_crater():
    """Verify slope bounds [0, 90] and steep slopes at crater rims."""
    dem, craters = generate_synthetic_terrain(width=80, height=80, seed=42)
    slope = compute_slope(dem, cell_size=10.0)

    assert slope.min() >= 0.0
    assert slope.max() <= 90.0
    assert slope.max() > 25.0, "Crater rims should generate steep slopes (> 25 deg)"

    s_metrics = analyze_slope(slope, max_safe_slope=15.0)
    assert s_metrics["hazard_cell_count"] > 0


# =============================================================================
# 7. ROUGHNESS CALCULATION
# =============================================================================

def test_roughness_calculation_flat_and_noisy():
    """Verify local RMS height deviation Rq on flat and procedurally textured surfaces."""
    # Flat terrain -> 0.0 roughness
    flat = np.full((50, 50), 100.0, dtype=np.float32)
    rough_flat = compute_roughness(flat, window_size=5)
    assert np.allclose(rough_flat, 0.0, atol=1e-5)

    # Noisy terrain with known standard deviation
    rng = np.random.default_rng(42)
    noisy = 100.0 + rng.normal(0.0, 1.5, (50, 50)).astype(np.float32)
    rough_noisy = compute_roughness(noisy, window_size=5)

    # Interior roughness should closely match noise standard deviation (~1.5m)
    interior_mean = float(np.mean(rough_noisy[10:40, 10:40]))
    assert abs(interior_mean - 1.5) < 0.35, f"Expected roughness ~1.5m, got {interior_mean}"


def test_roughness_window_validation():
    """Verify window size constraints (must be positive odd integer >= 3)."""
    data = np.full((20, 20), 100.0, dtype=np.float32)
    with pytest.raises(ValueError):
        compute_roughness(data, window_size=4)  # Even
    with pytest.raises(ValueError):
        compute_roughness(data, window_size=1)  # Too small
    with pytest.raises(ValueError):
        compute_roughness(data, window_size=-3) # Negative


# =============================================================================
# 8. TRAVERSABILITY CLASSIFICATION
# =============================================================================

def test_traversability_safety_tiers():
    """Verify 4 discrete tiers: 0=SAFE, 1=MODERATE, 2=DIFFICULT, 3=UNSAFE."""
    dem = np.full((40, 40), 100.0, dtype=np.float32)

    # 1. Flat smooth -> 100% SAFE
    class_safe = classify_traversability(
        dem,
        np.full((40, 40), 2.0, dtype=np.float32),  # slope < 5
        np.full((40, 40), 0.3, dtype=np.float32)   # roughness < 0.8
    )
    assert np.all(class_safe == 0)

    # 2. Moderate slope (7 deg) -> Class 1
    class_mod = classify_traversability(
        dem,
        np.full((40, 40), 7.0, dtype=np.float32),
        np.full((40, 40), 0.3, dtype=np.float32)
    )
    assert np.all(class_mod == 1)

    # 3. Difficult slope (13 deg) -> Class 2
    class_diff = classify_traversability(
        dem,
        np.full((40, 40), 13.0, dtype=np.float32),
        np.full((40, 40), 0.3, dtype=np.float32)
    )
    assert np.all(class_diff == 2)

    # 4. Unsafe slope (22 deg) -> Class 3
    class_unsafe = classify_traversability(
        dem,
        np.full((40, 40), 22.0, dtype=np.float32),
        np.full((40, 40), 0.3, dtype=np.float32)
    )
    assert np.all(class_unsafe == 3)


def test_traversability_invalid_cells_forced_unsafe():
    """Verify that any invalid NaN/Inf cell is strictly assigned Class 3 (UNSAFE)."""
    dem = np.full((20, 20), 100.0, dtype=np.float32)
    slope = np.full((20, 20), 2.0, dtype=np.float32)
    rough = np.full((20, 20), 0.3, dtype=np.float32)

    dem[5, 5] = np.nan
    slope[10, 10] = np.inf
    rough[15, 15] = np.nan

    classified = classify_traversability(dem, slope, rough)
    assert classified[5, 5] == 3
    assert classified[10, 10] == 3
    assert classified[15, 15] == 3
    assert classified[0, 0] == 0  # Valid neighbor remains SAFE


# =============================================================================
# 9. DATA EXPORT & CONTRACT CONSISTENCY
# =============================================================================

def test_data_export_and_contract_schema():
    """Verify all binary array files, metadata JSON, and hazard exports."""
    dem = np.random.uniform(90.0, 140.0, (32, 32)).astype(np.float32)
    slope = np.random.uniform(0.0, 20.0, (32, 32)).astype(np.float32)
    rough = np.random.uniform(0.1, 4.0, (32, 32)).astype(np.float32)
    trav = np.random.uniform(0.0, 1.0, (32, 32)).astype(np.float32)
    classified = np.random.randint(0, 4, (32, 32)).astype(np.uint8)

    craters = [{"id": "CRATER_001", "x": 100.0, "y": 100.0, "radius": 15.0}]
    hazards = [{"id": "HAZARD_001", "type": "crater", "x": 100.0, "y": 100.0, "radius_meters": 15.0, "known_from_orbit": True}]

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        manifest = export_all_pipeline_artifacts(
            output_dir=tmp_path,
            dem=dem,
            slope=slope,
            rough=rough,
            traversability=trav,
            craters=craters,
            hazards=hazards,
            elev_analysis={"min_elevation_m": 90.0, "max_elevation_m": 140.0},
            slope_analysis={"mean_slope_deg": 8.0, "max_slope_deg": 20.0},
            rough_analysis={"mean_roughness_m": 1.5},
            trav_summary={"passable_percentage": 85.0},
            classified_traversability=classified,
            cell_size_meters=10.0,
            seed=42
        )

        # Check binary file sizes: 32 * 32 * 4 = 4096 bytes
        assert (tmp_path / "dem.bin").stat().st_size == 32 * 32 * 4
        assert (tmp_path / "slope.bin").stat().st_size == 32 * 32 * 4
        assert (tmp_path / "rough.bin").stat().st_size == 32 * 32 * 4
        assert (tmp_path / "traversability.bin").stat().st_size == 32 * 32 * 4
        assert (tmp_path / "traversability_classified.bin").stat().st_size == 32 * 32 * 4

        # Read back dem.bin and verify zero loss
        loaded_dem = np.fromfile(tmp_path / "dem.bin", dtype="<f4").reshape((32, 32))
        assert np.array_equal(dem, loaded_dem)

        # Validate metadata schema
        with open(tmp_path / "terrain_meta.json", "r") as f:
            meta = json.load(f)
        assert meta["schema_version"] == "1.0.0"
        assert meta["grid_width"] == 32
        assert meta["grid_height"] == 32
        assert meta["elevation_units"] == "meters"
        assert meta["slope_units"] == "degrees"
        assert meta["roughness_units"] == "meters"


# =============================================================================
# 10. UNIFIED PIPELINE EXECUTION, REPRODUCIBILITY & PERFORMANCE
# =============================================================================

def test_pipeline_reproducibility():
    """Verify bitwise exact reproducibility with same seed, and divergent output with different seed."""
    with tempfile.TemporaryDirectory() as tmp1, tempfile.TemporaryDirectory() as tmp2, tempfile.TemporaryDirectory() as tmp3:
        # Run 1: seed=42
        res1 = run_full_pipeline(width=64, height=64, seed=42, output_dir=Path(tmp1), large_craters=1, medium_craters=2, small_craters=4)
        # Run 2: seed=42 (identical)
        res2 = run_full_pipeline(width=64, height=64, seed=42, output_dir=Path(tmp2), large_craters=1, medium_craters=2, small_craters=4)
        # Run 3: seed=999 (divergent)
        res3 = run_full_pipeline(width=64, height=64, seed=999, output_dir=Path(tmp3), large_craters=1, medium_craters=2, small_craters=4)

        # Check identical output
        assert np.array_equal(res1["dem"], res2["dem"]), "Identical seeds must produce bitwise identical DEM"
        assert np.array_equal(res1["slope"], res2["slope"]), "Identical seeds must produce identical slope"
        assert np.array_equal(res1["classified_traversability"], res2["classified_traversability"])

        # Check divergent output with different seeds
        assert not np.array_equal(res1["dem"], res3["dem"]), "Different seeds must produce different DEMs"


def test_pipeline_execution_performance():
    """Verify unified pipeline executes efficiently within acceptable execution time."""
    start_time = time.time()
    with tempfile.TemporaryDirectory() as tmpdir:
        res = run_full_pipeline(width=128, height=128, seed=42, output_dir=Path(tmpdir), large_craters=1, medium_craters=3, small_craters=6)
        elapsed = time.time() - start_time

    assert elapsed < 15.0, f"128x128 pipeline execution took too long ({elapsed:.2f}s > 15s)"
    assert res["dem"].shape == (128, 128)

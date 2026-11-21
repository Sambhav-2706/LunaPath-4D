"""
Comprehensive Test Suite for Member 1: Terrain & Data Engineering
Individually tests all 9 modules and validates inter-member data contracts.
"""

import json
from pathlib import Path
import numpy as np

# Ensure pipeline root is in path
PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
DATA_DIR = PROJECT_ROOT / "web" / "public" / "data"

import sys
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.config import WIDTH, HEIGHT, CELL_SIZE_METERS, MAX_SAFE_SLOPE_DEG
from pipeline.terrain_generation import synthesize_lunar_base, generate_hermite_noise
from pipeline.dem_manager import DEMManager
from pipeline.crater_generator import sample_crater_radii, apply_crater_profile, generate_crater_population
from pipeline.elevation_analysis import compute_elevation_statistics
from pipeline.slope_analysis import compute_slope, analyze_slope
from pipeline.roughness_analysis import compute_roughness, analyze_roughness
from pipeline.traversability_analysis import compute_traversability, summarize_traversability, compile_hazard_catalog
from pipeline.terrain_exporter import export_binary_array, build_metadata_contract


def test_module_1_terrain_generation():
    rng = np.random.default_rng(123)
    base = synthesize_lunar_base(rng=rng)
    assert base.shape == (HEIGHT, WIDTH), f"Incorrect shape: {base.shape}"
    assert not np.isnan(base).any(), "Base terrain contains NaN values"
    assert not np.isinf(base).any(), "Base terrain contains Inf values"
    assert base.min() > 50.0 and base.max() < 200.0, "Base elevation outside lunar limits"
    print("PASS: Module 1 (Terrain Generation)")


def test_module_2_dem_manager():
    mgr = DEMManager(cell_size=10.0)
    wx, wy = mgr.grid_to_world(100, 150)
    assert wx == 1000.0 and wy == 1500.0, "Grid to world conversion failed"
    col, row = mgr.world_to_grid(wx, wy)
    assert col == 100 and row == 150, "World to grid round-trip failed"
    x3d, y3d, z3d = mgr.grid_to_threejs_world(128, 128, 120.0, base_elev=100.0)
    assert x3d == 0.0 and z3d == 0.0 and y3d == 20.0, "Three.js world projection failed"
    print("PASS: Module 2 (DEM Manager)")


def test_module_3_crater_generator():
    radii = sample_crater_radii(count=15, r_min=3.0, r_max=20.0)
    assert len(radii) == 15
    assert radii[0] >= radii[-1], "Crater radii should be sorted descending"

    test_grid = np.zeros((100, 100), dtype=np.float64)
    morph = apply_crater_profile(test_grid, 50, 50, radius_cells=10, cell_size=10.0)
    assert morph["depth_meters"] > 0
    assert morph["rim_height_meters"] > 0
    assert test_grid[50, 50] < 0.0, "Crater floor must be depressed"
    assert test_grid.max() > 0.0, "Crater rim must be elevated"
    print("PASS: Module 3 (Crater Generator)")


def test_module_4_elevation_analysis():
    dummy = np.linspace(100.0, 200.0, 1000)
    stats = compute_elevation_statistics(dummy)
    assert stats["min_elevation_m"] == 100.0
    assert stats["max_elevation_m"] == 200.0
    assert abs(stats["mean_elevation_m"] - 150.0) < 1e-3
    assert stats["total_relief_m"] == 100.0
    assert stats["percentiles"]["p05"] < stats["percentiles"]["p95"]
    print("PASS: Module 4 (Elevation Analysis)")


def test_module_5_slope_analysis():
    # 1. Flat terrain must have 0 slope
    flat = np.full((50, 50), 100.0)
    flat_slope = compute_slope(flat, cell_size=10.0)
    assert np.allclose(flat_slope, 0.0, atol=1e-5), "Flat terrain must have 0 slope"

    # 2. Known 45 deg ramp: dz/dx = 1.0 (10m rise per 10m run)
    x, y = np.meshgrid(np.arange(50), np.arange(50))
    ramp = x * 10.0
    ramp_slope = compute_slope(ramp, cell_size=10.0)
    # Check interior cells away from boundary
    assert np.allclose(ramp_slope[10:40, 10:40], 45.0, atol=1e-1), f"Expected 45 deg slope, got {ramp_slope[25, 25]}"
    print("PASS: Module 5 (Slope Analysis)")


def test_module_6_roughness_analysis():
    flat = np.full((60, 60), 100.0)
    flat_rough = compute_roughness(flat, window_size=5)
    assert np.allclose(flat_rough, 0.0, atol=1e-5), "Flat surface roughness must be 0"

    noisy = np.random.default_rng(42).normal(100.0, 2.0, (60, 60))
    noisy_rough = compute_roughness(noisy, window_size=5)
    assert noisy_rough.mean() > 1.0, "Noisy surface should have positive roughness"
    print("PASS: Module 6 (Roughness Analysis)")


def test_module_7_traversability_analysis():
    slope = np.zeros((50, 50), dtype=np.float32)
    rough = np.zeros((50, 50), dtype=np.float32)
    slope[20:25, 20:25] = 20.0  # Hazardous obstacle zone

    cost, raw_obs, inf_obs = compute_traversability(
        slope, rough, max_safe_slope=15.0, safety_margin_cells=1
    )
    assert cost.min() >= 0.0 and cost.max() <= 1.0, "Cost must be in [0, 1]"
    assert (cost[20:25, 20:25] == 1.0).all(), "Hazard zone must have cost 1.0"
    assert inf_obs.sum() > raw_obs.sum(), "Dilated obstacles must be larger than raw obstacles"
    print("PASS: Module 7 (Traversability Analysis)")


def test_module_8_and_9_export_and_contracts():
    expected_binaries = ["dem.bin", "slope.bin", "rough.bin", "traversability.bin"]
    expected_bytes = WIDTH * HEIGHT * 4  # 262,144 bytes

    for b in expected_binaries:
        p = DATA_DIR / b
        assert p.exists(), f"Missing binary file: {b}"
        assert p.stat().st_size == expected_bytes, f"Binary {b} has wrong size: {p.stat().st_size}"

    meta_p = DATA_DIR / "terrain_meta.json"
    assert meta_p.exists(), "Missing terrain_meta.json"
    with open(meta_p, "r", encoding="utf-8") as f:
        meta = json.load(f)
    assert meta["width"] == WIDTH and meta["height"] == HEIGHT
    assert "rover_parameters" in meta

    hazards_p = DATA_DIR / "hazards.json"
    assert hazards_p.exists(), "Missing hazards.json"
    with open(hazards_p, "r", encoding="utf-8") as f:
        hazards = json.load(f)
    assert len(hazards) > 0

    print("PASS: Modules 8 & 9 (Export & Data Contracts)")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  RUNNING MODULAR UNIT TESTS (MEMBER 1)")
    print("=" * 60)
    test_module_1_terrain_generation()
    test_module_2_dem_manager()
    test_module_3_crater_generator()
    test_module_4_elevation_analysis()
    test_module_5_slope_analysis()
    test_module_6_roughness_analysis()
    test_module_7_traversability_analysis()
    test_module_8_and_9_export_and_contracts()
    print("=" * 60)
    print("  ALL 9 MODULES PASSED ALL TESTS SUCCESSFULLY!")
    print("=" * 60 + "\n")

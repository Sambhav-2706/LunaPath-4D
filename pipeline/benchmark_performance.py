"""
Performance Benchmark Script for LunaPath-4D Member 1 Terrain Engine
Measures execution time and peak memory usage at:
- 256 x 256
- 512 x 512
- 1024 x 1024
"""

import sys
import time
import tracemalloc
from pathlib import Path
import numpy as np

# Ensure project root is in sys.path
PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.terrain_generation import generate_synthetic_terrain
from pipeline.slope_analysis import compute_slope, analyze_slope
from pipeline.roughness_analysis import compute_roughness, analyze_roughness
from pipeline.traversability_analysis import classify_traversability, calculate_traversability_metrics, compute_traversability
from pipeline.dem_manager import DigitalElevationModel
from pipeline.terrain_exporter import export_binary_array, export_all_pipeline_artifacts
from pipeline.elevation_analysis import compute_elevation_statistics


def benchmark_resolution(width: int, height: int, runs: int = 3):
    print(f"\n=======================================================")
    print(f" BENCHMARKING GRID RESOLUTION: {width} x {height} ({width * height:,} cells)")
    print(f"=======================================================")

    results = {}

    # 1. Terrain Generation (including craters)
    tracemalloc.start()
    t0 = time.perf_counter()
    for _ in range(runs):
        dem, craters = generate_synthetic_terrain(width=width, height=height, seed=42)
    t_terrain = (time.perf_counter() - t0) / runs
    _, mem_terrain = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    results["terrain_gen"] = (t_terrain, mem_terrain / (1024 * 1024))
    print(f"  1. Terrain & Crater Gen    : {t_terrain * 1000:7.2f} ms | Peak Mem: {mem_terrain / (1024 * 1024):6.2f} MB")

    # 2. DEM Validation & Metrics
    tracemalloc.start()
    t0 = time.perf_counter()
    for _ in range(runs):
        dem_obj = DigitalElevationModel(dem, cell_size_meters=10.0)
        dem_obj.validate()
        elev_stats = compute_elevation_statistics(dem)
    t_dem = (time.perf_counter() - t0) / runs
    _, mem_dem = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    results["elevation_dem"] = (t_dem, mem_dem / (1024 * 1024))
    print(f"  2. DEM & Elevation Stats   : {t_dem * 1000:7.2f} ms | Peak Mem: {mem_dem / (1024 * 1024):6.2f} MB")

    # 3. Slope Calculation
    tracemalloc.start()
    t0 = time.perf_counter()
    for _ in range(runs):
        slope = compute_slope(dem, cell_size=10.0)
        slope_stats = analyze_slope(slope)
    t_slope = (time.perf_counter() - t0) / runs
    _, mem_slope = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    results["slope"] = (t_slope, mem_slope / (1024 * 1024))
    print(f"  3. Slope Calculation       : {t_slope * 1000:7.2f} ms | Peak Mem: {mem_slope / (1024 * 1024):6.2f} MB")

    # 4. Roughness Calculation
    tracemalloc.start()
    t0 = time.perf_counter()
    for _ in range(runs):
        roughness = compute_roughness(dem, window_size=5)
        rough_stats = analyze_roughness(roughness)
    t_rough = (time.perf_counter() - t0) / runs
    _, mem_rough = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    results["roughness"] = (t_rough, mem_rough / (1024 * 1024))
    print(f"  4. Roughness Calculation   : {t_rough * 1000:7.2f} ms | Peak Mem: {mem_rough / (1024 * 1024):6.2f} MB")

    # 5. Traversability Classification
    tracemalloc.start()
    t0 = time.perf_counter()
    for _ in range(runs):
        classified = classify_traversability(dem, slope, roughness)
        class_stats = calculate_traversability_metrics(classified)
        cost, raw_obs, infl_obs = compute_traversability(slope, roughness)
    t_trav = (time.perf_counter() - t0) / runs
    _, mem_trav = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    results["traversability"] = (t_trav, mem_trav / (1024 * 1024))
    print(f"  5. Traversability Analysis : {t_trav * 1000:7.2f} ms | Peak Mem: {mem_trav / (1024 * 1024):6.2f} MB")

    # 6. Binary Array Export
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        tracemalloc.start()
        t0 = time.perf_counter()
        for _ in range(runs):
            export_binary_array(dem, tmp_path / "dem.bin")
            export_binary_array(slope, tmp_path / "slope.bin")
            export_binary_array(roughness, tmp_path / "rough.bin")
            export_binary_array(cost, tmp_path / "trav.bin")
        t_export = (time.perf_counter() - t0) / runs
        _, mem_export = tracemalloc.get_traced_memory()
        tracemalloc.stop()
    results["export"] = (t_export, mem_export / (1024 * 1024))
    print(f"  6. Binary Data Export (x4) : {t_export * 1000:7.2f} ms | Peak Mem: {mem_export / (1024 * 1024):6.2f} MB")

    total_time = t_terrain + t_dem + t_slope + t_rough + t_trav + t_export
    total_mem = max(m for _, m in results.values())
    results["total"] = (total_time, total_mem)
    print(f"  -----------------------------------------------------")
    print(f"  TOTAL CORE PIPELINE TIME   : {total_time * 1000:7.2f} ms ({total_time:.3f} s)")
    print(f"  MAX PEAK MEMORY ALLOCATED  : {total_mem:7.2f} MB")

    return results


def run_all_benchmarks():
    print("=" * 60)
    print("  LUNAPATH-4D PERFORMANCE BENCHMARK SUITE")
    print("=" * 60)

    bench_results = {}
    for size in [256, 512, 1024]:
        bench_results[size] = benchmark_resolution(size, size, runs=3)

    return bench_results


if __name__ == "__main__":
    run_all_benchmarks()

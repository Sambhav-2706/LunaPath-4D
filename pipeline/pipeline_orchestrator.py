"""
LunaPath-4D: Master Unified Terrain & Data Pipeline Orchestrator
Role: Member 1 — Terrain & Data Engineering

Executes the complete 8-stage terrain engineering pipeline in strict chronological sequence:
  Stage 1: Generate synthetic lunar terrain (fBm noise + empirical non-circular impact craters).
  Stage 2: Create, validate, and store the Digital Elevation Model (DEM) and GeoTIFF raster.
  Stage 3: Perform hypsometric elevation analysis (relief statistics, quantiles, distributions).
  Stage 4: Calculate 2D topographic slope via Horn's method and identify critical slope hazards.
  Stage 5: Calculate surface roughness (moving-window RMS height deviation Rq).
  Stage 6: Calculate rover traversability (4 discrete safety classes and continuous A* cost grid).
  Stage 7: Generate the complete publication-quality scientific visualization suite.
  Stage 8: Export all binary arrays, GeoTIFF, hazard catalogs, and versioned metadata contracts.
"""

import sys
import argparse
from pathlib import Path
from typing import Dict, Any, Optional
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
    DEFAULT_LARGE_CRATERS,
    DEFAULT_MEDIUM_CRATERS,
    DEFAULT_SMALL_CRATERS,
    MAX_SAFE_SLOPE_DEG,
    CRITICAL_ROUGHNESS_M,
    ROVER_SAFETY_MARGIN_CELLS
)
from pipeline.terrain_generation import generate_synthetic_terrain
from pipeline.dem_manager import DigitalElevationModel
from pipeline.elevation_analysis import (
    compute_elevation_statistics,
    render_elevation_heatmap,
    render_elevation_histogram,
    render_elevation_distribution_suite
)
from pipeline.slope_analysis import compute_slope, analyze_slope
from pipeline.roughness_analysis import compute_roughness, analyze_roughness
from pipeline.traversability_analysis import (
    classify_traversability,
    calculate_traversability_metrics,
    compute_traversability,
    summarize_traversability,
    compile_hazard_catalog,
    render_traversability_heatmap
)
from pipeline.terrain_visualizer import (
    render_scientific_elevation,
    render_scientific_slope,
    render_scientific_roughness,
    render_scientific_traversability,
    render_terrain_layers_comparison,
    render_dem_3d_surface,
    render_analytical_suite
)
from pipeline.crater_generator import generate_crater_comparison_visualizations
from pipeline.terrain_exporter import export_all_pipeline_artifacts


def run_full_pipeline(
    width: int = WIDTH,
    height: int = HEIGHT,
    cell_size: float = CELL_SIZE_METERS,
    seed: int = SEED,
    base_elevation: float = BASE_ELEVATION,
    output_dir: Path = DATA_DIR,
    large_craters: int = DEFAULT_LARGE_CRATERS,
    medium_craters: int = DEFAULT_MEDIUM_CRATERS,
    small_craters: int = DEFAULT_SMALL_CRATERS,
    max_safe_slope: float = MAX_SAFE_SLOPE_DEG,
    critical_roughness: float = CRITICAL_ROUGHNESS_M,
    safety_margin_cells: int = ROVER_SAFETY_MARGIN_CELLS
) -> Dict[str, Any]:
    """
    Execute the unified 8-stage terrain engineering pipeline.

    Args:
        width: Grid width in cells (default: 256).
        height: Grid height in cells (default: 256).
        cell_size: Physical cell resolution in meters (default: 10.0m).
        seed: Random seed for deterministic reproducibility (default: 42).
        base_elevation: Baseline reference elevation in meters (default: 120.0m).
        output_dir: Destination path for all export artifacts (default: web/public/data).
        large_craters: Count of large craters (default: 3).
        medium_craters: Count of medium craters (default: 7).
        small_craters: Count of small craters (default: 18).
        max_safe_slope: Rover climbing slope limit in degrees (default: 15.0 deg).
        critical_roughness: Severe micro-roughness limit in meters (default: 3.0m).
        safety_margin_cells: Dilation buffer around obstacles (default: 1 cell).

    Returns:
        Dictionary containing all generated analytical arrays, DEM instance, and export manifest.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("  LUNAPATH-4D: UNIFIED TERRAIN & DATA PIPELINE (MEMBER 1)")
    print("  Mission: Lunar South Pole Autonomous Rover Simulator")
    print(f"  Configuration: {width}x{height} grid, {cell_size}m/cell, seed={seed}")
    print("=" * 70)

    try:
        # =====================================================================
        # STAGE 1: Generate Synthetic Lunar Terrain
        # =====================================================================
        print("\n[1/8] STAGE 1: Generating synthetic lunar terrain...")
        dem_raw, craters_catalog = generate_synthetic_terrain(
            width=width,
            height=height,
            cell_size=cell_size,
            seed=seed,
            base_elevation=base_elevation,
            large_craters=large_craters,
            medium_craters=medium_craters,
            small_craters=small_craters
        )
        print(f"      ✓ Terrain base generated with {len(craters_catalog)} cataloged impact craters.")

        # =====================================================================
        # STAGE 2: Create and Save the DEM
        # =====================================================================
        print("\n[2/8] STAGE 2: Creating, validating, and saving Digital Elevation Model (DEM)...")
        dem_obj = DigitalElevationModel(
            dem_raw,
            cell_size_meters=cell_size,
            base_elevation=base_elevation
        )
        dem_obj.validate()
        dem = dem_obj.data

        # Save GeoTIFF raster
        geotiff_path = output_dir / "dem.tif"
        if dem_obj.save_geotiff(geotiff_path):
            print(f"      ✓ Geospatial GeoTIFF saved: {geotiff_path.name}")
        print(f"      ✓ DEM validated ({dem.shape[1]}x{dem.shape[0]} float32, range: {dem.min():.2f}m to {dem.max():.2f}m).")

        # =====================================================================
        # STAGE 3: Perform Elevation Analysis
        # =====================================================================
        print("\n[3/8] STAGE 3: Performing hypsometric elevation analysis...")
        elev_analysis = compute_elevation_statistics(dem)
        print(f"      ✓ Elevation relief: {elev_analysis['min_elevation_m']:.2f}m to {elev_analysis['max_elevation_m']:.2f}m "
              f"(Span: {elev_analysis['total_relief_m']:.2f}m, Mean: {elev_analysis['mean_elevation_m']:.2f}m).")

        # =====================================================================
        # STAGE 4: Calculate Slope
        # =====================================================================
        print("\n[4/8] STAGE 4: Calculating 2D topographic slope via Horn's gradient method...")
        slope = compute_slope(dem, cell_size=cell_size)
        slope_analysis = analyze_slope(slope, max_safe_slope=max_safe_slope)
        print(f"      ✓ Slope calculated: Mean = {slope_analysis['mean_slope_deg']:.2f}°, "
              f"Max = {slope_analysis['max_slope_deg']:.2f}°, "
              f"Hazardous (> {max_safe_slope}°) = {slope_analysis['hazard_percentage']:.2f}% of area.")

        # =====================================================================
        # STAGE 5: Calculate Roughness
        # =====================================================================
        print("\n[5/8] STAGE 5: Calculating surface roughness (moving-window RMS height deviation)...")
        roughness = compute_roughness(dem, window_size=5)
        rough_analysis = analyze_roughness(roughness, critical_threshold=critical_roughness)
        print(f"      ✓ Surface roughness: Mean = {rough_analysis['mean_roughness_m']:.2f}m, "
              f"Max = {rough_analysis['max_roughness_m']:.2f}m.")

        # =====================================================================
        # STAGE 6: Calculate Traversability
        # =====================================================================
        print("\n[6/8] STAGE 6: Calculating rover traversability safety tiers & continuous cost grid...")
        # A. 4-tier discrete classification (SAFE, MODERATE, DIFFICULT, UNSAFE)
        classified_traversability = classify_traversability(dem, slope, roughness)
        trav_classification = calculate_traversability_metrics(classified_traversability)

        # B. Continuous cost map with safety margin dilation for Member 3 pathfinder
        traversability, raw_obstacles, inflated_obstacles = compute_traversability(
            slope,
            roughness,
            max_safe_slope=max_safe_slope,
            critical_roughness=critical_roughness,
            safety_margin_cells=safety_margin_cells
        )
        trav_summary = summarize_traversability(traversability)
        hazards = compile_hazard_catalog(craters_catalog, slope, raw_obstacles, cell_size=cell_size)

        print(f"      ✓ 4-Tier Classification: SAFE={trav_classification['safe']['percentage']:.1f}%, "
              f"MODERATE={trav_classification['moderate']['percentage']:.1f}%, "
              f"DIFFICULT={trav_classification['difficult']['percentage']:.1f}%, "
              f"UNSAFE={trav_classification['unsafe']['percentage']:.1f}%.")
        print(f"      ✓ Continuous A* Cost Map: {trav_summary['passable_percentage']:.1f}% passable, "
              f"{trav_summary['blocked_obstacle_percentage']:.1f}% blocked obstacles.")
        print(f"      ✓ Hazard Catalog: {len(hazards)} geographic hazards identified.")

        # =====================================================================
        # STAGE 7: Generate All Visualizations
        # =====================================================================
        print("\n[7/8] STAGE 7: Generating complete scientific visualization suite...")
        # Individual analytical layers
        render_scientific_elevation(dem, output_dir / "elevation_scientific.png", cell_size=cell_size)
        render_scientific_slope(slope, output_dir / "slope_scientific.png", cell_size=cell_size, max_safe_slope=max_safe_slope)
        render_scientific_roughness(roughness, output_dir / "roughness_scientific.png", cell_size=cell_size, critical_threshold=critical_roughness)
        render_scientific_traversability(classified_traversability, output_dir / "traversability_scientific.png", cell_size=cell_size)
        render_traversability_heatmap(classified_traversability, output_dir / "traversability_heatmap.png", cell_size=cell_size)

        # Multi-layer synchronized dashboard & 3D mesh
        render_terrain_layers_comparison(dem, slope, roughness, classified_traversability, output_dir / "terrain_layers_comparison.png", cell_size=cell_size, max_safe_slope=max_safe_slope)
        render_dem_3d_surface(dem, output_dir / "terrain_surface_3d.png", cell_size=cell_size)
        render_analytical_suite(dem, slope, roughness, traversability, output_dir / "terrain_analysis.png", max_safe_slope=max_safe_slope)

        # Elevation statistical plots & crater morphometry comparisons
        render_elevation_heatmap(dem, output_dir / "terrain_preview.png")
        render_elevation_heatmap(dem, output_dir / "terrain_elevation_2d.png")
        render_elevation_heatmap(dem, output_dir / "elevation_heatmap.png")
        render_elevation_histogram(dem, output_dir / "elevation_histogram.png")
        render_elevation_distribution_suite(dem, output_dir / "elevation_distribution.png")
        generate_crater_comparison_visualizations(output_dir, seed=seed)
        print("      ✓ 12 scientific figures and comparative charts successfully rendered to output directory.")

        # =====================================================================
        # STAGE 8: Export All Terrain Data & Contracts
        # =====================================================================
        print("\n[8/8] STAGE 8: Exporting binary arrays, NumPy files, and versioned contract metadata...")
        manifest = export_all_pipeline_artifacts(
            output_dir=output_dir,
            dem=dem,
            slope=slope,
            rough=roughness,
            traversability=traversability,
            craters=craters_catalog,
            hazards=hazards,
            elev_analysis=elev_analysis,
            slope_analysis=slope_analysis,
            rough_analysis=rough_analysis,
            trav_summary=trav_summary,
            classified_traversability=classified_traversability,
            classification_metrics=trav_classification,
            cell_size_meters=cell_size,
            seed=seed,
            base_elevation=base_elevation
        )
        print(f"      ✓ Serialized {len(manifest)} data contract artifacts (dem.bin, slope.bin, rough.bin, traversability.bin, meta.json).")

        # =====================================================================
        # Summary Report
        # =====================================================================
        print("\n" + "=" * 70)
        print("  PIPELINE EXECUTION COMPLETE — SUMMARY")
        print("=" * 70)
        print(f"  Extent                : {width} x {height} cells ({cell_size} m/cell -> {width * cell_size / 1000.0:.2f} km x {height * cell_size / 1000.0:.2f} km)")
        print(f"  Elevation Relief      : {elev_analysis['min_elevation_m']:.2f} m to {elev_analysis['max_elevation_m']:.2f} m (Delta: {elev_analysis['total_relief_m']:.2f} m)")
        print(f"  Mean Slope            : {slope_analysis['mean_slope_deg']:.2f}° (Max: {slope_analysis['max_slope_deg']:.2f}°)")
        print(f"  Mean Roughness        : {rough_analysis['mean_roughness_m']:.2f} m (Max: {rough_analysis['max_roughness_m']:.2f} m)")
        print(f"  Traversability Tiers  : Safe={trav_classification['safe']['percentage']:.1f}%, Moderate={trav_classification['moderate']['percentage']:.1f}%, Difficult={trav_classification['difficult']['percentage']:.1f}%, Unsafe={trav_classification['unsafe']['percentage']:.1f}%")
        print(f"  Total Hazards         : {len(hazards)} (Craters: {len(craters_catalog)})")
        print(f"  Export Destination    : {output_dir.resolve()}")
        print("=" * 70 + "\n")

        return {
            "dem": dem,
            "dem_obj": dem_obj,
            "slope": slope,
            "roughness": roughness,
            "classified_traversability": classified_traversability,
            "traversability": traversability,
            "craters": craters_catalog,
            "hazards": hazards,
            "elevation_analysis": elev_analysis,
            "slope_analysis": slope_analysis,
            "roughness_analysis": rough_analysis,
            "traversability_classification": trav_classification,
            "traversability_summary": trav_summary,
            "manifest": manifest
        }

    except Exception as e:
        print(f"\n[ERROR] Unified Pipeline execution failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        raise


def parse_arguments() -> argparse.Namespace:
    """Parse command line parameters for configurable pipeline execution."""
    parser = argparse.ArgumentParser(
        description="LunaPath-4D Member 1: Unified Lunar Terrain & Data Engineering Pipeline"
    )
    parser.add_argument("--width", type=int, default=WIDTH, help=f"Grid width in cells (default: {WIDTH})")
    parser.add_argument("--height", type=int, default=HEIGHT, help=f"Grid height in cells (default: {HEIGHT})")
    parser.add_argument("--cell-size", type=float, default=CELL_SIZE_METERS, help=f"Horizontal cell spacing in meters (default: {CELL_SIZE_METERS})")
    parser.add_argument("--seed", type=int, default=SEED, help=f"Random seed for reproducibility (default: {SEED})")
    parser.add_argument("--base-elevation", type=float, default=BASE_ELEVATION, help=f"Baseline elevation in meters (default: {BASE_ELEVATION})")
    parser.add_argument("--output-dir", type=str, default=str(DATA_DIR), help="Output directory path")
    parser.add_argument("--large-craters", type=int, default=DEFAULT_LARGE_CRATERS, help="Number of large impact craters")
    parser.add_argument("--medium-craters", type=int, default=DEFAULT_MEDIUM_CRATERS, help="Number of medium impact craters")
    parser.add_argument("--small-craters", type=int, default=DEFAULT_SMALL_CRATERS, help="Number of small impact craters")
    parser.add_argument("--max-safe-slope", type=float, default=MAX_SAFE_SLOPE_DEG, help="Rover slope limit in degrees")
    parser.add_argument("--critical-roughness", type=float, default=CRITICAL_ROUGHNESS_M, help="Critical roughness limit in meters")
    parser.add_argument("--safety-margin", type=int, default=ROVER_SAFETY_MARGIN_CELLS, help="Safety margin dilation in cells")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_arguments()
    run_full_pipeline(
        width=args.width,
        height=args.height,
        cell_size=args.cell_size,
        seed=args.seed,
        base_elevation=args.base_elevation,
        output_dir=Path(args.output_dir),
        large_craters=args.large_craters,
        medium_craters=args.medium_craters,
        small_craters=args.small_craters,
        max_safe_slope=args.max_safe_slope,
        critical_roughness=args.critical_roughness,
        safety_margin_cells=args.safety_margin
    )

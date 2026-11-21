"""
Module 9: Terrain Data Exporter & Contract Validation
Serializes binary arrays (<f4 little-endian), NumPy files, and comprehensive JSON metadata
conforming to LunaPath-4D team data contracts.
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional
import numpy as np
from .config import (
    WIDTH,
    HEIGHT,
    CELL_SIZE_METERS,
    GRID_WIDTH_METERS,
    GRID_HEIGHT_METERS,
    ORIGIN_LATITUDE_DEG,
    ORIGIN_LONGITUDE_DEG,
    LUNAR_REGION,
    SEED,
    MAX_SAFE_SLOPE_DEG,
    CRITICAL_ROUGHNESS_M,
    ROVER_SAFETY_MARGIN_CELLS,
    ROVER_CLASS,
    ROVER_MASS_KG,
    ROVER_WHEEL_COUNT,
    ROVER_NOMINAL_SPEED_MPS
)


def export_binary_array(array: np.ndarray, filepath: Path) -> Path:
    """Export NumPy array as contiguous little-endian float32 binary file with zero copy when possible."""
    filepath = Path(filepath)
    if array.dtype == np.dtype("<f4") and array.flags.c_contiguous:
        array.tofile(filepath)
    else:
        np.ascontiguousarray(array, dtype="<f4").tofile(filepath)
    return filepath


def build_metadata_contract(
    elev_analysis: Dict[str, Any],
    slope_analysis: Dict[str, Any],
    rough_analysis: Dict[str, Any],
    traversability_summary: Dict[str, float],
    craters: List[Dict],
    hazards: List[Dict],
    width: int = WIDTH,
    height: int = HEIGHT,
    cell_size_meters: float = CELL_SIZE_METERS,
    seed: int = SEED,
    base_elevation: float = 120.0,
    max_safe_slope: float = MAX_SAFE_SLOPE_DEG,
    critical_roughness: float = CRITICAL_ROUGHNESS_M,
    safety_margin_cells: int = ROVER_SAFETY_MARGIN_CELLS
) -> Dict[str, Any]:
    """
    Assemble complete versioned metadata payload adhering to LunaPath-4D Section 7 data contract
    and cross-module integration requirements for Members 2, 3, and 4.
    """
    grid_width_meters = width * cell_size_meters
    grid_height_meters = height * cell_size_meters

    return {
        "project": "LunaPath-4D",
        "name": "LunaPath Synthetic Lunar Polar Terrain",
        "schema_version": "1.0.0",
        "metadata_version": "1.0.0",
        "source": "Procedural lunar synthesis (multi-octave fBm + power-law cratering)",
        "is_synthetic": True,
        "seed": seed,

        # 1. Grid Dimensions & Spacing
        "grid_width": width,
        "grid_height": height,
        "width": width,
        "height": height,
        "grid_size": [width, height],
        "grid_shape": [height, width],
        "cell_size_meters": cell_size_meters,
        "horizontal_cell_spacing": cell_size_meters,
        "horizontal_cell_spacing_meters": cell_size_meters,
        "grid_width_meters": grid_width_meters,
        "grid_height_meters": grid_height_meters,
        "extent_km": [grid_width_meters / 1000.0, grid_height_meters / 1000.0],
        "total_cells": width * height,

        # 2. Units & Mathematical Definitions
        "elevation_units": "meters",
        "slope_units": "degrees",
        "roughness_units": "meters",
        "roughness_definition": "Moving-window Root-Mean-Square (RMS) height deviation (Rq) over local 5x5 neighborhood",
        "base_elevation_meters": base_elevation,

        # 3. Coordinate Conventions & Array Orientation
        "coordinate_convention": (
            "Local Topocentric Cartesian. Row index i represents Northing (South-to-North, +Y direction). "
            "Column index j represents Easting (West-to-East, +X direction). "
            "Grid Origin [row=0, col=0] is at the South-West (Bottom-Left) corner."
        ),
        "array_orientation": (
            "Row-major (C-contiguous): flat_index = row * width + col. "
            "Sequential binary memory traverses columns West-to-East first, then advances rows South-to-North."
        ),
        "origin_coordinates": {
            "latitude_deg": ORIGIN_LATITUDE_DEG,
            "longitude_deg": ORIGIN_LONGITUDE_DEG,
            "lunar_region": LUNAR_REGION,
            "datum": "Lunar Reference Sphere R = 1737.4 km"
        },

        # 4. Data Types & Formats
        "data_types": {
            "dem": "float32",
            "slope": "float32",
            "roughness": "float32",
            "traversability": "float32",
            "traversability_classified": "float32 (uint8 discrete classes 0-3)"
        },
        "data_format": {
            "data_type": "float32",
            "byte_order": "little_endian",
            "channels": 1,
            "bytes_per_element": 4,
            "total_bytes_per_file": width * height * 4
        },
        "nodata_representation": {
            "value": "NaN",
            "standard": "IEEE 754 floating point NaN",
            "numeric_fallback": -9999.0
        },
        "export_format": {
            "binary": "Raw little-endian IEEE 754 32-bit float (.bin)",
            "geospatial": "GeoTIFF (.tif)",
            "numpy": "NumPy array (.npy)",
            "metadata": "JSON formatted documents (.json)"
        },

        # 5. Member 2 Integration: Coordinate Transformation to Three.js World Space
        "three_js_coordinate_transform": {
            "description": "Formulas to convert grid coordinates (row, col) and elevation to Three.js world coordinates (X, Y, Z)",
            "world_X": "col * cell_size - (width - 1) * cell_size / 2",
            "world_Y": "(elevation - base_elevation) * vertical_exaggeration",
            "world_Z": "-(row * cell_size - (height - 1) * cell_size / 2)",
            "inverse_col": "round((world_X + (width - 1) * cell_size / 2) / cell_size)",
            "inverse_row": "round((-world_Z + (height - 1) * cell_size / 2) / cell_size)"
        },

        # 6. Member 3 Integration: Navigation & Pathfinding Contract
        "navigation_planner_contract": {
            "description": "Input specifications for Member 3 pathfinding algorithms",
            "traversability_binary": "traversability.bin",
            "cost_range": "[0.0, 1.0]",
            "impassable_obstacle_cost": 1.0,
            "max_climbing_slope_deg": max_safe_slope,
            "critical_roughness_m": critical_roughness,
            "safety_margin_cells": safety_margin_cells,
            "safety_margin_meters": safety_margin_cells * cell_size_meters,
            "neighbor_connectivity": 8,
            "cost_formula": "Cost(u, v) = dist(u, v) * (1.0 + alpha * traversability_cost[v])"
        },

        # 7. File Manifest
        "files": {
            "dem_binary": "dem.bin",
            "slope_binary": "slope.bin",
            "roughness_binary": "rough.bin",
            "traversability_binary": "traversability.bin",
            "traversability_classified_binary": "traversability_classified.bin",
            "dem_geotiff": "dem.tif",
            "dem_numpy": "dem.npy",
            "hazards_catalog": "hazards.json",
            "metadata": "terrain_meta.json",
            "metadata_alias": "meta.json",
            "preview_image": "terrain_preview.png",
            "scientific_comparison": "terrain_layers_comparison.png",
            "traversability_heatmap": "traversability_heatmap.png"
        },

        # 8. Rover Operational Constraints
        "rover_parameters": {
            "rover_class": ROVER_CLASS,
            "mass_kg": ROVER_MASS_KG,
            "wheel_count": ROVER_WHEEL_COUNT,
            "max_safe_slope_deg": max_safe_slope,
            "critical_roughness_m": critical_roughness,
            "safety_buffer_meters": safety_margin_cells * cell_size_meters,
            "nominal_speed_m_per_s": ROVER_NOMINAL_SPEED_MPS
        },

        # 9. Analysis Layers & Summary Statistics
        "elevation_analysis": elev_analysis,
        "slope_analysis": slope_analysis,
        "roughness_analysis": rough_analysis,
        "traversability_summary": traversability_summary,
        "crater_count": len(craters),
        "hazard_count": len(hazards),
        "craters": craters
    }


def export_all_pipeline_artifacts(
    output_dir: Path,
    dem: np.ndarray,
    slope: np.ndarray,
    rough: np.ndarray,
    traversability: np.ndarray,
    craters: List[Dict],
    hazards: List[Dict],
    elev_analysis: Dict[str, Any],
    slope_analysis: Dict[str, Any],
    rough_analysis: Dict[str, Any],
    trav_summary: Dict[str, float],
    classified_traversability: Optional[np.ndarray] = None,
    classification_metrics: Optional[Dict[str, Any]] = None,
    cell_size_meters: float = CELL_SIZE_METERS,
    seed: int = SEED,
    base_elevation: float = 120.0
) -> Dict[str, Path]:
    """Write all binary and JSON assets into output directory and return manifest."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    height, width = dem.shape
    manifest = {}

    # 1. Binary files
    manifest["dem_bin"] = export_binary_array(dem, output_dir / "dem.bin")
    manifest["slope_bin"] = export_binary_array(slope, output_dir / "slope.bin")
    manifest["rough_bin"] = export_binary_array(rough, output_dir / "rough.bin")
    manifest["trav_bin"] = export_binary_array(traversability, output_dir / "traversability.bin")

    if classified_traversability is not None:
        manifest["trav_class_bin"] = export_binary_array(
            classified_traversability.astype(np.float32),
            output_dir / "traversability_classified.bin"
        )

    # 2. NumPy file
    npy_path = output_dir / "dem.npy"
    np.save(npy_path, dem)
    manifest["dem_npy"] = npy_path

    # 3. Hazard catalog
    hazards_path = output_dir / "hazards.json"
    with open(hazards_path, "w", encoding="utf-8") as f:
        json.dump(hazards, f, indent=4)
    manifest["hazards_json"] = hazards_path

    # 4. Metadata JSON (both terrain_meta.json and meta.json alias)
    meta_payload = build_metadata_contract(
        elev_analysis, slope_analysis, rough_analysis,
        trav_summary, craters, hazards,
        width=width,
        height=height,
        cell_size_meters=cell_size_meters,
        seed=seed,
        base_elevation=base_elevation
    )
    if classification_metrics is not None:
        meta_payload["traversability_classification"] = classification_metrics

    meta_path = output_dir / "terrain_meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta_payload, f, indent=4)
    manifest["terrain_meta"] = meta_path

    alias_path = output_dir / "meta.json"
    with open(alias_path, "w", encoding="utf-8") as f:
        json.dump(meta_payload, f, indent=4)
    manifest["meta_alias"] = alias_path

    return manifest

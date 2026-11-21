"""
Module 7: Terrain Traversability Analysis & Safety Classification
Classifies lunar terrain into discrete rover safety tiers based on topographic slope,
surface micro-roughness, and data validity.

Traversability Classification Rules:
- Class 0: SAFE (Flat, smooth regolith plains; nominal rover driving)
- Class 1: MODERATE (Gentle slopes or moderate pebbles; minor power/steering cost)
- Class 2: DIFFICULT (Challenging slopes 10-15 deg or rough rocky regolith; requires caution)
- Class 3: UNSAFE (Slopes > 15 deg exceeding rover climbing limit, severe roughness > 3m,
                    crater drop-offs, or invalid/missing data cells; strict no-go hazard)

Mathematical Combination Logic:
Cell_Class(i, j) = max(Slope_Class(i, j), Roughness_Class(i, j))
If any cell is invalid (NaN, Inf in DEM, slope, or roughness), it is strictly assigned Class 3 (UNSAFE).

Limitations:
- This module performs kinematic terrain hazard classification based on orbital DEM geometry.
- It does NOT compute rover trajectories, optimal routes, A* path planning, or dynamic slip.
- Path planning and autonomous navigation decisions belong to Member 3.
"""

from typing import Tuple, List, Dict, Any, Optional
from pathlib import Path
import numpy as np
import scipy.ndimage as ndimage
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm
import matplotlib.patches as mpatches

try:
    from .config import (
        CELL_SIZE_METERS,
        MAX_SAFE_SLOPE_DEG,
        CRITICAL_ROUGHNESS_M,
        ROVER_SAFETY_MARGIN_CELLS,
        WIDTH,
        HEIGHT,
        DATA_DIR,
    )
except (ImportError, ValueError):
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from config import (
        CELL_SIZE_METERS,
        MAX_SAFE_SLOPE_DEG,
        CRITICAL_ROUGHNESS_M,
        ROVER_SAFETY_MARGIN_CELLS,
        WIDTH,
        HEIGHT,
        DATA_DIR,
    )

# Default Configurable Classification Thresholds
DEFAULT_TRAVERSABILITY_THRESHOLDS = {
    "slope_deg": {
        "safe_max": 5.0,         # 0 to 5 deg: SAFE
        "moderate_max": 10.0,    # 5 to 10 deg: MODERATE
        "difficult_max": 15.0    # 10 to 15 deg: DIFFICULT (above 15 deg: UNSAFE)
    },
    "roughness_m": {
        "safe_max": 0.8,         # 0 to 0.8 m: SAFE
        "moderate_max": 1.8,     # 0.8 to 1.8 m: MODERATE
        "difficult_max": 3.0     # 1.8 to 3.0 m: DIFFICULT (above 3.0 m: UNSAFE)
    }
}

CLASS_LABELS = {
    0: "SAFE",
    1: "MODERATE",
    2: "DIFFICULT",
    3: "UNSAFE"
}

CLASS_COLORS = {
    0: "#2ea043",  # Green
    1: "#dbab09",  # Yellow
    2: "#f0883e",  # Orange
    3: "#da3633"   # Red
}


def classify_traversability(
    dem: np.ndarray,
    slope: np.ndarray,
    roughness: np.ndarray,
    thresholds: Optional[Dict[str, Dict[str, float]]] = None
) -> np.ndarray:
    """
    Classify each terrain cell into discrete rover traversability safety tiers:
    0 = SAFE, 1 = MODERATE, 2 = DIFFICULT, 3 = UNSAFE.

    Args:
        dem: 2D elevation grid (meters).
        slope: 2D slope grid (degrees).
        roughness: 2D local roughness grid (meters).
        thresholds: Optional custom dictionary with 'slope_deg' and 'roughness_m' limits.

    Returns:
        2D integer array (uint8) of traversability classes [0, 1, 2, 3].
    """
    if not isinstance(dem, np.ndarray) or not isinstance(slope, np.ndarray) or not isinstance(roughness, np.ndarray):
        raise TypeError("dem, slope, and roughness must all be NumPy arrays.")
    if dem.shape != slope.shape or dem.shape != roughness.shape:
        raise ValueError(f"Shape mismatch: dem={dem.shape}, slope={slope.shape}, roughness={roughness.shape}")

    th = thresholds if thresholds is not None else DEFAULT_TRAVERSABILITY_THRESHOLDS

    s_safe = float(th["slope_deg"]["safe_max"])
    s_mod = float(th["slope_deg"]["moderate_max"])
    s_diff = float(th["slope_deg"]["difficult_max"])

    r_safe = float(th["roughness_m"]["safe_max"])
    r_mod = float(th["roughness_m"]["moderate_max"])
    r_diff = float(th["roughness_m"]["difficult_max"])

    # 1. Identify valid and invalid cells
    valid_mask = np.isfinite(dem) & np.isfinite(slope) & np.isfinite(roughness)

    # 2. Slope classification (efficient tiered assignment)
    slope_class = np.full(slope.shape, 3, dtype=np.uint8)
    slope_class[slope <= s_diff] = 2
    slope_class[slope < s_mod] = 1
    slope_class[slope < s_safe] = 0

    # 3. Roughness classification (efficient tiered assignment)
    rough_class = np.full(roughness.shape, 3, dtype=np.uint8)
    rough_class[roughness <= r_diff] = 2
    rough_class[roughness < r_mod] = 1
    rough_class[roughness < r_safe] = 0

    # 4. Multi-factor combination: max severity of slope and roughness
    combined_class = np.maximum(slope_class, rough_class)

    # 5. Invalid cells are strictly assigned UNSAFE (Class 3)
    combined_class[~valid_mask] = 3

    return combined_class


def calculate_traversability_metrics(classified_grid: np.ndarray) -> Dict[str, Any]:
    """Calculate cell counts and percentages across the 4 traversability tiers using single-pass bincount."""
    total = float(classified_grid.size)

    counts = np.bincount(classified_grid.ravel(), minlength=4)
    safe_count = int(counts[0])
    mod_count = int(counts[1])
    diff_count = int(counts[2])
    unsafe_count = int(counts[3])

    return {
        "safe": {
            "label": "SAFE",
            "code": 0,
            "count": safe_count,
            "percentage": round((safe_count / total) * 100.0, 2)
        },
        "moderate": {
            "label": "MODERATE",
            "code": 1,
            "count": mod_count,
            "percentage": round((mod_count / total) * 100.0, 2)
        },
        "difficult": {
            "label": "DIFFICULT",
            "code": 2,
            "count": diff_count,
            "percentage": round((diff_count / total) * 100.0, 2)
        },
        "unsafe": {
            "label": "UNSAFE",
            "code": 3,
            "count": unsafe_count,
            "percentage": round((unsafe_count / total) * 100.0, 2)
        },
        "total_cells": int(total),
        "passable_surface_pct": round(((safe_count + mod_count + diff_count) / total) * 100.0, 2),
        "blocked_surface_pct": round((unsafe_count / total) * 100.0, 2)
    }


def render_traversability_heatmap(
    classified_grid: np.ndarray,
    save_path: Path,
    cell_size: float = CELL_SIZE_METERS,
    title: str = "LunaPath-4D: Rover Terrain Traversability Classification"
) -> Path:
    """
    Generate high-resolution traversability heatmap with discrete color mapping
    and explicit four-class legend.
    """
    save_path = Path(save_path)
    height, width = classified_grid.shape
    extent = [0, width * cell_size / 1000.0, 0, height * cell_size / 1000.0]

    # Discrete colormap: Green, Yellow, Orange, Red
    cmap = ListedColormap([CLASS_COLORS[0], CLASS_COLORS[1], CLASS_COLORS[2], CLASS_COLORS[3]])
    norm = BoundaryNorm([-0.5, 0.5, 1.5, 2.5, 3.5], cmap.N)

    fig, ax = plt.subplots(figsize=(10, 8), dpi=150)
    img = ax.imshow(
        classified_grid,
        cmap=cmap,
        norm=norm,
        origin="lower",
        extent=extent,
        interpolation="nearest"
    )

    metrics = calculate_traversability_metrics(classified_grid)

    # Custom legend with class descriptions and percentage breakdown
    legend_patches = [
        mpatches.Patch(
            color=CLASS_COLORS[0],
            label=f"Class 0: SAFE ({metrics['safe']['percentage']:.1f}%) — Slope <5°, Roughness <0.8m"
        ),
        mpatches.Patch(
            color=CLASS_COLORS[1],
            label=f"Class 1: MODERATE ({metrics['moderate']['percentage']:.1f}%) — Slope 5-10°, Roughness 0.8-1.8m"
        ),
        mpatches.Patch(
            color=CLASS_COLORS[2],
            label=f"Class 2: DIFFICULT ({metrics['difficult']['percentage']:.1f}%) — Slope 10-15°, Roughness 1.8-3.0m"
        ),
        mpatches.Patch(
            color=CLASS_COLORS[3],
            label=f"Class 3: UNSAFE ({metrics['unsafe']['percentage']:.1f}%) — Slope >15°, Roughness >3.0m / Hazard"
        )
    ]

    ax.legend(
        handles=legend_patches,
        loc="upper right",
        framealpha=0.92,
        fontsize=9,
        title="Traversability Tiers",
        title_fontsize=10
    )

    ax.set_title(title, fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Easting / West-to-East (km)", fontsize=11)
    ax.set_ylabel("Northing / South-to-North (km)", fontsize=11)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path


# -------------------------------------------------------------
# Continuous Cost Computation (Data Contract for Member 3 Planner)
# -------------------------------------------------------------

def compute_traversability(
    slope_grid: np.ndarray,
    roughness_grid: np.ndarray,
    max_safe_slope: float = MAX_SAFE_SLOPE_DEG,
    critical_roughness: float = CRITICAL_ROUGHNESS_M,
    safety_margin_cells: int = ROVER_SAFETY_MARGIN_CELLS
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Compute normalized continuous traversability cost map [0.0 = ideal, 1.0 = impassable]
    and dilated obstacle mask for path planning data contract.
    """
    norm_slope_cost = np.clip((slope_grid / max_safe_slope) ** 2, 0.0, 1.0)
    norm_rough_cost = np.clip(roughness_grid / critical_roughness, 0.0, 1.0)

    base_cost = 0.75 * norm_slope_cost + 0.25 * norm_rough_cost
    raw_obstacles = (slope_grid > max_safe_slope) | (roughness_grid > critical_roughness)

    if safety_margin_cells > 0:
        struct = ndimage.generate_binary_structure(2, 1)
        inflated_obstacles = ndimage.binary_dilation(
            raw_obstacles,
            structure=struct,
            iterations=safety_margin_cells
        )
    else:
        inflated_obstacles = raw_obstacles

    traversability_cost = np.copy(base_cost)
    traversability_cost[inflated_obstacles] = 1.0
    traversability_cost = np.clip(traversability_cost, 0.0, 1.0).astype(np.float32)

    return traversability_cost, raw_obstacles, inflated_obstacles


def summarize_traversability(traversability_grid: np.ndarray) -> Dict[str, float]:
    """Calculate percentage distribution of continuous traversability grid."""
    total = float(traversability_grid.size)
    passable = float(np.sum(traversability_grid < 0.5))
    caution = float(np.sum((traversability_grid >= 0.5) & (traversability_grid < 1.0)))
    blocked = float(np.sum(traversability_grid >= 1.0))

    return {
        "passable_percentage": round((passable / total) * 100.0, 2),
        "caution_percentage": round((caution / total) * 100.0, 2),
        "blocked_obstacle_percentage": round((blocked / total) * 100.0, 2)
    }


def compile_hazard_catalog(
    craters_meta: List[Dict],
    slope_grid: np.ndarray,
    raw_obstacle_mask: np.ndarray,
    cell_size: float = CELL_SIZE_METERS
) -> List[Dict[str, Any]]:
    """Assemble structured hazard catalog combining craters and steep ridges."""
    hazards = []

    grid_h, grid_w = slope_grid.shape

    for c in craters_meta:
        cx_cell = int(np.clip(round(c["x"]), 0, grid_w - 1))
        cy_cell = int(np.clip(round(c["y"]), 0, grid_h - 1))
        local_slope = float(slope_grid[cy_cell, cx_cell])

        radius_cells = float(c.get("radius_cells", c.get("radius", 0.0)))
        radius_meters = float(c.get("radius_meters", radius_cells * cell_size))

        severity = "HIGH" if (radius_meters > 40.0 or local_slope > 15.0) else "MEDIUM"
        if radius_meters < 20.0:
            severity = "LOW"

        hazards.append({
            "id": c["id"],
            "type": "crater",
            "x": round(c["x"], 2),
            "y": round(c["y"], 2),
            "x_cell": round(c["x"], 2),
            "y_cell": round(c["y"], 2),
            "x_meters": round(c["x"] * cell_size, 2),
            "y_meters": round(c["y"] * cell_size, 2),
            "radius": round(radius_cells, 2),
            "radius_cells": round(radius_cells, 2),
            "radius_meters": round(radius_meters, 2),
            "depth_meters": c.get("depth_meters", 0.0),
            "severity": severity,
            "known_from_orbit": c.get("known_from_orbit", True)
        })

    labeled_cliffs, num_features = ndimage.label(raw_obstacle_mask)
    if num_features > 0:
        objects = ndimage.find_objects(labeled_cliffs)
        for i, sl in enumerate(objects):
            if sl is None:
                continue
            zone_mask = (labeled_cliffs[sl] == (i + 1))
            size = np.sum(zone_mask)
            if size >= 15:
                cy_slice, cx_slice = sl
                y_center = float(cy_slice.start + (cy_slice.stop - cy_slice.start) / 2.0)
                x_center = float(cx_slice.start + (cx_slice.stop - cx_slice.start) / 2.0)

                near_crater = any(
                    np.hypot(x_center - c["x"], y_center - c["y"]) <= (float(c.get("radius_cells", c.get("radius", 0.0))) * 1.2)
                    for c in craters_meta
                )
                if not near_crater:
                    hazards.append({
                        "id": f"CLIFF_{i + 1:03d}",
                        "type": "steep_ridge",
                        "x": round(x_center, 2),
                        "y": round(y_center, 2),
                        "x_cell": round(x_center, 2),
                        "y_cell": round(y_center, 2),
                        "x_meters": round(x_center * cell_size, 2),
                        "y_meters": round(y_center * cell_size, 2),
                        "radius": round(np.sqrt(size) * 0.5, 2),
                        "radius_meters": round(np.sqrt(size) * cell_size * 0.5, 2),
                        "depth_meters": 0.0,
                        "severity": "CRITICAL",
                        "known_from_orbit": True
                    })

    return hazards


def run_traversability_analysis(dem_path: Optional[Path] = None, output_dir: Path = DATA_DIR) -> Dict[str, Any]:
    """Execute standalone traversability classification and generate output heatmap."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if dem_path is None or not Path(dem_path).exists():
        dem_path = output_dir / "dem.bin"

    try:
        from .slope_analysis import compute_slope
        from .roughness_analysis import compute_roughness
    except (ImportError, ValueError):
        from slope_analysis import compute_slope
        from roughness_analysis import compute_roughness

    dem = np.fromfile(dem_path, dtype="<f4").reshape((HEIGHT, WIDTH))
    slope = compute_slope(dem, cell_size=CELL_SIZE_METERS)
    roughness = compute_roughness(dem, window_size=5)

    classified = classify_traversability(dem, slope, roughness)
    metrics = calculate_traversability_metrics(classified)
    heatmap_path = render_traversability_heatmap(classified, output_dir / "traversability_heatmap.png")

    print("\n" + "=" * 60)
    print("  LUNAPATH-4D TERRAIN TRAVERSABILITY CLASSIFICATION")
    print("=" * 60)
    print(f"Class 0 (SAFE)      : {metrics['safe']['count']:,} cells ({metrics['safe']['percentage']:.2f}%)")
    print(f"Class 1 (MODERATE)  : {metrics['moderate']['count']:,} cells ({metrics['moderate']['percentage']:.2f}%)")
    print(f"Class 2 (DIFFICULT) : {metrics['difficult']['count']:,} cells ({metrics['difficult']['percentage']:.2f}%)")
    print(f"Class 3 (UNSAFE)    : {metrics['unsafe']['count']:,} cells ({metrics['unsafe']['percentage']:.2f}%)")
    print("-" * 60)
    print(f"Passable Surface    : {metrics['passable_surface_pct']:.2f}%")
    print(f"Blocked Hazards     : {metrics['blocked_surface_pct']:.2f}%")
    print(f"Heatmap Saved       : {heatmap_path}")
    print("=" * 60 + "\n")

    return {
        "classified_grid": classified,
        "metrics": metrics,
        "heatmap": heatmap_path
    }


if __name__ == "__main__":
    run_traversability_analysis()

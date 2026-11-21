"""
Module 6: Terrain Surface Roughness Analysis
Quantifies local surface unevenness and micro-relief across configurable neighborhood windows.

Mathematical Definition & Documentation:
1. Definition of Roughness:
   Roughness is defined as the moving-window Root-Mean-Square (RMS) height deviation (Rq),
   also known as local elevation standard deviation over an odd-sized neighborhood window W x W:

   Rq(i, j) = sqrt( (1 / N) * sum_{(u, v) in N(i, j)} (z(u, v) - mu_local(i, j))^2 )
            = sqrt( max(0.0, E[z^2] - (E[z])^2) )

   where:
   - N(i, j) is the W x W spatial neighborhood centered at grid cell (i, j)
   - N = W * W (e.g. 25 cells for 5x5 window)
   - mu_local is the local arithmetic mean elevation: E[z]
   - E[z^2] is the local mean of squared elevations

2. Physical Units & Meaning:
   - Window size W: cells (e.g. W=5 cells * 10m/cell = 50m x 50m neighborhood footprint)
   - Elevation z: meters (m)
   - Roughness Rq: meters (m)
   - A completely flat surface has Rq = 0.0 m
   - Smooth lunar maria: Rq ~ 0.2 m to 0.8 m
   - Crater rims and boulder clusters: Rq ~ 2.0 m to 10.0+ m

3. Edge Handling:
   Boundary cells are handled with reflection mode ('reflect'), ensuring no artificial edge steps.
"""

from typing import Dict, Any, Optional
from pathlib import Path
import numpy as np
import scipy.ndimage as ndimage
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

try:
    from .config import CELL_SIZE_METERS, CRITICAL_ROUGHNESS_M, DATA_DIR
except (ImportError, ValueError):
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from config import CELL_SIZE_METERS, CRITICAL_ROUGHNESS_M, DATA_DIR


def compute_roughness(
    dem: np.ndarray,
    window_size: int = 5,
    mode: str = "reflect"
) -> np.ndarray:
    """
    Calculate moving-window root-mean-square (RMS) elevation deviation (local standard deviation).

    Args:
        dem: 2D NumPy array of elevations (meters). Original array is preserved.
        window_size: Neighborhood window dimension in cells (odd integer >= 3, default 5).
        mode: Boundary extension mode ('reflect', 'nearest', 'constant').

    Returns:
        2D float32 array of local roughness values in meters.
    """
    if not isinstance(dem, np.ndarray):
        raise TypeError(f"dem must be a NumPy array, got {type(dem)}")
    if dem.ndim != 2:
        raise ValueError(f"dem must be a 2D array, got shape {dem.shape}")
    if not isinstance(window_size, (int, np.integer)) or window_size < 3:
        raise ValueError(f"window_size must be an integer >= 3, got: {window_size}")
    if window_size % 2 == 0:
        raise ValueError(f"window_size should be an odd integer to center at cell, got: {window_size}")

    # Non-destructive: handle NaNs if present
    is_finite = np.isfinite(dem)
    has_invalid = not np.all(is_finite)

    if has_invalid:
        clean_dem = np.copy(dem).astype(np.float32)
        median_val = float(np.median(clean_dem[is_finite])) if np.any(is_finite) else 0.0
        clean_dem[~is_finite] = median_val
    else:
        clean_dem = dem if dem.dtype == np.float32 else dem.astype(np.float32)

    # Shift by central value to preserve high numerical precision in float32 without cancellation:
    # Var(X - c) == Var(X)
    center_val = float(np.mean(clean_dem))
    shifted = clean_dem - center_val

    # Fast moving-window variance: Var = E[X^2] - (E[X])^2
    mean_sq = ndimage.uniform_filter(shifted ** 2, size=window_size, mode=mode)
    sq_mean = ndimage.uniform_filter(shifted, size=window_size, mode=mode) ** 2

    variance = np.maximum(0.0, mean_sq - sq_mean)
    roughness = np.sqrt(variance).astype(np.float32)

    if has_invalid:
        roughness[~is_finite] = np.nan

    return roughness


def analyze_roughness(
    roughness_grid: np.ndarray,
    critical_threshold: float = CRITICAL_ROUGHNESS_M,
    num_bins: int = 40
) -> Dict[str, Any]:
    """
    Compute statistical distribution metrics and classify rover roughness hazard areas.
    """
    if not isinstance(roughness_grid, np.ndarray):
        raise TypeError(f"roughness_grid must be a NumPy array, got {type(roughness_grid)}")

    valid_mask = np.isfinite(roughness_grid)
    valid_rough = roughness_grid[valid_mask].astype(np.float64)

    if len(valid_rough) == 0:
        raise ValueError("Roughness grid contains zero valid finite values.")

    total_valid = len(valid_rough)
    total_cells = roughness_grid.size
    invalid_count = total_cells - total_valid

    r_min = float(np.min(valid_rough))
    r_max = float(np.max(valid_rough))
    r_mean = float(np.mean(valid_rough))
    r_median = float(np.median(valid_rough))
    r_std = float(np.std(valid_rough))

    # Frequency distribution
    counts, bin_edges = np.histogram(valid_rough, bins=num_bins, range=(0.0, max(r_max, 5.0)))
    bin_centers = 0.5 * (bin_edges[:-1] + bin_edges[1:])

    # Percentiles
    percentile_levels = [5, 10, 25, 50, 75, 90, 95]
    percentile_vals = np.percentile(valid_rough, percentile_levels)
    percentiles_dict = {f"p{lvl:02d}": float(v) for lvl, v in zip(percentile_levels, percentile_vals)}

    # Categorization
    smooth_cells = int(np.sum(valid_rough < 1.0))
    moderate_cells = int(np.sum((valid_rough >= 1.0) & (valid_rough < critical_threshold)))
    rough_cells = int(np.sum(valid_rough >= critical_threshold))

    return {
        "minimum_roughness_m": r_min,
        "maximum_roughness_m": r_max,
        "min_roughness_m": r_min,
        "max_roughness_m": r_max,
        "mean_roughness_m": r_mean,
        "median_roughness_m": r_median,
        "standard_deviation_m": r_std,
        "std_roughness_m": r_std,
        "critical_roughness_threshold_m": float(critical_threshold),
        "rough_cell_count": rough_cells,
        "rough_percentage": round((rough_cells / total_valid) * 100.0, 2),
        "total_valid_cells": total_valid,
        "invalid_cell_count": invalid_count,
        "units": "meters",
        "percentiles": percentiles_dict,
        "distribution": {
            "bin_edges_m": [float(b) for b in bin_edges],
            "bin_centers_m": [float(c) for c in bin_centers],
            "histogram_counts": [int(cnt) for cnt in counts]
        },
        "classification": {
            "smooth_under_1m_pct": round((smooth_cells / total_valid) * 100.0, 2),
            "moderate_1_to_3m_pct": round((moderate_cells / total_valid) * 100.0, 2),
            "severe_roughness_above_3m_pct": round((rough_cells / total_valid) * 100.0, 2)
        }
    }


def render_roughness_heatmap(
    roughness_grid: np.ndarray,
    save_path: Path,
    cell_size: float = CELL_SIZE_METERS,
    critical_threshold: float = CRITICAL_ROUGHNESS_M
) -> Path:
    """Generate 2D surface roughness heatmap with colorbar and kilometer axes."""
    save_path = Path(save_path)
    height, width = roughness_grid.shape
    extent = [0, width * cell_size / 1000.0, 0, height * cell_size / 1000.0]

    display_rough = np.copy(roughness_grid)
    display_rough[~np.isfinite(display_rough)] = np.nan

    fig, ax = plt.subplots(figsize=(10, 8), dpi=150)
    img = ax.imshow(
        display_rough,
        cmap="magma",
        origin="lower",
        extent=extent,
        vmin=0.0,
        vmax=max(5.0, float(np.nanmax(display_rough)))
    )

    if np.nanmax(display_rough) >= critical_threshold:
        ax.contour(
            display_rough,
            levels=[critical_threshold],
            colors="yellow",
            linewidths=1.3,
            extent=extent,
            origin="lower"
        )

    ax.set_title(f"LunaPath-4D: Surface Roughness (Yellow: {critical_threshold}m Hazard Threshold)", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Easting (km)", fontsize=11)
    ax.set_ylabel("Northing (km)", fontsize=11)

    cbar = fig.colorbar(img, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("RMS Roughness (meters)", fontsize=11)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path


def run_roughness_analysis(dem_path: Optional[Path] = None, output_dir: Path = DATA_DIR) -> Dict[str, Any]:
    """Execute roughness analysis standalone and output summary."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if dem_path is None or not Path(dem_path).exists():
        dem_path = output_dir / "dem.bin"

    if dem_path.suffix == ".bin":
        dem = np.fromfile(dem_path, dtype="<f4").reshape((256, 256))
    elif dem_path.suffix == ".npy":
        dem = np.load(dem_path)
    else:
        raise ValueError(f"Unsupported DEM format: {dem_path}")

    roughness = compute_roughness(dem, window_size=5)
    analysis = analyze_roughness(roughness, critical_threshold=CRITICAL_ROUGHNESS_M)
    heatmap_path = render_roughness_heatmap(roughness, output_dir / "roughness_heatmap.png")

    print("\n" + "=" * 60)
    print("  LUNAPATH-4D TERRAIN ROUGHNESS ANALYSIS")
    print("=" * 60)
    print(f"Minimum Roughness   : {analysis['minimum_roughness_m']:.2f} m")
    print(f"Maximum Roughness   : {analysis['maximum_roughness_m']:.2f} m")
    print(f"Mean Roughness      : {analysis['mean_roughness_m']:.2f} m")
    print(f"Median Roughness    : {analysis['median_roughness_m']:.2f} m")
    print(f"Std Deviation       : {analysis['standard_deviation_m']:.2f} m")
    print(f"Severe (>3m)        : {analysis['rough_percentage']}% of surface")
    print("-" * 60)
    print(f"Roughness Heatmap   : {heatmap_path}")
    print("=" * 60 + "\n")

    return {"roughness": roughness, "analysis": analysis, "heatmap": heatmap_path}


if __name__ == "__main__":
    run_roughness_analysis()

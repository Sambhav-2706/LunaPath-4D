"""
Module 5: Slope & Topographic Gradient Analysis
Calculates the topographic slope of each terrain cell from Digital Elevation Models.

Mathematical Formulation & Documentation:
1. Spatial Gradients:
   For an elevation grid z(x, y) with physical horizontal cell spacing Delta x and Delta y:
   - dz/dx: Rate of elevation change in East-West direction (meters / meter, dimensionless)
   - dz/dy: Rate of elevation change in South-North direction (meters / meter, dimensionless)

   Evaluated using second-order accurate central differences on the interior:
   dz/dx[i, j] = (z[i, j+1] - z[i, j-1]) / (2 * Delta x)
   dz/dy[i, j] = (z[i+1, j] - z[i-1, j]) / (2 * Delta y)
   and first/second-order one-sided differences at grid boundaries (via np.gradient).

2. Slope Magnitude (Gradient Vector Norm):
   S(i, j) = sqrt((dz/dx)^2 + (dz/dy)^2)   [rise over run, tangent of slope angle]

3. Slope Angle in Degrees:
   theta(i, j) = arctan(S(i, j)) * (180.0 / pi)
   - Range: [0.0 deg, 90.0 deg]
   - Flat ground: theta = 0.0 deg
   - 1:1 slope: theta = 45.0 deg
   - Vertical cliff: theta -> 90.0 deg

Units:
- Horizontal spacing: meters (m)
- Elevation: meters (m)
- Slope: degrees (deg)
"""

from typing import Dict, Any, Tuple, Optional, Union
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

try:
    from .config import CELL_SIZE_METERS, MAX_SAFE_SLOPE_DEG, DATA_DIR
except (ImportError, ValueError):
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from config import CELL_SIZE_METERS, MAX_SAFE_SLOPE_DEG, DATA_DIR


def compute_slope(
    dem: np.ndarray,
    cell_size: Union[float, Tuple[float, float]] = CELL_SIZE_METERS,
    method: str = "gradient"
) -> np.ndarray:
    """
    Calculate the 2D slope angle in degrees for each cell in the DEM.

    Args:
        dem: 2D NumPy array of elevations (meters). Original array is preserved.
        cell_size: Physical cell spacing in meters (scalar or (dy, dx)).
        method: "gradient" (NumPy central differences with boundary orders) or "horn" (3x3 weighted).

    Returns:
        2D float32 array of slope angles in degrees [0, 90].
    """
    if not isinstance(dem, np.ndarray):
        raise TypeError(f"dem must be a NumPy array, got {type(dem)}")
    if dem.ndim != 2:
        raise ValueError(f"dem must be a 2D array, got shape {dem.shape}")

    if isinstance(cell_size, (tuple, list)):
        dy, dx = float(cell_size[0]), float(cell_size[1])
    else:
        dy = dx = float(cell_size)

    if dx <= 0.0 or dy <= 0.0:
        raise ValueError(f"Cell size must be strictly positive, got dx={dx}, dy={dy}")

    # Non-destructive: work with finite copy only if NaNs/Infs exist
    is_finite = np.isfinite(dem)
    has_invalid = not np.all(is_finite)

    if has_invalid:
        clean_dem = np.copy(dem).astype(np.float32)
        median_val = float(np.median(clean_dem[is_finite])) if np.any(is_finite) else 0.0
        clean_dem[~is_finite] = median_val
    else:
        clean_dem = dem if dem.dtype == np.float32 else dem.astype(np.float32)

    if method == "horn":
        import scipy.ndimage as ndimage
        kernel_x = np.array([
            [-1,  0,  1],
            [-2,  0,  2],
            [-1,  0,  1]
        ], dtype=np.float32) / (8.0 * dx)

        kernel_y = np.array([
            [-1, -2, -1],
            [ 0,  0,  0],
            [ 1,  2,  1]
        ], dtype=np.float32) / (8.0 * dy)

        dz_dx = ndimage.convolve(clean_dem, kernel_x, mode="nearest")
        dz_dy = ndimage.convolve(clean_dem, kernel_y, mode="nearest")
    else:
        # np.gradient returns [grad_along_axis_0 (Y), grad_along_axis_1 (X)]
        dz_dy, dz_dx = np.gradient(clean_dem, dy, dx)

    # Slope magnitude S = sqrt((dz/dx)^2 + (dz/dy)^2)
    slope_magnitude = np.hypot(dz_dx, dz_dy)

    # Convert to degrees: theta = rad2deg(arctan(S))
    slope_degrees = np.rad2deg(np.arctan(slope_magnitude)).astype(np.float32)

    # If invalid cells were present, preserve NaN in slope output
    if has_invalid:
        slope_degrees[~is_finite] = np.nan

    return slope_degrees


def analyze_slope(
    slope_grid: np.ndarray,
    max_safe_slope: float = MAX_SAFE_SLOPE_DEG,
    num_bins: int = 40
) -> Dict[str, Any]:
    """
    Calculate statistical slope metrics, frequency distribution, and rover hazard classifications.
    """
    if not isinstance(slope_grid, np.ndarray):
        raise TypeError(f"slope_grid must be a NumPy array, got {type(slope_grid)}")

    valid_mask = np.isfinite(slope_grid)
    valid_slopes = slope_grid[valid_mask].astype(np.float64)

    if len(valid_slopes) == 0:
        raise ValueError("Slope grid contains zero valid finite values.")

    total_valid = len(valid_slopes)
    total_cells = slope_grid.size
    invalid_count = total_cells - total_valid

    s_min = float(np.min(valid_slopes))
    s_max = float(np.max(valid_slopes))
    s_mean = float(np.mean(valid_slopes))
    s_median = float(np.median(valid_slopes))
    s_std = float(np.std(valid_slopes))

    # Frequency distribution
    counts, bin_edges = np.histogram(valid_slopes, bins=num_bins, range=(0.0, max(s_max, 30.0)))
    bin_centers = 0.5 * (bin_edges[:-1] + bin_edges[1:])

    # Percentiles
    percentile_levels = [5, 10, 25, 50, 75, 90, 95]
    percentile_vals = np.percentile(valid_slopes, percentile_levels)
    percentiles_dict = {f"p{lvl:02d}": float(v) for lvl, v in zip(percentile_levels, percentile_vals)}

    # Classification relative to rover climbing capabilities
    flat_cells = int(np.sum(valid_slopes < 5.0))
    moderate_cells = int(np.sum((valid_slopes >= 5.0) & (valid_slopes < 10.0)))
    caution_cells = int(np.sum((valid_slopes >= 10.0) & (valid_slopes <= max_safe_slope)))
    hazardous_cells = int(np.sum(valid_slopes > max_safe_slope))
    extreme_cells = int(np.sum(valid_slopes > 25.0))

    return {
        "minimum_slope_deg": s_min,
        "maximum_slope_deg": s_max,
        "min_slope_deg": s_min,
        "max_slope_deg": s_max,
        "mean_slope_deg": s_mean,
        "median_slope_deg": s_median,
        "standard_deviation_deg": s_std,
        "std_slope_deg": s_std,
        "critical_slope_threshold_deg": float(max_safe_slope),
        "hazard_cell_count": hazardous_cells,
        "hazard_percentage": round((hazardous_cells / total_valid) * 100.0, 2),
        "total_valid_cells": total_valid,
        "invalid_cell_count": invalid_count,
        "units": "degrees",
        "percentiles": percentiles_dict,
        "distribution": {
            "bin_edges_deg": [float(b) for b in bin_edges],
            "bin_centers_deg": [float(c) for c in bin_centers],
            "histogram_counts": [int(cnt) for cnt in counts]
        },
        "classification": {
            "flat_under_5deg_pct": round((flat_cells / total_valid) * 100.0, 2),
            "moderate_5_to_10deg_pct": round((moderate_cells / total_valid) * 100.0, 2),
            "caution_10_to_15deg_pct": round((caution_cells / total_valid) * 100.0, 2),
            "hazardous_above_15deg_pct": round((hazardous_cells / total_valid) * 100.0, 2),
            "extreme_above_25deg_pct": round((extreme_cells / total_valid) * 100.0, 2)
        }
    }


def render_slope_heatmap(
    slope_grid: np.ndarray,
    save_path: Path,
    cell_size: float = CELL_SIZE_METERS,
    max_safe_slope: float = MAX_SAFE_SLOPE_DEG
) -> Path:
    """
    Generate 2D slope heatmap with cyan contour line highlighting critical rover slope threshold.
    """
    save_path = Path(save_path)
    height, width = slope_grid.shape
    extent = [0, width * cell_size / 1000.0, 0, height * cell_size / 1000.0]

    display_slope = np.copy(slope_grid)
    display_slope[~np.isfinite(display_slope)] = np.nan

    fig, ax = plt.subplots(figsize=(10, 8), dpi=150)
    img = ax.imshow(
        display_slope,
        cmap="inferno",
        origin="lower",
        extent=extent,
        vmin=0.0,
        vmax=max(30.0, float(np.nanmax(display_slope)))
    )

    # Cyan contour at critical slope threshold
    if np.nanmax(display_slope) >= max_safe_slope:
        ax.contour(
            display_slope,
            levels=[max_safe_slope],
            colors="cyan",
            linewidths=1.5,
            extent=extent,
            origin="lower"
        )

    ax.set_title(f"LunaPath-4D: Topographic Slope Map (Cyan: {max_safe_slope}° Rover Limit)", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Easting (km)", fontsize=11)
    ax.set_ylabel("Northing (km)", fontsize=11)

    cbar = fig.colorbar(img, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("Slope Angle (degrees)", fontsize=11)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path


def run_slope_analysis(dem_path: Optional[Path] = None, output_dir: Path = DATA_DIR) -> Dict[str, Any]:
    """Execute slope analysis standalone and output summary."""
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

    slope = compute_slope(dem, cell_size=CELL_SIZE_METERS)
    analysis = analyze_slope(slope, max_safe_slope=MAX_SAFE_SLOPE_DEG)
    heatmap_path = render_slope_heatmap(slope, output_dir / "slope_heatmap.png")

    print("\n" + "=" * 60)
    print("  LUNAPATH-4D TOPOGRAPHIC SLOPE ANALYSIS")
    print("=" * 60)
    print(f"Minimum Slope       : {analysis['minimum_slope_deg']:.2f}°")
    print(f"Maximum Slope       : {analysis['maximum_slope_deg']:.2f}°")
    print(f"Mean Slope          : {analysis['mean_slope_deg']:.2f}°")
    print(f"Median Slope        : {analysis['median_slope_deg']:.2f}°")
    print(f"Std Deviation       : {analysis['standard_deviation_deg']:.2f}°")
    print(f"Hazardous (>15°)    : {analysis['hazard_percentage']}% of surface")
    print(f"Extreme (>25°)      : {analysis['classification']['extreme_above_25deg_pct']}% of surface")
    print("-" * 60)
    print(f"Slope Heatmap Saved : {heatmap_path}")
    print("=" * 60 + "\n")

    return {"slope": slope, "analysis": analysis, "heatmap": heatmap_path}


if __name__ == "__main__":
    run_slope_analysis()

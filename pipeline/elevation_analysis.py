"""
Module 4: Elevation Analysis for LunaPath-4D
Computes statistical elevation properties, vertical relief, hypsometric curves,
and frequency distributions from Digital Elevation Models.

Units:
- All horizontal coordinates: meters (m)
- All elevation values: meters (m) relative to lunar topocentric reference
- All distribution bins: meters (m)

Requirements Addressed:
1. Minimum elevation
2. Maximum elevation
3. Mean elevation
4. Median elevation
5. Standard deviation
6. Elevation range (vertical relief)
7. Elevation distribution (histogram, PDF, CDF, percentiles, skewness, kurtosis)
8. Robust handling of invalid DEM values (NaN, Inf) without modifying original array
9. Non-destructive array operations (preserves original DEM)
10. Visualization suite (heatmap, histogram, distribution suite)
"""

from typing import Dict, Any, Tuple, Optional
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

try:
    from .config import CELL_SIZE_METERS, DATA_DIR
except (ImportError, ValueError):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from config import CELL_SIZE_METERS, DATA_DIR


def extract_valid_elevations(dem: np.ndarray) -> Tuple[np.ndarray, int]:
    """
    Extract a 1D float64 array of finite elevation values from the DEM,
    preserving the original array completely.

    Returns:
        (valid_elevations_1d, invalid_count)
    """
    if not isinstance(dem, np.ndarray):
        raise TypeError(f"dem must be a NumPy array, got {type(dem)}")

    # Do not mutate original array; create a read-only flat view or copy of finite values
    dem_flat = dem.reshape(-1)
    finite_mask = np.isfinite(dem_flat)
    invalid_count = int(np.sum(~finite_mask))

    if not np.any(finite_mask):
        raise ValueError("DEM contains zero valid finite elevation values.")

    valid_values = dem_flat[finite_mask].astype(np.float64)
    return valid_values, invalid_count


def calculate_elevation_metrics(dem: np.ndarray) -> Dict[str, float]:
    """
    Calculate comprehensive statistical elevation properties.

    Calculations:
    - Minimum elevation: z_min
    - Maximum elevation: z_max
    - Mean elevation: mu = (1/N) * sum(z_i)
    - Median elevation: z_med (50th percentile)
    - Standard deviation: sigma = sqrt((1/N) * sum((z_i - mu)^2))
    - Elevation range / relief: Delta z = z_max - z_min
    - Skewness: E[((z - mu) / sigma)^3]
    - Kurtosis: E[((z - mu) / sigma)^4] - 3.0 (excess kurtosis)

    Returns:
        Dictionary with strictly documented metric units.
    """
    values, invalid_count = extract_valid_elevations(dem)
    n = len(values)

    z_min = float(np.min(values))
    z_max = float(np.max(values))
    z_mean = float(np.mean(values))
    z_median = float(np.median(values))
    z_std = float(np.std(values))
    z_range = float(z_max - z_min)
    z_var = float(np.var(values))

    # Higher-order statistical moments
    if z_std > 1e-9:
        standardized = (values - z_mean) / z_std
        skewness = float(np.mean(standardized ** 3))
        kurtosis = float(np.mean(standardized ** 4) - 3.0)
    else:
        skewness = 0.0
        kurtosis = 0.0

    return {
        "minimum_elevation_m": z_min,
        "maximum_elevation_m": z_max,
        "mean_elevation_m": z_mean,
        "median_elevation_m": z_median,
        "standard_deviation_m": z_std,
        "elevation_range_m": z_range,
        "total_relief_m": z_range,
        "variance_m2": z_var,
        "skewness": round(skewness, 4),
        "excess_kurtosis": round(kurtosis, 4),
        "total_valid_cells": n,
        "valid_cell_count": n,
        "invalid_cell_count": invalid_count,
        "units": "meters"
    }


def calculate_elevation_distribution(
    dem: np.ndarray,
    num_bins: int = 50
) -> Dict[str, Any]:
    """
    Calculate frequency distribution, empirical probability density,
    cumulative distribution, and percentile quantiles across the terrain.
    """
    values, _ = extract_valid_elevations(dem)

    counts, bin_edges = np.histogram(values, bins=num_bins, density=False)
    density, _ = np.histogram(values, bins=num_bins, density=True)

    bin_centers = 0.5 * (bin_edges[:-1] + bin_edges[1:])
    cdf = np.cumsum(counts) / float(len(values))

    percentile_levels = [1, 5, 10, 25, 50, 75, 90, 95, 99]
    percentile_values = np.percentile(values, percentile_levels)
    percentiles_dict = {
        f"p{level:02d}": float(val) for level, val in zip(percentile_levels, percentile_values)
    }

    return {
        "bin_edges_m": [float(b) for b in bin_edges],
        "bin_centers_m": [float(c) for c in bin_centers],
        "histogram_counts": [int(cnt) for cnt in counts],
        "probability_density": [float(d) for d in density],
        "cumulative_density": [float(c) for c in cdf],
        "percentiles_m": percentiles_dict,
        "num_bins": num_bins
    }


def calculate_hypsometry(dem: np.ndarray, steps: int = 100) -> Dict[str, Any]:
    """
    Compute classical hypsometric curve (fractional area above normalized elevation).
    """
    values, _ = extract_valid_elevations(dem)
    z_min = float(np.min(values))
    z_max = float(np.max(values))
    relief = z_max - z_min

    if relief < 1e-6:
        normalized_elev = np.linspace(0.0, 1.0, steps)
        area_above = np.ones(steps)
    else:
        normalized_elev = np.linspace(0.0, 1.0, steps)
        elevation_thresholds = z_min + normalized_elev * relief
        area_above = np.array([
            float(np.mean(values >= thresh)) for thresh in elevation_thresholds
        ])

    return {
        "relative_elevation": [float(e) for e in normalized_elev],
        "fractional_area_above": [float(a) for a in area_above]
    }


# Backward-compatible alias
def compute_elevation_statistics(dem: np.ndarray) -> Dict[str, Any]:
    """Legacy wrapper returning format expected by pipeline metadata contract."""
    metrics = calculate_elevation_metrics(dem)
    dist = calculate_elevation_distribution(dem, num_bins=30)
    p = dist["percentiles_m"]

    return {
        "min_elevation_m": metrics["minimum_elevation_m"],
        "max_elevation_m": metrics["maximum_elevation_m"],
        "mean_elevation_m": metrics["mean_elevation_m"],
        "median_elevation_m": metrics["median_elevation_m"],
        "std_elevation_m": metrics["standard_deviation_m"],
        "total_relief_m": metrics["elevation_range_m"],
        "percentiles": {
            "p05": p["p05"],
            "p25": p["p25"],
            "p50": p["p50"],
            "p75": p["p75"],
            "p95": p["p95"]
        }
    }


# -------------------------------------------------------------
# Visualization Functions
# -------------------------------------------------------------

def render_elevation_heatmap(
    dem: np.ndarray,
    save_path: Path,
    cell_size: float = CELL_SIZE_METERS
) -> Path:
    """Generate high-resolution 2D elevation heatmap with metric axes and contours."""
    save_path = Path(save_path)
    height, width = dem.shape
    extent = [0, width * cell_size / 1000.0, 0, height * cell_size / 1000.0]

    # Handle invalid values for display
    display_dem = np.copy(dem)
    display_dem[~np.isfinite(display_dem)] = np.nan

    fig, ax = plt.subplots(figsize=(10, 8), dpi=150)
    img = ax.imshow(
        display_dem,
        cmap="copper",
        origin="lower",
        extent=extent,
        interpolation="bilinear"
    )

    valid_mask = np.isfinite(display_dem)
    if np.any(valid_mask):
        levels = np.linspace(float(np.nanmin(display_dem)), float(np.nanmax(display_dem)), 12)
        ax.contour(
            display_dem,
            levels=levels,
            colors="white",
            alpha=0.3,
            linewidths=0.6,
            extent=extent,
            origin="lower"
        )

    ax.set_title("LunaPath-4D: Lunar Elevation Heatmap", fontsize=14, fontweight="bold", pad=12)
    ax.set_xlabel("Easting (km)", fontsize=11)
    ax.set_ylabel("Northing (km)", fontsize=11)

    cbar = fig.colorbar(img, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("Elevation (meters)", fontsize=11)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path


def render_elevation_histogram(
    dem: np.ndarray,
    save_path: Path,
    num_bins: int = 50
) -> Path:
    """
    Generate elevation frequency histogram with statistical markers:
    mean, median, and +/- 1 standard deviation intervals.
    """
    save_path = Path(save_path)
    values, _ = extract_valid_elevations(dem)
    metrics = calculate_elevation_metrics(dem)

    fig, ax = plt.subplots(figsize=(10, 6), dpi=150)

    # Histogram
    n, bins, patches = ax.hist(
        values,
        bins=num_bins,
        color="#c89658",
        edgecolor="#2a2015",
        alpha=0.85,
        density=True,
        label="Elevation Frequency"
    )

    # Statistical marker lines
    ax.axvline(metrics["mean_elevation_m"], color="red", linestyle="--", linewidth=1.8,
               label=f"Mean: {metrics['mean_elevation_m']:.2f} m")
    ax.axvline(metrics["median_elevation_m"], color="blue", linestyle=":", linewidth=1.8,
               label=f"Median: {metrics['median_elevation_m']:.2f} m")

    # Standard deviation interval
    mu = metrics["mean_elevation_m"]
    sigma = metrics["standard_deviation_m"]
    ax.axvline(mu - sigma, color="black", linestyle="-.", alpha=0.6,
               label=f"±1σ: [{mu - sigma:.1f}m, {mu + sigma:.1f}m]")
    ax.axvline(mu + sigma, color="black", linestyle="-.", alpha=0.6)

    ax.set_title("LunaPath-4D: Terrain Elevation Frequency Distribution", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Elevation (meters)", fontsize=11)
    ax.set_ylabel("Probability Density", fontsize=11)
    ax.legend(loc="upper right", framealpha=0.9)
    ax.grid(True, linestyle=":", alpha=0.5)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path


def render_elevation_distribution_suite(
    dem: np.ndarray,
    save_path: Path,
    cell_size: float = CELL_SIZE_METERS
) -> Path:
    """
    Generate comprehensive 3-panel analytical elevation distribution visualization:
    (A) 2D Spatial Elevation Heatmap
    (B) Elevation Histogram & Probability Density Function (PDF)
    (C) Cumulative Distribution Function (CDF) / Hypsometric Curve
    """
    save_path = Path(save_path)
    values, _ = extract_valid_elevations(dem)
    metrics = calculate_elevation_metrics(dem)
    dist = calculate_elevation_distribution(dem, num_bins=45)
    hyps = calculate_hypsometry(dem, steps=100)

    fig, axes = plt.subplots(1, 3, figsize=(18, 5.5), dpi=150)

    # Panel A: Spatial Heatmap
    height, width = dem.shape
    extent = [0, width * cell_size / 1000.0, 0, height * cell_size / 1000.0]
    im0 = axes[0].imshow(dem, cmap="copper", origin="lower", extent=extent)
    axes[0].set_title("(A) Spatial Elevation Map", fontweight="bold", fontsize=11)
    axes[0].set_xlabel("Easting (km)")
    axes[0].set_ylabel("Northing (km)")
    fig.colorbar(im0, ax=axes[0], label="Elevation (m)", fraction=0.046, pad=0.04)

    # Panel B: Histogram & PDF
    axes[1].hist(values, bins=dist["bin_edges_m"], color="#c89658", edgecolor="#2a2015",
                 density=True, alpha=0.85)
    axes[1].axvline(metrics["mean_elevation_m"], color="red", linestyle="--", linewidth=1.6,
                    label=f"Mean: {metrics['mean_elevation_m']:.1f} m")
    axes[1].axvline(metrics["median_elevation_m"], color="blue", linestyle=":", linewidth=1.6,
                    label=f"Median: {metrics['median_elevation_m']:.1f} m")
    axes[1].set_title("(B) Probability Density Function", fontweight="bold", fontsize=11)
    axes[1].set_xlabel("Elevation (meters)")
    axes[1].set_ylabel("Density")
    axes[1].legend(loc="upper right", fontsize=9)
    axes[1].grid(True, linestyle=":", alpha=0.4)

    # Panel C: Cumulative Distribution (CDF)
    axes[2].plot(dist["bin_centers_m"], dist["cumulative_density"], color="#2b5c8f", linewidth=2.0, label="Cumulative CDF")
    axes[2].set_title("(C) Cumulative Elevation Distribution (CDF)", fontweight="bold", fontsize=11)
    axes[2].set_xlabel("Elevation (meters)")
    axes[2].set_ylabel("Cumulative Fraction")
    axes[2].axhline(0.5, color="gray", linestyle="--", alpha=0.6, label="50th Percentile")
    axes[2].grid(True, linestyle=":", alpha=0.4)
    axes[2].legend(loc="lower right", fontsize=9)

    plt.suptitle(
        f"LunaPath-4D Elevation Analysis Suite | Min: {metrics['minimum_elevation_m']:.1f}m | "
        f"Max: {metrics['maximum_elevation_m']:.1f}m | Relief: {metrics['elevation_range_m']:.1f}m",
        fontsize=13, fontweight="bold", y=0.98
    )
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path


def run_elevation_analysis(dem_path: Optional[Path] = None, output_dir: Path = DATA_DIR) -> Dict[str, Any]:
    """Run standalone elevation analysis and generate visualization artifacts."""
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

    # Calculate metrics
    metrics = calculate_elevation_metrics(dem)
    dist = calculate_elevation_distribution(dem)

    # Generate visualizations
    heatmap_path = render_elevation_heatmap(dem, output_dir / "elevation_heatmap.png")
    hist_path = render_elevation_histogram(dem, output_dir / "elevation_histogram.png")
    suite_path = render_elevation_distribution_suite(dem, output_dir / "elevation_distribution.png")

    print("\n" + "=" * 60)
    print("  LUNAPATH-4D ELEVATION ANALYSIS REPORT")
    print("=" * 60)
    print(f"Minimum Elevation : {metrics['minimum_elevation_m']:.2f} m")
    print(f"Maximum Elevation : {metrics['maximum_elevation_m']:.2f} m")
    print(f"Mean Elevation    : {metrics['mean_elevation_m']:.2f} m")
    print(f"Median Elevation  : {metrics['median_elevation_m']:.2f} m")
    print(f"Std Deviation     : {metrics['standard_deviation_m']:.2f} m")
    print(f"Elevation Range   : {metrics['elevation_range_m']:.2f} m (Relief)")
    print(f"Skewness          : {metrics['skewness']:.4f}")
    print(f"Excess Kurtosis   : {metrics['excess_kurtosis']:.4f}")
    print(f"Total Valid Cells : {metrics['total_valid_cells']:,}")
    print("-" * 60)
    print("Visualizations Generated:")
    print(f"  - Heatmap     : {heatmap_path}")
    print(f"  - Histogram   : {hist_path}")
    print(f"  - Dist Suite  : {suite_path}")
    print("=" * 60 + "\n")

    return {
        "metrics": metrics,
        "distribution": dist,
        "artifacts": {
            "heatmap": heatmap_path,
            "histogram": hist_path,
            "distribution_suite": suite_path
        }
    }


if __name__ == "__main__":
    run_elevation_analysis()

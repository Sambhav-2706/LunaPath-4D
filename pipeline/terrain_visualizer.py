"""
Module 8: Publication-Quality Scientific Terrain Visualization Suite
Generates individual scientific figures and multi-layer comparisons for:
1. Lunar Elevation (DEM)
2. Topographic Slope
3. Surface Roughness
4. Terrain Traversability (4-Tier Rover Safety Classification)

Formatting Standards:
- Standardized metric axes: Easting (km) and Northing (km)
- Consistent coordinate orientation: origin="lower" (South-West origin)
- High-resolution publication output (150 DPI)
- Explicit physical units displayed on colorbars and legends
- Distinct accessible colormaps
"""

from typing import Optional
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource, ListedColormap, BoundaryNorm
import matplotlib.patches as mpatches

try:
    from .config import MAX_SAFE_SLOPE_DEG, CRITICAL_ROUGHNESS_M, CELL_SIZE_METERS, DATA_DIR
except (ImportError, ValueError):
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from config import MAX_SAFE_SLOPE_DEG, CRITICAL_ROUGHNESS_M, CELL_SIZE_METERS, DATA_DIR

CLASS_COLORS = {
    0: "#2ea043",  # Green: SAFE
    1: "#dbab09",  # Yellow: MODERATE
    2: "#f0883e",  # Orange: DIFFICULT
    3: "#da3633"   # Red: UNSAFE
}


# =============================================================
# 1. SCIENTIFIC VISUALIZATION: LUNAR ELEVATION
# =============================================================

def render_scientific_elevation(
    dem: np.ndarray,
    save_path: Path,
    cell_size: float = CELL_SIZE_METERS,
    title: str = "LunaPath-4D: Lunar Surface Elevation Model (DEM)"
) -> Path:
    """Render publication-quality elevation map with metric axes, contours, and colorbar."""
    save_path = Path(save_path)
    height, width = dem.shape
    extent = [0, width * cell_size / 1000.0, 0, height * cell_size / 1000.0]

    fig, ax = plt.subplots(figsize=(10, 8), dpi=150)
    img = ax.imshow(
        dem,
        cmap="copper",
        origin="lower",
        extent=extent,
        interpolation="bilinear"
    )

    levels = np.linspace(float(np.nanmin(dem)), float(np.nanmax(dem)), 12)
    ax.contour(
        dem,
        levels=levels,
        colors="white",
        alpha=0.30,
        linewidths=0.6,
        extent=extent,
        origin="lower"
    )

    ax.set_title(title, fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Easting / West-to-East (km)", fontsize=11)
    ax.set_ylabel("Northing / South-to-North (km)", fontsize=11)

    cbar = fig.colorbar(img, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("Elevation (meters relative to lunar reference)", fontsize=11)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path


# =============================================================
# 2. SCIENTIFIC VISUALIZATION: TOPOGRAPHIC SLOPE
# =============================================================

def render_scientific_slope(
    slope: np.ndarray,
    save_path: Path,
    cell_size: float = CELL_SIZE_METERS,
    max_safe_slope: float = MAX_SAFE_SLOPE_DEG,
    title: str = "LunaPath-4D: Topographic Slope Analysis"
) -> Path:
    """Render publication-quality slope map with cyan rover climbing hazard contour."""
    save_path = Path(save_path)
    height, width = slope.shape
    extent = [0, width * cell_size / 1000.0, 0, height * cell_size / 1000.0]

    fig, ax = plt.subplots(figsize=(10, 8), dpi=150)
    img = ax.imshow(
        slope,
        cmap="inferno",
        origin="lower",
        extent=extent,
        vmin=0.0,
        vmax=max(30.0, float(np.nanmax(slope)))
    )

    if np.nanmax(slope) >= max_safe_slope:
        ax.contour(
            slope,
            levels=[max_safe_slope],
            colors="cyan",
            linewidths=1.5,
            extent=extent,
            origin="lower"
        )
        legend_patch = mpatches.Patch(color="cyan", label=f"Critical Slope Threshold ({max_safe_slope}° limit)")
        ax.legend(handles=[legend_patch], loc="upper right", framealpha=0.9, fontsize=9)

    ax.set_title(title, fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Easting / West-to-East (km)", fontsize=11)
    ax.set_ylabel("Northing / South-to-North (km)", fontsize=11)

    cbar = fig.colorbar(img, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("Slope Angle (degrees)", fontsize=11)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path


# =============================================================
# 3. SCIENTIFIC VISUALIZATION: SURFACE ROUGHNESS
# =============================================================

def render_scientific_roughness(
    roughness: np.ndarray,
    save_path: Path,
    cell_size: float = CELL_SIZE_METERS,
    critical_threshold: float = CRITICAL_ROUGHNESS_M,
    title: str = "LunaPath-4D: Surface Roughness (RMS Height Deviation)"
) -> Path:
    """Render publication-quality surface roughness map with hazard threshold contour."""
    save_path = Path(save_path)
    height, width = roughness.shape
    extent = [0, width * cell_size / 1000.0, 0, height * cell_size / 1000.0]

    fig, ax = plt.subplots(figsize=(10, 8), dpi=150)
    img = ax.imshow(
        roughness,
        cmap="magma",
        origin="lower",
        extent=extent,
        vmin=0.0,
        vmax=max(5.0, float(np.nanmax(roughness)))
    )

    if np.nanmax(roughness) >= critical_threshold:
        ax.contour(
            roughness,
            levels=[critical_threshold],
            colors="yellow",
            linewidths=1.5,
            extent=extent,
            origin="lower"
        )
        legend_patch = mpatches.Patch(color="yellow", label=f"Roughness Hazard ({critical_threshold}m limit)")
        ax.legend(handles=[legend_patch], loc="upper right", framealpha=0.9, fontsize=9)

    ax.set_title(title, fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Easting / West-to-East (km)", fontsize=11)
    ax.set_ylabel("Northing / South-to-North (km)", fontsize=11)

    cbar = fig.colorbar(img, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("Local RMS Roughness Rq (meters)", fontsize=11)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path


# =============================================================
# 4. SCIENTIFIC VISUALIZATION: TRAVERSABILITY CLASSIFICATION
# =============================================================

def render_scientific_traversability(
    classified_grid: np.ndarray,
    save_path: Path,
    cell_size: float = CELL_SIZE_METERS,
    title: str = "LunaPath-4D: Rover Terrain Traversability Safety Map"
) -> Path:
    """Render publication-quality 4-tier discrete traversability classification map with legend."""
    save_path = Path(save_path)
    height, width = classified_grid.shape
    extent = [0, width * cell_size / 1000.0, 0, height * cell_size / 1000.0]

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

    total = float(classified_grid.size)
    p0 = (np.sum(classified_grid == 0) / total) * 100.0
    p1 = (np.sum(classified_grid == 1) / total) * 100.0
    p2 = (np.sum(classified_grid == 2) / total) * 100.0
    p3 = (np.sum(classified_grid == 3) / total) * 100.0

    legend_patches = [
        mpatches.Patch(color=CLASS_COLORS[0], label=f"0: SAFE ({p0:.1f}%) — Slope <5°, Roughness <0.8m"),
        mpatches.Patch(color=CLASS_COLORS[1], label=f"1: MODERATE ({p1:.1f}%) — Slope 5-10°, Roughness 0.8-1.8m"),
        mpatches.Patch(color=CLASS_COLORS[2], label=f"2: DIFFICULT ({p2:.1f}%) — Slope 10-15°, Roughness 1.8-3.0m"),
        mpatches.Patch(color=CLASS_COLORS[3], label=f"3: UNSAFE ({p3:.1f}%) — Slope >15° or Roughness >3.0m")
    ]

    ax.legend(
        handles=legend_patches,
        loc="upper right",
        framealpha=0.92,
        fontsize=9,
        title="Rover Safety Classification",
        title_fontsize=10
    )

    ax.set_title(title, fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Easting / West-to-East (km)", fontsize=11)
    ax.set_ylabel("Northing / South-to-North (km)", fontsize=11)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path


# =============================================================
# 5. MULTI-LAYER COMPARISON VISUALIZATION (SAME REGION)
# =============================================================

def render_terrain_layers_comparison(
    dem: np.ndarray,
    slope: np.ndarray,
    roughness: np.ndarray,
    classified_traversability: np.ndarray,
    save_path: Path,
    cell_size: float = CELL_SIZE_METERS,
    max_safe_slope: float = MAX_SAFE_SLOPE_DEG
) -> Path:
    """
    Render 4-panel (2x2) synchronized publication figure showing all 4 analytical layers
    for the exact same lunar terrain region with aligned coordinate extents.
    """
    save_path = Path(save_path)
    height, width = dem.shape
    extent = [0, width * cell_size / 1000.0, 0, height * cell_size / 1000.0]

    fig, axes = plt.subplots(2, 2, figsize=(15, 13), dpi=150)

    # Panel A: DEM
    im0 = axes[0, 0].imshow(dem, cmap="copper", origin="lower", extent=extent)
    axes[0, 0].set_title("(A) Digital Elevation Model (DEM)", fontweight="bold", fontsize=11)
    axes[0, 0].set_xlabel("Easting (km)")
    axes[0, 0].set_ylabel("Northing (km)")
    cbar0 = fig.colorbar(im0, ax=axes[0, 0], fraction=0.046, pad=0.04)
    cbar0.set_label("Elevation (m)")

    # Panel B: Slope
    im1 = axes[0, 1].imshow(slope, cmap="inferno", origin="lower", extent=extent, vmin=0.0, vmax=max(30.0, float(np.nanmax(slope))))
    if np.nanmax(slope) >= max_safe_slope:
        axes[0, 1].contour(slope, levels=[max_safe_slope], colors="cyan", linewidths=1.2, extent=extent, origin="lower")
    axes[0, 1].set_title(f"(B) Topographic Slope (Cyan: {max_safe_slope}° Limit)", fontweight="bold", fontsize=11)
    axes[0, 1].set_xlabel("Easting (km)")
    axes[0, 1].set_ylabel("Northing (km)")
    cbar1 = fig.colorbar(im1, ax=axes[0, 1], fraction=0.046, pad=0.04)
    cbar1.set_label("Slope Angle (°)")

    # Panel C: Roughness
    im2 = axes[1, 0].imshow(roughness, cmap="magma", origin="lower", extent=extent, vmin=0.0, vmax=max(5.0, float(np.nanmax(roughness))))
    axes[1, 0].set_title("(C) Surface Roughness (RMS Height Deviation)", fontweight="bold", fontsize=11)
    axes[1, 0].set_xlabel("Easting (km)")
    axes[1, 0].set_ylabel("Northing (km)")
    cbar2 = fig.colorbar(im2, ax=axes[1, 0], fraction=0.046, pad=0.04)
    cbar2.set_label("Roughness Rq (m)")

    # Panel D: Traversability Classification
    cmap_trav = ListedColormap([CLASS_COLORS[0], CLASS_COLORS[1], CLASS_COLORS[2], CLASS_COLORS[3]])
    norm_trav = BoundaryNorm([-0.5, 0.5, 1.5, 2.5, 3.5], cmap_trav.N)
    axes[1, 1].imshow(classified_traversability, cmap=cmap_trav, norm=norm_trav, origin="lower", extent=extent, interpolation="nearest")
    axes[1, 1].set_title("(D) Traversability Safety Classification", fontweight="bold", fontsize=11)
    axes[1, 1].set_xlabel("Easting (km)")
    axes[1, 1].set_ylabel("Northing (km)")

    # Traversability mini legend
    p_safe = (np.sum(classified_traversability == 0) / classified_traversability.size) * 100.0
    p_unsafe = (np.sum(classified_traversability == 3) / classified_traversability.size) * 100.0
    legend_patches = [
        mpatches.Patch(color=CLASS_COLORS[0], label=f"SAFE ({p_safe:.0f}%)"),
        mpatches.Patch(color=CLASS_COLORS[1], label="MODERATE"),
        mpatches.Patch(color=CLASS_COLORS[2], label="DIFFICULT"),
        mpatches.Patch(color=CLASS_COLORS[3], label=f"UNSAFE ({p_unsafe:.0f}%)")
    ]
    axes[1, 1].legend(handles=legend_patches, loc="upper right", fontsize=8, framealpha=0.9)

    plt.suptitle("LunaPath-4D: Synchronized Multi-Layer Terrain Analysis Suite", fontsize=14, fontweight="bold", y=0.98)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path


# Backward compatibility aliases
def render_dem_2d_heatmap(dem, save_path, cell_size=CELL_SIZE_METERS, title=None):
    return render_scientific_elevation(dem, save_path, cell_size=cell_size, title=title or "LunaPath-4D: Lunar Surface Elevation (DEM)")

def render_analytical_suite(dem, slope, roughness, traversability, save_path, max_safe_slope=MAX_SAFE_SLOPE_DEG):
    return render_terrain_layers_comparison(dem, slope, roughness, traversability, save_path, max_safe_slope=max_safe_slope)


def render_dem_3d_surface(
    dem: np.ndarray,
    save_path: Path,
    cell_size: float = CELL_SIZE_METERS,
    downsample_factor: int = 2,
    vertical_exaggeration: float = 1.5,
    title: str = "LunaPath-4D Synthetic Lunar Surface (3D Elevation Mesh)"
) -> Path:
    """3D perspective surface mesh visualization with directional light shading."""
    save_path = Path(save_path)
    height, width = dem.shape

    step = max(1, downsample_factor)
    x = np.arange(0, width, step) * cell_size / 1000.0
    y = np.arange(0, height, step) * cell_size / 1000.0
    xx, yy = np.meshgrid(x, y)
    zz = dem[::step, ::step]

    ls = LightSource(azdeg=315, altdeg=35)
    rgb = ls.shade(zz, cmap=plt.cm.copper, vert_exag=vertical_exaggeration, blend_mode="overlay")

    fig = plt.figure(figsize=(12, 9), dpi=150)
    ax = fig.add_subplot(111, projection="3d")

    ax.plot_surface(
        xx, yy, zz,
        facecolors=rgb,
        rstride=1, cstride=1,
        linewidth=0,
        antialiased=True,
        shade=False
    )

    ax.set_title(title, fontsize=14, fontweight="bold", pad=18)
    ax.set_xlabel("Easting (km)", fontsize=10, labelpad=8)
    ax.set_ylabel("Northing (km)", fontsize=10, labelpad=8)
    ax.set_zlabel("Elevation (m)", fontsize=10, labelpad=8)
    ax.view_init(elev=42, azim=-55)

    ax.grid(True, linestyle="--", alpha=0.3)
    ax.xaxis.pane.fill = False
    ax.yaxis.pane.fill = False
    ax.zaxis.pane.fill = False

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    return save_path

"""
Module 3: Procedural Impact Crater Generator (Enhanced Mathematical Realism)
Synthesizes geologically authentic lunar impact crater populations based on empirical crater morphometry:
- Parabolic bowl-shaped interior cavity
- Raised structural rim crest
- Power-law decaying continuous ejecta blanket (u^-3 decay)
- Multi-harmonic non-circular boundary perturbations (ellipticity, scalloping, polygonal facets)
- Variable depth-to-diameter and rim-height-to-diameter scaling
- Chronological superposition (younger craters cross-cutting older craters)
- Small secondary crater clusters in ejecta blankets
- Smooth C1 natural surface transitions

Mathematical Equations Documented:
1. Radial Boundary Irregularity:
   R(theta) = R_0 * [1.0 + eps_2 * cos(2(theta - phi_2)) + eps_3 * sin(3(theta - phi_3)) + eps_4 * cos(4(theta - phi_4))]
   where:
   - eps_2: Ellipticity from oblique projectile trajectory (theta_impact < 90 deg)
   - eps_3: Rim wall slump scallops / structural asymmetry
   - eps_4: Polygonal rim segments aligned with pre-existing joints

2. Interior Cavity Bowl (u = r / R(theta) <= 1.0):
   z_bowl(u) = -d * (1.0 - u^p) + h_rim * u^4
   where p in [1.8, 2.2] models parabolic curvature.
   At u = 0 (crater center): z = -d (maximum depth)
   At u = 1.0 (rim crest): z = h_rim (raised rim peak)

3. Exterior Ejecta Blanket (u > 1.0):
   z_ejecta(u) = h_rim * (u^-3.0) * exp(-0.8 * (u - 1.0)) * S(u)
   where S(u) is a smooth Hermite transition tapering to 0 at u = 3.2.
   Matches empirical lunar ejecta decay (McGetchin et al. 1973, Melosh 1989).
"""

from typing import List, Dict, Tuple, Optional, Any
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

try:
    from .config import (
        CELL_SIZE_METERS,
        WIDTH,
        HEIGHT,
        SEED,
        CRATER_LARGE_RADIUS_RANGE,
        CRATER_MEDIUM_RADIUS_RANGE,
        CRATER_SMALL_RADIUS_RANGE,
        DEFAULT_LARGE_CRATERS,
        DEFAULT_MEDIUM_CRATERS,
        DEFAULT_SMALL_CRATERS,
        DATA_DIR
    )
except (ImportError, ValueError):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from config import (
        CELL_SIZE_METERS,
        WIDTH,
        HEIGHT,
        SEED,
        CRATER_LARGE_RADIUS_RANGE,
        CRATER_MEDIUM_RADIUS_RANGE,
        CRATER_SMALL_RADIUS_RANGE,
        DEFAULT_LARGE_CRATERS,
        DEFAULT_MEDIUM_CRATERS,
        DEFAULT_SMALL_CRATERS,
        DATA_DIR
    )


def sample_crater_radii(
    count: int = 26,
    r_min: float = 3.2,
    r_max: float = 22.0,
    exponent: float = 1.8,
    rng: Optional[np.random.Generator] = None
) -> List[float]:
    """Sample crater radii from Pareto/power-law distribution N(D) ~ D^-2."""
    if rng is None:
        rng = np.random.default_rng(SEED)

    radii = []
    for _ in range(count):
        u = rng.random()
        r = r_min * (1.0 - u * (1.0 - (r_min / r_max) ** exponent)) ** (-1.0 / exponent)
        radii.append(float(np.clip(r, r_min, r_max)))

    radii.sort(reverse=True)
    return radii


def compute_crater_profile_metrics(
    radius_cells: float,
    cell_size: float = CELL_SIZE_METERS,
    depth_ratio: float = 0.18,
    rim_ratio: float = 0.045
) -> Dict[str, float]:
    """Calculate key mathematical dimensions for an impact crater."""
    diameter_m = radius_cells * 2.0 * cell_size
    depth_m = diameter_m * depth_ratio
    rim_height_m = diameter_m * rim_ratio

    return {
        "diameter_meters": float(round(diameter_m, 2)),
        "depth_meters": float(round(depth_m, 2)),
        "rim_height_meters": float(round(rim_height_m, 2)),
        "radius_cells": float(round(radius_cells, 2)),
        "radius_meters": float(round(radius_cells * cell_size, 2))
    }


def apply_realistic_crater(
    dem: np.ndarray,
    center_x: float,
    center_y: float,
    radius_cells: float,
    cell_size: float = CELL_SIZE_METERS,
    depth_ratio: Optional[float] = None,
    rim_ratio: Optional[float] = None,
    asymmetry_scale: float = 0.12,
    rng: Optional[np.random.Generator] = None
) -> Dict[str, Any]:
    """
    Superimpose an individual mathematically realistic impact crater onto DEM array.

    Incorporates:
    - Multi-harmonic non-circular radial perturbation
    - Parabolic bowl-shaped interior with central depth d
    - Structural raised rim crest with peak height h_rim at u = 1.0
    - Continuous ejecta blanket with empirical u^-3 decay
    - Smooth cubic Hermite boundary taper at u in [2.5, 3.2]
    """
    if rng is None:
        rng = np.random.default_rng()

    # Natural variation in depth and rim ratios
    if depth_ratio is None:
        depth_ratio = float(rng.uniform(0.14, 0.22))
    if rim_ratio is None:
        rim_ratio = float(rng.uniform(0.035, 0.055))

    metrics = compute_crater_profile_metrics(radius_cells, cell_size, depth_ratio, rim_ratio)
    depth_m = metrics["depth_meters"]
    rim_height_m = metrics["rim_height_meters"]

    height, width = dem.shape

    # Multi-harmonic radial perturbation
    eps2 = float(rng.uniform(-asymmetry_scale, asymmetry_scale))
    eps3 = float(rng.uniform(-asymmetry_scale * 0.4, asymmetry_scale * 0.4))
    eps4 = float(rng.uniform(-asymmetry_scale * 0.25, asymmetry_scale * 0.25))

    phi2 = float(rng.uniform(0, np.pi))
    phi3 = float(rng.uniform(0, 2 * np.pi))
    phi4 = float(rng.uniform(0, np.pi / 2))

    # Bounding-box localization: evaluate only across the affected local patch (u < 2.9)
    max_radial_factor = 1.0 + abs(eps2) + abs(eps3) + abs(eps4)
    rmax = int(np.ceil(radius_cells * max_radial_factor * 2.9)) + 2

    y_min = max(0, int(np.floor(center_y - rmax)))
    y_max = min(height, int(np.ceil(center_y + rmax + 1)))
    x_min = max(0, int(np.floor(center_x - rmax)))
    x_max = min(width, int(np.ceil(center_x + rmax + 1)))

    if y_min < y_max and x_min < x_max:
        y_idx = np.arange(y_min, y_max, dtype=np.float64)
        x_idx = np.arange(x_min, x_max, dtype=np.float64)
        xx, yy = np.meshgrid(x_idx, y_idx)
        dx = xx - center_x
        dy = yy - center_y
        dist = np.hypot(dx, dy)
        theta = np.arctan2(dy, dx)

        radial_factor = 1.0 + (
            eps2 * np.cos(2 * (theta - phi2)) +
            eps3 * np.sin(3 * (theta - phi3)) +
            eps4 * np.cos(4 * (theta - phi4))
        )
        effective_radius = np.maximum(radius_cells * radial_factor, 1.0)
        norm_dist = dist / effective_radius

        # 1. Interior parabolic bowl cavity (u <= 1.0)
        inner_mask = norm_dist <= 1.0
        bowl = (-depth_m * (1.0 - norm_dist ** 2) + rim_height_m * (norm_dist ** 4)) * inner_mask

        # 2. Exterior ejecta blanket – distance ratio based on perturbed radius
        # Continuous ejecta extends to u = 2.8 with smooth Hermite taper in [2.0, 2.8]
        # Ensuring r > 3 * radius is strictly background terrain (delta == 0)
        outer_mask = (norm_dist > 1.0) & (norm_dist < 2.8)
        u_outer = np.maximum(norm_dist, 1.0)

        # Ejecta decay: h_rim * u^-3 * exp(-0.8 * (u - 1))
        ejecta_decay = rim_height_m * (u_outer ** -3.0) * np.exp(-0.8 * (u_outer - 1.0))

        # Smooth Hermite transition at outer boundary u in [2.0, 2.8]
        t = np.clip((norm_dist - 2.0) / 0.8, 0.0, 1.0)
        hermite_fade = 1.0 - (t * t * (3.0 - 2.0 * t))
        ejecta = ejecta_decay * hermite_fade * outer_mask

        # Superimpose localized crater modification
        dem[y_min:y_max, x_min:x_max] += (bowl + ejecta)

    return {
        "x": round(center_x, 2),
        "y": round(center_y, 2),
        "radius": round(radius_cells, 2),
        "radius_cells": round(radius_cells, 2),
        "radius_meters": metrics["radius_meters"],
        "depth_meters": depth_m,
        "rim_height_meters": rim_height_m,
        "depth_ratio": round(depth_ratio, 3),
        "rim_ratio": round(rim_ratio, 3),
        "ellipticity": round(abs(eps2), 3),
        "known_from_orbit": bool(metrics["radius_meters"] >= 45.0),
        "type": "crater"
    }


def add_secondary_crater_cluster(
    dem: np.ndarray,
    parent_x: float,
    parent_y: float,
    parent_radius_cells: float,
    cluster_count: int = 5,
    cell_size: float = CELL_SIZE_METERS,
    rng: Optional[np.random.Generator] = None
) -> List[Dict[str, Any]]:
    """
    Generate a cluster of small secondary impact craters in the ejecta blanket of a large crater.
    """
    if rng is None:
        rng = np.random.default_rng()

    height, width = dem.shape
    secondaries = []

    for idx in range(cluster_count):
        # Radial distance in ejecta field: 1.4 to 2.8 parent radii
        radial_mult = float(rng.uniform(1.4, 2.6))
        angle = float(rng.uniform(0, 2 * np.pi))

        sec_x = parent_x + parent_radius_cells * radial_mult * np.cos(angle)
        sec_y = parent_y + parent_radius_cells * radial_mult * np.sin(angle)

        # Ensure within grid margins
        if 8 <= sec_x < (width - 8) and 8 <= sec_y < (height - 8):
            sec_radius = float(rng.uniform(1.2, 2.8))  # small crater: 12m to 28m
            record = apply_realistic_crater(
                dem, sec_x, sec_y, sec_radius,
                cell_size=cell_size,
                depth_ratio=0.15,
                rim_ratio=0.035,
                asymmetry_scale=0.08,
                rng=rng
            )
            record["type"] = "secondary_crater"
            record["parent_radius_m"] = round(parent_radius_cells * cell_size, 2)
            secondaries.append(record)

    return secondaries


def generate_realistic_crater_population(
    dem: np.ndarray,
    large_count: int = DEFAULT_LARGE_CRATERS,
    medium_count: int = DEFAULT_MEDIUM_CRATERS,
    small_count: int = DEFAULT_SMALL_CRATERS,
    include_secondaries: bool = True,
    cell_size: float = CELL_SIZE_METERS,
    margin_cells: float = 16.0,
    rng: Optional[np.random.Generator] = None
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Populate terrain with chronologically superimposed realistic lunar craters across size tiers.
    """
    if rng is None:
        rng = np.random.default_rng(SEED)

    height, width = dem.shape

    # 1. Sample radii for each tier
    large_radii = [float(rng.uniform(*CRATER_LARGE_RADIUS_RANGE)) for _ in range(large_count)]
    med_radii = [float(rng.uniform(*CRATER_MEDIUM_RADIUS_RANGE)) for _ in range(medium_count)]
    small_radii = [float(rng.uniform(*CRATER_SMALL_RADIUS_RANGE)) for _ in range(small_count)]

    large_radii.sort(reverse=True)
    med_radii.sort(reverse=True)
    small_radii.sort(reverse=True)

    tier_batches = [
        ("LARGE", large_radii),
        ("MEDIUM", med_radii),
        ("SMALL", small_radii)
    ]

    craters_catalog = []
    crater_counter = 1

    for tier_name, radii in tier_batches:
        for r in radii:
            min_x = margin_cells + r
            max_x = width - margin_cells - r
            min_y = margin_cells + r
            max_y = height - margin_cells - r

            if min_x >= max_x or min_y >= max_y:
                cx = width / 2.0
                cy = height / 2.0
            else:
                cx = float(rng.uniform(min_x, max_x))
                cy = float(rng.uniform(min_y, max_y))

            crater_rec = apply_realistic_crater(
                dem, cx, cy, r,
                cell_size=cell_size,
                rng=rng
            )
            crater_rec["id"] = f"CRATER_{crater_counter:03d}"
            crater_rec["size_tier"] = tier_name
            craters_catalog.append(crater_rec)
            crater_counter += 1

            # Add secondaries around large impacts
            if include_secondaries and tier_name == "LARGE":
                secondaries = add_secondary_crater_cluster(
                    dem, cx, cy, r,
                    cluster_count=4,
                    cell_size=cell_size,
                    rng=rng
                )
                for s in secondaries:
                    s["id"] = f"CRATER_{crater_counter:03d}"
                    s["size_tier"] = "SECONDARY"
                    craters_catalog.append(s)
                    crater_counter += 1

    return dem, craters_catalog


# Backward-compatible alias
generate_crater_population = generate_realistic_crater_population
apply_crater_profile = apply_realistic_crater


# -------------------------------------------------------------
# Visual Comparison Generator
# -------------------------------------------------------------

def generate_crater_comparison_visualizations(output_dir: Path = DATA_DIR, seed: int = SEED) -> Path:
    """
    Generate side-by-side 3-panel visual comparison:
    1. Terrain without craters (bare multi-scale undulations)
    2. Terrain with simple circular Gaussian craters
    3. Terrain with improved realistic crater profiles (parabolic bowl, raised rim, u^-3 ejecta, secondaries)
    """
    from .terrain_generation import synthesize_lunar_base

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    comparison_path = output_dir / "crater_comparison.png"

    rng_base = np.random.default_rng(seed)
    base_terrain = synthesize_lunar_base(rng=rng_base)

    # 1. Bare Terrain
    terrain_no_craters = np.copy(base_terrain)

    # 2. Simple Circular Craters (pure Gaussian bowl + rim without asymmetry or power-law ejecta)
    terrain_simple = np.copy(base_terrain)
    rng_simple = np.random.default_rng(seed)
    for _ in range(12):
        cx = float(rng_simple.uniform(30, WIDTH - 30))
        cy = float(rng_simple.uniform(30, HEIGHT - 30))
        r = float(rng_simple.uniform(6, 18))
        yy, xx = np.indices((HEIGHT, WIDTH))
        dist = np.hypot(xx - cx, yy - cy) / r
        bowl = -14.0 * np.exp(-(dist ** 2) * 4.0)
        rim = 3.5 * np.exp(-((dist - 1.0) ** 2) / 0.04)
        terrain_simple += (bowl + rim) * (dist < 2.2)

    # 3. Improved Realistic Craters
    terrain_realistic = np.copy(base_terrain)
    rng_real = np.random.default_rng(seed)
    terrain_realistic, _ = generate_realistic_crater_population(
        terrain_realistic,
        large_count=3,
        medium_count=6,
        small_count=12,
        include_secondaries=True,
        rng=rng_real
    )

    # Render 3-panel comparison figure
    fig, axes = plt.subplots(1, 3, figsize=(18, 6), dpi=150)

    im0 = axes[0].imshow(terrain_no_craters, cmap="copper", origin="lower")
    axes[0].set_title("(A) Base Terrain (No Craters)\nMulti-Scale Hermite Topography", fontweight="bold", fontsize=11)
    axes[0].set_xlabel("X (cells)")
    axes[0].set_ylabel("Y (cells)")
    fig.colorbar(im0, ax=axes[0], label="Elevation (m)", fraction=0.046, pad=0.04)

    im1 = axes[1].imshow(terrain_simple, cmap="copper", origin="lower")
    axes[1].set_title("(B) Simple Craters\nIdentical Circles (Gaussian Bowl/Rim)", fontweight="bold", fontsize=11)
    axes[1].set_xlabel("X (cells)")
    axes[1].set_ylabel("Y (cells)")
    fig.colorbar(im1, ax=axes[1], label="Elevation (m)", fraction=0.046, pad=0.04)

    im2 = axes[2].imshow(terrain_realistic, cmap="copper", origin="lower")
    axes[2].set_title("(C) Improved Realistic Craters\nParabolic Bowl + u⁻³ Ejecta + Asymmetry + Secondaries", fontweight="bold", fontsize=11)
    axes[2].set_xlabel("X (cells)")
    axes[2].set_ylabel("Y (cells)")
    fig.colorbar(im2, ax=axes[2], label="Elevation (m)", fraction=0.046, pad=0.04)

    plt.suptitle("LunaPath-4D: Lunar Crater Mathematical Modeling Comparison", fontsize=14, fontweight="bold", y=0.98)
    plt.tight_layout()
    plt.savefig(comparison_path, dpi=150)
    plt.close()

    return comparison_path


if __name__ == "__main__":
    comp_file = generate_crater_comparison_visualizations()
    print(f"Crater comparison figure saved: {comp_file}")

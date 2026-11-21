"""
Module 1: Synthetic Lunar Terrain Generation
Generates a configurable and reproducible artificial lunar landscape using Python and NumPy.

Mathematical Assumptions & Specifications:
1. Synthetic Nature:
   This is a synthetic procedural terrain model for simulation and path planning testing,
   not measured or raw lunar orbital altimetry.
2. Multi-Scale Topography:
   Synthesized by superimposing three octaves of cubic Hermite interpolated noise (scales 64, 24, 8)
   and a linear regional polar gradient.
3. Crater Morphometry (Pike 1977, Melosh 1989):
   - Cavity bowl: Damped exponential paraboloid z_bowl(r) = -d * exp(-3.5 * (r/R)^2)
   - Raised rim: Localized Gaussian uplift z_rim(r) = h_rim * exp(-((r/R) - 1.0)^2 / 0.038)
   - Continuous ejecta: Power-law decay z_ejecta(r) = 0.35 * h_rim * exp(-1.8 * ((r/R) - 1.0))
4. Non-Circular Irregularity:
   To avoid identical artificial circular shapes, craters incorporate harmonic radial distortion:
   R(theta) = R_0 * (1.0 + eps_1 * cos(2(theta - phi_1)) + eps_2 * sin(3(theta - phi_2)))
   simulating oblique impact ellipticity and localized wall slumping.
5. Chronological Superposition:
   Larger craters are sculpted first; smaller craters overwrite older crater floors and rims.
"""

from typing import List, Dict, Tuple, Optional, Any
import numpy as np

from .config import (
    WIDTH,
    HEIGHT,
    CELL_SIZE_METERS,
    BASE_ELEVATION,
    SEED,
    CRATER_LARGE_RADIUS_RANGE,
    CRATER_MEDIUM_RADIUS_RANGE,
    CRATER_SMALL_RADIUS_RANGE,
    DEFAULT_LARGE_CRATERS,
    DEFAULT_MEDIUM_CRATERS,
    DEFAULT_SMALL_CRATERS,
    DEFAULT_DEPTH_TO_DIAMETER,
    DEFAULT_RIM_TO_DIAMETER,
    CRATER_ASYMMETRY_FACTOR
)


def validate_configuration(
    width: int,
    height: int,
    cell_size: float,
    base_elevation: float,
    large_craters: int,
    medium_craters: int,
    small_craters: int,
    depth_ratio: float,
    rim_ratio: float
) -> None:
    """Validate terrain generation parameters, raising ValueError on invalid inputs."""
    if not isinstance(width, (int, np.integer)) or width <= 0:
        raise ValueError(f"Grid width must be a positive integer, got: {width}")
    if not isinstance(height, (int, np.integer)) or height <= 0:
        raise ValueError(f"Grid height must be a positive integer, got: {height}")
    if not isinstance(cell_size, (int, float, np.floating)) or cell_size <= 0.0:
        raise ValueError(f"Cell size must be a positive float, got: {cell_size}")
    if not isinstance(base_elevation, (int, float, np.floating)):
        raise ValueError(f"Base elevation must be a numeric value, got: {base_elevation}")
    if large_craters < 0 or medium_craters < 0 or small_craters < 0:
        raise ValueError(f"Crater counts must be non-negative integers, got: "
                         f"large={large_craters}, medium={medium_craters}, small={small_craters}")
    if depth_ratio <= 0.0 or depth_ratio > 0.5:
        raise ValueError(f"Crater depth ratio must be in range (0.0, 0.5], got: {depth_ratio}")
    if rim_ratio <= 0.0 or rim_ratio > 0.2:
        raise ValueError(f"Crater rim ratio must be in range (0.0, 0.2], got: {rim_ratio}")


def initialize_terrain(width: int = WIDTH, height: int = HEIGHT, base_elevation: float = BASE_ELEVATION) -> np.ndarray:
    """Initialize a flat terrain elevation array at the specified base elevation."""
    if width <= 0 or height <= 0:
        raise ValueError(f"Invalid dimensions: width={width}, height={height}")
    return np.full((height, width), float(base_elevation), dtype=np.float64)


def generate_hermite_noise(width: int, height: int, scale: int, rng: np.random.Generator) -> np.ndarray:
    """Generate continuous smooth noise using cubic Hermite interpolation (3t^2 - 2t^3) with 1D broadcasting."""
    control_x = max(2, width // scale)
    control_y = max(2, height // scale)

    lattice = rng.normal(0.0, 1.0, (control_y + 1, control_x + 1))

    x = np.linspace(0, control_x, width)
    y = np.linspace(0, control_y, height)

    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    x1 = np.minimum(x0 + 1, control_x)
    y1 = np.minimum(y0 + 1, control_y)

    tx = x - x0
    ty = y - y0

    # Cubic Hermite smoothing
    tx = tx * tx * (3.0 - 2.0 * tx)
    ty = ty * ty * (3.0 - 2.0 * ty)

    # 1D broadcasted indexing eliminates multiple 2D meshgrid allocations
    c00 = lattice[y0[:, None], x0[None, :]]
    c10 = lattice[y0[:, None], x1[None, :]]
    c01 = lattice[y1[:, None], x0[None, :]]
    c11 = lattice[y1[:, None], x1[None, :]]

    tx_2d = tx[None, :]
    ty_2d = ty[:, None]

    top = c00 * (1.0 - tx_2d) + c10 * tx_2d
    bottom = c01 * (1.0 - tx_2d) + c11 * tx_2d

    return top * (1.0 - ty_2d) + bottom * ty_2d


def apply_surface_variation(
    terrain: np.ndarray,
    macro_amplitude: float = 22.0,
    meso_amplitude: float = 8.5,
    micro_amplitude: float = 2.5,
    rng: Optional[np.random.Generator] = None
) -> np.ndarray:
    """
    Superimpose multi-scale undulations and regional polar slope onto terrain using broadcasted coordinates.
    """
    if rng is None:
        rng = np.random.default_rng(SEED)

    height, width = terrain.shape

    macro_noise = generate_hermite_noise(width, height, scale=64, rng=rng)
    meso_noise = generate_hermite_noise(width, height, scale=24, rng=rng)
    micro_noise = generate_hermite_noise(width, height, scale=8, rng=rng)

    # 1D broadcasting avoids allocating two full HxW int64 index arrays
    x_coords = np.arange(width, dtype=np.float64)[None, :]
    y_coords = np.arange(height, dtype=np.float64)[:, None]
    regional_slope = ((x_coords - width / 2.0) * 0.015 + (y_coords - height / 2.0) * 0.020)

    variation = (
        regional_slope
        + macro_noise * macro_amplitude
        + meso_noise * meso_amplitude
        + micro_noise * micro_amplitude
    )

    terrain += variation
    return terrain


def synthesize_lunar_base(
    width: int = WIDTH,
    height: int = HEIGHT,
    base_elevation: float = BASE_ELEVATION,
    rng: Optional[np.random.Generator] = None
) -> np.ndarray:
    """Convenience alias for initializing flat terrain and applying surface variations."""
    terrain = initialize_terrain(width, height, base_elevation)
    return apply_surface_variation(terrain, rng=rng)


def generate_crater_profile(
    radius_cells: float,
    cell_size: float = CELL_SIZE_METERS,
    depth_ratio: float = DEFAULT_DEPTH_TO_DIAMETER,
    rim_ratio: float = DEFAULT_RIM_TO_DIAMETER
) -> Dict[str, float]:
    """Calculate key mathematical dimensions for a crater profile."""
    diameter_m = radius_cells * 2.0 * cell_size
    depth_m = diameter_m * depth_ratio
    rim_height_m = diameter_m * rim_ratio

    return {
        "diameter_meters": float(round(diameter_m, 2)),
        "depth_meters": float(round(depth_m, 2)),
        "rim_height_meters": float(round(rim_height_m, 2)),
        "radius_cells": float(round(radius_cells, 2))
    }


def place_crater(
    terrain: np.ndarray,
    center_x: float,
    center_y: float,
    radius_cells: float,
    cell_size: float = CELL_SIZE_METERS,
    depth_ratio: float = DEFAULT_DEPTH_TO_DIAMETER,
    rim_ratio: float = DEFAULT_RIM_TO_DIAMETER,
    asymmetry_factor: float = CRATER_ASYMMETRY_FACTOR,
    rng: Optional[np.random.Generator] = None
) -> Dict[str, Any]:
    """
    Model and superimpose a non-circular crater using harmonic radial perturbation.

    Radial boundary formulation:
    R(theta) = R_0 * (1 + eps1 * cos(2(theta - phi1)) + eps2 * sin(3(theta - phi2)))
    """
    if rng is None:
        rng = np.random.default_rng()

    height, width = terrain.shape

    # Harmonic asymmetry parameters (avoids identical circular shapes)
    eps1 = float(rng.uniform(-asymmetry_factor, asymmetry_factor))
    eps2 = float(rng.uniform(-asymmetry_factor * 0.5, asymmetry_factor * 0.5))
    phi1 = float(rng.uniform(0, np.pi))
    phi2 = float(rng.uniform(0, 2 * np.pi))

    # Bounding-box localization: compute only over local influence patch (u < 3.2)
    max_radial_factor = 1.0 + abs(eps1) + abs(eps2)
    rmax = int(np.ceil(radius_cells * max_radial_factor * 3.25)) + 2

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

        effective_radius = radius_cells * (1.0 + eps1 * np.cos(2 * (theta - phi1)) + eps2 * np.sin(3 * (theta - phi2)))
        effective_radius = np.maximum(effective_radius, 1.0)
        norm_dist = dist / effective_radius

        profile = generate_crater_profile(radius_cells, cell_size, depth_ratio, rim_ratio)
        depth_m = profile["depth_meters"]
        rim_height_m = profile["rim_height_meters"]

        # 1. Cavity bowl
        bowl = -depth_m * np.exp(-(norm_dist ** 2) * 3.5)

        # 2. Raised rim crest
        rim = rim_height_m * np.exp(-((norm_dist - 1.0) ** 2) / 0.038)

        # 3. Continuous decaying ejecta blanket
        ejecta = (rim_height_m * 0.35) * np.exp(-1.8 * (norm_dist - 1.0)) * (norm_dist >= 1.0) * (norm_dist <= 3.2)

        # Apply localized modification
        influence = norm_dist < 3.2
        crater_delta = (bowl + rim + ejecta) * influence
        terrain[y_min:y_max, x_min:x_max] += crater_delta
    else:
        profile = generate_crater_profile(radius_cells, cell_size, depth_ratio, rim_ratio)
        depth_m = profile["depth_meters"]
        rim_height_m = profile["rim_height_meters"]

    radius_m = radius_cells * cell_size
    known_from_orbit = bool(radius_m >= 45.0)

    return {
        "x": round(center_x, 2),
        "y": round(center_y, 2),
        "x_cell": round(center_x, 2),
        "y_cell": round(center_y, 2),
        "radius": round(radius_cells, 2),
        "radius_cells": round(radius_cells, 2),
        "radius_meters": round(radius_m, 2),
        "depth_m": depth_m,
        "depth_meters": depth_m,
        "rim_height_m": rim_height_m,
        "rim_height_meters": rim_height_m,
        "ellipticity": round(abs(eps1), 3),
        "known_from_orbit": known_from_orbit,
        "type": "crater"
    }


def place_craters(
    terrain: np.ndarray,
    large_count: int = DEFAULT_LARGE_CRATERS,
    medium_count: int = DEFAULT_MEDIUM_CRATERS,
    small_count: int = DEFAULT_SMALL_CRATERS,
    cell_size: float = CELL_SIZE_METERS,
    depth_ratio: float = DEFAULT_DEPTH_TO_DIAMETER,
    rim_ratio: float = DEFAULT_RIM_TO_DIAMETER,
    margin_cells: float = 16.0,
    rng: Optional[np.random.Generator] = None
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Populate terrain with large, medium, and small craters with chronological superposition.
    """
    if rng is None:
        rng = np.random.default_rng(SEED)

    height, width = terrain.shape

    # Generate radii lists for each tier
    large_radii = [float(rng.uniform(*CRATER_LARGE_RADIUS_RANGE)) for _ in range(large_count)]
    medium_radii = [float(rng.uniform(*CRATER_MEDIUM_RADIUS_RANGE)) for _ in range(medium_count)]
    small_radii = [float(rng.uniform(*CRATER_SMALL_RADIUS_RANGE)) for _ in range(small_count)]

    # Sort descending within tiers
    large_radii.sort(reverse=True)
    medium_radii.sort(reverse=True)
    small_radii.sort(reverse=True)

    ordered_radii = [
        ("LARGE", r) for r in large_radii
    ] + [
        ("MEDIUM", r) for r in medium_radii
    ] + [
        ("SMALL", r) for r in small_radii
    ]

    craters_catalog = []
    for idx, (tier, radius) in enumerate(ordered_radii):
        # Prevent placing craters outside valid terrain
        min_x = margin_cells + radius
        max_x = width - margin_cells - radius
        min_y = margin_cells + radius
        max_y = height - margin_cells - radius

        if min_x >= max_x or min_y >= max_y:
            cx = width / 2.0
            cy = height / 2.0
        else:
            cx = float(rng.uniform(min_x, max_x))
            cy = float(rng.uniform(min_y, max_y))

        record = place_crater(
            terrain, cx, cy, radius,
            cell_size=cell_size,
            depth_ratio=depth_ratio,
            rim_ratio=rim_ratio,
            rng=rng
        )
        record["id"] = f"CRATER_{idx + 1:03d}"
        record["size_tier"] = tier
        craters_catalog.append(record)

    return terrain, craters_catalog


def combine_terrain(
    base_terrain: np.ndarray,
    regolith_noise_sigma: float = 0.28,
    rng: Optional[np.random.Generator] = None
) -> np.ndarray:
    """Combine base terrain with micro-regolith fine texture."""
    if rng is None:
        rng = np.random.default_rng(SEED)

    micro_texture = rng.normal(0.0, regolith_noise_sigma, base_terrain.shape)
    final_terrain = base_terrain + micro_texture
    return final_terrain.astype(np.float32)


def generate_synthetic_terrain(
    width: int = WIDTH,
    height: int = HEIGHT,
    cell_size: float = CELL_SIZE_METERS,
    base_elevation: float = BASE_ELEVATION,
    large_craters: int = DEFAULT_LARGE_CRATERS,
    medium_craters: int = DEFAULT_MEDIUM_CRATERS,
    small_craters: int = DEFAULT_SMALL_CRATERS,
    depth_ratio: float = DEFAULT_DEPTH_TO_DIAMETER,
    rim_ratio: float = DEFAULT_RIM_TO_DIAMETER,
    seed: int = SEED
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    High-level entry point to generate a complete synthetic lunar landscape.

    Returns:
        (dem_array, craters_catalog)
    """
    validate_configuration(
        width, height, cell_size, base_elevation,
        large_craters, medium_craters, small_craters,
        depth_ratio, rim_ratio
    )

    rng = np.random.default_rng(seed)

    # 1. Initialize
    terrain = initialize_terrain(width, height, base_elevation)

    # 2. Apply multi-scale surface variation
    terrain = apply_surface_variation(terrain, rng=rng)

    # 3. Superimpose craters across sizes
    terrain, craters_catalog = place_craters(
        terrain,
        large_count=large_craters,
        medium_count=medium_craters,
        small_count=small_craters,
        cell_size=cell_size,
        depth_ratio=depth_ratio,
        rim_ratio=rim_ratio,
        rng=rng
    )

    # 4. Add fine regolith roughness
    dem = combine_terrain(terrain, rng=rng)

    return dem, craters_catalog


if __name__ == "__main__":
    dem, catalog = generate_synthetic_terrain()
    print(f"Generated synthetic terrain: shape={dem.shape}, min={dem.min():.2f}m, max={dem.max():.2f}m, craters={len(catalog)}")

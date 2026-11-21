
import json
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt


# ==========================================================
# LUNAPATH-4D SYNTHETIC LUNAR TERRAIN GENERATOR
# ==========================================================

# Reproducibility
SEED = 42
rng = np.random.default_rng(SEED)

# Terrain dimensions
WIDTH = 256
HEIGHT = 256

# Distance represented by each grid cell
CELL_SIZE_METERS = 10.0

# Base elevation
BASE_ELEVATION = 120.0

# Output directory
ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT_DIR / "web" / "public" / "data"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ==========================================================
# 1. GENERATE MULTI-SCALE NOISE
# ==========================================================

def generate_noise(size, scale, rng):
    """
    Generate smooth noise by interpolating a smaller random grid.

    scale determines the number of random control points.
    Small scale = broad terrain features.
    Large scale = finer terrain features.
    """

    control_size = max(2, size // scale)

    random_grid = rng.normal(
        0.0,
        1.0,
        (control_size + 1, control_size + 1)
    )

    x = np.linspace(0, control_size, size)
    y = np.linspace(0, control_size, size)

    xx, yy = np.meshgrid(x, y)

    x0 = np.floor(xx).astype(int)
    y0 = np.floor(yy).astype(int)

    x1 = np.minimum(x0 + 1, control_size)
    y1 = np.minimum(y0 + 1, control_size)

    tx = xx - x0
    ty = yy - y0

    # Smooth interpolation
    tx = tx * tx * (3 - 2 * tx)
    ty = ty * ty * (3 - 2 * ty)

    a = random_grid[y0, x0]
    b = random_grid[y0, x1]
    c = random_grid[y1, x0]
    d = random_grid[y1, x1]

    top = a * (1 - tx) + b * tx
    bottom = c * (1 - tx) + d * tx

    return top * (1 - ty) + bottom * ty


# ==========================================================
# 2. CREATE BASE ELEVATION
# ==========================================================

def create_base_terrain():
    """
    Combine broad hills and smaller terrain variation.
    """

    broad_noise = generate_noise(
        WIDTH, 64, rng
    )

    medium_noise = generate_noise(
        WIDTH, 24, rng
    )

    fine_noise = generate_noise(
        WIDTH, 8, rng
    )

    terrain = (
        BASE_ELEVATION
        + broad_noise * 18.0
        + medium_noise * 7.0
        + fine_noise * 2.0
    )

    return terrain


# ==========================================================
# 3. ADD IMPACT CRATERS
# ==========================================================

def add_crater(terrain, center_x, center_y, radius):
    """
    Add a crater depression with a raised rim.

    All measurements here are in grid cells, not meters.
    """

    yy, xx = np.indices(terrain.shape)

    distance = np.sqrt(
        (xx - center_x) ** 2
        + (yy - center_y) ** 2
    )

    normalized_distance = distance / radius

    # Crater bowl
    bowl = -12.0 * np.exp(
        -(normalized_distance ** 2) * 4.0
    )

    # Raised rim around the bowl
    rim = 4.0 * np.exp(
        -((normalized_distance - 1.0) ** 2) / 0.035
    )

    # Only keep the crater influence within a finite region
    influence = normalized_distance < 2.0

    crater_shape = (bowl + rim) * influence

    terrain += crater_shape


def create_craters(terrain, number_of_craters=18):
    """
    Generate randomly positioned craters.
    """

    crater_metadata = []

    for _ in range(number_of_craters):

        margin = 25

        center_x = rng.integers(
            margin, WIDTH - margin
        )

        center_y = rng.integers(
            margin, HEIGHT - margin
        )

        radius = rng.uniform(4, 18)

        add_crater(
            terrain,
            center_x,
            center_y,
            radius
        )

        crater_metadata.append({
            "x": int(center_x),
            "y": int(center_y),
            "radius_cells": round(float(radius), 2),
            "radius_meters": round(
                float(radius * CELL_SIZE_METERS), 2
            )
        })

    return crater_metadata


# ==========================================================
# 4. GENERATE COMPLETE TERRAIN
# ==========================================================

def generate_terrain():

    print("Generating synthetic lunar terrain...")

    terrain = create_base_terrain()

    craters = create_craters(
        terrain,
        number_of_craters=18
    )

    # Small-scale surface roughness
    roughness = rng.normal(
        0.0,
        0.35,
        terrain.shape
    )

    terrain += roughness

    # Convert to float32 for compact data storage
    terrain = terrain.astype(np.float32)

    print("Terrain generated successfully.")

    return terrain, craters


# ==========================================================
# 5. SAVE TERRAIN DATA
# ==========================================================

def save_terrain(terrain, craters):

    # Binary elevation file
    binary_path = OUTPUT_DIR / "dem.bin"

    terrain.astype("<f4").tofile(binary_path)

    # NumPy file, useful for Python processing later
    numpy_path = OUTPUT_DIR / "dem.npy"

    np.save(numpy_path, terrain)

    # Metadata
    metadata = {
        "name": "LunaPath Synthetic Lunar Terrain",
        "source": "Synthetic procedural generation",
        "is_synthetic": True,
        "seed": SEED,
        "width": WIDTH,
        "height": HEIGHT,
        "cell_size_meters": CELL_SIZE_METERS,
        "grid_width_meters": WIDTH * CELL_SIZE_METERS,
        "grid_height_meters": HEIGHT * CELL_SIZE_METERS,
        "data_type": "float32",
        "byte_order": "little_endian",
        "binary_file": "dem.bin",
        "numpy_file": "dem.npy",
        "minimum_elevation_meters": float(terrain.min()),
        "maximum_elevation_meters": float(terrain.max()),
        "mean_elevation_meters": float(terrain.mean()),
        "crater_count": len(craters),
        "craters": craters
    }

    metadata_path = OUTPUT_DIR / "terrain_meta.json"

    with open(metadata_path, "w", encoding="utf-8") as file:
        json.dump(metadata, file, indent=4)

    print(f"Binary DEM saved: {binary_path}")
    print(f"NumPy DEM saved: {numpy_path}")
    print(f"Metadata saved: {metadata_path}")


# ==========================================================
# 6. VISUALIZE TERRAIN
# ==========================================================

def save_visualization(terrain):

    image_path = OUTPUT_DIR / "terrain_preview.png"

    plt.figure(figsize=(10, 8))

    image = plt.imshow(
        terrain,
        cmap="gray",
        origin="lower"
    )

    plt.title("LunaPath-4D Synthetic Lunar DEM")
    plt.xlabel("X Grid Coordinate")
    plt.ylabel("Y Grid Coordinate")

    plt.colorbar(
        image,
        label="Elevation (meters)"
    )

    plt.tight_layout()

    plt.savefig(
        image_path,
        dpi=150
    )

    plt.close()

    print(f"Terrain image saved: {image_path}")


# ==========================================================
# 7. MAIN
# ==========================================================

if __name__ == "__main__":

    terrain, craters = generate_terrain()

    save_terrain(terrain, craters)

    save_visualization(terrain)

    print("\n========== TERRAIN SUMMARY ==========")
    print(f"Dimensions: {terrain.shape}")
    print(f"Minimum elevation: {terrain.min():.2f} m")
    print(f"Maximum elevation: {terrain.max():.2f} m")
    print(f"Mean elevation: {terrain.mean():.2f} m")
    print(f"Craters generated: {len(craters)}")
    print("=================================")
    print("LunaPath terrain pipeline complete.")

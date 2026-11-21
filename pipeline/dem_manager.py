"""
Module 2: Digital Elevation Model (DEM) Management & Validation
Encapsulates 2D lunar elevation data, spatial metadata, missing-value handling,
physical bounds validation, and binary/NumPy serialization.
"""

from pathlib import Path
from typing import Tuple, Dict, Any, Optional
import json
import numpy as np

from .config import (
    WIDTH,
    HEIGHT,
    CELL_SIZE_METERS,
    BASE_ELEVATION,
    ELEVATION_UNITS,
    COORDINATE_SYSTEM,
    ORIGIN_LATITUDE_DEG,
    ORIGIN_LONGITUDE_DEG,
    ROW_AXIS_CONVENTION,
    COL_AXIS_CONVENTION,
    LUNAR_REGION
)

# Optional geospatial rasterio import
try:
    import rasterio
    from rasterio.transform import from_origin
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False


class DigitalElevationModel:
    """
    Structured container for a 2D lunar Digital Elevation Model (DEM).
    Guarantees consistent units, coordinate transformations, validation, and serialization.
    """

    def __init__(
        self,
        elevation_data: Optional[np.ndarray] = None,
        cell_size_meters: Optional[float] = None,
        cell_size: Optional[float] = None,
        base_elevation: float = BASE_ELEVATION,
        origin_lat: float = ORIGIN_LATITUDE_DEG,
        origin_lon: float = ORIGIN_LONGITUDE_DEG
    ):
        actual_cell_size = cell_size if cell_size is not None else (
            cell_size_meters if cell_size_meters is not None else CELL_SIZE_METERS
        )
        self.cell_size_meters: float = float(actual_cell_size)
        self.cell_size: float = self.cell_size_meters
        self.base_elevation: float = float(base_elevation)
        self.origin_lat: float = float(origin_lat)
        self.origin_lon: float = float(origin_lon)
        self.units: str = ELEVATION_UNITS
        self.coordinate_system: str = COORDINATE_SYSTEM

        if elevation_data is not None:
            if not isinstance(elevation_data, np.ndarray):
                raise TypeError(f"elevation_data must be a NumPy array, got {type(elevation_data)}")
            if elevation_data.ndim != 2:
                raise ValueError(f"elevation_data must be a 2D array, got shape {elevation_data.shape}")
            self.data: np.ndarray = elevation_data.astype(np.float32)
            self.height, self.width = self.data.shape
        else:
            self.data: np.ndarray = np.zeros((HEIGHT, WIDTH), dtype=np.float32)
            self.height, self.width = HEIGHT, WIDTH

    @property
    def min_elevation(self) -> float:
        return float(np.nanmin(self.data))

    @property
    def max_elevation(self) -> float:
        return float(np.nanmax(self.data))

    @property
    def relief(self) -> float:
        return self.max_elevation - self.min_elevation

    # -------------------------------------------------------------
    # Validation & Missing Value Handling
    # -------------------------------------------------------------

    def validate(self, min_valid: float = -2000.0, max_valid: float = 5000.0, raise_on_error: bool = True) -> bool:
        """
        Validate DEM data integrity:
        - Check for NaN values.
        - Check for Infinity values.
        - Check that elevations lie within physically consistent limits.
        """
        has_nan = bool(np.isnan(self.data).any())
        has_inf = bool(np.isinf(self.data).any())
        val_min = float(np.nanmin(self.data)) if not has_nan else float("-inf")
        val_max = float(np.nanmax(self.data)) if not has_nan else float("inf")
        out_of_bounds = val_min < min_valid or val_max > max_valid

        if has_nan or has_inf or out_of_bounds:
            msg = (
                f"DEM validation failed: has_nan={has_nan}, has_inf={has_inf}, "
                f"elevation_range=[{val_min:.2f}, {val_max:.2f}] (expected [{min_valid}, {max_valid}])"
            )
            if raise_on_error:
                raise ValueError(msg)
            return False

        return True

    def handle_missing_values(self, fill_value: Optional[float] = None) -> int:
        """
        Detect and replace any NaN or Infinite values with a valid elevation.
        Returns the number of patched cells.
        """
        invalid_mask = np.isnan(self.data) | np.isinf(self.data)
        count = int(np.sum(invalid_mask))

        if count > 0:
            if fill_value is None:
                valid_values = self.data[~invalid_mask]
                fill_value = float(np.median(valid_values)) if len(valid_values) > 0 else self.base_elevation

            self.data[invalid_mask] = np.float32(fill_value)

        return count

    # -------------------------------------------------------------
    # Coordinate Transforms
    # -------------------------------------------------------------

    def grid_to_world(self, col: float, row: float) -> Tuple[float, float]:
        """Convert grid column (X) and row (Y) to physical metric coordinates."""
        x_meters = col * self.cell_size_meters
        y_meters = row * self.cell_size_meters
        return round(x_meters, 2), round(y_meters, 2)

    def world_to_grid(self, x: float, y: float) -> Tuple[int, int]:
        """Convert physical metric coordinates (X, Y) to discrete grid indices."""
        col = int(np.clip(round(x / self.cell_size_meters), 0, self.width - 1))
        row = int(np.clip(round(y / self.cell_size_meters), 0, self.height - 1))
        return col, row

    def get_elevation_at_world(self, x: float, y: float) -> float:
        """Query elevation at metric coordinates (X, Y)."""
        col, row = self.world_to_grid(x, y)
        return float(self.data[row, col])

    def grid_to_threejs_world(self, col: float, row: float, elevation: float, base_elev: float = 0.0) -> Tuple[float, float, float]:
        """Convert grid coordinate to Three.js 3D world space."""
        x_3d = (col - (self.width / 2.0)) * self.cell_size_meters
        z_3d = -(row - (self.height / 2.0)) * self.cell_size_meters
        y_3d = elevation - base_elev
        return round(x_3d, 2), round(y_3d, 2), round(z_3d, 2)

    # -------------------------------------------------------------
    # Serialization & I/O
    # -------------------------------------------------------------

    def save_binary(self, filepath: Path) -> Path:
        """Save DEM as a contiguous little-endian float32 binary file."""
        filepath = Path(filepath)
        self.data.astype("<f4").tofile(filepath)
        return filepath

    def save_numpy(self, filepath: Path) -> Path:
        """Save DEM as a standard NumPy .npy file."""
        filepath = Path(filepath)
        np.save(filepath, self.data)
        return filepath

    def save_metadata(self, filepath: Path) -> Path:
        """Export DEM metadata as UTF-8 formatted JSON."""
        filepath = Path(filepath)
        payload = self.to_dict()
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=4)
        return filepath

    def save_geotiff(self, filepath: Path) -> bool:
        """Export DEM as GeoTIFF via Rasterio if available."""
        if not RASTERIO_AVAILABLE:
            return False

        filepath = Path(filepath)
        transform = from_origin(0.0, self.height * self.cell_size_meters, self.cell_size_meters, self.cell_size_meters)

        with rasterio.open(
            filepath,
            "w",
            driver="GTiff",
            height=self.height,
            width=self.width,
            count=1,
            dtype=self.data.dtype,
            crs="+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
            transform=transform,
        ) as dst:
            dst.write(self.data, 1)

        return True

    @classmethod
    def load_binary(
        cls,
        filepath: Path,
        width: int = WIDTH,
        height: int = HEIGHT,
        cell_size: float = CELL_SIZE_METERS,
        cell_size_meters: Optional[float] = None
    ) -> "DigitalElevationModel":
        """Load a DEM from a little-endian float32 binary file."""
        filepath = Path(filepath)
        if not filepath.exists():
            raise FileNotFoundError(f"Binary DEM not found: {filepath}")
        eff_cell_size = cell_size_meters if cell_size_meters is not None else cell_size
        raw = np.fromfile(filepath, dtype="<f4").reshape((height, width))
        return cls(raw, cell_size_meters=eff_cell_size)

    @classmethod
    def load_numpy(
        cls,
        filepath: Path,
        cell_size: float = CELL_SIZE_METERS,
        cell_size_meters: Optional[float] = None
    ) -> "DigitalElevationModel":
        """Load a DEM from a NumPy .npy file."""
        filepath = Path(filepath)
        if not filepath.exists():
            raise FileNotFoundError(f"NumPy DEM not found: {filepath}")
        eff_cell_size = cell_size_meters if cell_size_meters is not None else cell_size
        arr = np.load(filepath)
        return cls(arr, cell_size_meters=eff_cell_size)

    def to_dict(self) -> Dict[str, Any]:
        """Generate structured metadata dictionary."""
        return {
            "width": self.width,
            "height": self.height,
            "grid_shape": [self.height, self.width],
            "cell_size_meters": self.cell_size_meters,
            "grid_width_meters": self.width * self.cell_size_meters,
            "grid_height_meters": self.height * self.cell_size_meters,
            "elevation_units": self.units,
            "base_elevation_meters": self.base_elevation,
            "minimum_elevation_meters": float(self.data.min()),
            "maximum_elevation_meters": float(self.data.max()),
            "mean_elevation_meters": float(self.data.mean()),
            "total_relief_meters": float(self.data.max() - self.data.min()),
            "origin_coordinates": {
                "latitude_deg": self.origin_lat,
                "longitude_deg": self.origin_lon,
                "region": LUNAR_REGION
            },
            "coordinate_conventions": {
                "coordinate_system": self.coordinate_system,
                "row_axis": ROW_AXIS_CONVENTION,
                "column_axis": COL_AXIS_CONVENTION
            },
            "data_format": {
                "dtype": "float32",
                "byte_order": "little_endian",
                "total_bytes": self.width * self.height * 4
            }
        }


# Maintain DEMManager alias for backward compatibility
DEMManager = DigitalElevationModel


if __name__ == "__main__":
    dummy = np.random.normal(120.0, 5.0, (256, 256)).astype(np.float32)
    dem = DigitalElevationModel(dummy)
    assert dem.validate()
    print("DEM validation successful:", dem.to_dict()["minimum_elevation_meters"])

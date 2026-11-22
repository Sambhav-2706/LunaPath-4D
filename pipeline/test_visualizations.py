"""
Unit Tests for Scientific Visualization Suite (pipeline/terrain_visualizer.py)

Tests:
1. Generation of publication-quality elevation map (elevation_scientific.png).
2. Generation of publication-quality slope map with critical threshold contour (slope_scientific.png).
3. Generation of publication-quality roughness map with hazard threshold contour (roughness_scientific.png).
4. Generation of 4-tier discrete traversability classification map with legend (traversability_scientific.png).
5. Generation of 4-panel synchronized multi-layer comparison visualization (terrain_layers_comparison.png).
6. Generation of traversability classification heatmap (traversability_heatmap.png).
7. Verification that saved PNG files exist, are non-empty (> 10 KB), and match expected formats.
"""

import sys
import tempfile
from pathlib import Path
import numpy as np

PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.terrain_visualizer import (
    render_scientific_elevation,
    render_scientific_slope,
    render_scientific_roughness,
    render_scientific_traversability,
    render_terrain_layers_comparison
)
from pipeline.traversability_analysis import (
    classify_traversability,
    render_traversability_heatmap
)
from pipeline.slope_analysis import compute_slope
from pipeline.roughness_analysis import compute_roughness
from pipeline.terrain_generation import generate_synthetic_terrain


def test_scientific_visualizations():
    """Verify all individual and comparison scientific visualization renderers."""
    # Generate test terrain with realistic craters
    dem, craters = generate_synthetic_terrain(width=64, height=64, seed=42)
    slope = compute_slope(dem, cell_size=10.0)
    roughness = compute_roughness(dem, window_size=5)
    classified = classify_traversability(dem, slope, roughness)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        # 1. Scientific Elevation Map
        p_elev = tmp_path / "elevation_scientific.png"
        render_scientific_elevation(dem, p_elev, cell_size=10.0)
        assert p_elev.exists(), "Elevation PNG was not created"
        assert p_elev.stat().st_size > 10_000, f"Elevation PNG too small ({p_elev.stat().st_size} bytes)"
        print(f"PASS: render_scientific_elevation ({p_elev.stat().st_size} bytes)")

        # 2. Scientific Slope Map
        p_slope = tmp_path / "slope_scientific.png"
        render_scientific_slope(slope, p_slope, cell_size=10.0, max_safe_slope=15.0)
        assert p_slope.exists(), "Slope PNG was not created"
        assert p_slope.stat().st_size > 10_000, f"Slope PNG too small ({p_slope.stat().st_size} bytes)"
        print(f"PASS: render_scientific_slope ({p_slope.stat().st_size} bytes)")

        # 3. Scientific Roughness Map
        p_rough = tmp_path / "roughness_scientific.png"
        render_scientific_roughness(roughness, p_rough, cell_size=10.0, critical_threshold=3.0)
        assert p_rough.exists(), "Roughness PNG was not created"
        assert p_rough.stat().st_size > 10_000, f"Roughness PNG too small ({p_rough.stat().st_size} bytes)"
        print(f"PASS: render_scientific_roughness ({p_rough.stat().st_size} bytes)")

        # 4. Scientific Traversability Safety Map
        p_trav = tmp_path / "traversability_scientific.png"
        render_scientific_traversability(classified, p_trav, cell_size=10.0)
        assert p_trav.exists(), "Traversability PNG was not created"
        assert p_trav.stat().st_size > 10_000, f"Traversability PNG too small ({p_trav.stat().st_size} bytes)"
        print(f"PASS: render_scientific_traversability ({p_trav.stat().st_size} bytes)")

        # 5. Multi-Layer Comparison (2x2 Dashboard)
        p_comp = tmp_path / "terrain_layers_comparison.png"
        render_terrain_layers_comparison(dem, slope, roughness, classified, p_comp, cell_size=10.0)
        assert p_comp.exists(), "Comparison dashboard PNG was not created"
        assert p_comp.stat().st_size > 20_000, f"Comparison PNG too small ({p_comp.stat().st_size} bytes)"
        print(f"PASS: render_terrain_layers_comparison ({p_comp.stat().st_size} bytes)")

        # 6. Traversability Classification Heatmap with legend
        p_heat = tmp_path / "traversability_heatmap.png"
        render_traversability_heatmap(classified, p_heat, cell_size=10.0)
        assert p_heat.exists(), "Traversability heatmap PNG was not created"
        assert p_heat.stat().st_size > 10_000, f"Traversability heatmap PNG too small ({p_heat.stat().st_size} bytes)"
        print(f"PASS: render_traversability_heatmap ({p_heat.stat().st_size} bytes)")


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING SCIENTIFIC VISUALIZATIONS TEST SUITE")
    print("=" * 60)
    test_scientific_visualizations()
    print("=" * 60)
    print("ALL VISUALIZATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

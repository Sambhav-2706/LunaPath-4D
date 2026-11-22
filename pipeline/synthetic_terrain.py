"""
LunaPath-4D: Synthetic Lunar Terrain Pipeline Entry Point
Delegates execution directly to the modular master orchestrator.
Preserves full backward compatibility with the command documented in README.md:
    python pipeline/synthetic_terrain.py
"""

import sys
from pathlib import Path

# Add project root to Python search path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from pipeline.pipeline_orchestrator import run_full_pipeline

if __name__ == "__main__":
    run_full_pipeline()

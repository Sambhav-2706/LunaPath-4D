"""
LunaPath-4D Master Launcher
Cross-platform script to run Mission Control web app, tests, or pipeline.

Usage:
    python run.py             # Launch web server & open browser (default)
    python run.py dev         # Launch web dev server
    python run.py build       # Build production bundle
    python run.py test        # Run all Python & JS test suites
    python run.py pipeline    # Run 8-stage terrain pipeline
"""

import sys
import os
import subprocess
import webbrowser

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(PROJECT_ROOT, "web")
VENV_DIR = os.path.join(PROJECT_ROOT, ".venv")


def get_python_exe():
    if sys.platform == "win32":
        venv_py = os.path.join(VENV_DIR, "Scripts", "python.exe")
    else:
        venv_py = os.path.join(VENV_DIR, "bin", "python")
    return venv_py if os.path.exists(venv_py) else sys.executable


def get_pytest_exe():
    if sys.platform == "win32":
        venv_pt = os.path.join(VENV_DIR, "Scripts", "pytest.exe")
    else:
        venv_pt = os.path.join(VENV_DIR, "bin", "pytest")
    return venv_pt if os.path.exists(venv_pt) else "pytest"


def ensure_npm_dependencies():
    node_modules = os.path.join(WEB_DIR, "node_modules")
    if not os.path.exists(node_modules):
        print("[SETUP] Installing web dependencies...")
        subprocess.run(["npm", "install"], cwd=WEB_DIR, check=True, shell=sys.platform == "win32")
        print("[SETUP] Dependencies installed successfully.\n")


def run_dev():
    ensure_npm_dependencies()
    print("=" * 55)
    print("           LUNAPATH-4D MISSION CONTROL")
    print("     Autonomous Lunar Rover Simulation System")
    print("=" * 55)
    print("\n[STATUS] Starting Vite Mission Control server...")
    print("[INFO] Dashboard URL: http://localhost:5173")
    print("[INFO] Press Ctrl+C to terminate the server.\n")

    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

    subprocess.run(["npm", "run", "dev"], cwd=WEB_DIR, shell=sys.platform == "win32")


def run_build():
    ensure_npm_dependencies()
    print("[BUILD] Compiling production assets with Vite...")
    subprocess.run(["npm", "run", "build"], cwd=WEB_DIR, check=True, shell=sys.platform == "win32")


def run_tests():
    print("=" * 55)
    print("[TEST 1/2] Running Python pipeline test suite...")
    print("=" * 55)
    pytest_exe = get_pytest_exe()
    subprocess.run([pytest_exe, "-v", "pipeline/"], cwd=PROJECT_ROOT, check=True)

    print("\n" + "=" * 55)
    print("[TEST 2/2] Running Member 3 Navigation test suite...")
    print("=" * 55)
    test_scripts = [
        "navigation/testAStar.js",
        "navigation/testPathPlanner.js",
        "navigation/testHazardDetection.js",
        "navigation/testDynamicReplanner.js",
        "navigation/testMissionController.js"
    ]
    for script in test_scripts:
        subprocess.run(["node", script], cwd=WEB_DIR, check=True)
    print("\n[PASS] All test suites completed successfully!")


def run_pipeline():
    print("[PIPELINE] Running 8-stage terrain engineering pipeline...")
    py_exe = get_python_exe()
    subprocess.run([py_exe, "pipeline/pipeline_orchestrator.py"], cwd=PROJECT_ROOT, check=True)


if __name__ == "__main__":
    action = sys.argv[1].lower() if len(sys.argv) > 1 else "dev"

    if action in ("dev", "web", "start"):
        run_dev()
    elif action == "build":
        run_build()
    elif action == "test":
        run_tests()
    elif action == "pipeline":
        run_pipeline()
    else:
        print(f"Unknown action: {action}")
        print("Available actions: dev, build, test, pipeline")
        sys.exit(1)

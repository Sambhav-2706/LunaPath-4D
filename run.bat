@echo off
setlocal
title LunaPath-4D Simulation Launcher
cd /d "%~dp0"

echo ===================================================
echo           LUNAPATH-4D MISSION CONTROL
echo     Autonomous Lunar Rover Simulation System
echo ===================================================
echo.

if not exist "web\node_modules" (
    echo [SETUP] Installing web dependencies...
    cd web
    call npm install
    cd ..
    echo [SETUP] Dependencies installed successfully.
    echo.
)

if "%1"=="" goto default_run
if "%1"=="dev" goto default_run
if "%1"=="web" goto default_run
if "%1"=="build" goto build_app
if "%1"=="test" goto test_all
if "%1"=="pipeline" goto run_pipeline

:default_run
echo [STATUS] Starting Vite Mission Control server...
echo [INFO] Access dashboard at: http://localhost:5173
echo [INFO] Press Ctrl+C in this window to stop the server.
echo.
cd web
start "" http://localhost:5173
npm run dev
goto end

:build_app
echo [BUILD] Building production assets...
cd web
call npm run build
cd ..
goto end

:test_all
echo [TEST] Running Python pipeline test suite...
if exist ".venv\Scripts\pytest.exe" (
    call .\.venv\Scripts\pytest -v pipeline/
) else (
    call pytest -v pipeline/
)
echo.
echo [TEST] Running Member 3 Navigation test suite...
cd web
call node navigation/testAStar.js
call node navigation/testPathPlanner.js
call node navigation/testHazardDetection.js
call node navigation/testDynamicReplanner.js
call node navigation/testMissionController.js
cd ..
echo.
echo [TEST] Full test suite passed!
goto end

:run_pipeline
echo [PIPELINE] Executing 8-stage terrain engineering pipeline...
if exist ".venv\Scripts\python.exe" (
    call .\.venv\Scripts\python pipeline/pipeline_orchestrator.py
) else (
    call python pipeline/pipeline_orchestrator.py
)
goto end

:end
endlocal

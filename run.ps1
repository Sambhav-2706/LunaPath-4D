<#
.SYNOPSIS
    LunaPath-4D Master Launcher Script
.DESCRIPTION
    Launches the web application, runs automated tests, or executes the terrain engineering pipeline.
.PARAMETER Action
    Action to perform: 'dev' (default), 'build', 'test', 'pipeline'
.EXAMPLE
    .\run.ps1
    .\run.ps1 -Action build
    .\run.ps1 -Action test
    .\run.ps1 -Action pipeline
#>

[CmdletBinding()]
param(
    [ValidateSet("dev", "web", "build", "test", "pipeline")]
    [string]$Action = "dev",
    [switch]$NoBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
Set-Location -Path $ProjectRoot

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "          LUNAPATH-4D MISSION CONTROL              " -ForegroundColor Cyan
Write-Host "    Autonomous Lunar Rover Simulation System       " -ForegroundColor DarkCyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure node_modules exist
$WebDir = Join-Path $ProjectRoot "web"
$NodeModulesDir = Join-Path $WebDir "node_modules"

if (-not (Test-Path $NodeModulesDir)) {
    Write-Host "[SETUP] Installing web dependencies..." -ForegroundColor Yellow
    Push-Location $WebDir
    npm install
    Pop-Location
    Write-Host "[SETUP] Dependencies installed." -ForegroundColor Green
    Write-Host ""
}

switch ($Action) {
    { $_ -in "dev", "web" } {
        Write-Host "[LAUNCH] Starting Mission Control Web Dashboard..." -ForegroundColor Green
        Write-Host "[INFO] Local address: http://localhost:5173" -ForegroundColor Yellow
        Write-Host "[INFO] Press Ctrl+C to terminate the server." -ForegroundColor DarkGray
        Write-Host ""
        
        if (-not $NoBrowser) {
            Start-Process "http://localhost:5173"
        }
        
        Push-Location $WebDir
        try {
            npm run dev
        } finally {
            Pop-Location
        }
    }

    "build" {
        Write-Host "[BUILD] Compiling production build with Vite..." -ForegroundColor Cyan
        Push-Location $WebDir
        try {
            npm run build
        } finally {
            Pop-Location
        }
    }

    "test" {
        Write-Host "[TEST] Executing Python test suite (69 tests)..." -ForegroundColor Cyan
        $VenvPytest = Join-Path $ProjectRoot ".venv\Scripts\pytest.exe"
        if (Test-Path $VenvPytest) {
            & $VenvPytest -v pipeline/
        } else {
            pytest -v pipeline/
        }

        Write-Host ""
        Write-Host "[TEST] Executing JavaScript navigation test suite..." -ForegroundColor Cyan
        Push-Location $WebDir
        try {
            node navigation/testAStar.js
            node navigation/testPathPlanner.js
            node navigation/testHazardDetection.js
            node navigation/testDynamicReplanner.js
            node navigation/testMissionController.js
        } finally {
            Pop-Location
        }
        Write-Host ""
        Write-Host "[PASS] All test suites completed successfully!" -ForegroundColor Green
    }

    "pipeline" {
        Write-Host "[PIPELINE] Executing Member 1 Terrain & Data Engineering Pipeline..." -ForegroundColor Cyan
        $VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
        if (Test-Path $VenvPython) {
            & $VenvPython pipeline/pipeline_orchestrator.py
        } else {
            python pipeline/pipeline_orchestrator.py
        }
    }
}

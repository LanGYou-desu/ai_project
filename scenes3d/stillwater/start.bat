@echo off
setlocal
cd /d "%~dp0"
title STILLWATER

echo.
echo   STILLWATER - one-click launcher
echo   --------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js was not found.
  echo   Install Node.js 20.19+ or 22.12+ from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=12)||(v[0]===20&&v[1]>=19)?0:1)"
if errorlevel 1 (
  echo   This demo requires Node.js 20.19+ or 22.12+.
  echo   Your current version is:
  node --version
  echo   Install a newer Node.js from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo   npm was not found. Reinstall Node.js with npm included.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo   Installing dependencies...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   Dependency installation failed.
    echo   Check your network connection and try again.
    echo.
    pause
    exit /b 1
  )
)

echo   Checking for an existing STILLWATER server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2; if ($r.StatusCode -eq 200 -and $r.Content -match 'STILLWATER') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  echo   Already running. Opening the browser.
  start "" "http://127.0.0.1:5173/"
  timeout /t 2 /nobreak >nul
  exit /b 0
)

echo.
echo   Starting Vite...
echo   The browser will open when the server is ready.
echo   Keep this window open. Press Ctrl+C to stop the demo.
echo.
call npm run dev -- --open

echo.
echo   STILLWATER server stopped.
echo.
pause
endlocal

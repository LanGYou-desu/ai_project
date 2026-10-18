@echo off
rem personal-os launcher (ASCII only: no codepage or encoding issues in cmd)
rem Double-click this file to start. Requires Node.js 20+.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [personal-os] Node.js not found.
  echo [personal-os] Please install Node.js 20 or newer: https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo [personal-os] First run: installing dependencies, this may take a while...
  call npm install
  if errorlevel 1 (
    echo [personal-os] npm install failed. Check your network and try again.
    pause
    exit /b 1
  )
)

echo.
echo  ============================================
echo   personal-os is starting
echo   URL:   http://localhost:5180
echo   Disk:  disk\disk.img
echo   Press Ctrl+C in this window to stop
echo  ============================================
echo.

call npm run dev -- --open
pause

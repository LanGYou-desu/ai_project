@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)
echo Starting 3D showroom at http://127.0.0.1:8080 ...
node server.js
pause

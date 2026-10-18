@echo off
chcp 65001 >nul
cd /d %~dp0
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is required. Please install Node.js first.
  pause
  exit /b 1
)
echo Starting THE VANISHED ...
echo Browser will open at http://127.0.0.1:8768
node server.js
pause

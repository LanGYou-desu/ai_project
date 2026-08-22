@echo off
cd /d "%~dp0"

echo.
echo   The History Reader - History Reader
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo Error: node not found in PATH.
  echo Please install Node.js from https://nodejs.org/
  echo and add it to your system PATH.
  echo.
  pause
  exit /b 1
)

echo   Starting server...
echo.

node server.js

if %errorlevel% neq 0 (
  echo.
  echo Server exited with an error. Check the output above.
  pause
)
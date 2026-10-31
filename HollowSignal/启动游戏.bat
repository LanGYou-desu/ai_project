@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Hollow Signal - Local Server

echo.
echo   The Hollow Signal - One-click launcher
echo   --------------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] Node.js was not found.
  echo   Install Node.js 20 or newer from:
  echo   https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "server.mjs" (
  echo   [ERROR] server.mjs was not found.
  echo   Put this script in the HollowSignal project root.
  echo.
  pause
  exit /b 1
)

netstat -ano | findstr /C:":4173" | findstr /C:"LISTENING" >nul
if not errorlevel 1 (
  echo   The server is already running. Opening the browser...
  start "" "http://127.0.0.1:4173/"
  timeout /t 1 >nul
  exit /b 0
)

echo   Starting the local server...
echo   The browser will open automatically.
echo   If it does not, open:
echo   http://127.0.0.1:4173/
echo.
echo   Close this window or press Ctrl+C to stop the server.
echo.

node server.mjs
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo   [ERROR] The server exited with code %EXIT_CODE%.
  echo   Check whether port 4173 is already in use.
  echo   To use another port, run:
  echo   set PORT=8080 ^&^& node server.mjs
) else (
  echo   Server stopped.
)
echo.
pause

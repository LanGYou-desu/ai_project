@echo off
rem ============================================================
rem  Stellar Post - One-click Launcher (start.bat)
rem  IMPORTANT: keep this file ASCII-only. cmd.exe parses batch
rem  files with the system code page, and non-ASCII bytes can
rem  break command parsing.
rem ============================================================
setlocal
cd /d "%~dp0"
chcp 65001 >nul

echo.
echo ============================================
echo    Stellar Post - One-click Start
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 goto nonode

echo [1/2] Starting local server (browser opens automatically)...
echo       URL: http://127.0.0.1:5177/
echo       Stop with Ctrl+C in this window.
echo.
node server.js
goto end

:nonode
echo [ERROR] Node.js was not found.
echo         Install Node.js 18 or newer from https://nodejs.org
echo.
pause

:end
endlocal

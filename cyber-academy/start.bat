@echo off
rem ============================================================
rem  Cyber Security Academy - One-click Launcher (start.bat)
rem  IMPORTANT: this file must stay ASCII-only.
rem  Batch files are parsed by cmd.exe using the system code page;
rem  any non-ASCII byte can be misread and break command parsing.
rem ============================================================
setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo   Cyber Security Academy - One-click Start
echo ============================================

rem ---- check Node.js ----
where node >nul 2>nul
if errorlevel 1 goto nonode

echo [1/3] Checking practice assets...
if not exist "practice\login.pcap" goto gen
echo       Practice assets exist, skipping.
goto serv

:gen
echo [1/3] Generating practice assets (practice\ + wordlist)...
node make-practice.js

:serv
echo [2/3] Starting game + lab server (this opens a new window)...
start "Cyber-Academy-Server" cmd /k "cd /d ""%~dp0"" && node server.js"
timeout /t 2 /nobreak >nul

echo [3/3] Opening browser...
start "" "http://localhost:8080"

echo.
echo ============================================
echo   Ready!
echo     Game:      http://localhost:8080
echo     Real lab:  http://127.0.0.1:8090
echo     Real tools:node tools\scanlab.js 127.0.0.1
echo     Practice:  practice\
echo     Stop:      close the "Cyber-Academy-Server" window (Ctrl+C)
echo ============================================
echo.
pause
goto end

:nonode
echo [ERROR] Node.js not found. Please install it first:
echo         https://nodejs.org
echo.
pause

:end
endlocal

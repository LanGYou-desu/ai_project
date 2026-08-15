@echo off
rem ============================================================
rem  DevSaga - Programmer Simulator (one-click launcher)
rem  Double-click this file to start the game.
rem  Requires Python 3.10+ on PATH.
rem  NOTE: keep this file ASCII-only (cmd parses it in OEM codepage).
rem ============================================================
chcp 65001 >nul
setlocal
title DevSaga - Programmer Simulator
cd /d "%~dp0"

rem ---- locate Python (try python / py / python3) ----
set "PYCMD="
where python >nul 2>nul && set "PYCMD=python"
if not defined PYCMD ( where py >nul 2>nul && set "PYCMD=py -3" )
if not defined PYCMD ( where python3 >nul 2>nul && set "PYCMD=python3" )
if not defined PYCMD (
    echo.
    echo   [ERROR] Python not found!
    echo   Please install Python 3.10+ : https://www.python.org/downloads/
    echo   Remember to check "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)

set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"

:menu
cls
echo.
echo   ============================================
echo      DevSaga - Programmer Simulator
echo      One-Click Launcher
echo   ============================================
echo.
echo     [1] Play game (main menu)
echo     [1] Play in browser  (web UI, recommended)
echo     [2] Play in terminal  (classic)
echo     [3] Bot demo (clear all 10 scenarios)
echo     [4] Judge algorithm solution file
echo     [5] Create desktop shortcut
echo     [0] Quit
echo.
set /p CHOICE=   Your choice:
if "%CHOICE%"=="" exit /b 0
if "%CHOICE%"=="1" goto web
if "%CHOICE%"=="2" goto play
if "%CHOICE%"=="3" goto bot
if "%CHOICE%"=="4" goto grade
if "%CHOICE%"=="5" goto shortcut
if "%CHOICE%"=="0" exit /b 0
goto menu

:web
echo.
echo   Starting web UI, opening browser...
echo   (close the small server window to stop the game)
start "DevSaga Web" /min cmd /c "%PYCMD% main.py --web"
goto menu

:play
echo.
echo   Starting game...
%PYCMD% main.py
echo.
echo   (Game closed, back to launcher)
echo.
pause
goto menu

:bot
echo.
echo   Bot BOT-9000 is clearing all scenarios, please wait...
%PYCMD% main.py --bot
echo.
pause
goto menu

:grade
echo.
set /p GRADEFILE=   Path to your solution file (Enter to cancel):
if "%GRADEFILE%"=="" (
    echo   [Hint] No file given, back to menu.
) else (
    %PYCMD% main.py --grade algo_arena "%GRADEFILE%"
)
echo.
pause
goto menu

:shortcut
rem %~f0 = real full path of this .bat (Unicode-safe, no literal Chinese needed)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$sc = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\DevSaga.lnk');" ^
  "$sc.TargetPath = '%~f0';" ^
  "$sc.WorkingDirectory = '%~dp0';" ^
  "$sc.IconLocation = '%SystemRoot%\System32\imageres.dll, 25';" ^
  "$sc.Description = 'DevSaga Programmer Simulator';" ^
  "$sc.Save()"
if exist "%USERPROFILE%\Desktop\DevSaga.lnk" (
    echo   [OK] Desktop shortcut created: DevSaga.lnk
) else (
    echo   [WARN] Shortcut creation failed; create one manually instead.
)
echo.
pause
goto menu

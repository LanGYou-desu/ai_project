@echo off
rem ============================================
rem  Desktop Ghost - The House Guest
rem  (ASCII-only on purpose: cmd parses batch
rem   files with the OEM codepage, so Chinese
rem   text in .bat files can garble on some
rem   systems. The game itself prints Chinese
rem   fine from Python.)
rem ============================================
chcp 65001 >nul
cd /d %~dp0

where python >nul 2>nul
if errorlevel 1 (
    where py >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Python not found. Please install Python 3 and add it to PATH.
        pause
        exit /b 1
    )
    py -3 main.py %*
    pause
    exit /b 0
)

python main.py %*
echo.
pause

@echo off
rem ASCII-only batch file (see start.bat for why)
chcp 65001 >nul
cd /d %~dp0

where python >nul 2>nul
if errorlevel 1 (
    where py >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Python not found.
        pause
        exit /b 1
    )
    py -3 -m unittest discover -s tests -t . -v
    pause
    exit /b 0
)

python -m unittest discover -s tests -t . -v
pause

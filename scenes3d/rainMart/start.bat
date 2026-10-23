@echo off
setlocal
cd /d "%~dp0"

title Hoshifuru Mart - Rainy Night Diorama

echo.
echo   Hoshifuru Mart - Rainy Night Diorama
echo   ------------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 goto :standalone

rem Reuse an already-running local server when possible.
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:4173/' -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not errorlevel 1 goto :open

echo   Starting local preview server...
powershell -NoProfile -Command "Start-Process -FilePath 'node' -ArgumentList 'serve.mjs' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

rem Give the server a moment to bind the port.
for /l %%i in (1,1,20) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:4173/' -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 goto :open
  powershell -NoProfile -Command "Start-Sleep -Milliseconds 500"
)

echo   The local server did not respond. Falling back to the single-file build.
goto :standalone

:open
echo   Opening http://127.0.0.1:4173/
start "" "http://127.0.0.1:4173/"
exit /b 0

:standalone
if not exist "%~dp0start.html" (
  echo   Could not find start.html.
  echo   Install Node.js and run: npm start
  pause
  exit /b 1
)
echo   Opening the standalone HTML build...
start "" "%~dp0start.html"
exit /b 0

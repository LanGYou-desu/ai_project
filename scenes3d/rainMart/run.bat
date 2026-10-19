@echo off
rem ============================================================
rem 雨夜便利店 · 本地预览启动脚本
rem   1) 有 node  → node serve.js（http://127.0.0.1:8137/）
rem   2) 有 python → python -m http.server（同端口）
rem   3) 都没有   → 直接 file:// 打开 index.html
rem ============================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  echo [run] 使用 node serve.js 启动本地预览...
  node serve.js
  goto :done
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo [run] 使用 python -m http.server 启动本地预览...
  python -m http.server 8137 --bind 127.0.0.1
  goto :done
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo [run] 使用 py -m http.server 启动本地预览...
  py -m http.server 8137 --bind 127.0.0.1
  goto :done
)

echo [run] 未找到 node / python，直接以 file:// 打开 index.html
start "" "%~dp0index.html"

:done
endlocal

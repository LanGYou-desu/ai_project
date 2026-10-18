@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   天空都市 東京 · Celestial Metropolis
echo   正在用默认浏览器打开 index.html ...
echo   （Three.js 已内联，无需联网）
echo ============================================
start "" "%~dp0index.html"

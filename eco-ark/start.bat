@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   ECO-ARK 生态方舟
echo   正在打开游戏...
echo   测试: node test/run.js
echo ============================================
start "" "%~dp0index.html"

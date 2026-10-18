@echo off
chcp 65001 >nul
title NETIME 网络时光机 · 旧互联网考古
echo ============================================
echo   NETIME 网络时光机 · 旧互联网考古
echo   纯前端 · 零依赖 · 双击即玩
echo ============================================
echo.
echo   [1] 打开游戏（默认，用 Chrome/Edge 打开 index.html）
echo   [2] 运行单元测试（需要 Node.js）
echo   [0] 退出
echo.
set /p CHOICE=请选择：

if "%CHOICE%"=="2" (
  node tests\run.js
  pause
  exit /b
)
if "%CHOICE%"=="0" exit /b

echo 正在打开 NETIME……
start "" index.html
exit /b

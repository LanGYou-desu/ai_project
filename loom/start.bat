@echo off
chcp 65001 >nul
title LOOM 织机编程 · 用代码织布
cd /d "%~dp0"
echo ============================================
echo   LOOM 织机编程 · 用代码织布
echo   纯前端 · 零依赖 · 双击即玩
echo ============================================
echo.
echo   [1] 打开工作室（默认，用浏览器打开 index.html）
echo   [2] 运行单元测试（需要 Node.js）
echo   [3] 运行界面冒烟测试
echo   [4] 把 12 个纹样导出成 PNG 到 preview\ 目录
echo   [0] 退出
echo.
set /p CHOICE=请选择：

if "%CHOICE%"=="2" (
  node test\run.js
  pause
  exit /b
)
if "%CHOICE%"=="3" (
  node test\smoke-ui.js
  pause
  exit /b
)
if "%CHOICE%"=="4" (
  node tools\render-png.js all preview
  pause
  exit /b
)
if "%CHOICE%"=="0" exit /b

echo 正在打开 LOOM……
start "" "%~dp0index.html"
exit /b

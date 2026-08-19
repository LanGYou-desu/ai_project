@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js。请先安装 Node.js（https://nodejs.org），然后重新双击本文件。
  pause
  exit /b 1
)
echo 正在启动 3D 跑车展厅...
node server.js
pause

@echo off
chcp 65001 >nul
cd /d %~dp0
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 需要 Node.js，请先安装。
  pause
  exit /b 1
)
echo 电路沙盒启动中 ...
echo 浏览器将打开 http://127.0.0.1:8848
node server.js
pause
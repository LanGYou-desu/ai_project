@echo off
chcp 65001 >nul
cd /d %~dp0
where node >nul 2>nul || (echo [错误] 需要安装 Node.js & pause & exit /b 1)
echo DESKTOP SIEGE 正在启动……
node server.js
pause

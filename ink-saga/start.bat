@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║  墨战 · 天书纪  INK-SAGA                 ║
echo  ║  用笔书写汉字，消灭吞噬文字的墨妖        ║
echo  ╚══════════════════════════════════════════╝
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo  [错误] 未检测到 Node.js，请先安装：https://nodejs.org/
  pause
  exit /b 1
)
echo  正在启动墨战世界...
start "" http://127.0.0.1:7337
node server.js
pause

@echo off
chcp 65001 >nul
title 无光之城 UNLIT · 盲者体验馆
echo.
echo   ============================================
echo    无光之城 UNLIT · 盲者体验馆
echo    戴上耳机，用耳朵去看这个世界
echo   ============================================
echo.
start "" "%~dp0index.html"
echo   已打开游戏页面（建议 Chrome / Edge，务必佩戴耳机）。
echo.
echo   操作：W/S 前进后退 · 左右方向键转身 · Space 白杖回声
echo         E 触摸 · M 心灵地图 · H 提示 · N 语音导航 · Tab 辅助轮廓
echo.
echo   运行测试：node test\run.js   （59 项）
pause

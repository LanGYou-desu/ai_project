# 星海邮局 · STELLAR POST — 一键启动 (PowerShell)
# 注意: 本文件以 UTF-8 带 BOM 保存，否则 PowerShell 5.1 下中文会乱码。

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  星海邮局 · STELLAR POST" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未找到 Node.js，请先安装：https://nodejs.org" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

Write-Host "[启动] 本地服务 http://127.0.0.1:5177/" -ForegroundColor Green
Write-Host "       浏览器会自动打开；按 Ctrl+C 停止服务" -ForegroundColor DarkGray
Write-Host ""

node server.js

# 赛博安全学院 — 一键启动 (PowerShell)
# 注意: 本文件需 UTF-8 带 BOM 保存, 否则 PowerShell 5.1 下中文会乱码 (功能不受影响)。
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  赛博安全学院 · 一键启动" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

# 1. 检查 Node.js
$nodeOk = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeOk) {
    Write-Host "[错误] 未找到 Node.js, 请先安装: https://nodejs.org" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

# 2. 生成真实练习素材 (首次运行)
if (-not (Test-Path (Join-Path $here "practice\login.pcap"))) {
    Write-Host "[1/3] 生成真实练习素材 (practice\ + 字典)..." -ForegroundColor Cyan
    Push-Location $here
    node make-practice.js
    Pop-Location
} else {
    Write-Host "[1/3] 练习素材已存在, 跳过" -ForegroundColor DarkGray
}

# 3. 启动游戏 + 靶场 (可见窗口, 与 start.bat 行为一致)
Write-Host "[2/3] 启动游戏与本地靶场服务器..." -ForegroundColor Cyan
Start-Process cmd -ArgumentList '/k', 'title Cyber-Academy-Server && cd /d "' + $here + '" && node server.js'
Start-Sleep -Seconds 2

# 4. 打开浏览器
Write-Host "[3/3] 打开浏览器..." -ForegroundColor Cyan
Start-Process "http://localhost:8080"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  已就绪!" -ForegroundColor Green
Write-Host "    游戏:      http://localhost:8080" -ForegroundColor Gray
Write-Host "    真实靶场:  http://127.0.0.1:8090" -ForegroundColor Gray
Write-Host "    真实工具:  node tools\scanlab.js 127.0.0.1" -ForegroundColor Gray
Write-Host "    练习素材:  practice\" -ForegroundColor Gray
Write-Host "    停止服务:  关闭 'Cyber-Academy-Server' 窗口 (Ctrl+C)" -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Read-Host "按回车关闭本窗口 (服务器窗口保持运行)"

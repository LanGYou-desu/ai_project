# 赛博安全学院 — 服务器启动助手 (被 start.ps1 调用)
# 用 Set-Location 避免 cd /d 的兼容问题; 内容保持 ASCII 以兼容 PowerShell 5.1
Set-Location $PSScriptRoot
node server.js

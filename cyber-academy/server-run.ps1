# Cyber Security Academy - server launcher (invoked by start.ps1)
# This file is intentionally ASCII-only: Windows PowerShell 5.1 decodes BOM-less
# script files using the system code page, so non-ASCII comments can be misread.
# Behaviour: cd to this script's folder, then run the game + lab server in the foreground.
$Host.UI.RawUI.WindowTitle = 'Cyber-Academy-Server'
Set-Location -Path $PSScriptRoot
node server.js
Write-Host ''
Write-Host 'Server stopped. Close this window or press Ctrl+C.' -ForegroundColor DarkGray

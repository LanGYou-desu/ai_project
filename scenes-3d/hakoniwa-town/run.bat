@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动本地服务器: http://localhost:8080
where node >nul 2>nul
if not errorlevel 1 (
  start "" "http://localhost:8080"
  node -e "const http=require('http'),fs=require('fs'),path=require('path');const ROOT=process.cwd();const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)){s.writeHead(403);return s.end();}fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);return s.end('Not Found');}s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});s.end(d);});}).listen(8080,()=>console.log('Hakoniwa Town: http://localhost:8080'));"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Neither Node.js nor Python found.
    echo Install Node.js from https://nodejs.org then retry.
    pause
    exit /b 1
  )
  echo Using python -m http.server (no auto-open browser)
  python -m http.server 8080
)

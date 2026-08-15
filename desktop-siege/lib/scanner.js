'use strict';
// 真实磁盘扫描：收集用户目录的文件名与系统进程名，作为敌人命名池。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_DIRS = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos'];
const SKIP_DIRS = new Set(['node_modules', 'AppData', '$RECYCLE.BIN', 'System Volume Information', '.git', 'Windows']);

function sanitizeName(name) {
  let s = String(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '');
  s = s.replace(/\.+$/, '');
  if (s.length > 26) s = s.slice(0, 26);
  return s || '未知文件';
}

function scanDir(dir, maxDepth, cap, out) {
  if (out.length >= cap || maxDepth < 0) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of entries) {
    if (out.length >= cap) break;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name) || ent.name.startsWith('.')) continue;
      scanDir(full, maxDepth - 1, cap, out);
    } else if (ent.isFile()) {
      let size = 0;
      try { size = fs.statSync(full).size; } catch (e) { size = 0; }
      const ext = path.extname(ent.name).toLowerCase().replace('.', '');
      out.push({
        name: sanitizeName(path.basename(ent.name, path.extname(ent.name))),
        ext: ext || 'file',
        size: size,
        dir: path.basename(dir)
      });
    }
  }
}

function scan(opts) {
  opts = opts || {};
  const dirs = opts.dirs || [];
  const maxDepth = opts.maxDepth !== undefined ? opts.maxDepth : 2;
  const cap = opts.cap || 3000;
  const files = [];
  for (const d of dirs) {
    if (d && fs.existsSync(d)) scanDir(d, maxDepth, cap - files.length, files);
  }
  // 去重（同名 + 同后缀）
  const seen = new Set();
  const unique = [];
  for (const f of files) {
    const key = f.name + '.' + f.ext;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(f);
  }
  // 系统进程
  let processes = [];
  try {
    const raw = execFileSync('powershell',
      ['-NoProfile', '-Command', 'Get-Process | Select-Object -ExpandProperty ProcessName'],
      { encoding: 'utf8', timeout: 10000, windowsHide: true });
    processes = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      .filter(s => /^[A-Za-z0-9._-]+$/.test(s) && s.length <= 24)
      .slice(0, 300);
  } catch (e) {
    processes = ['svchost', 'explorer', 'node', 'powershell', 'winlogon'];
  }
  // 各类别最大文件（Boss 命名）
  const byExt = {};
  for (const f of unique) {
    if (!byExt[f.ext]) byExt[f.ext] = [];
    byExt[f.ext].push(f);
  }
  const largestOf = function (exts) {
    let best = null;
    for (const ext of exts) {
      for (const f of byExt[ext] || []) {
        if (!best || f.size > best.size) best = f;
      }
    }
    return best;
  };
  const result = {
    files: unique,
    processes: processes,
    largest: largestOf(Object.keys(byExt)),
    largestDoc: largestOf(['doc', 'docx', 'pdf', 'txt', 'md']),
    largestMedia: largestOf(['jpg', 'png', 'gif', 'bmp', 'mp4', 'mp3', 'wav']),
    largestArchive: largestOf(['zip', 'rar', '7z', 'tar', 'gz']),
    counts: {
      total: unique.length,
      processes: processes.length,
      byExt: Object.keys(byExt).reduce(function (o, k) { o[k] = byExt[k].length; return o; }, {})
    },
    scannedAt: Date.now()
  };
  if (opts.cacheFile) {
    try { fs.writeFileSync(opts.cacheFile, JSON.stringify(result), 'utf8'); } catch (e) { /* 忽略 */ }
  }
  return result;
}

function defaultProfileDirs() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return DEFAULT_DIRS.map(d => path.join(home, d)).filter(d => fs.existsSync(d));
}

if (require.main === module) {
  const dirs = defaultProfileDirs();
  console.log('扫描目录：' + dirs.join(' | '));
  const res = scan({ dirs: dirs, maxDepth: 2, cap: 3000 });
  console.log('共扫描到 ' + res.files.length + ' 个文件，' + res.processes.length + ' 个进程');
  console.log('最大文件：' + (res.largest ? res.largest.name + '.' + res.largest.ext : '无'));
  const sample = res.files.slice(0, 10).map(f => f.name + '.' + f.ext).join(', ');
  console.log('示例：' + sample);
}

module.exports = { scan, scanDir, sanitizeName, defaultProfileDirs, DEFAULT_DIRS };

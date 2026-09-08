'use strict';
// 真实磁盘扫描：收集用户目录的文件名与系统进程名，作为敌人命名池。
// 安全边界：只允许扫描「用户主目录的子目录」，绝不跟随符号链接 / 目录联接越界。
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const DEFAULT_DIRS = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos'];
const SKIP_DIRS = new Set(['node_modules', 'AppData', '$RECYCLE.BIN', 'System Volume Information', '.git', 'Windows']);
const MAX_NAME_LEN = 26;
const MAX_PROCESSES = 300;
const PROC_NAME_RE = /^[A-Za-z0-9._-]+$/;

// 零宽 / 方向控制字符：会生成「看不见的敌人名」，统一剔除
const INVISIBLE_RE = /[\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060\ufeff\u00ad\uFFFD]/g;

function sanitizeName(name) {
  let s = String(name == null ? '' : name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '');
  s = s.replace(INVISIBLE_RE, '');
  s = s.trim().replace(/^\.+/, '').replace(/\.+$/, '').trim();
  if (s.length > MAX_NAME_LEN) s = s.slice(0, MAX_NAME_LEN);
  return s || '未知文件';
}

// 真实路径解析（失败则原样返回），用于符号链接越界检查
function realPathOf(p) {
  try { return fs.realpathSync(p); } catch (e) { return path.resolve(p); }
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// 某个目录是否允许作为扫描根：必须是绝对路径，且（若给了 home）位于 home 之内，且不是符号链接
function isAllowedRoot(dir, home) {
  if (typeof dir !== 'string' || dir === '') return false;
  if (!path.isAbsolute(dir)) return false;
  let st;
  try { st = fs.lstatSync(dir); } catch (e) { return false; }
  if (st.isSymbolicLink() || !st.isDirectory()) return false;
  if (home) {
    const h = realPathOf(home);
    if (!isInside(h, realPathOf(dir))) return false;
  }
  return true;
}

function scanDir(dir, maxDepth, cap, out) {
  if (out.length >= cap || maxDepth < 0) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of entries) {
    if (out.length >= cap) break;
    // 符号链接 / 目录联接一律不进入，避免越出用户目录
    if (ent.isSymbolicLink()) continue;
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

// 结构校验：缓存/外部数据可能不完整，缺失字段一律补默认值，避免上层崩溃
function normalizeResult(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const files = Array.isArray(r.files) ? r.files.filter(f => f && typeof f.name === 'string') : [];
  const processes = Array.isArray(r.processes) ? r.processes.filter(p => typeof p === 'string') : [];
  const counts = r.counts && typeof r.counts === 'object' ? r.counts : {};
  return {
    files: files,
    processes: processes,
    largest: r.largest || null,
    largestDoc: r.largestDoc || null,
    largestMedia: r.largestMedia || null,
    largestArchive: r.largestArchive || null,
    counts: {
      total: typeof counts.total === 'number' ? counts.total : files.length,
      processes: typeof counts.processes === 'number' ? counts.processes : processes.length,
      byExt: counts.byExt && typeof counts.byExt === 'object' ? counts.byExt : {}
    },
    scannedAt: typeof r.scannedAt === 'number' ? r.scannedAt : 0
  };
}

function scan(opts) {
  opts = opts || {};
  const dirs = Array.isArray(opts.dirs) ? opts.dirs : [];
  const maxDepth = opts.maxDepth !== undefined ? opts.maxDepth : 2;
  const cap = opts.cap || 3000;
  // home 用来把扫描范围钉死在用户目录内；调用方（如测试夹具）可显式传 home 指定边界，
  // 传 home:null 表示「不限定边界，但仍要求绝对路径 + 真实目录 + 不跟随符号链接」。
  const home = opts.home !== undefined ? opts.home : homeDir();
  const files = [];
  for (const d of dirs) {
    if (!isAllowedRoot(d, home)) continue;
    scanDir(d, maxDepth, cap - files.length, files);
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
      .filter(s => PROC_NAME_RE.test(s) && s.length <= 24)
      .slice(0, MAX_PROCESSES);
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
  const result = normalizeResult({
    files: unique,
    processes: processes,
    largest: largestOf(Object.keys(byExt)),
    largestDoc: largestOf(['doc', 'docx', 'pdf', 'txt', 'md']),
    largestMedia: largestOf(['jpg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'mp3', 'wav', 'avi']),
    largestArchive: largestOf(['zip', 'rar', '7z', 'tar', 'gz', 'iso']),
    counts: {
      total: unique.length,
      processes: processes.length,
      byExt: Object.keys(byExt).reduce(function (o, k) { o[k] = byExt[k].length; return o; }, {})
    },
    scannedAt: Date.now()
  });
  if (opts.cacheFile) {
    try { fs.writeFileSync(opts.cacheFile, JSON.stringify(result), 'utf8'); } catch (e) { /* 忽略 */ }
  }
  return result;
}

// 用户主目录：环境变量优先，其次 os.homedir()；拿不到就返回 ''（调用方必须视为「不允许扫描」）
function homeDir() {
  const env = process.env.USERPROFILE || process.env.HOME || '';
  if (env && path.isAbsolute(env)) return path.resolve(env);
  try {
    const h = os.homedir();
    if (h && path.isAbsolute(h)) return path.resolve(h);
  } catch (e) { /* 忽略 */ }
  return '';
}

function defaultProfileDirs() {
  const home = homeDir();
  if (!home) return [];
  return DEFAULT_DIRS.map(d => path.join(home, d)).filter(d => isAllowedRoot(d, home));
}

// 校验磁盘上的缓存文件是否可用。
// maxAgeMs 语义：正数=只接受该时长内的缓存；0=忽略时效（永不过期）；负数=不使用缓存；undefined=不做时效检查
function readCache(cacheFile, maxAgeMs) {
  if (!cacheFile) return null;
  if (typeof maxAgeMs === 'number' && maxAgeMs < 0) return null;
  let raw;
  try { raw = fs.readFileSync(cacheFile, 'utf8'); } catch (e) { return null; }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return null; }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.files)) return null;
  if (typeof maxAgeMs === 'number' && maxAgeMs > 0) {
    const at = typeof parsed.scannedAt === 'number' ? parsed.scannedAt : 0;
    if (!at || Date.now() - at > maxAgeMs) return null;
  }
  return normalizeResult(parsed);
}

if (require.main === module) {
  const dirs = defaultProfileDirs();
  console.log('扫描目录：' + (dirs.length ? dirs.join(' | ') : '(未找到用户目录，已拒绝扫描)'));
  const res = scan({ dirs: dirs, maxDepth: 2, cap: 3000 });
  console.log('共扫描到 ' + res.files.length + ' 个文件，' + res.processes.length + ' 个进程');
  console.log('最大文件：' + (res.largest ? res.largest.name + '.' + res.largest.ext : '无'));
  const sample = res.files.slice(0, 10).map(f => f.name + '.' + f.ext).join(', ');
  console.log('示例：' + sample);
}

module.exports = {
  scan, scanDir, sanitizeName, defaultProfileDirs, homeDir,
  readCache, normalizeResult, isAllowedRoot, DEFAULT_DIRS, MAX_NAME_LEN
};

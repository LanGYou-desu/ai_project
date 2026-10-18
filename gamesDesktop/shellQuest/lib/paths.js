'use strict';
// ============================================================
// 档案馆-7 · 路径沙盒守卫
// 同时做“词法边界”和“真实路径（realpath）边界”检查：
//   - 词法检查挡住 ../、绝对路径、跨盘符；
//   - realpath 检查挡住符号链接 / Windows 目录联接（junction）逃逸。
// 命令引擎与静态文件服务共用，避免两处各写一套容易漏。
// ============================================================
const fs = require('fs');
const path = require('path');

const BACKSLASH = String.fromCharCode(92);
const NUL = String.fromCharCode(0);
const DEVICE_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

// Windows 保留设备名（CON/NUL/COM1...）会让 fs 访问挂起或指向设备，必须拒绝。
function hasDeviceComponent(rel) {
  if (!rel) return false;
  const norm = rel.split(BACKSLASH).join('/');
  return norm.split('/').some(function (p) { return DEVICE_RE.test(p); });
}

function realpathOrNull(p) {
  try { return fs.realpathSync(p); } catch (e) { return null; }
}

// 词法包含判断：abs 是否位于 root 内（不解析符号链接）
function isInside(root, abs) {
  const rel = path.relative(root, abs);
  if (rel === '') return true;
  if (rel === '..' || rel.startsWith('..' + path.sep)) return false;
  if (path.isAbsolute(rel)) return false;
  return true;
}

// 从 p 往上找第一个真实存在的祖先；用于处理“目标还不存在”的情况
function deepestExisting(p) {
  let cur = path.resolve(p);
  for (;;) {
    let exists = false;
    try { exists = fs.existsSync(cur); } catch (e) { return null; }
    if (exists) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

function makeRootGuard(root) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new Error('makeRootGuard：缺少 root');
  }
  const rootAbs = path.resolve(root);

  function rootReal() { return realpathOrNull(rootAbs) || rootAbs; }

  // 完整包含检查：先词法，再对“最深的已存在祖先”做 realpath 检查
  function contains(abs) {
    if (typeof abs !== 'string' || abs.length === 0) return false;
    const target = path.resolve(abs);
    if (!isInside(rootAbs, target)) return false;
    const existing = deepestExisting(target);
    if (!existing) return false;
    const real = realpathOrNull(existing);
    if (!real) return false;
    return isInside(rootReal(), real);
  }

  function resolve(arg, base) {
    if (typeof arg !== 'string' || arg.length === 0) return null;
    if (arg.indexOf(NUL) >= 0) return null;
    const baseDir = base || rootAbs;
    const abs = path.isAbsolute(arg) ? path.resolve(arg) : path.resolve(baseDir, arg);
    if (!contains(abs)) return null;
    if (hasDeviceComponent(path.relative(rootAbs, abs))) return null;
    return abs;
  }

  // 静态文件用：rel 来自 URL pathname，拒绝反斜杠 / 冒号 / NUL
  function join(rel) {
    if (typeof rel !== 'string' || rel.length === 0) return null;
    if (rel.indexOf(NUL) >= 0 || rel.indexOf(BACKSLASH) >= 0 || rel.indexOf(':') >= 0) return null;
    if (hasDeviceComponent(rel)) return null;
    const abs = path.resolve(rootAbs, '.' + path.sep + rel);
    return contains(abs) ? abs : null;
  }

  return { root: rootAbs, rootReal, contains, resolve, join };
}

module.exports = { makeRootGuard, isInside, deepestExisting, realpathOrNull, hasDeviceComponent };

'use strict';
// ============================================================
// 档案馆-7 · 世界生成器
// 生成一个真实的、确定性的沙盒目录（默认 world/）。
// 同一种子 → 同一个世界（文件树、文件内容、清单完全一致）。
//
// 安全性：generateWorld 会先删除目标目录，因此必须拒绝
// 项目根目录、项目上级目录、文件系统根目录以及符号链接/目录联接，
// 避免 `node lib/worldgen.js .` 这类误操作毁掉源码。
// 生成过程先写临时目录，成功后再替换目标，避免半成品世界。
// ============================================================
const fs = require('fs');
const path = require('path');
const { createRng } = require('./rng');
const { b64e, rot13, caesar, xorBytes } = require('./crypto-utils');
const { WORLD, FLAGS } = require('./worlddata');

const SEED = 20810719;
// 清单版本：worlddata 结构或生成规则变化时递增，服务器据此自动重建旧世界。
const WORLD_VERSION = 2;

function assertSafeWorldDir(rootDir) {
  if (typeof rootDir !== 'string' || rootDir.trim() === '') {
    throw new Error('世界目录不能为空');
  }
  const target = path.resolve(rootDir);
  const projectRoot = path.resolve(__dirname, '..');
  if (path.parse(target).root === target) {
    throw new Error('拒绝把文件系统根目录作为世界目录：' + target);
  }
  const rel = path.relative(target, projectRoot);
  if (rel === '') {
    throw new Error('拒绝把项目根目录作为世界目录：' + target);
  }
  if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)) {
    throw new Error('拒绝把项目上级目录作为世界目录：' + target);
  }
  let lst = null;
  try { lst = fs.lstatSync(target); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (lst && lst.isSymbolicLink()) {
    throw new Error('世界目录是符号链接/目录联接，拒绝删除：' + target);
  }
  return target;
}

function worldIsStale(rootDir, opts) {
  const seed = opts && opts.seed !== undefined ? opts.seed : SEED;
  const target = path.resolve(rootDir);
  let lst;
  try { lst = fs.lstatSync(target); } catch (e) { return true; }
  if (lst.isSymbolicLink() || !lst.isDirectory()) return true;
  const manifestPath = path.join(path.dirname(target), '世界清单.json');
  let m;
  try { m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { return true; }
  if (!m || m.version !== WORLD_VERSION || m.seed !== seed) return true;
  if (!Array.isArray(m.files) || m.files.length === 0) return true;
  if (typeof m.diskFileCount !== 'number' || m.diskFileCount !== m.files.length) return true;
  for (const f of m.files) {
    if (typeof f !== 'string' || f.length === 0 || f.indexOf('..') >= 0 || path.isAbsolute(f)) return true;
    if (!fs.existsSync(path.join(target, f))) return true;
  }
  return false;
}

// ---- tar (ustar, 无压缩) ----
function tarHeader(name, size) {
  const h = Buffer.alloc(512);
  Buffer.from(name, 'utf8').copy(h, 0, 0, 100);
  h.write('0000644', 100, 8, 'ascii');
  h.write('0000000', 108, 8, 'ascii');
  h.write('0000000', 116, 8, 'ascii');
  h.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  h.write('00000000000', 136, 12, 'ascii');
  h.write('        ', 148, 8, 'ascii');
  h.write('0', 156, 1, 'ascii');
  Buffer.from('ustar', 'ascii').copy(h, 257);
  h.write('00', 263, 2, 'ascii');
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += h[i];
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return h;
}

function buildTar(entries) {
  const chunks = [];
  for (const e of entries) {
    chunks.push(tarHeader(e.name, e.data.length));
    chunks.push(e.data);
    const pad = (512 - (e.data.length % 512)) % 512;
    if (pad) chunks.push(Buffer.alloc(pad));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

// ---- 内容解析：把 worlddata 的描述变成真实字节 ----
function resolveContent(desc, rng) {
  if (Array.isArray(desc)) {
    return Buffer.from(desc.map(line => resolveLine(line, rng)).join('\n') + '\n', 'utf8');
  }
  if (desc && typeof desc === 'object') {
    switch (desc.kind) {
      case 'base64':
        return Buffer.from(b64e(desc.text) + '\n', 'utf8');
      case 'rot13':
        return Buffer.from(rot13(desc.text) + '\n', 'utf8');
      case 'caesar':
        return Buffer.from(caesar(desc.text, desc.shift) + '\n', 'utf8');
      case 'hextext':
        return Buffer.from(Buffer.from(desc.text, 'utf8').toString('hex') + '\n', 'utf8');
      case 'xor':
        return xorBytes(Buffer.from(desc.text, 'utf8'), desc.key);
      case 'sequence': {
        const lines = [];
        for (let i = 1; i <= 40; i++) {
          lines.push(i === desc.signalLine ? 'signal' : rng.pick(desc.noise));
        }
        return Buffer.from(lines.join('\n') + '\n', 'utf8');
      }
      case 'b64part': {
        const full = b64e(desc.text);
        const partLen = Math.ceil(full.length / desc.parts);
        const piece = full.slice(desc.part * partLen, Math.min((desc.part + 1) * partLen, full.length));
        return Buffer.from(piece + '\n', 'utf8');
      }
      case 'tar': {
        const entries = desc.entries.map(en => ({
          name: en.name,
          data: Buffer.from(en.lines.map(line => resolveLine(line, rng)).join('\n') + '\n', 'utf8')
        }));
        return buildTar(entries);
      }
      default:
        throw new Error('未知内容类型：' + desc.kind);
    }
  }
  return Buffer.from('\n', 'utf8');
}

function resolveLine(line, rng) {
  if (line && typeof line === 'object' && line.kind) return resolveContent(line, rng).toString('utf8').replace(/\n$/, '');
  return String(line);
}

// ---- 写入磁盘：先写临时目录，成功后再替换目标 ----
function generateWorld(rootDir, opts) {
  const seed = opts && opts.seed !== undefined ? opts.seed : SEED;
  const target = assertSafeWorldDir(rootDir);
  const parent = path.dirname(target);
  const staging = path.join(parent, '.world-staging-' + process.pid + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
  const rng = createRng(seed);

  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  const written = [];
  let totalFiles = 0;
  try {
    for (const [rel, desc] of Object.entries(WORLD)) {
      const abs = path.join(staging, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const content = resolveContent(desc, rng);
      fs.writeFileSync(abs, content);
      written.push(rel);
      totalFiles++;
      if (desc && desc.kind === 'tar' && Array.isArray(desc.entries)) totalFiles += desc.entries.length;
    }

    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(staging, target);

    // 清单在替换成功后再写：万一写清单失败，下一次启动会因为清单陈旧而重建，而不是出现“新清单+旧世界”。
    const manifest = {
      version: WORLD_VERSION,
      seed: seed,
      diskFileCount: written.length,
      fileCount: totalFiles,
      files: written.slice().sort()
    };
    fs.writeFileSync(path.join(parent, '世界清单.json'), JSON.stringify(manifest, null, 2), 'utf8');
  } catch (e) {
    try { fs.rmSync(staging, { recursive: true, force: true }); } catch (e2) { /* 清理失败就算了 */ }
    throw e;
  }

  return { seed: seed, fileCount: totalFiles, diskFileCount: written.length, files: written.slice().sort() };
}

if (require.main === module) {
  try {
    const dir = process.argv[2] || path.join(__dirname, '..', 'world');
    const seedArg = process.argv[3] !== undefined ? Number(process.argv[3]) : SEED;
    if (!Number.isFinite(seedArg)) throw new Error('种子必须是数字');
    const res = generateWorld(dir, { seed: seedArg });
    console.log('[worldgen] 世界已生成：' + res.diskFileCount + ' 个磁盘文件（含 tar 内条目共 ' + res.fileCount + ' 个内容单元），种子 ' + res.seed);
    console.log('目录：' + path.resolve(dir));
  } catch (e) {
    console.error('[worldgen] ' + e.message);
    process.exit(1);
  }
}

module.exports = {
  generateWorld,
  buildTar,
  tarHeader,
  assertSafeWorldDir,
  worldIsStale,
  WORLD_VERSION,
  FLAGS,
  SEED
};

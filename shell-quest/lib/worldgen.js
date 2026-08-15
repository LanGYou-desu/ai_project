'use strict';
// ============================================================
// 档案馆-7 · 世界生成器
// 生成一个真实的、确定性的沙盒目录（默认 world/）。
// 同一种子 → 同一个世界（文件树与内容完全一致，可复现可测试）。
// ============================================================
const fs = require('fs');
const path = require('path');
const { createRng } = require('./rng');
const { b64e, rot13, caesar, xorBytes } = require('./crypto-utils');
const { WORLD, FLAGS, ACT_TASKS, ACT_HINTS } = require('./worlddata');

const SEED = 20810719;

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
        return Buffer.from('（生成失败）\n', 'utf8');
    }
  }
  return Buffer.from('\n', 'utf8');
}

function resolveLine(line, rng) {
  if (line && typeof line === 'object' && line.kind) return resolveContent(line, rng).toString('utf8').replace(/\n$/, '');
  return String(line);
}

// ---- 写入磁盘 ----
function generateWorld(rootDir, opts) {
  const seed = opts && opts.seed !== undefined ? opts.seed : SEED;
  const rng = createRng(seed);

  fs.rmSync(rootDir, { recursive: true, force: true });
  fs.mkdirSync(rootDir, { recursive: true });

  const written = [];
  let totalFiles = 0;
  for (const [rel, desc] of Object.entries(WORLD)) {
    const abs = path.join(rootDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const content = resolveContent(desc, rng);
    fs.writeFileSync(abs, content);
    written.push(rel);
    totalFiles++;
    if (desc && desc.kind === 'tar' && Array.isArray(desc.entries)) totalFiles += desc.entries.length;
  }

  const manifest = {
    seed: seed,
    generatedAt: new Date().toISOString(),
    fileCount: totalFiles,
    files: written.slice().sort()
  };
  const manifestPath = path.join(rootDir, '..', '世界清单.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return { seed: seed, fileCount: totalFiles, files: written.slice().sort() };
}

if (require.main === module) {
  const dir = process.argv[2] || path.join(__dirname, '..', 'world');
  const seed = process.argv[3] !== undefined ? Number(process.argv[3]) : SEED;
  const res = generateWorld(dir, { seed: seed });
  console.log('[worldgen] 世界已生成：' + res.fileCount + ' 个文件，种子 ' + res.seed);
  console.log('目录：' + path.resolve(dir));
}

module.exports = { generateWorld, buildTar, FLAGS, ACT_TASKS, ACT_HINTS, SEED };

import fsp from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import unzipper from 'unzipper';
import { pipeline } from 'node:stream/promises';
import { ensureDir, formatBytes, randomId } from './util.js';

const COVER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const MAX_EXTRACT_BYTES = 1.5 * 1024 * 1024 * 1024;
const MAX_EXTRACT_FILES = 5000;

export async function createUploads({ storageDir, publicDir, playDir, packageDir }) {
  const tmpDir = path.join(storageDir, 'tmp');
  await ensureDir(tmpDir);
  await ensureDir(playDir);
  await ensureDir(packageDir);
  await ensureDir(path.join(publicDir, 'covers', 'uploads'));

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, randomId('tmp') + ext);
    },
  });

  const uploader = multer({
    storage,
    limits: { fileSize: 600 * 1024 * 1024, files: 2, fields: 40 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (file.fieldname === 'cover') {
        if (!COVER_EXT.has(ext) || !String(file.mimetype || '').startsWith('image/')) {
          return cb(new Error('封面只支持 JPG / PNG / WebP / AVIF'));
        }
        return cb(null, true);
      }
      if (file.fieldname === 'package') {
        if (ext !== '.zip') return cb(new Error('作品包必须是 ZIP 文件'));
        return cb(null, true);
      }
      return cb(new Error('未知的上传字段'));
    },
  });

  function sanitizeText(value, max = 2000) {
    return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
  }

  function parseTags(value) {
    return String(value || '')
      .split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  async function extractZip(zipPath, targetDir) {
    await ensureDir(targetDir);
    const directory = await unzipper.Open.file(zipPath);
    let total = 0;
    let count = 0;
    for (const entry of directory.files) {
      if (entry.type === 'Directory') continue;
      if (entry.type && entry.type !== 'File') continue;
      count += 1;
      if (count > MAX_EXTRACT_FILES) throw new Error('压缩包文件数量超过限制');
      total += Number(entry.uncompressedSize) || 0;
      if (total > MAX_EXTRACT_BYTES) throw new Error('解压后体积超过 1.5 GB 限制');
      const raw = String(entry.path || '').replace(/\\/g, '/');
      const normalized = path.posix.normalize(raw);
      if (!normalized || normalized === '.' || normalized.startsWith('/') || normalized.startsWith('..') || normalized.includes('\u0000')) {
        throw new Error('压缩包中包含非法路径');
      }
      const dest = path.resolve(targetDir, normalized);
      const root = path.resolve(targetDir) + path.sep;
      if (!dest.startsWith(root)) throw new Error('压缩包中包含非法路径');
      await ensureDir(path.dirname(dest));
      await pipeline(entry.stream(), (await import('node:fs')).createWriteStream(dest));
    }
  }

  async function normalizeWebRoot(dir) {
    try {
      const stat = await fsp.stat(path.join(dir, 'index.html'));
      if (stat.isFile()) return true;
    } catch {}
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && e.name !== '__MACOSX');
    if (dirs.length === 1) {
      const inner = path.join(dir, dirs[0].name);
      try {
        const stat = await fsp.stat(path.join(inner, 'index.html'));
        if (stat.isFile()) {
          for (const e of await fsp.readdir(inner)) {
            await fsp.rename(path.join(inner, e), path.join(dir, e));
          }
          await fsp.rmdir(inner).catch(() => {});
          return true;
        }
      } catch {}
    }
    return false;
  }

  async function processUpload({ body, files, store }) {
    const title = sanitizeText(body.title, 80);
    const subtitle = sanitizeText(body.subtitle, 80);
    const tagline = sanitizeText(body.tagline, 200);
    const description = sanitizeText(body.description, 3000);
    const category = sanitizeText(body.category, 40) || 'art';
    const tags = parseTags(body.tags);
    const tech = parseTags(body.tech);
    const accent = /^#[0-9a-fA-F]{6}$/.test(sanitizeText(body.accent, 7)) ? sanitizeText(body.accent, 7) : '#c9c4b8';
    const featured = String(body.featured || '') === 'true';
    const visible = String(body.visible || 'true') !== 'false';
    if (title.length < 2) throw new Error('请填写作品标题（至少 2 个字符）');
    if (!['webgames', 'desktop', 'three', 'apps', 'tools', 'art'].includes(category)) throw new Error('作品分类不合法');

    const coverFile = files?.cover?.[0] || null;
    const packageFile = files?.package?.[0] || null;
    if (!coverFile && !packageFile && !tagline && !description) throw new Error('请至少上传封面、作品包，或填写作品介绍');

    const id = randomId('u');
    const now = new Date().toISOString();
    let cover = null;
    let demoPath = null;
    let downloadPath = null;
    let downloadSize = 0;
    let kind = 'image';

    try {
      if (coverFile) {
        const ext = path.extname(coverFile.originalname || '').toLowerCase();
        const name = id + (ext === '.jpeg' ? '.jpg' : ext);
        const dest = path.join(publicDir, 'covers', 'uploads', name);
        await fsp.rename(coverFile.path, dest);
        cover = '/covers/uploads/' + name;
      }

      if (packageFile) {
        const dest = path.join(packageDir, id + '.zip');
        await fsp.rename(packageFile.path, dest);
        downloadPath = id + '.zip';
        downloadSize = packageFile.size || 0;
        const target = path.join(playDir, 'u', id);
        await extractZip(dest, target);
        const hasIndex = await normalizeWebRoot(target);
        if (hasIndex) {
          demoPath = 'u/' + id + '/';
          kind = 'web';
        } else {
          await fsp.rm(target, { recursive: true, force: true });
          kind = cover ? 'image' : 'download';
        }
      }

      if (cover && !packageFile) kind = 'image';
      if (!cover && !packageFile) kind = 'text';

      const work = {
        id, title, subtitle, tagline, description, category, tags, tech, accent,
        cover, demoPath, downloadPath, downloadSize, kind,
        featured: Boolean(featured), visible: Boolean(visible),
        createdAt: now, updatedAt: now,
        builtin: false,
      };
      await store.add(work);
      return work;
    } finally {
      for (const f of [coverFile, packageFile]) {
        if (f?.path) { try { await fsp.rm(f.path, { force: true }); } catch {} }
      }
    }
  }

  function describeSize(bytes) {
    return formatBytes(bytes);
  }

  return { uploader, processUpload, describeSize, tmpDir };
}

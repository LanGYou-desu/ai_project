import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createAuth } from './lib/auth.js';
import { createStore } from './lib/store.js';
import { createWorks } from './lib/works.js';
import { createPostStore } from './lib/posts.js';
import { createUploads } from './lib/uploads.js';
import { ensureDir, formatBytes } from './lib/util.js';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(appDir, 'public');
const storageDir = path.resolve(process.env.DATA_DIR || path.join(appDir, 'storage'));
const playDir = path.resolve(process.env.PLAY_DIR || path.join(storageDir, 'play'));
const packageDir = path.resolve(process.env.PACKAGE_DIR || path.join(storageDir, 'packages'));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const secureCookie = String(process.env.COOKIE_SECURE || 'true') !== 'false';
const username = process.env.ADMIN_USERNAME || 'LanGYou';

await ensureDir(storageDir);
await ensureDir(playDir);
await ensureDir(packageDir);

async function loadSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) return process.env.SESSION_SECRET;
  const file = path.join(storageDir, 'session-secret');
  try {
    const value = (await fsp.readFile(file, 'utf8')).trim();
    if (value.length >= 32) return value;
  } catch {}
  const value = crypto.randomBytes(48).toString('base64url');
  await fsp.writeFile(file, value + '\n', { mode: 0o600 });
  return value;
}

const secret = await loadSecret();
const store = await createStore(storageDir);
const auth = await createAuth({
  storageDir,
  username,
  initialPassword: process.env.ADMIN_PASSWORD || '',
  secret,
  secureCookie,
});
const works = await createWorks({ appDir, playBase: process.env.PLAY_BASE || 'https://play.langyousaikyo.top', store, playDir, packageDir, publicDir });
const postStore = await createPostStore(storageDir);
const uploads = await createUploads({ storageDir, publicDir, playDir, packageDir });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://static.cloudflareinsights.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://play.langyousaikyo.top'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", 'https://cloudflareinsights.com'],
      frameSrc: ["https://play.langyousaikyo.top"],
      mediaSrc: ["'self'", 'https://play.langyousaikyo.top'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

app.use(express.static(publicDir, {
  index: false,
  maxAge: '1h',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    if (filePath.includes(path.sep + 'covers' + path.sep)) res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));

app.use('/downloads', express.static(packageDir, { maxAge: '7d', fallthrough: true }));
app.use('/play', express.static(playDir, { maxAge: '1h', fallthrough: true }));

function sessionOf(req) {
  return auth.sessionFromRequest(req);
}

function requireSession(req, res, next) {
  const session = sessionOf(req);
  if (!session) return res.status(401).json({ error: '请先登录' });
  req.session = session;
  next();
}

function requireAdmin(req, res, next) {
  const session = sessionOf(req);
  if (!session) return res.status(401).json({ error: '请先登录' });
  if (session.role !== 'owner') return res.status(403).json({ error: '游客只能浏览和下载，不能发布内容' });
  req.session = session;
  next();
}

function requireCsrf(req, res, next) {
  const token = req.get('x-csrf-token') || '';
  if (!req.session || !token || token !== req.session.csrf) {
    return res.status(403).json({ error: 'CSRF 校验失败，请刷新页面后重试' });
  }
  next();
}

const attempts = new Map();
function clientKey(req) {
  return String(req.headers['cf-connecting-ip'] || req.ip || 'unknown');
}
function checkRate(req) {
  const key = clientKey(req);
  const now = Date.now();
  const item = attempts.get(key);
  if (!item) return { ok: true };
  if (item.blockedUntil && item.blockedUntil > now) {
    return { ok: false, retry: Math.ceil((item.blockedUntil - now) / 1000) };
  }
  if (item.resetAt < now) {
    attempts.delete(key);
    return { ok: true };
  }
  return { ok: item.count < 6 };
}
function noteFailure(req) {
  const key = clientKey(req);
  const now = Date.now();
  const item = attempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000, blockedUntil: 0 };
  item.count += 1;
  if (item.count >= 6) item.blockedUntil = now + 15 * 60 * 1000;
  attempts.set(key, item);
}

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'langyou-archive', time: new Date().toISOString() });
});

app.get('/api/meta', async (_req, res, next) => {
  try {
    const { meta, works: list } = await works.publicWorks();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      meta: { ...meta, stats: { ...meta.stats, works: list.length, assertions: list.reduce((s, w) => s + (Number(w.tests) || 0), 0) } },
      categories: meta.categories,
    });
  } catch (err) { next(err); }
});

app.get('/api/works', async (_req, res, next) => {
  try {
    const { meta, works: list } = await works.publicWorks();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ meta, categories: meta.categories, works: list });
  } catch (err) { next(err); }
});

app.get('/api/works/:id', async (req, res, next) => {
  try {
    const found = await works.getWork(req.params.id);
    if (!found) return res.status(404).json({ error: '作品不存在' });
    res.json(found);
  } catch (err) { next(err); }
});

app.get('/api/posts', async (_req, res, next) => {
  try {
    const list = (await postStore.list())
      .filter((p) => p.visible !== false)
      .sort((a, b) => (Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))) || String(b.createdAt).localeCompare(String(a.createdAt)));
    res.setHeader('Cache-Control', 'no-store');
    res.json({ posts: list });
  } catch (err) { next(err); }
});

app.get('/api/posts/:id', async (req, res, next) => {
  try {
    const post = (await postStore.list()).find((p) => p.id === req.params.id && p.visible !== false);
    if (!post) return res.status(404).json({ error: '手记不存在' });
    res.json({ post });
  } catch (err) { next(err); }
});

app.get('/api/session', (req, res) => {
  const session = sessionOf(req);
  if (!session) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: { username: session.role === 'guest' ? 'Guest' : auth.username, role: session.role || 'owner' }, csrf: session.csrf, expiresAt: session.exp });
});

app.post('/api/login', async (req, res) => {
  const gate = checkRate(req);
  if (!gate.ok) return res.status(429).json({ error: '尝试次数过多，请 15 分钟后再试' });
  const usernameInput = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!usernameInput || !password) return res.status(400).json({ error: '请输入用户名和密码' });
  const session = await auth.login(usernameInput, password);
  if (!session) {
    noteFailure(req);
    return res.status(401).json({ error: '用户名或密码不正确' });
  }
  attempts.delete(clientKey(req));
  auth.setCookie(res, session.token);
  res.json({ ok: true, user: { username: auth.username, role: 'owner' }, csrf: session.csrf, expiresAt: session.exp });
});

app.post('/api/guest', (req, res) => {
  const session = auth.issueGuest();
  auth.setCookie(res, session.token);
  res.json({ ok: true, user: { username: 'Guest', role: 'guest' }, csrf: session.csrf, expiresAt: session.exp });
});

app.post('/api/logout', requireSession, requireCsrf, (req, res) => {
  auth.clearCookie(res);
  res.json({ ok: true });
});

app.get('/api/admin/works', requireAdmin, async (_req, res, next) => {
  try {
    const { meta, works: list } = await works.adminWorks();
    res.json({ meta, categories: meta.categories, works: list });
  } catch (err) { next(err); }
});

app.get('/api/admin/posts', requireAdmin, async (_req, res, next) => {
  try {
    const list = (await postStore.list()).sort((a, b) => (Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))) || String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ posts: list });
  } catch (err) { next(err); }
});

app.post('/api/admin/posts', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const body = req.body || {};
    const title = String(body.title || '').trim().slice(0, 120);
    const content = String(body.body || '').trim().slice(0, 20000);
    const tags = (Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(/[,，、]/)).map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
    if (title.length < 2) return res.status(400).json({ error: '标题至少 2 个字符' });
    if (content.length < 1) return res.status(400).json({ error: '正文不能为空' });
    const post = await postStore.add({ title, body: content, tags, pinned: Boolean(body.pinned), visible: body.visible !== false });
    res.status(201).json({ ok: true, post });
  } catch (err) { next(err); }
});

app.patch('/api/admin/posts/:id', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const existing = (await postStore.list()).find((p) => p.id === req.params.id);
    if (!existing) return res.status(404).json({ error: '手记不存在' });
    const body = req.body || {};
    const patch = {};
    if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 120);
    if (typeof body.body === 'string') patch.body = body.body.trim().slice(0, 20000);
    if (Array.isArray(body.tags)) patch.tags = body.tags.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
    if (typeof body.pinned === 'boolean') patch.pinned = body.pinned;
    if (typeof body.visible === 'boolean') patch.visible = body.visible;
    if (patch.title !== undefined && patch.title.length < 2) return res.status(400).json({ error: '标题至少 2 个字符' });
    if (patch.body !== undefined && patch.body.length < 1) return res.status(400).json({ error: '正文不能为空' });
    const updated = await postStore.update(req.params.id, patch);
    res.json({ ok: true, post: updated });
  } catch (err) { next(err); }
});

app.delete('/api/admin/posts/:id', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const existing = (await postStore.list()).find((p) => p.id === req.params.id);
    if (!existing) return res.status(404).json({ error: '手记不存在' });
    await postStore.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get('/api/admin/stats', requireAdmin, async (_req, res, next) => {
  try {
    const stats = await works.stats();
    let uploadBytes = 0;
    try {
      const files = await fsp.readdir(packageDir, { withFileTypes: true });
      for (const f of files) {
        if (f.isFile()) uploadBytes += (await fsp.stat(path.join(packageDir, f.name))).size;
      }
    } catch {}
    const posts = await postStore.list();
    res.json({ ...stats, posts: posts.length, uploadBytes, uploadBytesLabel: formatBytes(uploadBytes), storageFree: null });
  } catch (err) { next(err); }
});

app.post('/api/admin/works', requireAdmin, requireCsrf, (req, res, next) => {
  uploads.uploader.fields([{ name: 'cover', maxCount: 1 }, { name: 'package', maxCount: 1 }])(req, res, async (err) => {
    if (err) return next(err);
    try {
      const work = await uploads.processUpload({ body: req.body, files: req.files, store });
      res.status(201).json({ ok: true, work });
    } catch (e) { next(e); }
  });
});

app.patch('/api/admin/works/:id', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const existing = await store.get(req.params.id);
    if (!existing) return res.status(404).json({ error: '作品不存在或不可编辑' });
    const body = req.body || {};
    const patch = {};
    for (const key of ['title', 'subtitle', 'tagline', 'description', 'category', 'accent']) {
      if (typeof body[key] === 'string') patch[key] = body[key].trim().slice(0, key === 'description' ? 3000 : 220);
    }
    if (Array.isArray(body.tags)) patch.tags = body.tags.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
    if (Array.isArray(body.tech)) patch.tech = body.tech.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
    if (typeof body.featured === 'boolean') patch.featured = body.featured;
    if (typeof body.visible === 'boolean') patch.visible = body.visible;
    if (patch.title && patch.title.length < 2) return res.status(400).json({ error: '标题至少 2 个字符' });
    if (patch.category && !['webgames', 'desktop', 'three', 'apps', 'tools', 'art'].includes(patch.category)) {
      return res.status(400).json({ error: '分类不合法' });
    }
    const updated = await store.update(req.params.id, patch);
    res.json({ ok: true, work: updated });
  } catch (err) { next(err); }
});

app.delete('/api/admin/works/:id', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const existing = await store.get(req.params.id);
    if (!existing) return res.status(404).json({ error: '作品不存在或不可删除' });
    await store.remove(req.params.id);
    await works.removeFiles(existing);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.post('/api/admin/password', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const ok = await auth.changePassword(currentPassword, newPassword);
    if (!ok) return res.status(401).json({ error: '当前密码不正确' });
    const session = auth.issue();
    auth.setCookie(res, session.token);
    res.json({ ok: true, csrf: session.csrf, expiresAt: session.exp });
  } catch (err) { next(err); }
});

function sendHtml(res, file) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.sendFile(path.join(publicDir, file));
}
app.get(['/login', '/login/'], (_req, res) => sendHtml(res, 'login.html'));
app.get(['/studio', '/studio/'], (req, res) => {
  const session = auth.sessionFromRequest(req);
  if (!session || session.role !== 'owner') return res.redirect(302, '/login?t=' + Date.now());
  return sendHtml(res, 'studio.html');
});
app.get(['/', '/index.html'], (_req, res) => sendHtml(res, 'index.html'));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: '接口不存在' });
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

app.use((err, _req, res, _next) => {
  const status = err.name === 'MulterError' ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : (err.status || 500);
  const message = err.name === 'MulterError'
    ? (err.code === 'LIMIT_FILE_SIZE' ? '文件太大：封面最大 12 MB，作品包最大 600 MB' : '上传失败：' + err.message)
    : (status === 500 ? '服务器开小差了，请稍后再试' : err.message);
  if (status === 500) console.error(err);
  res.status(status).json({ error: message });
});

app.listen(port, host, () => {
  console.log('[langyou] listening on http://' + host + ':' + port);
  console.log('[langyou] storage:', storageDir);
  console.log('[langyou] play:', playDir);
  console.log('[langyou] packages:', packageDir);
});
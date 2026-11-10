import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createAuth } from './lib/auth.js';
import { createStore } from './lib/store.js';
import { createWorks } from './lib/works.js';
import { createPostStore } from './lib/posts.js';
import { createUploads } from './lib/uploads.js';
import { createUserStore, publicUser, normalizeEmail, isEmail } from './lib/users.js';
import { createCodeStore } from './lib/codes.js';
import { createMailer } from './lib/mailer.js';
import { ensureDir, formatBytes } from './lib/util.js';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(appDir, 'public');
const storageDir = path.resolve(process.env.DATA_DIR || path.join(appDir, 'storage'));
const playDir = path.resolve(process.env.PLAY_DIR || path.join(storageDir, 'play'));
const packageDir = path.resolve(process.env.PACKAGE_DIR || path.join(storageDir, 'packages'));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const secureCookie = String(process.env.COOKIE_SECURE || 'true') !== 'false';
const adminUsername = process.env.ADMIN_USERNAME || 'LanGYou';
const adminEmail = process.env.ADMIN_EMAIL || '3365814005@qq.com';

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
const users = await createUserStore({
  storageDir,
  adminUsername,
  adminEmail,
  adminPassword: process.env.ADMIN_PASSWORD || '',
});
const auth = await createAuth({ users, secret, secureCookie });
const codes = await createCodeStore({ storageDir, secret });
const mailer = createMailer({
  mode: process.env.MAIL_MODE || (process.env.SMTP_PASS ? 'smtp' : 'console'),
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: process.env.SMTP_PORT || 465,
  secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
  user: process.env.SMTP_USER || adminEmail,
  pass: process.env.SMTP_PASS || '',
  from: process.env.MAIL_FROM || process.env.SMTP_USER || adminEmail,
});
const works = await createWorks({ appDir, playBase: process.env.PLAY_BASE || 'https://play.langyousaikyo.top', store, playDir, packageDir, publicDir });
const postStore = await createPostStore(storageDir);
const uploads = await createUploads({ storageDir, publicDir, playDir, packageDir });

// Legacy posts had no author. Attribute them to the admin account once.
const adminUser = (await users.list()).find((u) => u.role === 'admin');
if (adminUser) {
  for (const post of await postStore.list()) {
    if (!post.authorId) {
      await postStore.update(post.id, { authorId: adminUser.id, authorName: adminUser.username, authorRole: 'admin' });
    }
  }
}

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

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Resolve the session once per request. Public visitors simply have req.user = null.
app.use(wrap(async (req, _res, next) => {
  const session = await auth.sessionFromRequest(req);
  if (session) {
    req.session = session;
    req.user = session.user;
  }
  next();
}));

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
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

const codeAttempts = new Map();
function checkCodeRate(req) {
  const key = clientKey(req);
  const now = Date.now();
  const item = codeAttempts.get(key);
  if (!item || item.resetAt < now) {
    codeAttempts.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (item.count >= 10) return false;
  item.count += 1;
  return true;
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
    res.json({
      meta: { ...meta, stats: { ...meta.stats, works: list.length, assertions: list.reduce((s, w) => s + (Number(w.tests) || 0), 0) } },
      categories: meta.categories,
    });
  } catch (err) { next(err); }
});

app.get('/api/works', async (_req, res, next) => {
  try {
    const { meta, works: list } = await works.publicWorks();
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

function decoratePost(post) {
  return {
    ...post,
    authorName: post.authorName || adminUser?.username || 'LanGYou',
    authorRole: post.authorRole || 'admin',
  };
}

app.get('/api/posts', async (_req, res, next) => {
  try {
    const list = (await postStore.list())
      .filter((p) => p.visible !== false)
      .sort((a, b) => (Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))) || String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(decoratePost);
    res.json({ posts: list });
  } catch (err) { next(err); }
});

app.get('/api/posts/:id', async (req, res, next) => {
  try {
    const post = (await postStore.list()).find((p) => p.id === req.params.id && p.visible !== false);
    if (!post) return res.status(404).json({ error: '手记不存在' });
    res.json({ post: decoratePost(post) });
  } catch (err) { next(err); }
});

app.get('/api/my/posts', requireAuth, async (req, res, next) => {
  try {
    const list = (await postStore.list())
      .filter((p) => p.authorId === req.user.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(decoratePost);
    res.json({ posts: list });
  } catch (err) { next(err); }
});

function readPostBody(body = {}) {
  const title = String(body.title || '').trim().slice(0, 120);
  const content = String(body.body || '').trim().slice(0, 20000);
  const tags = (Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(/[,，、]/))
    .map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
  return { title, content, tags };
}

app.post('/api/posts', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const { title, content, tags } = readPostBody(req.body);
    if (title.length < 2) return res.status(400).json({ error: '标题至少 2 个字符' });
    if (content.length < 1) return res.status(400).json({ error: '正文不能为空' });
    const post = await postStore.add({
      title, body: content, tags,
      pinned: req.user.role === 'admin' ? Boolean(req.body?.pinned) : false,
      visible: req.user.role === 'admin' ? req.body?.visible !== false : true,
      authorId: req.user.id,
      authorName: req.user.username,
      authorRole: req.user.role,
    });
    res.status(201).json({ ok: true, post: decoratePost(post) });
  } catch (err) { next(err); }
});

app.patch('/api/posts/:id', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const existing = (await postStore.list()).find((p) => p.id === req.params.id);
    if (!existing) return res.status(404).json({ error: '手记不存在' });
    if (existing.authorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '只能编辑自己的手记' });
    }
    const body = req.body || {};
    const patch = {};
    if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 120);
    if (typeof body.body === 'string') patch.body = body.body.trim().slice(0, 20000);
    if (Array.isArray(body.tags)) patch.tags = body.tags.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
    if (req.user.role === 'admin') {
      if (typeof body.pinned === 'boolean') patch.pinned = body.pinned;
      if (typeof body.visible === 'boolean') patch.visible = body.visible;
    }
    if (patch.title !== undefined && patch.title.length < 2) return res.status(400).json({ error: '标题至少 2 个字符' });
    if (patch.body !== undefined && patch.body.length < 1) return res.status(400).json({ error: '正文不能为空' });
    const updated = await postStore.update(req.params.id, patch);
    res.json({ ok: true, post: decoratePost(updated) });
  } catch (err) { next(err); }
});

app.delete('/api/posts/:id', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const existing = (await postStore.list()).find((p) => p.id === req.params.id);
    if (!existing) return res.status(404).json({ error: '手记不存在' });
    if (existing.authorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '只能删除自己的手记' });
    }
    await postStore.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get('/api/session', (req, res) => {
  if (!req.user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: publicUser(req.user), csrf: req.session.csrf, expiresAt: req.session.exp });
});

app.post('/api/login', async (req, res) => {
  const gate = checkRate(req);
  if (!gate.ok) return res.status(429).json({ error: '尝试次数过多，请 15 分钟后再试' });
  const identifier = String(req.body?.identifier || req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!identifier || !password) return res.status(400).json({ error: '请输入用户名/邮箱和密码' });
  const session = await auth.login(identifier, password);
  if (!session) {
    noteFailure(req);
    return res.status(401).json({ error: '用户名、邮箱或密码不正确' });
  }
  attempts.delete(clientKey(req));
  auth.setCookie(res, session.token);
  res.json({ ok: true, user: publicUser(session.user), csrf: session.csrf, expiresAt: session.exp });
});

app.post('/api/auth/send-code', async (req, res, next) => {
  try {
    if (!checkCodeRate(req)) return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    const email = normalizeEmail(req.body?.email);
    const purpose = req.body?.purpose === 'reset' ? 'reset' : 'register';
    if (!isEmail(email)) return res.status(400).json({ error: '请输入有效的邮箱' });
    const existing = await users.findByEmail(email);
    if (purpose === 'register' && existing) return res.status(409).json({ error: '这个邮箱已经注册，可以直接登录' });
    // Do not reveal whether a reset email exists.
    if (purpose === 'reset' && !existing) return res.json({ ok: true });
    const code = await codes.issue(email, purpose);
    try {
      await mailer.sendCode({ to: email, code, purpose });
    } catch (mailErr) {
      const e = new Error(mailErr.message === '邮件服务尚未配置' ? '邮件服务尚未配置，请联系管理员' : '验证码邮件发送失败，请稍后再试');
      e.status = 503;
      throw e;
    }
    res.json({ ok: true, ...(mailer.mode === 'console' ? { dev: true } : {}) });
  } catch (err) { next(err); }
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const code = String(req.body?.code || '').trim();
    if (!isEmail(email)) return res.status(400).json({ error: '请输入有效的邮箱' });
    if (!code) return res.status(400).json({ error: '请输入邮箱验证码' });
    if (String(password || '').length < 8) return res.status(400).json({ error: '密码至少需要 8 位' });
    if (await users.findByEmail(email)) return res.status(409).json({ error: '这个邮箱已经注册，可以直接登录' });
    if (await users.usernameTaken(username)) return res.status(409).json({ error: '这个用户名已被使用' });
    const ok = await codes.consume(email, 'register', code);
    if (!ok) return res.status(400).json({ error: '验证码不正确或已过期' });
    const user = await users.create({ username, email, password, role: 'user' });
    const session = auth.issue(user);
    auth.setCookie(res, session.token);
    res.status(201).json({ ok: true, user: publicUser(user), csrf: session.csrf, expiresAt: session.exp });
  } catch (err) { next(err); }
});

app.post('/api/auth/reset', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    const password = String(req.body?.password || '');
    if (!isEmail(email)) return res.status(400).json({ error: '请输入有效的邮箱' });
    if (String(password || '').length < 8) return res.status(400).json({ error: '新密码至少需要 8 位' });
    const user = await users.findByEmail(email);
    if (!user) return res.status(400).json({ error: '验证码不正确或已过期' });
    const ok = await codes.consume(email, 'reset', code);
    if (!ok) return res.status(400).json({ error: '验证码不正确或已过期' });
    const updated = await users.setPassword(user.id, password);
    const session = auth.issue(updated);
    auth.setCookie(res, session.token);
    res.json({ ok: true, user: publicUser(updated), csrf: session.csrf, expiresAt: session.exp });
  } catch (err) { next(err); }
});

app.post('/api/logout', requireAuth, requireCsrf, (req, res) => {
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
    const list = (await postStore.list())
      .sort((a, b) => (Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))) || String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(decoratePost);
    res.json({ posts: list });
  } catch (err) { next(err); }
});

app.get('/api/admin/users', requireAdmin, async (_req, res, next) => {
  try {
    const posts = await postStore.list();
    const list = (await users.list()).map((u) => ({
      ...publicUser(u),
      postCount: posts.filter((p) => p.authorId === u.id).length,
    }));
    res.json({ users: list });
  } catch (err) { next(err); }
});

app.patch('/api/admin/users/:id', requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: '不能修改自己的角色或状态' });
    const target = await users.findById(req.params.id);
    if (!target) return res.status(404).json({ error: '用户不存在' });
    const patch = {};
    if (req.body?.role === 'admin' || req.body?.role === 'user') patch.role = req.body.role;
    if (typeof req.body?.disabled === 'boolean') patch.disabled = req.body.disabled;
    if (target.role === 'admin' && (patch.role === 'user' || patch.disabled === true)) {
      const admins = (await users.list()).filter((u) => u.role === 'admin' && !u.disabled);
      if (admins.length <= 1) return res.status(400).json({ error: '至少需要保留一名管理员' });
    }
    const updated = await users.update(target.id, patch);
    res.json({ ok: true, user: publicUser(updated) });
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
    const userCount = (await users.list()).length;
    res.json({ ...stats, posts: posts.length, users: userCount, uploadBytes, uploadBytesLabel: formatBytes(uploadBytes), storageFree: null });
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

app.post('/api/account/password', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 8) return res.status(400).json({ error: '新密码至少需要 8 位' });
    const ok = await auth.changePassword(req.user.id, currentPassword, newPassword);
    if (!ok) return res.status(401).json({ error: '当前密码不正确' });
    const fresh = await users.findById(req.user.id);
    const session = auth.issue(fresh);
    auth.setCookie(res, session.token);
    res.json({ ok: true, csrf: session.csrf, expiresAt: session.exp });
  } catch (err) { next(err); }
});

app.post('/api/admin/password', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 8) return res.status(400).json({ error: '新密码至少需要 8 位' });
    const ok = await auth.changePassword(req.user.id, currentPassword, newPassword);
    if (!ok) return res.status(401).json({ error: '当前密码不正确' });
    const fresh = await users.findById(req.user.id);
    const session = auth.issue(fresh);
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
app.get(['/dashboard', '/dashboard/', '/studio', '/studio/'], wrap(async (req, res) => {
  const session = await auth.sessionFromRequest(req);
  if (!session) return res.redirect(302, '/login?t=' + Date.now());
  return sendHtml(res, 'studio.html');
}));
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
  console.log('[langyou] mail:', mailer.mode);
});

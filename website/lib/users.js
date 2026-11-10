import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir, readJson, writeJsonAtomic, safeEqual } from './util.js';
import { hashPassword, verifyPassword } from './password.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isEmail(email) {
  return EMAIL_RE.test(normalizeEmail(email));
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    disabled: Boolean(user.disabled),
  };
}

export async function createUserStore({ storageDir, adminUsername, adminEmail, adminPassword }) {
  const file = path.join(storageDir, 'users.json');
  await ensureDir(storageDir);
  let data = await readJson(file, null);

  if (!data) {
    // Migrate the previous single-owner auth.json if present.
    const legacy = await readJson(path.join(storageDir, 'auth.json'), null);
    let adminRecord = null;
    if (legacy?.salt && legacy?.hash) {
      adminRecord = {
        id: 'u_admin',
        username: adminUsername || legacy.username || 'LanGYou',
        email: normalizeEmail(adminEmail || ''),
        role: 'admin',
        salt: legacy.salt,
        hash: legacy.hash,
        verified: true,
        disabled: false,
        passwordVersion: Number(legacy.version) || 1,
        createdAt: legacy.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      if (!adminPassword || adminPassword.length < 10) throw new Error('首次启动需要 ADMIN_PASSWORD（至少 10 位）');
      if (!isEmail(adminEmail)) throw new Error('首次启动需要有效的 ADMIN_EMAIL');
      const { salt, hash } = await hashPassword(adminPassword);
      adminRecord = {
        id: 'u_admin',
        username: adminUsername || 'LanGYou',
        email: normalizeEmail(adminEmail),
        role: 'admin',
        salt, hash,
        verified: true,
        disabled: false,
        passwordVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    data = { users: [adminRecord] };
    await writeJsonAtomic(file, data);
  }

  if (!Array.isArray(data.users)) data.users = [];
  if (!data.users.some((u) => u.role === 'admin')) throw new Error('users.json 中没有管理员账号');

  let queue = Promise.resolve();
  function mutate(fn) {
    const run = queue.then(async () => {
      const current = await readJson(file, { users: [] });
      if (!Array.isArray(current.users)) current.users = [];
      const result = await fn(current);
      await writeJsonAtomic(file, current);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  async function list() {
    const current = await readJson(file, { users: [] });
    return Array.isArray(current.users) ? current.users : [];
  }

  async function findById(id) {
    return (await list()).find((u) => u.id === id) || null;
  }

  async function findByLogin(identifier) {
    const value = String(identifier || '').trim().toLowerCase();
    if (!value) return null;
    return (await list()).find((u) => String(u.username).toLowerCase() === value || normalizeEmail(u.email) === value) || null;
  }

  async function findByEmail(email) {
    const value = normalizeEmail(email);
    return (await list()).find((u) => normalizeEmail(u.email) === value) || null;
  }

  async function usernameTaken(username) {
    const value = String(username || '').trim().toLowerCase();
    return (await list()).some((u) => String(u.username).toLowerCase() === value);
  }

  async function create({ username, email, password, role = 'user' }) {
    const name = String(username || '').trim();
    const mail = normalizeEmail(email);
    if (name.length < 2 || name.length > 24) throw new Error('用户名需要 2–24 个字符');
    if (!/^[\p{L}\p{N}_-]+$/u.test(name)) throw new Error('用户名只能包含文字、字母、数字、下划线和连字符');
    if (!isEmail(mail)) throw new Error('请输入有效的邮箱');
    if (String(password || '').length < 8) throw new Error('密码至少需要 8 位');
    return mutate(async (current) => {
      if (current.users.some((u) => String(u.username).toLowerCase() === name.toLowerCase())) throw new Error('这个用户名已被使用');
      if (current.users.some((u) => normalizeEmail(u.email) === mail)) throw new Error('这个邮箱已经注册');
      const { salt, hash } = await hashPassword(password);
      const user = {
        id: 'u_' + crypto.randomBytes(8).toString('hex'),
        username: name,
        email: mail,
        role: role === 'admin' ? 'admin' : 'user',
        salt, hash,
        verified: true,
        disabled: false,
        passwordVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      current.users.push(user);
      return user;
    });
  }

  async function verifyCredentials(identifier, password) {
    const user = await findByLogin(identifier);
    if (!user || user.disabled) return null;
    const ok = await verifyPassword(password, user);
    return ok ? user : null;
  }

  async function setPassword(id, nextPassword) {
    if (String(nextPassword || '').length < 8) throw new Error('新密码至少需要 8 位');
    return mutate(async (current) => {
      const user = current.users.find((u) => u.id === id);
      if (!user) return null;
      const { salt, hash } = await hashPassword(nextPassword);
      user.salt = salt; user.hash = hash;
      user.passwordVersion = (Number(user.passwordVersion) || 1) + 1;
      user.updatedAt = new Date().toISOString();
      return user;
    });
  }

  async function update(id, patch) {
    return mutate(async (current) => {
      const user = current.users.find((u) => u.id === id);
      if (!user) return null;
      if (patch.role === 'admin' || patch.role === 'user') user.role = patch.role;
      if (typeof patch.disabled === 'boolean') user.disabled = patch.disabled;
      user.updatedAt = new Date().toISOString();
      return user;
    });
  }

  return { file, list, findById, findByLogin, findByEmail, usernameTaken, create, verifyCredentials, setPassword, update };
}
